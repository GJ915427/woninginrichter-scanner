import { describe, it, expect } from 'vitest';
import { LabelLayoutEngine } from '@/domain/architectural/label-layout-engine';
import { Polygon2D } from '@/domain/geometry/polygon';

describe('LabelLayoutEngine Unit Tests', () => {
  describe('1D Vertical Interval Stacking', () => {
    it('should leave widely spaced markers unchanged', () => {
      const markers = [
        { id: 'm1', nominalY: 0.0, text: 'P = 0.00' },
        { id: 'm2', nominalY: 2.8, text: '+2.80' },
        { id: 'm3', nominalY: 5.5, text: '+5.50' },
      ];

      const resolved = LabelLayoutEngine.resolveVerticalStack(markers, 0.45);
      expect(resolved.every((m) => !m.isJogged)).toBe(true);
      expect(resolved[0].joggedY).toBe(0.0);
      expect(resolved[1].joggedY).toBe(2.8);
      expect(resolved[2].joggedY).toBe(5.5);
    });

    it('should displace closely spaced markers and flag them as jogged', () => {
      const markers = [
        { id: 'floor', nominalY: 2.80, text: '+2.80 Vloer' },
        { id: 'eaves', nominalY: 2.95, text: '+2.95 Dakrand' }, // Only 0.15m above floor!
        { id: 'beam', nominalY: 3.10, text: '+3.10 Balklaag' }, // Only 0.15m above eaves!
      ];

      const resolved = LabelLayoutEngine.resolveVerticalStack(markers, 0.45);

      expect(resolved[0].isJogged).toBe(false);
      expect(resolved[0].joggedY).toBe(2.80);

      expect(resolved[1].isJogged).toBe(true);
      expect(resolved[1].joggedY).toBe(3.25); // 2.80 + 0.45

      expect(resolved[2].isJogged).toBe(true);
      expect(resolved[2].joggedY).toBe(3.70); // 3.25 + 0.45
    });

    it('should generate architectural dog-leg leader points for jogged labels', () => {
      const item = {
        id: 'eaves',
        nominalY: 2.95,
        joggedY: 3.40,
        isJogged: true,
        text: '+2.95 Dakrand',
      };

      const leaderPts = LabelLayoutEngine.computeJoggedLeaderPoints(item, 10.0, 1.0);
      expect(leaderPts.length).toBe(4);
      expect(leaderPts[0].x).toBe(10.0);
      expect(leaderPts[0].y).toBe(2.95);
      expect(leaderPts[3].y).toBe(3.40); // Ends at displaced jogged height
    });
  });

  describe('2D Interior Room Label Placement (Polylabel)', () => {
    it('should place room label strictly INSIDE an L-shaped room where centroid is outside', () => {
      // L-shaped polygon:
      // (0,0) -> (10,0) -> (10,4) -> (4,4) -> (4,10) -> (0,10)
      const lShapedRoom = new Polygon2D([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 4 },
        { x: 4, y: 4 },
        { x: 4, y: 10 },
        { x: 0, y: 10 },
      ]);

      const centroid = lShapedRoom.centroid();
      // For this L-shape, centroid is near (3.2, 3.2), but let's test a deeply concave L-shape
      const result = LabelLayoutEngine.computeRoomLabelPlacement(
        lShapedRoom,
        'Woonkamer'
      );

      expect(result.roomName).toBe('Woonkamer');
      expect(lShapedRoom.containsPoint(result.labelPosition)).toBe(true);
      expect(result.distanceToBoundary).toBeGreaterThan(0.5);
      expect(result.areaM2).toBe(64); // 10*4 + 4*6 = 40 + 24 = 64 m²
    });
  });

  describe('3-Tier Dimension Chain Hierarchy', () => {
    it('should generate Tier 3 overall dimension and Tier 1 opening chains', () => {
      const wallEdge = {
        p1: { x: 0, y: 0 },
        p2: { x: 10, y: 0 },
      };
      const outwardNormal = { x: 0, y: -1 }; // Facing South

      const chains = LabelLayoutEngine.createDimensionChain(
        wallEdge,
        outwardNormal,
        [
          { tStart: 0, tEnd: 0.3, label: '3.00 m (Penant)' },
          { tStart: 0.3, tEnd: 0.5, label: '2.00 m (Raam)' },
          { tStart: 0.5, tEnd: 1.0, label: '5.00 m (Muur)' },
        ]
      );

      // 1 Tier 3 item + 3 Tier 1 items = 4 items
      expect(chains.length).toBe(4);

      const tier3 = chains.find((c) => c.tier === 3);
      expect(tier3).toBeDefined();
      expect(tier3!.dimensionMeters).toBe(10);
      expect(tier3!.offsetMeters).toBe(2.8);

      const tier1s = chains.filter((c) => c.tier === 1);
      expect(tier1s.length).toBe(3);
      expect(tier1s[0].offsetMeters).toBe(1.2);
    });
  });
});
