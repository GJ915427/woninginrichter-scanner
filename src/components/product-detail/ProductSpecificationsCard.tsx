import React from 'react';
import { SlidersHorizontal } from 'lucide-react';

export interface ProductSpecificationsCardProps {
  specifications: {
    fabric: string;
    profileColor: string;
    operation: string;
    mountType: string;
    stackHeight: string;
  };
  onEdit?: () => void;
}

export const ProductSpecificationsCard: React.FC<ProductSpecificationsCardProps> = ({
  specifications,
  onEdit,
}) => {
  const specRows = [
    { label: 'Stof & Uitvoering', value: specifications.fabric },
    { label: 'Profielkleur', value: specifications.profileColor },
    { label: 'Bediening', value: specifications.operation },
    { label: 'Montagewijze', value: specifications.mountType },
    { label: 'Pakkethoogte', value: specifications.stackHeight },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-blue-600" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Specificaties</h2>
        </div>

        {/* Fitts-compliant edit button (min-h-[44px]) */}
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center justify-center min-h-[44px] px-3.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50/80 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          Wijzigen
        </button>
      </div>

      {/* Specifications Rows */}
      <div className="divide-y divide-slate-100 text-xs">
        {specRows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors"
          >
            <span className="text-slate-500 font-medium">{row.label}</span>
            <span className="text-slate-900 font-semibold text-right">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
