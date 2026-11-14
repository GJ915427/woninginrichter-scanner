import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetOrderTotalsCache,
  requireServiceRoleKey,
  ingestOrderTransaction,
  acquireSyncLeaseDal,
  releaseSyncLeaseDal,
  getSyncCursorDal,
  updateSyncCursorDal,
  fetchOrderSummariesDal,
  fetchOrderMatrixBundleDal,
} from '@/lib/supabase/order-client';
import { toOrderLinePatchDto } from '@/lib/supabase/order-mutation-client';
import { bundleMatrixOrder } from '@/hooks/useMatrixOrderBundle';
import { seedMatrixOrders } from '../../../../scripts/seed_matrix_orders';
import {
  assertRunOrderIngestionConfig,
  ingestOrderRecord,
} from '../../../../scripts/run-order-ingestion';
import type { IngestedOrderBundle } from '@/types/order-intake';

const ROOT = process.cwd();

const SAMPLE_BUNDLE: IngestedOrderBundle = {
  order: {
    id: '117282',
    order_number: 'V26002086',
    customer_name: 'De Vries Wonen',
    fsm_phase: '5. Bestellen (Actueel)',
    fsm_step: 5,
    total_amount_cents: 12500,
    status: 'active',
    raw_data: {},
  },
  lines: [
    {
      line_number: 1,
      sub_line: 0,
      external_line_id: 'lt-line-1',
      product_id: null,
      product_code: 'TEKST',
      product_group_code: '1.1',
      description: 'Testgordijn',
      quantity: 2.5,
      unit: 'm1',
      unit_price_cents: 5000,
      total_price_cents: 12500,
      is_hybrid: false,
      is_inbegrepen: false,
      etage_name: 'Begane grond',
    },
  ],
};

