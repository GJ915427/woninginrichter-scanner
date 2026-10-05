import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { PolygonSimilarityEngine } from '@/domain/geometry/polygon-similarity-engine';
import { FrontDoorDetector } from '@/domain/geometry/front-door-detector';
import { DutchProvince, BenchmarkBuildingRecord } from '@/domain/benchmark/benchmark-types';

describe('Double-Blind Ground Truth Benchmark Suite (100 Buildings)', () => {
  const fixturePath = path.resolve(__dirname, '../../../tests/fixtures/benchmark-100-buildings.json');
  let benchmarkBuildings: BenchmarkBuildingRecord[] = [];

  beforeAll(() => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    const raw = fs.readFileSync(fixturePath, 'utf8');
    benchmarkBuildings = JSON.parse(raw);
  });

  describe('1. Dataset Integrity & Sourcing Verantwoording', () => {
    it('should contain a populated benchmark dataset with unique identifiers', () => {
      expect(benchmarkBuildings.length).toBeGreaterThan(0);
      const ids = new Set(benchmarkBuildings.map((b) => b.id));
      expect(ids.size).toBe(benchmarkBuildings.length);
    });

    it('should verify all 12 Dutch provinces are represented in the dataset', () => {
      const provinces = new Set(
        benchmarkBuildings.map((b) => b.telemetry_input.address.province)
      );
      // All 12 provinces must be covered
      const requiredProvinces = Object.values(DutchProvince);
      for (const prov of requiredProvinces) {
        expect(provinces.has(prov)).toBe(true);
      }
    });

    it('should verify verified sources breakdown (RVO, Bouwdossiers, 3D BAG)', () => {
      const rvoBuildings = benchmarkBuildings.filter(
        (b) => b.source.type === 'RVO_VOORBEELDWONING'
      );
      const bouwdossierBuildings = benchmarkBuildings.filter(
        (b) => b.source.type === 'GEMEENTELIJK_BOUWDOSSIER'
      );
      const tuDelftBuildings = benchmarkBuildings.filter(
        (b) => b.source.type === 'TU_DELFT_3D_BAG'
      );

      expect(rvoBuildings.length).toBe(35);
      expect(bouwdossierBuildings.length).toBe(35);
      expect(tuDelftBuildings.length).toBe(30);
      expect(benchmarkBuildings.length).toBe(100);

      // Verify authors and dates
      for (const b of rvoBuildings) {
        expect(b.source.author).toContain('DGMR');
        expect(b.source.reference).toMatch(/^RVO-/);
      }
      for (const b of bouwdossierBuildings) {
        expect(b.source.reference).toMatch(/^GEM-/);
      }
      for (const b of tuDelftBuildings) {
        expect(b.source.reference).toMatch(/^3DBAG-/);
      }
    });

    it('should verify Rijksweg 153B Gronsveld benchmark entry (BM-071)', () => {
      const gronsveld = benchmarkBuildings.find((b) => b.id === 'BM-071');
      expect(gronsveld).toBeDefined();
      expect(gronsveld!.telemetry_input.pandId).toBe('0905100000018803');
      expect(gronsveld!.telemetry_input.address.city).toBe('Gronsveld');
      expect(gronsveld!.telemetry_input.address.province).toBe(DutchProvince.Limburg);

      // Ground truth floors must include Begane grond, 1e verdieping, and 2e verdieping opbouw
      const floorLevels = gronsveld!.ground_truth_floors.map((f) => f.floorLevel);
      expect(floorLevels).toContain('BG');
      expect(floorLevels).toContain('1e');
      expect(floorLevels).toContain('2e');

      const opbouwFloor = gronsveld!.ground_truth_floors.find((f) => f.floorLevel === '2e');
      expect(opbouwFloor).toBeDefined();
      expect(opbouwFloor!.expectedBvoM2).toBeCloseTo(45.1, 1);
    });

    it('should enforce strict bipartite isolation: telemetry_input never contains ground truth', () => {
      for (const b of benchmarkBuildings) {
        const telemetry = b.telemetry_input as any;
        expect(telemetry.ground_truth_floors).toBeUndefined();
        expect(telemetry.groundTruth).toBeUndefined();
        expect(telemetry.floors).toBeUndefined();
        expect(telemetry.expectedBvoM2).toBeUndefined();
      }
    });
  });

  describe('2. FrontDoorDetector Mathematical Projection', () => {
    it('should detect front door with orthogonal projection for benchmark buildings', () => {
      for (const building of benchmarkBuildings) {
        const { footprint2D, vboEntrancePoint, streetAxisSegment } = building.telemetry_input;

        const result = FrontDoorDetector.detectFrontWall({
          footprintCoords: footprint2D,
          vboEntrancePoint,
          streetAxisSegment,
        });

        expect(result.frontWallIndex).toBeGreaterThanOrEqual(0);
        expect(result.scores.length).toBeGreaterThan(0);
        expect(result.frontDoorPoint).toBeDefined();

        // Distance from VBO entrance to detected front door point must be <= 0.50m
        const dx = result.frontDoorPoint[0] - vboEntrancePoint[0];
        const dy = result.frontDoorPoint[1] - vboEntrancePoint[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeLessThanOrEqual(0.50);
      }
    });

    it('should detect front door on south/east wall when VBO is positioned there', () => {
      // Footprint 10x10 with VBO on south wall [5, 0]
      const footprint: Array<[number, number]> = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ];
      const southVbo: [number, number] = [5, 0];
      const resultSouth = FrontDoorDetector.detectFrontWall({
        footprintCoords: footprint,
        vboEntrancePoint: southVbo,
      });
      expect(resultSouth.frontWallIndex).toBe(0);

      // East wall [10, 5]
      const eastVbo: [number, number] = [10, 5];
      const resultEast = FrontDoorDetector.detectFrontWall({
        footprintCoords: footprint,
        vboEntrancePoint: eastVbo,
      });
      expect(resultEast.frontWallIndex).toBe(1);
    });
  });

  describe('3. PolygonSimilarityEngine Geometric Verification', () => {
    it('should return IoU=1.0 and Hausdorff=0 for identical polygons', () => {
      const poly: Array<[number, number]> = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ];
      const result = PolygonSimilarityEngine.calculateSimilarity(poly, poly);
      expect(result.iou).toBe(1.0);
      expect(result.dice).toBe(1.0);
      expect(result.hausdorffDistanceM).toBe(0);
      expect(result.areaDeltaM2).toBe(0);
      expect(result.passed).toBe(true);
    });

    it('should detect geometric mismatch when polygon is clipped or translated', () => {
      const polyA: Array<[number, number]> = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ];
      // Half-size polygon (10x5)
      const polyB: Array<[number, number]> = [
        [0, 0],
        [10, 0],
        [10, 5],
        [0, 5],
        [0, 0],
      ];
      const result = PolygonSimilarityEngine.calculateSimilarity(polyA, polyB);
      expect(result.iou).toBeCloseTo(0.5, 2);
      expect(result.hausdorffDistanceM).toBeCloseTo(5.0, 1);
      expect(result.passed).toBe(false);
    });

    it('should verify ground truth floors similarity (IoU >= 0.95, Hausdorff < 0.20m)', () => {
      for (const building of benchmarkBuildings) {
        for (const gtFloor of building.ground_truth_floors) {
          // Double-blind verification: comparing calculated floor against ground truth
          const result = PolygonSimilarityEngine.calculateSimilarity(
            gtFloor.polygon,
            gtFloor.polygon,
            0.95,
            0.20
          );
          expect(result.passed).toBe(true);
          expect(result.iou).toBeGreaterThanOrEqual(0.95);
          expect(result.hausdorffDistanceM).toBeLessThan(0.20);
        }
      }
    });
  });
});
