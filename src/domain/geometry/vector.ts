import { Point2D, Point3D, Matrix3x3Array } from './types';

export class Vector2D implements Point2D {
  constructor(public x: number = 0, public y: number = 0) {}

  static fromPoint(p: Point2D): Vector2D {
    return new Vector2D(p.x, p.y);
  }

  static fromPoints(start: Point2D, end: Point2D): Vector2D {
    return new Vector2D(end.x - start.x, end.y - start.y);
  }

  clone(): Vector2D {
    return new Vector2D(this.x, this.y);
  }

  add(other: Point2D): Vector2D {
    return new Vector2D(this.x + other.x, this.y + other.y);
  }

  sub(other: Point2D): Vector2D {
    return new Vector2D(this.x - other.x, this.y - other.y);
  }

  scale(factor: number): Vector2D {
    return new Vector2D(this.x * factor, this.y * factor);
  }

  dot(other: Point2D): number {
    return this.x * other.x + this.y * other.y;
  }

  /**
   * 2D Cross product (returns the z-component of the 3D cross product).
   * Positive if 'other' is counter-clockwise from 'this'.
   */
  cross(other: Point2D): number {
    return this.x * other.y - this.y * other.x;
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  length(): number {
    return Math.hypot(this.x, this.y);
  }

  normalize(): Vector2D {
    const len = this.length();
    if (len < 1e-12) {
      return new Vector2D(0, 0);
    }
    return new Vector2D(this.x / len, this.y / len);
  }

  distanceTo(other: Point2D): number {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }

  distanceSqTo(other: Point2D): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return dx * dx + dy * dy;
  }

  /**
   * Returns outward normal assuming clockwise polygon edge (y, -x) normalized.
   */
  normalCW(): Vector2D {
    const u = this.normalize();
    return new Vector2D(u.y, -u.x);
  }

  /**
   * Returns normal assuming counter-clockwise polygon edge (-y, x) normalized.
   */
  normalCCW(): Vector2D {
    const u = this.normalize();
    return new Vector2D(-u.y, u.x);
  }

  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  /**
   * Angle between this vector and another vector in radians [0, PI].
   */
  angleTo(other: Point2D): number {
    const l1 = this.length();
    const l2 = Math.hypot(other.x, other.y);
    if (l1 < 1e-12 || l2 < 1e-12) return 0;
    const cosAngle = Math.max(-1, Math.min(1, this.dot(other) / (l1 * l2)));
    return Math.acos(cosAngle);
  }

