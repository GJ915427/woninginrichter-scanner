/**
 * src/domain/classification/central-classification-service.ts
 *
 * Centrale Classificatie Service & Taxonomie SSOT (32 Productgroepen + 9.9 UNCLASSIFIED)
 * Implementeert de 4-traps cascade (Mechanisch vóór Cognitief) conform Grondwet Laag 1B § 6.
 */

import type { Category, ProductGroup, BatchProductTaxonomyUpdateItem } from '@/types/taxonomy';
import {
  detectServiceDiscipline,
  SERVICE_DISCIPLINE_TO_PRODUCT_GROUP,
} from '@/domain/search/v2/cognitive-typology-classifier';

export const TAXONOMY_CATEGORIES: readonly Category[] = [
  { id: 1, name: 'Raambekleding Stof', code: 'raambekleding_stof' },
  { id: 2, name: 'Raambekleding Hard', code: 'raambekleding_hard' },
  { id: 3, name: 'Vloeren & Afwerking', code: 'vloeren_afwerking' },
  { id: 4, name: 'Wandafwerking', code: 'wandafwerking' },
  { id: 5, name: 'Buiten & Zonwering', code: 'buiten_zonwering' },
  { id: 6, name: 'Diensten & Arbeid', code: 'diensten_arbeid' },
  { id: 9, name: 'Onbekend / Fallback', code: 'onbekend_fallback' },
] as const;

export const TAXONOMY_PRODUCT_GROUPS: readonly ProductGroup[] = [
  // Categorie 1: Raambekleding Stof
  { code: '1.1', category_id: 1, name: 'Gordijnen & Vitrages', default_uom: 'm1' },
  { code: '1.2', category_id: 1, name: 'Vouwgordijnen', default_uom: 'stuks' },
  { code: '1.3', category_id: 1, name: 'Paneelgordijnen', default_uom: 'stuks' },
  { code: '1.4', category_id: 1, name: 'Rails & Roedes', default_uom: 'm1' },
  // Categorie 2: Raambekleding Hard
  { code: '2.1', category_id: 2, name: 'Rolgordijnen & Duo', default_uom: 'stuks' },
  { code: '2.2', category_id: 2, name: 'Jaloezieën Hout / Bamboe', default_uom: 'stuks' },
  { code: '2.3', category_id: 2, name: 'Jaloezieën Aluminium', default_uom: 'stuks' },
  { code: '2.4', category_id: 2, name: 'Plissés & Duettes', default_uom: 'stuks' },
  // Categorie 3: Vloeren & Afwerking
  { code: '3.1', category_id: 3, name: 'Click PVC', default_uom: 'm2' },
  { code: '3.2', category_id: 3, name: 'Dryback PVC (Plak)', default_uom: 'm2' },
  { code: '3.3', category_id: 3, name: 'Visgraat & Patroon PVC', default_uom: 'm2' },
  { code: '3.4', category_id: 3, name: 'Laminaat & Parket', default_uom: 'm2' },
  { code: '3.5', category_id: 3, name: 'Tapijt & Karpetten', default_uom: 'm2' },
  { code: '3.6', category_id: 3, name: 'Egaline, Lijm & Egalisatie', default_uom: 'kg' },
  { code: '3.7', category_id: 3, name: 'Ondervloeren', default_uom: 'm2' },
  { code: '3.8', category_id: 3, name: 'Plinten & Profielen', default_uom: 'm1' },
  // Categorie 4: Wandafwerking
  { code: '4.1', category_id: 4, name: 'Behang & Renovlies', default_uom: 'rollen' },
  { code: '4.2', category_id: 4, name: 'Wandpanelen & Akoestiek', default_uom: 'stuks' },
  { code: '4.3', category_id: 4, name: 'Verf & Stucmaterialen', default_uom: 'liters' },
  // Categorie 5: Buiten & Zonwering
  { code: '5.1', category_id: 5, name: 'Screens & Zipscreens', default_uom: 'stuks' },
  { code: '5.2', category_id: 5, name: 'Knikarmschermen', default_uom: 'stuks' },
  { code: '5.3', category_id: 5, name: 'Rolluiken Buiten', default_uom: 'stuks' },
  { code: '5.4', category_id: 5, name: 'Lamellendaken & Overkapping', default_uom: 'stuks' },
  // Categorie 6: Diensten & Arbeid
  { code: '6.1', category_id: 6, name: 'Gordijn & Rail Montage', default_uom: 'm1' },
  { code: '6.2', category_id: 6, name: 'Binnenzonwering Montage', default_uom: 'stuks' },
  { code: '6.3', category_id: 6, name: 'Vloer Legservice', default_uom: 'm2' },
  { code: '6.4', category_id: 6, name: 'Trapstoffering Montage', default_uom: 'treden' },
  { code: '6.5', category_id: 6, name: 'Buitenzonwering Montage', default_uom: 'stuks' },
  { code: '6.6', category_id: 6, name: 'Inmeet & Schouw Service', default_uom: 'stuks' },
  { code: '6.7', category_id: 6, name: 'Sloop, Egalisatie & Voorbereiding', default_uom: 'm2' },
  { code: '6.8', category_id: 6, name: 'Logistiek & Materieel Service', default_uom: 'stuks' },
  { code: '6.9', category_id: 6, name: 'Overige Diensten & Maatwerk', default_uom: 'stuks' },
  // Categorie 9: Fallback
  { code: '9.9', category_id: 9, name: 'Niet geclassificeerd', default_uom: 'stuks' },
] as const;

