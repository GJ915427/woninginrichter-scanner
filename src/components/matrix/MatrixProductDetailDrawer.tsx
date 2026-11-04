'use client';

import React, { useEffect, useState } from 'react';
import { MatrixProductDetailDrawerProps } from '../../types/matrix';
import { centsToEuroString } from '../../utils/matrix-pricing';
import { parseCellKey } from '../../utils/matrix-overlay-state';

/**
 * MatrixProductDetailDrawer (INV-GOV-22)
 * Detaildrawer voor productcatalogus-specificaties en ruimtelijke footprint.
 * Bevat maximaal 2 primitieve hooks (useEffect voor Escape-trap, useState voor notitie-invoer) en blijft <200 regels.
 */
export function MatrixProductDetailDrawer({
  isOpen = true,
  product,
  positions = [],
  onClose,
  onAddNote,
}: MatrixProductDetailDrawerProps) {
  const [quickNote, setQuickNote] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  if (!product) {
    return (
      <div
        id="product-detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Productdetails"
        className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-2xs"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-white p-6 shadow-2xl flex flex-col justify-between"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <h2 className="text-lg font-bold text-slate-900">Geen product geselecteerd</h2>
            <p className="text-sm text-slate-500 mt-2">Het opgevraagde product kon niet worden gevonden.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="w-full min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg transition-colors"
          >
            Sluiten
          </button>
        </div>
      </div>
    );
  }

  // Ruimtelijke posities filteren waar product actief is
  const configuredEntries = Object.entries(product.posPrices || {}).filter(
    ([, data]) => (data.quantity ?? 0) > 0 || (data.totalPriceCents ?? 0) > 0
  );

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNote.trim()) return;
    onAddNote?.(`[Product: ${product.code}] ${quickNote.trim()}`);
    setQuickNote('');
  };

  return (
    <div
      id="product-detail-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-detail-title"
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                {product.code}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {product.category}
              </span>
            </div>
            <h2 id="product-detail-title" className="text-base font-bold text-slate-900 leading-snug">
              {product.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <span className="text-xl font-bold leading-none">✕</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-700">
          {/* Sectie 1: Specificaties */}
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400">
              Productspecificaties &amp; Tarieven
            </h3>
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500 block text-[11px]">Eenheid</span>
                <span className="font-semibold text-slate-900">{product.unit || 'stuks'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Tariefmodus</span>
                <span className="font-semibold text-slate-900 font-mono">{product.pricingMode || 'standaard'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Basistarief</span>
                <span className="font-semibold text-emerald-700 font-mono">
                  {product.baseRateCents ? centsToEuroString(product.baseRateCents) : '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Dimensielimieten</span>
                <span className="font-semibold text-slate-900">
                  {product.dimensionLimits
                    ? `${product.dimensionLimits.minWidth ?? 0} - ${product.dimensionLimits.maxWidth ?? '∞'} mm`
                    : 'N.v.t.'}
                </span>
              </div>
            </div>
          </section>

          {/* Sectie 2: Ruimtelijke Footprint */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400">
                Ruimtelijke Order Footprint
              </h3>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {configuredEntries.length} posities geconfigureerd
              </span>
            </div>

            {configuredEntries.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-lg text-slate-500 text-center border border-dashed border-slate-200">
                Geen actieve posities geconfigureerd in deze order.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                {configuredEntries.map(([cellKey, cellData]) => {
                  const { positionId, subPos } = parseCellKey(cellKey);
                  const posName = positions.find((p) => p.id === positionId)?.name || positionId;
                  return (
                    <div key={cellKey} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {posName}
                          {subPos && <span className="ml-1 text-slate-500 text-[10px]">({subPos})</span>}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {cellData.dim || cellData.afmetingen || 'Geen maatopgave'}
                          {cellData.note && ` • ${cellData.note}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-emerald-700">
                          {centsToEuroString(cellData.totalPriceCents)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {cellData.quantity} {cellData.unit || product.unit}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Sectie 3: Notitie Toevoegen */}
          {onAddNote && (
            <section className="space-y-3 pt-2 border-t border-slate-200">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400">
                Werfnotitie Aan Product Koppelen
              </h3>
              <form onSubmit={handleNoteSubmit} className="space-y-2">
                <textarea
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  placeholder="Voeg een specifieke notitie of maatinstructie toe..."
                  rows={2}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!quickNote.trim()}
                  className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>✏️</span>
                  <span>Notitie toevoegen</span>
                </button>
              </form>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="min-h-[44px] px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition-colors"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}
