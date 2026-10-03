// [SPEC-CHANGE-AUTHORIZED: Pure 1-on-1 migratie van google_maps_picker.html naar Next.js layout conform akkoord van de gebruiker (Google Action buttons Directions/Save/Nearby, permanent GoogleMapElement canvas, LegacyPlaceSidebar, FloorplanOverlay)]

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import HomePage from '@/app/page';

describe('HomePage Single-Screen Component (1-on-1 google_maps_picker.html layout)', () => {
  it('should render the floating PlaceSidebar container', () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain('id="placeSidebar"');
  });

  it('should render the full-screen Google Maps canvas container', () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain('id="googleMapElement"');
  });

  it('should render the 5 legacy Google action buttons', () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain('Directions');
    expect(html).toContain('Save');
    expect(html).toContain('Nearby');
    expect(html).toContain('Send to phone');
    expect(html).toContain('Share');
  });

  it('should render address search input in the sidebar', () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain('id="addressSearchInput"');
    expect(html).toContain('value="Rijksweg 153b"');
  });

  it('should render technical building specifications for default pand Rijksweg 153B', () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain('1969'); // Bouwjaar
    expect(html).toContain('173');  // m² woonoppervlakte
    expect(html).toContain('3 bouwlagen');
    expect(html).toContain('411');  // m² perceel
    expect(html).toContain('9.3');  // nokhoogte
  });

  it('should render mini floorplan container to open floorplan overlay', () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain('id="miniFloorplanContainer"');
    expect(html).toContain('id="floorplanFullView"');
  });
});