export type ClassificationStage =
  | 'trap_1_master_cache'
  | 'trap_2_deterministic_ontology'
  | 'trap_3_typology_engine'
  | 'trap_4_fail_closed_quarantine';

export interface ClassificationResult {
  productGroupCode: string;
  productGroupName: string;
  categoryId: number;
  categoryName: string;
  stage: ClassificationStage;
  confidence: number;
  requiresReview: boolean;
}

export interface ClassifyProductInput {
  code?: string;
  name: string;
  description?: string;
  supplier_name?: string;
  sales_group?: string;
}

export interface ClassifyFreeTextInput {
  description: string;
  supplier_name?: string;
}

export class ClassificationService {
  private masterCache: Map<string, string> = new Map();
  private productGroupMap: Map<string, ProductGroup> = new Map();
  private categoryMap: Map<number, Category> = new Map();

  constructor() {
    for (const group of TAXONOMY_PRODUCT_GROUPS) {
      this.productGroupMap.set(group.code, group);
    }
    for (const cat of TAXONOMY_CATEGORIES) {
      this.categoryMap.set(cat.id, cat);
    }
  }

  public registerMasterProduct(productCode: string, productGroupCode: string): void {
    if (productCode && productGroupCode) {
      this.masterCache.set(productCode.trim().toUpperCase(), productGroupCode);
    }
  }

  public async classifyProduct(input: ClassifyProductInput): Promise<ClassificationResult> {
    const code = (input.code || '').trim().toUpperCase();

    // Trap 1: Mechanisch Master Data Cache (0ms)
    if (code && this.masterCache.has(code)) {
      const groupCode = this.masterCache.get(code)!;
      return this.buildResult(groupCode, 'trap_1_master_cache', 1.0, false);
    }

    // Trap 2: Mechanisch Deterministische Ontologie (<1ms)
    const trap2Group = this.matchDeterministicOntology(input);
    if (trap2Group) {
      return this.buildResult(trap2Group, 'trap_2_deterministic_ontology', 0.95, false);
    }

    // Trap 3: Cognitieve Typologie Classificatie Engine
    const trap3Result = this.evaluateCognitiveTypology(input.name, input.description);
    if (trap3Result) {
      return trap3Result;
    }

    // Trap 4: Fail-Closed Quarantaine
    return this.buildResult('9.9', 'trap_4_fail_closed_quarantine', 0.1, true);
  }

  public async classifyFreeTextLine(input: ClassifyFreeTextInput): Promise<ClassificationResult> {
    return this.classifyProduct({
      code: 'TEKST',
      name: input.description,
      description: input.description,
      supplier_name: input.supplier_name,
    });
  }

  public async prepareBackfillBatch(
    products: Array<{ id: number; code?: string; name: string; description?: string; supplier_name?: string }>
  ): Promise<BatchProductTaxonomyUpdateItem[]> {
    const batch: BatchProductTaxonomyUpdateItem[] = [];

    for (const product of products) {
      const result = await this.classifyProduct(product);
      batch.push({
        id: product.id,
        product_group_code: result.productGroupCode,
      });
    }

    return batch;
  }

