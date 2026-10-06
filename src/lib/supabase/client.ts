/**
 * Lightweight, zero-dependency Supabase Client voor PostgREST & RPC endpoints.
 * Gebruikt native Web Fetch en ondersteunt veilige graceful degradation.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceKey?: string;
}

export interface FtsProductRow {
  id: number;
  code: string;
  name: string;
  description: string;
  supplier_id: number | null;
  supplier_name: string;
  supplier_code: string;
  group_name: string;
  groups: string[];
  sales_group: string;
  sales_price: number;
  vat_code: string;
  unit: string;
  raw_data: Record<string, any>;
  rank: number;
  total_count: number | string;
}

export interface SyncStateRow {
  key: string;
  last_synced_at: string;
  total_synced: number;
  updated_at?: string;
}

const DEFAULT_SUPABASE_URL = 'https://cizpyycszaszknffofhq.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpenB5eWNzemFzemtuZmZvZmhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDM5NjksImV4cCI6MjEwNjE3OTk2OX0.GAW_ETVoIN2stQ79-nPSkjqF5mnlx6rMASyfNRY7G6w';

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return { url, anonKey, serviceKey };
}

export function isSupabaseConfigured(): boolean {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey);
}

export async function searchProductsFts(
  query: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ rows: FtsProductRow[]; totalCount: number }> {
  const { url, anonKey, serviceKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    return { rows: [], totalCount: 0 };
  }

  const endpoint = `${url}/rest/v1/rpc/search_logictrade_products`;
  const token = serviceKey || anonKey;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: token,
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      search_query: query,
      limit_count: limit,
      offset_count: offset
    }),
    cache: 'no-store'
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Supabase RPC search error (HTTP ${res.status}): ${errorText}`);
  }

  const rows = (await res.json()) as FtsProductRow[];
  const totalCount = rows.length > 0 ? Number(rows[0].total_count || rows.length) : 0;

  return { rows, totalCount };
}

export async function getSyncState(key: string = 'catalog_sync'): Promise<SyncStateRow | null> {
  const { url, anonKey, serviceKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;

  const endpoint = `${url}/rest/v1/logictrade_sync_state?key=eq.${encodeURIComponent(key)}&select=*`;
  const token = serviceKey || anonKey;

  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`
    },
    cache: 'no-store'
  });

  if (!res.ok) return null;
  const data = (await res.json()) as SyncStateRow[];
  return data.length > 0 ? data[0] : null;
}

export async function updateSyncState(
  key: string = 'catalog_sync',
  totalSynced: number,
  lastSyncedAt: string
): Promise<void> {
  const { url, anonKey, serviceKey } = getSupabaseConfig();
  if (!url || !anonKey) return;

  const endpoint = `${url}/rest/v1/logictrade_sync_state`;
  const token = serviceKey || anonKey;

  await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: token,
      Authorization: `Bearer ${token}`,
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      key,
      total_synced: totalSynced,
      last_synced_at: lastSyncedAt,
      updated_at: new Date().toISOString()
    })
  });
}

export async function upsertProductsBatch(
  products: Record<string, any>[]
): Promise<{ success: boolean; count: number }> {
  if (products.length === 0) return { success: true, count: 0 };

  const { url, anonKey, serviceKey } = getSupabaseConfig();
  if (!url || !anonKey) return { success: false, count: 0 };

  const endpoint = `${url}/rest/v1/logictrade_products`;
  const token = serviceKey || anonKey;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: token,
      Authorization: `Bearer ${token}`,
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify(products)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Supabase batch upsert error (HTTP ${res.status}): ${errorText}`);
  }

  return { success: true, count: products.length };
}
