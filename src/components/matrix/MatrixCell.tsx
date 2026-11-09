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
  isHighlighted?: boolean;
  cellKey?: string;
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
 * Matrixcel conform Stitch Optie 1 en Gebruikersitem 8 en 11.
 * - Cel-cardificatie met afgeronde container en zuivere typografie.
 * - Stepper en box om aantal geëlimineerd; de gehele cel is klikbaar (min-h-[48px]).
 * - Lege cellen (—) zijn klikbaar en openen de drawer om een product toe te wijzen.
 * - Subpositie badge [a] alleen zichtbaar indien er daadwerkelijk meerdere subposities zijn.
 * - Regelnummer in rustige badge (#20) met WCAG AA contrast.
 * - Long-press (500ms) en rechtermuisklik openen het contextmenu; synthetische click-bleed onderdrukt.
 * - Warm cream achtergrond voor pos_project_algemeen / Algemeen kolom.
 */
export function MatrixCell({
  cellData,
  productId,
  positionId,
  subPos,
  hasMultipleSubPositions = false,
  isHighlighted = false,
  cellKey,
  onCellClick,
  onCellContextMenu,
}: MatrixCellProps) {
  const isAlgemeen = positionId === 'pos_project_algemeen' || positionId === 'pos-gen';

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
        id={cellKey ? `matrix-cell-${productId}-${cellKey}` : undefined}
        onContextMenu={handleContextMenu}
        className={`w-[160px] min-w-[160px] max-w-[160px] min-h-[48px] px-3 py-3 text-center border-r border-b border-slate-100 cursor-pointer select-none transition-colors align-middle ${
          isAlgemeen ? 'bg-amber-50/20 hover:bg-amber-50/40' : 'bg-white hover:bg-blue-50/20'
        }`}
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
      id={cellKey ? `matrix-cell-${productId}-${cellKey}` : undefined}
      onContextMenu={handleContextMenu}
      className={`relative w-[160px] min-w-[160px] max-w-[160px] min-h-[48px] p-2 text-center border-r border-b border-slate-200 align-top cursor-pointer select-none transition-all duration-200 ${
        isHighlighted
          ? 'ring-2 ring-blue-500 bg-blue-50/40 shadow-sm z-10'
          : isAlgemeen
          ? 'bg-amber-50/30 hover:bg-amber-50/50'
          : 'bg-white hover:bg-slate-50'
      }`}
      title="Klik om maten en aantal te bewerken. Rechtsklik voor opties."
    >
      {/* Sub-positie badge & regelnummer badge */}
      <div className="flex items-center justify-between mb-1">
        {hasMultipleSubPositions && cellData.subPos ? (
          <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-100 px-1 rounded">
            [{cellData.subPos}]
          </span>
        ) : (
          <span />
        )}
        {cellData.line && (
          <span className="text-[10px] font-mono font-semibold text-amber-800 bg-amber-50 border border-amber-200/60 px-1 py-0.2 rounded">
            #{cellData.line}
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
          className="text-[10px] text-slate-500 font-mono truncate max-w-[140px] tracking-tight"
          title={cellData.dim}
        >
          {cellData.dim.replace('x', '×')}
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
