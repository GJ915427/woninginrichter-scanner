import { BuildingHeightAttributes, FloorLevel } from './types';

export interface FloorBuilderConfig {
  drempelpeilOffset?: number;     // Finished floor above ground NAP, default 0.15m
  minAtticClearance?: number;     // Min height from attic floor to ridge to count as attic floor, default 2.00m
  standardGroundFloorHeight?: number; // default 2.80m
  standardUpperFloorHeight?: number;  // default 2.70m
}

export class FloorBuilder {
  /**
   * Generates dynamic architectural floor levels from AHN elevation datum,
   * eaves height, and ridge height.
   */
  static buildFloors(
    heights: BuildingHeightAttributes,
    config: FloorBuilderConfig = {}
  ): FloorLevel[] {
    const drempelpeil = config.drempelpeilOffset ?? 0.15;
    const minAtticClearance = config.minAtticClearance ?? 2.00;
    const stdGroundH = config.standardGroundFloorHeight ?? 2.80;
    const stdUpperH = config.standardUpperFloorHeight ?? 2.70;

    const zGround = heights.groundLevelNAP;
    const zBg = zGround + drempelpeil;

    // Use eaves height if available, otherwise ridge height
    const zEaves = heights.eavesHeightNAP ?? heights.ridgeHeightNAP ?? (zBg + stdGroundH);
    const zRidge = heights.ridgeHeightNAP ?? zEaves;

    const hEaves = Math.max(0, zEaves - zGround);
    const roofRise = Math.max(0, zRidge - zEaves);
    const isFlatRoof = roofRise < 0.50;

    const floors: FloorLevel[] = [];

    // 1. Begane Grond is always present
    if (hEaves >= 5.40) {
      // 2 full storeys (Begane Grond + 1e Verdieping)
      floors.push({
        id: 'floor_bg',
        name: 'Begane Grond',
        elevationNAP: Math.round(zBg * 100) / 100,
        heightMeters: stdGroundH,
        isGroundFloor: true,
        isAttic: false,
      });

      const z1e = zBg + stdGroundH;
      floors.push({
        id: 'floor_1e',
        name: '1e Verdieping',
        elevationNAP: Math.round(z1e * 100) / 100,
        heightMeters: stdUpperH,
        isGroundFloor: false,
        isAttic: false,
      });

      // Check attic
      const zAttic = z1e + stdUpperH;
      const atticHeadroom = zRidge - zAttic;
      if (!isFlatRoof && atticHeadroom >= minAtticClearance) {
        floors.push({
          id: 'floor_zolder',
          name: 'Zolder',
          elevationNAP: Math.round(zAttic * 100) / 100,
          heightMeters: Math.round(atticHeadroom * 100) / 100,
          isGroundFloor: false,
          isAttic: true,
        });
      }
    } else if (hEaves >= 3.00) {
      // 1 full storey (Begane Grond) + potential Attic
      floors.push({
        id: 'floor_bg',
        name: 'Begane Grond',
        elevationNAP: Math.round(zBg * 100) / 100,
        heightMeters: stdGroundH,
        isGroundFloor: true,
        isAttic: false,
      });

      const zAttic = zBg + stdGroundH;
      const atticHeadroom = zRidge - zAttic;
      if (!isFlatRoof && atticHeadroom >= minAtticClearance) {
        floors.push({
          id: 'floor_zolder',
          name: 'Zolder',
          elevationNAP: Math.round(zAttic * 100) / 100,
          heightMeters: Math.round(atticHeadroom * 100) / 100,
          isGroundFloor: false,
          isAttic: true,
        });
      }
    } else {
      // Single storey / Bungalow
      const bgHeight = Math.max(2.40, Math.min(stdGroundH, zRidge - zBg));
      floors.push({
        id: 'floor_bg',
        name: 'Begane Grond',
        elevationNAP: Math.round(zBg * 100) / 100,
        heightMeters: Math.round(bgHeight * 100) / 100,
        isGroundFloor: true,
        isAttic: false,
      });
    }

    return floors;
  }

  /**
   * Formats relative elevation (peil) string e.g. "+2.80" or "0.00" or "-0.15".
   */
  static formatPeilString(elevationNAP: number, groundFloorNAP: number): string {
    const rel = elevationNAP - groundFloorNAP;
    if (Math.abs(rel) < 0.005) {
      return 'P = 0.00';
    }
    const sign = rel > 0 ? '+' : '';
    return `${sign}${rel.toFixed(2)}`;
  }
}
