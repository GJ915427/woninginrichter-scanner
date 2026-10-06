import { Point2D } from './collinear-simplifier';
import { FrontDoorDetector } from '../geometry/front-door-detector';

/**
 * 1-on-1 port of computeFloorGeometry from google_maps_picker.html,
 * enhanced with volumetric telemetry, VBO entrance point detection, and DKK boundaries.
 * For etageIndex === 0: returns base contour.
 * For compound buildings (n > 4, floorRatio < 0.85): isolates the street-side main volume.
 * Returns vertices in standard polygon traversal order: [pA, pB, pB + inN * depth, pA + inN * depth],
 * where edge 0 is front wall (width), edge 1 is side wall (depth), etc.
 */
export function computeFloorGeometry(
  basePoints: Point2D[],
  frontIdx: number,
  etageIndex: number,
  totalWoonoppervlakte: number,
  wallThickness: number = 0.28,
  bag3d?: {
    volumes?: Array<{ hMax: number; hMin: number; hoogteBoven: number }>;
    oppGrond?: number | null;
    vboEntrancePoint?: [number, number] | Point2D;
    dkkPerceel?: { polygonRD?: Array<[number, number]> };
  }
): Point2D[] {
  if (etageIndex === 0 || !basePoints || basePoints.length < 3) {
    return basePoints.map((p) => ({ ...p }));
  }

  const n = basePoints.length;
  let bgFootprintArea = 0;
  for (let i = 0; i < n; i++) {
    const next = basePoints[(i + 1) % n];
    bgFootprintArea += basePoints[i].x * next.y - next.x * basePoints[i].y;
  }
  bgFootprintArea = Math.abs(bgFootprintArea) / 2;

  // Netto binnenoppervlakte Begane Grond (binnenmaten na aftrek spouwdikte)
  const approxBgInner = bgFootprintArea * 0.88;
  const upperRemainingTotal =
    totalWoonoppervlakte && totalWoonoppervlakte > 20
      ? Math.max(0, totalWoonoppervlakte - approxBgInner)
      : bgFootprintArea * 0.65;

  // Indien er meerdere bovenbouwlagen zijn (bijv. 1e verdieping + kap/zolder)
  const numUpperFloors =
    upperRemainingTotal > approxBgInner * 0.85
      ? Math.max(1, Math.round(upperRemainingTotal / (approxBgInner * 0.7)))
      : 1;
  const upperRemainingArea = upperRemainingTotal / numUpperFloors;

  const floorRatio = upperRemainingArea / approxBgInner;

  // Eenvoudige rechthoek of volledige 2e bouwlaag (rijtjeswoning / 2 volledige verdiepingen)
  if (n <= 4 || floorRatio >= 0.85) {
    return basePoints.map((p) => ({ ...p }));
  }

  // Samengesteld pand met 1-laags aanbouw (hoofdvolume aan straatzijde, zoals Rijksweg 153b)
  if (frontIdx < 0 || frontIdx >= n) {
    if (bag3d?.vboEntrancePoint) {
      const vboPt: [number, number] = Array.isArray(bag3d.vboEntrancePoint)
        ? [bag3d.vboEntrancePoint[0], bag3d.vboEntrancePoint[1]]
        : [bag3d.vboEntrancePoint.x, bag3d.vboEntrancePoint.y];
      const result = FrontDoorDetector.detectFrontWall({
        footprintCoords: basePoints.map((p) => [p.x, p.y]),
        vboEntrancePoint: vboPt,
      });
      frontIdx = result.frontWallIndex;
    } else {
      frontIdx = 0;
    }
  }

  const pA = basePoints[frontIdx];
  const pB = basePoints[(frontIdx + 1) % n];
  const vx = pB.x - pA.x;
  const vy = pB.y - pA.y;
  const fLen = Math.hypot(vx, vy);

  // Binnenbreedte van het hoofdvolume
  const wInner = Math.max(2.0, fLen - 2 * wallThickness);
  // Benodigde binnendiepte van het hoofdvolume om het resterende BAG-woonoppervlak te vullen:
  const dInner = upperRemainingArea > 15 && wInner > 2 ? upperRemainingArea / wInner : 5.44;

  // Buitenwerks diepte (inclusief 2x spouwmuur):
  let depth = dInner + 2 * wallThickness;

  // LoD 1.3 / LoD 2.2 volume-gebaseerde diepteverfijning (3D BAG feitelijke geometrie)
  if (bag3d && bag3d.volumes && bag3d.volumes.length >= 2) {
    const mainVol = bag3d.volumes[bag3d.volumes.length - 1];
    const aanbouwVol = bag3d.volumes[0];
    const mainH = mainVol.hoogteBoven || 8.9;
    const aanbouwH = aanbouwVol.hoogteBoven || 3.9;
    if (mainH > aanbouwH * 1.4 && bag3d.oppGrond && fLen > 2) {
      const bag3dDepth = upperRemainingArea / wInner + 2 * wallThickness;
      if (bag3dDepth >= 4.0 && bag3dDepth <= 12.0) {
        depth = bag3dDepth;
      }
    }
  }

  // Bouwkundige dieptebegrenzing voor hoofdvolume bij samengestelde panden met aanbouw:
  // Detecteer of de footprint een werkelijke goot- of muursprong heeft (bijv. 8.0m voor Rijksweg 153B)
  const pPrev = basePoints[(frontIdx - 1 + n) % n];
  const leftLen = Math.hypot(pPrev.x - pA.x, pPrev.y - pA.y);
  const pNext2 = basePoints[(frontIdx + 2) % n];
  const rightLen = Math.hypot(pNext2.x - pB.x, pNext2.y - pB.y);

  if (leftLen >= 4.5 && leftLen <= 12.0 && Math.abs(leftLen - depth) < 2.0) {
    depth = leftLen;
  } else if (rightLen >= 4.5 && rightLen <= 12.0 && Math.abs(rightLen - depth) < 2.0) {
    depth = rightLen;
  } else {
    depth = Math.max(5.0, Math.min(8.0, depth));
  }

  const ux = vx / fLen;
  const uy = vy / fLen;
  const nx1 = -uy;
  const ny1 = ux;
  const cx = basePoints.reduce((s, p) => s + p.x, 0) / n;
  const cy = basePoints.reduce((s, p) => s + p.y, 0) / n;
  const dot1 = (cx - (pA.x + pB.x) / 2) * nx1 + (cy - (pA.y + pB.y) / 2) * ny1;
  const inNx = dot1 >= 0 ? nx1 : -nx1;
  const inNy = dot1 >= 0 ? ny1 : -ny1;

  // 4-hoekig zuiver hoofdvolume langs de straatgevel in polygon-volgorde:
  // pA -> pB -> pB + inN * depth -> pA + inN * depth
  return [
    { x: pA.x, y: pA.y },
    { x: pB.x, y: pB.y },
    { x: pB.x + inNx * depth, y: pB.y + inNy * depth },
    { x: pA.x + inNx * depth, y: pA.y + inNy * depth },
  ];
}
