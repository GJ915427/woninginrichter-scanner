'use client';

import React from 'react';
import { SearchResultItem } from '@/types/product';
import { M3SearchBox } from './m3/M3SearchBox';

export interface LiveProductSearchProps {
  onSelectProduct: (product: SearchResultItem) => void;
  initialProduct?: SearchResultItem | null;
  className?: string;
}

/**
 * LiveProductSearch (Bridge naar M3SearchBox)
 * Behoudt backwards compatibility voor bestaande pagina's en configuratiewidgets
 * terwijl het 100% de nieuwe Google Material Design 3 zoekengine gebruikt.
 */
export function LiveProductSearch({
  onSelectProduct,
  initialProduct = null,
  className = ''
}: LiveProductSearchProps) {
  return (
    <div className={`w-full max-w-3xl ${className}`}>
      {/* Nieuwe M3 Zoekengine met 1-regelige layout & LocalStorage geschiedenis */}
      <M3SearchBox
        onSelectProduct={onSelectProduct}
        initialProduct={initialProduct}
        placeholder="Zoek op artikelcode, naam of leverancier (bijv. Luxaflex, Duette, A00052469)..."
      />

      {/* Systeeminformatie & Status Footer */}
      <div className="mt-2.5 px-3 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Live verbonden met LogicTrade Cloud REST API
        </span>
        <span className="hidden sm:inline text-slate-400 dark:text-slate-600">
          Typ meerdere zoektermen voor directe filtering
        </span>
      </div>
    </div>
  );
}