describe('Fase 2A: order-client, sync lease/cursor DAL & SQL invarianten', () => {
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    _resetOrderTotalsCache();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    if (originalServiceKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Fail-Closed Service Role Guard', () => {
    it('blokkeert requireServiceRoleKey en alle muterende DAL/CLI calls vóór fetch zodra SUPABASE_SERVICE_ROLE_KEY ontbreekt', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(() => requireServiceRoleKey()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/i);
      expect(() => assertRunOrderIngestionConfig()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/i);

      await expect(ingestOrderTransaction(SAMPLE_BUNDLE)).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/i);
      await expect(acquireSyncLeaseDal('logictrade_orders', 'worker-1', 300)).rejects.toThrow(
        /SUPABASE_SERVICE_ROLE_KEY/i
      );
      await expect(releaseSyncLeaseDal('logictrade_orders', 'worker-1')).rejects.toThrow(
        /SUPABASE_SERVICE_ROLE_KEY/i
      );
      await expect(getSyncCursorDal('logictrade_orders')).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/i);
      await expect(updateSyncCursorDal('logictrade_orders', '2026-11-12T00:00:00Z', 5)).rejects.toThrow(
        /SUPABASE_SERVICE_ROLE_KEY/i
      );
      await expect(seedMatrixOrders()).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/i);
      await expect(
        ingestOrderRecord({ id: 117282, number: 'V26002086' }, [])
      ).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/i);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('roept acquireSyncLeaseDal en releaseSyncLeaseDal aan met Bearer serviceKey en retourneert lease-resultaat', async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
      fetchMock
        .mockResolvedValueOnce(
          new Response(JSON.stringify([{ acquired: true, owner_id: 'worker-1' }]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(true), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );

      const acquired = await acquireSyncLeaseDal('logictrade_orders', 'worker-1', 300);
      expect(acquired.acquired).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0][0])).toContain('/rest/v1/rpc/acquire_logictrade_sync_lease');
      expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({
        Authorization: 'Bearer test-service-role-key',
        apikey: 'test-service-role-key',
      });

      const released = await releaseSyncLeaseDal('logictrade_orders', 'worker-1');
      expect(released).toBe(true);
      expect(String(fetchMock.mock.calls[1][0])).toContain('/rest/v1/rpc/release_logictrade_sync_lease');
    });
  });

  describe('fetchOrderSummariesDal & fetchOrderMatrixBundleDal queries', () => {
    it('combineert type=quotes en zoekterm q via een enkele geneste and=(or(...),or(...)) query zonder dubbele or=', async () => {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const u = String(input);
        if (u.includes('select=count')) {
          return new Response(JSON.stringify([{ count: 1 }]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify([
            {
              id: '99001',
              order_number: 'O26000501',
              quotation_number: 'O26000501',
              customer_name: 'Bakker Interieur',
              city: 'Breda',
              status: 'Concept',
              fsm_step: 2,
              total_amount_cents: 25000,
            },
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'content-range': '0-0/1' },
          }
        );
      });

      const response = await fetchOrderSummariesDal({ type: 'quotes', q: 'Bakker', limit: 25 });

      const summaryCall = fetchMock.mock.calls.find(
        (call) => !String(call[0]).includes('select=count')
      );
      expect(summaryCall).toBeDefined();
      const url = String(summaryCall![0]);
      const orMatches = url.match(/(?:[?&])or=/g) || [];
      expect(orMatches.length).toBe(0);
      expect(decodeURIComponent(url)).toContain('and=(or(');
      expect(response.items).toHaveLength(1);
      expect(response.items[0].id).toBe('99001');
      expect(response.items[0].orderNumber).toBe('O26000501');
      expect(response.items[0].klant).toBe('Bakker Interieur');
    });

    it('dwingt cache: no-store af op header + lines en past deterministische lookup ranking toe in fetchOrderMatrixBundleDal', async () => {
      fetchMock
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                id: 'ALT-1',
                order_number: 'V26009999',
                quotation_number: 'V26001376',
                customer_name: 'Quotation Match',
                fsm_step: 1,
                fsm_phase: '1. Aanvraag',
              },
              {
                id: '117000',
                order_number: 'V26001376',
                customer_name: 'Exact Order Number Match',
                fsm_step: 5,
                fsm_phase: '5. Bestellen',
              },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );

      const bundle = await fetchOrderMatrixBundleDal('V26001376');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const headerUrl = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
      expect(headerUrl).toContain('quotation_number.eq.');
      expect(headerUrl).toContain('order=fsm_step.asc,updated_at.desc');
      expect(headerUrl).toContain('limit=50');
      expect((fetchMock.mock.calls[0][1] as RequestInit).cache).toBe('no-store');
      expect((fetchMock.mock.calls[1][1] as RequestInit).cache).toBe('no-store');
      expect(bundle?.order.id).toBe('117000');
      expect(bundle?.order.order_number).toBe('V26001376');
    });
  });

  describe('DTO mapping: toOrderLinePatchDto & bundleMatrixOrder', () => {
    it('mapt unit expliciet mee in toOrderLinePatchDto en behoudt orderNumber in bundleMatrixOrder', () => {
      const dto = toOrderLinePatchDto({ unit: 'm1', quantity: 3.5 });
      expect(dto.unit).toBe('m1');
      expect(dto.quantity).toBe(3.5);

      const matrixOrder = bundleMatrixOrder({
        order: {
          id: '117282',
          order_number: 'V26002086',
          customer_name: 'De Vries Wonen',
          fsm_step: 5,
          fsm_phase: '5. Bestellen',
        },
        lines: [],
      });
      expect(matrixOrder.id).toBe('117282');
      expect(matrixOrder.orderNumber).toBe('V26002086');
    });
  });

  describe('SQL Migratie & CLI Invarianten', () => {
    it('garandeert safe JSONB/PLpgSQL fix, unit propagation, effective prices en service_role-only grants in migratie 05', () => {
      const sql05 = fs.readFileSync(
        path.join(ROOT, 'supabase/migrations/20261112_05_dual_state_diff_and_sync.sql'),
        'utf8'
      );

      expect(sql05).not.toMatch(/::INTEGER/i);
      expect(sql05).toMatch(/::numeric/i);
      expect(sql05).toContain('v_line_elem');
      expect(sql05).toContain("jsonb_typeof(NULLIF(COALESCE(o.raw_data->'lines', o.raw_data->'order'->'lines'), 'null'::jsonb)) = 'array'");
      expect(sql05).toContain('v_effective_unit_price_cents');
      expect(sql05).toContain("unit = COALESCE(NULLIF(p_patch->>'unit', ''), unit)");
      expect(sql05).toContain('AND sub_line = v_sub_line');
      expect(sql05).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.ingest_logictrade_order/i);
      expect(sql05).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.ingest_logictrade_order.*TO\s+service_role/i);
    });

    it('definieert logictrade_sync_state met RLS, lease/state RPCs, p_lease_key fencing en NUMERIC(14,4) in migratie 06', () => {
      const sql06 = fs.readFileSync(
        path.join(ROOT, 'supabase/migrations/20261112_06_logictrade_sync_state_and_swr.sql'),
        'utf8'
      );

      expect(sql06).toContain('logictrade_sync_state');
      expect(sql06).toContain('ENABLE ROW LEVEL SECURITY');
      expect(sql06).toContain('acquire_logictrade_sync_lease');
      expect(sql06).toContain('release_logictrade_sync_lease');
      expect(sql06).toContain('get_logictrade_sync_state');
      expect(sql06).toContain('update_logictrade_sync_state');
      expect(sql06).toContain('p_lease_key');
      expect(sql06).toContain('ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ');
      expect(sql06).toMatch(/ALTER\s+TABLE\s+public\.order_lines[\s\S]*?ALTER\s+COLUMN\s+quantity\s+TYPE\s+NUMERIC\(14,\s*4\)/i);
      expect(sql06).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.acquire_logictrade_sync_lease.*FROM\s+PUBLIC,\s*anon,\s*authenticated/i);
      expect(sql06).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.acquire_logictrade_sync_lease.*TO\s+service_role/i);
    });

    it('heeft geen hardcoded fallback service_group_code "9.1" in seed_matrix_orders.ts', () => {
      const seedSrc = fs.readFileSync(path.join(ROOT, 'scripts/seed_matrix_orders.ts'), 'utf8');
      expect(seedSrc).not.toContain("'9.1'");
    });
  });
});
