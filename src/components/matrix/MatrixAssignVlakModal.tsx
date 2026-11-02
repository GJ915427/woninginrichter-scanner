'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface MatrixAssignVlakModalProps {
  isOpen: boolean;
  positionId: string;
  currentVlak?: string;
  onSave: (positionId: string, vlak: string) => void;
  onClose: () => void;
}

const PRESET_VLAKKEN = [
  'Wand Voorgevel',
  'Wand Achtergevel',
  'Wand Linkergevel',
  'Wand Rechtergevel',
  'Vloer',
  'Kozijn A',
  'Erker Voorgevel',
  'Achterpui',
];

export function MatrixAssignVlakModal({
  isOpen,
  positionId,
  currentVlak = '',
  onSave,
  onClose,
}: MatrixAssignVlakModalProps) {
  const [selectedVlak, setSelectedVlak] = useState<string>(currentVlak);
  const [customVlak, setCustomVlak] = useState<string>('');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedVlak(currentVlak);
    setCustomVlak('');
  }, [currentVlak, isOpen]);

  // Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalVlak = customVlak.trim() || selectedVlak.trim();
    if (finalVlak) {
      onSave(positionId, finalVlak);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-vlak-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏷️</span>
            <div>
              <h3 id="assign-vlak-title" className="text-base font-bold text-slate-900">
                Bouwkundig Vlak Toewijzen
              </h3>
              <p className="text-xs text-slate-500 font-mono">Positie: {positionId}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluit dialoogvenster"
            className="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
              Kies uit standaard vlakken
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_VLAKKEN.map((vlak) => {
                const isSelected = selectedVlak === vlak && !customVlak;
                return (
                  <button
                    key={vlak}
                    type="button"
                    onClick={() => {
                      setSelectedVlak(vlak);
                      setCustomVlak('');
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-medium border text-left transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-800 font-semibold shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <span>{vlak}</span>
                    {isSelected && <span className="text-blue-600 font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="custom-vlak-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2"
            >
              Of typ een aangepast vlak
            </label>
            <input
              id="custom-vlak-input"
              type="text"
              value={customVlak}
              onChange={(e) => setCustomVlak(e.target.value)}
              placeholder="bv. Zijgevel Tuinzijde..."
              className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 min-h-[44px] min-w-[80px] text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Annuleren
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 min-h-[44px] min-w-[100px] text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Opslaan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
