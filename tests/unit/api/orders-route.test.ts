import { describe, it, expect, beforeEach, vi } from 'vitest';
import { _resetOrderTotalsCache, fetchOrderSummariesDal, fetchOrderMatrixBundleDal } from '@/lib/supabase/order-client';
import { GET as getOrdersRoute } from '@/app/api/orders/route';
import { GET as getOrderDetailRoute } from '@/app/api/orders/[id]/route';

describe('Server-Centric Orders API & DAL Suite (Sub-Fase 3A)', () => {
  beforeEach(() => {
    _resetOrderTotalsCache();
    vi.restoreAllMocks();
  });

  describe('fetchOrderSummariesDal', () => {
    it('haalt orders op met catalogustotalen en paginering via mock fetch', async () => {
      const mockRows = [
        {
          id: 'ord-1',
          order_number: 'V26001001',
          customer_name: 'Pinkaarts',
          city: 'Maastricht',
          quotation_number: 'Q26001001',
          order_date: '2026-03-01',
          total_amount_cents: 150000,
          status: 'ORDER',
          fsm_step: 5,
        },
      ];

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        // Count queries
        if (url.includes('select=count')) {
          if (url.includes('status.ilike.*OFFERTE*') || url.includes('status=ilike') || url.includes('fsm_step.eq.2')) {
            return {
              ok: true,
              json: async () => [{ count: 50 }],
            };
          }
          if (url.includes('status=neq.OFFERTE') || url.includes('status=neq')) {
            return {
              ok: true,
              json: async () => [{ count: 150 }],
            };
          }
          return {
            ok: true,
            json: async () => [{ count: 200 }],
          };
        }

        // Data queries
        return {
          ok: true,
          headers: new Headers({ 'content-range': '0-0/200' }),
          json: async () => mockRows,
        };
      });

      const res = await fetchOrderSummariesDal({
        fetchImpl: mockFetch as any,
        limit: 25,
        offset: 0,
        bypassCache: true,
      });

      expect(res.items).toHaveLength(1);
      expect(res.items[0]).toEqual({
        id: 'ord-1',
        orderNumber: 'V26001001',
        klant: 'Pinkaarts',
        plaats: 'Maastricht',
        offerte: 'Q26001001',
        orderdatum: '2026-03-01',
        totaalbedragCents: 150000,
        status: 'ORDER',
      });
      expect(res.limit).toBe(25);
      expect(res.offset).toBe(0);
      expect(res.total).toBe(200);
      expect(res.filteredCount).toBe(200);
      expect(res.catalogTotals).toEqual({
        all: 200,
        orders: 150,
        quotes: 50,
      });
    });

    it('cached catalogustotalen en respecteert _resetOrderTotalsCache', async () => {
      let countCalls = 0;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('select=count')) {
          countCalls++;
          return {
            ok: true,
            json: async () => [{ count: 100 }],
          };
        }
        return {
          ok: true,
          headers: new Headers({ 'content-range': '0-0/100' }),
          json: async () => [],
        };
      });

      // Call 1
      await fetchOrderSummariesDal({ fetchImpl: mockFetch as any });
      const initialCountCalls = countCalls;
      expect(initialCountCalls).toBeGreaterThan(0);

      // Call 2 (zonder bypassCache) -> mag géén extra count-calls doen
      await fetchOrderSummariesDal({ fetchImpl: mockFetch as any });
      expect(countCalls).toBe(initialCountCalls);

      // Reset cache
      _resetOrderTotalsCache();

      // Call 3 (na reset) -> moet opnieuw totalen ophalen
      await fetchOrderSummariesDal({ fetchImpl: mockFetch as any });
      expect(countCalls).toBeGreaterThan(initialCountCalls);
    });

    it('filtert op type=quotes en zoekt op q query', async () => {
      let requestedUrl = '';
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('select=count')) {
          return { ok: true, json: async () => [{ count: 10 }] };
        }
        requestedUrl = url;
        return {
          ok: true,
          headers: new Headers({ 'content-range': '0-0/1' }),
          json: async () => [],
        };
      });

      await fetchOrderSummariesDal({
        type: 'quotes',
        q: 'Maastricht',
        fetchImpl: mockFetch as any,
        bypassCache: true,
      });

      expect(requestedUrl).toContain('order_number.ilike');
      expect(requestedUrl).toContain('status.ilike');
    });
  });

  describe('fetchOrderMatrixBundleDal', () => {
    it('haalt header en lijnen op voor een bestaand orderId', async () => {
      const mockHeader = {
        id: 'V26001376',
        order_number: 'V26001376',
        customer_name: 'Jaspers',
        city: 'Maastricht',
        total_amount_cents: 250000,
        status: 'ORDER',
      };
      const mockLines = [
        {
          line_number: 10,
          sub_line: 0,
          product_code: 'DUETTE-01',
          description: 'Duette gordijn',
          quantity: 2,
          unit: 'stuks',
          unit_price_cents: 125000,
          total_price_cents: 250000,
          is_hybrid: false,
          is_inbegrepen: false,
          etage_name: 'Begane grond',
          room_name: 'Woonkamer',
        },
      ];

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/orders?')) {
          return {
            ok: true,
            json: async () => [mockHeader],
          };
        }
        if (url.includes('/order_lines?')) {
          return {
            ok: true,
            json: async () => mockLines,
          };
        }
        return { ok: false, status: 404 };
      });

      const bundle = await fetchOrderMatrixBundleDal('V26001376', { fetchImpl: mockFetch as any });
      expect(bundle).not.toBeNull();
      expect(bundle?.order.order_number).toBe('V26001376');
      expect(bundle?.lines).toHaveLength(1);
      expect(bundle?.lines[0].line_number).toBe(10);
    });

    it('geeft null terug als order niet bestaat in database', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          json: async () => [],
        };
      });

      const bundle = await fetchOrderMatrixBundleDal('ONBEKEND-999', { fetchImpl: mockFetch as any });
      expect(bundle).toBeNull();
    });
  });

  describe('Route Handlers (Next.js 16 pure transport)', () => {
    let fetchSpy: any;

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('select=count')) {
          return new Response(JSON.stringify([{ count: 100 }]), { status: 200 });
        }
        if (urlStr.includes('/order_lines?')) {
          return new Response(
            JSON.stringify([
              {
                line_number: 10,
                sub_line: 0,
                product_code: 'DUETTE-01',
                description: 'Duette gordijn',
                quantity: 1,
                unit: 'stuks',
                unit_price_cents: 10000,
                total_price_cents: 10000,
                is_hybrid: false,
                is_inbegrepen: false,
                etage_name: 'Begane grond',
              },
            ]),
            { status: 200 }
          );
        }
        if (urlStr.includes('NIET-BESTAAND')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (urlStr.includes('V26001376')) {
          return new Response(
            JSON.stringify([
              {
                id: 'V26001376',
                order_number: 'V26001376',
                customer_name: 'Jaspers',
                city: 'Maastricht',
                status: 'ORDER',
              },
            ]),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify([
            {
              id: 'ord-100',
              order_number: 'V26001000',
              customer_name: 'Pinkaarts',
              city: 'Maastricht',
              total_amount_cents: 150000,
              status: 'ORDER',
            },
          ]),
          {
            status: 200,
            headers: { 'content-range': '0-0/1' },
          }
        );
      });
    });

    it('GET /api/orders parseert query parameters en retourneert JSON', async () => {
      const req = new Request('http://localhost:8088/api/orders?q=Pinkaarts&type=orders&limit=10&offset=5');
      const res = await getOrdersRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty('items');
      expect(json).toHaveProperty('total');
      expect(json).toHaveProperty('filteredCount');
      expect(json.filteredCount).toBe(1);
      expect(json).toHaveProperty('limit', 10);
      expect(json).toHaveProperty('offset', 5);
      expect(json).toHaveProperty('catalogTotals');
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('GET /api/orders/[id] retourneert HTTP 200 Happy Path met matrix bundel', async () => {
      const req = new Request('http://localhost:8088/api/orders/V26001376');
      const res = await getOrderDetailRoute(req, {
        params: Promise.resolve({ id: 'V26001376' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('order');
      expect(json.order.order_number).toBe('V26001376');
      expect(json).toHaveProperty('lines');
      expect(json.lines).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('GET /api/orders/[id] retourneert HTTP 400 wanneer id leeg of whitespace is', async () => {
      const req = new Request('http://localhost:8088/api/orders/%20');
      const res = await getOrderDetailRoute(req, {
        params: Promise.resolve({ id: '   ' }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Order ID ontbreekt');
    });

    it('GET /api/orders/[id] lost Next.js 16 async params op en geeft 404 als order niet bestaat', async () => {
      const reqMissing = new Request('http://localhost:8088/api/orders/NIET-BESTAAND');
      const resMissing = await getOrderDetailRoute(reqMissing, {
        params: Promise.resolve({ id: 'NIET-BESTAAND' }),
      });
      expect(resMissing.status).toBe(404);
      const jsonMissing = await resMissing.json();
      expect(jsonMissing.error).toBe('Order niet gevonden');
    });
  });
});
