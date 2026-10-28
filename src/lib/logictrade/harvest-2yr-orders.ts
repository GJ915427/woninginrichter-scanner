import * as fs from 'fs';
import * as path from 'path';
import { defaultRateLimiter, RateLimiter } from './rate-limiter';
import { HarvestedRawArticle } from '@/domain/search/v2/cognitive-typology-classifier';

export const DEFAULT_HARVEST_STATUSES = [
  'CONFIRMED',
  'ORDER',
  'DELIVERED',
  'CLOSED',
  'DEFINITIEF',
] as const;

export interface LogicTradeOrderHeader {
  id: string | number;
  orderNumber: string;
  status: string; // e.g. 'CONFIRMED', 'ORDER', 'DELIVERED', 'CLOSED', 'Definitief'
  createdDate: string; // ISO string
  totalAmount?: number;
  origin?: string | { id?: number | string; code?: string; description?: string; [key: string]: unknown };
  lines?: LogicTradeOrderLine[];
  orderLines?: LogicTradeOrderLine[];
}

export interface LogicTradeOrderLine {
  id: string | number;
  orderId?: string | number;
  articleCode?: string;
  articleDescription?: string;
  code?: string;
  description?: string;
  quantity?: number;
  supplierName?: string;
  configurationJson?: string;
  options?: Array<{ key: string; value: string; description?: string; surcharge?: number }>;
  widthMm?: number;
  heightMm?: number;
  comment?: { intern?: string; extern?: string } | string | null;
  partPrice?: number;
  linePrice?: number;
  orderNumber?: string;
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
  originFilter?: string | string[];
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
 * Parset gestructureerde CPQ-opties en afmetingen uit orderregel-commentaren
 * (zowel line.comment.extern als line.comment.intern of directe string).
 */
export function parseCommentExtern(comment?: { intern?: string; extern?: string } | string | null): {
  options: Array<{ key: string; value: string; label?: string }>;
  dimensions?: { widthMm?: number; heightMm?: number };
} {
  const result: {
    options: Array<{ key: string; value: string; label?: string }>;
    dimensions?: { widthMm?: number; heightMm?: number };
  } = { options: [] };

  if (!comment) return result;

  const textChunks: string[] = [];
  if (typeof comment === 'string') {
    textChunks.push(comment);
  } else if (typeof comment === 'object') {
    if (typeof comment.extern === 'string' && comment.extern.trim()) {
      textChunks.push(comment.extern);
    }
    if (typeof comment.intern === 'string' && comment.intern.trim()) {
      textChunks.push(comment.intern);
    }
  }

  for (const chunk of textChunks) {
    const rawLines = chunk.split(/\r?\n/);
    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      // Extract bullet points: lines starting with '- ' or '* ' or '• '
      const isBullet = /^[-*•]\s+/.test(trimmed);
      const cleanLine = trimmed.replace(/^[-*•]\s+/, '').trim();
      if (!cleanLine) continue;

      // 1. Dimension detection: e.g. "afmeting 400 x 400" or "400 x 400" or "1200x1800"
      const dimMatch = cleanLine.match(/(?:(?:afmeting(?:en)?|maat|afm\.?)\s*:?\s*)?(\d{2,5})\s*(?:mm)?\s*[xX*]\s*(\d{2,5})\s*(?:mm)?/i);
      if (dimMatch && !result.dimensions) {
        const w = parseInt(dimMatch[1], 10);
        const h = parseInt(dimMatch[2], 10);
        if (w > 0 && h > 0) {
          result.dimensions = { widthMm: w, heightMm: h };
        }
      }

      // 2. Structured option detection:
      // Pattern A: "Key: Value" (e.g. "- Kleur: 19", "- Bediening: SmartCord")
      const kvMatch = cleanLine.match(/^([^:]+):\s*(.+)$/);
      if (kvMatch) {
        const k = kvMatch[1].trim();
        const v = kvMatch[2].trim();
        if (/^(?:afmeting|maat|afm)/i.test(k)) {
          continue;
        }
        if (k && v) {
          result.options.push({
            key: k,
            value: v,
            label: `${k}: ${v}`,
          });
          continue;
        }
      }

      // Pattern B: Bulleted CPQ choices without explicit colon
      if (isBullet) {
        if (/^(?:afmeting|maat)\b/i.test(cleanLine) || /^\d{2,5}\s*[xX*]\s*\d{2,5}$/.test(cleanLine)) {
          continue;
        }

        let key = 'Optie';
        if (/plooi|retourplooi|vlinderplooi|wave/i.test(cleanLine)) {
          key = 'Plooi';
        } else if (/montage|monteren|in de dag|op de dag/i.test(cleanLine)) {
          key = 'Montage';
        } else if (/gaas|hor/i.test(cleanLine)) {
          key = 'Gaas';
        } else if (/bediening|koord|ketting|motor|smartcord/i.test(cleanLine)) {
          key = 'Bediening';
        }

        result.options.push({
          key,
          value: cleanLine,
          label: cleanLine,
        });
      }
    }
  }

