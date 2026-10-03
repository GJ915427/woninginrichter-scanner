import { Point3D, Point2D } from '../geometry/types';

export interface SectionSliceOptions {
  centerPoint: Point2D;
  axisDirection: Point2D; // Richting van de snijlijn (bijv. loodrecht op nok)
}

export interface SectionProfileSegment {
  u1: number; // Horizontale as langs snede
  z1: number; // NAP Hoogte
  u2: number;
  z2: number;
  surfaceType: 'ROOF' | 'WALL' | 'GROUND';
}

export class CityJSONSectionCutter {
  /**
   * Voert een analytische doorsnede uit op een 3D CityJSON volume via segment-plane intersection
   */
  static cut3DVolume(
    surfaces: { polygon3D: Point3D[]; type: 'RoofSurface' | 'WallSurface' | 'GroundSurface' }[],
    options: SectionSliceOptions
  ): SectionProfileSegment[] {
    const { centerPoint, axisDirection } = options;

    // Snij-as normaliseren
    const uLen = Math.hypot(axisDirection.x, axisDirection.y);
    const ux = uLen > 1e-6 ? axisDirection.x / uLen : 1;
    const uy = uLen > 1e-6 ? axisDirection.y / uLen : 0;

    // Normaalvector op het verticale snijvlak: (-uy, ux, 0)
    const nx = -uy;
    const ny = ux;
    const planeD = -(nx * centerPoint.x + ny * centerPoint.y);

    const resultSegments: SectionProfileSegment[] = [];

    for (const surf of surfaces) {
      const ring = surf.polygon3D;
      const n = ring.length;
      if (n < 3) continue;

      const hitPoints: { u: number; z: number }[] = [];

      for (let i = 0; i < n; i++) {
        const p1 = ring[i];
        const p2 = ring[(i + 1) % n];

        const d1 = nx * p1.x + ny * p1.y + planeD;
        const d2 = nx * p2.x + ny * p2.y + planeD;

        // Snijdt het segment het vlak?
        if (d1 * d2 <= 0 && Math.abs(d1 - d2) > 1e-7) {
          const t = d1 / (d1 - d2);
          const qx = p1.x + t * (p2.x - p1.x);
          const qy = p1.y + t * (p2.y - p1.y);
          const qz = p1.z + t * (p2.z - p1.z);

          // Projecteer naar 2D snijstelsel (u = projectie langs as, z = NAP)
          const u = (qx - centerPoint.x) * ux + (qy - centerPoint.y) * uy;

          // Voorkom identieke opeenvolgende punten
          if (
            hitPoints.length === 0 ||
            Math.hypot(u - hitPoints[hitPoints.length - 1].u, qz - hitPoints[hitPoints.length - 1].z) > 1e-3
          ) {
            hitPoints.push({ u, z: qz });
          }
        }
      }

      // Koppel paren van snijpunten aan segmenten
      if (hitPoints.length >= 2) {
        const sType =
          surf.type === 'RoofSurface' ? 'ROOF' : surf.type === 'WallSurface' ? 'WALL' : 'GROUND';
        for (let k = 0; k + 1 < hitPoints.length; k += 2) {
          resultSegments.push({
            u1: hitPoints[k].u,
            z1: hitPoints[k].z,
            u2: hitPoints[k + 1].u,
            z2: hitPoints[k + 1].z,
            surfaceType: sType,
          });
        }
      }
    }

    return resultSegments;
  }
}
