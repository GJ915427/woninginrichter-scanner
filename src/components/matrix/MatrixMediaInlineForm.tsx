'use client';

import React, { useState } from 'react';
import { MatrixMediaInlineFormProps } from '../../types/matrix';

/**
 * MatrixMediaInlineForm (INV-GOV-22)
 * Invoerformulier voor werfnotities met Fitts' Law touch targets (min-h-[44px]).
 * 1 hook (useState), <70 regels.
 */
export function MatrixMediaInlineForm({ onSubmit }: MatrixMediaInlineFormProps) {
  const [noteText, setNoteText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    onSubmit('Werfnotitie', noteText.trim());
    setNoteText('');
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200 bg-slate-50 flex gap-2 items-center">
      <input
        type="text"
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="Voeg werfnotitie toe..."
        className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 min-h-[44px]"
      />
      <button
        type="submit"
        disabled={!noteText.trim()}
        aria-label="Notitie toevoegen"
        className="px-4 py-2 min-h-[44px] rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer shadow-xs flex items-center justify-center gap-1"
      >
        <span>+</span>
        <span className="hidden sm:inline">Toevoegen</span>
      </button>
    </form>
  );
}
