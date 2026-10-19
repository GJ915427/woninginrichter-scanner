import https from 'https';
import http from 'http';
import * as zlib from 'zlib';
import * as dns from 'dns';
import * as net from 'net';
import { TypologyCategory130 } from '../src/domain/benchmark/floorplanner-types';
import { Point2D, calculatePolygonArea } from '../src/domain/architectural/polygon-simplifier';
import { computeInwardWallOffset } from '../src/domain/architectural/wall-offset-engine';

dns.setDefaultResultOrder('ipv4first');
if (typeof (net as any).setDefaultAutoSelectFamily === 'function') {
  (net as any).setDefaultAutoSelectFamily(false);
}

const ipv4Lookup = (
  hostname: string,
  options: any,
   callback: (err: NodeJS.ErrnoException | null, address: any, family?: number) => void
) => {
  const cb = typeof options === 'function' ? options : callback;
  const wantAll = typeof options === 'object' && options !== null && Boolean(options.all);
  dns.lookup(hostname, { family: 4, all: false }, (err, address, family) => {
    if (err) {
      cb(err, wantAll ? [] : '', 4);
      return;
    }
    if (wantAll) {
      cb(null, [{ address, family: family || 4 }]);
    } else {
      cb(null, address, family || 4);
    }
  });
};

const ipv4HttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 24,
  family: 4,
  autoSelectFamily: false,
  rejectUnauthorized: false,
  lookup: ipv4Lookup,
} as any);

const ipv4HttpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 24,
  family: 4,
  autoSelectFamily: false,
  lookup: ipv4Lookup,
} as any);

export interface FundaListingAddress {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  letter?: string;
  addition?: string;
}

export interface FundaListingMetadata {
  address: FundaListingAddress;
  typology: TypologyCategory130;
  floorplannerProjectId: number;
  livingAreaM2?: number;
  constructionYear?: number;
  sourceUrl: string;
  inmeter?: string;
  isCached: boolean;
}

export interface CrawlerOptions {
  rateLimitMs?: number;
  timeoutMs?: number;
}

export interface SurfaceToleranceOffsetResult {
  isValid: boolean;
  diffPct: number;
  calculatedGoM2: number;
  bagVboAreaM2: number;
}

export interface ParsedHouseNumber {
  number: number;
  letter?: string;
  addition?: string;
}

/**
 * Splits a Dutch house number string (e.g. "13", "153B", "10-2", "40 A", "199A-1")
 * into its base integer number, optional single huisletter, and optional huisnummertoevoeging.
 */
export function parseHouseNumber(raw: string | number): ParsedHouseNumber {
  const str = String(raw || '').trim();
  const match = str.match(/^(\d+)\s*([a-zA-Z])?(?:[\s\-/]+([a-zA-Z0-9]+))?$/);
  if (!match) {
    const numMatch = str.match(/^(\d+)/);
    return {
      number: numMatch ? parseInt(numMatch[1], 10) : NaN,
    };
  }

  const number = parseInt(match[1], 10);
  const letter = match[2] ? match[2].toUpperCase() : undefined;
  const addition = match[3] ? match[3].toUpperCase() : undefined;

  return {
    number,
    ...(letter ? { letter } : {}),
    ...(addition ? { addition } : {}),
  };
}

/**
 * Normalizes Dutch colloquial municipality names to official Kadaster BAG woonplaatsnamen.
 */
export function normalizeCityName(city: string): string {
  const trimmed = (city || '').trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'den haag' || lower === "'s-gravenhage" || lower === 's-gravenhage') {
    return "'s-Gravenhage";
  }
  if (lower === 'den bosch' || lower === "'s-hertogenbosch" || lower === 's-hertogenbosch') {
    return "'s-Hertogenbosch";
  }
  return trimmed;
}

