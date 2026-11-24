/**
 * tests/unit/domain/orders/dimension-extraction-engine.test.ts
 *
 * TDD Suite voor de centrale SSOT DimensionExtractionEngine:
 * - Raambekleding (window_2d): ERP velden, kruismaten, B/H syntaxen, e-Order synthese
 * - Vloeren (floor_area): m2 extractie, snijverliespercentages (visgraat/recht), bruto m2
 * - Gordijnen & Rails (curtain_linear): railbreedte, confectiehoogte, plooifactoren (wave, vlinder, enkel)
 * - Trappen (stairs): tredenaantal, open/dicht, renovatie, stootborden, LED, bandering
 * - Diensten & Overig (piece_service): tariefeenheden, fail-closed grenswaarden
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DimensionExtractionEngine } from '@/domain/orders/dimension-extraction-engine';
import type { RawOrderLineInput, ConfigurationDimensions } from '@/types/order-intake';

describe('DimensionExtractionEngine (TDD)', () => {
  let engine: DimensionExtractionEngine;

  beforeEach(() => {
    engine = new DimensionExtractionEngine();
  });

  describe('1. Raambekleding & Buitenzonwering (window_2d)', () => {
    it('extraheert directe ERP breedte en hoogte (width_mm & height_mm)', () => {
      const line: RawOrderLineInput = {
        line_number: 10,
        description: 'Duette Fix 25mm',
        width_mm: 2400,
        height_mm: 1800,
      };

      const result = engine.extractDimension(line, '2.1');

      expect(result.dimensionSpec).toEqual({
        type: 'window_2d',
        widthMm: 2400,
        heightMm: 1800,
        areaM2: 4.32,
      });
      expect(result.formattedDim).toBe('2400 × 1800');
      expect(result.source).toBe('erp_fields');
    });

    it('extraheert kruismaten uit omschrijving in centimeters en millimeters', () => {
      const line1: RawOrderLineInput = {
        line_number: 11,
        description: 'Rolgordijn verduisterend 140x220cm wit',
      };
      const res1 = engine.extractDimension(line1, '2.2');
      expect(res1.dimensionSpec).toEqual({
        type: 'window_2d',
        widthMm: 1400,
        heightMm: 2200,
        areaM2: 3.08,
      });
      expect(res1.formattedDim).toBe('1400 × 2200');

      const line2: RawOrderLineInput = {
        line_number: 12,
        description: 'Horren inzethor 850 × 1200 mm',
      };
      const res2 = engine.extractDimension(line2, '2.4');
      expect(res2.dimensionSpec).toEqual({
        type: 'window_2d',
        widthMm: 850,
        heightMm: 1200,
        areaM2: 1.02,
      });
      expect(res2.formattedDim).toBe('850 × 1200');
    });

    it('extraheert B en H labels uit vrije tekst of opmerkingen', () => {
      const line: RawOrderLineInput = {
        line_number: 13,
        description: 'Houten jaloezie 50mm',
        notes: 'Maatvoering: B 1800 H 2400 koordbediening rechts',
      };

      const res = engine.extractDimension(line, '2.1');
      expect(res.dimensionSpec).toEqual({
        type: 'window_2d',
        widthMm: 1800,
        heightMm: 2400,
        areaM2: 4.32,
      });
      expect(res.formattedDim).toBe('1800 × 2400');
    });

    it('synthetiseert afmetingen uit fallbackDimensions (e-Order Unilux/KeJe/Luxaflex items)', () => {
      const line: RawOrderLineInput = {
        line_number: 14,
        description: 'Unilux Voorzethor Special',
      };
      const fallbackDims: ConfigurationDimensions = {
        width_mm: 1250,
        height_mm: 1650,
      };

      const res = engine.extractDimension(line, '2.4', fallbackDims);
      expect(res.dimensionSpec).toEqual({
        type: 'window_2d',
        widthMm: 1250,
        heightMm: 1650,
        areaM2: 2.06,
      });
      expect(res.formattedDim).toBe('1250 × 1650');
      expect(res.source).toBe('configuration_fallback');
    });
  });

  describe('2. Vaste Vloerbekleding (floor_area)', () => {
    it('extraheert netto m2 en snijverlies percentage uit vrije tekst', () => {
      const line: RawOrderLineInput = {
        line_number: 20,
        description: 'Moduleo Click PVC Visgraat 34,5 m2 (+10% snijverlies)',
      };

      const res = engine.extractDimension(line, '3.1');
      expect(res.dimensionSpec).toEqual({
        type: 'floor_area',
        netAreaM2: 34.5,
        wastePercentage: 10,
        grossAreaM2: 37.95,
      });
      expect(res.formattedDim).toBe('34,5 m² (+10% snijverlies)');
    });

    it('kent automatisch 10% default snijverlies toe bij visgraat en 5% bij rechte stroken indien niet vermeld', () => {
      const lineVisgraat: RawOrderLineInput = {
        line_number: 21,
        description: 'Dryback PVC Visgraat 40 m2',
      };
      const resV = engine.extractDimension(lineVisgraat, '3.1');
      expect(resV.dimensionSpec).toEqual({
        type: 'floor_area',
        netAreaM2: 40,
        wastePercentage: 10,
        grossAreaM2: 44,
      });

      const lineRecht: RawOrderLineInput = {
        line_number: 22,
        description: 'Laminaat rechte plank 50 m²',
      };
      const resR = engine.extractDimension(lineRecht, '3.2');
      expect(resR.dimensionSpec).toEqual({
        type: 'floor_area',
        netAreaM2: 50,
        wastePercentage: 5,
        grossAreaM2: 52.5,
      });
    });

    it('valt terug op numerieke quantity indien eenheid m2 is en tekst geen getal bevat', () => {
      const line: RawOrderLineInput = {
        line_number: 23,
        description: 'Tapijt Parade Desso',
        quantity: 28.5,
        unit: 'm2',
      };

      const res = engine.extractDimension(line, '3.4');
      expect(res.dimensionSpec).toEqual({
        type: 'floor_area',
        netAreaM2: 28.5,
        wastePercentage: 5,
        grossAreaM2: 29.93,
      });
    });
  });

  describe('3. Gordijnen & Rails (curtain_linear)', () => {
    it('extraheert pure railbreedte in millimeters en herkent meters/cm', () => {
      const line: RawOrderLineInput = {
        line_number: 30,
        description: 'Gordijnrail DS wit 4,20 m1 met bocht',
      };

      const res = engine.extractDimension(line, '1.2');
      expect(res.dimensionSpec).toEqual({
        type: 'curtain_linear',
        widthMm: 4200,
        heightMm: undefined,
        pleatFactor: undefined,
      });
      expect(res.formattedDim).toBe('4200 mm');
    });

    it('extraheert breedte, hoogte en plooifactor voor wavegordijnen', () => {
      const line: RawOrderLineInput = {
        line_number: 31,
        description: 'Wavegordijn Inbetween breedte 420 cm hoogte 260 cm',
      };

      const res = engine.extractDimension(line, '1.1');
      expect(res.dimensionSpec).toEqual({
        type: 'curtain_linear',
        widthMm: 4200,
        heightMm: 2600,
        pleatFactor: 2.2,
      });
      expect(res.formattedDim).toBe('4200 × 2600 mm (wave)');
    });

    it('herkent dubbele/vlinderplooi factor 2.5 en enkele plooi factor 2.0', () => {
      const lineVlinder: RawOrderLineInput = {
        line_number: 32,
        description: 'Overgordijn 300 x 250 cm vlinderplooi',
      };
      const resV = engine.extractDimension(lineVlinder, '1.1');
      expect((resV.dimensionSpec as any).pleatFactor).toBe(2.5);

      const lineEnkel: RawOrderLineInput = {
        line_number: 33,
        description: 'Vitrage 200 x 240 cm enkele plooi',
      };
      const resE = engine.extractDimension(lineEnkel, '1.1');
      expect((resE.dimensionSpec as any).pleatFactor).toBe(2.0);
    });
  });

  describe('4. Trappen (stairs)', () => {
    // [SPEC-CHANGE-AUTHORIZED: Aanpassing testcases aan canonieke taxonomie 6.4 Trapstoffering ipv 4.x Wandafwerking]
    it('extraheert tredenaantal, open/dicht, renovatie en LED opties onder 6.4 Trapstoffering', () => {
      const line: RawOrderLineInput = {
        line_number: 40,
        description: 'Traprenovatie 13 treden dicht met LED verlichting',
      };

      const res = engine.extractDimension(line, '6.4');
      expect(res.dimensionSpec).toEqual({
        type: 'stairs',
        stepsCount: 13,
        stairType: 'renovatie',
        hasRisers: true,
        isOpen: false,
        ledLighting: true,
        bandering: false,
      });
      expect(res.formattedDim).toBe('13 treden (dicht + LED)');
    });

    it('extraheert open trap met 14 treden onder 6.4', () => {
      const line: RawOrderLineInput = {
        line_number: 41,
        description: 'Trap stofferen 14 treden open rondom',
      };

      const res = engine.extractDimension(line, '6.4');
      expect(res.dimensionSpec).toEqual({
        type: 'stairs',
        stepsCount: 14,
        stairType: 'stoffering',
        hasRisers: false,
        isOpen: true,
        ledLighting: false,
        bandering: false,
      });
      expect(res.formattedDim).toBe('14 treden (open)');
    });

    it('extraheert traploper met bandering onder 6.4', () => {
      const line: RawOrderLineInput = {
        line_number: 42,
        description: 'Traploper sisal 13 treden gebandeerd met roedes',
      };

      const res = engine.extractDimension(line, '6.4');
      expect(res.dimensionSpec).toEqual({
        type: 'stairs',
        stepsCount: 13,
        stairType: 'loper',
        hasRisers: false,
        isOpen: false,
        ledLighting: false,
        bandering: true,
      });
      expect(res.formattedDim).toBe('13 treden (gebandeerd)');
    });

    it('kent standaard 13 treden toe indien categorie trap (6.4) is maar aantal ontbreekt', () => {
      const line: RawOrderLineInput = {
        line_number: 43,
        description: 'Traprenovatie overzettreden CPL eiken dicht',
      };

      const res = engine.extractDimension(line, '6.4');
      expect(res.dimensionSpec).toEqual({
        type: 'stairs',
        stepsCount: 13,
        stairType: 'renovatie',
        hasRisers: true,
        isOpen: false,
        ledLighting: false,
        bandering: false,
      });
    });

    it('kent GEEN trappen toe aan Categorie 4 Wandafwerking (4.1 Behang krijgt geen 13 fantoom traptreden)', () => {
      const lineBehang: RawOrderLineInput = {
        line_number: 44,
        description: 'Arte behang Focus collectie',
      };
      const resBehang = engine.extractDimension(lineBehang, '4.1');
      expect(resBehang.dimensionSpec?.type).not.toBe('stairs');
      expect(resBehang.formattedDim).toBeNull();
    });

    it('kent GEEN trappen toe aan behang met notitie trapopgang onder Categorie 4', () => {
      const lineTrapopgang: RawOrderLineInput = {
        line_number: 45,
        description: 'Arte behang voor trapopgang',
        notes: 'behang voor trapopgang',
      };
      const res = engine.extractDimension(lineTrapopgang, '4.1');
      expect(res.dimensionSpec?.type).not.toBe('stairs');
    });
  });

  describe('5. Diensten & Overig (piece_service)', () => {
    it('kent piece_service toe aan diensten en montage regels', () => {
      const line: RawOrderLineInput = {
        line_number: 50,
        description: 'Montage raambekleding per uur',
        unit: 'uur',
      };

      const res = engine.extractDimension(line, '6.2');
      expect(res.dimensionSpec).toEqual({
        type: 'piece_service',
        unit: 'uur',
      });
      expect(res.formattedDim).toBeNull();
    });

    it('valt veilig terug op piece_service bij zuivere tekstregels zonder maten', () => {
      const line: RawOrderLineInput = {
        line_number: 51,
        description: 'Showroomgesprek en kleuradvies',
      };

      const res = engine.extractDimension(line, '9.9');
      expect(res.dimensionSpec).toEqual({
        type: 'piece_service',
        unit: 'stuks',
      });
      expect(res.formattedDim).toBeNull();
    });
  });

  describe('6. Fail-Closed Grenswaarden & Robuustheid', () => {
    it('wijst negatieve afmetingen af en valt fail-closed terug op piece_service', () => {
      const line: RawOrderLineInput = {
        line_number: 60,
        description: 'Gordijn -1200 x 2400',
        width_mm: -1200,
        height_mm: 2400,
      };

      const res = engine.extractDimension(line, '1.1');
      expect(res.dimensionSpec).toEqual({
        type: 'piece_service',
        unit: 'stuks',
      });
      expect(res.formattedDim).toBeNull();
    });

    it('wijst absurde afmetingen (> 15000 mm) af en valt fail-closed terug op piece_service', () => {
      const line: RawOrderLineInput = {
        line_number: 61,
        description: 'Duette 50000 x 1800 mm',
        width_mm: 50000,
        height_mm: 1800,
      };

      const res = engine.extractDimension(line, '2.1');
      expect(res.dimensionSpec).toEqual({
        type: 'piece_service',
        unit: 'stuks',
      });
    });

    it('parseDimensionString en formatDimensionSpec werken bijectief en consistent', () => {
      const spec = engine.parseDimensionString('1800 × 2400', 'raam');
      expect(spec).toEqual({
        type: 'window_2d',
        widthMm: 1800,
        heightMm: 2400,
        areaM2: 4.32,
      });

      const formatted = engine.formatDimensionSpec(spec);
      expect(formatted).toBe('1800 × 2400');
    });
  });
});
