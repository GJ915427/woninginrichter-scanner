'use client';

import React from 'react';
import { MatrixProduct, Position, CellPriceData } from '../../types/matrix';
import { MatrixCell } from './MatrixCell';
import { resolveCellData } from '../../utils/matrix-overlay-state';

export interface MatrixProductRowProps {
  product: MatrixProduct;
  positions: Position[];
  rowIndex: number;
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
  activeStepper?: { productId: string; positionId: string } | null;
  onOpenStepper?: (productId: string, positionId: string) => void;
  onCloseStepper?: () => void;
  onUpdateQuantity?: (productId: string, positionId: string, delta: number) => void;
}

/**
 * Productrij in de matrixweergave conform INV-GOV-22 (<250 regels).
 * Handelt compound key resolve en conditionele subposities af.
 */
export function MatrixProductRow({
  product,
  positions,
  rowIndex,
  onCellClick,
  onCellContextMenu,
  activeStepper,
  onOpenStepper,
  onCloseStepper,
  onUpdateQuantity,
}: MatrixProductRowProps) {
  const isEven = rowIndex % 2 === 0;
  const col0Bg = isEven ? 'bg-white' : 'bg-slate-50';

  return (
    <tr className="hover:bg-blue-50/30 transition-colors">
      {/* STICKY KOLOM 0: PRODUCT IDENTIFICATIE (280px breed, z-10) */}
      <th
        style={{ left: '0px' }}
        scope="row"
        className={`sticky left-0 z-10 w-[280px] min-w-[280px] max-w-[280px] px-4 py-3 text-left border-r border-b border-slate-200 ${col0Bg} font-normal select-none`}
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-1">
            <span className="font-bold text-xs text-slate-900 leading-snug line-clamp-2">
              {product.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-mono">
            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[10px] border border-slate-200">
              {product.code}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-[10px] text-slate-600">
              {product.category}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-[10px] text-slate-400">
              {product.unit}
            </span>
          </div>
        </div>
      </th>

      {/* KOLOM 1: ALGEMEEN / PROJECTSOPCE */}
      <MatrixCell
        cellData={product.posPrices['pos_project_algemeen'] || product.posPrices['pos-gen']}
        productId={product.id}
        positionId="pos_project_algemeen"
        onCellClick={onCellClick}
        onCellContextMenu={onCellContextMenu}
        isStepperActive={
          activeStepper?.productId === product.id &&
          activeStepper?.positionId === 'pos_project_algemeen'
        }
        onOpenStepper={onOpenStepper}
        onCloseStepper={onCloseStepper}
        onUpdateQuantity={onUpdateQuantity}
      />

      {/* KOLOMMEN 2+: RUIMTELIJKE POSITIES */}
      {positions.map((pos) => {
        const hasMultiple = Boolean(pos.subPositions && pos.subPositions.length > 1);
        let activeSubPos: string | undefined = undefined;
        if (hasMultiple && pos.subPositions) {
          activeSubPos = pos.subPositions.find(
            (sp) => Boolean(product.posPrices[`${pos.id}__${sp}`])
          );
        }

        const cellData = resolveCellData(product, pos.id, activeSubPos);
        const isStepperActive =
          activeStepper?.productId === product.id && activeStepper?.positionId === pos.id;

        return (
          <MatrixCell
            key={pos.id}
            cellData={cellData}
            productId={product.id}
            positionId={pos.id}
            subPos={activeSubPos || cellData?.subPos}
            hasMultipleSubPositions={hasMultiple}
            onCellClick={onCellClick}
            onCellContextMenu={onCellContextMenu}
            isStepperActive={isStepperActive}
            onOpenStepper={onOpenStepper}
            onCloseStepper={onCloseStepper}
            onUpdateQuantity={onUpdateQuantity}
          />
        );
      })}
    </tr>
  );
}
