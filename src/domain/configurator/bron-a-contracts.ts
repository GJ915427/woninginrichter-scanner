/**
 * Bron A Canonieke Domeincontracten
 * 100% data-gedreven AST types conform LogicTrade.ConfigurationService v1
 * Bron: https://configurator.logictrade.app/swagger/v1/swagger.json
 */

/**
 * Type aanduiding van een configuratiestap conform Bron A
 */
export enum ConfigurationStepType {
  Numeric = 100,
  NumericDecimals = 110,
  Select = 200,
  Boolean = 300,
  Date = 310,
  FreeInputText = 400,
  MultiSelect = 500
}

/**
 * Een mogelijke keuzewaarde binnen een configuratiestap
 */
export interface ConfigurationStepValue {
  key: string;
  value: string;
  groupDescription?: string | null;
  calculatedValue?: number;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  chargeAmount?: number | null;
  recommendedChargeAmount?: number | null;
  purchaseChargeAmount?: number | null;
  actionPrice?: number | null;
  salesActionChargeAmount?: number | null;
  periodicSalesChargeAmount?: number | null;
  show?: boolean;
  code?: string | null;
  sequence?: number;
  customFields?: Array<Record<string, unknown>>;
  attributes?: Record<string, unknown> | null;
  internalAttributes?: Record<string, unknown> | null;
}

/**
 * Een enkele configuratiestap (veld) in de interactieve wizard
 */
export interface ConfigurationStep {
  id: string;
  description: string;
  code?: string | null;
  show: boolean;
  enabled: boolean;
  summaryItem?: boolean;
  sequence: number;
  type: ConfigurationStepType;
  minValue?: number | null;
  maxValue?: number | null;
  required: boolean;
  suffix?: string | null;
  customFields?: Array<Record<string, unknown>>;
  value?: string | null;
  valueDescription?: string | null;
  values?: string[] | null;
  possibleValueHash?: string | null;
  possibleValues?: ConfigurationStepValue[] | null;
  selectedValue?: ConfigurationStepValue | null;
  attributes?: Record<string, unknown> | null;
  internalAttributes?: Record<string, unknown> | null;
}

/**
 * Een resulterende stuklijst / orderregel na afronding van de configuratie
 */
export interface ArticleImplementation {
  articleCode: string;
  articleDescription: string;
  quantity: number;
  price: number;
  vatPercentage: number;
  unit?: string;
  customFields?: Array<Record<string, unknown>>;
}

/**
 * Validatiefout gegenereerd door de fabrieksregels in Bron A
 */
export interface ConfigurationError {
  code?: string;
  message: string;
  stepId?: string;
  severity?: 'error' | 'warning' | 'info';
}

/**
 * De integrale configuratiesessie conform LogicTrade.ConfigurationService.Base.Models.Configuration
 */
export interface Configuration {
  configurationGuid: string;
  quantity?: number | null;
  steps: ConfigurationStep[];
  image?: {
    imageUrl?: string | null;
    thumbnailUrl?: string | null;
  } | null;
  possibleValuesImageUrl?: string | null;
  summary?: string | null;
  attributes?: Record<string, unknown> | null;
  articleDescription?: string | null;
  articleCode?: string | null;
  implementations?: ArticleImplementation[] | null;
  errors: ConfigurationError[];
}

/**
 * Inputparameter voor POST /api/hunterdouglas/start
 */
export interface HunterDouglasStart {
  articleId?: number;
  articleCode?: string | null;
  variantId?: string | null;
  externConfiguratorId?: number;
  administrationKey?: string | null;
  configurationGuid?: string | null;
  token?: string | null;
  language?: string | null;
  priceType?: string | null;
  configurationServiceUrl?: string | null;
}

/**
 * Inputparameter voor POST /api/curtainv2/start
 */
export interface CurtainV2Start {
  articleId?: number;
  articleCode?: string | null;
  articleDescription?: string | null;
  fabricTrackWidth?: number;
  patternHeight?: number;
  fabricType?: string | null;
  curtainType?: string | null;
  leadLace?: string | null;
  roomHighFabric?: boolean;
  laceCurtain?: boolean;
  token?: string | null;
  administrationKey?: string | null;
}

/**
 * Resultaat van de Conclaaf & Consensus validatie
 */
export interface ConclaafValidationResult {
  isValid: boolean;
  errors: ConfigurationError[];
  warnings: string[];
}
