import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ClassificationService,
  TAXONOMY_CATEGORIES,
  TAXONOMY_PRODUCT_GROUPS,
  type ClassificationResult,
} from '@/domain/classification/central-classification-service';
import { processBackfillChunk } from '../../../../scripts/backfill_product_taxonomy';

describe('ClassificationService & Taxonomy SSOT', () => {
  let service: ClassificationService;

  beforeEach(() => {
    service = new ClassificationService();
  });

  describe('Taxonomy Structure & Canonical Parity', () => {
    it('defines all main categories plus 0, 7 and fallback category 9 (9 total)', () => {
      expect(TAXONOMY_CATEGORIES.length).toBe(9);
      const categoryIds = TAXONOMY_CATEGORIES.map((c) => c.id);
      expect(categoryIds).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 9]);
    });

    it('defines exactly 38 active product groups plus 9.9 UNCLASSIFIED (39 total)', () => {
      expect(TAXONOMY_PRODUCT_GROUPS.length).toBe(39);
      const codes = TAXONOMY_PRODUCT_GROUPS.map((g) => g.code);
      expect(codes).toContain('0.0');
      expect(codes).toContain('0.1');
      expect(codes).toContain('2.5');
      expect(codes).toContain('2.6');
      expect(codes).toContain('3.9');
      expect(codes).toContain('7.1');
      expect(codes).toContain('9.9');
      expect(codes).toContain('1.1');
      expect(codes).toContain('3.1');
      expect(codes).toContain('6.1');
      expect(codes).toContain('6.9');
    });

    it('harmonizes Category 6 disciplines with SERVICE_DISCIPLINE_TO_PRODUCT_GROUP (6.1..6.9)', () => {
      const cat6Groups = TAXONOMY_PRODUCT_GROUPS.filter((g) => g.category_id === 6);
      expect(cat6Groups.length).toBe(9);
      const cat6Codes = cat6Groups.map((g) => g.code);
      expect(cat6Codes).toEqual([
        '6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7', '6.8', '6.9'
      ]);
    });
  });

  describe('4-Stage Classification Pipeline', () => {
    it('Trap 1 (Mechanical Master Data): returns cached/known group instantly without cognitive overhead', async () => {
      service.registerMasterProduct('A000123', '3.1');
      const result: ClassificationResult = await service.classifyProduct({
        code: 'A000123',
        name: 'Uniclic Rigid PVC',
      });

      expect(result.productGroupCode).toBe('3.1');
      expect(result.stage).toBe('trap_1_master_cache');
      expect(result.requiresReview).toBe(false);
      expect(result.confidence).toBe(1.0);
    });

    it('Trap 2 (Mechanical Ontological Match): resolves deterministic floor underlay pattern', async () => {
      const result: ClassificationResult = await service.classifyProduct({
        code: 'NEW_SKU',
        name: 'Ondervloer Heat-Foil 10dB contactgeluidreductie',
        supplier_name: 'Estillon',
      });

      expect(result.productGroupCode).toBe('3.7');
      expect(result.stage).toBe('trap_2_deterministic_ontology');
      expect(result.requiresReview).toBe(false);
    });

    it('Trap 3 (Cognitive Typology Engine): resolves free-text description for curtain rail mounting', async () => {
      const result: ClassificationResult = await service.classifyFreeTextLine({
        description: 'Montage gordijnrails 2x erker inclusief runners en bochten',
      });

      expect(result.productGroupCode).toBe('6.1');
      expect(result.stage).toBe('trap_3_typology_engine');
      expect(result.requiresReview).toBe(false);
    });

    it('Trap 4 (Fail-Closed Quarantine): assigns 9.9 UNCLASSIFIED with requiresReview = true on ambiguous input', async () => {
      const result: ClassificationResult = await service.classifyFreeTextLine({
        description: 'diverse toeslagen n.t.b. spoedorder verrekening',
      });

      expect(result.productGroupCode).toBe('9.9');
      expect(result.stage).toBe('trap_4_fail_closed_quarantine');
      expect(result.requiresReview).toBe(true);
    });

    // [SPEC-CHANGE-AUTHORIZED: Dekking voor 33 productgroepen harmonisatie en false positive eliminatie]
    it('Trap 2 (Sanering Arte Substring): classificeert James startersset harde vloeren als 3.8 en NIET als 4.1', async () => {
      const result = await service.classifyProduct({
        code: 'A000123',
        name: 'James startersset harde vloeren',
        description: 'James startersset harde vloeren',
      });
      expect(result.productGroupCode).toBe('3.8');
      expect(result.productGroupCode).not.toBe('4.1');
    });

    it('Trap 2 (Sanering Arte Substring): classificeert leverancier Artelux gordijn als 1.1 en NIET als 4.1', async () => {
      const result = await service.classifyProduct({
        code: 'ART-001',
        name: 'Artelux Inbetween gordijnstof',
        supplier_name: 'Artelux',
      });
      expect(result.productGroupCode).toBe('1.1');
      expect(result.productGroupCode).not.toBe('4.1');
    });

    it('Trap 2 (Legitiem Arte Behang): classificeert echt Arte behang zuiver als 4.1', async () => {
      const result = await service.classifyProduct({
        code: 'BEH-001',
        name: 'Arte behang Focus collectie',
      });
      expect(result.productGroupCode).toBe('4.1');
    });

    // [SPEC-CHANGE-AUTHORIZED: Sub-Phase 3B Hybrid Classification Coverage]
    it('Trap 2 (Hybrid Material & Service): detects hybrid order line without losing material product group', async () => {
      const result: ClassificationResult = await service.classifyProduct({
        code: 'HYB-001',
        name: 'Visgraat PVC Eiken incl. leggen',
      });

      expect(result.productGroupCode).toBe('3.3');
      expect(result.stage).toBe('trap_2_deterministic_ontology');
      expect(result.isHybrid).toBe(true);
      expect(result.materialGroupCode).toBe('3.3');
      expect(result.serviceDisciplineCode).toBe('6.3');
      expect(result.requiresReview).toBe(false);
    });

    // [SPEC-CHANGE-AUTHORIZED: Tranche 2 TDD suite voor gecontextualiseerde ontologie en immuniteit voor meubels]
    it('Trap 2 (Gecontextualiseerde Jaloezieën): classificeert jaloezie met lamelmaat als 2.3', async () => {
      const result = await service.classifyProduct({
        code: 'JAL-001',
        name: 'Horizontale jaloezie 25 mm alu',
      });
      expect(result.productGroupCode).toBe('2.3');
      expect(result.stage).toBe('trap_2_deterministic_ontology');
    });

    it('Trap 2 (Meubel Immuniteit): classificeert horizontaal opberg element NIET als jaloezie (geen 2.3 kaping)', async () => {
      const result = await service.classifyProduct({
        code: 'KAST-01',
        name: 'BKS Aurora horizontaal opberg element',
      });
      expect(result.productGroupCode).not.toBe('2.3');
    });

    // [SPEC-CHANGE-AUTHORIZED: Taxonomie upgrade 2.5 Horren & Insectenwering isolatie]
    it('Trap 2 (Horren en Hordeuren): classificeert hordeur en inzethor direct naar 2.5', async () => {
      const result = await service.classifyProduct({
        code: 'HOR-01',
        name: 'Unilux plissé hordeur voorzet',
        supplier_name: 'Unilux',
      });
      expect(result.productGroupCode).toBe('2.5');
    });

    it('Trap 2 (Lamellen vs Lamellendak): classificeert lamellenrails als 1.4 en lamellendaken als 5.4 (geen 2.1 kaping)', async () => {
      const dakResult = await service.classifyProduct({
        code: 'DAK-01',
        name: 'Brera Lamellendak 400x300 cm',
      });
      expect(dakResult.productGroupCode).toBe('5.4');

      const railResult = await service.classifyProduct({
        code: 'RAIL-01',
        name: 'Lamellenrail compleet met runners',
      });
      expect(railResult.productGroupCode).toBe('1.4');
    });
  });

  describe('Keyset Backfill Chunk Runner', () => {
    it('generates batch payloads for batch_update_product_taxonomies with max 1000 items', async () => {
      const mockProducts = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        code: `SKU_${i + 1}`,
        name: i % 2 === 0 ? 'Click PVC Ambiant' : 'Rolgordijn Verosol',
      }));

      const batchPayload = await service.prepareBackfillBatch(mockProducts);
      expect(batchPayload.length).toBe(50);
      expect(batchPayload[0]).toHaveProperty('id');
      expect(batchPayload[0]).toHaveProperty('product_group_code');
      expect(['3.1', '2.1']).toContain(batchPayload[0].product_group_code);
    });

    it('processes chunk and updates checkpoint in dryRun mode', async () => {
      const mockProducts = [
        { id: 101, code: 'A1', name: 'Laminaat Quick-step' },
        { id: 102, code: 'A2', name: 'Duette Luxaflex' },
      ];

      const res = await processBackfillChunk(service, mockProducts, {
        url: 'https://mock.supabase.co',
        serviceKey: 'mock-key',
        dryRun: true,
      });

      expect(res.updatedCount).toBe(2);
      expect(res.maxId).toBe(102);
    });
  });
});
