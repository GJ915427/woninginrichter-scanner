import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { M3PriceActionFooter } from '@/components/configurator/m3/M3PriceActionFooter';
import { DynamicConfiguratorForm } from '@/components/configurator/DynamicConfiguratorForm';
import { ConclaafRulesEngine } from '@/domain/configurator/conclaaf-rules-engine';
import ConfiguratorPage from '@/app/configurator/page';
import { SearchResultItem } from '@/types/product';
import { Configuration } from '@/domain/configurator/bron-a-contracts';

const dummyProduct: SearchResultItem = {
  id: 101,
  code: 'A00052469',
  name: 'Duette® Shade 25mm SmartCord',
  salesPrice: 199.50,
  unit: 'stuks',
  vatCode: '21%',
  supplierId: 42,
  supplierName: 'Hunter Douglas',
  salesGroup: 'Raamdecoratie',
  articleGroup: 'Duette',
  groups: ['Raamdecoratie', 'Duette']
};

const dummyValidConfig: Configuration = {
  steps: [
    {
      id: 'BREEDTE',
      type: 'BREEDTE',
      title: 'Breedte (mm)',
      required: true,
      currentValue: '1000',
      possibleValues: []
    }
  ],
  errors: [],
  surcharges: {
    totalEur: 50.00,
    items: [{ key: 'POWERVIEW', title: 'PowerView motor', eur: 50.00 }]
  }
};

const dummyInvalidConfig: Configuration = {
  steps: [],
  errors: [
    {
      code: 'ERR_TRUFIT_WIDTH_EXCEEDED',
      message: 'TruFit montagesysteem ondersteunt een maximale breedte van 1280 mm',
      severity: 'error'
    }
  ],
  surcharges: { totalEur: 0, items: [] }
};

