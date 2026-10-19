'use client';

import React, { useState, useEffect, useRef, useTransition, useMemo } from 'react';
import { SearchResultItem } from '@/types/product';
import { SearchHistoryItem, M3SearchBoxProps } from '@/types/configurator';

const STORAGE_KEY = 'lt_search_history_v1';
const MAX_HISTORY_ITEMS = 5;

/**
 * Veilig escapen van speciale tekens voor RegExp constructie.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tokenized meervoudige markering van zoektermen in tekst conform M3 standaard.
 * Splitst zoekquery op witruimte, sorteert op dalende lengte, en markeert alle matches vet.
 */
export function renderMultiTermHighlight(text: string, query: string): React.ReactNode {
  if (!text) return '';
  if (!query || !query.trim()) return text;

  const tokens = Array.from(
    new Set(
      query
        .trim()
        .split(/\s+/)
        .filter(Boolean)
    )
  ).sort((a, b) => b.length - a.length);

  if (tokens.length === 0) return text;

  try {
    const pattern = new RegExp(`(${tokens.map(escapeRegex).join('|')})`, 'gi');
    const parts = text.split(pattern);

    return parts.map((part, index) => {
      const isMatch = tokens.some(t => t.toLowerCase() === part.toLowerCase());
      if (isMatch) {
        return (
          <strong
            key={index}
            className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded px-0.5"
          >
            {part}
          </strong>
        );
      }
      return part;
    });
  } catch {
    return text;
  }
}

export interface ExtendedM3SearchBoxProps extends M3SearchBoxProps {
  testResults?: SearchResultItem[];
  testHistory?: SearchHistoryItem[];
  forceDropdownOpen?: boolean;
  currentQuery?: string;
}

