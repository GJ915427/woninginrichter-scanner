'use client';

import React, { useState, useMemo } from 'react';
import { MatrixOrder } from '../../types/matrix';
import { centsToEuroString } from '../../utils/matrix-pricing';

interface MatrixSidebarProps {
  orders: MatrixOrder[];
  currentIndex: number;
  onSelectOrder: (index: number) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export function MatrixSidebar({
  orders,
  currentIndex,
  onSelectOrder,
  isOpen,
  onToggleOpen,
}: MatrixSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.klant.toLowerCase().includes(q) ||
        o.plaats.toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  if (!isOpen) {
    return (
      <div className="bg-white text-slate-700 p-2 flex flex-col items-center border-r border-slate-200 select-none">
        <button
          type="button"
          onClick={onToggleOpen}
          className="p-2 rounded-lg hover:bg-slate-100 transition cursor-pointer text-slate-600"
          title="Open Orders Explorer"
          aria-label="Open Orders Explorer"
        >
          »
        </button>
      </div>
    );
  }

  return (
    <aside aria-label="Orders Explorer" className="w-80 min-w-[320px] max-w-[320px] bg-white text-slate-800 flex flex-col border-r border-slate-200 select-none text-xs">
      {/* HEADER */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Orders Explorer
          </span>
          <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
            {orders.length} live
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleOpen}
          className="text-slate-400 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-100 transition cursor-pointer"
          title="Klap zijbalk in"
          aria-label="Klap zijbalk in"
        >
          «
        </button>
      </div>

      {/* QUICK NAV: VORIGE / VOLGENDE */}
      <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
        <button
          type="button"
          disabled={currentIndex <= 0}
          onClick={() => onSelectOrder(currentIndex - 1)}
          className="px-2.5 py-1 rounded text-xs bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs font-medium"
        >
          &lt; Vorige
        </button>
        <span className="text-xs font-mono font-semibold text-slate-600">
          {currentIndex + 1} / {orders.length}
        </span>
        <button
          type="button"
          disabled={currentIndex >= orders.length - 1}
          onClick={() => onSelectOrder(currentIndex + 1)}
          className="px-2.5 py-1 rounded text-xs bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs font-medium"
        >
          Volgende &gt;
        </button>
      </div>

      {/* ZOEKVELD */}
      <div className="p-2 border-b border-slate-200">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Zoek order, klant of plaats..."
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
        />
      </div>

      {/* ORDERS LIJST */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {filteredOrders.map((order) => {
          const originalIndex = orders.findIndex((o) => o.id === order.id);
          const isSelected = originalIndex === currentIndex;

          return (
            <div
              key={order.id}
              id={`sidebar-order-${order.id}`}
              onClick={() => onSelectOrder(originalIndex)}
              className={`p-3 transition-colors cursor-pointer border-l-4 ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/70 font-semibold shadow-2xs'
                  : 'border-transparent hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-mono font-bold ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                  {order.id}
                </span>
                <span className="text-xs font-mono font-bold text-emerald-700">
                  {centsToEuroString(order.totaalbedragCents)}
                </span>
              </div>
              <div className="text-xs font-medium text-slate-800 truncate">
                {order.klant}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                <span>{order.plaats}</span>
                <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded font-mono text-slate-600">
                  {order.positionCount ?? 15} pos.
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* GSW 2026 OMZET SNAPSHOT FOOTER */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/90 text-slate-700">
        <div className="font-bold text-[11px] uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
          <span>Winkel GSW BV (2026)</span>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 rounded font-mono font-bold">Actief</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center font-mono">
          <div className="bg-white p-1.5 rounded border border-slate-200 shadow-2xs">
            <div className="text-[10px] text-slate-500 font-sans">Orders</div>
            <div className="font-bold text-slate-800 text-xs">674</div>
          </div>
          <div className="bg-white p-1.5 rounded border border-slate-200 shadow-2xs">
            <div className="text-[10px] text-slate-500 font-sans">Omzet</div>
            <div className="font-bold text-emerald-700 text-xs">€ 1,91M</div>
          </div>
          <div className="bg-white p-1.5 rounded border border-slate-200 shadow-2xs">
            <div className="text-[10px] text-slate-500 font-sans">Gemiddeld</div>
            <div className="font-bold text-slate-800 text-xs">€ 2.833</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
