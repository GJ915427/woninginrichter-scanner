/**
 * src/types/order-intake.ts
 *
 * Contracten en DTO's voor order-intake, regelsplitsing, JIT catalogus-lookup,
 * configuratie-extractie en PostgreSQL transactionele stored procedure interfaces.
 */

export interface ConfigurationDimensions {
  width_mm?: number;
  height_mm?: number;
  depth_mm?: number;
  area_m2?: number;
  linear_meters?: number;
}

export interface ConfigurationSpec {
  status: 'valid' | 'incomplete' | 'requires_review';
  confidence: number;
  source: 'erp_fields' | 'eorder_json' | 'regex_tokenizer' | 'cognitive' | 'manual';
  dimensions?: ConfigurationDimensions;
  options?: string[];
  attributes?: Record<string, unknown>;
  extraction_notes?: string[];
  reconciled_product_group_code?: string;
}

export interface CurtainConfigSpec extends ConfigurationSpec {
  attributes?: {
    pleat_type?: 'enkele_plooi' | 'dubbele_plooi' | 'wave' | 'retourplooi' | string;
    hook_type?: string;
    track_type?: string;
    fabric_width_mm?: number;
    lead_cord?: boolean;
    hem_cm?: number;
    [key: string]: unknown;
  };
}

export interface HardWindowConfigSpec extends ConfigurationSpec {
  attributes?: {
    model?: string;
    operation?: 'koord' | 'ketting' | 'motor' | 'smartcord' | 'greep' | string;
    side?: 'links' | 'rechts' | string;
    profile_color?: string;
    mounting?: 'in_de_dag' | 'op_de_dag' | string;
    slat_width_mm?: number;
    [key: string]: unknown;
  };
}

export interface FlooringConfigSpec extends ConfigurationSpec {
  attributes?: {
    subfloor?: string;
    plinth_type?: string;
    laying_pattern?: 'visgraat' | 'recht' | 'hongaarse_punt' | 'tegel' | string;
    underfloor_heating?: boolean;
    waste_percentage?: number;
    [key: string]: unknown;
  };
}

export interface ServiceConfigSpec extends ConfigurationSpec {
  attributes?: {
    discipline?: string;
    is_included?: boolean;
    reference_line?: number;
    [key: string]: unknown;
  };
}

export interface ICognitiveExtractionProvider {
  extract(rawLine: RawOrderLineInput, productGroupCode?: string): Promise<ConfigurationSpec>;
}

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
  width_mm?: number;
  height_mm?: number;
  options?: string[];
  configuration_json?: Record<string, unknown> | null;
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
  configuration_spec?: ConfigurationSpec | null;
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
