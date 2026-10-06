/**
 * Domain Contracts voor Dynamische Configurator & Productgroep-herkenning
 * 100% data-gedreven op basis van LogicTrade Cloud ERP data (Nul hardcoded schaduwcatalogi).
 */

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
