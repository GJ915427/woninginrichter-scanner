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
  });
});
