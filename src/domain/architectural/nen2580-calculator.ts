import { Point2D, Point3D } from '../geometry/types';
import { Vector3D } from '../geometry/vector';

export interface RoofSegment2D {
  p1: Point2D; // x: afstand over snijlijn (meters), y: NAP hoogte (meters)
  p2: Point2D;
}

export interface ClearanceLineResult {
  zLevel: number;
  xHits: number[];
  usableWidthMeters: number;
}

export type AtticClassification =
  | 'GO_WONEN'
  | 'OIR_INSUFFICIENT_HEADROOM'
  | 'OIR_NO_DAYLIGHT'
  | 'OIR_VLIZO';

export interface AtticHeadroomEvaluation {
  floorId: string;
  atticFloorNAP: number;
  usable150Line: ClearanceLineResult; // NEN 2580 grens (1.50m stahoogte)
  verblijf260Line: ClearanceLineResult; // Bouwbesluit grens (2.60m verblijfsgebied)
  atticUsableRatio: number; // Percentage vloeroppervlak met >= 1.50m hoogte
  maxRidgeHeightM: number; // Vrije nokhoogte boven zoldervloer
  areaAbove150M2?: number; // Vloeroppervlak met >= 1.50m stahoogte
  areaAbove200M2?: number; // Vloeroppervlak met >= 2.00m stahoogte (BBMI eis >= 4.0m²)
  qualifiesAsGOWonen?: boolean;
  classification?: AtticClassification;
}

export class NEN2580Calculator {
  /**
   * Berekent de exacte snijlijnen van stahoogte (1.50m) en verblijfsgebied (2.60m)
   * voor een zolderverdieping onder een schuin dak.
   */
  static computeAtticHeadroom(
    floorId: string,
    atticFloorNAP: number,
    roofSegments: RoofSegment2D[],
    totalFloorWidth: number
  ): AtticHeadroomEvaluation {
    const z150 = atticFloorNAP + 1.5;
    const z260 = atticFloorNAP + 2.6;

    const xHits150 = this.findHorizontalIntersections(roofSegments, z150);
    const xHits260 = this.findHorizontalIntersections(roofSegments, z260);

    const usableWidth150 = this.calculateSpanBetweenHits(xHits150);
    const usableWidth260 = this.calculateSpanBetweenHits(xHits260);

    const ratio = totalFloorWidth > 0 ? Math.min(1.0, usableWidth150 / totalFloorWidth) : 0;

    let maxRoofZ = atticFloorNAP;
    for (const seg of roofSegments) {
      maxRoofZ = Math.max(maxRoofZ, seg.p1.y, seg.p2.y);
    }
    const maxRidgeHeightM = Math.max(0, maxRoofZ - atticFloorNAP);

    return {
      floorId,
      atticFloorNAP,
      usable150Line: {
        zLevel: z150,
        xHits: xHits150,
        usableWidthMeters: usableWidth150,
      },
      verblijf260Line: {
        zLevel: z260,
        xHits: xHits260,
        usableWidthMeters: usableWidth260,
      },
      atticUsableRatio: ratio,
      maxRidgeHeightM,
    };
  }

  /**
   * Evalueert een zolderverdieping conform de Branchebrede Meetinstructie (BBMI / NEN 2580):
   * - Hoogste punt >= 2.00m EN oppervlakte >= 2.00m stahoogte >= 4.00m²
   * - Voldoende daglicht (>= 0.50m² glasoppervlak)
   * - Vaste trap aanwezig
   */
  static evaluateAtticBBMI(
    atticFloorNAP: number,
    roofSegments: RoofSegment2D[],
    buildingDepthM: number,
    hasDaylight: boolean = true,
    hasFixedStairs: boolean = true
  ): {
    areaAbove150M2: number;
    areaAbove200M2: number;
    maxRidgeHeightM: number;
    qualifiesAsGOWonen: boolean;
    classification: AtticClassification;
  } {
    const z150 = atticFloorNAP + 1.5;
    const z200 = atticFloorNAP + 2.0;

    const xHits150 = this.findHorizontalIntersections(roofSegments, z150);
    const xHits200 = this.findHorizontalIntersections(roofSegments, z200);

    const width150 = this.calculateSpanBetweenHits(xHits150);
    const width200 = this.calculateSpanBetweenHits(xHits200);

    const areaAbove150M2 = Math.round(width150 * buildingDepthM * 100) / 100;
    const areaAbove200M2 = Math.round(width200 * buildingDepthM * 100) / 100;

    let maxRoofZ = atticFloorNAP;
    for (const seg of roofSegments) {
      maxRoofZ = Math.max(maxRoofZ, seg.p1.y, seg.p2.y);
    }
    const maxRidgeHeightM = Math.max(0, maxRoofZ - atticFloorNAP);

    let classification: AtticClassification = 'GO_WONEN';
    let qualifiesAsGOWonen = true;

    if (!hasFixedStairs) {
      classification = 'OIR_VLIZO';
      qualifiesAsGOWonen = false;
    } else if (maxRidgeHeightM < 2.0 || areaAbove200M2 < 4.0) {
      classification = 'OIR_INSUFFICIENT_HEADROOM';
      qualifiesAsGOWonen = false;
    } else if (!hasDaylight) {
      classification = 'OIR_NO_DAYLIGHT';
      qualifiesAsGOWonen = false;
    }

    return {
      areaAbove150M2,
      areaAbove200M2,
      maxRidgeHeightM,
      qualifiesAsGOWonen,
      classification,
    };
  }

