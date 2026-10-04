'use client';

import React, { useState } from 'react';
import { LegacyBuildingState } from '@/domain/legacy/legacy-state-adapter';
import { Point2D } from '@/domain/legacy/collinear-simplifier';

interface LegacyPlaceSidebarProps {
  buildingState: LegacyBuildingState | null;
  searchValue: string;
  coords?: { lat: number; lng: number };
  onSearchChange: (val: string) => void;
  onSearchSubmit: (query: string) => void;
  onOpenFloorplan?: (etage?: number | 'section') => void;
  onOpen3D?: () => void;
  onToggleStreetView?: () => void;
  onToggleSatellite?: () => void;
  basePoints?: Point2D[];
}

export const LegacyPlaceSidebar: React.FC<LegacyPlaceSidebarProps> = ({
  buildingState,
  searchValue,
  coords,
  onSearchChange,
  onSearchSubmit,
  onOpenFloorplan,
  onOpen3D,
  onToggleStreetView,
  onToggleSatellite,
  basePoints = [],
}) => {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [heroMode, setHeroMode] = useState<'streetview' | 'satellite'>('streetview');

  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    'AIzaSyBcrKLAGqIMYlDVag_c8zNOLNDbVjVJcLI';

  const streetNumber = buildingState?.address ? buildingState.address.split(',')[0].trim() : '';
  const subtitle = buildingState
    ? `${buildingState.pandStatus || 'Pand in gebruik'} • ${buildingState.gebruiksdoel || 'Woonfunctie'}`
    : '';

  const displayLabel = customLabel || buildingState?.bouwtypologie || 'Eengezinswoning';
  const bouwjaar = buildingState?.bouwjaar ? String(buildingState.bouwjaar) : '—';
  const oppervlakte = buildingState?.oppervlakte ? `${buildingState.oppervlakte} m²` : '—';
  const nokhoogte = buildingState?.nokhoogte ? `${buildingState.nokhoogte.toFixed(1)} m` : '—';
  const perceelOpp = buildingState?.perceeloppervlakte ? `${buildingState.perceeloppervlakte} m²` : '—';
  const perceelAanduiding = buildingState?.perceelAanduiding
    ? `Kadastraal perceel ${buildingState.perceelAanduiding}`
    : 'Kadastraal perceel onbekend';
  const volumeM3 = buildingState?.volumeM3 ? `${buildingState.volumeM3} m³` : '—';
  const wozText = buildingState?.wozWaarde
    ? `€ ${buildingState.wozWaarde.toLocaleString('nl-NL')}`
    : '—';

  // Construct dynamic mini floorplan path if basePoints available
  let miniSvg = null;
  if (basePoints && basePoints.length >= 3) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    basePoints.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
    const pad = 1.2;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    const pathStr =
      basePoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') +
      ' Z';

    miniSvg = (
      <svg
        viewBox={`${(minX - pad).toFixed(2)} ${(minY - pad).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`}
        className="w-full h-full p-2 pointer-events-none"
        preserveAspectRatio="xMidYMid meet"
      >
        <path d={pathStr} fill="#f8fafc" stroke="#1a73e8" strokeWidth="0.5" />
      </svg>
    );
  }

  const streetViewUrl = coords
    ? `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${coords.lat},${coords.lng}&fov=90&heading=${buildingState?.streetViewHeading ?? 92}&pitch=5&key=${apiKey}`
    : '';

  return (
    <div
      id="placeSidebar"
      className="absolute top-0 left-0 bottom-0 w-full sm:w-[400px] z-20 bg-white shadow-2xl flex flex-col transition-all duration-300 pointer-events-auto border-r border-slate-200"
    >
      {/* 1. Search Bar Header */}
      <div className="p-3 bg-white border-b border-slate-200 z-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchValue.trim()) onSearchSubmit(searchValue.trim());
          }}
          className="relative flex items-center bg-white rounded-full shadow-md border border-slate-200 px-3.5 py-2 hover:shadow-lg focus-within:shadow-lg transition-shadow"
        >
          <button type="button" className="text-slate-400 hover:text-slate-600 mr-2.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <input
            id="addressSearchInput"
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Zoek een adres of postcode..."
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="text-slate-400 hover:text-slate-600 px-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button type="submit" className="text-[#007b83] hover:text-[#005f66] ml-2 font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
        </form>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        {!buildingState ? (
          /* Welcoming Empty State */
          <div className="p-8 text-center flex flex-col items-center justify-center min-h-[400px] text-slate-500 space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#007b83]/10 flex items-center justify-center text-[#007b83]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Kies een woning</h2>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              Zoek op postcode of straatnaam, of klik direct op een pand op de kaart om de 2D plattegrond, de doorsnede
              en alle bouwkundige BAG-gegevens op te halen.
            </p>
          </div>
        ) : (
          <>
            {/* 2. Hero Image / Street View */}
            <div className="relative w-full h-52 bg-slate-900 overflow-hidden group">
              {streetViewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  id="streetViewImage"
                  src={streetViewUrl}
                  alt={buildingState.address}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                  Geen Street View beschikbaar
                </div>
              )}

              {/* View Mode Toggle: Street View / Satelliet */}
              <div className="absolute top-3 left-3 bg-black/65 backdrop-blur-xs p-0.5 rounded-full flex items-center text-white text-[10px] font-medium shadow-md">
                <button
                  id="heroModeSvBtn"
                  type="button"
                  onClick={() => setHeroMode('streetview')}
                  className={`px-2.5 py-1 rounded-full font-semibold shadow-xs transition-all cursor-pointer ${
                    heroMode === 'streetview' ? 'bg-white text-slate-800' : 'text-white/90 hover:text-white'
                  }`}
                >
                  Street View
                </button>
                <button
                  id="heroModeAirBtn"
                  type="button"
                  onClick={() => {
                    setHeroMode('satellite');
                    onToggleSatellite?.();
                  }}
                  className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1 cursor-pointer ${
                    heroMode === 'satellite' ? 'bg-white text-slate-800' : 'text-white/90 hover:text-white'
                  }`}
                >
                  <span>Satelliet & Perceel</span>
                </button>
              </div>

              {/* Bottom Left 360 Badge */}
              <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-xs text-white px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-md">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span id="heroBadgeText">360° Street View</span>
              </div>
            </div>

            {/* 3. Title Header */}
            <div className="px-5 pt-4 pb-2 border-b border-slate-100">
              <h1 id="placeTitle" className="text-2xl font-normal text-slate-900 tracking-tight leading-tight">
                {streetNumber || 'Gekozen Pand'}
              </h1>
              <p id="placeSubtitle" className="text-xs text-slate-500 mt-0.5">
                {subtitle}
              </p>
            </div>

            {/* 4. The 5 Action Buttons Row (Circular Teal Google Maps Style) */}
            <div className="flex items-center justify-around py-3 px-2 border-b border-slate-100 bg-white">
              {/* Button 1: 2D Plan */}
              <button
                type="button"
                onClick={() => onOpenFloorplan?.(0)}
                className="flex flex-col items-center group cursor-pointer"
                title="Open 2D Plattegrond"
              >
                <div className="w-10 h-10 rounded-full bg-[#007b83] flex items-center justify-center text-white group-hover:bg-[#005f66] transition-colors shadow-xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                </div>
                <span className="text-[10px] text-[#007b83] font-medium mt-1.5">2D Plan</span>
              </button>

              {/* Button 2: Doorsnede */}
              <button
                type="button"
                onClick={() => onOpenFloorplan?.('section')}
                className="flex flex-col items-center group cursor-pointer"
                title="Open Doorsnede"
              >
                <div className="w-10 h-10 rounded-full bg-[#007b83] flex items-center justify-center text-white group-hover:bg-[#005f66] transition-colors shadow-xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11m16-11v11" />
                  </svg>
                </div>
                <span className="text-[10px] text-[#007b83] font-medium mt-1.5">Doorsnede</span>
              </button>

              {/* Button 3: 3D Model */}
              <button
                type="button"
                onClick={() => onOpen3D?.()}
                className="flex flex-col items-center group cursor-pointer"
                title="Bekijk 3D Volumemodel"
              >
                <div className="w-10 h-10 rounded-full bg-[#007b83] flex items-center justify-center text-white group-hover:bg-[#005f66] transition-colors shadow-xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <span className="text-[10px] text-[#007b83] font-medium mt-1.5">3D Model</span>
              </button>

              {/* Button 4: Street View */}
              <button
                type="button"
                onClick={() => onToggleStreetView?.()}
                className="flex flex-col items-center group cursor-pointer"
                title="Open Street View"
              >
                <div className="w-10 h-10 rounded-full bg-[#007b83] flex items-center justify-center text-white group-hover:bg-[#005f66] transition-colors shadow-xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <span className="text-[10px] text-[#007b83] font-medium mt-1.5">Street View</span>
              </button>

              {/* Button 5: Satelliet */}
              <button
                type="button"
                onClick={() => onToggleSatellite?.()}
                className="flex flex-col items-center group cursor-pointer"
                title="Wissel Satellietkaart"
              >
                <div className="w-10 h-10 rounded-full bg-[#007b83] flex items-center justify-center text-white group-hover:bg-[#005f66] transition-colors shadow-xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-[10px] text-[#007b83] font-medium mt-1.5">Satelliet</span>
              </button>
            </div>

            {/* 5. Google Maps List Items with Pure Vector SVG Icons */}
            <div className="divide-y divide-slate-100 text-sm text-slate-800">
              {/* Adres */}
              <div className="flex items-start px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <div className="w-6 shrink-0 text-[#007b83] mt-0.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <div id="displayFullAddress" className="text-sm font-normal text-slate-900 leading-snug">
                    {buildingState.address}
                  </div>
                  <div id="displayRegionCountry" className="text-xs text-slate-400 mt-0.5">
                    Nederland
                  </div>
                </div>
              </div>

              {/* Label */}
              <div className="px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 shrink-0 text-[#007b83]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-slate-500 font-normal">Label</span>
                      <span id="displayTypeLabel" className="text-sm font-medium text-slate-900">
                        {displayLabel}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingLabel(!isEditingLabel)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
                    title="Bewerk label"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
                {isEditingLabel && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      placeholder="Bijv. Eengezinswoning"
                      className="flex-1 text-xs border border-slate-300 rounded px-2 py-1 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setIsEditingLabel(false)}
                      className="bg-[#007b83] text-white text-xs px-2.5 py-1 rounded"
                    >
                      OK
                    </button>
                  </div>
                )}
              </div>

              {/* Bouwjaar */}
              <div className="flex items-start px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="w-6 shrink-0 text-[#007b83] mt-0.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-normal text-slate-900">
                    Bouwjaar <strong id="displayBouwjaar" className="font-medium text-slate-800">{bouwjaar}</strong>
                  </div>
                  <div id="displayPandStatus" className="text-xs text-slate-400 mt-0.5">
                    {buildingState.pandStatus || 'Pand in gebruik'} • {buildingState.bouwtypologie || 'Woonhuis'}
                  </div>
                </div>
              </div>

              {/* Woonoppervlakte */}
              <div className="flex items-start px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="w-6 shrink-0 text-[#007b83] mt-0.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-normal text-slate-900">
                    <strong id="displayOppervlakte" className="font-medium text-slate-800">{oppervlakte}</strong> woonoppervlakte
                  </div>
                  <div id="displayGebruiksdoel" className="text-xs text-slate-400 mt-0.5">
                    {buildingState.gebruiksdoel || 'Woonfunctie'}
                  </div>
                </div>
              </div>

              {/* Etages */}
              <div className="flex items-start px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="w-6 shrink-0 text-[#007b83] mt-0.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-normal text-slate-900">
                    Etages <strong id="displayBouwlagen" className="font-medium text-slate-800">{buildingState.bouwlagen || '—'} bouwlagen</strong>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    3D BAG AHN5 laserscan
                  </div>
                </div>
              </div>

              {/* Perceel */}
              <div className="flex items-start px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="w-6 shrink-0 text-[#007b83] mt-0.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-normal text-slate-900">
                    <strong id="displayPerceel" className="font-medium text-slate-800">{perceelOpp}</strong> perceel
                  </div>
                  <div id="displayPerceelAanduiding" className="text-xs text-slate-400 mt-0.5">
                    {perceelAanduiding}
                  </div>
                </div>
              </div>

              {/* Hoogte */}
              <div className="flex items-start px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="w-6 shrink-0 text-[#007b83] mt-0.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-normal text-slate-900">
                    Hoogte <strong id="displayNokhoogte" className="font-medium text-slate-800">{nokhoogte}</strong> (nok)
                  </div>
                  <div id="displayGebouwVolume" className="text-xs text-slate-400 mt-0.5">
                    Gebouwvolume {volumeM3} • 3D BAG AHN5
                  </div>
                </div>
              </div>

              {/* WOZ-waarde */}
              <div className="flex items-start px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="w-6 shrink-0 text-[#007b83] mt-0.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-normal text-slate-900">
                    <span id="displayWoz">WOZ-waarde <strong>{wozText}</strong></span>
                  </div>
                  <div id="displayWozSub" className="text-xs text-slate-400 mt-0.5">
                    Kadaster WOZ
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Photos, Satellite & Floorplan 3-Card Section */}
            <div className="p-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-sm font-medium text-slate-900">Foto&apos;s & Plattegrond</div>
                <span className="text-[10px] text-slate-400 font-normal">Street View, Satelliet & Buitenmuren</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {/* 1. Street View Mini */}
                <div
                  id="miniStreetViewContainer"
                  onClick={onToggleStreetView}
                  className="relative rounded-lg overflow-hidden h-28 bg-slate-900 group cursor-pointer shadow-xs border border-slate-200"
                  title="Open 360° Street View"
                >
                  {streetViewUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={streetViewUrl}
                      alt="Street View Thumbnail"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                      Street View
                    </div>
                  )}
                  <div className="absolute bottom-1.5 left-1.5 bg-black/65 backdrop-blur-xs text-white px-1.5 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 shadow-md pointer-events-none">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Street View</span>
                  </div>
                </div>

                {/* 2. Google Satellite Mini */}
                <div
                  id="miniSatContainer"
                  onClick={onToggleSatellite}
                  className="relative rounded-lg overflow-hidden h-28 bg-slate-900 group cursor-pointer shadow-xs border border-slate-200"
                  title="Toon Google Satelliet & Perceel"
                >
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
                    Satelliet
                  </div>
                  <div className="absolute bottom-1.5 left-1.5 bg-black/65 backdrop-blur-xs text-white px-1.5 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 shadow-md pointer-events-none z-10">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Satelliet</span>
                  </div>
                </div>

                {/* 3. Plattegrond Buitenmuren Mini */}
                <div
                  id="miniFloorplanContainer"
                  onClick={() => onOpenFloorplan?.(0)}
                  className="relative rounded-lg overflow-hidden h-28 bg-white group cursor-pointer shadow-xs border border-slate-200 hover:border-[#1a73e8] transition-all flex flex-col items-center justify-center p-1.5"
                  title="Bekijk plattegrond van buitenmuren met maatvoering"
                >
                  <div id="miniFloorplanPreview" className="w-full h-full flex items-center justify-center pointer-events-none">
                    {miniSvg ? (
                      miniSvg
                    ) : (
                      <svg viewBox="0 0 100 100" className="w-16 h-16 opacity-75">
                        <rect x="20" y="15" width="60" height="70" fill="none" stroke="#334155" strokeWidth="6" />
                        <text x="50" y="55" fontSize="12" fill="#0284c7" textAnchor="middle" fontWeight="bold">
                          2D
                        </text>
                      </svg>
                    )}
                  </div>
                  <div className="absolute bottom-1.5 left-1.5 bg-white/90 backdrop-blur-xs text-slate-800 px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 shadow-xs pointer-events-none z-10 border border-slate-200">
                    <svg className="w-2.5 h-2.5 text-[#1a73e8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                    <span>Plattegrond</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
