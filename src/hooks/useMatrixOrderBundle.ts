/**
 * src/hooks/useMatrixOrderBundle.ts
 *
 * Pure bundler engine en React hook voor asynchrone retrieval van Supabase Matrix Orders.
 * Ontkoppelt pure transformatielogica (testbaar in Node Vitest) van reactieve UI lifecycle.
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  MatrixOrder,
  Etage,
  Room,
  Position,
  MatrixProduct,
  CellPriceData,
  DimensionSpec,
} from '@/types/matrix';
import { getSupabaseConfig } from '@/lib/supabase/client';

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

export function bundleMatrixOrder(dto: OrderMatrixBundleDto): MatrixOrder {
  const { order, lines } = dto;

  // 1. Construeer ruimtelijke hiërarchie: etages -> rooms -> positions
  const etageMap = new Map<string, Map<string, Map<string, Position>>>();
  const productMap = new Map<string, MatrixProduct>();

  for (const line of lines) {
    const etageName = (line.etage_name || 'BEGANE GROND').trim();
    const roomName = (line.room_name || 'Algemeen').trim();
    const posId = (line.position_id || `pos_${line.line_number}`).trim();
    const posName = (line.window_name || `Positie ${line.line_number}`).trim();

    if (!etageMap.has(etageName)) {
      etageMap.set(etageName, new Map());
    }
    const roomMap = etageMap.get(etageName)!;

    if (!roomMap.has(roomName)) {
      roomMap.set(roomName, new Map());
    }
    const posMap = roomMap.get(roomName)!;

    if (!posMap.has(posId)) {
      posMap.set(posId, {
        id: posId,
        name: posName,
        type: 'Raam',
      });
    }

    // 2. Construeer Matrix Producten & CellPriceData
    const prodCode = line.product_code || 'TEKST';
    const prodKey = `${prodCode}_${line.sub_line}`;

    if (!productMap.has(prodKey)) {
      productMap.set(prodKey, {
        id: `prod_${prodKey}`,
        code: prodCode,
        name: line.description || prodCode,
        category: line.sub_line === 1 ? 'Dienst / Service' : 'Product',
        unit: line.unit || 'stuks',
        posPrices: {},
      });
    }

    const prod = productMap.get(prodKey)!;
    const cellPrice: CellPriceData = {
      quantity: Number(line.quantity) || 1,
      unit: line.unit,
      unitPriceCents: Number(line.unit_price_cents) || 0,
      totalPriceCents: Number(line.total_price_cents) || 0,
      dim: line.dim || undefined,
      note: line.notes || undefined,
      line: line.line_number,
      subPos: line.sub_line > 0 ? String(line.sub_line) : undefined,
      isInbegrepen: Boolean(line.is_inbegrepen),
      dimensionSpec: line.dimension_spec || undefined,
    };

    prod.posPrices[posId] = cellPrice;
  }

  // Bouw Etage array
  const etages: Etage[] = [];
  let etageIdx = 1;
  for (const [etageName, roomMap] of etageMap.entries()) {
    const rooms: Room[] = [];
    let roomIdx = 1;
    for (const [roomName, posMap] of roomMap.entries()) {
      rooms.push({
        id: `room_${etageIdx}_${roomIdx++}`,
        name: roomName,
        clusters: [],
        positions: Array.from(posMap.values()),
      });
    }
    etages.push({
      id: `etage_${etageIdx++}`,
      name: etageName,
      rooms,
    });
  }

  return {
    id: order.id,
    klant: order.customer_name || 'Klant',
    plaats: order.city || 'Nederland',
    offerte: order.quotation_number || '',
    orderdatum: order.order_date || '',
    status: order.status || 'Definitief',
    fsmPhase: order.fsm_phase || '5. Bestellen (Actueel)',
    fsmStep: order.fsm_step !== undefined ? order.fsm_step : 5,
    verkoper: order.sales_rep || 'Verkoop',
    filiaal: order.branch || 'Winkel GSW BV',
    totaalbedragCents: Number(order.total_amount_cents) || 0,
    scopeDescription: order.scope_description,
    etages,
    products: Array.from(productMap.values()),
  };
}

export async function fetchMatrixOrderBundle(
  orderId: string,
  options?: { url?: string; anonKey?: string; fetchImpl?: typeof fetch }
): Promise<MatrixOrder | null> {
  if (!orderId || !orderId.trim()) {
    return null;
  }

  const config = getSupabaseConfig();
  const baseUrl = options?.url || config.url;
  const key = options?.anonKey || config.anonKey;
  const customFetch = options?.fetchImpl || fetch;

  if (!baseUrl || !key) {
    console.warn('Supabase URL of Key ontbreekt voor fetchMatrixOrderBundle');
    return null;
  }

  try {
    const res = await customFetch(`${baseUrl}/rest/v1/rpc/get_order_matrix_bundle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_order_id: orderId.trim() }),
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as OrderMatrixBundleDto | null;
    if (!data || !data.order) {
      return null;
    }

    return bundleMatrixOrder(data);
  } catch (err) {
    console.error('Fout bij fetchMatrixOrderBundle:', err);
    return null;
  }
}

export function useMatrixOrderBundle(orderId: string | null) {
  const [order, setOrder] = useState<MatrixOrder | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadBundle = useCallback(async () => {
    if (!orderId) {
      setOrder(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fetchedOrder = await fetchMatrixOrderBundle(orderId);
      if (fetchedOrder) {
        setOrder(fetchedOrder);
      } else {
        setError(`Order ${orderId} kon niet worden gevonden.`);
      }
    } catch (err) {
      setError(`Fout bij laden van order: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadBundle();
  }, [loadBundle]);

  return {
    order,
    isLoading,
    error,
    refetch: loadBundle,
  };
}
