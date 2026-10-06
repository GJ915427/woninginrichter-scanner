import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BENCHMARK_TYPOLOGIES,
  BENCHMARK_TYPOLOGY_MAP,
} from '@/fixtures/benchmark-typologies';
import { InspectionChips } from '@/components/ui/InspectionChips';

describe('InspectionChips Component', () => {
  it('should render all 5 inspection chips for rijwoning_tussen', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    const html = renderToStaticMarkup(<InspectionChips typology={typology} />);

    expect(html).toContain('Voorgevel:');
    expect(html).toContain('Mandelige muur:');
    expect(html).toContain('AHN5 Maaiveld:');
    expect(html).toContain('+0.85m NAP');
    expect(html).toContain('NEN 2580:');
    expect(html).toContain('3D BAG:');
    expect(html).toContain('LoD2.2');
  });

  it('should display 0% (Vrijstaand) for vrijstaande_villa', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['vrijstaande_villa'];
    const html = renderToStaticMarkup(<InspectionChips typology={typology} />);

    expect(html).toContain('0% (Vrijstaand)');
    expect(html).toContain('+6.50m NAP');
  });

  it('should render chips for all 5 benchmark typologies without crashing', () => {
    for (const typology of BENCHMARK_TYPOLOGIES) {
      const html = renderToStaticMarkup(<InspectionChips typology={typology} />);
      expect(html).toBeTruthy();
      expect(html).toContain('Voorgevel:');
      expect(html).toContain('NEN 2580:');
      expect(html).toContain('AHN5 Maaiveld:');
    }
  });

  it('should apply active styling when activeFilter is set', () => {
    const typology = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    const html = renderToStaticMarkup(
      <InspectionChips typology={typology} activeFilter="voorgevel" />
    );

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('bg-brand');
  });
});
