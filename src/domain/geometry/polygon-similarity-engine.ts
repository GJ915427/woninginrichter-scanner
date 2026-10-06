import { Polygon2D } from './polygon';
import { Point2D } from './types';
import { PolygonClipping } from './clipping';
import { SimilarityResult } from '../benchmark/benchmark-types';

export interface RotationInvariantSimilarityResult extends SimilarityResult {
  bestRotationDeg: number;
}

export class PolygonSimilarityEngine {
  /**
   * Calculates rotation-invariant similarity between a calculated floor polygon and a ground-truth polygon.
   * Evaluates direct alignment as well as centroid-aligned rotations at 0°, 90°, 180°, and 270°.
   * Returns the best matching result along with the detected optimal rotation in degrees.
   */
  static calculateRotationInvariantSimilarity(
    calculatedCoords: Array<[number, number]>,
    groundTruthCoords: Array<[number, number]>,
    thresholdIoU: number = 0.95,
    thresholdHausdorffM: number = 0.20,
    rotationsDeg: number[] = [0, 90, 180, 270]
  ): RotationInvariantSimilarityResult {
    if (!calculatedCoords || calculatedCoords.length < 3 || !groundTruthCoords || groundTruthCoords.length < 3) {
      return {
        iou: 0,
        dice: 0,
        hausdorffDistanceM: Infinity,
        areaDeltaM2: Infinity,
        relativeAreaDeltaPct: 100,
        passed: false,
        bestRotationDeg: 0,
      };
    }

    // 1. Direct evaluation (no translation, 0° rotation)
    const directResult = this.calculateSimilarity(
      calculatedCoords,
      groundTruthCoords,
      thresholdIoU,
      thresholdHausdorffM
    );

    let bestResult: RotationInvariantSimilarityResult = {
      ...directResult,
      bestRotationDeg: 0,
    };

    if (bestResult.passed && bestResult.iou >= 0.99) {
      return bestResult;
    }

    // 2. Centroid-aligned evaluation across specified rotation angles
    const cCalc = this.computeCentroid(calculatedCoords);
    const cGt = this.computeCentroid(groundTruthCoords);

    const centeredCalc = calculatedCoords.map(
      ([x, y]) => [x - cCalc[0], y - cCalc[1]] as [number, number]
    );
    const centeredGt = groundTruthCoords.map(
      ([x, y]) => [x - cGt[0], y - cGt[1]] as [number, number]
    );

    for (const deg of rotationsDeg) {
      const rad = (deg * Math.PI) / 180;
      const cos = Math.round(Math.cos(rad) * 1e6) / 1e6;
      const sin = Math.round(Math.sin(rad) * 1e6) / 1e6;

      const rotatedCalc: Array<[number, number]> = centeredCalc.map(([x, y]) => [
        x * cos - y * sin,
        x * sin + y * cos,
      ]);

      const candidateResult = this.calculateSimilarity(
        rotatedCalc,
        centeredGt,
        thresholdIoU,
        thresholdHausdorffM
      );

      // Higher IoU wins; if IoUs are equal, lower Hausdorff distance wins
      if (
        candidateResult.iou > bestResult.iou ||
        (candidateResult.iou === bestResult.iou &&
          candidateResult.hausdorffDistanceM < bestResult.hausdorffDistanceM)
      ) {
        bestResult = {
          ...candidateResult,
          bestRotationDeg: deg,
        };
      }
    }

    return bestResult;
  }

  private static computeCentroid(coords: Array<[number, number]>): [number, number] {
    let pts = coords;
    if (
      pts.length > 1 &&
      pts[0][0] === pts[pts.length - 1][0] &&
      pts[0][1] === pts[pts.length - 1][1]
    ) {
      pts = pts.slice(0, pts.length - 1);
    }
    if (pts.length === 0) return [0, 0];
    let sumX = 0;
    let sumY = 0;
    for (const [x, y] of pts) {
      sumX += x;
      sumY += y;
    }
    return [sumX / pts.length, sumY / pts.length];
  }

