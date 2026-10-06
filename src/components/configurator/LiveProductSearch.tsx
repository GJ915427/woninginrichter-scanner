'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SearchResultItem, SearchApiResponse } from '@/types/product';

export interface LiveProductSearchProps {
  onSelectProduct: (product: SearchResultItem) => void;
  initialProduct?: SearchResultItem | null;
  className?: string;
}

export function LiveProductSearch({
  onSelectProduct,
  initialProduct = null,
  className = ''
}: LiveProductSearchProps) {
  const [query, setQuery] = useState(initialProduct ? `${initialProduct.name} (${initialProduct.code})` : '');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [pagination, setPagination] = useState<{ totalResults: number; page: number; totalPages: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<SearchResultItem | null>(initialProduct);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Outside click listener om de dropdown netjes te sluiten
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setQuery(rawVal);

    const clean = rawVal.trim();
    if (clean.length < 2) {
      setResults([]);
      setPagination(null);
      setIsOpen(false);
      setError(null);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      return;
    }

    // Debounce van 300ms conform specificatie
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      // Vorige netwerkaanvraag afbreken
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsLoading(true);

      try {
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(clean)}`, {
          signal: controller.signal
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Serverfout (${response.status})`);
        }

        const data: SearchApiResponse = await response.json();
        setResults(data.items || []);
        if (data.pagination) {
          setPagination(data.pagination);
        } else {
          setPagination({ totalResults: data.count || 0, page: 1, totalPages: 1 });
        }
        setIsOpen(true);
      } catch (err: any) {
        // Red Team Audit Invariant: AbortError stilzwijgend negeren bij snel doortypen
        if (err.name === 'AbortError') {
          return;
        }
        setError(err.message || 'Kon LogicTrade stambestand niet raadplegen.');
        setResults([]);
        setPagination(null);
        setIsOpen(true);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  };

  const handleSelect = (item: SearchResultItem) => {
    setSelectedProduct(item);
    setQuery(`${item.name} (${item.code})`);
    setIsOpen(false);
    setError(null);
    onSelectProduct(item);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setPagination(null);
    setSelectedProduct(null);
    setIsOpen(false);
    setError(null);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
  };

  return (
    <div ref={containerRef} className={`relative w-full max-w-3xl ${className}`}>
      {/* Zoekbalk Input Box */}
      <div className="relative flex items-center">
        <div className="absolute left-4 text-slate-400 pointer-events-none flex items-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder="Zoek op artikelcode, naam of leverancier (bijv. Luxaflex, Duette, A00052469)..."
          aria-label="Artikel zoeken"
          autoComplete="off"
          className="w-full pl-12 pr-12 py-3.5 bg-white text-slate-800 rounded-xl border border-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition font-medium"
        />

        {/* Loading Spinner / Clear Knop */}
        <div className="absolute right-4 flex items-center space-x-2">
          {isLoading && (
            <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}

          {query.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 text-lg p-1 rounded-md transition"
              title="Zoekopdracht wissen"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Status & Badge als product gekozen is */}
      {selectedProduct && (
        <div className="mt-2 flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
          <div className="flex items-center space-x-2">
            <span className="font-semibold px-2 py-0.5 bg-blue-600 text-white rounded">
              {selectedProduct.code}
            </span>
            <span className="font-bold">{selectedProduct.name}</span>
            <span className="text-blue-700">| Leverancier: {selectedProduct.supplierName}</span>
          </div>
          <span className="text-slate-500 font-medium">Groep: {selectedProduct.salesGroup}</span>
        </div>
      )}

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden max-h-96 flex flex-col">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Resultaten uit LogicTrade Cloud Stambestand</span>
            <span>
              {pagination && pagination.totalResults > results.length
                ? `${results.length} van ${pagination.totalResults} gevonden`
                : `${results.length} gevonden`}
            </span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-100">
            {error && (
              <div className="p-4 text-xs text-rose-600 bg-rose-50 flex items-center space-x-2">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {!error && results.length === 0 && !isLoading && (
              <div className="p-6 text-center text-sm text-slate-500">
                Geen artikelen gevonden voor &lsquo;<strong className="text-slate-700">{query}</strong>&rsquo; in het stambestand.
              </div>
            )}

            {!error &&
              results.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="p-3.5 hover:bg-blue-50/70 cursor-pointer transition flex items-center justify-between group"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 group-hover:bg-blue-100 group-hover:text-blue-800 group-hover:border-blue-300 transition">
                        {item.code}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-900 transition">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center space-x-3">
                      <span>Leverancier: <strong className="text-slate-700">{item.supplierName}</strong></span>
                      {item.groups.length > 0 && (
                        <span>Groep: <span className="text-slate-600">{item.groups.join(' › ')}</span></span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-4">
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {item.salesGroup}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Lege toestand infotekst */}
      {!selectedProduct && (
        <div className="mt-2 text-xs text-slate-400 flex items-center space-x-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Live verbonden met LogicTrade Cloud REST API (100.719 artikelen)</span>
        </div>
      )}
    </div>
  );
}
