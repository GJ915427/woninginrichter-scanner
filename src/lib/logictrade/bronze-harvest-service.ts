/**
 * src/lib/logictrade/bronze-harvest-service.ts
 *
 * Dedicated Harvester for Complete LogicTrade Bronze Domains:
 * Customers, Suppliers, Purchase Orders, and Configurator Options & Option Values.
 */

import { resolveLogicTradeConnectionConfig } from './connection-config';
import { defaultRateLimiter, RateLimiter } from './rate-limiter';
import {
  getSupabaseConfig,
  getSyncState,
  updateSyncState,
  upsertConfiguratorSchemasBatch,
  upsertConfiguratorOptionValuesBatch,
  upsertCustomersBatch,
  upsertSuppliersBatch,
  upsertPurchaseOrdersBatch,
  ConfiguratorOptionValueRow,
  ConfiguratorSchemaRow,
  CustomerBronzeRow,
  SupplierBronzeRow,
  PurchaseOrderBronzeRow,
} from '@/lib/supabase/client';

export interface BronzeHarvestOptions {
  client?: any;
  dal?: any;
  apiKey?: string;
  baseUrl?: string;
  adminGuid?: string;
  requireApiKey?: boolean;
  rateLimiter?: RateLimiter;
}

export class BronzeHarvestService {
  private client: any;
  private dal: any;
  private apiKey: string;
  private baseUrl: string;
  private adminGuid?: string;
  private limiter: RateLimiter;

