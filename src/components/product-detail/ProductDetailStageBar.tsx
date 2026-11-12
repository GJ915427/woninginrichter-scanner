import React from 'react';
import { Ruler, Wrench, AlertTriangle } from 'lucide-react';

export interface ProductDetailStageBarProps {
  currentStage: string;
  onStartInmeten?: () => void;
  onStartMonteren?: () => void;
  onRegisterIssue?: () => void;
}

export const ProductDetailStageBar: React.FC<ProductDetailStageBarProps> = ({
  currentStage,
  onStartInmeten,
  onStartMonteren,
  onRegisterIssue,
}) => {
  return (
    <div className="w-full bg-white border-b border-slate-200 px-4 sm:px-6 py-2">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
        {/* Left: Action triggers with physical Fitts min-h-[44px] */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onStartInmeten}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-3.5 py-1.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-medium rounded-md border border-slate-200 transition-colors shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            <Ruler className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>Start Inmeten</span>
          </button>

          <button
            type="button"
            onClick={onStartMonteren}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-3.5 py-1.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-medium rounded-md border border-slate-200 transition-colors shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            <Wrench className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
            <span>Start Monteren</span>
          </button>

          <button
            type="button"
            onClick={onRegisterIssue}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-3.5 py-1.5 bg-white hover:bg-amber-50 active:bg-amber-100 text-amber-800 text-xs font-medium rounded-md border border-amber-200 transition-colors shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
            <span>Issue Registreren</span>
          </button>
        </div>

        {/* Right: Current FSM workflow stage indicator */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-normal">Huidige fase:</span>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-md text-blue-800 font-semibold shadow-2xs">
            <span>{currentStage}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
