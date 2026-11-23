/**
 * src/types/order-intake.ts
 *
 * Contracten en DTO's voor order-intake, regelsplitsing, JIT catalogus-lookup,
 * configuratie-extractie en PostgreSQL transactionele stored procedure interfaces.
 */

export type DimensionSpec =
  | {
      type: 'window_2d';
      widthMm: number;
      heightMm: number;
      areaM2?: number;
    }
  | {
      type: 'floor_area';
      netAreaM2: number;
      wastePercentage: number;
      grossAreaM2?: number;
      packageSizeM2?: number;
      packageCount?: number;
    }
  | {
      type: 'curtain_linear';
      widthMm: number;
      heightMm?: number;
      linearMeters?: number;
      pleatFactor?: number;
      fabricWidthMm?: number;
    }
  | {
      type: 'stairs';
      stepsCount: number;
      stairType: 'dicht' | 'open' | 'renovatie' | 'stoffering' | 'loper';
      hasRisers?: boolean;
      isOpen?: boolean;
      ledLighting?: boolean;
      bandering?: boolean;
      widthMm?: number;
    }
  | {
      type: 'piece_service';
      unit?: string;
    };

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

export type SpatialProvenance = 'EXPLICIT' | 'INFERRED' | 'VERIFIED';

export interface ExtractedSpatialMetadata {
  etage_name: string | null;
  etage_source?: SpatialProvenance;
  room_name: string | null;
  room_source?: SpatialProvenance;
  window_name: string | null;
  position_id: string | null;
  pos_source?: SpatialProvenance;
  cluster_name: string | null;
  cluster_source?: SpatialProvenance;
}

