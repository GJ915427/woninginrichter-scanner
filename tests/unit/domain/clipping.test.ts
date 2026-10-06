import { describe, it, expect } from 'vitest';
import { Polygon2D } from '@/domain/geometry/polygon';
import { PolygonClipping } from '@/domain/geometry/clipping';
import { Triangulation } from '@/domain/geometry/triangulation';
import { Point3D } from '@/domain/geometry/types';

describe('Polygon2D Core Math Tests', () => {
  it('should compute signed area and winding correctly', () => {
    // CCW Unit square (0,0) -> (1,0) -> (1,1) -> (0,1)
    const polyCCW = new Polygon2D([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]);
    expect(polyCCW.signedArea()).toBe(1);
    expect(polyCCW.area()).toBe(1);
    expect(polyCCW.windingOrder()).toBe('CCW');

    // CW Unit square
    const polyCW = polyCCW.ensureWinding('CW');
    expect(polyCW.signedArea()).toBe(-1);
    expect(polyCW.area()).toBe(1);
    expect(polyCW.windingOrder()).toBe('CW');
  });

  it('should compute centroid accurately', () => {
    // Rectangle 10x20
    const rect = new Polygon2D([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 20 },
      { x: 0, y: 20 },
    ]);
    const c = rect.centroid();
    expect(c.x).toBeCloseTo(5, 6);
    expect(c.y).toBeCloseTo(10, 6);
  });

  it('should test point-in-polygon correctly', () => {
    const poly = new Polygon2D([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);

    expect(poly.containsPoint({ x: 5, y: 5 })).toBe(true);
    expect(poly.containsPoint({ x: 15, y: 5 })).toBe(false);
    expect(poly.containsPoint({ x: -1, y: -1 })).toBe(false);
    // Boundary point
    expect(poly.containsPoint({ x: 5, y: 0 })).toBe(true);
  });

  it('should compute segment-segment intersection', () => {
    const s1 = { p1: { x: 0, y: 5 }, p2: { x: 10, y: 5 } };
    const s2 = { p1: { x: 5, y: 0 }, p2: { x: 5, y: 10 } };

    const hit = Polygon2D.segmentIntersection(s1, s2);
    expect(hit).not.toBeNull();
    expect(hit!.point.x).toBe(5);
    expect(hit!.point.y).toBe(5);
    expect(hit!.t).toBe(0.5);
    expect(hit!.u).toBe(0.5);

    // Parallel segments
    const s3 = { p1: { x: 0, y: 6 }, p2: { x: 10, y: 6 } };
    expect(Polygon2D.segmentIntersection(s1, s3)).toBeNull();
  });
});

describe('PolygonClipping (martinez) Tests', () => {
  const rectA = new Polygon2D([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]);

  const rectB = new Polygon2D([
    { x: 5, y: 0 },
    { x: 15, y: 0 },
    { x: 15, y: 10 },
    { x: 5, y: 10 },
  ]);

  it('should compute boolean intersection', () => {
    const result = PolygonClipping.intersection(rectA, rectB);
    expect(result.length).toBe(1);
    expect(result[0].area()).toBeCloseTo(50, 4); // 5x10 = 50 m²
  });

  it('should compute boolean union', () => {
    const result = PolygonClipping.union(rectA, rectB);
    expect(result.length).toBe(1);
    expect(result[0].area()).toBeCloseTo(150, 4); // 15x10 = 150 m²
  });

  it('should compute boolean difference', () => {
    const result = PolygonClipping.difference(rectA, rectB);
    expect(result.length).toBe(1);
    expect(result[0].area()).toBeCloseTo(50, 4); // 5x10 = 50 m²
  });

  it('should return empty array for disjoint intersection', () => {
    const rectDisjoint = new Polygon2D([
      { x: 100, y: 100 },
      { x: 110, y: 100 },
      { x: 110, y: 110 },
      { x: 100, y: 110 },
    ]);
    const result = PolygonClipping.intersection(rectA, rectDisjoint);
    expect(result.length).toBe(0);
  });
});

describe('Triangulation (earcut) Tests', () => {
  it('should triangulate 2D polygons', () => {
    const poly = new Polygon2D([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    const triangles = Triangulation.triangulatePolygon2D(poly);
    expect(triangles.length).toBe(2);
  });

  it('should triangulate arbitrary 3D planar roof face', () => {
    // 3D sloping roof surface
    const face3D: Point3D[] = [
      { x: 0, y: 0, z: 3 },
      { x: 10, y: 0, z: 3 },
      { x: 10, y: 5, z: 7 },
      { x: 0, y: 5, z: 7 },
    ];

    const result = Triangulation.triangulate3DFace(face3D);
    expect(result.indices.length).toBe(6); // 2 triangles * 3 vertices
    expect(result.triangles.length).toBe(2);
    expect(result.normal.length()).toBeCloseTo(1.0, 5);
  });
});
