/**
 * src/lib/supabase/order-client.ts
 *
 * Data Access Layer (DAL) Adapter voor Order Ingest, JIT Catalogus Disambiguatie
 * en PostgREST RPC/query transacties conform INV-GOV-21C.
 */

import { getSupabaseConfig } from './client';
import type { IngestedOrderBundle, ResolvedProductEntity } from '@/types/order-intake';
import type { DimensionSpec, OrderSummaryItem } from '@/types/matrix';

export interface OrderLineDto {
  line_number: number;
  sub_line: number;
  product_id: number | null;
  product_code: string;
  product_group_code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  total_price_cents: number;
  is_hybrid: boolean;
  is_inbegrepen: boolean;
  etage_name: string;
  room_name?: string;
  window_name?: string;
  position_id?: string;
  dim?: string | null;
  notes?: string | null;
  dimension_spec?: DimensionSpec | null;
}

export interface OrderHeaderDto {
  id: string;
  order_number: string;
  customer_name?: string;
  city?: string;
  quotation_number?: string;
  order_date?: string;
  sales_rep?: string;
  branch?: string;
  fsm_phase?: string;
  fsm_step?: number;
  scope_description?: string;
  total_amount_cents?: number;
  status?: string;
  raw_data?: Record<string, unknown>;
}

export interface OrderMatrixBundleDto {
  order: OrderHeaderDto;
  lines: OrderLineDto[];
}

export interface CatalogTotals {
  all: number;
  orders: number;
  quotes: number;
}

export interface OrdersApiResponse {
  items: OrderSummaryItem[];
  total: number;
  filteredCount: number;
  limit: number;
  offset: number;
  catalogTotals: CatalogTotals;
}

let cachedCatalogTotals: { data: CatalogTotals; expiresAt: number } | null = null;

export function _resetOrderTotalsCache(): void {
  cachedCatalogTotals = null;
}

async function fetchCatalogTotals(
  config: { url: string; authKey: string },
  fetchFn: typeof fetch,
  bypassCache?: boolean
): Promise<CatalogTotals> {
  const now = Date.now();
  if (!bypassCache && cachedCatalogTotals && cachedCatalogTotals.expiresAt > now) {
    return cachedCatalogTotals.data;
  }

  const headers = {
    apikey: config.authKey,
    Authorization: `Bearer ${config.authKey}`,
  };

  const [resAll, resQuotes, resOrders] = await Promise.all([
    fetchFn(`${config.url}/rest/v1/orders?select=count`, { headers }),
    fetchFn(`${config.url}/rest/v1/orders?or=(status.ilike.*OFFERTE*,fsm_step.eq.2)&select=count`, { headers }),
    fetchFn(`${config.url}/rest/v1/orders?status=neq.OFFERTE&fsm_step=neq.2&select=count`, { headers }),
  ]);

  let all = 0;
  let quotes = 0;
  let orders = 0;

  if (resAll.ok) {
    const data = await resAll.json();
    all = Array.isArray(data) && data[0]?.count != null ? Number(data[0].count) : 0;
  }
  if (resQuotes.ok) {
    const data = await resQuotes.json();
    quotes = Array.isArray(data) && data[0]?.count != null ? Number(data[0].count) : 0;
  }
  if (resOrders.ok) {
    const data = await resOrders.json();
    orders = Array.isArray(data) && data[0]?.count != null ? Number(data[0].count) : 0;
  }

  const totals: CatalogTotals = { all, quotes, orders };
  cachedCatalogTotals = { data: totals, expiresAt: now + 60_000 };
  return totals;
}

