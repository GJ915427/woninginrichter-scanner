export interface Point2D {
  x: number;
  y: number;
}

/**
 * 1-on-1 port of simplifyCollinearPoints from google_maps_picker.html.
 * Removes collinear points on a polygon perimeter when the angle deviation < maxAngleDeg (default 4.0°)
 * or when segment lengths are < 1e-4.
 */
export function simplifyCollinearPoints(points: Point2D[], maxAngleDeg: number = 4.0): Point2D[] {
  const res = [...points];
  let changed = true;
  while (changed && res.length > 3) {
    changed = false;
    const len = res.length;
    for (let i = 0; i < len; i++) {
      const pPrev = res[(i - 1 + len) % len];
      const pCurr = res[i];
      const pNext = res[(i + 1) % len];
      const v1x = pCurr.x - pPrev.x;
      const v1y = pCurr.y - pPrev.y;
      const l1 = Math.hypot(v1x, v1y);
      const v2x = pNext.x - pCurr.x;
      const v2y = pNext.y - pCurr.y;
      const l2 = Math.hypot(v2x, v2y);
      if (l1 < 1e-4 || l2 < 1e-4) {
        res.splice(i, 1);
        changed = true;
        break;
      }
      const dot = (v1x * v2x + v1y * v2y) / (l1 * l2);
      const cross = (v1x * v2y - v1y * v2x) / (l1 * l2);
      const ang = Math.abs((Math.atan2(cross, dot) * 180) / Math.PI);
      if (ang < maxAngleDeg) {
        res.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return res;
}
