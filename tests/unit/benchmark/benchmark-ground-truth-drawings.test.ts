import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { BenchmarkRecord130, TypologyCategory130 } from '@/domain/benchmark/floorplanner-types';
import { PolygonSimilarityEngine } from '@/domain/geometry/polygon-similarity-engine';
import { FrontDoorDetector } from '@/domain/geometry/front-door-detector';
import { computeFloorGeometry } from '@/domain/legacy/floor-geometry-calculator';

describe('Canonieke 130-Panden Ground Truth Referentietest (Floorplanner FML)', () => {
  const fixturePath = path.resolve(__dirname, '../../../tests/fixtures/benchmark-ground-truth-130.json');
  let records: BenchmarkRecord130[] = [];

  beforeAll(() => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    const raw = fs.readFileSync(fixturePath, 'utf8');
    records = JSON.parse(raw);
  });

  describe('1. Dataset Integriteit & MECE Verdeling (130 Panden)', () => {
    it('moet exact 130 unieke referentiepanden bevatten', () => {
      expect(records).toHaveLength(130);
      const uniqueIds = new Set(records.map((r) => r.id));
      expect(uniqueIds.size).toBe(130);
      const uniqueProjects = new Set(records.map((r) => r.project_id));
      expect(uniqueProjects.size).toBe(130);
    });

    it('moet de strikte MECE typologische verdeling respecteren (35/25/25/20/15/10)', () => {
      const counts: Record<TypologyCategory130, number> = {
        tussenwoning: 0,
        hoekwoning: 0,
        twee_onder_een_kap: 0,
        vrijstaand: 0,
        appartement: 0,
        samengesteld: 0,
      };

      for (const r of records) {
        counts[r.typology] = (counts[r.typology] || 0) + 1;
      }

      expect(counts.tussenwoning).toBe(35);
      expect(counts.hoekwoning).toBe(25);
      expect(counts.twee_onder_een_kap).toBe(25);
      expect(counts.vrijstaand).toBe(20);
      expect(counts.appartement).toBe(15);
      expect(counts.samengesteld).toBe(10);
    });

    it('moet geverifieerde inmeters en Floorplanner source URLs bevatten', () => {
      for (const r of records) {
        expect(r.meta.source_url).toContain(`https://floorplanner.com/projects/${r.project_id}`);
        expect(r.meta.inmeter).toBeTruthy();
        expect(r.meta.verified_at).toBeTruthy();
        expect(r.address.city).toBeTruthy();
        expect(r.address.street).toBeTruthy();
        expect(r.address.postalCode).toMatch(/^[1-9][0-9]{3}[A-Z]{2}$/);
      }
    });

    it('moet Singel 13 Bussum (BM-FP-001) met project 21000075 correct registreren', () => {
      const singel13 = records.find((r) => r.id === 'BM-FP-001');
      expect(singel13).toBeDefined();
      expect(singel13!.project_id).toBe(21000075);
      expect(singel13!.address.city).toBe('Bussum');
      expect(singel13!.address.street).toBe('Singel');
      expect(singel13!.address.houseNumber).toBe('13');
      expect(singel13!.ground_truth_floors).toHaveLength(2);
      expect(singel13!.ground_truth_floors[0].measuredGrossAreaM2).toBeCloseTo(37.16, 1);
    });

    it('moet voor alle 130 panden een geverifieerde NEN 2580 oppervlakte en Funda URL bevatten (INV-REF-02)', () => {
      for (const r of records) {
        expect(r.meta.funda_url).toMatch(/^https:\/\/www\.funda\.nl\/detail\/koop\//);
        expect(r.meta.fml_validation_status).toBe('VALIDATED_NEN2580');
        expect(r.meta.bag_vbo_oppervlakte).toBeGreaterThan(0);
        expect(r.meta.fml_oppervlakte).toBeGreaterThan(0);
      }
    });

    it('moet strikte bipartiete isolatie handhaven: telemetry_input bevat géén grondwaarheid', () => {
      for (const r of records) {
        const telemetry = r.telemetry_input as any;
        expect(telemetry.ground_truth_floors).toBeUndefined();
        expect(telemetry.groundTruth).toBeUndefined();
        expect(telemetry.floors).toBeUndefined();
        expect(telemetry.outerPolygonM).toBeUndefined();
      }
    });
  });

  describe('2. Dubbelblinde Geometrische Referentietest (Vitest < 1s)', () => {
    it('moet voor alle 130 panden een gesloten buitenschil genereren die matcht met FML', () => {
      let totalFloorsTested = 0;
      let passedFloors = 0;

      for (const b of records) {
        let footprintCoords: Array<[number, number]> = b.telemetry_input.bagFootprint2D;
        if (
          footprintCoords.length > 1 &&
          footprintCoords[0][0] === footprintCoords[footprintCoords.length - 1][0] &&
          footprintCoords[0][1] === footprintCoords[footprintCoords.length - 1][1]
        ) {
          footprintCoords = footprintCoords.slice(0, -1);
        }

        const basePoints = footprintCoords.map(([x, y]) => ({ x, y }));
        const frontWallRes = FrontDoorDetector.detectFrontWall({
          footprintCoords: b.telemetry_input.bagFootprint2D,
          vboEntrancePoint: b.telemetry_input.vboEntrancePoint,
        });

        for (const floor of b.ground_truth_floors) {
          totalFloorsTested++;

          const calculatedPoints = computeFloorGeometry(
            basePoints,
            frontWallRes.frontWallIndex,
            floor.level,
            b.telemetry_input.oppervlakteVboM2,
            0.28,
            { vboEntrancePoint: b.telemetry_input.vboEntrancePoint }
          );

          const calcCoords: Array<[number, number]> = calculatedPoints.map((p) => [p.x, p.y]);
          const gtCoords: Array<[number, number]> = floor.outerPolygonM;

          const sim = PolygonSimilarityEngine.calculateRotationInvariantSimilarity(
            calcCoords,
            gtCoords,
            0.95,
            0.20
          );

          expect(sim.passed).toBe(true);
          expect(sim.iou).toBeGreaterThanOrEqual(0.95);
          expect(sim.hausdorffDistanceM).toBeLessThanOrEqual(0.20);
          expect(sim.relativeAreaDeltaPct).toBeLessThanOrEqual(5.0);

          if (sim.passed) {
            passedFloors++;
          }
        }
      }

      expect(passedFloors).toBe(totalFloorsTested);
      expect(totalFloorsTested).toBeGreaterThanOrEqual(260);
    });
  });

  describe('3. Benchmark Aggregatie & Typologie Matrix Rapport', () => {
    it('moet 100% slaagpercentage en IoU >= 0.95 rapporteren over alle 6 typologieën', () => {
      const resultsByTypology: Record<
        string,
        { count: number; passed: number; sumIoU: number; sumHausdorff: number }
      > = {};

      for (const b of records) {
        const typ = b.typology;
        if (!resultsByTypology[typ]) {
          resultsByTypology[typ] = { count: 0, passed: 0, sumIoU: 0, sumHausdorff: 0 };
        }

        let footprintCoords: Array<[number, number]> = b.telemetry_input.bagFootprint2D;
        if (
          footprintCoords.length > 1 &&
          footprintCoords[0][0] === footprintCoords[footprintCoords.length - 1][0] &&
          footprintCoords[0][1] === footprintCoords[footprintCoords.length - 1][1]
        ) {
          footprintCoords = footprintCoords.slice(0, -1);
        }

        const basePoints = footprintCoords.map(([x, y]) => ({ x, y }));
        const frontWallRes = FrontDoorDetector.detectFrontWall({
          footprintCoords: b.telemetry_input.bagFootprint2D,
          vboEntrancePoint: b.telemetry_input.vboEntrancePoint,
        });

        for (const floor of b.ground_truth_floors) {
          resultsByTypology[typ].count++;

          const calculatedPoints = computeFloorGeometry(
            basePoints,
            frontWallRes.frontWallIndex,
            floor.level,
            b.telemetry_input.oppervlakteVboM2,
            0.28,
            { vboEntrancePoint: b.telemetry_input.vboEntrancePoint }
          );

          const calcCoords: Array<[number, number]> = calculatedPoints.map((p) => [p.x, p.y]);
          const gtCoords: Array<[number, number]> = floor.outerPolygonM;

          const sim = PolygonSimilarityEngine.calculateRotationInvariantSimilarity(
            calcCoords,
            gtCoords
          );
          resultsByTypology[typ].sumIoU += sim.iou;
          resultsByTypology[typ].sumHausdorff += sim.hausdorffDistanceM;

          if (sim.passed) {
            resultsByTypology[typ].passed++;
          }
        }
      }

      // Check each typology has 100% pass rate and mean IoU >= 0.95
      for (const [typ, data] of Object.entries(resultsByTypology)) {
        const meanIoU = data.sumIoU / data.count;
        const passRate = (data.passed / data.count) * 100;
        expect(passRate).toBe(100);
        expect(meanIoU).toBeGreaterThanOrEqual(0.95);
      }
    });
  });
});
