import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LivePipelineEvaluator } from '@/domain/pipeline/live-pipeline-evaluator';
import { Polygon2D } from '@/domain/geometry/polygon';

describe('Live Pipeline Evaluator & Benchmark Integration (Sub-Fase 3B)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('VM-PIPE-05: Live Data Aggregation & Telemetry Conversion', () => {
    it('aggregates live open data into complete telemetry and computes floor plans', async () => {
      const mockBagClient = {
        getPandById: vi.fn().mockResolvedValue({
          identificatie: '0905100000018803',
          status: 'Pand in gebruik',
          bouwjaar: 1969,
          oppervlakte: 173,
          geometrieRD: Polygon2D.fromArray([
            [179400, 312870],
            [179406.62, 312870],
            [179406.62, 312888.51],
            [179403.83, 312888.51],
            [179403.83, 312878],
            [179400, 312878],
            [179400, 312870],
          ]),
          vboHrefs: ['https://api.pdok.nl/vbo-mock'],
        }),
        getVerblijfsobjectenForPand: vi.fn().mockResolvedValue([
          {
            id: '0905010000002118',
            rdCoordinates: [179403.31, 312870],
            huisnummer: 153,
            huisletter: 'B',
            postcode: '6247AD',
            woonplaats: 'Gronsveld',
            oppervlakte: 173,
            gebruiksdoel: 'woonfunctie',
            status: 'Verblijfsobject in gebruik',
          },
        ]),
      };

      const mockThreeDBagClient = {
        get3DModel: vi.fn().mockResolvedValue({
          pandId: '0905100000018803',
          vertices: [],
          surfaces: [],
          lod: '2.2',
          groundHeightNAP: 54.3,
          roofHeightNAP: 63.6,
          gutterHeightNAP: 60.1,
          roofType: 'samengesteld',
        }),
      };

      const mockDkkClient = {
        getPerceelForPoint: vi.fn().mockResolvedValue({
          id: 'perceel-639',
          kadastraleGemeente: 'Eijsden',
          sectie: 'F',
          perceelnummer: 639,
          grootteM2: 2163,
          polygonRD: [[179350, 312850], [179450, 312850], [179450, 312900], [179350, 312850]],
        }),
      };

      const mockAhnClient = {
        getGroundElevationPoint: vi.fn().mockResolvedValue({
          groundLevelNAP: 54.3,
          source: '3D_BAG',
        }),
      };

      const evaluator = new LivePipelineEvaluator({
        bagClient: mockBagClient as any,
        threeDBagClient: mockThreeDBagClient as any,
        dkkClient: mockDkkClient as any,
        ahnClient: mockAhnClient as any,
      });

      const result = await evaluator.evaluatePand('0905100000018803');

      expect(result).not.toBeNull();
      expect(result?.pandId).toBe('0905100000018803');
      expect(result?.telemetry.vboId).toBe('0905010000002118');
      expect(result?.telemetry.vboEntrancePoint).toEqual([179403.31, 312870]);
      expect(result?.telemetry.perceelnummer).toBe(639);
      expect(result?.telemetry.groundNapM).toBe(54.3);
      expect(result?.calculatedFloors).toHaveLength(3);
      expect(result?.calculatedFloors[0].name).toBe('Begane grond');
      expect(result?.calculatedFloors[1].name).toBe('1e verdieping');
    });
  });

  describe('VM-PIPE-07: Dynamic Ground Truth Comparison Engine', () => {
    it('compares calculated floors with Floorplanner ground truth using rotation-invariant IoU', () => {
      const evaluator = new LivePipelineEvaluator();

      const calculatedFloors = [
        {
          level: 0,
          name: 'Begane grond',
          polygon: [
            [0, 0],
            [6.62, 0],
            [6.62, 18.51],
            [3.83, 18.51],
            [3.83, 8],
            [0, 8],
            [0, 0],
          ] as Array<[number, number]>,
          areaM2: 85.0,
        },
        {
          level: 1,
          name: '1e verdieping',
          polygon: [
            [0, 0],
            [6.62, 0],
            [6.62, 8],
            [0, 8],
            [0, 0],
          ] as Array<[number, number]>,
          areaM2: 52.96,
        },
      ];

      const groundTruthFloors = [
        {
          level: 0,
          outerPolygonM: [
            [0, 0],
            [6.62, 0],
            [6.62, 18.51],
            [3.83, 18.51],
            [3.83, 8],
            [0, 8],
            [0, 0],
          ] as Array<[number, number]>,
          measuredGrossAreaM2: 85.0,
        },
        {
          level: 1,
          outerPolygonM: [
            [0, 0],
            [6.62, 0],
            [6.62, 8],
            [0, 8],
            [0, 0],
          ] as Array<[number, number]>,
          measuredGrossAreaM2: 52.96,
        },
      ];

      const comparison = evaluator.compareFloorsWithGroundTruth(calculatedFloors, groundTruthFloors);

      expect(comparison.overallMatch).toBe(true);
      expect(comparison.floorComparisons).toHaveLength(2);
      expect(comparison.floorComparisons[0].iou).toBeGreaterThanOrEqual(0.95);
      expect(comparison.floorComparisons[1].iou).toBeGreaterThanOrEqual(0.95);
      expect(comparison.floorComparisons[0].hausdorffDistanceM).toBeLessThanOrEqual(0.10);
    });

    it('correctly reports mismatch when floor geometry diverges significantly', () => {
      const evaluator = new LivePipelineEvaluator();

      const calculatedFloors = [
        {
          level: 1,
          name: '1e verdieping',
          polygon: [
            [0, 0],
            [3.0, 0],
            [3.0, 18.0],
            [0, 18.0],
            [0, 0],
          ] as Array<[number, number]>,
          areaM2: 54.0,
        },
      ];

      const groundTruthFloors = [
        {
          level: 1,
          outerPolygonM: [
            [0, 0],
            [6.62, 0],
            [6.62, 8.0],
            [0, 8.0],
            [0, 0],
          ] as Array<[number, number]>,
          measuredGrossAreaM2: 53.0,
        },
      ];

      const comparison = evaluator.compareFloorsWithGroundTruth(calculatedFloors, groundTruthFloors);

      expect(comparison.overallMatch).toBe(false);
      expect(comparison.floorComparisons[0].iou).toBeLessThan(0.85);
    });
  });
});
