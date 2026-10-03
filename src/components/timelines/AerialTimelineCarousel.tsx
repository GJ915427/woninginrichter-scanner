import React from 'react';
import { Layers, Sparkles } from 'lucide-react';

export interface AerialTimelineCarouselProps {
  selectedYear: number;
  onSelectYear: (year: number) => void;
  availableYears?: number[];
}

export function AerialTimelineCarousel({
  selectedYear,
  onSelectYear,
  availableYears = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
}: AerialTimelineCarouselProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-[90vw] md:max-w-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/70 shadow-2xl rounded-2xl p-2.5 flex items-center gap-3">
      <div className="flex items-center gap-1.5 px-2 text-slate-400 border-r border-slate-700/60 pr-3">
        <Layers className="w-4 h-4 text-teal-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          PDOK Luchtfoto
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-thin scrollbar-thumb-slate-700">
        {availableYears.map((year) => {
          const isSelected = year === selectedYear;
          const isLatest = year === 2024;
          return (
            <button
              key={year}
              onClick={() => onSelectYear(year)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20 ring-2 ring-teal-400'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {isLatest && <Sparkles className="w-3 h-3 text-amber-400" />}
              <span>{year}</span>
              {year >= 2021 && (
                <span className="text-[9px] px-1 py-0.2 bg-slate-700/80 text-teal-300 rounded font-mono">
                  8cm
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
