import React from 'react';
import { Maximize2, Info } from 'lucide-react';
import { MeasurementAxis } from '../../types/product-detail';

export interface ProductMeasurementCanvasCardProps {
  width: MeasurementAxis;
  height: MeasurementAxis;
  installationHeightMm: number;
  isInstallationHeightFixed: boolean;
}

export const ProductMeasurementCanvasCard: React.FC<ProductMeasurementCanvasCardProps> = ({
  width,
  height,
  installationHeightMm,
  isInstallationHeightFixed,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Maximize2 className="w-4 h-4 text-blue-600" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Meetgegevens</h2>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Schematic Measurement Canvas Viewport */}
        <div className="relative w-full h-44 bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-center overflow-hidden">
          {/* Schematic Window Drawing */}
          <div className="relative w-36 h-32 border-2 border-slate-400 bg-white shadow-2xs rounded-xs flex flex-col justify-between p-1.5">
            {/* Top Bar Indicator */}
            <div className="w-full h-2 bg-slate-200 rounded-2xs" />

            {/* Inner Glazing Crosshairs */}
            <div className="w-full h-full border border-dashed border-slate-200 my-1 flex items-center justify-center">
              <span className="text-[10px] text-slate-400 font-mono">
                {width.finalProductionMm} × {height.finalProductionMm}
              </span>
            </div>

            {/* Bottom Bar Indicator */}
            <div className="w-full h-2 bg-slate-200 rounded-2xs" />
          </div>

          {/* Dimension indicator tags */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-[11px] font-bold text-blue-900 shadow-2xs">
            B: {width.finalProductionMm} mm
          </div>

          <div className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-[11px] font-bold text-blue-900 shadow-2xs">
            H: {height.finalProductionMm} mm
          </div>
        </div>

        {/* Structured 3-Point Laser Line Metrics */}
        <div className="space-y-3.5 text-xs">
          {/* Width Metrics Axis */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">Breedte (B)</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-mono">
                  B1:{width.points[0]} · B2:{width.points[1]} · B3:{width.points[2]}
                </span>
                <span className="px-1.5 py-0.2 bg-slate-200/80 text-slate-700 rounded text-[10px] font-semibold">
                  MIN {width.minRawMm} mm
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{width.formulaDescription}</span>
              <span className="font-extrabold text-blue-900 text-sm">{width.finalProductionMm} mm</span>
            </div>
          </div>

          {/* Height Metrics Axis */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">Hoogte (H)</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-mono">
                  H1:{height.points[0]} · H2:{height.points[1]} · H3:{height.points[2]}
                </span>
                <span className="px-1.5 py-0.2 bg-slate-200/80 text-slate-700 rounded text-[10px] font-semibold">
                  MIN {height.minRawMm} mm
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{height.formulaDescription}</span>
              <span className="font-extrabold text-blue-900 text-sm">{height.finalProductionMm} mm</span>
            </div>
          </div>

          {/* Installation Height (Montagehoogte - MH) */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <span>MONTAGEHOOGTE (MH)</span>
              <Info className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            </div>

            <div className="flex items-center gap-2">
              {isInstallationHeightFixed && (
                <span className="px-1.5 py-0.2 bg-blue-100/70 text-blue-800 rounded text-[10px] font-bold">
                  VAST
                </span>
              )}
              <span className="font-extrabold text-slate-900 text-sm">
                {installationHeightMm} <span className="text-xs font-normal text-slate-500">mm</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
