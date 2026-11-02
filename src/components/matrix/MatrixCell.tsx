'use client';

import React from 'react';
import { CellPriceData } from '../../types/matrix';
import { centsToEuroString } from '../../utils/matrix-pricing';
import { useLongPress } from './useLongPress';

export interface MatrixCellProps {
  cellData?: CellPriceData;
  productId: string;
  positionId: string;
  subPos?: string;
  hasMultipleSubPositions?: boolean;
  onCellClick: (
    productId: string,
    positionId: string,
    subPos?: string,
    cellData?: CellPriceData
  ) => void;
  onCellContextMenu: (
    productId: string,
    positionId: string,
    subPos: string | undefined,
    e: React.MouseEvent
  ) => void;
  // Backwards compatibility props
  isStepperActive?: boolean;
  onOpenStepper?: (productId: string, positionId: string) => void;
  onCloseStepper?: () => void;
  onUpdateQuantity?: (productId: string, positionId: string, delta: number) => void;
}

/**
 * Matrixcel conform Gebruikersitem 8 en 11.
 * - Stepper en box om aantal geëlimineerd; de gehele cel is klikbaar (min-h-[48px]).
 * - Lege cellen (—) zijn klikbaar en openen de drawer om een product toe te wijzen.
 * - Regelnummer uitgegrijst in text-slate-500 (WCAG AA 4.77:1) zonder rood omkaderend vakje.
 * - Subpositie badge [a] alleen zichtbaar indien er daadwerkelijk meerdere subposities zijn.
 * - Long-press (500ms) en rechtermuisklik openen het contextmenu; synthetische click-bleed onderdrukt.
 */
export function MatrixCell({
  cellData,
  productId,
  positionId,
  subPos,
  hasMultipleSubPositions = false,
  onCellClick,
  onCellContextMenu,
}: MatrixCellProps) {
  const { handlers } = useLongPress({
    onLongPress: (e) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      onCellContextMenu(productId, positionId, subPos, {
        clientX,
        clientY,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as React.MouseEvent);
    },
    onClick: () => {
      onCellClick(productId, positionId, subPos, cellData);
    },
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onCellContextMenu(productId, positionId, subPos, e);
  };

  // Lege cel (—)
  if (!cellData) {
    return (
      <td
        {...handlers}
        onContextMenu={handleContextMenu}
        className="w-[160px] min-w-[160px] max-w-[160px] min-h-[48px] px-3 py-3 text-center border-r border-b border-slate-100 bg-white cursor-pointer select-none hover:bg-blue-50/20 transition-colors align-middle"
        title="Klik om dit artikel toe te wijzen aan deze positie"
      >
        <span className="text-slate-300 font-mono text-sm">—</span>
      </td>
    );
  }

  const isIncluded = cellData.isInbegrepen || cellData.unitPriceCents === 0;

  return (
    <td
      {...handlers}
      onContextMenu={handleContextMenu}
      className="relative w-[160px] min-w-[160px] max-w-[160px] min-h-[48px] p-2 text-center border-r border-b border-slate-200 bg-white align-top cursor-pointer select-none hover:bg-slate-50 transition-colors"
      title="Klik om maten en aantal te bewerken. Rechtsklik voor opties."
    >
      {/* Sub-positie badge & uitgegrijst regelnummer zonder omkadering */}
      <div className="flex items-center justify-between mb-1">
        {hasMultipleSubPositions && cellData.subPos ? (
          <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-100 px-1 rounded">
            [{cellData.subPos}]
          </span>
        ) : (
          <span />
        )}
        {cellData.line && (
          <span className="text-[10px] font-mono text-slate-500 font-medium">
            {cellData.line}
          </span>
        )}
      </div>

      {/* Cel inhoud: aantal & prijs */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-xs font-semibold text-slate-700">
          {cellData.quantity} {cellData.unit || 'st'}
        </span>

        <span className="font-mono text-xs font-bold text-slate-900">
          {centsToEuroString(cellData.totalPriceCents)}
        </span>
      </div>

      {/* Specificaties en dimensies */}
      {isIncluded && (
        <span className="inline-block text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
          Inbegrepen
        </span>
      )}
      {cellData.dim && (
        <div
          className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]"
          title={cellData.dim}
        >
          {cellData.dim}
        </div>
      )}
      {cellData.note && !isIncluded && (
        <div
          className="text-[9px] text-slate-400 truncate max-w-[140px]"
          title={cellData.note}
        >
          {cellData.note}
        </div>
      )}
    </td>
  );
}
