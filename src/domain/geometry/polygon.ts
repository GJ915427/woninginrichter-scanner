import { Point2D, Segment2D, BoundingBox2D, Intersection2D, WindingOrder } from './types';
import { Vector2D } from './vector';

export class Polygon2D {
  public vertices: Point2D[];

  constructor(vertices: Point2D[]) {
    // Strip redundant closing vertex if present (where last point == first point)
    if (vertices.length > 2) {
      const first = vertices[0];
      const last = vertices[vertices.length - 1];
      if (Math.abs(first.x - last.x) < 1e-9 && Math.abs(first.y - last.y) < 1e-9) {
        this.vertices = vertices.slice(0, -1);
      } else {
        this.vertices = [...vertices];
      }
    } else {
      this.vertices = [...vertices];
    }
  }

  static fromArray(coords: [number, number][]): Polygon2D {
    return new Polygon2D(coords.map(([x, y]) => ({ x, y })));
  }

  toArray(): [number, number][] {
    return this.vertices.map((v) => [v.x, v.y]);
  }

  /**
   * Returns closed ring coordinates where the first point is repeated at the end.
   */
  toClosedArray(): [number, number][] {
    if (this.vertices.length === 0) return [];
    const arr = this.toArray();
    arr.push([...arr[0]]);
    return arr;
  }

  get edges(): Segment2D[] {
    const n = this.vertices.length;
    if (n < 2) return [];
    const edges: Segment2D[] = [];
    for (let i = 0; i < n; i++) {
      edges.push({
        p1: this.vertices[i],
        p2: this.vertices[(i + 1) % n],
      });
    }
    return edges;
  }

  get vertexCount(): number {
    return this.vertices.length;
  }

