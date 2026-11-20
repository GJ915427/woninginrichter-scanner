#!/usr/bin/env node
/**
 * scripts/verify-bronze-parity.ts
 *
 * Deterministic Mechanical-Before-Cognitive Gate (INV-SYS-13, INV-RAW-IMMUTABILITY-01)
 * Verifies live database state against cryptographic hash integrity:
 * 1. Checks all 9 Bronze tables using Keyset-Chunking (LIMIT 500) to eliminate SQLSTATE 57014.
 * 2. Confirms corrupted_hashes == 0 across all tables.
 * 3. Enforces sub_line = 1 order lines have lt_raw_data IS NULL and lt_raw_hash IS NULL.
 * 4. Exits with code 0 on 100% parity; exits with code 1 fail-closed on any failure.
 */

import { getSupabaseConfig } from '../src/lib/supabase/client';

export interface ParityVerificationRow {
  table_name: string;
  total_rows: number;
  rows_with_raw_data: number;
  rows_with_hash: number;
  corrupted_hashes: number;
}

export const BRONZE_TABLES_TO_VERIFY = [
  { key: 'orders', label: 'orders' },
  { key: 'order_lines', label: 'order_lines (sub_line=0)' },
  { key: 'order_lines_sub1', label: 'order_lines (sub_line=1)' },
  { key: 'logictrade_products', label: 'logictrade_products' },
  { key: 'logictrade_configurator_schemas', label: 'logictrade_configurator_schemas' },
  { key: 'logictrade_configurator_option_values', label: 'logictrade_configurator_option_values' },
  { key: 'logictrade_customers', label: 'logictrade_customers' },
  { key: 'logictrade_suppliers', label: 'logictrade_suppliers' },
  { key: 'logictrade_purchase_orders', label: 'logictrade_purchase_orders' },
  { key: 'logictrade_purchase_order_lines', label: 'logictrade_purchase_order_lines' },
];

export async function verifyBronzeParityGate(): Promise<{
  success: boolean;
  results: ParityVerificationRow[];
}> {
  const { url, anonKey, serviceKey } = getSupabaseConfig();
  const token = serviceKey || anonKey;

  if (!url || !token) {
    throw new Error('Supabase URL en token zijn vereist voor mechanische pariteitsverificatie.');
  }

  console.log('================================================================');
  console.log('🔍 Mechanische Pariteitspoort: Keyset-Chunked Hash Verificatie');
  console.log('================================================================\n');

  const results: ParityVerificationRow[] = [];
  let hasErrors = false;

  for (const table of BRONZE_TABLES_TO_VERIFY) {
    let lastKey = '';
    let hasMore = true;
    let tableTotal = 0;
    let tableWithRaw = 0;
    let tableWithHash = 0;
    let tableCorrupt = 0;

    while (hasMore) {
      const rpcRes = await fetch(`${url}/rest/v1/rpc/verify_bronze_immutability_and_hashes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: token,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          p_table: table.key,
          p_last_key: lastKey,
          p_limit: 500,
        }),
      });

      if (!rpcRes.ok) {
        const errText = await rpcRes.text().catch(() => 'Unknown error');
        throw new Error(`RPC verify_bronze_immutability_and_hashes voor ${table.key} mislukt (HTTP ${rpcRes.status}): ${errText}`);
      }

      const rows = (await rpcRes.json()) as any[];
      if (!Array.isArray(rows) || rows.length === 0) {
        break;
      }

      const chunk = rows[0];
      const count = Number(chunk.total_rows) || 0;
      tableTotal += count;
      tableWithRaw += Number(chunk.rows_with_raw_data) || 0;
      tableWithHash += Number(chunk.rows_with_hash) || 0;
      tableCorrupt += Number(chunk.corrupted_hashes) || 0;

      lastKey = String(chunk.next_last_key || '');
      hasMore = Boolean(chunk.has_more) && count > 0 && lastKey !== '';
    }

    const row: ParityVerificationRow = {
      table_name: table.label,
      total_rows: tableTotal,
      rows_with_raw_data: tableWithRaw,
      rows_with_hash: tableWithHash,
      corrupted_hashes: tableCorrupt,
    };
    results.push(row);

    if (row.corrupted_hashes > 0) {
      console.error(`❌ CORRUPTIE: Tabel '${row.table_name}' bevat ${row.corrupted_hashes} corrupte hashes!`);
      hasErrors = true;
    }
    if (row.table_name.includes('sub_line=1') && (row.rows_with_raw_data > 0 || row.rows_with_hash > 0)) {
      console.error(`❌ INVARIANT SHIFT: 'order_lines (sub_line=1)' bevat niet-lege raw_data of hash!`);
      hasErrors = true;
    }
  }

  console.table(results);

  if (hasErrors) {
    console.error('\n💥 Mechanische Pariteitspoort: GEFAALD (Fail-Closed).');
    return { success: false, results };
  }

  console.log('\n✅ Mechanische Pariteitspoort: 100% SUCCES (Alle tabellen integer).');
  return { success: true, results };
}

if (process.env.NODE_ENV !== 'test') {
  verifyBronzeParityGate()
    .then((res) => {
      if (!res.success) {
        process.exitCode = 1;
      } else {
        process.exitCode = 0;
      }
    })
    .catch((err) => {
      console.error('💥 Onverwachte fout in parity gate:', err);
      process.exit(1);
    });
}
