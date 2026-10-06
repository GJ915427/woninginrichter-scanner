import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StreetViewViewer } from '@/components/map/StreetViewViewer';

describe('StreetViewViewer Component Unit Tests', () => {
  it('should render fallback or image when coordinates and heading are provided', () => {
    const html = renderToStaticMarkup(
      <StreetViewViewer
        lat={50.80529}
        lng={5.73351}
        heading={92}
        address="Rijksweg 153b, Gronsveld"
      />
    );

    expect(html).toContain('Street View &amp; Gevelbeeld');
    expect(html).toContain('Rijksweg 153b, Gronsveld');
    expect(html).toContain('data-testid="street-view-viewer"');
  });
});
