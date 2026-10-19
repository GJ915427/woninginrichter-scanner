import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { M3SearchBox, renderMultiTermHighlight } from '@/components/configurator/m3/M3SearchBox';
import { SearchResultItem } from '@/types/product';

describe('M3SearchBox Component & Highlighting Unit Tests', () => {
  const mockDuette: SearchResultItem = {
    id: 219609,
    code: 'A00052469',
    name: 'Duette® shade',
    unit: 'stuks',
    salesPrice: 861.02,
    salesGroup: 'Raamdecoratie',
    supplierName: 'Luxaflex Nederland',
    supplierId: 82653,
    groups: ['Luxaflex', 'Duette® shade'],
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

  const mockCurtain: SearchResultItem = {
    id: 161126,
    code: '0103960000',
    name: 'Gordijnstoffen VLIET 00',
    unit: 'meter',
    salesPrice: 919.25,
    salesGroup: 'Gordijnstoffen',
    supplierName: 'LOFT79',
    supplierId: 82110,
    groups: ['Gordijnstoffen'],
    vatCode: 'BTW Hoog'
  };

  describe('renderMultiTermHighlight', () => {
    it('should boldly highlight multiple separate terms in text', () => {
      const text = 'Luxaflex Nederland Duette® shade AU20';
      const query = 'duette au20';
      const rendered = renderToStaticMarkup(renderMultiTermHighlight(text, query));

      // Zowel "Duette" als "AU20" moeten vetgedrukt zijn gemarkeerd
      expect(rendered).toContain('<strong class="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded px-0.5">Duette</strong>');
      expect(rendered).toContain('<strong class="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded px-0.5">AU20</strong>');
    });

    it('should safely escape regex metacharacters in queries', () => {
      const text = 'Duette (25mm) + SmartCord® [AU20]';
      const query = '(25mm) + AU20';
      
      expect(() => {
        renderToStaticMarkup(renderMultiTermHighlight(text, query));
      }).not.toThrow();

      const rendered = renderToStaticMarkup(renderMultiTermHighlight(text, query));
      expect(rendered).toContain('<strong class="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded px-0.5">(25mm)</strong>');
      expect(rendered).toContain('<strong class="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded px-0.5">+</strong>');
    });

    it('should return raw text unhighlighted when query is empty or whitespace', () => {
      const text = 'Luxaflex Nederland';
      const rendered = renderToStaticMarkup(renderMultiTermHighlight(text, '   '));
      expect(rendered).toBe('Luxaflex Nederland');
    });
  });

  describe('1-Regelig Resultaat Layout', () => {
    it('should render 1-line layout starting with supplier and no database ID or Groep label', () => {
      const onSelect = vi.fn();
      const html = renderToStaticMarkup(
        <M3SearchBox 
          onSelectProduct={onSelect} 
          testResults={[mockDuette, mockCurtain]}
          forceDropdownOpen={true}
          currentQuery="duette"
        />
      );

      // Moet beginnen met leverancier direct zonder "Leverancier:" label
      expect(html).toContain('Luxaflex Nederland');
      expect(html).not.toContain('Leverancier:');
      
      // Moet géén database ID tonen (#219609)
      expect(html).not.toContain('#219609');
      expect(html).not.toContain('#161126');

      // Moet géén "Groep:" label tonen
      expect(html).not.toContain('Groep:');

      // Moet artikelcode en omschrijving tonen (Duette is gemarkeerd)
      expect(html).toContain('A00052469');
      expect(html).toContain('Duette');
      expect(html).toContain('shade');
      expect(html).toContain('AU20');

      // Tweede artikel
      expect(html).toContain('LOFT79');
      expect(html).toContain('0103960000');
      expect(html).toContain('Gordijnstoffen VLIET 00');
    });
  });

  describe('Zoekhistorie & M3 Input Styling', () => {
    it('should render M3 search input with rounded-full container and search icon', () => {
      const html = renderToStaticMarkup(<M3SearchBox onSelectProduct={vi.fn()} />);

      expect(html).toContain('type="text"');
      expect(html).toContain('aria-label="Artikel zoeken"');
      expect(html).toContain('rounded-full');
    });

    it('should render selected product card with 1-line compact preview when initialProduct is provided', () => {
      const html = renderToStaticMarkup(
        <M3SearchBox onSelectProduct={vi.fn()} initialProduct={mockDuette} />
      );

      expect(html).toContain('Luxaflex Nederland');
      expect(html).toContain('A00052469');
      expect(html).toContain('Duette® shade');
      expect(html).toContain('AU20');
      expect(html).not.toContain('Leverancier:');
      expect(html).not.toContain('#219609');
    });

    it('should render search history items when dropdown is opened with empty query and history exists', () => {
      const mockHistory = [
        { query: 'luxaflex au20', timestamp: 1700000000 },
        { query: '0103960000', timestamp: 1699999000 }
      ];

      const html = renderToStaticMarkup(
        <M3SearchBox 
          onSelectProduct={vi.fn()} 
          testHistory={mockHistory}
          forceDropdownOpen={true}
          currentQuery=""
        />
      );

      expect(html).toContain('Recente zoekopdrachten');
      expect(html).toContain('luxaflex au20');
      expect(html).toContain('0103960000');
      expect(html).toContain('Geschiedenis wissen');
    });
  });

  describe('Uitlopende Collecties Sortering & M3 Badges', () => {
    const mockDiscontinuedDuette: SearchResultItem = {
      id: 219610,
      code: 'A00042592',
      name: 'Duette shade uitlopend',
      unit: 'stuks',
      salesPrice: 750.00,
      salesGroup: 'Raamdecoratie',
      supplierName: 'Luxaflex Nederland',
      supplierId: 82653,
      groups: ['Luxaflex', 'Duette shade'],
      vatCode: 'BTW Hoog',
      isDiscontinued: true
    };

    const mockDiscontinuedWithPreset: SearchResultItem = {
      id: 219611,
      code: 'A00042582',
      name: 'Duette shade SmartCord oud',
      unit: 'stuks',
      salesPrice: 780.00,
      salesGroup: 'Raamdecoratie',
      supplierName: 'Luxaflex Nederland',
      supplierId: 82653,
      groups: ['Luxaflex', 'Duette shade'],
      vatCode: 'BTW Hoog',
      isDiscontinued: true,
      modelPreset: {
        code: 'AU10',
        name: 'SmartCord Standaard',
        productFamily: 'Duette / Plissé',
        vorm: ':10 Standaard',
        bediening: 'SmartCord',
        surchargeEur: 0
      }
    };

    it('should sort active items before discontinued items in displayResults rendering', () => {
      // Bied de artikelen aan met het uitlopende artikel eerst
      const unorderedResults = [mockDiscontinuedDuette, mockDuette];

      const html = renderToStaticMarkup(
        <M3SearchBox
          onSelectProduct={vi.fn()}
          testResults={unorderedResults}
          forceDropdownOpen={true}
          currentQuery="duette"
        />
      );

      // Het actieve artikel (A00052469) moet vóór het uitlopende artikel (A00042592) in de HTML verschijnen
      const activeIndex = html.indexOf('A00052469');
      const discontinuedIndex = html.indexOf('A00042592');

      expect(activeIndex).toBeGreaterThan(-1);
      expect(discontinuedIndex).toBeGreaterThan(-1);
      expect(activeIndex).toBeLessThan(discontinuedIndex);
    });

    it('should render amber badge for discontinued items in search results list', () => {
      const html = renderToStaticMarkup(
        <M3SearchBox
          onSelectProduct={vi.fn()}
          testResults={[mockDiscontinuedDuette]}
          forceDropdownOpen={true}
          currentQuery="duette"
        />
      );

      expect(html).toContain('data-testid="badge-discontinued"');
      expect(html).toContain('Uitlopende collectie');
      expect(html).toContain('bg-amber-500/15');
      expect(html).toContain('text-amber-700');
    });

    it('should render both modelPreset badge and discontinued badge when item has both', () => {
      const html = renderToStaticMarkup(
        <M3SearchBox
          onSelectProduct={vi.fn()}
          testResults={[mockDiscontinuedWithPreset]}
          forceDropdownOpen={true}
          currentQuery="duette"
        />
      );

      expect(html).toContain('AU10');
      expect(html).toContain('data-testid="badge-discontinued"');
      expect(html).toContain('Uitlopende collectie');
    });

    it('should render amber badge in selected product preview card when discontinued product is selected', () => {
      const html = renderToStaticMarkup(
        <M3SearchBox
          onSelectProduct={vi.fn()}
          initialProduct={mockDiscontinuedDuette}
        />
      );

      expect(html).toContain('data-testid="preview-badge-discontinued"');
      expect(html).toContain('Uitlopende collectie');
      expect(html).toContain('A00042592');
    });

    it('should render compact feature badges without prices in dropdown result row', () => {
      const mockProductWithFeatures: SearchResultItem = {
        id: 219609,
        code: 'A00052469',
        name: 'Duette shade 25 mm',
        unit: 'stuks',
        salesPrice: 229.0,
        salesGroup: 'Raamdecoratie',
        supplierName: 'Luxaflex',
        supplierId: 1,
        groups: ['Duette'],
        vatCode: 'BTW21',
        featureBadges: ['TruFit', 'Architella'],
        preconfiguration: {
          montage: 'MONTAGE_TRUFIT',
          bediening: 'HANDGREEP',
          stofFilter: 'Architella'
        }
      };

      const html = renderToStaticMarkup(
        <M3SearchBox
          onSelectProduct={vi.fn()}
          testResults={[mockProductWithFeatures]}
          forceDropdownOpen={true}
          currentQuery="tru deut"
        />
      );

      expect(html).toContain('data-testid="badge-trufit"');
      expect(html).toContain('Voorgeselecteerd: TruFit');
      expect(html).toContain('data-testid="badge-architella"');
      expect(html).toContain('Voorgeselecteerd: Architella');

      // Cruciaal: géén prijzen in de zoekresultaatbadges!
      expect(html).not.toContain('+€');
      expect(html).not.toContain('68,50');
      expect(html).not.toContain('68.50');
    });

    it('displays preselected badge labels with Voorgeselecteerd prefix', () => {
      const mockSmartCord: SearchResultItem = {
        id: 219609,
        code: 'A00052469',
        name: 'Duette shade',
        unit: 'stuks',
        salesPrice: 229.0,
        salesGroup: 'Raamdecoratie',
        supplierName: 'Luxaflex',
        supplierId: 1,
        groups: ['Duette'],
        vatCode: 'BTW21',
        featureBadges: ['SmartCord']
      };

      const html = renderToStaticMarkup(
        <M3SearchBox
          onSelectProduct={vi.fn()}
          testResults={[mockSmartCord]}
          forceDropdownOpen={true}
          currentQuery="cor"
        />
      );

      expect(html).toContain('data-testid="badge-smartcord"');
      expect(html).toContain('Voorgeselecteerd: SmartCord');
    });

    it('filters out competing suppliers client-side when user types a specific supplier probe (Zero Stale)', () => {
      const sunwayItem: SearchResultItem = {
        id: 234181,
        code: 'A000064503',
        name: 'Duette shades staal',
        unit: 'stuks',
        salesPrice: 0,
        salesGroup: 'Raamdecoratie',
        supplierName: 'Sunway Benelux BV',
        supplierId: 2,
        groups: ['Sunway'],
        vatCode: 'BTW21'
      };
      const luxaflexItem: SearchResultItem = {
        id: 219609,
        code: 'A00052469',
        name: 'Duette shade',
        unit: 'stuks',
        salesPrice: 229.0,
        salesGroup: 'Raamdecoratie',
        supplierName: 'Luxaflex',
        supplierId: 1,
        groups: ['Luxaflex'],
        vatCode: 'BTW21'
      };

      const html = renderToStaticMarkup(
        <M3SearchBox
          onSelectProduct={vi.fn()}
          testResults={[sunwayItem, luxaflexItem]}
          forceDropdownOpen={true}
          currentQuery="trufit luxa"
        />
      );

      // Sunway must be immediately filtered out client-side when 'luxa' is in query
      expect(html).not.toContain('Sunway Benelux BV');
      expect(html).toContain('Luxaflex');
    });

    it('should render feature badges in selected product preview card', () => {
      const mockProductWithFeatures: SearchResultItem = {
        id: 219609,
        code: 'A00052469',
        name: 'Duette shade 25 mm',
        unit: 'stuks',
        salesPrice: 229.0,
        salesGroup: 'Raamdecoratie',
        supplierName: 'Luxaflex',
        supplierId: 1,
        groups: ['Duette'],
        vatCode: 'BTW21',
        featureBadges: ['TruFit'],
        preconfiguration: {
          montage: 'MONTAGE_TRUFIT',
          bediening: 'HANDGREEP'
        }
      };

      const html = renderToStaticMarkup(
        <M3SearchBox
          onSelectProduct={vi.fn()}
          initialProduct={mockProductWithFeatures}
        />
      );

      expect(html).toContain('data-testid="preview-badge-trufit"');
      expect(html).toContain('Voorgeselecteerd: TruFit');
    });
  });
});
