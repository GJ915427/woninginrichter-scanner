import React from 'react';
import { History, Calendar } from 'lucide-react';

export interface HistoricalPanoItem {
  panoId: string;
  label: string; // e.g. "Aug 2024", "Sep 2023"
  date?: string;
  isActive?: boolean;
}

export interface StreetViewTimelineCarouselProps {
  panos: HistoricalPanoItem[];
  activePanoId?: string;
  onSelectPano: (panoId: string) => void;
}

export function StreetViewTimelineCarousel({
  panos,
  activePanoId,
  onSelectPano,
}: StreetViewTimelineCarouselProps) {
  if (!panos || panos.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-[90vw] md:max-w-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/70 shadow-2xl rounded-2xl p-2.5 flex items-center gap-3">
      <div className="flex items-center gap-1.5 px-2 text-slate-400 border-r border-slate-700/60 pr-3">
        <History className="w-4 h-4 text-teal-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          Tijdlijn
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-thin scrollbar-thumb-slate-700">
        {panos.map((item) => {
          const isSelected = item.panoId === activePanoId || item.isActive;
          return (
            <button
              key={item.panoId}
              onClick={() => onSelectPano(item.panoId)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20 ring-2 ring-teal-400'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Calendar className="w-3 h-3 opacity-70" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
