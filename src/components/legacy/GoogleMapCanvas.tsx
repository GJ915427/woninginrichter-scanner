'use client';

import React, { useEffect, useRef } from 'react';

interface GoogleMapCanvasProps {
  lat?: number;
  lng?: number;
  zoom?: number;
  polygonCoords?: Array<[number, number]>;
  onMapClick?: (lat: number, lng: number) => void;
  mapTypeId?: 'roadmap' | 'satellite' | 'hybrid';
  isStreetView?: boolean;
  streetViewHeading?: number;
  onStreetViewClose?: () => void;
}

export const GoogleMapCanvas: React.FC<GoogleMapCanvasProps> = ({
  lat = 52.15517,
  lng = 5.38720,
  zoom = 12,
  polygonCoords,
  onMapClick,
  mapTypeId = 'roadmap',
  isStreetView = false,
  streetViewHeading = 0,
  onStreetViewClose,
}) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const initMap = () => {
      if (typeof window === 'undefined') return;
      const google = (window as any).google;
      if (!google || !google.maps) return;

      if (!mapInstanceRef.current && mapRef.current) {
        const center = { lat: Number(lat), lng: Number(lng) };
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center,
          zoom,
          mapTypeId,
          renderingType: google.maps.RenderingType ? google.maps.RenderingType.RASTER : 'RASTER',
          disableDefaultUI: false,
          mapTypeControl: true,
          streetViewControl: true,
          zoomControl: true,
          fullscreenControl: true,
          gestureHandling: 'greedy',
        });

        const hasBuilding = polygonCoords && polygonCoords.length > 2;
        markerRef.current = new google.maps.Marker({
          position: center,
          map: mapInstanceRef.current,
          draggable: true,
          visible: !!hasBuilding,
          title: 'Sleep om locatie aan te passen',
        });

        const panorama = mapInstanceRef.current.getStreetView();
        if (panorama) {
          panorama.addListener('visible_changed', () => {
            if (!panorama.getVisible() && onStreetViewClose) {
              onStreetViewClose();
            }
          });
        }

        mapInstanceRef.current.addListener('click', (e: any) => {
          if (e.latLng && onMapClick) {
            onMapClick(e.latLng.lat(), e.latLng.lng());
          }
        });
      }
    };

    if ((window as any).google?.maps) {
      initMap();
    } else {
      const existingScript = document.getElementById('google-maps-sdk');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'google-maps-sdk';
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyBcrKLAGqIMYlDVag_c8zNOLNDbVjVJcLI';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
        script.async = true;
        script.defer = true;
        script.onload = () => initMap();
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener('load', initMap);
      }
    }
  }, [lat, lng, zoom, onMapClick]);

  // Update center, polygon, mapTypeId & street view when props change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    const newCenter = { lat: Number(lat), lng: Number(lng) };
    mapInstanceRef.current.setCenter(newCenter);

    if (mapTypeId && mapInstanceRef.current.getMapTypeId() !== mapTypeId) {
      mapInstanceRef.current.setMapTypeId(mapTypeId);
    }

    const hasBuilding = polygonCoords && polygonCoords.length > 2;
    if (markerRef.current) {
      markerRef.current.setPosition(newCenter);
      markerRef.current.setVisible(!!hasBuilding);
    }

    if (hasBuilding) {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
      const path = polygonCoords!.map((coord) => ({ lat: coord[1], lng: coord[0] }));
      polygonRef.current = new google.maps.Polygon({
        paths: path,
        strokeColor: '#1a73e8',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#1a73e8',
        fillOpacity: 0.25,
        map: mapInstanceRef.current,
      });
    } else if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }

    const panorama = mapInstanceRef.current.getStreetView();
    if (panorama) {
      if (isStreetView && !panorama.getVisible()) {
        panorama.setPosition(newCenter);
        if (streetViewHeading != null) {
          panorama.setPov({ heading: Number(streetViewHeading), pitch: 0 });
        }
        panorama.setVisible(true);
      } else if (!isStreetView && panorama.getVisible()) {
        panorama.setVisible(false);
      }
    }
  }, [lat, lng, polygonCoords, mapTypeId, isStreetView, streetViewHeading]);

  return (
    <div
      id="googleMapElement"
      ref={mapRef}
      className="absolute inset-0 w-full h-full z-0 bg-slate-100"
    >
      {/* Visual map canvas fallback */}
      <div className="w-full h-full flex items-center justify-center text-slate-400 select-none pointer-events-none">
        <div className="text-center opacity-60">
          <div className="text-sm font-semibold">Google Maps Canvas (100vw × 100vh)</div>
          <div className="text-xs">Lat: {lat}, Lng: {lng}</div>
        </div>
      </div>
    </div>
  );
};
