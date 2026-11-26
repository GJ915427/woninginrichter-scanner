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
      const resVisgraat = engine.extractDimension(lineVisgraat, '3.1');
      expect((resVisgraat.dimensionSpec as any).wastePercentage).toBe(10);
      expect((resVisgraat.dimensionSpec as any).grossAreaM2).toBe(44);

      const lineRecht: RawOrderLineInput = {
        line_number: 22,
        description: 'Laminaat eiken naturel 50 m2',
      };
      const resRecht = engine.extractDimension(lineRecht, '3.2');
      expect((resRecht.dimensionSpec as any).wastePercentage).toBe(5);
      expect((resRecht.dimensionSpec as any).grossAreaM2).toBe(52.5);
    });

    it('leest m2 uit line.quantity indien unit m2 is en tekst geen expliciete m2 bevat', () => {
      const lineQty: RawOrderLineInput = {
        line_number: 23,
        description: 'Ambiant Spigato Click PVC',
        quantity: 25.4,
        unit: 'm2',
      };

      const res = engine.extractDimension(lineQty, '3.1');
      expect(res.dimensionSpec).toEqual({
        type: 'floor_area',
        netAreaM2: 25.4,
        wastePercentage: 5,
        grossAreaM2: 26.67,
      });
      expect(res.source).toBe('erp_fields');
    });
  });

  describe('3. Gordijnen & Rails (curtain_linear)', () => {
    it('extraheert railbreedte en confectiehoogte uit B x H annotaties', () => {
      const line: RawOrderLineInput = {
        line_number: 30,
        description: 'Inbetween stof Lucca',
        notes: 'B: 3200 mm H: 2600 mm enkele plooi',
      };

      const res = engine.extractDimension(line, '1.1');
      expect(res.dimensionSpec).toEqual({
        type: 'curtain_linear',
        widthMm: 3200,
        heightMm: 2600,
        pleatFactor: 2.0,
      });
      expect(res.formattedDim).toBe('3200 × 2600 mm (enkel)');
    });

    it('extraheert plooifactoren: wave (2.2), vlinder (2.5), enkel (2.0)', () => {
      const lineWave: RawOrderLineInput = {
        line_number: 31,
        description: 'Wavegordijn linnen look 420 x 260 cm',
      };
      const resWave = engine.extractDimension(lineWave, '1.1');
      expect((resWave.dimensionSpec as any).pleatFactor).toBe(2.2);
      expect(resWave.formattedDim).toBe('4200 × 2600 mm (wave)');

      const lineVlinder: RawOrderLineInput = {
        line_number: 32,
        description: 'Overgordijn velours B: 300 H: 250 cm vlinderplooi',
      };
      const resVlinder = engine.extractDimension(lineVlinder, '1.1');
      expect((resVlinder.dimensionSpec as any).pleatFactor).toBe(2.5);
      expect(resVlinder.formattedDim).toBe('3000 × 2500 mm (vlinder)');
    });

    it('ondersteunt losse gordijnrails (1D maat in millimeters of meters)', () => {
      const lineRail: RawOrderLineInput = {
        line_number: 33,
        description: 'Gordijnrail DS wit 4,20 m1 met bocht',
      };

      const res = engine.extractDimension(lineRail, '1.2');
      expect(res.dimensionSpec).toEqual({
        type: 'curtain_linear',
        widthMm: 4200,
        heightMm: undefined,
        pleatFactor: undefined,
      });
      expect(res.formattedDim).toBe('4200 mm');
    });
  });

  describe('4. Trappen (stairs)', () => {
    it('extraheert dichte traprenovatie met 13 treden en LED verlichting onder 6.4', () => {
      const line: RawOrderLineInput = {
        line_number: 40,
        description: 'Traprenovatie eiken 13 treden dicht met LED',
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

    it('extraheert open trapstoffering met 14 treden onder 6.4', () => {
      const line: RawOrderLineInput = {
        line_number: 41,
        description: 'Trap stofferen 14 treden open aan 2 zijden',
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

    it('wijst absurde afmetingen (> 12000 mm) af en valt fail-closed terug op piece_service', () => {
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

    it('wijst afmetingen kleiner dan 100 mm af voor ramen en valt fail-closed terug op piece_service', () => {
      const line: RawOrderLineInput = {
        line_number: 62,
        description: 'Buisdiameter 20 mm',
        width_mm: 20,
        height_mm: 20,
      };

      const res = engine.extractDimension(line, '2.1');
      expect(res.dimensionSpec).toEqual({
        type: 'piece_service',
        unit: 'stuks',
      });
    });

    it('normaliseert cm-eenheden en decimale getallen in parseWindow2D', () => {
      const lineCm: RawOrderLineInput = {
        line_number: 63,
        description: 'Rolgordijn B: 180,5 cm H: 240 cm',
      };

      const res = engine.extractDimension(lineCm, '2.1');
      expect(res.dimensionSpec?.type).toBe('window_2d');
      expect((res.dimensionSpec as any)?.widthMm).toBe(1805);
      expect((res.dimensionSpec as any)?.heightMm).toBe(2400);
    });

    it('herkent marmoleum, linoleum en vinyl onder categorie 3.9 als vloeren', () => {
      const lineFloor: RawOrderLineInput = {
        line_number: 64,
        description: 'Forbo Marmoleum Click 90x30 cm',
        quantity: 15,
        unit: 'm2',
      };

      const res = engine.extractDimension(lineFloor, '3.9');
      expect(res.dimensionSpec?.type).toBe('floor_area');
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

  describe('7. Syntactische Scheiding van Kleurcodes vs Maatlabels (Root Cause Fix)', () => {
    it('herkent Duette stofkleurcodes (B90607, H12345) NIET als uitschieter in hasDimensionOutlier', () => {
      const line1: RawOrderLineInput = {
        line_number: 70,
        description: 'Duette®',
        notes: '- Slaapkamer Joost\r\n- GIW duette\r\n- Type: Tapeframe met top down / bottom up\r\n- Kleur: B90607\r\n- Profiel: Wit',
      };
      expect(engine.hasDimensionOutlier(line1)).toBe(false);

      const line2: RawOrderLineInput = {
        line_number: 71,
        description: 'Hor',
        notes: '- Kleur: H12345',
      };
      expect(engine.hasDimensionOutlier(line2)).toBe(false);
    });

    it('herkent legitieme extreme uitschieters (> 12000 mm) WEL als outlier in hasDimensionOutlier', () => {
      const outlier1: RawOrderLineInput = {
        line_number: 72,
        description: 'Zonwering',
        notes: 'B: 25000 mm',
      };
      expect(engine.hasDimensionOutlier(outlier1)).toBe(true);

      const outlier2: RawOrderLineInput = {
        line_number: 73,
        description: 'Gordijn',
        notes: 'Breedte 15000 mm',
      };
      expect(engine.hasDimensionOutlier(outlier2)).toBe(true);
    });

    it('parseWindow2D negeert Duette kleurcode B90607 en extraheert legitieme maten bij gecombineerde annotatie', () => {
      const line: RawOrderLineInput = {
        line_number: 74,
        description: 'Duette®',
        notes: '- Kleur: B90607\r\n- B: 1800 H: 2400',
      };
      const res = engine.extractDimension(line, '2.4');
      expect(res.dimensionSpec).toEqual({
        type: 'window_2d',
        widthMm: 1800,
        heightMm: 2400,
        areaM2: 4.32,
      });
      expect(res.formattedDim).toBe('1800 × 2400');
    });

    it('ondersteunt diverse geldige label-scheidingstekens (B 1800, B: 1800, B=1800, B-1800, Breedte 1800)', () => {
      for (const sep of [': ', ' ', '=', '-']) {
        const line: RawOrderLineInput = {
          line_number: 75,
          description: 'Jaloezie',
          notes: `B${sep}1800 H${sep}2400`,
        };
        const res = engine.extractDimension(line, '2.1');
        expect(res.dimensionSpec?.type).toBe('window_2d');
        expect((res.dimensionSpec as any)?.widthMm).toBe(1800);
        expect((res.dimensionSpec as any)?.heightMm).toBe(2400);
      }
    });
  });

  // [SPEC-CHANGE-AUTHORIZED: Uitbreiding regressiesuite voor Zilveren Laag Plan 2 categorisatie en synthese conform Grondwet Laag 1B § 6]
  describe('8. Zilveren Laag Sanering: Categorisatie, Null-Safety & Bijectieve Synthese (Plan 2)', () => {
    describe('8.1 Null-Safety & Ontbrekende ERP-maten', () => {
      it('stroomt bij null-waarden voor lt_width_mm en lt_height_mm netjes door naar vrije tekst extractie', () => {
        const line: RawOrderLineInput = {
          line_number: 80,
          description: 'Rolgordijn verduisterend 140x220cm wit',
          lt_width_mm: null as any,
          lt_height_mm: null as any,
        };
        const res = engine.extractDimension(line, '2.2');
        expect(res.dimensionSpec).toEqual({
          type: 'window_2d',
          widthMm: 1400,
          heightMm: 2200,
          areaM2: 3.08,
        });
        expect(res.formattedDim).toBe('1400 × 2200');
        expect(res.source).toBe('text_description');
      });

      it('stroomt bij width_mm === 0 door naar vrije tekst zonder af te breken naar piece_service', () => {
        const line: RawOrderLineInput = {
          line_number: 81,
          description: 'Houten jaloezie 50mm B 1800 H 2400',
          width_mm: 0,
          height_mm: 0,
        };
        const res = engine.extractDimension(line, '2.1');
        expect(res.dimensionSpec?.type).toBe('window_2d');
        expect((res.dimensionSpec as any)?.widthMm).toBe(1800);
        expect((res.dimensionSpec as any)?.heightMm).toBe(2400);
      });

      it('breekt bij fysiek ongeldige maten (< 0 of 0 < dim < 100) fail-closed af naar piece_service', () => {
        const lineNeg: RawOrderLineInput = {
          line_number: 82,
          description: 'Rolgordijn',
          width_mm: -50,
          height_mm: 1800,
        };
        const resNeg = engine.extractDimension(lineNeg, '2.1');
        expect(resNeg.dimensionSpec?.type).toBe('piece_service');

        const lineTooSmall: RawOrderLineInput = {
          line_number: 83,
          description: 'Rolgordijn',
          width_mm: 50,
          height_mm: 1800,
        };
        const resTooSmall = engine.extractDimension(lineTooSmall, '2.1');
        expect(resTooSmall.dimensionSpec?.type).toBe('piece_service');
      });

      it('breekt bij fysieke uitschieters (> 12000 mm) fail-closed af naar piece_service met isOutlier: true', () => {
        const lineOutlier: RawOrderLineInput = {
          line_number: 84,
          description: 'Rolgordijn',
          width_mm: 15000,
          height_mm: 1800,
        };
        const resOutlier = engine.extractDimension(lineOutlier, '2.1');
        expect(resOutlier.dimensionSpec?.type).toBe('piece_service');
        expect(resOutlier.isOutlier).toBe(true);
      });
    });

    describe('8.2 Categorisatie & Morfologische Rail/Gordijn Scheiding', () => {
      it('herkent echte rails als kind: rail en isTrueRail: true', () => {
        const res = engine.resolveCurtainOrRailKind('1.2', 'Gordijnrail 400 cm');
        expect(res.kind).toBe('rail');
        expect(res.isTrueRail).toBe(true);
      });

      it('classificeert contextuele railnotities bij gordijnen als kind: curtain en isTrueRail: false', () => {
        const res = engine.resolveCurtainOrRailKind('1.1', 'Overgordijn plooi', '- Op bestaande rail');
        expect(res.kind).toBe('curtain');
        expect(res.isTrueRail).toBe(false);
        expect(res.isCurtain).toBe(true);
      });

      it('classificeert rail-accessoires als kind: other en isTrueRail: false', () => {
        const res = engine.resolveCurtainOrRailKind('1.4', 'Dubbele wandsteun voor rail');
        expect(res.kind).toBe('other');
        expect(res.isTrueRail).toBe(false);

        const res2 = engine.resolveCurtainOrRailKind('1.4', '- 4x Wandsteun rail');
        expect(res2.kind).toBe('other');
        expect(res2.isTrueRail).toBe(false);

        const res3 = engine.resolveCurtainOrRailKind('1.4', 'Wandsteun Gordijnrail 10 cm');
        expect(res3.kind).toBe('other');
        expect(res3.isTrueRail).toBe(false);

        const resNoGroup = engine.resolveCurtainOrRailKind('', 'Dubbele wandsteun voor rail');
        expect(resNoGroup.kind).toBe('other');
        expect(resNoGroup.isTrueRail).toBe(false);
      });

      it('extraheert 1.2 orderregels zonder het woord vouwgordijn als window_2d terwijl 1.2 rails curtain_linear blijven', () => {
        // Romeins vouwsysteem onder 1.2 zonder woord "vouwgordijn"
        const lineVouw: RawOrderLineInput = {
          line_number: 910,
          description: 'Romeins systeem 180 x 220 cm',
        };
        const resVouw = engine.extractDimension(lineVouw, '1.2');
        expect(resVouw.dimensionSpec).toEqual({
          type: 'window_2d',
          widthMm: 1800,
          heightMm: 2200,
          areaM2: 3.96,
        });

        // 1.2 Rail blijft curtain_linear
        const lineRail: RawOrderLineInput = {
          line_number: 911,
          description: 'Gordijnrail DS wit 4,20 m1 met bocht',
        };
        const resRail = engine.extractDimension(lineRail, '1.2');
        expect(resRail.dimensionSpec).toEqual({
          type: 'curtain_linear',
          widthMm: 4200,
          heightMm: undefined,
          pleatFactor: undefined,
        });
      });

      it('beschermt 1.4 gordijnen met screen/hor notities tegen kaping naar hard_window (blijft curtain_linear)', () => {
        const line: RawOrderLineInput = {
          line_number: 912,
          description: 'Gordijn Lavie KH 13 300 x 250 cm',
          notes: '- Hangt naast screen voor raam met inzethor',
        };
        const classification = engine.resolveCurtainOrRailKind('1.4', line.description, line.notes);
        expect(classification.kind).toBe('curtain');
        expect(classification.isCurtain).toBe(true);
        expect(classification.isExplicitHardWindow).toBe(false);

        const res = engine.extractDimension(line, '1.4');
        expect(res.dimensionSpec).toEqual({
          type: 'curtain_linear',
          widthMm: 3000,
          heightMm: 2500,
          pleatFactor: undefined,
        });
      });

      it('disambigueert gordijnen met ringen/loodveter (kind: curtain) van losse accessoires (kind: other)', () => {
        // 1. Gordijnen met toevoegingen -> curtain
        const resRingen = engine.resolveCurtainOrRailKind('1.1', 'Overgordijn met ringen 300 x 250 cm');
        expect(resRingen.kind).toBe('curtain');
        expect(resRingen.isCurtain).toBe(true);

        const resZeilringen = engine.resolveCurtainOrRailKind('1.1', 'Overgordijn incl. zeilringen 300 x 250 cm');
        expect(resZeilringen.kind).toBe('curtain');

        const resLoodveter = engine.resolveCurtainOrRailKind('1.1', 'Vitrage met loodveter 300 x 250 cm');
        expect(resLoodveter.kind).toBe('curtain');

        const resWaveglijders = engine.resolveCurtainOrRailKind('1.4', 'Wavegordijn incl. waveglijders 400 x 260 cm');
        expect(resWaveglijders.kind).toBe('curtain');

        // Extractie levert netjes curtain_linear
        const lineGordijnRingen: RawOrderLineInput = {
          line_number: 913,
          description: 'Overgordijn met ringen 300 x 250 cm',
        };
        const dimRingen = engine.extractDimension(lineGordijnRingen, '1.1');
        expect(dimRingen.dimensionSpec.type).toBe('curtain_linear');
        expect((dimRingen.dimensionSpec as any).widthMm).toBe(3000);
        expect((dimRingen.dimensionSpec as any).heightMm).toBe(2500);

        // 2. Echte accessoires als hoofdproduct -> other
        const resWandOvergordijn = engine.resolveCurtainOrRailKind('1.4', 'Dubbele wandsteun voor overgordijn');
        expect(resWandOvergordijn.kind).toBe('other');
        expect(resWandOvergordijn.isTrueRail).toBe(false);

        const resWandGordijn = engine.resolveCurtainOrRailKind('1.4', 'Wandsteun voor gordijn 10 cm');
        expect(resWandGordijn.kind).toBe('other');

        const resWaveglijdersLos = engine.resolveCurtainOrRailKind('1.4', 'Waveglijders 100 stuks');
        expect(resWaveglijdersLos.kind).toBe('other');
      });

      it('herkent gordijnroedes en paneelgordijn rails correct als rail', () => {
        const resRoede = engine.resolveCurtainOrRailKind('1.2', 'Gordijnroede 300 cm');
        expect(resRoede.kind).toBe('rail');
        expect(resRoede.isTrueRail).toBe(true);

        const resPaneel = engine.resolveCurtainOrRailKind('1.2', 'Paneelgordijn losse rail wit');
        expect(resPaneel.kind).toBe('rail');
        expect(resPaneel.isTrueRail).toBe(true);
      });

      it('behandelt "Vitrage stof" als stof (kind: other) en "Inbetween verduisteringsstof 15000 mm" als gordijn (kind: curtain)', () => {
        const resVitrage = engine.resolveCurtainOrRailKind('1.1', 'Vitrage stof 300 x 250 cm');
        expect(resVitrage.kind).toBe('other');
        expect(resVitrage.isTrueRail).toBe(false);

        const resInbetween = engine.resolveCurtainOrRailKind('1.9', 'Inbetween verduisteringsstof 15000 mm');
        expect(resInbetween.kind).toBe('curtain');
        expect(resInbetween.isTrueRail).toBe(false);
      });

      it('classificeert empirische randgevallen uit de Dev DB (433938, 436440, 434270, 427727)', () => {
        // 433938: Rail (verticale jaloezie) -> rail
        const res433938 = engine.resolveCurtainOrRailKind('1.2', 'Rail (verticale jaloezie)');
        expect(res433938.kind).toBe('rail');
        expect(res433938.isTrueRail).toBe(true);

        // Roede voor vouwgordijn -> rail
        const resVouwRoede = engine.resolveCurtainOrRailKind('1.2', 'Roede voor vouwgordijn');
        expect(resVouwRoede.kind).toBe('rail');
        expect(resVouwRoede.isTrueRail).toBe(true);

        // Goelst & Silent Gliss
        const resGoelst = engine.resolveCurtainOrRailKind('1.2', 'Goelst Gordijnrail voor overgordijn');
        expect(resGoelst.kind).toBe('rail');
        expect(resGoelst.isTrueRail).toBe(true);

        const resSilentGliss = engine.resolveCurtainOrRailKind('1.2', 'Silent Gliss 6100 rail voor vitrage');
        expect(resSilentGliss.kind).toBe('rail');
        expect(resSilentGliss.isTrueRail).toBe(true);

        // 434270: Paneelgordijn losse rail
        const res434270 = engine.resolveCurtainOrRailKind('1.2', 'Paneelgordijn losse rail');
        expect(res434270.kind).toBe('rail');
        expect(res434270.isTrueRail).toBe(true);

        // 436440: Gordijnrail DS wit, - 2.80 mtr. rail
        const res436440 = engine.resolveCurtainOrRailKind('1.2', 'Gordijnrail DS wit', '- 2.80 mtr. rail');
        expect(res436440.kind).toBe('rail');
        expect(res436440.isTrueRail).toBe(true);

        // 427727: Groep 3.8 Duette shades -> hard_window
        const res427727 = engine.resolveCurtainOrRailKind('3.8', 'Duette® shades', '- Br 113 cm x hg 300 cm');
        expect(res427727.kind).toBe('hard_window');
        expect(res427727.isExplicitHardWindow).toBe(true);
      });
    });

    describe('8.3 UI vs ERP 1D Scheiding (parseDimensionString)', () => {
      it('parseert 1D maatreeksen uit Matrix UI kolommen voor zowel Gordijnen als Gordijnrail', () => {
        const curtainSpec = engine.parseDimensionString('3200 mm', 'Gordijnen');
        expect(curtainSpec).toEqual({
          type: 'curtain_linear',
          widthMm: 3200,
        });

        const railSpec = engine.parseDimensionString('3200 mm', 'Gordijnrail');
        expect(railSpec).toEqual({
          type: 'curtain_linear',
          widthMm: 3200,
        });
      });

      it('ondersteunt m1 en m¹ notaties in parseDimensionString voor rails', () => {
        const railM1 = engine.parseDimensionString('4,20 m1', 'Gordijnrail');
        expect(railM1).toEqual({
          type: 'curtain_linear',
          widthMm: 4200,
        });

        const railSup1 = engine.parseDimensionString('4m¹', 'Gordijnrail');
        expect(railSup1).toEqual({
          type: 'curtain_linear',
          widthMm: 4000,
        });
      });

      it('laat ERP 2D gordijn met 1D stofnotitie doorvallen naar fallback/piece_service (geen 1D Variant 3 kaping)', () => {
        const lineStof: RawOrderLineInput = {
          line_number: 871,
          description: 'Overgordijn',
          notes: '- 17,6 mtr stof',
        };
        const resStof = engine.extractDimension(lineStof, '1.1');
        expect(resStof.dimensionSpec.type).toBe('piece_service');
      });

      it('extraheert 1D railbreedte en negeert wandsteun-afmetingen (2.80 mtr vs 10 cm)', () => {
        const lineRailSteun: RawOrderLineInput = {
          line_number: 872,
          description: 'Gordijnrail DS wit',
          notes: '- 2.80 mtr. rail\n- Wandsteunen 10 cm',
        };
        const res = engine.extractDimension(lineRailSteun, '1.2');
        expect(res.dimensionSpec).toEqual({
          type: 'curtain_linear',
          widthMm: 2800,
          heightMm: undefined,
          pleatFactor: undefined,
        });
      });
    });

    describe('8.4 Bijectieve Round-Trip & Plooi-Normalisatie', () => {
      it('formatteert 2D gordijnmaten met bijectieve haakjestokens voor alle 4 plooifactoren', () => {
        expect(engine.formatDimensionSpec({ type: 'curtain_linear', widthMm: 2000, heightMm: 2400, pleatFactor: 2.0 })).toBe('2000 × 2400 mm (enkel)');
        expect(engine.formatDimensionSpec({ type: 'curtain_linear', widthMm: 4200, heightMm: 2600, pleatFactor: 2.2 })).toBe('4200 × 2600 mm (wave)');
        expect(engine.formatDimensionSpec({ type: 'curtain_linear', widthMm: 3000, heightMm: 2500, pleatFactor: 2.5 })).toBe('3000 × 2500 mm (vlinder)');
        expect(engine.formatDimensionSpec({ type: 'curtain_linear', widthMm: 2000, heightMm: 2400, pleatFactor: 3.0 })).toBe('2000 × 2400 mm (triplooi)');
      });

      it('behoudt plooifactor bij round-trip parseDimensionString(formatDimensionSpec(spec))', () => {
        for (const factor of [2.0, 2.2, 2.5, 3.0]) {
          const original = { type: 'curtain_linear' as const, widthMm: 2400, heightMm: 2200, pleatFactor: factor };
          const formatted = engine.formatDimensionSpec(original);
          expect(formatted).toBeTruthy();
          const parsed = engine.parseDimensionString(formatted!, 'Gordijnen');
          expect(parsed).toEqual(original);
        }
      });

      it('herkent samengestelde retourplooien en enkeleplooi in extractDimension', () => {
        const lineVlinderRetour: RawOrderLineInput = {
          line_number: 85,
          description: 'Overgordijn 300 x 250 cm vlinder-retourplooi',
        };
        const resVlinder = engine.extractDimension(lineVlinderRetour, '1.1');
        expect(resVlinder.dimensionSpec?.type).toBe('curtain_linear');
        expect((resVlinder.dimensionSpec as any)?.pleatFactor).toBe(2.5);

        const lineEnkelRetour: RawOrderLineInput = {
          line_number: 86,
          description: 'Overgordijn 300 x 250 cm enkel-retour',
        };
        const resEnkel = engine.extractDimension(lineEnkelRetour, '1.1');
        expect((resEnkel.dimensionSpec as any)?.pleatFactor).toBe(2.0);

        const lineEnkelePlooi: RawOrderLineInput = {
          line_number: 87,
          description: 'Overgordijn 300 x 250 cm enkeleplooi',
        };
        const resEnkele = engine.extractDimension(lineEnkelePlooi, '1.1');
        expect((resEnkele.dimensionSpec as any)?.pleatFactor).toBe(2.0);

        const lineTriPlooi: RawOrderLineInput = {
          line_number: 873,
          description: 'Overgordijn 300 x 250 cm tri-plooi',
        };
        const resTri = engine.extractDimension(lineTriPlooi, '1.1');
        expect((resTri.dimensionSpec as any)?.pleatFactor).toBe(3.0);
      });

      it('respecteert negatie-guards voor plooifactoren', () => {
        const lineNeg1: RawOrderLineInput = {
          line_number: 874,
          description: 'Overgordijn 300 x 250 cm',
          notes: '- Enkele plooi: niet van toepassing',
        };
        const resNeg1 = engine.extractDimension(lineNeg1, '1.1');
        expect((resNeg1.dimensionSpec as any)?.pleatFactor).toBeUndefined();

        const lineNeg2: RawOrderLineInput = {
          line_number: 875,
          description: 'Overgordijn 300 x 250 cm',
          notes: '- Enkele plooi: nee',
        };
        const resNeg2 = engine.extractDimension(lineNeg2, '1.1');
        expect((resNeg2.dimensionSpec as any)?.pleatFactor).toBeUndefined();

        const lineWaveRail: RawOrderLineInput = {
          line_number: 876,
          description: 'Gordijn 300 x 250 cm',
          notes: 'Wave rail: ja',
        };
        const resWaveRail = engine.extractDimension(lineWaveRail, '1.1');
        expect((resWaveRail.dimensionSpec as any)?.pleatFactor).toBeUndefined();
      });
    });

    describe('8.5 Regex-Grenzen, Backtracking & Multiplier-Isolatie', () => {
      it('voorkomt dat decimale artikelnummers zoals br 2402.0246.1.1 als maat worden gezien', () => {
        const line: RawOrderLineInput = {
          line_number: 88,
          description: 'Gordijnstof br 2402.0246.1.1',
          notes: 'Geen maat opgegeven',
        };
        const res = engine.extractDimension(line, '1.1');
        expect(res.dimensionSpec?.type).toBe('piece_service');
      });

      it('voorkomt fantoomdimensies op datums (15/12/2026) en orderreferenties (2026/15000)', () => {
        const lineDatum: RawOrderLineInput = {
          line_number: 881,
          description: 'Rolgordijn Leverdatum 15/12/2026',
        };
        const resDatum = engine.extractDimension(lineDatum, '2.1');
        expect(resDatum.dimensionSpec?.type).toBe('piece_service');

        const lineOrder: RawOrderLineInput = {
          line_number: 882,
          description: 'Rolgordijn Order 2026/15000',
        };
        const resOrder = engine.extractDimension(lineOrder, '2.1');
        expect(resOrder.dimensionSpec?.type).toBe('piece_service');
      });

      it('scheidt bundels met aantal x lengte (1 x 14.20mtr.) van 2D kruismaten', () => {
        const lineMultiplier: RawOrderLineInput = {
          line_number: 89,
          description: 'Plint 1 x 14.20mtr.',
        };
        const res = engine.extractDimension(lineMultiplier, '3.2');
        expect(res.dimensionSpec?.type).not.toBe('window_2d');
      });

      it('extraheert decimale 2D-maten met komma en meter aanduiding (2,40 x 2,60 mtr) correct', () => {
        const lineDec: RawOrderLineInput = {
          line_number: 90,
          description: 'Rolgordijn 2,40 x 2,60 mtr',
        };
        const res = engine.extractDimension(lineDec, '2.1');
        expect(res.dimensionSpec).toEqual({
          type: 'window_2d',
          widthMm: 2400,
          heightMm: 2600,
          areaM2: 6.24,
        });
      });

      it('normaliseert decimale meters zonder eenheid (443810, 442969, 442043)', () => {
        // 443810: breedte 2.60 x hoogte 1.94 -> 2600 x 1940 mm
        const line443810: RawOrderLineInput = {
          line_number: 883,
          description: 'Rolgordijn breedte 2.60 x hoogte 1.94',
        };
        const res443810 = engine.extractDimension(line443810, '2.1');
        expect(res443810.dimensionSpec).toEqual({
          type: 'window_2d',
          widthMm: 2600,
          heightMm: 1940,
          areaM2: 5.04,
        });

        // 442969: BR 1.20 x HG 1915 -> 1200 x 1915 mm
        const line442969: RawOrderLineInput = {
          line_number: 884,
          description: 'Rolgordijn BR 1.20 x HG 1915',
        };
        const res442969 = engine.extractDimension(line442969, '2.1');
        expect(res442969.dimensionSpec).toEqual({
          type: 'window_2d',
          widthMm: 1200,
          heightMm: 1915,
          areaM2: 2.3,
        });

        // 442043: BR 1,4 mtr x HG 2,8 mtr -> 1400 x 2800 mm
        const line442043: RawOrderLineInput = {
          line_number: 885,
          description: 'Rolgordijn BR 1,4 mtr x HG 2,8 mtr',
        };
        const res442043 = engine.extractDimension(line442043, '2.1');
        expect(res442043.dimensionSpec).toEqual({
          type: 'window_2d',
          widthMm: 1400,
          heightMm: 2800,
          areaM2: 3.92,
        });
      });

      it('is immuun voor multi-line bullet kaping (442461 - PG B / 6,9)', () => {
        const line442461: RawOrderLineInput = {
          line_number: 886,
          description: 'Paneelgordijn',
          notes: '- PG B\r\n- 6,9',
        };
        const res = engine.extractDimension(line442461, '1.4');
        expect(res.dimensionSpec.type).toBe('piece_service');
      });

      it('sluit m² en m2 oppervlaktes uit van lineaire breedtematen', () => {
        const lineM2: RawOrderLineInput = {
          line_number: 91,
          description: 'Gordijnstof 15 x 15 m²',
        };
        const res = engine.extractDimension(lineM2, '1.1');
        expect(res.dimensionSpec?.type).not.toBe('window_2d');

        const lineM2Label: RawOrderLineInput = {
          line_number: 887,
          description: 'Vloerbedekking Breedte: 250 m²',
        };
        const resM2Label = engine.extractDimension(lineM2Label, '3.1');
        expect(resM2Label.dimensionSpec?.type).not.toBe('window_2d');
      });

      it('herkent aangesloten eenheden (200cm, 23cm, 4m¹, 2500cm) zonder fouten', () => {
        const line1: RawOrderLineInput = {
          line_number: 888,
          description: 'Rolgordijn 140x220cm',
        };
        const res1 = engine.extractDimension(line1, '2.1');
        expect(res1.dimensionSpec).toEqual({
          type: 'window_2d',
          widthMm: 1400,
          heightMm: 2200,
          areaM2: 3.08,
        });

        const line2: RawOrderLineInput = {
          line_number: 889,
          description: 'Gordijnrail 200cm',
        };
        const res2 = engine.extractDimension(line2, '1.2');
        expect(res2.dimensionSpec).toEqual({
          type: 'curtain_linear',
          widthMm: 2000,
          heightMm: undefined,
          pleatFactor: undefined,
        });
      });
    });

    describe('8.6 Safety Gate hasDimensionOutlier', () => {
      it('geeft true voor raambekleding met materiaalwoorden > 12000 mm', () => {
        const linePVC: RawOrderLineInput = {
          line_number: 92,
          description: 'Rolgordijn PVC 15000 mm',
        };
        expect(engine.hasDimensionOutlier(linePVC)).toBe(true);

        const lineVoering: RawOrderLineInput = {
          line_number: 93,
          description: 'Overgordijn met voeringstof 15000 mm',
        };
        expect(engine.hasDimensionOutlier(lineVoering)).toBe(true);

        const lineLinnen: RawOrderLineInput = {
          line_number: 890,
          description: 'Overgordijn linnen stof 15000 mm',
        };
        expect(engine.hasDimensionOutlier(lineLinnen)).toBe(true);

        const lineJaloezie: RawOrderLineInput = {
          line_number: 891,
          description: 'Kunststof jaloezie 15000 mm',
        };
        expect(engine.hasDimensionOutlier(lineJaloezie)).toBe(true);
      });

      it('geeft false voor echte verbruiksmetrages zoals plinten of bundels > 12000 mm', () => {
        const linePlint: RawOrderLineInput = {
          line_number: 94,
          description: 'Vloerplint 15000 mm',
        };
        expect(engine.hasDimensionOutlier(linePlint)).toBe(false);

        const lineBundle: RawOrderLineInput = {
          line_number: 95,
          description: 'Vloerplint 1 x 14.20mtr.',
        };
        expect(engine.hasDimensionOutlier(lineBundle)).toBe(false);

        const lineMarmoleum: RawOrderLineInput = {
          line_number: 892,
          description: 'Forbo Marmoleum Real',
          notes: '- 25,9 mtr',
        };
        expect(engine.hasDimensionOutlier(lineMarmoleum)).toBe(false);

        const lineStofBalia: RawOrderLineInput = {
          line_number: 893,
          description: 'Gordijnstof Balia 17,6 mtr',
        };
        expect(engine.hasDimensionOutlier(lineStofBalia)).toBe(false);

        const lineStofBaliaRail: RawOrderLineInput = {
          line_number: 894,
          description: 'Gordijnstof Balia op bestaande rail',
          notes: '- 17,6 mtr',
        };
        expect(engine.hasDimensionOutlier(lineStofBaliaRail)).toBe(false);

        const lineVitrageStof: RawOrderLineInput = {
          line_number: 895,
          description: 'Vitrage stof 17,6 mtr',
        };
        expect(engine.hasDimensionOutlier(lineVitrageStof)).toBe(false);

        const lineInbetweenStof: RawOrderLineInput = {
          line_number: 896,
          description: 'Inbetween stof 17,6 mtr',
        };
        expect(engine.hasDimensionOutlier(lineInbetweenStof)).toBe(false);

        const lineRailBundle: RawOrderLineInput = {
          line_number: 897,
          description: 'Gordijnrail 15 x 2.80 mtr',
        };
        expect(engine.hasDimensionOutlier(lineRailBundle)).toBe(false);
      });

      it('geeft true voor echte rail-uitschieters (> 12000 mm)', () => {
        const lineRailOutlier1: RawOrderLineInput = {
          line_number: 898,
          description: 'Gordijnrail 2 x 14.20 mtr',
        };
        expect(engine.hasDimensionOutlier(lineRailOutlier1)).toBe(true);

        const lineRailOutlier2: RawOrderLineInput = {
          line_number: 899,
          description: 'Gordijnrail DS wit',
          notes: '- 2 x 14.20 mtr',
        };
        expect(engine.hasDimensionOutlier(lineRailOutlier2)).toBe(true);

        const lineRailOutlier3: RawOrderLineInput = {
          line_number: 900,
          description: 'Gordijnrail 15 m1 incl. 100 stuks glijders',
        };
        expect(engine.hasDimensionOutlier(lineRailOutlier3)).toBe(true);
      });

      it('erft isHardWindowProduct over naar gesplitste notes regels', () => {
        const lineNotes: RawOrderLineInput = {
          line_number: 96,
          description: 'Rolgordijn verduisterend',
          notes: 'B: 15000 mm',
        };
        expect(engine.hasDimensionOutlier(lineNotes)).toBe(true);

        const lineNotes2: RawOrderLineInput = {
          line_number: 901,
          description: 'Rolgordijn',
          notes: '- 15 m1 PVC',
        };
        expect(engine.hasDimensionOutlier(lineNotes2)).toBe(true);
      });
    });
  });
});
