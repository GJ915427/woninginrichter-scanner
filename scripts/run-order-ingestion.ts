/**
 * scripts/run-order-ingestion.ts
 *
 * Standalone Ingestion Pipeline Runner:
 * Haalt alle actuele én historische orders en offertes op uit LogicTrade REST API
 * (zonder status-, prefix-, datum- of regeluitsluiting), transformeert ze via de SSOT
 * OrderIntakeService en persisteert ze streaming en atomair in Supabase via PostgREST RPC ingest_logictrade_order.
 */

import { harvest2YearOrders, type LogicTradeOrderHeader, type LogicTradeOrderLine } from '../src/lib/logictrade/harvest-2yr-orders';
import { OrderIntakeService, mapLogicTradeOrderToRawInput } from '../src/domain/orders/order-intake-service';
import { getSupabaseConfig } from '../src/lib/supabase/client';

async function main() {
  const args = process.argv.slice(2);
  const isFull = args.includes('--full');
  const maxIndex = args.indexOf('--max');
  const maxOrders = maxIndex !== -1 && args[maxIndex + 1] ? parseInt(args[maxIndex + 1], 10) : undefined;
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
  console.log('🚀 Start Integrale Order- & Offerte-Intake Pipeline (LogicTrade -> Supabase)');
  console.log(`📍 Supabase Instantie: ${url}`);
  console.log(`📅 Horizon: ${isFull ? 'ONBEPERKT (alle historische data)' : `${yearsArg} jaar`}`);
  console.log(`🎯 Statusfilter: UITGESCHAKELD (zowel orders als offertes worden ingeladen)`);
  if (maxOrders) {
    console.log(`⏹️  Max Orders: ${maxOrders}`);
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

  try {
    await harvest2YearOrders({
      years: yearsArg,
      statusFilter: [], // Lege array = accepteer ALLE statussen (incl. OFFERTE, QUOTATION, etc.)
      maxOrders,
      pageSize: 50,
      onOrder: async (orderHeader: LogicTradeOrderHeader, orderLines: LogicTradeOrderLine[]) => {
        totalScanned++;

        try {
          // 1. SSOT Transformatie
          const rawInput = mapLogicTradeOrderToRawInput(orderHeader, orderLines);

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
          const errMsg = `Fout bij order ${orderHeader.orderNumber || orderHeader.id}: ${err.message}`;
          console.error(` ❌ ${errMsg}`);
          errors.push(errMsg);
        }
      },
    });

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
      console.log(`⚠️  Aantal mislukte orders: ${errors.length}`);
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
