import { loadEnvConfig } from '@next/env';
import {
  harvest2YearOrders,
  harvestQuotes,
  type LogicTradeOrderHeader,
  type LogicTradeQuoteHeader,
  type LogicTradeOrderLine,
} from '../src/lib/logictrade/harvest-2yr-orders';
import { resolveLogicTradeConnectionConfig } from '../src/lib/logictrade/connection-config';
import { OrderIntakeService, mapLogicTradeOrderToRawInput } from '../src/domain/orders/order-intake-service';
import { getSupabaseConfig, type SupabaseConfig } from '../src/lib/supabase/client';
import { ingestOrderTransaction } from '../src/lib/supabase/order-client';
import type { ResolvedProductEntity, IngestedOrderBundle } from '../src/types/order-intake';

export const BOOLEAN_FLAGS: ReadonlySet<string> = new Set([
  '--from-db',
  '--with-configuration',
  '--force',
  '--only-pending',
  '--full',
  '--help',
  '-h',
]);

export const VALUE_FLAGS: ReadonlySet<string> = new Set([
  '--delta-since',
  '--order-ids',
  '--type',
  '--years',
  '--year',
  '--start-after',
  '--batch-size',
  '--concurrency',
  '--max',
  '--cutoff-date',
  '--origin',
]);

export const ALL_FLAGS: ReadonlySet<string> = new Set([...BOOLEAN_FLAGS, ...VALUE_FLAGS]);

export interface IngestionCliOptions {
  isHelp?: boolean;
  isFromDb?: boolean;
  withConfiguration?: boolean;
  isForce?: boolean;
  isOnlyPending?: boolean;
  isFull?: boolean;
  deltaSince?: string;
  orderIds?: string[];
  type?: 'orders' | 'quotes' | 'all';
  years?: number;
  year?: string;
  startAfter?: string;
  batchSize?: number;
  concurrency?: number;
  maxCount?: number;
  cutoffDate?: string;
  origin?: string;
}

