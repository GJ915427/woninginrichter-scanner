#!/usr/bin/env node
/**
 * scripts/harvest-logictrade-bronze.ts
 *
 * Full LogicTrade Bronze Layer Harvester CLI Orchestrator.
 * Connects to live LogicTrade REST API v1 and ingests all domains:
 * - Orders & Quotes
 * - Products & Catalog
 * - Customers
 * - Suppliers
 * - Purchase Orders
 * - Configurator Options & Option Values (all 226,983 values)
 */

import { resolveLogicTradeConnectionConfig } from '../src/lib/logictrade/connection-config';
import { harvest2YearOrders, harvestQuotes } from '../src/lib/logictrade/harvest-2yr-orders';
import { executeDeltaSync } from '../src/lib/logictrade/sync-service';
import { executeSchemaDeltaSync } from '../src/lib/logictrade/schema-sync-service';
import { BronzeHarvestService } from '../src/lib/logictrade/bronze-harvest-service';

export async function runBronzeHarvestCli(): Promise<void> {
  const apiKeyArg = process.argv.find((a) => a.startsWith('--api-key='))?.split('=')[1];
  const connection = resolveLogicTradeConnectionConfig({
    apiKey: apiKeyArg,
    requireApiKey: true,
  });

  console.log('================================================================');
  console.log('🚀 LogicTrade Full Bronze Layer Harvest Pipeline Started');
  console.log(`🔗 Base URL: ${connection.baseUrl}`);
  console.log('================================================================\n');

  const bronzeService = new BronzeHarvestService({
    apiKey: connection.apiKey,
    baseUrl: connection.baseUrl,
  });

  // 1. Customers
  console.log('📦 1/6 Synchroniseren van Klanten (/customers)...');
  const custRes = await bronzeService.harvestCustomers();
  console.log(`   ✅ ${custRes.customersProcessed} klanten gesynchroniseerd.\n`);

  // 2. Suppliers
  console.log('📦 2/6 Synchroniseren van Leveranciers (/suppliers)...');
  const suppRes = await bronzeService.harvestSuppliers();
  console.log(`   ✅ ${suppRes.suppliersProcessed} leveranciers gesynchroniseerd.\n`);

  // 3. Purchase Orders
  console.log('📦 3/6 Synchroniseren van Inkooporders (/purchaseorders)...');
  const poRes = await bronzeService.harvestPurchaseOrders();
  console.log(`   ✅ ${poRes.purchaseOrdersProcessed} inkooporders gesynchroniseerd.\n`);

  // 4. Products & Catalog
  console.log('📦 4/6 Synchroniseren van Producten & Catalogus (/products)...');
  const prodRes = await executeDeltaSync({
    apiKey: connection.apiKey,
    baseUrl: connection.baseUrl,
  });
  console.log(`   ✅ ${prodRes.syncedCount} catalogusproducten gesynchroniseerd.\n`);

  // 5. Configurator Schemas & Option Values (All discrete options + option 1026 scale)
  console.log('📦 5/6 Synchroniseren van Configurator Opties & Waarden (/options & /values)...');
  const schemaRes = await executeSchemaDeltaSync({
    apiKey: connection.apiKey,
    baseUrl: connection.baseUrl,
    forceSince: '',
    persistBronzeValues: true,
    preserveSilverOnConflict: true,
  });
  console.log(`   ✅ ${schemaRes.schemasSynced} configurator schema's gesynchroniseerd.\n`);

  // 6. Orders & Quotes
  console.log('📦 6/6 Synchroniseren van Verkooporders & Offertes (/orders & /quotes)...');
  const ordersRes = await harvest2YearOrders({
    apiKey: connection.apiKey,
    baseUrl: connection.baseUrl,
  });
  const quotesRes = await harvestQuotes({
    apiKey: connection.apiKey,
    baseUrl: connection.baseUrl,
  });
  console.log(`   ✅ ${ordersRes.totalOrdersScanned} orders en ${quotesRes.totalQuotesScanned} offertes verwerkt.\n`);

  console.log('================================================================');
  console.log('🎉 Integrale Bronze Domeinexpansie & Pariteit Voltooid!');
  console.log('================================================================');
}

if (process.env.NODE_ENV !== 'test') {
  runBronzeHarvestCli()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('💥 Fatale fout tijdens Bronze harvesting:', err);
      process.exit(1);
    });
}
