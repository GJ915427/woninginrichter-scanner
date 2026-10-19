import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { M3DimensionSection } from '@/components/configurator/m3/M3DimensionSection';
import { M3ExecutionSection } from '@/components/configurator/m3/M3ExecutionSection';
import { DynamicConfiguratorForm } from '@/components/configurator/DynamicConfiguratorForm';
import { ConclaafRulesEngine } from '@/domain/configurator/conclaaf-rules-engine';
import { SearchResultItem } from '@/types/product';
import ConfiguratorPage from '@/app/configurator/page';

describe('M3 Configurator Form Components (SRP & M3 Invariants)', () => {
  const duetteProduct: SearchResultItem = {
    id: 219609,
    code: 'A00052469',
    name: 'Duette® shade',
    unit: 'stuks',
    salesPrice: 861.02,
    salesGroup: 'Raamdecoratie',
    supplierName: 'Luxaflex Nederland',
    supplierId: 82653,
    groups: ['Luxaflex', 'Duette® shade'],
    vatCode: 'BTW Hoog'
  };

  const curtainProduct: SearchResultItem = {
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

  describe('M3DimensionSection (SRP Presentation INV-GOV-22)', () => {
    it('should render width and height inputs in mm and M3 Switch for Blijvende maat', () => {
      const engine = new ConclaafRulesEngine(duetteProduct);
      const config = engine.getConfiguration();
      const widthStep = config.steps.find(s => s.id === 'BREEDTE')!;
      const heightStep = config.steps.find(s => s.id === 'HOOGTE')!;

      const html = renderToStaticMarkup(
        <M3DimensionSection
          widthStep={widthStep}
          heightStep={heightStep}
          isBlijvendeMaat={true}
          onToggleBlijvendeMaat={vi.fn()}
          onChangeWidth={vi.fn()}
          onChangeHeight={vi.fn()}
          errors={[]}
        />
      );

      // Verify dimensions direct at the top
      expect(html).toContain('Breedte');
      expect(html).toContain('Hoogte');
      expect(html).toContain('mm');
      expect(html).toContain('value="1000"');
      expect(html).toContain('value="1500"');

      // Verify M3 Switch for Blijvende maat
      expect(html).toContain('Blijvende maat');
      expect(html).toContain('checked');
    });

    it('should display validation errors purely data-driven from errors prop (INV-GOV-22)', () => {
      const engine = new ConclaafRulesEngine(duetteProduct);
      const config = engine.getConfiguration();
      const widthStep = config.steps.find(s => s.id === 'BREEDTE')!;
      const heightStep = config.steps.find(s => s.id === 'HOOGTE')!;

      const mockErrors = [
        {
          code: 'ERR_TRUFIT_WIDTH_EXCEEDED',
          stepId: 'BREEDTE',
          message: 'TruFit® plakprofiel overschrijdt maximale breedte van 1280 mm'
        }
      ];

      const html = renderToStaticMarkup(
        <M3DimensionSection
          widthStep={widthStep}
          heightStep={heightStep}
          isBlijvendeMaat={true}
          onToggleBlijvendeMaat={vi.fn()}
          onChangeWidth={vi.fn()}
          onChangeHeight={vi.fn()}
          errors={mockErrors}
        />
      );

      expect(html).toContain('TruFit® plakprofiel overschrijdt maximale breedte van 1280 mm');
      expect(html).toContain('border-rose-500'); // M3 error border styling
    });
  });

  describe('M3ExecutionSection (Conditional Rules & Real Fabric Options)', () => {
    it('should render shape, mounting, operation, and STOF_KLEUR with real catalogue fabrics for raamdecoratie', () => {
      const engine = new ConclaafRulesEngine(duetteProduct);
      const config = engine.getImmutableSnapshot();

      const html = renderToStaticMarkup(
        <M3ExecutionSection
          steps={config.steps}
          category="raamdecoratie"
          onChangeStep={vi.fn()}
        />
      );

      expect(html).toContain('Model / Vorm');
      expect(html).toContain('Montagewijze');
      expect(html).toContain('Bedieningstype');
      expect(html).toContain('Stofkeuze &amp; Kleur');

      // Real fabrics rendered
      expect(html).toContain('Elan Chalk White');
      expect(html).toContain('ELAN_101');
    });

    it('Edge Case: should render curtain confection steps without raamdecoratie steps for curtainProduct', () => {
      const engine = new ConclaafRulesEngine(curtainProduct);
      const config = engine.getImmutableSnapshot();

      const html = renderToStaticMarkup(
        <M3ExecutionSection
          steps={config.steps}
          category="gordijnen"
          onChangeStep={vi.fn()}
        />
      );

      // Confection steps present
      expect(html).toContain('Plooisoort');
      expect(html).toContain('Onderzoom afwerking');
      expect(html).toContain('Sluiting &amp; Stelwijze');

      // Raamdecoratie steps absent (Category Isolation)
      expect(html).not.toContain('Model / Vorm');
      expect(html).not.toContain('Montagewijze');
      expect(html).not.toContain('Bedieningstype');
      expect(html).not.toContain('Stofkeuze &amp; Kleur');
    });
  });

  describe('DynamicConfiguratorForm (Orchestration, Live Price & Folded Accordion)', () => {
    it('Happy Path: should render single compact header, dimensions at top, live price, and accordion at bottom', () => {
      const html = renderToStaticMarkup(
        <DynamicConfiguratorForm
          product={duetteProduct}
          onChange={vi.fn()}
        />
      );

      // 1. Single occurrence: Article badge at top
      expect(html).toContain('A00052469');
      expect(html).toContain('Duette® shade');
      expect(html).toContain('Luxaflex Nederland');

      // 2. Maten direct bovenaan
      expect(html).toContain('Breedte');
      expect(html).toContain('Hoogte');
      expect(html).toContain('Blijvende maat');

      // 3. Live prijsbalk
      expect(html).toContain('Totaalprijs');
      expect(html).toContain('861,02');

      // 4. Accordion onderaan met technische ERP details (standaard samengevouwen)
      expect(html).toContain('Technische artikeldetails');
      expect(html).toContain('ERP-hiërarchie');
    });
  });

  describe('Sanitized ConfiguratorPage (/configurator/page.tsx)', () => {
    it('should render search and empty state without redundant header card', () => {
      const html = renderToStaticMarkup(<ConfiguratorPage />);
      expect(html).toContain('Welkom bij de Product Configurator');
      expect(html).toContain('placeholder="Typ een artikelcode, omschrijving of merk');
      // No ghost duplicate cards
      expect(html).not.toContain('Artikelhiërarchie:');
    });
  });
});
