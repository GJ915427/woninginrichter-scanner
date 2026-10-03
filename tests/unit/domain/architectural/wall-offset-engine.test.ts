import { describe, it, expect } from 'vitest';
import {
  getTypicalWallThickness,
  computeInwardWallOffset,
} from '@/domain/architectural/wall-offset-engine';

describe('WallOffsetEngine (Bisector Offset & Dutch Building Codes)', () => {
  it('should return correct typical wall thickness based on construction year', () => {
    expect(getTypicalWallThickness(1910)).toBe(0.22); // Solid brick (steensmuur)
    expect(getTypicalWallThickness(1965)).toBe(0.28); // Early cavity wall (ongeisoleerde spouw)
    expect(getTypicalWallThickness(1985)).toBe(0.32); // Moderately insulated cavity
    expect(getTypicalWallThickness(2018)).toBe(0.38); // Heavily insulated cavity (Rc >= 4.5)
  });

  it('should offset a rectangular footprint inward uniformly along vertex bisectors', () => {
    // 10m x 8m rectangle
    const exterior = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 8 },
      { x: 0, y: 8 },
    ];
    const thickness = 0.30; // 30cm

    const interior = computeInwardWallOffset(exterior, thickness);
    expect(interior.length).toBe(4);

    // Each corner should be moved inward by thickness along x and y
    expect(interior[0].x).toBeCloseTo(0.30, 2);
    expect(interior[0].y).toBeCloseTo(0.30, 2);

    expect(interior[1].x).toBeCloseTo(9.70, 2);
    expect(interior[1].y).toBeCloseTo(0.30, 2);

    expect(interior[2].x).toBeCloseTo(9.70, 2);
    expect(interior[2].y).toBeCloseTo(7.70, 2);

    expect(interior[3].x).toBeCloseTo(0.30, 2);
    expect(interior[3].y).toBeCloseTo(7.70, 2);
  });

  it('should clamp acute angles with miter limiting to prevent self-intersection', () => {
    // Sharp triangle corner (30 degrees)
    const triangle = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 15 },
    ];
    const thickness = 0.35;

    const interior = computeInwardWallOffset(triangle, thickness);
    expect(interior.length).toBeGreaterThanOrEqual(3);
    // All vertices must be strictly inside the original bounding box
    interior.forEach((pt) => {
      expect(pt.x).toBeGreaterThan(0);
      expect(pt.x).toBeLessThan(10);
      expect(pt.y).toBeGreaterThan(0);
      expect(pt.y).toBeLessThan(15);
    });
  });
});
