'use client';

import React from 'react';
import Link from 'next/link';

export interface MatrixTopNavProps {
  currentOrderIndex: number;
  totalOrders: number;
  onPreviousOrder: () => void;
  onNextOrder: () => void;
  customerName?: string;
  projectName?: string;
}

export function MatrixTopNav({
  currentOrderIndex,
  totalOrders,
  onPreviousOrder,
  onNextOrder,
  customerName = 'Jaspers',
  projectName = 'Maastricht',
}: MatrixTopNavProps) {
  const isFirst = currentOrderIndex <= 0;
  const isLast = currentOrderIndex >= totalOrders - 1;

  return (
    <nav
      aria-label="Kruimelpad & Ordernavigatie"
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-2 bg-slate-900 text-white text-xs border-b border-slate-800"
    >
      {/* Breadcrumbs */}
      <ol className="flex items-center flex-wrap gap-1.5 text-slate-400">
        <li className="flex items-center gap-1.5">
          <Link
            href="/"
            className="flex items-center py-2 px-1 hover:text-white transition-colors"
          >
            Home
          </Link>
          <span className="text-slate-600 font-mono">/</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="text-slate-200 font-medium py-2 px-1">{customerName}</span>
          <span className="text-slate-600 font-mono">/</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="text-slate-200 font-medium py-2 px-1">{projectName}</span>
          <span className="text-slate-600 font-mono">/</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="text-blue-400 font-semibold py-2 px-1" aria-current="page">
            Matrix Orders Browser
          </span>
        </li>
      </ol>

      {/* Order Switcher */}
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold mr-1">
          Order:
        </span>

        <button
          type="button"
          onClick={onPreviousOrder}
          disabled={isFirst}
          aria-label="Vorige order"
          className="flex items-center gap-1 px-3 py-1.5 min-h-[44px] rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700/60 transition-colors"
        >
          <span>‹</span>
          <span>Vorige</span>
        </button>

        <span className="font-mono font-bold text-slate-200 px-2 py-1 min-h-[44px] flex items-center bg-slate-800/80 rounded-md border border-slate-700">
          {currentOrderIndex + 1} / {Math.max(1, totalOrders)}
        </span>

        <button
          type="button"
          onClick={onNextOrder}
          disabled={isLast}
          aria-label="Volgende order"
          className="flex items-center gap-1 px-3 py-1.5 min-h-[44px] rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700/60 transition-colors"
        >
          <span>Volgende</span>
          <span>›</span>
        </button>
      </div>
    </nav>
  );
}
