/**
 * tests/unit/matrix/matrix-pricing.test.ts
 *
 * Vitest tests voor de CPQ Pricing Engine en Zero Float Math garanties.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateDimensionPriceCents,
  calculateEtageTotalCents,
  calculateLineTotal,
  calculateOrderTotalCents,
  calculatePriceFromSpec,
  calculateRoomTotalCents,
  centsToEuroString,
  euroStringToCents,
  formatDimensionSpec,
  parseDimensions,
  parseDimensionSpec,
  resolveCellBaseRateCents,
  resolveCellPriceCents,
  STAIRS_SURCHARGES,
  validateDimensions,
} from '../../../src/utils/matrix-pricing';
import { DimensionSpec, Etage, MatrixOrder, MatrixProduct, Room } from '../../../src/types/matrix';

describe('CPQ Pricing Engine & Zero Float Math (Unit Tests)', () => {
  describe('TC-CPQ-01: Locale-Aware Valuta Parsing (euroStringToCents)', () => {
    it('parseert duizendtallen-bedragen met punten en komma correct naar centen', () => {
      expect(euroStringToCents('€ 1.250,00')).toBe(125000);
      expect(euroStringToCents('€ 2.380,74')).toBe(238074);
      expect(euroStringToCents('€ 19.250,00')).toBe(1925000);
    });

    it('parseert bedragen met trailing dash (,- of .-) als hele euro bedragen', () => {
      expect(euroStringToCents('€ 1.250,-')).toBe(125000);
      expect(euroStringToCents('€ 50,-')).toBe(5000);
    });

    it('parseert nul- en kleine bedragen correct', () => {
      expect(euroStringToCents('€ 0,00')).toBe(0);
      expect(euroStringToCents('0')).toBe(0);
      expect(euroStringToCents('')).toBe(0);
      expect(euroStringToCents(null)).toBe(0);
      expect(euroStringToCents(undefined)).toBe(0);
      expect(euroStringToCents('€ 913,65')).toBe(91365);
      expect(euroStringToCents('895,22')).toBe(89522);
    });

    it('formateert centen terug naar formele Nederlandse valutatekst (centsToEuroString)', () => {
      expect(centsToEuroString(125000)).toBe('€ 1.250,00');
      expect(centsToEuroString(238074)).toBe('€ 2.380,74');
      expect(centsToEuroString(0)).toBe('€ 0,00');
      expect(centsToEuroString(89522)).toBe('€ 895,22');
      expect(centsToEuroString(1925000)).toBe('€ 19.250,00');
    });
  });

  describe('TC-CPQ-02: Lineaire Stepper Herberekening (calculateLineTotal)', () => {
    it('berekent regelprijs strikt lineair over invariante basis-stuksprijs', () => {
      const unitPriceCents = 65000; // € 650,00
      expect(calculateLineTotal(1, unitPriceCents)).toBe(65000);
      expect(calculateLineTotal(2, unitPriceCents)).toBe(130000);
      expect(calculateLineTotal(3, unitPriceCents)).toBe(195000);
      expect(calculateLineTotal(5, unitPriceCents)).toBe(325000);
    });

    it('past defensieve clamping toe bij 0 of negatieve aantallen', () => {
      const unitPriceCents = 89522;
      expect(calculateLineTotal(0, unitPriceCents)).toBe(0);
      expect(calculateLineTotal(-1, unitPriceCents)).toBe(0);
      expect(calculateLineTotal(2, -500)).toBe(0);
    });
  });

  describe('TC-CPQ-03: Hiërarchische CPQ Sommatie (Cel -> Ruimte -> Etage -> Order)', () => {
    const mockRoom: Room = {
      id: 'room-woonkamer',
      name: 'Woonkamer',
      clusters: [],
      positions: [
        { id: 'pos-1', name: 'Raam Links', type: 'Raam' },
        { id: 'pos-2', name: 'Raam Rechts', type: 'Raam' },
      ],
    };

    const mockEtage: Etage = {
      id: 'etage-bg',
      name: 'BEGANE GROND',
      rooms: [mockRoom],
    };

    const mockProducts: MatrixProduct[] = [
      {
        id: 'prod-duette',
        code: 'A000866057',
        name: 'GIW Duette®',
        category: 'Raambekleding',
        unit: 'stuks',
        posPrices: {
          'pos-1': {
            quantity: 1,
            unit: 'st',
            unitPriceCents: 89522,
            totalPriceCents: 89522,
          },
          'pos-2': {
            quantity: 2,
            unit: 'st',
            unitPriceCents: 89522,
            totalPriceCents: 179044,
          },
        },
      },
      {
        id: 'prod-inmeet',
        code: 'A00034988',
        name: 'Inmeetservice',
        category: 'Dienst / Service',
        unit: 'keer',
        posPrices: {
          'pos-1': {
            quantity: 1,
            unitPriceCents: 0,
            totalPriceCents: 0,
            isInbegrepen: true,
          },
          'pos-gen': {
            quantity: 1,
            unitPriceCents: 5000,
            totalPriceCents: 5000, // € 50,00 op algemeen
          },
        },
      },
    ];

    it('resolvet celprijzen en negeert inbegrepen diensten in sommaties', () => {
      const normalCell = mockProducts[0].posPrices['pos-1'];
      const inbegrepenCell = mockProducts[1].posPrices['pos-1'];

      expect(resolveCellPriceCents(normalCell)).toBe(89522);
      expect(resolveCellPriceCents(inbegrepenCell)).toBe(0);
    });

    it('berekent het ruimtetotaal exact als de som van geldige cellen', () => {
      // pos-1 (89522) + pos-2 (179044) = 268566
      const roomTotal = calculateRoomTotalCents(mockRoom, mockProducts);
      expect(roomTotal).toBe(268566);
    });

    it('berekent het etagetotaal exact als de som van ruimtes', () => {
      const etageTotal = calculateEtageTotalCents(mockEtage, mockProducts);
      expect(etageTotal).toBe(268566);
    });

    it('berekent het complete ordertotaal inclusief algemene posten via pos-gen', () => {
      const order: MatrixOrder = {
        id: 'V26001376',
        klant: 'Jaspers',
        plaats: 'Maastricht',
        offerte: 'O26000865',
        orderdatum: '07 aug 2026',
        status: 'Definitief',
        fsmPhase: '5. Bestellen (Actueel)',
        fsmStep: 5,
        verkoper: 'Carlo Heinemans',
        filiaal: 'Winkel GSW BV',
        totaalbedragCents: 273566, // 268566 + 5000
        etages: [mockEtage],
        products: mockProducts,
      };

      // 268566 (etage) + 5000 (pos-gen) = 273566
      const orderTotal = calculateOrderTotalCents(order);
      expect(orderTotal).toBe(273566);
      expect(centsToEuroString(orderTotal)).toBe('€ 2.735,66');
    });
  });

  describe('TC-CPQ-04: Dimensionele Prijsberekening & Grenzen (calculateDimensionPriceCents)', () => {
    it('berekent m² prijzen in integer centen met zero float math', () => {
      // 1100mm x 2240mm = 2.464 m²; tarief = € 100,00 (10000 cent)
      // (1100 * 2240 * 10000) / 1.000.000 = 24640 cent (€ 246,40)
      const price = calculateDimensionPriceCents(1100, 2240, 10000, 'm2');
      expect(price).toBe(24640);
    });

    it('berekent strekkende meter prijzen op breedte (m1_width)', () => {
      // 4800mm breedte; tarief = € 25,00 (2500 cent)
      // (4800 * 2500) / 1.000 = 12000 cent (€ 120,00)
      const price = calculateDimensionPriceCents(4800, undefined, 2500, 'm1_width');
      expect(price).toBe(12000);
    });

    it('geeft vaste stukprijs bij unit modus of nul-afmetingen', () => {
      expect(calculateDimensionPriceCents(1000, 1000, 89522, 'unit')).toBe(89522);
      expect(calculateDimensionPriceCents(0, 0, 89522, 'm2')).toBe(89522);
    });

    it('parseert dimensies robuust met unicode en ascii vermenigvuldigingstekens', () => {
      expect(parseDimensions('1100 × 2240')).toEqual({ widthMm: 1100, heightMm: 2240 });
      expect(parseDimensions('1100x2240')).toEqual({ widthMm: 1100, heightMm: 2240 });
      expect(parseDimensions('Breedte 4800')).toEqual({ widthMm: 4800 });
      expect(parseDimensions(undefined)).toEqual({});
    });

    it('valideert catalogusgrenzen correct', () => {
      const limits = { minWidth: 500, maxWidth: 3000, minHeight: 600, maxHeight: 3500 };
      expect(validateDimensions(1100, 2240, limits).valid).toBe(true);
      expect(validateDimensions(400, 2240, limits).valid).toBe(false);
      expect(validateDimensions(1100, 4000, limits).valid).toBe(false);
    });
  });

  describe('TC-CPQ-05: Compound Key Aggregatie & Harmonizatie in Sommaties', () => {
    it('normaliseert compound keys (posId__subPos) correct in calculateRoomTotalCents', () => {
      const room: Room = {
        id: 'room-wk',
        name: 'Woonkamer',
        clusters: [],
        positions: [{ id: 'pos_pui', name: 'Schuifpui', type: 'Pui' }],
      };

      const products: MatrixProduct[] = [
        {
          id: 'prod-gordijn',
          code: 'G01',
          name: 'Gordijn',
          category: 'Gordijnen',
          unit: 'st',
          posPrices: {
            'pos_pui__a': { quantity: 1, unitPriceCents: 125000, totalPriceCents: 125000 },
          },
        },
        {
          id: 'prod-rail',
          code: 'R01',
          name: 'Rail',
          category: 'Gordijnen',
          unit: 'st',
          posPrices: {
            'pos_pui__b': { quantity: 1, unitPriceCents: 45000, totalPriceCents: 45000 },
          },
        },
      ];

      // Beide subposities moeten geteld worden op 'pos_pui': 125000 + 45000 = 170000 cent
      const total = calculateRoomTotalCents(room, products);
      expect(total).toBe(170000);
    });

    it('telt algemene posten onder pos_project_algemeen correct mee in calculateOrderTotalCents', () => {
      const etage: Etage = {
        id: 'et-1',
        name: 'BG',
        rooms: [],
      };

      const order: MatrixOrder = {
        id: 'V26001761',
        klant: 'DrHaack',
        plaats: 'Maastricht',
        offerte: 'O1',
        orderdatum: '01 jan 2026',
        status: 'Definitief',
        fsmPhase: '5. Bestellen',
        fsmStep: 5,
        verkoper: 'Carlo',
        filiaal: 'GSW',
        totaalbedragCents: 110000,
        etages: [etage],
        products: [
          {
            id: 'p-montage',
            code: 'M01',
            name: 'Montagekosten',
            category: 'Dienst',
            unit: 'post',
            posPrices: {
              'pos_project_algemeen': { quantity: 1, unitPriceCents: 110000, totalPriceCents: 110000 },
            },
          },
        ],
      };

      const total = calculateOrderTotalCents(order);
      expect(total).toBe(110000);
      expect(centsToEuroString(total)).toBe('€ 1.100,00');
    });
  });

  describe('TC-CPQ-06: Polymorphic Dimension Spec & Bijective CPQ Inversion', () => {
    describe('parseDimensionSpec', () => {
      it('parseert trappen: renovatie, stoffering en lopers met opties', () => {
        // 13 treden renovatie dicht + LED
        const spec1 = parseDimensionSpec('13 treden (dicht + LED)', 'Traprenovatie');
        expect(spec1.type).toBe('stairs');
        if (spec1.type === 'stairs') {
          expect(spec1.stepsCount).toBe(13);
          expect(spec1.stairType).toBe('renovatie');
          expect(spec1.hasRisers).toBe(true);
          expect(spec1.isOpen).toBe(false);
          expect(spec1.ledLighting).toBe(true);
        }

        // 14 treden stoffering open (Order V26000925)
        const spec2 = parseDimensionSpec('14 treden open', 'Trapstoffering');
        expect(spec2.type).toBe('stairs');
        if (spec2.type === 'stairs') {
          expect(spec2.stepsCount).toBe(14);
          expect(spec2.stairType).toBe('stoffering');
          expect(spec2.isOpen).toBe(true);
          expect(spec2.hasRisers).toBe(false);
        }

        // 15 treden traploper met bandering
        const spec3 = parseDimensionSpec('15 treden loper gebandeerd', 'Trappen');
        expect(spec3.type).toBe('stairs');
        if (spec3.type === 'stairs') {
          expect(spec3.stepsCount).toBe(15);
          expect(spec3.stairType).toBe('loper');
          expect(spec3.bandering).toBe(true);
        }
      });

      it('parseert vloeren met netto oppervlakte en percentage snijverlies', () => {
        const spec = parseDimensionSpec('24,5 m2 (+10% snijverlies)', 'Vloeren');
        expect(spec.type).toBe('floor_area');
        if (spec.type === 'floor_area') {
          expect(spec.netAreaM2).toBe(24.5);
          expect(spec.wastePercentage).toBe(10);
          expect(spec.grossAreaM2).toBe(26.95);
        }
      });

      it('parseert gordijnen en raambekleding met 2D of lineaire breedte', () => {
        const spec2D = parseDimensionSpec('2400 x 1800', 'Gordijnen');
        expect(spec2D.type).toBe('curtain_linear');
        if (spec2D.type === 'curtain_linear') {
          expect(spec2D.widthMm).toBe(2400);
          expect(spec2D.heightMm).toBe(1800);
        }

        const specLinear = parseDimensionSpec('3200 mm', 'Gordijnen');
        expect(specLinear.type).toBe('curtain_linear');
        if (specLinear.type === 'curtain_linear') {
          expect(specLinear.widthMm).toBe(3200);
        }
      });

      it('parseert standaard 2D ramen correct', () => {
        const spec = parseDimensionSpec('1200 x 1600', 'Raambekleding');
        expect(spec.type).toBe('window_2d');
        if (spec.type === 'window_2d') {
          expect(spec.widthMm).toBe(1200);
          expect(spec.heightMm).toBe(1600);
          expect(spec.areaM2).toBe(1.92);
        }
      });

      it('valt veilig terug op piece_service bij diensten of onbekend', () => {
        const spec = parseDimensionSpec('1 post montage', 'Diensten');
        expect(spec.type).toBe('piece_service');
      });
    });

    describe('calculatePriceFromSpec & resolveCellBaseRateCents (Bijectiviteit)', () => {
      it('berekent trappenprijs exact en inverteert basis tarief zuiver (renovatie dicht + LED)', () => {
        // 13 treden renovatie dicht + LED: baseRate € 75,00/trede
        // Surcharges per trede: risers € 15,00 + LED € 10,00 = € 25,00
        // Totale trede-prijs: € 100,00. Totaal voor 13 treden: 13 * € 100,00 = € 1.300,00 (130000 cent)
        const spec: DimensionSpec = {
          type: 'stairs',
          stepsCount: 13,
          stairType: 'renovatie',
          isOpen: false,
          hasRisers: true,
          ledLighting: true,
        };
        const baseRateCents = 7500;
        const totalCents = calculatePriceFromSpec(spec, baseRateCents);
        expect(totalCents).toBe(130000);

        // Tariefomkering:
        const invertedRate = resolveCellBaseRateCents(
          { quantity: 1, unitPriceCents: totalCents, totalPriceCents: totalCents },
          spec
        );
        expect(invertedRate).toBe(baseRateCents);
      });

      it('berekent trappenprijs exact voor open trap stoffering (Order V26000925)', () => {
        // 14 treden open trap stoffering: baseRate € 40,50/trede, openTrap opslag € 8,00/trede
        // Totale trede-prijs: € 48,50. Totaal voor 14 treden: 14 * € 48,50 = € 679,00 (67900 cent)
        const spec: DimensionSpec = {
          type: 'stairs',
          stepsCount: 14,
          stairType: 'stoffering',
          isOpen: true,
          hasRisers: false,
        };
        const baseRateCents = 4050;
        const totalCents = calculatePriceFromSpec(spec, baseRateCents);
        expect(totalCents).toBe(67900);

        const invertedRate = resolveCellBaseRateCents(
          { quantity: 1, unitPriceCents: totalCents, totalPriceCents: totalCents },
          spec
        );
        expect(invertedRate).toBe(baseRateCents);
      });

      it('berekent vloerenprijs inclusief snijverlies en inverteert basistarief m2', () => {
        // Netto 24.5 m2 + 10% snijverlies = 26.95 m2 bruto
        // Base rate: € 45,00/m2 (4500 cent)
        // Totaal: Math.round(26.95 * 4500) = 121275 cent (€ 1.212,75)
        const spec: DimensionSpec = {
          type: 'floor_area',
          netAreaM2: 24.5,
          wastePercentage: 10,
          grossAreaM2: 26.95,
        };
        const baseRateCents = 4500;
        const totalCents = calculatePriceFromSpec(spec, baseRateCents);
        expect(totalCents).toBe(121275);

        const invertedRate = resolveCellBaseRateCents(
          { quantity: 1, unitPriceCents: totalCents, totalPriceCents: totalCents },
          spec
        );
        expect(invertedRate).toBe(baseRateCents);
      });

      it('beschermt tegen deling door nul bij ongeldige of 0-dimensies', () => {
        const specStairsZero: DimensionSpec = { type: 'stairs', stepsCount: 0, stairType: 'renovatie' };
        expect(resolveCellBaseRateCents({ quantity: 1, unitPriceCents: 5000, totalPriceCents: 5000 }, specStairsZero)).toBe(5000);

        const specFloorZero: DimensionSpec = { type: 'floor_area', netAreaM2: 0, wastePercentage: 0, grossAreaM2: 0 };
        expect(resolveCellBaseRateCents({ quantity: 1, unitPriceCents: 5000, totalPriceCents: 5000 }, specFloorZero)).toBe(5000);

        const specCurtainZero: DimensionSpec = { type: 'curtain_linear', widthMm: 0 };
        expect(resolveCellBaseRateCents({ quantity: 1, unitPriceCents: 5000, totalPriceCents: 5000 }, specCurtainZero)).toBe(5000);

        const specWindowZero: DimensionSpec = { type: 'window_2d', widthMm: 0, heightMm: 1000 };
        expect(resolveCellBaseRateCents({ quantity: 1, unitPriceCents: 5000, totalPriceCents: 5000 }, specWindowZero)).toBe(5000);
      });
    });

    describe('formatDimensionSpec', () => {
      it('formatteert trappen spec met alle actieve opties', () => {
        const spec: DimensionSpec = {
          type: 'stairs',
          stepsCount: 13,
          stairType: 'renovatie',
          isOpen: false,
          hasRisers: true,
          ledLighting: true,
        };
        expect(formatDimensionSpec(spec)).toBe('13 treden (dicht + LED)');

        const specOpen: DimensionSpec = {
          type: 'stairs',
          stepsCount: 14,
          stairType: 'stoffering',
          isOpen: true,
          hasRisers: false,
        };
        expect(formatDimensionSpec(specOpen)).toBe('14 treden (open)');
      });

      it('formatteert vloeren spec met snijverlies', () => {
        const spec: DimensionSpec = {
          type: 'floor_area',
          netAreaM2: 24.5,
          wastePercentage: 10,
          grossAreaM2: 26.95,
        };
        expect(formatDimensionSpec(spec)).toBe('24,5 m² (+10% snijverlies)');
      });
    });
  });
});
