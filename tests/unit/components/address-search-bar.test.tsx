import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AddressSearchBar } from '@/components/map/AddressSearchBar';

describe('AddressSearchBar Component Unit Tests', () => {
  it('should render search input with placeholder', () => {
    const onSelect = vi.fn();
    const html = renderToStaticMarkup(<AddressSearchBar onSelectAddress={onSelect} />);

    expect(html).toContain('placeholder="Zoek een adres of postcode');
    expect(html).toContain('type="text"');
  });
});