  /**
   * Berekent het netto gebruiksoppervlakte (GO) met NEN 2580 regel voor vides/trapgaten:
   * Alleen vides en trapgaten met een opening >= 4.00 m² mogen worden afgetrokken!
   */
  static calculateNettoGO(brutoBinnenGO: number, openingenM2: number[]): number {
    let aftrek = 0;
    for (const opp of openingenM2) {
      if (opp >= 4.0) {
        aftrek += opp;
      }
    }
    return Math.max(0, Math.round((brutoBinnenGO - aftrek) * 100) / 100);
  }

  /**
   * Berekent het netto NEN 2580 gebruiksoppervlakte (GO Wonen) van een zolderverdieping
   */
  static calculateUsableArea(usableWidthMeters: number, buildingDepthMeters: number): number {
    return Math.round(usableWidthMeters * buildingDepthMeters * 100) / 100;
  }

  /**
   * Snijdt 3D dakvlakken met een verticaal vlak om de 2D profielsegmenten te genereren
   */
  static slice3DFacesWithPlane(
    roofFaces3D: Point3D[][],
    planeNormal: Vector3D,
    planeD: number,
    sectionOrigin: Point3D,
    sectionAxisU: Vector3D
  ): { p1: Point2D; p2: Point2D }[] {
    const segments: { p1: Point2D; p2: Point2D }[] = [];

    for (const face of roofFaces3D) {
      const intersections: Point3D[] = [];

      for (let i = 0; i < face.length; i++) {
        const p1 = face[i];
        const p2 = face[(i + 1) % face.length];

        const d1 = planeNormal.dot(new Vector3D(p1.x, p1.y, p1.z)) + planeD;
        const d2 = planeNormal.dot(new Vector3D(p2.x, p2.y, p2.z)) + planeD;

        if (d1 * d2 < 0) {
          const t = d1 / (d1 - d2);
          intersections.push({
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y),
            z: p1.z + t * (p2.z - p1.z),
          });
        } else if (Math.abs(d1) < 1e-6) {
          intersections.push(p1);
        }
      }

      if (intersections.length >= 2) {
        const u1 =
          new Vector3D(
            intersections[0].x - sectionOrigin.x,
            intersections[0].y - sectionOrigin.y,
            intersections[0].z - sectionOrigin.z
          ).dot(sectionAxisU);
        const z1 = intersections[0].z;

        const u2 =
          new Vector3D(
            intersections[1].x - sectionOrigin.x,
            intersections[1].y - sectionOrigin.y,
            intersections[1].z - sectionOrigin.z
          ).dot(sectionAxisU);
        const z2 = intersections[1].z;

        segments.push({
          p1: { x: u1, y: z1 },
          p2: { x: u2, y: z2 },
        });
      }
    }

    return segments;
  }

  static intersectHorizontalLine(
    segments: RoofSegment2D[] | Array<{ p1: { x: number; y: number }; p2: { x: number; y: number } }>,
    targetZ: number,
    _lineId?: string
  ): ClearanceLineResult {
    const xHits = this.findHorizontalIntersections(segments as RoofSegment2D[], targetZ);
    const usableWidthMeters = this.calculateSpanBetweenHits(xHits);
    return {
      zLevel: targetZ,
      xHits,
      usableWidthMeters,
    };
  }

  private static findHorizontalIntersections(segments: RoofSegment2D[], targetZ: number): number[] {
    const hits: number[] = [];

    for (const seg of segments) {
      const minZ = Math.min(seg.p1.y, seg.p2.y);
      const maxZ = Math.max(seg.p1.y, seg.p2.y);

      if (targetZ >= minZ - 1e-4 && targetZ <= maxZ + 1e-4) {
        if (Math.abs(seg.p2.y - seg.p1.y) < 1e-4) {
          hits.push(seg.p1.x, seg.p2.x);
        } else {
          const t = (targetZ - seg.p1.y) / (seg.p2.y - seg.p1.y);
          const xHit = seg.p1.x + t * (seg.p2.x - seg.p1.x);
          hits.push(xHit);
        }
      }
    }

    hits.sort((a, b) => a - b);
    const uniqueHits: number[] = [];
    for (const h of hits) {
      if (uniqueHits.length === 0 || Math.abs(h - uniqueHits[uniqueHits.length - 1]) > 0.01) {
        uniqueHits.push(h);
      }
    }

    return uniqueHits;
  }

  private static calculateSpanBetweenHits(hits: number[]): number {
    if (hits.length < 2) return 0;
    if (hits.length % 2 === 0) {
      let total = 0;
      for (let i = 0; i < hits.length; i += 2) {
        total += Math.max(0, hits[i + 1] - hits[i]);
      }
      return total;
    }
    return Math.max(0, hits[hits.length - 1] - hits[0]);
  }
}