  boundingBox(): BoundingBox2D {
    if (this.vertices.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    let minX = this.vertices[0].x;
    let maxX = this.vertices[0].x;
    let minY = this.vertices[0].y;
    let maxY = this.vertices[0].y;

    for (let i = 1; i < this.vertices.length; i++) {
      const v = this.vertices[i];
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Signed area using the Shoelace formula.
   * Positive = Counter-Clockwise (CCW) in standard Cartesian (x-right, y-up).
   * Negative = Clockwise (CW).
   */
  signedArea(): number {
    const n = this.vertices.length;
    if (n < 3) return 0;

    let area = 0;
    for (let i = 0; i < n; i++) {
      const p1 = this.vertices[i];
      const p2 = this.vertices[(i + 1) % n];
      area += p1.x * p2.y - p2.x * p1.y;
    }
    return area * 0.5;
  }

  area(): number {
    return Math.abs(this.signedArea());
  }

  perimeter(): number {
    let perim = 0;
    const n = this.vertices.length;
    for (let i = 0; i < n; i++) {
      const p1 = this.vertices[i];
      const p2 = this.vertices[(i + 1) % n];
      perim += Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }
    return perim;
  }

  windingOrder(): WindingOrder {
    return this.signedArea() >= 0 ? 'CCW' : 'CW';
  }

  ensureWinding(target: WindingOrder): Polygon2D {
    if (this.windingOrder() !== target) {
      return new Polygon2D([...this.vertices].reverse());
    }
    return this;
  }

  centroid(): Point2D {
    const n = this.vertices.length;
    if (n === 0) return { x: 0, y: 0 };
    if (n === 1) return { ...this.vertices[0] };
    if (n === 2) {
      return {
        x: (this.vertices[0].x + this.vertices[1].x) * 0.5,
        y: (this.vertices[0].y + this.vertices[1].y) * 0.5,
      };
    }

    const sArea = this.signedArea();
    if (Math.abs(sArea) < 1e-9) {
      // Degenerate polygon, fallback to arithmetic mean
      let sx = 0;
      let sy = 0;
      for (const v of this.vertices) {
        sx += v.x;
        sy += v.y;
      }
      return { x: sx / n, y: sy / n };
    }

    let cx = 0;
    let cy = 0;
    for (let i = 0; i < n; i++) {
      const p1 = this.vertices[i];
      const p2 = this.vertices[(i + 1) % n];
      const factor = p1.x * p2.y - p2.x * p1.y;
      cx += (p1.x + p2.x) * factor;
      cy += (p1.y + p2.y) * factor;
    }

    const multiplier = 1 / (6 * sArea);
    return {
      x: cx * multiplier,
      y: cy * multiplier,
    };
  }

  /**
   * Ray casting point-in-polygon algorithm.
   * Returns true if point is strictly inside or on the boundary.
   */
  containsPoint(p: Point2D, includeBoundary: boolean = true): boolean {
    const n = this.vertices.length;
    if (n < 3) return false;

    // Check boundary proximity
    if (includeBoundary) {
      const { distance } = this.closestPointOnBoundary(p);
      if (distance < 1e-6) return true;
    }

    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = this.vertices[i].x;
      const yi = this.vertices[i].y;
      const xj = this.vertices[j].x;
      const yj = this.vertices[j].y;

      const intersect =
        yi > p.y !== yj > p.y &&
        p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * Finds the closest point on the polygon perimeter to point P.
   */
  closestPointOnBoundary(p: Point2D): {
    point: Point2D;
    distance: number;
    edgeIndex: number;
    t: number;
  } {
    const edges = this.edges;
    let bestDist = Infinity;
    let bestPt: Point2D = { x: 0, y: 0 };
    let bestEdge = 0;
    let bestT = 0;

    for (let i = 0; i < edges.length; i++) {
      const res = Polygon2D.pointToSegmentDistance(p, edges[i]);
      if (res.distance < bestDist) {
        bestDist = res.distance;
        bestPt = res.closestPoint;
        bestEdge = i;
        bestT = res.t;
      }
    }

    return {
      point: bestPt,
      distance: bestDist,
      edgeIndex: bestEdge,
      t: bestT,
    };
  }

  /**
   * Computes the distance from a point to a 2D line segment.
   */
  static pointToSegmentDistance(
    p: Point2D,
    seg: Segment2D
  ): { distance: number; closestPoint: Point2D; t: number } {
    const dx = seg.p2.x - seg.p1.x;
    const dy = seg.p2.y - seg.p1.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq < 1e-12) {
      const d = Math.hypot(p.x - seg.p1.x, p.y - seg.p1.y);
      return { distance: d, closestPoint: { ...seg.p1 }, t: 0 };
    }

    const t = Math.max(0, Math.min(1, ((p.x - seg.p1.x) * dx + (p.y - seg.p1.y) * dy) / lenSq));
    const closestX = seg.p1.x + t * dx;
    const closestY = seg.p1.y + t * dy;
    const dist = Math.hypot(p.x - closestX, p.y - closestY);

    return {
      distance: dist,
      closestPoint: { x: closestX, y: closestY },
      t,
    };
  }

  /**
   * Computes intersection between two segments S1 = [p1, p2] and S2 = [p3, p4].
   * Returns Intersection2D or null if segments do not intersect.
   */
  static segmentIntersection(s1: Segment2D, s2: Segment2D): Intersection2D | null {
    const x1 = s1.p1.x;
    const y1 = s1.p1.y;
    const x2 = s1.p2.x;
    const y2 = s1.p2.y;

    const x3 = s2.p1.x;
    const y3 = s2.p1.y;
    const x4 = s2.p2.x;
    const y4 = s2.p2.y;

    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (Math.abs(denom) < 1e-10) {
      return null; // Collinear or parallel
    }

    const t = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const u = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

    if (t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) {
      const clampedT = Math.max(0, Math.min(1, t));
      const clampedU = Math.max(0, Math.min(1, u));
      return {
        point: {
          x: x1 + clampedT * (x2 - x1),
          y: y1 + clampedT * (y2 - y1),
        },
        t: clampedT,
        u: clampedU,
      };
    }

    return null;
  }
}
