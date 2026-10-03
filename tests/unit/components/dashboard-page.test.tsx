// [SPEC-CHANGE-AUTHORIZED: Migratie van statische benchmark dashboard-page naar de door de gebruiker geaccordeerde single-screen PlaceSidebar/ViewerCanvas layout conform google_maps_picker.html]

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import HomePage from '@/app/page';

describe('HomePage Single-Screen Component (google_maps_picker.html layout)', () => {
  it('should render the floating PlaceSidebar container', () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain('id="placeSidebar"');
  });

  it('should render the 5 modern circular view buttons (Screenshot 1 replacement)', () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain('2D Plan');
    expect(html).toContain('Doorsnede');
    expect(html).toContain('3D Model');
    expect(html).toContain('Street View');
    expect(html).toContain('Satelliet');
  });

  it('should render address search input in the sidebar', () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain('placeholder="Zoek een adres of postcode');
  });

  it('should render the zero-hallucination empty state prompt when no building is loaded', () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain('Woninginrichter 3D Scanner');
    expect(html).toContain('Zoek linksboven een adres of postcode');
    expect(html).toContain('Rijksweg 153b, Gronsveld');
  });

  it('should render technical building specifications section', () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain('Bouwkundige Specificaties');
    expect(html).toContain('Footprint Oppervlakte');
    expect(html).toContain('Dak &amp; Hoogtemetingen');
  });
});
