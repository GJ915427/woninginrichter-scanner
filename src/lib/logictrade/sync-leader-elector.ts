/**
 * Gedistribueerde Lease & Leader Election Engine voor LogicTrade Continue Synchronisatie.
 * Garandeert split-brain preventie via PostgreSQL row-level leases, fail-closed pre-tick assertions
 * en strikt monotone fencing epochs ($e_{t+1} > e_t$).
 */

import { getSupabaseConfig } from '../supabase/client';

export interface SyncLeaderElectionConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  leaseKey?: string;
  ttlSeconds?: number;
  heartbeatIntervalMs?: number;
}

export class SyncLeaderElection {
  private workerId: string;
  private leaseKey: string;
  private ttlSeconds: number;
  private heartbeatIntervalMs: number;
  private supabaseUrl: string;
  private supabaseKey: string;

  private leader = false;
  private currentFencingToken: number | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(workerId: string, config: SyncLeaderElectionConfig = {}) {
    const defaultSupabase = getSupabaseConfig();
    this.workerId = workerId;
    this.leaseKey = config.leaseKey || 'logictrade_sync_master';
    this.ttlSeconds = config.ttlSeconds || 15;
    this.heartbeatIntervalMs = config.heartbeatIntervalMs || 5000;
    this.supabaseUrl = (config.supabaseUrl || defaultSupabase.url || '').replace(/\/+$/, '');
    this.supabaseKey = config.supabaseKey || defaultSupabase.serviceKey || defaultSupabase.anonKey || '';
  }

  isLeader(): boolean {
    return this.leader;
  }

  getFencingToken(): number | null {
    return this.currentFencingToken;
  }

  getWorkerId(): string {
    return this.workerId;
  }

  async acquireLease(): Promise<boolean> {
    try {
      const res = await fetch(`${this.supabaseUrl}/rest/v1/rpc/acquire_sync_lease`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
        },
        body: JSON.stringify({
          p_lease_key: this.leaseKey,
          p_worker_id: this.workerId,
          p_ttl_seconds: this.ttlSeconds,
        }),
      });

      if (!res.ok) {
        this.leader = false;
        return false;
      }

      const rows = (await res.json()) as Array<{ acquired: boolean; current_fencing_token: number }>;
      if (Array.isArray(rows) && rows.length > 0 && rows[0].acquired) {
        this.leader = true;
        this.currentFencingToken = rows[0].current_fencing_token;
        this.startHeartbeat();
        return true;
      }

      this.leader = false;
      this.currentFencingToken = null;
      return false;
    } catch {
      this.leader = false;
      return false;
    }
  }

  async renewHeartbeat(): Promise<boolean> {
    if (!this.leader) return false;
    return await this.acquireLease();
  }

  async assertLeadership(): Promise<boolean> {
    try {
      const res = await fetch(`${this.supabaseUrl}/rest/v1/rpc/get_sync_lease`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
        },
        body: JSON.stringify({
          p_lease_key: this.leaseKey,
        }),
      });

      if (!res.ok) {
        this.demote('get_sync_lease HTTP error');
        return false;
      }

      const rows = (await res.json()) as Array<{
        lease_key: string;
        worker_id: string;
        fencing_token: number;
        expires_at: string;
        is_active: boolean;
      }>;

      if (!Array.isArray(rows) || rows.length === 0) {
        this.demote('Lease record niet gevonden');
        return false;
      }

      const row = rows[0];
      const valid =
        row.worker_id === this.workerId &&
        row.is_active &&
        Number(row.fencing_token) === this.currentFencingToken;

      if (!valid) {
        this.demote(`Leiderschap verloren (actieve leider: ${row.worker_id}, epoch: ${row.fencing_token})`);
        return false;
      }

      return true;
    } catch (err: any) {
      this.demote(`assertLeadership netwerkfout: ${err.message}`);
      return false;
    }
  }

  async releaseLease(): Promise<boolean> {
    this.stopHeartbeat();
    try {
      const res = await fetch(`${this.supabaseUrl}/rest/v1/rpc/release_sync_lease`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
        },
        body: JSON.stringify({
          p_lease_key: this.leaseKey,
          p_worker_id: this.workerId,
        }),
      });

      this.leader = false;
      this.currentFencingToken = null;
      return res.ok;
    } catch {
      this.leader = false;
      this.currentFencingToken = null;
      return false;
    }
  }

  private demote(reason: string): void {
    if (this.leader) {
      console.warn(`[SyncLeaderElection] Worker ${this.workerId} gede-escaleerd naar STANDBY: ${reason}`);
    }
    this.leader = false;
    this.stopHeartbeat();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(async () => {
      if (this.leader) {
        await this.renewHeartbeat();
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
