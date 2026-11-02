'use client';

import React from 'react';

export interface MatrixMediaFilterTabsProps {
  activeTypeTab: 'foto' | 'video' | 'opmerking';
  onTypeTabChange: (tab: 'foto' | 'video' | 'opmerking') => void;
  activeContextFilter: 'position' | 'room' | 'project';
  onContextFilterChange: (filter: 'position' | 'room' | 'project') => void;
  hasActivePosition?: boolean;
}

/**
 * Filter- en navigatietabs voor werfmedia conform INV-GOV-22 (<100 regels).
 * Scheidt typefilters (foto/video/opmerking) van contextfilters (positie/ruimte/project).
 */
export const MatrixMediaFilterTabs: React.FC<MatrixMediaFilterTabsProps> = ({
  activeTypeTab,
  onTypeTabChange,
  activeContextFilter,
  onContextFilterChange,
  hasActivePosition = true,
}) => {
  return (
    <div className="border-b border-slate-200 bg-white">
      {/* Context Scope Filter */}
      <div className="flex border-b border-slate-100 px-3 py-1.5 gap-1 text-[11px] font-medium bg-slate-50/70">
        <span className="text-slate-400 self-center text-[10px] mr-1 uppercase tracking-wider font-semibold">
          Context:
        </span>
        {hasActivePosition && (
          <button
            type="button"
            onClick={() => onContextFilterChange('position')}
            className={`px-2 py-0.5 rounded transition ${
              activeContextFilter === 'position'
                ? 'bg-blue-100 text-blue-800 font-bold'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Deze Positie
          </button>
        )}
        <button
          type="button"
          onClick={() => onContextFilterChange('room')}
          className={`px-2 py-0.5 rounded transition ${
            activeContextFilter === 'room'
              ? 'bg-blue-100 text-blue-800 font-bold'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          Ruimte
        </button>
        <button
          type="button"
          onClick={() => onContextFilterChange('project')}
          className={`px-2 py-0.5 rounded transition ${
            activeContextFilter === 'project'
              ? 'bg-blue-100 text-blue-800 font-bold'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          Heel Project
        </button>
      </div>

      {/* Media Type Tabs */}
      <div className="flex p-2 gap-1.5">
        <button
          type="button"
          onClick={() => onTypeTabChange('foto')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTypeTab === 'foto'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          📷 Foto&apos;s
        </button>
        <button
          type="button"
          onClick={() => onTypeTabChange('video')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTypeTab === 'video'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          🎥 Video&apos;s
        </button>
        <button
          type="button"
          onClick={() => onTypeTabChange('opmerking')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTypeTab === 'opmerking'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          📝 Notities
        </button>
      </div>
    </div>
  );
};
