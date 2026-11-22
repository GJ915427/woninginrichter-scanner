/**
 * scripts/prune_and_enrich_gsw_products.ts
 *
 * GSW Catalogus-inkrimping, Metadata-hydratie & Container-markering:
 * 1. Schonen van niet-GSW transactiedata via purgeNonGswOrders().
 * 2. Ophalen van actieve GSW product IDs via getDistinctGswProductIds() (~753 stuks).
 * 3. Snoeien van de catalogus van 100.924 naar ~753 artikelen via pruneNonGswProducts(activeGswProductIds).
 * 4. Hydrateren van artikelmetadata via LogicTrade REST /products/{id} met rate limiter en HTTP 404 tolerantie.
 * 5. Garanderen van unanchored container-markering (is_generic_container = true).
 */

import {
  purgeNonGswOrders,
  getDistinctGswProductIds,
  pruneNonGswProducts,
  getSupabaseConfig
} from '../src/lib/supabase/client';
import { resolveLogicTradeConnectionConfig } from '../src/lib/logictrade/connection-config';
import { defaultRateLimiter } from '../src/lib/logictrade/rate-limiter';
import { syncProductsBatch } from '../src/lib/logictrade/sync-service';
import type { LogicTradeProductRaw } from '../src/types/product';

export interface PruneAndEnrichOptions {
  dryRun?: boolean;
  concurrency?: number;
  apiKey?: string;
  baseUrl?: string;
  adminGuid?: string;
}

export interface PruneAndEnrichResult {
  purgedNonGswOrders: number;
  activeGswProductIds: number[];
  prunedCount: number;
  enrichedCount: number;
  containerMarkedCount: number;
}

