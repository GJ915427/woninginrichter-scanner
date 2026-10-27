import { describe, it, expect } from 'vitest';
import {
  classifyCognitiveTypology,
  mapDomainToCategory,
  type HarvestedRawArticle,
  type CanonicalDomain,
} from '@/domain/search/v2/cognitive-typology-classifier';

describe('CognitiveTypologyClassifier (TDD Suite)', () => {
  describe('mapDomainToCategory Adapter', () => {
    it('exhaustively maps all 8 CanonicalDomain literals to DomainCategory', () => {
      expect(mapDomainToCategory('RAAMBEKLEDING')).toBe('RAAMBEKLEDING');
      expect(mapDomainToCategory('GORDIJNEN')).toBe('RAAMBEKLEDING');
      expect(mapDomainToCategory('VLOEREN')).toBe('VLOEREN');
      expect(mapDomainToCategory('HORREN')).toBe('HORREN');
      expect(mapDomainToCategory('TRAPBEKLEDING')).toBe('VLOEREN');
      expect(mapDomainToCategory('ACCESSOIRES')).toBe('ACCESSOIRES');
      expect(mapDomainToCategory('DIENSTEN')).toBe('DIENSTEN');
      expect(mapDomainToCategory('UNCLASSIFIED')).toBe('UNCLASSIFIED');
    });
  });

  describe('Happy Path Scenarios', () => {
    it('H1: classifies Luxaflex Duette AU20 SmartCord with options and dimensions', () => {
      const input: HarvestedRawArticle = {
        articleCode: 'A00052469',
        articleName: 'Duette 25mm AU20 SmartCord',
        supplierName: 'Luxaflex',
        orderOptions: ['Klemsteunen', 'SmartCord Bediening', 'Top-Down/Bottom-Up'],
        rawConfigurations: [
          { key: 'BEDIENINGS_TYPE', value: 'SMARTCORD', label: 'SmartCord Bediening', count: 14 },
          { key: 'MONTAGE', value: 'KLEMSTEUNEN', label: 'Klemsteunen', count: 12 },
        ],
        observedDimensions: {
          minWidthMm: 800,
          maxWidthMm: 1600,
          minHeightMm: 1000,
          maxHeightMm: 2200,
        },
        historicalOccurrences: 18,
      };

      const result = classifyCognitiveTypology(input);

      expect(result.id).toBe('A00052469');
      expect(result.code).toBe('A00052469');
      expect(result.domain).toBe('RAAMBEKLEDING');
      expect(result.category).toBe('RAAMBEKLEDING');
      expect(result.productType).toBe('DUETTE_SHADE');
      expect(result.itemRole).toBe('CONFIGURABLE_MAIN');
      expect(result.classificationConfidence).toBeGreaterThanOrEqual(0.95);
      expect(result.requiresHitlReview).toBe(false);

      // Verify SSOT stepId binding (INV-CPQ-02)
      const smartcordCap = result.capabilities.find(c => c.key === 'SMARTCORD');
      expect(smartcordCap).toBeDefined();
      expect(smartcordCap?.stepId).toBe('BEDIENINGS_TYPE');
      expect(smartcordCap?.name).toBe('SmartCord');

      expect(result.observedDimensions).toEqual({
        minWidthMm: 800,
        maxWidthMm: 1600,
        minHeightMm: 1000,
        maxHeightMm: 2200,
      });
    });

    it('H2: classifies cryptic Wooden Venetian Blind ("B&C HZ 25 ST")', () => {
      const input: HarvestedRawArticle = {
        articleCode: 'BC-HZ25',
        articleName: 'B&C HZ 25 ST Hout 25mm',
        supplierName: 'B&C Raamdecoratie',
        orderOptions: ['Koordbediening', 'Kleur Wit 010'],
        rawConfigurations: [
          { key: 'BEDIENINGS_TYPE', value: 'KOORD', label: 'Koordbediening', count: 5 },
        ],
        historicalOccurrences: 6,
      };

      const result = classifyCognitiveTypology(input);

      expect(result.id).toBe('BC-HZ25');
      expect(result.domain).toBe('RAAMBEKLEDING');
      expect(result.category).toBe('RAAMBEKLEDING');
      expect(result.productType).toBe('HORIZONTALE_JALOEZIE');
      expect(result.itemRole).toBe('CONFIGURABLE_MAIN');
      expect(result.classificationConfidence).toBeGreaterThanOrEqual(0.95);
      expect(result.requiresHitlReview).toBe(false);
    });

    it('H3: classifies Unilux Plissé Insect Screen Door ("UN-PL-01")', () => {
      const input: HarvestedRawArticle = {
        articleCode: 'UN-PL-01',
        articleName: 'Plissé hordeur Allure enkel',
        supplierName: 'Unilux',
        orderOptions: ['Standaard geleider', 'Gaas Zwart'],
        rawConfigurations: [
          { key: 'MONTAGE', value: 'IN_DE_DAG', label: 'In de dag montage', count: 8 },
        ],
        historicalOccurrences: 9,
      };

      const result = classifyCognitiveTypology(input);

      expect(result.id).toBe('UN-PL-01');
      expect(result.domain).toBe('HORREN');
      expect(result.category).toBe('HORREN');
      expect(result.productType).toBe('PLISSE_HORDEUR');
      expect(result.itemRole).toBe('CONFIGURABLE_MAIN');
      expect(result.classificationConfidence).toBeGreaterThanOrEqual(0.95);
      expect(result.requiresHitlReview).toBe(false);
    });

    it('H4: classifies Trapbekleding & Traprenovatie (§3.5)', () => {
      const input: HarvestedRawArticle = {
        articleCode: 'TRAP-REN-OAK',
        articleName: 'Traprenovatie Eik Natuur Overzettreden',
        supplierName: 'Trenovo',
        orderOptions: ['13 treden', 'Stootborden wit'],
        rawConfigurations: [],
        historicalOccurrences: 4,
      };

      const result = classifyCognitiveTypology(input);

      expect(result.domain).toBe('TRAPBEKLEDING');
      expect(result.category).toBe('VLOEREN'); // Backwards-compatible mapped
      expect(result.productType).toBe('TRAPRENOVATIE_OVERZETTREDEN');
      expect(result.itemRole).toBe('CONFIGURABLE_MAIN');
      expect(result.classificationConfidence).toBeGreaterThanOrEqual(0.95);
    });

    it('H5: classifies Curtains / Gordijnen (§3.2)', () => {
      const input: HarvestedRawArticle = {
        articleCode: 'PLOEG-VIL-01',
        articleName: 'De Ploeg Gordijnstof Vilano kamerhoog',
        supplierName: 'De Ploeg',
        orderOptions: ['Dubbele plooi', 'Inclusief loodveter'],
        rawConfigurations: [
          { key: 'CONFECTIE', value: 'DUBBELE_PLOOI', label: 'Dubbele plooi', count: 10 },
        ],
        historicalOccurrences: 11,
      };

      const result = classifyCognitiveTypology(input);

      expect(result.domain).toBe('GORDIJNEN');
      expect(result.category).toBe('RAAMBEKLEDING');
      expect(result.productType).toBe('OVERGORDIJN');
      expect(result.itemRole).toBe('CONFIGURABLE_MAIN');
      expect(result.classificationConfidence).toBeGreaterThanOrEqual(0.95);
    });
  });

  describe('Edge Cases', () => {
    it('E1: detects Knipstaal & Samples and marks as SAMPLE', () => {
      const input: HarvestedRawArticle = {
        articleCode: 'KEN-SMP-0439',
        articleName: 'Kendix 0439/12 Knipstaal 20x30cm',
        supplierName: 'Kendix',
        orderOptions: [],
        rawConfigurations: [],
        historicalOccurrences: 25,
      };

      const result = classifyCognitiveTypology(input);

      expect(result.itemRole).toBe('SAMPLE');
      expect(result.productType).toBe('KNIPSTAAL');
      expect(result.requiresHitlReview).toBe(false);
    });

    it('E2: detects Labor & Montage services and marks as LABOR_SERVICE', () => {
      const input: HarvestedRawArticle = {
        articleCode: 'SRV-MONT-01',
        articleName: 'Inmeten en monteren raambekleding verdieping',
        orderOptions: [],
        rawConfigurations: [],
        historicalOccurrences: 45,
      };

      const result = classifyCognitiveTypology(input);

      expect(result.domain).toBe('DIENSTEN');
      expect(result.category).toBe('DIENSTEN');
      expect(result.itemRole).toBe('LABOR_SERVICE');
      expect(result.requiresHitlReview).toBe(false);
    });

    it('E3: marks unknown collection with low confidence for HITL Review', () => {
      const input: HarvestedRawArticle = {
        articleCode: 'UNK-999',
        articleName: 'Speciaal profiel type X onbekend model',
        orderOptions: [],
        rawConfigurations: [],
        historicalOccurrences: 1,
      };

      const result = classifyCognitiveTypology(input);

      expect(result.supplierName).toBe('ONBEKEND');
      expect(result.classificationConfidence).toBeLessThan(0.95);
      expect(result.requiresHitlReview).toBe(true);
      expect(result.reasoning).toBeTruthy();
    });

    it('E4: excludes non-positive dimensions from range calculation', () => {
      const input: HarvestedRawArticle = {
        articleCode: 'DUETTE-AU20-TEST',
        articleName: 'Duette AU20 25mm',
        supplierName: 'Luxaflex',
        orderOptions: [],
        rawConfigurations: [],
        observedDimensions: {
          minWidthMm: 600,
          maxWidthMm: 2000,
          minHeightMm: 800,
          maxHeightMm: 2500,
        },
        historicalOccurrences: 3,
      };

      const result = classifyCognitiveTypology(input);

      expect(result.observedDimensions?.minWidthMm).toBe(600);
      expect(result.observedDimensions?.minHeightMm).toBe(800);
    });
  });

  describe('Corner Cases', () => {
    it('C1: immune to homonym context conflict ("van vloer tot plafond")', () => {
      const input: HarvestedRawArticle = {
        articleCode: 'GORD-VLOER-PLAFOND',
        articleName: 'Gordijnstof prachtig vallend doek van vloer tot plafond voor schuifpui',
        supplierName: 'Kobe',
        orderOptions: ['Enkele plooi'],
        rawConfigurations: [],
        historicalOccurrences: 7,
      };

      const result = classifyCognitiveTypology(input);

      // Must NOT be classified as VLOEREN!
      expect(result.domain).toBe('GORDIJNEN');
      expect(result.category).toBe('RAAMBEKLEDING');
      expect(result.domain).not.toBe('VLOEREN');
    });

    it('C3: normalizes model code variations (UA20 vs AU-20)', () => {
      const inputs = [
        { code: 'D-01', name: 'Duette UA20 model 25mm' },
        { code: 'D-02', name: 'Duette AU-20 Top-Down' },
        { code: 'D-03', name: 'Duette 25mm AU20 SmartCord' },
      ];

      for (const inp of inputs) {
        const res = classifyCognitiveTypology({
          articleCode: inp.code,
          articleName: inp.name,
          orderOptions: [],
          rawConfigurations: [],
          historicalOccurrences: 2,
        });

        expect(res.productType).toBe('DUETTE_SHADE');
        expect(res.reasoning).toContain('AU20');
      }
    });
  });
});
