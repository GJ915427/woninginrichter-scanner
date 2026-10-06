import { describe, it, expect } from 'vitest';
import { Polygon2D } from '@/domain/geometry/polygon';
import { PartyWallDetector } from '@/domain/architectural/party-wall-detector';

describe('PartyWallDetector Unit Tests', () => {
  // Target building: 6m wide (x: 0 to 6), 10m deep (y: 0 to 10)
  // Edges:
  // Edge 0: (0,0) -> (6,0) (Front/South)
  // Edge 1: (6,0) -> (6,10) (Right/East)
  // Edge 2: (6,10) -> (0,10) (Rear/North)
  // Edge 3: (0,10) -> (0,0) (Left/West)
  const targetHouse = new Polygon2D([
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 10 },
    { x: 0, y: 10 },
  ]);

  it('should test segment pair with 0.15m epsilon buffer tolerance', () => {
    // Exact match along x = 6
    const pA = { x: 6, y: 0 };
    const pB = { x: 6, y: 10 };
    const pC = { x: 6.05, y: 10 }; // 5cm gap (cavity wall)
    const pD = { x: 6.05, y: 0 };

    const match = PartyWallDetector.testSegmentPair(pA, pB, pC, pD);
    expect(match).not.toBeNull();
    expect(match!.classification).toBe('FULL');
    expect(match!.sharedLengthMeters).toBeCloseTo(10, 2);

    // Gap too large: 25cm gap
    const pCFar = { x: 6.25, y: 10 };
    const pDFar = { x: 6.25, y: 0 };
    const matchFar = PartyWallDetector.testSegmentPair(pA, pB, pCFar, pDFar);
    expect(matchFar).toBeNull();
  });

  it('should reject non-parallel walls exceeding 6 degree threshold', () => {
    const pA = { x: 0, y: 0 };
    const pB = { x: 0, y: 10 };
    // Angled at 15 degrees
    const pC = { x: 0, y: 0 };
    const pD = { x: 2.6, y: 9.65 };

    const match = PartyWallDetector.testSegmentPair(pA, pB, pC, pD);
    expect(match).toBeNull();
  });

  it('should detect mid-terrace house (rijwoning tussen) with two full party walls', () => {
    // Neighbor Left: x from -6 to 0, y from 0 to 10
    const neighborLeft = {
      id: 'neighbor_left',
      polygon: new Polygon2D([
        { x: -6, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: -6, y: 10 },
      ]),
    };

    // Neighbor Right: x from 6 to 12, y from 0 to 10
    const neighborRight = {
      id: 'neighbor_right',
      polygon: new Polygon2D([
        { x: 6, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 10 },
        { x: 6, y: 10 },
      ]),
    };

    const walls = PartyWallDetector.detect(targetHouse, [neighborLeft, neighborRight]);

    // Edge 0 (Front, y=0): FREE
    expect(walls[0].classification).toBe('FREE');
    // Edge 1 (Right, x=6): FULL party wall
    expect(walls[1].classification).toBe('FULL');
    expect(walls[1].sharedLengthMeters).toBeCloseTo(10, 2);
    expect(walls[1].neighborPandId).toBe('neighbor_right');
    // Edge 2 (Rear, y=10): FREE
    expect(walls[2].classification).toBe('FREE');
    // Edge 3 (Left, x=0): FULL party wall
    expect(walls[3].classification).toBe('FULL');
    expect(walls[3].sharedLengthMeters).toBeCloseTo(10, 2);
    expect(walls[3].neighborPandId).toBe('neighbor_left');
  });

  it('should detect partial party wall with staggered neighbor (verspringende aanbouw)', () => {
    // Neighbor Right is only 6m deep (from y=0 to y=6)
    const neighborShort = {
      id: 'neighbor_short',
      polygon: new Polygon2D([
        { x: 6, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 6 },
        { x: 6, y: 6 },
      ]),
    };

    const walls = PartyWallDetector.detect(targetHouse, [neighborShort]);

    expect(walls[1].classification).toBe('PARTIAL');
    expect(walls[1].sharedInterval[0]).toBeCloseTo(0.0, 2);
    expect(walls[1].sharedInterval[1]).toBeCloseTo(0.6, 2);
    expect(walls[1].sharedLengthMeters).toBeCloseTo(6.0, 2);
    expect(walls[1].sharedSegment).toBeDefined();
    expect(walls[1].sharedSegment!.p1.y).toBeCloseTo(0.0, 2);
    expect(walls[1].sharedSegment!.p2.y).toBeCloseTo(6.0, 2);
  });

  it('should detect detached villa (vrijstaande villa) as 100% free-standing', () => {
    // Neighbor 5 meters away
    const farNeighbor = {
      id: 'far_house',
      polygon: new Polygon2D([
        { x: 15, y: 0 },
        { x: 25, y: 0 },
        { x: 25, y: 10 },
        { x: 15, y: 10 },
      ]),
    };

    const walls = PartyWallDetector.detect(targetHouse, [farNeighbor]);
    expect(walls.every((w) => w.classification === 'FREE')).toBe(true);
  });
});