  return result;
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

      // Check origin / herkomst filter (indien geconfigureerd)
      if (options.originFilter) {
        const filters = (Array.isArray(options.originFilter) ? options.originFilter : [options.originFilter])
          .map(f => f.trim().toUpperCase())
          .filter(Boolean);

        if (filters.length > 0) {
          let rawOrigin = '';
          if (typeof order.origin === 'string') {
            rawOrigin = order.origin;
          } else if (order.origin && typeof order.origin === 'object') {
            rawOrigin = order.origin.code || order.origin.description || '';
          }
          const normOrigin = rawOrigin.trim().toUpperCase();
          if (!normOrigin || !filters.includes(normOrigin)) {
            continue;
          }
        }
      }

      // Sla reeds verwerkte sub-orders over bij hervatting
      if (processedOrderSet.has(orderIdStr)) {
        continue;
      }

      // Haal orderregels op voor deze order:
      // Geef voorrang aan reeds embedded order.lines (N+1 HTTP eliminatie)
      let lines: LogicTradeOrderLine[] = [];
      const embeddedLines = (order as any).lines ?? (order as any).orderLines;
      if (Array.isArray(embeddedLines)) {
        lines = embeddedLines;
      } else {
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

        lines = Array.isArray(linesEnvelope)
          ? linesEnvelope
          : linesEnvelope?.data || linesEnvelope?.results || [];
      }

      totalOrderLinesProcessed += lines.length;

      for (const line of lines) {
        // Ondersteun zowel articleCode als code alias
        const rawCode = (line.articleCode || line.code || '').trim();
        // Skip lege regels of commentaarregels zonder code
        if (!rawCode) {
          continue;
        }

        // Ondersteun articleDescription of description alias
        const rawDescription = (line.articleDescription || line.description || rawCode).trim();

        // Parseer opties en afmetingen uit line.comment (extern & intern)
        const commentParsed = parseCommentExtern(line.comment);

        // Dimensies: expliciete positieve waarden op de regel hebben absolute voorrang
        let w = typeof line.widthMm === 'number' && line.widthMm > 0 ? line.widthMm : undefined;
        let h = typeof line.heightMm === 'number' && line.heightMm > 0 ? line.heightMm : undefined;

        if (w === undefined && commentParsed.dimensions?.widthMm) {
          w = commentParsed.dimensions.widthMm;
        }
        if (h === undefined && commentParsed.dimensions?.heightMm) {
          h = commentParsed.dimensions.heightMm;
        }

        // Extraheer opties uit commentaar, gestructureerde array en configurationJson
        const lineOptions: Array<{ key: string; value: string; label?: string; surcharge?: number }> = [];

        // 1. Commentaar opties toevoegen
        for (const cOpt of commentParsed.options) {
          lineOptions.push({
            key: cOpt.key,
            value: cOpt.value,
            label: cOpt.label || `${cOpt.key}: ${cOpt.value}`,
          });
        }

        // 2. Gestructureerde opties
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

        // 3. ConfigurationJson
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
            articleName: rawDescription,
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
