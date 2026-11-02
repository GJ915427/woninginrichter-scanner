/**
 * src/utils/matrix-pricing.ts
 *
 * Centrale CPQ (Configure, Price, Quote) Pricing Engine voor de Matrix Orders Browser.
 * Garandeert Zero Float Math (alle interne calculaties en opslag strictly in integer centen).
 */

import {
  CellPriceData,
  DimensionLimits,
  Etage,
  LogicTradeOrderLine,
  MatrixOrder,
  MatrixProduct,
  PricingMode,
  Room,
} from '../types/matrix';

/**
 * Converteert een integer bedrag in centen naar een formele Nederlandse valutatekst (e.g. 125000 -> "€ 1.250,00").
 */
export function centsToEuroString(cents: number): string {
  const safeCents = Math.round(Number.isFinite(cents) ? cents : 0);
  const isNegative = safeCents < 0;
  const absCents = Math.abs(safeCents);
  const euros = Math.floor(absCents / 100);
  const remainder = absCents % 100;

  // Duizendtallen scheiden met punten
  const euroParts = euros.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centPart = remainder.toString().padStart(2, '0');

  return `${isNegative ? '-' : ''}€ ${euroParts},${centPart}`;
}

export const formatPriceCents = centsToEuroString;

/**
 * Locale-aware parser die Nederlandse valutateksten omzet naar integer centen.
 * Verwijdert valutasymbolen (€), spaties, duizendtallen-punten (.) en normaliseert trailing ,- naar ,00.
 */
export function euroStringToCents(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return Math.round(Number.isFinite(val) ? val : 0);
  }

  let cleaned = val.trim();
  if (!cleaned) return 0;

  // Strip valutasymbolen en whitespace
  cleaned = cleaned.replace(/[€$\s]/g, '');

  // Normaliseer trailing ",-" of ".-" naar ",00"
  cleaned = cleaned.replace(/[,-]-$/, ',00');

  // Als er zowel punten als komma's zijn, is de punt een duizendtallen-scheider (e.g. "1.250,00")
  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, ''); // verwijder duizendtallen-punten
  } else if (cleaned.includes('.')) {
    // Alleen punt: controleer of het een duizendtallen-scheider is (e.g. "1.250" met 3 cijfers achter punt)
    const parts = cleaned.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      cleaned = parts[0] + parts[1] + ',00';
    } else {
      // Beschouw als decimaal punt
      cleaned = cleaned.replace('.', ',');
    }
  }

  const isNegative = cleaned.startsWith('-');
  if (isNegative) {
    cleaned = cleaned.substring(1);
  }

  const [euroStr, centStr = '0'] = cleaned.split(',');
  const euros = parseInt(euroStr.replace(/\D/g, ''), 10) || 0;
  const rawCents = centStr.replace(/\D/g, '').padEnd(2, '0').slice(0, 2);
  const cents = parseInt(rawCents, 10) || 0;

  const total = euros * 100 + cents;
  return isNegative ? -total : total;
}

/**
 * Berekent de regelprijs door aantal met de invariante basis-stuksprijs te vermenigvuldigen.
 * Past defensieve clamping toe (geen negatieve getallen).
 */
export function calculateLineTotal(qty: number, unitPriceCents: number): number {
  const safeQty = Math.max(0, Math.round(Number.isFinite(qty) ? qty : 0));
  const safeUnitPrice = Math.max(0, Math.round(Number.isFinite(unitPriceCents) ? unitPriceCents : 0));
  return safeQty * safeUnitPrice;
}

/**
 * Berekent een dimensionale stuksprijs in integer centen op basis van maten en modus (zero float math).
 * - 'm2': (breedte_mm * hoogte_mm * tarief) / 1.000.000
 * - 'm1_width': (breedte_mm * tarief) / 1.000
 * - 'm1_height': (hoogte_mm * tarief) / 1.000
 * - 'unit': vaste stuksprijs (geen maatvermenigvuldiging)
 */
export function calculateDimensionPriceCents(
  widthMm?: number,
  heightMm?: number,
  baseRateCents: number = 0,
  mode: PricingMode = 'm2'
): number {
  const safeRate = Math.max(0, Math.round(Number.isFinite(baseRateCents) ? baseRateCents : 0));
  const w = Math.max(0, Math.round(Number.isFinite(widthMm) ? (widthMm as number) : 0));
  const h = Math.max(0, Math.round(Number.isFinite(heightMm) ? (heightMm as number) : 0));

  switch (mode) {
    case 'm2': {
      if (w === 0 || h === 0) return safeRate;
      return Math.round((w * h * safeRate) / 1_000_000);
    }
    case 'm1_width': {
      if (w === 0) return safeRate;
      return Math.round((w * safeRate) / 1_000);
    }
    case 'm1_height': {
      if (h === 0) return safeRate;
      return Math.round((h * safeRate) / 1_000);
    }
    case 'unit':
    default:
      return safeRate;
  }
}

