import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/products/search/route';
import { mapProductToRow, syncProductsBatch } from '@/lib/logictrade/sync-service';
import * as supabaseClient from '@/lib/supabase/client';
import { LogicTradeProductRaw } from '@/types/product';

const realProductSample: LogicTradeProductRaw = {
  id: 219609,
  code: 'A00052469',
  name: 'Duette® shade',
  description: 'Luxaflex Duette raamdecoratie',
  salesPrice: 898.21,
  unit: 'stuks',
  vat: { id: 1, code: '1', description: 'BTW Hoog' },
  salesGroup: { id: 49, code: '', description: 'Raamdecoratie' },
  groups: [
    { id: 230, parentId: null, code: '', description: 'Koppelingen Raamdecoratie', customFields: [] },
    { id: 231, parentId: 230, code: '', description: 'Luxaflex', customFields: [] },
    { id: 239, parentId: 231, code: '', description: 'Duette® shade', customFields: [] }
  ],
  supplier: {
    code: '1032-1035',
    description: 'Duette® shade',
    purchasePrice: 450.0,
    supplier: {
      id: 82653,
      number: 'R00017180',
      companyName: 'Luxaflex'
    }
  },
  images: [],
  attributes: [
    {
      id: 94,
      name: 'HunterDouglas artikel type',
      type: 'Select',
      values: [{ code: 'HD_Type_Product', value: 'Product' }]
    }
  ]
};

