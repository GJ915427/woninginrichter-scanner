/**
 * PolygonSimplifier - Collinear noise reduction and polygon normalization.
 * Ported and enhanced from google_maps_picker.html (simplifyCollinearPoints).
 */

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Calculates the signed area of a polygon using the Shoelace formula.
 * Positive = Counter-Clockwise (CCW), Negative = Clockwise (CW).
 */
export function calculatePolygonArea(points: Point2D[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2.0;
}

/**
 * Ensures counter-clockwise (CCW) orientation for standard architectural projection.
 */
export function normalizePolygonOrientation(points: Point2D[]): Point2D[] {
  if (points.length < 3) return points;
  const area = calculatePolygonArea(points);
  if (area < 0) {
    // Clockwise -> reverse to make CCW
    return [...points].reverse();
  }
  return [...points];
}

/**
 * Removes intermediate points on straight walls within a angular threshold (default 4.0 degrees).
 * Preserves sharp corners, recesses, and 90-degree facade steps.
 */
export function simplifyCollinearPoints(points: Point2D[], angleThresholdDeg = 4.0): Point2D[] {
  if (points.length <= 3) return points;

  const thresholdRad = (angleThresholdDeg * Math.PI) / 180.0;
  const result: Point2D[] = [];
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;

    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);

    if (len1 < 1e-6 || len2 < 1e-6) {
      // Degenerate zero-length segment, skip point
      continue;
    }

    const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
    // Clamp dot product to valid range [-1, 1] to prevent NaN from floating point inaccuracies
    const clampedDot = Math.max(-1.0, Math.min(1.0, dot));
    const angle = Math.acos(clampedDot);

    // If angle exceeds threshold, it is an architectural corner -> keep it
    if (angle > thresholdRad) {
      result.push(curr);
    }
  }

  return result.length >= 3 ? result : points;
}
