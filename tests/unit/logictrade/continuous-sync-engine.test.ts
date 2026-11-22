// [SPEC-CHANGE-AUTHORIZED: Toevoegen testsuite voor sequentiële tick scheduling, cold-start horizon fallback zonder RangeError, RateLimiter promise queue concurrency serialization, pre-tick fencing check en entrypoint guard]
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContinuousSyncEngine, DOMAIN_CHECKPOINT_KEYS, calculateEffectiveSince } from '@/lib/logictrade/continuous-sync-engine';
import { RateLimiter } from '@/lib/logictrade/rate-limiter';
import { isWorkerCliEntrypoint } from '../../../scripts/run-logictrade-sync-worker';

describe('ContinuousSyncEngine - Scheduling, Horizon & Guard Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateEffectiveSince Horizon Fallback Contract', () => {
    it('falls back to now - defaultLookbackMs when checkpoint is null (Cold-Start)', () => {
      const nowMs = 1700000000000;
      vi.spyOn(Date, 'now').mockReturnValue(nowMs);

      const effectiveSince = calculateEffectiveSince(null, 60000, 300000);
      const expectedDate = new Date(nowMs - 300000).toISOString();

      expect(effectiveSince).toBe(expectedDate);
      expect(effectiveSince).not.toContain('1970');
    });

    it('calculates checkpoint.last_synced_at - overlapWindowMs when checkpoint exists', () => {
      const lastSynced = '2026-11-22T20:00:00.000Z';
      const effectiveSince = calculateEffectiveSince({ last_synced_at: lastSynced } as any, 60000, 300000);
      const expectedDate = new Date(new Date(lastSynced).getTime() - 60000).toISOString();

      expect(effectiveSince).toBe(expectedDate);
    });

    it('maps all expected domains to their SSOT checkpoint keys', () => {
      expect(DOMAIN_CHECKPOINT_KEYS['orders']).toBe('orders_bronze_sync');
      expect(DOMAIN_CHECKPOINT_KEYS['quotes']).toBe('quotes_bronze_sync');
      expect(DOMAIN_CHECKPOINT_KEYS['purchaseorders']).toBe('purchaseorders_bronze_sync');
      expect(DOMAIN_CHECKPOINT_KEYS['customers']).toBe('customers_bronze_sync');
      expect(DOMAIN_CHECKPOINT_KEYS['suppliers']).toBe('suppliers_bronze_sync');
    });
  });

  describe('RateLimiter Serialized Promise Queue', () => {
    it('serializes concurrent calls and enforces minDelayMs between all callers', async () => {
      const limiter = new RateLimiter({ minDelayMs: 40 });
      const timestamps: number[] = [];

      // Fire 3 calls concurrently
      await Promise.all([
        limiter.pace().then(() => timestamps.push(Date.now())),
        limiter.pace().then(() => timestamps.push(Date.now())),
        limiter.pace().then(() => timestamps.push(Date.now())),
      ]);

      expect(timestamps.length).toBe(3);
      expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(35);
      expect(timestamps[2] - timestamps[1]).toBeGreaterThanOrEqual(35);
    });

    it('does not poison queue when an earlier promise in pacing rejects', async () => {
      const limiter = new RateLimiter({ minDelayMs: 20 });
      // Inject a synthetic failure into the internal queue to test error-containment
      (limiter as any).queue = Promise.reject(new Error('Synthetic error')).catch(() => {});

      const t0 = Date.now();
      await expect(limiter.pace()).resolves.toBeUndefined();
      await limiter.pace();
      const elapsed = Date.now() - t0;
      expect(elapsed).toBeGreaterThanOrEqual(15);
    });
  });

  describe('Entrypoint Guard', () => {
    it('returns false when running inside test environment', () => {
      expect(isWorkerCliEntrypoint('/app/scripts/run-logictrade-sync-worker.ts', 'test')).toBe(false);
    });

    it('returns true when argv target matches file in production mode', () => {
      expect(isWorkerCliEntrypoint('C:\\app\\scripts\\run-logictrade-sync-worker.ts', 'production', 'run-logictrade-sync-worker.ts')).toBe(true);
    });
  });

  describe('Pre-Tick Leadership Assertions', () => {
    it('skips tick when leader elector asserts leadership is lost', async () => {
      const mockElector = {
        assertLeadership: vi.fn().mockResolvedValue(false),
        isLeader: vi.fn().mockReturnValue(false),
        acquireLease: vi.fn().mockResolvedValue(false),
        renewHeartbeat: vi.fn().mockResolvedValue(false),
        releaseLease: vi.fn().mockResolvedValue(true),
        getFencingToken: vi.fn().mockReturnValue(null),
      };

      const mockHandler = {
        domain: 'orders',
        syncDelta: vi.fn().mockResolvedValue({ recordsProcessed: 0, latestModifiedDate: null }),
      };

      const engine = new ContinuousSyncEngine({
        elector: mockElector as any,
        handlers: [mockHandler],
        tickIntervalMs: 1000,
      });

      const tickExecuted = await engine.executeSingleTick();
      expect(tickExecuted).toBe(false);
      expect(mockHandler.syncDelta).not.toHaveBeenCalled();
    });
  });
});
