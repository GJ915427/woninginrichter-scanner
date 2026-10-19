/**
 * LogicTrade Cloud REST API Domain Types & Frontend Search Contracts
 * 100% data-gedreven conform het officiële LogicTrade v1 schema.
 */

export interface LogicTradeProductGroup {
  id: number;
  parentId: number | null;
  code: string;
  description: string;
  customFields?: Array<Record<string, unknown>>;
}

export interface LogicTradeSalesGroup {
  id: number;
  code: string;
  description: string;
}

export interface LogicTradeVat {
  id: number;
  code: string;
  description: string;
}

export interface LogicTradeSupplierDetail {
  id: number;
  number?: string;
  companyName: string;
  phoneNumber?: string;
  email?: string;
  address?: {
    street?: string;
    houseNumber?: string;
    zipCode?: string;
    city?: string;
    country?: string;
  };
}

export interface LogicTradeSupplierWrapper {
  code?: string;
  description?: string;
  purchasePrice?: number;
  leadTimeInWeeks?: number;
  supplier?: LogicTradeSupplierDetail;
}

export interface LogicTradeAttributeValue {
  id: number;
  code: string;
  value: string;
}

export interface LogicTradeAttribute {
  id: number;
  code: string;
  name: string;
  type: string;
  values?: LogicTradeAttributeValue[];
}

export interface LogicTradeProductRaw {
  id: number;
  code: string;
  name: string;
  description?: string;
  barcode?: string;
  unit?: string;
  salesPrice: number;
  configurable?: boolean;
  sellable?: string;
  groups?: LogicTradeProductGroup[];
  salesGroup?: LogicTradeSalesGroup;
  vat?: LogicTradeVat;
  supplier?: LogicTradeSupplierWrapper;
  attributes?: LogicTradeAttribute[];
  images?: string[];
}

export interface LogicTradePagination {
  totalResults: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export interface LogicTradeResponseEnvelope {
  pagination?: LogicTradePagination;
  results: LogicTradeProductRaw[];
}

export interface LogicTradeSuppliersEnvelope {
  pagination?: LogicTradePagination;
  results: LogicTradeSupplierDetail[];
}

export interface SupplierBasic {
  id: number;
  number?: string;
  companyName: string;
}

export interface ModelPreset {
  code: string;
  name: string;
  productFamily: string;
  vorm: string;
  bediening: string;
  montage?: string;
  surchargeEur?: number;
}

export interface ProductPreconfiguration {
  montage?: 'STANDAARD' | 'MONTAGE_TRUFIT' | 'KLEMSTEUNEN' | string;
  bediening?: 'STANDAARD' | 'HANDGREEP' | 'SMARTCORD' | 'KETTING' | 'POWERVIEW' | string;
  modelPreset?: ModelPreset;
  stofFilter?: string;
  eigenschap?: string;
  // ConclaafRulesEngine SSOT Step IDs (Grondwet Laag 1B)
  VORM?: string;
  MONTAGE?: string;
  BEDIENINGS_TYPE?: string;
  PROFIELKLEUR?: string;
  VOEDINGSTYPE?: string;
  VOEDINGSZIJDE?: string;
  BEDIENINGSZIJDE?: string;
  STOF_KLEUR?: string;
  PLOOISOORT?: string;
  LOODVETER?: string;
  OPENING?: string;
  SNIJVERLIES?: string;
  LEGWYZE?: string;
  PLINTEN?: string;
  [key: string]: any;
}

/**
 * Gestandaardiseerd contract voor de EasyM2M UI
 */
export interface SearchResultItem {
  id: number;
  code: string;
  name: string;
  description?: string;
  unit: string;
  salesPrice: number;
  salesGroup: string;
  supplierName: string;
  supplierId: number | null;
  groups: string[];
  vatCode: string;
  modelPreset?: ModelPreset;
  isDiscontinued?: boolean;
  featureBadges?: string[];
  preconfiguration?: ProductPreconfiguration;
}

export interface SearchApiResponse {
  success: boolean;
  query: string;
  count: number;
  items: SearchResultItem[];
  pagination?: {
    page: number;
    pageSize: number;
    totalResults: number;
    totalPages: number;
    hasMore: boolean;
  };
  error?: string;
}
