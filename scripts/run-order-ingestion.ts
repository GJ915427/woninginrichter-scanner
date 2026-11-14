/**
 * scripts/run-order-ingestion.ts
 *
 * Standalone Ingestion Pipeline Runner:
 * Haalt alle actuele én historische orders en offertes op uit LogicTrade REST API
 * (zonder status-, prefix-, datum- of regeluitsluiting), transformeert ze via de SSOT
 * OrderIntakeService en persisteert ze streaming en atomair in Supabase via PostgREST RPC ingest_logictrade_order.
 */

import {
  harvest2YearOrders,
  harvestQuotes,
  type LogicTradeOrderHeader,
  type LogicTradeQuoteHeader,
  type LogicTradeOrderLine,
} from '../src/lib/logictrade/harvest-2yr-orders';
import { OrderIntakeService, mapLogicTradeOrderToRawInput } from '../src/domain/orders/order-intake-service';
import { ingestOrderTransaction, requireServiceRoleKey } from '../src/lib/supabase/order-client';
import type { IngestedOrderBundle } from '../src/types/order-intake';

export function assertRunOrderIngestionConfig(): { url: string; serviceKey: string } {
  return requireServiceRoleKey();
}

export async function ingestOrderRecord(
  header: LogicTradeOrderHeader | LogicTradeQuoteHeader | Record<string, unknown>,
  lines: LogicTradeOrderLine[] | Record<string, unknown>[],
  options?: { isQuote?: boolean; intakeService?: OrderIntakeService }
): Promise<IngestedOrderBundle> {
  assertRunOrderIngestionConfig();
  const intakeService =
    options?.intakeService ?? new OrderIntakeService({ skipClientLookup: true });
  const rawInput = mapLogicTradeOrderToRawInput(header, lines, { isQuote: options?.isQuote });
  const bundle = await intakeService.processOrderIntake(rawInput);
  await ingestOrderTransaction(bundle);
  return bundle;
}

