import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BENCHMARK_TYPOLOGIES,
  BENCHMARK_TYPOLOGY_MAP,
} from '@/fixtures/benchmark-typologies';
import { CrossSectionViewer } from '@/components/cross-section/CrossSectionViewer';

describe('CrossSectionViewer Component', () => {
  it('should render cross-section SVG with proper data-testid', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    const html = renderToStaticMarkup(<CrossSectionViewer typology={typology} />);

    expect(html).toContain('data-testid="cross-section-svg"');
  });

  it('should render ground datum (AHN5) and drempelpeil lines', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    const html = renderToStaticMarkup(<CrossSectionViewer typology={typology} />);

    expect(html).toContain('data-testid="ground-datum-line"');
    expect(html).toContain('data-testid="drempelpeil-line"');
  });

  it('should render roof profile polyline conforming to typology', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    const html = renderToStaticMarkup(<CrossSectionViewer typology={typology} />);

    expect(html).toContain('data-testid="roof-profile-line"');
  });

  it('should render dynamic floor slabs and names', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    const html = renderToStaticMarkup(<CrossSectionViewer typology={typology} />);

    expect(html).toContain('Begane Grond');
    expect(html).toContain('1e Verdieping');
    expect(html).toContain('floor-slab');
  });

  it('should render dashed NEN 2580 clearance lines (1.50m & 2.60m)', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    const html = renderToStaticMarkup(<CrossSectionViewer typology={typology} />);

    expect(html).toContain('data-testid="nen-150-line"');
    expect(html).toContain('data-testid="nen-260-line"');
  });

  it('should render 1D vertical stacked elevation labels with jogged leader lines', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    const html = renderToStaticMarkup(<CrossSectionViewer typology={typology} />);

    expect(html).toContain('vertical-label-group');
    expect(html).toContain('Maaiveld:');
    expect(html).toContain('Peil = 0.00');
    expect(html).toContain('NEN 2580 GO Wonen');
  });

  it('should render without errors for all 5 benchmark typologies', () => {
    for (const typology of BENCHMARK_TYPOLOGIES) {
      const html = renderToStaticMarkup(<CrossSectionViewer typology={typology} />);
      expect(html).toBeTruthy();
      expect(html).toContain('data-testid="cross-section-svg"');
      expect(html).toContain('data-testid="ground-datum-line"');
      expect(html).toContain('data-testid="drempelpeil-line"');
    }
  });

  it('should render zoom and reset control buttons', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    const html = renderToStaticMarkup(<CrossSectionViewer typology={typology} />);

    expect(html).toContain('data-testid="cs-zoom-in-button"');
    expect(html).toContain('data-testid="cs-zoom-out-button"');
    expect(html).toContain('data-testid="cs-reset-view-button"');
  });
});
