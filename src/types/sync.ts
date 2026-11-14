/**
 * src/types/sync.ts
 *
 * Gedeelde typecontracten voor LogicTrade <-> Supabase incremental sync cursors,
 * leader leases en synchronisatie-resultaten.
 */

export interface SyncStateRecord {
  key: string;
  last_synced_at: string;
  total_synced: number;
  high_watermark_id?: string | null;
  metadata?: Record<string, unknown>;
  leader_id?: string | null;
  leader_lease_expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LeaseAcquisitionResult {
  acquired: boolean;
  lease_key: string;
  owner_id: string | null;
  expires_at: string | null;
}

export interface SyncDaemonConfig {
  ordersCursorKey: string;
  quotesCursorKey: string;
  leaseKey: string;
  leaseTtlSeconds: number;
  intervalMs: number;
  batchSize: number;
}

export interface SyncDaemonStatus {
  running: boolean;
  leaderId: string | null;
  lastRunAt: string | null;
  ordersCursor?: SyncStateRecord | null;
  quotesCursor?: SyncStateRecord | null;
  lastError?: string | null;
}

export interface OrderSyncResult {
  success: boolean;
  ordersProcessed: number;
  quotesProcessed: number;
  errors: string[];
  cursorUpdatedTo?: string;
}
