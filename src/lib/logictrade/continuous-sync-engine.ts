/**
 * Centrale Continue Delta Synchronisatie Engine voor LogicTrade Cloud REST API.
 * Voert deterministische sequentiële scheduling uit over multi-lane domeinen,
 * bewaakt pre-tick leiderschap via de SyncLeaderElection actor en garandeert 0 dataverlies.
 */

import { getSyncState, updateSyncState, SyncStateRow } from '../supabase/client';
import { SyncLeaderElection } from './sync-leader-elector';

export const DOMAIN_CHECKPOINT_KEYS: Record<string, string> = {
  orders: 'orders_bronze_sync',
  quotes: 'quotes_bronze_sync',
  purchaseorders: 'purchaseorders_bronze_sync',
  customers: 'customers_bronze_sync',
  suppliers: 'suppliers_bronze_sync',
};

export const DEFAULT_DOMAIN_INTERVALS_MS: Record<string, number> = {
  orders: 1000,
  quotes: 1000,
  purchaseorders: 5000,
  customers: 5000,
  suppliers: 30000,
};

export function calculateEffectiveSince(
  checkpoint: SyncStateRow | null | undefined,
  overlapWindowMs = 60000,
  defaultLookbackMs = 300000
): string {
  if (checkpoint && checkpoint.last_synced_at) {
    const checkpointMs = new Date(checkpoint.last_synced_at).getTime();
    if (!isNaN(checkpointMs) && checkpointMs > 0) {
      return new Date(checkpointMs - overlapWindowMs).toISOString();
    }
  }

  // Cold-start fallback: voorkomt RangeError en prehistorische 1970 lookback
  return new Date(Date.now() - defaultLookbackMs).toISOString();
}

export interface IDeltaDomainHandler {
  domain: string;
  syncDelta(effectiveSince: string): Promise<{ recordsProcessed: number; latestModifiedDate: string | null }>;
}

export interface ContinuousSyncEngineConfig {
  elector: SyncLeaderElection;
  handlers: IDeltaDomainHandler[];
  tickIntervalMs?: number;
  overlapWindowMs?: number;
  defaultLookbackMs?: number;
  domainIntervalsMs?: Record<string, number>;
}

export class ContinuousSyncEngine {
  private elector: SyncLeaderElection;
  private handlers: IDeltaDomainHandler[];
  private tickIntervalMs: number;
  private overlapWindowMs: number;
  private defaultLookbackMs: number;
  private domainIntervalsMs: Record<string, number>;

  private domainLastRunAt: Record<string, number> = {};
  private isRunning = false;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: ContinuousSyncEngineConfig) {
    this.elector = config.elector;
    this.handlers = config.handlers;
    this.tickIntervalMs = config.tickIntervalMs ?? 1000;
    this.overlapWindowMs = config.overlapWindowMs ?? 60000;
    this.defaultLookbackMs = config.defaultLookbackMs ?? 300000;
    this.domainIntervalsMs = {
      ...DEFAULT_DOMAIN_INTERVALS_MS,
      ...(config.domainIntervalsMs || {}),
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[ContinuousSyncEngine] Worker ${this.elector.getWorkerId()} gestart.`);
    this.scheduleNextTick(0);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    await this.elector.releaseLease();
    console.log(`[ContinuousSyncEngine] Worker ${this.elector.getWorkerId()} gestopt en lease vrijgegeven.`);
  }

  async executeSingleTick(): Promise<boolean> {
    // 1. Fail-closed pre-tick leiderschapscontrole
    const isLeader = await this.elector.assertLeadership();
    if (!isLeader) {
      // Indien geen actieve leider: probeer leiderschap te verwerven
      const acquired = await this.elector.acquireLease();
      if (!acquired) {
        return false;
      }
    }

    const now = Date.now();

    // 2. Deterministische domein-sequencing met tijdstempels
    for (const handler of this.handlers) {
      if (!this.isRunning && this.loopTimer !== null) break;

      const domain = handler.domain;
      const intervalMs = this.domainIntervalsMs[domain] ?? 5000;
      const lastRun = this.domainLastRunAt[domain] || 0;

      if (now - lastRun < intervalMs) {
        continue;
      }

      try {
        const checkpointKey = DOMAIN_CHECKPOINT_KEYS[domain] || `${domain}_bronze_sync`;
        const checkpoint = await getSyncState(checkpointKey);
        const effectiveSince = calculateEffectiveSince(checkpoint, this.overlapWindowMs, this.defaultLookbackMs);

        const result = await handler.syncDelta(effectiveSince);

        if (result.recordsProcessed > 0 || result.latestModifiedDate) {
          const nextHwm = result.latestModifiedDate || new Date().toISOString();
          await updateSyncState(checkpointKey, result.recordsProcessed, nextHwm);
        }

        this.domainLastRunAt[domain] = Date.now();
      } catch (err: any) {
        console.error(`[ContinuousSyncEngine] Fout bij delta sync voor domein '${domain}':`, err.message);
      }
    }

    return true;
  }

  private scheduleNextTick(delayMs: number): void {
    if (!this.isRunning) return;

    this.loopTimer = setTimeout(async () => {
      const t0 = Date.now();
      try {
        await this.executeSingleTick();
      } catch (err: any) {
        console.error('[ContinuousSyncEngine] Onverwachte tick fout:', err.message);
      }

      const elapsed = Date.now() - t0;
      const nextDelay = Math.max(50, this.tickIntervalMs - elapsed);
      this.scheduleNextTick(nextDelay);
    }, delayMs);
  }
}
