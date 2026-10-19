import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimiter } from '@/lib/logictrade/rate-limiter';
import { harvestCatalogRange, getHarvestCheckpoint, saveHarvestCheckpoint } from '@/lib/logictrade/harvest-service';
import * as supabaseClient from '@/lib/supabase/client';
import * as syncService from '@/lib/logictrade/sync-service';
import { GET as adminSyncGET, POST as adminSyncPOST } from '@/app/api/admin/sync/route';

describe('Tranche 3B: Rate Limiter & Catalog Harvester Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RateLimiter Engine', () => {
    it('spaces sequential requests by at least minDelayMs', async () => {
      const limiter = new RateLimiter({ minDelayMs: 20 });
      const t0 = Date.now();
      await limiter.pace();
      await limiter.pace();
      const elapsed = Date.now() - t0;
      expect(elapsed).toBeGreaterThanOrEqual(18);
    });

    it('retries with exponential backoff when receiving HTTP 429 and eventually succeeds', async () => {
      const limiter = new RateLimiter({ minDelayMs: 1, baseBackoffMs: 10, maxRetries: 2 });
      let callCount = 0;

      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response('Too Many Requests', { status: 429 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      });

      // Vervang global fetch tijdelijk
      vi.stubGlobal('fetch', mockFetch);

      const res = await limiter.fetchWithAdaptiveBackoff('https://example.com/api');
      expect(res.status).toBe(200);
      expect(callCount).toBe(2);
    });

    it('throws error when maxRetries is exceeded on persistent 429', async () => {
      const limiter = new RateLimiter({ minDelayMs: 1, baseBackoffMs: 5, maxRetries: 2 });
      const mockFetch = vi.fn().mockResolvedValue(new Response('Too Many Requests', { status: 429 }));
      vi.stubGlobal('fetch', mockFetch);

      await expect(limiter.fetchWithAdaptiveBackoff('https://example.com/api')).rejects.toThrow(
        /RateLimiter: Maximaal aantal herhaalpogingen/
      );
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initiële call + 2 retries
    });
  });

  describe('HarvestService Resumable Batch Paging', () => {
    it('saves and retrieves checkpoints accurately', async () => {
      vi.spyOn(supabaseClient, 'getSyncState').mockResolvedValueOnce({
        key: 'catalog_harvest_checkpoint',
        total_synced: 42,
        last_synced_at: '2026-10-06T20:00:00.000Z'
      });

      const checkpoint = await getHarvestCheckpoint();
      expect(checkpoint.lastPage).toBe(42);

      const updateSpy = vi.spyOn(supabaseClient, 'updateSyncState').mockResolvedValue();
      await saveHarvestCheckpoint(50, 5000);
      expect(updateSpy).toHaveBeenCalledWith('catalog_harvest_checkpoint', 50, expect.any(String));
      expect(updateSpy).toHaveBeenCalledWith('catalog_sync', 5000, expect.any(String));
    });

    it('harvests requested range and calls syncProductsBatch for each page', async () => {
      const limiter = new RateLimiter({ minDelayMs: 1 });
      const syncSpy = vi.spyOn(syncService, 'syncProductsBatch').mockResolvedValue(100);
      vi.spyOn(supabaseClient, 'updateSyncState').mockResolvedValue();

      let pageRequested = 0;
      const mockFetch = vi.fn().mockImplementation(async (url: any) => {
        pageRequested++;
        return new Response(
          JSON.stringify({
            results: [{ id: pageRequested, code: `PROD-${pageRequested}`, name: `Item ${pageRequested}`, salesPrice: 50 }],
            pagination: { totalResults: 300, totalPages: 3, pageNumber: pageRequested, pageSize: 100 }
          }),
          { status: 200 }
        );
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await harvestCatalogRange({
        fromPage: 1,
        limitPages: 2,
        pageSize: 100,
        rateLimiter: limiter
      });

      expect(result.totalPagesProcessed).toBe(2);
      expect(result.totalProductsSynced).toBe(200);
      expect(result.lastPage).toBe(2);
      expect(syncSpy).toHaveBeenCalledTimes(2);
    });

    it('resumes from checkpoint when resume option is true', async () => {
      const limiter = new RateLimiter({ minDelayMs: 1 });
      vi.spyOn(supabaseClient, 'getSyncState').mockResolvedValue({
        key: 'catalog_harvest_checkpoint',
        total_synced: 10,
        last_synced_at: '2026-10-06T20:00:00.000Z'
      });
      vi.spyOn(syncService, 'syncProductsBatch').mockResolvedValue(100);
      vi.spyOn(supabaseClient, 'updateSyncState').mockResolvedValue();

      let requestedPageNumber = 0;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        const u = new URL(url);
        requestedPageNumber = Number(u.searchParams.get('pageNumber'));
        return new Response(
          JSON.stringify({
            results: [{ id: 100, code: 'RESUMED', name: 'Resumed Item', salesPrice: 10 }],
            pagination: { totalResults: 2000, totalPages: 20, pageNumber: requestedPageNumber, pageSize: 100 }
          }),
          { status: 200 }
        );
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await harvestCatalogRange({
        resume: true,
        limitPages: 1,
        rateLimiter: limiter
      });

      expect(requestedPageNumber).toBe(11); // Start vanaf checkpoint (10 + 1)
      expect(result.lastPage).toBe(11);
    });
  });

  describe('Admin Sync API Route', () => {
    it('GET /api/admin/sync returns current sync status and checkpoint', async () => {
      vi.spyOn(supabaseClient, 'getSyncState').mockResolvedValueOnce({
        key: 'catalog_sync',
        total_synced: 100921,
        last_synced_at: '2026-10-06T20:30:00.000Z',
        updated_at: '2026-10-06T20:30:00.000Z'
      });
      vi.spyOn(supabaseClient, 'getSyncState').mockResolvedValueOnce({
        key: 'catalog_harvest_checkpoint',
        total_synced: 1010,
        last_synced_at: '2026-10-06T20:30:00.000Z'
      });

      const res = await adminSyncGET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.totalSynced).toBe(100921);
      expect(json.data.checkpointPage).toBe(1010);
    });

    it('POST /api/admin/sync executes delta sync and returns result', async () => {
      vi.spyOn(syncService, 'executeDeltaSync').mockResolvedValueOnce({
        syncedCount: 15,
        lastSyncedAt: '2026-10-06T21:00:00.000Z'
      });

      const req = new Request('http://localhost:8089/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceSince: '2026-10-06T20:00:00.000Z' })
      });

      const res = await adminSyncPOST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.syncedCount).toBe(15);
      expect(json.data.lastSyncedAt).toBe('2026-10-06T21:00:00.000Z');
    });
  });
});
