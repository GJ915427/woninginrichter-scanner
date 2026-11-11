/**
 * src/hooks/useLiveOrderList.ts
 *
 * Headless React hook voor het dynamisch ophalen van de live ordercatalogus
 * via de same-origin BFF route /api/orders conform INV-GOV-21C.
 * Elimineert directe client-side PostgREST aanroepen en silent mock fallbacks.
 */

import { useState, useEffect, useCallback } from 'react';
import type { OrderSummaryItem } from '@/types/matrix';
import type { CatalogTotals, OrdersApiResponse } from '@/lib/supabase/order-client';
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

export interface UseLiveOrderListOptions {
  q?: string;
  type?: 'all' | 'orders' | 'quotes';
  limit?: number;
  offset?: number;
  fetchImpl?: typeof fetch;
}

export async function fetchLiveOrderList(
  options?: UseLiveOrderListOptions
): Promise<OrdersApiResponse | null> {
  const customFetch = options?.fetchImpl || fetch;

  try {
    const params = new URLSearchParams();
    if (options?.q?.trim()) {
      params.set('q', options.q.trim());
    }
    if (options?.type && options.type !== 'all') {
      params.set('type', options.type);
    }
    if (options?.limit) {
      params.set('limit', String(options.limit));
    }
    if (options?.offset) {
      params.set('offset', String(options.offset));
    }

    const queryString = params.toString();
    const endpoint = queryString ? `/api/orders?${queryString}` : '/api/orders';

    const res = await customFetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as OrdersApiResponse;
    if (!data || !Array.isArray(data.items)) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export function useLiveOrderList(options?: UseLiveOrderListOptions) {
  const [orders, setOrders] = useState<OrderSummaryItem[]>([]);
  const [catalogTotals, setCatalogTotals] = useState<CatalogTotals>({ all: 0, orders: 0, quotes: 0 });
  const [total, setTotal] = useState<number>(0);
  const [filteredCount, setFilteredCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const query = options?.q;
  const filterType = options?.type;
  const limit = options?.limit;
  const offset = options?.offset;
  const customFetch = options?.fetchImpl;

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchLiveOrderList({
        q: query,
        type: filterType,
        limit,
        offset,
        fetchImpl: customFetch,
      });

      if (response) {
        setOrders(response.items);
        setCatalogTotals(response.catalogTotals || { all: 0, orders: 0, quotes: 0 });
        setTotal(response.total ?? 0);
        setFilteredCount(response.filteredCount ?? response.total ?? 0);
      } else {
        setError('Kon orders niet ophalen van server');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [query, filterType, limit, offset, customFetch]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  return {
    orders,
    catalogTotals,
    total,
    filteredCount,
    isLoading,
    error,
    refetch: loadOrders,
  };
}