export const M3SearchBox: React.FC<ExtendedM3SearchBoxProps> = ({
  onSelectProduct,
  initialProduct = null,
  placeholder = 'Typ een artikelcode, omschrijving of merk (bijv. Luxaflex, Vadain, A00052469)...',
  className = '',
  testResults,
  testHistory,
  forceDropdownOpen = false,
  currentQuery: controlledQuery
}) => {
  const [query, setQuery] = useState(controlledQuery !== undefined ? controlledQuery : '');
  const [results, setResults] = useState<SearchResultItem[]>(testResults || []);

  // Stabiele client-side sortering & zero-stale supplier filtering
  const displayResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const queryTokens = trimmed.split(/\s+/).filter(t => t.length >= 3);
    const KNOWN_NON_SUPPLIERS = new Set([
      'duette', 'duettes', 'shades', 'shade', 'jaloezie', 'jaloezieen',
      'rolgordijn', 'rolgordijnen', 'gordijn', 'gordijnen', 'plisse',
      'tapijt', 'tapijten', 'vloer', 'vloerbedekking', 'pvc', 'vinyl',
      'laminaat', 'parket', 'raam', 'raamdecoratie', 'smartcord',
      'powerview', 'trufit', 'klemsteun', 'klemsteunen', 'antraciet',
      'au20', 'ab21', 'db42', 'vs2'
    ]);

    let filtered = results;
    // Client-side guard tegen stale resultaten tijdens in-flight netwerkverzoeken:
    // Als een ingetypte lettercombinatie matcht op een leverancier, filter concurrerende leveranciers direct uit
    if (queryTokens.length > 0 && results.length > 0) {
      for (const token of queryTokens) {
        if (KNOWN_NON_SUPPLIERS.has(token)) continue;
        const matchingSuppliers = new Set(
          results
            .map(r => r.supplierName)
            .filter((s): s is string => Boolean(s) && s.toLowerCase().includes(token))
        );
        if (matchingSuppliers.size > 0 && matchingSuppliers.size < new Set(results.map(r => r.supplierName)).size) {
          filtered = filtered.filter(r => r.supplierName && matchingSuppliers.has(r.supplierName));
          break;
        }
      }
    }

    return [...filtered].sort((a, b) => {
      const aDisc = Boolean(a.isDiscontinued);
      const bDisc = Boolean(b.isDiscontinued);
      if (aDisc !== bDisc) return aDisc ? 1 : -1;
      return 0; // Behoudt server-side rangschikking binnen dezelfde groep
    });
  }, [results, query]);
  const [history, setHistory] = useState<SearchHistoryItem[]>(testHistory || []);
  const [isOpen, setIsOpen] = useState(forceDropdownOpen);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedProduct, setSelectedProduct] = useState<SearchResultItem | null>(initialProduct);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchCacheRef = useRef<Map<string, SearchResultItem[]>>(new Map());
  const requestIdRef = useRef(0);

  // Synchroniseer controlled query / test state
  useEffect(() => {
    if (controlledQuery !== undefined) {
      setQuery(controlledQuery);
    }
  }, [controlledQuery]);

  useEffect(() => {
    if (testResults) {
      setResults(testResults);
    }
  }, [testResults]);

  useEffect(() => {
    if (testHistory) {
      setHistory(testHistory);
    }
  }, [testHistory]);

  useEffect(() => {
    if (forceDropdownOpen) {
      setIsOpen(true);
    }
  }, [forceDropdownOpen]);

  // Laad geschiedenis veilig client-side (SSR hydration guard)
  useEffect(() => {
    if (typeof window === 'undefined' || testHistory) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, MAX_HISTORY_ITEMS));
        }
      }
    } catch {
      // Graceful fallback bij private browsing of quota restricties
    }
  }, [testHistory]);

  // Sla zoekterm op in LocalStorage
  const saveSearchToHistory = (searchTerm: string, product?: SearchResultItem) => {
    if (typeof window === 'undefined') return;
    const trimmed = searchTerm.trim();
    if (!trimmed) return;

    try {
      const newItem: SearchHistoryItem = {
        query: trimmed,
        timestamp: Date.now(),
        selectedCode: product?.code,
        selectedName: product?.name
      };

      const updated = [
        newItem,
        ...history.filter(h => h.query.toLowerCase() !== trimmed.toLowerCase())
      ].slice(0, MAX_HISTORY_ITEMS);

      setHistory(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // QuotaExceededError geruisloos negeren
    }
  };

  // Wis zoekgeschiedenis
  const clearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory([]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Safe catch
      }
    }
  };

  // Live zoekopdracht via BFF route met 0.0ms SWR caching en Zero-Flash debounce
  useEffect(() => {
    if (testResults !== undefined) return;
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    // 0.0ms SWR Cache Hit Check: onmiddellijke weergave zonder flikkerende spinner
    if (searchCacheRef.current.has(trimmed)) {
      const cached = searchCacheRef.current.get(trimmed)!;
      setResults(cached);
      setIsLoading(false);
      setIsOpen(true);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    const controller = new AbortController();

    // Zero-Flash Debounce: Alleen binnen de timeout isLoading aanzetten
    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(trimmed)}&limit=20`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          const items = data.items || [];
          searchCacheRef.current.set(trimmed, items);

          // Corner 2 Sequence Guard: Latere trage requests overschrijven snellere responses niet
          if (currentRequestId === requestIdRef.current) {
            startTransition(() => {
              setResults(items);
              setIsOpen(true);
            });
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') return;
        console.error('[M3SearchBox] Zoekfout:', err);
      } finally {
        if (!controller.signal.aborted && currentRequestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, testResults]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (forceDropdownOpen) return;
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [forceDropdownOpen]);

  const handleSelect = (product: SearchResultItem) => {
    setSelectedProduct(product);
    onSelectProduct(product);
    saveSearchToHistory(query || product.name, product);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    const itemsCount = displayResults.length > 0 ? displayResults.length : history.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < itemsCount - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : itemsCount - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (displayResults.length > 0) {
        const target = (selectedIndex >= 0 && selectedIndex < displayResults.length)
          ? displayResults[selectedIndex]
          : displayResults[0];
        handleSelect(target);
      } else if (displayResults.length === 0 && history.length > 0 && selectedIndex >= 0 && selectedIndex < history.length) {
        setQuery(history[selectedIndex].query);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Geselecteerd Artikel Compacte M3 Kaart */}
      {selectedProduct && (
        <div className="mb-3 p-3 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
              {selectedProduct.supplierName}
            </span>
            <span className="text-emerald-400 dark:text-emerald-600">—</span>
            <span className="font-mono font-medium text-emerald-900 dark:text-emerald-100">
              {selectedProduct.code}
            </span>
            <span className="text-slate-800 dark:text-slate-200">
              {selectedProduct.name}
            </span>
            {selectedProduct.modelPreset && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                <span className="font-bold">{selectedProduct.modelPreset.code}</span>
                <span>{selectedProduct.modelPreset.name}</span>
              </span>
            )}
            {selectedProduct.featureBadges && selectedProduct.featureBadges.map((badge) => (
              <span
                key={badge}
                data-testid={`preview-badge-${badge.toLowerCase()}`}
                className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800 shrink-0"
              >
                Voorgeselecteerd: {badge}
              </span>
            ))}
            {selectedProduct.isDiscontinued && (
              <span
                data-testid="preview-badge-discontinued"
                className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 shrink-0"
              >
                Uitlopende collectie
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedProduct(null);
              inputRef.current?.focus();
            }}
            className="text-xs text-emerald-700 dark:text-emerald-300 hover:underline shrink-0 font-medium"
          >
            Wijzig artikel
          </button>
        </div>
      )}

      {/* M3 Zoekinvoerveld */}
      <div className="relative flex items-center">
        <div className="absolute left-4 pointer-events-none text-slate-400 dark:text-slate-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen && (displayResults.length > 0 || history.length > 0)}
          aria-controls="m3-search-listbox"
          aria-activedescendant={selectedIndex >= 0 ? `m3-opt-${selectedIndex}` : undefined}
          aria-label="Artikel zoeken"
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full pl-11 pr-12 py-3 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm"
        />

        {query.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center rounded-full transition-colors"
            aria-label="Zoekopdracht wissen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown Menu (Resultaten of Zoekhistorie) */}
      {(isOpen || forceDropdownOpen) && (
        <div
          id="m3-search-listbox"
          role="listbox"
          aria-label="Gevonden artikelen"
          className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-h-96 overflow-y-auto"
        >
          {/* Status: Resultatenlijst */}
          {displayResults.length > 0 && (
            <div className="py-1">
              {displayResults.map((item, idx) => (
                <div
                  key={item.id || idx}
                  id={`m3-opt-${idx}`}
                  role="option"
                  aria-selected={selectedIndex === idx}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex flex-wrap md:flex-nowrap items-center justify-between gap-2 px-4 py-3 min-h-[48px] cursor-pointer text-sm border-b border-slate-100 dark:border-slate-800/50 last:border-0 transition-colors ${
                    selectedIndex === idx
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-[200px] flex-1 truncate">
                    {/* 1. Leverancier direct voorop zonder label */}
                    <span className="font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                      {renderMultiTermHighlight(item.supplierName || 'Onbekend', query)}
                    </span>

                    {/* 2. Scheidingsstreepje */}
                    <span className="text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true">—</span>

                    {/* 3. Artikelcode & Omschrijving */}
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-400 shrink-0">
                      {renderMultiTermHighlight(item.code, query)}
                    </span>
                    <span className="truncate">
                      {renderMultiTermHighlight(item.name, query)}
                    </span>
                  </div>

                  {/* 4. Badges container (ModelPreset + FeatureBadges + Uitlopende collectie) */}
                  <div className="ml-auto flex items-center justify-end gap-1.5 flex-wrap">
                    {item.modelPreset && (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                        {item.modelPreset.code}
                      </span>
                    )}
                    {item.featureBadges && item.featureBadges.map((badge) => (
                      <span
                        key={badge}
                        data-testid={`badge-${badge.toLowerCase()}`}
                        className="px-2 py-0.5 text-xs font-semibold rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 shrink-0"
                      >
                        Voorgeselecteerd: {badge}
                      </span>
                    ))}
                    {item.isDiscontinued && (
                      <span
                        data-testid="badge-discontinued"
                        className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 shrink-0"
                      >
                        Uitlopende collectie
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Status: Leeg Zoekveld -> Zoekhistorie tonen */}
          {displayResults.length === 0 && query.trim().length === 0 && history.length > 0 && (
            <div className="py-2">
              <div className="flex items-center justify-between px-4 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <span>Recente zoekopdrachten</span>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-xs normal-case text-slate-400 hover:text-red-500 dark:hover:text-red-400 font-normal transition-colors"
                >
                  Geschiedenis wissen
                </button>
              </div>

              {history.map((hist, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setQuery(hist.query);
                    inputRef.current?.focus();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center gap-3 px-4 py-2 text-sm cursor-pointer transition-colors ${
                    selectedIndex === idx
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="truncate">{hist.query}</span>
                  {hist.selectedCode && (
                    <span className="ml-auto text-xs text-slate-400 font-mono shrink-0">
                      {hist.selectedCode}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Status: Geen resultaten gevonden */}
          {displayResults.length === 0 && query.trim().length >= 2 && !isLoading && (
            <div role="status" aria-live="polite" className="p-6 text-center text-sm text-slate-600 dark:text-slate-400">
              Geen artikelen gevonden voor &ldquo;<span className="font-semibold text-slate-800 dark:text-slate-200">{query}</span>&rdquo;
            </div>
          )}

          {/* Status: Aan het laden */}
          {isLoading && (
            <div role="status" aria-live="polite" className="p-4 text-center text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Zoeken in LogicTrade catalogus...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
