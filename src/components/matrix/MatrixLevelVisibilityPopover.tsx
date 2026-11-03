'use client';

import React, { useEffect } from 'react';
import { HeaderLevelVisibility } from '../../types/matrix';

export interface MatrixLevelVisibilityPopoverProps {
  isOpen: boolean;
  anchorPosition: { x: number; y: number };
  visibleLevels: HeaderLevelVisibility;
  onToggleLevel: (level: 'etage' | 'ruimte' | 'cluster') => void;
  onClose: () => void;
}

/**
 * Zwevende popover voor niveau-zichtbaarheid (V6).
 * Wordt buiten de tabelkop gerenderd via MatrixOverlayCoordinator.
 * Voldoet aan INV-GOV-22 (<110 regels, 1 hook), WAI-ARIA role="dialog",
 * 2D viewport boundary clamping en Fitts' Law touch targets >= 44px.
 */
export function MatrixLevelVisibilityPopover({
  isOpen,
  anchorPosition,
  visibleLevels,
  onToggleLevel,
  onClose,
}: MatrixLevelVisibilityPopoverProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const left = typeof window !== 'undefined'
    ? Math.max(16, Math.min(anchorPosition.x, window.innerWidth - 240))
    : anchorPosition.x;
  const top = typeof window !== 'undefined'
    ? Math.max(16, Math.min(anchorPosition.y, window.innerHeight - 240))
    : anchorPosition.y;

  return (
    <>
      {/* Click-outside backdrop */}
      <div
        className="fixed inset-0 z-40 bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Floating Popover Dialog */}
      <div
        role="dialog"
        aria-label="Niveau zichtbaarheid"
        aria-modal="false"
        className="fixed z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-2 w-56 select-none animate-in fade-in zoom-in-95 duration-100"
        style={{ left: `${left}px`, top: `${top}px` }}
      >
        <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Niveaus
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluit pop-up"
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-1 py-1">
          {/* Etage Row */}
          <button
            type="button"
            onClick={() => onToggleLevel('etage')}
            aria-pressed={visibleLevels.etage}
            className="flex items-center justify-between px-3 py-2 min-h-[44px] rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">🏢</span>
              <span>Etage</span>
            </span>
            <span
              className={`px-2 py-0.5 text-[10px] rounded-full font-bold transition-colors ${
                visibleLevels.etage
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {visibleLevels.etage ? 'AAN' : 'UIT'}
            </span>
          </button>

          {/* Ruimte Row */}
          <button
            type="button"
            onClick={() => onToggleLevel('ruimte')}
            aria-pressed={visibleLevels.ruimte}
            className="flex items-center justify-between px-3 py-2 min-h-[44px] rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">🚪</span>
              <span>Ruimte</span>
            </span>
            <span
              className={`px-2 py-0.5 text-[10px] rounded-full font-bold transition-colors ${
                visibleLevels.ruimte
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {visibleLevels.ruimte ? 'AAN' : 'UIT'}
            </span>
          </button>

          {/* Cluster Row */}
          <button
            type="button"
            onClick={() => onToggleLevel('cluster')}
            aria-pressed={visibleLevels.cluster}
            className="flex items-center justify-between px-3 py-2 min-h-[44px] rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">🔗</span>
              <span>Cluster</span>
            </span>
            <span
              className={`px-2 py-0.5 text-[10px] rounded-full font-bold transition-colors ${
                visibleLevels.cluster
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {visibleLevels.cluster ? 'AAN' : 'UIT'}
            </span>
          </button>

          {/* Positie (vast niveau) */}
          <div
            className="flex items-center justify-between px-3 py-2 min-h-[44px] rounded-lg text-xs font-semibold text-slate-400 bg-slate-50/80 cursor-default"
            title="Positieniveau is altijd actief"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">📍</span>
              <span>Positie</span>
            </span>
            <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-slate-200 text-slate-600">
              VAST
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
