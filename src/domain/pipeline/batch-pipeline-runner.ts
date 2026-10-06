import { LivePipelineEvaluator, LivePipelineEvaluation } from './live-pipeline-evaluator';

export interface BatchItemResult {
  index: number;
  fundaUrl?: string;
  query: string;
  typology: string;
  success: boolean;
  error?: string;
  durationMs: number;
  pandId?: string;
  vboId?: string;
  oppervlakteVboM2?: number;
  groundNapM?: number;
  eavesNapM?: number;
  ridgeNapM?: number;
  perceelnummer?: string | number;
  calculatedFloorsCount?: number;
  overallMatch?: boolean;
  avgIoU?: number;
  maxDeltaAreaM2?: number;
}

export interface BatchProgress {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  lastCompleted?: BatchItemResult;
  elapsedMs: number;
}

export interface TypologyStats {
  total: number;
  successful: number;
  failed: number;
  avgIoU: number;
  avgDeltaAreaM2: number;
  avgDurationMs: number;
}

export interface BatchSummaryResult {
  totalRecords: number;
  successfulCount: number;
  failedCount: number;
  totalDurationMs: number;
  averageDurationPerRecordMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  typologyBreakdown: Record<string, TypologyStats>;
  results: BatchItemResult[];
}

export interface BatchRunnerOptions {
  concurrency?: number;
  delayMs?: number;
  maxRetries?: number;
  evaluator?: LivePipelineEvaluator;
  onProgress?: (progress: BatchProgress) => void;
}

export class BatchPipelineRunner {
  private evaluator: LivePipelineEvaluator;
  private concurrency: number;
  private delayMs: number;
  private maxRetries: number;
  private onProgress?: (progress: BatchProgress) => void;

  constructor(options: BatchRunnerOptions = {}) {
    this.evaluator = options.evaluator || new LivePipelineEvaluator();
    this.concurrency = Math.max(1, options.concurrency ?? 5);
    this.delayMs = options.delayMs ?? 25;
    this.maxRetries = options.maxRetries ?? 1;
    this.onProgress = options.onProgress;
  }

  /**
   * Voert een gecontroleerde live batch sweep uit over de referentielijst
   */
  async runBatch(
    records: Array<{
      address: { street: string; houseNumber: string; city: string; postalCode?: string };
      typology?: string;
      typologie?: string;
      housing_typology?: string;
      funda_url?: string;
      ground_truth_floors?: Array<{
        level: number;
        outerPolygonM: Array<[number, number]>;
        measuredGrossAreaM2?: number;
      }>;
    }>
  ): Promise<BatchSummaryResult> {
    const startTime = Date.now();
    const total = records.length;
    let completed = 0;
    let successful = 0;
    let failed = 0;

    const results: BatchItemResult[] = new Array(total);
    let nextIndex = 0;

    const executeItemWithRetry = async (
      record: (typeof records)[0],
      idx: number
    ): Promise<BatchItemResult> => {
      const typology = record.typology || record.typologie || record.housing_typology || 'Onbekend';
      const query = `${record.address.street} ${record.address.houseNumber} ${record.address.city}`.trim();
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        if (attempt > 0) {
          // Exponentiële jitter backoff vóór retry
          const backoff = 100 * attempt + Math.floor(Math.random() * 50);
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }

        const itemStart = Date.now();
        try {
          let evaluation: LivePipelineEvaluation | null = null;
          let comparison: {
            overallMatch: boolean;
            floorComparisons: Array<{ level: number; iou: number; hausdorffDistanceM: number; deltaAreaM2: number }>;
          } | null = null;

          if (record.ground_truth_floors && record.ground_truth_floors.length > 0) {
            const evalResult = await this.evaluator.evaluateBenchmarkRecord({
              address: record.address,
              ground_truth_floors: record.ground_truth_floors,
            });
            evaluation = evalResult.evaluation;
            comparison = evalResult.comparison;
          } else {
            evaluation = await this.evaluator.evaluateAddress(query);
          }

          const durationMs = Date.now() - itemStart;

          if (!evaluation) {
            throw new Error(`Geen pand/evaluatie gevonden voor adres: ${query}`);
          }

          let avgIoU: number | undefined;
          let maxDeltaAreaM2: number | undefined;

          if (comparison && comparison.floorComparisons.length > 0) {
            const sumIoU = comparison.floorComparisons.reduce((acc, f) => acc + f.iou, 0);
            avgIoU = Math.round((sumIoU / comparison.floorComparisons.length) * 1000) / 1000;
            maxDeltaAreaM2 = Math.max(...comparison.floorComparisons.map((f) => f.deltaAreaM2));
          }

          return {
            index: idx,
            fundaUrl: record.funda_url,
            query,
            typology,
            success: true,
            durationMs,
            pandId: evaluation.pandId,
            vboId: evaluation.telemetry.vboId,
            oppervlakteVboM2: evaluation.telemetry.oppervlakteVboM2,
            groundNapM: evaluation.telemetry.groundNapM,
            eavesNapM: evaluation.telemetry.eavesNapM,
            ridgeNapM: evaluation.telemetry.ridgeNapM,
            perceelnummer: evaluation.telemetry.perceelnummer !== undefined ? String(evaluation.telemetry.perceelnummer) : undefined,
            calculatedFloorsCount: evaluation.calculatedFloors.length,
            overallMatch: comparison?.overallMatch ?? true,
            avgIoU,
            maxDeltaAreaM2,
          };
        } catch (err) {
          lastError = err as Error;
        }
      }

      // Indien na retries gefaald:
      return {
        index: idx,
        fundaUrl: record.funda_url,
        query,
        typology,
        success: false,
        error: lastError?.message || 'Onbekende evaluatiefout',
        durationMs: 0,
      };
    };

