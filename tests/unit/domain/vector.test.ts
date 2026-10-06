import { describe, it, expect } from 'vitest';
import { Vector2D, Vector3D, Matrix3x3 } from '@/domain/geometry/vector';

describe('Vector2D Unit Tests', () => {
  it('should construct, add, sub, and scale correctly', () => {
    const v1 = new Vector2D(3, 4);
    const v2 = new Vector2D(1, 2);

    const sum = v1.add(v2);
    expect(sum.x).toBe(4);
    expect(sum.y).toBe(6);

    const diff = v1.sub(v2);
    expect(diff.x).toBe(2);
    expect(diff.y).toBe(2);

    const scaled = v1.scale(2.5);
    expect(scaled.x).toBe(7.5);
    expect(scaled.y).toBe(10);
  });

  it('should compute dot product and 2D cross product correctly', () => {
    const v1 = new Vector2D(1, 0);
    const v2 = new Vector2D(0, 1);

    expect(v1.dot(v2)).toBe(0); // Orthogonal
    expect(v1.cross(v2)).toBe(1); // v2 is 90 deg CCW from v1
    expect(v2.cross(v1)).toBe(-1); // Anti-commutative
  });

  it('should compute length and handle zero-vector normalization', () => {
    const v = new Vector2D(3, 4);
    expect(v.length()).toBe(5);
    expect(v.lengthSq()).toBe(25);

    const normalized = v.normalize();
    expect(normalized.length()).toBeCloseTo(1.0, 6);
    expect(normalized.x).toBeCloseTo(0.6, 6);
    expect(normalized.y).toBeCloseTo(0.8, 6);

    const zero = new Vector2D(0, 0);
    expect(zero.normalize().length()).toBe(0);
  });

  it('should compute distance and angles', () => {
    const p1 = new Vector2D(0, 0);
    const p2 = new Vector2D(3, 4);
    expect(p1.distanceTo(p2)).toBe(5);

    const vRight = new Vector2D(1, 0);
    const vUp = new Vector2D(0, 1);
    expect(vRight.angleTo(vUp)).toBeCloseTo(Math.PI / 2, 6);
  });

  it('should rotate vectors correctly', () => {
    const v = new Vector2D(1, 0);
    const rotated90 = v.rotate(Math.PI / 2);
    expect(rotated90.x).toBeCloseTo(0, 6);
    expect(rotated90.y).toBeCloseTo(1, 6);

    const rotated180 = v.rotate(Math.PI);
    expect(rotated180.x).toBeCloseTo(-1, 6);
    expect(rotated180.y).toBeCloseTo(0, 6);
  });

  it('should compute CW and CCW normals', () => {
    const v = new Vector2D(1, 0); // pointing right
    const normCW = v.normalCW();
    expect(normCW.x).toBeCloseTo(0, 6);
    expect(normCW.y).toBeCloseTo(-1, 6); // pointing down

    const normCCW = v.normalCCW();
    expect(normCCW.x).toBeCloseTo(0, 6);
    expect(normCCW.y).toBeCloseTo(1, 6); // pointing up
  });
});

describe('Vector3D Unit Tests', () => {
  it('should compute 3D cross product and dot product', () => {
    const vx = new Vector3D(1, 0, 0);
    const vy = new Vector3D(0, 1, 0);

    const vz = vx.cross(vy);
    expect(vz.x).toBe(0);
    expect(vz.y).toBe(0);
    expect(vz.z).toBe(1);

    expect(vz.dot(vx)).toBe(0);
    expect(vz.dot(vy)).toBe(0);
  });

  it('should normalize and compute distance in 3D', () => {
    const v = new Vector3D(2, 3, 6);
    expect(v.length()).toBe(7); // sqrt(4 + 9 + 36) = 7

    const norm = v.normalize();
    expect(norm.length()).toBeCloseTo(1.0, 6);
    expect(norm.z).toBeCloseTo(6 / 7, 6);
  });
});

describe('Matrix3x3 Unit Tests', () => {
  it('should transform 2D points via identity, translation, rotation, and scale', () => {
    const p = { x: 5, y: 10 };

    // Identity
    const pIdent = Matrix3x3.identity().transformPoint(p);
    expect(pIdent.x).toBe(5);
    expect(pIdent.y).toBe(10);

    // Translation
    const T = Matrix3x3.translation(10, -5);
    const pTrans = T.transformPoint(p);
    expect(pTrans.x).toBe(15);
    expect(pTrans.y).toBe(5);

    // Rotation 90 deg CCW
    const R = Matrix3x3.rotation(Math.PI / 2);
    const pRot = R.transformPoint(p);
    expect(pRot.x).toBeCloseTo(-10, 6);
    expect(pRot.y).toBeCloseTo(5, 6);

    // Scale
    const S = Matrix3x3.scaling(2, 3);
    const pScale = S.transformPoint(p);
    expect(pScale.x).toBe(10);
    expect(pScale.y).toBe(30);
  });

  it('should compose transformations and invert correctly', () => {
    const M = Matrix3x3.compose(20, 30, Math.PI / 4, 2, 2);
    const pOriginal = { x: 3, y: 7 };

    const pTransformed = M.transformPoint(pOriginal);
    const M_inv = M.invert();
    expect(M_inv).not.toBeNull();

    const pRecovered = M_inv!.transformPoint(pTransformed);
    expect(pRecovered.x).toBeCloseTo(pOriginal.x, 5);
    expect(pRecovered.y).toBeCloseTo(pOriginal.y, 5);
  });
});
