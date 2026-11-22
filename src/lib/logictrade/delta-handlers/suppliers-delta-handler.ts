/**
 * Delta Handler voor LogicTrade Leveranciers (Slow Lane - 30s).
 * Haalt leveranciersmutaties op via /suppliers?modifiedAfter=... en persisteert
 * deze atomair in public.logictrade_suppliers via de Supabase DAL batch RPC.
 */

import { resolveLogicTradeConnectionConfig } from '../connection-config';
import { defaultRateLimiter, RateLimiter } from '../rate-limiter';
import { upsertSuppliersBatch, SupplierBronzeRow } from '@/lib/supabase/client';

export interface SupplierDeltaHandlerOptions {
  baseUrl?: string;
  apiKey?: string;
  adminGuid?: string;
  fetchFn?: typeof fetch;
  limiter?: RateLimiter;
  upsertFn?: typeof upsertSuppliersBatch;
}

export class SupplierDeltaHandler {
  readonly domain = 'suppliers';
  private baseUrl: string;
  private apiKey: string;
  private adminGuid?: string;
  private fetchFn: typeof fetch;
  private limiter: RateLimiter;
  private upsertFn: typeof upsertSuppliersBatch;

  constructor(options: SupplierDeltaHandlerOptions = {}) {
    const conn = resolveLogicTradeConnectionConfig({ apiKey: options.apiKey, baseUrl: options.baseUrl });
    this.baseUrl = conn.baseUrl.replace(/\/+$/, '');
    this.apiKey = conn.apiKey || '';
    this.adminGuid = options.adminGuid || process.env.LOGICTRADE_ADMIN_GUID;
    this.fetchFn = options.fetchFn || fetch.bind(globalThis);
    this.limiter = options.limiter || defaultRateLimiter;
    this.upsertFn = options.upsertFn || upsertSuppliersBatch;
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
      const url = `${this.baseUrl}/suppliers?modifiedAfter=${encodeURIComponent(effectiveSince)}&pageSize=100&pageNumber=${page}`;
      const res = await this.limiter.fetchWithAdaptiveBackoff(url, {
        headers: this.getHeaders(),
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`SupplierDeltaHandler HTTP fout ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      const results: any[] = Array.isArray(data) ? data : data.results || data.data || [];
      const totalPages = data.pagination?.totalPages ?? data.totalPages ?? 1;

      if (!results || results.length === 0) {
        break;
      }

      const payload: SupplierBronzeRow[] = results.map((s) => {
        const modDate = s.modifiedDate || s.updatedAt || s.createdDate || '';
        if (modDate && (!latestModifiedDate || new Date(modDate) > new Date(latestModifiedDate))) {
          latestModifiedDate = modDate;
        }

        return {
          id: s.id,
          code: s.code || s.supplierNumber || String(s.id),
          name: s.name || s.companyName || 'Onbekend',
          search_name: s.searchName || s.name || s.companyName || null,
          is_active: s.isActive !== false,
          lt_raw_data: s,
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
