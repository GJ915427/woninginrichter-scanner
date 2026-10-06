'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PdokLocatieserverClient, AddressSuggestion } from '@/data/pdok/pdok-locatieserver-client';

export type { AddressSuggestion };

export interface AddressSearchResult {
  id: string;
  weergavenaam: string;
  straatnaam: string;
  huisnummer: number;
  huisletter?: string;
  toevoeging?: string;
  postcode: string;
  woonplaatsnaam: string;
  centroideRd: { x: number; y: number };
  centroideWgs84: { lat: number; lng: number };
  adresseerbaarObjectId?: string;
  pandIds: string[];
}

export interface AddressSearchBarProps {
  onSelectAddress: (result: AddressSearchResult | AddressSuggestion) => void;
  initialValue?: string;
  className?: string;
}

export function AddressSearchBar({ onSelectAddress, initialValue = '' }: AddressSearchBarProps) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const clientRef = useRef(new PdokLocatieserverClient());
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 3) {
      debounceRef.current = setTimeout(() => {
        setSuggestions([]);
        setIsOpen(false);
      }, 0);
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await clientRef.current.suggest(query);
        setSuggestions(results);
        setIsOpen(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (suggestion: AddressSuggestion) => {
    setQuery(suggestion.weergavenaam);
    setIsOpen(false);
    setIsLoading(true);

    try {
      const details = await clientRef.current.lookup(suggestion.id);
      if (details) {
        onSelectAddress({
          id: details.id || suggestion.id,
          weergavenaam: details.weergavenaam || suggestion.weergavenaam,
          straatnaam: details.straatnaam || '',
          huisnummer: details.huisnummer || 0,
          huisletter: details.huisletter,
          toevoeging: details.huisnummertoevoeging,
          postcode: details.postcode || '',
          woonplaatsnaam: details.woonplaatsnaam || '',
          centroideRd: details.centroideRd || { x: 0, y: 0 },
          centroideWgs84: details.centroideWgs84 || { lat: 0, lng: 0 },
          adresseerbaarObjectId: details.adresseerbaarObjectId,
          pandIds: details.pandIds || [],
        });
      } else {
        onSelectAddress(suggestion);
      }
    } catch (err) {
      console.error('Fout bij ophalen adresdetails:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative flex items-center bg-white rounded-full shadow-md border border-slate-200 hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
        <div className="pl-4 pr-2 text-slate-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek een adres of postcode (bijv. Rijksweg 153b Gronsveld)..."
          className="w-full py-2.5 pr-10 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400 font-medium"
        />

        {isLoading ? (
          <div className="pr-4 text-slate-400 animate-spin">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : query ? (
          <button
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setIsOpen(false);
            }}
            className="pr-4 text-slate-400 hover:text-slate-600"
            title="Wissen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 divide-y divide-slate-50 max-h-72 overflow-y-auto">
          {suggestions.map((item) => (
            <li
              key={item.id}
              onClick={() => handleSelect(item)}
              className="px-4 py-3 text-sm text-slate-700 hover:bg-blue-50/70 hover:text-blue-900 cursor-pointer flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>{item.weergavenaam}</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{item.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
