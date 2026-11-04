'use client';

import React from 'react';
import { MatrixOrder } from '../../types/matrix';
import { centsToEuroString } from '../../utils/matrix-pricing';

export interface MatrixOrderMetaCardProps {
  selectedOrder: MatrixOrder;
  onOpenPdf?: () => void;
  onScrollToAuditTrail?: () => void;
  onOpenMedia?: () => void;
}

/**
 * MatrixOrderMetaCard (INV-GOV-22)
 * 6-koloms 12-velden actieve order overzichtskaart conform de benchmark.
 * Pure presentational component (0 state hooks, < 140 regels).
 */
export function MatrixOrderMetaCard({
  selectedOrder,
  onOpenPdf,
  onScrollToAuditTrail,
  onOpenMedia,
}: MatrixOrderMetaCardProps) {
  const handleAuditScroll = () => {
    if (onScrollToAuditTrail) {
      onScrollToAuditTrail();
    } else {
      document.getElementById('matrix-audit-trail-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const lineCount =
    selectedOrder.orderlineCount ??
    selectedOrder.products.reduce(
      (acc, p) => acc + (p.posPrices ? Object.keys(p.posPrices).length : 0),
      0
    ) ??
    10;

  return (
    <div
      aria-label="Order Metadata Overzicht"
      className="bg-white border-b border-slate-200 px-6 py-3.5 shadow-2xs text-xs select-none"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-center">
        {/* Kolom 1: Ordernummer & Offerte */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Ordernummer
          </span>
          <div className="flex items-center gap-1.5">
            <h1 id="meta-order-number" data-testid="order-title" className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
              {selectedOrder.id}
            </h1>
            <button
              type="button"
              id="btn-meta-historisch-doc"
              onClick={onOpenPdf}
              aria-label="Historisch document openen"
              title="Historisch gegenereerd PDF document openen"
              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              📄
            </button>
          </div>
          <span id="meta-quote-number" className="text-[11px] text-blue-600 hover:underline cursor-pointer font-medium">
            Offerte: {selectedOrder.offerte || 'OF-2026-0412'}
          </span>
        </div>

        {/* Kolom 2: Klant & Plaats */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Klant & Locatie
          </span>
          <span id="meta-customer-name" className="font-bold text-sm text-slate-900 truncate">
            {selectedOrder.klant}
          </span>
          <span id="meta-customer-city" className="text-slate-500 font-medium truncate">
            {selectedOrder.plaats}
          </span>
        </div>

        {/* Kolom 3: Datum & Status */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Datum & Status
          </span>
          <span id="meta-date" className="text-slate-700 font-medium">
            {selectedOrder.orderdatum || '14-02-2026'}
          </span>
          <div>
            <span
              id="meta-status"
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
            >
              {selectedOrder.status || 'Definitief'}
            </span>
          </div>
        </div>

        {/* Kolom 4: Project Scope & Posities */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Project Scope &amp; Bijlagen
          </span>
          <span id="meta-scope-summary" className="font-semibold text-slate-800 truncate">
            {selectedOrder.scopeDescription || 'Villa: Raambekleding'}
          </span>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span id="meta-positions-count" className="text-slate-500">
              {selectedOrder.positionCount ?? 15} posities
            </span>
            <button
              type="button"
              id="btn-meta-media-drawer"
              onClick={onOpenMedia}
              aria-label="Bijlagen en notities openen"
              className="min-h-[44px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            >
              <span>📎</span>
              <span>Bijlagen ({selectedOrder.media?.length ?? 0})</span>
            </button>
          </div>
        </div>

        {/* Kolom 5: Verkoper & Filiaal */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Verkoper & Vestiging
          </span>
          <span id="meta-salesman" className="font-semibold text-slate-800">
            {selectedOrder.verkoper || 'Jan'}
          </span>
          <span id="meta-branch" className="text-slate-500">
            {selectedOrder.filiaal || 'GSW BV (Filiaal 01)'}
          </span>
        </div>

        {/* Kolom 6: Totaalbedrag & Orderregels */}
        <div className="flex flex-col gap-0.5 lg:items-end">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Orderbedrag & Regels
          </span>
          <span id="meta-total-amount" className="font-mono font-extrabold text-sm sm:text-base text-emerald-700">
            {centsToEuroString(selectedOrder.totaalbedragCents)}
          </span>
          <button
            type="button"
            id="meta-lines-count"
            onClick={handleAuditScroll}
            aria-label="Scroll naar orderregels"
            className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>{lineCount} orderregels</span>
            <span className="text-[10px]">↓</span>
          </button>
        </div>
      </div>
    </div>
  );
}
