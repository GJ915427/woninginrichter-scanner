import { describe, it, expect } from 'vitest';
import { FloorBuilder } from '@/domain/architectural/floor-builder';

describe('FloorBuilder Unit Tests', () => {
  it('should generate 3 floors (BG, 1e Verdieping, Zolder) for standard row house (eaves >= 5.4m)', () => {
    const heights = {
      groundLevelNAP: 1.0,  // NAP +1.00m
      eavesHeightNAP: 6.8,  // Eaves NAP +6.80m (H_eaves = 5.80m)
      ridgeHeightNAP: 9.8,  // Ridge NAP +9.80m
      roofType: 'zadeldak',
    };

    const floors = FloorBuilder.buildFloors(heights);

    expect(floors.length).toBe(3);

    // Begane Grond
    expect(floors[0].id).toBe('floor_bg');
    expect(floors[0].name).toBe('Begane Grond');
    expect(floors[0].elevationNAP).toBe(1.15); // ground + 0.15m drempelpeil
    expect(floors[0].heightMeters).toBe(2.80);
    expect(floors[0].isGroundFloor).toBe(true);
    expect(floors[0].isAttic).toBe(false);

    // 1e Verdieping
    expect(floors[1].id).toBe('floor_1e');
    expect(floors[1].name).toBe('1e Verdieping');
    expect(floors[1].elevationNAP).toBe(3.95); // 1.15 + 2.80
    expect(floors[1].heightMeters).toBe(2.70);

    // Zolder
    expect(floors[2].id).toBe('floor_zolder');
    expect(floors[2].name).toBe('Zolder');
    expect(floors[2].elevationNAP).toBe(6.65); // 3.95 + 2.70
    expect(floors[2].isAttic).toBe(true);
    expect(floors[2].heightMeters).toBeCloseTo(3.15, 2); // 9.8 - 6.65 = 3.15m
  });

  it('should generate 2 floors (BG + Zolder) for 1-storey cottage (3.0m <= eaves < 5.4m)', () => {
    const heights = {
      groundLevelNAP: 0.0,
      eavesHeightNAP: 3.5,
      ridgeHeightNAP: 7.0,
      roofType: 'zadeldak',
    };

    const floors = FloorBuilder.buildFloors(heights);

    expect(floors.length).toBe(2);
    expect(floors[0].id).toBe('floor_bg');
    expect(floors[1].id).toBe('floor_zolder');
    expect(floors[1].elevationNAP).toBe(2.95); // 0.15 + 2.80
  });

  it('should NOT generate attic for flat-roofed building', () => {
    const heights = {
      groundLevelNAP: 0.0,
      eavesHeightNAP: 6.0,
      ridgeHeightNAP: 6.1, // Flat roof (ridge - eaves < 0.50m)
      roofType: 'plat',
    };

    const floors = FloorBuilder.buildFloors(heights);

    expect(floors.length).toBe(2);
    expect(floors.some((f) => f.isAttic)).toBe(false);
  });

  it('should generate single ground floor for low bungalow (eaves < 3.0m)', () => {
    const heights = {
      groundLevelNAP: 2.0,
      eavesHeightNAP: 4.6, // h_eaves = 2.6m
      ridgeHeightNAP: 4.8,
    };

    const floors = FloorBuilder.buildFloors(heights);
    expect(floors.length).toBe(1);
    expect(floors[0].isGroundFloor).toBe(true);
  });

  it('should format peil strings correctly', () => {
    expect(FloorBuilder.formatPeilString(1.15, 1.15)).toBe('P = 0.00');
    expect(FloorBuilder.formatPeilString(3.95, 1.15)).toBe('+2.80');
    expect(FloorBuilder.formatPeilString(1.00, 1.15)).toBe('-0.15');
  });
});
