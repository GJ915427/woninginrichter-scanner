import { describe, it, expect } from 'vitest';
import { WallAssemblyEngine } from '@/domain/architectural/wall-assembly-engine';

describe('WallAssemblyEngine Unit Tests', () => {
  it('should return solid masonry specification for pre-1920 buildings', () => {
    const spec = WallAssemblyEngine.getSpecification(1910);
    expect(spec.totalFacadeThicknessM).toBe(0.24);
    expect(spec.cavityM).toBe(0.0);
    expect(WallAssemblyEngine.getInwardOffset(false, spec)).toBe(0.24);
    expect(WallAssemblyEngine.getInwardOffset(true, spec)).toBe(0.11);
  });

  it('should return acoustic party wall with 145mm offset for post-1980 buildings', () => {
    const spec = WallAssemblyEngine.getSpecification(1995);
    expect(spec.totalFacadeThicknessM).toBe(0.33);
    expect(spec.partyWallThicknessM).toBe(0.29);
    expect(WallAssemblyEngine.getInwardOffset(true, spec)).toBeCloseTo(0.145, 3);
  });

  it('should return BENG/BBL compliant envelope for 2020 buildings', () => {
    const spec = WallAssemblyEngine.getSpecification(2022);
    expect(spec.totalFacadeThicknessM).toBeGreaterThanOrEqual(0.40);
    expect(spec.rcValue).toBeGreaterThanOrEqual(4.5);
  });
});
