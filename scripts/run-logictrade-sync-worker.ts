/**
 * LogicTrade Continue 1-Seconde Delta Synchronisatie Worker CLI Daemon.
 * Draait als 24/7 background worker met fail-closed lease governance en graceful shutdown.
 *
 * Opties:
 *   --once                  Voer 1 enkele tick-cyclus uit en stop (voor tests en cronjobs)
 *   --interval=<ms>         Tick poll interval in milliseconden (standaard: 1000)
 *   --domains=<domeinen>    Kommagescheiden lijst van domeinen (orders,quotes,purchaseorders,customers,suppliers)
 *   --worker-id=<id>        Expliciete worker identificatie (standaard: hostname-pid)
 */

import os from 'os';
import path from 'path';
import { SyncLeaderElection } from '../src/lib/logictrade/sync-leader-elector';
import { LRUDeduplicationCache } from '../src/lib/logictrade/lru-deduplication-cache';
import { ContinuousSyncEngine, IDeltaDomainHandler } from '../src/lib/logictrade/continuous-sync-engine';
import { OrderDeltaHandler } from '../src/lib/logictrade/delta-handlers/orders-delta-handler';
import { QuoteDeltaHandler } from '../src/lib/logictrade/delta-handlers/quotes-delta-handler';
import { PurchaseOrderDeltaHandler } from '../src/lib/logictrade/delta-handlers/purchase-orders-delta-handler';
import { CustomerDeltaHandler } from '../src/lib/logictrade/delta-handlers/customers-delta-handler';
import { SupplierDeltaHandler } from '../src/lib/logictrade/delta-handlers/suppliers-delta-handler';
import { getSupabaseConfig } from '../src/lib/supabase/client';

export function isWorkerCliEntrypoint(
  filename: string,
  nodeEnv = process.env.NODE_ENV,
  targetArg = process.argv[1]
): boolean {
  if (nodeEnv === 'test') return false;
  if (!targetArg) return false;

  const normTarget = targetArg.replace(/\\/g, '/');
  const normFile = filename.replace(/\\/g, '/');
  return normTarget.endsWith(path.basename(normFile)) || normTarget === normFile;
}

export async function runSyncWorkerCli(argv = process.argv.slice(2)): Promise<void> {
  const isOnce = argv.includes('--once');
  const intervalArg = argv.find((a) => a.startsWith('--interval='));
  const tickIntervalMs = intervalArg ? parseInt(intervalArg.split('=')[1], 10) : 1000;

  const domainsArg = argv.find((a) => a.startsWith('--domains='));
  const domainList = domainsArg
    ? domainsArg.split('=')[1].split(',').map((d) => d.trim().toLowerCase())
    : ['orders', 'quotes', 'purchaseorders', 'customers', 'suppliers'];

  const workerIdArg = argv.find((a) => a.startsWith('--worker-id='));
  const workerId = workerIdArg ? workerIdArg.split('=')[1] : `${os.hostname()}-${process.pid}`;

  console.log('='.repeat(80));
  console.log(`[LogicTrade Sync Worker] Initialisatie worker '${workerId}'`);
  console.log(`Modus: ${isOnce ? 'Single-Pass (--once)' : 'Continue Daemon'}`);
  console.log(`Tick interval: ${tickIntervalMs}ms`);
  console.log(`Actieve domeinen: ${domainList.join(', ')}`);
  console.log('='.repeat(80));

  // 1. Fail-closed credential check
  const supabaseConfig = getSupabaseConfig();
  if (!supabaseConfig.url || !supabaseConfig.serviceKey) {
    console.error('[FOUT] SUPABASE_SERVICE_ROLE_KEY ontbreekt in environment. Continue sync worker vereist service-role rechten.');
    process.exit(1);
  }

  // 2. Initialiseer Leader Elector en Dedup-Cache
  const elector = new SyncLeaderElection(workerId, {
    supabaseUrl: supabaseConfig.url,
    supabaseKey: supabaseConfig.serviceKey,
    leaseKey: 'logictrade_sync_master',
    ttlSeconds: 15,
    heartbeatIntervalMs: 5000,
  });

  const dedupCache = new LRUDeduplicationCache(5000, 120000);

  // 3. Bouw actieve delta handlers
  const handlers: IDeltaDomainHandler[] = [];
  if (domainList.includes('orders')) {
    handlers.push(new OrderDeltaHandler({ dedupCache }));
  }
  if (domainList.includes('quotes')) {
    handlers.push(new QuoteDeltaHandler({ dedupCache }));
  }
  if (domainList.includes('purchaseorders')) {
    handlers.push(new PurchaseOrderDeltaHandler());
  }
  if (domainList.includes('customers')) {
    handlers.push(new CustomerDeltaHandler());
  }
  if (domainList.includes('suppliers')) {
    handlers.push(new SupplierDeltaHandler());
  }

  // 4. Construeer Sync Engine
  const engine = new ContinuousSyncEngine({
    elector,
    handlers,
    tickIntervalMs,
    overlapWindowMs: 60000,
    defaultLookbackMs: 300000,
  });

  // 5. Graceful shutdown registratie
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[LogicTrade Sync Worker] Signaal ${signal} ontvangen. Sluit gecontroleerd af...`);
    await engine.stop();
    console.log('[LogicTrade Sync Worker] Teardown succesvol afgerond.');
    process.exit(0);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // 6. Uitvoering
  if (isOnce) {
    console.log('[LogicTrade Sync Worker] Start single-pass verificatiecyclus...');
    const executed = await engine.executeSingleTick();
    await engine.stop();
    console.log(`[LogicTrade Sync Worker] Single-pass voltooid (uitgevoerd: ${executed}).`);
    return;
  }

  await engine.start();
}

if (isWorkerCliEntrypoint(__filename)) {
  runSyncWorkerCli().catch((err) => {
    console.error('[FATAL] Ongehandelde fout in continue sync worker:', err);
    process.exit(1);
  });
}