async function asyncPool<T>(limit: number, array: T[], fn: (item: T) => Promise<void>): Promise<void[]> {
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

export async function pruneAndEnrichGswProducts(
  options: PruneAndEnrichOptions = {}
): Promise<PruneAndEnrichResult> {
  const dryRun = options.dryRun ?? false;
  const concurrency = options.concurrency ?? 10;

  console.log('================================================================');
  console.log(`🚀 Start GSW Catalogus-inkrimping & Verrijking ${dryRun ? '(DRY-RUN)' : ''}`);
  console.log('================================================================');

  // 1. Purge non-GSW orders
  let purgedNonGswOrders = 0;
  if (!dryRun) {
    console.log('🧹 Stap 1: Schonen van niet-GSW transactiedata (orders & orderregels)...');
    purgedNonGswOrders = await purgeNonGswOrders();
    console.log(`   ✅ Verwijderd: ${purgedNonGswOrders} niet-GSW orders.`);
  } else {
    console.log('🧹 Stap 1: [DRY-RUN] Overslaan van purgeNonGswOrders.');
  }

  // 2. Fetch distinct GSW product IDs
  console.log('🔍 Stap 2: Ophalen unieke GSW product IDs uit orderregels...');
  const activeGswProductIds = await getDistinctGswProductIds();
  console.log(`   ✅ Gevonden unieke GSW product IDs: ${activeGswProductIds.length}`);

  if (!activeGswProductIds || activeGswProductIds.length === 0) {
    throw new Error('pruneAndEnrichGswProducts: Geen actieve GSW product IDs gevonden. Aborting ter bescherming van catalogus.');
  }

  // 3. Prune catalog
  let prunedCount = 0;
  if (!dryRun) {
    console.log(`✂️  Stap 3: Snoeien van niet-GSW artikelen conform whitelist (${activeGswProductIds.length} te behouden)...`);
    prunedCount = await pruneNonGswProducts(activeGswProductIds);
    console.log(`   ✅ Verwijderd uit public.logictrade_products: ${prunedCount} overtollige artikelen.`);
  } else {
    console.log('✂️  Stap 3: [DRY-RUN] Overslaan van pruneNonGswProducts.');
  }

  // 4. Hydrate metadata via LogicTrade REST
  let enrichedCount = 0;
  let containerMarkedCount = 0;

  const connection = resolveLogicTradeConnectionConfig({ apiKey: options.apiKey, baseUrl: options.baseUrl });
  const apiKey = connection.apiKey;
  const baseUrl = connection.baseUrl.replace(/\/+$/, '');
  const adminGuid = options.adminGuid || process.env.LOGICTRADE_ADMIN_GUID;

  if (!apiKey) {
    console.warn('⚠️  Geen LogicTrade API key geconfigureerd; metadata-hydratie wordt overgeslagen.');
  } else if (!dryRun) {
    console.log(`📥 Stap 4: Ophalen van actuele metadata via LogicTrade REST (/products/{id}) voor ${activeGswProductIds.length} artikelen...`);
    const headers: Record<string, string> = {
      'api-key': apiKey,
      Accept: 'application/json',
    };
    if (adminGuid) {
      headers['administration-guid'] = adminGuid;
    }

    const fetchedProducts: LogicTradeProductRaw[] = [];
    const missingProductIds: number[] = [];

    await asyncPool(concurrency, activeGswProductIds, async (productId) => {
      const productUrl = `${baseUrl}/products/${productId}`;
      try {
        const res = await defaultRateLimiter.fetchWithAdaptiveBackoff(productUrl, {
          headers,
          cache: 'no-store',
        });

        if (res.status === 404) {
          missingProductIds.push(productId);
          return;
        }

        if (!res.ok) {
          console.warn(`[Hydrate] HTTP ${res.status} bij artikel ${productId}`);
          return;
        }

        const data = (await res.json()) as LogicTradeProductRaw;
        if (data && data.id) {
          fetchedProducts.push(data);
        }
      } catch (err: any) {
        console.warn(`[Hydrate] Netwerkfout bij artikel ${productId}: ${err.message}`);
      }
    });

    if (missingProductIds.length > 0) {
      console.log(`   ℹ️  ${missingProductIds.length} historische artikelen bestaan niet meer in actieve LT catalogus (HTTP 404).`);
    }

    if (fetchedProducts.length > 0) {
      console.log(`   💾 Upserten van ${fetchedProducts.length} verrijkte artikelen naar public.logictrade_products...`);
      const chunkSize = 50;
      for (let i = 0; i < fetchedProducts.length; i += chunkSize) {
        const chunk = fetchedProducts.slice(i, i + chunkSize);
        const count = await syncProductsBatch(chunk);
        enrichedCount += count;
      }
      console.log(`   ✅ Succesvol verrijkt en ge-upsert: ${enrichedCount} artikelen.`);
    }
  } else {
    console.log('📥 Stap 4: [DRY-RUN] Overslaan van REST hydratatie.');
  }

  // 5. Query final container count
  const { url, serviceKey, anonKey } = getSupabaseConfig();
  const token = serviceKey || anonKey;
  if (url && token) {
    try {
      const res = await fetch(`${url}/rest/v1/logictrade_products?is_generic_container=eq.true&select=id`, {
        headers: { apikey: token, Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const containers = await res.json();
        containerMarkedCount = Array.isArray(containers) ? containers.length : 0;
      }
    } catch {
      // Ignore
    }
  }

  console.log('================================================================');
  console.log('✅ GSW Catalogus-inkrimping & Verrijking Voltooid');
  console.log(`   • Geschoonde orders:         ${purgedNonGswOrders}`);
  console.log(`   • Actieve GSW artikelen:     ${activeGswProductIds.length}`);
  console.log(`   • Verwijderde artikelen:     ${prunedCount}`);
  console.log(`   • Verrijkte artikelen:       ${enrichedCount}`);
  console.log(`   • Gemarkeerde containers:    ${containerMarkedCount}`);
  console.log('================================================================\n');

  return {
    purgedNonGswOrders,
    activeGswProductIds,
    prunedCount,
    enrichedCount,
    containerMarkedCount,
  };
}

// Standalone CLI execution
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').includes('scripts/prune_and_enrich_gsw_products')) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const concIdx = args.indexOf('--concurrency');
  const concurrency = concIdx !== -1 && args[concIdx + 1] ? parseInt(args[concIdx + 1], 10) : 10;

  pruneAndEnrichGswProducts({ dryRun, concurrency })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('💥 Fatale fout tijdens uitvoering pruneAndEnrichGswProducts:', err);
      process.exit(1);
    });
}
