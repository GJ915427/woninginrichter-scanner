import React from 'react';
import { centsToEuroString } from '../../utils/matrix-pricing';

export interface ProductDetailTitleBannerProps {
  productName: string;
  category: string;
  roomName: string;
  positionCode: string;
  productionWidthMm: number;
  productionHeightMm: number;
  priceCents: number;
}

export const ProductDetailTitleBanner: React.FC<ProductDetailTitleBannerProps> = ({
  productName,
  category,
  roomName,
  positionCode,
  productionWidthMm,
  productionHeightMm,
  priceCents,
}) => {
  const formattedPrice = centsToEuroString(priceCents);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-3">
      <div className="flex flex-wrap items-start justify-between gap-y-4 gap-x-6">
        {/* Left: Product Name & Descriptive Context Tags */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {productName}
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded font-medium">
              {category}
            </span>
            <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded font-medium">
              Ruimte: <span className="text-slate-900 font-semibold">{roomName}</span>
            </span>
            <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded font-medium">
              Positie: <span className="text-slate-900 font-semibold">{positionCode} (Kozijn Binnen)</span>
            </span>
          </div>
        </div>

        {/* Right: Key Performance Indicators (KPIs) */}
        <div className="flex flex-wrap items-center gap-3">
          {/* KPI 1: Blijvende Productiemaat */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 min-w-[170px] text-right shadow-2xs">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-0.5">
              Blijvende Productiemaat
            </div>
            <div className="text-lg font-extrabold text-blue-900 tracking-tight">
              {productionWidthMm} <span className="text-sm font-semibold text-slate-500">×</span> {productionHeightMm} <span className="text-xs font-normal text-slate-500">mm</span>
            </div>
          </div>

          {/* KPI 2: Positieprijs */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 min-w-[170px] text-right shadow-2xs">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-0.5">
              Positieprijs
            </div>
            <div className="text-lg font-extrabold text-slate-900 tracking-tight">
              {formattedPrice} <span className="text-[11px] font-normal text-slate-500">incl. BTW</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
