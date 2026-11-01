'use client';

import React, { useRef, useEffect } from 'react';
import { CellPriceData } from '../../types/matrix';
import { centsToEuroString } from '../../utils/matrix-pricing';

interface MatrixCellProps {
  cellData?: CellPriceData;
  productId: string;
  positionId: string;
  isStepperActive: boolean;
  onOpenStepper: (productId: string, positionId: string) => void;
  onCloseStepper: () => void;
  onUpdateQuantity: (productId: string, positionId: string, delta: number) => void;
}

export function MatrixCell({
  cellData,
  productId,
  positionId,
  isStepperActive,
  onOpenStepper,
  onCloseStepper,
  onUpdateQuantity,
}: MatrixCellProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close stepper on Escape or click outside
  useEffect(() => {
    if (!isStepperActive) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseStepper();
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onCloseStepper();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStepperActive, onCloseStepper]);

  if (!cellData) {
    return (
      <td className="w-[160px] min-w-[160px] max-w-[160px] px-3 py-3 text-center border-r border-b border-slate-100 bg-white">
        <span className="text-slate-300 font-mono text-sm">—</span>
      </td>
    );
  }

  const isIncluded = cellData.isInbegrepen || cellData.unitPriceCents === 0;

  return (
    <td className="relative w-[160px] min-w-[160px] max-w-[160px] p-2 text-center border-r border-b border-slate-200 bg-white align-top">
      {/* Sub-positie badge & regelnummer */}
      <div className="flex items-center justify-between mb-1">
        {cellData.subPos ? (
          <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-100 px-1 rounded">
            [{cellData.subPos}]
          </span>
        ) : <span />}
        {cellData.line && (
          <span className="text-[9px] font-mono text-amber-600/80 bg-amber-50 px-1 rounded border border-amber-200/50">
            {cellData.line}
          </span>
        )}
      </div>

      {/* Interactieve Cel Body */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenStepper(productId, positionId);
          }}
          className="px-2 py-1 rounded bg-blue-50 border border-blue-200 text-blue-900 font-bold text-xs hover:bg-blue-100 transition cursor-pointer min-h-[32px] flex items-center justify-center"
          title="Klik om aantal te wijzigen"
        >
          {cellData.quantity} {cellData.unit || 'st'}
        </button>

        <span className="font-mono text-xs font-bold text-slate-800">
          {centsToEuroString(cellData.totalPriceCents)}
        </span>
      </div>

      {/* Dimensie of Inbegrepen specificatie */}
      {isIncluded && (
        <span className="inline-block text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
          Inbegrepen
        </span>
      )}
      {cellData.dim && (
        <div className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]" title={cellData.dim}>
          {cellData.dim}
        </div>
      )}
      {cellData.note && !isIncluded && (
        <div className="text-[9px] text-slate-400 truncate max-w-[140px]" title={cellData.note}>
          {cellData.note}
        </div>
      )}

      {/* TOUCH-STEPPER OVERLAY (z-5, monotone onder col 0 [z-10] en headers [z-20]) */}
      {isStepperActive && (
        <div
          ref={overlayRef}
          className="absolute inset-0 z-5 bg-white/95 backdrop-blur-xs border-2 border-blue-500 rounded-lg shadow-lg flex items-center justify-around p-1 animate-in fade-in zoom-in-95"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUpdateQuantity(productId, positionId, -1);
            }}
            className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-lg active:scale-95 transition cursor-pointer border border-slate-300"
            aria-label="Verminder aantal met 1"
          >
            —
          </button>

          <div className="flex flex-col items-center">
            <span className="font-mono font-bold text-base text-blue-900">
              {cellData.quantity}
            </span>
            <span className="text-[9px] text-slate-400">
              {cellData.unit || 'st'}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUpdateQuantity(productId, positionId, 1);
            }}
            className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg active:scale-95 transition cursor-pointer shadow-xs"
            aria-label="Verhoog aantal met 1"
          >
            +
          </button>
        </div>
      )}
    </td>
  );
}
