import earcut from 'earcut';
import { Point2D, Point3D } from './types';
import { Polygon2D } from './polygon';
import { Vector3D } from './vector';

export interface Triangulated3DFace {
  indices: number[];
  triangles: [Point3D, Point3D, Point3D][];
  normal: Vector3D;
}

export class Triangulation {
  /**
   * Triangulates a 2D polygon using earcut.
   * Returns an array of vertex indices (every 3 consecutive indices form a triangle).
   */
  static triangulate2D(vertices: Point2D[], holeIndices?: number[]): number[] {
    const flatCoords: number[] = [];
    for (const v of vertices) {
      flatCoords.push(v.x, v.y);
    }
    return earcut(flatCoords, holeIndices, 2);
  }

  /**
   * Triangulates a Polygon2D into an array of triangle point triplets.
   */
  static triangulatePolygon2D(polygon: Polygon2D): [Point2D, Point2D, Point2D][] {
    const indices = this.triangulate2D(polygon.vertices);
    const triangles: [Point2D, Point2D, Point2D][] = [];
    for (let i = 0; i < indices.length; i += 3) {
      triangles.push([
        polygon.vertices[indices[i]],
        polygon.vertices[indices[i + 1]],
        polygon.vertices[indices[i + 2]],
      ]);
    }
    return triangles;
  }

  /**
   * Computes the face normal for a 3D polygon using Newell's method.
   */
  static computeFaceNormal(vertices: Point3D[]): Vector3D {
    const n = vertices.length;
    if (n < 3) return new Vector3D(0, 0, 1);

    let nx = 0;
    let ny = 0;
    let nz = 0;

    for (let i = 0; i < n; i++) {
      const current = vertices[i];
      const next = vertices[(i + 1) % n];
      nx += (current.y - next.y) * (current.z + next.z);
      ny += (current.z - next.z) * (current.x + next.x);
      nz += (current.x - next.x) * (current.y + next.y);
    }

    const norm = new Vector3D(nx, ny, nz);
    return norm.normalize();
  }

  /**
   * Triangulates an arbitrary 3D planar face (e.g. CityJSON WallSurface or RoofSurface).
   * Projects onto best-fit plane, runs earcut, and returns original 3D triangles.
   */
  static triangulate3DFace(vertices: Point3D[]): Triangulated3DFace {
    const n = vertices.length;
    if (n < 3) {
      return { indices: [], triangles: [], normal: new Vector3D(0, 0, 1) };
    }

    const normal = this.computeFaceNormal(vertices);
    const absX = Math.abs(normal.x);
    const absY = Math.abs(normal.y);
    const absZ = Math.abs(normal.z);

    // Project onto 2D plane by dropping the axis with largest normal component
    const flatCoords: number[] = [];
    if (absZ >= absX && absZ >= absY) {
      // Normal mostly in Z -> project to XY plane (e.g. floors, flat roofs)
      for (const v of vertices) {
        flatCoords.push(v.x, v.y);
      }
    } else if (absY >= absX && absY >= absZ) {
      // Normal mostly in Y -> project to XZ plane
      for (const v of vertices) {
        flatCoords.push(v.x, v.z);
      }
    } else {
      // Normal mostly in X -> project to YZ plane
      for (const v of vertices) {
        flatCoords.push(v.y, v.z);
      }
    }

    const indices = earcut(flatCoords, undefined, 2);
    const triangles: [Point3D, Point3D, Point3D][] = [];

    for (let i = 0; i < indices.length; i += 3) {
      triangles.push([
        vertices[indices[i]],
        vertices[indices[i + 1]],
        vertices[indices[i + 2]],
      ]);
    }

    return {
      indices,
      triangles,
      normal,
    };
  }
}
