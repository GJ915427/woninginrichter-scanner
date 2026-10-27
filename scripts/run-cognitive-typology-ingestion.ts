/**
 * V2 Cognitive Producttypologie Ingestion & 2-Jaars Order-Harvesting Pipeline (CLI Runner)
 * 
 * Gebruik:
 *   npx tsx scripts/run-cognitive-typology-ingestion.ts --dry-run
 *   npx tsx scripts/run-cognitive-typology-ingestion.ts --page-size 50 --checkpoint data/harvest_checkpoint.json
 *   npx tsx scripts/run-cognitive-typology-ingestion.ts --output-catalog data/harvested_2yr_typology_catalog.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { harvest2YearOrders, Harvest2YrOptions } from '../src/lib/logictrade/harvest-2yr-orders';
import {
  classifyCognitiveTypology,
  EnrichedProductEntity,
  CanonicalDomain,
} from '../src/domain/search/v2/cognitive-typology-classifier';

interface CommandLineOptions {
  dryRun: boolean;
  pageSize: number;
  dateFrom?: string;
  checkpointFilePath?: string;
  outputCatalogPath: string;
  outputReportPath: string;
  help: boolean;
}

function parseCommandLineArgs(args: string[]): CommandLineOptions {
  const options: CommandLineOptions = {
    dryRun: false,
    pageSize: 50,
    outputCatalogPath: 'data/harvested_2yr_typology_catalog.json',
    outputReportPath: 'data/harvested_2yr_typology_audit_report.md',
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--page-size' && args[i + 1]) {
      const parsed = parseInt(args[i + 1], 10);
      options.pageSize = !isNaN(parsed) && parsed > 0 ? parsed : 50;
      i++;
    } else if (arg === '--date-from' && args[i + 1]) {
      options.dateFrom = args[i + 1];
      i++;
    } else if (arg === '--checkpoint' && args[i + 1]) {
      options.checkpointFilePath = args[i + 1];
      i++;
    } else if (arg === '--output-catalog' && args[i + 1]) {
      options.outputCatalogPath = args[i + 1];
      i++;
    } else if (arg === '--output-report' && args[i + 1]) {
      options.outputReportPath = args[i + 1];
      i++;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Gebruik: npx tsx scripts/run-cognitive-typology-ingestion.ts [opties]

Opties:
  --dry-run                 Voer een proefdraai uit zonder schijfpersistentie
  --page-size <n>           Aantal orders per REST API pagina (standaard: 50)
  --date-from <iso-date>    Startdatum voor orderhistorie (standaard: 2 jaar geleden)
  --checkpoint <pad>        Pad naar JSON checkpointbestand
  --output-catalog <pad>    Pad voor de geëxporteerde JSON catalogus (standaard: data/harvested_2yr_typology_catalog.json)
  --output-report <pad>     Pad voor het Markdown auditrapport (standaard: data/harvested_2yr_typology_audit_report.md)
  --help, -h                Toon dit helpscherm
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseCommandLineArgs(args);

  if (options.help) {
    printHelp();
    return;
  }

  console.log('='.repeat(70));
  console.log('🏛️  V2 Cognitive Producttypologie Ingestion & 2-Jaars Pipeline');
  console.log('='.repeat(70));
  console.log(`Modus:               ${options.dryRun ? 'DRY RUN (geen schijfpersistentie)' : 'PRODUCTIE HARVEST'}`);
  console.log(`Paging Grootte:      ${options.pageSize} orders per call`);
  if (options.dateFrom) console.log(`Datum Vanaf:         ${options.dateFrom}`);
  if (options.checkpointFilePath) console.log(`Checkpoint Bestand:  ${options.checkpointFilePath}`);
  console.log(`Catalogus Uitvoer:   ${options.outputCatalogPath}`);
  console.log(`Rapport Uitvoer:     ${options.outputReportPath}`);
  console.log('='.repeat(70));

  const startTime = Date.now();

  try {
    // 1. Oogsten van historische verkooporders
    console.log('\n[1/3] 📡 Oogsten van historische orders en orderregels...');
    const harvestResult = await harvest2YearOrders({
      dryRun: options.dryRun,
      pageSize: options.pageSize,
      dateFrom: options.dateFrom,
      checkpointFilePath: options.checkpointFilePath,
    });

    console.log(`✓ Orders gescand:       ${harvestResult.totalOrdersScanned}`);
    console.log(`✓ Orderregels verwerkt: ${harvestResult.totalOrderLinesProcessed}`);
    console.log(`✓ Unieke artikelen:     ${harvestResult.uniqueArticlesFound}`);

    // 2. Cognitieve Typologie Classificatie
    console.log('\n[2/3] 🧠 Uitvoeren van deterministische cognitieve typologie classificatie...');
    const enrichedEntities: EnrichedProductEntity[] = harvestResult.articles.map(article =>
      classifyCognitiveTypology(article)
    );

    // Statistieken berekenen
    const domainCounts: Record<string, number> = {};
    const roleCounts: Record<string, number> = {};
    let highConfidenceCount = 0;
    let hitlReviewCount = 0;

    for (const entity of enrichedEntities) {
      domainCounts[entity.domain] = (domainCounts[entity.domain] || 0) + 1;
      roleCounts[entity.itemRole] = (roleCounts[entity.itemRole] || 0) + 1;
      if (entity.requiresHitlReview) {
        hitlReviewCount++;
      } else {
        highConfidenceCount++;
      }
    }

    console.log(`✓ Direct goedgekeurd (confidence >= 0.95): ${highConfidenceCount}`);
    console.log(`✓ Gemarkeerd voor HITL Review Cockpit:      ${hitlReviewCount}`);

    // 3. Exporteren van resultaten
    console.log('\n[3/3] 💾 Exporteren van catalogus en auditrapport...');
    if (!options.dryRun) {
      // JSON Catalogus
      const catalogDir = path.dirname(options.outputCatalogPath);
      fs.mkdirSync(catalogDir, { recursive: true });
      fs.writeFileSync(options.outputCatalogPath, JSON.stringify(enrichedEntities, null, 2), 'utf-8');
      console.log(`✓ JSON catalogus opgeslagen: ${options.outputCatalogPath}`);

      // Markdown Audit Rapport
      const reportDir = path.dirname(options.outputReportPath);
      fs.mkdirSync(reportDir, { recursive: true });

      const reportContent = generateMarkdownAuditReport({
        totalOrders: harvestResult.totalOrdersScanned,
        totalLines: harvestResult.totalOrderLinesProcessed,
        uniqueArticles: harvestResult.uniqueArticlesFound,
        highConfidenceCount,
        hitlReviewCount,
        domainCounts,
        roleCounts,
        entities: enrichedEntities,
      });

      fs.writeFileSync(options.outputReportPath, reportContent, 'utf-8');
      console.log(`✓ Markdown auditrapport opgeslagen: ${options.outputReportPath}`);
    } else {
      console.log('✓ Dry-run voltooid: opslag overgeslagen.');
    }

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(70));
    console.log(`🎉 Pipeline Succesvol Voltooid in ${elapsedSeconds}s!`);
    console.log('='.repeat(70));
  } catch (err: any) {
    console.error('\n❌ Fout tijdens uitvoering van typologie-pipeline:', err.message);
    process.exit(1);
  }
}

interface ReportStats {
  totalOrders: number;
  totalLines: number;
  uniqueArticles: number;
  highConfidenceCount: number;
  hitlReviewCount: number;
  domainCounts: Record<string, number>;
  roleCounts: Record<string, number>;
  entities: EnrichedProductEntity[];
}

function generateMarkdownAuditReport(stats: ReportStats): string {
  const hitlEntities = stats.entities.filter(e => e.requiresHitlReview);
  const topMainEntities = stats.entities
    .filter(e => e.itemRole === 'CONFIGURABLE_MAIN')
    .sort((a, b) => b.historicalOccurrences - a.historicalOccurrences)
    .slice(0, 15);

  return `# Auditrapport: 2-Jaars LogicTrade Order-Harvesting & Cognitieve Typologie

**Gegenereerd op:** ${new Date().toISOString()}  
**Totaal geanalyseerde orders:** ${stats.totalOrders}  
**Totaal geanalyseerde orderregels:** ${stats.totalLines}  
**Unieke maatwerkartikelen:** ${stats.uniqueArticles}  

---

## 1. Executive Summary & KPI's

| Metric | Aantal | Percentage |
| :--- | :--- | :--- |
| **Direct Geclassificeerd (Confidence $\\ge 0.95$)** | ${stats.highConfidenceCount} | ${((stats.highConfidenceCount / Math.max(1, stats.uniqueArticles)) * 100).toFixed(1)}% |
| **Gemarkeerd voor HITL Review Cockpit** | ${stats.hitlReviewCount} | ${((stats.hitlReviewCount / Math.max(1, stats.uniqueArticles)) * 100).toFixed(1)}% |
| **Configureerbare Hoofdproducten (\`CONFIGURABLE_MAIN\`)** | ${stats.roleCounts['CONFIGURABLE_MAIN'] || 0} | ${(((stats.roleCounts['CONFIGURABLE_MAIN'] || 0) / Math.max(1, stats.uniqueArticles)) * 100).toFixed(1)}% |
| **Stalen & Monsters (\`SAMPLE\`)** | ${stats.roleCounts['SAMPLE'] || 0} | ${(((stats.roleCounts['SAMPLE'] || 0) / Math.max(1, stats.uniqueArticles)) * 100).toFixed(1)}% |
| **Diensten & Arbeid (\`LABOR_SERVICE\`)** | ${stats.roleCounts['LABOR_SERVICE'] || 0} | ${(((stats.roleCounts['LABOR_SERVICE'] || 0) / Math.max(1, stats.uniqueArticles)) * 100).toFixed(1)}% |

---

## 2. Domeindistributie (Conform Domeinmodel Woninginrichting)

| Canoniek Domein | V2 Zoekmachine Categorie | Aantal Artikelen |
| :--- | :--- | :--- |
${Object.entries(stats.domainCounts)
  .map(([dom, count]) => `| \`${dom}\` | \`${dom === 'GORDIJNEN' || dom === 'RAAMBEKLEDING' ? 'RAAMBEKLEDING' : dom === 'TRAPBEKLEDING' || dom === 'VLOEREN' ? 'VLOEREN' : dom}\` | ${count} |`)
  .join('\n')}

---

## 3. Top 15 Geconfigureerde Hoofdproducten (Empirische Ground Truth)

| Code | Naam | Typologie | Voorkomens | Capabilities | Maten (BxH mm) |
| :--- | :--- | :--- | :--- | :--- | :--- |
${topMainEntities
  .map(e => {
    const caps = e.capabilities.map(c => c.name).join(', ') || 'Standaard';
    const dims = e.observedDimensions
      ? `${e.observedDimensions.minWidthMm ?? '?'}-${e.observedDimensions.maxWidthMm ?? '?'} x ${e.observedDimensions.minHeightMm ?? '?'}-${e.observedDimensions.maxHeightMm ?? '?'}`
      : 'Geen maten';
    return `| \`${e.code}\` | ${e.name} | \`${e.productType}\` | ${e.historicalOccurrences} | ${caps} | ${dims} |`;
  })
  .join('\n')}

---

## 4. Artikelen ter Beoordeling in HITL Review Cockpit (${hitlEntities.length})

${
  hitlEntities.length === 0
    ? '_Geen artikelen met lage betrouwbaarheid aangetroffen. Alle artikelen voldoen aan de canonieke specificaties._'
    : hitlEntities
        .slice(0, 25)
        .map(
          e => `- **\`${e.code}\`** — ${e.name} (Leverancier: *${e.supplierName}*)  
  *Toegewezen:* \`${e.domain}\` / \`${e.productType}\` (Score: ${(e.classificationConfidence * 100).toFixed(0)}%)  
  *Motivering:* ${e.reasoning}`
        )
        .join('\n')
}
`;
}

// Start CLI runner indien direct aangeroepen
if (require.main === module || process.argv[1]?.includes('run-cognitive-typology-ingestion')) {
  main();
}
