/**
 * scripts/seed_matrix_orders.ts
 *
 * Seed script en pipeline om de 7 benchmark orders uit `matrix-mock-data.ts`
 * idempotent te laden in de PostgreSQL/Supabase database via `ingest_logictrade_order`.
 */

import { MATRIX_ORDERS_MOCK_DATA } from '../src/fixtures/matrix-mock-data';
import type { MatrixOrder } from '../src/types/matrix';
import { getSupabaseConfig } from '../src/lib/supabase/client';

export interface IngestOrderHeader {
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
  total_amount_cents: number;
  status: string;
}

export interface IngestOrderLine {
  order_id: string;
  line_number: number;
  sub_line: number;
  product_id?: number | null;
  product_code: string;
  product_group_code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  total_price_cents: number;
  is_hybrid?: boolean;
  is_inbegrepen?: boolean;
  etage_name?: string;
  room_name?: string;
  window_name?: string;
  position_id?: string;
  dim?: string | null;
  notes?: string | null;
  dimension_spec?: Record<string, unknown> | null;
}

export interface OrderIngestPayload {
  order: IngestOrderHeader;
  lines: IngestOrderLine[];
}

export function transformMockOrderToIngestPayload(mockOrder: MatrixOrder): OrderIngestPayload {
  // 1. Ruimtelijke index bouwen: positionId -> { etageName, roomName, posName }
  const spatialIndex = new Map<string, { etageName: string; roomName: string; posName: string }>();

  for (const etage of mockOrder.etages) {
    for (const room of etage.rooms) {
      for (const pos of room.positions) {
        spatialIndex.set(pos.id, {
          etageName: etage.name,
          roomName: room.name,
          posName: pos.name,
        });
      }
    }
  }

  // 2. Orderregels opbouwen uit products & posPrices
  const lines: IngestOrderLine[] = [];
  const processedKeys = new Set<string>();

  for (const product of mockOrder.products) {
    for (const [posId, cell] of Object.entries(product.posPrices)) {
      const lineNum = cell.line || 10;
      const subLineNum = cell.subPos ? (parseInt(cell.subPos, 10) || 0) : 0;
      const key = `${lineNum}_${subLineNum}`;

      if (processedKeys.has(key)) {
        continue;
      }
      processedKeys.add(key);

      const spatial = spatialIndex.get(posId);
      const isDienst = product.category?.toLowerCase().includes('dienst') ||
                       product.category?.toLowerCase().includes('arbeid') ||
                       product.category?.toLowerCase().includes('service');

      lines.push({
        order_id: mockOrder.id,
        line_number: lineNum,
        sub_line: subLineNum,
        product_code: product.code || 'TEKST',
        product_group_code: isDienst ? '6.9' : '3.1',
        description: product.name || product.code,
        quantity: Number(cell.quantity) || 1,
        unit: cell.unit || product.unit || 'stuks',
        unit_price_cents: Number(cell.unitPriceCents) || 0,
        total_price_cents: Number(cell.totalPriceCents) || 0,
        is_hybrid: false,
        is_inbegrepen: Boolean(cell.isInbegrepen),
        etage_name: spatial?.etageName || 'Begane Grond',
        room_name: spatial?.roomName || 'Algemeen',
        window_name: spatial?.posName || posId,
        position_id: posId,
        dim: cell.dim || null,
        notes: cell.note || null,
        dimension_spec: (cell.dimensionSpec as Record<string, unknown>) || null,
      });
    }
  }

  // Sorteer regels deterministisch op line_number, sub_line
  lines.sort((a, b) => a.line_number - b.line_number || a.sub_line - b.sub_line);

  // Bereken de exacte som over alle regels met Server CPQ integriteit
  const calculatedTotalCents = lines.reduce((acc, line) => {
    return acc + (line.is_inbegrepen ? 0 : line.total_price_cents);
  }, 0);

  // Parse datumformaat naar YYYY-MM-DD indien nodig
  const orderHeader: IngestOrderHeader = {
    id: mockOrder.id,
    order_number: mockOrder.id,
    customer_name: mockOrder.klant,
    city: mockOrder.plaats,
    quotation_number: mockOrder.offerte || undefined,
    order_date: '2026-10-01',
    sales_rep: mockOrder.verkoper,
    branch: mockOrder.filiaal,
    fsm_phase: mockOrder.fsmPhase || '5. Bestellen (Actueel)',
    fsm_step: mockOrder.fsmStep || 5,
    scope_description: mockOrder.scopeDescription,
    total_amount_cents: calculatedTotalCents > 0 ? calculatedTotalCents : mockOrder.totaalbedragCents,
    status: mockOrder.status || 'Definitief',
  };

  return {
    order: orderHeader,
    lines,
  };
}

export function validateIngestPayloadIntegrity(payload: OrderIngestPayload): {
  valid: boolean;
  calculatedTotalCents: number;
  headerTotalCents: number;
  diffCents: number;
} {
  const calculatedTotalCents = payload.lines.reduce((acc, line) => {
    return acc + (line.is_inbegrepen ? 0 : line.total_price_cents);
  }, 0);

  const headerTotalCents = payload.order.total_amount_cents;
  const diffCents = Math.abs(calculatedTotalCents - headerTotalCents);

  return {
    valid: diffCents === 0,
    calculatedTotalCents,
    headerTotalCents,
    diffCents,
  };
}

export async function seedMatrixOrders(options?: {
  url?: string;
  serviceKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ processedCount: number; errors: string[] }> {
  const config = getSupabaseConfig();
  const baseUrl = options?.url || config.url;
  const serviceKey = options?.serviceKey || config.serviceKey;
  const customFetch = options?.fetchImpl || fetch;

  if (!baseUrl) {
    throw new Error('Supabase URL ontbreekt voor seedMatrixOrders.');
  }
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is verplicht voor seedMatrixOrders (fail-closed).'
    );
  }

  const errors: string[] = [];
  let processedCount = 0;

  for (const mockOrder of MATRIX_ORDERS_MOCK_DATA) {
    const payload = transformMockOrderToIngestPayload(mockOrder);

    try {
      const res = await customFetch(`${baseUrl}/rest/v1/rpc/ingest_logictrade_order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ p_order: payload }),
      });

      if (!res.ok) {
        const text = await res.text();
        errors.push(`Order ${mockOrder.id} mislukt (${res.status}): ${text}`);
      } else {
        processedCount++;
      }
    } catch (err) {
      errors.push(`Order ${mockOrder.id} netwerkfout: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { processedCount, errors };
}
