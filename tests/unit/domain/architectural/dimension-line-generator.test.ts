import { describe, it, expect } from 'vitest';
import { generateDimensionLines } from '@/domain/architectural/dimension-line-generator';

describe('DimensionLineGenerator (Witness Lines & Metrical Annotations)', () => {
  const rectangle = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 8 },
    { x: 0, y: 8 },
  ];

  it('should generate 4 dimension line descriptors for a 4-sided polygon', () => {
    const dimLines = generateDimensionLines(rectangle, 0.6); // 60cm standoff
    expect(dimLines.length).toBe(4);
  });

  it('should format dimension lengths to two decimal places in meters', () => {
    const dimLines = generateDimensionLines(rectangle, 0.6);
    expect(dimLines[0].label).toBe('10.00 m');
    expect(dimLines[1].label).toBe('8.00 m');
    expect(dimLines[2].label).toBe('10.00 m');
    expect(dimLines[3].label).toBe('8.00 m');
  });

  it('should generate outward offset witness lines without overlapping the wall', () => {
    const dimLines = generateDimensionLines(rectangle, 0.6);
    // For bottom edge (0,0) to (10,0), normal points down (negative y)
    const bottomLine = dimLines[0];
    expect(bottomLine.midPoint.y).toBeLessThan(0);
    expect(bottomLine.start.y).toBeCloseTo(-0.6, 2);
    expect(bottomLine.end.y).toBeCloseTo(-0.6, 2);
  });
});
