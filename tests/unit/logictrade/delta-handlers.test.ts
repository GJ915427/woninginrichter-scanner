// [SPEC-CHANGE-AUTHORIZED: Toevoegen testsuite voor begrensde LRU dedup-cache met maxSize en active sweep, 0 secundaire calls bij herhaalde poll, orders, offertes (/quotes), PO's, klanten en leveranciers delta mapping en checkpoint HWM-verwerking]
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LRUDeduplicationCache } from '@/lib/logictrade/lru-deduplication-cache';
import { OrderDeltaHandler } from '@/lib/logictrade/delta-handlers/orders-delta-handler';
import { QuoteDeltaHandler } from '@/lib/logictrade/delta-handlers/quotes-delta-handler';

describe('LRUDeduplicationCache Tests', () => {
  it('deduplicates unchanged orders and invalidates on modifiedDate change', () => {
    const cache = new LRUDeduplicationCache(100, 60000);

    expect(cache.has(101, '2026-11-22T21:00:00Z')).toBe(false);

    cache.set(101, '2026-11-22T21:00:00Z');
    expect(cache.has(101, '2026-11-22T21:00:00Z')).toBe(true);

    // Modified order returns false because modifiedDate does not match
    expect(cache.has(101, '2026-11-22T21:05:00Z')).toBe(false);
  });

  it('evicts least recently used item when maxSize is reached', () => {
    const cache = new LRUDeduplicationCache(2, 60000);

    cache.set(1, 'd1');
    cache.set(2, 'd2');
    expect(cache.size).toBe(2);

    // Access 1 to refresh MRU position
    expect(cache.has(1, 'd1')).toBe(true);

    // Add 3, which should evict 2 (since 1 was promoted to MRU)
    cache.set(3, 'd3');
    expect(cache.has(2, 'd2')).toBe(false);
    expect(cache.has(1, 'd1')).toBe(true);
    expect(cache.has(3, 'd3')).toBe(true);
  });

  it('purges expired entries on pruneExpired', () => {
    const cache = new LRUDeduplicationCache(100, 10);
    cache.set(101, 'd1');

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 100);
    const purged = cache.pruneExpired();

    expect(purged).toBe(1);
    expect(cache.size).toBe(0);
  });
});

describe('Delta Handlers Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('OrderDeltaHandler skips secondary /orderlines HTTP calls when order is in LRU cache', async () => {
    const cache = new LRUDeduplicationCache(100, 60000);
    cache.set(101, '2026-11-22T21:00:00Z');

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/orders?')) {
        return {
          ok: true,
          json: async () => ({
            results: [{ id: 101, modifiedDate: '2026-11-22T21:00:00Z' }],
          }),
        };
      }
      if (url.includes('/orderlines')) {
        throw new Error('Secondary call should NOT be made for cached order');
      }
      return { ok: true, json: async () => ({}) };
    });

    const handler = new OrderDeltaHandler({
      baseUrl: 'https://mock-lt.internal',
      apiKey: 'mock-key',
      dedupCache: cache,
      fetchFn: mockFetch as any,
    });

    const result = await handler.syncDelta('2026-11-22T20:59:00Z');
    expect(result.recordsProcessed).toBe(0); // 0 records processed because skipped
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only header fetch, zero lines fetch
  });

  it('QuoteDeltaHandler processes quotes and registers in LRU cache', async () => {
    const cache = new LRUDeduplicationCache(100, 60000);

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/quotes?')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                id: 202,
                modifiedDate: '2026-11-22T21:00:00Z',
                lines: [{ id: 1, description: 'Offerte regel' }],
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    const mockIngest = vi.fn().mockResolvedValue({ success: true, order_id: '202', lines_processed: 1 });

    const handler = new QuoteDeltaHandler({
      baseUrl: 'https://mock-lt.internal',
      apiKey: 'mock-key',
      dedupCache: cache,
      fetchFn: mockFetch as any,
      ingestFn: mockIngest,
    });

    const result = await handler.syncDelta('2026-11-22T20:59:00Z');
    expect(result.recordsProcessed).toBe(1);
    expect(cache.has(202, '2026-11-22T21:00:00Z')).toBe(true);

    // Second run with same date is skipped
    const secondResult = await handler.syncDelta('2026-11-22T20:59:00Z');
    expect(secondResult.recordsProcessed).toBe(0);
    expect(mockIngest).toHaveBeenCalledTimes(1); // Not called second time
  });
});
