import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LiveProductSearch } from '@/components/configurator/LiveProductSearch';
import { SearchResultItem } from '@/types/product';

describe('LiveProductSearch Component Unit Tests', () => {
  it('should render search input with placeholder that includes leverancier', () => {
    const onSelect = vi.fn();
    const html = renderToStaticMarkup(<LiveProductSearch onSelectProduct={onSelect} />);

    expect(html).toContain('placeholder="Zoek op artikelcode, naam of leverancier (bijv. Luxaflex, Duette, A00052469)..."');
    expect(html).toContain('type="text"');
    expect(html).toContain('aria-label="Artikel zoeken"');
  });

  it('should render the clean empty state with guidance when no product is active', () => {
    const onSelect = vi.fn();
    const html = renderToStaticMarkup(<LiveProductSearch onSelectProduct={onSelect} />);

    expect(html).toContain('Live verbonden met LogicTrade Cloud REST API');
  });

  it('should render selected product badge when a product is preselected', () => {
    const selectedProduct: SearchResultItem = {
      id: 219609,
      code: 'A00052469',
      name: 'Duette® shade',
      unit: 'stuks',
      salesPrice: 0,
      salesGroup: 'Raamdecoratie',
      supplierName: 'Luxaflex Nederland',
      supplierId: 82653,
      groups: ['Luxaflex'],
      vatCode: 'BTW Hoog'
    };

    const html = renderToStaticMarkup(
      <LiveProductSearch onSelectProduct={vi.fn()} initialProduct={selectedProduct} />
    );

    expect(html).toContain('A00052469');
    expect(html).toContain('Duette® shade');
    expect(html).toContain('Luxaflex Nederland');
  });
});
