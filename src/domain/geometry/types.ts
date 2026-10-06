export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Segment2D {
  p1: Point2D;
  p2: Point2D;
}

export interface Segment3D {
  p1: Point3D;
  p2: Point3D;
}

export interface BoundingBox2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface BoundingBox3D {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  width: number;
  depth: number;
  height: number;
}

export type WindingOrder = 'CW' | 'CCW';

export interface Intersection2D {
  point: Point2D;
  t: number; // Parametric t along segment 1 [0, 1]
  u: number; // Parametric u along segment 2 [0, 1]
}

export type Matrix3x3Array = [
  number, number, number,
  number, number, number,
  number, number, number
];
