import { describe, it, expect } from 'vitest';
import { generateLegacyFloorplanSvg } from '@/domain/legacy/svg-floorplan-renderer';
import { Point2D } from '@/domain/legacy/collinear-simplifier';

describe('SVG Floorplan Renderer (Parity with google_maps_picker.html)', () => {
  // Rijksweg 153B shape: L-vormig pand met hoofdhuis vooraan en uitbouw achteraan
  const sampleBuildingPts: Point2D[] = [
    { x: 0, y: 0 },
    { x: 0, y: 6.07 },
    { x: 7.0, y: 6.07 },
    { x: 7.0, y: 13.07 },
    { x: 7.44, y: 13.07 },
    { x: 7.44, y: 0 },
  ];

  it('renders "2e VERDIEPING • OPBOUW (CONCEPT)" for composite roofs (auto mode with flat roof)', () => {
    const svg = generateLegacyFloorplanSvg({
      basePoints: sampleBuildingPts,
      frontWallIdx: 0,
      etageIndex: 2,
      wallThickness: 0.28,
      showInnerDimensions: true,
      showOuterDimensions: true,
      totalWoonoppervlakte: 173,
      roofType: 'auto',
      orientation: 'north',
      oppDakPlat: 72,
      oppDakSchuin: 104,
      isMandelig: true,
      mandeligWallIdx: 1,
    });

    // Moet OPBOUW renderen conform Screenshot 4, GEEN misvormde zadeldak zolder
    expect(svg).toContain('2e VERDIEPING • OPBOUW (CONCEPT)');
    expect(svg).not.toContain('ZOLDER / KAP (CONCEPT)');
    // Moet de mandelige muurarcering bevatten
    expect(svg).toContain('mandeliagHatch');
    // Moet de voorgevel straatindicator bevatten
    expect(svg).toContain('VOORZIJDE (STRAAT)');
  });

  it('renders "ZOLDER / KAP (CONCEPT)" only when roofType is explicitly slanted or pure slanted roof without flat roof', () => {
    const svg = generateLegacyFloorplanSvg({
      basePoints: sampleBuildingPts,
      frontWallIdx: 0,
      etageIndex: 2,
      wallThickness: 0.28,
      showInnerDimensions: true,
      showOuterDimensions: true,
      totalWoonoppervlakte: 173,
      roofType: 'slanted',
      orientation: 'north',
      oppDakPlat: 0,
      oppDakSchuin: 100,
    });

    expect(svg).toContain('ZOLDER / KAP (CONCEPT)');
  });

  it('renders Begane Grond with proper dimensions and outer path', () => {
    const svg = generateLegacyFloorplanSvg({
      basePoints: sampleBuildingPts,
      frontWallIdx: 0,
      etageIndex: 0,
      wallThickness: 0.28,
      showInnerDimensions: true,
      showOuterDimensions: true,
      totalWoonoppervlakte: 173,
      roofType: 'auto',
      orientation: 'north',
    });

    expect(svg).toContain('BEGANE GROND');
    expect(svg).toContain('VOORZIJDE (STRAAT)');
    expect(svg).toContain('<path');
  });
});