  /**
   * Calculates similarity between a calculated floor polygon and a ground-truth polygon.
   * Computes IoU (Intersection over Union), Dice score, bidirectional Hausdorff distance, and relative area delta.
   */
  static calculateSimilarity(
    calculatedCoords: Array<[number, number]>,
    groundTruthCoords: Array<[number, number]>,
    thresholdIoU: number = 0.95,
    thresholdHausdorffM: number = 0.20
  ): SimilarityResult {
    if (!calculatedCoords || calculatedCoords.length < 3 || !groundTruthCoords || groundTruthCoords.length < 3) {
      return {
        iou: 0,
        dice: 0,
        hausdorffDistanceM: Infinity,
        areaDeltaM2: Infinity,
        relativeAreaDeltaPct: 100,
        passed: false,
      };
    }

    const calcPoints: Point2D[] = calculatedCoords.map(([x, y]) => ({ x, y }));
    const gtPoints: Point2D[] = groundTruthCoords.map(([x, y]) => ({ x, y }));

    const polyCalc = new Polygon2D(calcPoints);
    const polyGt = new Polygon2D(gtPoints);

    const areaCalc = Math.abs(polyCalc.area());
    const areaGt = Math.abs(polyGt.area());

    if (areaCalc === 0 && areaGt === 0) {
      return {
        iou: 1.0,
        dice: 1.0,
        hausdorffDistanceM: 0,
        areaDeltaM2: 0,
        relativeAreaDeltaPct: 0,
        passed: true,
      };
    }

    // Boolean operations via Martinez
    const intersectionPolys = PolygonClipping.intersection(polyCalc, polyGt);
    const unionPolys = PolygonClipping.union(polyCalc, polyGt);

    const areaIntersection = intersectionPolys.reduce((sum, p) => sum + Math.abs(p.area()), 0);
    const areaUnion = unionPolys.reduce((sum, p) => sum + Math.abs(p.area()), 0);

    const iou = areaUnion > 0 ? areaIntersection / areaUnion : 0;
    const dice = areaCalc + areaGt > 0 ? (2 * areaIntersection) / (areaCalc + areaGt) : 0;

    const areaDeltaM2 = Math.abs(areaCalc - areaGt);
    const relativeAreaDeltaPct = areaGt > 0 ? (areaDeltaM2 / areaGt) * 100 : 100;

    const hausdorffDistanceM = this.computeBidirectionalHausdorff(polyCalc, polyGt);

    const passed =
      iou >= thresholdIoU &&
      hausdorffDistanceM <= thresholdHausdorffM &&
      relativeAreaDeltaPct <= 5.0;

    return {
      iou: Number(iou.toFixed(4)),
      dice: Number(dice.toFixed(4)),
      hausdorffDistanceM: Number(hausdorffDistanceM.toFixed(4)),
      areaDeltaM2: Number(areaDeltaM2.toFixed(3)),
      relativeAreaDeltaPct: Number(relativeAreaDeltaPct.toFixed(2)),
      passed,
    };
  }

  /**
   * Computes the bidirectional Hausdorff distance between two polygons.
   * max( directedHausdorff(A, B), directedHausdorff(B, A) )
   */
  static computeBidirectionalHausdorff(polyA: Polygon2D, polyB: Polygon2D): number {
    const hAB = this.computeDirectedHausdorff(polyA, polyB);
    const hBA = this.computeDirectedHausdorff(polyB, polyA);
    return Math.max(hAB, hBA);
  }

  private static computeDirectedHausdorff(sourcePoly: Polygon2D, targetPoly: Polygon2D): number {
    const sourceVertices = sourcePoly.vertices;
    const targetSegments = targetPoly.edges;

    let maxDist = 0;

    for (const pt of sourceVertices) {
      let minDistToBoundary = Infinity;
      for (const seg of targetSegments) {
        const dist = this.pointToSegmentDistance(pt, seg.p1, seg.p2);
        if (dist < minDistToBoundary) {
          minDistToBoundary = dist;
        }
      }
      if (minDistToBoundary > maxDist) {
        maxDist = minDistToBoundary;
      }
    }

    return maxDist;
  }

  private static pointToSegmentDistance(p: Point2D, a: Point2D, b: Point2D): number {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const lenSq = vx * vx + vy * vy;

    if (lenSq === 0) {
      const dx = p.x - a.x;
      const dy = p.y - a.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    const ux = p.x - a.x;
    const uy = p.y - a.y;
    const t = Math.max(0, Math.min(1, (ux * vx + uy * vy) / lenSq));

    const projX = a.x + t * vx;
    const projY = a.y + t * vy;

    const dx = p.x - projX;
    const dy = p.y - projY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
