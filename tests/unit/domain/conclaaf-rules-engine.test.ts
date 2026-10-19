import { describe, it, expect } from 'vitest';
import {
  ConclaafRulesEngine,
  determineProductCategory
} from '@/domain/configurator/conclaaf-rules-engine';
import { SearchResultItem } from '@/types/product';
import { ConfigurationStepType } from '@/domain/configurator/bron-a-contracts';

describe('ConclaafRulesEngine Unit Tests (Bron A Consensus)', () => {
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

  describe('Product Category Classification', () => {
    it('should correctly classify Duette as raamdecoratie', () => {
      expect(determineProductCategory(duetteProduct)).toBe('raamdecoratie');
    });

    it('should correctly classify VLIET as gordijnen', () => {
      expect(determineProductCategory(curtainProduct)).toBe('gordijnen');
    });
  });

  describe('TruFit® Rules Consensus (Happy, Edge, Corner)', () => {
    it('Happy Path: should enforce Handgreep, bounds and profielkleur when TruFit is selected', () => {
      const engine = new ConclaafRulesEngine(duetteProduct);
      let config = engine.getConfiguration();

      // Selecteer TruFit montage
      config = engine.updateStep('MONTAGE', 'MONTAGE_TRUFIT');

      const montageStep = config.steps.find(s => s.id === 'MONTAGE');
      const bedieningStep = config.steps.find(s => s.id === 'BEDIENINGS_TYPE');
      const breedteStep = config.steps.find(s => s.id === 'BREEDTE');
      const hoogteStep = config.steps.find(s => s.id === 'HOOGTE');
      const profielKleurStep = config.steps.find(s => s.id === 'PROFIELKLEUR');

      expect(montageStep?.value).toBe('MONTAGE_TRUFIT');
      expect(bedieningStep?.value).toBe('HANDGREEP'); // Verplicht handgreep
      expect(breedteStep?.maxValue).toBe(1280); // TruFit max 1280 mm
      expect(hoogteStep?.maxValue).toBe(2200); // TruFit max 2200 mm
      expect(profielKleurStep?.show).toBe(true); // Profielkleur verschijnt

      // Meerprijsberekening inclusief TruFit toeslag (€ 68,50)
      const surcharges = engine.calculateTotalSurcharge();
      expect(surcharges.totalSurchargeEur).toBe(68.50);
    });

    it('Corner Case: should emit ConfigurationError when width exceeds 1280 mm for TruFit', () => {
      const engine = new ConclaafRulesEngine(duetteProduct);
      engine.updateStep('MONTAGE', 'MONTAGE_TRUFIT');
      const config = engine.updateStep('BREEDTE', '1350');

      expect(config.errors.length).toBeGreaterThan(0);
      const widthError = config.errors.find(e => e.stepId === 'BREEDTE');
      expect(widthError).toBeDefined();
      expect(widthError?.code).toBe('ERR_TRUFIT_WIDTH_EXCEEDED');
      expect(widthError?.message).toContain('TruFit® plakprofiel overschrijdt maximale breedte van 1280 mm');
    });
  });

  describe('Numeric Bounds & NaN Guarding', () => {
    it('should emit ERR_NUMERIC_INVALID when non-numeric input is supplied for dimension', () => {
      const engine = new ConclaafRulesEngine(duetteProduct);
      const config = engine.updateStep('BREEDTE', 'abc');

      const nanError = config.errors.find(e => e.stepId === 'BREEDTE' && e.code === 'ERR_NUMERIC_INVALID');
      expect(nanError).toBeDefined();
      expect(nanError?.message).toContain('Ongeldige numerieke waarde');
    });

    it('should emit ERR_OUT_OF_BOUNDS when dimension is below minValue or above maxValue', () => {
      const engine = new ConclaafRulesEngine(duetteProduct);
      // Min value is 300 mm
      const configLow = engine.updateStep('BREEDTE', '150');
      const lowError = configLow.errors.find(e => e.stepId === 'BREEDTE' && e.code === 'ERR_OUT_OF_BOUNDS');
      expect(lowError).toBeDefined();
      expect(lowError?.message).toContain('Minimale breedte');

      // Max value is 3000 mm for regular
      const configHigh = engine.updateStep('BREEDTE', '4000');
      const highError = configHigh.errors.find(e => e.stepId === 'BREEDTE' && e.code === 'ERR_OUT_OF_BOUNDS');
      expect(highError).toBeDefined();
      expect(highError?.message).toContain('Maximale breedte');
    });
  });

  describe('Immutable Snapshots & React 19 Re-render Guard', () => {
    it('should provide getImmutableSnapshot() returning deep clone with fresh object references', () => {
      const engine = new ConclaafRulesEngine(duetteProduct);
      const snap1 = engine.getImmutableSnapshot();
      const snap2 = engine.getImmutableSnapshot();

      expect(snap1).not.toBe(snap2); // Different memory references
      expect(snap1.steps).not.toBe(snap2.steps);
      expect(snap1.steps).toEqual(snap2.steps); // Identical values

      // After updateStep, new snapshot reflects update and does not mutate previous snapshot
      const snap3 = engine.updateStep('BREEDTE', '1200');
      expect(snap3.steps.find(s => s.id === 'BREEDTE')?.value).toBe('1200');
      expect(snap1.steps.find(s => s.id === 'BREEDTE')?.value).toBe('1000');
    });

    it('should generate deterministic session ID without SSR hydration randomness', () => {
      const engine1 = new ConclaafRulesEngine(duetteProduct);
      const engine2 = new ConclaafRulesEngine(duetteProduct);

      expect(engine1.getConfiguration().configurationGuid).toBe(engine2.getConfiguration().configurationGuid);
      expect(engine1.getConfiguration().configurationGuid).toContain('A00052469');
    });
  });

  describe('PowerView® Motor Rules Consensus', () => {
    it('should hide bedieningszijde and activate voedingstype/zijde when PowerView is selected', () => {
      const engine = new ConclaafRulesEngine(duetteProduct);
      engine.updateStep('MONTAGE', 'STANDAARD');
      const config = engine.updateStep('BEDIENINGS_TYPE', 'POWERVIEW');

      const bedieningsZijde = config.steps.find(s => s.id === 'BEDIENINGSZIJDE');
      const voedingType = config.steps.find(s => s.id === 'VOEDINGSTYPE');
      const voedingZijde = config.steps.find(s => s.id === 'VOEDINGSZIJDE');

      expect(bedieningsZijde?.show).toBe(false); // Bedieningszijde verborgen
      expect(voedingType?.show).toBe(true); // Voedingstype actief
      expect(voedingZijde?.show).toBe(true); // Voedingszijde actief

      // Meerprijs PowerView motor (€ 185,00)
      const surcharges = engine.calculateTotalSurcharge();
      expect(surcharges.totalSurchargeEur).toBe(185.00);
    });
  });

  describe('Fabric Contract & Category Isolation', () => {
    it('should provide STOF_KLEUR step with real catalogue fabrics for raamdecoratie', () => {
      const engine = new ConclaafRulesEngine(duetteProduct);
      const config = engine.getConfiguration();

      const fabricStep = config.steps.find(s => s.id === 'STOF_KLEUR');
      expect(fabricStep).toBeDefined();
      expect(fabricStep?.type).toBe(ConfigurationStepType.Select);
      expect(fabricStep?.possibleValues && fabricStep.possibleValues.length).toBeGreaterThan(0);

      const elanFabric = fabricStep?.possibleValues?.find(f => f.key === 'ELAN_101');
      expect(elanFabric).toBeDefined();
      expect(elanFabric?.value).toContain('Elan Chalk White');
    });

    it('Edge Case: should not contain STOF_KLEUR or raamdecoratie steps for curtain fabric (0103960000)', () => {
      const engine = new ConclaafRulesEngine(curtainProduct);
      const config = engine.getConfiguration();

      const ids = config.steps.map(s => s.id);
      expect(ids).not.toContain('STOF_KLEUR'); // Curtain fabric IS the fabric
      expect(ids).not.toContain('VORM');
      expect(ids).not.toContain('BEDIENINGS_TYPE');
      expect(ids).not.toContain('MONTAGE');

      expect(ids).toContain('BREEDTE');
      expect(ids).toContain('HOOGTE');
      expect(ids).toContain('PLOOISOORT');
      expect(ids).toContain('LOODVETER');
    });

    it('should compute curtain drops and fabric fullness based on pleat type', () => {
      const engine = new ConclaafRulesEngine(curtainProduct);
      engine.updateStep('BREEDTE', '3000'); // 3 meter rail
      engine.updateStep('HOOGTE', '2600');
      engine.updateStep('PLOOISOORT', 'DUBBEL'); // 2.5x stofbreedte

      const calculation = engine.calculateCurtainMetrics();
      expect(calculation.fullnessMultiplier).toBe(2.5);
      expect(calculation.totalFabricWidthMeters).toBe(7.5);
    });
  });
});
