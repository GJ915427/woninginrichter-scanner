import React from 'react';
import { ShieldCheck, Check, Pen } from 'lucide-react';
import { ChecklistItem } from '../../types/product-detail';

export interface ProductChecklistSafetyCardProps {
  checklists: Array<ChecklistItem>;
  bracketInfo: {
    mountDescription: string;
    colorCode: string;
    supportLeft: string;
    supportRight: string;
    centerSupport: string;
  };
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            Checklist & Veiligheidsnormen
          </h2>
        </div>

        {/* Fitts-compliant action trigger (min-h-[44px]) */}
        <button
          type="button"
          onClick={onEditSpecs}
          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50/80 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          <Pen className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Specificaties Bewerken</span>
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Checklist List Items */}
        <div className="space-y-3.5">
          {checklists.map((item) => (
            <div
              key={item.id}
              onClick={() => onToggleChecklist?.(item.id)}
              className="flex items-start gap-3 p-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 rounded-lg cursor-pointer transition-colors"
            >
              <div
                className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center transition-colors shrink-0 ${
                  item.checked ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white'
                }`}
              >
                {item.checked && <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />}
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
            </div>

            {/* Right bracket diagram & values */}
            <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
              {/* Schematic Bracket Diagram */}
              <div className="relative w-full h-4 flex items-center justify-between px-2">
                <div className="absolute left-2 right-2 h-0.5 bg-slate-300" />
                <div className="relative z-10 w-2.5 h-2.5 bg-blue-600 rounded-xs" title="Steun Links" />
                <div className="relative z-10 w-2.5 h-2.5 bg-blue-600 rounded-xs" title="Steun Rechts" />
              </div>

              <div className="text-[11px] text-slate-600 space-y-0.5">
                <div className="flex justify-between">
                  <span>Steun L:</span>
                  <span className="font-semibold text-slate-800">{bracketInfo.supportLeft}</span>
                </div>
                <div className="flex justify-between">
                  <span>Steun R:</span>
                  <span className="font-semibold text-slate-800">{bracketInfo.supportRight}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Centrumsteun:</span>
                  <span>{bracketInfo.centerSupport}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
