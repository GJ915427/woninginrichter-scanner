import {
  LogicTradeProductRaw,
  LogicTradeSuppliersEnvelope,
  SearchResultItem,
  SupplierBasic
} from '@/types/product';

export const KNOWN_NON_SUPPLIER_TOKENS = new Set([
  'duette', 'duettes', 'shades', 'shade', 'jaloezie', 'jaloezieen',
  'rolgordijn', 'rolgordijnen', 'gordijn', 'gordijnen', 'plisse',
  'tapijt', 'tapijten', 'vloer', 'vloerbedekking', 'pvc', 'vinyl',
  'laminaat', 'parket', 'raam', 'raamdecoratie', 'smartcord',
  'powerview', 'trufit', 'klemsteun', 'klemsteunen', 'antraciet',
  'au20', 'ab21', 'db42', 'vs2'
]);

export const DEFAULT_API_KEY = '621dcae6617349d0896d3ca9ba96d4b6';
export const DEFAULT_BASE_URL = 'https://api.logictrade.cloud/rest/v1';

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
    .replace(/[<>'\"`;()$]/g, '')
    .replace(/[®™]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Normaliseert tekst voor tolerante vergelijking (diakrieten en hoofdletters verwijderen).
 */
export function normalizeForComparison(str: string): string {
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
      if (t.length < 3 || KNOWN_NON_SUPPLIER_TOKENS.has(t)) continue;

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
    if (!KNOWN_NON_SUPPLIER_TOKENS.has(t)) {
      for (const s of suppliers) {
        const sNorm = normalizeForComparison(s.companyName);
        if (sNorm.startsWith(t) || (t.length >= 4 && sNorm.includes(t))) {
          matchedSupplier = s;
          return { matchedSupplier: s, searchTerm: query, productTokens: [] };
        }
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

export const DISCONTINUED_REGEX = /(?:uitlopende?\s+collectie|\buitlopend\b)/i;

/**
 * Berekent de deterministische relevantie-tier voor een artikel conform de Diamond-Grade Relevance Pyramid.
 * Tier 1: Configureerbare Hoofdproducten (+100)
 * Tier 2: Specifieke Productvarianten (Dakraam, Combi) (+50)
 * Tier 3: Accessoires & Onderdelen (Bedieningsstang, Klemsteun, Onderdeel) (+10)
 * Tier 4: Monsters, Stalen & Collectieboeken (-80)
 * Tier 5: Uitlopende collecties (-200)
 */
export function calculateProductRelevanceTier(
  name: string,
  description: string = '',
  isDiscontinued: boolean = false
): number {
  if (isDiscontinued || DISCONTINUED_REGEX.test(name) || DISCONTINUED_REGEX.test(description)) {
    return -200; // Tier 5: Uitlopende collecties altijd onderaan
  }
  const lowerName = name.toLowerCase();
  // Tier 4: Monsters, Stalen, Collectieboeken (-80)
  if (/\b(?:staal|stalen|service|monster|collectieboek|prijsklasse)\b/i.test(lowerName)) {
    return -80;
  }
  // Tier 3: Accessoires & Onderdelen (+10)
  if (/\b(?:bedieningsstang|stang|stangen|klemsteun|klemsteunen|steun|steunen|onderdeel|onderdelen|reparatieset)\b/i.test(lowerName)) {
    return 10;
  }
  // Tier 2: Specifieke Productvarianten (+50)
  if (/\b(?:dakraam|combi)\b/i.test(lowerName)) {
    return 50;
  }
  // Tier 1: Configureerbare Hoofdproducten (+100)
  return 100;
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

  const isDiscontinued = Boolean(
    (raw.description && DISCONTINUED_REGEX.test(raw.description)) ||
    (raw.name && DISCONTINUED_REGEX.test(raw.name))
  );

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
    vatCode: raw.vat?.description || 'BTW Hoog',
    ...(isDiscontinued ? { isDiscontinued: true } : {})
  };
}
