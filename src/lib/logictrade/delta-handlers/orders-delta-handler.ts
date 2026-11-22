/**
 * Delta Handler voor LogicTrade Verkooporders (Fast Lane - 1s).
 * Maakt gebruik van de LRUDeduplicationCache om redundante /orderlines HTTP calls
 * en overbodige database writes binnen het overlap-venster categorisch uit te sluiten.
 */

import { resolveLogicTradeConnectionConfig } from '../connection-config';
import { defaultRateLimiter, RateLimiter } from '../rate-limiter';
import { LRUDeduplicationCache } from '../lru-deduplication-cache';
import { OrderIntakeService, mapLogicTradeOrderToRawInput } from '@/domain/orders/order-intake-service';
import { ingestOrderTransaction } from '@/lib/supabase/order-client';

export interface OrderDeltaHandlerOptions {
  baseUrl?: string;
  apiKey?: string;
  adminGuid?: string;
  dedupCache?: LRUDeduplicationCache;
  fetchFn?: typeof fetch;
  limiter?: RateLimiter;
  intakeService?: OrderIntakeService;
  ingestFn?: typeof ingestOrderTransaction;
}

export class OrderDeltaHandler {
  readonly domain = 'orders';
  private baseUrl: string;
  private apiKey: string;
  private adminGuid?: string;
  private dedupCache: LRUDeduplicationCache;
  private fetchFn: typeof fetch;
  private limiter: RateLimiter;
  private intakeService: OrderIntakeService;
  private ingestFn: typeof ingestOrderTransaction;

  constructor(options: OrderDeltaHandlerOptions = {}) {
    const conn = resolveLogicTradeConnectionConfig({ apiKey: options.apiKey, baseUrl: options.baseUrl });
    this.baseUrl = conn.baseUrl.replace(/\/+$/, '');
    this.apiKey = conn.apiKey || '';
    this.adminGuid = options.adminGuid || process.env.LOGICTRADE_ADMIN_GUID;
    this.dedupCache = options.dedupCache || new LRUDeduplicationCache();
    this.fetchFn = options.fetchFn || fetch.bind(globalThis);
    this.limiter = options.limiter || defaultRateLimiter;
    this.intakeService = options.intakeService || new OrderIntakeService();
    this.ingestFn = options.ingestFn || ingestOrderTransaction;
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
      const url = `${this.baseUrl}/orders?modifiedAfter=${encodeURIComponent(effectiveSince)}&pageSize=100&pageNumber=${page}`;
      const res = await this.limiter.fetchWithAdaptiveBackoff(
        url,
        {
          headers: this.getHeaders(),
          cache: 'no-store',
        },
        this.fetchFn
      );

      if (!res.ok) {
        throw new Error(`OrderDeltaHandler HTTP fout ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      const results: any[] = Array.isArray(data) ? data : data.results || data.data || [];
      const totalPages = data.pagination?.totalPages ?? data.totalPages ?? 1;

      if (!results || results.length === 0) {
        break;
      }

      for (const order of results) {
        const orderId = order.id;
        const modifiedDate = order.modifiedDate || order.date || order.createdDate || '';

        // 1. LRU Dedup-Check: sla over als reeds verwerkt met identieke modifiedDate
        if (modifiedDate && this.dedupCache.has(orderId, modifiedDate)) {
          continue;
        }

        // 2. Haal regels op via secundaire call
        const linesUrl = `${this.baseUrl}/orders/${orderId}/orderlines`;
        const linesRes = await this.limiter.fetchWithAdaptiveBackoff(
          linesUrl,
          {
            headers: this.getHeaders(),
            cache: 'no-store',
          },
          this.fetchFn
        );

        const linesData = linesRes.ok ? await linesRes.json() : [];
        const lines = Array.isArray(linesData) ? linesData : linesData.results || linesData.data || [];

        // 3. Verwerk via OrderIntakeService en persisteer
        const rawInput = mapLogicTradeOrderToRawInput(order, lines, { isQuote: false });
        const bundle = await this.intakeService.processOrderIntake(rawInput);
        await this.ingestFn(bundle);

        // 4. Registreer in LRU Cache
        if (modifiedDate) {
          this.dedupCache.set(orderId, modifiedDate);
          if (!latestModifiedDate || new Date(modifiedDate) > new Date(latestModifiedDate)) {
            latestModifiedDate = modifiedDate;
          }
        }

        recordsProcessed++;
      }

      page++;
      hasMorePages = page <= totalPages && results.length >= 100;
    } while (hasMorePages);

    return { recordsProcessed, latestModifiedDate };
  }
}