describe('Hybrid Product Search & Sync (Tranche 3A)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Sync State in-memory TTL caching', () => {
    it('caches sync state and does not call fetch repeatedly within TTL', async () => {
      supabaseClient.invalidateSyncStateCache('test_sync');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              key: 'test_sync',
              total_synced: 500,
              last_synced_at: '2026-10-07T12:00:00Z',
              checkpoint_page: 5,
              updated_at: '2026-10-07T12:00:00Z'
            }
          ]),
          { status: 200 }
        )
      );

      const first = await supabaseClient.getSyncState('test_sync');
      expect(first?.total_synced).toBe(500);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Tweede aanroep binnen TTL moet uit het geheugen komen
      const second = await supabaseClient.getSyncState('test_sync');
      expect(second?.total_synced).toBe(500);
      expect(fetchSpy).toHaveBeenCalledTimes(1); // Nog steeds 1!

      // Na invalidatie moet fetch opnieuw getriggerd worden
      supabaseClient.invalidateSyncStateCache('test_sync');
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              key: 'test_sync',
              total_synced: 600,
              last_synced_at: '2026-10-07T12:05:00Z',
              checkpoint_page: 6,
              updated_at: '2026-10-07T12:05:00Z'
            }
          ]),
          { status: 200 }
        )
      );

      const third = await supabaseClient.getSyncState('test_sync');
      expect(third?.total_synced).toBe(600);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Sync Service mapping & batching', () => {
    it('correctly maps LogicTradeProductRaw to database row format', () => {
      const row = mapProductToRow(realProductSample);

      expect(row.id).toBe(219609);
      expect(row.code).toBe('A00052469');
      expect(row.name).toBe('Duette® shade');
      expect(row.supplier_id).toBe(82653);
      expect(row.supplier_name).toBe('Luxaflex');
      expect(row.supplier_code).toBe('1032-1035');
      expect(row.group_name).toBe('Koppelingen Raamdecoratie');
      expect(row.groups).toEqual(['Koppelingen Raamdecoratie', 'Luxaflex', 'Duette® shade']);
      expect(row.sales_group).toBe('Raamdecoratie');
      expect(row.sales_price).toBe(898.21);
      expect(row.raw_data.images).toHaveLength(0);
    });

    it('syncProductsBatch calls upsert with mapped rows', async () => {
      const upsertSpy = vi
        .spyOn(supabaseClient, 'upsertProductsBatch')
        .mockResolvedValueOnce({ success: true, count: 1 });

      const count = await syncProductsBatch([realProductSample]);

      expect(count).toBe(1);
      expect(upsertSpy).toHaveBeenCalledTimes(1);
      const passedRows = upsertSpy.mock.calls[0][0];
      expect(passedRows[0].id).toBe(219609);
    });
  });

  describe('BFF Hybrid Search Route GET', () => {
    it('returns HTTP 400 when query is shorter than 2 characters', async () => {
      const req = new Request('http://localhost:8089/api/products/search?q=a');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.items).toEqual([]);
    });

    it('queries Supabase FTS when catalog is initialized and returns items payload', async () => {
      vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
      vi.spyOn(supabaseClient, 'getSyncState').mockResolvedValueOnce({
        key: 'catalog_sync',
        last_synced_at: new Date().toISOString(),
        total_synced: 100724,
        checkpoint_page: 1010,
        updated_at: new Date().toISOString()
      });

      vi.spyOn(supabaseClient, 'searchProductsFts').mockResolvedValueOnce({
        rows: [
          {
            id: 219609,
            code: 'A00052469',
            name: 'Duette® shade',
            description: 'Luxaflex Duette raamdecoratie',
            supplier_id: 82653,
            supplier_name: 'Luxaflex',
            supplier_code: '1032-1035',
            group_name: 'Koppelingen Raamdecoratie',
            groups: ['Koppelingen Raamdecoratie', 'Luxaflex', 'Duette® shade'],
            sales_group: 'Raamdecoratie',
            sales_price: 898.21,
            vat_code: '1',
            unit: 'stuks',
            raw_data: { images: [] },
            rank: 0.95,
            total_count: 1
          }
        ],
        totalCount: 1
      });

      const req = new Request('http://localhost:8089/api/products/search?q=Duette%20Luxaflex');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.query).toBe('Duette Luxaflex');
      expect(data.count).toBe(1);
      expect(data.items).toHaveLength(1);
      expect(data.items[0]).toEqual({
        id: 219609,
        code: 'A00052469',
        name: 'Duette® shade',
        salesGroup: 'Raamdecoratie',
        supplierName: 'Luxaflex',
        supplierId: 82653,
        groups: ['Koppelingen Raamdecoratie', 'Luxaflex', 'Duette® shade'],
        salesPrice: 898.21,
        vatCode: '1',
        unit: 'stuks'
      });
      expect(data.pagination.totalResults).toBe(1);
    });

    it('returns empty items immediately without hitting LogicTrade when FTS finds 0 matches on initialized catalog', async () => {
      vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
      vi.spyOn(supabaseClient, 'getSyncState').mockResolvedValueOnce({
        key: 'catalog_sync',
        last_synced_at: new Date().toISOString(),
        total_synced: 100921,
        checkpoint_page: 1010,
        updated_at: new Date().toISOString()
      });

      vi.spyOn(supabaseClient, 'searchProductsFts').mockResolvedValueOnce({
        rows: [],
        totalCount: 0
      });

      const req = new Request('http://localhost:8089/api/products/search?q=onbestaandewoordxyz');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.count).toBe(0);
      expect(data.items).toEqual([]);
      expect(data.pagination.totalResults).toBe(0);
    });

    it('supports universal search query via searchProductsUniversal', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake-supabase.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 219609,
              code: 'A00052469',
              name: 'Duette® shade',
              description: 'Luxaflex Duette raamdecoratie',
              supplier_id: 82653,
              supplier_name: 'Luxaflex',
              supplier_code: '1032-1035',
              group_name: 'Koppelingen Raamdecoratie',
              groups: ['Koppelingen Raamdecoratie', 'Luxaflex', 'Duette® shade'],
              sales_group: 'Raamdecoratie',
              sales_price: 898.21,
              vat_code: '1',
              unit: 'stuks',
              raw_data: { images: [] },
              rank: 95.0,
              total_count: 1
            }
          ]),
          { status: 200 }
        )
      );

      const res = await supabaseClient.searchProductsUniversal('cord', 20, 0);
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].code).toBe('A00052469');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/rpc/search_logictrade_products_universal'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            search_query: 'cord',
            category_filter: null,
            limit_count: 20,
            offset_count: 0
          })
        })
      );
    });

    it('resolves model code "AU20" to base article and enriches with modelPreset', async () => {
      vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
      vi.spyOn(supabaseClient, 'getSyncState').mockResolvedValueOnce({
        key: 'catalog_sync',
        last_synced_at: new Date().toISOString(),
        total_synced: 100724,
        checkpoint_page: 1010,
        updated_at: new Date().toISOString()
      });

      const searchFtsSpy = vi.spyOn(supabaseClient, 'searchProductsFts').mockResolvedValueOnce({
        rows: [
          {
            id: 219609,
            code: 'A00052469',
            name: 'Duette® shade',
            description: 'Luxaflex Duette raamdecoratie',
            supplier_id: 82653,
            supplier_name: 'Luxaflex',
            supplier_code: '1032-1035',
            group_name: 'Koppelingen Raamdecoratie',
            groups: ['Koppelingen Raamdecoratie', 'Luxaflex', 'Duette® shade'],
            sales_group: 'Raamdecoratie',
            sales_price: 898.21,
            vat_code: '1',
            unit: 'stuks',
            raw_data: { images: [] },
            rank: 0.95,
            total_count: 1
          }
        ],
        totalCount: 1
      });

      const req = new Request('http://localhost:8089/api/products/search?q=au20');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.query).toBe('au20');
      expect(searchFtsSpy).toHaveBeenCalledWith('au20', 20, 0, undefined);
      expect(data.count).toBe(1);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].code).toBe('A00052469');
      expect(data.items[0].name).toBe('Duette® shade');
      expect(data.items[0].modelPreset).toEqual({
        code: 'AU20',
        name: 'Top-Down / Bottom-Up SmartCord®',
        productFamily: 'Duette / Plissé',
        vorm: ':20 Top Down / Bottom Up',
        bediening: 'SmartCord'
      });
    });

    it('specifically handles truly unknown codes like "AU99" with HTTP 200 and zero matches without error', async () => {
      vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
      vi.spyOn(supabaseClient, 'getSyncState').mockResolvedValueOnce({
        key: 'catalog_sync',
        last_synced_at: new Date().toISOString(),
        total_synced: 100724,
        checkpoint_page: 1010,
        updated_at: new Date().toISOString()
      });

      vi.spyOn(supabaseClient, 'searchProductsFts').mockResolvedValueOnce({
        rows: [],
        totalCount: 0
      });

      const req = new Request('http://localhost:8089/api/products/search?q=AU99');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.query).toBe('AU99');
      expect(data.count).toBe(0);
      expect(data.items).toEqual([]);
      expect(data.error).toBeUndefined();
    });

    it('gracefully falls back to LogicTrade live API when Supabase is not yet initialized (total_synced === 0)', async () => {
      vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
      vi.spyOn(supabaseClient, 'getSyncState').mockResolvedValueOnce({
        key: 'catalog_sync',
        last_synced_at: new Date().toISOString(),
        total_synced: 0
      });

      // Mock native global fetch voor de LogicTrade API calls
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/suppliers')) {
          return new Response(JSON.stringify({ results: [{ id: 82653, companyName: 'Luxaflex' }] }), { status: 200 });
        }
        if (urlStr.includes('/products')) {
          return new Response(JSON.stringify({ results: [realProductSample], pagination: { totalResults: 1, totalPages: 1 } }), { status: 200 });
        }
        return new Response('{}', { status: 200 });
      });

      const req = new Request('http://localhost:8089/api/products/search?q=Luxaflex');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('gracefully falls back to LogicTrade live API when Supabase throws a connection error', async () => {
      vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
      vi.spyOn(supabaseClient, 'getSyncState').mockRejectedValueOnce(new Error('Connection timeout to Supabase'));

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/suppliers')) {
          return new Response(JSON.stringify({ results: [{ id: 82653, companyName: 'Luxaflex' }] }), { status: 200 });
        }
        if (urlStr.includes('/products')) {
          return new Response(JSON.stringify({ results: [realProductSample], pagination: { totalResults: 1, totalPages: 1 } }), { status: 200 });
        }
        return new Response('{}', { status: 200 });
      });

      const req = new Request('http://localhost:8089/api/products/search?q=Luxaflex');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('applies Tiered Relevance sorting on Supabase results so core products rank above swatch cards', async () => {
      vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
      vi.spyOn(supabaseClient, 'getSyncState').mockResolvedValueOnce({
        key: 'catalog_sync',
        last_synced_at: new Date().toISOString(),
        total_synced: 100724,
        checkpoint_page: 1010,
        updated_at: new Date().toISOString()
      });

      const staalRow = {
        id: 234181,
        code: 'A000064503',
        name: 'Duette® shades staal',
        description: 'Sunway staalkaart',
        supplier_id: 2,
        supplier_name: 'Sunway Benelux BV',
        supplier_code: 'SW',
        group_name: 'Raamdecoratie',
        groups: ['Raamdecoratie'],
        sales_group: 'Raamdecoratie',
        sales_price: 0,
        vat_code: '1',
        unit: 'stuks',
        raw_data: {},
        rank: 0.99,
        total_count: 2
      };
      const coreRow = {
        id: 219609,
        code: 'A00052469',
        name: 'Duette® shade',
        description: 'Luxaflex Duette raamdecoratie',
        supplier_id: 82653,
        supplier_name: 'Luxaflex',
        supplier_code: 'LX',
        group_name: 'Raamdecoratie',
        groups: ['Raamdecoratie'],
        sales_group: 'Raamdecoratie',
        sales_price: 229,
        vat_code: '1',
        unit: 'stuks',
        raw_data: {},
        rank: 0.95,
        total_count: 2
      };

      vi.spyOn(supabaseClient, 'searchProductsFts').mockResolvedValueOnce({
        rows: [staalRow, coreRow],
        totalCount: 2
      });

      const req = new Request('http://localhost:8089/api/products/search?q=cor');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.items).toHaveLength(2);
      // Core product MUST rank #1 despite staalRow being first in database rows
      expect(data.items[0].code).toBe('A00052469');
      expect(data.items[0].name).toBe('Duette® shade');
      expect(data.items[1].code).toBe('A000064503');
    });

    it('routes "wave" to category_filter gordijnen and attaches PLOOISOORT preconfiguration', async () => {
      vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
      vi.spyOn(supabaseClient, 'getSyncState').mockResolvedValueOnce({
        key: 'catalog_sync',
        last_synced_at: new Date().toISOString(),
        total_synced: 100724
      });

      const searchFtsSpy = vi.spyOn(supabaseClient, 'searchProductsFts').mockResolvedValueOnce({
        rows: [
          {
            id: 3001,
            code: 'GOR001',
            name: 'Inbetween Wave Gordijn',
            description: 'Luxe inbetween stof',
            supplier_id: 10,
            supplier_name: 'Kendix',
            supplier_code: 'KX',
            group_name: 'Gordijnen',
            groups: ['Gordijnen'],
            sales_group: 'Gordijnen',
            sales_price: 150,
            vat_code: '1',
            unit: 'm',
            raw_data: {},
            rank: 0.9,
            total_count: 1
          }
        ],
        totalCount: 1
      });

      const req = new Request('http://localhost:8089/api/products/search?q=wave');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(searchFtsSpy).toHaveBeenCalledWith('wave', 20, 0, 'gordijnen');
      expect(data.items[0].featureBadges).toContain('Wave plooi');
      expect(data.items[0].preconfiguration).toEqual({ PLOOISOORT: 'WAVE' });
    });
  });
});
