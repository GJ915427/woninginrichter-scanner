import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/v2/products/search/route';
import * as supabaseClient from '@/lib/supabase/client';
import { FtsProductRow } from '@/lib/supabase/client';
import { NextRequest } from 'next/server';

describe('API Route — GET /api/v2/products/search', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Happy Path H1: "duette draai" levert exact 2 discrete rijen op (€ 885.52 en € 929.52)', async () => {
    const benchmarkRow: FtsProductRow = {
      id: 52469,
      code: 'A00052469',
      name: 'Duette® shade',
      description: 'Vrijhangend model',
      sales_price: 861.02,
      sales_group: 'Raamdecoratie',
      supplier_name: 'Luxaflex',
      groups: ['Raamdecoratie', 'Duette']
    };

    vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(supabaseClient, 'searchProductsUniversal').mockResolvedValue({
      rows: [benchmarkRow],
      totalCount: 1
    });

    const req = new NextRequest('http://localhost:3000/api/v2/products/search?q=duette+draai');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.provider).toBe('supabase');
    expect(data.total).toBe(2);
    expect(data.results.length).toBe(2);

    const klemRow = data.results.find((r: any) => r.rowKey.includes('KLEMSTEUNEN'));
    const trufitRow = data.results.find((r: any) => r.rowKey.includes('MONTAGE_TRUFIT'));

    expect(klemRow).toBeDefined();
    expect(klemRow.totalPriceEur).toBe(885.52);
    expect(klemRow.salesPrice).toBe(861.02);
    expect(klemRow.surchargeEur).toBe(24.50);

    expect(trufitRow).toBeDefined();
    expect(trufitRow.totalPriceEur).toBe(929.52);
    expect(trufitRow.salesPrice).toBe(861.02);
    expect(trufitRow.surchargeEur).toBe(68.50);
  });

  it('Happy Path H2: Modelcode "ua20" normaliseert naar AU20 met :20 Top Down / Bottom Up en SmartCord', async () => {
    const benchmarkRow: FtsProductRow = {
      id: 52469,
      code: 'A00052469',
      name: 'Duette® shade',
      sales_price: 861.02,
      sales_group: 'Raamdecoratie',
      supplier_name: 'Luxaflex'
    };

    vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(supabaseClient, 'searchProductsUniversal').mockResolvedValue({
      rows: [benchmarkRow],
      totalCount: 1
    });

    const req = new NextRequest('http://localhost:3000/api/v2/products/search?q=ua20');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.results.length).toBeGreaterThan(0);
    const row = data.results[0];

    expect(row.modelPreset).toBeDefined();
    expect(row.modelPreset.code).toBe('AU20');
    expect(row.preconfiguration.VORM).toBe(':20 Top Down / Bottom Up');
    expect(row.preconfiguration.BEDIENINGS_TYPE).toBe('SMARTCORD');
  });

  it('Happy Path H3: Categorie-isolatie "tapijt antraciet"', async () => {
    const tapijtRow: FtsProductRow = {
      id: 112227,
      code: 'FL-TAP-01',
      name: 'Interfloor Tapijt Antraciet',
      sales_price: 89.95,
      sales_group: 'Tapijt',
      supplier_name: 'Interfloor',
      groups: ['Tapijt']
    };

    vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(supabaseClient, 'searchProductsUniversal').mockResolvedValue({
      rows: [tapijtRow],
      totalCount: 1
    });

    const req = new NextRequest('http://localhost:3000/api/v2/products/search?q=tapijt+antraciet');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.results.length).toBe(1);
    expect(data.results[0].salesGroup).toBe('Tapijt');
  });

  it('Edge Case E1: Lege query levert direct fail-closed HTTP 200 met provider "none"', async () => {
    const searchSpy = vi.spyOn(supabaseClient, 'searchProductsUniversal');
    const req = new NextRequest('http://localhost:3000/api/v2/products/search?q=%20%20');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({
      results: [],
      total: 0,
      provider: 'none',
      query: ''
    });
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it('Edge Case: Relatieve URL parsing crasht niet op TypeError: Invalid URL', async () => {
    vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(supabaseClient, 'searchProductsUniversal').mockResolvedValue({
      rows: [],
      totalCount: 0
    });

    const mockReq = {
      url: '/api/v2/products/search?q=test'
    } as unknown as Request;

    const res = await GET(mockReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.query).toBe('test');
  });

  it('Limit clamping: Clampt parameter limit tussen 1 en 50', async () => {
    const rows: FtsProductRow[] = Array.from({ length: 60 }, (_, i) => ({
      id: 1000 + i,
      code: `CODE-${i}`,
      name: `Product ${i}`,
      sales_price: 100,
      sales_group: 'Raamdecoratie'
    }));

    vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(supabaseClient, 'searchProductsUniversal').mockResolvedValue({
      rows,
      totalCount: 60
    });

    const req = new NextRequest('http://localhost:3000/api/v2/products/search?q=product&limit=999');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.results.length).toBeLessThanOrEqual(50);
  });

  it('Error handling (HTTP 500): Vangt onverwachte runtime exceptions op met console.warn', async () => {
    vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockImplementation(() => {
      throw new Error('Fatal database crash');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const req = new NextRequest('http://localhost:3000/api/v2/products/search?q=test');
    const res = await GET(req);
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toContain('Fatal database crash');
    expect(warnSpy).toHaveBeenCalled();
  });
});
