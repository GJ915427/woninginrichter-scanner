import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LegacyPlaceSidebar } from '@/components/legacy/LegacyPlaceSidebar';

describe('Address Autocomplete Suggestions Dropdown (PDOK Parity)', () => {
  const sampleSuggestions = [
    { id: 'adr-1', weergavenaam: 'Hennemettenstraat 1, 6247BD Gronsveld' },
    { id: 'adr-2', weergavenaam: 'Hennemettenstraat 2, 6247BD Gronsveld' },
    { id: 'adr-3', weergavenaam: 'Hennemettenstraat 3, 6247BD Gronsveld' },
  ];

  it('renders the suggestions dropdown container with matching items', () => {
    const html = renderToStaticMarkup(
      <LegacyPlaceSidebar
        buildingState={null}
        searchValue="henneme"
        suggestions={sampleSuggestions}
        isDropdownOpen={true}
        onSearchChange={() => {}}
        onSearchSubmit={() => {}}
        onSelectSuggestion={() => {}}
      />
    );

    expect(html).toContain('id="suggestionsDropdown"');
    expect(html).toContain('Hennemettenstraat 1, 6247BD Gronsveld');
    expect(html).toContain('Hennemettenstraat 2, 6247BD Gronsveld');
    expect(html).toContain('Hennemettenstraat 3, 6247BD Gronsveld');
  });

  it('hides the suggestions dropdown when isDropdownOpen is false', () => {
    const html = renderToStaticMarkup(
      <LegacyPlaceSidebar
        buildingState={null}
        searchValue="henneme"
        suggestions={sampleSuggestions}
        isDropdownOpen={false}
        onSearchChange={() => {}}
        onSearchSubmit={() => {}}
        onSelectSuggestion={() => {}}
      />
    );

    expect(html).not.toContain('id="suggestionsDropdown"');
  });
});
