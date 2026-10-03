import { describe, it, expect } from 'vitest';
import { simplifyCollinearPoints } from '@/domain/legacy/collinear-simplifier';

describe('Legacy Collinear Simplifier (1-on-1 port from google_maps_picker.html)', () => {
  it('should remove collinear points on a straight wall within 4.0 degrees', () => {
    // A rectangle with an extra midpoint on the top edge: (0,0) -> (5,0) -> (10,0) -> (10,5) -> (0,5)
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ];

    const simplified = simplifyCollinearPoints(points, 4.0);
    expect(simplified).toHaveLength(4);
    expect(simplified).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ]);
  });

  it('should preserve real corners that deviate more than maxAngleDeg', () => {
    // An L-shape with a 90 degree corner
    const lShape = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ];

    const simplified = simplifyCollinearPoints(lShape, 4.0);
    expect(simplified).toHaveLength(6);
  });

  it('should handle small duplicate points with length < 1e-4', () => {
    const pointsWithDuplicate = [
      { x: 0, y: 0 },
      { x: 0.00001, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ];

    const simplified = simplifyCollinearPoints(pointsWithDuplicate, 4.0);
    expect(simplified).toHaveLength(4);
  });
});
