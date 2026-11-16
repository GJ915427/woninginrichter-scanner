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
import { getSupabaseConfig } from '../src/lib/supabase/client';

async function main() {
  const args = process.argv.slice(2);
  const isFull = args.includes('--full');
  const isFromDb = args.includes('--from-db');

  const batchSizeIndex = args.indexOf('--batch-size');
  const batchSize = batchSizeIndex !== -1 && args[batchSizeIndex + 1] ? parseInt(args[batchSizeIndex + 1], 10) : 100;

  const concurrencyIndex = args.indexOf('--concurrency');
  const concurrency = concurrencyIndex !== -1 && args[concurrencyIndex + 1] ? parseInt(args[concurrencyIndex + 1], 10) : 15;

  const startAfterIndex = args.indexOf('--start-after');
  const startAfter = startAfterIndex !== -1 && args[startAfterIndex + 1] ? args[startAfterIndex + 1] : undefined;

  // Type parsing met fail-closed validatie
  const typeIndex = args.indexOf('--type');
  const ingestionType = typeIndex !== -1 && args[typeIndex + 1] ? args[typeIndex + 1].toLowerCase() : 'all';
  if (!isFromDb && !['orders', 'quotes', 'all'].includes(ingestionType)) {
    console.error(`❌ Ongeldig type argument: "${ingestionType}". Toegestane waarden: orders, quotes, all.`);
    console.error('Gebruik: npx tsx scripts/run-order-ingestion.ts [--from-db] [--type orders|quotes|all] [--max <N>] [--years <N> | --full]');
    process.exit(1);
  }

  const maxIndex = args.indexOf('--max');
  const maxCount = maxIndex !== -1 && args[maxIndex + 1] ? parseInt(args[maxIndex + 1], 10) : undefined;
  const yearsIndex = args.indexOf('--years');
  const yearsArg = yearsIndex !== -1 && args[yearsIndex + 1] ? parseFloat(args[yearsIndex + 1]) : (isFull ? null : 2);

  const config = getSupabaseConfig();
  const url = config.url;
  const key = config.serviceKey || config.anonKey;

  if (!url || !key) {
    console.error('❌ Supabase configuratie ontbreekt (URL of sleutel niet gevonden).');
    process.exit(1);
  }

  console.log('================================================================');
  console.log(isFromDb
    ? '🚀 Start Backfill & Herclassificatie Pipeline uit Database (--from-db)'
    : '🚀 Start Integrale Order- & Offerte-Intake Pipeline (LogicTrade -> Supabase)');
  console.log(`📍 Supabase Instantie: ${url}`);
  if (isFromDb) {
    console.log(`⚡ Bron:                PostgreSQL public.orders (keyset streaming)`);
    console.log(`📦 Batchgrootte:        ${batchSize}`);
    console.log(`🧵 Concurrency:         ${concurrency} workers`);
    if (startAfter) console.log(`⏭️  Hervatten na ID:     ${startAfter}`);
  } else {
    console.log(`🎯 Pipeline Type:      ${ingestionType.toUpperCase()}`);
    console.log(`📅 Horizon:            ${isFull ? 'ONBEPERKT (alle historische data)' : `${yearsArg} jaar`}`);
    console.log(`🎯 Statusfilter:       UITGESCHAKELD (alle statussen worden ingeladen)`);
  }
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
      // 1. SSOT Transformatie
      const rawInput = mapLogicTradeOrderToRawInput(header, lines, { isQuote });

      // 2. CPQ Validering & Hybride Regelsplitsing
      const bundle = await intakeService.processOrderIntake(rawInput);

      // 3. Atomaire RPC persistence in Supabase
      const res = await fetch(`${url}/rest/v1/rpc/ingest_logictrade_order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ p_order: bundle }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

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
    if (isFromDb) {
      console.log('--- 🔄 Start Keyset Cursor Paginering over public.orders ---');
      let lastId: string = startAfter || '';
      let hasMore = true;

      // Hulpfunctie voor bounded concurrency pool
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

      while (hasMore) {
        if (maxCount && totalIngested >= maxCount) {
          console.log(`⏹️ Max count van ${maxCount} bereikt.`);
          break;
        }

        const currentLimit = maxCount ? Math.min(batchSize, maxCount - totalIngested) : batchSize;
        const queryParams = new URLSearchParams({
          select: 'id,order_number,status,fsm_step,fsm_phase,raw_data',
          order: 'id.asc',
          limit: String(currentLimit),
        });
        if (lastId) {
          queryParams.set('id', `gt.${lastId}`);
        }

        const fetchUrl = `${url}/rest/v1/orders?${queryParams.toString()}`;
        const fetchRes = await fetch(fetchUrl, {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
        });

        if (!fetchRes.ok) {
          const errText = await fetchRes.text();
          throw new Error(`Fout bij ophalen orders batch na id ${lastId}: HTTP ${fetchRes.status}: ${errText}`);
        }

        const batchOrders: any[] = await fetchRes.json();
        if (!Array.isArray(batchOrders) || batchOrders.length === 0) {
          hasMore = false;
          break;
        }

        lastId = String(batchOrders[batchOrders.length - 1].id);

        await asyncPool(concurrency, batchOrders, async (dbOrder) => {
          const rawLines = dbOrder.raw_data?.lines || dbOrder.raw_data?.orderLines;
          if (!Array.isArray(rawLines) || rawLines.length === 0) {
            // Sla order over ter bescherming van bestaande public.order_lines (Falsificatie 11)
            return;
          }

          const isQuote = dbOrder.fsm_step === 2 || String(dbOrder.order_number || '').toUpperCase().startsWith('O');
          const header = dbOrder.raw_data || {};

          totalScanned++;
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

            const res = await fetch(`${url}/rest/v1/rpc/ingest_logictrade_order`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: key,
                Authorization: `Bearer ${key}`,
              },
              body: JSON.stringify({ p_order: bundle }),
            });

            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`HTTP ${res.status}: ${errText}`);
            }

            totalIngested++;
            if (bundle.order.fsm_step === 2) {
              totalQuotes++;
            } else {
              totalOrders++;
            }
            totalLines += bundle.lines.length;
            totalAmountCents += bundle.order.total_amount_cents;

            if (totalIngested % 50 === 0 || totalIngested === 1) {
              const isOfferte = bundle.order.fsm_step === 2;
              const badge = isOfferte ? '📄 [OFFERTE]' : '📦 [ORDER]  ';
              console.log(
                ` ${badge} #${totalIngested} | ID: ${String(bundle.order.id).padEnd(10)} | Nr: ${bundle.order.order_number.padEnd(12)} | Regels: ${bundle.lines.length}`
              );
            }
          } catch (err: any) {
            const errMsg = `Fout bij order ${dbOrder.id} (${dbOrder.order_number}): ${err.message}`;
            console.error(` ❌ ${errMsg}`);
            errors.push(errMsg);
          }
        });

        if (batchOrders.length < currentLimit) {
          hasMore = false;
        }
      }
    } else {
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

main().catch((err) => {
  console.error('Unhandled fatal error in run-order-ingestion:', err);
  process.exit(1);
});