    const worker = async () => {
      while (nextIndex < total) {
        const currentIndex = nextIndex++;
        const record = records[currentIndex];

        if (this.delayMs > 0 && currentIndex > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.delayMs));
        }

        const itemResult = await executeItemWithRetry(record, currentIndex);
        results[currentIndex] = itemResult;

        completed++;
        if (itemResult.success) {
          successful++;
        } else {
          failed++;
        }

        if (this.onProgress) {
          this.onProgress({
            total,
            completed,
            successful,
            failed,
            lastCompleted: itemResult,
            elapsedMs: Date.now() - startTime,
          });
        }
      }
    };

    const workerCount = Math.min(this.concurrency, total);
    const workerPromises = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workerPromises);

    const totalDurationMs = Date.now() - startTime;
    return this.aggregateResults(results, totalDurationMs);
  }

  /**
   * Aggregeert meetwaarden, percentielen en typologie-statistieken
   */
  private aggregateResults(results: BatchItemResult[], totalDurationMs: number): BatchSummaryResult {
    const totalRecords = results.length;
    const successfulCount = results.filter((r) => r.success).length;
    const failedCount = totalRecords - successfulCount;

    const durations = results
      .filter((r) => r.success && r.durationMs > 0)
      .map((r) => r.durationMs)
      .sort((a, b) => a - b);

    const avgDuration =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

    const p50DurationMs =
      durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
    const p95DurationMs =
      durations.length > 0
        ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]
        : 0;

    // Typologie uitsplitsing
    const typologyBreakdown: Record<string, TypologyStats> = {};

    for (const res of results) {
      if (!typologyBreakdown[res.typology]) {
        typologyBreakdown[res.typology] = {
          total: 0,
          successful: 0,
          failed: 0,
          avgIoU: 0,
          avgDeltaAreaM2: 0,
          avgDurationMs: 0,
        };
      }

      const st = typologyBreakdown[res.typology];
      st.total++;
      if (res.success) {
        st.successful++;
      } else {
        st.failed++;
      }
    }

    // Gemiddelden per typologie berekenen
    for (const [typology, st] of Object.entries(typologyBreakdown)) {
      const typResults = results.filter((r) => r.typology === typology && r.success);
      if (typResults.length > 0) {
        const sumDuration = typResults.reduce((acc, r) => acc + r.durationMs, 0);
        st.avgDurationMs = Math.round(sumDuration / typResults.length);

        const iouResults = typResults.filter((r) => r.avgIoU !== undefined);
        if (iouResults.length > 0) {
          const sumIoU = iouResults.reduce((acc, r) => acc + (r.avgIoU || 0), 0);
          st.avgIoU = Math.round((sumIoU / iouResults.length) * 1000) / 1000;
        }

        const deltaResults = typResults.filter((r) => r.maxDeltaAreaM2 !== undefined);
        if (deltaResults.length > 0) {
          const sumDelta = deltaResults.reduce((acc, r) => acc + (r.maxDeltaAreaM2 || 0), 0);
          st.avgDeltaAreaM2 = Math.round((sumDelta / deltaResults.length) * 100) / 100;
        }
      }
    }

    return {
      totalRecords,
      successfulCount,
      failedCount,
      totalDurationMs,
      averageDurationPerRecordMs: avgDuration,
      p50DurationMs,
      p95DurationMs,
      typologyBreakdown,
      results,
    };
  }
}
