/**
 * src/lib/supabase/order-client.ts
 *
 * Data Access Layer (DAL) Adapter voor Order Ingest, JIT Catalogus Disambiguatie
 * en PostgREST RPC transacties conform INV-GOV-21C.
 */

import { getSupabaseConfig } from './client';
import type { IngestedOrderBundle, ResolvedProductEntity } from '@/types/order-intake';

export async function resolveProductByCode(
  productCode: string,
  supplierName?: string
): Promise<ResolvedProductEntity | null> {
  const code = (productCode || '').trim();
  if (!code || code.toUpperCase() === 'TEKST') {
    return null;
  }

  const config = getSupabaseConfig();
  const authKey = config.serviceKey || config.anonKey;
  if (!config.url || !authKey) {
    return null;
  }

  try {
    // 1. Primaire poging: code + leverancier
    if (supplierName && supplierName.trim()) {
      const supParam = encodeURIComponent(supplierName.trim());
      const codeParam = encodeURIComponent(code);
      const url = `${config.url}/rest/v1/logictrade_products?code=eq.${codeParam}&supplier_name=ilike.*${supParam}*&select=id,code,supplier_name,product_group_code&order=modified_at.desc&limit=1`;
      const res = await fetch(url, {
        headers: { apikey: authKey, Authorization: `Bearer ${authKey}` },
      });
      if (res.ok) {
        const rows = (await res.json()) as ResolvedProductEntity[];
        if (Array.isArray(rows) && rows.length > 0) {
          return rows[0];
        }
      }
    }

    // 2. Secundaire poging: Meest recente SKU match
    const codeParam = encodeURIComponent(code);
    const url = `${config.url}/rest/v1/logictrade_products?code=eq.${codeParam}&select=id,code,supplier_name,product_group_code&order=modified_at.desc&limit=1`;
    const res = await fetch(url, {
      headers: { apikey: authKey, Authorization: `Bearer ${authKey}` },
    });
    if (res.ok) {
      const rows = (await res.json()) as ResolvedProductEntity[];
      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0];
      }
    }
  } catch (err) {
    console.error('Fout bij resolveProductByCode:', err);
  }

  return null;
}

export async function ingestOrderTransaction(
  bundle: IngestedOrderBundle
): Promise<{ success: boolean; order_id: string; lines_processed: number }> {
  const config = getSupabaseConfig();
  const authKey = config.serviceKey || config.anonKey;

  if (!config.url || !authKey) {
    throw new Error('Supabase configuratie ontbreekt voor order ingest transactie.');
  }

  const res = await fetch(`${config.url}/rest/v1/rpc/ingest_logictrade_order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: authKey,
      Authorization: `Bearer ${authKey}`,
    },
    body: JSON.stringify({ p_order: bundle }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`RPC ingest_logictrade_order mislukt: ${res.status} ${errorText}`);
  }

  return (await res.json()) as { success: boolean; order_id: string; lines_processed: number };
}
