import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LiveProductSearch } from '@/components/configurator/LiveProductSearch';
import { DynamicConfiguratorForm } from '@/components/configurator/DynamicConfiguratorForm';
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

  it('should render modelPreset badge in selected product card when product has modelPreset', () => {
    const productWithPreset: SearchResultItem = {
      id: 219609,
      code: 'A00052469',
      name: 'Duette® shade',
      unit: 'stuks',
      salesPrice: 0,
      salesGroup: 'Raamdecoratie',
      supplierName: 'Luxaflex Nederland',
      supplierId: 82653,
      groups: ['Luxaflex'],
      vatCode: 'BTW Hoog',
      modelPreset: {
        code: 'AU20',
        name: 'Top-Down / Bottom-Up SmartCord®',
        productFamily: 'Duette / Plissé',
        vorm: ':20 Top Down / Bottom Up',
        bediening: 'SmartCord',
        surchargeEur: 37.19
      }
    };

    const html = renderToStaticMarkup(
      <LiveProductSearch onSelectProduct={vi.fn()} initialProduct={productWithPreset} />
    );

    expect(html).toContain('AU20');
    expect(html).toContain('Top-Down / Bottom-Up SmartCord®');
    // Wet 1: Prijzen en toeslagen zijn definitief verbannen uit de zoekbox
    expect(html).not.toContain('€ 37,19');
  });
});

describe('DynamicConfiguratorForm Component Unit Tests', () => {
  const baseProduct: SearchResultItem = {
    id: 219609,
    code: 'A00052469',
    name: 'Duette® shade',
    unit: 'stuks',
    salesPrice: 0,
    salesGroup: 'Raamdecoratie',
    supplierName: 'Luxaflex',
    supplierId: 82653,
    groups: ['Luxaflex', 'Duette® shade'],
    vatCode: 'BTW Hoog'
  };

  it('should render model configuration banner and meerprijs when product has modelPreset', () => {
    const productWithPreset: SearchResultItem = {
      ...baseProduct,
      modelPreset: {
        code: 'AU20',
        name: 'Top-Down / Bottom-Up SmartCord®',
        productFamily: 'Duette / Plissé',
        vorm: ':20 Top Down / Bottom Up',
        bediening: 'SmartCord',
        surchargeEur: 37.19
      }
    };

    const html = renderToStaticMarkup(<DynamicConfiguratorForm product={productWithPreset} />);

    expect(html).toContain('Modelconfiguratie: AU20');
    expect(html).toContain('Top-Down / Bottom-Up SmartCord®');
    expect(html).toContain('€ 37,19');
  });

  it('should render standard layout without model configuration banner when product lacks modelPreset', () => {
    const html = renderToStaticMarkup(<DynamicConfiguratorForm product={baseProduct} />);

    expect(html).not.toContain('Modelconfiguratie:');
  });

  it('should render suggestions in empty search state structure', () => {
    const onSelect = vi.fn();
    const html = renderToStaticMarkup(<LiveProductSearch onSelectProduct={onSelect} />);

    // De component heeft de structuur voor zoeksuggesties ingebouwd
    expect(html).toContain('Live verbonden met LogicTrade Cloud REST API');
  });
});