async function main() {
  const args = process.argv.slice(2);
  const isFull = args.includes('--full');

  // Type parsing met fail-closed validatie
  const typeIndex = args.indexOf('--type');
  const ingestionType = typeIndex !== -1 && args[typeIndex + 1] ? args[typeIndex + 1].toLowerCase() : 'all';
  if (!['orders', 'quotes', 'all'].includes(ingestionType)) {
    console.error(`❌ Ongeldig type argument: "${ingestionType}". Toegestane waarden: orders, quotes, all.`);
    console.error('Gebruik: npx tsx scripts/run-order-ingestion.ts [--type orders|quotes|all] [--max <N>] [--years <N> | --full]');
    process.exit(1);
  }

  const maxIndex = args.indexOf('--max');
  const maxCount = maxIndex !== -1 && args[maxIndex + 1] ? parseInt(args[maxIndex + 1], 10) : undefined;
  const yearsIndex = args.indexOf('--years');
  const yearsArg = yearsIndex !== -1 && args[yearsIndex + 1] ? parseFloat(args[yearsIndex + 1]) : (isFull ? null : 2);

  let url: string;
  try {
    ({ url } = assertRunOrderIngestionConfig());
  } catch (err: any) {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
    return;
  }

  console.log('================================================================');
  console.log('🚀 Start Integrale Order- & Offerte-Intake Pipeline (LogicTrade -> Supabase)');
  console.log(`📍 Supabase Instantie: ${url}`);
  console.log(`🎯 Pipeline Type:      ${ingestionType.toUpperCase()}`);
  console.log(`📅 Horizon:            ${isFull ? 'ONBEPERKT (alle historische data)' : `${yearsArg} jaar`}`);
  console.log(`🎯 Statusfilter:       UITGESCHAKELD (alle statussen worden ingeladen)`);
  if (maxCount) {
    console.log(`⏹️  Max Items:          ${maxCount}`);
  }
  console.log('================================================================\n');

  // Initialiseer OrderIntakeService met skipClientLookup: true
  // Hierdoor vermijden we de client-side N+1 REST loop en delegeert de service
  // de SKU product_id & product_group lookup direct aan de PostgreSQL LEFT JOIN LATERAL
  const intakeService = new OrderIntakeService({
    skipClientLookup: true,
  });

  let totalScanned = 0;
  let totalIngested = 0;
  let totalQuotes = 0;
  let totalOrders = 0;
  let totalLines = 0;
  let totalAmountCents = 0;
  const errors: string[] = [];

  const startTime = Date.now();

  async function ingestItem(
    header: LogicTradeOrderHeader | LogicTradeQuoteHeader,
    lines: LogicTradeOrderLine[],
    isQuote: boolean
  ) {
    totalScanned++;

    try {
      const bundle = await ingestOrderRecord(header, lines, {
        isQuote,
        intakeService,
      });

      totalIngested++;
      if (bundle.order.fsm_step === 2) {
        totalQuotes++;
      } else {
        totalOrders++;
      }
      totalLines += bundle.lines.length;
      totalAmountCents += bundle.order.total_amount_cents;

      const isOfferte = bundle.order.fsm_step === 2;
      const badge = isOfferte ? '📄 [OFFERTE]' : '📦 [ORDER]  ';
      const formattedAmount = (bundle.order.total_amount_cents / 100).toLocaleString('nl-NL', {
        style: 'currency',
        currency: 'EUR',
      });

      console.log(
        ` ${badge} #${totalIngested} | Nr: ${bundle.order.order_number.padEnd(12)} | ` +
        `Klant: ${(bundle.order.customer_name || '').slice(0, 20).padEnd(20)} | ` +
        `Regels: ${String(bundle.lines.length).padStart(2)} | Bedrag: ${formattedAmount.padStart(10)}`
      );
    } catch (err: any) {
      const itemNum = (header as any).orderNumber || (header as any).number || header.id;
      const errMsg = `Fout bij ${isQuote ? 'offerte' : 'order'} ${itemNum}: ${err.message}`;
      console.error(` ❌ ${errMsg}`);
      errors.push(errMsg);
    }
  }

  try {
    if (ingestionType === 'orders' || ingestionType === 'all') {
      console.log('--- 📦 Fase A: Ophalen & Verwerken van Verkooporders (/orders) ---');
      await harvest2YearOrders({
        years: yearsArg,
        statusFilter: [], // Lege array = accepteer ALLE statussen
        maxOrders: maxCount,
        pageSize: 50,
        onOrder: async (orderHeader: LogicTradeOrderHeader, orderLines: LogicTradeOrderLine[]) => {
          await ingestItem(orderHeader, orderLines, false);
        },
      });
    }

    if (ingestionType === 'quotes' || ingestionType === 'all') {
      console.log('\n--- 📄 Fase B: Ophalen & Verwerken van Offertes (/quotes) ---');
      await harvestQuotes({
        years: yearsArg,
        statusFilter: [], // Lege array = accepteer ALLE statussen
        maxQuotes: maxCount,
        pageSize: 100,
        onQuote: async (quoteHeader: LogicTradeQuoteHeader, quoteLines: LogicTradeOrderLine[]) => {
          await ingestItem(quoteHeader, quoteLines, true);
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
    console.log(`📑 Totaal orderregels: ${totalLines}`);
    console.log(
      `💰 Totale geaggregeerde orderwaarde: ${(totalAmountCents / 100).toLocaleString('nl-NL', {
        style: 'currency',
        currency: 'EUR',
      })}`
    );
    if (errors.length > 0) {
      console.log(`⚠️  Aantal mislukte records: ${errors.length}`);
    }
    console.log('================================================================\n');
  } catch (err: any) {
    console.error('💥 Fatale fout tijdens uitvoering harvester pipeline:', err);
    process.exit(1);
  }
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === 'string' &&
  process.argv[1].replace(/\\/g, '/').endsWith('/scripts/run-order-ingestion.ts');

if (isDirectExecution) {
  main().catch((err) => {
    console.error('Unhandled fatal error in run-order-ingestion:', err);
    process.exit(1);
  });
}
