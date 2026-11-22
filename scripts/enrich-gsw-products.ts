/**
 * scripts/enrich-gsw-products.ts
 *
 * Verrijking van ontbrekende GSW artikelen (390 stuks) direct vanuit de LogicTrade REST API:
 * 1. Ophalen van unieke ontbrekende productcodes uit public.order_lines via public.get_missing_gsw_product_codes() RPC.
 * 2. Ophalen van actuele artikelmetadata via LogicTrade REST API (/products?code={code}) met adaptive rate limiter.
 * 3. Batchgewijs upserten van de opgehaalde artikelen naar public.logictrade_products via syncProductsBatch().
 * 4. Reconciliatie van orderregels: updaten van order_lines.product_id op basis van logictrade_products.id.
 */

import { getSupabaseConfig } from '../src/lib/supabase/client';
import { resolveLogicTradeConnectionConfig } from '../src/lib/logictrade/connection-config';
import { defaultRateLimiter } from '../src/lib/logictrade/rate-limiter';
import { syncProductsBatch } from '../src/lib/logictrade/sync-service';
import type { LogicTradeProductRaw } from '../src/types/product';

export interface EnrichMissingGswProductsOptions {
  concurrency?: number;
  apiKey?: string;
  baseUrl?: string;
  adminGuid?: string;
}

