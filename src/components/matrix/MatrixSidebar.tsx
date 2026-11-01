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
      <div className="bg-slate-900 text-white p-2 flex flex-col items-center border-r border-slate-800">
        <button
          type="button"
          onClick={onToggleOpen}
          className="p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer text-slate-300"
          title="Open Orders Explorer"
        >
          »
        </button>
      </div>
    );
  }

  return (
    <aside className="w-64 min-w-[256px] max-w-[256px] bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 select-none">
      {/* HEADER */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Orders Explorer
          </span>
          <span className="text-[10px] font-mono font-bold bg-blue-900 text-blue-200 px-1.5 py-0.5 rounded">
            {orders.length} live
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleOpen}
          className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
          title="Klap zijbalk in"
        >
          «
        </button>
      </div>

      {/* QUICK NAV: VORIGE / VOLGENDE */}
      <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <button
          type="button"
          disabled={currentIndex <= 0}
          onClick={() => onSelectOrder(currentIndex - 1)}
          className="px-2 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        >
          &lt; Vorige
        </button>
        <span className="text-xs font-mono text-slate-400">
          {currentIndex + 1} / {orders.length}
        </span>
        <button
          type="button"
          disabled={currentIndex >= orders.length - 1}
          onClick={() => onSelectOrder(currentIndex + 1)}
          className="px-2 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        >
          Volgende &gt;
        </button>
      </div>

      {/* ZOEKVELD */}
      <div className="p-2 border-b border-slate-800">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Zoek order of klant..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* ORDERS LIJST */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
        {filteredOrders.map((order) => {
          const originalIndex = orders.findIndex((o) => o.id === order.id);
          const isSelected = originalIndex === currentIndex;

          return (
            <div
              key={order.id}
              id={`sidebar-order-${order.id}`}
              onClick={() => onSelectOrder(originalIndex)}
              className={`p-3 transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white font-semibold shadow-inner'
                  : 'hover:bg-slate-800/50 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold font-mono ${isSelected ? 'text-white' : 'text-blue-400'}`}>
                  {order.id}
                </span>
                <span className="text-xs font-mono font-bold">
                  {centsToEuroString(order.totaalbedragCents)}
                </span>
              </div>
              <div className="text-xs truncate font-medium">
                {order.klant}
              </div>
              <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                {order.plaats}
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div className="p-2.5 border-t border-slate-800 text-[10px] text-slate-400 text-center bg-slate-950/60 font-mono">
        Winkel GSW BV (2026)
      </div>
    </aside>
  );
}
