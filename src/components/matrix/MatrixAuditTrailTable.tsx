'use client';

import React, { useState } from 'react';
import { LogicTradeOrderLine } from '../../types/matrix';
import { centsToEuroString } from '../../utils/matrix-pricing';

export interface MatrixAuditTrailTableProps {
  lines: LogicTradeOrderLine[];
  highlightedLine?: number | null;
  onSelectLine?: (line: number) => void;
  onOpenDocument?: () => void;
}

export function MatrixAuditTrailTable({
  lines,
  highlightedLine,
  onSelectLine,
  onOpenDocument,
}: MatrixAuditTrailTableProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!lines || lines.length === 0) return null;

  return (
    <section
      aria-label="LogicTrade Orderregels Audit Trail"
      className="mt-6 border-t-2 border-slate-300 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <span className="text-lg">📋</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Oorspronkelijke LogicTrade Orderregels & Inkooporders (Audit-Trail)
              </h3>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                {lines.length} regels
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Klik op een regel om de corresponderende cel in de matrix direct te lokaliseren en te markeren.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenDocument && (
            <button
              type="button"
              onClick={onOpenDocument}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium text-slate-700 hover:text-blue-700 hover:bg-white border border-slate-300 transition-colors"
              title="Historisch brondocument openen"
            >
              <span>📄</span>
              <span>Origineel Document</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-expanded={!isCollapsed}
            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium text-slate-700 hover:bg-white border border-slate-300 transition-colors"
          >
            <span>{isCollapsed ? '▲ Uitklappen' : '▼ Inklappen'}</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      {!isCollapsed && (
        <div className="overflow-x-auto max-h-[380px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/80 text-slate-600 font-semibold sticky top-0 border-b border-slate-200 z-10">
              <tr>
                <th scope="col" className="px-4 py-3 w-16 text-center font-mono">Regel</th>
                <th scope="col" className="px-4 py-3 w-28 font-mono">Art. Code</th>
                <th scope="col" className="px-4 py-3">Omschrijving & Specificaties</th>
                <th scope="col" className="px-4 py-3 w-24 text-right">Aantal</th>
                <th scope="col" className="px-4 py-3 w-28 text-right font-mono">Stuksprijs</th>
                <th scope="col" className="px-4 py-3 w-28 text-right font-mono">Totaal</th>
                <th scope="col" className="px-4 py-3 w-48">Ruimte / Positie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((row) => {
                const isSelected = highlightedLine === row.line;
                const isProjectscope = !row.roomName && row.positionName === 'pos_project_algemeen';

                return (
                  <tr
                    key={row.line}
                    role={isProjectscope ? undefined : 'button'}
                    tabIndex={isProjectscope ? -1 : 0}
                    onClick={() => {
                      if (!isProjectscope && onSelectLine) {
                        onSelectLine(row.line);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (!isProjectscope && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onSelectLine?.(row.line);
                      }
                    }}
                    className={`transition-colors min-h-[44px] ${
                      isSelected
                        ? 'bg-blue-50 font-medium text-blue-900 border-l-4 border-l-blue-600'
                        : isProjectscope
                        ? 'bg-slate-50/50 text-slate-500 cursor-default'
                        : 'hover:bg-blue-50/30 cursor-pointer text-slate-800'
                    }`}
                  >
                    <td className="px-4 py-3 text-center font-mono text-slate-600 font-semibold">
                      {row.line}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {row.productCode || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{row.description}</div>
                      {row.unit && (
                        <div className="text-[11px] text-slate-500">Eenheid: {row.unit}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {row.quantity}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      {centsToEuroString(row.priceCents)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {centsToEuroString(row.totalCents)}
                    </td>
                    <td className="px-4 py-3">
                      {isProjectscope ? (
                        <span className="inline-block text-[10px] font-medium text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded">
                          Projectscope (Algemeen)
                        </span>
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800">{row.roomName || '—'}</span>
                          {row.positionName && (
                            <span className="text-[10px] font-mono text-slate-500">
                              {row.positionName}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
