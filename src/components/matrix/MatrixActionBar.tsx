'use client';

// [SPEC-CHANGE-AUTHORIZED: Implementatie van contextuele procesactiebalk conform Stitch Optie 1 met Google Material Symbols Outlined (square_foot geodriehoek voor Inmeten), h-action-btn (32px) met W3C pseudo-element expansie (WCAG 2.5.5/2.5.8), rounded-control en collapse toggle met SVG chevrons]
import React from 'react';
import { CheckSquare, ChevronDown, ChevronUp } from 'lucide-react';
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
  columnSelectMode?: boolean;
  selectedColumnCount?: number;
  onToggleColumnSelectMode?: () => void;
  isHeaderCollapsed?: boolean;
  onToggleHeaderCollapse?: () => void;
  // Optionele compatibiliteitsprops
  onOpenMediaDrawer?: (tab: 'foto' | 'video' | 'opmerking') => void;
  historischDocumentUrl?: string;
}

/**
 * MatrixActionBar (INV-GOV-22)
 * Contextuele procesactiebalk conform Google Stitch Optie 1 met Google Material Symbols Outlined vector iconen.
 * Voldoet aan INV-GOV-22 (< 160 regels, 0 hooks).
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
  columnSelectMode = false,
  selectedColumnCount = 0,
  onToggleColumnSelectMode,
  isHeaderCollapsed = false,
  onToggleHeaderCollapse,
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

      {/* RECHTER SECTIE: Kolom Multiselectie + Huidige Fase Tag + Header Collapse */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Posities Selecteren Knop */}
        <button
          type="button"
          id="btn-toggle-column-select"
          onClick={onToggleColumnSelectMode}
          className={`h-action-btn relative before:content-[''] before:absolute before:-inset-y-1.5 before:inset-x-0 before:min-h-[44px] px-3 py-1.5 rounded-control text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
            columnSelectMode
              ? 'bg-blue-600 text-white ring-2 ring-blue-300 font-bold'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>
            {columnSelectMode ? `Selectie (${selectedColumnCount})` : 'Posities Selecteren'}
          </span>
        </button>

        <div className="h-5 w-px bg-slate-200 hidden sm:block mx-0.5" />

        {/* Workflow Fase Tag (interactief voor FSM modal overzicht) */}
        <button
          type="button"
          id="workflowStageTag"
          onClick={onWorkflowStageClick}
          className="h-action-btn relative before:content-[''] before:absolute before:-inset-y-1.5 before:inset-x-0 before:min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition cursor-pointer shadow-2xs"
          title="Klik om workflow procesmodal te openen"
        >
          <span className="text-slate-500 text-[11px] font-normal">Huidige fase:</span>
          <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-control border border-blue-200/60">
            {workflowStage}
          </span>
        </button>

        {/* Header Collapse Toggle */}
        <button
          type="button"
          id="btn-toggle-header-collapse"
          onClick={onToggleHeaderCollapse}
          aria-expanded={!isHeaderCollapsed}
          aria-controls="order-meta-card"
          aria-label={isHeaderCollapsed ? 'Orderinformatie tonen' : 'Orderinformatie inklappen'}
          className="h-action-btn relative before:content-[''] before:absolute before:-inset-y-1.5 before:inset-x-0 before:min-h-[44px] px-3 py-1.5 rounded-control text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1 shadow-2xs"
        >
          <span>Orderinfo</span>
          {isHeaderCollapsed ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