export function parseIngestionCliArgs(argv: string[] = process.argv.slice(2)): IngestionCliOptions {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { isHelp: true };
  }

  const rawValues = new Map<string, string>();
  const booleanPresent = new Set<string>();

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('-')) {
      const eqIdx = token.indexOf('=');
      let flagName = token;
      let flagValue: string | undefined = undefined;
      if (eqIdx !== -1) {
        flagName = token.slice(0, eqIdx);
        flagValue = token.slice(eqIdx + 1);
      }

      if (!ALL_FLAGS.has(flagName)) {
        throw new Error(`[CLI-ARG-01] Onbekende vlag: '${token}'.`);
      }

      if (BOOLEAN_FLAGS.has(flagName)) {
        if (eqIdx !== -1) {
          throw new Error(`[CLI-ARG-01] Boolean vlag '${flagName}' accepteert geen waarde (gezien: '${token}').`);
        }
        booleanPresent.add(flagName);
      } else if (VALUE_FLAGS.has(flagName)) {
        if (eqIdx !== -1) {
          if (!flagValue || flagValue.trim() === '' || flagValue.startsWith('--')) {
            throw new Error(`[CLI-ARG-03] Waarde ontbreekt of is leeg voor vlag '${flagName}'.`);
          }
          rawValues.set(flagName, flagValue);
        } else {
          if (i + 1 >= argv.length) {
            throw new Error(`[CLI-ARG-03] Waarde ontbreekt voor vlag '${flagName}'.`);
          }
          const nextVal = argv[i + 1];
          if (!nextVal || nextVal.trim() === '' || nextVal.startsWith('--')) {
            throw new Error(`[CLI-ARG-03] Waarde ontbreekt of is leeg voor vlag '${flagName}'.`);
          }
          rawValues.set(flagName, nextVal);
          i++;
        }
      }
    } else {
      throw new Error(`[CLI-ARG-02] Onverwacht positioneel argument: '${token}'.`);
    }
  }

  const isFromDb = booleanPresent.has('--from-db');
  const withConfiguration = booleanPresent.has('--with-configuration');
  const isForce = booleanPresent.has('--force');
  const isOnlyPending = booleanPresent.has('--only-pending');
  const isFull = booleanPresent.has('--full');

  const deltaSince = rawValues.get('--delta-since');
  const rawOrderIds = rawValues.get('--order-ids');
  const typeVal = rawValues.get('--type');
  const yearsVal = rawValues.get('--years');
  const yearVal = rawValues.get('--year');
  const startAfter = rawValues.get('--start-after');
  const batchSizeVal = rawValues.get('--batch-size');
  const concurrencyVal = rawValues.get('--concurrency');
  const maxVal = rawValues.get('--max');
  const cutoffDateVal = rawValues.get('--cutoff-date');
  const origin = rawValues.get('--origin');

  let orderIds: string[] | undefined = undefined;
  if (rawOrderIds !== undefined) {
    orderIds = rawOrderIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (orderIds.length === 0) {
      throw new Error(`[CLI-ARG-04] Vlag '--order-ids' vereist minimaal 1 geldig order ID.`);
    }
  }

  let maxCount: number | undefined = undefined;
  if (maxVal !== undefined) {
    if (!/^\d+$/.test(maxVal) || parseInt(maxVal, 10) <= 0) {
      throw new Error(`[CLI-ARG-08] Vlag '--max' vereist een positief geheel getal (> 0).`);
    }
    maxCount = parseInt(maxVal, 10);
  }

  let batchSize: number | undefined = undefined;
  if (batchSizeVal !== undefined) {
    if (!/^\d+$/.test(batchSizeVal) || parseInt(batchSizeVal, 10) <= 0) {
      throw new Error(`[CLI-ARG-08] Vlag '--batch-size' vereist een positief geheel getal (> 0).`);
    }
    batchSize = parseInt(batchSizeVal, 10);
  }

  let concurrency: number | undefined = undefined;
  if (concurrencyVal !== undefined) {
    if (!/^\d+$/.test(concurrencyVal) || parseInt(concurrencyVal, 10) <= 0) {
      throw new Error(`[CLI-ARG-08] Vlag '--concurrency' vereist een positief geheel getal (> 0).`);
    }
    concurrency = parseInt(concurrencyVal, 10);
  }

  let years: number | undefined = undefined;
  if (yearsVal !== undefined) {
    const num = Number(yearsVal.trim());
    if (!Number.isFinite(num) || num <= 0) {
      throw new Error(`[CLI-ARG-09] Vlag '--years' vereist een positief getal (> 0).`);
    }
    years = num;
  }

  let year: string | undefined = undefined;
  if (yearVal !== undefined) {
    if (!/^\d{4}$/.test(yearVal) || parseInt(yearVal, 10) < 2000 || parseInt(yearVal, 10) > 2100) {
      throw new Error(`[CLI-ARG-10] Vlag '--year' vereist een 4-cijferig jaartal tussen 2000 en 2100.`);
    }
    year = yearVal;
  }

  if (deltaSince !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(deltaSince) || Number.isNaN(Date.parse(deltaSince))) {
      throw new Error(`[CLI-ARG-11] Vlag '--delta-since' vereist een geldige ISO-datum (YYYY-MM-DD of ISO-8601).`);
    }
  }

  if (cutoffDateVal !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(cutoffDateVal) || Number.isNaN(Date.parse(cutoffDateVal))) {
      throw new Error(`[CLI-ARG-11] Vlag '--cutoff-date' vereist een geldige ISO-datum (YYYY-MM-DD of ISO-8601).`);
    }
  }

  let type: 'orders' | 'quotes' | 'all' | undefined = undefined;
  if (typeVal !== undefined) {
    const norm = typeVal.toLowerCase();
    if (!['orders', 'quotes', 'all'].includes(norm)) {
      throw new Error(`[CLI-ARG-12] Ongeldig type: '${typeVal}'. Toegestane waarden zijn: orders, quotes, all.`);
    }
    type = norm as 'orders' | 'quotes' | 'all';
  }

  if (withConfiguration && startAfter) {
    throw new Error(`[CLI-ARG-05] Vlag '--with-configuration' kan niet worden gecombineerd met '--start-after'.`);
  }

  if (orderIds && withConfiguration) {
    throw new Error(`Vlag '--order-ids' kan niet worden gecombineerd met '--with-configuration'.`);
  }

  if (orderIds && startAfter) {
    throw new Error(`Vlag '--order-ids' kan niet worden gecombineerd met '--start-after'.`);
  }

  if (isFromDb && !deltaSince) {
    if (type !== undefined) {
      throw new Error(`[CLI-ARG-06] Vlag '--type' kan uitsluitend worden gebruikt voor LogicTrade API-oogst (--delta-since of API-harvest), niet voor zuivere '--from-db' runs.`);
    }
    if (origin !== undefined) {
      throw new Error(`[CLI-ARG-07] Vlag '--origin' kan uitsluitend worden gebruikt voor LogicTrade API-oogst (--delta-since of API-harvest), niet voor zuivere '--from-db' runs.`);
    }
  }

  if (cutoffDateVal !== undefined && (!isFromDb || !isOnlyPending)) {
    throw new Error(`[CLI-ARG-13] Vlag '--cutoff-date' kan alleen worden gebruikt in combinatie met '--from-db' en '--only-pending'.`);
  }

  if ((years !== undefined || isFull) && (deltaSince !== undefined || isFromDb)) {
    throw new Error(`[CLI-ARG-14] Vlaggen '--years' en '--full' zijn uitsluitend bedoeld voor historische LogicTrade API-oogst en kunnen niet worden gecombineerd met '--delta-since' of '--from-db'. Gebruik '--year' voor database-filtering op jaar.`);
  }

  if (!isFromDb) {
    if (withConfiguration) throw new Error("Vlag '--with-configuration' vereist '--from-db'.");
    if (year !== undefined) throw new Error("Vlag '--year' vereist '--from-db'.");
    if (isOnlyPending) throw new Error("Vlag '--only-pending' vereist '--from-db'.");
    if (startAfter !== undefined) throw new Error("Vlag '--start-after' vereist '--from-db'.");
    if (orderIds !== undefined) throw new Error("Vlag '--order-ids' vereist '--from-db'.");
  }

  if (isFull && years !== undefined) {
    throw new Error("Vlaggen '--full' en '--years' kunnen niet tegelijkertijd worden gebruikt.");
  }

  return {
    isHelp: false,
    isFromDb,
    withConfiguration,
    isForce,
    isOnlyPending,
    isFull,
    deltaSince,
    orderIds,
    type,
    years,
    year,
    startAfter,
    batchSize,
    concurrency,
    maxCount,
    cutoffDate: cutoffDateVal,
    origin,
  };
}

