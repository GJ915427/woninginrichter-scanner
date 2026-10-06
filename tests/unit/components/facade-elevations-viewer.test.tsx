import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FacadeElevationsViewer } from '@/components/facade/FacadeElevationsViewer';

describe('FacadeElevationsViewer Component Unit Tests', () => {
  it('should render facade elevations viewer with tabs and SVG canvas', () => {
    const mockFacadeData = {
      orientation: 'Voorgevel (Oost)',
      groundNAP: 45.2,
      drempelNAP: 45.35,
      gutterNAP: 50.8,
      ridgeNAP: 54.8,
      widthMeters: 6.5,
      heightMeters: 9.6,
      floorsCount: 3,
      hasDoor: true,
      windowsCount: 4,
    };

    const html = renderToStaticMarkup(
      <FacadeElevationsViewer
        facadeData={mockFacadeData}
        address="Rijksweg 153b, Gronsveld"
      />
    );

    expect(html).toContain('data-testid="facade-elevations-viewer"');
    expect(html).toContain('Gevelaanzichten');
    expect(html).toContain('Voorgevel');
    expect(html).toContain('Achtergevel');
    expect(html).toContain('Rijksweg 153b, Gronsveld');
  });
});