  private matchDeterministicOntology(input: ClassifyProductInput): string | null {
    const text = `${input.name || ''} ${input.description || ''} ${input.supplier_name || ''} ${input.sales_group || ''}`.toLowerCase();

    // Als de tekst een duidelijke dienst of montagetaak betreft, delegeer aan Trap 3
    if (/\b(montage|monteren|plaatsen|leggen|inmeten|inmeet|schouw|stofferen|stoffering|service|uurtarief|arbeid)\b/i.test(text)) {
      return null;
    }

    // Ondervloeren
    if (text.includes('ondervloer') || text.includes('heat-foil') || text.includes('jumpax') || text.includes('estillon')) {
      return '3.7';
    }

    // Egaline & Lijm
    if (text.includes('egaline') || text.includes('egaliseer') || text.includes('thomsit') || text.includes('eurocol') || text.includes('uzin')) {
      return '3.6';
    }

    // Plinten & Profielen
    if (text.includes('plint') || text.includes('overgangsprofiel') || text.includes('hoekprofiel')) {
      return '3.8';
    }

    // PVC Vloeren
    if (text.includes('visgraat') && (text.includes('pvc') || text.includes('vloer'))) {
      return '3.3';
    }
    if (text.includes('click pvc') || text.includes('klik pvc') || text.includes('uniclic') || text.includes('rigid')) {
      return '3.1';
    }
    if (text.includes('dryback') || text.includes('plak pvc') || text.includes('lijm pvc') || text.includes('stroken')) {
      return '3.2';
    }
    if (text.includes('laminaat') || text.includes('parket')) {
      return '3.4';
    }
    if (text.includes('tapijt') || text.includes('karpet')) {
      return '3.5';
    }

    // Behang & Wandafwerking
    if (text.includes('behang') || text.includes('renovlies') || text.includes('glasvezel') || text.includes('arte')) {
      return '4.1';
    }
    if (text.includes('wandpaneel') || text.includes('akupanel')) {
      return '4.2';
    }
    if (text.includes('verf') || text.includes('stuc') || text.includes('sikkens')) {
      return '4.3';
    }

    // Raambekleding Hard
    if (text.includes('duette') || text.includes('plissé') || text.includes('plisse')) {
      return '2.4';
    }
    if (text.includes('rolgordijn') || text.includes('duo rolgordijn')) {
      return '2.1';
    }
    if (text.includes('jaloezie') && (text.includes('hout') || text.includes('bamboe'))) {
      return '2.2';
    }
    if (text.includes('jaloezie') && (text.includes('alu') || text.includes('aluminium'))) {
      return '2.3';
    }

    // Raambekleding Stof
    if (text.includes('vouwgordijn')) {
      return '1.2';
    }
    if (text.includes('paneelgordijn')) {
      return '1.3';
    }
    if (text.includes('rail') || text.includes('roede') || text.includes('interstil') || text.includes('goelst')) {
      return '1.4';
    }
    if (text.includes('gordijn') || text.includes('vitrage') || text.includes('inbetween')) {
      return '1.1';
    }

    // Buiten & Zonwering
    if (text.includes('screen') || text.includes('zipscreen')) {
      return '5.1';
    }
    if (text.includes('knikarm') || text.includes('terrasscherm')) {
      return '5.2';
    }
    if (text.includes('rolluik')) {
      return '5.3';
    }
    if (text.includes('lamellendak') || text.includes('overkapping')) {
      return '5.4';
    }

    return null;
  }

  private evaluateCognitiveTypology(name: string, description?: string): ClassificationResult | null {
    const combined = `${name || ''} ${description || ''}`.trim();
    if (!combined) return null;

    // Check service disciplines via detectServiceDiscipline
    const serviceRes = detectServiceDiscipline(combined);
    if (serviceRes && serviceRes.discipline) {
      const pgCode = SERVICE_DISCIPLINE_TO_PRODUCT_GROUP[serviceRes.discipline];
      if (pgCode) {
        return this.buildResult(pgCode, 'trap_3_typology_engine', 0.9, false);
      }
    }

    return null;
  }

  private buildResult(
    productGroupCode: string,
    stage: ClassificationStage,
    confidence: number,
    requiresReview: boolean
  ): ClassificationResult {
    const group = this.productGroupMap.get(productGroupCode) || this.productGroupMap.get('9.9')!;
    const category = this.categoryMap.get(group.category_id) || this.categoryMap.get(9)!;

    return {
      productGroupCode: group.code,
      productGroupName: group.name,
      categoryId: category.id,
      categoryName: category.name,
      stage,
      confidence,
      requiresReview,
    };
  }
}
