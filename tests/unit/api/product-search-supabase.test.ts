import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/products/search/route';
import { mapProductToRow, syncProductsBatch } from '@/lib/logictrade/sync-service';
import * as supabaseClient from '@/lib/supabase/client';
import { LogicTradeProductRaw } from '@/types/product';

const mockRawProduct: LogicTradeProductRaw = {
  id: 147251,
  code: 'A00042607',
  name: 'Luxaflex - Plissé Shade AU20',
  description: 'Top-Down / Bottom-Up SmartCord',
  salesPrice: 189.5,
  unit: 'stuks',
  vat: { id: 1, code: '1', description: 'BTW Hoog' },
  salesGroup: { id: 49, code: 'RD', description: 'Raamdecoratie' },
  groups: [
    { id: 231, parentId: 230, code: '', description: 'Luxaflex', customFields: [] },
    { id: 245, parentId: 231, code: '', description: 'Plissé Shade', customFields: [] }
  ],
  supplier: {
    code: '1030-1017',
    description: 'Plissé AU20',
    purchasePrice: 95.0,
    supplier: {
      id: 82653,
      number: 'R00017180',
      companyName: 'Luxaflex'
    }
  },
  images: [{ id: 1, url: 'https://example.com/au20.jpg', name: 'au20.jpg' }],
  attributes: [
    {
      id: 10,
      name: 'Model',
      type: 'Select',
      values: [{ code: 'AU20', value: 'AU20' }]
    }
  ]
};

describe('Hybrid Product Search & Sync (Tranche 3A)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Sync Service mapping & batching', () => {
    it('correctly maps LogicTradeProductRaw to database row format', () => {
      const row = mapProductToRow(mockRawProduct);

      expect(row.id).toBe(147251);
      expect(row.code).toBe('A00042607');
      expect(row.name).toBe('Luxaflex - Plissé Shade AU20');
      expect(row.supplier_id).toBe(82653);
      expect(row.supplier_name).toBe('Luxaflex');
      expect(row.supplier_code).toBe('1030-1017');
      expect(row.group_name).toBe('Luxaflex');
      expect(row.groups).toEqual(['Luxaflex', 'Plissé Shade']);
      expect(row.sales_group).toBe('Raamdecoratie');
      expect(row.sales_price).toBe(189.5);
      expect(row.raw_data.images).toHaveLength(1);
    });

    it('syncProductsBatch calls upsert with mapped rows', async () => {
      const upsertSpy = vi
        .spyOn(supabaseClient, 'upsertProductsBatch')
        .mockResolvedValueOnce({ success: true, count: 1 });

      const count = await syncProductsBatch([mockRawProduct]);

      expect(count).toBe(1);
      expect(upsertSpy).toHaveBeenCalledTimes(1);
      const passedRows = upsertSpy.mock.calls[0][0];
      expect(passedRows[0].id).toBe(147251);
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
        total_synced: 100921
      });

      vi.spyOn(supabaseClient, 'searchProductsFts').mockResolvedValueOnce({
        rows: [
          {
            id: 147251,
            code: 'A00042607',
            name: 'Luxaflex - Plissé Shade AU20',
            description: 'Top-Down / Bottom-Up SmartCord',
            supplier_id: 82653,
            supplier_name: 'Luxaflex',
            supplier_code: '1030-1017',
            group_name: 'Luxaflex',
            groups: ['Luxaflex', 'Plissé Shade'],
            sales_group: 'Raamdecoratie',
            sales_price: 189.5,
            vat_code: '1',
            unit: 'stuks',
            raw_data: { images: [{ url: 'https://example.com/au20.jpg' }] },
            rank: 0.85,
            total_count: 1
          }
        ],
        totalCount: 1
      });

      const req = new Request('http://localhost:8089/api/products/search?q=AU20%20Pliss%C3%A9');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.query).toBe('AU20 Plissé');
      expect(data.count).toBe(1);
      expect(data.items).toHaveLength(1);
      expect(data.items[0]).toEqual({
        id: 147251,
        code: 'A00042607',
        name: 'Luxaflex - Plissé Shade AU20',
        salesGroup: 'Raamdecoratie',
        supplierName: 'Luxaflex',
        supplierId: 82653,
        groups: ['Luxaflex', 'Plissé Shade'],
        salesPrice: 189.5,
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
        total_synced: 100921
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
          return new Response(JSON.stringify({ results: [mockRawProduct], pagination: { totalResults: 1, totalPages: 1 } }), { status: 200 });
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
          return new Response(JSON.stringify({ results: [mockRawProduct], pagination: { totalResults: 1, totalPages: 1 } }), { status: 200 });
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
  });
});
