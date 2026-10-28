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
  classifyCognitiveTypologyWithOnlineSearch,
  EnrichedProductEntity,
  CanonicalDomain,
  OnlineEnrichmentOptions,
} from '../src/domain/search/v2/cognitive-typology-classifier';

interface CommandLineOptions {
  dryRun: boolean;
  pageSize: number;
  dateFrom?: string;
  originFilter?: string[];
  enableOnlineSearch: boolean;
  onlineCachePath: string;
  checkpointFilePath?: string;
  outputCatalogPath: string;
  outputReportPath: string;
  help: boolean;
}

export function loadOnlineSearchCache(filePath: string): Map<string, any> {
  const cache = new Map<string, any>();
  if (!fs.existsSync(filePath)) {
    return cache;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        cache.set(k, v);
      }
    }
  } catch (err: any) {
    console.warn(`[OnlineSearchCache] Kon cache '${filePath}' niet laden (${err.message}), start met lege cache.`);
  }
  return cache;
}

export function saveOnlineSearchCache(filePath: string, cache: Map<string, any>): void {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const obj: Record<string, any> = {};
    for (const [k, v] of cache.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8');
    console.log(`✓ Online search cache geserialiseerd (${cache.size} entries): ${filePath}`);
  } catch (err: any) {
    console.warn(`[OnlineSearchCache] Kon cache niet opslaan: ${err.message}`);
  }
}

// Concrete, rate-limited web search fetcher voor productie ingestion
let lastSearchTimestamp = 0;
export async function defaultWebSearchFetcher(query: string): Promise<Array<{ title?: string; snippet: string }>> {
  // Rate-limiting: minimaal 250ms pauze tussen externe zoekverzoeken
  const now = Date.now();
  const timeSinceLast = now - lastSearchTimestamp;
  if (timeSinceLast < 250) {
    await new Promise(resolve => setTimeout(resolve, 250 - timeSinceLast));
  }
  lastSearchTimestamp = Date.now();

  const encoded = encodeURIComponent(query);
  const endpoint = `https://html.duckduckgo.com/html/?q=${encoded}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AntigravityCPQ/2.0',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();
    // Eenvoudige regex extractie van snippet teksten uit zoekresultaten
    const snippets: Array<{ title?: string; snippet: string }> = [];
    const snippetMatches = html.match(/<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/gi) || [];
    for (const match of snippetMatches.slice(0, 3)) {
      const clean = match.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
      if (clean) snippets.push({ snippet: clean });
    }

    return snippets;
  } catch (err: any) {
    throw new Error(`Web search gefaald voor '${query}': ${err.message}`);
  }
}

function parseCommandLineArgs(args: string[]): CommandLineOptions {
  const options: CommandLineOptions = {
    dryRun: false,
    pageSize: 50,
    originFilter: ['Winkel GSW BV'],
    enableOnlineSearch: true,
    onlineCachePath: 'data/online_enrichment_cache.json',
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
    } else if (arg === '--origin-filter' && args[i + 1]) {
      const val = args[i + 1].trim();
      if (val.toLowerCase() === 'all' || val.toLowerCase() === 'none') {
        options.originFilter = undefined;
      } else {
        options.originFilter = val.split(',').map(s => s.trim()).filter(Boolean);
      }
      i++;
    } else if (arg === '--no-origin-filter') {
      options.originFilter = undefined;
    } else if (arg === '--enable-online-search') {
      options.enableOnlineSearch = true;
    } else if (arg === '--no-online-search') {
      options.enableOnlineSearch = false;
    } else if (arg === '--online-cache' && args[i + 1]) {
      options.onlineCachePath = args[i + 1];
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
  --origin-filter <val>     Filter op orderherkomst (standaard: 'Winkel GSW BV'; gebruik 'all' voor alles)
  --no-origin-filter        Schakel herkomstfiltering uit (laat alle BV's door)
  --enable-online-search    Schakel systematische web search enrichment in (standaard: aan)
  --no-online-search        Schakel externe web search uit (gebruik alleen lokale taxonomie)
  --online-cache <pad>      Pad naar JSON zoekcache (standaard: data/online_enrichment_cache.json)
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
  console.log(`Herkomst Filter:     ${options.originFilter ? options.originFilter.join(', ') : 'ALLE ORDERS (geen filter)'}`);
  console.log(`Online Search:       ${options.enableOnlineSearch ? 'INGESCHAKELD (>99% kwaliteitslaag)' : 'UITGESCHAKELD'}`);
  if (options.enableOnlineSearch) console.log(`Search Cache:        ${options.onlineCachePath}`);
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
      originFilter: options.originFilter,
      checkpointFilePath: options.checkpointFilePath,
    });

    console.log(`✓ Orders gescand:       ${harvestResult.totalOrdersScanned}`);
    console.log(`✓ Orderregels verwerkt: ${harvestResult.totalOrderLinesProcessed}`);
    console.log(`✓ Unieke artikelen:     ${harvestResult.uniqueArticlesFound}`);

    // 2. Cognitieve Typologie Classificatie met Systematische Online Search
    console.log('\n[2/3] 🧠 Uitvoeren van cognitieve typologie classificatie & web enrichment...');
    const onlineCache = loadOnlineSearchCache(options.onlineCachePath);
    const enrichedEntities: EnrichedProductEntity[] = [];

    let processedCount = 0;
    for (const article of harvestResult.articles) {
      const enriched = await classifyCognitiveTypologyWithOnlineSearch(article, {
        searchFn: defaultWebSearchFetcher,
        cache: onlineCache,
        enabled: options.enableOnlineSearch,
      });
      enrichedEntities.push(enriched);
      processedCount++;
      if (processedCount % 10 === 0 || processedCount === harvestResult.articles.length) {
        process.stdout.write(`\r  → Verrijkt: ${processedCount}/${harvestResult.articles.length} artikelen...`);
      }
    }
    console.log('');

    // Statistieken berekenen
    const domainCounts: Record<string, number> = {};
    const roleCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    let highConfidenceCount = 0;
    let hitlReviewCount = 0;

    for (const entity of enrichedEntities) {
      domainCounts[entity.domain] = (domainCounts[entity.domain] || 0) + 1;
      roleCounts[entity.itemRole] = (roleCounts[entity.itemRole] || 0) + 1;
      const src = entity.enrichmentSource || 'LOCAL';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;

      if (entity.requiresHitlReview) {
        hitlReviewCount++;
      } else {
        highConfidenceCount++;
      }
    }

    console.log(`✓ Direct goedgekeurd (confidence >= 0.95): ${highConfidenceCount}`);
    console.log(`✓ Gemarkeerd voor HITL Review Cockpit:      ${hitlReviewCount}`);
    for (const [src, cnt] of Object.entries(sourceCounts)) {
      console.log(`  • Bron '${src}': ${cnt} artikelen`);
    }

    // 3. Exporteren van resultaten & Cache Serialisatie
    console.log('\n[3/3] 💾 Exporteren van catalogus, cache en auditrapport...');
    if (!options.dryRun) {
      // JSON Catalogus
      const catalogDir = path.dirname(options.outputCatalogPath);
      fs.mkdirSync(catalogDir, { recursive: true });
      fs.writeFileSync(options.outputCatalogPath, JSON.stringify(enrichedEntities, null, 2), 'utf-8');
      console.log(`✓ JSON catalogus opgeslagen: ${options.outputCatalogPath}`);

      // Online Search Cache Atomaire Flush
      if (options.enableOnlineSearch) {
        saveOnlineSearchCache(options.onlineCachePath, onlineCache);
      }

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