export async function fetchOrderSummariesDal(options?: {
  q?: string;
  type?: 'all' | 'orders' | 'quotes';
  limit?: number;
  offset?: number;
  bypassCache?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<OrdersApiResponse> {
  const config = getSupabaseConfig();
  const authKey = config.serviceKey || config.anonKey;
  const fetchFn = options?.fetchImpl || fetch;

  if (!config.url || !authKey) {
    return {
      items: [],
      total: 0,
      filteredCount: 0,
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
      catalogTotals: { all: 0, orders: 0, quotes: 0 },
    };
  }

  const catalogTotals = await fetchCatalogTotals(
    { url: config.url, authKey },
    fetchFn,
    options?.bypassCache
  );

  const limit = Math.min(Math.max(1, options?.limit ?? 50), 100);
  const offset = Math.max(0, options?.offset ?? 0);
  const typeFilter = options?.type ?? 'all';
  const query = options?.q?.trim();

  const queryParams: string[] = [
    'select=id,order_number,customer_name,city,quotation_number,order_date,total_amount_cents,status,fsm_step',
    'order=order_date.desc.nullslast,id.desc',
    `limit=${limit}`,
    `offset=${offset}`,
  ];

  if (typeFilter === 'quotes') {
    queryParams.push('or=(status.ilike.*OFFERTE*,fsm_step.eq.2)');
  } else if (typeFilter === 'orders') {
    queryParams.push('status=neq.OFFERTE');
    queryParams.push('fsm_step=neq.2');
  }

  if (query) {
    const cleanQ = encodeURIComponent(query.replace(/[%,()]/g, ''));
    queryParams.push(`or=(order_number.ilike.*${cleanQ}*,customer_name.ilike.*${cleanQ}*,city.ilike.*${cleanQ}*)`);
  }

  const url = `${config.url}/rest/v1/orders?${queryParams.join('&')}`;
  const res = await fetchFn(url, {
    headers: {
      apikey: authKey,
      Authorization: `Bearer ${authKey}`,
      Prefer: 'count=exact',
    },
  });

  if (!res.ok) {
    return {
      items: [],
      total: 0,
      filteredCount: 0,
      limit,
      offset,
      catalogTotals,
    };
  }

  const contentRange = res.headers.get('content-range') || '';
  const totalMatch = contentRange.match(/\/(\d+|\*)$/);
  const total = totalMatch && totalMatch[1] !== '*' ? parseInt(totalMatch[1], 10) : 0;

  const rawRows = (await res.json()) as any[];
  const items: OrderSummaryItem[] = Array.isArray(rawRows)
    ? rawRows.map((r) => ({
        id: String(r.id),
        orderNumber: String(r.order_number || r.id),
        klant: String(r.customer_name || 'Onbekende Klant'),
        plaats: String(r.city || ''),
        offerte: r.quotation_number ? String(r.quotation_number) : undefined,
        orderdatum: r.order_date ? String(r.order_date).slice(0, 10) : '',
        totaalbedragCents: typeof r.total_amount_cents === 'number' ? r.total_amount_cents : 0,
        status: String(r.status || (r.fsm_step === 2 ? 'OFFERTE' : 'ORDER')),
      }))
    : [];

  return {
    items,
    total,
    filteredCount: total,
    limit,
    offset,
    catalogTotals,
  };
}

export async function fetchOrderMatrixBundleDal(
  orderId: string,
  options?: { fetchImpl?: typeof fetch }
): Promise<OrderMatrixBundleDto | null> {
  const cleanId = (orderId || '').trim();
  if (!cleanId) return null;

  const config = getSupabaseConfig();
  const authKey = config.serviceKey || config.anonKey;
  const fetchFn = options?.fetchImpl || fetch;

  if (!config.url || !authKey) {
    return null;
  }

  const headers = {
    apikey: authKey,
    Authorization: `Bearer ${authKey}`,
  };

  const idParam = encodeURIComponent(cleanId);
  const headerUrl = `${config.url}/rest/v1/orders?or=(id.eq.${idParam},order_number.eq.${idParam})&limit=1`;
  const headerRes = await fetchFn(headerUrl, { headers });

  if (!headerRes.ok) {
    return null;
  }

  const headersJson = (await headerRes.json()) as OrderHeaderDto[];
  if (!Array.isArray(headersJson) || headersJson.length === 0) {
    return null;
  }

  const orderHeader = headersJson[0];
  const targetOrderId = encodeURIComponent(orderHeader.id);
  const linesUrl = `${config.url}/rest/v1/order_lines?order_id=eq.${targetOrderId}&order=line_number.asc,sub_line.asc`;
  const linesRes = await fetchFn(linesUrl, { headers });

  let lines: OrderLineDto[] = [];
  if (linesRes.ok) {
    try {
      const parsed = (await linesRes.json()) as OrderLineDto[];
      if (Array.isArray(parsed)) {
        lines = parsed;
      }
    } catch {
      lines = [];
    }
  }

  return {
    order: orderHeader,
    lines,
  };
}

export async function resolveProductByCode(
  productCode: string,
  supplierName?: string
): Promise<ResolvedProductEntity | null> {
  const code = (productCode || '').trim();
  if (!code || code.toUpperCase() === 'TEKST') {
    return null;
  }

  const config = getSupabaseConfig();
  const authKey = config.serviceKey || config.anonKey;
  if (!config.url || !authKey) {
    return null;
  }

  try {
    // 1. Primaire poging: code + leverancier
    if (supplierName && supplierName.trim()) {
      const supParam = encodeURIComponent(supplierName.trim());
      const codeParam = encodeURIComponent(code);
      const url = `${config.url}/rest/v1/logictrade_products?code=eq.${codeParam}&supplier_name=ilike.*${supParam}*&select=id,code,supplier_name,product_group_code&order=modified_at.desc&limit=1`;
      const res = await fetch(url, {
        headers: { apikey: authKey, Authorization: `Bearer ${authKey}` },
      });
      if (res.ok) {
        const rows = (await res.json()) as ResolvedProductEntity[];
        if (Array.isArray(rows) && rows.length > 0) {
          return rows[0];
        }
      }
    }

    // 2. Secundaire poging: Meest recente SKU match
    const codeParam = encodeURIComponent(code);
    const url = `${config.url}/rest/v1/logictrade_products?code=eq.${codeParam}&select=id,code,supplier_name,product_group_code&order=modified_at.desc&limit=1`;
    const res = await fetch(url, {
      headers: { apikey: authKey, Authorization: `Bearer ${authKey}` },
    });
    if (res.ok) {
      const rows = (await res.json()) as ResolvedProductEntity[];
      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0];
      }
    }
  } catch (err) {
    console.error('Fout bij resolveProductByCode:', err);
  }

  return null;
}

export async function ingestOrderTransaction(
  bundle: IngestedOrderBundle
): Promise<{ success: boolean; order_id: string; lines_processed: number }> {
  const config = getSupabaseConfig();
  const authKey = config.serviceKey || config.anonKey;

  if (!config.url || !authKey) {
    throw new Error('Supabase configuratie ontbreekt voor order ingest transactie.');
  }

  const res = await fetch(`${config.url}/rest/v1/rpc/ingest_logictrade_order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: authKey,
      Authorization: `Bearer ${authKey}`,
    },
    body: JSON.stringify({ p_order: bundle }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`RPC ingest_logictrade_order mislukt: ${res.status} ${errorText}`);
  }

  return (await res.json()) as { success: boolean; order_id: string; lines_processed: number };
}