/**
 * Parseert een dimensietekst (bijv. "1100 × 2240", "1100x2240", "Breedte 4800") robuust naar millimeters.
 */
export function parseDimensions(dim?: string): { widthMm?: number; heightMm?: number } {
  if (!dim) return {};
  const cleaned = dim.replace(/×/g, 'x');
  const match = cleaned.match(/(\d+)\s*x\s*(\d+)/i);
  if (match) {
    return {
      widthMm: parseInt(match[1], 10),
      heightMm: parseInt(match[2], 10),
    };
  }
  const singleMatch = cleaned.match(/(\d+)\s*(?:mm|m1|cm)?/i);
  if (singleMatch) {
    return { widthMm: parseInt(singleMatch[1], 10) };
  }
  return {};
}

/**
 * Valideert afmetingen tegen optionele catalogusgrenzen.
 */
export function validateDimensions(
  widthMm?: number,
  heightMm?: number,
  limits?: DimensionLimits
): { valid: boolean; error?: string } {
  if (!limits) return { valid: true };

  if (widthMm !== undefined) {
    if (limits.minWidth !== undefined && widthMm < limits.minWidth) {
      return { valid: false, error: `Breedte (${widthMm}mm) is kleiner dan minimum (${limits.minWidth}mm)` };
    }
    if (limits.maxWidth !== undefined && widthMm > limits.maxWidth) {
      return { valid: false, error: `Breedte (${widthMm}mm) overschrijdt maximum (${limits.maxWidth}mm)` };
    }
  }

  if (heightMm !== undefined) {
    if (limits.minHeight !== undefined && heightMm < limits.minHeight) {
      return { valid: false, error: `Hoogte (${heightMm}mm) is kleiner dan minimum (${limits.minHeight}mm)` };
    }
    if (limits.maxHeight !== undefined && heightMm > limits.maxHeight) {
      return { valid: false, error: `Hoogte (${heightMm}mm) overschrijdt maximum (${limits.maxHeight}mm)` };
    }
  }

  return { valid: true };
}

/**
 * Resolvet de effectieve prijs van een cel.
 * Als de cel 'isInbegrepen' is, levert dit 0 cent op voor aggregaties.
 * Indien de cel geen expliciete prijs heeft maar een line reference naar rawLines, resolvet hij die.
 */
export function resolveCellPriceCents(cell?: CellPriceData, rawLines?: LogicTradeOrderLine[]): number {
  if (!cell) return 0;
  if (cell.isInbegrepen) return 0;

  if (cell.totalPriceCents !== undefined && cell.totalPriceCents !== null && cell.totalPriceCents > 0) {
    return cell.totalPriceCents;
  }

  if (cell.line && rawLines && rawLines.length > 0) {
    const rawLine = rawLines.find((l) => l.line === cell.line);
    if (rawLine) {
      return rawLine.totalCents;
    }
  }

  return 0;
}

/**
 * Berekent het geaggregeerde ruimtetotaal in integer centen door over alle posities en producten te sommeren.
 * Normaliseert compound keys (${positionId}__${subPos}) naar de basis-positie ID.
 */
export function calculateRoomTotalCents(
  room: Room,
  products: MatrixProduct[],
  rawLines?: LogicTradeOrderLine[]
): number {
  let sum = 0;
  const posIds = new Set(room.positions.map((p) => p.id));

  for (const product of products) {
    for (const [posId, cellData] of Object.entries(product.posPrices)) {
      // Normaliseer compound keys zoals 'pos_wk_pui__a' naar 'pos_wk_pui'
      const basePosId = posId.includes('__') ? posId.split('__')[0] : posId;
      if (posIds.has(basePosId)) {
        sum += resolveCellPriceCents(cellData, rawLines);
      }
    }
  }

  return sum;
}

/**
 * Berekent het geaggregeerde etagetotaal in integer centen door over alle ruimtes in de etage te sommeren.
 */
export function calculateEtageTotalCents(
  etage: Etage,
  products: MatrixProduct[],
  rawLines?: LogicTradeOrderLine[]
): number {
  return etage.rooms.reduce((acc, room) => {
    return acc + calculateRoomTotalCents(room, products, rawLines);
  }, 0);
}

/**
 * Berekent het totale orderbedrag in centen (som van alle etages plus eventuele algemene projectscope posten).
 * Ondersteunt zowel 'pos_project_algemeen' als 'pos-gen' als sleutels voor de algemene scope.
 */
export function calculateOrderTotalCents(order: MatrixOrder): number {
  let etagesTotal = order.etages.reduce((acc, etage) => {
    return acc + calculateEtageTotalCents(etage, order.products, order.rawLines);
  }, 0);

  // Algemene posten (bijv. inmeetservice of projectscope posten op kolom "Algemeen")
  for (const product of order.products) {
    const genCell = product.posPrices['pos_project_algemeen'] || product.posPrices['pos-gen'];
    if (genCell) {
      etagesTotal += resolveCellPriceCents(genCell, order.rawLines);
    }
  }

  return etagesTotal;
}
