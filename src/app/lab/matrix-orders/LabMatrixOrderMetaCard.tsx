'use client';

// [VISUAL-MUTATION-AUTHORIZED: UX verfijning Hoofdscherm 4: klantnaam popover trigger en ordernummer audit toggle interactie conform HITL verzoek]
import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Paperclip, ChevronDown } from 'lucide-react';
import { MatrixOrder, OrderSummaryItem } from '@/types/matrix';
import { centsToEuroString } from '@/utils/matrix-pricing';

export interface LabMatrixOrderMetaCardProps {
  selectedOrder: MatrixOrder;
  orders?: (MatrixOrder | OrderSummaryItem)[];
  currentOrderIndex?: number;
  onSelectOrder?: (index: number) => void;
  onSelectOrderId?: (orderId: string) => void;
  onOpenPdf?: () => void;
  onOpenMedia?: (tab?: 'foto' | 'video' | 'opmerking') => void;
  onToggleAuditTrail?: () => void;
  isAuditTrailActive?: boolean;
}

/**
 * LabMatrixOrderMetaCard (INV-GOV-22, Fitts' Law >= 44px)
 * Executive strip voor /lab/matrix-orders met orderpicker en audit toggle (<235 LOC).
 */
export function LabMatrixOrderMetaCard({
  selectedOrder,
  orders,
  currentOrderIndex = 0,
  onSelectOrder,
  onSelectOrderId,
  onOpenMedia,
  onToggleAuditTrail,
  isAuditTrailActive = false,
}: LabMatrixOrderMetaCardProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const orderList = orders && orders.length > 0 ? orders : [selectedOrder];
  const currentIndex = currentOrderIndex >= 0 && currentOrderIndex < orderList.length
    ? currentOrderIndex
    : Math.max(0, orderList.findIndex((o) => o.id === selectedOrder.id));

  useEffect(() => {
    if (!isPopoverOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setIsPopoverOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPopoverOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPopoverOpen]);

  return (
    <div
      aria-label="Order Metadata Overzicht"
      className="bg-white border-b border-slate-200 px-6 py-2.5 shadow-2xs text-xs select-none relative z-30 flex items-center justify-between gap-4"
    >
      {/* Linkerzijde: Klantnaam (Popover Trigger) & Locatie | Gestapelde Micro-labels */}
      <div className="min-w-0 flex-1 flex items-center gap-3 flex-wrap sm:flex-nowrap">
        {/* Klantnaam Container met Popover Orderpicker */}
        <div className="relative flex items-center min-w-0" ref={popoverRef}>
          <button
            type="button"
            id="meta-customer-name"
            aria-haspopup="listbox"
            aria-expanded={isPopoverOpen}
            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
            className="min-h-[44px] px-2 py-1 inline-flex items-center gap-1.5 rounded-control hover:bg-slate-100 transition-colors text-slate-900 cursor-pointer font-bold text-sm max-w-full text-left"
            title="Klik om te wisselen van klant/order"
          >
            <span className="truncate max-w-[200px] sm:max-w-[260px]">
              {selectedOrder.klant} {selectedOrder.plaats ? `(${selectedOrder.plaats})` : ''}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
          </button>

          {isPopoverOpen && (
            <div
              role="listbox"
              aria-label="Order selectielijst"
              className="absolute top-full left-0 mt-2 w-80 bg-white rounded-container shadow-xl border border-slate-200 p-3 z-50 text-xs whitespace-normal animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800">Orders ({orderList.length})</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Vorige order"
                    disabled={currentIndex <= 0}
                    onClick={() => {
                      const prev = orderList[currentIndex - 1];
                      if (prev) onSelectOrderId ? onSelectOrderId(prev.id) : onSelectOrder?.(currentIndex - 1);
                    }}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-control hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 font-bold"
                  >‹</button>
                  <span className="font-mono text-xs text-slate-600 px-1 font-semibold">{currentIndex + 1} / {orderList.length}</span>
                  <button
                    type="button"
                    aria-label="Volgende order"
                    disabled={currentIndex >= orderList.length - 1}
                    onClick={() => {
                      const next = orderList[currentIndex + 1];
                      if (next) onSelectOrderId ? onSelectOrderId(next.id) : onSelectOrder?.(currentIndex + 1);
                    }}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-control hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 font-bold"
                  >›</button>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1">
                {orderList.map((ord, idx) => (
                  <button
                    key={ord.id}
                    type="button"
                    onClick={() => {
                      if (onSelectOrderId) onSelectOrderId(ord.id);
                      else onSelectOrder?.(idx);
                      setIsPopoverOpen(false);
                    }}
                    className={`w-full min-h-[44px] px-3 py-2 text-left rounded-control transition-colors flex items-center justify-between ${
                      idx === currentIndex
                        ? 'bg-blue-50 border border-blue-200 text-blue-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="truncate">
                      <span className="font-mono font-bold text-slate-900 block">{ord.id}</span>
                      <span className="text-slate-500 text-[11px] truncate block">
                        {ord.klant} ({ord.plaats || 'Maastricht'})
                      </span>
                    </div>
                    <span className="font-mono text-slate-600 text-[11px] shrink-0 ml-2">
                      {centsToEuroString(ord.totaalbedragCents)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <span className="text-slate-300 hidden md:inline">|</span>
        <div className="hidden lg:flex items-center gap-1 text-slate-600 truncate">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          <span id="meta-customer-city" className="truncate font-medium">
            {selectedOrder.plaats ? `Sint Pieterstraat 12, ${selectedOrder.plaats}` : 'Sint Pieterstraat 12, Maastricht'}
          </span>
        </div>
        <span className="text-slate-300 hidden lg:inline">|</span>

        {/* 2-Tier Gestapelde Micro-Labels */}
        <div className="flex items-center gap-3">
          {/* Ordernummer Stack: Toggle Knop voor Offerte- en Orderregels (Audit Trail) */}
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[9px] uppercase font-semibold text-slate-500 tracking-wider">
              ORDERNUMMER
            </span>
            <div className="relative">
              <h1 className="m-0 p-0 font-inherit inline-flex">
                <button
                  type="button"
                  id="meta-order-number"
                  data-testid="order-title"
                  aria-pressed={Boolean(isAuditTrailActive)}
                  aria-label={
                    isAuditTrailActive
                      ? `Order ${selectedOrder.id}: Terug naar matrixraster`
                      : `Order ${selectedOrder.id}: Toon offerte- en orderregels`
                  }
                  onClick={onToggleAuditTrail}
                  className={`min-h-[44px] px-2.5 py-1 inline-flex items-center gap-1.5 rounded-control font-extrabold text-xs font-mono transition-colors shadow-2xs cursor-pointer ${
                    isAuditTrailActive
                      ? 'bg-blue-600 text-white border border-blue-700 hover:bg-blue-700'
                      : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900'
                  }`}
                  title={isAuditTrailActive ? 'Toon matrixraster' : 'Toon offerte- en orderregels'}
                >
                  <span>{selectedOrder.id}</span>
                </button>
              </h1>
            </div>
          </div>

          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[9px] uppercase font-semibold text-slate-500 tracking-wider">PROJECTSTATUS</span>
            <span id="meta-status" className="inline-flex items-center min-h-[44px] sm:min-h-0 px-2.5 py-1 rounded-control text-xs font-medium bg-emerald-50/50 text-emerald-700 border border-emerald-200/60">
              Order
            </span>
          </div>
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[9px] uppercase font-semibold text-slate-500 tracking-wider">PRODUCTSTATUS</span>
            <span id="meta-product-status" className="inline-flex items-center min-h-[44px] sm:min-h-0 px-2.5 py-1 rounded-control text-xs font-medium bg-emerald-50/50 text-emerald-700 border border-emerald-200/60">
              {selectedOrder.status || 'Definitief'}
            </span>
          </div>
        </div>
      </div>

      {/* Rechterzijde: Bijlagen Pill & Prominent Orderbedrag */}
      <div className="flex-shrink-0 flex items-center gap-4">
        <button
          type="button"
          id="btn-meta-media-drawer"
          onClick={() => onOpenMedia?.()}
          aria-label="Bijlagen en notities openen"
          className="h-action-btn relative before:content-[''] before:absolute before:-inset-y-1.5 before:inset-x-0 before:min-h-[44px] px-3.5 py-1.5 rounded-pill text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-2 shadow-2xs"
        >
          <Paperclip className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
          <span>Bijlagen</span>
          <span className="bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded-full text-[10px]">
            {selectedOrder.media?.length ?? 7}
          </span>
        </button>

        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[9px] uppercase font-semibold text-slate-500 tracking-wider text-right">
            ORDERBEDRAG
          </span>
          <span id="meta-total-amount" className="font-mono font-black text-sm sm:text-base text-slate-900 tracking-tight">
            {centsToEuroString(selectedOrder.totaalbedragCents ?? 1925000)}
          </span>
        </div>
      </div>
    </div>
  );
}
