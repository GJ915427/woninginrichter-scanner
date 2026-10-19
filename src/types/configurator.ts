/**
 * Domain Contracts voor Dynamische Configurator & Productgroep-herkenning
 * 100% data-gedreven op basis van LogicTrade Cloud ERP data (Nul hardcoded schaduwcatalogi).
 */

import type { Configuration } from '@/domain/configurator/bron-a-contracts';
import type { SearchResultItem } from './product';

export type ProductCategory = 'raamdecoratie' | 'gordijnen' | 'vloeren' | 'algemeen';

export type FieldType = 'number' | 'text' | 'select' | 'boolean';

export interface SelectOption {
  value: string;
  label: string;
}

export interface ConfiguratorField {
  key: string;
  label: string;
  type: FieldType;
  unit?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: SelectOption[];
  helpText?: string;
}

export interface ConfiguratorSchema {
  category: ProductCategory;
  categoryLabel: string;
  description: string;
  fields: ConfiguratorField[];
}

export type ProductConfigValues = Record<string, string | number | boolean>;

export type PreconfigurationMap = Record<string, string>;

export interface StepChangeIntent {
  stepId: string;
  value: string;
}

export interface ConfigurationSnapshot {
  configuration: Configuration;
  totalSurchargeEur: number;
  calculationErrors: string[];
}

/**
 * M3 Zoekbox & Zoekhistorie Contracten
 */
export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  selectedCode?: string;
  selectedName?: string;
}

export interface M3SearchBoxProps {
  onSelectProduct: (product: SearchResultItem) => void;
  initialProduct?: SearchResultItem | null;
  placeholder?: string;
  className?: string;
}
