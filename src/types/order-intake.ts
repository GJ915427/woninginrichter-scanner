/**
 * src/types/order-intake.ts
 *
 * Contracten en DTO's voor order-intake, regelsplitsing, JIT catalogus-lookup
 * en PostgreSQL transactionele stored procedure interfaces.
 */

export interface RawOrderLineInput {
  line_number: number;
  product_code?: string;
  description: string;
  quantity?: number;
  unit?: string;
  unit_price_cents?: number;
  total_price_cents?: number;
  is_hybrid?: boolean;
  etage_name?: string;
  room_name?: string;
  window_name?: string;
  position_id?: string;
  dim?: string;
  notes?: string;
  dimension_spec?: Record<string, unknown> | null;
}

export interface RawLogicTradeOrderInput {
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
  lines: RawOrderLineInput[];
}

export interface IngestedOrderLine {
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
  dimension_spec?: Record<string, unknown> | null;
}

export interface IngestedOrderHeader {
  id: string;
  order_number: string;
  customer_name: string;
  city?: string;
  quotation_number?: string;
  order_date?: string;
  sales_rep?: string;
  branch?: string;
  fsm_phase: string;
  fsm_step: number;
  scope_description?: string;
  total_amount_cents: number;
  status: string;
  raw_data: Record<string, unknown>;
}

export interface IngestedOrderBundle {
  order: IngestedOrderHeader;
  lines: IngestedOrderLine[];
}

export interface ResolvedProductEntity {
  id: number;
  code: string;
  supplier_name?: string;
  product_group_code?: string;
}
