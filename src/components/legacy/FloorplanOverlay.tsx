'use client';

import React, { useState, useMemo } from 'react';
import { Point2D } from '@/domain/legacy/collinear-simplifier';
import { generateLegacyFloorplanSvg } from '@/domain/legacy/svg-floorplan-renderer';
import { generateLegacySectionSvg } from '@/domain/legacy/svg-section-renderer';
import { LegacyBuildingState } from '@/domain/legacy/legacy-state-adapter';

interface FloorplanOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  basePoints: Point2D[];
  buildingState: LegacyBuildingState | null;
}

export const FloorplanOverlay: React.FC<FloorplanOverlayProps> = ({
  isOpen,
  onClose,
  basePoints,
  buildingState,
}) => {
  const [etage, setEtage] = useState<number | 'section'>(0);
  const [wallThickness, setWallThickness] = useState<number>(0.28);
  const [showInnerDims, setShowInnerDims] = useState<boolean>(true);
  const [showOuterDims, setShowOuterDims] = useState<boolean>(true);
  const [roofType, setRoofType] = useState<'auto' | 'slanted' | 'flat'>('auto');
  const [orientation, setOrientation] = useState<'north' | 'front_left'>('north');

  const svgContent = useMemo(() => {
    if (!isOpen || !basePoints || basePoints.length < 3) return '';

    if (etage === 'section') {
      return generateLegacySectionSvg({
        basePoints,
        frontWallIdx: 0,
        totalWoonoppervlakte: buildingState?.oppervlakte || 173,
        nokhoogte: buildingState?.nokhoogte || 9.3,
        goothoogte: buildingState?.goothoogte || 5.8,
        bouwlagen: buildingState?.bouwlagen || 3,
        goothoogteAanbouw: buildingState?.bag3d?.goothoogteAanbouw || 3.7,
      });
    }

    return generateLegacyFloorplanSvg({
      basePoints,
      frontWallIdx: 0,
      wallThickness,
      showInnerDimensions: showInnerDims,
      showOuterDimensions: showOuterDims,
      etageIndex: etage,
      totalWoonoppervlakte: buildingState?.oppervlakte || 173,
      roofType,
      orientation,
      oppDakPlat: buildingState?.oppDakPlat || 0,
      oppDakSchuin: buildingState?.oppDakSchuin || 0,
      bag3d: buildingState?.bag3d,
      isMandelig: buildingState ? buildingState.oppScheidingsmuur > 10 : true,
      mandeligWallIdx: 3,
    });
  }, [
    isOpen,
    basePoints,
    etage,
    wallThickness,
    showInnerDims,
    showOuterDims,
    roofType,
    orientation,
    buildingState,
  ]);

  const toggleOrientation = () => {
    setOrientation((prev) => (prev === 'north' ? 'front_left' : 'north'));
  };

  const activeAddress = buildingState?.address || 'Rijksweg 153b, Gronsveld';
  const activeFloorTitle =
    etage === 0
      ? 'Begane grond'
      : etage === 1
        ? '1e Verdieping'
        : etage === 2
          ? '2e Verdieping / Kap'
          : 'Zijaanzicht & Doorsnede';

  return (
    <div
      id="floorplanFullView"
      className={`${
        isOpen ? 'block' : 'hidden'
      } absolute inset-0 w-full h-full z-10 bg-white overflow-hidden select-none`}
    >
      {/* Top Floating Navigation & Floorplan Controls */}
      <div className="absolute top-4 left-4 md:left-[430px] right-4 z-20 flex items-center justify-between pointer-events-none">
        {/* Return to Map Button */}
        <button
          id="returnToMapBtn"
          onClick={onClose}
          className="pointer-events-auto flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-full shadow-md border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-all cursor-pointer"
          title="Terug naar Google Maps overzicht"
        >
          <span className="text-[#1a73e8] font-bold">←</span>
          <span>Kaart bekijken</span>
        </button>

        {/* Floorplan Info Pill */}
        <div className="hidden sm:flex pointer-events-auto items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-md border border-slate-200 text-xs text-slate-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span id="fpActiveAddressText" className="font-medium text-slate-800">
            {activeAddress}
          </span>
          <span className="text-slate-300">•</span>
          <span id="fpActiveFloorTitle" className="text-[#1a73e8] font-semibold">
            {activeFloorTitle}
          </span>
        </div>
      </div>

      {/* Google Indoor Maps Floor Pillar (Right Side) */}
      <div className="absolute right-4 top-20 z-20 flex flex-col items-center bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200 overflow-hidden text-xs font-medium">
        <button
          id="btnFloor2"
          onClick={() => setEtage(2)}
          className={`w-11 h-11 flex flex-col items-center justify-center border-b border-slate-100 transition-colors cursor-pointer ${
            etage === 2 ? 'bg-[#1a73e8] text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
          title="2e Verdieping / Opbouw (Concept)"
        >
          <span className="text-xs font-bold">3</span>
          <span className={`text-[9px] -mt-0.5 ${etage === 2 ? 'text-white/80' : 'text-slate-400'}`}>
            2e
          </span>
        </button>
        <button
          id="btnFloor1"
          onClick={() => setEtage(1)}
          className={`w-11 h-11 flex flex-col items-center justify-center border-b border-slate-100 transition-colors cursor-pointer ${
            etage === 1 ? 'bg-[#1a73e8] text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
          title="1e Verdieping (Concept)"
        >
          <span className="text-xs font-bold">2</span>
          <span className={`text-[9px] -mt-0.5 ${etage === 1 ? 'text-white/80' : 'text-slate-400'}`}>
            1e
          </span>
        </button>
        <button
          id="btnFloor0"
          onClick={() => setEtage(0)}
          className={`w-11 h-11 flex flex-col items-center justify-center border-b border-slate-100 transition-colors cursor-pointer ${
            etage === 0 ? 'bg-[#1a73e8] text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
          title="Begane Grond (Feitelijk)"
        >
          <span className="text-xs font-bold">BG</span>
          <span className={`text-[9px] -mt-0.5 ${etage === 0 ? 'text-white/80' : 'text-slate-400'}`}>
            Vloer
          </span>
        </button>
        <button
          id="btnFloorSection"
          onClick={() => setEtage('section')}
          className={`w-11 h-11 flex flex-col items-center justify-center transition-colors cursor-pointer ${
            etage === 'section' ? 'bg-[#1a73e8] text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
          title="Zijaanzicht & Doorsnede (Profiel)"
        >
          <span className="text-xs font-bold">☷</span>
          <span
            className={`text-[9px] -mt-0.5 ${
              etage === 'section' ? 'text-white/80' : 'text-slate-400'
            }`}
          >
            Profiel
          </span>
        </button>
      </div>

      {/* Google Street View Compass Widget */}
      <div id="fpCompassContainer" className="absolute right-4 top-[272px] z-20 flex flex-col items-center gap-1">
        <button
          id="btnFpCompass"
          onClick={toggleOrientation}
          className="w-12 h-12 rounded-full bg-white/95 backdrop-blur-md shadow-md border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all cursor-pointer"
          title="Wissel oriëntatie: Noord boven / Voorzijde links"
        >
          <div
            className="w-8 h-8 flex items-center justify-center transition-transform duration-500 ease-out"
            style={{
              transform: orientation === 'front_left' ? 'rotate(-90deg)' : 'rotate(0deg)',
            }}
          >
            <svg viewBox="0 0 36 36" className="w-8 h-8 pointer-events-none">
              <circle cx="18" cy="18" r="16" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
              <polygon points="18,5 14,18 18,15" fill="#ea4335" />
              <polygon points="18,5 22,18 18,15" fill="#c5221f" />
              <polygon points="18,31 14,18 18,15" fill="#94a3b8" />
              <polygon points="18,31 22,18 18,15" fill="#64748b" />
              <circle cx="18" cy="18" r="2.5" fill="#1e293b" />
            </svg>
          </div>
        </button>
        <span
          id="fpCompassModeLabel"
          className="text-[10px] font-bold text-slate-600 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-full shadow-xs border border-slate-200 select-none"
        >
          {orientation === 'front_left' ? 'Voorzijde ◀' : 'Noord ↑'}
        </span>
      </div>

      {/* Floating Controls Panel (Right Bottom) */}
      <div className="absolute right-4 bottom-6 z-20 bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-slate-200 p-3.5 space-y-3 w-72 max-w-[calc(100vw-32px)]">
        {/* Dakvorm Dropdown */}
        {etage === 2 && (
          <div id="fpRoofTypeContainer" className="space-y-1">
            <label htmlFor="fpRoofTypeSelect" className="text-[10px] text-slate-500 font-medium block">
              Dakvorm / 2e verdieping:
            </label>
            <select
              id="fpRoofTypeSelect"
              value={roofType}
              onChange={(e) => setRoofType(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-[#1a73e8] cursor-pointer"
            >
              <option value="auto">Auto (3D BAG Morfologie)</option>
              <option value="flat">Plat dak / Opbouw & Terras</option>
              <option value="slanted">Zadeldak (Kap / Schuin dak)</option>
            </select>
          </div>
        )}

        {/* Muurdikte Dropdown */}
        <div className="space-y-1">
          <label htmlFor="fpWallThicknessSelect" className="text-[10px] text-slate-500 font-medium block">
            Muurdikte:
          </label>
          <select
            id="fpWallThicknessSelect"
            value={wallThickness.toString()}
            onChange={(e) => setWallThickness(parseFloat(e.target.value))}
            className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-[#1a73e8] cursor-pointer"
          >
            <option value="0.25">25 cm (massief / steens)</option>
            <option value="0.28">28 cm (standaard spouw &lt;1975)</option>
            <option value="0.30">30 cm (spouw)</option>
            <option value="0.32">32 cm (geïsoleerd 1991-2005)</option>
            <option value="0.35">35 cm (nieuwbouw 2006-2014)</option>
            <option value="0.40">40 cm (dikke isolatie 2015+)</option>
          </select>
        </div>

        {/* Maatvoering Checklist */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
            Maten weergeven:
          </span>
          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none font-medium hover:text-slate-900 transition-colors">
            <input
              type="checkbox"
              id="chkInnerDims"
              checked={showInnerDims}
              onChange={(e) => setShowInnerDims(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-slate-300 accent-amber-500 cursor-pointer"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
            <span className="text-slate-800 font-medium">Binnenmaten</span>
          </label>
          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none font-medium hover:text-slate-900 transition-colors">
            <input
              type="checkbox"
              id="chkOuterDims"
              checked={showOuterDims}
              onChange={(e) => setShowOuterDims(e.target.checked)}
              className="w-4 h-4 rounded text-[#1a73e8] focus:ring-[#1a73e8] border-slate-300 accent-[#1a73e8] cursor-pointer"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block"></span>
            <span className="text-slate-800 font-medium">Buitenmaten</span>
          </label>
        </div>
      </div>

      {/* Dynamic SVG Canvas Wrapper (Padded for floating sidebar) */}
      <div
        id="floorplanSvgWrapper"
        className="w-full h-full flex items-center justify-center p-4 md:pl-[430px] transition-all duration-300"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
};
