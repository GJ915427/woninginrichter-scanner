import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GET,
  normalizeProduct,
  sanitizeQuery,
  parseMultiTokenQuery,
  getSuppliersCache,
  resetSuppliersCache,
  calculateProductRelevanceTier,
  DISCONTINUED_REGEX
} from '@/app/api/products/search/route';
import { LogicTradeProductRaw } from '@/types/product';

describe('BFF Product Search Route API Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetSuppliersCache();
  });

  describe('Query Sanitization', () => {
    it('should trim and strip unsafe characters', () => {
      expect(sanitizeQuery('  A00052469  ')).toBe('A00052469');
      expect(sanitizeQuery('Duette® shade')).toBe('Duette shade');
      expect(sanitizeQuery('   ')).toBe('');
    });
  });

  describe('Multi-Token & Supplier Query Parsing (TDD RED)', () => {
    it('should detect supplier and separate product term when supplier is present in query', () => {
      const knownSuppliers = [
        { id: 82653, number: 'R00017180', companyName: 'Luxaflex' },
        { id: 10200, number: 'R00012000', companyName: 'Vadain' }
      ];

      const parsed = parseMultiTokenQuery('Luxaflex Duette', knownSuppliers);
      expect(parsed.matchedSupplier?.companyName).toBe('Luxaflex');
      expect(parsed.searchTerm).toBe('Duette');
      expect(parsed.productTokens).toEqual(['Duette']);
    });

    it('should detect supplier prefix in abbreviated multi-token queries like "luxa due"', () => {
      const knownSuppliers = [
        { id: 82653, number: 'R00017180', companyName: 'Luxaflex' }
      ];

      const parsed = parseMultiTokenQuery('luxa due', knownSuppliers);
      expect(parsed.matchedSupplier?.companyName).toBe('Luxaflex');
      expect(parsed.searchTerm).toBe('due');
      expect(parsed.productTokens).toEqual(['due']);
    });

    it('should detect supplier regardless of token order (e.g. "due vadai")', () => {
      const knownSuppliers = [
        { id: 10200, number: 'R00012000', companyName: 'Vadain' }
      ];

      const parsed = parseMultiTokenQuery('due vadai', knownSuppliers);
      expect(parsed.matchedSupplier?.companyName).toBe('Vadain');
      expect(parsed.searchTerm).toBe('due');
      expect(parsed.productTokens).toEqual(['due']);
    });

    it('should handle single supplier query correctly and keep productTokens empty', () => {
      const knownSuppliers = [
        { id: 82653, number: 'R00017180', companyName: 'Luxaflex' }
      ];

      const parsed = parseMultiTokenQuery('Luxaflex', knownSuppliers);
      expect(parsed.matchedSupplier?.companyName).toBe('Luxaflex');
      expect(parsed.searchTerm).toBe('Luxaflex');
      expect(parsed.productTokens).toEqual([]);
    });

    it('should leave query intact when no known supplier matches', () => {
      const knownSuppliers = [
        { id: 82653, number: 'R00017180', companyName: 'Luxaflex' }
      ];

      const parsed = parseMultiTokenQuery('Onbekend Gordijn', knownSuppliers);
      expect(parsed.matchedSupplier).toBeNull();
      expect(parsed.searchTerm).toBe('Onbekend Gordijn');
      expect(parsed.productTokens).toEqual(['Onbekend', 'Gordijn']);
    });
  });

  describe('Supplier Cache', () => {
    it('should fetch and cache suppliers from LogicTrade /suppliers endpoint', async () => {
      const mockSuppliersPayload = {
        pagination: { totalResults: 2, pageNumber: 1, pageSize: 100, totalPages: 1 },
        results: [
          { id: 82653, number: 'R00017180', companyName: 'Luxaflex' },
          { id: 10200, number: 'R00012000', companyName: 'Vadain' }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSuppliersPayload
      } as Response);

      const suppliers = await getSuppliersCache(true);
      expect(suppliers.length).toBe(2);
      expect(suppliers[0].companyName).toBe('Luxaflex');
    });

    it('should gracefully return empty cache if /suppliers endpoint fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));
      const suppliers = await getSuppliersCache(true);
      expect(suppliers).toEqual([]);
    });
  });

  describe('Product Normalization', () => {
    it('should normalize a raw LogicTrade product envelope to SearchResultItem', () => {
      const rawProduct: LogicTradeProductRaw = {
        id: 219609,
        code: 'A00052469',
        name: 'Duette® shade',
        unit: 'stuks',
        salesPrice: 898.21,
        salesGroup: { id: 49, code: 'RD', description: 'Raamdecoratie' },
        vat: { id: 1, code: '1', description: 'BTW Hoog' },
        supplier: {
          supplier: {
            id: 82653,
            companyName: 'Luxaflex Nederland'
          }
        },
        groups: [
          { id: 230, parentId: null, code: '', description: 'Koppelingen Raamdecoratie' },
          { id: 231, parentId: 230, code: '', description: 'Luxaflex' }
        ]
      };

      const normalized = normalizeProduct(rawProduct);

      expect(normalized.id).toBe(219609);
      expect(normalized.code).toBe('A00052469');
      expect(normalized.name).toBe('Duette® shade');
      expect(normalized.salesPrice).toBe(898.21);
      expect(normalized.salesGroup).toBe('Raamdecoratie');
      expect(normalized.supplierName).toBe('Luxaflex Nederland');
      expect(normalized.supplierId).toBe(82653);
      expect(normalized.groups).toEqual(['Koppelingen Raamdecoratie', 'Luxaflex']);
      expect(normalized.vatCode).toBe('BTW Hoog');
    });

    it('should gracefully handle missing nested objects in raw product', () => {
      const minimalRaw: LogicTradeProductRaw = {
        id: 100,
        code: 'TEST01',
        name: 'Test Product',
        salesPrice: 0
      };

      const normalized = normalizeProduct(minimalRaw);

      expect(normalized.id).toBe(100);
      expect(normalized.code).toBe('TEST01');
      expect(normalized.supplierName).toBe('Onbekende leverancier');
      expect(normalized.salesGroup).toBe('Algemeen');
      expect(normalized.groups).toEqual([]);
    });
  });

  describe('GET Handler Validation & Conjunctive (AND) Filtering (TDD RED)', () => {
    it('should return 400 when query parameter is missing', async () => {
      const request = new Request('http://localhost:3000/api/products/search');
      const response = await GET(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('minimaal 2');
    });

    it('should return 400 when query parameter is shorter than 2 characters', async () => {
      const request = new Request('http://localhost:3000/api/products/search?q=a');
      const response = await GET(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('should query LogicTrade API and return formatted results and pagination metadata on valid query', async () => {
      const mockApiResponse = {
        pagination: { totalResults: 157, pageNumber: 1, pageSize: 20, totalPages: 8 },
        results: [
          {
            id: 219609,
            code: 'A00052469',
            name: 'Duette® shade',
            unit: 'stuks',
            salesPrice: 0,
            salesGroup: { id: 49, code: '', description: 'Raamdecoratie' },
            vat: { id: 1, code: '1', description: 'BTW Hoog' },
            supplier: {
              supplier: {
                id: 82653,
                companyName: 'Luxaflex'
              }
            }
          }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockApiResponse
      } as Response);

      const request = new Request('http://localhost:3000/api/products/search?q=Luxaflex');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.count).toBe(1);
      expect(json.items[0].code).toBe('A00052469');
      expect(json.items[0].supplierName).toBe('Luxaflex');
      expect(json.pagination).toBeDefined();
      expect(json.pagination.totalResults).toBe(157);
    });

    it('should strictly reject competing supplier products for "vadai due" and return 0 results', async () => {
      const mockSuppliersPayload = {
        pagination: { totalResults: 1, pageNumber: 1, pageSize: 100, totalPages: 1 },
        results: [
          { id: 10200, number: 'R00012000', companyName: 'Vadain' }
        ]
      };

      // Simuleer dat LogicTrade voor due 53 items teruggeeft van Interfloor en Luxaflex (maar NIET van Vadain)
      const mockProductsDue = {
        pagination: { totalResults: 53, pageNumber: 1, pageSize: 20, totalPages: 3 },
        results: [
          {
            id: 30405,
            code: 'A00030405',
            name: '400 Ab Duette 703',
            unit: 'm1',
            salesPrice: 55,
            salesGroup: { id: 10, code: '', description: 'Tapijt' },
            supplier: {
              supplier: {
                id: 9999,
                companyName: 'Interfloor'
              }
            }
          },
          {
            id: 219609,
            code: 'A00052469',
            name: 'Duette® shade',
            unit: 'stuks',
            salesPrice: 0,
            salesGroup: { id: 49, code: '', description: 'Raamdecoratie' },
            supplier: {
              supplier: {
                id: 82653,
                companyName: 'Luxaflex'
              }
            }
          }
        ]
      };

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/suppliers')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockSuppliersPayload
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => mockProductsDue
        };
      });

      const request = new Request('http://localhost:3000/api/products/search?q=vadai+due');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.count).toBe(0);
      expect(json.items).toEqual([]);
      expect(json.pagination.totalResults).toBe(0);
      expect(json.pagination.hasMore).toBe(false);
    });

    it('should also reject competing suppliers for reversed query order "due vadai"', async () => {
      const mockSuppliersPayload = {
        pagination: { totalResults: 1, pageNumber: 1, pageSize: 100, totalPages: 1 },
        results: [
          { id: 10200, number: 'R00012000', companyName: 'Vadain' }
        ]
      };

      const mockProductsDue = {
        pagination: { totalResults: 53, pageNumber: 1, pageSize: 20, totalPages: 3 },
        results: [
          {
            id: 30405,
            code: 'A00030405',
            name: '400 Ab Duette 703',
            unit: 'm1',
            salesPrice: 55,
            salesGroup: { id: 10, code: '', description: 'Tapijt' },
            supplier: {
              supplier: {
                id: 9999,
                companyName: 'Interfloor'
              }
            }
          }
        ]
      };

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/suppliers')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockSuppliersPayload
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => mockProductsDue
        };
      });

      const request = new Request('http://localhost:3000/api/products/search?q=due+vadai');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.count).toBe(0);
      expect(json.items).toEqual([]);
      expect(json.pagination.totalResults).toBe(0);
    });

    it('should handle ERP error 429 rate limit gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'Retry-After': '5' })
      } as Response);

      const request = new Request('http://localhost:3000/api/products/search?q=Duette');
      const response = await GET(request);

      expect(response.status).toBe(429);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('te veel verzoeken');
    });
  });

  describe('Uitlopende Collectie Detectie & Sortering (Punten 2.1 & 2.2)', () => {
    describe('DISCONTINUED_REGEX', () => {
      it('should match "Uitlopende collectie", "uitlopende collectie", and "Uitlopend"', () => {
        expect(DISCONTINUED_REGEX.test('Uitlopende collectie')).toBe(true);
        expect(DISCONTINUED_REGEX.test('uitlopende collectie')).toBe(true);
        expect(DISCONTINUED_REGEX.test('Collectie is Uitlopend')).toBe(true);
        expect(DISCONTINUED_REGEX.test('uitlopend')).toBe(true);
        expect(DISCONTINUED_REGEX.test('Duette shade 25 mm - Uitlopend')).toBe(true);
      });

      it('should not match regular active product names or descriptions', () => {
        expect(DISCONTINUED_REGEX.test('Duette shade 25 mm')).toBe(false);
        expect(DISCONTINUED_REGEX.test('Nieuwe collectie 2026')).toBe(false);
        expect(DISCONTINUED_REGEX.test('Rolgordijn verduisterend')).toBe(false);
      });
    });

    describe('normalizeProduct isDiscontinued mapping', () => {
      it('should set isDiscontinued: true when description contains "Uitlopende collectie"', () => {
        const raw: LogicTradeProductRaw = {
          id: 219610,
          code: 'A00042592',
          name: 'Duette shade',
          description: 'Uitlopende collectie',
          salesPrice: 173.0,
          groups: [{ id: 1, parentId: null, code: 'G1', description: 'Duette' }]
        };

        const normalized = normalizeProduct(raw);
        expect(normalized.isDiscontinued).toBe(true);
      });

      it('should set isDiscontinued: true when name contains "uitlopend"', () => {
        const raw: LogicTradeProductRaw = {
          id: 219612,
          code: 'A00042593',
          name: 'Duette shade uitlopend',
          salesPrice: 173.0
        };

        const normalized = normalizeProduct(raw);
        expect(normalized.isDiscontinued).toBe(true);
      });

      it('should set isDiscontinued: false for active products with null or missing description', () => {
        const raw: LogicTradeProductRaw = {
          id: 219609,
          code: 'A00052469',
          name: 'Duette shade 25 mm',
          salesPrice: 229.0
        };

        const normalized = normalizeProduct(raw);
        expect(normalized.isDiscontinued).toBeFalsy();
      });
    });

    describe('GET ranking priority (Active before Discontinued)', () => {
      it('should sort active products before discontinued products in response items', async () => {
        const mockActive = {
          id: 219609,
          code: 'A00052469',
          name: 'Duette shade 2026',
          salesPrice: 229.0,
          unit: 'stuks',
          supplier: { supplier: { companyName: 'Luxaflex' } }
        };

        const mockDiscontinued = {
          id: 219610,
          code: 'A00042592',
          name: 'Duette shade uitlopend',
          description: 'Uitlopende collectie',
          salesPrice: 173.0,
          unit: 'stuks',
          supplier: { supplier: { companyName: 'Luxaflex' } }
        };

        global.fetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('/suppliers')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ results: [{ id: 1, companyName: 'Luxaflex' }] })
            };
          }
          // Retourneer eerst het uitlopende artikel en daarna het actieve artikel
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [mockDiscontinued, mockActive],
              pagination: { totalResults: 2, pageNumber: 1, pageSize: 20, totalPages: 1 }
            })
          };
        });

        const request = new Request('http://localhost:3000/api/products/search?q=Duette');
        const response = await GET(request);

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.items.length).toBe(2);

        // Actieve artikel moet bovenaan staan (index 0) en uitlopend onderaan (index 1)
        expect(json.items[0].code).toBe('A00052469');
        expect(json.items[0].isDiscontinued).toBeFalsy();
        expect(json.items[1].code).toBe('A00042592');
        expect(json.items[1].isDiscontinued).toBe(true);
      });
    });

    describe('Feature Intent & Pre-Configuration Search Integration Tests', () => {
      it('should enrich search results with TruFit badge and preconfiguration when searching "tru deut"', async () => {
        const mockProduct = {
          id: 219609,
          code: 'A00052469',
          name: 'Duette shade 25 mm',
          salesPrice: 229.0,
          unit: 'stuks',
          supplier: { supplier: { companyName: 'Luxaflex' } }
        };

        global.fetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('/suppliers')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ results: [{ id: 1, companyName: 'Luxaflex' }] })
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [mockProduct],
              pagination: { totalResults: 1, pageNumber: 1, pageSize: 20, totalPages: 1 }
            })
          };
        });

        const request = new Request('http://localhost:3000/api/products/search?q=tru%20deut');
        const response = await GET(request);

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.items.length).toBe(1);

        const item = json.items[0];
        expect(item.code).toBe('A00052469');
        expect(item.featureBadges).toContain('TruFit');
        expect(item.preconfiguration).toBeDefined();
        expect(item.preconfiguration?.montage).toBe('MONTAGE_TRUFIT');
        expect(item.preconfiguration?.bediening).toBe('HANDGREEP');
      });

      it('should enrich search results with SmartCord badge and preconfiguration when searching "cord"', async () => {
        const mockProduct = {
          id: 219609,
          code: 'A00052469',
          name: 'Duette shade 25 mm',
          salesPrice: 229.0,
          unit: 'stuks',
          supplier: { supplier: { companyName: 'Luxaflex' } }
        };

        global.fetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('/suppliers')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ results: [{ id: 1, companyName: 'Luxaflex' }] })
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [mockProduct],
              pagination: { totalResults: 1, pageNumber: 1, pageSize: 20, totalPages: 1 }
            })
          };
        });

        const request = new Request('http://localhost:3000/api/products/search?q=cord');
        const response = await GET(request);

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.items[0].featureBadges).toContain('SmartCord');
        expect(json.items[0].preconfiguration?.bediening).toBe('SMARTCORD');
      });

      it('should resolve transposition typo UA20 to AU20 with model preset', async () => {
        const mockProduct = {
          id: 219609,
          code: 'A00052469',
          name: 'Duette shade 25 mm',
          salesPrice: 229.0,
          unit: 'stuks',
          supplier: { supplier: { companyName: 'Luxaflex' } }
        };

        global.fetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('/suppliers')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ results: [{ id: 1, companyName: 'Luxaflex' }] })
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [mockProduct],
              pagination: { totalResults: 1, pageNumber: 1, pageSize: 20, totalPages: 1 }
            })
          };
        });

        const request = new Request('http://localhost:3000/api/products/search?q=UA20');
        const response = await GET(request);

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.items[0].modelPreset?.code).toBe('AU20');
      });

      it('negative control: should not attach SmartCord badge to raamdecoratie query', async () => {
        const mockProduct = {
          id: 219609,
          code: 'A00052469',
          name: 'Duette raamdecoratie',
          salesPrice: 229.0,
          unit: 'stuks',
          supplier: { supplier: { companyName: 'Luxaflex' } }
        };

        global.fetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('/suppliers')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ results: [{ id: 1, companyName: 'Luxaflex' }] })
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [mockProduct],
              pagination: { totalResults: 1, pageNumber: 1, pageSize: 20, totalPages: 1 }
            })
          };
        });

        const request = new Request('http://localhost:3000/api/products/search?q=Luxaflex%20raamdecoratie');
        const response = await GET(request);

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.items[0].featureBadges).toBeUndefined();
      });

      it('should match progressive prefix "smartcor" and attach SmartCord badge and preconfiguration', async () => {
        const mockProduct = {
          id: 219609,
          code: 'A00052469',
          name: 'Duette shade 25 mm',
          salesPrice: 229.0,
          unit: 'stuks',
          supplier: { supplier: { companyName: 'Luxaflex' } }
        };

        global.fetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('/suppliers')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ results: [{ id: 1, companyName: 'Luxaflex' }] })
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [mockProduct],
              pagination: { totalResults: 1, pageNumber: 1, pageSize: 20, totalPages: 1 }
            })
          };
        });

        const request = new Request('http://localhost:3000/api/products/search?q=smartcor');
        const response = await GET(request);

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.items[0].featureBadges).toContain('SmartCord');
        expect(json.items[0].preconfiguration?.bediening).toBe('SMARTCORD');
      });

      it('should match universal infix keyword \"fit\" and \"view\" and multi-feature \"fit deut 20 cord\"', async () => {
        const mockProduct = {
          id: 219609,
          code: 'A00052469',
          name: 'Duette shade 25 mm',
          salesPrice: 229.0,
          unit: 'stuks',
          supplier: { supplier: { companyName: 'Luxaflex' } }
        };

        global.fetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('/suppliers')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ results: [{ id: 1, companyName: 'Luxaflex' }] })
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [mockProduct],
              pagination: { totalResults: 1, pageNumber: 1, pageSize: 20, totalPages: 1 }
            })
          };
        });

        const reqFit = new Request('http://localhost:3000/api/products/search?q=fit');
        const resFit = await GET(reqFit);
        const jsonFit = await resFit.json();
        expect(jsonFit.items[0].featureBadges).toContain('TruFit');
        expect(jsonFit.items[0].preconfiguration?.montage).toBe('MONTAGE_TRUFIT');

        const reqMulti = new Request('http://localhost:3000/api/products/search?q=fit%20deut%2020%20cord');
        const resMulti = await GET(reqMulti);
        const jsonMulti = await resMulti.json();
        expect(jsonMulti.items[0].featureBadges).toContain('TruFit');
        expect(jsonMulti.items[0].featureBadges).toContain('SmartCord');
        expect(jsonMulti.items[0].preconfiguration?.montage).toBe('MONTAGE_TRUFIT');
        expect(jsonMulti.items[0].preconfiguration?.bediening).toBe('HANDGREEP');
        expect(jsonMulti.items[0].preconfiguration?.modelPreset?.code).toBe('AU20');
      });
    });

    describe('Tiered Relevance Pyramid & Cross-Field Matching (Tranche 3C)', () => {
      it('assigns correct numerical tiers via calculateProductRelevanceTier', () => {
        // Tier 1: Configureerbare Hoofdproducten (+100)
        expect(calculateProductRelevanceTier('Duette shade 25 mm')).toBe(100);
        expect(calculateProductRelevanceTier('Plissé shades')).toBe(100);

        // Tier 2: Specifieke Productvarianten (+50)
        expect(calculateProductRelevanceTier('Dakraam Duette shade')).toBe(50);
        expect(calculateProductRelevanceTier('Dakraam Duette shade combi')).toBe(50);

        // Tier 3: Accessoires & Bediening (+10)
        expect(calculateProductRelevanceTier('Bedieningsstang (plissé/Duette shade)')).toBe(10);
        expect(calculateProductRelevanceTier('Klemsteunen Duette')).toBe(10);

        // Tier 4: Monsters & Stalen (-80)
        expect(calculateProductRelevanceTier('Duette shades staal')).toBe(-80);
        expect(calculateProductRelevanceTier('Stalen service Duette shades (AF10)')).toBe(-80);
        expect(calculateProductRelevanceTier('Collectieboek Duette 2025')).toBe(-80);

        // Tier 5: Uitlopende collecties (-200)
        expect(calculateProductRelevanceTier('Duette shade [Uitlopende collectie]')).toBe(-200);
        expect(calculateProductRelevanceTier('Duette shade', '', true)).toBe(-200);
      });

      it('ranks core base products strictly above swatch sample cards and accessories', async () => {
        const mockStaal: LogicTradeProductRaw = {
          id: 234181,
          code: 'A000064503',
          name: 'Duette shades staal',
          salesPrice: 0,
          unit: 'stuks',
          supplier: { supplier: { companyName: 'Sunway Benelux BV' } }
        };
        const mockStang: LogicTradeProductRaw = {
          id: 147237,
          code: 'A00042593',
          name: 'Bedieningsstang (plissé/Duette shade)',
          salesPrice: 15.0,
          unit: 'stuks',
          supplier: { supplier: { companyName: 'Luxaflex' } }
        };
        const mockCoreProduct: LogicTradeProductRaw = {
          id: 219609,
          code: 'A00052469',
          name: 'Duette shade',
          salesPrice: 229.0,
          unit: 'stuks',
          supplier: { supplier: { companyName: 'Luxaflex' } }
        };

        global.fetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('/suppliers')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                results: [
                  { id: 1, companyName: 'Luxaflex' },
                  { id: 2, companyName: 'Sunway Benelux BV' }
                ]
              })
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [mockStaal, mockStang, mockCoreProduct],
              pagination: { totalResults: 3, pageNumber: 1, pageSize: 20, totalPages: 1 }
            })
          };
        });

        const req = new Request('http://localhost:3000/api/products/search?q=cor');
        const res = await GET(req);
        const json = await res.json();

        expect(json.success).toBe(true);
        expect(json.items.length).toBe(3);
        // Positie #1 MOET het configureerbare hoofdproduct zijn!
        expect(json.items[0].code).toBe('A00052469');
        expect(json.items[0].name).toBe('Duette shade');

        // Positie #2 is de accessoire (bedieningsstang)
        expect(json.items[1].code).toBe('A00042593');

        // Positie #3 (onderaan) is de stalenkaart
        expect(json.items[2].code).toBe('A000064503');
      });
    });
  });
});
