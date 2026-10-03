import { describe, it, expect } from 'vitest';
import {
  estimateFenestration,
  OpeningConfidence,
  OpeningType,
} from '@/domain/architectural/fenestration-estimator';

describe('FenestrationEstimator (Transparency Badges & User Overrides)', () => {
  const buildingContext = {
    frontWallSegment: {
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    },
    rearWallSegment: {
      start: { x: 10, y: 8 },
      end: { x: 0, y: 8 },
    },
    vboEntrancePoint: { x: 2.5, y: -0.5 }, // Entrance near x=2.5
    bgtCanopy: true,
    constructionYear: 1982,
    epOnlineGlassArea: 24.0, // 24 m² glass
    floorArea: 120.0,
  };

  it('should locate the front entrance door with high confidence at projected VBO point', () => {
    const fenestration = estimateFenestration(buildingContext);
    const frontEntrance = fenestration.openings.find(
      (o) => o.facade === 'front' && o.type === OpeningType.DOOR
    );

    expect(frontEntrance).toBeDefined();
    expect(frontEntrance?.confidence).toBe(OpeningConfidence.VERIFIED_HIGH);
    expect(frontEntrance?.position.x).toBeCloseTo(2.5, 1);
    expect(frontEntrance?.badgeText).toContain('Geverifieerd');
  });

  it('should classify rear facade openings as STATISTICAL_LOW (Bouwkundige benadering)', () => {
    const fenestration = estimateFenestration(buildingContext);
    const rearOpenings = fenestration.openings.filter((o) => o.facade === 'rear');

    expect(rearOpenings.length).toBeGreaterThan(0);
    rearOpenings.forEach((op) => {
      expect(op.confidence).toBe(OpeningConfidence.STATISTICAL_LOW);
      expect(op.badgeText).toContain('Bouwkundige benadering');
    });
  });

  it('should support interactive user override on the rear facade (e.g. Schuifpui)', () => {
    const override = {
      rearFacadeType: OpeningType.SCHUIFPUI,
      width: 3.6,
    };

    const fenestration = estimateFenestration(buildingContext, override);
    const rearPui = fenestration.openings.find(
      (o) => o.facade === 'rear' && o.type === OpeningType.SCHUIFPUI
    );

    expect(rearPui).toBeDefined();
    expect(rearPui?.width).toBe(3.6);
    expect(rearPui?.confidence).toBe(OpeningConfidence.USER_OVERRIDDEN);
  });
});
