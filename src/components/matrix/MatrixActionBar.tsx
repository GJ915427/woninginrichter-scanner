'use client';

import React from 'react';
import { FSM_STAGES, FsmProcessStep, HeaderLevelVisibility } from '../../types/matrix';

export interface MatrixActionBarProps {
  currentStage: number;
  onStageChange: (stage: number) => void;
  columnSelectMode: boolean;
  selectedColumnCount: number;
  onToggleColumnSelectMode: () => void;
  onOpenMediaDrawer: (tab: 'foto' | 'video' | 'opmerking') => void;
  onFsmStepClick?: (step: FsmProcessStep) => void;
  historischDocumentUrl?: string;
  isHeaderCollapsed?: boolean;
  onToggleHeaderCollapse?: () => void;
  visibleLevels?: HeaderLevelVisibility;
  onToggleLevelVisibility?: (level: 'etage' | 'ruimte' | 'cluster') => void;
}

/**
 * Actiebalk voor processtappen, niveau-zichtbaarheid, documenten en acties.
 * Voldoet aan INV-GOV-22 (<250 regels, 0 hooks) en elimineert storende browser alerts.
 */
export function MatrixActionBar({
  currentStage,
  onStageChange,
  columnSelectMode,
  selectedColumnCount,
  onToggleColumnSelectMode,
  onOpenMediaDrawer,
  onFsmStepClick,
  historischDocumentUrl,
  isHeaderCollapsed,
  onToggleHeaderCollapse,
  visibleLevels,
  onToggleLevelVisibility,
}: MatrixActionBarProps) {
  const handleStepClick = (step: FsmProcessStep) => {
    if (step.step <= currentStage) {
      if (onFsmStepClick) {
        onFsmStepClick(step);
      } else {
        onStageChange(step.step);
      }
    } else {
      onStageChange(step.step);
    }
  };

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
      {/* LINKER SECTIE: FSM PROCESSTAPPEN (8 STAPPEN) */}
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
          Proces:
        </span>

        {FSM_STAGES.map((step: FsmProcessStep) => {
          const isCompleted = step.step < currentStage;
          const isCurrent = step.step === currentStage;
          const isLocked = step.step > currentStage;

          let btnClasses =
            'px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ';
          if (isCurrent) {
            btnClasses += 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400 font-bold';
          } else if (isCompleted) {
            btnClasses += 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100';
          } else {
            btnClasses += 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200';
          }

          return (
            <button
              key={step.step}
              type="button"
              id={`fsm-step-${step.step}`}
              onClick={() => handleStepClick(step)}
              className={btnClasses}
              title={`Fase ${step.step}: ${step.label} (klik voor details)`}
            >
              <span>{isCompleted ? '✓' : isCurrent ? '▶' : step.step}</span>
              <span className="hidden md:inline">{step.label}</span>
              {isLocked && step.actionRequired && (
                <span
                  className="ml-0.5 px-1 rounded text-[10px] font-bold bg-amber-50 text-amber-950 border border-amber-200"
                  title="Actie vereist conform FSM"
                >
                  ⚠️
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* MIDDEN / NIVEAU-ZICHTBAARHEID SEGMENTED CONTROL */}
      {visibleLevels && onToggleLevelVisibility && (
        <div
          role="group"
          aria-label="Niveau zichtbaarheid"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold"
        >
          <button
            type="button"
            onClick={() => onToggleLevelVisibility('etage')}
            aria-pressed={visibleLevels.etage}
            className={`px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden ${
              visibleLevels.etage
                ? 'bg-white text-slate-800 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Toon/verberg Etage-niveau"
          >
            <span>🏢</span>
            <span>Etage</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleLevelVisibility('ruimte')}
            aria-pressed={visibleLevels.ruimte}
            className={`px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden ${
              visibleLevels.ruimte
                ? 'bg-white text-slate-800 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Toon/verberg Ruimte-niveau"
          >
            <span>🚪</span>
            <span>Ruimte</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleLevelVisibility('cluster')}
            aria-pressed={visibleLevels.cluster}
            className={`px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden ${
              visibleLevels.cluster
                ? 'bg-white text-slate-800 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Toon/verberg Positiecluster-niveau"
          >
            <span>🔗</span>
            <span>Cluster</span>
          </button>
          <span
            className="px-2 py-1 text-slate-400 bg-slate-200/50 cursor-default font-medium border-l border-slate-200 flex items-center gap-1"
            title="Positieniveau is altijd zichtbaar"
          >
            <span>📍</span>
            <span>Positie (vast)</span>
          </span>
        </div>
      )}

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
