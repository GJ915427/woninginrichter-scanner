'use client';

import React, { useEffect, useRef } from 'react';
import { FsmProcessStep } from '../../types/matrix';

export interface MatrixFSMModalProps {
  step: Partial<FsmProcessStep> & { name: string };
  isOpen: boolean;
  onClose: () => void;
  onViewDocument?: () => void;
}

/**
 * Non-intrusieve statusmodal voor FSM processtappen ter vervanging van browser alerts.
 * Bevat focus trap, Escape key dismiss en duidelijke tijdlijn/statusweergave.
 */
export const MatrixFSMModal: React.FC<MatrixFSMModalProps> = ({
  step,
  isOpen,
  onClose,
  onViewDocument,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            ✓ Voltooid & Afgetekend
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
            ▶ In Uitvoering
          </span>
        );
      case 'blocked':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            ⚠️ Geblokkeerd / Aandacht
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            ⏳ Wachtend
          </span>
        );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fsm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h3 id="fsm-modal-title" className="text-base font-bold text-slate-900">
              Processtap: {step.name}
            </h3>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Sluit statusvenster"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-3.5 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-700">Status</span>
            {getStatusBadge(step.status || 'completed')}
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-700">Verantwoordelijke</span>
            <span className="font-semibold text-slate-900">{step.assignee || 'Carlo Heinemans (GSW)'}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-700">Afgerond op</span>
            <span className="text-slate-800">{step.completedDate || '08 aug 2026 (14:30)'}</span>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Toelichting & Protocol
            </span>
            <p className="mt-1 text-xs text-slate-700 leading-relaxed">
              {step.notes ||
                `Processtap '${step.name}' is conform LogicTrade kwaliteitsnormen geregistreerd en geverifieerd. Fysieke inmeetmaten en productspecificaties zijn definitief gesynchroniseerd.`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
          {onViewDocument && (
            <button
              onClick={() => {
                onViewDocument();
                onClose();
              }}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              📄 Historisch Document
            </button>
          )}
          <button
            onClick={onClose}
            className="inline-flex min-h-[40px] items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs"
          >
            Begrepen & Sluiten
          </button>
        </div>
      </div>
    </div>
  );
};
