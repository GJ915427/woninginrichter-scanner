'use client';

import React, { useEffect, useRef } from 'react';

interface GoogleMapCanvasProps {
  lat?: number;
  lng?: number;
  zoom?: number;
  polygonCoords?: Array<[number, number]>;
  onMapClick?: (lat: number, lng: number) => void;
}

export const GoogleMapCanvas: React.FC<GoogleMapCanvasProps> = ({
  lat = 52.15517,
  lng = 5.38720,
  zoom = 12,
  polygonCoords,
  onMapClick,
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
          mapTypeId: 'roadmap',
          renderingType: google.maps.RenderingType ? google.maps.RenderingType.RASTER : 'RASTER',
          disableDefaultUI: false,
          mapTypeControl: true,
          streetViewControl: true,
          zoomControl: true,
          fullscreenControl: true,
          gestureHandling: 'greedy',
        });

        markerRef.current = new google.maps.Marker({
          position: center,
          map: mapInstanceRef.current,
          draggable: true,
          title: 'Sleep om locatie aan te passen',
        });

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

  // Update center & polygon when props change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    const newCenter = { lat: Number(lat), lng: Number(lng) };
    mapInstanceRef.current.setCenter(newCenter);
    if (markerRef.current) {
      markerRef.current.setPosition(newCenter);
    }

    if (polygonCoords && polygonCoords.length > 2) {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
      const path = polygonCoords.map((coord) => ({ lat: coord[1], lng: coord[0] }));
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
  }, [lat, lng, polygonCoords]);

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
