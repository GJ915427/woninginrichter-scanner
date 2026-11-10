'use client';

// [SPEC-CHANGE-AUTHORIZED: Implementatie van zuivere contextuele procesactiebalk conform Stitch Optie 1 met Google Material Symbols Outlined (square_foot geodriehoek voor Inmeten), h-action-btn (32px) met W3C pseudo-element expansie (WCAG 2.5.5/2.5.8), rounded-control en zuivering van Posities Selecteren en Orderinfo collapse knoppen conform Stitch design]
import React from 'react';
import {
  IconCalendarMonth,
  IconDescription,
  IconSquareFoot,
  IconBuild,
  IconLock,
} from './MaterialSymbols';

export interface MatrixActionBarProps {
  workflowStage?: string;
  onWorkflowStageClick?: () => void;
  onMakeAppointment?: () => void;
  onMakeReport?: () => void;
  onInmeten?: () => void;
  onMonteren?: () => void;
  onAfronden?: () => void;
  isAfrondenLocked?: boolean;
  statusAlert?: { message: string; type: 'success' | 'error' | 'info' } | null;
  // Optionele backwards compatibiliteitsprops
  columnSelectMode?: boolean;
  selectedColumnCount?: number;
  onToggleColumnSelectMode?: () => void;
  isHeaderCollapsed?: boolean;
  onToggleHeaderCollapse?: () => void;
  onOpenMediaDrawer?: (tab: 'foto' | 'video' | 'opmerking') => void;
  historischDocumentUrl?: string;
}

/**
 * MatrixActionBar (INV-GOV-22)
 * Zuivere procesactiebalk conform Google Stitch Optie 1 met Google Material Symbols Outlined vector iconen.
 * Voldoet aan INV-GOV-22 (< 120 regels, 0 hooks).
 */
export function MatrixActionBar({
  workflowStage = 'Montage gepland',
  onWorkflowStageClick,
  onMakeAppointment,
  onMakeReport,
  onInmeten,
  onMonteren,
  onAfronden,
  isAfrondenLocked = true,
  statusAlert,
}: MatrixActionBarProps) {
  return (
    <div className="bg-white border-b border-slate-200 px-6 py-2 flex flex-wrap items-center justify-between gap-3 shadow-2xs select-none">
      {/* LINKER SECTIE: 5 Contextuele Procesknoppen conform Stitch met Material Symbols vector SVGs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onMakeAppointment}
          className="h-action-btn relative before:content-[''] before:absolute before:-inset-y-1.5 before:inset-x-0 before:min-h-[44px] px-3 py-1.5 rounded-control text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
        >
          <IconCalendarMonth size={14} className="text-blue-600 shrink-0" />
          <span>Maak Afspraak</span>
        </button>

        <button
          type="button"
          onClick={onMakeReport}
          className="h-action-btn relative before:content-[''] before:absolute before:-inset-y-1.5 before:inset-x-0 before:min-h-[44px] px-3 py-1.5 rounded-control text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
        >
          <IconDescription size={14} className="text-blue-600 shrink-0" />
          <span>Maak Rapport</span>
        </button>

        <button
          type="button"
          onClick={onInmeten}
          className="h-action-btn relative before:content-[''] before:absolute before:-inset-y-1.5 before:inset-x-0 before:min-h-[44px] px-3 py-1.5 rounded-control text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
        >
          <IconSquareFoot size={14} className="text-blue-600 shrink-0" />
          <span>Inmeten</span>
        </button>

        <button
          type="button"
          onClick={onMonteren}
          className="h-action-btn relative before:content-[''] before:absolute before:-inset-y-1.5 before:inset-x-0 before:min-h-[44px] px-3 py-1.5 rounded-control text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
        >
          <IconBuild size={14} className="text-blue-600 shrink-0" />
          <span>Monteren</span>
        </button>

        <button
          type="button"
          disabled={isAfrondenLocked}
          onClick={onAfronden}
          title={
            isAfrondenLocked
              ? "Status moet 'Gemonteerd' zijn & 0 openstaande punten"
              : 'Order afronden en factureren'
          }
          className="h-action-btn relative before:content-[''] before:absolute before:-inset-y-1.5 before:inset-x-0 before:min-h-[44px] px-3 py-1.5 rounded-control text-xs font-semibold bg-white border border-slate-200 text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow-2xs"
        >
          <IconLock size={14} className="text-slate-400 shrink-0" />
          <span>Afronden</span>
        </button>
      </div>

      {/* STATUS MELDING (WCAG 4.1.3 status message) */}
      {statusAlert && (
        <div
          role="alert"
          aria-live="polite"
          className={`text-xs px-2.5 py-1 rounded-control font-medium flex items-center gap-1.5 transition-all ${
            statusAlert.type === 'error'
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : statusAlert.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}
        >
          <span>{statusAlert.message}</span>
        </div>
      )}

      {/* RECHTER SECTIE: Huidige Fase Tag conform Stitch Optie 1 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          id="workflowStageTag"
          onClick={onWorkflowStageClick}
          className="h-action-btn relative before:content-[''] before:absolute before:-inset-y-1.5 before:inset-x-0 before:min-h-[44px] inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition cursor-pointer shadow-2xs"
          title="Klik om workflow procesmodal te openen"
        >
          <span className="text-slate-400 text-xs font-normal">Huidige fase:</span>
          <span className="font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-control border border-blue-100">
            {workflowStage}
          </span>
        </button>
      </div>
    </div>
  );
}
