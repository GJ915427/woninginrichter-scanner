import { Point2D, Point3D } from '../geometry/types';
import { Vector3D } from '../geometry/vector';

export type RoofEdgeType =
  | 'RIDGE' // Noklijn (horizontaal, convex)
  | 'HIP' // Hoekkeper (hellend, convex)
  | 'VALLEY' // Kilkeper (hellend, concaaf)
  | 'EAVES' // Gootlijn / Dakvoet (horizontaal, onderrand)
  | 'VERGE' // Windveer / Gevelrand (hellend, buitenrand)
  | 'DORMER_EDGE'; // Dakkapel contour

export interface ClassifiedRoofEdge {
  p1: Point3D;
  p2: Point3D;
  type: RoofEdgeType;
  slopeDeg: number;
  elevationZ: number;
  faceIndices: [number, number?];
}

export interface RoofPlaneMetadata {
  faceIndex: number;
  normal: Vector3D;
  pitchDeg: number;
  azimuthDeg: number;
  drainVector2D: Point2D;
  isFlat: boolean;
  isDormer: boolean;
  vertices3D: Point3D[];
  projected2D: Point2D[];
}

export class RoofPlanEngine {
  /**
   * Berekent de vlaknormaal via Newell's methode
   */
  static computeNewellNormal(vertices: Point3D[]): Vector3D {
    let nx = 0;
    let ny = 0;
    let nz = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const cur = vertices[i];
      const next = vertices[(i + 1) % n];
      nx += (cur.y - next.y) * (cur.z + next.z);
      ny += (cur.z - next.z) * (cur.x + next.x);
      nz += (cur.x - next.x) * (cur.y + next.y);
    }
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-6) return new Vector3D(0, 0, 1);
    // Zorg dat normaal omhoog wijst (buitenzijde dak)
    const sign = nz < 0 ? -1 : 1;
    return new Vector3D((nx / len) * sign, (ny / len) * sign, (nz / len) * sign);
  }

  /**
   * Analyseert een collectie 3D BAG dakvlakken en classificeert alle daklijnen
   */
  static reconstructRoofPlan(roofFaces: Point3D[][]): {
    planes: RoofPlaneMetadata[];
    edges: ClassifiedRoofEdge[];
  } {
    const planes: RoofPlaneMetadata[] = [];
    const edgeMap = new Map<string, { p1: Point3D; p2: Point3D; faces: number[] }>();

    // 1. Analyseer elk dakvlak
    roofFaces.forEach((face, idx) => {
      const normal = this.computeNewellNormal(face);
      const pitchDeg = Math.round(Math.acos(Math.min(1, Math.max(0, normal.z))) * (180 / Math.PI) * 10) / 10;
      const isFlat = pitchDeg < 5.0;

      // Drain richting (valpijl in 2D)
      const drainLen = Math.hypot(normal.x, normal.y);
      const drainVector2D: Point2D =
        drainLen > 1e-4
          ? { x: -normal.x / drainLen, y: -normal.y / drainLen }
          : { x: 0, y: 0 };

      const azimuthDeg = Math.round(
        (Math.atan2(drainVector2D.x, drainVector2D.y) * (180 / Math.PI) + 360) % 360
      );

      // 2D Footprint oppervlakte
      let area2D = 0;
      for (let i = 0; i < face.length; i++) {
        const j = (i + 1) % face.length;
        area2D += face[i].x * face[j].y - face[j].x * face[i].y;
      }
      area2D = Math.abs(area2D) * 0.5;

      const isDormer = area2D >= 1.2 && area2D <= 10.0 && pitchDeg > 0;

      planes.push({
        faceIndex: idx,
        normal,
        pitchDeg,
        azimuthDeg,
        drainVector2D,
        isFlat,
        isDormer,
        vertices3D: face,
        projected2D: face.map((p) => ({ x: p.x, y: p.y })),
      });

      // 2. Registreer ribben in Adjacency Map
      for (let i = 0; i < face.length; i++) {
        const p1 = face[i];
        const p2 = face[(i + 1) % face.length];
        const key = this.getEdgeKey(p1, p2);

        if (!edgeMap.has(key)) {
          edgeMap.set(key, { p1, p2, faces: [idx] });
        } else {
          edgeMap.get(key)!.faces.push(idx);
        }
      }
    });

    // 3. Classificeer elke ribbe
    const classifiedEdges: ClassifiedRoofEdge[] = [];

    edgeMap.forEach(({ p1, p2, faces }) => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dz = p2.z - p1.z;
      const len3D = Math.hypot(dx, dy, dz);
      if (len3D < 0.08) return; // filter micro-segmenten

      const slope = Math.abs(dz) / len3D;
      const isHorizontal = slope < 0.08; // < 4.5 graden helling
      const midZ = (p1.z + p2.z) / 2;

      let edgeType: RoofEdgeType = 'VERGE';

      if (faces.length >= 2) {
        const f1 = planes[faces[0]];
        const f2 = planes[faces[1]];

        if (f1.isDormer || f2.isDormer) {
          edgeType = 'DORMER_EDGE';
        } else if (isHorizontal) {
          edgeType = 'RIDGE';
        } else {
          // Convexiteitstest voor Hoekkeper (Hip) vs Kilkeper (Valley)
          const uEdge = new Vector3D(dx / len3D, dy / len3D, dz / len3D);
          const crossNorm = f1.normal.cross(f2.normal);
          const dihedralScore = crossNorm.dot(uEdge);
          edgeType = dihedralScore >= 0 ? 'HIP' : 'VALLEY';
        }
      } else {
        // Enkelzijdig daksegment: Eaves (dakvoet) of Verge (windveer)
        edgeType = isHorizontal ? 'EAVES' : 'VERGE';
      }

      classifiedEdges.push({
        p1,
        p2,
        type: edgeType,
        slopeDeg: Math.round(Math.asin(slope) * (180 / Math.PI)),
        elevationZ: midZ,
        faceIndices: [faces[0], faces[1]],
      });
    });

    return { planes, edges: classifiedEdges };
  }

  private static getEdgeKey(p1: Point3D, p2: Point3D): string {
    const round = (n: number) => (Math.round(n * 25) / 25).toFixed(2);
    const k1 = `${round(p1.x)},${round(p1.y)},${round(p1.z)}`;
    const k2 = `${round(p2.x)},${round(p2.y)},${round(p2.z)}`;
    return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
  }
}
