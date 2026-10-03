import { Point2D, normalizePolygonOrientation } from './polygon-simplifier';

/**
 * Returns typical exterior wall thickness in meters based on the construction year
 * according to historical Dutch building regulations (Bouwbesluit / NEN).
 */
export function getTypicalWallThickness(constructionYear?: number): number {
  if (!constructionYear || isNaN(constructionYear)) return 0.30;
  if (constructionYear < 1930) return 0.22; // Steensmuur (solid brick)
  if (constructionYear < 1975) return 0.28; // Ongeisoleerde spouwmuur (early cavity)
  if (constructionYear < 2000) return 0.32; // Matig geisoleerde spouw
  return 0.38; // Hoogwaardig geisoleerde spouwmuur (Rc >= 4.5)
}

/**
 * Offsets a polygon inward by `thickness` meters along vertex bisector vectors.
 * Implements miter-limiting to prevent acute angle spikes and self-intersections.
 */
export function computeInwardWallOffset(
  exteriorPolygon: Point2D[],
  thickness: number
): Point2D[] {
  if (exteriorPolygon.length < 3) return exteriorPolygon;

  // Guarantee CCW orientation
  const poly = normalizePolygonOrientation(exteriorPolygon);
  const n = poly.length;
  const interior: Point2D[] = [];

  // 1. Calculate edge inward normals for CCW polygon
  // Edge i goes from poly[i] to poly[(i+1)%n]
  // Inward normal for CCW segment (dx, dy) is (-dy, dx) / length
  const edgeNormals: { nx: number; ny: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % n];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);

    if (len < 1e-6) {
      edgeNormals.push({ nx: 0, ny: 1 });
    } else {
      edgeNormals.push({
        nx: -dy / len,
        ny: dx / len,
      });
    }
  }

  // 2. Compute vertex bisector displacement with miter-limiting
  for (let i = 0; i < n; i++) {
    const prevEdgeIdx = (i - 1 + n) % n;
    const currEdgeIdx = i;

    const nPrev = edgeNormals[prevEdgeIdx];
    const nCurr = edgeNormals[currEdgeIdx];

    // Bisector vector
    const bx = nPrev.nx + nCurr.nx;
    const by = nPrev.ny + nCurr.ny;
    const bLen = Math.hypot(bx, by);

    if (bLen < 1e-5) {
      // 180-degree straight segment or collinear
      interior.push({
        x: poly[i].x + nCurr.nx * thickness,
        y: poly[i].y + nCurr.ny * thickness,
      });
      continue;
    }

    const unitBx = bx / bLen;
    const unitBy = by / bLen;

    // cos(angle / 2) between bisector and either normal
    const cosHalfAngle = unitBx * nCurr.nx + unitBy * nCurr.ny;
    
    // Miter limit: maximum extension multiplier (default 2.0 to prevent runaway spikes on acute angles)
    const miterLimit = 2.0;
    const miterFactor = cosHalfAngle > 0.1 ? Math.min(1.0 / cosHalfAngle, miterLimit) : miterLimit;

    interior.push({
      x: poly[i].x + unitBx * thickness * miterFactor,
      y: poly[i].y + unitBy * thickness * miterFactor,
    });
  }

  return interior;
}