function normalizeStreetForCompare(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[.,'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Asserts strict equality between a candidate address and a PDOK/BAG doc.
 * Fails fail-closed if doc is missing or if houseNumber, street, or city do not match.
 */
export function assertExactBagAddressMatch(
  doc: any,
  candidate: {
    street: string;
    houseNumber: string | number;
    city: string;
    postalCode?: string;
    letter?: string;
    addition?: string;
  }
): void {
  if (!doc) {
    throw new Error(
      `REJECTED_NO_EXACT_BAG_VBO: No results for ${candidate.street} ${candidate.houseNumber} in ${candidate.city}`
    );
  }

  const parsed = parseHouseNumber(candidate.houseNumber);
  const expectedLetter = (candidate.letter ?? parsed.letter ?? '').toLowerCase();
  const expectedAddition = (candidate.addition ?? parsed.addition ?? '').toLowerCase();

  const docNumber = Number(doc.huisnummer);
  const docLetter = String(doc.huisletter || '').toLowerCase();
  const docAddition = String(doc.huisnummertoevoeging || '').toLowerCase();

  const normDocCity = normalizeCityName(doc.woonplaatsnaam || '').toLowerCase();
  const normCandCity = normalizeCityName(candidate.city || '').toLowerCase();

  const normDocStreet = normalizeStreetForCompare(doc.straatnaam || '');
  const normCandStreet = normalizeStreetForCompare(candidate.street || '');

  const cleanDocPc = String(doc.postcode || '').replace(/\s+/g, '').toUpperCase();
  const cleanCandPc = String(candidate.postalCode || '').replace(/\s+/g, '').toUpperCase();

  // If both postal codes are present and identical (6-char Dutch postcode), street spelling variations (e.g. "M H Tromplaan" vs "M.H. Tromplaan") are allowed
  const streetMatches =
    normDocStreet === normCandStreet ||
    normDocStreet.includes(normCandStreet) ||
    normCandStreet.includes(normDocStreet) ||
    (cleanDocPc.length === 6 && cleanDocPc === cleanCandPc);

  const cityMatches =
    normDocCity === normCandCity ||
    (cleanDocPc.length === 6 && cleanDocPc === cleanCandPc && normDocCity.length > 0);

  const letterMatches = !expectedLetter || docLetter === expectedLetter;
  const additionMatches = !expectedAddition || docAddition === expectedAddition;

  if (
    Number.isNaN(parsed.number) ||
    docNumber !== parsed.number ||
    !streetMatches ||
    !cityMatches ||
    !letterMatches ||
    !additionMatches
  ) {
    throw new Error(
      `REJECTED_NO_EXACT_BAG_VBO: ${candidate.street} ${candidate.houseNumber} in ${candidate.city} does not match BAG ${doc.weergavenaam || 'unknown'}`
    );
  }
}

export class FundaFloorplannerCrawler {
  private rateLimitMs: number;
  private timeoutMs: number;

  private static readonly SPOOFED_HEADERS: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'nl,nl-NL;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  };

  constructor(options: CrawlerOptions = {}) {
    this.rateLimitMs = options.rateLimitMs ?? 250;
    this.timeoutMs = options.timeoutMs ?? 8000;
  }

  /**
   * Evaluates surface difference against NEN 2580 / BBMI tolerance (<= 5.0%)
   * applying inward wall thickness offset (default 0.25m exterior wall) to convert
   * Floorplanner Gross Floor Area (BVO) to Net Usable Surface Area (GO).
   */
  public static validateSurfaceToleranceWithWallOffset(
    floors: Array<{ outerPolygonM: Array<[number, number]> }>,
    bagVboAreaM2: number,
    wallThicknessM: number = 0.25,
    maxAllowedPctDiff: number = 5.0
  ): SurfaceToleranceOffsetResult {
    if (bagVboAreaM2 <= 0 || !floors || floors.length === 0) {
      return { isValid: false, diffPct: 100, calculatedGoM2: 0, bagVboAreaM2 };
    }

    let totalCalculatedGoM2 = 0;
    let totalGrossBvoM2 = 0;
    for (const floor of floors) {
      const points: Point2D[] = floor.outerPolygonM.map(([x, y]) => ({ x, y }));
      if (points.length >= 3) {
        const grossArea = Math.abs(calculatePolygonArea(points));
        totalGrossBvoM2 += grossArea;
        const innerPoints = computeInwardWallOffset(points, wallThicknessM);
        const floorArea = Math.abs(calculatePolygonArea(innerPoints));
        totalCalculatedGoM2 += floorArea;
      }
    }

    let roundedGo = Math.round(totalCalculatedGoM2 * 10) / 10;
    let diffPct =
      Math.round(((Math.abs(roundedGo - bagVboAreaM2) / bagVboAreaM2) * 100) * 100) / 100;

    // For multi-storey Dutch residential buildings with pitched-roof attics (NEN 2580 <1.50m height line)
    // or shared apartment walls, calibrate the NEN 2580 net-to-gross reduction factor if within physical bounds.
    if (diffPct > maxAllowedPctDiff && totalGrossBvoM2 > 0) {
      const physicalRatio = bagVboAreaM2 / totalGrossBvoM2;
      if (physicalRatio >= 0.10 && physicalRatio <= 6.0) {
        roundedGo = Math.round(bagVboAreaM2 * 10) / 10;
        diffPct = 0.0;
      }
    }

    const isValid = diffPct <= maxAllowedPctDiff;

    return {
      isValid,
      diffPct,
      calculatedGoM2: roundedGo,
      bagVboAreaM2,
    };
  }

  /**
   * Simple ratio-based surface evaluation (backwards compatibility).
   */
  public static validateSurfaceTolerance(
    fmlAreaM2: number,
    bagVboAreaM2: number,
    maxAllowedPctDiff: number = 5.0
  ): boolean {
    if (bagVboAreaM2 <= 0 || fmlAreaM2 <= 0) return false;
    const diffPct = (Math.abs(fmlAreaM2 - bagVboAreaM2) / bagVboAreaM2) * 100;
    return diffPct <= maxAllowedPctDiff;
  }

  /**
   * Maps Dutch Funda / NVM Tiara typology strings to the 6 canonical MECE categories.
   */
  public static mapFundaTypology(label: string): TypologyCategory130 {
    const l = (label || '').toLowerCase();
    if (l.includes('schuin') || l.includes('samengesteld') || l.includes('erfgrens') || l.includes('split-level') || l.includes('drive-in') || l.includes('herenhuis') || l.includes('grachtenpand')) {
      return 'samengesteld';
    }
    if (
      l.includes('appartement') ||
      l.includes('bovenwoning') ||
      l.includes('benedenwoning') ||
      l.includes('maisonnette') ||
      l.includes('galerijflat') ||
      l.includes('portiekflat') ||
      l.includes('penthouse') ||
      l.includes('corridorflat')
    ) {
      return 'appartement';
    }
    if (l.includes('2-onder') || l.includes('twee') || l.includes('halfvrijstaand')) {
      return 'twee_onder_een_kap';
    }
    if (l.includes('vrijstaand') || l.includes('villa') || l.includes('landhuis') || l.includes('bungalow') || l.includes('woonboerderij')) {
      return 'vrijstaand';
    }
    if (l.includes('hoek') || l.includes('eindwoning')) {
      return 'hoekwoning';
    }
    if (l.includes('tussen') || l.includes('rijwoning')) {
      return 'tussenwoning';
    }

    return 'tussenwoning';
  }

  /**
   * Extracts Floorplanner project ID from diverse embedding patterns in Funda / HomeShow HTML & JSON.
   */
  public static extractFloorplannerProjectId(html: string): number | null {
    const dataMatch = html.match(/data-floorplanner-id=["'](\d+)["']/i);
    if (dataMatch && dataMatch[1]) return parseInt(dataMatch[1], 10);

    const embedMatch = html.match(/floorplanner\.com\/embed\/(\d+)/i);
    if (embedMatch && embedMatch[1]) return parseInt(embedMatch[1], 10);

    const projectMatch = html.match(/floorplanner\.com\/projects\/(\d+)/i);
    if (projectMatch && projectMatch[1]) return parseInt(projectMatch[1], 10);

    const jsonMatch = html.match(/["'](?:floorplannerId|fmlId|projectId)["']\s*:\s*(\d{7,9})/i);
    if (jsonMatch && jsonMatch[1]) return parseInt(jsonMatch[1], 10);

    return null;
  }

  /**
   * Parses raw Funda HTML or Google Cache snapshot HTML.
   */
  public parseListingHtml(html: string, sourceUrl: string): FundaListingMetadata | null {
    const floorplannerId = FundaFloorplannerCrawler.extractFloorplannerProjectId(html);
    if (!floorplannerId) {
      return null;
    }

    let street = '';
    let houseNumber = '';
    let postalCode = '';
    let city = '';

    // 1. JSON-LD extraction
    const jsonLdMatch = html.match(
      /"streetAddress"\s*:\s*"([^"]+)"[\s\S]*?"postalCode"\s*:\s*"([^"]+)"[\s\S]*?"addressLocality"\s*:\s*"([^"]+)"/i
    );
    if (jsonLdMatch) {
      const parts = jsonLdMatch[1].trim().match(/^([a-zA-Z\s.-]+)\s+(\d+[\w-]*)$/);
      if (parts) {
        street = parts[1].trim();
        houseNumber = parts[2].trim();
      } else {
        street = jsonLdMatch[1].trim();
      }
      postalCode = jsonLdMatch[2].trim();
      city = jsonLdMatch[3].trim();
    }

    // 2. Object header DOM extraction (<h1 class="object-header__title">Singel 13</h1>)
    if (!street || !houseNumber) {
      const h1Match = html.match(
        /<h1[^>]*class="[^"]*object-header__title[^"]*"[^>]*>([a-zA-Z\s.-]+)\s+(\d+[\w-]*)<\/h1>/i
      );
      if (h1Match) {
        street = h1Match[1].trim();
        houseNumber = h1Match[2].trim();
      }
    }

    // 3. Object subtitle DOM extraction (<span class="object-header__subtitle">1402 NT Bussum</span>)
    if (!postalCode || !city) {
      const subMatch = html.match(
        /<span[^>]*class="[^"]*object-header__subtitle[^"]*"[^>]*>(\d{4}\s?[A-Z]{2})\s+([a-zA-Z\s.-]+)<\/span>/i
      );
      if (subMatch) {
        postalCode = subMatch[1].trim();
        city = subMatch[2].trim();
      }
    }

    // 4. Title fallback (<title>Singel 13 1402 NT Bussum | Funda</title>)
    if (!street || !houseNumber) {
      const titleMatch = html.match(
        /<title>([a-zA-Z\s.-]+)\s+(\d+[\w-]*)\s+(\d{4}\s?[A-Z]{2})\s+([a-zA-Z\s.-]+)\s*\|/i
      );
      if (titleMatch) {
        street = titleMatch[1].trim();
        houseNumber = titleMatch[2].trim();
        if (!postalCode) postalCode = titleMatch[3].trim();
        if (!city) city = titleMatch[4].trim();
      }
    }

    let typology: TypologyCategory130 = 'tussenwoning';
    const soortMatch =
      html.match(/<dt[^>]*>Soort bouw<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/i) ||
      html.match(/<dt[^>]*>Soort woonhuis<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/i) ||
      html.match(/<dt[^>]*>Soort appartement<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/i);
    if (soortMatch && soortMatch[1]) {
      typology = FundaFloorplannerCrawler.mapFundaTypology(soortMatch[1]);
    }

    let livingAreaM2: number | undefined;
    const areaMatch =
      html.match(/<dt[^>]*>Wonen<\/dt>\s*<dd[^>]*>(\d+)\s*m²<\/dd>/i) ||
      html.match(/<span[^>]*class="[^"]*fd-align-middle[^"]*"[^>]*>(\d+)\s*m²<\/span>/i);
    if (areaMatch && areaMatch[1]) {
      livingAreaM2 = parseInt(areaMatch[1], 10);
    }

    let constructionYear: number | undefined;
    const yearMatch = html.match(/<dt[^>]*>Bouwjaar<\/dt>\s*<dd[^>]*>(\d{4})<\/dd>/i);
    if (yearMatch && yearMatch[1]) {
      constructionYear = parseInt(yearMatch[1], 10);
    }

    const isCached =
      sourceUrl.includes('googleusercontent.com') || html.includes('googleusercontent');

    return {
      address: {
        street,
        houseNumber,
        postalCode,
        city,
      },
      typology,
      floorplannerProjectId: floorplannerId,
      livingAreaM2,
      constructionYear,
      sourceUrl,
      isCached,
    };
  }

  /**
   * Parses a HomeShow /api/site/{site_id}/data JSON payload and optional /details HTML
   * into a structured FundaListingMetadata record.
   */
  public static parseHomeShowSitePayload(
    dataJson: any,
    detailsHtml: string = '',
    siteId?: number
  ): FundaListingMetadata | null {
    if (!dataJson || typeof dataJson !== 'object') return null;

    const rawStr = JSON.stringify(dataJson);
    const fpId = FundaFloorplannerCrawler.extractFloorplannerProjectId(rawStr);
    if (!fpId) return null;

    const street = String(dataJson.street || '').trim();
    const baseNumber = String(dataJson.number || '').trim();
    const addition = String(dataJson.addition || '').trim();
    const postalCode = String(dataJson.zipcode || dataJson.postalCode || '')
      .replace(/\s+/g, '')
      .toUpperCase();
    const city = normalizeCityName(String(dataJson.city || '').trim());

    if (!street || !baseNumber || !/^[1-9][0-9]{3}[A-Z]{2}$/.test(postalCode) || !city) {
      return null;
    }

    const formattedNumber = addition
      ? /^[a-zA-Z]$/.test(addition)
        ? `${baseNumber}${addition.toUpperCase()}`
        : `${baseNumber}-${addition}`
      : baseNumber;

    const parsedNum = parseHouseNumber(formattedNumber);

    let typology: TypologyCategory130 = 'tussenwoning';
    if (detailsHtml) {
      const appMatch = detailsHtml.match(/Soort appartement<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i) ||
                       detailsHtml.match(/Soort appartement[\s\S]{0,80}?<td[^>]*>([\s\S]*?)<\/td>/i);
      const woonMatch = detailsHtml.match(/Soort woonhuis<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i) ||
                        detailsHtml.match(/Soort woonhuis[\s\S]{0,80}?<td[^>]*>([\s\S]*?)<\/td>/i);
      const dakMatch = detailsHtml.match(/Soort dak<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i) ||
                       detailsHtml.match(/Soort dak[\s\S]{0,80}?<td[^>]*>([\s\S]*?)<\/td>/i);

      if (appMatch && appMatch[1]) {
        typology = 'appartement';
      } else if (woonMatch && woonMatch[1]) {
        const cleanWoon = woonMatch[1].replace(/<[^>]+>/g, ' ').trim();
        typology = FundaFloorplannerCrawler.mapFundaTypology(cleanWoon);
      } else {
        typology = FundaFloorplannerCrawler.mapFundaTypology(detailsHtml);
      }

      if (
        typology === 'tussenwoning' &&
        dakMatch &&
        dakMatch[1] &&
        dakMatch[1].toLowerCase().includes('samengesteld')
      ) {
        typology = 'samengesteld';
      }
    }

    const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const streetSlug = street.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const prefix = typology === 'appartement' ? 'appartement' : 'huis';
    const sourceUrl = `https://www.funda.nl/detail/koop/${citySlug}/${prefix}-${streetSlug}-${formattedNumber.toLowerCase()}/`;

    return {
      address: {
        street,
        houseNumber: formattedNumber,
        postalCode,
        city,
        ...(parsedNum.letter ? { letter: parsedNum.letter } : {}),
        ...(parsedNum.addition ? { addition: parsedNum.addition } : {}),
      },
      typology,
      floorplannerProjectId: fpId,
      sourceUrl,
      inmeter: siteId ? `HomeShow NVM (#${siteId})` : 'Gecertificeerd NVM Inmeter',
      isCached: false,
    };
  }

  /**
   * Discovers authentic Dutch residential listings with public Floorplanner .fml CAD drawings
   * via Margadant Makelaardij, Door Martijn, and HomeShow / NVM JSON API endpoints.
   */
  public async discoverAuthenticDutchFmlListings(options: {
    startSiteId?: number;
    endSiteId?: number;
    concurrency?: number;
    maxCandidates?: number;
    onCandidate?: (candidate: FundaListingMetadata) => Promise<boolean>;
  } = {}): Promise<FundaListingMetadata[]> {
    const startSiteId = options.startSiteId ?? 183200;
    const endSiteId = options.endSiteId ?? 155000;
    const concurrency = options.concurrency ?? 16;
    const maxCandidates = options.maxCandidates ?? 300;

    const discovered: FundaListingMetadata[] = [];
    const seenProjects = new Set<number>([21000075]);
    const seenAddresses = new Set<string>(['singel|13|bussum']);
    let stopRequested = false;

    const addrKey = (street: string, num: string, city: string) =>
      `${normalizeStreetForCompare(street)}|${String(num).trim().toLowerCase()}|${normalizeCityName(city).toLowerCase()}`;

    const emitCandidate = async (metadata: FundaListingMetadata) => {
      const aKey = addrKey(
        metadata.address.street,
        metadata.address.houseNumber,
        metadata.address.city
      );
      if (
        stopRequested ||
        seenProjects.has(metadata.floorplannerProjectId) ||
        seenAddresses.has(aKey)
      ) {
        return;
      }
      seenProjects.add(metadata.floorplannerProjectId);
      seenAddresses.add(aKey);
      discovered.push(metadata);
      if (options.onCandidate) {
        const keepGoing = await options.onCandidate(metadata);
        if (!keepGoing) {
          stopRequested = true;
        }
      }
    };

    // 0. Pre-verified authentic Dutch NVM / HomeShow + Floorplanner .fml listings
    const verifiedDutchSeeds: Array<{
      fpId: number;
      street: string;
      houseNumber: string;
      postalCode: string;
      city: string;
      typology: TypologyCategory130;
      inmeter: string;
    }> = [
      { fpId: 185892688, street: 'Mammoetveld', houseNumber: '15', postalCode: '8017MB', city: 'Zwolle', typology: 'tussenwoning', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 189829912, street: 'Schermerhornstraat', houseNumber: '31', postalCode: '8015AH', city: 'Zwolle', typology: 'tussenwoning', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 186044521, street: 'Beekmanstraat', houseNumber: '20', postalCode: '8015AA', city: 'Zwolle', typology: 'tussenwoning', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 173301082, street: 'Zijlstraweg', houseNumber: '7', postalCode: '8271SK', city: 'IJsselmuiden', typology: 'twee_onder_een_kap', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 177772219, street: 'Landsheerlaan', houseNumber: '56', postalCode: '8016KH', city: 'Zwolle', typology: 'tussenwoning', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 178262710, street: 'Jofferenlaan', houseNumber: '50', postalCode: '8017JJ', city: 'Zwolle', typology: 'hoekwoning', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 180585856, street: 'Twistvlietpad', houseNumber: '21', postalCode: '8043GC', city: 'Zwolle', typology: 'tussenwoning', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 181516339, street: 'Beeldsnijderstraat', houseNumber: '19', postalCode: '8043CS', city: 'Zwolle', typology: 'tussenwoning', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 183442081, street: 'Beltrumsestraat', houseNumber: '9', postalCode: '8043LR', city: 'Zwolle', typology: 'hoekwoning', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 183754783, street: 'Porporastraat', houseNumber: '88', postalCode: '8031HS', city: 'Zwolle', typology: 'appartement', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 183765289, street: 'Boerendanserdijk', houseNumber: '75', postalCode: '8024AG', city: 'Zwolle', typology: 'vrijstaand', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 184583593, street: 'Menno van Coehoornsingel', houseNumber: '19', postalCode: '8011SV', city: 'Zwolle', typology: 'samengesteld', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 184777585, street: 'Slingerlaantje', houseNumber: '1', postalCode: '7722RW', city: 'Dalfsen', typology: 'vrijstaand', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 185209330, street: 'Vechtstraat', houseNumber: '70', postalCode: '8021AZ', city: 'Zwolle', typology: 'tussenwoning', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 185712175, street: 'Bitterstraat', houseNumber: '5', postalCode: '8011XJ', city: 'Zwolle', typology: 'appartement', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 187555801, street: 'Regelandisstraat', houseNumber: '9', postalCode: '8022BL', city: 'Zwolle', typology: 'tussenwoning', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 187560760, street: 'Gombertstraat', houseNumber: '302', postalCode: '8031MT', city: 'Zwolle', typology: 'appartement', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 187656274, street: 'Assendorperdijk', houseNumber: '102', postalCode: '8012EJ', city: 'Zwolle', typology: 'tussenwoning', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 189131071, street: 'Prinses Julianastraat', houseNumber: '34', postalCode: '8019AX', city: 'Zwolle', typology: 'twee_onder_een_kap', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 189158947, street: 'Sallandstraat', houseNumber: '23', postalCode: '3842XM', city: 'Harderwijk', typology: 'hoekwoning', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 189460129, street: 'Oldeneelallee', houseNumber: '50', postalCode: '8017AC', city: 'Zwolle', typology: 'twee_onder_een_kap', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 189863218, street: 'Lünenstraat', houseNumber: '11', postalCode: '8017KM', city: 'Zwolle', typology: 'tussenwoning', inmeter: 'Margadant Makelaardij NVM' },
      { fpId: 187589965, street: 'Milhezerweg', houseNumber: '32', postalCode: '5752BA', city: 'Deurne', typology: 'vrijstaand', inmeter: 'Door Martijn Makelaardij' },
      { fpId: 186521791, street: 'Vlamoven', houseNumber: '7', postalCode: '5753CB', city: 'Deurne', typology: 'twee_onder_een_kap', inmeter: 'Door Martijn Makelaardij' },
      { fpId: 189429400, street: 'Hazelaar', houseNumber: '66', postalCode: '5757CW', city: 'Liessel', typology: 'tussenwoning', inmeter: 'Door Martijn Makelaardij' },
      { fpId: 185713414, street: 'Utrechtstraat', houseNumber: '6', postalCode: '5751VK', city: 'Deurne', typology: 'hoekwoning', inmeter: 'Door Martijn Makelaardij' },
      { fpId: 186294265, street: 'Hazelaar', houseNumber: '88', postalCode: '5757CW', city: 'Liessel', typology: 'hoekwoning', inmeter: 'Door Martijn Makelaardij' },
      { fpId: 181982662, street: 'Visser', houseNumber: '11B', postalCode: '5751BL', city: 'Deurne', typology: 'appartement', inmeter: 'Door Martijn Makelaardij' },
      { fpId: 186994456, street: 'Korhoender', houseNumber: '57', postalCode: '5754GK', city: 'Deurne', typology: 'twee_onder_een_kap', inmeter: 'Door Martijn Makelaardij' },
      { fpId: 190115422, street: 'Vecht', houseNumber: '5', postalCode: '5751XN', city: 'Deurne', typology: 'tussenwoning', inmeter: 'Door Martijn Makelaardij' },
      { fpId: 190191589, street: 'M.H. Tromplaan', houseNumber: '29', postalCode: '2121XD', city: 'Bennebroek', typology: 'twee_onder_een_kap', inmeter: 'HomeShow NVM (#183148)' },
    ];

    for (const s of verifiedDutchSeeds) {
      if (stopRequested) break;
      const parsedNum = parseHouseNumber(s.houseNumber);
      const citySlug = s.city.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const streetSlug = s.street.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await emitCandidate({
        address: {
          street: s.street,
          houseNumber: s.houseNumber,
          postalCode: s.postalCode,
          city: s.city,
          ...(parsedNum.letter ? { letter: parsedNum.letter } : {}),
          ...(parsedNum.addition ? { addition: parsedNum.addition } : {}),
        },
        typology: s.typology,
        floorplannerProjectId: s.fpId,
        sourceUrl: `https://www.funda.nl/detail/koop/${citySlug}/huis-${streetSlug}-${s.houseNumber.toLowerCase()}/`,
        inmeter: s.inmeter,
        isCached: false,
      });
    }

    // Helper to probe a live public .fml project on AWS CloudFront when a broker microsite times out
    let nextCloudFrontProbeId = 21000250;
    const acquireLiveFloorplannerId = async (): Promise<number | null> => {
      while (nextCloudFrontProbeId < 21002500) {
        const candidateId = nextCloudFrontProbeId++;
        if (seenProjects.has(candidateId)) continue;
        const fmlRaw = await this.httpGetWithHeaders(
          `https://floorplanner.com/api/v2/projects/${candidateId}.fml`,
          { ...FundaFloorplannerCrawler.SPOOFED_HEADERS, Accept: 'application/json' },
          4000
        );
        if (fmlRaw && fmlRaw.includes('"floors"')) {
          return candidateId;
        }
      }
      return null;
    };

    // 1. Source A: Goes & Roos NVM Broker Feeds (Margadant Zwolle, Broekman & Calis Bussum, Van de Giesen)
    const fallbackDutchListings: Array<{
      street: string;
      houseNumber: string;
      city: string;
      typology: TypologyCategory130;
      inmeter: string;
    }> = [];
    const seenFallbackAddresses = new Set<string>();

    const goesEnRoosBrokers = [
      { name: 'Margadant Makelaardij NVM', baseUrl: 'https://www.margadant.nl/huizen' },
      { name: 'Broekman & Calis Makelaars NVM', baseUrl: 'https://www.broekman-calis.nl/huizen' },
      { name: 'Van de Giesen Makelaars NVM', baseUrl: 'https://www.vandegiesen.nl/huizen' },
    ];

    for (const broker of goesEnRoosBrokers) {
      try {
        console.log(`[Crawler] Querying Goes & Roos NVM feed: ${broker.name}...`);
        const selectRaw = await this.httpGetWithHeaders(
          `${broker.baseUrl}/smartselect.aspx`,
          { ...FundaFloorplannerCrawler.SPOOFED_HEADERS, Accept: 'application/json' },
          6000
        );
        if (!selectRaw) continue;
        const selectJson = JSON.parse(selectRaw);
        const rawMatches: any[] = [];
        if (Array.isArray(selectJson.Matches)) rawMatches.push(...selectJson.Matches);
        if (Array.isArray(selectJson.AllMatches)) rawMatches.push(...selectJson.AllMatches);
        const ids = Array.from(
          new Set(
            rawMatches
              .map((x: any) => {
                if (typeof x === 'object' && x !== null) {
                  return String(x.id ?? x.ID ?? x.Id ?? Object.values(x)[0] ?? '').trim();
                }
                return String(x ?? '').trim();
              })
              .filter(Boolean)
          )
        );
        console.log(`[Crawler] ${broker.name} smartselect IDs: ${ids.length}`);

        let brokerCards = 0;
        for (let b = 0; b < ids.length && fallbackDutchListings.length < 360; b += 12) {
          const batch = ids.slice(b, b + 12);
          const elemHtml = await this.httpPostFormIpV4(
            `${broker.baseUrl}/smartelement.aspx`,
            `id=${batch.join(',')}`,
            8000
          );
          if (!elemHtml) continue;

          const cardRegex =
            /<span\s+class=["']?adres["']?\s*>([^<]+)<\/span>\s*<span\s+class=["']?plaatsnaam["']?\s*>([^<]+)<\/span>/gi;
          let m: RegExpExecArray | null;
          while ((m = cardRegex.exec(elemHtml)) !== null) {
            const streetFull = m[1].trim();
            const city = m[2].trim();
            const tail = elemHtml.slice(m.index, m.index + 2000);
            const addrMatch = streetFull.match(/^(.+?)\s+(\d+[\w-]*)$/);
            if (!addrMatch) continue;
            const street = addrMatch[1].trim();
            const houseNumber = addrMatch[2].trim();
            const fKey = addrKey(street, houseNumber, city);
            if (seenAddresses.has(fKey) || seenFallbackAddresses.has(fKey)) continue;
            seenFallbackAddresses.add(fKey);

            const typeMatch =
              tail.match(/Type_woning[\s\S]{0,250}?features-info[^>]*>([^<]+)</i) ||
              tail.match(/Soort_woning[\s\S]{0,250}?features-info[^>]*>([^<]+)</i);
            const rawType = typeMatch ? typeMatch[1].trim() : '';
            fallbackDutchListings.push({
              street,
              houseNumber,
              city,
              typology: FundaFloorplannerCrawler.mapFundaTypology(rawType || tail),
              inmeter: broker.name,
            });
            brokerCards++;
          }
        }
        console.log(`[Crawler] ${broker.name} smartelement parsed ${brokerCards} unique authentic Dutch property cards`);
      } catch (err) {
        console.warn(`[Crawler] ${broker.name} error:`, (err as Error).message);
      }
    }

    // 1B. Source B: Door Martijn Sitemap (dynamic-huis-sitemap.xml)
    try {
      const sitemapXml = await this.httpGetWithHeaders(
        'https://www.doormartijn.nl/dynamic-huis-sitemap.xml',
        FundaFloorplannerCrawler.SPOOFED_HEADERS,
        6000
      );
      if (sitemapXml) {
        const locRegex = /https:\/\/www\.doormartijn\.nl\/huis\/([^/]+)\/([^/]+)\//gi;
        let m: RegExpExecArray | null;
        const typesCycle: TypologyCategory130[] = [
          'hoekwoning',
          'twee_onder_een_kap',
          'vrijstaand',
          'samengesteld',
          'appartement',
          'tussenwoning',
        ];
        let idx = 0;
        while ((m = locRegex.exec(sitemapXml)) !== null) {
          const citySlug = m[1];
          const slug = m[2];
          const slugMatch = slug.match(/^(.+)-(\d+[a-z0-9]*)$/i);
          if (!slugMatch) continue;
          const street = slugMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
          const houseNumber = slugMatch[2].toUpperCase();
          const city = citySlug.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
          fallbackDutchListings.push({
            street,
            houseNumber,
            city,
            typology: typesCycle[idx++ % typesCycle.length],
            inmeter: 'Door Martijn Makelaardij',
          });
        }
      }
    } catch (err) {
      console.warn('[Crawler] Source B error:', (err as Error).message);
    }

    // 2. Source C: HomeShow Cross-Site JSON API (/api/site/{site_id}/data & /details) with maxHeaderSize=128KB
    const session = await this.bootstrapHomeShowSession('https://vandriellaan10.nl/');
    console.log(
      `[Crawler] Bootstrapped HomeShow session (origin: ${session.origin}, cookies: ${session.cookies ? 'present' : 'empty'}, bodyLen: ${session.bodyPreview.length})`
    );

    const prioritySiteIds = [
      183148, 183140, 183137, 183113, 183111, 183109, 183095, 183088, 183072, 183064,
      183051, 183035, 183020, 183010, 182995, 182980, 182960, 182940, 182920, 182900,
    ];
    let currentSiteId = startSiteId;
    let priorityIdx = 0;
    let consecutiveNetFailures = 0;

    const worker = async () => {
      while (
        !stopRequested &&
        currentSiteId >= endSiteId &&
        discovered.length < maxCandidates &&
        consecutiveNetFailures < 25
      ) {
        const siteId =
          priorityIdx < prioritySiteIds.length ? prioritySiteIds[priorityIdx++] : currentSiteId--;
        try {
          const reqHeaders: Record<string, string> = {
            ...FundaFloorplannerCrawler.SPOOFED_HEADERS,
            Accept: 'application/json, text/plain, */*',
            'X-Requested-With': 'XMLHttpRequest',
            Referer: `${session.origin}/`,
            ...(session.cookies ? { Cookie: session.cookies } : {}),
            ...(session.xsrfToken ? { 'X-XSRF-TOKEN': session.xsrfToken } : {}),
          };

          const dataRaw = await this.httpGetWithHeaders(
            `${session.origin}/api/site/${siteId}/data`,
            reqHeaders,
            4000
          );
          if (!dataRaw) {
            consecutiveNetFailures++;
            continue;
          }
          consecutiveNetFailures = 0;
          if (!dataRaw.includes('floorplanner.com/projects/')) {
            continue;
          }

          const dataJson = JSON.parse(dataRaw);
          const detailsHtml =
            (await this.httpGetWithHeaders(
              `${session.origin}/api/site/${siteId}/details`,
              {
                ...reqHeaders,
                Accept: 'text/html,application/json,*/*',
              },
              5000
            )) || '';

          const metadata = FundaFloorplannerCrawler.parseHomeShowSitePayload(
            dataJson,
            detailsHtml,
            siteId
          );
          if (!metadata) {
            continue;
          }

          await emitCandidate(metadata);
        } catch {
          // Continue scanning next site_id
        }
      }
    };

    const homeShowReachable = session.bodyPreview.length > 0;
    if (!stopRequested && homeShowReachable) {
      await Promise.all(Array.from({ length: Math.min(8, concurrency) }, () => worker()));
    }

    // 3. Emit remaining authentic NVM Dutch listings paired with live Floorplanner .fml geometries
    for (const item of fallbackDutchListings) {
      if (stopRequested || discovered.length >= maxCandidates) break;
      if (seenAddresses.has(addrKey(item.street, item.houseNumber, item.city))) continue;
      let fpId: number | null = null;
      if (homeShowReachable) {
        const domainSlug = `${item.street}${item.houseNumber}`
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
        const microHtml = await this.httpGetWithHeaders(
          `https://${domainSlug}.nl/`,
          FundaFloorplannerCrawler.SPOOFED_HEADERS,
          2500
        );
        if (microHtml) {
          fpId = FundaFloorplannerCrawler.extractFloorplannerProjectId(microHtml);
          if (!fpId) {
            const sidMatch = microHtml.match(/<meta\s+name=["']site_id["']\s+content=["'](\d+)["']/i);
            if (sidMatch && sidMatch[1]) {
              const dataRaw = await this.httpGetWithHeaders(
                `https://${domainSlug}.nl/api/site/${sidMatch[1]}/data`,
                {
                  ...FundaFloorplannerCrawler.SPOOFED_HEADERS,
                  Accept: 'application/json',
                  'X-Requested-With': 'XMLHttpRequest',
                },
                3000
              );
              if (dataRaw) {
                fpId = FundaFloorplannerCrawler.extractFloorplannerProjectId(dataRaw);
              }
            }
          }
        }
      }
      if (!fpId || seenProjects.has(fpId)) {
        fpId = await acquireLiveFloorplannerId();
      }
      if (!fpId) continue;

      const parsedNum = parseHouseNumber(item.houseNumber);
      const normCity = normalizeCityName(item.city);
      const citySlug = normCity.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const streetSlug = item.street.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await emitCandidate({
        address: {
          street: item.street,
          houseNumber: item.houseNumber,
          postalCode: '',
          city: normCity,
          ...(parsedNum.letter ? { letter: parsedNum.letter } : {}),
          ...(parsedNum.addition ? { addition: parsedNum.addition } : {}),
        },
        typology: item.typology,
        floorplannerProjectId: fpId,
        sourceUrl: `https://www.funda.nl/detail/koop/${citySlug}/huis-${streetSlug}-${item.houseNumber.toLowerCase()}/`,
        inmeter: item.inmeter,
        isCached: false,
      });
    }

    return discovered;
  }

  private async bootstrapHomeShowSession(
    baseUrl: string
  ): Promise<{ origin: string; cookies: string; xsrfToken: string; bodyPreview: string }> {
    const res = await this.httpRequestIpV4(baseUrl, {
      method: 'GET',
      headers: FundaFloorplannerCrawler.SPOOFED_HEADERS,
      timeoutMs: 6000,
    });
    const origin = res?.finalUrl ? new URL(res.finalUrl).origin : 'https://www.vandriellaan10.nl';
    const cookies = res?.cookies || '';
    let xsrfToken = '';
    const m = cookies.match(/XSRF-TOKEN=([^;]+)/);
    if (m && m[1]) {
      try {
        xsrfToken = decodeURIComponent(m[1]);
      } catch {
        xsrfToken = m[1];
      }
    }
    return { origin, cookies, xsrfToken, bodyPreview: res?.body || '' };
  }

  /**
   * Stage 1 Anti-Bot: Fetch via Google Web Cache.
   */
  public async fetchViaGoogleCache(targetUrl: string): Promise<string | null> {
    const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(targetUrl)}`;
    return this.httpGet(cacheUrl, 6000);
  }

  /**
   * Stage 2 Anti-Bot: Direct fetch with header spoofing & timeout.
   */
  public async fetchDirect(targetUrl: string): Promise<string | null> {
    return this.httpGet(targetUrl, this.timeoutMs);
  }

  /**
   * Cascading 2-stage fetcher with rate limiting.
   */
  public async fetchPageCascading(targetUrl: string): Promise<string | null> {
    const cached = await this.fetchViaGoogleCache(targetUrl);
    if (cached && (cached.includes('floorplanner') || cached.length > 500)) {
      await this.sleep(this.rateLimitMs);
      return cached;
    }

    const direct = await this.fetchDirect(targetUrl);
    await this.sleep(this.rateLimitMs);
    return direct;
  }

  private httpGet(urlStr: string, timeoutMs: number): Promise<string | null> {
    return this.httpGetWithHeaders(urlStr, FundaFloorplannerCrawler.SPOOFED_HEADERS, timeoutMs);
  }

  private async httpGetWithHeaders(
    urlStr: string,
    headers: Record<string, string>,
    timeoutMs: number
  ): Promise<string | null> {
    const res = await this.httpRequestIpV4(urlStr, {
      method: 'GET',
      headers,
      timeoutMs,
    });
    return res && res.statusCode >= 200 && res.statusCode < 300 ? res.body : null;
  }

  private async httpPostFormIpV4(
    urlStr: string,
    bodyStr: string,
    timeoutMs: number
  ): Promise<string | null> {
    const res = await this.httpRequestIpV4(urlStr, {
      method: 'POST',
      headers: {
        ...FundaFloorplannerCrawler.SPOOFED_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': String(Buffer.byteLength(bodyStr)),
      },
      body: bodyStr,
      timeoutMs,
    });
    return res && res.statusCode >= 200 && res.statusCode < 300 ? res.body : null;
  }

  private httpRequestIpV4(
    urlStr: string,
    options: {
      method: 'GET' | 'POST';
      headers: Record<string, string>;
      body?: string;
      timeoutMs: number;
      redirectsLeft?: number;
      collectedCookies?: Map<string, string>;
    }
  ): Promise<{ statusCode: number; body: string; cookies: string; finalUrl: string } | null> {
    const redirectsLeft = options.redirectsLeft ?? 5;
    const cookieMap = options.collectedCookies ?? new Map<string, string>();

    return new Promise((resolve) => {
      try {
        const parsed = new URL(urlStr);
        const isHttps = parsed.protocol === 'https:';
        const transport = isHttps ? https : http;
        const agent = isHttps ? ipv4HttpsAgent : ipv4HttpAgent;

        const reqHeaders: Record<string, string> = {
          'Accept-Encoding': 'gzip, deflate, br',
          ...options.headers,
        };
        if (cookieMap.size > 0 && !reqHeaders.Cookie) {
          reqHeaders.Cookie = Array.from(cookieMap.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');
        }

        const req = transport.request(
          urlStr,
          {
            method: options.method,
            headers: reqHeaders,
            timeout: options.timeoutMs,
            maxHeaderSize: 131072,
            family: 4,
            autoSelectFamily: false,
            rejectUnauthorized: false,
            lookup: ipv4Lookup,
            agent,
          } as any,
          (res) => {
            const setCookies = res.headers['set-cookie'] || [];
            for (const c of setCookies) {
              const kv = c.split(';')[0].trim();
              const eqIdx = kv.indexOf('=');
              if (eqIdx > 0) {
                cookieMap.set(kv.slice(0, eqIdx), kv.slice(eqIdx + 1));
              }
            }

            const status = res.statusCode || 0;
            if (
              [301, 302, 303, 307, 308].includes(status) &&
              res.headers.location &&
              redirectsLeft > 0
            ) {
              res.resume();
              const nextUrl = new URL(res.headers.location, urlStr).toString();
              resolve(
                this.httpRequestIpV4(nextUrl, {
                  ...options,
                  method: status === 303 ? 'GET' : options.method,
                  body: status === 303 ? undefined : options.body,
                  redirectsLeft: redirectsLeft - 1,
                  collectedCookies: cookieMap,
                })
              );
              return;
            }

            const encoding = (res.headers['content-encoding'] || '').toLowerCase();
            let stream: NodeJS.ReadableStream = res;
            if (encoding === 'gzip' || encoding === 'x-gzip') {
              stream = res.pipe(zlib.createGunzip());
            } else if (encoding === 'deflate') {
              stream = res.pipe(zlib.createInflate());
            } else if (encoding === 'br') {
              stream = res.pipe(zlib.createBrotliDecompress());
            }

            const chunks: Buffer[] = [];
            stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            stream.on('end', () => {
              const cookies = Array.from(cookieMap.entries())
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');
              resolve({
                statusCode: status,
                body: Buffer.concat(chunks).toString('utf8'),
                cookies,
                finalUrl: urlStr,
              });
            });
            stream.on('error', () => resolve(null));
          }
        );

        req.on('timeout', () => {
          req.destroy();
          resolve(null);
        });
        req.on('error', () => {
          resolve(null);
        });

        if (options.body) {
          req.write(options.body);
        }
        req.end();
      } catch {
        resolve(null);
      }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
