/**
 * src/lib/supabase/order-mutation-client.ts
 *
 * Data Access Client voor atomaire cel-updates en CPQ herberekening via PostgREST RPC.
 * Bevat pure payload transformaties en fail-closed netwerkcommunicatie.
 */

import { getSupabaseConfig } from './client';

export interface OrderCellPatchInput {
  quantity?: number;
  unitPriceCents?: number;
  totalPriceCents?: number;
  baseTotalPriceCents?: number;
  base_total_price_cents?: number;
  isInbegrepen?: boolean;
  is_inbegrepen?: boolean;
  dim?: string;
  note?: string;
  notes?: string;
  dimensionSpec?: Record<string, unknown>;
  dimension_spec?: Record<string, unknown>;
  measuredDimensionSpec?: Record<string, unknown>;
  measured_dimension_spec?: Record<string, unknown>;
  spatialUpdatedAt?: string;
  spatial_updated_at?: string;
}

export interface OrderLinePatchDto {
  quantity?: number;
  unit_price_cents?: number;
  total_price_cents?: number;
  base_total_price_cents?: number;
  is_inbegrepen?: boolean;
  dim?: string;
  notes?: string;
  dimension_spec?: Record<string, unknown>;
  measured_dimension_spec?: Record<string, unknown>;
  spatial_updated_at?: string;
}

export interface OrderMutationRpcPayload {
  p_order_id: string;
  p_line_number: number;
  p_sub_line: number;
  p_patch: OrderLinePatchDto;
}

export interface OrderMutationResult {
  success: boolean;
  updatedLine?: Record<string, unknown>;
  totalAmountCents?: number;
  error?: string;
}

export function toOrderLinePatchDto(input: OrderCellPatchInput): OrderLinePatchDto {
  const dto: OrderLinePatchDto = {};

  if (input.quantity !== undefined) {
    dto.quantity = Number(input.quantity);
  }

  if (input.unitPriceCents !== undefined) {
    dto.unit_price_cents = Number(input.unitPriceCents);
  }

  const basePrice = input.baseTotalPriceCents !== undefined ? input.baseTotalPriceCents : input.base_total_price_cents;
  if (basePrice !== undefined) {
    dto.base_total_price_cents = Number(basePrice);
  }

  const inbegrepen = input.isInbegrepen !== undefined ? input.isInbegrepen : input.is_inbegrepen;
  if (inbegrepen !== undefined) {
    dto.is_inbegrepen = Boolean(inbegrepen);
  }

  if (input.totalPriceCents !== undefined) {
    dto.total_price_cents = Number(input.totalPriceCents);
  } else if (dto.is_inbegrepen) {
    dto.total_price_cents = 0;
  } else if (dto.quantity !== undefined && dto.unit_price_cents !== undefined) {
    dto.total_price_cents = Math.round(dto.quantity * dto.unit_price_cents);
  }

  if (input.dim !== undefined) {
    dto.dim = input.dim;
  }

  const noteVal = input.notes !== undefined ? input.notes : input.note;
  if (noteVal !== undefined) {
    dto.notes = noteVal;
  }

  const dimSpecVal = input.dimension_spec !== undefined ? input.dimension_spec : input.dimensionSpec;
  if (dimSpecVal !== undefined) {
    dto.dimension_spec = dimSpecVal;
  }

  const measDimSpecVal = input.measured_dimension_spec !== undefined ? input.measured_dimension_spec : input.measuredDimensionSpec;
  if (measDimSpecVal !== undefined) {
    dto.measured_dimension_spec = measDimSpecVal;
  }

  const spatialUpdatedVal = input.spatial_updated_at !== undefined ? input.spatial_updated_at : input.spatialUpdatedAt;
  if (spatialUpdatedVal !== undefined) {
    dto.spatial_updated_at = spatialUpdatedVal;
  }

  return dto;
}

export async function updateMatrixCellRpc(options: {
  orderId: string;
  lineNumber: number;
  subLine: number;
  patch: OrderCellPatchInput;
  fetchImpl?: typeof fetch;
  url?: string;
  anonKey?: string;
}): Promise<OrderMutationResult> {
  const { orderId, lineNumber, subLine, patch, fetchImpl, url, anonKey } = options;

  const config = getSupabaseConfig();
  const baseUrl = url || config.url;
  const key = anonKey || config.anonKey;
  const customFetch = fetchImpl || fetch;

  if (!baseUrl || !key) {
    return {
      success: false,
      error: 'Supabase configuratie ontbreekt (URL of Key niet ingesteld).',
    };
  }

  const patchDto = toOrderLinePatchDto(patch);
  const payload: OrderMutationRpcPayload = {
    p_order_id: orderId.trim(),
    p_line_number: Math.floor(lineNumber),
    p_sub_line: Math.floor(subLine),
    p_patch: patchDto,
  };

  try {
    const res = await customFetch(`${baseUrl}/rest/v1/rpc/update_matrix_cell`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        success: false,
        error: `Fout bij cel-update (${res.status} ${res.statusText}): ${errText}`,
      };
    }

    const data = await res.json();
    if (data && typeof data === 'object') {
      if (data.success === false) {
        return {
          success: false,
          error: data.error || 'Onbekende fout geretourneerd door database procedure.',
        };
      }

      return {
        success: true,
        updatedLine: data.updated_line,
        totalAmountCents: data.total_amount_cents !== undefined ? Number(data.total_amount_cents) : undefined,
      };
    }

    return {
      success: true,
      updatedLine: data,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
