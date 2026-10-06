import { NextResponse } from 'next/server';
import {
  LogicTradeProductRaw,
  LogicTradeResponseEnvelope,
  LogicTradeSuppliersEnvelope,
  SearchResultItem,
  SearchApiResponse,
  SupplierBasic,
  LogicTradePagination
} from '@/types/product';

const DEFAULT_API_KEY = '621dcae6617349d0896d3ca9ba96d4b6';
const DEFAULT_BASE_URL = 'https://api.logictrade.cloud/rest/v1';

let cachedSuppliers: SupplierBasic[] | null = null;
let suppliersCacheExpiry = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 uur TTL

/**
 * Reset de leverancierscache (gebruikt voor tests en herinitialisatie).
 */
export function resetSuppliersCache(): void {
  cachedSuppliers = null;
  suppliersCacheExpiry = 0;
}

/**
 * Saniteert de zoekquery en verwijdert potentieel schadelijke tekens en diakrieten-ruis.
 */
export function sanitizeQuery(rawQuery: string): string {
  if (!rawQuery) return '';
  return rawQuery
    .trim()
    .replace(/[<>'"`;()$]/g, '')
    .replace(/[®™]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Normaliseert tekst voor tolerante vergelijking (diakrieten en hoofdletters verwijderen).
 */
function normalizeForComparison(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Haalt de leverancierslijst (330 leveranciers) op uit LogicTrade en bewaart deze in een in-memory cache.
 */
export async function getSuppliersCache(forceRefresh = false): Promise<SupplierBasic[]> {
  const now = Date.now();
  if (!forceRefresh && cachedSuppliers && now < suppliersCacheExpiry) {
    return cachedSuppliers;
  }

  const apiKey = process.env.LOGICTRADE_API_KEY || DEFAULT_API_KEY;
  const baseUrl = (process.env.LOGICTRADE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const adminGuid = process.env.LOGICTRADE_ADMIN_GUID;

  const headers: Record<string, string> = {
    'api-key': apiKey,
    'Accept': 'application/json'
  };
  if (adminGuid) {
    headers['administration-guid'] = adminGuid;
  }

  try {
    const allSuppliers: SupplierBasic[] = [];
    let page = 1;
    let totalPages = 1;

    // Haal gepagineerd alle leveranciers op
    do {
      const url = `${baseUrl}/suppliers?pageNumber=${page}&pageSize=100`;
      const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
      if (!res.ok) {
        break;
      }
      const data = (await res.json()) as LogicTradeSuppliersEnvelope;
      if (data.results && Array.isArray(data.results)) {
        for (const s of data.results) {
          if (s && s.companyName) {
            allSuppliers.push({
              id: s.id,
              number: s.number || '',
              companyName: s.companyName.trim()
            });
          }
        }
      }
      totalPages = data.pagination?.totalPages || 1;
      page++;
    } while (page <= totalPages && page <= 5);

    if (allSuppliers.length > 0) {
      cachedSuppliers = allSuppliers;
      suppliersCacheExpiry = now + CACHE_TTL_MS;
      return cachedSuppliers;
    }
  } catch (err: any) {
    console.warn('[BFF] Fout bij ophalen LogicTrade leverancierscache:', err?.message || err);
    if (forceRefresh) {
      cachedSuppliers = null;
    }
  }

  return cachedSuppliers || [];
}

export interface ParsedQuery {
  matchedSupplier: SupplierBasic | null;
  searchTerm: string;
  productTokens: string[];
}

/**
 * Analyseert de zoekstring en detecteert of er een bekende leverancier in de zoekopdracht voorkomt,
 * ongeacht de woordvolgorde.
 */
export function parseMultiTokenQuery(query: string, suppliers: SupplierBasic[]): ParsedQuery {
  const normQuery = normalizeForComparison(query);
  if (!normQuery) {
    return { matchedSupplier: null, searchTerm: query, productTokens: [] };
  }

  const rawTokens = query.trim().split(/\s+/).filter(Boolean);
  const normTokens = normQuery.split(/\s+/).filter(Boolean);

  let matchedSupplier: SupplierBasic | null = null;
  const remainingRaw = [...rawTokens];

  // 1. Exacte match op volledige naam van een leverancier
  for (const s of suppliers) {
    const sNorm = normalizeForComparison(s.companyName);
    if (sNorm && normQuery === sNorm) {
      return { matchedSupplier: s, searchTerm: query, productTokens: [] };
    }
    if (sNorm && normQuery.includes(sNorm)) {
      matchedSupplier = s;
      const regex = new RegExp(s.companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const rem = query.replace(regex, '').trim();
      const remTokens = rem.split(/\s+/).filter(Boolean);
      return { matchedSupplier: s, searchTerm: rem || query, productTokens: remTokens };
    }
  }

  // 2. Token-gebaseerde prefix match (ongeacht positie)
  if (normTokens.length > 1) {
    for (let i = 0; i < normTokens.length; i++) {
      const t = normTokens[i];
      if (t.length < 3) continue;

      for (const s of suppliers) {
        const sNorm = normalizeForComparison(s.companyName);
        if (sNorm.startsWith(t) || (t.length >= 4 && sNorm.includes(t))) {
          matchedSupplier = s;
          remainingRaw.splice(i, 1);
          break;
        }
      }
      if (matchedSupplier) break;
    }
  } else if (normTokens.length === 1 && normTokens[0].length >= 3) {
    const t = normTokens[0];
    for (const s of suppliers) {
      const sNorm = normalizeForComparison(s.companyName);
      if (sNorm.startsWith(t) || (t.length >= 4 && sNorm.includes(t))) {
        matchedSupplier = s;
        return { matchedSupplier: s, searchTerm: query, productTokens: [] };
      }
    }
  }

  const searchTerm = remainingRaw.length > 0 ? remainingRaw.join(' ') : query;
  const productTokens = matchedSupplier ? remainingRaw : rawTokens;

  return {
    matchedSupplier,
    searchTerm,
    productTokens
  };
}

/**
 * Normaliseert een ruw LogicTrade product naar het strakke SearchResultItem contract.
 */
export function normalizeProduct(raw: LogicTradeProductRaw): SearchResultItem {
  const groupDescriptions = (raw.groups || [])
    .map(g => g.description)
    .filter(Boolean);

  const supplierName =
    raw.supplier?.supplier?.companyName ||
    raw.supplier?.description ||
    'Onbekende leverancier';

  const supplierId = raw.supplier?.supplier?.id ?? null;

  return {
    id: raw.id,
    code: raw.code || '',
    name: raw.name || '',
    unit: raw.unit || 'stuks',
    salesPrice: typeof raw.salesPrice === 'number' ? raw.salesPrice : 0,
    salesGroup: raw.salesGroup?.description || 'Algemeen',
    supplierName,
    supplierId,
    groups: groupDescriptions,
    vatCode: raw.vat?.description || 'BTW Hoog'
  };
}

interface FetchResult {
  products: LogicTradeProductRaw[];
  pagination?: LogicTradePagination;
}

/**
 * Voert een zoekopdracht uit tegen de LogicTrade Cloud REST API.
 */
async function fetchFromLogicTrade(
  paramKey: 'code' | 'name',
  queryValue: string,
  apiKey: string,
  baseUrl: string,
  adminGuid?: string
): Promise<FetchResult> {
  const url = `${baseUrl}/products?${paramKey}=${encodeURIComponent(queryValue)}&pageSize=20`;

  const headers: Record<string, string> = {
    'api-key': apiKey,
    'Accept': 'application/json'
  };

  if (adminGuid) {
    headers['administration-guid'] = adminGuid;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store'
  });

  if (!response.ok) {
    if (response.status === 429) {
      const err = new Error('LogicTrade Cloud API rate limit bereikt (te veel verzoeken). Probeer het over enkele seconden opnieuw.');
      (err as any).status = 429;
      throw err;
    }
    const err = new Error(`LogicTrade API fout: HTTP ${response.status} ${response.statusText}`);
    (err as any).status = response.status;
    throw err;
  }

  const envelope = (await response.json()) as LogicTradeResponseEnvelope;
  return {
    products: envelope.results || [],
    pagination: envelope.pagination
  };
}

/**
 * Next.js GET Route Handler: /api/products/search?q={query}
 */
export async function GET(request: Request): Promise<NextResponse<SearchApiResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('q') || '';
    const cleanQuery = sanitizeQuery(rawQuery);

    if (cleanQuery.length < 2) {
      return NextResponse.json(
        {
          success: false,
          query: rawQuery,
          count: 0,
          items: [],
          error: 'Zoekopdracht moet minimaal 2 karakters bevatten.'
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.LOGICTRADE_API_KEY || DEFAULT_API_KEY;
    const baseUrl = (process.env.LOGICTRADE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const adminGuid = process.env.LOGICTRADE_ADMIN_GUID;

    // Leveranciers ophalen voor multi-token herkenning
    const suppliers = await getSuppliersCache();
    const { matchedSupplier, searchTerm, productTokens } = parseMultiTokenQuery(cleanQuery, suppliers);

    // Parallel bevragen op artikelcode, omschrijving en eventuele leveranciersterm
    const requests = [
      fetchFromLogicTrade('code', cleanQuery, apiKey, baseUrl, adminGuid),
      fetchFromLogicTrade('name', searchTerm, apiKey, baseUrl, adminGuid)
    ];

    if (searchTerm !== cleanQuery) {
      requests.push(fetchFromLogicTrade('name', cleanQuery, apiKey, baseUrl, adminGuid));
    }

    const results = await Promise.allSettled(requests);

    const successfulResults: FetchResult[] = [];
    let rateLimitError: Error | null = null;

    for (const res of results) {
      if (res.status === 'fulfilled') {
        successfulResults.push(res.value);
      } else if ((res.reason as any)?.status === 429) {
        rateLimitError = res.reason;
      }
    }

    // Foutafhandeling indien alle verzoeken faalden
    if (successfulResults.length === 0) {
      if (rateLimitError) {
        return NextResponse.json(
          {
            success: false,
            query: cleanQuery,
            count: 0,
            items: [],
            error: rateLimitError.message
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          query: cleanQuery,
          count: 0,
          items: [],
          error: 'Fout bij het raadplegen van LogicTrade Cloud API.'
        },
        { status: 502 }
      );
    }

    const allRaw: LogicTradeProductRaw[] = [];
    let maxTotalResults = 0;
    let maxTotalPages = 1;

    for (const r of successfulResults) {
      allRaw.push(...r.products);
      if (r.pagination?.totalResults && r.pagination.totalResults > maxTotalResults) {
        maxTotalResults = r.pagination.totalResults;
        maxTotalPages = r.pagination.totalPages;
      }
    }

    // Dedupliceren op uniek product ID
    const uniqueMap = new Map<number, LogicTradeProductRaw>();
    for (const prod of allRaw) {
      if (!uniqueMap.has(prod.id)) {
        uniqueMap.set(prod.id, prod);
      }
    }

    const normalizedCandidates = Array.from(uniqueMap.values()).map(normalizeProduct);
    const sTarget = matchedSupplier ? normalizeForComparison(matchedSupplier.companyName) : '';
    const normProductTokens = productTokens.map(normalizeForComparison).filter(t => t.length >= 2);

    // Strikte Conjunctieve (AND) Filterpoort
    const conjunctiveItems = normalizedCandidates.filter((item) => {
      // 1. Harde leveranciersisolatie met Empty-String Guard
      if (matchedSupplier && sTarget) {
        const itemSupplier = normalizeForComparison(item.supplierName);
        const itemGroups = item.groups.map(normalizeForComparison);

        const matchesSupplier =
          Boolean(itemSupplier) &&
          (itemSupplier.includes(sTarget) ||
            (itemSupplier.length >= 3 && sTarget.includes(itemSupplier)) ||
            itemGroups.some((g) => g.includes(sTarget)));

        if (!matchesSupplier) {
          return false; // Verwerp artikelen van concurrerende leveranciers
        }
      }

      // 2. Harde token-dekking: alle overige productTokens moeten voorkomen (inclusief supplierName!)
      if (normProductTokens.length > 0) {
        const itemContext = normalizeForComparison(
          `${item.code} ${item.name} ${item.salesGroup} ${item.supplierName} ${item.groups.join(' ')}`
        );

        for (const token of normProductTokens) {
          if (!itemContext.includes(token)) {
            return false;
          }
        }
      }

      return true;
    });

    // Rangschikken van de gefilterde set (exacte code match > naam match > alfabetisch)
    const normTarget = normalizeForComparison(cleanQuery);
    const normTerm = normalizeForComparison(searchTerm);

    const sortedItems = conjunctiveItems
      .sort((a, b) => {
        const aCodeExact = normalizeForComparison(a.code) === normTarget;
        const bCodeExact = normalizeForComparison(b.code) === normTarget;
        if (aCodeExact && !bCodeExact) return -1;
        if (!aCodeExact && bCodeExact) return 1;

        const aNameExact = normalizeForComparison(a.name) === normTarget || normalizeForComparison(a.name) === normTerm;
        const bNameExact = normalizeForComparison(b.name) === normTarget || normalizeForComparison(b.name) === normTerm;
        if (aNameExact && !bNameExact) return -1;
        if (!aNameExact && bNameExact) return 1;

        return a.name.localeCompare(b.name);
      })
      .slice(0, 25);

    // Paginatie Metadata Sanitatie
    let totalResults = 0;
    let totalPages = 0;
    let hasMore = false;

    if (sortedItems.length > 0) {
      const wereItemsFilteredOut = conjunctiveItems.length < normalizedCandidates.length;
      if (wereItemsFilteredOut) {
        totalResults = conjunctiveItems.length;
        totalPages = Math.ceil(totalResults / 20);
        hasMore = totalResults > 20;
      } else {
        totalResults = Math.max(maxTotalResults, conjunctiveItems.length);
        totalPages = Math.max(maxTotalPages, Math.ceil(totalResults / 20));
        hasMore = totalResults > conjunctiveItems.length;
      }
    }

    return NextResponse.json({
      success: true,
      query: cleanQuery,
      count: sortedItems.length,
      items: sortedItems,
      pagination: {
        page: 1,
        pageSize: 20,
        totalResults,
        totalPages,
        hasMore
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        query: '',
        count: 0,
        items: [],
        error: error.message || 'Interne serverfout bij zoeken in artikelstambestand.'
      },
      { status: error.status || 500 }
    );
  }
}
