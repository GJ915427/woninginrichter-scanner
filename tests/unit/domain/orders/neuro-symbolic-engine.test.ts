import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NeuroSymbolicEngine,
  type NeuroSymbolicEngineOptions,
  type NeuroSymbolicLineResult,
} from '@/domain/orders/neuro-symbolic-engine';
import { ClassificationService } from '@/domain/classification/central-classification-service';
import { ConfigurationExtractionEngine } from '@/domain/orders/configuration-extraction-engine';
import { DimensionExtractionEngine } from '@/domain/orders/dimension-extraction-engine';
import type {
  RawOrderLineInput,
  CognitiveExtractionContext,
  ICognitiveExtractionProvider,
  ResolvedProductEntity,
} from '@/types/order-intake';

describe('NeuroSymbolicEngine (4-Layer Cognitive-Deterministic Architecture)', () => {
  let engine: NeuroSymbolicEngine;
  let mockCognitiveProvider: ICognitiveExtractionProvider;
  let classificationService: ClassificationService;
  let extractionEngine: ConfigurationExtractionEngine;
  let dimensionEngine: DimensionExtractionEngine;

  beforeEach(() => {
    mockCognitiveProvider = {
      extract: vi.fn().mockResolvedValue({
        status: 'success',
        confidence: 0.95,
        source: 'cognitive',
        options: { color: 'Antraciet' },
        dimensions: { width_mm: 1800, height_mm: 2400 },
      }),
    };

    classificationService = new ClassificationService();
    extractionEngine = new ConfigurationExtractionEngine();
    dimensionEngine = new DimensionExtractionEngine();

    engine = new NeuroSymbolicEngine({
      cognitiveProvider: mockCognitiveProvider,
      classificationService,
      extractionEngine,
      dimensionEngine,
    });
  });

  describe('Laag 0: Raw Immutability & Catalog Hydration', () => {
    it('behoudt lt_raw_data en ruwe brondata 100% ongewijzigd in de output', async () => {
      const line: RawOrderLineInput = {
        line_number: 10,
        product_code: 'A000123',
        description: 'Rigid Core Click PVC Vloer',
        quantity: 12,
        unit: 'pak',
        unit_price_cents: 4500,
        total_price_cents: 54000,
        lt_raw_data: { customField: 'bronwaarde', nested: { id: 99 } },
        notes: 'Levering op 1e etage via lift',
      };

      const result = await engine.processLine(line);
      expect(result.productGroupCode).toBeDefined();
      expect(line.lt_raw_data).toEqual({ customField: 'bronwaarde', nested: { id: 99 } });
    });

    it('hydrateert catalogus-attributen via de meegegeven context', async () => {
      const line: RawOrderLineInput = {
        line_number: 10,
        product_code: 'A00052374',
        description: 'Vrij artikel raamdecoratie',
        quantity: 1,
        unit_price_cents: 15000,
        total_price_cents: 15000,
      };

      const catalogProduct: ResolvedProductEntity = {
        id: 1001,
        code: 'A00052374',
        name: 'Vrij artikel Zonwering',
        unit: 'stuks',
        product_group_code: '2.4',
        is_generic_container: true,
      };

      const result = await engine.processLine(line, {
        line,
        catalogProduct,
      });

      // Generieke container moet escaleren naar Laag 2
      expect(mockCognitiveProvider.extract).toHaveBeenCalled();
    });
  });

  describe('Laag 1: Deterministisch ERP & Configurator Engine (0 AI tokens)', () => {
    it('classificeert informatieve tekst TEKST à €0 zuiver als 0.0 Informatieve Tekst / Clausule', async () => {
      const line: RawOrderLineInput = {
        line_number: 10,
        product_code: 'TEKST',
        description: 'Levering onder CBW-voorwaarden. Betaling bij aflevering.',
        quantity: 1,
        unit_price_cents: 0,
        total_price_cents: 0,
      };

      const result = await engine.processLine(line);
      expect(result.productGroupCode).toBe('0.0');
      expect(result.confidence).toBe(1.0);
      expect(result.stage).toBe('trap_1_master_cache');
      expect(result.requiresReview).toBe(false);
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();
    });

    it('classificeert historische mixed-case Tekst à €0 eveneens als 0.0', async () => {
      const line: RawOrderLineInput = {
        line_number: 20,
        product_code: 'Tekst',
        description: 'Montage gepland in week 48',
        quantity: 1,
        unit_price_cents: 0,
        total_price_cents: 0,
      };

      const result = await engine.processLine(line);
      expect(result.productGroupCode).toBe('0.0');
      expect(result.confidence).toBe(1.0);
      expect(result.stage).toBe('trap_1_master_cache');
    });

    it('routeert catalogus-gedreven diensten (6.x) direct met confidence 1.000', async () => {
      const line: RawOrderLineInput = {
        line_number: 30,
        product_code: 'A00038387',
        description: 'Legkosten PVC vloer verlijmd',
        quantity: 45,
        unit: 'm2',
        unit_price_cents: 1850,
        total_price_cents: 83250,
        notes: 'Inclusief schuren en stofzuigen van de dekvloer',
      };

      const catalogProduct: ResolvedProductEntity = {
        id: 2002,
        code: 'A00038387',
        name: 'Legkosten PVC',
        product_group_code: '6.3',
        is_generic_container: false,
      };

      const result = await engine.processLine(line, { line, catalogProduct });
      expect(result.productGroupCode).toBe('6.3');
      expect(result.confidence).toBe(1.0);
      expect(result.requiresReview).toBe(false);
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();
    });

    it('parset Zonnelux dealer connect configurator items deterministisch (Regel 100)', async () => {
      const line: RawOrderLineInput = {
        line_number: 100,
        product_code: 'A000066060',
        description: 'Zonnelux Rolgordijn maatwerk',
        quantity: 1,
        unit_price_cents: 22000,
        total_price_cents: 22000,
        lt_configuration: {
          items: [
            { key: 'Breedte', value: '1000' },
            { key: 'Hoogte', value: '1000' },
            { key: 'Kleur', value: 'Wit' },
          ],
        },
      };

      const result = await engine.processLine(line);
      expect(result.dimensionSpec).toBeDefined();
      expect((result.dimensionSpec as any)?.widthMm || result.configurationSpec?.dimensions?.width_mm).toBe(1000);
      expect((result.dimensionSpec as any)?.heightMm || result.configurationSpec?.dimensions?.height_mm).toBe(1000);
      expect(result.stage).toBe('trap_2_configurator');
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();
    });

    describe('5-Traps Credit Triage', () => {
      it('Conditie A: classificeert zuivere kortings-SKU A00044570 à -€50 als 0.1 Korting', async () => {
        const line: RawOrderLineInput = {
          line_number: 40,
          product_code: 'A00044570',
          description: 'Actiekorting voorjaarsdeal',
          quantity: 1,
          unit_price_cents: -5000,
          total_price_cents: -5000,
        };

        const result = await engine.processLine(line);
        expect(result.productGroupCode).toBe('0.1');
        expect(result.confidence).toBe(1.0);
        expect(result.requiresReview).toBe(false);
      });

      it('Conditie B: behoudt materiële productgroep bij fysieke retourboeking (quantity < 0)', async () => {
        const line: RawOrderLineInput = {
          line_number: 50,
          product_code: 'A00035469',
          description: 'Retour hoekbank stof antraciet',
          quantity: -1,
          unit_price_cents: 348754,
          total_price_cents: -348754,
        };

        const catalogProduct: ResolvedProductEntity = {
          id: 3003,
          code: 'A00035469',
          name: 'Hoekbank Elements',
          product_group_code: '7.1',
          is_generic_container: false,
        };

        const result = await engine.processLine(line, { line, catalogProduct });
        expect(result.productGroupCode).toBe('7.1');
        expect(result.requiresReview).toBe(false);
      });

      it('Conditie C: behoudt dienstgroep 6.x bij negatieve correctie/minderwerk', async () => {
        const line: RawOrderLineInput = {
          line_number: 60,
          product_code: 'A00038387',
          description: 'Minderwerk legkosten ivm zelf leggen slaapkamers',
          quantity: -15,
          unit_price_cents: 1850,
          total_price_cents: -27750,
        };

        const catalogProduct: ResolvedProductEntity = {
          id: 2002,
          code: 'A00038387',
          name: 'Legkosten PVC',
          product_group_code: '6.3',
          is_generic_container: false,
        };

        const result = await engine.processLine(line, { line, catalogProduct });
        expect(result.productGroupCode).toBe('6.3');
        expect(result.requiresReview).toBe(false);
      });

      it('Conditie E: plaatst niet-gekoppelde negatieve regels in fail-closed quarantaine 9.9', async () => {
        const line: RawOrderLineInput = {
          line_number: 70,
          product_code: 'ONBEKEND_NEGATIEF',
          description: 'Correctieboeking n.t.b.',
          quantity: 1,
          unit_price_cents: -1500,
          total_price_cents: -1500,
        };

        const result = await engine.processLine(line);
        expect(result.productGroupCode).toBe('9.9');
        expect(result.confidence).toBe(0.1);
        expect(result.requiresReview).toBe(true);
        expect(result.stage).toBe('trap_4_fail_closed_quarantine');
      });
    });
  });

  describe('Laag 2: AI Semantic Extractor met Ordercontext', () => {
    it('escaleert generieke containers (is_generic_container = true) naar Laag 2 met adjacentLines context', async () => {
      const line: RawOrderLineInput = {
        line_number: 80,
        product_code: 'A00038948',
        description: 'Vrij artikel gordijnen confectie enkele plooi',
        quantity: 1,
        unit_price_cents: 42000,
        total_price_cents: 42000,
      };

      const siblingLine: RawOrderLineInput = {
        line_number: 79,
        product_code: 'A000111',
        description: 'Gordijnstof De Ploeg 100% linnen',
        quantity: 8,
        unit_price_cents: 6500,
        total_price_cents: 52000,
      };

      const catalogProduct: ResolvedProductEntity = {
        id: 4004,
        code: 'A00038948',
        name: 'Vrij artikel gordijnen',
        product_group_code: '1.1',
        is_generic_container: true,
      };

      const context: CognitiveExtractionContext = {
        line,
        catalogProduct,
        adjacentLines: [siblingLine, line],
      };

      const result = await engine.processLine(line, context);
      expect(mockCognitiveProvider.extract).toHaveBeenCalledWith(context, '1.1');
      expect(result.stage).toBe('trap_3_cognitive');
    });

    it('vangt ontbrekende GEMINI_API_KEY deterministisch af naar requiresReview = true', async () => {
      const failingProvider: ICognitiveExtractionProvider = {
        extract: vi.fn().mockResolvedValue({
          status: 'requires_review',
          confidence: 0.1,
          source: 'cognitive',
          extraction_notes: ['GEMINI_API_KEY ontbreekt in runtime context'],
        }),
      };

      const engineWithFailingProvider = new NeuroSymbolicEngine({
        cognitiveProvider: failingProvider,
        classificationService,
        extractionEngine,
        dimensionEngine,
      });

      const line: RawOrderLineInput = {
        line_number: 90,
        product_code: 'ONBEKEND',
        description: 'Maatwerkpaneel zonder specificaties in catalogus',
        quantity: 1,
        unit_price_cents: 5000,
        total_price_cents: 5000,
      };

      const result = await engineWithFailingProvider.processLine(line);
      expect(result.requiresReview).toBe(true);
      expect(result.confidence).toBe(0.1);
      expect(result.extractionNotes).toContain('GEMINI_API_KEY ontbreekt in runtime context');
    });
  });

  describe('Laag 3: Symbolische Fysica & Prijs Verificatie (De Mechanische Veiligheidspoort)', () => {
    it('weert buisdiameters (bijv. 20mm) af als raam-afmeting (< 100mm)', async () => {
      const line: RawOrderLineInput = {
        line_number: 110,
        product_code: 'A000999',
        description: 'Roede zwart mat 20mm diameter',
        quantity: 1,
        unit_price_cents: 3500,
        total_price_cents: 3500,
        notes: 'Diameter 20 mm',
      };

      const result = await engine.processLine(line);
      expect(result.dimensionSpec?.height_mm).toBeUndefined();
    });

    it('weert 2D plinten (bijv. 120x15 mm) af als raamafmetingen', async () => {
      const line: RawOrderLineInput = {
        line_number: 120,
        product_code: 'A000888',
        description: 'MDF Renovatieplint wit gegrond',
        quantity: 10,
        unit: 'm1',
        unit_price_cents: 850,
        total_price_cents: 8500,
        notes: 'Afmeting 120x15 mm',
      };

      const result = await engine.processLine(line);
      expect(result.dimensionSpec?.type).not.toBe('window_2d');
    });

    it('vlagt extreme uitschieters (> 12.000 mm) fail-closed af naar requiresReview = true', async () => {
      // Testgeval 1: 25920 mm in vrije tekst notities
      const line1: RawOrderLineInput = {
        line_number: 130,
        product_code: 'A000777',
        description: 'Gordijnrail XXL typefout',
        quantity: 1,
        unit_price_cents: 12000,
        total_price_cents: 12000,
        notes: 'Breedte 25920 mm Hoogte 2600 mm',
      };
      const res1 = await engine.processLine(line1);
      expect(res1.requiresReview).toBe(true);
      expect(res1.stage).toBe('trap_4_fail_closed_quarantine');

      // Testgeval 2: Willekeurige 15000 mm uitschieter in notities
      const line2: RawOrderLineInput = {
        line_number: 131,
        product_code: 'A000778',
        description: 'Duette plissé',
        quantity: 1,
        unit_price_cents: 15000,
        total_price_cents: 15000,
        notes: 'Afmeting: 15000 x 2000 mm',
      };
      const res2 = await engine.processLine(line2);
      expect(res2.requiresReview).toBe(true);
      expect(res2.stage).toBe('trap_4_fail_closed_quarantine');

      // Testgeval 3: Willekeurige 24000 mm uitschieter in ERP width_mm veld
      const line3: RawOrderLineInput = {
        line_number: 132,
        product_code: 'A000779',
        description: 'Rolgordijn reuze',
        quantity: 1,
        unit_price_cents: 18000,
        total_price_cents: 18000,
        width_mm: 24000,
        height_mm: 2000,
      };
      const res3 = await engine.processLine(line3);
      expect(res3.requiresReview).toBe(true);
      expect(res3.stage).toBe('trap_4_fail_closed_quarantine');

      // Testgeval 4: Willekeurige 15 m1 uitschieter in omschrijving
      const line4: RawOrderLineInput = {
        line_number: 133,
        product_code: 'A000780',
        description: 'Gordijnrail 15 m1 lengte',
        quantity: 1,
        unit_price_cents: 9000,
        total_price_cents: 9000,
      };
      const res4 = await engine.processLine(line4);
      expect(res4.requiresReview).toBe(true);
      expect(res4.stage).toBe('trap_4_fail_closed_quarantine');
    });
  });
});
