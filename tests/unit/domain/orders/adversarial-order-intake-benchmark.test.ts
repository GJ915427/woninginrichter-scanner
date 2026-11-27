import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ConfigurationExtractionEngine,
  DeterministicTokenizerProvider,
} from '@/domain/orders/configuration-extraction-engine';
import {
  NeuroSymbolicEngine,
  type NeuroSymbolicLineResult,
} from '@/domain/orders/neuro-symbolic-engine';
import { DimensionExtractionEngine } from '@/domain/orders/dimension-extraction-engine';
import { ClassificationService } from '@/domain/classification/central-classification-service';
import {
  OrderIntakeService,
  mapLogicTradeOrderToRawInput,
  type RawLogicTradeOrderInput,
  type IngestedOrderBundle,
} from '@/domain/orders/order-intake-service';
import type {
  RawOrderLineInput,
  ICognitiveExtractionProvider,
  ResolvedProductEntity,
} from '@/types/order-intake';

describe('Adversarial Ground-Truth Benchmark: 4-Layer Neuro-Symbolic Engine & Order Intake', () => {
  let mockCognitiveProvider: ICognitiveExtractionProvider;
  let classificationService: ClassificationService;
  let extractionEngine: ConfigurationExtractionEngine;
  let dimensionEngine: DimensionExtractionEngine;
  let neuroEngine: NeuroSymbolicEngine;
  let orderIntakeService: OrderIntakeService;

  beforeEach(() => {
    mockCognitiveProvider = {
      extract: vi.fn().mockResolvedValue({
        status: 'valid',
        confidence: 0.9,
        source: 'cognitive',
        dimensions: { width_mm: 1400, height_mm: 2200 },
        attributes: {},
      }),
    };

    classificationService = new ClassificationService();
    // Registreer bekende SKU's
    classificationService.registerMasterProduct('LT_VADAINGORDIJN', '1.1');
    classificationService.registerMasterProduct('A00052469', '2.4');
    classificationService.registerMasterProduct('A000061749', '2.3');
    classificationService.registerMasterProduct('A000061747', '2.1');
    classificationService.registerMasterProduct('A00042629', '9.9');
    classificationService.registerMasterProduct('A000067257', '2.4');
    classificationService.registerMasterProduct('A00045698', '1.3');
    classificationService.registerMasterProduct('A000066060', '2.1');
    classificationService.registerMasterProduct('A00021201', '9.9');
    classificationService.registerMasterProduct('A00060982', '9.9');
    classificationService.registerMasterProduct('MEUBEL_01', '7.1');
    classificationService.registerMasterProduct('DIENST_01', '6.1');
    classificationService.registerMasterProduct('TRAP_01', '6.4');

    extractionEngine = new ConfigurationExtractionEngine({
      cognitiveProvider: mockCognitiveProvider,
    });
    dimensionEngine = new DimensionExtractionEngine();

    neuroEngine = new NeuroSymbolicEngine({
      cognitiveProvider: mockCognitiveProvider,
      classificationService,
      extractionEngine,
      dimensionEngine,
    });

    orderIntakeService = new OrderIntakeService({
      classificationService,
      extractionEngine,
      dimensionEngine,
      neuroSymbolicEngine: neuroEngine,
      resolveProductByCode: vi.fn().mockImplementation(async (code: string) => {
        if (code === 'LT_VADAINGORDIJN') return { id: 101, code, supplier_name: 'Vadain', product_group_code: '1.1' };
        if (code === 'A00052469') return { id: 102, code, supplier_name: 'Luxaflex', product_group_code: '2.4' };
        if (code === 'MEUBEL_01') return { id: 103, code, supplier_name: 'Maitre', product_group_code: '7.1' };
        if (code === 'A00034988') return { id: 104, code, supplier_name: 'Luxaflex', product_group_code: '2.4' };
        return null;
      }),
    });
  });

  // =========================================================================
  // SECTIE 1: De 10 Reële LogicTrade Payloads (lt_configuration_items_voorbeelden.md)
  // =========================================================================
  describe('Sectie 1: De 10 Reële LogicTrade Payloads', () => {
    it('Payload 1: Vadain – Plooigordijn (LT_VADAINGORDIJN, 22 items) -> 1.1 curtain_linear met pleatFactor: 2.5', async () => {
      const line: RawOrderLineInput = {
        line_number: 10,
        product_code: 'LT_VADAINGORDIJN',
        description: 'Vadain Plooigordijn',
        notes: '- GIW Fiep / - Kleur 17 linen / - Stuk / - Vlinder retour plooi',
        lt_configuration: {
          items: [
            { value: 'Plooigordijn', option: '' },
            { value: 'woonkamer', option: '' },
            { value: 'Comfort gordijn', option: '' },
            { value: 'Kamerhoog', option: '' },
            { value: '174,00 cm', option: '' },
            { value: '250,00 cm', option: '' },
            { value: 'Vlinder plooi', option: '' },
            { value: '220', option: '' },
            { value: 'Ja', option: '' },
            { value: 'Stuk links', option: '' },
            { value: '174', option: '' },
            { value: '8 cm', option: '' },
            { value: '0', option: '' },
            { value: 'Verzwaringskoord aanwezig', option: '' },
            { value: '0', option: '' },
            { value: 'Ja', option: '' },
            { value: 'Ja', option: '' },
            { value: 'Ja', option: '' },
            { value: 'Nee', option: '' },
            { value: '433,00 cm', option: '' },
            { value: '1', option: '' },
            { value: '433,00 cm', option: '' },
          ],
        },
      };

      const result = await neuroEngine.processLine(line);

      expect(result.productGroupCode).toBe('1.1');
      expect(result.stage).toBe('trap_2_configurator');
      expect(result.requiresReview).toBe(false);
      expect(result.configurationSpec?.dimensions).toEqual({
        width_mm: 1740,
        height_mm: 2500,
      });
      expect(result.dimensionSpec).toBeDefined();
      expect(result.dimensionSpec?.type).toBe('curtain_linear');
      expect((result.dimensionSpec as any)?.widthMm).toBe(1740);
      expect((result.dimensionSpec as any)?.heightMm).toBe(2500);
      expect((result.dimensionSpec as any)?.pleatFactor).toBe(2.5); // Vlinderplooi = 2.5
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();
    });

    it('Payload 2: Vadain – Stofregel / Deelregel (A00060982, 3 items) -> 9.9, geen maten, 0 AI', async () => {
      const line: RawOrderLineInput = {
        line_number: 20,
        product_code: 'A00060982',
        description: 'Fiep KH 17 linen',
        lt_configuration: {
          items: [
            { value: '433,00 cm', option: '' },
            { value: '1', option: '' },
            { value: '433,00 cm', option: '' },
          ],
        },
      };

      const result = await neuroEngine.processLine(line);

      expect(result.productGroupCode).toBe('9.9');
      expect(result.configurationSpec?.dimensions).toBeUndefined();
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();
    });

    it('Payload 3: Luxaflex – Duette shade (A00052469, 27 items) -> 2.4, 1550 x 1940 mm', async () => {
      const line: RawOrderLineInput = {
        line_number: 30,
        product_code: 'A00052469',
        description: 'Duette 32mm Elan',
        notes: '- Slaapkamer galerij / - Verduisterend duette / - Kleur 7850 / - Top down en bottom up / - Powerview motor rechts',
        lt_configuration: {
          items: [
            { value: 'Rechthoekig' },
            { value: '20  Top Down / Bottom Up (EUR 37,19)' },
            { value: 'Blijvende maat' },
            { value: '1550' },
            { value: '1940' },
            { value: 'Nee' },
            { value: 'Vrijhangend' },
            { value: 'PowerView® (EUR 325,62)' },
            { value: '1209 SBS' },
            { value: '7850  Elan Full Tone RD  F32' },
          ],
        },
      };

      const result = await neuroEngine.processLine(line);

      expect(result.productGroupCode).toBe('2.4');
      expect(result.stage).toBe('trap_2_configurator');
      expect(result.configurationSpec?.dimensions).toEqual({
        width_mm: 1550,
        height_mm: 1940,
      });
      expect(result.dimensionSpec?.type).toBe('window_2d');
      expect((result.dimensionSpec as any)?.widthMm).toBe(1550);
      expect((result.dimensionSpec as any)?.heightMm).toBe(1940);
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();
    });

    it('Payload 4: Luxaflex – Horizontale jaloezie 25 mm (A000061749, 34 items) -> 2.3, 650 x 2300 mm', async () => {
      const line: RawOrderLineInput = {
        line_number: 40,
        product_code: 'A000061749',
        description: 'Horizontale jaloezie 25 mm',
        lt_configuration: {
          items: [
            { value: 'Nee' },
            { value: 'Standaard rechthoek' },
            { value: 'Blijvende maat' },
            { value: '650' },
            { value: '2300' },
            { value: '25 mm' },
            { value: 'Standaard EOS' },
          ],
        },
      };

      const result = await neuroEngine.processLine(line);

      expect(result.productGroupCode).toBe('2.3');
      expect(result.stage).toBe('trap_2_configurator');
      expect(result.configurationSpec?.dimensions).toEqual({
        width_mm: 650,
        height_mm: 2300,
      });
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();
    });

    it('Payload 5: Luxaflex – Rolgordijn (A000061747, 61 items met lege strings) -> 2.1, 675 x 2400 mm', async () => {
      const line: RawOrderLineInput = {
        line_number: 50,
        product_code: 'A000061747',
        description: 'Luxaflex Rolgordijn',
        notes: '- Woonkamer raam 5 / - Luxaflex Rolgordijn / - Stof: 1044 / - Powerview Accumotor / - Onderlat: Alu',
        lt_configuration: {
          items: [
            { value: '' },
            { value: '*' },
            { value: 'Blijvende maat' },
            { value: '675' },
            { value: '2400' },
            { value: 'Nee' },
            { value: 'Steun' },
            { value: 'PowerView® (EUR 89,26)' },
            { value: '18 PowerView® motor bediend rolgordijn' },
            { value: '1044  Endure' },
          ],
        },
      };

      const result = await neuroEngine.processLine(line);

      expect(result.productGroupCode).toBe('2.1');
      expect(result.stage).toBe('trap_2_configurator');
      expect(result.configurationSpec?.dimensions).toEqual({
        width_mm: 675,
        height_mm: 2400,
      });
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();
    });

    it('Payload 6: Luxaflex – Accessoire (A00042629, USB-C oplader, 4 items) -> 9.9, geen maten, 0 AI', async () => {
      const line: RawOrderLineInput = {
        line_number: 60,
        product_code: 'A00042629',
        description: 'PowerView gen 3 oplader USB-C',
        lt_configuration: {
          items: [
            { value: 'ChargerRolloTwist' },
            { value: 'Oplader USB-C' },
            { value: '1' },
            { value: 'Nederlands' },
          ],
        },
      };

      const result = await neuroEngine.processLine(line);

      expect(result.productGroupCode).toBe('9.9');
      expect(result.configurationSpec?.dimensions).toBeUndefined();
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();
    });

    it('Payload 7: Sunway – Duette shades 2026 (A000067257, 26 items) -> 2.4, 700 x 2000 mm', async () => {
      const line: RawOrderLineInput = {
        line_number: 70,
        product_code: 'A000067257',
        description: 'Sunway Duette shades',
        notes: '- Deur / - 25 mm duette lichtdoorlatend / - Kleur 7222 / - Afmeting 70 x 200 cm',
        lt_configuration: {
          items: [
            { value: 'Rechthoekig' },
            { value: '20  TopDown/BottomUp' },
            { value: 'Blijvende maat' },
            { value: '700' },
            { value: '2000' },
            { value: 'Nee' },
          ],
        },
      };

      const result = await neuroEngine.processLine(line);

      expect(result.productGroupCode).toBe('2.4');
      expect(result.stage).toBe('trap_2_configurator');
      expect(result.configurationSpec?.dimensions).toEqual({
        width_mm: 700,
        height_mm: 2000,
      });
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();
    });

    it('Payload 8: Sunway – Paneelgordijn (A00045698, 20 items) -> 1.3 curtain_linear, 2650 x 2950 mm', async () => {
      const line: RawOrderLineInput = {
        line_number: 80,
        product_code: 'A00045698',
        description: 'Sunway Paneelgordijn',
        notes: '- 2 ramen / - Sunway Paneelgordijn / - 2 spoor - 4 panelen / - Kleur: 9139 Zwart',
        lt_configuration: {
          items: [
            { value: 'Blijvende maat' },
            { value: '2650' },
            { value: '2950' },
            { value: 'B' },
            { value: '9139  Vector' },
            { value: '2' },
          ],
        },
      };

      const result = await neuroEngine.processLine(line);

      expect(result.productGroupCode).toBe('1.3');
      expect(result.stage).toBe('trap_2_configurator');
      expect(result.configurationSpec?.dimensions).toEqual({
        width_mm: 2650,
        height_mm: 2950,
      });
      expect(result.dimensionSpec?.type).toBe('curtain_linear');
      expect((result.dimensionSpec as any)?.widthMm).toBe(2650);
      expect((result.dimensionSpec as any)?.heightMm).toBe(2950);
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();
    });

    it('Payload 9: Zonnelux – GIW Rolgordijnen small (A000066060, 103 items) -> 2.1, 620 x 900 mm binnen <10ms SLA', async () => {
      const raw103Items = [
        'Ja', '10120', 'Blijvende maat', '620', '900', 'Montageprofiel (EUR 26,45)',
        'Montageprofiel kettingbediening', '35', 'C91004', 'Rechts', 'Ja', 'Metaal',
        'Ja', 'Ja', '2200', '0', '500', '500', '500', 'Ja', '500', 'Wand', 'Nee', 'Geen',
        'Steun S mp', 'Standaard (achterover)', 'CW Wit', 'Metaal', 'S  Type S', 'CW Wit (EUR 5,89)',
        'Geen', 'Geen bijlage', 'S', '2', 'C91004', 'C91004', 'Nee', 'Nee', '', 'C', 'Ja', 'Ja,Nee',
        'Zonne2023', '25. 2', 'BS', '620', '900', '3. 1', 'MP', '14. 9', '2567', '-', '-', '10. 1',
        '', '21. 3', '620', '500', '0', '0', '62. 1', '26. 3', 'Nee', '13. 1', '24. 2', '', '28. 1',
        '9. 7', '', '51.11', '', '40. 1', '41.99', '54. 1', '0', '', '', '-', '2.0', 'C91004', '', '', ''
      ];

      const line: RawOrderLineInput = {
        line_number: 90,
        product_code: 'A000066060',
        description: 'GIW Rolgordijn small',
        notes: '- Kamer Joep achterzijde / - GIW Rolgordijn met montageprofiel / - Kleur: C91004 verduisterend',
        lt_configuration: {
          items: raw103Items.map((val) => ({ value: val, option: '' })),
        },
      };

      const start = performance.now();
      const result = await neuroEngine.processLine(line);
      const durationMs = performance.now() - start;

      expect(result.productGroupCode).toBe('2.1');
      expect(result.stage).toBe('trap_2_configurator');
      expect(result.configurationSpec?.dimensions).toEqual({
        width_mm: 620,
        height_mm: 900,
      });
      expect(durationMs).toBeLessThan(10); // SLA < 10ms
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();
    });

    it('Payload 10: GSW Intern – Optimalisatie vragenlijst (A00021201) vs Gemengde Configurator', async () => {
      // 10A: Vragenlijst zonder maatankers -> 9.9, geen maten, 0 AI
      const questionnaireLine: RawOrderLineInput = {
        line_number: 100,
        product_code: 'A00021201',
        description: 'Optimalisatie vragenlijst',
        lt_configuration: {
          items: [
            { option: 'Onderhouds-/productadvies van uw aankopen zijn uitvoerig besproken?', value: 'Ja' },
            { option: 'Is de aflevering en montage op de begane grond?', value: 'Ja' },
            { option: 'Afmeting', value: '123' },
            { option: 'U heeft een harde vloer liggen?', value: 'Parket' },
          ],
        },
      };

      const resQ = await neuroEngine.processLine(questionnaireLine);
      expect(resQ.productGroupCode).toBe('9.9');
      expect(resQ.configurationSpec?.dimensions).toBeUndefined();
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();

      // 10B: Gemengde configurator met { option: 'Breedte (mm)', value: '1070' }
      const mixedLineMm: RawOrderLineInput = {
        line_number: 101,
        product_code: 'A00052469',
        description: 'Duette maatwerk',
        lt_configuration: {
          items: [
            { option: 'Breedte (mm)', value: '1070' },
            { option: 'Hoogte (mm)', value: '1850' },
            { option: 'Bediening', value: 'SmartCord' },
          ],
        },
      };

      const resMm = await neuroEngine.processLine(mixedLineMm);
      expect(resMm.configurationSpec?.dimensions).toEqual({
        width_mm: 1070,
        height_mm: 1850,
      });

      // 10C: Gemengde configurator met { option: 'Breedte (cm)', value: '107' }
      const mixedLineCm: RawOrderLineInput = {
        line_number: 102,
        product_code: 'A00052469',
        description: 'Duette maatwerk cm',
        lt_configuration: {
          items: [
            { option: 'Breedte (cm)', value: '107' },
            { option: 'Hoogte (cm)', value: '185' },
            { option: 'Bediening', value: 'SmartCord' },
          ],
        },
      };

      const resCm = await neuroEngine.processLine(mixedLineCm);
      expect(resCm.configurationSpec?.dimensions).toEqual({
        width_mm: 1070,
        height_mm: 1850,
      });
    });
  });

  // =========================================================================
  // SECTIE 2: De 7 Historische Pijnpunten & Randgevallen
  // =========================================================================
  describe('Sectie 2: De 7 Historische Pijnpunten & Randgevallen', () => {
    it('Pijnpunt 1: Ongelabelde items arrays - positie, ankers en textiel cm sequencer', async () => {
      // 1A: Lookahead anker op index k gevolgd door maten op k+1, k+2
      const lineLookahead: RawOrderLineInput = {
        line_number: 1,
        product_code: 'A00052469',
        description: 'Lookahead duette',
        lt_configuration: {
          items: [
            { value: 'Rechthoek' },
            { value: 'Dagmaat' },
            { value: '1200' },
            { value: '1600' },
          ],
        },
      };
      const res1A = await neuroEngine.processLine(lineLookahead);
      expect(res1A.configurationSpec?.dimensions).toEqual({ width_mm: 1200, height_mm: 1600 });

      // 1B: Textiel cm sequencer: opeenvolgende "155 cm" en "194 cm"
      const lineCm: RawOrderLineInput = {
        line_number: 2,
        product_code: 'LT_VADAINGORDIJN',
        description: 'Textiel cm sequence',
        lt_configuration: {
          items: [
            { value: '155 cm' },
            { value: '194 cm' },
          ],
        },
      };
      const res1B = await neuroEngine.processLine(lineCm);
      expect(res1B.configurationSpec?.dimensions).toEqual({ width_mm: 1550, height_mm: 1940 });

      // 1C: Unilux [0, 1] directe numerieke indices
      const lineUnilux: RawOrderLineInput = {
        line_number: 3,
        product_code: 'A00052469',
        description: 'Unilux hor',
        lt_configuration: {
          items: [
            { value: '850' },
            { value: '1250' },
          ],
        },
      };
      const res1C = await neuroEngine.processLine(lineUnilux);
      expect(res1C.configurationSpec?.dimensions).toEqual({ width_mm: 850, height_mm: 1250 });
    });

    it('Pijnpunt 2: Nulprijs Tekstregels (TEKST / Tekst €0) -> 0.0, null specs, 0 AI', async () => {
      const lineZero: RawOrderLineInput = {
        line_number: 1,
        product_code: 'TEKST',
        description: 'Levering onder CBW-voorwaarden. Betaling bij aflevering.',
        unit_price_cents: 0,
        total_price_cents: 0,
      };

      const resZero = await neuroEngine.processLine(lineZero);
      expect(resZero.productGroupCode).toBe('0.0');
      expect(resZero.configurationSpec).toBeNull();
      expect(resZero.dimensionSpec).toBeNull();
      expect(resZero.confidence).toBe(1.0);
      expect(resZero.stage).toBe('trap_1_master_cache');
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();
    });

    it('Pijnpunt 3: Negatieve Bedragen & Creditregels (-€50 actiekorting -> 0.1, onbekend -> quarantaine)', async () => {
      // Actiekorting
      const lineDiscount: RawOrderLineInput = {
        line_number: 1,
        product_code: 'KORTING',
        description: 'Actiekorting najaar 2026',
        unit_price_cents: -5000,
        total_price_cents: -5000,
      };
      const resDiscount = await neuroEngine.processLine(lineDiscount);
      expect(resDiscount.productGroupCode).toBe('0.1');
      expect(resDiscount.confidence).toBe(1.0);

      // Onbekende negatieve boeking -> quarantaine
      const lineUnknownNeg: RawOrderLineInput = {
        line_number: 2,
        product_code: 'DIVERSEN_NEG',
        description: 'Onbekende correctiepost',
        unit_price_cents: -2500,
        total_price_cents: -2500,
      };
      const resNeg = await neuroEngine.processLine(lineUnknownNeg);
      expect(resNeg.stage).toBe('trap_4_fail_closed_quarantine');
      expect(resNeg.requiresReview).toBe(true);
    });

    it('Pijnpunt 4: Discipline Gating & 7.1 ERP-Pariteit vs Free-Text', async () => {
      // 4A: 7.1 Salontafel met ERP-maten behoudt dim: '700 × 900', configuration_spec = null
      const orderPayload = { id: 120002, orderNumber: 'V26001235', status: 'ORDER' };
      const linePayloads = [
        {
          lineNumber: 10,
          productCode: 'MEUBEL_01',
          description: 'Salontafel 70x90 cm Maitre',
          widthMm: 700,
          heightMm: 900,
          configuration: {
            id: 1122,
            items: ['Eiken blad', 'Zwart stalen onderstel'],
          },
        },
      ];

      const rawInput = mapLogicTradeOrderToRawInput(orderPayload, linePayloads);
      const ingested = await orderIntakeService.processOrderIntake(rawInput);
      const lineTable = ingested.lines[0];

      expect(lineTable.dim).toBe('700 × 900');
      expect(lineTable.configuration_spec).toBeNull();

      // 4B: 7.1 Hoekbank uit vrije tekst zonder ERP-maten krijgt piece_service, dim: null
      const lineFreeTextSofa: RawOrderLineInput = {
        line_number: 20,
        product_code: 'MEUBEL_01',
        description: 'Hoekbank bij raam 220 x 90 cm',
        unit_price_cents: 120000,
        total_price_cents: 120000,
      };
      const resSofa = await neuroEngine.processLine(lineFreeTextSofa);
      expect(resSofa.dimensionSpec?.type).toBe('piece_service');

      // 4C: 6.1 Dienst -> piece_service, dim: null, configuration_spec: null
      const lineService: RawOrderLineInput = {
        line_number: 30,
        product_code: 'DIENST_01',
        description: 'Montage rolgordijnen 140x220 cm',
        unit_price_cents: 8500,
        total_price_cents: 8500,
      };
      const resService = await neuroEngine.processLine(lineService);
      expect(resService.productGroupCode).toBe('6.1');
      expect(resService.dimensionSpec?.type).toBe('piece_service');
      expect(resService.configurationSpec).toBeNull();

      // 4D: 6.4 Traprenovatie behoudt stairs
      const lineStairs: RawOrderLineInput = {
        line_number: 40,
        product_code: 'TRAP_01',
        description: 'Traprenovatie 13 treden dichte trap',
        unit_price_cents: 150000,
        total_price_cents: 150000,
      };
      const resStairs = await neuroEngine.processLine(lineStairs);
      expect(resStairs.productGroupCode).toBe('6.4');
      expect(resStairs.dimensionSpec?.type).toBe('stairs');
    });

    it('Pijnpunt 5: Wiskundige Uitschieters (> 12000 mm) & Telefoonnummer-/Eenheids-Veiligheid', async () => {
      // 5A: Configurator uitschieter (15000 mm) met beschrijving "140x220" routeert naar quarantaine met dim = null
      const lineOutlier: RawOrderLineInput = {
        line_number: 1,
        product_code: 'A00052469',
        description: 'Duette 140x220 cm',
        width_mm: 15000, // Uitschieter in ERP veld!
        height_mm: 2000,
      };

      const resOutlier = await neuroEngine.processLine(lineOutlier);
      expect(resOutlier.stage).toBe('trap_4_fail_closed_quarantine');
      expect(resOutlier.requiresReview).toBe(true);

      // In OrderIntakeService: mag dim NIET terugvallen op description 140x220!
      const rawOrderOutlier: RawLogicTradeOrderInput = {
        id: 'O_OUTLIER_1',
        order_number: 'O_OUTLIER_1',
        lines: [
          {
            line_number: 1,
            product_code: 'A00052469',
            description: 'Duette 140x220 cm incl. montage',
            width_mm: 15000,
            height_mm: 2000,
            unit_price_cents: 25000,
            total_price_cents: 25000,
          },
        ],
      };
      const ingestedOutlier = await orderIntakeService.processOrderIntake(rawOrderOutlier);
      expect(ingestedOutlier.lines[0].dim).toBeNull();
      expect(ingestedOutlier.lines[0].configuration_spec).toBeNull();
      expect(ingestedOutlier.lines[0].requires_review).toBe(true);

      // 5B: "Hoogte 2400 met koord" matcht NIET op 'm' uit 'met' (geen 2.400.000 mm uitschieter)
      const lineKoord: RawOrderLineInput = {
        line_number: 2,
        product_code: 'A00052469',
        description: 'Duette Breedte 1600 Hoogte 2400 met koordbediening',
      };
      const resKoord = await neuroEngine.processLine(lineKoord);
      expect(resKoord.stage).not.toBe('trap_4_fail_closed_quarantine');
      expect(resKoord.configurationSpec?.dimensions).toEqual({
        width_mm: 1600,
        height_mm: 2400,
      });

      // 5C: Telefoonnummer "mob: 0625920112" of "aub 0625920112" triggert géén valse uitschieter
      const linePhone: RawOrderLineInput = {
        line_number: 3,
        product_code: 'A00052469',
        description: 'Duette 1600x2400 mm mob: 0625920112 bellen voor levering',
      };
      const resPhone = await neuroEngine.processLine(linePhone);
      expect(resPhone.stage).not.toBe('trap_4_fail_closed_quarantine');
      expect(resPhone.configurationSpec?.dimensions).toEqual({
        width_mm: 1600,
        height_mm: 2400,
      });

      // 5D: Lamelbreedte: 25 mm mag NIET als productbreedte < 100 mm worden aangezien (Trap D quarantaine)
      const lineLamel: RawOrderLineInput = {
        line_number: 4,
        product_code: 'A000061749',
        description: 'Horizontale jaloezie Blijvende maat 650 x 2300 mm Lamelbreedte: 25 mm',
      };
      const resLamel = await neuroEngine.processLine(lineLamel);
      expect(resLamel.configurationSpec?.dimensions).toEqual({
        width_mm: 650,
        height_mm: 2300,
      });
      expect(resLamel.stage).not.toBe('trap_4_fail_closed_quarantine');
    });

    it('Pijnpunt 6: O(1) Pre-Hydratatie met Case-Preserving Lookup & Negative Caching', async () => {
      const mockBatchResolver = vi.fn().mockImplementation(async (codes: string[]) => {
        const map = new Map<string, ResolvedProductEntity>();
        for (const code of codes) {
          if (code === 'Lt_VadainGordijn') {
            map.set(code, { id: 201, code: 'Lt_VadainGordijn', supplier_name: 'Vadain', product_group_code: '1.1' });
          }
        }
        return map;
      });

      const mockSingleResolver = vi.fn().mockResolvedValue(null);

      const serviceWithBatch = new OrderIntakeService({
        classificationService,
        extractionEngine,
        dimensionEngine,
        neuroSymbolicEngine: neuroEngine,
        resolveProductsByCodes: mockBatchResolver,
        resolveProductByCode: mockSingleResolver,
      });

      const rawOrder: RawLogicTradeOrderInput = {
        id: 'O_BATCH_01',
        order_number: 'O_BATCH_01',
        lines: [
          { line_number: 1, product_code: 'Lt_VadainGordijn', description: 'Regel 1' },
          { line_number: 2, product_code: 'Lt_VadainGordijn', description: 'Regel 2 (duplicaat)' },
          { line_number: 3, product_code: 'TEKST', description: 'Tekstregel à €0', unit_price_cents: 0 },
          { line_number: 4, product_code: 'ONBEKEND_SKU_1', description: 'Onbekend 1' },
          { line_number: 5, product_code: 'ONBEKEND_SKU_1', description: 'Onbekend 1 duplicaat' },
        ],
      };

      await serviceWithBatch.processOrderIntake(rawOrder);

      // Batch resolver moet precies 1x aangeroepen zijn met unieke codes (zonder TEKST) en met behoud van de originele casing
      expect(mockBatchResolver).toHaveBeenCalledTimes(1);
      const passedCodes = mockBatchResolver.mock.calls[0][0];
      expect(passedCodes).toContain('Lt_VadainGordijn'); // Behoudt mixed-case casing!
      expect(passedCodes).toContain('ONBEKEND_SKU_1');
      expect(passedCodes).not.toContain('TEKST');
      expect(passedCodes.length).toBe(2);

      // Single resolver mag 0 keer aangeroepen zijn omdat de batch call geslaagd is
      expect(mockSingleResolver).not.toHaveBeenCalled();
    });

    it('Pijnpunt 7: curtain_linear & Plooifactor-Synthese (1.1, 1.3, 1.4 vs 1.2)', async () => {
      // 1.1 Gordijn -> curtain_linear
      const res11 = await neuroEngine.processLine({
        line_number: 1,
        product_code: 'LT_VADAINGORDIJN',
        description: 'Gordijn dubbele plooi 2000x2600 mm',
      });
      expect(res11.dimensionSpec?.type).toBe('curtain_linear');

      // 1.2 Vouwgordijn -> window_2d
      const res12 = await neuroEngine.processLine({
        line_number: 2,
        description: 'Vouwgordijn kettingbediening 1400x2200 mm',
      });
      expect(res12.dimensionSpec?.type).toBe('window_2d');

      // 1.3 Paneelgordijn -> curtain_linear
      const res13 = await neuroEngine.processLine({
        line_number: 3,
        product_code: 'A00045698',
        description: 'Paneelgordijn 4 spoor 2650x2950 mm',
      });
      expect(res13.dimensionSpec?.type).toBe('curtain_linear');
    });

    it('Corner Case 4: Dimensieloze 2.1-regel met lt_options en notes > 20 escaleert via Stap 1.6 naar Laag 2', async () => {
      const lineCustomWithoutDims: RawOrderLineInput = {
        line_number: 1,
        product_code: 'A000061747', // 2.1 Rolgordijn
        description: 'Rolgordijn maatwerk cassette',
        options: ['Kleur: Antraciet', 'Bediening: Ketting'],
        notes: 'Speciale bestelling: afwijkende montagesteunen en koofbevestiging gewenst door klant.', // > 20 chars
      };

      const result = await neuroEngine.processLine(lineCustomWithoutDims);

      // Moet niet voortijdig afbreken in Stap 1.6, maar escaleren naar Laag 2 (cognitive provider)
      expect(mockCognitiveProvider.extract).toHaveBeenCalled();
      expect(result.stage).toBe('trap_3_cognitive');
    });
  });
});
