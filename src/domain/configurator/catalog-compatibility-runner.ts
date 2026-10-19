import { SearchResultItem } from '@/types/product';
import {
  ConclaafRulesEngine,
  determineProductCategory,
  ProductCategory
} from '@/domain/configurator/conclaaf-rules-engine';

export interface ProductEvaluationResult {
  productId: string;
  productCode: string;
  productName: string;
  category: ProductCategory;
  valid: boolean;
  stepCount: number;
  totalSurcharge: number;
  error?: string;
}

export interface CompatibilityReport {
  totalEvaluated: number;
  totalProcessed: number;
  validCount: number;
  successCount: number;
  invalidCount: number;
  errorCount: number;
  anomalyCount: number;
  categoryCounts: Record<ProductCategory, number>;
  anomalies: ProductEvaluationResult[];
  errors: ProductEvaluationResult[];
  durationMs?: number;
}

export class CatalogCompatibilityRunner {
  private totalEvaluated = 0;
  private validCount = 0;
  private invalidCount = 0;
  private categoryCounts: Record<ProductCategory, number> = {
    raamdecoratie: 0,
    gordijnen: 0,
    vloeren: 0,
    algemeen: 0,
  };
  private anomalies: ProductEvaluationResult[] = [];

  public evaluateProduct(item: SearchResultItem): ProductEvaluationResult {
    const productId = String(item.id ?? item.code ?? 'unknown');
    const productCode = item.code || '';
    const productName = item.name || '';

    try {
      const category = determineProductCategory(item);
      const engine = new ConclaafRulesEngine(item);
      const snapshot = engine.getImmutableSnapshot();
      const pricing = engine.calculateTotalSurcharge();

      const result: ProductEvaluationResult = {
        productId,
        productCode,
        productName,
        category,
        valid: true,
        stepCount: snapshot.steps.length,
        totalSurcharge: pricing.totalSurchargeEur,
      };

      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const category: ProductCategory = 'algemeen';

      return {
        productId,
        productCode,
        productName,
        category,
        valid: false,
        stepCount: 0,
        totalSurcharge: 0,
        error: errorMessage,
      };
    }
  }

  public evaluateBatch(items: SearchResultItem[]): CompatibilityReport {
    for (const item of items) {
      const result = this.evaluateProduct(item);
      this.totalEvaluated++;
      this.categoryCounts[result.category] = (this.categoryCounts[result.category] || 0) + 1;

      if (result.valid) {
        this.validCount++;
      } else {
        this.invalidCount++;
        this.anomalies.push(result);
      }
    }

    return this.getReport();
  }

  public getReport(durationMs?: number): CompatibilityReport {
    return {
      totalEvaluated: this.totalEvaluated,
      totalProcessed: this.totalEvaluated,
      validCount: this.validCount,
      successCount: this.validCount,
      invalidCount: this.invalidCount,
      errorCount: this.invalidCount,
      anomalyCount: this.anomalies.length,
      categoryCounts: { ...this.categoryCounts },
      anomalies: [...this.anomalies],
      errors: [...this.anomalies],
      durationMs,
    };
  }

  public reset(): void {
    this.totalEvaluated = 0;
    this.validCount = 0;
    this.invalidCount = 0;
    this.categoryCounts = {
      raamdecoratie: 0,
      gordijnen: 0,
      vloeren: 0,
      algemeen: 0,
    };
    this.anomalies = [];
  }
}