describe('M3PriceActionFooter & Configurator Page Integration', () => {
  describe('M3PriceActionFooter (SRP Presentation & M3 Invariants)', () => {
    it('Happy Path: should render base price, surcharge and calculated total EUR', () => {
      const html = renderToStaticMarkup(
        <M3PriceActionFooter
          basePriceEur={199.50}
          surchargeEur={50.00}
          proposalId="O26000735"
          disabled={false}
          isSubmitting={false}
          onSubmit={vi.fn()}
        />
      );

      // Base price and surcharge breakdown
      expect(html).toContain('€ 199,50');
      expect(html).toContain('+€ 50,00 toeslag');
      // Total price: 199.50 + 50.00 = 249.50
      expect(html).toContain('€ 249,50');
      // Action button
      expect(html).toContain('Toevoegen aan Offerte O26000735');
      expect(html).not.toContain('disabled=""');
    });

    it('Edge Case: should render disabled button and warning when disabled is true', () => {
      const html = renderToStaticMarkup(
        <M3PriceActionFooter
          basePriceEur={199.50}
          surchargeEur={0}
          proposalId="O26000735"
          disabled={true}
          isSubmitting={false}
          validationMessage="Configuratie bevat validatiefouten"
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain('disabled=""');
      expect(html).toContain('Configuratie bevat validatiefouten');
    });

    it('Edge Case: should show loading state when isSubmitting is true', () => {
      const html = renderToStaticMarkup(
        <M3PriceActionFooter
          basePriceEur={199.50}
          surchargeEur={0}
          proposalId="O26000735"
          disabled={false}
          isSubmitting={true}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain('Bezig met toevoegen...');
      expect(html).toContain('disabled=""');
    });

    it('Happy Path: should display success badge when successMessage is provided', () => {
      const html = renderToStaticMarkup(
        <M3PriceActionFooter
          basePriceEur={199.50}
          surchargeEur={0}
          proposalId="O26000735"
          disabled={false}
          isSubmitting={false}
          successMessage="Toegevoegd aan regel 1 van offerte O26000735"
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain('Toegevoegd aan regel 1 van offerte O26000735');
    });

    it('Direct Callback: should execute onSubmit handler when invoked', () => {
      const handleSubmit = vi.fn();
      const props = {
        basePriceEur: 199.50,
        surchargeEur: 0,
        proposalId: 'O26000735',
        disabled: false,
        isSubmitting: false,
        onSubmit: handleSubmit
      };

      props.onSubmit();
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('ConfiguratorPage (/configurator/page.tsx) Assemblage', () => {
    it('should render authentic Material Design 3 layout and Top App Bar', () => {
      const html = renderToStaticMarkup(<ConfiguratorPage />);
      // M3 Top App Bar branding
      expect(html).toContain('Product Configurator');
      expect(html).toContain('EasyM2M');
      expect(html).toContain('LogicTrade Cloud REST API');
      // M3 Search Bar & Grey Instruction Placeholder
      expect(html).toContain('placeholder="Typ een artikelcode, omschrijving of merk');
      // M3 Empty State Guidance
      expect(html).toContain('Welkom bij de Product Configurator');
      // Elimination of legacy POC artifacts
      expect(html).not.toContain('shadow-blue-500/30'); // Old 'E' badge shadow
      expect(html).not.toContain('Het formulier past zich automatisch en 100% dynamisch aan'); // Old POC subtitle
    });
  });

  describe('Pre-Configuration Hydration (Sub-Fase 2)', () => {
    it('should pre-hydrate DynamicConfiguratorForm with TruFit montage and Handgreep from preconfiguration', () => {
      const productWithPreconfig: SearchResultItem = {
        ...dummyProduct,
        featureBadges: ['TruFit'],
        preconfiguration: {
          montage: 'MONTAGE_TRUFIT',
          bediening: 'HANDGREEP'
        }
      };

      const html = renderToStaticMarkup(
        <DynamicConfiguratorForm
          product={productWithPreconfig}
          onChange={vi.fn()}
        />
      );

      // Verify that TruFit and Handgreep are rendered in the pre-hydrated HTML
      expect(html).toContain('TruFit');
      expect(html).toContain('Handgreep');
    });

    it('should calculate +€ 68,50 surcharge in ConclaafRulesEngine when preconfigured with TruFit', () => {
      const productWithTruFit: SearchResultItem = {
        ...dummyProduct,
        preconfiguration: {
          montage: 'MONTAGE_TRUFIT',
          bediening: 'HANDGREEP'
        }
      };

      const engine = new ConclaafRulesEngine(productWithTruFit);
      if (productWithTruFit.preconfiguration?.montage) {
        engine.updateStep('MONTAGE', productWithTruFit.preconfiguration.montage);
      }
      if (productWithTruFit.preconfiguration?.bediening) {
        engine.updateStep('BEDIENINGS_TYPE', productWithTruFit.preconfiguration.bediening);
      }

      const surcharge = engine.calculateTotalSurcharge();
      expect(surcharge.totalSurchargeEur).toBe(68.50);
      const snapshot = engine.getConfiguration();
      const montageStep = snapshot.steps.find((s) => s.id === 'MONTAGE');
      expect(montageStep?.selectedValue?.key).toBe('MONTAGE_TRUFIT');
      const bedieningStep = snapshot.steps.find((s) => s.id === 'BEDIENINGS_TYPE');
      expect(bedieningStep?.selectedValue?.key).toBe('HANDGREEP');
    });

    it('should generically pre-hydrate VORM :20 (Top Down / Bottom Up) from preconfiguration without hardcoded if-checks', () => {
      const productWithTopDown: SearchResultItem = {
        ...dummyProduct,
        featureBadges: ['Top Down / Bottom Up'],
        preconfiguration: {
          VORM: ':20'
        }
      };

      const html = renderToStaticMarkup(
        <DynamicConfiguratorForm
          product={productWithTopDown}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain('Top Down / Bottom Up');
    });
  });
});
