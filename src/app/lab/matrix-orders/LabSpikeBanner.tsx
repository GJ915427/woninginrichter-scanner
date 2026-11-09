'use client';

// [VISUAL-MUTATION-AUTHORIZED: Geïsoleerde /lab/matrix-orders UX Spike route conform HITL verzoek]
import React from 'react';
import Link from 'next/link';
import { FlaskConical, ArrowLeft } from 'lucide-react';

export interface LabSpikeBannerProps {
  viewMode: 'matrix' | 'audit';
  onViewModeChange: (mode: 'matrix' | 'audit') => void;
  totalAuditLines?: number;
}

/**
 * LabSpikeBanner (INV-GOV-22)
 * Presentational banner voor de geïsoleerde UX Spike route (/lab/matrix-orders).
 * Bevat amber statusindicator, Fitts' Law touch targets (>= 44x44px),
 * return-link naar productie en segmented control view-mode toggle.
 * Pure presentational component (0 hooks, < 80 LOC).
 */
export function LabSpikeBanner({
  viewMode,
  onViewModeChange,
  totalAuditLines = 0,
}: LabSpikeBannerProps) {
  return (
    <div
      id="lab-spike-banner"
      role="status"
      className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-xs select-none"
    >
      <div className="flex items-center gap-3">
        <Link
          href="/matrix-orders"
          className="min-h-[44px] min-w-[44px] inline-flex items-center gap-1.5 text-amber-800 hover:text-amber-950 font-semibold px-2 py-1 rounded transition-colors focus:outline-hidden focus:ring-2 focus:ring-amber-500"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Naar Productie</span>
        </Link>
        <div className="h-4 w-px bg-amber-200" aria-hidden="true" />
        <div className="inline-flex items-center gap-2 text-amber-900 font-medium">
          <span className="p-1 rounded bg-amber-100 text-amber-800 inline-flex items-center justify-center">
            <FlaskConical className="w-3.5 h-3.5" />
          </span>
          <span className="font-bold tracking-tight">LAB SPIKE</span>
          <span className="text-amber-700 hidden sm:inline">(Hoofdscherm 4 Matrix)</span>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-amber-100/70 p-0.5 rounded-lg border border-amber-200">
        <button
          type="button"
          data-view="matrix"
          onClick={() => onViewModeChange('matrix')}
          className={`min-h-[44px] px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            viewMode === 'matrix'
              ? 'bg-white text-amber-950 shadow-xs font-semibold'
              : 'text-amber-800 hover:text-amber-950'
          }`}
        >
          Matrix Raster
        </button>
        <button
          type="button"
          data-view="audit"
          onClick={() => onViewModeChange('audit')}
          className={`min-h-[44px] px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            viewMode === 'audit'
              ? 'bg-white text-amber-950 shadow-xs font-semibold'
              : 'text-amber-800 hover:text-amber-950'
          }`}
        >
          Audit Trail {totalAuditLines > 0 ? `(${totalAuditLines})` : ''}
        </button>
      </div>
    </div>
  );
}
