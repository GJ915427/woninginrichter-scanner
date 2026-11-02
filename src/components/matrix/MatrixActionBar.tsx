'use client';

import React from 'react';
import { FSM_STAGES, FsmProcessStep } from '../../types/matrix';

export interface MatrixActionBarProps {
  currentStage: number;
  onStageChange: (stage: number) => void;
  columnSelectMode: boolean;
  selectedColumnCount: number;
  onToggleColumnSelectMode: () => void;
  onOpenMediaDrawer: (tab: 'foto' | 'video' | 'opmerking') => void;
  onFsmStepClick?: (step: FsmProcessStep) => void;
  historischDocumentUrl?: string;
}

/**
 * Actiebalk voor processtappen, LogicTrade brondocument en media drawers.
 * Voldoet aan INV-GOV-22 (<250 regels) en elimineert storende browser alerts.
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
}: MatrixActionBarProps) {
  const handleStepClick = (step: FsmProcessStep) => {
    if (step.step <= currentStage) {
      // Reeds bereikte of voltooide stap toont FSM modal met details
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
    <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
      {/* LINKER SECTIE: FSM PROCESSTAPPEN (8 STAPPEN) */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
          Processtappen:
        </span>

        {FSM_STAGES.map((step: FsmProcessStep) => {
          const isCompleted = step.step < currentStage;
          const isCurrent = step.step === currentStage;
          const isLocked = step.step > currentStage;

          let btnClasses =
            'px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ';
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
              <span>{step.label}</span>
              {isLocked && step.actionRequired && (
                <span
                  className="ml-1 px-1 rounded text-[10px] font-bold bg-amber-50 text-amber-950 border border-amber-200"
                  title="Actie vereist conform FSM"
                >
                  ⚠️
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* RECHTER SECTIE: LOGICTRADE DOCUMENT, MEDIA & ACTIEKNOPPEN */}
      <div className="flex items-center gap-2">
        {/* Historisch gegenereerd LogicTrade document link */}
        {historischDocumentUrl && (
          <a
            href={historischDocumentUrl}
            target="_blank"
            rel="noopener noreferrer"
            id="btn-historisch-document"
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Origineel historisch LogicTrade brondocument openen"
          >
            <span>📄</span>
            <span className="hidden md:inline">LT Brondocument</span>
          </a>
        )}

        <button
          type="button"
          onClick={() => onOpenMediaDrawer('foto')}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
        >
          📷 <span>+ Foto</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenMediaDrawer('video')}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
        >
          🎥 <span>+ Video</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenMediaDrawer('opmerking')}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
        >
          📝 <span>+ Opmerking</span>
        </button>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={onToggleColumnSelectMode}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
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
