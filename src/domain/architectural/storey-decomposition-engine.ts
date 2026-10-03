import { Point2D, calculatePolygonArea, normalizePolygonOrientation } from './polygon-simplifier';
import { computeInwardWallOffset } from './wall-offset-engine';

export enum StoreyLevel {
  BEGANE_GROND = 'begane_grond',
  EERSTE_VERDIEPING = 'eerste_verdieping',
  TWEEDE_VERDIEPING = 'tweede_verdieping',
  ZOLDER = 'zolder',
}

export interface RoofSurfaceData {
  id: string;
  normal: [number, number, number];
  minZ: number;
  maxZ: number;
  isFlat: boolean;
  polygon2D: Point2D[];
}

export interface StoreyDescriptor {
  level: StoreyLevel;
  name: string;
  polygon: Point2D[];
  area: number;
  hasExtension: boolean;
  isSlopedRoof: boolean;
  elevationZ: number;
}

export interface DecomposeStoreysParams {
  footprint: Point2D[];
  roofSurfaces: RoofSurfaceData[];
  eaveHeight: number;
  ridgeHeight: number;
  groundHeight: number;
  totalFloorArea?: number;
}

/**
 * Decomposes a building into storeys using 3D BAG LoD 2.2 semantic roof Z-splits.
 * Detects 1-storey flat-roof extensions and excludes them from upper floors.
 * Calculates NEN 2580 1.50m clearance zone under sloped roof planes.
 */
export function decomposeStoreys(params: DecomposeStoreysParams): StoreyDescriptor[] {
  const { footprint, roofSurfaces, eaveHeight, ridgeHeight, groundHeight } = params;
  const normalizedFootprint = normalizePolygonOrientation(footprint);
  const totalFootprintArea = calculatePolygonArea(normalizedFootprint);

  // 1. Detect flat-roof extension from 3D BAG roof surfaces
  // An extension has a flat normal (z near 1.0) and a maximum height below the main eave height
  const extensionSurfaces = roofSurfaces.filter(
    (r) => (r.isFlat || Math.abs(r.normal[2]) > 0.9) && r.maxZ < eaveHeight - 0.5
  );

  const hasExtension = extensionSurfaces.length > 0;
  let mainVolumePolygon = normalizedFootprint;

  if (hasExtension) {
    // Find extension bounding x-range or polygon
    // The main volume is the footprint minus the extension
    const extPoly = extensionSurfaces[0].polygon2D;
    const minExtX = Math.min(...extPoly.map((p) => p.x));
    const maxExtX = Math.max(...extPoly.map((p) => p.x));
    const minExtY = Math.min(...extPoly.map((p) => p.y));
    const maxExtY = Math.max(...extPoly.map((p) => p.y));

    // If extension is at the right side (x >= minExtX)
    const isExtensionRight = minExtX > 2.0;
    if (isExtensionRight) {
      // Main volume spans from x=0 to x=minExtX
      const maxY = Math.max(...normalizedFootprint.map((p) => p.y));
      const minY = Math.min(...normalizedFootprint.map((p) => p.y));
      mainVolumePolygon = [
        { x: 0, y: minY },
        { x: minExtX, y: minY },
        { x: minExtX, y: maxY },
        { x: 0, y: maxY },
      ];
    }
  }

  const mainVolumeArea = calculatePolygonArea(mainVolumePolygon);

  const isRoofSloped = roofSurfaces.some(
    (r) => !r.isFlat && Math.abs(r.normal[2]) < 0.95
  ) && ridgeHeight > eaveHeight + 0.8;

  const storeys: StoreyDescriptor[] = [];

  // Level 0: Begane Grond (Full footprint)
  storeys.push({
    level: StoreyLevel.BEGANE_GROND,
    name: 'Begane Grond',
    polygon: normalizedFootprint,
    area: totalFootprintArea,
    hasExtension,
    isSlopedRoof: false,
    elevationZ: groundHeight,
  });

  // Level 1: 1e Verdieping (Main volume only, extension excluded)
  storeys.push({
    level: StoreyLevel.EERSTE_VERDIEPING,
    name: '1e Verdieping',
    polygon: mainVolumePolygon,
    area: mainVolumeArea,
    hasExtension: false,
    isSlopedRoof: false,
    elevationZ: groundHeight + 2.8,
  });

  // Level 2: Zolder / Kaplaag
  if (isRoofSloped) {
    // Calculate NEN 2580 1.50m clearance line
    // Inset proportional to roof slope
    const roofRise = ridgeHeight - eaveHeight;
    const roofRun = Math.max(2.0, Math.sqrt(mainVolumeArea) / 2.0);
    const slopeTan = roofRise / roofRun;
    // Clearance offset: 1.50m / slopeTan
    const clearanceOffset = Math.min(1.8, Math.max(0.6, 1.5 / Math.max(0.5, slopeTan)));
    const atticPolygon = computeInwardWallOffset(mainVolumePolygon, clearanceOffset);

    storeys.push({
      level: StoreyLevel.ZOLDER,
      name: 'Zolder / Kaplaag (NEN 2580 >1.50m)',
      polygon: atticPolygon,
      area: calculatePolygonArea(atticPolygon),
      hasExtension: false,
      isSlopedRoof: true,
      elevationZ: groundHeight + 5.6,
    });
  } else {
    // Flat roof: full top floor without sloped cuts
    storeys.push({
      level: StoreyLevel.ZOLDER,
      name: 'Bovenste Bouwlaag',
      polygon: mainVolumePolygon,
      area: mainVolumeArea,
      hasExtension: false,
      isSlopedRoof: false,
      elevationZ: groundHeight + 5.6,
    });
  }

  return storeys;
}