  constructor(options: BronzeHarvestOptions = {}) {
    this.client = options.client;
    this.dal = options.dal;
    const connection = resolveLogicTradeConnectionConfig({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      requireApiKey: options.requireApiKey ?? false,
    });
    this.apiKey = connection.apiKey;
    this.baseUrl = connection.baseUrl.replace(/\/+$/, '');
    this.adminGuid = options.adminGuid || process.env.LOGICTRADE_ADMIN_GUID;
    this.limiter = options.rateLimiter || defaultRateLimiter;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'api-key': this.apiKey,
      Accept: 'application/json',
    };
    if (this.adminGuid) {
      headers['administration-guid'] = this.adminGuid;
    }
    return headers;
  }

  public async harvestCustomers(options: { pageSize?: number } = {}): Promise<{ customersProcessed: number }> {
    const upsert = this.dal?.upsertCustomersBatch || upsertCustomersBatch;
    const syncUpdate = this.dal?.updateSyncState || updateSyncState;

    if (this.client?.fetchCustomers) {
      const res = await this.client.fetchCustomers();
      const results: any[] = Array.isArray(res) ? res : res?.results || [];
      const payload: CustomerBronzeRow[] = results.map((c) => ({
        id: c.id,
        customer_number: c.customerNumber || c.code || String(c.id),
        name: c.name || c.companyName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Onbekend',
        search_name: c.searchName || c.name || c.companyName || null,
        is_active: c.isActive !== false,
        lt_raw_data: c,
      }));
      if (payload.length > 0) {
        await upsert(payload);
      }
      await syncUpdate('customers_bronze_sync', payload.length, new Date().toISOString());
      return { customersProcessed: payload.length };
    }

    const pageSize = options.pageSize || 100;
    let page = 1;
    let totalPages = 1;
    let totalCustomers = 0;

    do {
      const fetchUrl = `${this.baseUrl}/customers?pageSize=${pageSize}&pageNumber=${page}`;
      const res = await this.limiter.fetchWithAdaptiveBackoff(fetchUrl, {
        headers: this.getHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`LogicTrade customers harvest HTTP error ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      const results: any[] = data.results || [];
      totalPages = data.pagination?.totalPages ?? data.totalPages ?? 1;

      if (results.length > 0) {
        const payload: CustomerBronzeRow[] = results.map((c) => ({
          id: c.id,
          customer_number: c.customerNumber || c.code || String(c.id),
          name: c.name || c.companyName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Onbekend',
          search_name: c.searchName || c.name || c.companyName || null,
          is_active: c.isActive !== false,
          lt_raw_data: c,
        }));
        await upsert(payload);
      }

      totalCustomers += results.length;
      page++;
    } while (page <= totalPages);

    await syncUpdate('customers_bronze_sync', totalCustomers, new Date().toISOString());
    return { customersProcessed: totalCustomers };
  }

  public async harvestSuppliers(options: { pageSize?: number } = {}): Promise<{ suppliersProcessed: number }> {
    const upsert = this.dal?.upsertSuppliersBatch || upsertSuppliersBatch;
    const syncUpdate = this.dal?.updateSyncState || updateSyncState;

    if (this.client?.fetchSuppliers) {
      const res = await this.client.fetchSuppliers();
      const results: any[] = Array.isArray(res) ? res : res?.results || [];
      const payload: SupplierBronzeRow[] = results.map((s) => ({
        id: s.id,
        supplier_number: s.supplierNumber || s.code || String(s.id),
        name: s.name || s.companyName || 'Onbekend',
        is_active: s.isActive !== false,
        lt_raw_data: s,
      }));
      if (payload.length > 0) {
        await upsert(payload);
      }
      await syncUpdate('suppliers_bronze_sync', payload.length, new Date().toISOString());
      return { suppliersProcessed: payload.length };
    }

    const pageSize = options.pageSize || 100;
    let page = 1;
    let totalPages = 1;
    let totalSuppliers = 0;

    do {
      const fetchUrl = `${this.baseUrl}/suppliers?pageSize=${pageSize}&pageNumber=${page}`;
      const res = await this.limiter.fetchWithAdaptiveBackoff(fetchUrl, {
        headers: this.getHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`LogicTrade suppliers harvest HTTP error ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      const results: any[] = data.results || [];
      totalPages = data.pagination?.totalPages ?? data.totalPages ?? 1;

      if (results.length > 0) {
        const payload: SupplierBronzeRow[] = results.map((s) => ({
          id: s.id,
          supplier_number: s.supplierNumber || s.code || String(s.id),
          name: s.name || s.companyName || 'Onbekend',
          is_active: s.isActive !== false,
          lt_raw_data: s,
        }));
        await upsert(payload);
      }

      totalSuppliers += results.length;
      page++;
    } while (page <= totalPages);

    await syncUpdate('suppliers_bronze_sync', totalSuppliers, new Date().toISOString());
    return { suppliersProcessed: totalSuppliers };
  }

  public async harvestPurchaseOrders(
    options: { pageSize?: number; originCode?: string } = {}
  ): Promise<{ purchaseOrdersProcessed: number; purchaseOrderLinesProcessed: number }> {
    const upsert = this.dal?.upsertPurchaseOrdersBatch || upsertPurchaseOrdersBatch;
    const syncUpdate = this.dal?.updateSyncState || updateSyncState;
    const originCode = options.originCode ?? 'Winkel GSW BV';
    const pageSize = options.pageSize || 100;

    const originQuery = originCode ? `&originCode=${originCode.replace(/ /g, '+')}` : '';

    if (this.client?.fetchPurchaseOrders) {
      const requestedUrl = `${this.baseUrl}/purchaseorders?pageSize=${pageSize}&pageNumber=1${originQuery}`;
      const res = await this.client.fetchPurchaseOrders(requestedUrl);
      const results: any[] = Array.isArray(res) ? res : res?.results || [];
      const payload: PurchaseOrderBronzeRow[] = results.map((po) => ({
        id: po.id,
        order_number: po.orderNumber || po.number || String(po.id),
        supplier_id: po.supplier?.id || po.supplierId || null,
        status: po.status || 'ORDER',
        order_date: po.orderDate || po.date || null,
        total_gross_cents: po.totalGrossCents ?? (typeof po.totalGross === 'number' ? Math.round(po.totalGross * 100) : (typeof po.totalPrice === 'number' ? Math.round(po.totalPrice * 100) : 0)),
        lt_raw_data: po,
        lines: po.lines || po.orderLines || [],
      }));
      if (payload.length > 0) {
        await upsert(payload);
      }
      const linesCount = payload.reduce((acc, po) => acc + (po.lines?.length || 0), 0);
      await syncUpdate('purchaseorders_bronze_sync', payload.length, new Date().toISOString());
      return { purchaseOrdersProcessed: payload.length, purchaseOrderLinesProcessed: linesCount };
    }

    let page = 1;
    let totalPages = 1;
    let totalPurchaseOrders = 0;
    let totalPurchaseOrderLines = 0;

    do {
      const fetchUrl = `${this.baseUrl}/purchaseorders?pageSize=${pageSize}&pageNumber=${page}${originQuery}`;
      const res = await this.limiter.fetchWithAdaptiveBackoff(fetchUrl, {
        headers: this.getHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`LogicTrade purchase orders harvest HTTP error ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      const results: any[] = data.results || [];
      totalPages = data.pagination?.totalPages ?? data.totalPages ?? 1;

      if (results.length > 0) {
        const payload: PurchaseOrderBronzeRow[] = results.map((po) => ({
          id: po.id,
          order_number: po.orderNumber || po.number || String(po.id),
          supplier_id: po.supplier?.id || po.supplierId || null,
          status: po.status || 'ORDER',
          order_date: po.orderDate || po.date || null,
          total_gross_cents: po.totalGrossCents ?? (typeof po.totalGross === 'number' ? Math.round(po.totalGross * 100) : (typeof po.totalPrice === 'number' ? Math.round(po.totalPrice * 100) : 0)),
          lt_raw_data: po,
          lines: po.lines || po.orderLines || [],
        }));

        totalPurchaseOrderLines += payload.reduce((acc: number, po: any) => acc + (po.lines?.length || 0), 0);
        await upsert(payload);
      }

      totalPurchaseOrders += results.length;
      page++;
    } while (page <= totalPages);

    await syncUpdate('purchaseorders_bronze_sync', totalPurchaseOrders, new Date().toISOString());
    return { purchaseOrdersProcessed: totalPurchaseOrders, purchaseOrderLinesProcessed: totalPurchaseOrderLines };
  }

  public async harvestConfiguratorOptionsAndValues(
    options: {
      persistBronzeValues?: boolean;
      preserveSilverOnConflict?: boolean;
      pageSize?: number;
    } = {}
  ): Promise<{ optionsProcessed: number; valuesProcessed: number }> {
    let rawOptions: any[] = [];

    if (this.client?.fetchConfiguratorOptions) {
      rawOptions = await this.client.fetchConfiguratorOptions();
    } else {
      let optPage = 1;
      let optTotalPages = 1;
      do {
        const optUrl = `${this.baseUrl}/products/configurator/options?pageSize=${options.pageSize || 100}&pageNumber=${optPage}`;
        const res = await this.limiter.fetchWithAdaptiveBackoff(optUrl, {
          headers: this.getHeaders(),
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error(`LogicTrade configurator options error HTTP ${res.status}`);
        }
        const data = await res.json();
        const batch: any[] = data.results || [];
        rawOptions.push(...batch);
        optTotalPages = data.pagination?.totalPages ?? data.totalPages ?? 1;
        optPage++;
      } while (optPage <= optTotalPages);
    }

    const upsertSchemas = this.dal?.upsertConfiguratorSchemasBatch || upsertConfiguratorSchemasBatch;
    const upsertOptionValues = this.dal?.upsertConfiguratorOptionValuesBatch || upsertConfiguratorOptionValuesBatch;

    // Step 1: Parent pre-upsert with preserveSilverOnConflict: true
    if (rawOptions.length > 0) {
      const parentRows: ConfiguratorSchemaRow[] = rawOptions.map((opt) => ({
        option_id: opt.id,
        code: opt.code,
        name: opt.name || opt.description || opt.code,
        description: opt.description || opt.name,
        kind: opt.kind ?? 400,
        is_active: false,
        possible_values: [],
        lt_raw_data: opt,
      }));
      await upsertSchemas(parentRows, { preserveSilverOnConflict: options.preserveSilverOnConflict ?? true });
    }

    let totalValues = 0;
    let valueBuffer: ConfiguratorOptionValueRow[] = [];

    // Step 2: Stream option values in buffered chunks <= 250
    for (const opt of rawOptions) {
      let page = 1;
      let totalPages = 1;

      do {
        let vBatch: any[] = [];
        if (this.client?.fetchConfiguratorOptionValues) {
          const vData = await this.client.fetchConfiguratorOptionValues(opt.id, page);
          vBatch = vData.results || [];
          totalPages = Math.ceil((vData.pagination?.totalResults || 0) / (vData.pagination?.pageSize || 100)) || 1;
        } else {
          const valUrl = `${this.baseUrl}/products/configurator/options/${opt.id}/values?pageSize=100&pageNumber=${page}`;
          const vRes = await this.limiter.fetchWithAdaptiveBackoff(valUrl, {
            headers: this.getHeaders(),
            cache: 'no-store',
          });
          if (!vRes.ok) {
            throw new Error(`Option values error for option ${opt.id} HTTP ${vRes.status}`);
          }
          const vData = await vRes.json();
          vBatch = vData.results || [];
          totalPages = vData.pagination?.totalPages || (vData.pagination?.totalResults ? Math.ceil(vData.pagination.totalResults / (vData.pagination.pageSize || 100)) : (vData.totalPages || 1));
        }

        if (vBatch.length > 0 && options.persistBronzeValues) {
          const bronzeBatch: ConfiguratorOptionValueRow[] = vBatch.map((val) => ({
            option_id: opt.id,
            value_id: val.id,
            code: val.code || String(val.id),
            description: val.description || val.name || val.code,
            name: val.name || val.description || val.code,
            is_active: val.isActive !== false,
            lt_raw_data: val,
          }));

          valueBuffer.push(...bronzeBatch);
          while (valueBuffer.length >= 250) {
            const chunk = valueBuffer.splice(0, 250);
            await upsertOptionValues(chunk);
          }
        }

        totalValues += vBatch.length;
        page++;
      } while (page <= totalPages);
    }

    // Flush any remaining buffered option values
    if (valueBuffer.length > 0 && options.persistBronzeValues) {
      await upsertOptionValues(valueBuffer);
      valueBuffer = [];
    }

    const syncUpdate = this.dal?.updateSyncState || updateSyncState;
    await syncUpdate('schemas_bronze_sync', rawOptions.length, new Date().toISOString());

    return {
      optionsProcessed: rawOptions.length,
      valuesProcessed: totalValues,
    };
  }

  public async backfillMissingRawHashes(options: { targetTable?: string; limit?: number } = {}): Promise<{ totalProcessed: number; hasMore: boolean }> {
    const { url, anonKey, serviceKey } = getSupabaseConfig();
    const token = serviceKey || anonKey;
    if (!url || !token) return { totalProcessed: 0, hasMore: false };

    const target = options.targetTable || 'all';
    const limit = options.limit || 500;
    const res = await fetch(`${url}/rest/v1/rpc/backfill_bronze_raw_hashes_batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: token,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_target: target,
        p_last_key: '',
        p_limit: limit,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`backfill_bronze_raw_hashes_batch HTTP ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    return {
      totalProcessed: Number(data?.processed_count ?? data ?? 0),
      hasMore: Boolean(data?.has_more ?? false),
    };
  }
}

export async function harvestCustomersBronze(
  options: BronzeHarvestOptions & { pageSize?: number } = {}
): Promise<{ customersProcessed: number }> {
  const service = new BronzeHarvestService(options);
  return service.harvestCustomers(options);
}

export async function harvestSuppliersBronze(
  options: BronzeHarvestOptions & { pageSize?: number } = {}
): Promise<{ suppliersProcessed: number }> {
  const service = new BronzeHarvestService(options);
  return service.harvestSuppliers(options);
}

export async function harvestPurchaseOrdersBronze(
  options: BronzeHarvestOptions & { pageSize?: number; originCode?: string } = {}
): Promise<{ purchaseOrdersProcessed: number; purchaseOrderLinesProcessed: number }> {
  const service = new BronzeHarvestService(options);
  return service.harvestPurchaseOrders(options);
}

export async function backfillMissingRawHashesBronze(options: BronzeHarvestOptions & { targetTable?: string; limit?: number } = {}): Promise<{ totalProcessed: number; hasMore: boolean }> {
  const service = new BronzeHarvestService(options);
  return service.backfillMissingRawHashes(options);
}