export interface OrderSpatialContext {
  orderFloors: Set<string>;
  orderRooms: Set<string>;
  existingPositionsByRoom: Map<string, string[]>;
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

export interface LogicTradeRawOrderLine {
  id?: number | string;
  code?: string;
  articleCode?: string;
  productCode?: string;
  description?: string;
  articleDescription?: string;
  quantity?: number;
  unit?: string;
  price?: number;
  partPrice?: number;
  grossPrice?: number;
  totalPrice?: number;
  linePrice?: number;
  totalGrossPrice?: number;
  basePartPrice?: number;
  discount?: number;
  discountPercentage?: number;
  vat?: {
    code?: string;
    percentage?: number;
  };
  vatCode?: string;
  vatPercentage?: number;
  reservations?: Array<{ number: string; lineNumber?: number }>;
  stockStatus?: string;
  deliveryStatus?: string;
  invoiceStatus?: string;
  comment?: string | {
    extern?: string;
    intern?: string;
    [key: string]: unknown;
  };
  supplierName?: string;
  supplier_name?: string;
  supplierCode?: string;
  supplier_code?: string;
  widthMm?: number;
  width_mm?: number;
  heightMm?: number;
  height_mm?: number;
  options?: unknown[];
  configuration?: {
    id?: number | string;
    items?: unknown[];
    [key: string]: unknown;
  };
  configurationJson?: Record<string, unknown>;
  configuration_json?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RawOrderLineInput {
  line_number: number;
  sub_line?: number;
  product_code?: string;
  description: string;
  quantity?: number;
  unit?: string;
  unit_price_cents?: number;
  total_price_cents?: number;
  is_hybrid?: boolean;
  etage_name?: string | null;
  room_name?: string | null;
  window_name?: string | null;
  position_id?: string | null;
  cluster_name?: string | null;
  spatial_metadata?: ExtractedSpatialMetadata | null;
  dim?: string | null;
  notes?: string | null;
  dimension_spec?: DimensionSpec | Record<string, unknown> | null;
  width_mm?: number;
  height_mm?: number;
  options?: string[];
  configuration_json?: Record<string, unknown> | null;
  supplier_name?: string;
  supplier_code?: string;
  configuration?: {
    id?: number | string;
    items?: unknown[];
    [key: string]: unknown;
  } | null;
  // Non-destructive Bronze Layer velden met lt_ prefix:
  lt_raw_data?: Record<string, unknown> | null;
  lt_id?: string | null;
  lt_configuration_json?: Record<string, unknown> | null;
  lt_configuration?: Record<string, unknown> | null;
  lt_width_mm?: number | null;
  lt_height_mm?: number | null;
  lt_options?: unknown[] | null;
  lt_supplier_name?: string | null;
  lt_supplier_code?: string | null;
  lt_comment_extern?: string | null;
  lt_comment_intern?: string | null;
  lt_vat_code?: string | null;
  lt_vat_percentage?: number | null;
  lt_discount_percentage?: number | null;
  lt_base_price_cents?: number | null;
  lt_reservations?: Array<{ number: string; lineNumber?: number }> | null;
  lt_stock_status?: string | null;
  lt_delivery_status?: string | null;
  lt_invoice_status?: string | null;
  // Backwards compatibility aliassen:
  raw_data?: Record<string, unknown> | null;
  external_line_id?: string | null;
  comment_extern?: string | null;
  comment_intern?: string | null;
  vat_code?: string | null;
  vat_percentage?: number | null;
  discount_percentage?: number | null;
  base_price_cents?: number | null;
  reservations?: Array<{ number: string; lineNumber?: number }> | null;
  stock_status?: string | null;
  delivery_status?: string | null;
  invoice_status?: string | null;
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
  lt_raw_data?: Record<string, unknown> | null;
  lt_id?: string | null;
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
  etage_name: string | null;
  etage_source?: SpatialProvenance;
  room_name?: string | null;
  room_source?: SpatialProvenance;
  window_name?: string | null;
  position_id?: string | null;
  pos_source?: SpatialProvenance;
  cluster_name?: string | null;
  cluster_source?: SpatialProvenance;
  spatial_metadata?: ExtractedSpatialMetadata | null;
  dim?: string | null;
  notes?: string | null;
  dimension_spec?: DimensionSpec | null;
  configuration_spec?: ConfigurationSpec | null;
  // Non-destructive Bronze Layer velden met lt_ prefix:
  lt_raw_data?: Record<string, unknown> | null;
  lt_id?: string | null;
  lt_configuration_json?: Record<string, unknown> | null;
  lt_configuration?: Record<string, unknown> | null;
  lt_width_mm?: number | null;
  lt_height_mm?: number | null;
  lt_options?: unknown[] | null;
  lt_supplier_name?: string | null;
  lt_supplier_code?: string | null;
  lt_comment_extern?: string | null;
  lt_comment_intern?: string | null;
  lt_vat_code?: string | null;
  lt_vat_percentage?: number | null;
  lt_discount_percentage?: number | null;
  lt_base_price_cents?: number | null;
  lt_reservations?: Array<{ number: string; lineNumber?: number }> | null;
  lt_stock_status?: string | null;
  lt_delivery_status?: string | null;
  lt_invoice_status?: string | null;
  // Backwards compatibility aliassen:
  raw_data?: Record<string, unknown> | null;
  external_line_id?: string | null;
  comment_extern?: string | null;
  comment_intern?: string | null;
  vat_code?: string | null;
  vat_percentage?: number | null;
  discount_percentage?: number | null;
  base_price_cents?: number | null;
  reservations?: Array<{ number: string; lineNumber?: number }> | null;
  stock_status?: string | null;
  delivery_status?: string | null;
  invoice_status?: string | null;
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
  lt_id?: string | null;
  lt_raw_data?: Record<string, unknown> | null;
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

/**
 * Isomorphic helper ensuring non-negative quantities (>= 0).
 * Null, undefined, NaN and invalid strings return 0.
 * Negative numbers are clamped to 0. Retains decimal values without Math.floor.
 */
export function toNonNegativeQuantity(val: unknown): number {
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || Number.isNaN(val)) return 0;
    return Math.max(0, val);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return 0;
    const num = Number(trimmed);
    if (!Number.isFinite(num) || Number.isNaN(num)) return 0;
    return Math.max(0, num);
  }
  return 0;
}

/**
 * Helper to parse quantity retaining 0 for storno/null rows and decimal quantities (e.g. 1.45m),
 * defaulting undefined/null to 1.
 */
export function resolveNumericQuantity(val: unknown): number {
  if (val === 0 || val === '0' || val === '0.0') return 0;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return 1;
}

