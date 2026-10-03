import { describe, it, expect } from 'vitest';
import { simplifyCollinearPoints, normalizePolygonOrientation, calculatePolygonArea } from '@/domain/architectural/polygon-simplifier';

describe('PolygonSimplifier (Port from google_maps_picker.html)', () => {
  it('should remove collinear points on straight wall segments within 4 degrees tolerance', () => {
    // A straight line from (0,0) to (10,0) with noisy intermediate points slightly displaced
    const noisyLine = [
      { x: 0, y: 0 },
      { x: 3, y: 0.05 }, // ~0.95 degrees deflection -> should be removed
      { x: 6, y: -0.05 }, // small deflection -> should be removed
      { x: 10, y: 0 },
      { x: 10, y: 8 },
      { x: 0, y: 8 },
    ];

    const simplified = simplifyCollinearPoints(noisyLine, 4.0);
    // Should remove the 2 intermediate collinear points and keep the 4 rectangle corners
    expect(simplified.length).toBe(4);
    expect(simplified[0]).toEqual({ x: 0, y: 0 });
    expect(simplified[1]).toEqual({ x: 10, y: 0 });
    expect(simplified[2]).toEqual({ x: 10, y: 8 });
    expect(simplified[3]).toEqual({ x: 0, y: 8 });
  });

  it('should preserve sharp 90-degree corners in L-shaped buildings', () => {
    const lShaped = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 6, y: 5 }, // 90 degree inside corner
      { x: 6, y: 10 }, // 90 degree inside corner
      { x: 0, y: 10 },
    ];

    const simplified = simplifyCollinearPoints(lShaped, 4.0);
    expect(simplified.length).toBe(6);
  });

  it('should calculate accurate Shoelace polygon area', () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 12 },
      { x: 0, y: 12 },
    ];
    const area = calculatePolygonArea(rect);
    expect(area).toBeCloseTo(96.0, 1);
  });

  it('should ensure counter-clockwise polygon orientation', () => {
    const clockwise = [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
    ];
    const ccw = normalizePolygonOrientation(clockwise);
    // Area of CCW should be positive
    const area = calculatePolygonArea(ccw);
    expect(area).toBeGreaterThan(0);
  });
});
