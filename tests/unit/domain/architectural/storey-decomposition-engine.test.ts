import { describe, it, expect } from 'vitest';
import {
  decomposeStoreys,
  RoofSurfaceData,
  StoreyLevel,
} from '@/domain/architectural/storey-decomposition-engine';

describe('StoreyDecompositionEngine (Enhanced with 3D BAG Z-Splits)', () => {
  // Building with 10m x 8m main volume (gable roof, eave 6.0m, ridge 9.0m)
  // and 4m x 8m rear extension (flat roof at z=3.0m)
  // Total footprint: 14m x 8m = 112 m²
  const footprint = [
    { x: 0, y: 0 },
    { x: 14, y: 0 },
    { x: 14, y: 8 },
    { x: 0, y: 8 },
  ];

  const roofSurfaces: RoofSurfaceData[] = [
    // Main roof pitch 1 (sloped)
    {
      id: 'roof-main-1',
      normal: [0.707, 0, 0.707],
      minZ: 6.0,
      maxZ: 9.0,
      isFlat: false,
      polygon2D: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 8 },
        { x: 0, y: 8 },
      ],
    },
    // Main roof pitch 2 (sloped)
    {
      id: 'roof-main-2',
      normal: [-0.707, 0, 0.707],
      minZ: 6.0,
      maxZ: 9.0,
      isFlat: false,
      polygon2D: [
        { x: 5, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 8 },
        { x: 5, y: 8 },
      ],
    },
    // Extension roof (flat at 3.0m, normal [0, 0, 1])
    {
      id: 'roof-extension',
      normal: [0, 0, 1],
      minZ: 3.0,
      maxZ: 3.0,
      isFlat: true,
      polygon2D: [
        { x: 10, y: 0 },
        { x: 14, y: 0 },
        { x: 14, y: 8 },
        { x: 10, y: 8 },
      ],
    },
  ];

  it('should include full footprint in Begane Grond (level 0)', () => {
    const storeys = decomposeStoreys({
      footprint,
      roofSurfaces,
      eaveHeight: 6.0,
      ridgeHeight: 9.0,
      groundHeight: 0.0,
      totalFloorArea: 160,
    });

    const groundFloor = storeys.find((s) => s.level === StoreyLevel.BEGANE_GROND);
    expect(groundFloor).toBeDefined();
    expect(groundFloor?.polygon.length).toBe(4);
    expect(groundFloor?.area).toBeCloseTo(112.0, 1);
    expect(groundFloor?.hasExtension).toBe(true);
  });

  it('should exclude the flat-roof extension from 1e Verdieping (level 1)', () => {
    const storeys = decomposeStoreys({
      footprint,
      roofSurfaces,
      eaveHeight: 6.0,
      ridgeHeight: 9.0,
      groundHeight: 0.0,
      totalFloorArea: 160,
    });

    const firstFloor = storeys.find((s) => s.level === StoreyLevel.EERSTE_VERDIEPING);
    expect(firstFloor).toBeDefined();
    // Main volume is 10m x 8m = 80 m²
    expect(firstFloor?.area).toBeCloseTo(80.0, 1);
    expect(firstFloor?.hasExtension).toBe(false);
  });

  it('should compute NEN 2580 1.50m clearance contour for Zolder / Kaplaag (level 2)', () => {
    const storeys = decomposeStoreys({
      footprint,
      roofSurfaces,
      eaveHeight: 6.0,
      ridgeHeight: 9.0,
      groundHeight: 0.0,
      totalFloorArea: 160,
    });

    const attic = storeys.find((s) => s.level === StoreyLevel.ZOLDER);
    expect(attic).toBeDefined();
    // Attic should be smaller than main floor due to sloped roof cutoffs
    expect(attic!.area).toBeLessThan(80.0);
    expect(attic!.area).toBeGreaterThan(20.0);
  });

  it('should handle flat-roof buildings without creating sloped attic cutoffs', () => {
    const flatRoofSurfaces: RoofSurfaceData[] = [
      {
        id: 'roof-flat-total',
        normal: [0, 0, 1],
        minZ: 7.0,
        maxZ: 7.0,
        isFlat: true,
        polygon2D: footprint,
      },
    ];

    const storeys = decomposeStoreys({
      footprint,
      roofSurfaces: flatRoofSurfaces,
      eaveHeight: 7.0,
      ridgeHeight: 7.0,
      groundHeight: 0.0,
      totalFloorArea: 220,
    });

    const attic = storeys.find((s) => s.level === StoreyLevel.ZOLDER);
    // Flat roof does not have a sloped attic cut
    expect(attic?.isSlopedRoof).toBe(false);
  });
});
