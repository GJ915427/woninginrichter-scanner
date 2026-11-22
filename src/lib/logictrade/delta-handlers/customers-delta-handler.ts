/**
 * Delta Handler voor LogicTrade Klanten (Medium Lane - 5s).
 * Haalt klantmutaties op via /customers?modifiedAfter=... en persisteert
 * deze atomair in public.logictrade_customers via de Supabase DAL batch RPC.
 */

import { resolveLogicTradeConnectionConfig } from '../connection-config';
import { defaultRateLimiter, RateLimiter } from '../rate-limiter';
import { upsertCustomersBatch, CustomerBronzeRow } from '@/lib/supabase/client';

export interface CustomerDeltaHandlerOptions {
  baseUrl?: string;
  apiKey?: string;
  adminGuid?: string;
  fetchFn?: typeof fetch;
  limiter?: RateLimiter;
  upsertFn?: typeof upsertCustomersBatch;
}

export class CustomerDeltaHandler {
  readonly domain = 'customers';
  private baseUrl: string;
  private apiKey: string;
  private adminGuid?: string;
  private fetchFn: typeof fetch;
  private limiter: RateLimiter;
  private upsertFn: typeof upsertCustomersBatch;

  constructor(options: CustomerDeltaHandlerOptions = {}) {
    const conn = resolveLogicTradeConnectionConfig({ apiKey: options.apiKey, baseUrl: options.baseUrl });
    this.baseUrl = conn.baseUrl.replace(/\/+$/, '');
    this.apiKey = conn.apiKey || '';
    this.adminGuid = options.adminGuid || process.env.LOGICTRADE_ADMIN_GUID;
    this.fetchFn = options.fetchFn || fetch.bind(globalThis);
    this.limiter = options.limiter || defaultRateLimiter;
    this.upsertFn = options.upsertFn || upsertCustomersBatch;
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
      const url = `${this.baseUrl}/customers?modifiedAfter=${encodeURIComponent(effectiveSince)}&pageSize=100&pageNumber=${page}`;
      const res = await this.limiter.fetchWithAdaptiveBackoff(url, {
        headers: this.getHeaders(),
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`CustomerDeltaHandler HTTP fout ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      const results: any[] = Array.isArray(data) ? data : data.results || data.data || [];
      const totalPages = data.pagination?.totalPages ?? data.totalPages ?? 1;

      if (!results || results.length === 0) {
        break;
      }

      const payload: CustomerBronzeRow[] = results.map((c) => {
        const modDate = c.modifiedDate || c.updatedAt || c.createdDate || '';
        if (modDate && (!latestModifiedDate || new Date(modDate) > new Date(latestModifiedDate))) {
          latestModifiedDate = modDate;
        }

        return {
          id: c.id,
          customer_number: c.customerNumber || c.code || String(c.id),
          name: c.name || c.companyName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Onbekend',
          search_name: c.searchName || c.name || c.companyName || null,
          is_active: c.isActive !== false,
          lt_raw_data: c,
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
