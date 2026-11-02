'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CellPriceData, PricingMode } from '../../types/matrix';
import {
  calculateDimensionPriceCents,
  formatPriceCents,
  validateDimensions,
} from '../../utils/matrix-pricing';

export interface MatrixProductEditDrawerProps {
  isOpen: boolean;
  productName: string;
  productCode: string;
  positionName: string;
  subPos?: string;
  initialData?: CellPriceData;
  onClose: () => void;
  onSave: (data: Partial<CellPriceData>) => void;
  onDelete?: () => void;
}

interface DrawerFormData {
  widthMm: number;
  heightMm: number;
  quantity: number;
  unit: string;
  pricingMode: PricingMode;
  basePriceCents: number;
  notes: string;
}

function getInitialFormData(initialData?: CellPriceData): DrawerFormData {
  return {
    widthMm: initialData?.breedte_mm ?? 1100,
    heightMm: initialData?.hoogte_mm ?? 2240,
    quantity: initialData?.quantity ?? 1,
    unit: initialData?.unit ?? 'stuks',
    pricingMode: initialData?.pricingMode ?? 'unit',
    basePriceCents: initialData?.unitPriceCents ?? 15000,
    notes: initialData?.note ?? initialData?.opmerking ?? '',
  };
}

/**
 * Slide-over drawer voor celbewerking conform INV-GOV-22 (<=250 regels, <=4 hooks).
 * Geconsolideerde form-state met deterministische CPQ dimensionale calculatie.
 */
export const MatrixProductEditDrawer: React.FC<MatrixProductEditDrawerProps> = ({
  isOpen,
  productName,
  productCode,
  positionName,
  subPos,
  initialData,
  onClose,
  onSave,
  onDelete,
}) => {
  const [formData, setFormData] = useState<DrawerFormData>(() => getInitialFormData(initialData));
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialFormData(initialData));
      setTimeout(() => firstInputRef.current?.focus(), 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, initialData, onClose]);

  if (!isOpen) return null;

  const { widthMm, heightMm, quantity, unit, pricingMode, basePriceCents, notes } = formData;
  const updateField = <K extends keyof DrawerFormData>(key: K, val: DrawerFormData[K]) =>
    setFormData((prev) => ({ ...prev, [key]: val }));

  const unitCents = calculateDimensionPriceCents(widthMm, heightMm, basePriceCents, pricingMode);
  const totalCents = quantity * unitCents;
  const validation = validateDimensions(widthMm, heightMm);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      breedte_mm: widthMm,
      hoogte_mm: heightMm,
      dim: `${widthMm} × ${heightMm}`,
      afmetingen: `${widthMm} × ${heightMm}`,
      quantity,
      unit,
      pricingMode,
      unitPriceCents: unitCents,
      totalPriceCents: totalCents,
      note: notes,
      opmerking: notes,
      isCalculated: true,
    });
    onClose();
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in" aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="product-edit-title" className="fixed inset-y-0 right-0 z-50 w-[420px] max-w-full bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{productCode}</span>
              {subPos && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">[{subPos}]</span>}
            </div>
            <h3 id="product-edit-title" className="text-sm font-bold text-slate-900 mt-1">{productName}</h3>
            <p className="text-xs text-slate-500">Positie: <span className="font-semibold text-slate-700">{positionName}</span></p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer text-base" aria-label="Sluit drawer">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Breedte (mm)</label>
              <input ref={firstInputRef} type="number" min="100" max="10000" value={widthMm} onChange={(e) => updateField('widthMm', Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Hoogte (mm)</label>
              <input type="number" min="100" max="10000" value={heightMm} onChange={(e) => updateField('heightMm', Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {!validation.valid && (
            <div className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">⚠️ {validation.error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Aantal</label>
              <input type="number" min="1" max="999" value={quantity} onChange={(e) => updateField('quantity', Math.max(1, Number(e.target.value)))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Eenheid</label>
              <select value={unit} onChange={(e) => updateField('unit', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="stuks">stuks</option>
                <option value="stel">stel</option>
                <option value="post">post</option>
                <option value="m1">m¹</option>
                <option value="m2">m²</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Prijscalculatie Modus (CPQ)</label>
            <select value={pricingMode} onChange={(e) => updateField('pricingMode', e.target.value as PricingMode)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="unit">Vast tarief per stuk</option>
              <option value="m2">Oppervlakte (m²)</option>
              <option value="m1_width">Lopende meter breedte (m¹)</option>
              <option value="m1_height">Lopende meter hoogte (m¹)</option>
            </select>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Stukprijs (berekend)</span>
              <span className="font-semibold text-slate-800">{formatPriceCents(unitCents)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
              <span>Totaal (excl. BTW)</span>
              <span className="text-blue-700 text-base">{formatPriceCents(totalCents)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Montage / Maatwerk Opmerkingen</label>
            <textarea rows={3} value={notes} onChange={(e) => updateField('notes', e.target.value)} placeholder="Bijv. SmartCord rechts, extra wandsteun vereist..." className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="border-t border-slate-200 pt-4 flex items-center justify-between gap-2">
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
