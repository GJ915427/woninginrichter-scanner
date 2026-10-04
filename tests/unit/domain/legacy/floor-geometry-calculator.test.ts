import { describe, it, expect } from 'vitest';
import { computeFloorGeometry } from '@/domain/legacy/floor-geometry-calculator';

describe('Legacy Floor Geometry Calculator (1-on-1 port from google_maps_picker.html)', () => {
  const sampleLBuilding = [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 18 },
    { x: 3, y: 18 },
    { x: 3, y: 8 },
    { x: 0, y: 8 },
  ];

  it('should return the full base contour for Begane Grond (etageIndex 0)', () => {
    const bg = computeFloorGeometry(sampleLBuilding, 0, 0, 173, 0.28);
    expect(bg).toHaveLength(6);
    expect(bg).toEqual(sampleLBuilding);
  });

  it('should return a rectangular main volume for 1st floor on compound buildings', () => {
    // For an L-shape with totalWoonoppervlakte = 173m², the upper floor should isolate the main volume
    const f1 = computeFloorGeometry(sampleLBuilding, 0, 1, 173, 0.28);
    expect(f1).toHaveLength(4);
    // The width should match the front wall
    const width = Math.hypot(f1[1].x - f1[0].x, f1[1].y - f1[0].y);
    expect(width).toBeCloseTo(6.0, 1);
    // The depth should be between 5.0 and 8.0 meters
    const depth = Math.hypot(f1[3].x - f1[0].x, f1[3].y - f1[0].y);
    expect(depth).toBeGreaterThanOrEqual(5.0);
    expect(depth).toBeLessThanOrEqual(8.0);
    expect(depth).toBeCloseTo(8.0, 1);
  });

  it('should not stretch upper floor along long 18m annex wall', () => {
    // When front wall is 6m and side wall is 18m, upper floor must not exceed 8.0m
    const f1 = computeFloorGeometry(sampleLBuilding, 0, 1, 173, 0.28);
    const depth = Math.hypot(f1[3].x - f1[0].x, f1[3].y - f1[0].y);
    expect(depth).not.toBeCloseTo(18.0, 0);
    expect(depth).toBeLessThanOrEqual(8.0);
  });

  it('should return base contour if building has <= 4 corners (simple rectangle)', () => {
    const rectBuilding = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 10 },
      { x: 0, y: 10 },
    ];
    const f1 = computeFloorGeometry(rectBuilding, 0, 1, 120, 0.28);
    expect(f1).toHaveLength(4);
    expect(f1).toEqual(rectBuilding);
  });
});
