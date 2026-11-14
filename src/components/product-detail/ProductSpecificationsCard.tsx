import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { ProductSpecifications } from '../../types/product-detail';
import { ActionButton } from '../ui/ActionButton';

export interface ProductSpecificationsCardProps {
  specifications: ProductSpecifications;
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
    <div className="bg-white border border-slate-200 rounded-container shadow-2xs overflow-hidden select-none">
      {/* Card Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-blue-600" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Specificaties</h2>
        </div>

        {/* Fitts-compliant edit button with physical layout bounding box (min-h-[44px]) */}
        <ActionButton
          variant="ghost"
          onClick={onEdit}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50/80 rounded-control shadow-2xs"
        >
          Wijzigen
        </ActionButton>
      </div>

      {/* Specifications Rows with subtle zebra-striping */}
      <div className="divide-y divide-slate-100 text-xs">
        {specRows.map((row, idx) => (
          <div
            key={row.label}
            className={`flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 transition-colors ${
              idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
            } hover:bg-blue-50/30`}
          >
            <span className="text-slate-500 font-medium">{row.label}</span>
            <span className="text-slate-900 font-semibold text-right font-sans">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductSpecificationsCard;
