'use client';

// [SPEC-CHANGE-AUTHORIZED: Handcrafting van compacte Executive Order Strip conform Stitch specificatie met 2-laags gestapelde micro-labels, SVG iconen, pointerdown touch popover orderpicker op klantnaam, dubbele statusindicatie met rounded-control en Fitts law >= 44px touch targets]
import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Paperclip, ChevronDown } from 'lucide-react';
import { MatrixOrder, OrderSummaryItem } from '../../types/matrix';
import { centsToEuroString } from '../../utils/matrix-pricing';
import { MatrixOrderPickerPopover } from './MatrixOrderPickerPopover';

export interface MatrixOrderMetaCardProps {
  selectedOrder: MatrixOrder;
  orders?: (MatrixOrder | OrderSummaryItem)[];
  currentOrderIndex?: number;
  onSelectOrder?: (index: number) => void;
  onSelectOrderId?: (orderId: string) => void;
  onOpenPdf?: () => void;
  onOpenMedia?: (tab?: 'foto' | 'video' | 'opmerking') => void;
  onScrollToAuditTrail?: () => void;
  isAuditTrailActive?: boolean;
  onToggleAuditTrail?: () => void;
}

export function MatrixOrderMetaCard({
  selectedOrder,
  orders,
  currentOrderIndex = 0,
  onSelectOrder,
  onSelectOrderId,
  onOpenPdf,
  onOpenMedia,
  isAuditTrailActive = false,
  onToggleAuditTrail,
}: MatrixOrderMetaCardProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const orderList = orders && orders.length > 0 ? orders : [selectedOrder];
  const currentIndex = currentOrderIndex >= 0 && currentOrderIndex < orderList.length
    ? currentOrderIndex
    : Math.max(0, orderList.findIndex((o) => o.id === selectedOrder.id));

  // Pointerdown + Escape listener voor robuuste cross-platform dismissal (iPad touch + Desktop mouse)
  useEffect(() => {
    if (!isPopoverOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setIsPopoverOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsPopoverOpen(false); };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPopoverOpen]);

  // Reactieve popover sluiting bij orderwissel
  useEffect(() => {
    setIsPopoverOpen(false);
  }, [selectedOrder.id, currentOrderIndex]);

  const switchOrder = (idx: number, id: string) => {
    if (onSelectOrderId && id) onSelectOrderId(id);
    else if (onSelectOrder) onSelectOrder(idx);
    setIsPopoverOpen(false);
  };

  return (
    <div
      aria-label="Order Metadata Overzicht"
      className="bg-white border-b border-slate-200 px-6 py-2.5 shadow-2xs text-xs select-none relative z-50 flex items-center justify-between gap-4"
    >
      {/* Linkerzijde: Klant & Locatie | Gestapelde Micro-labels */}
      <div className="min-w-0 flex-1 flex items-center gap-3 flex-wrap sm:flex-nowrap">
        {/* Klantnaam Container met Popover Order Switcher Trigger */}
        <div className="flex items-center gap-1.5 min-w-0 relative" ref={popoverRef}>
          <button
            type="button"
            id="meta-customer-name"
            aria-haspopup="listbox"
            aria-expanded={isPopoverOpen}
            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
            className="font-bold text-sm text-slate-900 truncate min-h-[44px] inline-flex items-center gap-1.5 hover:text-slate-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-control px-1 -mx-1"
            title="Klik om een order te selecteren"
          >
            <span className="truncate">{selectedOrder.klant} {selectedOrder.plaats ? `(${selectedOrder.plaats})` : ''}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
          </button>

          <MatrixOrderPickerPopover
            isOpen={isPopoverOpen}
            onClose={() => setIsPopoverOpen(false)}
            selectedOrder={selectedOrder}
            orders={orderList}
            currentOrderIndex={currentIndex}
            onSelectOrder={onSelectOrder}
            onSelectOrderId={onSelectOrderId}
          />
        </div>

        <span className="text-slate-300 hidden md:inline">|</span>

        <div className="hidden lg:flex items-center gap-1 text-slate-600 truncate">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          <span id="meta-customer-city" className="truncate font-medium">
            {selectedOrder.plaats ? `Sint Pieterstraat 12, ${selectedOrder.plaats}` : 'Sint Pieterstraat 12, Maastricht'}
          </span>
        </div>

        <span className="text-slate-300 hidden lg:inline">|</span>

        {/* 2-Tier Gestapelde Micro-Labels met Uniforme 30px Hoogte */}
        <div className="flex items-center gap-3">
          {/* Ordernummer Stack met Audit Trail Toggle Knop */}
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
                  aria-pressed={isAuditTrailActive}
                  onClick={onToggleAuditTrail}
                  className={`h-[30px] px-2.5 py-1 inline-flex items-center gap-1.5 rounded-control border font-extrabold text-xs font-mono transition-colors shadow-2xs cursor-pointer relative before:content-[''] before:absolute before:-inset-y-1.5 before:inset-x-0 before:min-h-[44px] ${
                    isAuditTrailActive
                      ? 'bg-sky-100 border-sky-300 text-sky-900 ring-1 ring-sky-300'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900'
                  }`}
                  title={isAuditTrailActive ? 'Klik om terug te keren naar matrix' : 'Klik om offerte-/orderregels te bekijken'}
                >
                  <span>{selectedOrder.id}</span>
                </button>
              </h1>
            </div>
          </div>

          {/* Projectstatus Stack */}
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[9px] uppercase font-semibold text-slate-500 tracking-wider">
              PROJECTSTATUS
            </span>
            <span
              id="meta-status"
              className="inline-flex items-center h-[30px] px-2.5 py-1 rounded-control text-xs font-medium bg-emerald-50/50 text-emerald-700 border border-emerald-200/60"
            >
              Order
            </span>
          </div>

          {/* Productstatus Stack */}
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[9px] uppercase font-semibold text-slate-500 tracking-wider">
              PRODUCTSTATUS
            </span>
            <span
              id="meta-product-status"
              className="inline-flex items-center h-[30px] px-2.5 py-1 rounded-control text-xs font-medium bg-emerald-50/50 text-emerald-700 border border-emerald-200/60"
            >
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
