import {
  FmlProject,
  FmlWall,
  FmlPoint2D,
  ExtractedFloorPolygon,
} from '../src/domain/benchmark/floorplanner-types';

export class FmlOuterPolygonExtractor {
  /**
   * Snapping tolerance in cm to merge slightly misaligned wall joints.
   */
  private static readonly SNAP_TOLERANCE_CM = 8.0;

  /**
   * Extracts outer polygon boundaries for each floor in an FML project.
   */
  public static extractFloorPolygons(project: FmlProject): ExtractedFloorPolygon[] {
    if (!project || !project.floors || project.floors.length === 0) {
      return [];
    }

    const results: ExtractedFloorPolygon[] = [];

    for (const floor of project.floors) {
      const design = floor.designs && floor.designs[0];
      if (!design || !design.walls || design.walls.length === 0) {
        continue;
      }

      const outerPolygonM = this.extractOuterPolygonFromWalls(design.walls);
      const areaM2 = this.calculatePolygonArea(outerPolygonM);

      results.push({
        level: floor.level ?? 0,
        name: floor.name || `Verdieping ${floor.level}`,
        heightCm: floor.height || 280,
        outerPolygonM,
        measuredGrossAreaM2: Math.round(areaM2 * 100) / 100,
        wallCount: design.walls.length,
        isClosed: this.isClosedPolygon(outerPolygonM),
      });
    }

    return results;
  }

  /**
   * Extracts the outermost closed boundary polygon from a collection of FML walls.
   * Filters out internal partition walls and chains outer walls into a closed ring in meters.
   */
  public static extractOuterPolygonFromWalls(walls: FmlWall[]): Array<[number, number]> {
    if (!walls || walls.length === 0) return [];

    // 1. Filter out degenerate zero-length walls
    const validWalls = walls.filter(w => {
      const dx = w.b.x - w.a.x;
      const dy = w.b.y - w.a.y;
      return Math.hypot(dx, dy) > 5.0; // at least 5cm long
    });

    if (validWalls.length === 0) return [];

    // 2. Determine structural thickness threshold
    // Dutch exterior walls are typically >= 20cm (spouwmuur or steensmuur: 25-40cm).
    // Interior partitions are typically 7-12cm.
    // If the model has mixed thicknesses, prioritize walls with thickness >= 18cm.
    const maxThickness = Math.max(...validWalls.map(w => w.thickness || 0));
    let candidateWalls = validWalls;

    if (maxThickness >= 20) {
      const thickWalls = validWalls.filter(w => (w.thickness || 0) >= 18);
      // Only use thick walls if they form at least 3 walls
      if (thickWalls.length >= 3) {
        candidateWalls = thickWalls;
      }
    }

    // 3. Build graph of snapped vertices
    const segments = candidateWalls.map(w => ({
      a: { x: w.a.x, y: w.a.y },
      b: { x: w.b.x, y: w.b.y },
    }));

    // 4. Chain segments into a closed polygon
    const chainedRingCm = this.chainSegmentsIntoPolygon(segments);
    if (chainedRingCm.length < 3) {
      // Fallback: bounding box of all segments
      return this.computeBoundingBoxPolygon(segments);
    }

    // 5. Convert cm to meters (100cm = 1m) and round to 3 decimals (millimeter precision)
    const polygonM: Array<[number, number]> = chainedRingCm.map(pt => [
      Math.round((pt.x / 100) * 1000) / 1000,
      Math.round((pt.y / 100) * 1000) / 1000,
    ]);

    // Ensure counterclockwise orientation
    return this.ensureCounterClockwise(polygonM);
  }

