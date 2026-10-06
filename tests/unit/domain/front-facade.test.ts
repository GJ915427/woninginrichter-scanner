import { describe, it, expect } from 'vitest';
import { Polygon2D } from '@/domain/geometry/polygon';
import { FrontFacadeDetector } from '@/domain/architectural/front-facade-detector';

describe('FrontFacadeDetector Unit Tests', () => {
  // Rectangular building: 8m wide (x: 0 to 8), 10m deep (y: 0 to 10)
  // Edges:
  // Edge 0: (0,0) -> (8,0) (South wall, y=0)
  // Edge 1: (8,0) -> (8,10) (East wall, x=8)
  // Edge 2: (8,10) -> (0,10) (North wall, y=10)
  // Edge 3: (0,10) -> (0,0) (West wall, x=0)
  const building = new Polygon2D([
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 10 },
    { x: 0, y: 10 },
  ]);

  it('should identify front facade via entrance point proximity', () => {
    // Entrance point 0.3m south of South wall at (4, -0.3)
    const result = FrontFacadeDetector.detect(building, {
      entrancePoint: { x: 4, y: -0.3 },
    });

    expect(result.frontEdgeIndex).toBe(0);
    expect(result.frontEdge.p1.y).toBe(0);
    expect(result.frontEdge.p2.y).toBe(0);
    // Outward normal should point South (negative y)
    expect(result.outwardNormal.y).toBeLessThan(0);
  });

  it('should identify front facade when entrance is on North wall', () => {
    // Entrance point 0.2m north of North wall at (4, 10.2)
    const result = FrontFacadeDetector.detect(building, {
      entrancePoint: { x: 4, y: 10.2 },
    });

    expect(result.frontEdgeIndex).toBe(2);
    expect(result.outwardNormal.y).toBeGreaterThan(0); // pointing North
  });

  it('should combine entrance point and street centerline alignment', () => {
    // Street runs along y = -5 from x = -10 to x = 20
    const streetCenterline = {
      p1: { x: -10, y: -5 },
      p2: { x: 20, y: -5 },
    };

    const result = FrontFacadeDetector.detect(building, {
      entrancePoint: { x: 4, y: -0.2 },
      streetCenterline,
    });

    expect(result.frontEdgeIndex).toBe(0);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should correctly disambiguate corner house (hoekwoning) with two street exposures', () => {
    // Corner house exposed to South street (y = -4) and East street (x = 12)
    const southStreet = { p1: { x: -5, y: -4 }, p2: { x: 15, y: -4 } };
    const eastStreet = { p1: { x: 12, y: -5 }, p2: { x: 12, y: 15 } };

    // Entrance door is on South facade at (3, -0.1)
    const result = FrontFacadeDetector.detect(building, {
      entrancePoint: { x: 3, y: -0.1 },
      streetCenterline: [southStreet, eastStreet],
    });

    expect(result.frontEdgeIndex).toBe(0); // South facade wins due to entrance point
  });

  it('should detect front facade for angled/rotated buildings', () => {
    // Rotated 45 degrees
    const s = Math.SQRT1_2;
    // Rotate vertices by 45 deg
    const rotatedVertices = building.vertices.map((v) => ({
      x: v.x * s - v.y * s,
      y: v.x * s + v.y * s,
    }));
    const rotatedBuilding = new Polygon2D(rotatedVertices);

    // Entrance point at mid of first edge rotated
    const origMid = { x: 4, y: -0.3 };
    const rotEntrance = {
      x: origMid.x * s - origMid.y * s,
      y: origMid.x * s + origMid.y * s,
    };

    const result = FrontFacadeDetector.detect(rotatedBuilding, {
      entrancePoint: rotEntrance,
    });

    expect(result.frontEdgeIndex).toBe(0);
  });
});
