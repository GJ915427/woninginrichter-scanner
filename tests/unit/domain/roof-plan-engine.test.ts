import { describe, it, expect } from 'vitest';
import { RoofPlanEngine } from '@/domain/architectural/roof-plan-engine';
import { Point3D } from '@/domain/geometry/types';

describe('RoofPlanEngine Unit Tests', () => {
  // A symmetric gable roof (zadeldak) with 2 slopes meeting at ridge:
  // Slope 1 (South facing, pitching up towards ridge at z=9)
  const southSlope: Point3D[] = [
    { x: 0, y: 0, z: 6 },
    { x: 10, y: 0, z: 6 },
    { x: 10, y: 4, z: 9 },
    { x: 0, y: 4, z: 9 },
  ];
  // Slope 2 (North facing, pitching up towards ridge at z=9)
  const northSlope: Point3D[] = [
    { x: 0, y: 4, z: 9 },
    { x: 10, y: 4, z: 9 },
    { x: 10, y: 8, z: 6 },
    { x: 0, y: 8, z: 6 },
  ];

  it('should compute valid Newell plane normal pointing upward', () => {
    const normal = RoofPlanEngine.computeNewellNormal(southSlope);
    expect(normal.z).toBeGreaterThan(0);
    // Slope pitches up in Y, so Y normal should be negative (pointing south)
    expect(normal.y).toBeLessThan(0);
  });

  it('should reconstruct roof plan and classify ridge and eaves', () => {
    const result = RoofPlanEngine.reconstructRoofPlan([southSlope, northSlope]);

    expect(result.planes.length).toBe(2);
    expect(result.planes[0].isFlat).toBe(false);
    expect(result.planes[1].isFlat).toBe(false);

    // Should classify the shared edge at y=4, z=9 as RIDGE
    const ridgeEdge = result.edges.find((e) => e.type === 'RIDGE');
    expect(ridgeEdge).toBeDefined();
    expect(ridgeEdge?.elevationZ).toBeCloseTo(9.0, 1);

    // Eaves at y=0, z=6 and y=8, z=6
    const eavesEdges = result.edges.filter((e) => e.type === 'EAVES');
    expect(eavesEdges.length).toBeGreaterThanOrEqual(2);
  });
});