  /**
   * Chains a set of line segments into a closed polygon path.
   */
  private static chainSegmentsIntoPolygon(
    segments: Array<{ a: FmlPoint2D; b: FmlPoint2D }>
  ): FmlPoint2D[] {
    if (segments.length === 0) return [];

    // Iteratively prune dead-ends (degree 1 vertices)
    let activeSegments = [...segments];
    let pruned = true;

    while (pruned) {
      pruned = false;
      const vertexDegree = new Map<string, number>();

      for (const seg of activeSegments) {
        const keyA = this.pointKey(seg.a);
        const keyB = this.pointKey(seg.b);
        vertexDegree.set(keyA, (vertexDegree.get(keyA) || 0) + 1);
        vertexDegree.set(keyB, (vertexDegree.get(keyB) || 0) + 1);
      }

      const beforeLen = activeSegments.length;
      activeSegments = activeSegments.filter(seg => {
        const degA = vertexDegree.get(this.pointKey(seg.a)) || 0;
        const degB = vertexDegree.get(this.pointKey(seg.b)) || 0;
        return degA >= 2 && degB >= 2;
      });

      if (activeSegments.length < beforeLen) {
        pruned = true;
      }
    }

    if (activeSegments.length < 3) {
      activeSegments = [...segments];
    }

    // Trace path
    const remaining = [...activeSegments];
    const first = remaining.shift()!;
    const path: FmlPoint2D[] = [first.a, first.b];

    while (remaining.length > 0) {
      const currentTail = path[path.length - 1];
      let nextIdx = -1;
      let reverse = false;

      for (let i = 0; i < remaining.length; i++) {
        const cand = remaining[i];
        if (this.distance(currentTail, cand.a) <= this.SNAP_TOLERANCE_CM) {
          nextIdx = i;
          reverse = false;
          break;
        } else if (this.distance(currentTail, cand.b) <= this.SNAP_TOLERANCE_CM) {
          nextIdx = i;
          reverse = true;
          break;
        }
      }

      if (nextIdx !== -1) {
        const [nextSeg] = remaining.splice(nextIdx, 1);
        path.push(reverse ? nextSeg.a : nextSeg.b);
      } else {
        break;
      }
    }

    // Close ring if endpoints are close
    if (path.length >= 3 && this.distance(path[0], path[path.length - 1]) <= this.SNAP_TOLERANCE_CM * 2) {
      path[path.length - 1] = { x: path[0].x, y: path[0].y };
    }

    return path;
  }

  private static computeBoundingBoxPolygon(
    segments: Array<{ a: FmlPoint2D; b: FmlPoint2D }>
  ): Array<[number, number]> {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const seg of segments) {
      minX = Math.min(minX, seg.a.x, seg.b.x);
      minY = Math.min(minY, seg.a.y, seg.b.y);
      maxX = Math.max(maxX, seg.a.x, seg.b.x);
      maxY = Math.max(maxY, seg.a.y, seg.b.y);
    }

    return [
      [minX / 100, minY / 100],
      [maxX / 100, minY / 100],
      [maxX / 100, maxY / 100],
      [minX / 100, maxY / 100],
      [minX / 100, minY / 100],
    ];
  }

  private static calculatePolygonArea(polygon: Array<[number, number]>): number {
    if (polygon.length < 3) return 0;
    let sum = 0;
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = polygon[i];
      const [x2, y2] = polygon[(i + 1) % n];
      sum += x1 * y2 - x2 * y1;
    }
    return Math.abs(sum) / 2;
  }

  private static isClosedPolygon(polygon: Array<[number, number]>): boolean {
    if (polygon.length < 4) return false;
    const first = polygon[0];
    const last = polygon[polygon.length - 1];
    return Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.05;
  }

  private static ensureCounterClockwise(polygon: Array<[number, number]>): Array<[number, number]> {
    if (polygon.length < 3) return polygon;
    let sum = 0;
    const n = polygon.length;
    for (let i = 0; i < n - 1; i++) {
      sum += (polygon[i + 1][0] - polygon[i][0]) * (polygon[i + 1][1] + polygon[i][1]);
    }
    // If clockwise (sum > 0), reverse
    if (sum > 0) {
      return [...polygon].reverse();
    }
    return polygon;
  }

  private static distance(p1: FmlPoint2D, p2: FmlPoint2D): number {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  private static pointKey(p: FmlPoint2D): string {
    const qx = Math.round(p.x / this.SNAP_TOLERANCE_CM) * this.SNAP_TOLERANCE_CM;
    const qy = Math.round(p.y / this.SNAP_TOLERANCE_CM) * this.SNAP_TOLERANCE_CM;
    return `${qx},${qy}`;
  }
}
