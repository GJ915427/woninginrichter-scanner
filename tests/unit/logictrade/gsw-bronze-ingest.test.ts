import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  harvest2YearOrders,
  harvestQuotes,
  type LogicTradeOrderHeader,
  type LogicTradeQuoteHeader,
  type LogicTradeOrderLine
} from '@/lib/logictrade/harvest-2yr-orders';
import {
  mapProductToRow,
  type LogicTradeProductRaw,
  type MappedProductRow
} from '@/lib/logictrade/sync-service';
import {
  pruneNonGswProducts,
  purgeNonGswOrders,
  getDistinctGswProductIds
} from '@/lib/supabase/client';
import {
  mapLogicTradeOrderToRawInput,
  OrderIntakeService
} from '@/domain/orders/order-intake-service';

describe('GSW Bronze Ingestion & Catalog Pruning Suite (TDD Red -> Green)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. REST URL Builder & Server-Side Origin Filtering', () => {
    it('harvest2YearOrders: appends server-side originCode parameter for string originFilter', async () => {
      const capturedUrls: string[] = [];
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        capturedUrls.push(url);
        return Promise.resolve({
          ok: true,
          json: async () => ({ results: [] })
        });
      });

      await harvest2YearOrders({
        apiKey: 'test-key',
        years: 1,
        originFilter: 'Winkel GSW BV',
        maxOrders: 10,
        rateLimiter: {
          fetchWithAdaptiveBackoff: mockFetch
        }
      });

      expect(capturedUrls.length).toBeGreaterThan(0);
      expect(capturedUrls[0]).toContain('originCode=Winkel%20GSW%20BV');
      expect(capturedUrls[0]).not.toContain('undefined');
    });

    it('harvest2YearOrders: handles array originFilter and safely unwraps the first element', async () => {
      const capturedUrls: string[] = [];
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        capturedUrls.push(url);
        return Promise.resolve({
          ok: true,
          json: async () => ({ results: [] })
        });
      });

      await harvest2YearOrders({
        apiKey: 'test-key',
        years: 1,
        originFilter: ['Winkel GSW BV'],
        maxOrders: 10,
        rateLimiter: {
          fetchWithAdaptiveBackoff: mockFetch
        }
      });

      expect(capturedUrls.length).toBeGreaterThan(0);
      expect(capturedUrls[0]).toContain('originCode=Winkel%20GSW%20BV');
    });

    it('harvest2YearOrders: handles empty array originFilter without emitting "undefined"', async () => {
      const capturedUrls: string[] = [];
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        capturedUrls.push(url);
        return Promise.resolve({
          ok: true,
          json: async () => ({ results: [] })
        });
      });

      await harvest2YearOrders({
        apiKey: 'test-key',
        years: 1,
        originFilter: [],
        maxOrders: 10,
        rateLimiter: {
          fetchWithAdaptiveBackoff: mockFetch
        }
      });

      expect(capturedUrls.length).toBeGreaterThan(0);
      expect(capturedUrls[0]).not.toContain('originCode');
      expect(capturedUrls[0]).not.toContain('undefined');
    });

    it('harvestQuotes: appends server-side originCode and filters quotes client-side', async () => {
      const capturedUrls: string[] = [];
      const quotesSample = [
        {
          id: 101,
          number: 'Q-GSW-01',
          origin: { code: 'Winkel GSW BV' },
          lines: []
        },
        {
          id: 102,
          number: 'Q-GIW-01',
          origin: { code: 'Winkel GIW BV' },
          lines: []
        }
      ];

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        capturedUrls.push(url);
        return Promise.resolve({
          ok: true,
          json: async () => quotesSample
        });
      });

      const processedQuotes: any[] = [];
      await harvestQuotes({
        apiKey: 'test-key',
        years: 1,
        originFilter: 'Winkel GSW BV',
        maxQuotes: 10,
        rateLimiter: {
          fetchWithAdaptiveBackoff: mockFetch
        },
        onQuote: async (quoteHeader) => {
          processedQuotes.push(quoteHeader);
        }
      });

      expect(capturedUrls.length).toBeGreaterThan(0);
      expect(capturedUrls[0]).toContain('originCode=Winkel%20GSW%20BV');
      // Defense-in-depth: non-GSW quote must be filtered out
      expect(processedQuotes.length).toBe(1);
      expect(processedQuotes[0].number).toBe('Q-GSW-01');
    });
  });

  describe('2. Unanchored Container Article Detection in mapProductToRow', () => {
    it('correctly detects standard "Algemeen artikel" prefixes', () => {
      const product: LogicTradeProductRaw = {
        id: 1001,
        code: 'A0001',
        name: 'Algemeen artikel gordijnen',
        description: 'Maatwerk gordijnen'
      };
      const mapped = mapProductToRow(product);
      expect(mapped.is_generic_container).toBe(true);
    });

    it('correctly detects unanchored container variants like "De Ploeg algemeen artikel" and "Keje ALGEMEEN"', () => {
      const p1: LogicTradeProductRaw = {
        id: 1002,
        code: 'A0002',
        name: 'De Ploeg algemeen artikel',
        description: ''
      };
      const p2: LogicTradeProductRaw = {
        id: 1003,
        code: 'A0003',
        name: 'Keje ALGEMEEN',
        description: 'Horren algemeen'
      };
      expect(mapProductToRow(p1).is_generic_container).toBe(true);
      expect(mapProductToRow(p2).is_generic_container).toBe(true);
    });

    it('returns is_generic_container: false for standard non-container products', () => {
      const product: LogicTradeProductRaw = {
        id: 2001,
        code: 'A-DUETTE-01',
        name: 'Duette Architella 25mm',
        description: 'Plisse raamdecoratie'
      };
      const mapped = mapProductToRow(product);
      expect(mapped.is_generic_container).toBe(false);
    });
  });

  describe('3. Database Column Parity in mapProductToRow', () => {
    it('maps all physical columns matching logictrade_products table schema', () => {
      const raw: LogicTradeProductRaw = {
        id: 555,
        code: 'TEST-SKU',
        name: 'Test Product',
        description: 'Omschrijving',
        supplier: {
          code: 'SUP-01',
          supplier: { id: 99, companyName: 'Leverancier BV' }
        },
        groups: [{ id: 1, description: 'Gordijnen' }],
        salesGroup: { id: 2, description: 'Particulier' },
        salesPrice: 149.95,
        vat: { id: 1, code: '21', percentage: 21 },
        unit: 'm1',
        modifiedDate: '2026-01-15T12:00:00Z'
      };

      const mapped = mapProductToRow(raw);
      expect(mapped.id).toBe(555);
      expect(mapped.code).toBe('TEST-SKU');
      expect(mapped.supplier_id).toBe(99);
      expect(mapped.supplier_name).toBe('Leverancier BV');
      expect(mapped.group_name).toBe('Gordijnen');
      expect(mapped.groups).toEqual(['Gordijnen']);
      expect(mapped.sales_price).toBe(149.95);
      expect(mapped.vat_code).toBe('21');
      expect(mapped.unit).toBe('m1');
      expect(mapped.raw_data).toBeDefined();
      expect(mapped.lt_raw_data).toBeDefined();
      expect(mapped.modified_at).toBe('2026-01-15T12:00:00Z');
      expect(mapped.is_generic_container).toBe(false);
    });
  });

  describe('4. Client RPC Wrappers & Fail-Closed Guarding', () => {
    it('pruneNonGswProducts: throws fail-closed error if keepIds is empty or null', async () => {
      await expect(pruneNonGswProducts([])).rejects.toThrow(
        /keepIds array mag niet leeg of null zijn/
      );
      await expect(pruneNonGswProducts(null as any)).rejects.toThrow(
        /keepIds array mag niet leeg of null zijn/
      );
    });

    it('pruneNonGswProducts: calls /rest/v1/rpc/prune_non_gsw_products with p_keep_ids payload', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => 100171
      });
      vi.stubGlobal('fetch', mockFetch);

      const deletedCount = await pruneNonGswProducts([101, 102, 103]);
      expect(deletedCount).toBe(100171);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/rpc/prune_non_gsw_products'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ p_keep_ids: [101, 102, 103] })
        })
      );
    });

    it('purgeNonGswOrders: calls /rest/v1/rpc/purge_non_gsw_orders', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => 15831
      });
      vi.stubGlobal('fetch', mockFetch);

      const deletedCount = await purgeNonGswOrders();
      expect(deletedCount).toBe(15831);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/rpc/purge_non_gsw_orders'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({})
        })
      );
    });

    it('getDistinctGswProductIds: calls /rest/v1/rpc/get_distinct_gsw_product_ids', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [101, 102, 103]
      });
      vi.stubGlobal('fetch', mockFetch);

      const ids = await getDistinctGswProductIds();
      expect(ids).toEqual([101, 102, 103]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/rpc/get_distinct_gsw_product_ids'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({})
        })
      );
    });
  });

  // [SPEC-CHANGE-AUTHORIZED: Uitbreiding regressietests met offerte-reconciliatie, salesMan en sub_line pariteit]
  describe('5. GSW Bronze Pariteit & Reconciliatie Tests (Stap 1B)', () => {
    it('mapLogicTradeOrderToRawInput: links sales order to quote number via header.quote.number', () => {
      const mockSalesOrder: any = {
        id: 98610,
        number: 'V24000917',
        fsm_step: 5,
        fsm_phase: '5. Verkooporder',
        quote: {
          id: 109400,
          number: 'O24000411'
        },
        lines: [
          {
            id: 1,
            lineNumber: 10,
            articleCode: 'A0001',
            quantity: 1,
            linePrice: 100
          }
        ]
      };

      const mapped = mapLogicTradeOrderToRawInput(mockSalesOrder);
      expect(mapped.order_number).toBe('V24000917');
      expect(mapped.quotation_number).toBe('O24000411');
      expect(mapped.fsm_step).toBe(5);
    });

    it('mapLogicTradeOrderToRawInput: unwraps sales_rep from salesMan and branch from origin object/string', () => {
      const mockOrderWithOriginObj: any = {
        id: 98611,
        number: 'V24000918',
        salesMan: 'Simon Bak',
        origin: { code: 'Winkel GSW BV', description: 'Vestiging GSW' },
        lines: []
      };

      const mapped1 = mapLogicTradeOrderToRawInput(mockOrderWithOriginObj);
      expect(mapped1.sales_rep).toBe('Simon Bak');
      expect(mapped1.branch).toBe('Winkel GSW BV');

      const mockOrderWithOriginString: any = {
        id: 98612,
        number: 'V24000919',
        salesMan: 'Carlo Heinemans',
        origin: 'Winkel GSW BV',
        lines: []
      };

      const mapped2 = mapLogicTradeOrderToRawInput(mockOrderWithOriginString);
      expect(mapped2.sales_rep).toBe('Carlo Heinemans');
      expect(mapped2.branch).toBe('Winkel GSW BV');
    });

    it('mapLogicTradeOrderToRawInput: maps all 11 bronze columns into RawOrderLineInput', () => {
      const mockOrderWithBronzeFields: any = {
        id: 98613,
        number: 'V24000920',
        lines: [
          {
            id: 1,
            lineNumber: 10,
            articleCode: 'A0001',
            quantity: 2,
            partPrice: 50,
            linePrice: 100,
            commentExtern: 'Graag leveren op verdieping',
            commentIntern: 'Sleutel onder de mat',
            vatCode: '21',
            vatPercentage: 21,
            discountPercentage: 10,
            basePriceCents: 5500,
            reservations: [{ id: 1, qty: 2 }],
            stockStatus: 'Op voorraad',
            deliveryStatus: 'In behandeling',
            invoiceStatus: 'Niet gefactureerd',
            isInbegrepen: false
          }
        ]
      };

      const mapped = mapLogicTradeOrderToRawInput(mockOrderWithBronzeFields);
      expect(mapped.lines.length).toBe(1);
      const line = mapped.lines[0];
      expect(line.lt_comment_extern).toBe('Graag leveren op verdieping');
      expect(line.lt_comment_intern).toBe('Sleutel onder de mat');
      expect(line.lt_vat_code).toBe('21');
      expect(line.lt_vat_percentage).toBe(21);
      expect(line.lt_discount_percentage).toBe(10);
      expect(line.lt_base_price_cents).toBe(5500);
      expect(line.lt_reservations).toEqual([{ id: 1, qty: 2 }]);
      expect(line.lt_stock_status).toBe('Op voorraad');
      expect(line.lt_delivery_status).toBe('In behandeling');
      expect(line.lt_invoice_status).toBe('Niet gefactureerd');
      expect(line.is_inbegrepen).toBe(false);
    });

    it('mapLogicTradeOrderToRawInput: groups Vadain composite lines sharing identical lineNumber: 20 without random explosion', () => {
      const mockVadainOrder: any = {
        id: 98614,
        number: 'V24000921',
        lines: [
          {
            id: 201,
            lineNumber: 20,
            articleCode: 'LT_VADAINGORDIJN',
            articleDescription: 'Vadain Gordijnstof',
            quantity: 5.5,
            linePrice: 275
          },
          {
            id: 202,
            lineNumber: 20,
            articleCode: 'LT_VADAINCONFECTIE',
            articleDescription: 'Vadain Confectie Enkele Plooi',
            quantity: 1,
            linePrice: 65
          }
        ]
      };

      const mapped = mapLogicTradeOrderToRawInput(mockVadainOrder);
      expect(mapped.lines.length).toBe(2);

      const fabricLine = mapped.lines.find((l) => l.product_code === 'LT_VADAINGORDIJN');
      const confectieLine = mapped.lines.find((l) => l.product_code === 'LT_VADAINCONFECTIE');

      expect(fabricLine).toBeDefined();
      expect(confectieLine).toBeDefined();

      // Beide regels moeten lineNumber 20 behouden
      expect(fabricLine?.line_number).toBe(20);
      expect(confectieLine?.line_number).toBe(20);

      // Confectie moet sub_line = 1 krijgen
      expect(fabricLine?.sub_line).toBe(0);
      expect(confectieLine?.sub_line).toBe(1);

      // Beide moeten hun ruwe brondata behouden (geen null voor reële Vadain confectie)
      expect(fabricLine?.lt_raw_data).toBeDefined();
      expect(fabricLine?.lt_raw_data).not.toBeNull();
      expect(confectieLine?.lt_raw_data).toBeDefined();
      expect(confectieLine?.lt_raw_data).not.toBeNull();
    });
  });
});