export interface EnrichMissingGswProductsResult {
  missingCodesCount: number;
  fetchedCount: number;
  enrichedCount: number;
  notFoundCount: number;
  updatedOrderLinesCount: number;
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

export async function enrichMissingGswProducts(
  options: EnrichMissingGswProductsOptions = {}
): Promise<EnrichMissingGswProductsResult> {
  const concurrency = options.concurrency ?? 5;

  console.log('================================================================');
  console.log('🚀 Start Verrijking van Ontbrekende GSW Artikelen (Stap 1B)');
  console.log('================================================================');

  // 1. Fetch missing product codes from Supabase
  const { url: supabaseUrl, serviceKey, anonKey } = getSupabaseConfig();
  const token = serviceKey || anonKey;
  if (!supabaseUrl || !token) {
    throw new Error('Supabase configuratie ontbreekt (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  }

  console.log('🔍 Stap 1: Ophalen van ontbrekende productcodes uit order_lines...');
  const rpcUrl = `${supabaseUrl}/rest/v1/rpc/get_missing_gsw_product_codes`;
  const rpcRes = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!rpcRes.ok) {
    throw new Error(`Fout bij ophalen ontbrekende productcodes HTTP ${rpcRes.status}: ${await rpcRes.text()}`);
  }

  const rpcData = (await rpcRes.json()) as Array<{ product_code: string }>;
  const missingCodes = rpcData.map((r) => r.product_code).filter(Boolean);
  console.log(`   ✅ Gevonden ontbrekende productcodes in orderregels: ${missingCodes.length}`);

  if (missingCodes.length === 0) {
    console.log('   🎉 Geen ontbrekende productcodes gevonden. Catalogus is reeds 100% compleet!');
    return {
      missingCodesCount: 0,
      fetchedCount: 0,
      enrichedCount: 0,
      notFoundCount: 0,
      updatedOrderLinesCount: 0,
    };
  }

  // 2. Setup LogicTrade client
  const connection = resolveLogicTradeConnectionConfig({ apiKey: options.apiKey, baseUrl: options.baseUrl });
  const apiKey = connection.apiKey;
  const baseUrl = connection.baseUrl.replace(/\/+$/, '');
  const adminGuid = options.adminGuid || process.env.LOGICTRADE_ADMIN_GUID;

  if (!apiKey) {
    throw new Error('LogicTrade API key ontbreekt (LOGICTRADE_API_KEY).');
  }

  const headers: Record<string, string> = {
    'api-key': apiKey,
    Accept: 'application/json',
  };
  if (adminGuid) {
    headers['administration-guid'] = adminGuid;
  }

  // 3. Fetch product metadata from LogicTrade REST API
  console.log(`📥 Stap 2: Ophalen van actuele metadata via LogicTrade REST voor ${missingCodes.length} artikelen...`);
  const fetchedProducts: LogicTradeProductRaw[] = [];
  const notFoundCodes: string[] = [];

  await asyncPool(concurrency, missingCodes, async (code) => {
    try {
      const productUrl = `${baseUrl}/products?code=${encodeURIComponent(code)}`;
      const res = await defaultRateLimiter.fetchWithAdaptiveBackoff(productUrl, {
        headers,
        cache: 'no-store',
      });

      if (!res.ok) {
        notFoundCodes.push(code);
        return;
      }

      const payload = await res.json();
      const results: LogicTradeProductRaw[] = Array.isArray(payload.results)
        ? payload.results
        : (Array.isArray(payload) ? payload : []);

      if (results.length > 0) {
        const exact = results.find((p) => p.code?.toUpperCase() === code.toUpperCase()) || results[0];
        fetchedProducts.push(exact);
      } else {
        notFoundCodes.push(code);
      }
    } catch (err: any) {
      console.warn(`[Enrich] Fout bij ophalen artikelcode ${code}: ${err.message}`);
      notFoundCodes.push(code);
    }
  });

  console.log(`   ✅ Succesvol opgehaald uit LogicTrade REST: ${fetchedProducts.length} artikelen.`);
  if (notFoundCodes.length > 0) {
    console.log(`   ℹ️  ${notFoundCodes.length} codes niet gevonden in actieve LT catalogus (historisch/inactief).`);
  }

  // 4. Batch upsert into public.logictrade_products
  let enrichedCount = 0;
  if (fetchedProducts.length > 0) {
    console.log(`💾 Stap 3: Upserten van ${fetchedProducts.length} artikelen naar public.logictrade_products...`);
    const chunkSize = 50;
    for (let i = 0; i < fetchedProducts.length; i += chunkSize) {
      const chunk = fetchedProducts.slice(i, i + chunkSize);
      const count = await syncProductsBatch(chunk);
      enrichedCount += count;
    }
    console.log(`   ✅ Ge-upsert naar database: ${enrichedCount} artikelen.`);
  }

  // 5. Reconcile order_lines.product_id
  console.log('🔄 Stap 4: Reconciliatie van orderregels met gekoppelde product_id...');
  let updatedOrderLinesCount = 0;
  const reconcileRes = await fetch(`${supabaseUrl}/rest/v1/rpc/reconcile_order_lines_product_ids`, {
    method: 'POST',
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (reconcileRes.ok) {
    const updated = await reconcileRes.json();
    updatedOrderLinesCount = typeof updated === 'number' ? updated : (updated?.count || 0);
    console.log(`   ✅ Gereconcilieerde orderregels: ${updatedOrderLinesCount}`);
  } else {
    console.warn(`   ⚠️ Reconcile RPC niet aangeroepen (HTTP ${reconcileRes.status}), wordt meegenomen tijdens --from-db ingestion.`);
  }

  console.log('================================================================');
  console.log('✅ GSW Catalogus Verrijking Voltooid');
  console.log(`   • Te verrijken SKU codes:    ${missingCodes.length}`);
  console.log(`   • Opgehaald uit LT API:      ${fetchedProducts.length}`);
  console.log(`   • Ge-upsert naar database:   ${enrichedCount}`);
  console.log(`   • Niet gevonden in LT API:   ${notFoundCodes.length}`);
  console.log('================================================================\n');

  return {
    missingCodesCount: missingCodes.length,
    fetchedCount: fetchedProducts.length,
    enrichedCount,
    notFoundCount: notFoundCodes.length,
    updatedOrderLinesCount,
  };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').includes('scripts/enrich-gsw-products')) {
  enrichMissingGswProducts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('💥 Fatale fout tijdens uitvoering enrichMissingGswProducts:', err);
      process.exit(1);
    });
}
