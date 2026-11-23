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
  Cluster,
  Position,
  MatrixProduct,
  CellPriceData,
  DimensionSpec,
} from '@/types/matrix';
import type { ConfigurationSpec } from '@/types/order-intake';
import { resolveNumericQuantity } from '@/types/order-intake';
import type {
  OrderLineDto,
  OrderHeaderDto,
  OrderMatrixBundleDto,
} from '@/lib/supabase/order-client';

export type { OrderLineDto, OrderHeaderDto, OrderMatrixBundleDto };

export function bundleMatrixOrder(dto: OrderMatrixBundleDto): MatrixOrder {
  const { order, lines } = dto;

  // 1. Construeer ruimtelijke hiërarchie: etages -> rooms -> positions
  const etageMap = new Map<string, Map<string, Map<string, Position>>>();
  const clusterMap = new Map<string, Map<string, Map<string, Set<string>>>>();
  const productMap = new Map<string, MatrixProduct>();

  for (const line of lines) {
    const posId = (line.position_id || `pos_${line.line_number}`).trim();
    const posName = (line.window_name || `Positie ${line.line_number}`).trim();

    // Stroom A uitsluiten van etageMap/roomMap (INV-SPATIAL-02)
    if (posId !== 'pos_project_algemeen') {
      const etageName = (line.etage_name && line.etage_name.trim() !== '')
        ? line.etage_name.trim()
        : 'Overig / N.t.b.';
      const roomName = (line.room_name && line.room_name.trim() !== '')
        ? line.room_name.trim()
        : 'N.t.b.';

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

      // Cluster tracking voor ColSpan pariteit
      const clusterName = line.spatial_metadata?.cluster_name;
      if (clusterName && clusterName.trim() !== '') {
        const cName = clusterName.trim();
        if (!clusterMap.has(etageName)) {
          clusterMap.set(etageName, new Map());
        }
        const etageClusterMap = clusterMap.get(etageName)!;
        if (!etageClusterMap.has(roomName)) {
          etageClusterMap.set(roomName, new Map());
        }
        const roomClusterMap = etageClusterMap.get(roomName)!;
        if (!roomClusterMap.has(cName)) {
          roomClusterMap.set(cName, new Set());
        }
        roomClusterMap.get(cName)!.add(posId);
      }
    }

    // 2. Construeer Matrix Producten & CellPriceData (inclusief pos_project_algemeen voor Kolom 1)
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
      quantity: resolveNumericQuantity(line.quantity),
      unit: line.unit,
      unitPriceCents: Number(line.unit_price_cents) || 0,
      totalPriceCents: Number(line.total_price_cents) || 0,
      dim: line.dim || undefined,
      note: line.notes || undefined,
      line: line.line_number,
      subLine: line.sub_line,
      subPos: line.sub_line > 0 ? String(line.sub_line) : undefined,
      isInbegrepen: Boolean(line.is_inbegrepen),
      dimensionSpec: line.dimension_spec || undefined,
      configurationSpec: line.configuration_spec || undefined,
    };

    prod.posPrices[posId] = cellPrice;
  }

  // Bouw Etage array met geclusterde posities vooraan voor colSpan pariteit
  const etages: Etage[] = [];
  let etageIdx = 1;
  for (const [etageName, roomMap] of etageMap.entries()) {
    const rooms: Room[] = [];
    let roomIdx = 1;
    for (const [roomName, posMap] of roomMap.entries()) {
      const allPositions = Array.from(posMap.values());
      const clusters: Cluster[] = [];
      const roomClusterMap = clusterMap.get(etageName)?.get(roomName);

      if (roomClusterMap && roomClusterMap.size > 0) {
        let clusterIdx = 1;
        for (const [clusterName, posIdSet] of roomClusterMap.entries()) {
          clusters.push({
            id: `cluster_${etageIdx}_${roomIdx}_${clusterIdx++}`,
            name: clusterName,
            positionIds: Array.from(posIdSet),
          });
        }
      }

      let orderedPositions = allPositions;
      if (clusters.length > 0) {
        const primaryCluster = clusters[0];
        const clusteredPositions = allPositions.filter((p) => primaryCluster.positionIds.includes(p.id));
        const remainingPositions = allPositions.filter((p) => !primaryCluster.positionIds.includes(p.id));
        orderedPositions = [...clusteredPositions, ...remainingPositions];
      }

      rooms.push({
        id: `room_${etageIdx}_${roomIdx++}`,
        name: roomName,
        clusters,
        positions: orderedPositions,
      });
    }
    etages.push({
      id: `etage_${etageIdx++}`,
      name: etageName,
      rooms,
    });
  }

  // Bouw rawLines voor de audit trail
  const rawLines = lines.map((l) => ({
    line: l.line_number,
    subLine: l.sub_line,
    productCode: l.product_code,
    description: l.description,
    quantity: Number(l.quantity) || 1,
    unit: l.unit,
    priceCents: Number(l.unit_price_cents) || 0,
    totalCents: Number(l.total_price_cents) || 0,
    positionName: (l.window_name || l.position_id) ? String(l.window_name || l.position_id) : undefined,
    roomName: l.room_name ? String(l.room_name) : undefined,
    etageName: l.etage_name,
  }));

  return {
    id: order.id,
    isLive: true,
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
    rawLines,
  };
}

export async function fetchMatrixOrderBundle(
  orderId: string,
  options?: { url?: string; fetchImpl?: typeof fetch }
): Promise<MatrixOrder | null> {
  if (!orderId || !orderId.trim()) {
    return null;
  }

  const customFetch = options?.fetchImpl || fetch;

  try {
    const cleanId = encodeURIComponent(orderId.trim());
    const baseUrl = options?.url || '';
    const endpoint = baseUrl ? `${baseUrl}/api/orders/${cleanId}` : `/api/orders/${cleanId}`;

    const res = await customFetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
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
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadBundle = useCallback(async () => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const bundle = await fetchMatrixOrderBundle(orderId);
      if (!bundle) {
        setError(`Order ${orderId} kon niet worden geladen.`);
        setOrder(null);
      } else {
        setOrder(bundle);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onbekende fout bij ophalen order.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadBundle();
  }, [loadBundle]);

  return {
    order,
    loading,
    error,
    reload: loadBundle,
  };
}
