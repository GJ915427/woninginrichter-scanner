import { describe, it, expect, vi } from 'vitest';
import { BatchPipelineRunner } from '@/domain/pipeline/batch-pipeline-runner';
import { LivePipelineEvaluator, LivePipelineEvaluation } from '@/domain/pipeline/live-pipeline-evaluator';

describe('BatchPipelineRunner', () => {
  const createMockEvaluation = (pandId: string, street: string): LivePipelineEvaluation => ({
    pandId,
    address: { street, houseNumber: '1', postalCode: '1234AB', city: 'Teststad' },
    telemetry: {
      pandId,
      vboId: 'vbo-' + pandId,
      bagFootprint2D: [[0, 0], [10, 0], [10, 10], [0, 10]],
      bouwjaar: 1985,
      oppervlakteVboM2: 120,
      groundNapM: 2.5,
      eavesNapM: 6.0,
      ridgeNapM: 9.5,
      perceelnummer: '1001',
    },
    calculatedFloors: [
      {
        level: 0,
        name: 'Begane grond',
        polygon: [[0, 0], [10, 0], [10, 10], [0, 10]],
        areaM2: 100,
      },
    ],
  });

  it('VM-SWP-01: respecteert strikt de concurrency pool grens (C=3)', async () => {
    let activeWorkers = 0;
    let maxObservedActive = 0;

    const mockEvaluator = {
      evaluateAddress: vi.fn().mockImplementation(async (query: string) => {
        activeWorkers++;
        if (activeWorkers > maxObservedActive) {
          maxObservedActive = activeWorkers;
        }
        await new Promise((r) => setTimeout(r, 30));
        activeWorkers--;
        return createMockEvaluation('pand-1', query);
      }),
      evaluateBenchmarkRecord: vi.fn(),
    } as unknown as LivePipelineEvaluator;

    const runner = new BatchPipelineRunner({
      concurrency: 3,
      delayMs: 0,
      maxRetries: 0,
      evaluator: mockEvaluator,
    });

    const testRecords = Array.from({ length: 9 }, (_, i) => ({
      address: { street: `Straat ${i}`, houseNumber: '1', city: 'Teststad' },
      typologie: 'Tussenwoning',
    }));

    const summary = await runner.runBatch(testRecords);

    expect(maxObservedActive).toBeLessThanOrEqual(3);
    expect(summary.totalRecords).toBe(9);
    expect(summary.successfulCount).toBe(9);
    expect(summary.failedCount).toBe(0);
  });

  it('VM-SWP-02: isoleert fouten zodat één haperend adres de batch niet afbreekt', async () => {
    const mockEvaluator = {
      evaluateAddress: vi.fn().mockImplementation(async (query: string) => {
        if (query.includes('FoutAdres')) {
          throw new Error('PDOK 500 Internal Server Error');
        }
        return createMockEvaluation('pand-ok', query);
      }),
      evaluateBenchmarkRecord: vi.fn(),
    } as unknown as LivePipelineEvaluator;

    const runner = new BatchPipelineRunner({
      concurrency: 2,
      delayMs: 0,
      maxRetries: 0,
      evaluator: mockEvaluator,
    });

    const records = [
      { address: { street: 'Goed 1', houseNumber: '1', city: 'Teststad' }, typologie: 'Tussenwoning' },
      { address: { street: 'FoutAdres', houseNumber: '2', city: 'Teststad' }, typologie: 'Hoekwoning' },
      { address: { street: 'Goed 2', houseNumber: '3', city: 'Teststad' }, typologie: 'Twee-onder-een-kap' },
    ];

    const summary = await runner.runBatch(records);

    expect(summary.totalRecords).toBe(3);
    expect(summary.successfulCount).toBe(2);
    expect(summary.failedCount).toBe(1);
    expect(summary.results[1].success).toBe(false);
    expect(summary.results[1].error).toContain('PDOK 500');
    expect(summary.results[0].success).toBe(true);
    expect(summary.results[2].success).toBe(true);
  });

  it('VM-SWP-03: aggregeert typologische statistieken en percentielen correct', async () => {
    const mockEvaluator = {
      evaluateBenchmarkRecord: vi.fn().mockImplementation(async (record: any) => {
        const query = record.address.street;
        const evaluation = createMockEvaluation('pand-' + query, query);
        const comparison = {
          overallMatch: true,
          floorComparisons: [
            { level: 0, iou: 0.92, hausdorffDistanceM: 0.15, deltaAreaM2: 1.2 },
          ],
        };
        return { evaluation, comparison };
      }),
      evaluateAddress: vi.fn(),
    } as unknown as LivePipelineEvaluator;

    const runner = new BatchPipelineRunner({
      concurrency: 2,
      delayMs: 0,
      maxRetries: 0,
      evaluator: mockEvaluator,
    });

    const records = [
      {
        address: { street: 'Tussen 1', houseNumber: '1', city: 'Teststad' },
        typologie: 'Tussenwoning',
        ground_truth_floors: [{ level: 0, outerPolygonM: [[0, 0], [10, 0], [10, 10], [0, 10]] as Array<[number, number]>, measuredGrossAreaM2: 100 }],
      },
      {
        address: { street: 'Tussen 2', houseNumber: '2', city: 'Teststad' },
        typologie: 'Tussenwoning',
        ground_truth_floors: [{ level: 0, outerPolygonM: [[0, 0], [10, 0], [10, 10], [0, 10]] as Array<[number, number]>, measuredGrossAreaM2: 100 }],
      },
      {
        address: { street: 'Hoek 1', houseNumber: '3', city: 'Teststad' },
        typologie: 'Hoekwoning',
        ground_truth_floors: [{ level: 0, outerPolygonM: [[0, 0], [10, 0], [10, 10], [0, 10]] as Array<[number, number]>, measuredGrossAreaM2: 100 }],
      },
    ];

    const summary = await runner.runBatch(records);

    expect(summary.totalRecords).toBe(3);
    expect(summary.successfulCount).toBe(3);
    expect(summary.typologyBreakdown['Tussenwoning'].total).toBe(2);
    expect(summary.typologyBreakdown['Tussenwoning'].successful).toBe(2);
    expect(summary.typologyBreakdown['Tussenwoning'].avgIoU).toBe(0.92);
    expect(summary.typologyBreakdown['Hoekwoning'].total).toBe(1);
    expect(summary.typologyBreakdown['Hoekwoning'].successful).toBe(1);
  });

  it('herstelt met retry bij een initiële tijdelijke fout', async () => {
    let callCount = 0;
    const mockEvaluator = {
      evaluateAddress: vi.fn().mockImplementation(async (query: string) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('504 Gateway Timeout');
        }
        return createMockEvaluation('pand-retry', query);
      }),
      evaluateBenchmarkRecord: vi.fn(),
    } as unknown as LivePipelineEvaluator;

    const runner = new BatchPipelineRunner({
      concurrency: 1,
      delayMs: 0,
      maxRetries: 1,
      evaluator: mockEvaluator,
    });

    const records = [
      { address: { street: 'HerstelStraat', houseNumber: '1', city: 'Teststad' }, typologie: 'Vrijstaand' },
    ];

    const summary = await runner.runBatch(records);

    expect(callCount).toBe(2);
    expect(summary.successfulCount).toBe(1);
    expect(summary.failedCount).toBe(0);
    expect(summary.results[0].success).toBe(true);
  });
});
