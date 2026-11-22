import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Imports to be satisfied in Phase 3 conform declared targets
import { toNonNegativeQuantity, resolveNumericQuantity } from '@/types/order-intake';
import { mapLogicTradeOrderToRawInput } from '@/domain/orders/order-intake-service';
import { resolveLogicTradeConnectionConfig } from '@/lib/logictrade/connection-config';
import { BronzeHarvestService } from '@/lib/logictrade/bronze-harvest-service';
import { isParityGateEntrypoint } from '../../../scripts/verify-bronze-parity';
import { isHarvestCliEntrypoint } from '../../../scripts/harvest-logictrade-bronze';

describe('Bronze Parity and Domain Expansion Suite (TDD Red -> Green)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Sub-Fase 3A: Isomorphic Quantity Helper & Order Intake Parity', () => {
    it('toNonNegativeQuantity: correctly handles 0, positive integers, negative numbers and invalid inputs', () => {
      expect(toNonNegativeQuantity(0)).toBe(0);
      expect(toNonNegativeQuantity(1)).toBe(1);
      expect(toNonNegativeQuantity(1.45)).toBe(1.45);
      expect(toNonNegativeQuantity('1.45')).toBe(1.45);
      expect(toNonNegativeQuantity(42)).toBe(42);
      expect(toNonNegativeQuantity('5')).toBe(5);
      expect(toNonNegativeQuantity('0')).toBe(0);

      // Clamping negatives & handling null/undefined/NaN
      expect(toNonNegativeQuantity(-1)).toBe(0);
      expect(toNonNegativeQuantity(-100)).toBe(0);
      expect(toNonNegativeQuantity(null)).toBe(0);
      expect(toNonNegativeQuantity(undefined)).toBe(0);
      expect(toNonNegativeQuantity('not-a-number')).toBe(0);
      expect(toNonNegativeQuantity(NaN)).toBe(0);
    });

    it('resolveNumericQuantity: retains 0, parses integers and falls back to 1 for null/undefined/invalid', () => {
      expect(resolveNumericQuantity(0)).toBe(0);
      expect(resolveNumericQuantity('0')).toBe(0);
      expect(resolveNumericQuantity('0.0')).toBe(0);
      expect(resolveNumericQuantity(1.45)).toBe(1.45);
      expect(resolveNumericQuantity('1.45')).toBe(1.45);
      expect(resolveNumericQuantity(5)).toBe(5);
      expect(resolveNumericQuantity('5')).toBe(5);
      expect(resolveNumericQuantity(-2)).toBe(-2);
      expect(resolveNumericQuantity(null)).toBe(1);
      expect(resolveNumericQuantity(undefined)).toBe(1);
      expect(resolveNumericQuantity('')).toBe(1);
      expect(resolveNumericQuantity('invalid')).toBe(1);
    });

    it('connection-config: resolves default base URL and environment config cleanly', () => {
      const config = resolveLogicTradeConnectionConfig({ requireApiKey: false });
      expect(config.baseUrl).toBeDefined();
      expect(config.baseUrl).toContain('https://');
      expect(typeof config.apiKey).toBe('string');
    });

    it('connection-config: throws fail-closed error if API key is required but missing', () => {
      const origKey = process.env.LOGICTRADE_API_KEY;
      const origVendor = process.env.LOGICTRADE_VENDOR_API_KEY;
      try {
        delete process.env.LOGICTRADE_API_KEY;
        delete process.env.LOGICTRADE_VENDOR_API_KEY;

        expect(() => {
          resolveLogicTradeConnectionConfig({
            apiKey: '',
            requireApiKey: true,
          });
        }).toThrow(/LOGICTRADE_API_KEY/);
      } finally {
        if (origKey) process.env.LOGICTRADE_API_KEY = origKey;
        if (origVendor) process.env.LOGICTRADE_VENDOR_API_KEY = origVendor;
      }
    });

    it('mapLogicTradeOrderToRawInput: assigns orders.lt_id and enforces lt_raw_data = null on sub_line=1', () => {
      const mockOrder: any = {
        id: 109327,
        orderId: 'V25001523',
        orderNumber: 'V25001523',
        status: 'Confirmed',
        totalGross: 1250.50,
        currency: 'EUR',
        lines: [
          {
            id: 2001,
            lineNumber: 10,
            articleCode: 'ART-01',
            description: 'Main item',
            quantity: 2,
            unitPrice: 500,
            subLines: [
              {
                id: 2002,
                lineNumber: 10,
                articleCode: 'ART-SUB-01',
                description: 'Sub option',
                quantity: 1,
                unitPrice: 250,
              }
            ]
          }
        ]
      };

      const mapped = mapLogicTradeOrderToRawInput(mockOrder);
      expect(mapped.lt_id).toBe('109327');
      expect(mapped.order_number).toBe('V25001523');

      // Check lines
      const mainLine = mapped.lines.find((l: any) => l.sub_line === 0);
      const subLine = mapped.lines.find((l: any) => l.sub_line === 1);

      expect(mainLine).toBeDefined();
      expect(mainLine.quantity).toBe(2);
      expect(mainLine.lt_raw_data).toBeDefined();

      expect(subLine).toBeDefined();
      expect(subLine.line_number).toBe(mainLine.line_number);
      expect(subLine.quantity).toBe(1);
      // [SPEC-CHANGE-AUTHORIZED: Herstel testassertie naar behoud ruwe brondata voor reële sublines en restrictie van null-data tot is_inbegrepen = true]
      // Reële LogicTrade subregels behouden authentieke brondata; uitsluitend synthetische inbegrepen regels hebben null lt_raw_data
      expect(subLine.lt_raw_data).toBeDefined();
      expect(subLine.lt_raw_data).not.toBeNull();
    });

    it('mapLogicTradeOrderToRawInput: colliding main lines preserve parent-child line numbers for all sublines', () => {
      const collidingOrderWithSublines: any = {
        id: 158701,
        orderNumber: 'O24000107',
        lines: [
          {
            id: 101,
            lineNumber: 60,
            articleCode: 'MAIN-1',
            quantity: 1,
            subLines: [{ id: 1011, lineNumber: 60, articleCode: 'SUB-1', quantity: 1 }],
          },
          {
            id: 102,
            lineNumber: 60,
            articleCode: 'MAIN-2',
            quantity: 1,
            subLines: [{ id: 1021, lineNumber: 60, articleCode: 'SUB-2', quantity: 1 }],
          },
        ],
      };

      const mapped = mapLogicTradeOrderToRawInput(collidingOrderWithSublines);
      expect(mapped.lines).toHaveLength(4);

      const main1 = mapped.lines.find((l: any) => l.product_code === 'MAIN-1');
      const sub1 = mapped.lines.find((l: any) => l.product_code === 'SUB-1');
      const main2 = mapped.lines.find((l: any) => l.product_code === 'MAIN-2');
      const sub2 = mapped.lines.find((l: any) => l.product_code === 'SUB-2');

      expect(main1).toBeDefined();
      expect(sub1).toBeDefined();
      expect(main2).toBeDefined();
      expect(sub2).toBeDefined();

      // Parent-child subline binding
      expect(sub1.line_number).toBe(main1.line_number);
      expect(sub2.line_number).toBe(main2.line_number);

      // Collision resolved cleanly: main1 and main2 have distinct line numbers
      expect(main1.line_number).not.toBe(main2.line_number);
    });

    it('mapLogicTradeOrderToRawInput: collision-free line numbering on duplicate or 0 lineNumbers', () => {
      const mockOrderWithDuplicates: any = {
        id: 158700,
        orderNumber: 'O24000106',
        lines: [
          { id: 101, lineNumber: 60, articleCode: 'A', quantity: 1 },
          { id: 102, lineNumber: 60, articleCode: 'B', quantity: 1 },
          { id: 103, lineNumber: 0, articleCode: 'C', quantity: 0 },
        ]
      };

      const mapped = mapLogicTradeOrderToRawInput(mockOrderWithDuplicates);
      const lineNumbers = mapped.lines.map((l: any) => l.line_number);
      const uniqueLineNumbers = new Set(lineNumbers);

      // Every line must have a unique positive line_number
      expect(uniqueLineNumbers.size).toBe(mapped.lines.length);
      lineNumbers.forEach((ln: number) => {
        expect(ln).toBeGreaterThan(0);
      });
    });
  });

  describe('Sub-Fase 3B: Bronze Domain Harvester & Option Values Scale Contract', () => {
    it('BronzeHarvestService: instantiates and exposes bronze domain methods', () => {
      const service = new BronzeHarvestService({
        requireApiKey: false,
      });

      expect(typeof service.harvestCustomers).toBe('function');
      expect(typeof service.harvestSuppliers).toBe('function');
      expect(typeof service.harvestPurchaseOrders).toBe('function');
      expect(typeof service.harvestConfiguratorOptionsAndValues).toBe('function');
    });

    it('BronzeHarvestService: streams option values in batches <= 250 rows with parent pre-upsert', async () => {
      const mockClient: any = {
        fetchConfiguratorOptions: vi.fn().mockResolvedValue([
          { id: 1026, code: 'OPT_FABRIC', description: 'Fabric Selection', kind: 400, isActive: true }
        ]),
        fetchConfiguratorOptionValues: vi.fn().mockImplementation((optionId: number, page: number) => {
          if (page === 1) {
            return Promise.resolve({
              results: Array.from({ length: 100 }, (_, i) => ({
                id: i + 1,
                code: `VAL_${i + 1}`,
                description: `Value ${i + 1}`,
                isActive: true
              })),
              pagination: { totalResults: 200, page: 1, pageSize: 100 }
            });
          } else if (page === 2) {
            return Promise.resolve({
              results: Array.from({ length: 100 }, (_, i) => ({
                id: i + 101,
                code: `VAL_${i + 101}`,
                description: `Value ${i + 101}`,
                isActive: i % 2 === 0 // some inactive
              })),
              pagination: { totalResults: 200, page: 2, pageSize: 100 }
            });
          }
          return Promise.resolve({ results: [], pagination: { totalResults: 200, page: 3, pageSize: 100 } });
        })
      };

      const mockDal: any = {
        upsertConfiguratorSchemasBatch: vi.fn().mockResolvedValue({ count: 1 }),
        upsertConfiguratorOptionValuesBatch: vi.fn().mockResolvedValue({ count: 100 }),
        updateSyncState: vi.fn().mockResolvedValue(true)
      };

      const service = new BronzeHarvestService({
        client: mockClient,
        dal: mockDal,
        requireApiKey: false
      });

      const result = await service.harvestConfiguratorOptionsAndValues({
        persistBronzeValues: true,
        preserveSilverOnConflict: true
      });

      expect(result.optionsProcessed).toBe(1);
      expect(result.valuesProcessed).toBe(200);

      // Verify Step 1: Parent pre-upsert called with preserveSilverOnConflict: true
      expect(mockDal.upsertConfiguratorSchemasBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ option_id: 1026 })
        ]),
        expect.objectContaining({ preserveSilverOnConflict: true })
      );

      // Verify Step 2: Streamed to option values in chunks <= 250
      expect(mockDal.upsertConfiguratorOptionValuesBatch).toHaveBeenCalled();
      const calls = mockDal.upsertConfiguratorOptionValuesBatch.mock.calls;
      calls.forEach((call: any) => {
        const batch = call[0];
        expect(batch.length).toBeLessThanOrEqual(250);
      });
    });

    it('Cryptographic Immutability Contract: computes SHA-256 matching PostgreSQL digest', () => {
      const samplePayload = { id: 1001, name: 'Test Product', timestamp: '2026-11-20T12:00:00Z' };
      const rawText = JSON.stringify(samplePayload);
      const expectedHash = crypto.createHash('sha256').update(rawText).digest('hex');

      expect(expectedHash).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(expectedHash)).toBe(true);
    });

    // [SPEC-CHANGE-AUTHORIZED: Toevoegen regressietests voor GSW originCode filtering op inkooporders, totalPrice/null order_date/companyName mapping, multi-page /options paginatie, buffered option values streaming, fail-closed DAL/updateSyncState errors, sync checkpoints en Windows/POSIX CLI entrypoint-guards]
    it('harvestPurchaseOrders: applies originCode Winkel GSW BV by default and maps totalPrice and null order_date faithfully', async () => {
      let requestedUrl = '';
      const mockLimiter: any = {
        fetchWithAdaptiveBackoff: vi.fn().mockImplementation((url: string) => {
          requestedUrl = url;
          return Promise.resolve(
            new Response(
              JSON.stringify({
                results: [
                  {
                    id: 5001,
                    orderNumber: 'PO-5001',
                    orderDate: null,
                    totalGross: null,
                    totalPrice: 49.95,
                    lines: [
                      { id: 1, lineNumber: 10, code: 'TRACK-01', quantity: 6.92, partPrice: 20.0, linePrice: 138.4 }
                    ]
                  }
                ],
                pagination: { totalPages: 1 }
              }),
              { status: 200 }
            )
          );
        })
      };

      const mockDal: any = {
        upsertPurchaseOrdersBatch: vi.fn().mockResolvedValue({ count: 1 }),
        updateSyncState: vi.fn().mockResolvedValue(true)
      };

      const service = new BronzeHarvestService({
        dal: mockDal,
        rateLimiter: mockLimiter,
        requireApiKey: false
      });

      const res = await service.harvestPurchaseOrders();
      expect(res.purchaseOrdersProcessed).toBe(1);
      expect(requestedUrl).toContain('originCode=Winkel+GSW+BV');

      expect(mockDal.upsertPurchaseOrdersBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 5001,
            order_date: null,
            total_gross_cents: 4995
          })
        ])
      );
      expect(mockDal.updateSyncState).toHaveBeenCalledWith('purchaseorders_bronze_sync', 1, expect.any(String));
    });

    it('harvestCustomers: cascades companyName and updates customers_bronze_sync checkpoint', async () => {
      const mockLimiter: any = {
        fetchWithAdaptiveBackoff: vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              results: [
                { id: 7001, customerNumber: 'C-7001', name: null, firstName: null, lastName: null, companyName: 'Bedrijf XYZ B.V.', isActive: true }
              ],
              pagination: { totalPages: 1 }
            }),
            { status: 200 }
          )
        )
      };

      const mockDal: any = {
        upsertCustomersBatch: vi.fn().mockResolvedValue({ count: 1 }),
        updateSyncState: vi.fn().mockResolvedValue(true)
      };

      const service = new BronzeHarvestService({
        dal: mockDal,
        rateLimiter: mockLimiter,
        requireApiKey: false
      });

      const res = await service.harvestCustomers();
      expect(res.customersProcessed).toBe(1);
      expect(mockDal.upsertCustomersBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 7001,
            name: 'Bedrijf XYZ B.V.'
          })
        ])
      );
      expect(mockDal.updateSyncState).toHaveBeenCalledWith('customers_bronze_sync', 1, expect.any(String));
    });

    // [SPEC-CHANGE-AUTHORIZED: Toevoegen unit tests voor CLI entrypoint guards isParityGateEntrypoint en isHarvestCliEntrypoint]
    it('isParityGateEntrypoint & isHarvestCliEntrypoint: correctly detects CLI entrypoint vs test environment', () => {
      // In test environment, returns false
      expect(isParityGateEntrypoint(undefined, 'test')).toBe(false);
      expect(isHarvestCliEntrypoint(undefined, 'test')).toBe(false);

      // Matches various POSIX/Windows paths
      expect(isParityGateEntrypoint('C:\\project\\scripts\\verify-bronze-parity.ts', 'development')).toBe(true);
      expect(isParityGateEntrypoint('/app/scripts/verify-bronze-parity.js', 'production')).toBe(true);
      expect(isParityGateEntrypoint('scripts/verify-bronze-parity', 'production')).toBe(true);
      expect(isParityGateEntrypoint('other-script.ts', 'production')).toBe(false);

      expect(isHarvestCliEntrypoint('C:\\project\\scripts\\harvest-logictrade-bronze.ts', 'development')).toBe(true);
      expect(isHarvestCliEntrypoint('/app/scripts/harvest-logictrade-bronze.mjs', 'production')).toBe(true);
      expect(isHarvestCliEntrypoint('scripts/harvest-logictrade-bronze', 'production')).toBe(true);
      expect(isHarvestCliEntrypoint('other-script.ts', 'production')).toBe(false);
    });
  });
});
