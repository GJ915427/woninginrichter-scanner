/**
 * scripts/backfill_product_taxonomy.ts
 *
 * Keyset Batch Backfill Script voor 100k Catalogusartikelen over PostgREST.
 * Pagineert via id > last_processed_id in brokken van <= 1.000 rijen en
 * persisteert de voortgang in logictrade_sync_state.
 */

import { getSupabaseConfig } from '../src/lib/supabase/client';
import { ClassificationService } from '../src/domain/classification/central-classification-service';

export interface BackfillOptions {
  chunkSize?: number;
  maxChunks?: number;
  dryRun?: boolean;
}

export interface BackfillStats {
  totalProcessed: number;
  lastProcessedId: number;
  chunksCompleted: number;
  durationMs: number;
}

export async function processBackfillChunk(
  service: ClassificationService,
  products: Array<{ id: number; code?: string; name: string; description?: string; supplier_name?: string }>,
  options: { url: string; serviceKey: string; dryRun?: boolean }
): Promise<{ updatedCount: number; maxId: number }> {
  if (products.length === 0) {
    return { updatedCount: 0, maxId: 0 };
  }

  const batch = await service.prepareBackfillBatch(products);
  const maxId = Math.max(...products.map((p) => p.id));

  if (options.dryRun) {
    return { updatedCount: batch.length, maxId };
  }

  const response = await fetch(`${options.url}/rest/v1/rpc/batch_update_product_taxonomies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: options.serviceKey,
      Authorization: `Bearer ${options.serviceKey}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ p_batch: batch }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RPC batch_update_product_taxonomies failed: ${response.status} ${errorText}`);
  }

  const updatedCount = (await response.json()) as number;

  // Persisteer checkpoint in logictrade_sync_state
  await fetch(`${options.url}/rest/v1/logictrade_sync_state?key=eq.product_taxonomy_backfill`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: options.serviceKey,
      Authorization: `Bearer ${options.serviceKey}`,
    },
    body: JSON.stringify({
      last_processed_id: maxId,
      updated_at: new Date().toISOString(),
    }),
  });

  return { updatedCount, maxId };
}

export async function backfillProductTaxonomy(options: BackfillOptions = {}): Promise<BackfillStats> {
  const startTime = Date.now();
  const chunkSize = Math.min(options.chunkSize || 1000, 1000);
  const config = getSupabaseConfig();
  const authKey = config.serviceKey || config.anonKey;

  if (!config.url || !authKey) {
    throw new Error('Supabase configuratie ontbreekt (URL of Key niet ingesteld).');
  }

  const service = new ClassificationService();
  let lastId = 0;
  let totalProcessed = 0;
  let chunksCompleted = 0;

  // Lees laatste checkpoint
  try {
    const stateRes = await fetch(`${config.url}/rest/v1/logictrade_sync_state?key=eq.product_taxonomy_backfill&select=last_processed_id`, {
      headers: {
        apikey: authKey,
        Authorization: `Bearer ${authKey}`,
      },
    });
    if (stateRes.ok) {
      const stateData = await stateRes.json();
      if (Array.isArray(stateData) && stateData.length > 0 && stateData[0].last_processed_id) {
        lastId = Number(stateData[0].last_processed_id);
      }
    }
  } catch {
    // Geen eerdere state gevonden; start vanaf 0
  }

  while (true) {
    if (options.maxChunks && chunksCompleted >= options.maxChunks) {
      break;
    }

    const fetchUrl = `${config.url}/rest/v1/logictrade_products?select=id,code,name,description,supplier_name,sales_group&id=gt.${lastId}&order=id.asc&limit=${chunkSize}`;
    const res = await fetch(fetchUrl, {
      headers: {
        apikey: authKey,
        Authorization: `Bearer ${authKey}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ophalen van logictrade_products mislukt: ${res.status} ${errText}`);
    }

    const rows = (await res.json()) as Array<{
      id: number;
      code?: string;
      name: string;
      description?: string;
      supplier_name?: string;
    }>;

    if (!rows || rows.length === 0) {
      break;
    }

    const { updatedCount, maxId } = await processBackfillChunk(service, rows, {
      url: config.url,
      serviceKey: authKey,
      dryRun: options.dryRun,
    });

    totalProcessed += updatedCount;
    lastId = maxId;
    chunksCompleted++;
  }

  return {
    totalProcessed,
    lastProcessedId: lastId,
    chunksCompleted,
    durationMs: Date.now() - startTime,
  };
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  backfillProductTaxonomy()
    .then((stats) => {
      console.log('Taxonomie backfill voltooid:', stats);
    })
    .catch((err) => {
      console.error('Fout bij taxonomie backfill:', err);
      process.exit(1);
    });
}
