import { Point2D, Segment2D } from '../geometry/types';
import { Vector2D } from '../geometry/vector';
import { Polygon2D } from '../geometry/polygon';
import { PartyWallSegment, PartyWallClassification } from './types';

export interface NeighborBuilding {
  id: string;
  polygon: Polygon2D;
  status?: string; // e.g. "Pand in gebruik"
}

export interface PartyWallDetectionOptions {
  maxDistanceMeters?: number; // default 0.15m (epsilon buffer for cavity wall / tolerance)
  maxAngleDegrees?: number;   // default 6.0 degrees (cos(6°) ≈ 0.9945)
  minSharedLength?: number;   // default 0.10m
  fullWallThreshold?: number; // default 0.85 (85% coverage = full party wall)
}

export class PartyWallDetector {
  /**
   * Tests a single target segment AB against a single neighbor segment CD.
   */
  static testSegmentPair(
    pA: Point2D,
    pB: Point2D,
    pC: Point2D,
    pD: Point2D,
    options: PartyWallDetectionOptions = {}
  ): {
    overlapInterval: [number, number];
    sharedLengthMeters: number;
    classification: PartyWallClassification;
  } | null {
    const maxDist = options.maxDistanceMeters ?? 0.15;
    const maxAngleDeg = options.maxAngleDegrees ?? 6.0;
    const minShared = options.minSharedLength ?? 0.10;
    const fullThreshold = options.fullWallThreshold ?? 0.85;

    const vAB = Vector2D.fromPoints(pA, pB);
    const lenAB = vAB.length();
    if (lenAB < 0.05) return null;

    const uAB = vAB.scale(1 / lenAB);
    // Perpendicular normal to AB
    const nAB = new Vector2D(-uAB.y, uAB.x);

    const vCD = Vector2D.fromPoints(pC, pD);
    const lenCD = vCD.length();
    if (lenCD < 0.05) return null;

    const uCD = vCD.scale(1 / lenCD);

    // 1. Directional Collinearity Check
    const dotAlign = Math.abs(uAB.dot(uCD));
    const minDot = Math.cos((maxAngleDeg * Math.PI) / 180);
    if (dotAlign < minDot) {
      return null;
    }

    // 2. Normal Distance Check (Epsilon Buffer)
    const vAC = Vector2D.fromPoints(pA, pC);
    const vAD = Vector2D.fromPoints(pA, pD);
    const distC = Math.abs(vAC.dot(nAB));
    const distD = Math.abs(vAD.dot(nAB));

    if (distC > maxDist || distD > maxDist) {
      return null;
    }

    // 3. 1D Scalar Interval Projection
    const tC = vAC.dot(uAB) / lenAB;
    const tD = vAD.dot(uAB) / lenAB;

    const tStart = Math.max(0, Math.min(tC, tD));
    const tEnd = Math.min(1, Math.max(tC, tD));

    if (tEnd <= tStart) {
      return null;
    }

    const sharedLength = (tEnd - tStart) * lenAB;
    if (sharedLength < minShared) {
      return null;
    }

    const ratio = tEnd - tStart;
    const classification: PartyWallClassification =
      ratio >= fullThreshold ? 'FULL' : 'PARTIAL';

    return {
      overlapInterval: [tStart, tEnd],
      sharedLengthMeters: Math.round(sharedLength * 1000) / 1000,
      classification,
    };
  }

  /**
   * Detects all party walls on a target building polygon by checking against
   * adjacent neighbor building polygons.
   */
  static detect(
    targetPolygon: Polygon2D,
    neighbors: NeighborBuilding[],
    options: PartyWallDetectionOptions = {}
  ): PartyWallSegment[] {
    const targetEdges = targetPolygon.edges;
    const results: PartyWallSegment[] = [];

    for (let i = 0; i < targetEdges.length; i++) {
      const edge = targetEdges[i];
      const edgeLen = Math.hypot(edge.p2.x - edge.p1.x, edge.p2.y - edge.p1.y);

      let bestOverlap: {
        interval: [number, number];
        sharedLength: number;
        classification: PartyWallClassification;
        neighborId?: string;
      } | null = null;

      for (const neighbor of neighbors) {
        // Quick bounding box check with 0.5m expansion
        const neighborBBox = neighbor.polygon.boundingBox();
        const minEdgeX = Math.min(edge.p1.x, edge.p2.x) - 0.5;
        const maxEdgeX = Math.max(edge.p1.x, edge.p2.x) + 0.5;
        const minEdgeY = Math.min(edge.p1.y, edge.p2.y) - 0.5;
        const maxEdgeY = Math.max(edge.p1.y, edge.p2.y) + 0.5;

        if (
          maxEdgeX < neighborBBox.minX ||
          minEdgeX > neighborBBox.maxX ||
          maxEdgeY < neighborBBox.minY ||
          minEdgeY > neighborBBox.maxY
        ) {
          continue;
        }

        const neighborEdges = neighbor.polygon.edges;
        for (const nEdge of neighborEdges) {
          const match = this.testSegmentPair(
            edge.p1,
            edge.p2,
            nEdge.p1,
            nEdge.p2,
            options
          );

          if (match) {
            if (!bestOverlap || match.sharedLengthMeters > bestOverlap.sharedLength) {
              bestOverlap = {
                interval: match.overlapInterval,
                sharedLength: match.sharedLengthMeters,
                classification: match.classification,
                neighborId: neighbor.id,
              };
            }
          }
        }
      }

      if (bestOverlap) {
        const [tStart, tEnd] = bestOverlap.interval;
        const vEdge = Vector2D.fromPoints(edge.p1, edge.p2);

        const subP1 = Vector2D.fromPoint(edge.p1).add(vEdge.scale(tStart));
        const subP2 = Vector2D.fromPoint(edge.p1).add(vEdge.scale(tEnd));

        results.push({
          wallEdgeIndex: i,
          originalSegment: edge,
          classification: bestOverlap.classification,
          sharedInterval: [tStart, tEnd],
          sharedLengthMeters: bestOverlap.sharedLength,
          sharedSegment: {
            p1: { x: subP1.x, y: subP1.y },
            p2: { x: subP2.x, y: subP2.y },
          },
          neighborPandId: bestOverlap.neighborId,
        });
      } else {
        results.push({
          wallEdgeIndex: i,
          originalSegment: edge,
          classification: 'FREE',
          sharedInterval: [0, 0],
          sharedLengthMeters: 0,
        });
      }
    }

    return results;
  }
}
