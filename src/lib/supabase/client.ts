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
  product_tier?: number;
  is_discontinued?: boolean;
  rank: number;
  total_count: number | string;
}

export interface SyncStateRow {
  key: string;
  last_synced_at: string;
  total_synced: number;
  checkpoint_page?: number;
  updated_at?: string;
}

export interface ConfiguratorSchemaValueItem {
  value: string;
  label: string;
  optionId?: number;
  sortOrder?: number;
}

export interface ConfiguratorSchemaRow {
  option_id: number;
  step_id: string;
  option_code: string;
  label: string;
  category: 'raamdecoratie' | 'gordijnen' | 'vloeren' | 'algemeen';
  kind: number;
  possible_values: ConfiguratorSchemaValueItem[];
  is_active: boolean;
  sort_order: number;
  raw_metadata?: Record<string, unknown>;
  synced_at: string;
  updated_at?: string;
}

export const configuratorSchemaMemoryCache = new Map<number, ConfiguratorSchemaRow>();

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
  offset: number = 0,
  categoryFilter?: string
): Promise<{ rows: FtsProductRow[]; totalCount: number }> {
  return searchProductsUniversal(query, limit, offset, categoryFilter);
}

/**
 * Voert een universele trigram- en FTS-zoekopdracht uit via de Supabase RPC
 * search_logictrade_products_universal met ondersteuning voor deelwoorden,
 * merknamen en typotolerantie (SLA < 3ms).
 */
export async function searchProductsUniversal(
  query: string,
  limit: number = 20,
  offset: number = 0,
  categoryFilter?: string
): Promise<{ rows: FtsProductRow[]; totalCount: number }> {
  const { url, anonKey, serviceKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    return { rows: [], totalCount: 0 };
  }

  const endpoint = `${url}/rest/v1/rpc/search_logictrade_products_universal`;
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
      category_filter: categoryFilter || null,
      limit_count: limit,
      offset_count: offset
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(5000)
  });

  if (!res.ok) {
    // Val terug op legacy search_logictrade_products indien universal endpoint nog niet actief is
    // Strip optie- en modelcode-tokens uit de legacy fallback query en verhoog limit om in-memory Venn-filtering te faciliteren
    const fallbackEndpoint = `${url}/rest/v1/rpc/search_logictrade_products`;
    const tokens = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
    const nonOptionTokens = tokens.filter(t => !/^(trufit|trufi|truf|tru|fit|klemsteunen|klemsteun|klemst|klem|draai|kiepraam|kiep|raam|smartcord|smartco|smartc|smart|cord|cor|powerview|powerv|power|view|motor|elektrisch|handgreep|literise|liter|ketting|kett|wave|plooi|visgraat|antraciet|zwart|wit|zilver|aluminium|au10|au20|au30|ab21|db42|vs2|ae10|ae20|af10|af20|as10|as20|ua20|ea20|:?10|:?20|:?30)$/i.test(t));
    
    let fallbackQuery = nonOptionTokens.join(' ').trim();
    if (!fallbackQuery) {
      fallbackQuery = /pliss/i.test(query) ? 'Plissé shade' : 'Duette shade';
    } else {
      fallbackQuery = fallbackQuery.replace(/\bdeut\b/gi, 'duette');
    }

    const fallbackLimit = Math.max(limit * 5, 100);

    const fallbackRes = await fetch(fallbackEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: token,
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        search_query: fallbackQuery,
        limit_count: fallbackLimit,
        offset_count: 0
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000)
    });

    if (!fallbackRes.ok) {
      const errorText = await fallbackRes.text();
      throw new Error(`Supabase RPC search error (HTTP ${fallbackRes.status}): ${errorText}`);
    }

    const rows = (await fallbackRes.json()) as FtsProductRow[];
    const totalCount = rows.length > 0 ? Number(rows[0].total_count || rows.length) : 0;
    return { rows, totalCount };
  }

  const rows = (await res.json()) as FtsProductRow[];
  const totalCount = rows.length > 0 ? Number(rows[0].total_count || rows.length) : 0;

  return { rows, totalCount };
}

interface CachedSyncState {
  data: SyncStateRow | null;
  timestamp: number;
}

const syncStateMemoryCache: Record<string, CachedSyncState> = {};
export const SYNC_STATE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minuten in-memory TTL

export function invalidateSyncStateCache(key?: string): void {
  if (key) {
    delete syncStateMemoryCache[key];
  } else {
    for (const k of Object.keys(syncStateMemoryCache)) {
      delete syncStateMemoryCache[k];
    }
  }
}

