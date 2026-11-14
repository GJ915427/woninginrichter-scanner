import React from 'react';
import { Ruler, Wrench, AlertTriangle } from 'lucide-react';
import { ActionButton } from '../ui/ActionButton';

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
    <div
      aria-label="Workflow Actiebalk"
      className="w-full bg-white border-b border-slate-200 px-6 py-2 shadow-2xs select-none flex flex-wrap items-center justify-between gap-y-3 gap-x-4"
    >
      {/* Left: Action triggers via ActionButton (min-h-[44px] physical bounding box) */}
      <div className="flex items-center gap-2 flex-wrap">
        <ActionButton
          variant="outline"
          onClick={onStartInmeten}
          className="font-semibold text-slate-700 shadow-2xs"
        >
          <Ruler className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
          <span>Start Inmeten</span>
        </ActionButton>

        <ActionButton
          variant="outline"
          onClick={onStartMonteren}
          className="font-semibold text-slate-700 shadow-2xs"
        >
          <Wrench className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
          <span>Start Monteren</span>
        </ActionButton>

        <ActionButton
          variant="outline"
          onClick={onRegisterIssue}
          className="font-semibold border-amber-200 text-amber-800 hover:bg-amber-50 shadow-2xs"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
          <span>Issue Registreren</span>
        </ActionButton>
      </div>

      {/* Right: Current FSM workflow stage indicator */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500 font-medium">Huidige fase:</span>
        <div className="min-h-[44px] px-3 inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-control text-blue-800 font-bold text-xs shadow-2xs">
          <span>{currentStage}</span>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailStageBar;
