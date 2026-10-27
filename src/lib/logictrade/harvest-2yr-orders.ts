import * as fs from 'fs';
import * as path from 'path';
import { defaultRateLimiter, RateLimiter } from './rate-limiter';
import { HarvestedRawArticle } from '@/domain/search/v2/cognitive-typology-classifier';

export const DEFAULT_HARVEST_STATUSES = [
  'CONFIRMED',
  'ORDER',
  'DELIVERED',
  'CLOSED',
] as const;

export interface LogicTradeOrderHeader {
  id: string | number;
  orderNumber: string;
  status: string; // e.g. 'CONFIRMED', 'ORDER', 'DELIVERED', 'CLOSED'
  createdDate: string; // ISO string
  totalAmount?: number;
}

export interface LogicTradeOrderLine {
  id: string | number;
  orderId: string | number;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  supplierName?: string;
  configurationJson?: string;
  options?: Array<{ key: string; value: string; description?: string; surcharge?: number }>;
  widthMm?: number;
  heightMm?: number;
}

export interface HarvestCheckpoint {
  lastPage: number;
  processedOrderIds: string[];
  aggregatedArticles?: Record<string, HarvestedRawArticle>;
}

export interface Harvest2YrOptions {
  dateFrom?: string; // ISO date string, defaults to 2 years before now
  pageSize?: number;
  checkpointFilePath?: string;
  statusFilter?: string[];
  dryRun?: boolean;
  rateLimiter?: any;
  baseUrl?: string;
  apiKey?: string;
  adminGuid?: string;
  initialCheckpoint?: HarvestCheckpoint;
}

export interface Harvest2YrResult {
  totalOrdersScanned: number;
  totalOrderLinesProcessed: number;
  uniqueArticlesFound: number;
  articles: HarvestedRawArticle[];
  checkpointSaved: boolean;
}

/**
 * Haalt geconfigureerde orderregels van de afgelopen 2 jaar op uit LogicTrade REST API.
 * Filtert op geldige orderstatussen, aggregeert unieke artikelen en configuratieopties,
 * en berekent empirische maatvoeringen met uitsluiting van niet-positieve maten.
 */
