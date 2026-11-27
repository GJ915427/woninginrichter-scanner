/**
 * tests/unit/domain/orders/configuration-extraction-engine.test.ts
 *
 * TDD Suite voor de 4-Traps Configuratie Extractie Engine:
 * - Trap 0: Directe ERP numerieke velden (0ms)
 * - Trap A: Gestructureerde e-Order JSON parsing (0ms)
 * - Trap B: Deterministische Regex Tokenizer (<1ms)
 * - Trap C: Cognitieve Provider met Zod validatie & SHA-256 LRU Caching
 * - Trap D: Mechanische Cross-Validatie & Productgroep Reconciliatie Egress
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ConfigurationExtractionEngine,
  DeterministicTokenizerProvider,
} from '@/domain/orders/configuration-extraction-engine';
import type { ICognitiveExtractionProvider, RawOrderLineInput } from '@/types/order-intake';

describe('ConfigurationExtractionEngine (TDD)', () => {
  let mockCognitiveProvider: ICognitiveExtractionProvider;
  let engine: ConfigurationExtractionEngine;

  beforeEach(() => {
    mockCognitiveProvider = {
      extract: vi.fn(),
    };
    engine = new ConfigurationExtractionEngine({
      cognitiveProvider: mockCognitiveProvider,
      lruCacheSize: 50,
    });
  });

  describe('Trap 0: Directe ERP Numerieke Velden (0ms)', () => {
    it('extraheert direct width_mm en height_mm uit RawOrderLineInput zonder provider aanroep', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 10,
        description: 'Duette Fix 25mm',
        width_mm: 2400,
        height_mm: 1800,
        options: ['SmartCord', 'Top-Down/Bottom-Up'],
      };

      const result = await engine.extractConfiguration(rawLine, '2.1');

      expect(result.source).toBe('erp_fields');
      expect(result.status).toBe('valid');
      expect(result.confidence).toBe(1.0);
      expect(result.dimensions).toEqual({
        width_mm: 2400,
        height_mm: 1800,
      });
      expect(result.options).toEqual(['SmartCord', 'Top-Down/Bottom-Up']);
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();
    });
  });

  describe('Trap A: Gestructureerde e-Order JSON (0ms)', () => {
    it('extraheert configuratiespecificaties uit configuration_json', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 20,
        description: 'Rolgordijn cassette',
        configuration_json: {
          width_mm: 1600,
          height_mm: 2100,
          control: 'ketting_rechts',
          fabric: 'Verduisterend Wit',
        },
      };

      const result = await engine.extractConfiguration(rawLine, '2.2');

      expect(result.source).toBe('eorder_json');
      expect(result.status).toBe('valid');
      expect(result.confidence).toBe(1.0);
      expect(result.dimensions).toEqual({
        width_mm: 1600,
        height_mm: 2100,
      });
      expect(result.attributes?.control).toBe('ketting_rechts');
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();
    });
  });

  describe('Trap B: Deterministische Regex Tokenizer (<1ms)', () => {
    it('extraheert standaardmaten in mm, cm en meters uit vrije tekst', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 30,
        description: 'Inbetween gordijn 2400 x 1800 mm wave',
      };

      const result = await engine.extractConfiguration(rawLine, '1.1');

      expect(result.source).toBe('regex_tokenizer');
      expect(result.dimensions).toEqual({
        width_mm: 2400,
        height_mm: 1800,
      });
      expect(mockCognitiveProvider.extract).not.toHaveBeenCalled();
    });

    it('normaliseert meters en centimeters strikt naar integer millimeters (zero float drift)', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 35,
        description: 'Houten jaloezie breedte 2,45 mtr hoogte 180 cm',
      };

      const result = await engine.extractConfiguration(rawLine, '2.1');

      expect(result.dimensions).toEqual({
        width_mm: 2450,
        height_mm: 1800,
      });
    });
  });

  describe('Trap C: Cognitieve Provider met LRU Caching', () => {
    it('schakelt over naar cognitieve provider als Trap 0, A en B geen afmetingen opleveren', async () => {
      vi.mocked(mockCognitiveProvider.extract).mockResolvedValueOnce({
        status: 'valid',
        confidence: 0.9,
        source: 'cognitive',
        dimensions: { width_mm: 1450, height_mm: 2100 },
        attributes: { pleat_type: 'dubbele_plooi', operation: 'koord_links' },
      });

      const rawLine: RawOrderLineInput = {
        line_number: 40,
        description: 'Gordijn op maat',
        notes: 'Speciale confectie: B 1450 en H 2100 met dubbele plooi en koordbediening links',
      };

      const result = await engine.extractConfiguration(rawLine, '1.1');

      expect(mockCognitiveProvider.extract).toHaveBeenCalledTimes(1);
      expect(result.source).toBe('cognitive');
      expect(result.dimensions?.width_mm).toBe(1450);
      expect(result.dimensions?.height_mm).toBe(2100);
    });

    it('hergebruikt deterministische LRU cache bij identieke specificaties (0ms hit)', async () => {
      vi.mocked(mockCognitiveProvider.extract).mockResolvedValue({
        status: 'valid',
        confidence: 0.92,
        source: 'cognitive',
        dimensions: { width_mm: 1500, height_mm: 2000 },
      });

      const rawLine1: RawOrderLineInput = {
        line_number: 41,
        description: 'Gordijn velours',
        notes: 'Identieke configuratie tekst A',
      };
      const rawLine2: RawOrderLineInput = {
        line_number: 42,
        description: 'Gordijn velours',
        notes: 'Identieke configuratie tekst A',
      };

      const res1 = await engine.extractConfiguration(rawLine1, '1.1');
      const res2 = await engine.extractConfiguration(rawLine2, '1.1');

      expect(mockCognitiveProvider.extract).toHaveBeenCalledTimes(1);
      expect(res1.dimensions).toEqual(res2.dimensions);
    });
  });

  describe('Trap D: Mechanische Cross-Validatie & Reconciliatie Egress', () => {
    it('detecteert categorie-incompatibiliteit en levert reconciled_product_group_code', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 50,
        description: 'Click PVC Vloer',
        notes: 'B: 3000 x H: 2600 mm met waveplooi en runnerhaak',
      };

      vi.mocked(mockCognitiveProvider.extract).mockResolvedValueOnce({
        status: 'valid',
        confidence: 0.95,
        source: 'cognitive',
        dimensions: { width_mm: 3000, height_mm: 2600 },
        attributes: { pleat_type: 'wave', hook_type: 'runnerhaak' },
      });

      const result = await engine.extractConfiguration(rawLine, '3.1');

      expect(result.reconciled_product_group_code).toBe('1.1');
      expect(result.extraction_notes).toContain('Productgroep gereconcilieerd van 3.1 naar 1.1 wegens plooitype');
    });

    it('markeert incomplete maten als status incomplete zonder crash', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 55,
        description: 'Duette stof',
        notes: 'Alleen breedte B: 1200 mm bekend',
      };

      const result = await engine.extractConfiguration(rawLine, '2.1');

      expect(result.status).toBe('incomplete');
      expect(result.dimensions?.width_mm).toBe(1200);
      expect(result.dimensions?.height_mm).toBeUndefined();
    });

    it('vangt onherleidbare vrije tekst op als requires_review zonder productgroep te vervuilen', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 60,
        description: 'Diverse stelposten',
        notes: 'zie mail van mevrouw van 12 mei',
      };

      vi.mocked(mockCognitiveProvider.extract).mockResolvedValueOnce({
        status: 'requires_review',
        confidence: 0.1,
        source: 'cognitive',
        extraction_notes: ['Geen herleidbare specificaties aangetroffen'],
      });

      const result = await engine.extractConfiguration(rawLine, '9.9');

      expect(result.status).toBe('requires_review');
      expect(result.reconciled_product_group_code).toBeUndefined();
    });

    // [SPEC-CHANGE-AUTHORIZED: Tranche 2 TDD suite voor LogicTrade multi-template configuration.items en Trap D fail-safe reconciliatie]
    it('Trap A Multi-Template: extraheert afmetingen via Luxaflex ankers (Blijvende maat) uit configuration.items', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 70,
        description: 'Luxaflex Silhouette 50mm',
        configuration: {
          id: 12345,
          items: [
            'Silhouette 50 mm',
            'Blijvende maat: 1070 mm',
            'Hoogte: 1480 mm',
            'Bediening: Smartcord rechts',
          ],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '2.3');
      expect(result.status).toBe('valid');
      expect(result.dimensions?.width_mm).toBe(1070);
      expect(result.dimensions?.height_mm).toBe(1480);
      expect(result.source).toBe('eorder_json');
    });

    it('Trap A Multi-Template: extraheert Unilux horren via directe indices 0 en 1 met domein-isolatie', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 71,
        description: 'Vaste hor Plus (veerstift)',
        supplier_name: 'Unilux',
        configuration: {
          id: 99887,
          items: [
            '865',
            '1341',
            'Standaard gaas grijs',
            'Kleur: RAL 9010',
          ],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '2.4');
      expect(result.status).toBe('valid');
      expect(result.dimensions?.width_mm).toBe(865);
      expect(result.dimensions?.height_mm).toBe(1341);
      expect(result.source).toBe('eorder_json');
    });

    it('Trap A Multi-Template: normaliseert heterogene array-elementen (strings, numbers, objects) zonder TypeError', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 72,
        description: 'KeJe Rolhor',
        supplier_name: 'KeJe',
        configuration: {
          id: 55443,
          items: [
            1200,
            { value: '1800' },
            null,
            undefined,
            'In de dag montage',
          ],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '2.4');
      expect(result.status).toBe('valid');
      expect(result.dimensions?.width_mm).toBe(1200);
      expect(result.dimensions?.height_mm).toBe(1800);
    });

    it('Trap A Multi-Template: voorkomt ongeankerde index-extractie op Plissés en Duettes (domein-isolatie)', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 73,
        description: 'Duette 25mm Fix',
        supplier_name: 'B&C Raamdecoratie',
        configuration: {
          id: 11223,
          items: [
            'Top-Down / Bottom-Up',
            'Koordbediening',
            'Stof Batist Wit',
          ],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '2.4');
      expect(result.dimensions?.width_mm).toBeUndefined();
    });

    // [SPEC-CHANGE-AUTHORIZED: Sanering van duplicate Trap D 9.9 reconciliatie conform SSOT-wet (ClassificationService is SSOT)]
    it('Trap D Reconciliatie: behoudt afmetingen zonder 9.9 classificatie te dupliceren', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 74,
        description: 'Horizontale jaloezie 25 mm alu',
        configuration: {
          id: 88776,
          items: [
            'Breedte: 1250 mm',
            'Hoogte: 1920 mm',
            'Lamelbreedte: 25 mm',
          ],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '9.9');
      expect(result.status).toBe('valid');
      expect(result.dimensions?.width_mm).toBe(1250);
      expect(result.dimensions?.height_mm).toBe(1920);
      expect(result.reconciled_product_group_code).toBeUndefined();
    });

    it('Trap D Reconciliatie: behoudt rolgordijn afmetingen zonder 9.9 te overschrijven', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 75,
        description: 'Toppoint Rolgordijn cassette',
        configuration: {
          id: 88777,
          items: [
            'Breedte: 1600 mm',
            'Hoogte: 2100 mm',
            'Stof: Verduisterend',
          ],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '9.9');
      expect(result.status).toBe('valid');
      expect(result.reconciled_product_group_code).toBeUndefined();
    });

    it('Trap D Reconciliatie: behoudt duettes afmetingen zonder 9.9 te overschrijven', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 76,
        description: 'Luxaflex Duette Shades 25mm',
        configuration: {
          id: 88778,
          items: [
            'Breedte: 1400 mm',
            'Hoogte: 1800 mm',
            'Model: Smartcord',
          ],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '9.9');
      expect(result.status).toBe('valid');
      expect(result.reconciled_product_group_code).toBeUndefined();
    });
  });

  // [SPEC-CHANGE-AUTHORIZED: Nieuwe regressietests voor nul-velden, kale tellers, 1D koven/rails, lookahead, 2.5 horren, 3.8/verticale jaloezieën, vragenlijsten en Trap C immutability conform INV-GOV-18]
  describe('Plan 1 TDD: Null & Partial Trap 0/A testsuite', () => {
    it('lt_width_mm: null of undefined in Trap 0 valt door naar items in Trap A zonder Math.round(null) te evalueren naar 0', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 101,
        description: 'Rolgordijn stof',
        width_mm: null as unknown as number,
        height_mm: null as unknown as number,
        configuration: {
          items: [
            'Blijvende maat',
            '1800',
            '2200',
          ],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '2.2');
      expect(result.status).toBe('valid');
      expect(result.dimensions?.width_mm).toBe(1800);
      expect(result.dimensions?.height_mm).toBe(2200);
      expect(result.source).toBe('eorder_json');
    });

    it('width_mm: 0 in ERP velden triggert geen Zod-crash en valt door naar items', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 102,
        description: 'Plissé',
        width_mm: 0,
        height_mm: 0,
        configuration: {
          items: [
            'Blijvende maat: 1200 mm',
            'Hoogte: 1600 mm',
          ],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '2.1');
      expect(result.status).toBe('valid');
      expect(result.dimensions?.width_mm).toBe(1200);
      expect(result.dimensions?.height_mm).toBe(1600);
      expect(result.source).toBe('eorder_json');
    });

    it('partiële hoogte "hoogte 2100 mm" via tokenize geeft { height_mm: 2100 } zonder width_mm: 0 en resulteert in status incomplete', async () => {
      const tokenized = DeterministicTokenizerProvider.tokenize('hoogte 2100 mm');
      expect(tokenized).toEqual({ height_mm: 2100 });
      expect(tokenized?.width_mm).toBeUndefined();

      const rawLine: RawOrderLineInput = {
        line_number: 103,
        description: 'hoogte 2100 mm',
      };

      const result = await engine.extractConfiguration(rawLine, '1.1');
      expect(result.status).toBe('incomplete');
      expect(result.dimensions?.height_mm).toBe(2100);
      expect(result.dimensions?.width_mm).toBeUndefined();
    });

    it('gedeeltelijke configuration_json zonder maten smoort items niet en draagt attributen over naar resultaat', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 104,
        description: 'Vouwgordijn',
        configuration_json: {
          kleur: 'wit',
        },
        configuration: {
          items: [
            'Blijvende maat',
            '2000',
            '2500',
          ],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '1.1');
      expect(result.status).toBe('valid');
      expect(result.dimensions?.width_mm).toBe(2000);
      expect(result.dimensions?.height_mm).toBe(2500);
      expect(result.attributes?.color || result.attributes?.kleur).toBe('wit');
    });
  });

  describe('Plan 1 TDD: Lookahead 494020 & 1D Koof 433888 testsuite', () => {
    it('lookahead i+10 op 494020 selecteert intern opeenvolgend paar (2250, 1000) ipv (2250, 2250)', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 105,
        description: 'DS-XL rail',
        configuration: {
          items: ['*', 'ALL', 'Blijvende maat', 'DS-XL® rail', '2250', 'Nee', '2250', '1000'],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '1.4');
      expect(result.status).toBe('valid');
      expect(result.dimensions?.width_mm).toBe(2250);
      expect(result.dimensions?.height_mm).toBe(1000);
    });

    it('1D losse koof 433888 stopt bij 0 na index 1 en retourneert 1D maat { width_mm: 950 } met status incomplete', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 106,
        description: 'Losse koof jaloezie',
        configuration: {
          items: ['Blijvende maat', '950', '0', 'Montage op de dag', '950'],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '2.1');
      expect(result.status).toBe('incomplete');
      expect(result.dimensions?.width_mm).toBe(950);
      expect(result.dimensions?.height_mm).toBeUndefined();
    });

    it('1D rail maat behoudt status incomplete zonder verlies van maat', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 107,
        description: 'Gordijnrail enkel',
        configuration: {
          items: ['Blijvende maat', '2400', 'Geen hoogte'],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '1.4');
      expect(result.status).toBe('incomplete');
      expect(result.dimensions?.width_mm).toBe(2400);
      expect(result.dimensions?.height_mm).toBeUndefined();
    });
  });

  describe('Plan 1 TDD: Counters Horren 2.5 & Policies 3.8/89mm/127mm testsuite', () => {
    it('kale een-cijferige tellers 1..9 in items worden nooit opgeschaald naar meters', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 108,
        description: 'Rolgordijn met opties',
        configuration: {
          items: ['Blijvende maat', '1', '2', 'Ketting rechts', '1500', '1900'],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '2.2');
      expect(result.dimensions?.width_mm).toBe(1500);
      expect(result.dimensions?.height_mm).toBe(1900);
    });

    it('horren groep 2.5 (435416) slaat teller 1 en 14 mm drempel over en pakt (558, 2344)', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 109,
        description: 'Plissé hordeur',
        supplier_name: 'Unilux',
        configuration: {
          items: ['1', '558', '2344', '14 mm drempel', 'Standaard gaas zwart'],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '2.5');
      expect(result.status).toBe('valid');
      expect(result.dimensions?.width_mm).toBe(558);
      expect(result.dimensions?.height_mm).toBe(2344);
    });

    it('vragenlijst items met { option: "Heeft u een koof?", value: "2400" } worden genegeerd tenzij optie een maatanker bevat', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 110,
        description: 'Gordijn',
        configuration: {
          items: [
            { option: 'Wilt u een koof?', value: '2400' },
            { option: 'Stofkeuze', value: 'Velours' },
          ],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '1.1');
      expect(result.dimensions?.width_mm).toBeUndefined();
    });

    it('groep 3.8 jaloezie (427414) met description extraheert slat_width_mm: 50', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 111,
        description: 'Horizontale jaloezie 50 mm alu',
        configuration: {
          items: ['Blijvende maat', '1200', '1800', 'Kleur wit'],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '3.8');
      expect(result.attributes?.slat_width_mm).toBe(50);
    });

    it('verticale jaloezieën met 89 mm en 127 mm lamellen worden correct geëxtraheerd als slat_width_mm', async () => {
      const rawLine89: RawOrderLineInput = {
        line_number: 112,
        description: 'Verticale lamel 89 mm stof',
        configuration: {
          items: ['Blijvende maat: 2000 mm', 'Hoogte: 2500 mm', 'Lamelbreedte: 89 mm'],
        },
      };
      const result89 = await engine.extractConfiguration(rawLine89, '2.3');
      expect(result89.attributes?.slat_width_mm).toBe(89);

      const rawLine127: RawOrderLineInput = {
        line_number: 113,
        description: 'Verticale jaloezie',
        configuration: {
          items: ['Blijvende maat', '1500', '2000', 'Lamel: 127 mm'],
        },
      };
      const result127 = await engine.extractConfiguration(rawLine127, '2.3');
      expect(result127.attributes?.slat_width_mm).toBe(127);
    });

    it('groep 2.1 met "Dubbele steun" matcht géén pleat_type: "dubbele_plooi"', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 114,
        description: 'Duette montageset',
        configuration: {
          items: ['Dubbele steun', 'Wand montage'],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '2.1');
      expect(result.attributes?.pleat_type).toBeUndefined();
      expect(result.attributes?.mounting).toBe('wand');
    });
  });

  describe('Plan 1 TDD: Bounds & Cache Immutability testsuite', () => {
    it('out-of-bounds maten (< 0, 0 < x < 100, > 12000) falen fail-closed via requires_review', async () => {
      const rawLineTooSmall: RawOrderLineInput = {
        line_number: 115,
        description: 'Duette',
        width_mm: 50,
        height_mm: 1500,
      };
      const resultTooSmall = await engine.extractConfiguration(rawLineTooSmall, '2.1');
      expect(resultTooSmall.status).toBe('requires_review');
      expect(resultTooSmall.dimensions).toBeUndefined();
      expect(resultTooSmall.confidence).toBe(0.1);

      const rawLineTooBig: RawOrderLineInput = {
        line_number: 116,
        description: 'Duette',
        configuration_json: {
          width_mm: 25000,
          height_mm: 1500,
        },
      };
      const resultTooBig = await engine.extractConfiguration(rawLineTooBig, '2.1');
      expect(resultTooBig.status).toBe('requires_review');
      expect(resultTooBig.dimensions).toBeUndefined();
    });

    it('hoekprofiel "50 x 20 mm" (489114) in Stap 6 wordt genegeerd zonder als out-of-bounds afgekeurd te worden', async () => {
      const rawLine: RawOrderLineInput = {
        line_number: 117,
        description: 'Aluminium hoekprofiel',
        configuration: {
          items: ['Hoekprofiel 50 x 20 mm', 'Lengte: 2390 mm'],
        },
      };

      const result = await engine.extractConfiguration(rawLine, '3.8');
      expect(result.status).not.toBe('requires_review');
    });

    it('Trap C LRU cache retourneert shallow copies zodat mutaties de cache niet beïnvloeden', async () => {
      vi.mocked(mockCognitiveProvider.extract).mockResolvedValueOnce({
        status: 'valid',
        confidence: 0.9,
        source: 'cognitive',
        dimensions: { width_mm: 1500, height_mm: 2000 },
        attributes: { color: 'blauw' },
      });

      const rawLine1: RawOrderLineInput = {
        line_number: 118,
        description: 'Gordijn uniek caching test',
        notes: 'Unieke confectie XYZ speciaal model zonder regex',
      };
      const rawLine2: RawOrderLineInput = {
        line_number: 119,
        description: 'Gordijn uniek caching test',
        notes: 'Unieke confectie XYZ speciaal model zonder regex',
      };

      const res1 = await engine.extractConfiguration(rawLine1, '1.1');
      if (res1.attributes) {
        res1.attributes.color = 'rood'; // mutatie op eerste resultaat
      }

      const res2 = await engine.extractConfiguration(rawLine2, '1.1');
      expect(res2.attributes?.color).toBe('blauw'); // cache blijft intact
    });
  });
});
