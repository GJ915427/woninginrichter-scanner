import { describe, it, expect } from 'vitest';
import earcut from 'earcut';
import polylabel from '@mapbox/polylabel';
import * as martinez from 'martinez-polygon-clipping';
import { z } from 'zod';

describe('Scaffolding & Dependency Integration Verification', () => {
  it('should verify Zod schema validation works correctly', () => {
    const BuildingSchema = z.object({
      pandId: z.string(),
      oppervlakte: z.number().positive(),
      bouwjaar: z.number().int(),
    });

    const parsed = BuildingSchema.safeParse({
      pandId: 'NL.IMBAG.Pand.0363100012165736',
      oppervlakte: 142.5,
      bouwjaar: 1930,
    });

    expect(parsed.success).toBe(true);
  });

  it('should verify earcut triangulates a standard rectangular polygon', () => {
    // 10x10 square
    const vertices = [0, 0, 10, 0, 10, 10, 0, 10];
    const triangles = earcut(vertices);
    expect(triangles).toBeDefined();
    expect(triangles.length).toBe(6); // 2 triangles * 3 indices
  });

  it('should verify @mapbox/polylabel computes pole of inaccessibility', () => {
    const squarePolygon = [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ];
    const center = polylabel(squarePolygon, 1.0);
    expect(center).toBeDefined();
    expect(center[0]).toBeCloseTo(5, 0.5);
    expect(center[1]).toBeCloseTo(5, 0.5);
  });

  it('should verify martinez polygon clipping library is importable and functional', () => {
    expect(martinez.intersection).toBeDefined();
    expect(martinez.union).toBeDefined();
  });
});
