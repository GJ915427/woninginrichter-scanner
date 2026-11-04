'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CellPriceData, DimensionSpec, PricingMode } from '../../types/matrix';
import {
  calculateDimensionPriceCents,
  calculatePriceFromSpec,
  formatDimensionSpec,
  formatPriceCents,
  parseDimensionSpec,
  resolveCellBaseRateCents,
  validateDimensions,
  STAIRS_SURCHARGES,
} from '../../utils/matrix-pricing';

export interface MatrixProductEditDrawerProps {
  isOpen: boolean;
  productName: string;
  productCode: string;
  category?: string;
  productId?: string;
  positionName: string;
  subPos?: string;
  initialData?: CellPriceData;
  onClose: () => void;
  onSave: (data: Partial<CellPriceData>) => void;
  onDelete?: () => void;
}

interface DrawerFormData {
  spec: DimensionSpec;
  quantity: number;
  unit: string;
  pricingMode: PricingMode;
  baseRateCents: number;
  notes: string;
}

function getInitialFormData(initialData?: CellPriceData, category?: string): DrawerFormData {
  const dimStr = initialData?.dim || initialData?.afmetingen ||
    (initialData?.breedte_mm && initialData?.hoogte_mm ? `${initialData.breedte_mm} × ${initialData.hoogte_mm}` : undefined);
  const spec: DimensionSpec = initialData?.dimensionSpec ?? parseDimensionSpec(dimStr, category);
  const baseRate = initialData?.baseRateCents && initialData.baseRateCents > 0
    ? initialData.baseRateCents : (initialData ? resolveCellBaseRateCents(initialData, spec) : 15000);

  return {
    spec,
    quantity: initialData?.quantity ?? 1,
    unit: initialData?.unit ?? 'stuks',
    pricingMode: initialData?.pricingMode ?? (spec.type === 'window_2d' ? 'unit' : 'm2'),
    baseRateCents: baseRate,
    notes: initialData?.note ?? initialData?.opmerking ?? '',
  };
}

/**
 * Slide-over drawer voor celbewerking conform INV-GOV-22 (<=250 regels, <=4 hooks).
 * Ondersteunt polymorfe specificaties voor trappen, vloeren, gordijnen, ramen en diensten.
 */
