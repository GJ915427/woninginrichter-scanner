import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  harvest2YearOrders,
  DEFAULT_HARVEST_STATUSES,
  type Harvest2YrOptions,
  type LogicTradeOrderHeader,
  type LogicTradeOrderLine,
} from '@/lib/logictrade/harvest-2yr-orders';

describe('Harvest2YrOrders Service (TDD Suite)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('declares the canonical default status whitelist', () => {
    expect(DEFAULT_HARVEST_STATUSES).toEqual([
      'CONFIRMED',
      'ORDER',
      'DELIVERED',
      'CLOSED',
      'DEFINITIEF',
    ]);
  });

  describe('Order Status Filtering & Date Boundaries', () => {
    it('processes confirmed orders and filters out quotes, concepts and cancellations', async () => {
      const mockOrders: LogicTradeOrderHeader[] = [
        { id: 'ORD-001', orderNumber: '1001', status: 'CONFIRMED', createdDate: '2025-01-10T10:00:00Z' },
        { id: 'ORD-002', orderNumber: '1002', status: 'QUOTE', createdDate: '2025-01-11T10:00:00Z' },
        { id: 'ORD-003', orderNumber: '1003', status: 'CONCEPT', createdDate: '2025-01-12T10:00:00Z' },
        { id: 'ORD-004', orderNumber: '1004', status: 'CANCELLED', createdDate: '2025-01-13T10:00:00Z' },
        { id: 'ORD-005', orderNumber: '1005', status: 'DELIVERED', createdDate: '2025-01-14T10:00:00Z' },
      ];

      const mockLinesByOrder: Record<string, LogicTradeOrderLine[]> = {
        'ORD-001': [
          {
            id: 'L-1',
            orderId: 'ORD-001',
            articleCode: 'A-DUETTE-01',
            articleDescription: 'Duette AU20',
            quantity: 1,
            widthMm: 1200,
            heightMm: 1800,
          },
        ],
        'ORD-005': [
          {
            id: 'L-2',
            orderId: 'ORD-005',
            articleCode: 'A-HOR-01',
            articleDescription: 'Plisse Hordeur',
            quantity: 1,
            widthMm: 900,
            heightMm: 2100,
          },
        ],
      };

      const mockFetcher = vi.fn().mockImplementation(async (endpoint: string) => {
        if (endpoint.includes('/orders?') || endpoint.endsWith('/orders')) {
          return { data: mockOrders, totalPages: 1, currentPage: 1 };
        }
        for (const [orderId, lines] of Object.entries(mockLinesByOrder)) {
          if (endpoint.includes(`/orders/${orderId}/orderlines`)) {
            return { data: lines };
          }
        }
        return { data: [] };
      });

      const options: Harvest2YrOptions = {
        dryRun: true,
        // Mock custom fetcher/limiter adapter
        rateLimiter: {
          fetchWithAdaptiveBackoff: mockFetcher,
        },
      };

      const result = await harvest2YearOrders(options);

      // Only ORD-001 and ORD-005 should be processed
      expect(result.totalOrdersScanned).toBe(5);
      expect(result.totalOrderLinesProcessed).toBe(2);
      expect(result.uniqueArticlesFound).toBe(2);

      const codes = result.articles.map(a => a.articleCode);
      expect(codes).toContain('A-DUETTE-01');
      expect(codes).toContain('A-HOR-01');
    });

    it('filters out orders older than dateFrom', async () => {
      const mockOrders: LogicTradeOrderHeader[] = [
        { id: 'ORD-OLD', orderNumber: '900', status: 'CONFIRMED', createdDate: '2022-01-01T00:00:00Z' },
        { id: 'ORD-NEW', orderNumber: '901', status: 'CONFIRMED', createdDate: '2025-06-01T00:00:00Z' },
      ];

      const mockFetcher = vi.fn().mockImplementation(async (endpoint: string) => {
        if (endpoint.includes('/orders?') || endpoint.endsWith('/orders')) {
          return { data: mockOrders, totalPages: 1, currentPage: 1 };
        }
        if (endpoint.includes('/orders/ORD-NEW/orderlines')) {
          return {
            data: [
              {
                id: 'L-NEW',
                orderId: 'ORD-NEW',
                articleCode: 'A-NEW',
                articleDescription: 'Nieuw Artikel',
                quantity: 1,
              },
            ],
          };
        }
        return { data: [] };
      });

      const options: Harvest2YrOptions = {
        dateFrom: '2024-01-01T00:00:00Z',
        dryRun: true,
        rateLimiter: {
          fetchWithAdaptiveBackoff: mockFetcher,
        },
      };

      const result = await harvest2YearOrders(options);

      expect(result.uniqueArticlesFound).toBe(1);
      expect(result.articles[0].articleCode).toBe('A-NEW');
    });
  });

  describe('Deduplication & Orderline Aggregation', () => {
    it('aggregates multiple occurrences of the same articleCode across orders', async () => {
      const mockOrders: LogicTradeOrderHeader[] = [
        { id: 'O1', orderNumber: '1', status: 'CONFIRMED', createdDate: '2025-02-01T00:00:00Z' },
        { id: 'O2', orderNumber: '2', status: 'CONFIRMED', createdDate: '2025-02-02T00:00:00Z' },
      ];

      const mockLinesByOrder: Record<string, LogicTradeOrderLine[]> = {
        O1: [
          {
            id: 'L1',
            orderId: 'O1',
            articleCode: 'A-HZ-25',
            articleDescription: 'Houten Jaloezie 25mm',
            quantity: 2,
            widthMm: 1000,
            heightMm: 1500,
            options: [{ key: 'BEDIENINGS_TYPE', value: 'KOORD', description: 'Koordbediening' }],
          },
        ],
        O2: [
          {
            id: 'L2',
            orderId: 'O2',
            articleCode: 'A-HZ-25',
            articleDescription: 'Houten Jaloezie 25mm',
            quantity: 1,
            widthMm: 1400,
            heightMm: 2200,
            options: [
              { key: 'BEDIENINGS_TYPE', value: 'KOORD', description: 'Koordbediening' },
              { key: 'LADDERBAND', value: 'BAND_25MM', description: 'Ladderband 25mm' },
            ],
          },
        ],
      };

      const mockFetcher = vi.fn().mockImplementation(async (endpoint: string) => {
        if (endpoint.includes('/orders?') || endpoint.endsWith('/orders')) {
          return { data: mockOrders, totalPages: 1, currentPage: 1 };
        }
        for (const [orderId, lines] of Object.entries(mockLinesByOrder)) {
          if (endpoint.includes(`/orders/${orderId}/orderlines`)) {
            return { data: lines };
          }
        }
        return { data: [] };
      });

      const result = await harvest2YearOrders({
        dryRun: true,
        rateLimiter: { fetchWithAdaptiveBackoff: mockFetcher },
      });

      expect(result.uniqueArticlesFound).toBe(1);
      const article = result.articles[0];
      expect(article.articleCode).toBe('A-HZ-25');
      expect(article.historicalOccurrences).toBe(2);

      // Verify dimensions range calculation
      expect(article.observedDimensions).toEqual({
        minWidthMm: 1000,
        maxWidthMm: 1400,
        minHeightMm: 1500,
        maxHeightMm: 2200,
      });

      // Verify options frequency count
      const koordOpt = article.rawConfigurations.find(c => c.value === 'KOORD');
      expect(koordOpt).toBeDefined();
      expect(koordOpt?.count).toBe(2);

      const bandOpt = article.rawConfigurations.find(c => c.value === 'BAND_25MM');
      expect(bandOpt).toBeDefined();
      expect(bandOpt?.count).toBe(1);
    });

    it('filters out non-positive dimensions (widthMm <= 0) and ignores blank lines', async () => {
      const mockOrders: LogicTradeOrderHeader[] = [
        { id: 'O1', orderNumber: '1', status: 'CONFIRMED', createdDate: '2025-02-01T00:00:00Z' },
      ];

      const mockLines: LogicTradeOrderLine[] = [
        // Blank article line (comment row)
        {
          id: 'L0',
          orderId: 'O1',
          articleCode: '   ',
          articleDescription: 'Opmerking: levering via achteringang',
          quantity: 1,
        },
        // Real article with normal dimensions
        {
          id: 'L1',
          orderId: 'O1',
          articleCode: 'ART-VALID',
          articleDescription: 'Gordijnrail Wit',
          quantity: 1,
          widthMm: 2400,
          heightMm: 0, // No height
        },
        // Toeslagregel / zero measurement
        {
          id: 'L2',
          orderId: 'O1',
          articleCode: 'ART-VALID',
          articleDescription: 'Gordijnrail Wit Extra Beugel',
          quantity: 1,
          widthMm: 0,
          heightMm: 0,
        },
      ];

      const mockFetcher = vi.fn().mockImplementation(async (endpoint: string) => {
        if (endpoint.includes('/orders?') || endpoint.endsWith('/orders')) {
          return { data: mockOrders, totalPages: 1, currentPage: 1 };
        }
        return { data: mockLines };
      });

      const result = await harvest2YearOrders({
        dryRun: true,
        rateLimiter: { fetchWithAdaptiveBackoff: mockFetcher },
      });

      expect(result.uniqueArticlesFound).toBe(1);
      const article = result.articles[0];
      expect(article.articleCode).toBe('ART-VALID');
      expect(article.observedDimensions?.minWidthMm).toBe(2400);
      expect(article.observedDimensions?.maxWidthMm).toBe(2400);
      expect(article.observedDimensions?.minHeightMm).toBeUndefined();
    });

    it('safely handles malformed configurationJson without throwing', async () => {
      const mockOrders: LogicTradeOrderHeader[] = [
        { id: 'O1', orderNumber: '1', status: 'CONFIRMED', createdDate: '2025-02-01T00:00:00Z' },
      ];

      const mockLines: LogicTradeOrderLine[] = [
        {
          id: 'L1',
          orderId: 'O1',
          articleCode: 'ART-JSON-ERR',
          articleDescription: 'Test product met broken json',
          quantity: 1,
          configurationJson: '{ broken_json: true, invalid... }',
        },
      ];

      const mockFetcher = vi.fn().mockImplementation(async (endpoint: string) => {
        if (endpoint.includes('/orders?') || endpoint.endsWith('/orders')) {
          return { data: mockOrders, totalPages: 1, currentPage: 1 };
        }
        return { data: mockLines };
      });

      const result = await harvest2YearOrders({
        dryRun: true,
        rateLimiter: { fetchWithAdaptiveBackoff: mockFetcher },
      });

      expect(result.uniqueArticlesFound).toBe(1);
      expect(result.articles[0].articleCode).toBe('ART-JSON-ERR');
    });
  });

  describe('Resumable Checkpointing (State Sanitation & Zero Pollution)', () => {
    it('resumes from checkpointed page and skips already processed orders', async () => {
      const mockOrdersPage2: LogicTradeOrderHeader[] = [
        { id: 'O-ALREADY', orderNumber: '1', status: 'CONFIRMED', createdDate: '2025-03-01T00:00:00Z' },
        { id: 'O-FRESH', orderNumber: '2', status: 'CONFIRMED', createdDate: '2025-03-02T00:00:00Z' },
      ];

      const mockFetcher = vi.fn().mockImplementation(async (endpoint: string) => {
        if (endpoint.includes('/orders?') || endpoint.endsWith('/orders')) {
          return { data: mockOrdersPage2, totalPages: 2, currentPage: 2 };
        }
        if (endpoint.includes('/orders/O-FRESH/orderlines')) {
          return {
            data: [
              {
                id: 'LFRESH',
                orderId: 'O-FRESH',
                articleCode: 'ART-FRESH',
                articleDescription: 'Vers geoogst artikel',
                quantity: 1,
              },
            ],
          };
        }
        return { data: [] };
      });

      const result = await harvest2YearOrders({
        dryRun: true,
        // In-memory checkpoint state injection
        initialCheckpoint: {
          lastPage: 1,
          processedOrderIds: ['O-ALREADY'],
          aggregatedArticles: {},
        },
        rateLimiter: { fetchWithAdaptiveBackoff: mockFetcher },
      });

      // O-ALREADY should be skipped, only O-FRESH orderlines fetched
      expect(result.uniqueArticlesFound).toBe(1);
      expect(result.articles[0].articleCode).toBe('ART-FRESH');
      expect(mockFetcher).not.toHaveBeenCalledWith(expect.stringContaining('/orders/O-ALREADY/orderlines'));
    });
  });

  describe('Live LogicTrade Order & Comment Ingestion Enhancements', () => {
    it('processes orders with Dutch status Definitief (case-insensitive)', async () => {
      const mockOrders: LogicTradeOrderHeader[] = [
        {
          id: 'ORD-NL-1',
          orderNumber: '2025-001',
          status: 'Definitief',
          createdDate: '2025-04-01T12:00:00Z',
          lines: [
            {
              id: 'L-1',
              code: 'ART-HOR-01',
              description: 'Plissé Inzethor Wit',
              quantity: 1,
              widthMm: 800,
              heightMm: 1200,
            },
          ],
        },
        {
          id: 'ORD-NL-2',
          orderNumber: '2025-002',
          status: 'Niet definitief',
          createdDate: '2025-04-02T12:00:00Z',
          lines: [
            {
              id: 'L-2',
              code: 'ART-CONCEPT',
              description: 'Concept Regel',
              quantity: 1,
            },
          ],
        },
      ];

      const mockFetcher = vi.fn().mockResolvedValue({ data: mockOrders, totalPages: 1 });

      const result = await harvest2YearOrders({
        dryRun: true,
        rateLimiter: { fetchWithAdaptiveBackoff: mockFetcher },
      });

      expect(result.totalOrdersScanned).toBe(2);
      expect(result.totalOrderLinesProcessed).toBe(1);
      expect(result.uniqueArticlesFound).toBe(1);
      expect(result.articles[0].articleCode).toBe('ART-HOR-01');
    });

    it('ingests embedded order.lines directly without sub-fetching /orderlines', async () => {
      const mockOrders: LogicTradeOrderHeader[] = [
        {
          id: 'ORD-EMBEDDED',
          orderNumber: '3001',
          status: 'Definitief',
          createdDate: '2025-05-01T08:00:00Z',
          lines: [
            {
              id: 'L-EMB-1',
              code: 'A-DUETTE-SMART',
              description: 'Duette SmartCord 25mm',
              quantity: 1,
              widthMm: 1400,
              heightMm: 2000,
            },
          ],
        },
      ];

      const mockFetcher = vi.fn().mockImplementation(async (endpoint: string) => {
        if (endpoint.includes('/orders?') || endpoint.endsWith('/orders')) {
          return { data: mockOrders, totalPages: 1 };
        }
        if (endpoint.includes('/orderlines')) {
          throw new Error('Sub-fetch should not be called when order.lines is present');
        }
        return { data: [] };
      });

      const result = await harvest2YearOrders({
        dryRun: true,
        rateLimiter: { fetchWithAdaptiveBackoff: mockFetcher },
      });

      expect(result.totalOrderLinesProcessed).toBe(1);
      expect(result.articles[0].articleCode).toBe('A-DUETTE-SMART');
      // Sub-fetch never called
      expect(mockFetcher).toHaveBeenCalledTimes(1);
    });

    it('falls back to sub-fetching /orderlines if embedded lines array is missing or empty', async () => {
      const mockOrders: LogicTradeOrderHeader[] = [
        {
          id: 'ORD-NO-LINES',
          orderNumber: '4001',
          status: 'Definitief',
          createdDate: '2025-05-02T08:00:00Z',
          // lines missing or empty
          lines: [],
        },
      ];

      const mockFetcher = vi.fn().mockImplementation(async (endpoint: string) => {
        if (endpoint.includes('/orders?') || endpoint.endsWith('/orders')) {
          return { data: mockOrders, totalPages: 1 };
        }
        if (endpoint.includes('/orders/ORD-NO-LINES/orderlines')) {
          return {
            data: [
              {
                id: 'L-FALLBACK-1',
                articleCode: 'A-FALLBACK',
                articleDescription: 'Fallback Opgehaald Artikel',
                quantity: 1,
              },
            ],
          };
        }
        return { data: [] };
      });

      const result = await harvest2YearOrders({
        dryRun: true,
        rateLimiter: { fetchWithAdaptiveBackoff: mockFetcher },
      });

      expect(result.totalOrderLinesProcessed).toBe(1);
      expect(result.articles[0].articleCode).toBe('A-FALLBACK');
      expect(mockFetcher).toHaveBeenCalledTimes(2);
    });

    it('parses rich configurator options, plooien and dimensions from line.comment.extern', async () => {
      const mockOrders: LogicTradeOrderHeader[] = [
        {
          id: 'ORD-COMMENT-1',
          orderNumber: '5001',
          status: 'Definitief',
          createdDate: '2025-06-01T10:00:00Z',
          lines: [
            {
              id: 'L-GORDIJN-1',
              code: 'A-GORDIJN-MAATWERK',
              description: 'Inbetween Stof Lucca',
              quantity: 1,
              comment: {
                intern: 'Interne notitie voor atelier',
                extern: [
                  '- Kleur: 19',
                  '- Enkele retourplooi + Loodveter',
                  '- Montage op de dag',
                  '- afmeting 400 x 400',
                ].join('\n'),
              },
            },
          ],
        },
      ];

      const mockFetcher = vi.fn().mockResolvedValue({ data: mockOrders, totalPages: 1 });

      const result = await harvest2YearOrders({
        dryRun: true,
        rateLimiter: { fetchWithAdaptiveBackoff: mockFetcher },
      });

      expect(result.uniqueArticlesFound).toBe(1);
      const article = result.articles[0];
      expect(article.articleCode).toBe('A-GORDIJN-MAATWERK');

      // Check extracted dimensions from comment
      expect(article.observedDimensions).toEqual({
        minWidthMm: 400,
        maxWidthMm: 400,
        minHeightMm: 400,
        maxHeightMm: 400,
      });

      // Check extracted options
      const optLabels = article.orderOptions;
      expect(optLabels).toContain('Kleur: 19');
      expect(optLabels).toContain('Enkele retourplooi + Loodveter');
      expect(optLabels).toContain('Montage op de dag');

      const kleurConfig = article.rawConfigurations.find(c => c.key === 'Kleur');
      expect(kleurConfig).toBeDefined();
      expect(kleurConfig?.value).toBe('19');

      const plooiConfig = article.rawConfigurations.find(c => c.value === 'Enkele retourplooi + Loodveter');
      expect(plooiConfig).toBeDefined();

      const montageConfig = article.rawConfigurations.find(c => c.value === 'Montage op de dag');
      expect(montageConfig).toBeDefined();
    });

    it('prefers explicit numerical line dimensions over comment string dimensions', async () => {
      const mockOrders: LogicTradeOrderHeader[] = [
        {
          id: 'ORD-DIM-PRIORITY',
          orderNumber: '6001',
          status: 'Definitief',
          createdDate: '2025-06-02T10:00:00Z',
          lines: [
            {
              id: 'L-DIM-1',
              code: 'A-DUETTE-EXPLICIT',
              description: 'Duette Fix',
              quantity: 1,
              widthMm: 1200,
              heightMm: 1800,
              comment: {
                extern: '- afmeting 400 x 400\n- Kleur: Wit',
              },
            },
          ],
        },
      ];

      const mockFetcher = vi.fn().mockResolvedValue({ data: mockOrders, totalPages: 1 });

      const result = await harvest2YearOrders({
        dryRun: true,
        rateLimiter: { fetchWithAdaptiveBackoff: mockFetcher },
      });

      const article = result.articles[0];
      expect(article.observedDimensions).toEqual({
        minWidthMm: 1200,
        maxWidthMm: 1200,
        minHeightMm: 1800,
        maxHeightMm: 1800,
      });
      expect(article.orderOptions).toContain('Kleur: Wit');
    });

    it('handles line.comment as raw string safely without errors', async () => {
      const mockOrders: LogicTradeOrderHeader[] = [
        {
          id: 'ORD-STR-COMMENT',
          orderNumber: '7001',
          status: 'Definitief',
          createdDate: '2025-06-03T10:00:00Z',
          lines: [
            {
              id: 'L-STR-1',
              code: 'A-STR-PRODUCT',
              description: 'String Comment Product',
              quantity: 1,
              comment: '- Kleur: Antraciet\n- Montage in de dag' as any,
            },
          ],
        },
      ];

      const mockFetcher = vi.fn().mockResolvedValue({ data: mockOrders, totalPages: 1 });

      const result = await harvest2YearOrders({
        dryRun: true,
        rateLimiter: { fetchWithAdaptiveBackoff: mockFetcher },
      });

      expect(result.uniqueArticlesFound).toBe(1);
      expect(result.articles[0].orderOptions).toContain('Kleur: Antraciet');
      expect(result.articles[0].orderOptions).toContain('Montage in de dag');
    });
  });
});
