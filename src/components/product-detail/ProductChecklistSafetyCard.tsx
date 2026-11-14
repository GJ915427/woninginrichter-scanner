import React from 'react';
import { ShieldCheck, Check, Pen } from 'lucide-react';
import { ChecklistItem, BracketMountInfo } from '../../types/product-detail';
import { ActionButton } from '../ui/ActionButton';

export interface ProductChecklistSafetyCardProps {
  checklists: Array<ChecklistItem>;
  bracketInfo: BracketMountInfo;
  onEditSpecs?: () => void;
  onToggleChecklist?: (id: string) => void;
}

export const ProductChecklistSafetyCard: React.FC<ProductChecklistSafetyCardProps> = ({
  checklists,
  bracketInfo,
  onEditSpecs,
  onToggleChecklist,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-container shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            Checklist & Veiligheidsnormen
          </h2>
        </div>

        {/* Fitts-compliant ActionButton (min-h-[44px]) */}
        <ActionButton
          variant="outline"
          onClick={onEditSpecs}
          className="text-xs font-semibold text-blue-600 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs"
        >
          <Pen className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Specificaties Bewerken</span>
        </ActionButton>
      </div>

      <div className="p-5 space-y-5">
        {/* Checklist List Items */}
        <div className="space-y-3.5" role="group" aria-label="Veiligheidsnormen Checklists">
          {checklists.map((item) => (
            <div
              key={item.id}
              role="checkbox"
              tabIndex={0}
              aria-checked={item.checked}
              onClick={() => onToggleChecklist?.(item.id)}
              onKeyDown={(e) => {
                const isSpace = e.key === ' ' || e.key === 'Space' || e.key === 'Spacebar' || e.code === 'Space' || e.keyCode === 32;
                const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.keyCode === 13;
                if (isSpace || isEnter) {
                  e.preventDefault();
                  onToggleChecklist?.(item.id);
                }
              }}
              className="w-full text-left flex items-start gap-3 p-3 bg-white hover:bg-slate-50/80 border border-slate-200 rounded-control shadow-2xs cursor-pointer transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 select-none min-h-[44px]"
            >
              <div
                className={`mt-0.5 w-5 h-5 rounded-control flex items-center justify-center transition-colors shrink-0 ${
                  item.checked ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white'
                }`}
                aria-hidden="true"
              >
                {item.checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>

              <div className="space-y-0.5 text-xs">
                <div className="font-bold text-slate-900">{item.title}</div>
                <div className="text-slate-600 leading-relaxed font-normal">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Technical Profile Cross Section & Bracket Location */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Doorsnede & Beugellocatie
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Left spec info */}
            <div className="space-y-1">
              <div className="font-bold text-slate-800">{bracketInfo.mountDescription}</div>
              <div className="text-slate-500">
                Kleurcode: <span className="text-slate-700 font-semibold">{bracketInfo.colorCode}</span>
              </div>
              {bracketInfo.centerSupport && (
                <div className="text-slate-500">
                  Middensteun: <span className="text-slate-700 font-semibold">{bracketInfo.centerSupport}</span>
                </div>
              )}
            </div>

            {/* Right bracket diagram & values */}
            <div className="space-y-2 bg-slate-50/70 p-3 rounded-control border border-slate-200 shadow-2xs">
              {/* Schematic Bracket Diagram */}
              <div className="relative w-full h-4 flex items-center justify-between px-2">
                <div className="absolute left-2 right-2 h-0.5 bg-slate-300" />
                <div className="relative z-10 w-2.5 h-2.5 bg-blue-600 rounded-control" title="Steun Links" />
                <div className="relative z-10 w-2.5 h-2.5 bg-blue-600 rounded-control" title="Steun Rechts" />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>{bracketInfo.supportLeft}</span>
                <span>{bracketInfo.supportRight}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductChecklistSafetyCard;