export const MatrixProductEditDrawer: React.FC<MatrixProductEditDrawerProps> = ({
  isOpen, productName, productCode, category, positionName, subPos, initialData, onClose, onSave, onDelete,
}) => {
  const [formData, setFormData] = useState<DrawerFormData>(() => getInitialFormData(initialData, category));
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialFormData(initialData, category));
      setTimeout(() => firstInputRef.current?.focus(), 50);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, initialData, category, onClose]);

  if (!isOpen) return null;

  const { spec, quantity, unit, pricingMode, baseRateCents, notes } = formData;
  const updateField = <K extends keyof DrawerFormData>(key: K, val: DrawerFormData[K]) =>
    setFormData((prev) => ({ ...prev, [key]: val }));
  const updateSpec = (patch: Partial<DimensionSpec>) =>
    setFormData((prev) => ({ ...prev, spec: { ...prev.spec, ...patch } as DimensionSpec }));

  const unitCents = spec.type === 'window_2d'
    ? (pricingMode === 'm2' ? calculateDimensionPriceCents(spec.widthMm, spec.heightMm, baseRateCents, 'm2') : baseRateCents)
    : calculatePriceFromSpec(spec, baseRateCents);
  const totalCents = quantity * unitCents;
  const validation = (spec.type === 'window_2d' || spec.type === 'curtain_linear')
    ? validateDimensions(spec.widthMm, spec.heightMm) : { valid: true };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedDim = formatDimensionSpec(spec);
    const widthMm = 'widthMm' in spec ? spec.widthMm : undefined;
    const heightMm = 'heightMm' in spec ? spec.heightMm : undefined;
    onSave({
      ...initialData, breedte_mm: widthMm, hoogte_mm: heightMm, dim: formattedDim, afmetingen: formattedDim,
      dimensionSpec: spec, quantity, unit, pricingMode, baseRateCents, unitPriceCents: unitCents,
      totalPriceCents: totalCents, note: notes, opmerking: notes, isCalculated: true,
    });
    onClose();
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity" aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="product-edit-title" className="fixed inset-y-0 right-0 z-50 w-[420px] max-w-full bg-white shadow-2xl flex flex-col border-l border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{productCode}</span>
              {subPos && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">[{subPos}]</span>}
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{spec.type}</span>
            </div>
            <h3 id="product-edit-title" className="text-sm font-bold text-slate-900 mt-1">{productName}</h3>
            <p className="text-xs text-slate-500">Positie: <span className="font-semibold text-slate-700">{positionName}</span></p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer text-base" aria-label="Sluit drawer">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {spec.type === 'stairs' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Aantal treden</label>
                  <input ref={firstInputRef} type="number" min="1" max="50" value={spec.stepsCount} onChange={(e) => updateSpec({ stepsCount: Math.max(1, Number(e.target.value)) })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Breedte (mm)</label>
                  <input type="number" min="500" max="3000" value={spec.widthMm ?? 1000} onChange={(e) => updateSpec({ widthMm: Math.max(100, Number(e.target.value)) })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={spec.isOpen} onChange={(e) => updateSpec({ isOpen: e.target.checked })} className="rounded text-blue-600" /><span>Open (+{formatPriceCents(STAIRS_SURCHARGES.openTrapCents)}/tr)</span></label>
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={spec.hasRisers} onChange={(e) => updateSpec({ hasRisers: e.target.checked })} className="rounded text-blue-600" /><span>Stootborden (+{formatPriceCents(STAIRS_SURCHARGES.riserCents)}/tr)</span></label>
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={spec.ledLighting} onChange={(e) => updateSpec({ ledLighting: e.target.checked })} className="rounded text-blue-600" /><span>LED (+{formatPriceCents(STAIRS_SURCHARGES.ledLightingCents)}/tr)</span></label>
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={spec.bandering} onChange={(e) => updateSpec({ bandering: e.target.checked })} className="rounded text-blue-600" /><span>Bandering (+{formatPriceCents(STAIRS_SURCHARGES.banderingPerStepCents)}/tr)</span></label>
              </div>
            </div>
          ) : spec.type === 'floor_area' ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Oppervlakte (m²)</label>
                  <input ref={firstInputRef} type="number" step="0.01" min="0.1" value={spec.netAreaM2} onChange={(e) => updateSpec({ netAreaM2: Math.max(0.1, Number(e.target.value)) })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Snijverlies (%)</label>
                  <input type="number" min="0" max="30" value={spec.wastePercentage ?? 5} onChange={(e) => updateSpec({ wastePercentage: Math.max(0, Number(e.target.value)) })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                Bruto te bestellen: <strong className="text-slate-700">{(spec.netAreaM2 * (1 + (spec.wastePercentage ?? 5) / 100)).toFixed(2)} m²</strong>
              </div>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Breedte (mm)</label>
                  <input ref={firstInputRef} type="number" min="100" max="10000" value={'widthMm' in spec ? spec.widthMm : 1100} onChange={(e) => updateSpec({ widthMm: Number(e.target.value) })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hoogte (mm)</label>
                  <input type="number" min="100" max="10000" value={'heightMm' in spec ? spec.heightMm : 2240} onChange={(e) => updateSpec({ heightMm: Number(e.target.value) })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {!validation.valid && (
                <div className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800 border border-amber-200">⚠️ {validation.error}</div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Aantal</label>
              <input id="drawer-quantity-input" type="number" min="1" max="999" value={quantity} onChange={(e) => updateField('quantity', Math.max(1, Number(e.target.value)))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Eenheid</label>
              <select value={unit} onChange={(e) => updateField('unit', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="stuks">stuks</option>
                <option value="stel">stel</option>
                <option value="post">post</option>
                <option value="m1">m¹</option>
                <option value="m2">m²</option>
                <option value="treden">treden</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600"><span>Basistarief</span><span className="font-mono">{formatPriceCents(baseRateCents)}</span></div>
            <div className="flex justify-between text-xs text-slate-600"><span>Stukprijs ({spec.type})</span><span className="font-semibold text-slate-800">{formatPriceCents(unitCents)}</span></div>
            <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2"><span>Totaal (excl. BTW)</span><span className="text-blue-700 text-base">{formatPriceCents(totalCents)}</span></div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Montage / Maatwerk Opmerkingen</label>
            <textarea rows={2} value={notes} onChange={(e) => updateField('notes', e.target.value)} placeholder="Bijv. SmartCord rechts, extra stootborden..." className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="border-t border-slate-200 pt-3 flex items-center justify-between gap-2">
            {onDelete && (
              <button type="button" onClick={() => { onDelete(); onClose(); }} className="px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition border border-red-200">
                Verwijderen
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition border border-slate-300">Annuleren</button>
              <button type="submit" className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-xs">Opslaan & Toepassen</button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
};
