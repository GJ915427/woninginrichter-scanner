import * as fs from 'fs';
import * as path from 'path';
import { BatchPipelineRunner, BatchProgress } from '../src/domain/pipeline/batch-pipeline-runner';
import { LivePipelineEvaluator } from '../src/domain/pipeline/live-pipeline-evaluator';

async function main() {
  console.log('================================================================================');
  console.log('🏛️  LIVE OPEN DATA PIPELINE: 130 REFERENTIEWONINGEN BATCH SWEEP');
  console.log('================================================================================\n');

  const fixturePath = path.resolve(__dirname, '../tests/fixtures/benchmark-ground-truth-130.json');
  if (!fs.existsSync(fixturePath)) {
    console.error('[-] Fout: Fixture bestand niet gevonden:', fixturePath);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
  const allRecords = Array.isArray(rawData) ? rawData : rawData.records || [];

  // Argument parsing (optionele --limit of --concurrency)
  const args = process.argv.slice(2);
  let limit = allRecords.length;
  let concurrency = 5;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
    }
    if (args[i] === '--concurrency' && args[i + 1]) {
      concurrency = parseInt(args[i + 1], 10);
    }
  }

  const targetRecords = allRecords.slice(0, limit);
  console.log(`📦 Te verwerken records : ${targetRecords.length} van ${allRecords.length}`);
  console.log(`⚡ Concurrency worker pool: ${concurrency} parallel`);
  console.log(`📡 Openbare bronnen      : PDOK Locatieserver, Kadaster BAG v2, 3D BAG, BGT, DKK, AHN, EP-Online\n`);

  const evaluator = new LivePipelineEvaluator();

  const runner = new BatchPipelineRunner({
    concurrency,
    delayMs: 25,
    maxRetries: 1,
    evaluator,
    onProgress: (p: BatchProgress) => {
      const pct = Math.floor((p.completed / p.total) * 100);
      const last = p.lastCompleted;
      const statusIcon = last?.success ? '✅' : '❌';
      const durationStr = last ? `${last.durationMs}ms` : '';
      const iouStr = last?.avgIoU !== undefined ? `| IoU: ${(last.avgIoU * 100).toFixed(1)}%` : '';
      const vboStr = last?.oppervlakteVboM2 ? `| VBO: ${last.oppervlakteVboM2}m²` : '';

      console.log(
        `[${String(p.completed).padStart(3, ' ')}/${p.total}] (${String(pct).padStart(3, ' ')}%) ${statusIcon} ` +
        `${(last?.typology || '').padEnd(16, ' ')} | ${(last?.query || '').padEnd(35, ' ')} ` +
        `[${durationStr.padStart(6, ' ')}] ${iouStr} ${vboStr}`
      );
    },
  });

  const startTime = Date.now();
  const summary = await runner.runBatch(targetRecords);
  const totalDurationSec = (summary.totalDurationMs / 1000).toFixed(2);

  console.log('\n================================================================================');
  console.log('📊 LIVE PIPELINE SWEEP SCORECARD');
  console.log('================================================================================\n');

  console.log(`- Totaal Verwerkt  : ${summary.totalRecords} adressen`);
  console.log(`- Geslaagd         : ${summary.successfulCount} (${((summary.successfulCount / summary.totalRecords) * 100).toFixed(1)}%)`);
  console.log(`- Gefaald          : ${summary.failedCount}`);
  console.log(`- Totale Duur      : ${totalDurationSec} seconden`);
  console.log(`- Gem. Latency     : ${summary.averageDurationPerRecordMs} ms / woning`);
  console.log(`- Mediaan (p50)    : ${summary.p50DurationMs} ms`);
  console.log(`- 95e percentiel   : ${summary.p95DurationMs} ms\n`);

  console.log('### Uitsplitsing per Woningtypologie:\n');
  console.log('| Typologie | Totaal | Geslaagd | Gefaald | Gem. Latency | Gem. IoU | Max Opp. Afwijking |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :---: | :---: |');

  for (const [typ, stats] of Object.entries(summary.typologyBreakdown)) {
    const iouStr = stats.avgIoU > 0 ? `${(stats.avgIoU * 100).toFixed(1)}%` : 'N/A';
    const deltaStr = stats.avgDeltaAreaM2 > 0 ? `±${stats.avgDeltaAreaM2.toFixed(1)} m²` : '0 m²';
    console.log(
      `| ${typ.padEnd(20, ' ')} | ${String(stats.total).padStart(6, ' ')} | ${String(stats.successful).padStart(8, ' ')} | ` +
      `${String(stats.failed).padStart(7, ' ')} | ${String(stats.avgDurationMs).padStart(10, ' ')}ms | ` +
      `${iouStr.padStart(8, ' ')} | ${deltaStr.padStart(18, ' ')} |`
    );
  }

  // Schrijf JSON samenvatting weg
  const outputPath = path.resolve(__dirname, '../tests/fixtures/batch-sweep-summary.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary: {
          totalRecords: summary.totalRecords,
          successfulCount: summary.successfulCount,
          failedCount: summary.failedCount,
          totalDurationMs: summary.totalDurationMs,
          averageDurationPerRecordMs: summary.averageDurationPerRecordMs,
          p50DurationMs: summary.p50DurationMs,
          p95DurationMs: summary.p95DurationMs,
        },
        typologyBreakdown: summary.typologyBreakdown,
        results: summary.results,
      },
      null,
      2
    )
  );

  console.log(`\n💾 Gedetailleerd JSON rapport opgeslagen in: tests/fixtures/batch-sweep-summary.json\n`);
}

main().catch((err) => {
  console.error('[-] Onherstelbare fout in batch sweep:', err);
  process.exit(1);
});