export async function harvest2YearOrders(options: Harvest2YrOptions = {}): Promise<Harvest2YrResult> {
  const apiKey = options.apiKey || process.env.LOGICTRADE_API_KEY || '621dcae6617349d0896d3ca9ba96d4b6';
  const baseUrl = (options.baseUrl || process.env.LOGICTRADE_BASE_URL || 'https://api.logictrade.cloud/rest/v1').replace(/\/+$/, '');
  const adminGuid = options.adminGuid || process.env.LOGICTRADE_ADMIN_GUID;
  const pageSize = options.pageSize || 50;
  const limiter = options.rateLimiter || defaultRateLimiter;

  // Bereken standaard datum: 2 jaar voor heden
  const twoYearsAgoMs = 2 * 365.25 * 24 * 60 * 60 * 1000;
  const defaultDateFrom = new Date(Date.now() - twoYearsAgoMs).toISOString();
  const dateFrom = options.dateFrom || defaultDateFrom;
  const dateFromTime = new Date(dateFrom).getTime();

  // Status whitelist
  const allowedStatuses = (options.statusFilter || DEFAULT_HARVEST_STATUSES).map(s => s.toUpperCase());

  // Checkpoint administratie
  const checkpoint: HarvestCheckpoint = options.initialCheckpoint || {
    lastPage: 0,
    processedOrderIds: [],
    aggregatedArticles: {},
  };

  const processedOrderSet = new Set<string>(checkpoint.processedOrderIds.map(String));
  const aggregatedArticles: Record<string, HarvestedRawArticle> = checkpoint.aggregatedArticles || {};

  let totalOrdersScanned = 0;
  let totalOrderLinesProcessed = 0;

  const headers: Record<string, string> = {
    'api-key': apiKey,
    Accept: 'application/json',
  };
  if (adminGuid) {
    headers['administration-guid'] = adminGuid;
  }

  let currentPage = checkpoint.lastPage + 1;
  let hasMorePages = true;

  while (hasMorePages) {
    const ordersUrl = `${baseUrl}/orders?pageSize=${pageSize}&pageNumber=${currentPage}&createdAfter=${encodeURIComponent(dateFrom)}`;
    const res = await limiter.fetchWithAdaptiveBackoff(ordersUrl, { headers, cache: 'no-store' });

    let envelope: any;
    if (res && typeof res.json === 'function') {
      if (!res.ok) {
        console.error(`[Harvest2YrOrders] Fout bij ophalen pagina ${currentPage} (HTTP ${res.status}).`);
        break;
      }
      envelope = await res.json();
    } else {
      envelope = res;
    }

    const orders: LogicTradeOrderHeader[] = Array.isArray(envelope)
      ? envelope
      : envelope?.data || envelope?.results || [];

    if (!orders || orders.length === 0) {
      hasMorePages = false;
      break;
    }

    totalOrdersScanned += orders.length;

    for (const order of orders) {
      const orderIdStr = String(order.id);

      // Check datumgrens
      if (order.createdDate) {
        const orderTime = new Date(order.createdDate).getTime();
        if (!isNaN(orderTime) && orderTime < dateFromTime) {
          continue;
        }
      }

      // Check status filter
      const statusUpper = (order.status || '').toUpperCase();
      if (!allowedStatuses.includes(statusUpper)) {
        continue;
      }

      // Sla reeds verwerkte sub-orders over bij hervatting
      if (processedOrderSet.has(orderIdStr)) {
        continue;
      }

      // Haal orderregels op voor deze order
      const linesUrl = `${baseUrl}/orders/${encodeURIComponent(orderIdStr)}/orderlines`;
      const linesRes = await limiter.fetchWithAdaptiveBackoff(linesUrl, { headers, cache: 'no-store' });

      let linesEnvelope: any;
      if (linesRes && typeof linesRes.json === 'function') {
        if (!linesRes.ok) {
          console.warn(`[Harvest2YrOrders] Kon orderregels voor order ${orderIdStr} niet ophalen (HTTP ${linesRes.status}).`);
          continue;
        }
        linesEnvelope = await linesRes.json();
      } else {
        linesEnvelope = linesRes;
      }

      const lines: LogicTradeOrderLine[] = Array.isArray(linesEnvelope)
        ? linesEnvelope
        : linesEnvelope?.data || linesEnvelope?.results || [];

      totalOrderLinesProcessed += lines.length;

      for (const line of lines) {
        const rawCode = (line.articleCode || '').trim();
        // Skip lege regels of commentaarregels zonder code
        if (!rawCode) {
          continue;
        }

        const w = typeof line.widthMm === 'number' && line.widthMm > 0 ? line.widthMm : undefined;
        const h = typeof line.heightMm === 'number' && line.heightMm > 0 ? line.heightMm : undefined;

        // Extraheer opties uit gestructureerde array of configurationJson
        const lineOptions: Array<{ key: string; value: string; label?: string; surcharge?: number }> = [];

        if (Array.isArray(line.options)) {
          for (const opt of line.options) {
            lineOptions.push({
              key: opt.key,
              value: opt.value,
              label: opt.description || opt.value,
              surcharge: opt.surcharge,
            });
          }
        }

        if (line.configurationJson) {
          try {
            const parsed = JSON.parse(line.configurationJson);
            if (parsed && typeof parsed === 'object') {
              for (const [k, v] of Object.entries(parsed)) {
                if (typeof v === 'string' || typeof v === 'number') {
                  lineOptions.push({
                    key: k,
                    value: String(v),
                    label: String(v),
                  });
                }
              }
            }
          } catch {
            // Malformed configurationJson veilig negeren
          }
        }

        // Aggregeer artikel
        if (!aggregatedArticles[rawCode]) {
          aggregatedArticles[rawCode] = {
            articleCode: rawCode,
            articleName: (line.articleDescription || rawCode).trim(),
            supplierName: line.supplierName,
            orderOptions: [],
            rawConfigurations: [],
            historicalOccurrences: 0,
            firstSeen: order.createdDate,
            lastSeen: order.createdDate,
          };
        }

        const art = aggregatedArticles[rawCode];
        art.historicalOccurrences += 1;
        if (order.createdDate) {
          if (!art.firstSeen || order.createdDate < art.firstSeen) art.firstSeen = order.createdDate;
          if (!art.lastSeen || order.createdDate > art.lastSeen) art.lastSeen = order.createdDate;
        }

        // Dimensie-aggregatie (alleen strikt positieve waarden)
        if (w !== undefined || h !== undefined) {
          if (!art.observedDimensions) {
            art.observedDimensions = {
              minWidthMm: w !== undefined ? w : (undefined as any),
              maxWidthMm: w !== undefined ? w : (undefined as any),
              minHeightMm: h !== undefined ? h : (undefined as any),
              maxHeightMm: h !== undefined ? h : (undefined as any),
            };
          } else {
            if (w !== undefined) {
              art.observedDimensions.minWidthMm =
                art.observedDimensions.minWidthMm !== undefined
                  ? Math.min(art.observedDimensions.minWidthMm, w)
                  : w;
              art.observedDimensions.maxWidthMm =
                art.observedDimensions.maxWidthMm !== undefined
                  ? Math.max(art.observedDimensions.maxWidthMm, w)
                  : w;
            }
            if (h !== undefined) {
              art.observedDimensions.minHeightMm =
                art.observedDimensions.minHeightMm !== undefined
                  ? Math.min(art.observedDimensions.minHeightMm, h)
                  : h;
              art.observedDimensions.maxHeightMm =
                art.observedDimensions.maxHeightMm !== undefined
                  ? Math.max(art.observedDimensions.maxHeightMm, h)
                  : h;
            }
          }
        }

        // Opties dedupliceren & tellen
        for (const opt of lineOptions) {
          const existing = art.rawConfigurations.find(
            c => c.key === opt.key && c.value === opt.value
          );
          if (existing) {
            existing.count = (existing.count || 1) + 1;
          } else {
            art.rawConfigurations.push({
              key: opt.key,
              value: opt.value,
              label: opt.label,
              surcharge: opt.surcharge,
              count: 1,
            });
          }

          if (opt.label && !art.orderOptions.includes(opt.label)) {
            art.orderOptions.push(opt.label);
          }
        }
      }

      processedOrderSet.add(orderIdStr);
    }

    checkpoint.lastPage = currentPage;
    checkpoint.processedOrderIds = Array.from(processedOrderSet);

    // Persisteer checkpoint defensief indien niet dryRun en pad geconfigureerd
    if (!options.dryRun && options.checkpointFilePath) {
      try {
        const dir = path.dirname(options.checkpointFilePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(options.checkpointFilePath, JSON.stringify(checkpoint, null, 2), 'utf-8');
      } catch (err: any) {
        console.warn(`[Harvest2YrOrders] Kon checkpoint niet wegschrijven: ${err.message}`);
      }
    }

    const totalPages = envelope?.totalPages || 1;
    if (currentPage >= totalPages) {
      hasMorePages = false;
    } else {
      currentPage++;
    }
  }

  const articles = Object.values(aggregatedArticles);

  return {
    totalOrdersScanned,
    totalOrderLinesProcessed,
    uniqueArticlesFound: articles.length,
    articles,
    checkpointSaved: !options.dryRun && !!options.checkpointFilePath,
  };
}
