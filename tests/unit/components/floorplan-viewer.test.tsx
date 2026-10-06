import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BENCHMARK_TYPOLOGIES,
  BENCHMARK_TYPOLOGY_MAP,
} from '@/fixtures/benchmark-typologies';
import { FloorplanViewer } from '@/components/floorplan/FloorplanViewer';

describe('FloorplanViewer Component', () => {
  it('should render SVG element with proper data-testid', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    const html = renderToStaticMarkup(<FloorplanViewer typology={typology} />);

    expect(html).toContain('data-testid="floorplan-svg"');
    expect(html).toContain('data-testid="target-building-polygon"');
  });

  it('should render VOORGEVEL badge at front facade for rijwoning_tussen', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    const html = renderToStaticMarkup(<FloorplanViewer typology={typology} />);

    expect(html).toContain('data-testid="voorgevel-badge"');
    expect(html).toContain('VOORGEVEL');
  });

  it('should render party wall hatching pattern for rijwoning_tussen', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    const html = renderToStaticMarkup(<FloorplanViewer typology={typology} />);

    expect(html).toContain('id="party-wall-hatch"');
    expect(html).toContain('url(#party-wall-hatch)');
  });

  it('should not render party wall hatching for vrijstaande_villa', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['vrijstaande_villa'];
    const html = renderToStaticMarkup(<FloorplanViewer typology={typology} />);

    // In SVG definitions pattern exists, but no line should have stroke="url(#party-wall-hatch)"
    expect(html).not.toContain('stroke="url(#party-wall-hatch)"');
  });

  it('should render room boundaries and labels with polylabel positioning', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    const html = renderToStaticMarkup(<FloorplanViewer typology={typology} />);

    expect(html).toContain('Woonkamer');
    expect(html).toContain('Keuken');
    expect(html).toContain('Entree / Hal');
    expect(html).toContain('Toilet');
  });

  it('should render door arcs and swing geometry', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    const html = renderToStaticMarkup(<FloorplanViewer typology={typology} />);

    expect(html).toContain('door-group');
  });

  it('should render dimension chains with meter labels', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    const html = renderToStaticMarkup(<FloorplanViewer typology={typology} />);

    expect(html).toContain('dimension-chain');
    expect(html).toContain('5.40 m');
    expect(html).toContain('9.60 m');
  });

  it('should render without errors for all 5 benchmark typologies', () => {
    for (const typology of BENCHMARK_TYPOLOGIES) {
      const html = renderToStaticMarkup(<FloorplanViewer typology={typology} />);
      expect(html).toBeTruthy();
      expect(html).toContain('data-testid="floorplan-svg"');
      expect(html).toContain('data-testid="target-building-polygon"');
      expect(html).toContain('VOORGEVEL');
    }
  });

  it('should render zoom and reset control buttons', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    const html = renderToStaticMarkup(<FloorplanViewer typology={typology} />);

    expect(html).toContain('data-testid="zoom-in-button"');
    expect(html).toContain('data-testid="zoom-out-button"');
    expect(html).toContain('data-testid="reset-view-button"');
  });
});
