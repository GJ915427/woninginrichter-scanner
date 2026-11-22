#!/usr/bin/env node
/**
 * scripts/harvest-logictrade-bronze.ts
 *
 * Full LogicTrade Bronze Layer Harvester CLI Orchestrator.
 * Connects to live LogicTrade REST API v1 and ingests configured domains:
 * - Customers
 * - Suppliers
 * - Purchase Orders (originCode: Winkel GSW BV)
 * - Configurator Options & Option Values (all 226,983 values)
 * - Products & Catalog (optional via --domains=products)
 * - Orders & Quotes (optional via --domains=orders)
 *
 * Followed by deterministic Keyset-Chunked Parity Gate verification.
 */

import { resolveLogicTradeConnectionConfig } from '../src/lib/logictrade/connection-config';
import { RateLimiter } from '../src/lib/logictrade/rate-limiter';
import { harvest2YearOrders, harvestQuotes } from '../src/lib/logictrade/harvest-2yr-orders';
import { executeDeltaSync } from '../src/lib/logictrade/sync-service';
import { BronzeHarvestService } from '../src/lib/logictrade/bronze-harvest-service';
import { verifyBronzeParityGate } from './verify-bronze-parity';

export async function runBronzeHarvestCli(): Promise<void> {
  const apiKeyArg = process.argv.find((a) => a.startsWith('--api-key='))?.split('=')[1];
  const domainsArg = process.argv.find((a) => a.startsWith('--domains='))?.split('=')[1] || 'suppliers,customers,purchaseorders,schemas';
  const pageSizeArg = process.argv.find((a) => a.startsWith('--page-size='))?.split('=')[1];
  const pageSize = pageSizeArg ? parseInt(pageSizeArg, 10) : 100;

  const targetDomains = domainsArg.split(',').map((d) => d.trim().toLowerCase());
  const skipVerify = process.argv.includes('--skip-verify');

  const connection = resolveLogicTradeConnectionConfig({
    apiKey: apiKeyArg,
    requireApiKey: true,
  });

  console.log('================================================================');
  console.log('🚀 LogicTrade Bronze Layer Harvest Pipeline Started');
  console.log(`🔗 Base URL: ${connection.baseUrl}`);
  console.log(`🎯 Doeldomeinen: ${targetDomains.join(', ')}`);
  console.log(`📄 PageSize: ${pageSize}`);
  console.log('================================================================\n');

  // Rate limiter met 75ms minDelay om API v1 throttling te voorkomen
  const harvestLimiter = new RateLimiter({ minDelayMs: 75, maxRetries: 5, baseBackoffMs: 1000 });

  const bronzeService = new BronzeHarvestService({
    apiKey: connection.apiKey,
    baseUrl: connection.baseUrl,
    rateLimiter: harvestLimiter,
  });

  // 1. Suppliers
  if (targetDomains.includes('suppliers')) {
    console.log('📦 1/4 Synchroniseren van Leveranciers (/suppliers)...');
    const suppRes = await bronzeService.harvestSuppliers({ pageSize });
    console.log(`   ✅ ${suppRes.suppliersProcessed} leveranciers gesynchroniseerd.\n`);
  }

  // 2. Customers
  if (targetDomains.includes('customers')) {
    console.log('📦 2/4 Synchroniseren van Klanten (/customers)...');
    const custRes = await bronzeService.harvestCustomers({ pageSize });
    console.log(`   ✅ ${custRes.customersProcessed} klanten gesynchroniseerd.\n`);
  }

  // 3. Purchase Orders
  if (targetDomains.includes('purchaseorders')) {
    console.log('📦 3/4 Synchroniseren van GSW Inkooporders (/purchaseorders?originCode=Winkel+GSW+BV)...');
    const poRes = await bronzeService.harvestPurchaseOrders({ pageSize, originCode: 'Winkel GSW BV' });
    console.log(`   ✅ ${poRes.purchaseOrdersProcessed} inkooporders en ${poRes.purchaseOrderLinesProcessed} orderlijnen gesynchroniseerd.\n`);
  }

  // 4. Configurator Schemas & Option Values
  if (targetDomains.includes('schemas')) {
    console.log('📦 4/4 Synchroniseren van Configurator Opties & Waarden (/options & /values)...');
    const schemaRes = await bronzeService.harvestConfiguratorOptionsAndValues({
      persistBronzeValues: true,
      preserveSilverOnConflict: true,
      pageSize,
    });
    console.log(`   ✅ ${schemaRes.optionsProcessed} opties en ${schemaRes.valuesProcessed} optiewaarden gesynchroniseerd.\n`);
  }

  // Optionele modules (indien expliciet meegegeven in --domains)
  if (targetDomains.includes('products')) {
    console.log('📦 Synchroniseren van Catalogusproducten (/products)...');
    const prodRes = await executeDeltaSync({
      apiKey: connection.apiKey,
      baseUrl: connection.baseUrl,
    });
    console.log(`   ✅ ${prodRes.syncedCount} catalogusproducten gesynchroniseerd.\n`);
  }

  if (targetDomains.includes('orders')) {
    console.log('📦 Synchroniseren van Verkooporders & Offertes (/orders & /quotes)...');
    const ordersRes = await harvest2YearOrders({
      apiKey: connection.apiKey,
      baseUrl: connection.baseUrl,
    });
    const quotesRes = await harvestQuotes({
      apiKey: connection.apiKey,
      baseUrl: connection.baseUrl,
    });
    console.log(`   ✅ ${ordersRes.totalOrdersScanned} orders en ${quotesRes.totalQuotesScanned} offertes verwerkt.\n`);
  }

  if (!skipVerify) {
    console.log('================================================================');
    console.log('🔍 Uitvoeren van Mechanische Pariteitspoort Verificatie...');
    console.log('================================================================\n');

    const parityGate = await verifyBronzeParityGate();
    if (!parityGate.success) {
      throw new Error('💥 Mechanische Pariteitspoort verificatie gefaald na harvest.');
    }
  } else {
    console.log('⚠️ Mechanische Pariteitspoort overgeslagen wegens --skip-verify.');
  }

  console.log('================================================================');
  console.log('🎉 Integrale Bronze Domeinexpansie & Pariteit 100% Voltooid!');
  console.log('================================================================');
}

export function isHarvestCliEntrypoint(entryArg?: string, nodeEnv?: string): boolean {
  const target = entryArg ?? (typeof process !== 'undefined' ? process.argv?.[1] : '');
  const env = nodeEnv ?? (typeof process !== 'undefined' ? process.env.NODE_ENV : '');
  if (!target || env === 'test') return false;
  const normalized = target.replace(/\\/g, '/');
  return /(?:^|\/)harvest-logictrade-bronze(?:\.[cm]?[tj]s)?$/.test(normalized);
}

if (isHarvestCliEntrypoint()) {
  runBronzeHarvestCli()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('💥 Fatale fout tijdens Bronze harvesting:', err);
      process.exit(1);
    });
}
