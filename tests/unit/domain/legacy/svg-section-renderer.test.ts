import { describe, it, expect } from 'vitest';
import { generateLegacySectionSvg } from '@/domain/legacy/svg-section-renderer';
import { Point2D } from '@/domain/legacy/collinear-simplifier';

describe('SVG Section Renderer (ViewBox & Height Chain Parity)', () => {
  const sampleBuildingPts: Point2D[] = [
    { x: 0, y: 0 },
    { x: 0, y: 6.07 },
    { x: 7.0, y: 6.07 },
    { x: 7.0, y: 13.07 },
    { x: 7.44, y: 13.07 },
    { x: 7.44, y: 0 },
  ];

  it('generates an unclipped SVG viewBox with left boundary <= -7.0', () => {
    const svg = generateLegacySectionSvg({
      basePoints: sampleBuildingPts,
      frontWallIdx: 0,
      totalWoonoppervlakte: 173,
      nokhoogte: 9.3,
      goothoogte: 5.8,
      bouwlagen: 3,
      goothoogteAanbouw: 3.7,
    });

    // Extract viewBox="x y w h"
    const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
    expect(viewBoxMatch).not.toBeNull();
    const [minX, minY, width, height] = viewBoxMatch![1].split(/\s+/).map(Number);

    // De linker viewBox-grens moet minimaal -7.0 zijn om peillabels tot -6.94m te accomoderen
    expect(minX).toBeLessThanOrEqual(-7.0);
    expect(minY).toBe(0.0);
    expect(height).toBe(12.2);
    expect(width).toBeGreaterThanOrEqual(25.0);
  });

  it('contains full peilketting labels and street indicators', () => {
    const svg = generateLegacySectionSvg({
      basePoints: sampleBuildingPts,
      frontWallIdx: 0,
      totalWoonoppervlakte: 173,
      nokhoogte: 9.3,
      goothoogte: 5.8,
      bouwlagen: 3,
      goothoogteAanbouw: 3.7,
    });

    expect(svg).toContain('+9.30m Nok');
    expect(svg).toContain('+5.80m Goot / Zolder');
    expect(svg).toContain('+2.80m 1e Verd.');
    expect(svg).toContain('0.00m Peil (Maaiveld)');
    expect(svg).toContain('◀ STRAAT (VOORGEVEL)');
    expect(svg).toContain('ACHTERTUIN ▶');
    expect(svg).toContain('+3.70m Plat dak');
  });
});
