'use client';

import React from 'react';
import Link from 'next/link';
import { FSM_STAGES } from '../../types/matrix';

export interface MatrixTopNavProps {
  currentOrderIndex: number;
  totalOrders: number;
  onPreviousOrder: () => void;
  onNextOrder: () => void;
  customerName?: string;
  projectName?: string;
  activeTab?: string;
  fsmStage?: number;
  onFsmStageChange?: (stage: number) => void;
  onTabClick?: (tab: string) => void;
}

const NAV_TABS = ['Home', 'Klant', 'Object', 'Project', 'Ruimte', 'Product'] as const;

export function MatrixTopNav({
  currentOrderIndex,
  totalOrders,
  onPreviousOrder,
  onNextOrder,
  activeTab = 'Project',
  fsmStage = 5,
  onFsmStageChange,
  onTabClick,
}: MatrixTopNavProps) {
  const isFirst = currentOrderIndex <= 0;
  const isLast = currentOrderIndex >= totalOrders - 1;

  return (
    <nav
      aria-label="Kruimelpad & Ordernavigatie"
      className="min-h-12 h-auto py-1 bg-white border-b border-slate-200 px-4 flex flex-wrap items-center justify-between gap-3 z-20 text-xs select-none"
    >
      {/* Linkerzijde: EasyM2M Branding + Hoofdnavigatie Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto flex-nowrap py-1">
        {/* EasyM2M Brand Badge */}
        <Link
          href="/"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          title="EasyM2M LogicTrade Portaal"
        >
          <span className="font-extrabold tracking-tight text-blue-400">EasyM²M</span>
          <span className="text-[10px] font-mono bg-blue-600/80 text-white px-1.5 py-0.2 rounded font-semibold">
            v3.0 H5
          </span>
        </Link>

        {/* 6 Navigatietabs */}
        <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
          {NAV_TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onTabClick?.(tab)}
                aria-current={isActive ? 'page' : undefined}
                className={`min-h-[44px] px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                  isActive
                    ? 'bg-blue-50/80 text-blue-600 border border-blue-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                <span>{tab}</span>
              </button>
            );
          })}
        </div>

        {/* Order Quick-Switcher Container (TC-NAV-01 conform) */}
        <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
          <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold mr-1">
            Order:
          </span>

          <button
            type="button"
            onClick={onPreviousOrder}
            disabled={isFirst}
            aria-label="Vorige order"
            className="flex items-center justify-center px-2.5 py-1 min-h-[44px] rounded-lg font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 transition-colors"
          >
            <span className="text-sm font-bold">‹</span>
            <span className="ml-1">Vorige</span>
          </button>

          <span className="font-mono font-bold text-slate-800 px-2 py-1 min-h-[44px] flex items-center bg-slate-50 rounded-md border border-slate-200 text-xs">
            {currentOrderIndex + 1} / {Math.max(1, totalOrders)}
          </span>

          <button
            type="button"
            onClick={onNextOrder}
            disabled={isLast}
            aria-label="Volgende order"
            className="flex items-center justify-center px-2.5 py-1 min-h-[44px] rounded-lg font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 transition-colors"
          >
            <span className="mr-1">Volgende</span>
            <span className="text-sm font-bold">›</span>
          </button>
        </div>
      </div>

      {/* Rechterzijde: FSM Dropdown + Zoeken + Winkelbadge + Jan Avatar */}
      <div className="flex items-center gap-3">
        {/* FSM Select Dropdown */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="fsm-stage-select" className="text-slate-500 font-medium text-[11px]">
            FSM:
          </label>
          <select
            id="fsm-stage-select"
            aria-label="FSM Processtap"
            value={fsmStage}
            onChange={(e) => onFsmStageChange?.(Number(e.target.value))}
            className="min-h-[44px] px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {FSM_STAGES.map((s) => (
              <option key={s.step} value={s.step}>
                {s.step}. {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Ctrl+K Search button */}
        <button
          type="button"
          aria-label="Zoeken"
          className="min-h-[44px] px-2.5 py-1 flex items-center gap-1.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded bg-slate-50 hover:bg-slate-100 transition-colors text-xs"
        >
          <span>🔍</span>
          <kbd className="font-mono text-[10px] bg-white border border-slate-300 px-1 rounded shadow-2xs">
            Ctrl+K
          </kbd>
        </button>

        {/* Vestiging Badge */}
        <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-medium text-xs border border-slate-200">
          Winkel GSW BV
        </span>

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
            J
          </div>
          <span className="text-slate-800 font-semibold text-xs hidden sm:inline">
            Jan (GSW)
          </span>
        </div>
      </div>
    </nav>
  );
}
