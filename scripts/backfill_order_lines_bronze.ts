#!/usr/bin/env node
/**
 * scripts/backfill_order_lines_bronze.ts
 * Keyset-Cursor Batch Runner voor Bronze Layer Order Lines Backfill.
 * Zero-dependency native fetch architectuur conform src/lib/supabase/client.ts.
 * Verwerkt alle 21.980 orders in micro-batches van 500 zonder statement timeouts.
 */

import { getSupabaseConfig } from '../src/lib/supabase/client';

const BATCH_SIZE = 100;

export async function executeBatchRpc(
  url: string,
  baseHeaders: Record<string, string>,
  orderIds: string[]
): Promise<number> {
  try {
    const rpcRes = await fetch(`${url}/rest/v1/rpc/backfill_order_lines_bronze_batch`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ p_order_ids: orderIds }),
    });

    if (!rpcRes.ok) {
      const errText = await rpcRes.text();
      if (orderIds.length > 1) {
        console.warn(`⚠️ Batch fout (${rpcRes.status}), bisecteer ${orderIds.length} orders in 2 helften...`);
        const mid = Math.floor(orderIds.length / 2);
        const count1 = await executeBatchRpc(url, baseHeaders, orderIds.slice(0, mid));
        const count2 = await executeBatchRpc(url, baseHeaders, orderIds.slice(mid));
        return count1 + count2;
      }
      throw new Error(`RPC backfill fout bij order ${orderIds[0]}: HTTP ${rpcRes.status}: ${errText}`);
    }

    const count = (await rpcRes.json()) as number;
    return typeof count === 'number' ? count : 0;
  } catch (err: any) {
    if (orderIds.length > 1) {
      console.warn(`⚠️ Exception (${err.message}), bisecteer ${orderIds.length} orders...`);
      const mid = Math.floor(orderIds.length / 2);
      const count1 = await executeBatchRpc(url, baseHeaders, orderIds.slice(0, mid));
      const count2 = await executeBatchRpc(url, baseHeaders, orderIds.slice(mid));
      return count1 + count2;
    }
    throw err;
  }
}

export async function backfillBronzeOrderLines(): Promise<{ totalOrders: number; updatedLines: number }> {
  const { url, anonKey, serviceKey } = getSupabaseConfig();
  const token = serviceKey || anonKey;

  if (!url || !token) {
    throw new Error('Supabase URL en authenticatie-sleutel zijn vereist in environment');
  }

  const baseHeaders = {
    'Content-Type': 'application/json',
    apikey: token,
    Authorization: `Bearer ${token}`,
  };

  const cursorArg = process.argv.find((a) => a.startsWith('--cursor='));
  let lastId = cursorArg ? cursorArg.split('=')[1] : '';

  console.log(`🚀 Start Keyset-Cursor Bronze Order Lines Backfill (Batch: ${BATCH_SIZE}, Cursor: '${lastId}')...`);
  let totalProcessed = 0;
  let totalUpdatedLines = 0;
  let hasMore = true;

  // Tel totaal aantal orders met ruwe data via HTTP Range / Prefer count=exact
  let totalOrders = 0;
  try {
    const countRes = await fetch(`${url}/rest/v1/orders?select=id`, {
      method: 'GET',
      headers: {
        ...baseHeaders,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    });
    const contentRange = countRes.headers.get('content-range');
    if (contentRange && contentRange.includes('/')) {
      totalOrders = parseInt(contentRange.split('/')[1], 10) || 0;
    }
  } catch (err) {
    console.warn('Kon totaal telling niet ophalen via content-range, doorgaan met dynamische cursor:', err);
  }

  console.log(`📊 Totaal orders met raw_data in database: ${totalOrders > 0 ? totalOrders : 'onbekend'}`);

  while (hasMore) {
    let endpoint = `${url}/rest/v1/orders?select=id&order=id.asc&limit=${BATCH_SIZE}`;
    if (lastId) {
      endpoint += `&id=gt.${encodeURIComponent(lastId)}`;
    }

    const fetchRes = await fetch(endpoint, {
      method: 'GET',
      headers: baseHeaders,
    });

    if (!fetchRes.ok) {
      const errText = await fetchRes.text();
      throw new Error(`Fout bij ophalen order batch na id ${lastId}: HTTP ${fetchRes.status}: ${errText}`);
    }

    const orders = (await fetchRes.json()) as Array<{ id: string }>;
    if (!Array.isArray(orders) || orders.length === 0) {
      hasMore = false;
      break;
    }

    const orderIds = orders.map((o) => o.id);
    lastId = orderIds[orderIds.length - 1];

    const updatedCount = await executeBatchRpc(url, baseHeaders, orderIds);

    totalProcessed += orderIds.length;
    totalUpdatedLines += typeof updatedCount === 'number' ? updatedCount : 0;

    const progressPct = totalOrders > 0 ? ((totalProcessed / totalOrders) * 100).toFixed(1) : '100';
    console.log(
      `[${progressPct}%] Verwerkt: ${totalProcessed}/${totalOrders > 0 ? totalOrders : '?'} orders | Geüpdatete regels: ${totalUpdatedLines} | Cursor: ${lastId}`
    );

    if (orders.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  console.log(`✅ Voltooid: ${totalProcessed} orders verwerkt, ${totalUpdatedLines} orderregels voorzien van Bronze data.`);
  return { totalOrders: totalProcessed, updatedLines: totalUpdatedLines };
}

if (process.env.NODE_ENV !== 'test') {
  backfillBronzeOrderLines()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Fatale backfill fout:', err);
      process.exit(1);
    });
}