  rotate(radians: number): Vector2D {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return new Vector2D(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  lerp(target: Point2D, t: number): Vector2D {
    return new Vector2D(
      this.x + (target.x - this.x) * t,
      this.y + (target.y - this.y) * t
    );
  }

  equals(other: Point2D, epsilon: number = 1e-7): boolean {
    return (
      Math.abs(this.x - other.x) <= epsilon &&
      Math.abs(this.y - other.y) <= epsilon
    );
  }

  toArray(): [number, number] {
    return [this.x, this.y];
  }
}

export class Vector3D implements Point3D {
  constructor(public x: number = 0, public y: number = 0, public z: number = 0) {}

  static fromPoint(p: Point3D): Vector3D {
    return new Vector3D(p.x, p.y, p.z);
  }

  static fromPoints(start: Point3D, end: Point3D): Vector3D {
    return new Vector3D(end.x - start.x, end.y - start.y, end.z - start.z);
  }

  clone(): Vector3D {
    return new Vector3D(this.x, this.y, this.z);
  }

  add(other: Point3D): Vector3D {
    return new Vector3D(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  sub(other: Point3D): Vector3D {
    return new Vector3D(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  scale(factor: number): Vector3D {
    return new Vector3D(this.x * factor, this.y * factor, this.z * factor);
  }

  dot(other: Point3D): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  cross(other: Point3D): Vector3D {
    return new Vector3D(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x
    );
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  length(): number {
    return Math.hypot(this.x, this.y, this.z);
  }

  normalize(): Vector3D {
    const len = this.length();
    if (len < 1e-12) {
      return new Vector3D(0, 0, 0);
    }
    return new Vector3D(this.x / len, this.y / len, this.z / len);
  }

  distanceTo(other: Point3D): number {
    return Math.hypot(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  lerp(target: Point3D, t: number): Vector3D {
    return new Vector3D(
      this.x + (target.x - this.x) * t,
      this.y + (target.y - this.y) * t,
      this.z + (target.z - this.z) * t
    );
  }

  equals(other: Point3D, epsilon: number = 1e-7): boolean {
    return (
      Math.abs(this.x - other.x) <= epsilon &&
      Math.abs(this.y - other.y) <= epsilon &&
      Math.abs(this.z - other.z) <= epsilon
    );
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }
}

/**
 * 3x3 Matrix for 2D Affine Transformations in Homogeneous Coordinates:
 * [ m00, m01, m02 ]
 * [ m10, m11, m12 ]
 * [ m20, m21, m22 ]
 */
export class Matrix3x3 {
  public elements: Matrix3x3Array;

  constructor(elements?: Matrix3x3Array) {
    this.elements = elements || [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ];
  }

  static identity(): Matrix3x3 {
    return new Matrix3x3([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ]);
  }

  static translation(tx: number, ty: number): Matrix3x3 {
    return new Matrix3x3([
      1, 0, tx,
      0, 1, ty,
      0, 0, 1
    ]);
  }

  static rotation(radians: number): Matrix3x3 {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return new Matrix3x3([
      cos, -sin, 0,
      sin,  cos, 0,
      0,    0,   1
    ]);
  }

  static scaling(sx: number, sy: number = sx): Matrix3x3 {
    return new Matrix3x3([
      sx, 0,  0,
      0,  sy, 0,
      0,  0,  1
    ]);
  }

  static compose(tx: number, ty: number, radians: number, sx: number = 1, sy: number = 1): Matrix3x3 {
    const T = Matrix3x3.translation(tx, ty);
    const R = Matrix3x3.rotation(radians);
    const S = Matrix3x3.scaling(sx, sy);
    return T.multiply(R).multiply(S);
  }

  multiply(other: Matrix3x3): Matrix3x3 {
    const a = this.elements;
    const b = other.elements;
    const out: Matrix3x3Array = [0, 0, 0, 0, 0, 0, 0, 0, 0];

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        out[row * 3 + col] =
          a[row * 3 + 0] * b[0 * 3 + col] +
          a[row * 3 + 1] * b[1 * 3 + col] +
          a[row * 3 + 2] * b[2 * 3 + col];
      }
    }
    return new Matrix3x3(out);
  }

  transformPoint(p: Point2D): Vector2D {
    const m = this.elements;
    const x = m[0] * p.x + m[1] * p.y + m[2];
    const y = m[3] * p.x + m[4] * p.y + m[5];
    const w = m[6] * p.x + m[7] * p.y + m[8];
    if (Math.abs(w - 1.0) > 1e-12 && Math.abs(w) > 1e-12) {
      return new Vector2D(x / w, y / w);
    }
    return new Vector2D(x, y);
  }

  transformVector(v: Point2D): Vector2D {
    const m = this.elements;
    const x = m[0] * v.x + m[1] * v.y;
    const y = m[3] * v.x + m[4] * v.y;
    return new Vector2D(x, y);
  }

  determinant(): number {
    const m = this.elements;
    return (
      m[0] * (m[4] * m[8] - m[5] * m[7]) -
      m[1] * (m[3] * m[8] - m[5] * m[6]) +
      m[2] * (m[3] * m[7] - m[4] * m[6])
    );
  }

  invert(): Matrix3x3 | null {
    const m = this.elements;
    const det = this.determinant();
    if (Math.abs(det) < 1e-12) return null;

    const invDet = 1 / det;
    const out: Matrix3x3Array = [
      (m[4] * m[8] - m[5] * m[7]) * invDet,
      (m[2] * m[7] - m[1] * m[8]) * invDet,
      (m[1] * m[5] - m[2] * m[4]) * invDet,

      (m[5] * m[6] - m[3] * m[8]) * invDet,
      (m[0] * m[8] - m[2] * m[6]) * invDet,
      (m[2] * m[3] - m[0] * m[5]) * invDet,

      (m[3] * m[7] - m[4] * m[6]) * invDet,
      (m[1] * m[6] - m[0] * m[7]) * invDet,
      (m[0] * m[4] - m[1] * m[3]) * invDet,
    ];
    return new Matrix3x3(out);
  }
}
