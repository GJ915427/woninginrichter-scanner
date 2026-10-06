import { describe, it, expect } from 'vitest';
import { CityJSONSectionCutter } from '@/domain/architectural/cityjson-section-cutter';
import { Point3D } from '@/domain/geometry/types';

describe('CityJSONSectionCutter Unit Tests', () => {
  it('should cut 3D building surfaces with a transverse vertical plane', () => {
    // 3D gable roof surfaces
    const roofSurface: Point3D[] = [
      { x: 0, y: 0, z: 6 },
      { x: 10, y: 0, z: 6 },
      { x: 10, y: 4, z: 9 },
      { x: 0, y: 4, z: 9 },
    ];

    const surfaces = [
      { polygon3D: roofSurface, type: 'RoofSurface' as const }
    ];

    // Cut vertically at x = 5 (center), slicing across Y
    const segments = CityJSONSectionCutter.cut3DVolume(surfaces, {
      centerPoint: { x: 5, y: 2 },
      axisDirection: { x: 0, y: 1 } // slicing along Y
    });

    expect(segments.length).toBeGreaterThanOrEqual(1);
    expect(segments[0].surfaceType).toBe('ROOF');
  });
});
