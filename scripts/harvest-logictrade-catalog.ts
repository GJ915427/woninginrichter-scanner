/**
 * LogicTrade Catalogus Batch Ingest Runner (CLI)
 * Gebruik:
 *   npx tsx scripts/harvest-logictrade-catalog.ts --limit-pages 2 (Proefdraai van 2 pagina's = 200 artikelen)
 *   npx tsx scripts/harvest-logictrade-catalog.ts --resume (Hervatten vanaf laatste checkpoint)
 *   npx tsx scripts/harvest-logictrade-catalog.ts (Volledige import met rate-limit bescherming)
 */

import { harvestCatalogRange, getHarvestCheckpoint } from '../src/lib/logictrade/harvest-service';

async function main() {
  const args = process.argv.slice(2);
  let resume = false;
  let limitPages: number | undefined;
  let pageSize = 100;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--resume') {
      resume = true;
    } else if (args[i] === '--limit-pages' && args[i + 1]) {
      limitPages = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      pageSize = parseInt(args[i + 1], 10);
      i++;
    }
  }

  console.log('='.repeat(65));
  console.log('📦 LogicTrade Catalogus Harvester & Supabase Importer (Tranche 3B)');
  console.log('='.repeat(65));
  console.log(`Pacing delay: 150ms per pagina (~400 req/min vs vendor limiet 1020 req/min)`);
  console.log(`PageSize: ${pageSize} artikelen per call`);
  if (limitPages) console.log(`Limit: max ${limitPages} pagina's voor deze run`);
  if (resume) console.log(`Modus: Hervatten vanaf laatste checkpoint`);

  const initialCheckpoint = await getHarvestCheckpoint();
  console.log(`Huidig checkpoint in Supabase: pagina ${initialCheckpoint.lastPage}`);

  const startTime = Date.now();

  try {
    const result = await harvestCatalogRange({
      pageSize,
      resume,
      limitPages,
      onProgress: ({ currentPage, totalPages, batchCount, cumulativeSynced }) => {
        const pct = ((currentPage / totalPages) * 100).toFixed(1);
        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(
          `[Harvester] [Pagina ${currentPage}/${totalPages}] (${pct}%) +${batchCount} artikelen (Cumulatief: ${cumulativeSynced}) | ${elapsedSec}s`
        );
      }
    });

    const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('='.repeat(65));
    console.log('✅ Synchronisatie Succesvol Afgerond!');
    console.log(`Verwerkte pagina's: ${result.totalPagesProcessed}`);
    console.log(`Totaal gesynchroniseerd: ${result.totalProductsSynced} artikelen`);
    console.log(`Laatste pagina opgeslagen: ${result.lastPage}`);
    console.log(`Catalogus compleet: ${result.isComplete ? 'JA' : 'NEE (gepauseerd of limiet bereikt)'}`);
    console.log(`Totale doorlooptijd: ${totalSeconds} seconden`);
    console.log('='.repeat(65));
  } catch (err: any) {
    console.error('❌ Fout tijdens catalogus synchronisatie:', err.message);
    process.exit(1);
  }
}

main();
