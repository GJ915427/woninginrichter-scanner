import { describe, it, expect } from 'vitest';
import { NEN2580Calculator, RoofSegment2D } from '@/domain/architectural/nen2580-calculator';
import { Vector3D } from '@/domain/geometry/vector';
import { Point3D } from '@/domain/geometry/types';

describe('NEN2580Calculator Unit Tests', () => {
  // Symmetric gable roof (zadeldak) with 6m span:
  // Left eave at (0, 6), Ridge at (3, 9), Right eave at (6, 6)
  const gableRoofSegments: RoofSegment2D[] = [
    { p1: { x: 0, y: 6 }, p2: { x: 3, y: 9 } },
    { p1: { x: 3, y: 9 }, p2: { x: 6, y: 6 } },
  ];

  it('should compute exact NEN 2580 1.50m and 2.60m clearance lines on gable roof', () => {
    const atticFloorNAP = 6.0;
    const totalFloorWidth = 6.0;

    const result = NEN2580Calculator.computeAtticHeadroom(
      'floor_zolder',
      atticFloorNAP,
      gableRoofSegments,
      totalFloorWidth
    );

    // 1.50m clearance line at z = 7.50m
    expect(result.usable150Line.zLevel).toBe(7.50);
    expect(result.usable150Line.xHits.length).toBe(2);
    expect(result.usable150Line.xHits[0]).toBeCloseTo(1.5, 4);
    expect(result.usable150Line.xHits[1]).toBeCloseTo(4.5, 4);
    expect(result.usable150Line.usableWidthMeters).toBeCloseTo(3.0, 4);

    // 2.60m Verblijfsgebied line at z = 8.60m
    expect(result.verblijf260Line.zLevel).toBe(8.60);
    expect(result.verblijf260Line.xHits.length).toBe(2);
    expect(result.verblijf260Line.xHits[0]).toBeCloseTo(2.6, 2);
    expect(result.verblijf260Line.xHits[1]).toBeCloseTo(3.4, 2);
    expect(result.verblijf260Line.usableWidthMeters).toBeCloseTo(0.8, 2);

    // Attic usable ratio: 3.0 / 6.0 = 0.50
    expect(result.atticUsableRatio).toBeCloseTo(0.5, 2);
  });

  it('should compute usable area (GO Wonen) correctly for attic', () => {
    // Usable width 3.0m, building depth 10.0m -> GO = 30.0 m²
    const go = NEN2580Calculator.calculateUsableArea(3.0, 10.0);
    expect(go).toBe(30.0);
  });

  it('should evaluate BBMI criteria correctly: GO Wonen when >= 4.0m² above 2.0m', () => {
    const atticFloorNAP = 6.0;
    const buildingDepthM = 8.0;

    // Span at 2.0m height: z=8.0m -> t = 2/3 -> x_left = 2.0, x_right = 4.0 -> width = 2.0m
    // Area above 2.0m = 2.0m * 8.0m = 16.0 m² >= 4.0 m² -> GO Wonen!
    const res = NEN2580Calculator.evaluateAtticBBMI(
      atticFloorNAP,
      gableRoofSegments,
      buildingDepthM,
      true,
      true
    );

    expect(res.qualifiesAsGOWonen).toBe(true);
    expect(res.classification).toBe('GO_WONEN');
    expect(res.areaAbove200M2).toBe(16.0);
    expect(res.areaAbove150M2).toBe(24.0); // 3.0m * 8.0m
  });

  it('should degrade to OIR when area above 2.00m is < 4.0m²', () => {
    const atticFloorNAP = 6.0;
    const buildingDepthM = 1.5; // Small depth

    // Area above 2.0m = 2.0m * 1.5m = 3.0 m² < 4.0 m² -> OIR!
    const res = NEN2580Calculator.evaluateAtticBBMI(
      atticFloorNAP,
      gableRoofSegments,
      buildingDepthM,
      true,
      true
    );

    expect(res.qualifiesAsGOWonen).toBe(false);
    expect(res.classification).toBe('OIR_INSUFFICIENT_HEADROOM');
  });

  it('should only deduct voids/stairwells when opening >= 4.0m² (NEN 2580 clause 5.1)', () => {
    const brutoBinnenGO = 60.0;
    // Standard stairwell (0.90 x 2.30 = 2.07 m²) should NOT be deducted
    expect(NEN2580Calculator.calculateNettoGO(brutoBinnenGO, [2.07])).toBe(60.0);

    // Large vide of 5.5 m² SHOULD be deducted
    expect(NEN2580Calculator.calculateNettoGO(brutoBinnenGO, [2.07, 5.5])).toBe(54.5);
  });

  it('should slice 3D roof faces with vertical plane', () => {
    const faceLeft: Point3D[] = [
      { x: 0, y: 0, z: 6 },
      { x: 0, y: 10, z: 6 },
      { x: 3, y: 10, z: 9 },
      { x: 3, y: 0, z: 9 },
    ];
    const faceRight: Point3D[] = [
      { x: 3, y: 0, z: 9 },
      { x: 3, y: 10, z: 9 },
      { x: 6, y: 10, z: 6 },
      { x: 6, y: 0, z: 6 },
    ];

    const planeNormal = new Vector3D(0, 1, 0);
    const planeD = -5;
    const sectionOrigin: Point3D = { x: 0, y: 5, z: 0 };
    const sectionAxisU = new Vector3D(1, 0, 0);

    const segments = NEN2580Calculator.slice3DFacesWithPlane(
      [faceLeft, faceRight],
      planeNormal,
      planeD,
      sectionOrigin,
      sectionAxisU
    );

    expect(segments.length).toBe(2);
    const pts = [segments[0].p1, segments[0].p2, segments[1].p1, segments[1].p2];
    const zMax = Math.max(...pts.map((p) => p.y));
    expect(zMax).toBeCloseTo(9.0, 4);
  });
});
