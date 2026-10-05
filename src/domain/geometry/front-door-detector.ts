export interface FrontDoorDetectionOptions {
  footprintCoords: Array<[number, number]>;
  vboEntrancePoint: [number, number];
  streetAxisSegment?: [[number, number], [number, number]];
  streetViewHeadingDeg?: number;
}

export interface WallSegmentScore {
  segmentIndex: number;
  start: [number, number];
  end: [number, number];
  length: number;
  projectedPoint: [number, number];
  distanceToVbo: number;
  distanceScore: number;
  projectionScore: number;
  orientationScore: number;
  lengthScore: number;
  totalScore: number;
}

export interface FrontDoorDetectionResult {
  frontWallIndex: number;
  frontDoorPoint: [number, number];
  outwardNormalAngleDeg: number;
  scores: WallSegmentScore[];
  confidence: number;
}

export class FrontDoorDetector {
  /**
   * Detects the front wall index and front entrance coordinate on the building footprint
   * using multi-factor orthogonal projection of the Kadaster BAG VBO entrance point.
   */
  static detectFrontWall(options: FrontDoorDetectionOptions): FrontDoorDetectionResult {
    const { footprintCoords, vboEntrancePoint, streetAxisSegment, streetViewHeadingDeg } = options;

    if (!footprintCoords || footprintCoords.length < 3) {
      return {
        frontWallIndex: 0,
        frontDoorPoint: vboEntrancePoint,
        outwardNormalAngleDeg: 0,
        scores: [],
        confidence: 0,
      };
    }

    // Ensure polygon is unwrapped to clean vertex ring
    const vertices = [...footprintCoords];
    const first = vertices[0];
    const last = vertices[vertices.length - 1];
    if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) {
      vertices.pop();
    }

    const n = vertices.length;
    if (n < 3) {
      return {
        frontWallIndex: 0,
        frontDoorPoint: vboEntrancePoint,
        outwardNormalAngleDeg: 0,
        scores: [],
        confidence: 0,
      };
    }

    // Centroid of building
    let cx = 0;
    let cy = 0;
    for (const [x, y] of vertices) {
      cx += x;
      cy += y;
    }
    cx /= n;
    cy /= n;

    // Check winding order (standard 2D polygon signed area)
    let signedArea = 0;
    for (let i = 0; i < n; i++) {
      const curr = vertices[i];
      const next = vertices[(i + 1) % n];
      signedArea += curr[0] * next[1] - next[0] * curr[1];
    }
    const isClockwise = signedArea < 0;

    const [vx, vy] = vboEntrancePoint;
    const scores: WallSegmentScore[] = [];

    for (let i = 0; i < n; i++) {
      const start = vertices[i];
      const end = vertices[(i + 1) % n];

      const segDx = end[0] - start[0];
      const segDy = end[1] - start[1];
      const lenSq = segDx * segDx + segDy * segDy;
      const length = Math.sqrt(lenSq);

      if (length < 1e-4) {
        continue;
      }

      // Orthogonal projection of VBO point onto wall segment
      const uX = vx - start[0];
      const uY = vy - start[1];
      const rawT = (uX * segDx + uY * segDy) / lenSq;
      const t = Math.max(0, Math.min(1, rawT));

      const projX = start[0] + t * segDx;
      const projY = start[1] + t * segDy;

      const distDx = vx - projX;
      const distDy = vy - projY;
      const distanceToVbo = Math.sqrt(distDx * distDx + distDy * distDy);

      // Distance score: Exponential decay with 3m scale
      const distanceScore = Math.exp(-distanceToVbo / 3.0);

      // Projection score: Bonus for being located centrally along the wall segment
      const projectionScore = 1.0 - 0.6 * Math.abs(2 * t - 1.0);

      // Outward normal vector
      let nx = isClockwise ? -segDy / length : segDy / length;
      let ny = isClockwise ? segDx / length : -segDx / length;

      // Verify outward direction relative to centroid
      const midX = (start[0] + end[0]) / 2;
      const midY = (start[1] + end[1]) / 2;
      const toMidX = midX - cx;
      const toMidY = midY - cy;
      if (nx * toMidX + ny * toMidY < 0) {
        nx = -nx;
        ny = -ny;
      }

      // Orientation score
      let orientationScore = 0.5;
      if (streetAxisSegment) {
        const [s1, s2] = streetAxisSegment;
        const streetDx = s2[0] - s1[0];
        const streetDy = s2[1] - s1[1];
        const streetMidX = (s1[0] + s2[0]) / 2;
        const streetMidY = (s1[1] + s2[1]) / 2;
        const toStreetX = streetMidX - midX;
        const toStreetY = streetMidY - midY;
        const toStreetLen = Math.sqrt(toStreetX * toStreetX + toStreetY * toStreetY);

        if (toStreetLen > 0) {
          const dot = (nx * toStreetX + ny * toStreetY) / toStreetLen;
          orientationScore = Math.max(0, Math.min(1, (dot + 1) / 2));
        }
      } else if (streetViewHeadingDeg !== undefined) {
        const headingRad = ((90 - streetViewHeadingDeg) * Math.PI) / 180;
        const camDirX = Math.cos(headingRad);
        const camDirY = Math.sin(headingRad);
        const dot = -(nx * camDirX + ny * camDirY);
        orientationScore = Math.max(0, Math.min(1, (dot + 1) / 2));
      }

      // Length score: Favor significant structural walls over micro-notches
      const lengthScore = Math.min(1.0, Math.log(1 + length) / Math.log(15.0));

      // Weighted multi-factor score
      const totalScore =
        0.45 * distanceScore +
        0.25 * projectionScore +
        0.20 * orientationScore +
        0.10 * lengthScore;

      scores.push({
        segmentIndex: i,
        start,
        end,
        length: Number(length.toFixed(2)),
        projectedPoint: [Number(projX.toFixed(3)), Number(projY.toFixed(3))],
        distanceToVbo: Number(distanceToVbo.toFixed(3)),
        distanceScore: Number(distanceScore.toFixed(3)),
        projectionScore: Number(projectionScore.toFixed(3)),
        orientationScore: Number(orientationScore.toFixed(3)),
        lengthScore: Number(lengthScore.toFixed(3)),
        totalScore: Number(totalScore.toFixed(4)),
      });
    }

    scores.sort((a, b) => b.totalScore - a.totalScore);
    const winner = scores[0];

    // Compute outward normal heading in degrees
    const winStart = winner.start;
    const winEnd = winner.end;
    const dx = winEnd[0] - winStart[0];
    const dy = winEnd[1] - winStart[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    let nx = isClockwise ? -dy / len : dy / len;
    let ny = isClockwise ? dx / len : -dx / len;
    const midX = (winStart[0] + winEnd[0]) / 2;
    const midY = (winStart[1] + winEnd[1]) / 2;
    if (nx * (midX - cx) + ny * (midY - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }

    let angleDeg = (Math.atan2(ny, nx) * 180) / Math.PI;
    if (angleDeg < 0) angleDeg += 360;

    const runnerUp = scores[1];
    const confidence = runnerUp
      ? Number(Math.max(0, Math.min(1, (winner.totalScore - runnerUp.totalScore) / winner.totalScore)).toFixed(3))
      : 1.0;

    return {
      frontWallIndex: winner.segmentIndex,
      frontDoorPoint: winner.projectedPoint,
      outwardNormalAngleDeg: Number(angleDeg.toFixed(1)),
      scores,
      confidence,
    };
  }
}
