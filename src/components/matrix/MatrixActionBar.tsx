'use client';

import React from 'react';

export interface MatrixActionBarProps {
  columnSelectMode: boolean;
  selectedColumnCount: number;
  onToggleColumnSelectMode: () => void;
  onOpenMediaDrawer: (tab: 'foto' | 'video' | 'opmerking') => void;
  historischDocumentUrl?: string;
  isHeaderCollapsed?: boolean;
  onToggleHeaderCollapse?: () => void;
}

/**
 * Actiebalk voor kolomselectie, mediadrawer en documentkoppelingen (V6).
 * FSM processtappen zijn ondergebracht in TopNav; niveauselectie via zwevende popover op kolom 0.
 * Voldoet aan INV-GOV-22 (<100 regels, 0 hooks).
 */
export function MatrixActionBar({
  columnSelectMode,
  selectedColumnCount,
  onToggleColumnSelectMode,
  onOpenMediaDrawer,
  historischDocumentUrl,
  isHeaderCollapsed,
  onToggleHeaderCollapse,
}: MatrixActionBarProps) {
  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
      {/* LINKER SECTIE: Matrix Status Indicatie */}
      <div className="flex items-center gap-2 py-1">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
          Matrix
        </span>
      </div>

      {/* RECHTER SECTIE: LOGICTRADE DOCUMENT, MEDIA & ACTIEKNOPPEN */}
      <div className="flex items-center gap-1.5">
        {historischDocumentUrl && (
          <a
            href={historischDocumentUrl}
            target="_blank"
            rel="noopener noreferrer"
            id="btn-historisch-document"
            className="px-2 py-1 rounded-lg text-xs font-semibold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition cursor-pointer flex items-center gap-1 shadow-2xs"
            title="Origineel historisch LogicTrade brondocument openen"
          >
            <span>📄</span>
            <span className="hidden lg:inline">LT Doc</span>
          </a>
        )}

        <button
          type="button"
          onClick={() => onOpenMediaDrawer('foto')}
          className="px-2 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
        >
          📷 <span className="hidden sm:inline">+ Foto</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenMediaDrawer('video')}
          className="px-2 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
        >
          🎥 <span className="hidden sm:inline">+ Video</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenMediaDrawer('opmerking')}
          className="px-2 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
        >
          📝 <span className="hidden sm:inline">+ Notitie</span>
        </button>

        <div className="h-4 w-px bg-slate-200 mx-0.5" />

        {onToggleHeaderCollapse && (
          <button
            type="button"
            id="btn-toggle-header-collapse"
            onClick={onToggleHeaderCollapse}
            aria-expanded={!isHeaderCollapsed}
            aria-controls="order-meta-card"
            aria-label={isHeaderCollapsed ? 'Orderinformatie tonen' : 'Orderinformatie inklappen'}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1 shadow-2xs"
            title={isHeaderCollapsed ? 'Orderinformatie tonen' : 'Orderinformatie inklappen'}
          >
            <span>{isHeaderCollapsed ? 'Orderinfo ▼' : 'Orderinfo ▲'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleColumnSelectMode}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
            columnSelectMode
              ? 'bg-blue-600 text-white ring-2 ring-blue-300'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
          }`}
        >
          <span>📋</span>
          <span>{columnSelectMode ? `Selectie (${selectedColumnCount})` : 'Posities Selecteren'}</span>
        </button>
      </div>
    </div>
  );
}
