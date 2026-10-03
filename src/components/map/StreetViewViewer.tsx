'use client';

import React, { useState } from 'react';

export interface HistoricalPano {
  year: number;
  month?: number;
  panoId: string;
}

export interface StreetViewViewerProps {
  lat: number;
  lng: number;
  heading?: number;
  pitch?: number;
  address?: string;
  apiKey?: string;
  className?: string;
  panoId?: string;
  historicalPanos?: HistoricalPano[];
}

export const StreetViewViewer: React.FC<StreetViewViewerProps> = ({
  lat,
  lng,
  heading = 92,
  pitch = 5,
  address,
  apiKey = 'AIzaSyBcrKLAGqIMYlDVag_c8zNOLNDbVjVJcLI',
  className = '',
  historicalPanos = [],
}) => {
  const [currentHeading, setCurrentHeading] = useState<number>(heading);
  const [currentPitch, setCurrentPitch] = useState<number>(pitch);
  const [imageError, setImageError] = useState<boolean>(false);
  const [isWinterMode, setIsWinterMode] = useState<boolean>(false);

  const rotate = (delta: number) => {
    setCurrentHeading((prev) => ((prev + delta) % 360 + 360) % 360);
    setImageError(false);
  };

  const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x360&location=${lat},${lng}&fov=90&heading=${Math.round(currentHeading)}&pitch=${currentPitch}&key=${apiKey}`;
  const full360Url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&heading=${Math.round(currentHeading)}&pitch=${currentPitch}`;

  return (
    <div
      className={`relative flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
      data-testid="street-view-viewer"
      title="Street View & Gevelbeeld"
    >
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs">
        <div className="flex items-center gap-2 font-medium text-slate-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Street View & Gevelbeeld</span>
          {address && (
            <span className="text-slate-500 truncate max-w-[200px]" title={address}>
              • {address}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsWinterMode((prev) => !prev)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
              isWinterMode
                ? 'bg-sky-100 text-sky-800 border-sky-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Wissel naar historische opname zonder bladerdek (winter/voorjaar)"
          >
            {isWinterMode ? '❄️ Winteropname actief' : '🌳 Bladerdek filter'}
          </button>
          <a
            href={full360Url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium text-[11px] flex items-center gap-1 shadow-2xs transition-colors"
          >
            <span>360° Openen</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      {/* Main Image Container */}
      <div className="relative aspect-video w-full bg-slate-900 flex items-center justify-center overflow-hidden group">
        {!imageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={streetViewUrl}
            alt={`Street View opname voor ${address || 'locatie'}`}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-slate-300 gap-2">
            <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium text-white">Geen Street View dekking op exacte locatie</p>
            <p className="text-xs text-slate-400 max-w-sm">
              Pand ligt mogelijk niet direct aan de openbare weg of heeft beperkte Google dekking. Raadpleeg de PDOK luchtfoto of de 3D BAG nokhoogte.
            </p>
            <a
              href={full360Url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 text-xs text-blue-400 hover:underline"
            >
              Open Google Maps zoekopdracht &rarr;
            </a>
          </div>
        )}

        {/* Floating Heading Overlay */}
        <div className="absolute top-2 left-2 px-2.5 py-1 rounded bg-black/60 backdrop-blur-xs text-white text-[11px] font-mono flex items-center gap-2">
          <span>Kijkhoek: {Math.round(currentHeading)}°</span>
          <span className="text-slate-400">|</span>
          <span>Pitch: {currentPitch}°</span>
        </div>

        {/* Camera Controls Overlay */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg">
          <button
            type="button"
            onClick={() => rotate(-45)}
            className="p-1 rounded-full text-white hover:bg-white/20 transition-colors"
            title="Draai 45° linksom"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => {
              setCurrentHeading(heading);
              setCurrentPitch(pitch);
              setImageError(false);
            }}
            className="px-2 py-0.5 rounded text-[11px] font-medium text-white hover:bg-white/20 transition-colors"
            title="Herstel naar berekende voorgevelhoek"
          >
            Reset ({Math.round(heading)}°)
          </button>
          <button
            type="button"
            onClick={() => rotate(45)}
            className="p-1 rounded-full text-white hover:bg-white/20 transition-colors"
            title="Draai 45° rechtsom"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
        <span>Coördinaten: {lat.toFixed(5)}, {lng.toFixed(5)}</span>
        <span>Bron: Google Maps Street View API</span>
      </div>
    </div>
  );
};
