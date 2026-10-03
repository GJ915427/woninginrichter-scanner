'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface SelectedPandEvent {
  lat: number;
  lng: number;
  address?: string;
  pandId?: string;
}

export interface InteractiveMapPickerProps {
  initialLat?: number;
  initialLng?: number;
  initialZoom?: number;
  center?: { lat: number; lng: number };
  zoom?: number;
  selectedCoords?: { lat: number; lng: number };
  onSelectCoords?: (coords: { lat: number; lng: number }) => void;
  selectedAddress?: string;
  selectedPandId?: string;
  onSelectPand?: (event: SelectedPandEvent) => void;
  className?: string;
  apiKey?: string;
  aerialYear?: number;
}

export const InteractiveMapPicker: React.FC<InteractiveMapPickerProps> = ({
  initialLat = 50.80529,
  initialLng = 5.73351,
  initialZoom = 19,
  selectedAddress,
  selectedPandId,
  onSelectPand,
  className = '',
  apiKey = 'AIzaSyBcrKLAGqIMYlDVag_c8zNOLNDbVjVJcLI',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');
  const [showKadasterOverlay, setShowKadasterOverlay] = useState<boolean>(true);
  const [userCoords, _setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [_mapLoaded, setMapLoaded] = useState<boolean>(false);

  const currentCoords = userCoords ?? { lat: initialLat, lng: initialLng };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const existingScript = document.getElementById('google-maps-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places`;
      script.async = true;
      script.defer = true;
      script.onload = () => setMapLoaded(true);
      document.head.appendChild(script);
    } else {
      existingScript.addEventListener('load', () => setMapLoaded(true), { once: true });
    }
  }, [apiKey]);

  return (
    <div
      className={`relative flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
      data-testid="interactive-map-container"
    >
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs">
        <div className="flex items-center gap-2 font-medium text-slate-800">
          <span className="w-2 h-2 rounded-full bg-blue-600" />
          <span>Kadastrale & Satelliet Pandviewer</span>
          {selectedAddress && (
            <span className="text-slate-500 truncate max-w-[220px]" title={selectedAddress}>
              • {selectedAddress}
            </span>
          )}
        </div>

        {/* Map Type Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMapType('roadmap')}
            className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
              mapType === 'roadmap'
                ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Kaart
          </button>
          <button
            type="button"
            onClick={() => setMapType('hybrid')}
            className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
              mapType === 'hybrid'
                ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Satelliet
          </button>
          <button
            type="button"
            onClick={() => setShowKadasterOverlay((prev) => !prev)}
            className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
              showKadasterOverlay
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100'
            }`}
            title="Kadaster DKK perceelsgrenzen tonen"
          >
            {showKadasterOverlay ? '✓ DKK Grenzen' : 'DKK Grenzen'}
          </button>
        </div>
      </div>

      {/* Map Element */}
      <div className="relative aspect-video w-full bg-slate-100 overflow-hidden">
        <div
          ref={mapContainerRef}
          className="w-full h-full"
          title="Interactieve Google Kaart"
        >
          {/* Static / Fallback Map View */}
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-2 shadow-2xs">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {selectedAddress || 'Geen adres geselecteerd'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Lat: {currentCoords.lat.toFixed(6)} | Lng: {currentCoords.lng.toFixed(6)}
            </p>
            {selectedPandId && (
              <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-800">
                BAG ID: {selectedPandId}
              </span>
            )}
          </div>
        </div>

        {/* Floating Coordinates & Layer Badge */}
        <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded bg-white/90 backdrop-blur-xs border border-slate-200 text-[11px] font-mono text-slate-700 shadow-2xs">
          <span>{currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}</span>
          <span className="mx-1.5 text-slate-300">|</span>
          <span className="font-semibold text-blue-600">{mapType.toUpperCase()}</span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
        <span>Klik op de kaart om een ander perceel of pand te selecteren</span>
        <span>Google Maps / Kadaster DKK / PDOK</span>
      </div>
    </div>
  );
};
