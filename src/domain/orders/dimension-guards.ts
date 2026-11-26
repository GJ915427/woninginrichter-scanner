/**
 * src/domain/orders/dimension-guards.ts
 *
 * SSOT Dimensie-Guards en fysieke integriteitsfuncties:
 * - Fysieke grensbewaking [100, 12000] mm
 * - Type-guards voor numerieke dimensies
 * - Parser voor LogicTrade item-dimensietokens (voorkomt opschaling van kale tellers '1'..'9')
 */

export const MIN_DIMENSION_MM = 100;
export const MAX_DIMENSION_MM = 12000;

export function hasFiniteNumericDimension(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

export function isValidErpDimension(val: unknown): val is number {
  return hasFiniteNumericDimension(val) && val >= MIN_DIMENSION_MM && val <= MAX_DIMENSION_MM;
}

export function isSubMinimumErpDimension(val: unknown): boolean {
  return hasFiniteNumericDimension(val) && val > 0 && val < MIN_DIMENSION_MM;
}

export function isOutlierDimension(val: unknown): boolean {
  return hasFiniteNumericDimension(val) && val > MAX_DIMENSION_MM;
}

export function isOutOfPhysicalBoundsDimension(val: unknown): boolean {
  return (
    hasFiniteNumericDimension(val) &&
    (val < 0 || (val > 0 && val < MIN_DIMENSION_MM) || val > MAX_DIMENSION_MM)
  );
}

/**
 * Converteert een item-dimensietoken uit LogicTrade configuration.items naar millimeters.
 * Voorkomt dat kale een-cijferige tellers/aantallen ("1", "2", "6") zonder eenheid en zonder
 * decimaalteken abusievelijk worden opgeschaald naar 1000..9000 mm.
 * Retourneert 0 voor expliciete '0' (1D losse koof/rail signaal) en null voor niet-dimensie tokens.
 */
export function parseItemDimensionToMm(rawVal: string, unit?: string): number | null {
  const trimmed = rawVal.trim();
  if (!trimmed) return null;

  const val = parseFloat(trimmed.replace(',', '.'));
  if (!Number.isFinite(val)) return null;
  if (val === 0 && !unit) return 0;

  const u = (unit || '').toLowerCase().trim();
  if (u === 'm' || u === 'mtr' || u === 'meter') {
    return Math.round(val * 1000);
  }
  if (u === 'cm') {
    return Math.round(val * 10);
  }
  if (u === 'mm') {
    return Math.round(val);
  }

  // Zonder eenheid: schaal < 10 uitsluitend als het een decimaal getal betreft ("2,45", "1.8"),
  // nooit voor kale een-cijferige integers ("1".."9" aantallen/indices).
  if (val > 0 && val < 10) {
    if (!/[.,]/.test(trimmed)) return null;
    return Math.round(val * 1000);
  }

  return Math.round(val);
}
