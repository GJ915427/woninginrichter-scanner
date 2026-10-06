import { LogicTradeProductRaw } from '@/types/product';
import {
  upsertProductsBatch,
  getSyncState,
  updateSyncState
} from '@/lib/supabase/client';

export interface MappedProductRow {
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
  modified_at: string;
}

export function mapProductToRow(p: LogicTradeProductRaw): MappedProductRow {
  const groupsList = (p.groups || []).map((g) => g.description || '').filter(Boolean);
  const primaryGroup = groupsList[0] || '';

  return {
    id: p.id,
    code: p.code || '',
    name: p.name || '',
    description: p.description || '',
    supplier_id: p.supplier?.supplier?.id || null,
    supplier_name: p.supplier?.supplier?.companyName || '',
    supplier_code: p.supplier?.code || '',
    group_name: primaryGroup,
    groups: groupsList,
    sales_group: p.salesGroup?.description || '',
    sales_price: typeof p.salesPrice === 'number' ? p.salesPrice : 0,
    vat_code: p.vat?.code || '',
    unit: p.unit || 'stuks',
    raw_data: {
      images: p.images || [],
      attributes: p.attributes || [],
      salesGroup: p.salesGroup,
      vat: p.vat,
      supplier: p.supplier,
      width: (p as any).width,
      height: (p as any).height
    },
    modified_at: (p as any).modifiedDate || new Date().toISOString()
  };
}

export async function syncProductsBatch(products: LogicTradeProductRaw[]): Promise<number> {
  if (!products || products.length === 0) return 0;
  const rows = products.map(mapProductToRow);
  const result = await upsertProductsBatch(rows);
  return result.count;
}

export async function executeDeltaSync(
  options: {
    apiKey?: string;
    baseUrl?: string;
    adminGuid?: string;
    forceSince?: string;
    pageSize?: number;
  } = {}
): Promise<{ syncedCount: number; lastSyncedAt: string }> {
  const apiKey = options.apiKey || process.env.LOGICTRADE_API_KEY || '';
  const baseUrl = options.baseUrl || process.env.LOGICTRADE_BASE_URL || 'https://api.logictrade.cloud/rest/v1';
  const adminGuid = options.adminGuid || process.env.LOGICTRADE_ADMIN_GUID;
  const pageSize = options.pageSize || 100;

  if (!apiKey) {
    throw new Error('LogicTrade API key ontbreekt voor synchronisatie.');
  }

  const existingState = await getSyncState('catalog_sync');
  const since = options.forceSince || existingState?.last_synced_at;

  const url = new URL(`${baseUrl}/products`);
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('pageNumber', '1');
  if (since) {
    url.searchParams.set('modifiedAfter', since);
  }

  const headers: Record<string, string> = {
    'api-key': apiKey,
    Accept: 'application/json'
  };
  if (adminGuid) {
    headers['administration-guid'] = adminGuid;
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers,
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error(`LogicTrade delta sync API error HTTP ${res.status}: ${await res.text()}`);
  }

  const payload = await res.json();
  const products: LogicTradeProductRaw[] = payload.results || [];
  const syncedCount = await syncProductsBatch(products);

  const newTimestamp = new Date().toISOString();
  const total = (existingState?.total_synced || 0) + syncedCount;
  await updateSyncState('catalog_sync', total, newTimestamp);

  return { syncedCount, lastSyncedAt: newTimestamp };
}
