'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GoogleMapCanvas } from '@/components/legacy/GoogleMapCanvas';
import { LegacyPlaceSidebar } from '@/components/legacy/LegacyPlaceSidebar';
import { FloorplanOverlay } from '@/components/legacy/FloorplanOverlay';
import {
  adaptBuildingPayloadToLegacyState,
  LegacyBuildingState,
} from '@/domain/legacy/legacy-state-adapter';
import { Point2D } from '@/domain/legacy/collinear-simplifier';

/**
 * Calculates forward bearing (degrees 0-360) from camera position to polygon centroid.
 * Falls back to 92.4° (legacy West-facing street view) if camera position is essentially identical to building centroid.
 */
function calculateForwardBearing(
  fromLat: number,
  fromLng: number,
  polygon: Array<[number, number]>
): number {
  if (!polygon || polygon.length === 0) return 92.4;
  let sumLng = 0;
  let sumLat = 0;
  for (const pt of polygon) {
    sumLng += pt[0];
    sumLat += pt[1];
  }
  const toLat = sumLat / polygon.length;
  const toLng = sumLng / polygon.length;

  const dLat = Math.abs(fromLat - toLat);
  const dLng = Math.abs(fromLng - toLng);
  if (dLat < 0.0001 && dLng < 0.0001) {
    return 92.4;
  }

  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const deltaLng = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

export default function HomePage() {
  const [legacyState, setLegacyState] = useState<LegacyBuildingState | null>(null);
  const [searchValue, setSearchValue] = useState<string>('');
  const lastSelectedAddressRef = useRef<string>('');

  const [coords, setCoords] = useState<{ lat: number; lng: number }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('last_known_coords');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Failed to parse cached coords:', e);
      }
    }
    return {
      lat: 52.15517, // Neutrale startlocatie NL
      lng: 5.38720,
    };
  });
  const [zoom, setZoom] = useState<number>(14);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');
  const [isStreetView, setIsStreetView] = useState<boolean>(false);
  const [polygonCoords, setPolygonCoords] = useState<Array<[number, number]>>([]);
  const [isFloorplanOpen, setIsFloorplanOpen] = useState<boolean>(false);
  const [floorplanEtage, setFloorplanEtage] = useState<number | 'section'>(0);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; weergavenaam: string }>>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // 1. Google Maps Clean Start: Dynamische Geolocation voor kaart-center, GEEN pandselectie
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCoords({ lat, lng });
          try {
            localStorage.setItem('last_known_coords', JSON.stringify({ lat, lng }));
          } catch (e) {}
          setZoom(14); // Regionaal overzichtsniveau (woonplaats/wijk)
        },
        (err) => {
          console.log('Device geolocation niet actief of geweigerd:', err.message);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 600000 }
      );
    }
  }, []);

  // 2. PDOK Autocomplete suggesties met 250ms debounce
  useEffect(() => {
    if (!searchValue || searchValue.trim().length < 2) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      return;
    }

    if (searchValue.trim() === lastSelectedAddressRef.current.trim()) {
      setIsDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest?q=${encodeURIComponent(
            searchValue.trim()
          )}&rows=5`
        );
        if (res.ok) {
          const data = await res.json();
          const docs = data?.response?.docs || [];
          const mapped = docs.map((d: any) => ({
            id: d.id,
            weergavenaam: d.weergavenaam,
          }));
          setSuggestions(mapped);
          setIsDropdownOpen(mapped.length > 0);
        }
      } catch (err) {
        console.warn('Failed to fetch PDOK suggestions:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchValue]);

  // Prioritize canonical metric basePoints from legacyState (accurate RD-NAP projection)
  const basePoints = useMemo<Point2D[]>(() => {
    if (legacyState?.basePoints && legacyState.basePoints.length > 2) {
      return legacyState.basePoints;
    }
    if (!polygonCoords || polygonCoords.length < 3) return [];
    return convertCoordinatesToMeters(polygonCoords);
  }, [legacyState, polygonCoords]);

  // Handler for selecting an autocomplete suggestion
  const handleSelectSuggestion = async (id: string, weergavenaam: string) => {
    lastSelectedAddressRef.current = weergavenaam;
    setSearchValue(weergavenaam);
    setIsDropdownOpen(false);
    setSuggestions([]);

    try {
      const lookupRes = await fetch(
        `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${encodeURIComponent(id)}`
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
          try {
            localStorage.setItem('last_known_coords', JSON.stringify({ lat: newLat, lng: newLng }));
          } catch (e) {}
          setZoom(19);
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
        const fullAddr = doc.weergavenaam || weergavenaam;
        const newState = adaptBuildingPayloadToLegacyState(payload, fullAddr);

        let ring: Array<[number, number]> = [];
        if (newState.polygonCoords && newState.polygonCoords.length > 2) {
          ring = newState.polygonCoords;
        } else if (newState.pandGeometry?.coordinates?.[0]) {
          let rawRing = newState.pandGeometry.coordinates[0];
          if (newState.pandGeometry.type === 'MultiPolygon') {
            rawRing = newState.pandGeometry.coordinates[0][0];
          }
          if (Array.isArray(rawRing) && rawRing.length > 2) {
            ring = rawRing;
          }
        }

        if (ring.length > 2) {
          setPolygonCoords(ring);
          const heading = calculateForwardBearing(newLat, newLng, ring);
          newState.streetViewHeading = heading;
        }

        setLegacyState(newState);
      }
    } catch (err) {
      console.error('Failed to resolve building from suggestion:', err);
    }
  };

  // PDOK Locatieserver direct submit handler
  const handleSearchSubmit = async (query: string) => {
    if (!query) return;
    lastSelectedAddressRef.current = query;
    setIsDropdownOpen(false);
    setSuggestions([]);
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
          try {
            localStorage.setItem('last_known_coords', JSON.stringify({ lat: newLat, lng: newLng }));
          } catch (e) {}
          setZoom(19);
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

        let ring: Array<[number, number]> = [];
        if (newState.polygonCoords && newState.polygonCoords.length > 2) {
          ring = newState.polygonCoords;
        } else if (newState.pandGeometry?.coordinates?.[0]) {
          let rawRing = newState.pandGeometry.coordinates[0];
          if (newState.pandGeometry.type === 'MultiPolygon') {
            rawRing = newState.pandGeometry.coordinates[0][0];
          }
          if (Array.isArray(rawRing) && rawRing.length > 2) {
            ring = rawRing;
          }
        }

        if (ring.length > 2) {
          setPolygonCoords(ring);
          const heading = calculateForwardBearing(newLat, newLng, ring);
          newState.streetViewHeading = heading;
        }

        setLegacyState(newState);
      }
    } catch (err) {
      console.error('Failed to search and resolve building:', err);
    }
  };

  // Map Click handler (dynamically fetches clicked building)
  const handleMapClick = async (lat: number, lng: number) => {
    setCoords({ lat, lng });
    try {
      localStorage.setItem('last_known_coords', JSON.stringify({ lat, lng }));
    } catch (e) {}
    try {
      const res = await fetch(`/api/building?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const payload = await res.json();
        if (payload) {
          const fullAddr = payload.address || payload.bag?.weergavenaam || 'Gekozen Pand';
          lastSelectedAddressRef.current = fullAddr;
          const newState = adaptBuildingPayloadToLegacyState(payload, fullAddr);

          let ring: Array<[number, number]> = [];
          if (newState.polygonCoords && newState.polygonCoords.length > 2) {
            ring = newState.polygonCoords;
          } else if (newState.pandGeometry?.coordinates?.[0]) {
            let rawRing = newState.pandGeometry.coordinates[0];
            if (newState.pandGeometry.type === 'MultiPolygon') {
              rawRing = newState.pandGeometry.coordinates[0][0];
            }
            if (Array.isArray(rawRing) && rawRing.length > 2) {
              ring = rawRing;
            }
          }

          if (ring.length > 2) {
            setPolygonCoords(ring);
            const heading = calculateForwardBearing(lat, lng, ring);
            newState.streetViewHeading = heading;
          }

          setLegacyState(newState);
          setSearchValue(fullAddr);
          setIsDropdownOpen(false);
          setZoom(19);
        }
      }
    } catch (e) {
      console.error('Failed to resolve building on map click:', e);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900">
      {/* 1. Full-screen Google Maps Singleton Background (z-0) */}
      <GoogleMapCanvas
        lat={coords.lat}
        lng={coords.lng}
        zoom={zoom}
        polygonCoords={polygonCoords}
        onMapClick={handleMapClick}
        mapTypeId={mapType}
        isStreetView={isStreetView}
        streetViewHeading={legacyState?.streetViewHeading}
        onStreetViewClose={() => setIsStreetView(false)}
      />

      {/* 2. Floating PlaceSidebar on Left (z-20) */}
      <LegacyPlaceSidebar
        buildingState={legacyState}
        searchValue={searchValue}
        coords={coords}
        suggestions={suggestions}
        isDropdownOpen={isDropdownOpen}
        onSearchChange={(val) => {
          lastSelectedAddressRef.current = '';
          setSearchValue(val);
        }}
        onSearchSubmit={handleSearchSubmit}
        onSelectSuggestion={handleSelectSuggestion}
        onOpenFloorplan={(etage = 0) => {
          setIsStreetView(false);
          setFloorplanEtage(etage);
          setIsFloorplanOpen(true);
        }}
        onOpen3D={() => {
          // 3D Model view
        }}
        onToggleStreetView={() => {
          setIsStreetView((prev) => !prev);
        }}
        onToggleSatellite={() => {
          setMapType((prev) => (prev === 'roadmap' ? 'hybrid' : 'roadmap'));
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

/**
 * Metric projection helper converting WGS84 polygon points to local meters in SVG coordinate system (North is -y)
 */
function convertCoordinatesToMeters(coords: Array<[number, number]>): Point2D[] {
  if (!coords || coords.length === 0) return [];
  const refLng = coords[0][0];
  const refLat = coords[0][1];
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((refLat * Math.PI) / 180);

  return coords.map((pt) => ({
    x: +((pt[0] - refLng) * metersPerDegLng).toFixed(2),
    y: -((pt[1] - refLat) * metersPerDegLat).toFixed(2),
  }));
}
