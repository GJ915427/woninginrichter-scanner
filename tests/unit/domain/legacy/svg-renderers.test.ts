import { describe, it, expect } from 'vitest';
import { generateLegacyFloorplanSvg } from '@/domain/legacy/svg-floorplan-renderer';
import { generateLegacySectionSvg } from '@/domain/legacy/svg-section-renderer';

describe('Legacy SVG Renderers (1-on-1 port from google_maps_picker.html)', () => {
  const samplePts = [
    { x: 0, y: 0 },
    { x: 6.06, y: 0 },
    { x: 6.06, y: 18.25 },
    { x: 0, y: 18.25 },
  ];

  it('should generate SVG with wall outlines and dimension lines', () => {
    const svg = generateLegacyFloorplanSvg({
      basePoints: samplePts,
      frontWallIdx: 0,
      wallThickness: 0.28,
      showInnerDimensions: true,
      showOuterDimensions: true,
      etageIndex: 0,
      totalWoonoppervlakte: 173,
      isMandelig: true,
      mandeligWallIdx: 3,
    });

    expect(svg).toContain('<svg');
    expect(svg).toContain('BEGANE GROND');
    expect(svg).toContain('VOORZIJDE (STRAAT)');
  });

  it('should generate Section SVG with nok, goot and NEN 2580 headroom line', () => {
    const svg = generateLegacySectionSvg({
      basePoints: samplePts,
      frontWallIdx: 0,
      totalWoonoppervlakte: 173,
      nokhoogte: 9.3,
      goothoogte: 5.8,
      bouwlagen: 3,
    });

    expect(svg).toContain('<svg');
    expect(svg).toContain('9.30m');
    expect(svg).toContain('NEN 2580');
    expect(svg).toContain('STRAAT (VOORGEVEL)');
  });
});
