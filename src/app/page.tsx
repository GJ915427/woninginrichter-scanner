'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { GoogleMapCanvas } from '@/components/legacy/GoogleMapCanvas';
import { LegacyPlaceSidebar } from '@/components/legacy/LegacyPlaceSidebar';
import { FloorplanOverlay } from '@/components/legacy/FloorplanOverlay';
import {
  LegacyBuildingState,
  convertCoordinatesToMeters,
  adaptBuildingPayloadToLegacyState,
} from '@/domain/legacy/legacy-state-adapter';
import { Point2D } from '@/domain/legacy/collinear-simplifier';

export default function HomePage() {
  const [legacyState, setLegacyState] = useState<LegacyBuildingState | null>(null);
  const [searchValue, setSearchValue] = useState<string>('');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 52.15517, // Amersfoort / geografisch middelpunt NL (neutrale default)
    lng: 5.38720,
  });
  const [polygonCoords, setPolygonCoords] = useState<Array<[number, number]>>([]);
  const [isFloorplanOpen, setIsFloorplanOpen] = useState<boolean>(false);
  const [floorplanEtage, setFloorplanEtage] = useState<number | 'section'>(0);

  // 1. Dynamische HTML5 Device Geolocation bij initial load
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCoords({ lat, lng });

          try {
            const res = await fetch(`/api/building?lat=${lat}&lng=${lng}`);
            if (res.ok) {
              const payload = await res.json();
              if (payload) {
                const fullAddr = payload.address || payload.bag?.weergavenaam || 'Mijn Locatie';
                const newState = adaptBuildingPayloadToLegacyState(payload, fullAddr);
                setLegacyState(newState);
                setSearchValue(fullAddr);

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
            }
          } catch (err) {
            console.warn('Geolocation reverse building lookup error:', err);
          }
        },
        (err) => {
          console.log('Device geolocation niet actief of geweigerd:', err.message);
        },
        { timeout: 7000, maximumAge: 60000 }
      );
    }
  }, []);

  // Convert raw lat/lng building polygon to local meter coordinates for SVG
  const basePoints: Point2D[] = useMemo(() => {
    if (legacyState?.basePoints && legacyState.basePoints.length > 2) {
      return legacyState.basePoints;
    }
    if (!polygonCoords || polygonCoords.length === 0) return [];
    return convertCoordinatesToMeters(polygonCoords);
  }, [legacyState, polygonCoords]);

  // PDOK Locatieserver search handler
  const handleSearchSubmit = async (query: string) => {
    if (!query) return;
    try {
      const suggestRes = await fetch(
        `https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest?q=${encodeURIComponent(query)}&rows=1`
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

      const vboId = doc.adresseerbaarobject_id;
      const pandId = doc.pand_id || (doc.gekoppeld_pand && doc.gekoppeld_pand[0]);
      let apiUrl = `/api/building?lat=${newLat}&lng=${newLng}`;
      if (vboId) {
        apiUrl = `/api/building?vboId=${encodeURIComponent(vboId)}&lat=${newLat}&lng=${newLng}`;
      } else if (pandId) {
        apiUrl = `/api/building?pandId=${encodeURIComponent(pandId)}`;
      }

      const bffRes = await fetch(apiUrl);
      if (bffRes.ok) {
        const payload = await bffRes.json();
        const fullAddr = doc.weergavenaam || query;
        const newState = adaptBuildingPayloadToLegacyState(payload, fullAddr);
        setLegacyState(newState);

        if (newState.polygonCoords && newState.polygonCoords.length > 2) {
          setPolygonCoords(newState.polygonCoords);
        } else if (newState.pandGeometry?.coordinates?.[0]) {
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

  // Map Click handler (dynamically fetches clicked building)
  const handleMapClick = async (lat: number, lng: number) => {
    setCoords({ lat, lng });
    try {
      const res = await fetch(`/api/building?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const payload = await res.json();
        if (payload) {
          const fullAddr = payload.address || payload.bag?.weergavenaam || 'Gekozen Pand';
          const newState = adaptBuildingPayloadToLegacyState(payload, fullAddr);
          setLegacyState(newState);
          setSearchValue(fullAddr);

          if (newState.polygonCoords && newState.polygonCoords.length > 2) {
            setPolygonCoords(newState.polygonCoords);
          } else if (newState.pandGeometry?.coordinates?.[0]) {
            let ring = newState.pandGeometry.coordinates[0];
            if (newState.pandGeometry.type === 'MultiPolygon') {
              ring = newState.pandGeometry.coordinates[0][0];
            }
            if (Array.isArray(ring) && ring.length > 2) {
              setPolygonCoords(ring);
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to resolve building on map click:', e);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-slate-100">
      {/* 1. Full-Screen Google Maps Canvas Base Layer (Singleton, z-0) */}
      <GoogleMapCanvas
        lat={coords.lat}
        lng={coords.lng}
        polygonCoords={polygonCoords}
        onMapClick={handleMapClick}
      />

      {/* 2. Floating PlaceSidebar on Left (z-20) */}
      <LegacyPlaceSidebar
        buildingState={legacyState}
        searchValue={searchValue}
        coords={coords}
        onSearchChange={setSearchValue}
        onSearchSubmit={handleSearchSubmit}
        onOpenFloorplan={(etage = 0) => {
          setFloorplanEtage(etage);
          setIsFloorplanOpen(true);
        }}
        onOpen3D={() => {
          // Future 3D expansion
        }}
        onToggleStreetView={() => {
          // Future Street View expansion
        }}
        onToggleSatellite={() => {
          // Future Satellite toggle
        }}
        basePoints={basePoints}
      />

      {/* 3. Floorplan / Section Overlay (z-10, centered on md:pl-[430px]) */}
      <FloorplanOverlay
        isOpen={isFloorplanOpen}
        onClose={() => setIsFloorplanOpen(false)}
        basePoints={basePoints}
        buildingState={legacyState}
        initialEtage={floorplanEtage}
      />
    </div>
  );
}
