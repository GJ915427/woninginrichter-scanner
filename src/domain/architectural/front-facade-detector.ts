import { Point2D, Segment2D } from '../geometry/types';
import { Vector2D } from '../geometry/vector';
import { Polygon2D } from '../geometry/polygon';
import { EdgeScoreDetail, FrontFacadeResult } from './types';

export interface FrontFacadeOptions {
  entrancePoint?: Point2D;
  streetCenterline?: Segment2D | Segment2D[];
  parcelFrontage?: Segment2D;
  weights?: {
    entrance?: number;
    street?: number;
    frontage?: number;
  };
}

export class FrontFacadeDetector {
  /**
   * Computes the strictly outward normal for edge i of a polygon.
   * Tests a small perturbation point along candidate normals to ensure it lies outside.
   */
  static getOutwardNormal(polygon: Polygon2D, edgeIndex: number): Vector2D {
    const edges = polygon.edges;
    const edge = edges[edgeIndex];
    const tangent = Vector2D.fromPoints(edge.p1, edge.p2).normalize();
    const mid = Vector2D.fromPoints(edge.p1, edge.p2).scale(0.5).add(edge.p1);

    // Candidate 1: (-tangent.y, tangent.x)
    const normal1 = new Vector2D(-tangent.y, tangent.x);
    // Candidate 2: (tangent.y, -tangent.x)
    const normal2 = new Vector2D(tangent.y, -tangent.x);

    const testDist = 0.05; // 5cm outside
    const testPoint1 = mid.add(normal1.scale(testDist));

    if (!polygon.containsPoint(testPoint1, false)) {
      return normal1;
    }
    return normal2;
  }

  /**
   * Identifies the front facade edge using multi-signal composite objective scoring.
   */
  static detect(
    polygon: Polygon2D,
    options: FrontFacadeOptions = {}
  ): FrontFacadeResult {
    const edges = polygon.edges;
    if (edges.length === 0) {
      throw new Error('Cannot detect front facade on an empty polygon');
    }

    const {
      entrancePoint,
      streetCenterline,
      parcelFrontage,
      weights = {},
    } = options;

    const hasEntrance = Boolean(entrancePoint);
    const hasStreet = Boolean(streetCenterline);
    const hasFrontage = Boolean(parcelFrontage);

    // Determine normalized weights based on available signals
    let wEntrance = hasEntrance ? (weights.entrance ?? 0.50) : 0;
    let wStreet = hasStreet ? (weights.street ?? 0.30) : 0;
    let wFrontage = hasFrontage ? (weights.frontage ?? 0.20) : 0;

    const totalWeight = wEntrance + wStreet + wFrontage;
    if (totalWeight > 0) {
      wEntrance /= totalWeight;
      wStreet /= totalWeight;
      wFrontage /= totalWeight;
    } else {
      // Fallback: If no signals provided, select the longest bottom/front edge
      wEntrance = 1.0;
    }

    const streetSegments: Segment2D[] = [];
    if (streetCenterline) {
      if (Array.isArray(streetCenterline)) {
        streetSegments.push(...streetCenterline);
      } else {
        streetSegments.push(streetCenterline);
      }
    }

    let frontageNormal: Vector2D | null = null;
    if (parcelFrontage) {
      const v = Vector2D.fromPoints(parcelFrontage.p1, parcelFrontage.p2).normalize();
      frontageNormal = new Vector2D(-v.y, v.x);
    }

    const scoredEdges: EdgeScoreDetail[] = [];
    let bestScore = -1;
    let bestIndex = 0;

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const length = Math.hypot(edge.p2.x - edge.p1.x, edge.p2.y - edge.p1.y);
      if (length < 1e-4) continue;

      const outwardNormal = this.getOutwardNormal(polygon, i);
      const mid = Vector2D.fromPoints(edge.p1, edge.p2).scale(0.5).add(edge.p1);

      // Signal 1: Entrance Point Proximity
      let entranceScore = 0;
      if (entrancePoint) {
        const { distance } = Polygon2D.pointToSegmentDistance(entrancePoint, edge);
        entranceScore = 1.0 / (1.0 + distance);
      }

      // Signal 2: Street Alignment & Proximity
      let streetAlignScore = 0;
      let streetDistScore = 0;
      if (streetSegments.length > 0) {
        let bestDistToStreet = Infinity;
        let vectorToStreet = new Vector2D(0, 0);

        for (const streetSeg of streetSegments) {
          const { distance, closestPoint } = Polygon2D.pointToSegmentDistance(mid, streetSeg);
          if (distance < bestDistToStreet) {
            bestDistToStreet = distance;
            vectorToStreet = Vector2D.fromPoints(mid, closestPoint);
          }
        }

        const lenVec = vectorToStreet.length();
        if (lenVec > 1e-6) {
          const uToStreet = vectorToStreet.normalize();
          streetAlignScore = Math.max(0, outwardNormal.dot(uToStreet));
          streetDistScore = 1.0 / (1.0 + bestDistToStreet);
        }
      }

      // Signal 3: Cadastral Parcel Frontage Parallelism
      let frontageParallelScore = 0;
      if (frontageNormal) {
        const dot = outwardNormal.dot(frontageNormal);
        frontageParallelScore = Math.max(0, dot);
      }

      // Composite Objective Score
      const compositeScore =
        wEntrance * entranceScore +
        wStreet * (streetAlignScore * streetDistScore) +
        wFrontage * frontageParallelScore;

      scoredEdges.push({
        edgeIndex: i,
        segment: edge,
        length,
        outwardNormal: { x: outwardNormal.x, y: outwardNormal.y },
        entranceScore,
        streetAlignScore,
        streetDistScore,
        frontageParallelScore,
        compositeScore,
      });

      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        bestIndex = i;
      }
    }

    const bestEdge = edges[bestIndex];
    const bestNormal = this.getOutwardNormal(polygon, bestIndex);

    // Orientation angle in radians relative to North (0 = North (0, 1), PI/2 = East (1, 0))
    // In Cartesian: North is (0, 1). Angle = atan2(normal.x, normal.y)
    let orientationAngleRad = Math.atan2(bestNormal.x, bestNormal.y);
    if (orientationAngleRad < 0) {
      orientationAngleRad += 2 * Math.PI;
    }

    // Confidence: gap between highest and second highest score
    const sorted = [...scoredEdges].sort((a, b) => b.compositeScore - a.compositeScore);
    const confidence =
      sorted.length > 1
        ? Math.max(0, Math.min(1, (sorted[0].compositeScore - sorted[1].compositeScore) * 2))
        : 1.0;

    // Cardinal direction label
    const deg = ((orientationAngleRad * 180) / Math.PI) % 360;
    let orientationLabel = 'Noord';
    if (deg >= 22.5 && deg < 67.5) orientationLabel = 'Noordoost';
    else if (deg >= 67.5 && deg < 112.5) orientationLabel = 'Oost';
    else if (deg >= 112.5 && deg < 157.5) orientationLabel = 'Zuidoost';
    else if (deg >= 157.5 && deg < 202.5) orientationLabel = 'Zuid';
    else if (deg >= 202.5 && deg < 247.5) orientationLabel = 'Zuidwest';
    else if (deg >= 247.5 && deg < 292.5) orientationLabel = 'West';
    else if (deg >= 292.5 && deg < 337.5) orientationLabel = 'Noordwest';

    return {
      frontEdgeIndex: bestIndex,
      frontEdge: bestEdge,
      outwardNormal: { x: bestNormal.x, y: bestNormal.y },
      orientationAngleRad,
      orientationLabel,
      allEdgeScores: scoredEdges,
      confidence,
    };
  }
}
