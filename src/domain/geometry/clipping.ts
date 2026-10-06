import * as martinez from 'martinez-polygon-clipping';
import { Polygon2D } from './polygon';
import { Point2D } from './types';

// Martinez types
type Position = [number, number];
type Ring = Position[];
type MartinezPolygon = Ring[];
type MartinezMultiPolygon = MartinezPolygon[];

function toMartinezPolygon(poly: Polygon2D): MartinezPolygon {
  return [poly.toClosedArray()];
}

function normalizeInput(
  input: Polygon2D | Polygon2D[]
): MartinezPolygon | MartinezMultiPolygon {
  if (Array.isArray(input)) {
    if (input.length === 1) {
      return toMartinezPolygon(input[0]);
    }
    return input.map(toMartinezPolygon);
  }
  return toMartinezPolygon(input);
}

function extractPolygons(result: any): Polygon2D[] {
  if (!result || result.length === 0) return [];

  const polygons: Polygon2D[] = [];

  // Martinez can return:
  // - null or empty array
  // - Polygon: Ring[] (array of rings: [exterior, hole1, ...])
  // - MultiPolygon: Ring[][] (array of polygons)
  const isMultiPolygon =
    Array.isArray(result) &&
    result.length > 0 &&
    Array.isArray(result[0]) &&
    result[0].length > 0 &&
    Array.isArray(result[0][0]) &&
    result[0][0].length > 0 &&
    Array.isArray(result[0][0][0]);

  if (isMultiPolygon) {
    // MultiPolygon
    for (const poly of result as MartinezMultiPolygon) {
      if (poly.length > 0) {
        // Exterior ring
        const extRing = poly[0];
        const pts: Point2D[] = extRing.map(([x, y]) => ({ x, y }));
        polygons.push(new Polygon2D(pts));
      }
    }
  } else {
    // Single Polygon
    const poly = result as MartinezPolygon;
    if (poly.length > 0) {
      const extRing = poly[0];
      const pts: Point2D[] = extRing.map(([x, y]) => ({ x, y }));
      polygons.push(new Polygon2D(pts));
    }
  }

  return polygons;
}

export class PolygonClipping {
  /**
   * Computes boolean intersection of subject and clipping polygon(s).
   */
  static intersection(
    subject: Polygon2D | Polygon2D[],
    clipping: Polygon2D | Polygon2D[]
  ): Polygon2D[] {
    const s = normalizeInput(subject);
    const c = normalizeInput(clipping);
    const result = martinez.intersection(s as any, c as any);
    return extractPolygons(result);
  }

  /**
   * Computes boolean union of subject and clipping polygon(s).
   */
  static union(
    subject: Polygon2D | Polygon2D[],
    clipping: Polygon2D | Polygon2D[]
  ): Polygon2D[] {
    const s = normalizeInput(subject);
    const c = normalizeInput(clipping);
    const result = martinez.union(s as any, c as any);
    return extractPolygons(result);
  }

  /**
   * Computes boolean difference (subject - clipping).
   */
  static difference(
    subject: Polygon2D | Polygon2D[],
    clipping: Polygon2D | Polygon2D[]
  ): Polygon2D[] {
    const s = normalizeInput(subject);
    const c = normalizeInput(clipping);
    const result = martinez.diff(s as any, c as any);
    return extractPolygons(result);
  }

  /**
   * Computes boolean XOR (symmetric difference) of subject and clipping.
   */
  static xor(
    subject: Polygon2D | Polygon2D[],
    clipping: Polygon2D | Polygon2D[]
  ): Polygon2D[] {
    const s = normalizeInput(subject);
    const c = normalizeInput(clipping);
    const result = martinez.xor(s as any, c as any);
    return extractPolygons(result);
  }
}
