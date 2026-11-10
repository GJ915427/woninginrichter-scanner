/**
 * src/types/taxonomy.ts
 *
 * Domeinmodellen en SSOT interfaces voor de 3NF Taxonomie
 * (Categorieën, Productgroepen, en Dynamische Views).
 */

export interface Category {
  id: number;
  name: string;
  code: string;
  created_at?: string;
}

export interface ProductGroup {
  code: string;
  category_id: number;
  name: string;
  default_uom: string;
  created_at?: string;
}

export interface TaxonomyMapping {
  productGroupCode: string;
  productGroupName: string;
  categoryId: number;
  categoryName: string;
  categoryCode: string;
  defaultUom: string;
}

export interface BatchProductTaxonomyUpdateItem {
  id: number;
  product_group_code: string;
}
