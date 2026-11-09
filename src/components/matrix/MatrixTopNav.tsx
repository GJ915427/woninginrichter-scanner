'use client';

// [SPEC-CHANGE-AUTHORIZED: Handcrafting van de rustige Stitch Topbar capsule (h-14, 56px), squircle EasyM2M logo (w-9 h-9 rounded-container met gradient), 6 navigatietabs in rounded-container capsule met rounded-control actieve Project tab, SVG zoeklens en zachtblauwe avatar (rounded-pill) conform Stitch Optie 1 en Fitts law >= 44px touch targets]
import React from 'react';
import Link from 'next/link';

export interface MatrixTopNavProps {
  activeTab?: string;
  onTabClick?: (tab: string) => void;
  onSearchClick?: () => void;
  userInitials?: string;
  userName?: string;
  // Optionele compatibiliteitsprops
  currentOrderIndex?: number;
  totalOrders?: number;
  onPreviousOrder?: () => void;
  onNextOrder?: () => void;
  customerName?: string;
  projectName?: string;
}

const NAV_TABS = ['Home', 'Klant', 'Object', 'Project', 'Ruimte', 'Product'] as const;

/**
 * MatrixTopNav (INV-GOV-22)
 * Rustige, ademende 56px capsule topbalk conform Google Stitch Optie 1.
 * Pure presentational component (0 hooks, < 110 regels).
 */
export function MatrixTopNav({
  activeTab = 'Project',
  onTabClick,
  onSearchClick,
  userInitials = 'CH',
  userName = 'Carlo Heinemans',
}: MatrixTopNavProps) {
  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-20 text-xs select-none"
    >
      {/* Linkerzijde: EasyM2M Squircle Brand Logo + 6 Capsule Navigatietabs */}
      <div className="flex items-center gap-5">
        <Link
          href="/"
          className="flex items-center gap-2.5 min-h-[44px] px-1 hover:opacity-90 transition-opacity select-none"
          title="EasyM2M LogicTrade Portaal"
        >
          <div className="w-9 h-9 rounded-container bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-sm shadow-blue-500/20">
            <span>E=M²</span>
          </div>
          <div className="flex items-center text-base tracking-tight leading-none">
            <span className="font-bold text-slate-900">Easy</span>
            <span className="font-bold text-blue-600">M2M</span>
          </div>
        </Link>

        {/* 6 Capsule Navigatietabs met Fitts' Law >= 44px hit-box */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-0.5 rounded-container border border-slate-200/80">
          {NAV_TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onTabClick?.(tab)}
                aria-current={isActive ? 'page' : undefined}
                className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3.5 py-1.5 rounded-control font-semibold transition-all ${
                  isActive
                    ? 'bg-white text-blue-600 font-bold shadow-2xs border border-slate-200/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rechterzijde: Zoekactie met vector SVG lens + Zachtblauwe Avatar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSearchClick}
          aria-label="Zoeken"
          className="min-h-[44px] min-w-[44px] p-2 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-pill transition-colors text-sm"
          title="Zoeken (Ctrl+K)"
        >
          <svg
            className="w-4 h-4 text-slate-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>

        <div className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity" title={userName}>
          <div className="w-8 h-8 rounded-pill bg-blue-100 text-blue-700 font-semibold border border-blue-200/50 flex items-center justify-center text-xs shadow-2xs">
            <span>{userInitials}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
