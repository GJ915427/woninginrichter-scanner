'use client';

import React, { useState } from 'react';
import { GoogleMapCanvas } from '@/components/legacy/GoogleMapCanvas';
import { LegacyPlaceSidebar } from '@/components/legacy/LegacyPlaceSidebar';
import { FloorplanOverlay } from '@/components/legacy/FloorplanOverlay';
import {
  DEFAULT_RIJKSWEG_STATE,
  DEFAULT_RIJKSWEG_COORDS,
  convertCoordinatesToMeters,
  adaptBuildingPayloadToLegacyState,
  LegacyBuildingState,
} from '@/domain/legacy';

export default function Home() {
  const [legacyState, setLegacyState] = useState<LegacyBuildingState>(DEFAULT_RIJKSWEG_STATE);
  const [searchValue, setSearchValue] = useState<string>('Rijksweg 153b');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 50.805292,
    lng: 5.733510,
  });
  const [polygonCoords, setPolygonCoords] = useState<Array<[number, number]>>(DEFAULT_RIJKSWEG_COORDS);
  const [isFloorplanOpen, setIsFloorplanOpen] = useState<boolean>(false);

  const basePoints = React.useMemo(() => {
    return convertCoordinatesToMeters(polygonCoords);
  }, [polygonCoords]);

  const handleSearchSubmit = async (query: string) => {
    if (!query) return;
    try {
      // 1. Zoek via PDOK Locatieserver
      const suggestRes = await fetch(
        `https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest?q=${encodeURIComponent(query)}`
      );
      if (!suggestRes.ok) return;
      const suggestData = await suggestRes.json();
      const firstDoc = suggestData?.response?.docs?.[0];
      if (!firstDoc?.id) return;

      const lookupRes = await fetch(
        `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${firstDoc.id}`
      );
      if (!lookupRes.ok) return;
      const lookupData = await lookupRes.json();
      const doc = lookupData?.response?.docs?.[0];
      if (!doc) return;

      let newLat = coords.lat;
      let newLng = coords.lng;
      if (doc.centroide_ll) {
        const match = doc.centroide_ll.match(/POINT\(([\d.]+)\s+([\d.]+)\)/);
        if (match) {
          newLng = parseFloat(match[1]);
          newLat = parseFloat(match[2]);
          setCoords({ lat: newLat, lng: newLng });
        }
      }

      const pandId = doc.pand_id || (doc.gekoppeld_pand && doc.gekoppeld_pand[0]);
      let apiUrl = `/api/building?lat=${newLat}&lng=${newLng}`;
      if (pandId) {
        apiUrl = `/api/building?pandId=${encodeURIComponent(pandId)}`;
      }

      const bffRes = await fetch(apiUrl);
      if (bffRes.ok) {
        const payload = await bffRes.json();
        const fullAddr = doc.weergavenaam || query;
        const newState = adaptBuildingPayloadToLegacyState(payload, fullAddr);
        setLegacyState(newState);

        if (newState.pandGeometry?.coordinates?.[0]) {
          let ring = newState.pandGeometry.coordinates[0];
          if (newState.pandGeometry.type === 'MultiPolygon') {
            ring = newState.pandGeometry.coordinates[0][0];
          }
          if (Array.isArray(ring) && ring.length > 2) {
            setPolygonCoords(ring);
          }
        }
      }
    } catch (err) {
      console.error('Failed to search and resolve building:', err);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-slate-100">
      {/* 1. Full-Screen Google Maps Canvas Base Layer (Singleton, z-0) */}
      <GoogleMapCanvas
        lat={coords.lat}
        lng={coords.lng}
        polygonCoords={polygonCoords}
        onMapClick={(lat, lng) => {
          setCoords({ lat, lng });
          fetch(`/api/building?lat=${lat}&lng=${lng}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((payload) => {
              if (payload) {
                setLegacyState(adaptBuildingPayloadToLegacyState(payload, 'Gekozen Pand'));
              }
            });
        }}
      />

      {/* 2. Floating PlaceSidebar on Left (Exact google_maps_picker clone, z-20) */}
      <LegacyPlaceSidebar
        buildingState={legacyState}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSearchSubmit={handleSearchSubmit}
        onOpenFloorplan={() => setIsFloorplanOpen(true)}
      />

      {/* 3. Floorplan / Section Overlay (z-10, centered on md:pl-[430px]) */}
      <FloorplanOverlay
        isOpen={isFloorplanOpen}
        onClose={() => setIsFloorplanOpen(false)}
        basePoints={basePoints}
        buildingState={legacyState}
      />
    </div>
  );
}
