import React, { useState } from 'react';
import { ActiveView } from '@/components/sidebar/PlaceSidebar';
import { FloorplanViewer } from '@/components/floorplan/FloorplanViewer';
import { CrossSectionViewer } from '@/components/cross-section/CrossSectionViewer';
import { Isometric3DViewer } from '@/components/3d/Isometric3DViewer';
import { StreetViewViewer } from '@/components/map/StreetViewViewer';
import { InteractiveMapPicker } from '@/components/map/InteractiveMapPicker';
import { StreetViewTimelineCarousel, HistoricalPanoItem } from '@/components/timelines/StreetViewTimelineCarousel';
import { AerialTimelineCarousel } from '@/components/timelines/AerialTimelineCarousel';
import { Search, Compass, MapPin } from 'lucide-react';

export interface ViewerCanvasProps {
  activeView: ActiveView;
  isSidebarOpen: boolean;
  currentBuildingData: any | null;
  searchedAddress: string;
  currentCoords: { lat: number; lng: number };
  onSelectCoords: (coords: { lat: number; lng: number }) => void;
  onSelectSampleAddress?: (address: string) => void;
}

export function ViewerCanvas({
  activeView,
  isSidebarOpen,
  currentBuildingData,
  searchedAddress,
  currentCoords,
  onSelectCoords,
  onSelectSampleAddress,
}: ViewerCanvasProps) {
  // Street view historical panos
  const [selectedPanoId, setSelectedPanoId] = useState<string | undefined>(undefined);
  const samplePanos: HistoricalPanoItem[] = [
    { panoId: 'current', label: 'Aug 2024', isActive: !selectedPanoId },
    { panoId: 'hist-2023', label: 'Sep 2023', isActive: selectedPanoId === 'hist-2023' },
    { panoId: 'hist-2019', label: 'Mei 2019', isActive: selectedPanoId === 'hist-2019' },
    { panoId: 'hist-2016', label: 'Aug 2016', isActive: selectedPanoId === 'hist-2016' },
    { panoId: 'hist-2010', label: 'Okt 2010', isActive: selectedPanoId === 'hist-2010' },
  ];

  // Satellite historical aerial photo years
  const [selectedAerialYear, setSelectedAerialYear] = useState<number>(2024);

  // If no building is selected yet, render the clean, zero-hallucination empty state
  if (!currentBuildingData) {
    return (
      <main
        className={`flex-1 h-full w-full relative flex items-center justify-center transition-all duration-300 ${
          isSidebarOpen ? 'md:pl-[420px]' : 'pl-0'
        }`}
      >
        <div className="max-w-md mx-auto p-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-teal-400 mb-6 shadow-2xl">
            <Compass className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
            Woninginrichter 3D Scanner
          </h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Zoek linksboven een adres of postcode om de officiële Kadaster- en 3D BAG geometrie in te laden.
          </p>

          <div className="w-full bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 text-left">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
              Voorbeeldadressen:
            </span>
            <div className="flex flex-col gap-2">
              {[
                'Rijksweg 153b, Gronsveld',
                'Keizersgracht 486, Amsterdam',
                'Europalaan 100, Utrecht',
              ].map((addr) => (
                <button
                  key={addr}
                  onClick={() => onSelectSampleAddress?.(addr)}
                  className="flex items-center gap-2 text-xs text-teal-400 hover:text-teal-300 hover:bg-slate-850 p-2 rounded-xl transition-colors text-left"
                >
                  <MapPin className="w-3.5 h-3.5 opacity-70" />
                  <span>{addr}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Active view canvas
  return (
    <main
      className={`flex-1 h-full w-full relative overflow-hidden transition-all duration-300 ${
        isSidebarOpen ? 'md:pl-[420px]' : 'pl-0'
      }`}
    >
      {/* 1. 2D Floorplan Viewer */}
      {activeView === '2d' && (
        <div className="w-full h-full flex flex-col justify-center items-center p-4">
          <FloorplanViewer
            buildingData={currentBuildingData}
            typology={currentBuildingData.typology}
            address={searchedAddress}
          />
        </div>
      )}

      {/* 2. Cross-Section Viewer */}
      {activeView === 'section' && (
        <div className="w-full h-full flex flex-col justify-center items-center p-4">
          <CrossSectionViewer
            typology={currentBuildingData.typology}
            address={searchedAddress}
          />
        </div>
      )}

      {/* 3. 3D Model Viewer */}
      {activeView === '3d' && (
        <div className="w-full h-full relative">
          <Isometric3DViewer
            typology={currentBuildingData.typology}
            address={searchedAddress}
          />
        </div>
      )}

      {/* 4. Street View with Historical Timeline Dock */}
      {activeView === 'streetview' && (
        <div className="w-full h-full relative">
          <StreetViewViewer
            lat={currentCoords.lat}
            lng={currentCoords.lng}
            heading={currentBuildingData.frontFacadeHeading || 0}
            address={searchedAddress}
            panoId={selectedPanoId}
          />
          <StreetViewTimelineCarousel
            panos={samplePanos}
            activePanoId={selectedPanoId}
            onSelectPano={(panoId) => setSelectedPanoId(panoId)}
          />
        </div>
      )}

      {/* 5. Satellite View with Historical Aerial Orthophoto Dock */}
      {activeView === 'satellite' && (
        <div className="w-full h-full relative">
          <InteractiveMapPicker
            center={currentCoords}
            zoom={19}
            selectedCoords={currentCoords}
            onSelectCoords={onSelectCoords}
            aerialYear={selectedAerialYear}
          />
          <AerialTimelineCarousel
            selectedYear={selectedAerialYear}
            onSelectYear={(year) => setSelectedAerialYear(year)}
          />
        </div>
      )}
    </main>
  );
}
