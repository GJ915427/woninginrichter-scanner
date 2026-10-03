import { Point2D, normalizePolygonOrientation } from './polygon-simplifier';

export interface DimensionLineDescriptor {
  id: string;
  start: Point2D;
  end: Point2D;
  midPoint: Point2D;
  length: number;
  label: string;
  angleDeg: number;
  witnessLines: [
    { from: Point2D; to: Point2D },
    { from: Point2D; to: Point2D }
  ];
}

/**
 * Generates metrical architectural dimension lines offset outward from polygon edges.
 * Includes witness lines (hulplijnen), ticks, and formatted text labels.
 */
export function generateDimensionLines(
  polygon: Point2D[],
  standoffDistance = 0.6
): DimensionLineDescriptor[] {
  if (polygon.length < 3) return [];

  // Guarantee CCW orientation so outward normal is (-dy, dx) reversed: (dy, -dx)
  const poly = normalizePolygonOrientation(polygon);
  const n = poly.length;
  const dimensionLines: DimensionLineDescriptor[] = [];

  for (let i = 0; i < n; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % n];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.hypot(dx, dy);

    if (length < 0.1) continue; // Skip negligible segments

    // Outward normal for CCW polygon edge (dx, dy):
    // Inward was (-dy, dx) / length, so Outward is (dy, -dx) / length
    const outNx = dy / length;
    const outNy = -dx / length;

    // Offset line
    const offsetStart: Point2D = {
      x: p1.x + outNx * standoffDistance,
      y: p1.y + outNy * standoffDistance,
    };
    const offsetEnd: Point2D = {
      x: p2.x + outNx * standoffDistance,
      y: p2.y + outNy * standoffDistance,
    };

    const midPoint: Point2D = {
      x: (offsetStart.x + offsetEnd.x) / 2.0,
      y: (offsetStart.y + offsetEnd.y) / 2.0,
    };

    let angleDeg = (Math.atan2(dy, dx) * 180.0) / Math.PI;
    // Keep text readable right-side up
    if (angleDeg > 90 || angleDeg < -90) {
      angleDeg += 180;
    }

    dimensionLines.push({
      id: `dim-${i}`,
      start: offsetStart,
      end: offsetEnd,
      midPoint,
      length,
      label: `${length.toFixed(2)} m`,
      angleDeg,
      witnessLines: [
        { from: p1, to: offsetStart },
        { from: p2, to: offsetEnd },
      ],
    });
  }

  return dimensionLines;
}
