import { ConclaafRulesEngine } from '@/domain/configurator/conclaaf-rules-engine';
import { GoldenVector } from '@/domain/configurator/golden-master-fixtures';

export interface ConfigurationDiffResult {
  vectorId: string;
  category: string;
  isParityMatch: boolean;
  stepParity: boolean;
  valueParity: boolean;
  statusParity: boolean;
  errorParity: boolean;
  pricingDriftCents: number;
  totalSurchargeEur: number;
  confectionMetricsParity?: boolean;
  discrepancies: string[];
}

export interface GoldenMasterParityReport {
  totalVectors: number;
  parityMatches: number;
  discrepancyCount: number;
  parityPercentage: number;
  maxPriceDriftCents: number;
  results: ConfigurationDiffResult[];
  categoryBreakdown: Record<string, { total: number; matches: number }>;
}

export class DifferentialGoldenMasterRunner {
  public evaluateVector(vector: GoldenVector): ConfigurationDiffResult {
    const discrepancies: string[] = [];

    // 1. Initialiseer de engine met het reële product
    const engine = new ConclaafRulesEngine(vector.product);

    // 2. Pas alle inputs van de testvector toe
    for (const input of vector.inputs) {
      engine.updateStep(String(input.stepType), String(input.value));
    }

    const snapshot = engine.getImmutableSnapshot();
    const pricing = engine.calculateTotalSurcharge();

    // 3. Stap Pariteit
    let stepParity = true;
    if (snapshot.steps.length !== vector.expected.stepCount) {
      stepParity = false;
      discrepancies.push(
        `StepCount mismatch: verwachte ${vector.expected.stepCount} stappen, maar ontving ${snapshot.steps.length}`
      );
    }

    // 4. Waarde & Auto-correctie Pariteit
    let valueParity = true;
    if (vector.expected.expectedSteps) {
      for (const expStep of vector.expected.expectedSteps) {
        const actualStep = snapshot.steps.find((s) => s.id === expStep.stepType);
        if (!actualStep) {
          valueParity = false;
          discrepancies.push(`Verwachte stap ${expStep.stepType} ontbreekt in snapshot`);
        } else if (expStep.expectedValue !== undefined && actualStep.value !== expStep.expectedValue) {
          valueParity = false;
          discrepancies.push(
            `Waarde mismatch voor stap ${expStep.stepType}: verwachtte ${expStep.expectedValue}, maar ontving ${actualStep.value}`
          );
        }
      }
    }

    // 5. Validatiestatus Pariteit (afgeleid van errors array conform Bron A contract)
    const derivedStatus = snapshot.errors.length === 0 ? 'valid' : 'invalid';
    const statusParity = derivedStatus === vector.expected.status;
    if (!statusParity) {
      discrepancies.push(
        `Status mismatch: verwachte status '${vector.expected.status}', maar ontving '${derivedStatus}' (errors: ${snapshot.errors.map((e) => e.code).join(', ')})`
      );
    }

    // 6. Error & Boundary Pariteit
    let errorParity = true;
    if (vector.expected.expectedErrors && vector.expected.expectedErrors.length > 0) {
      for (const expErr of vector.expected.expectedErrors) {
        const found = snapshot.errors.some((err) => err.code === expErr.code);
        if (!found) {
          errorParity = false;
          discrepancies.push(`Verwachte errorcode '${expErr.code}' werd niet gegenereerd`);
        }
      }
    } else if (vector.expected.status === 'valid' && snapshot.errors.length > 0) {
      errorParity = false;
      discrepancies.push(
        `Onverwachte foutmeldingen bij status 'valid': ${snapshot.errors.map((e) => e.code).join(', ')}`
      );
    }

    // 7. Prijscalculatie & Integer-Cent Pariteit
    let pricingDriftCents = 0;
    const engineTotalEur = pricing.totalSurchargeEur;
    if (vector.expected.totalSurchargeEur !== undefined) {
      const engineCents = Math.round(engineTotalEur * 100);
      const goldenCents = Math.round(vector.expected.totalSurchargeEur * 100);
      pricingDriftCents = Math.abs(engineCents - goldenCents);

      if (pricingDriftCents > 0) {
        discrepancies.push(
          `Prijsdrift gedetecteerd: verwachtte €${vector.expected.totalSurchargeEur.toFixed(2)}, maar ontving €${engineTotalEur.toFixed(2)} (${pricingDriftCents} cent afwijking)`
        );
      }
    }

    // 8. Gordijn Confectiemetrics Pariteit (indien van toepassing)
    let confectionMetricsParity: boolean | undefined = undefined;
    if (vector.expected.expectedCurtainMetrics) {
      const metrics = engine.calculateCurtainMetrics();
      const widthDiff = Math.abs(
        metrics.totalFabricWidthMeters - vector.expected.expectedCurtainMetrics.totalFabricWidthMeters
      );
      const pleatDiff = Math.abs(
        metrics.fullnessMultiplier - vector.expected.expectedCurtainMetrics.fullnessMultiplier
      );

      confectionMetricsParity = widthDiff < 0.001 && pleatDiff < 0.001;
      if (!confectionMetricsParity) {
        discrepancies.push(
          `Confectiemetrics mismatch: berekend ${metrics.totalFabricWidthMeters}m (factor ${metrics.fullnessMultiplier}) vs verwacht ${vector.expected.expectedCurtainMetrics.totalFabricWidthMeters}m (factor ${vector.expected.expectedCurtainMetrics.fullnessMultiplier})`
        );
      }
    }

    const isParityMatch =
      discrepancies.length === 0 &&
      stepParity &&
      valueParity &&
      statusParity &&
      errorParity &&
      pricingDriftCents === 0;

    return {
      vectorId: vector.id,
      category: vector.category,
      isParityMatch,
      stepParity,
      valueParity,
      statusParity,
      errorParity,
      pricingDriftCents,
      totalSurchargeEur: engineTotalEur,
      confectionMetricsParity,
      discrepancies,
    };
  }

  public evaluateAllVectors(vectors: GoldenVector[]): GoldenMasterParityReport {
    const results: ConfigurationDiffResult[] = [];
    let parityMatches = 0;
    let discrepancyCount = 0;
    let maxPriceDriftCents = 0;

    const categoryBreakdown: Record<string, { total: number; matches: number }> = {};

    for (const vector of vectors) {
      if (!categoryBreakdown[vector.category]) {
        categoryBreakdown[vector.category] = { total: 0, matches: 0 };
      }
      categoryBreakdown[vector.category].total++;

      const res = this.evaluateVector(vector);
      results.push(res);

      if (res.isParityMatch) {
        parityMatches++;
        categoryBreakdown[vector.category].matches++;
      } else {
        discrepancyCount += res.discrepancies.length;
      }

      if (res.pricingDriftCents > maxPriceDriftCents) {
        maxPriceDriftCents = res.pricingDriftCents;
      }
    }

    const totalVectors = vectors.length;
    const parityPercentage = totalVectors > 0 ? (parityMatches / totalVectors) * 100 : 0;

    return {
      totalVectors,
      parityMatches,
      discrepancyCount,
      parityPercentage,
      maxPriceDriftCents,
      results,
      categoryBreakdown,
    };
  }
}
