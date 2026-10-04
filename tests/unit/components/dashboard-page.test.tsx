// [SPEC-CHANGE-AUTHORIZED: Geautoriseerd door gebruiker: eliminatie hardcoded default adres Rijksweg 153B naar dynamische device geolocation en vervanging Google actieknoppen door 5 weergaveknoppen (2D Plan, Doorsnede, 3D Model, Street View, Satelliet)]

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import HomePage from '@/app/page';
import { LegacyPlaceSidebar } from '@/components/legacy/LegacyPlaceSidebar';
import { LegacyBuildingState } from '@/domain/legacy/legacy-state-adapter';

describe('HomePage Single-Screen Component (Zero-Mock & Dynamic State)', () => {
  it('should render the floating PlaceSidebar container', () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain('id="placeSidebar"');
  });

  it('should render the full-screen Google Maps canvas container', () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain('id="googleMapElement"');
  });

  it('should render address search input ready for user entry (without hardcoded initial value)', () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain('id="addressSearchInput"');
    expect(html).not.toContain('value="Rijksweg 153b"');
  });

  it('should render welcoming empty state when no building is yet selected', () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain('Kies een woning');
  });

  it('should render the 5 view action buttons when a building is loaded', () => {
    const sampleState: LegacyBuildingState = {
      address: 'Rijksweg 153B, 6247AD Gronsveld',
      pandId: '0905100000018803',
      vboId: '0905010000002118',
      bouwjaar: 1969,
      oppervlakte: 173,
      pandOppervlakte: 130,
      gebruiksdoel: 'Woonfunctie',
      pandStatus: 'Pand in gebruik',
      vboStatus: 'Verblijfsobject in gebruik',
      volumeM3: 744,
      nokhoogte: 9.3,
      goothoogte: 5.8,
      bouwlagen: 3,
      oppDakPlat: 72,
      oppDakSchuin: 104,
      hellingshoek: 35,
      dakType: 'Samengesteld',
      inferredRoofType: 'composite',
      oppScheidingsmuur: 42,
      oppBuitenmuur: 210,
      bouwtypologie: 'Halfvrijstaand',
      pandGeometry: null,
      bag3d: null,
      aantalVerblijfsobjecten: 1,
      gebouwIsObject: true,
      perceeloppervlakte: 411,
      perceelAanduiding: 'Gronsveld B 2882',
      wozWaarde: 373000,
    };

    const html = renderToStaticMarkup(
      <LegacyPlaceSidebar
        buildingState={sampleState}
        searchValue="Rijksweg 153B"
        onSearchChange={() => {}}
        onSearchSubmit={() => {}}
      />
    );

    // Verify 5 view buttons
    expect(html).toContain('2D Plan');
    expect(html).toContain('Doorsnede');
    expect(html).toContain('3D Model');
    expect(html).toContain('Street View');
    expect(html).toContain('Satelliet');

    // Verify live data
    expect(html).toContain('1969');
    expect(html).toContain('173 m²');
    expect(html).toContain('3 bouwlagen');
    expect(html).toContain('411 m²');
    expect(html).toContain('9.3 m');
    expect(html).toContain('373.000');

    // Verify 3 preview cards
    expect(html).toContain('id="miniStreetViewContainer"');
    expect(html).toContain('id="miniSatContainer"');
    expect(html).toContain('id="miniFloorplanContainer"');
  });

  it('should render miniSatContainer with Google Static Map satellite preview when coords are provided', () => {
    const sampleState: LegacyBuildingState = {
      address: 'Rijksweg 153B, 6247AD Gronsveld',
      pandId: '0905100000018803',
      vboId: '0905010000002118',
      bouwjaar: 1969,
      oppervlakte: 173,
      pandOppervlakte: 130,
      gebruiksdoel: 'Woonfunctie',
      pandStatus: 'Pand in gebruik',
      vboStatus: 'Verblijfsobject in gebruik',
      volumeM3: 744,
      nokhoogte: 9.3,
      goothoogte: 5.8,
      bouwlagen: 3,
      oppDakPlat: 72,
      oppDakSchuin: 104,
      hellingshoek: 35,
      dakType: 'Samengesteld',
      inferredRoofType: 'composite',
      oppScheidingsmuur: 42,
      oppBuitenmuur: 210,
      bouwtypologie: 'Halfvrijstaand',
      pandGeometry: null,
      bag3d: null,
      aantalVerblijfsobjecten: 1,
      gebouwIsObject: true,
      perceeloppervlakte: 411,
      perceelAanduiding: 'Gronsveld B 2882',
      wozWaarde: 373000,
    };

    const html = renderToStaticMarkup(
      <LegacyPlaceSidebar
        buildingState={sampleState}
        searchValue="Rijksweg 153B"
        coords={{ lat: 50.805292, lng: 5.73351 }}
        onSearchChange={() => {}}
        onSearchSubmit={() => {}}
      />
    );

    expect(html).toContain('maptype=satellite');
    expect(html).toContain('center=50.805292,5.73351');
  });
});
