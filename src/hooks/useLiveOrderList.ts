/**
 * src/hooks/useLiveOrderList.ts
 *
 * Headless React hook voor het dynamisch ophalen van de live ordercatalogus uit Supabase.
 * Converteert records naar `OrderSummaryItem[]` met Ubiquitous Language en
 * biedt fail-safe fallback naar mock headers bij offline / netwerkfouten.
 */

import { useState, useEffect, useCallback } from 'react';
import type { OrderSummaryItem } from '@/types/matrix';
import { getSupabaseConfig } from '@/lib/supabase/client';
import { MATRIX_ORDERS_MOCK_DATA } from '@/fixtures/matrix-mock-data';

export function getMockOrderSummaries(): OrderSummaryItem[] {
  return MATRIX_ORDERS_MOCK_DATA.map((o) => ({
    id: o.id,
    orderNumber: o.id,
    klant: o.klant,
    plaats: o.plaats,
    offerte: o.offerte,
    orderdatum: o.orderdatum,
    totaalbedragCents: o.totaalbedragCents,
    status: o.status,
  }));
}

export async function fetchLiveOrderList(options?: {
  url?: string;
  anonKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<OrderSummaryItem[] | null> {
  const config = getSupabaseConfig();
  const baseUrl = options?.url || config.url;
  const key = options?.anonKey || config.anonKey;
  const customFetch = options?.fetchImpl || fetch;

  if (!baseUrl || !key) {
    return null;
  }

  try {
    const query = new URLSearchParams({
      select: 'id,order_number,customer_name,city,quotation_number,order_date,total_amount_cents,status',
      order: 'order_date.desc',
    });

    const res = await customFetch(`${baseUrl}/rest/v1/orders?${query.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    if (!res.ok) {
      return null;
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }

    return rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      orderNumber: String(r.order_number || r.id),
      klant: String(r.customer_name || 'Klant'),
      plaats: String(r.city || 'Nederland'),
      offerte: r.quotation_number ? String(r.quotation_number) : undefined,
      orderdatum: r.order_date ? String(r.order_date) : '',
      totaalbedragCents: Number(r.total_amount_cents) || 0,
      status: String(r.status || 'Definitief'),
    }));
  } catch (err) {
    return null;
  }
}

export function useLiveOrderList() {
  const [orders, setOrders] = useState<OrderSummaryItem[]>(getMockOrderSummaries());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const liveOrders = await fetchLiveOrderList();
      if (liveOrders && liveOrders.length > 0) {
        setOrders(liveOrders);
      } else {
        // Fail-safe terugval op mock headers
        setOrders(getMockOrderSummaries());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setOrders(getMockOrderSummaries());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  return {
    orders,
    isLoading,
    error,
    refetch: loadOrders,
  };
}
