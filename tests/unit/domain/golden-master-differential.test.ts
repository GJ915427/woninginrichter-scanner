import { describe, it, expect } from 'vitest';
import {
  DifferentialGoldenMasterRunner,
  ConfigurationDiffResult,
  GoldenMasterParityReport
} from '@/domain/configurator/golden-master-differential';
import {
  GOLDEN_MASTER_VECTORS,
  GoldenVector
} from '@/domain/configurator/golden-master-fixtures';

describe('Fase 5: Differential Golden-Master Testing Suite', () => {
  const runner = new DifferentialGoldenMasterRunner();

  describe('Happy Path Configurations Parity', () => {
    it('should achieve 100% parity for standard Luxaflex Duette (A00052469)', () => {
      const vector = GOLDEN_MASTER_VECTORS.find(v => v.id === 'duette-standard');
      expect(vector).toBeDefined();

      const diff: ConfigurationDiffResult = runner.evaluateVector(vector!);
      expect(diff.isParityMatch).toBe(true);
      expect(diff.stepParity).toBe(true);
      expect(diff.valueParity).toBe(true);
      expect(diff.statusParity).toBe(true);
      expect(diff.pricingDriftCents).toBe(0);
      expect(diff.totalSurchargeEur).toBe(0);
      expect(diff.discrepancies).toHaveLength(0);
    });

    it('should achieve 100% parity for Curtain Confection VLIET (0103960000)', () => {
      const vector = GOLDEN_MASTER_VECTORS.find(v => v.id === 'curtain-double-pleat-lead');
      expect(vector).toBeDefined();

      const diff: ConfigurationDiffResult = runner.evaluateVector(vector!);
      expect(diff.isParityMatch).toBe(true);
      expect(diff.stepParity).toBe(true);
      expect(diff.valueParity).toBe(true);
      expect(diff.statusParity).toBe(true);
      expect(diff.pricingDriftCents).toBe(0);
      expect(diff.totalSurchargeEur).toBe(12.50);
      expect(diff.confectionMetricsParity).toBe(true);
      expect(diff.discrepancies).toHaveLength(0);
    });

    it('should achieve 100% parity for Flooring Novilon Vinyl (VIN01)', () => {
      const vector = GOLDEN_MASTER_VECTORS.find(v => v.id === 'flooring-vinyl-standard');
      expect(vector).toBeDefined();

      const diff: ConfigurationDiffResult = runner.evaluateVector(vector!);
      expect(diff.isParityMatch).toBe(true);
      expect(diff.stepParity).toBe(true);
      expect(diff.statusParity).toBe(true);
      expect(diff.pricingDriftCents).toBe(0);
      expect(diff.totalSurchargeEur).toBe(4.50);
      expect(diff.discrepancies).toHaveLength(0);
    });

    it('should achieve 100% parity for Furniture Het Anker Bank (BNK01)', () => {
      const vector = GOLDEN_MASTER_VECTORS.find(v => v.id === 'furniture-sofa-assembly');
      expect(vector).toBeDefined();

      const diff: ConfigurationDiffResult = runner.evaluateVector(vector!);
      expect(diff.isParityMatch).toBe(true);
      expect(diff.stepParity).toBe(true);
      expect(diff.statusParity).toBe(true);
      expect(diff.pricingDriftCents).toBe(0);
      expect(diff.totalSurchargeEur).toBe(45.00);
      expect(diff.discrepancies).toHaveLength(0);
    });
  });

  describe('Edge Cases (Motorization & Boundaries)', () => {
    it('should match PowerView motorization with Battery Pack (ACCU: €185)', () => {
      const vector = GOLDEN_MASTER_VECTORS.find(v => v.id === 'duette-powerview-accu');
      expect(vector).toBeDefined();

      const diff: ConfigurationDiffResult = runner.evaluateVector(vector!);
      expect(diff.isParityMatch).toBe(true);
      expect(diff.stepParity).toBe(true);
      expect(diff.statusParity).toBe(true);
      expect(diff.pricingDriftCents).toBe(0);
      expect(diff.totalSurchargeEur).toBe(185.00);
      expect(diff.discrepancies).toHaveLength(0);
    });

    it('should match PowerView motorization with Transformer (TRANSFORMATOR: €230)', () => {
      const vector = GOLDEN_MASTER_VECTORS.find(v => v.id === 'duette-powerview-transformator');
      expect(vector).toBeDefined();

      const diff: ConfigurationDiffResult = runner.evaluateVector(vector!);
      expect(diff.isParityMatch).toBe(true);
      expect(diff.stepParity).toBe(true);
      expect(diff.statusParity).toBe(true);
      expect(diff.pricingDriftCents).toBe(0);
      expect(diff.totalSurchargeEur).toBe(230.00);
      expect(diff.discrepancies).toHaveLength(0);
    });

    it('should match TruFit boundary width at exact limit 1280 mm with status valid', () => {
      const vector = GOLDEN_MASTER_VECTORS.find(v => v.id === 'duette-trufit-max-bound');
      expect(vector).toBeDefined();

      const diff: ConfigurationDiffResult = runner.evaluateVector(vector!);
      expect(diff.isParityMatch).toBe(true);
      expect(diff.statusParity).toBe(true);
      expect(diff.errorParity).toBe(true);
      expect(diff.discrepancies).toHaveLength(0);
    });
  });

  describe('Corner Cases (Violations & Auto-Correction)', () => {
    it('should trigger ERR_TRUFIT_WIDTH_EXCEEDED when TruFit width is 1281 mm', () => {
      const vector = GOLDEN_MASTER_VECTORS.find(v => v.id === 'duette-trufit-exceeded');
      expect(vector).toBeDefined();

      const diff: ConfigurationDiffResult = runner.evaluateVector(vector!);
      expect(diff.isParityMatch).toBe(true);
      expect(diff.statusParity).toBe(true);
      expect(diff.errorParity).toBe(true);
      expect(diff.discrepancies).toHaveLength(0);
    });

    it('should verify TruFit auto-correction to HANDGREEP when KETTING was initially selected', () => {
      const vector = GOLDEN_MASTER_VECTORS.find(v => v.id === 'duette-trufit-chain-auto-correct');
      expect(vector).toBeDefined();

      const diff: ConfigurationDiffResult = runner.evaluateVector(vector!);
      expect(diff.isParityMatch).toBe(true);
      expect(diff.statusParity).toBe(true);
      expect(diff.valueParity).toBe(true);
      expect(diff.errorParity).toBe(true);
      expect(diff.discrepancies).toHaveLength(0);
    });

    it('should reject invalid negative dimension with ERR_OUT_OF_BOUNDS', () => {
      const vector = GOLDEN_MASTER_VECTORS.find(v => v.id === 'duette-invalid-negative-dimension');
      expect(vector).toBeDefined();

      const diff: ConfigurationDiffResult = runner.evaluateVector(vector!);
      expect(diff.isParityMatch).toBe(true);
      expect(diff.statusParity).toBe(true);
      expect(diff.errorParity).toBe(true);
      expect(diff.discrepancies).toHaveLength(0);
    });
  });

  describe('Batch Parity Evaluation', () => {
    it('should run differential evaluation over all vectors and achieve 100% parity', () => {
      const report: GoldenMasterParityReport = runner.evaluateAllVectors(GOLDEN_MASTER_VECTORS);

      expect(report.totalVectors).toBe(GOLDEN_MASTER_VECTORS.length);
      expect(report.parityMatches).toBe(GOLDEN_MASTER_VECTORS.length);
      expect(report.discrepancyCount).toBe(0);
      expect(report.parityPercentage).toBe(100.0);
      expect(report.maxPriceDriftCents).toBe(0);
    });
  });
});
