'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2 } from 'lucide-react';
import type { MatrixOrder, OrderSummaryItem } from '../../types/matrix';
import { centsToEuroString } from '../../utils/matrix-pricing';
import { fetchLiveOrderList, getMockOrderSummaries } from '../../hooks/useLiveOrderList';
import type { CatalogTotals } from '../../lib/supabase/order-client';

export interface MatrixOrderPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrder: MatrixOrder;
  orders: (MatrixOrder | OrderSummaryItem)[];
  currentOrderIndex: number;
  onSelectOrder?: (index: number) => void;
  onSelectOrderId?: (orderId: string) => void;
}

export function MatrixOrderPickerPopover({
  isOpen, onClose, selectedOrder, orders, currentOrderIndex, onSelectOrder, onSelectOrderId,
}: MatrixOrderPickerPopoverProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'orders' | 'quotes'>('all');
  const [liveResults, setLiveResults] = useState<OrderSummaryItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [totals, setTotals] = useState<CatalogTotals>({ all: 0, orders: 0, quotes: 0 });

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchLiveOrderList({ q: searchTerm.trim() || undefined, type: typeFilter, limit: 30 });
        if (!isCancelled && res) {
          setLiveResults(res.items);
          if (res.catalogTotals) setTotals(res.catalogTotals);
        }
      } catch {
        if (!isCancelled) setLiveResults(null);
      } finally {
        if (!isCancelled) setIsSearching(false);
      }
    }, 200);
    return () => { isCancelled = true; clearTimeout(timer); };
  }, [isOpen, searchTerm, typeFilter]);

  const displayList = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const benchmarkList = getMockOrderSummaries();
    const matchesType = (item: OrderSummaryItem | MatrixOrder) => {
      if (typeFilter === 'all') return true;
      const isQuote = item.id.startsWith('O') || item.status?.toUpperCase().includes('OFFERTE');
      return typeFilter === 'quotes' ? isQuote : !isQuote;
    };
    const matchesSearch = (item: OrderSummaryItem | MatrixOrder) => !term ||
      item.id.toLowerCase().includes(term) || item.klant.toLowerCase().includes(term) ||
      Boolean(item.plaats && item.plaats.toLowerCase().includes(term));

    const eligibleBenchmarks = benchmarkList.filter((b) => matchesType(b) && matchesSearch(b));
    const liveSource = liveResults !== null ? liveResults : orders;
    const eligibleLive = liveSource.filter((l) => matchesType(l) && matchesSearch(l));

    const seenIds = new Set<string>();
    const combined: (OrderSummaryItem | MatrixOrder)[] = [];
    for (const item of [...eligibleBenchmarks, ...eligibleLive]) {
      if (!seenIds.has(item.id)) { seenIds.add(item.id); combined.push(item); }
    }
    return combined;
  }, [searchTerm, typeFilter, liveResults, orders]);

  if (!isOpen) return null;

  const handleSelect = (idx: number, id: string) => {
    if (onSelectOrderId && id) onSelectOrderId(id);
    else if (onSelectOrder) onSelectOrder(idx);
    onClose();
  };

  const activeIdx = displayList.findIndex((o) => o.id === selectedOrder.id);
  const safeIdx = activeIdx >= 0 ? activeIdx : Math.min(currentOrderIndex, Math.max(0, displayList.length - 1));
  const formatTotal = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  return (
    <div role="listbox" aria-label="Order selectielijst" className="absolute top-full left-0 mt-1 w-[420px] bg-white rounded-container shadow-xl border border-slate-200 p-3 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
        <span className="font-bold text-slate-800">Catalogus ({displayList.length}{totals.all > 0 ? ` / ${totals.all}` : ''})</span>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Vorige order" disabled={safeIdx <= 0} onClick={() => safeIdx > 0 && handleSelect(safeIdx - 1, displayList[safeIdx - 1]?.id)} className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-control hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 font-bold">‹</button>
          <span className="font-mono text-xs text-slate-600 px-1 font-semibold">{displayList.length === 0 ? '0 / 0' : `${safeIdx + 1} / ${displayList.length}`}</span>
          <button type="button" aria-label="Volgende order" disabled={safeIdx >= displayList.length - 1 || displayList.length === 0} onClick={() => safeIdx < displayList.length - 1 && handleSelect(safeIdx + 1, displayList[safeIdx + 1]?.id)} className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-control hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 font-bold">›</button>
        </div>
      </div>

      <div className="relative mb-2">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Zoek op ordernr, klant of plaats..." className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-control text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white" />
        {isSearching && <Loader2 className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin" aria-hidden="true" />}
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        {(['all', 'orders', 'quotes'] as const).map((filter) => {
          const count = filter === 'all' ? totals.all : filter === 'orders' ? totals.orders : totals.quotes;
          const label = filter === 'all' ? 'Alles' : filter === 'orders' ? 'Orders' : 'Offertes';
          const isActive = typeFilter === filter;
          return (
            <button key={filter} type="button" onClick={() => setTypeFilter(filter)} className={`px-2 py-1 rounded-control text-[11px] font-medium transition-colors ${isActive ? 'bg-sky-100 text-sky-900 font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {label} {count > 0 ? `(${formatTotal(count)})` : ''}
            </button>
          );
        })}
      </div>

      <div className="max-h-60 overflow-y-auto space-y-1" role="listbox">
        {displayList.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">Geen orders of offertes gevonden</div>
        ) : (
          displayList.map((ord, idx) => {
            const isSelected = ord.id === selectedOrder.id;
            return (
              <button key={ord.id} type="button" role="option" aria-selected={isSelected} onClick={() => handleSelect(idx, ord.id)} className={`w-full text-left px-2.5 py-2 rounded-control flex items-center justify-between transition-colors min-h-[44px] ${isSelected ? 'bg-sky-50 text-sky-900 font-semibold border border-sky-200' : 'hover:bg-slate-50 text-slate-700'}`}>
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-xs">{ord.id}</span>
                    {ord.status && (
                      <span className={`text-[10px] px-1 py-0.2 rounded ${ord.status.toUpperCase().includes('OFFERTE') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {ord.status}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[11px] text-slate-500">{ord.klant} {ord.plaats ? `(${ord.plaats})` : ''}</div>
                </div>
                <span className="font-mono text-xs font-semibold text-slate-800 shrink-0">{centsToEuroString(ord.totaalbedragCents ?? 0)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
