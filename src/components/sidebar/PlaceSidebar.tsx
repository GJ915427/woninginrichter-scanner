import React from 'react';
import {
  Compass,
  Layers,
  Box,
  Camera,
  Globe2,
  ChevronLeft,
  ChevronRight,
  Home,
  Calendar,
  Maximize2,
  Building,
  Ruler,
  Zap,
} from 'lucide-react';
import { AddressSearchBar, AddressSuggestion } from '@/components/map/AddressSearchBar';

export type ActiveView = '2d' | 'section' | '3d' | 'streetview' | 'satellite';

export interface PlaceSidebarProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  searchedAddress: string;
  onSelectAddress: (suggestion: any) => void;
  isLoadingAddress: boolean;
  buildingData: {
    address?: string;
    postalCode?: string;
    city?: string;
    constructionYear?: number;
    woningType?: string;
    surfaceArea?: number;
    floorArea?: number;
    parcelArea?: number;
    roofType?: string;
    flatRoofArea?: number;
    slopedRoofArea?: number;
    roofSlopeDeg?: number;
    ridgeHeightNap?: number;
    eaveHeightNap?: number;
    volumeM3?: number;
    energyLabel?: string;
    heroImageUrl?: string;
  } | null;
}

export function PlaceSidebar({
  isOpen,
  onToggleOpen,
  activeView,
  onSelectView,
  searchedAddress,
  onSelectAddress,
  isLoadingAddress,
  buildingData,
}: PlaceSidebarProps) {
  const energyLabelColors: Record<string, string> = {
    'A++++': 'bg-emerald-600 text-white',
    'A+++': 'bg-emerald-600 text-white',
    'A++': 'bg-emerald-600 text-white',
    'A+': 'bg-emerald-500 text-white',
    A: 'bg-green-600 text-white',
    B: 'bg-lime-600 text-white',
    C: 'bg-yellow-500 text-slate-900',
    D: 'bg-amber-500 text-white',
    E: 'bg-orange-500 text-white',
    F: 'bg-orange-600 text-white',
    G: 'bg-red-600 text-white',
  };

  const currentLabelColor =
    buildingData?.energyLabel && energyLabelColors[buildingData.energyLabel]
      ? energyLabelColors[buildingData.energyLabel]
      : 'bg-slate-700 text-slate-200';

  return (
    <>
      {/* Toggle button when closed on mobile/desktop */}
      {!isOpen && (
        <button
          onClick={onToggleOpen}
          aria-label="Open pandinformatie"
          className="fixed top-4 left-4 z-40 bg-slate-900/90 hover:bg-slate-800 text-white p-3 rounded-2xl shadow-2xl border border-slate-700/60 backdrop-blur-md transition-all flex items-center gap-2 group"
        >
          <ChevronRight className="w-5 h-5 text-teal-400 group-hover:translate-x-0.5 transition-transform" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Panddetails
          </span>
        </button>
      )}

      {/* Floating PlaceSidebar */}
      <aside
        id="placeSidebar"
        className={`fixed top-0 left-0 h-full z-40 w-full sm:w-[420px] bg-slate-900/95 backdrop-blur-xl border-r border-slate-800/80 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Search header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center gap-2">
          <div className="flex-1">
            <AddressSearchBar
              onSelectAddress={onSelectAddress}
            />
          </div>
          <button
            onClick={onToggleOpen}
            aria-label="Sluit sidebar"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Hero image preview */}
        <div className="relative h-44 bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800">
          {buildingData?.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={buildingData.heroImageUrl}
              alt="Gevelaanzicht"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 gap-2 p-4 text-center">
              <Building className="w-10 h-10 text-teal-500/50" />
              <span className="text-xs text-slate-400">
                {searchedAddress ? searchedAddress : 'Selecteer een woning om te inspecteren'}
              </span>
            </div>
          )}

          {buildingData?.energyLabel && (
            <div
              className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-bold shadow-lg ${currentLabelColor}`}
            >
              Label {buildingData.energyLabel}
            </div>
          )}
        </div>

        {/* Address & title bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60">
          <h1 className="text-lg font-bold text-white tracking-tight truncate">
            {buildingData?.address || searchedAddress || 'Geen adres geselecteerd'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {buildingData?.postalCode ? `${buildingData.postalCode} ${buildingData.city || ''}` : 'Nederland • Kadaster & 3D BAG'}
          </p>

          {/* Quick status chips */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {buildingData?.constructionYear && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                <Calendar className="w-3 h-3 text-teal-400" />
                {buildingData.constructionYear}
              </span>
            )}
            {buildingData?.woningType && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                <Home className="w-3 h-3 text-teal-400" />
                {buildingData.woningType}
              </span>
            )}
            {buildingData?.floorArea && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                <Maximize2 className="w-3 h-3 text-teal-400" />
                {buildingData.floorArea} m² GO
              </span>
            )}
          </div>
        </div>

        {/* The 5 Modern Circular View Buttons (replacing Screenshot 1) */}
        <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between gap-1">
          {/* 1. 2D Plattegrond */}
          <button
            onClick={() => onSelectView('2d')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
              activeView === '2d'
                ? 'text-teal-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                activeView === '2d'
                  ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20 ring-2 ring-teal-400'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight">2D Plan</span>
          </button>

          {/* 2. Langssnede */}
          <button
            onClick={() => onSelectView('section')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
              activeView === 'section'
                ? 'text-teal-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                activeView === 'section'
                  ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20 ring-2 ring-teal-400'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              <Ruler className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight">Doorsnede</span>
          </button>

          {/* 3. 3D Model */}
          <button
            onClick={() => onSelectView('3d')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
              activeView === '3d'
                ? 'text-teal-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                activeView === '3d'
                  ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20 ring-2 ring-teal-400'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              <Box className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight">3D Model</span>
          </button>

          {/* 4. Street View */}
          <button
            onClick={() => onSelectView('streetview')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
              activeView === 'streetview'
                ? 'text-teal-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                activeView === 'streetview'
                  ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20 ring-2 ring-teal-400'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              <Camera className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight">Street View</span>
          </button>

          {/* 5. Satelliet */}
          <button
            onClick={() => onSelectView('satellite')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
              activeView === 'satellite'
                ? 'text-teal-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                activeView === 'satellite'
                  ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20 ring-2 ring-teal-400'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              <Globe2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight">Satelliet</span>
          </button>
        </div>

        {/* Scrollable Technical Details List (conforming to google_maps_picker.html) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Bouwkundige Specificaties
            </h2>
            <div className="space-y-2 bg-slate-950/40 rounded-xl p-3 border border-slate-800/60">
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Footprint Oppervlakte</span>
                <span className="font-semibold text-slate-200">
                  {buildingData?.surfaceArea ? `${buildingData.surfaceArea} m²` : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Gebruiksoppervlakte (GO)</span>
                <span className="font-semibold text-slate-200">
                  {buildingData?.floorArea ? `${buildingData.floorArea} m²` : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Perceeloppervlakte (DKK)</span>
                <span className="font-semibold text-slate-200">
                  {buildingData?.parcelArea ? `${buildingData.parcelArea} m²` : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Bouwjaar</span>
                <span className="font-semibold text-slate-200">
                  {buildingData?.constructionYear || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Bruto Inhoud</span>
                <span className="font-semibold text-slate-200">
                  {buildingData?.volumeM3 ? `${buildingData.volumeM3} m³` : '—'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Dak & Hoogtemetingen (3D BAG / AHN)
            </h2>
            <div className="space-y-2 bg-slate-950/40 rounded-xl p-3 border border-slate-800/60">
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Dakoppervlak Schuin</span>
                <span className="font-semibold text-slate-200">
                  {buildingData?.slopedRoofArea ? `${buildingData.slopedRoofArea} m²` : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Dakoppervlak Plat</span>
                <span className="font-semibold text-slate-200">
                  {buildingData?.flatRoofArea ? `${buildingData.flatRoofArea} m²` : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Hellingshoek</span>
                <span className="font-semibold text-slate-200">
                  {buildingData?.roofSlopeDeg ? `${buildingData.roofSlopeDeg}°` : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Nokhoogte (NAP)</span>
                <span className="font-semibold text-slate-200">
                  {buildingData?.ridgeHeightNap ? `+${buildingData.ridgeHeightNap.toFixed(2)} m` : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Goothoogte (NAP)</span>
                <span className="font-semibold text-slate-200">
                  {buildingData?.eaveHeightNap ? `+${buildingData.eaveHeightNap.toFixed(2)} m` : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-teal-950/30 rounded-xl border border-teal-800/40 text-[11px] text-teal-300/90 leading-relaxed">
            <span className="font-semibold text-teal-300">Geodata Bronverantwoording:</span>{' '}
            Afmetingen en dakschilden worden live berekend uit Kadaster BAG en TU Delft 3D BAG (LoD 2.2 CityJSON).
          </div>
        </div>
      </aside>
    </>
  );
}