export function assertSafeSupabaseTarget(url?: string): void {
  if (url && url.includes('opoeksjilihrjszbftmn')) {
    throw new Error(
      "[INV-GOV-24] Productie-instantie gedetecteerd ('opoeksjilihrjszbftmn'). Directe operaties op productie zijn ten strengste verboden conform INV-GOV-24."
    );
  }
}

export function validateIngestionEnvironment(
  opts: IngestionCliOptions,
  config: SupabaseConfig,
  ltCheck?: () => void
): { ok: boolean; error?: string } {
  try {
    assertSafeSupabaseTarget(config.url);

    const effectiveServiceKey = config.serviceKey || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    if (!opts.isHelp && !effectiveServiceKey) {
      return {
        ok: false,
        error: "Schrijfoperaties vereisen SUPABASE_SERVICE_ROLE_KEY. Geen fallback op anonKey toegestaan conform INV-GOV-24.",
      };
    }

    if (opts.deltaSince || (!opts.isFromDb && !opts.isHelp)) {
      if (ltCheck) {
        ltCheck();
      } else {
        resolveLogicTradeConnectionConfig({ requireApiKey: true });
      }
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) };
  }
}

export function buildPostgrestQueryString(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => {
      const encKey = encodeURIComponent(k);
      const encVal = encodeURIComponent(v)
        .replace(/%2C/g, ',')
        .replace(/%28/g, '(')
        .replace(/%29/g, ')')
        .replace(/%2E/g, '.');
      return `${encKey}=${encVal}`;
    })
    .join('&');
}

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) {
    throw new Error("[CHUNK-01] chunkSize moet strikt positief zijn (> 0).");
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export function isIngestionCliEntrypoint(
  filename: string,
  nodeEnv: string = process.env.NODE_ENV || (process.env.VITEST ? 'test' : ''),
  targetArg: string = process.argv[1] || ''
): boolean {
  if (nodeEnv === 'test') {
    return false;
  }
  if (!targetArg) return false;
  const normFilename = filename.replace(/\\/g, '/');
  const normTarget = targetArg.replace(/\\/g, '/');
  return (
    normFilename.endsWith(normTarget) ||
    normTarget.endsWith('run-order-ingestion.ts') ||
    normTarget.endsWith('run-order-ingestion.js')
  );
}

export function formatCliUsageHelp(): string {
  return `
Gebruik:
  node ./node_modules/tsx/dist/cli.mjs scripts/run-order-ingestion.ts [opties]

Beschikbare vlaggen:
  --help, -h             Toon deze helptekst en sluit af
  --from-db              Lees en transformeer direct uit PostgreSQL public.orders
  --with-configuration   Filter op orders met maatwerkconfiguraties (vereist --from-db)
  --force                Schakel freeze guards uit en overschrijf bestaande data
  --only-pending         Verwerk alleen orders gewijzigd vóór cutoff-date (vereist --from-db)
  --cutoff-date <date>   ISO datum voor pending filter (vereist --from-db en --only-pending)
  --year <YYYY>          Filter op specifiek orderjaar (2000-2100, vereist --from-db)
  --start-after <id>     Hervat keyset paginering na order ID (vereist --from-db)
  --order-ids <ids>      Kommagescheiden lijst van order IDs (vereist --from-db)
  --batch-size <N>       Aantal records per database query (standaard: 100)
  --concurrency <N>      Aantal parallelle verwerkingsworkers (standaard: 15)
  --max <N>              Maximaal aantal te verwerken records
  --delta-since <date>   LogicTrade API delta-sync voor gewijzigde orders/offertes na ISO datum
  --type <enum>          API intake type: orders, quotes, all (standaard: all)
  --origin <name>        Herkomstfilter voor LogicTrade API (standaard: 'Winkel GSW BV')
  --years <N>            Historische API horizon in jaren (> 0)
  --full                 Onbeperkte historische API harvest

Conflictregels:
  • --cutoff-date vereist zowel --from-db als --only-pending [CLI-ARG-13]
  • --years en --full kunnen niet worden gecombineerd met --delta-since of --from-db [CLI-ARG-14]
  • --type en --origin zijn voor API-oogst en verboden bij zuivere --from-db runs [CLI-ARG-06, CLI-ARG-07]
  • --with-configuration kan niet worden gecombineerd met --start-after [CLI-ARG-05] of --order-ids
  • Productie-instantie 'opoeksjilihrjszbftmn' is geblokkeerd conform INV-GOV-24
`;
}

export interface RunLogicTradeApiHarvestOptions {
  ingestionType: 'orders' | 'quotes' | 'all';
  originFilter: string;
  yearsArg?: number | null;
  modifiedAfter?: string;
  maxCount?: number;
  getTotalScanned: () => number;
  onOrder: (order: LogicTradeOrderHeader, lines: LogicTradeOrderLine[]) => Promise<void>;
  onQuote: (quote: LogicTradeQuoteHeader, lines: LogicTradeOrderLine[]) => Promise<void>;
}

export async function runLogicTradeApiHarvest(options: RunLogicTradeApiHarvestOptions): Promise<void> {
  const { ingestionType, originFilter, yearsArg, modifiedAfter, maxCount, getTotalScanned, onOrder, onQuote } = options;

  let remaining = maxCount ? Math.max(0, maxCount - getTotalScanned()) : Infinity;

  if (remaining > 0 && (ingestionType === 'orders' || ingestionType === 'all')) {
    const isDelta = Boolean(modifiedAfter);
    console.log(
      isDelta
        ? '--- 📦 Fase 0A: Ophalen & Verwerken van Gewijzigde Verkooporders ---'
        : '--- 📦 Fase A: Ophalen & Verwerken van Verkooporders (/orders) ---'
    );
    const pSize = Number.isFinite(remaining) ? Math.min(50, Math.max(10, remaining)) : 50;
    await harvest2YearOrders({
      years: yearsArg,
      originFilter,
      statusFilter: [],
      pageSize: pSize,
      maxOrders: Number.isFinite(remaining) ? remaining : undefined,
      modifiedAfter,
      throwOnError: true,
      onOrder,
    });
  }

  remaining = maxCount ? Math.max(0, maxCount - getTotalScanned()) : Infinity;
  if (remaining > 0 && (ingestionType === 'quotes' || ingestionType === 'all')) {
    const isDelta = Boolean(modifiedAfter);
    console.log(
      isDelta
        ? '\n--- 📄 Fase 0B: Ophalen & Verwerken van Gewijzigde Offertes ---'
        : '\n--- 📄 Fase B: Ophalen & Verwerken van Offertes (/quotes) ---'
    );
    const pSize = Number.isFinite(remaining) ? Math.min(100, Math.max(10, remaining)) : 100;
    await harvestQuotes({
      years: yearsArg,
      originFilter,
      statusFilter: [],
      pageSize: pSize,
      maxQuotes: Number.isFinite(remaining) ? remaining : undefined,
      modifiedAfter,
      throwOnError: true,
      onQuote,
    });
  }
}

async function asyncPool<T>(limit: number, array: T[], fn: (item: T) => Promise<void>) {
  const ret: Promise<void>[] = [];
  const executing = new Set<Promise<void>>();
  for (const item of array) {
    const p = Promise.resolve().then(() => fn(item));
    ret.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(ret);
}

export async function runOrderIngestionCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseIngestionCliArgs(argv);
  if (opts.isHelp) {
    console.log(formatCliUsageHelp());
    return;
  }

  loadEnvConfig(process.cwd());
  const config = getSupabaseConfig();
  const envValidation = validateIngestionEnvironment(opts, config);
  if (!envValidation.ok) {
    console.error(`❌ Omgevingsvalidatie mislukt: ${envValidation.error}`);
    process.exit(1);
  }

  const effectiveServiceKey = config.serviceKey || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  if (!effectiveServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY ontbreekt. Schrijfoperaties vereisen service-role rechten.');
    process.exit(1);
  }

  const url = config.url;
  const key = effectiveServiceKey;

  const isForce = Boolean(opts.isForce);
  const isFromDb = Boolean(opts.isFromDb);
  const withConfiguration = Boolean(opts.withConfiguration);
  const isOnlyPending = Boolean(opts.isOnlyPending);
  const targetYear = opts.year;
  const startAfter = opts.startAfter;
  const targetOrderIds = opts.orderIds;
  const batchSize = opts.batchSize || 100;
  const concurrency = opts.concurrency || 15;
  const maxCount = opts.maxCount;
  const deltaSince = opts.deltaSince;
  const ingestionType = opts.type || 'all';
  const originFilter = opts.origin || 'Winkel GSW BV';
  const yearsArg = opts.years || null;
  const cutoffIso = opts.cutoffDate
    ? new Date(opts.cutoffDate).toISOString()
    : '2026-11-25T00:00:00.000Z';

  console.log('================================================================');
  console.log(
    isFromDb
      ? '🚀 Start Backfill & Herclassificatie Pipeline uit Database (--from-db)'
      : '🚀 Start Integrale Order- & Offerte-Intake Pipeline (LogicTrade -> Supabase)'
  );
  console.log(`📍 Supabase Instantie: ${url}`);
  console.log(
    `🔒 Delivered Freeze Guard: ${isForce ? '⚡ OVERRULED (--force actief)' : '🛡️  ACTIEF (geleverde orders worden beschermd)'}`
  );
  if (isFromDb) {
    console.log(`⚡ Bron:                PostgreSQL public.orders`);
    console.log(`📦 Batchgrootte:        ${batchSize}`);
    console.log(`🧵 Concurrency:         ${concurrency} workers`);
    if (withConfiguration) console.log(`🔧 Configuratie Filter: Alleen orders met maatwerk configuratie`);
    if (targetYear) console.log(`📅 Doeljaar Filter:     ${targetYear}`);
    if (startAfter) console.log(`⏭️  Hervatten na ID:     ${startAfter}`);
    if (isOnlyPending) console.log(`⏳ Alleen Pending:     Gewijzigd vóór ${cutoffIso}`);
    if (targetOrderIds) console.log(`🎯 Specifieke IDs:     ${targetOrderIds.length} orders`);
  } else {
    console.log(`🎯 Pipeline Type:      ${ingestionType.toUpperCase()}`);
    console.log(`📅 Horizon:            ${yearsArg ? `${yearsArg} jaar` : 'ONBEPERKT (volledige GSW historie)'}`);
    console.log(`🏢 Herkomstfilter:     ${originFilter}`);
    console.log(`🎯 Statusfilter:       UITGESCHAKELD (alle statussen worden ingeladen)`);
  }
  if (deltaSince) {
    console.log(`🌐 Delta-Sync:         Gewijzigd na ${deltaSince}`);
  }
  if (maxCount) {
    console.log(`⏹️  Max Items:          ${maxCount}`);
  }
  console.log('================================================================\n');

  console.log('🔄 Bezig met in-memory preloading van productcatalogus uit public.logictrade_products...');
  const catalogMap = new Map<string, ResolvedProductEntity>();
  let lastCatalogId = 0;
  let hasMoreCatalog = true;

  while (hasMoreCatalog) {
    const catalogFetchUrl = `${url}/rest/v1/logictrade_products?select=id,code,name,unit,supplier_name,product_group_code,is_generic_container&order=id.asc&limit=1000&id=gt.${lastCatalogId}`;
    const catalogRes = await fetch(catalogFetchUrl, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (!catalogRes.ok) {
      const errText = await catalogRes.text();
      throw new Error(`Fout bij inladen productcatalogus: HTTP ${catalogRes.status}: ${errText}`);
    }
    const catalogRows: ResolvedProductEntity[] = await catalogRes.json();
    if (!Array.isArray(catalogRows) || catalogRows.length === 0) {
      hasMoreCatalog = false;
      break;
    }
    for (const row of catalogRows) {
      if (row.code) {
        catalogMap.set(String(row.code).trim().toUpperCase(), row);
      }
    }
    lastCatalogId = Number(catalogRows[catalogRows.length - 1].id);
    if (catalogRows.length < 1000) {
      hasMoreCatalog = false;
    }
  }
  console.log(`✅ Productcatalogus geladen: ${catalogMap.size} unieke SKUs in werkgeheugen (< 200 KB RAM).\n`);

  const intakeService = new OrderIntakeService({
    skipClientLookup: false,
    resolveProductByCode: async (code: string) => {
      return catalogMap.get((code || '').trim().toUpperCase()) || null;
    },
    resolveProductsByCodes: async (codes: string[]) => {
      const res = new Map<string, ResolvedProductEntity>();
      for (const c of codes) {
        const found = catalogMap.get((c || '').trim().toUpperCase());
        if (found) res.set(c, found);
      }
      return res;
    },
  });

  let totalScanned = 0;
  let totalIngested = 0;
  let totalSkipped = 0;
  let totalQuotes = 0;
  let totalOrders = 0;
  let totalLines = 0;
  let totalAmountCents = 0;
  const errors: string[] = [];
  const deltaSyncedOrderIds = new Set<string>();
  const startTime = Date.now();

  async function persistBundle(bundle: IngestedOrderBundle, originItemNum: string, isQuote: boolean) {
    const resJson = await ingestOrderTransaction(bundle, {
      p_force: isForce,
      url,
      authKey: key,
      maxRetries: 3,
      retryDelayMs: 1000,
    });

    if (resJson && resJson.lines_processed === 0 && resJson.skipped_reason) {
      totalSkipped++;
      if (totalSkipped % 100 === 0 || totalSkipped === 1) {
        console.log(` ⏸️  [FREEZE GUARD SKIP] #${totalSkipped} | Order ${bundle.order.order_number}: ${resJson.skipped_reason}`);
      }
    } else {
      totalIngested++;
      if (bundle.order.fsm_step === 2) {
        totalQuotes++;
      } else {
        totalOrders++;
      }
      totalLines += (resJson?.lines_processed ?? bundle.lines.length);
      totalAmountCents += bundle.order.total_amount_cents;

      const isOfferte = bundle.order.fsm_step === 2;
      const badge = isOfferte ? '📄 [OFFERTE]' : '📦 [ORDER]  ';
      const formattedAmount = (bundle.order.total_amount_cents / 100).toLocaleString('nl-NL', {
        style: 'currency',
        currency: 'EUR',
      });

      if (totalIngested % 50 === 0 || totalIngested === 1) {
        console.log(
          ` ${badge} #${totalIngested} | Nr: ${bundle.order.order_number.padEnd(12)} | ` +
          `Klant: ${(bundle.order.customer_name || '').slice(0, 20).padEnd(20)} | ` +
          `Regels: ${String(bundle.lines.length).padStart(2)} | Bedrag: ${formattedAmount.padStart(10)}`
        );
      }
    }
  }

  async function ingestApiItem(
    header: LogicTradeOrderHeader | LogicTradeQuoteHeader,
    lines: LogicTradeOrderLine[],
    isQuote: boolean
  ) {
    totalScanned++;
    try {
      const rawInput = mapLogicTradeOrderToRawInput(header, lines, { isQuote });
      const bundle = await intakeService.processOrderIntake(rawInput);
      await persistBundle(bundle, String((header as any).orderNumber || (header as any).number || header.id), isQuote);
      deltaSyncedOrderIds.add(String(bundle.order.id));
    } catch (err: any) {
      const itemNum = (header as any).orderNumber || (header as any).number || header.id;
      const errMsg = `Fout bij ${isQuote ? 'offerte' : 'order'} ${itemNum}: ${err.message}`;
      console.error(` ❌ ${errMsg}`);
      errors.push(errMsg);
    }
  }

  async function processSingleDbOrder(dbOrder: any) {
    const rawLines =
      dbOrder.lt_raw_data?.lines ||
      dbOrder.lt_raw_data?.orderLines ||
      dbOrder.raw_data?.lines ||
      dbOrder.raw_data?.orderLines;
    if (!Array.isArray(rawLines) || rawLines.length === 0) return;

    const isQuote = dbOrder.fsm_step === 2 || String(dbOrder.order_number || '').toUpperCase().startsWith('O');
    const header = dbOrder.lt_raw_data || dbOrder.raw_data || {};

    try {
      const rawInput = mapLogicTradeOrderToRawInput(header, rawLines, {
        isQuote,
        existingOrder: {
          id: String(dbOrder.id),
          order_number: dbOrder.order_number,
          fsm_step: dbOrder.fsm_step,
          fsm_phase: dbOrder.fsm_phase,
        },
      });

      const bundle = await intakeService.processOrderIntake(rawInput);
      await persistBundle(bundle, String(dbOrder.order_number || dbOrder.id), isQuote);
    } catch (err: any) {
      const errMsg = `Fout bij order ${dbOrder.id} (${dbOrder.order_number}): ${err.message}`;
      console.error(` ❌ ${errMsg}`);
      errors.push(errMsg);
    }
  }

  try {
    if (deltaSince) {
      console.log(`--- 🌐 Start Delta Sync uit LogicTrade API (gewijzigd na ${deltaSince}) ---`);
      await runLogicTradeApiHarvest({
        ingestionType,
        originFilter,
        modifiedAfter: deltaSince,
        maxCount,
        getTotalScanned: () => totalScanned,
        onOrder: async (orderHeader, orderLines) => {
          await ingestApiItem(orderHeader, orderLines, false);
        },
        onQuote: async (quoteHeader, quoteLines) => {
          await ingestApiItem(quoteHeader, quoteLines, true);
        },
      });
      console.log('✅ Delta Sync succesvol afgerond.\n');
    }

    if (isFromDb) {
      if (maxCount && totalScanned >= maxCount) {
        console.log(`⏹️ Max count van ${maxCount} bereikt vóór database-verwerking.`);
      } else {
        let candidateIds: string[] | undefined = targetOrderIds;

        if (withConfiguration) {
          console.log('🔄 Ophalen van geconfigureerde order IDs uit public.order_lines...');
          const configuredSet = new Set<string>();
          let lastLineId = '';
          let hasMoreLines = true;
          while (hasMoreLines) {
            const qParams: Record<string, string> = {
              select: 'id,order_id',
              'lt_configuration->items': 'not.is.null',
              order: 'id.asc',
              limit: '500',
            };
            if (lastLineId) {
              qParams['id'] = `gt.${lastLineId}`;
            }
            const linesUrl = `${url}/rest/v1/order_lines?${buildPostgrestQueryString(qParams)}`;
            let fetchRes: Response | null = null;
            let fetchAttempts = 0;
            while (fetchAttempts < 3) {
              fetchAttempts++;
              try {
                fetchRes = await fetch(linesUrl, {
                  headers: { apikey: key, Authorization: `Bearer ${key}` },
                });
                if (fetchRes.ok) break;
              } catch {
                // retry
              }
              if (fetchAttempts < 3) await new Promise((r) => setTimeout(r, fetchAttempts * 500));
            }
            if (!fetchRes || !fetchRes.ok) {
              const errText = fetchRes ? await fetchRes.text() : 'No response';
              throw new Error(`Fout bij ophalen geconfigureerde orderregels: HTTP ${fetchRes?.status}: ${errText}`);
            }
            const batch: Array<{ id: string | number; order_id: string }> = await fetchRes.json();
            if (!Array.isArray(batch) || batch.length === 0) {
              hasMoreLines = false;
              break;
            }
            for (const line of batch) {
              if (line.order_id) configuredSet.add(String(line.order_id));
            }
            lastLineId = String(batch[batch.length - 1].id);
            if (batch.length < 500) {
              hasMoreLines = false;
            }
          }

          if (configuredSet.size === 0) {
            console.log('ℹ️  Geen orders met configuratie-items gevonden.');
            candidateIds = [];
          } else {
            console.log(`✅ ${configuredSet.size} unieke orders met configuraties geïdentificeerd.`);
            candidateIds = Array.from(configuredSet);
          }
        }

        if (candidateIds !== undefined) {
          if (candidateIds.length > 0) {
            console.log(`--- 🎯 Start Target-ID Batch Verwerking (${candidateIds.length} IDs) ---`);
            const chunks = chunkArray(candidateIds, 50);

            for (const chunk of chunks) {
              if (maxCount && totalScanned >= maxCount) {
                console.log(`⏹️ Max count van ${maxCount} bereikt.`);
                break;
              }

              const qParams: Record<string, string> = {
                select: 'id,order_number,status,fsm_step,fsm_phase,order_date,updated_at,raw_data,lt_raw_data',
                id: `in.(${chunk.join(',')})`,
                limit: String(chunk.length),
              };
              const chunkUrl = `${url}/rest/v1/orders?${buildPostgrestQueryString(qParams)}`;

              let fetchRes: Response | null = null;
              let fetchAttempts = 0;
              while (fetchAttempts < 3) {
                fetchAttempts++;
                try {
                  fetchRes = await fetch(chunkUrl, {
                    headers: { apikey: key, Authorization: `Bearer ${key}` },
                  });
                  if (fetchRes.ok) break;
                } catch {
                  // retry
                }
                if (fetchAttempts < 3) await new Promise((r) => setTimeout(r, fetchAttempts * 500));
              }
              if (!fetchRes || !fetchRes.ok) {
                const errText = fetchRes ? await fetchRes.text() : 'No response';
                throw new Error(`Fout bij ophalen chunk orders: HTTP ${fetchRes?.status}: ${errText}`);
              }
              const batchOrders: any[] = await fetchRes.json();
              if (!Array.isArray(batchOrders) || batchOrders.length === 0) {
                continue;
              }

              const eligibleOrders = batchOrders.filter((dbOrder) => {
                if (targetYear) {
                  if (!dbOrder.order_date) return false;
                  const yr = new Date(dbOrder.order_date).getFullYear();
                  if (String(yr) !== targetYear) return false;
                }
                if (isOnlyPending) {
                  if (dbOrder.updated_at && Date.parse(dbOrder.updated_at) > Date.parse(cutoffIso)) {
                    return false;
                  }
                }
                if (deltaSyncedOrderIds.has(String(dbOrder.id))) {
                  return false;
                }
                const rawLines =
                  dbOrder.lt_raw_data?.lines ||
                  dbOrder.lt_raw_data?.orderLines ||
                  dbOrder.raw_data?.lines ||
                  dbOrder.raw_data?.orderLines;
                if (!Array.isArray(rawLines) || rawLines.length === 0) {
                  return false;
                }
                return true;
              });

              const remaining = maxCount ? Math.max(0, maxCount - totalScanned) : Infinity;
              const effectiveOrders = Number.isFinite(remaining) ? eligibleOrders.slice(0, remaining) : eligibleOrders;

              await asyncPool(concurrency, effectiveOrders, async (dbOrder) => {
                await processSingleDbOrder(dbOrder);
              });

              totalScanned += effectiveOrders.length;
            }
          }
        } else {
          console.log('--- 🔄 Start Keyset Cursor Paginering over public.orders ---');
          let lastId: string = startAfter || '';
          let hasMore = true;

          while (hasMore) {
            if (maxCount && totalScanned >= maxCount) {
              console.log(`⏹️ Max count van ${maxCount} bereikt.`);
              break;
            }

            const currentLimit = maxCount ? Math.min(batchSize, maxCount - totalScanned) : batchSize;
            const qParams: Record<string, string> = {
              select: 'id,order_number,status,fsm_step,fsm_phase,order_date,updated_at,raw_data,lt_raw_data',
              order: 'id.asc',
              limit: String(currentLimit),
            };
            if (lastId) {
              qParams['id'] = `gt.${lastId}`;
            }
            if (targetYear) {
              qParams['and'] = `(order_date.gte.${targetYear}-01-01,order_date.lte.${targetYear}-12-31)`;
            }
            if (isOnlyPending) {
              qParams['or'] = `(updated_at.lte.${cutoffIso},updated_at.is.null)`;
            }

            const fetchUrl = `${url}/rest/v1/orders?${buildPostgrestQueryString(qParams)}`;
            let fetchRes: Response | null = null;
            let fetchAttempts = 0;
            while (fetchAttempts < 3) {
              fetchAttempts++;
              try {
                fetchRes = await fetch(fetchUrl, {
                  headers: { apikey: key, Authorization: `Bearer ${key}` },
                });
                if (fetchRes.ok) break;
              } catch {
                // retry
              }
              if (fetchAttempts < 3) await new Promise((r) => setTimeout(r, fetchAttempts * 1000));
            }

            if (!fetchRes || !fetchRes.ok) {
              const errText = fetchRes ? await fetchRes.text() : 'No response';
              throw new Error(`Fout bij ophalen orders batch na id ${lastId}: HTTP ${fetchRes?.status}: ${errText}`);
            }

            const batchOrders: any[] = await fetchRes.json();
            if (!Array.isArray(batchOrders) || batchOrders.length === 0) {
              hasMore = false;
              break;
            }

            lastId = String(batchOrders[batchOrders.length - 1].id);

            const eligibleOrders = batchOrders.filter((dbOrder) => {
              if (deltaSyncedOrderIds.has(String(dbOrder.id))) return false;
              const rawLines =
                dbOrder.lt_raw_data?.lines ||
                dbOrder.lt_raw_data?.orderLines ||
                dbOrder.raw_data?.lines ||
                dbOrder.raw_data?.orderLines;
              return Array.isArray(rawLines) && rawLines.length > 0;
            });

            const remaining = maxCount ? Math.max(0, maxCount - totalScanned) : Infinity;
            const effectiveOrders = Number.isFinite(remaining) ? eligibleOrders.slice(0, remaining) : eligibleOrders;

            await asyncPool(concurrency, effectiveOrders, async (dbOrder) => {
              await processSingleDbOrder(dbOrder);
            });

            totalScanned += effectiveOrders.length;

            if (batchOrders.length < currentLimit) {
              hasMore = false;
            }
          }
        }
      }
    } else if (!deltaSince) {
      await runLogicTradeApiHarvest({
        ingestionType,
        originFilter,
        yearsArg,
        maxCount,
        getTotalScanned: () => totalScanned,
        onOrder: async (orderHeader, orderLines) => {
          await ingestApiItem(orderHeader, orderLines, false);
        },
        onQuote: async (quoteHeader, quoteLines) => {
          await ingestApiItem(quoteHeader, quoteLines, true);
        },
      });
    }

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n================================================================');
    console.log('✅ Ingestion Pipeline Succesvol Afgerond');
    console.log(`⏱️  Doorlooptijd: ${elapsedSeconds}s`);
    console.log(`📊 Gescande documenten: ${totalScanned}`);
    console.log(`📥 Succesvol gepersisteerd: ${totalIngested}`);
    console.log(`   • Offertes (FSM 2): ${totalQuotes}`);
    console.log(`   • Orders (FSM 5):   ${totalOrders}`);
    console.log(`⏸️  Overgeslagen (Freeze Guard): ${totalSkipped}`);
    console.log(`📑 Totaal orderregels: ${totalLines}`);
    console.log(
      `💰 Totale geaggregeerde orderwaarde: ${(totalAmountCents / 100).toLocaleString('nl-NL', {
        style: 'currency',
        currency: 'EUR',
      })}`
    );
    if (errors.length > 0) {
      console.error(`⚠️  Aantal mislukte records: ${errors.length}`);
      console.error('💥 Harvester pipeline faalt fail-closed vanwege opgetreden fouten.');
      console.log('================================================================\n');
      process.exit(1);
    }
    console.log('================================================================\n');
  } catch (err: any) {
    console.error('💥 Fatale fout tijdens uitvoering harvester pipeline:', err);
    process.exit(1);
  }
}

if (isIngestionCliEntrypoint(__filename, process.env.NODE_ENV, process.argv[1])) {
  runOrderIngestionCli().catch((err) => {
    console.error('💥 Onbehandelde uitzondering in runOrderIngestionCli:', err);
    process.exit(1);
  });
}
