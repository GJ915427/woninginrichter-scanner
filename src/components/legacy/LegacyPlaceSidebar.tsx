'use client';

import React, { useState } from 'react';
import { LegacyBuildingState } from '@/domain/legacy/legacy-state-adapter';

interface LegacyPlaceSidebarProps {
  buildingState: LegacyBuildingState | null;
  searchValue: string;
  onSearchChange: (val: string) => void;
  onSearchSubmit: (val: string) => void;
  onOpenFloorplan: () => void;
  onToggleSatellite?: () => void;
}

export const LegacyPlaceSidebar: React.FC<LegacyPlaceSidebarProps> = ({
  buildingState,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  onOpenFloorplan,
  onToggleSatellite,
}) => {
  const [heroMode, setHeroMode] = useState<'streetview' | 'satellite'>('streetview');
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [customLabel, setCustomLabel] = useState<string>('');

  const streetNumber = buildingState?.address?.split(',')[0] || 'Rijksweg 153B';
  const subtitle = buildingState?.bouwtypologie || 'Building';
  const bouwjaar = buildingState?.bouwjaar || 1969;
  const oppervlakte = buildingState?.oppervlakte || 173;
  const bouwlagen = buildingState?.bouwlagen || 3;
  const nokhoogte = buildingState?.nokhoogte ? buildingState.nokhoogte.toFixed(1) : '9.3';
  const displayLabel = customLabel || 'Eengezinswoning';

  return (
    <div
      id="placeSidebar"
      className="absolute top-3 left-3 bottom-3 z-20 w-[400px] max-w-[calc(100vw-24px)] bg-white rounded-lg shadow-xl flex flex-col overflow-hidden transition-all duration-300 border border-slate-200/80"
    >
      {/* 1. Integrated Google Search Bar at Top of Card */}
      <div className="p-2.5 border-b border-slate-200 bg-white relative z-30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit(searchValue);
          }}
          className="flex items-center bg-white rounded-full px-3 py-1.5 border border-slate-300 shadow-xs hover:border-slate-400 focus-within:border-[#1a73e8] focus-within:ring-1 focus-within:ring-[#1a73e8] transition-all"
        >
          <span className="text-slate-500 mr-2.5 p-1 select-none">☰</span>

          <input
            type="text"
            id="addressSearchInput"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Zoek een adres..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 font-normal"
            autoComplete="off"
          />

          {searchValue && (
            <button
              type="button"
              id="clearSearchBtn"
              onClick={() => onSearchChange('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors mr-1 cursor-pointer"
              title="Wissen"
            >
              ✕
            </button>
          )}

          <div className="h-4 w-px bg-slate-200 mx-1"></div>

          <button
            type="submit"
            className="p-1 text-[#1a73e8] hover:text-blue-700 ml-1 cursor-pointer"
            title="Zoeken"
          >
            🔍
          </button>
        </form>
      </div>

      {/* Scrollable Card Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        {/* 2. Street View / Photo Hero Image */}
        <div className="relative w-full h-52 bg-slate-900 overflow-hidden group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            id="streetViewImage"
            src="https://maps.googleapis.com/maps/api/streetview?size=600x300&location=50.805292,5.733510&fov=90&heading=92&pitch=5&key=AIzaSyBcrKLAGqIMYlDVag_c8zNOLNDbVjVJcLI"
            alt="Hero View"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />

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
                if (onToggleSatellite) onToggleSatellite();
              }}
              className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1 cursor-pointer ${
                heroMode === 'satellite' ? 'bg-white text-slate-800' : 'text-white/90 hover:text-white'
              }`}
            >
              <span>Satelliet & Perceel</span>
            </button>
          </div>

          {/* Bottom Left Badge */}
          <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-xs text-white px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-md">
            <span id="heroBadgeIcon">🔄</span>
            <span id="heroBadgeText">360° Street View</span>
          </div>
        </div>

        {/* 3. Title & Classification Header */}
        <div className="px-5 pt-4 pb-2 border-b border-slate-100">
          <div>
            <h1 id="placeTitle" className="text-2xl font-normal text-slate-900 tracking-tight leading-tight">
              {streetNumber}
            </h1>
            <p id="placeSubtitle" className="text-xs text-slate-500 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {/* 4. Action Buttons Row (Circular Teal Google Maps Style) */}
        <div className="flex items-center justify-around py-3 px-3 border-b border-slate-100 bg-white">
          <button type="button" className="flex flex-col items-center group cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-[#007b83] flex items-center justify-center text-white group-hover:bg-[#005f66] transition-colors shadow-xs">
              <span className="text-sm">↗</span>
            </div>
            <span className="text-[10px] text-[#007b83] font-medium mt-1.5">Directions</span>
          </button>

          <button type="button" className="flex flex-col items-center group cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-[#007b83] flex items-center justify-center text-white group-hover:bg-[#005f66] transition-colors shadow-xs">
              <span className="text-sm">🔖</span>
            </div>
            <span id="copyJsonBtnLabel" className="text-[10px] text-[#007b83] font-medium mt-1.5">
              Save
            </span>
          </button>

          <button type="button" className="flex flex-col items-center group cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-[#007b83] flex items-center justify-center text-white group-hover:bg-[#005f66] transition-colors shadow-xs">
              <span className="text-sm">🧭</span>
            </div>
            <span className="text-[10px] text-[#007b83] font-medium mt-1.5">Nearby</span>
          </button>

          <button type="button" className="flex flex-col items-center group cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-[#007b83] flex items-center justify-center text-white group-hover:bg-[#005f66] transition-colors shadow-xs">
              <span className="text-sm">📱</span>
            </div>
            <span className="text-[10px] text-[#007b83] font-medium mt-1.5">Send to phone</span>
          </button>

          <button type="button" className="flex flex-col items-center group cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-[#007b83] flex items-center justify-center text-white group-hover:bg-[#005f66] transition-colors shadow-xs">
              <span className="text-sm">🔗</span>
            </div>
            <span className="text-[10px] text-[#007b83] font-medium mt-1.5">Share</span>
          </button>
        </div>

        {/* 5. Google Maps List Items (BAG Feiten & Overeenkomsten) */}
        <div className="divide-y divide-slate-100 text-sm text-slate-800">
          {/* Adres */}
          <div className="flex items-start px-5 py-3.5 hover:bg-slate-50 transition-colors">
            <div className="w-7 shrink-0 text-[#007b83] mt-0.5">📍</div>
            <div className="flex-1 min-w-0 pr-2">
              <div id="displayFullAddress" className="text-sm font-normal text-slate-900 leading-snug">
                {buildingState?.address || 'Rijksweg 153b, 6247 AD Gronsveld'}
              </div>
              <div id="displayRegionCountry" className="text-xs text-slate-400 mt-0.5">
                Limburg, Nederland
              </div>
            </div>
          </div>

          {/* Label */}
          <div className="px-5 py-3 hover:bg-slate-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 shrink-0 text-[#007b83]">🏷️</div>
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
                ✏️
              </button>
            </div>
            {isEditingLabel && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Bijv. Eengezinswoning"
                  className="flex-1 text-xs border border-slate-300 rounded px-2 py-1"
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

          {/* Bouwjaar & Status */}
          <div className="flex items-start px-5 py-3 hover:bg-slate-50 transition-colors">
            <div className="w-7 shrink-0 text-[#007b83] mt-0.5">🏛️</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-normal text-slate-900">
                Bouwjaar <strong id="displayBouwjaar" className="font-medium text-slate-800">{bouwjaar}</strong>
              </div>
              <div id="displayPandStatus" className="text-xs text-slate-400 mt-0.5">
                {buildingState?.pandStatus || 'Pand in gebruik'} • {buildingState?.bouwtypologie || 'Vrijstaand woonhuis'}
              </div>
            </div>
          </div>

          {/* Oppervlakte & Gebruik */}
          <div className="flex items-start px-5 py-3 hover:bg-slate-50 transition-colors">
            <div className="w-7 shrink-0 text-[#007b83] mt-0.5">📐</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-normal text-slate-900">
                <strong id="displayOppervlakte" className="font-medium text-slate-800">{oppervlakte}</strong> m² woonoppervlakte
              </div>
              <div id="displayGebruiksdoel" className="text-xs text-slate-400 mt-0.5">
                {buildingState?.gebruiksdoel || 'Woonfunctie'}
              </div>
            </div>
          </div>

          {/* Etages / Bouwlagen */}
          <div id="rowEtages" className="flex items-start px-5 py-3 hover:bg-slate-50 transition-colors">
            <div className="w-7 shrink-0 text-[#007b83] mt-0.5">🪜</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-normal text-slate-900">
                <span id="displayEtages">Etages <strong>{bouwlagen} bouwlagen</strong></span>
              </div>
              <div id="displayEtagesSub" className="text-xs text-slate-400 mt-0.5">
                3D BAG AHN5 laserscan
              </div>
            </div>
          </div>

          {/* Perceeloppervlakte */}
          <div className="flex items-start px-5 py-3 hover:bg-slate-50 transition-colors">
            <div className="w-7 shrink-0 text-[#007b83] mt-0.5">🔲</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-normal text-slate-900">
                <strong id="displayPerceel" className="font-medium text-slate-800">411</strong> m² perceel
              </div>
              <div id="displayPerceelSub" className="text-xs text-slate-400 mt-0.5">
                Kadastraal perceel Gronsveld B 2882
              </div>
            </div>
          </div>

          {/* Gebouwhoogte */}
          <div className="flex items-start px-5 py-3 hover:bg-slate-50 transition-colors">
            <div className="w-7 shrink-0 text-[#007b83] mt-0.5">↕️</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-normal text-slate-900">
                <span id="displayHoogte">Hoogte <strong>{nokhoogte} m</strong> (nok)</span>
              </div>
              <div id="displayHoogteSub" className="text-xs text-slate-400 mt-0.5">
                Gebouwvolume {buildingState?.volumeM3 || 744} m³ • 3D BAG AHN5
              </div>
            </div>
          </div>

          {/* WOZ-waarde */}
          <div className="flex items-start px-5 py-3 hover:bg-slate-50 transition-colors">
            <div className="w-7 shrink-0 text-[#007b83] mt-0.5">💶</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-normal text-slate-900">
                <span id="displayWoz">WOZ-waarde <strong>€ 373.000</strong></span>
              </div>
              <div id="displayWozSub" className="text-xs text-slate-400 mt-0.5">
                Peildatum 1 jan 2024 • Kadaster WOZ
              </div>
            </div>
          </div>
        </div>

        {/* 6. Photos, Satellite & Floorplan Section */}
        <div className="p-5 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-sm font-medium text-slate-900">Foto&apos;s & Plattegrond</div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {/* Google Satellite / Map Toggle Mini */}
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
                <span>🛰️ Satelliet</span>
              </div>
            </div>

            {/* Plattegrond Buitenmuren Mini */}
            <div
              id="miniFloorplanContainer"
              onClick={onOpenFloorplan}
              className="relative rounded-lg overflow-hidden h-28 bg-white group cursor-pointer shadow-xs border border-slate-200 hover:border-[#1a73e8] transition-all flex flex-col items-center justify-center p-1.5"
              title="Bekijk plattegrond van buitenmuren met maatvoering"
            >
              <div id="miniFloorplanPreview" className="w-full h-full flex items-center justify-center pointer-events-none">
                <svg viewBox="0 0 100 100" className="w-16 h-16 opacity-75">
                  <rect x="20" y="15" width="60" height="70" fill="none" stroke="#334155" strokeWidth="6" />
                  <line x1="10" y1="15" x2="10" y2="85" stroke="#0284c7" strokeWidth="2" strokeDasharray="4 2" />
                  <text x="50" y="55" fontSize="12" fill="#0284c7" textAnchor="middle" fontWeight="bold">2D</text>
                </svg>
              </div>
              <div className="absolute bottom-1.5 left-1.5 bg-white/90 backdrop-blur-xs text-slate-800 px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 shadow-xs pointer-events-none z-10 border border-slate-200">
                <span className="text-[#1a73e8]">📐</span>
                <span>Plattegrond</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
