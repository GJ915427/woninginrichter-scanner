'use client';

import React from 'react';

export interface MatrixClusterFloatingBarProps {
  selectedPositionIds: string[];
  isSingleRoom: boolean;
  roomName?: string;
  onOpenClusterModal: () => void;
  onClearSelection: () => void;
}

export function MatrixClusterFloatingBar({
  selectedPositionIds,
  isSingleRoom,
  roomName,
  onOpenClusterModal,
  onClearSelection,
}: MatrixClusterFloatingBarProps) {
  if (selectedPositionIds.length === 0) return null;

  return (
    <aside
      role="toolbar"
      aria-label="Cluster selectie actiebalk"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col sm:flex-row items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 select-none animate-in slide-in-from-bottom-5 duration-200"
    >
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-xs font-bold">
          {selectedPositionIds.length}
        </span>
        <span className="text-xs font-medium text-slate-200">
          {selectedPositionIds.length === 1
            ? '1 kolom geselecteerd'
            : `${selectedPositionIds.length} kolommen geselecteerd`}
          {roomName && isSingleRoom && ` in ${roomName}`}
        </span>
      </div>

      {!isSingleRoom && (
        <span className="text-[11px] font-semibold text-amber-300 bg-amber-950/80 border border-amber-600/50 px-2.5 py-1 rounded-md">
          ⚠️ Samenvoegen vereist posities binnen één ruimte
        </span>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenClusterModal}
          disabled={!isSingleRoom || selectedPositionIds.length < 2}
          title={
            !isSingleRoom
              ? 'Posities moeten zich binnen dezelfde ruimte bevinden om samen te voegen'
              : selectedPositionIds.length < 2
              ? 'Selecteer minimaal 2 posities om een cluster te vormen'
              : 'Voeg de geselecteerde posities samen tot één cluster'
          }
          className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed shadow transition-colors"
        >
          <span>🔗</span>
          <span>Samenvoegen tot Cluster</span>
        </button>

        <button
          type="button"
          disabled
          title="Posities verplaatsen volgt in een latere release"
          className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium text-slate-400 bg-slate-800 opacity-60 cursor-not-allowed border border-slate-700"
        >
          <span>↔️</span>
          <span>Posities Verplaatsen</span>
        </button>

        <button
          type="button"
          onClick={onClearSelection}
          className="flex items-center justify-center px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Deselecteer alle kolommen"
        >
          <span>✕ Wis selectie</span>
        </button>
      </div>
    </aside>
  );
}
