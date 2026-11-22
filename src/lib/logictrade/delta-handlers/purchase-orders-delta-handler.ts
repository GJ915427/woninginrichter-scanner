/**
 * Delta Handler voor LogicTrade Inkooporders (Medium Lane - 5s).
 * Haalt mutaties op via /purchaseorders?modifiedAfter=... en persisteert
 * ze atomair inclusief regels via de Supabase DAL batch RPC.
 */

import { resolveLogicTradeConnectionConfig } from '../connection-config';
import { defaultRateLimiter, RateLimiter } from '../rate-limiter';
import { upsertPurchaseOrdersBatch, PurchaseOrderBronzeRow } from '@/lib/supabase/client';

export interface PurchaseOrderDeltaHandlerOptions {
  baseUrl?: string;
  apiKey?: string;
  adminGuid?: string;
  fetchFn?: typeof fetch;
  limiter?: RateLimiter;
  upsertFn?: typeof upsertPurchaseOrdersBatch;
}

export class PurchaseOrderDeltaHandler {
  readonly domain = 'purchaseorders';
  private baseUrl: string;
  private apiKey: string;
  private adminGuid?: string;
  private fetchFn: typeof fetch;
  private limiter: RateLimiter;
  private upsertFn: typeof upsertPurchaseOrdersBatch;

  constructor(options: PurchaseOrderDeltaHandlerOptions = {}) {
    const conn = resolveLogicTradeConnectionConfig({ apiKey: options.apiKey, baseUrl: options.baseUrl });
    this.baseUrl = conn.baseUrl.replace(/\/+$/, '');
    this.apiKey = conn.apiKey || '';
    this.adminGuid = options.adminGuid || process.env.LOGICTRADE_ADMIN_GUID;
    this.fetchFn = options.fetchFn || fetch.bind(globalThis);
    this.limiter = options.limiter || defaultRateLimiter;
    this.upsertFn = options.upsertFn || upsertPurchaseOrdersBatch;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'api-key': this.apiKey,
      Accept: 'application/json',
    };
    if (this.adminGuid) {
      headers['administration-guid'] = this.adminGuid;
    }
    return headers;
  }

  async syncDelta(effectiveSince: string): Promise<{ recordsProcessed: number; latestModifiedDate: string | null }> {
    let page = 1;
    let hasMorePages = true;
    let recordsProcessed = 0;
    let latestModifiedDate: string | null = null;

    do {
      const url = `${this.baseUrl}/purchaseorders?modifiedAfter=${encodeURIComponent(effectiveSince)}&pageSize=100&pageNumber=${page}`;
      const res = await this.limiter.fetchWithAdaptiveBackoff(url, {
        headers: this.getHeaders(),
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`PurchaseOrderDeltaHandler HTTP fout ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      const results: any[] = Array.isArray(data) ? data : data.results || data.data || [];
      const totalPages = data.pagination?.totalPages ?? data.totalPages ?? 1;

      if (!results || results.length === 0) {
        break;
      }

      const payload: PurchaseOrderBronzeRow[] = results.map((po) => {
        const modDate = po.modifiedDate || po.orderDate || po.date || '';
        if (modDate && (!latestModifiedDate || new Date(modDate) > new Date(latestModifiedDate))) {
          latestModifiedDate = modDate;
        }

        return {
          id: po.id,
          order_number: po.orderNumber || po.number || String(po.id),
          supplier_id: po.supplier?.id || po.supplierId || null,
          status: po.status || 'ORDER',
          order_date: po.orderDate || po.date || null,
          total_gross_cents: po.totalGrossCents ?? (typeof po.totalGross === 'number' ? Math.round(po.totalGross * 100) : (typeof po.totalPrice === 'number' ? Math.round(po.totalPrice * 100) : 0)),
          lt_raw_data: po,
          lines: po.lines || po.orderLines || [],
        };
      });

      await this.upsertFn(payload);
      recordsProcessed += payload.length;

      page++;
      hasMorePages = page <= totalPages && results.length >= 100;
    } while (hasMorePages);

    return { recordsProcessed, latestModifiedDate };
  }
}