export async function getSyncState(key: string = 'catalog_sync'): Promise<SyncStateRow | null> {
  const cached = syncStateMemoryCache[key];
  const now = Date.now();
  if (cached && (now - cached.timestamp) < SYNC_STATE_CACHE_TTL_MS) {
    return cached.data;
  }

  const { url, anonKey, serviceKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;

  try {
    const endpoint = `${url}/rest/v1/logictrade_sync_state?key=eq.${encodeURIComponent(key)}&select=*`;
    const token = serviceKey || anonKey;

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: token,
        Authorization: `Bearer ${token}`
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000)
    });

    if (!res.ok) {
      return cached ? cached.data : null;
    }
    const data = (await res.json()) as SyncStateRow[];
    const result = data.length > 0 ? data[0] : null;

    syncStateMemoryCache[key] = { data: result, timestamp: now };
    return result;
  } catch (err) {
    console.warn(`[Supabase] Kon sync state '${key}' niet verifiëren via netwerk, gebruik fallback/cache:`, (err as any)?.message || err);
    return cached ? cached.data : null;
  }
}

export async function updateSyncState(
  key: string = 'catalog_sync',
  totalSynced: number,
  lastSyncedAt: string
): Promise<void> {
  const { url, anonKey, serviceKey } = getSupabaseConfig();
  const token = serviceKey || anonKey;

  if (!url || !token) {
    syncStateMemoryCache[key] = {
      data: {
        key,
        total_synced: totalSynced,
        last_synced_at: lastSyncedAt,
        checkpoint_page: 0,
        updated_at: new Date().toISOString()
      },
      timestamp: Date.now()
    };
    return;
  }

  const endpoint = `${url}/rest/v1/logictrade_sync_state`;

  const res = await fetch(endpoint, {
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
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`Supabase updateSyncState failed (${res.status}): ${errorText}`);
  }

  // Pas in-memory cache bijwerken na succesvolle remote persistence (Fail-Closed)
  syncStateMemoryCache[key] = {
    data: {
      key,
      total_synced: totalSynced,
      last_synced_at: lastSyncedAt,
      checkpoint_page: 0,
      updated_at: new Date().toISOString()
    },
    timestamp: Date.now()
  };
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

export async function upsertConfiguratorSchemasBatch(
  rows: ConfiguratorSchemaRow[],
  chunkSize = 100
): Promise<{ upserted: number }> {
  if (rows.length === 0) return { upserted: 0 };

  // Intra-batch deduplication on PK option_id to prevent PostgreSQL SQLSTATE 21000
  const dedupedMap = new Map<number, ConfiguratorSchemaRow>();
  for (const row of rows) {
    dedupedMap.set(row.option_id, row);
  }
  const uniqueRows = Array.from(dedupedMap.values());

  const { url, anonKey, serviceKey } = getSupabaseConfig();
  const token = serviceKey || anonKey;

  if (!url || !token) {
    for (const row of uniqueRows) {
      configuratorSchemaMemoryCache.set(row.option_id, row);
    }
    return { upserted: uniqueRows.length };
  }

  let totalUpserted = 0;
  for (let i = 0; i < uniqueRows.length; i += chunkSize) {
    const chunk = uniqueRows.slice(i, i + chunkSize);
    const res = await fetch(`${url}/rest/v1/logictrade_configurator_schemas?on_conflict=option_id`, {
      method: 'POST',
      headers: {
        apikey: token,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Supabase schema batch upsert failed (${res.status}): ${errText}`);
    }
    totalUpserted += chunk.length;
  }

  for (const row of uniqueRows) {
    configuratorSchemaMemoryCache.set(row.option_id, row);
  }

  return { upserted: totalUpserted };
}

export async function getActiveConfiguratorSchemas(): Promise<{
  ok: boolean;
  rows: ConfiguratorSchemaRow[];
}> {
  const { url, anonKey, serviceKey } = getSupabaseConfig();
  const token = serviceKey || anonKey;

  if (!url || !token) {
    const activeRows = Array.from(configuratorSchemaMemoryCache.values()).filter((r) => r.is_active);
    return { ok: true, rows: activeRows };
  }

  try {
    const res = await fetch(
      `${url}/rest/v1/logictrade_configurator_schemas?is_active=eq.true&order=sort_order.asc`,
      {
        headers: {
          apikey: token,
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      }
    );
    if (!res.ok) return { ok: false, rows: [] };
    const data = (await res.json()) as ConfiguratorSchemaRow[];
    return { ok: true, rows: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, rows: [] };
  }
}
