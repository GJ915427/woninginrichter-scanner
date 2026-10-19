#!/usr/bin/env ts-node
import { executeSchemaDeltaSync } from '../src/lib/logictrade/schema-sync-service';

async function main() {
  const args = process.argv.slice(2);
  let forceSince: string | undefined;
  let pageSize = 100;
  let notifyUrl = process.env.SYNC_NOTIFY_URL;

  for (const arg of args) {
    if (arg.startsWith('--force-since=')) {
      forceSince = arg.split('=')[1];
    } else if (arg.startsWith('--page-size=')) {
      pageSize = parseInt(arg.split('=')[1], 10) || 100;
    } else if (arg.startsWith('--notify-url=')) {
      notifyUrl = arg.split('=')[1];
    }
  }

  console.log(`[SchemaSync CLI] Starten van LogicTrade configurator schema delta-sync...`);
  if (forceSince) console.log(`[SchemaSync CLI] Geforceerde datum: ${forceSince}`);
  console.log(`[SchemaSync CLI] Paginagrootte: ${pageSize}`);

  try {
    const result = await executeSchemaDeltaSync({ forceSince, pageSize });
    console.log(`[SchemaSync CLI] Synchronisatie voltooid!`);
    console.log(`[SchemaSync CLI] Gesynchroniseerde schema's: ${result.schemasSynced}`);
    console.log(`[SchemaSync CLI] Totaal actieve schema's in database: ${result.totalActiveSchemas}`);
    console.log(`[SchemaSync CLI] Looptijd: ${result.durationMs}ms`);
    console.log(`[SchemaSync CLI] Checkpoint bijgewerkt naar: ${result.lastSyncedAt}`);

    if (notifyUrl) {
      console.log(`[SchemaSync CLI] Notificeren van Next.js server op ${notifyUrl}...`);
      try {
        const notifyRes = await fetch(notifyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {}),
          },
          body: JSON.stringify({ event: 'schemas_synced', timestamp: result.lastSyncedAt }),
        });
        console.log(`[SchemaSync CLI] Notificatie respons HTTP ${notifyRes.status}`);
      } catch (notifyErr) {
        console.warn(`[SchemaSync CLI] Waarschuwing: Notificatie aan ${notifyUrl} mislukt:`, notifyErr);
      }
    }
  } catch (err: any) {
    console.error(`[SchemaSync CLI] Fout tijdens synchronisatie:`, err.message || err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
