/**
 * src/lib/matrix/matrix-mutation-engine.ts
 *
 * Pure headless reducer- en calculatie-engine voor Matrix Order celmutaties.
 * 100% zuiver functioneel zonder React hooks of browser DOM afhankelijkheden;
 * garandeert Server CPQ pariteit, sub-line normalisatie en snapshot rollback in Node Vitest.
 */

import type { MatrixOrder, CellPriceData, MatrixProduct } from '@/types/matrix';
import { calculateOrderTotalCents } from '@/utils/matrix-pricing';
import { buildCellKey, parseCellKey, resolveCellData } from '@/utils/matrix-overlay-state';

export interface CellSnapshot {
  orderId: string;
  productId: string;
  positionId: string;
  subPos?: string;
  previousCellData?: CellPriceData;
  previousOrderTotalCents: number;
}

export interface CellMutationInput {
  productId: string;
  positionId: string;
  subPos?: string;
  patch: Partial<CellPriceData>;
}

/**
 * Normaliseert polymorfe subPos waarden (strings, letters, undefined)
 * deterministisch naar een geldige integer voor PostgreSQL.
 */
export function normalizeSubLine(subPos?: string): number {
  if (!subPos) return 0;
  const trimmed = subPos.trim();
  if (!trimmed) return 0;

  // Indien puur numeriek (e.g. "1", "12")
  const parsed = parseInt(trimmed, 10);
  if (!isNaN(parsed) && String(parsed) === trimmed) {
    return Math.max(0, parsed);
  }

  // Bij samengestelde vormen zoals "sub_1", match digits
  const digitMatch = trimmed.match(/\d+/);
  if (digitMatch) {
    const val = parseInt(digitMatch[0], 10);
    return isNaN(val) ? 0 : Math.max(0, val);
  }

  // Letters ("a", "b", etc.) of ongeldige tokens vallen veilig terug op basis-lijn 0
  return 0;
}

/**
 * Berekent het regelbedrag in integer centen met Server CPQ integriteit.
 * Dwingt 0 cent af voor inbegrepen stelposten (€0-bescherming).
 */
export function calculateLineTotalCents(
  quantity: number,
  unitPriceCents: number,
  isInbegrepen?: boolean
): number {
  if (isInbegrepen) {
    return 0;
  }
  const safeQty = Number.isFinite(quantity) ? quantity : 0;
  const safeUnit = Number.isFinite(unitPriceCents) ? unitPriceCents : 0;
  return Math.round(safeQty * safeUnit);
}

/**
 * Maakt een lichtgewicht snapshot van een cel en het ordertotaal vóór mutatie.
 */
export function createCellSnapshot(
  order: MatrixOrder,
  productId: string,
  positionId: string,
  subPos?: string
): CellSnapshot {
  const product = order.products.find((p) => p.id === productId);
  const currentCell = product ? resolveCellData(product, positionId, subPos) : undefined;

  return {
    orderId: order.id,
    productId,
    positionId,
    subPos,
    previousCellData: currentCell ? { ...currentCell } : undefined,
    previousOrderTotalCents: order.totaalbedragCents,
  };
}

/**
 * Past een celpatch immutabel toe op de MatrixOrder en herrekent het ordertotaal.
 */
export function applyCellPatch(
  order: MatrixOrder,
  mutation: CellMutationInput
): MatrixOrder {
  const { productId, positionId, subPos, patch } = mutation;
  const cellKey = buildCellKey(positionId, subPos);

  const updatedProducts: MatrixProduct[] = order.products.map((product) => {
    if (product.id !== productId) {
      return product;
    }

    const currentCell = resolveCellData(product, positionId, subPos) || {
      quantity: 1,
      unitPriceCents: 0,
      totalPriceCents: 0,
      unit: product.unit || 'stuks',
    };

    const newQuantity = patch.quantity !== undefined ? patch.quantity : currentCell.quantity;
    const newUnitPrice = patch.unitPriceCents !== undefined ? patch.unitPriceCents : currentCell.unitPriceCents;
    const newIsInbegrepen = patch.isInbegrepen !== undefined ? patch.isInbegrepen : currentCell.isInbegrepen;

    const newTotalPrice = patch.totalPriceCents !== undefined
      ? patch.totalPriceCents
      : calculateLineTotalCents(newQuantity, newUnitPrice, newIsInbegrepen);

    const updatedCell: CellPriceData = {
      ...currentCell,
      ...patch,
      quantity: newQuantity,
      unitPriceCents: newUnitPrice,
      totalPriceCents: newTotalPrice,
      isInbegrepen: newIsInbegrepen,
    };

    return {
      ...product,
      posPrices: {
        ...product.posPrices,
        [cellKey]: updatedCell,
      },
    };
  });

  const nextOrder: MatrixOrder = {
    ...order,
    products: updatedProducts,
  };

  const recalculatedTotal = calculateOrderTotalCents(nextOrder);
  nextOrder.totaalbedragCents = recalculatedTotal;

  return nextOrder;
}

/**
 * Rolt een celpatch immutabel terug naar de waarden uit het snapshot.
 */
export function rollbackCellPatch(
  order: MatrixOrder,
  snapshot: CellSnapshot
): MatrixOrder {
  const { productId, positionId, subPos, previousCellData, previousOrderTotalCents } = snapshot;
  const cellKey = buildCellKey(positionId, subPos);

  const updatedProducts: MatrixProduct[] = order.products.map((product) => {
    if (product.id !== productId) {
      return product;
    }

    const newPosPrices = { ...product.posPrices };
    if (previousCellData) {
      newPosPrices[cellKey] = { ...previousCellData };
    } else {
      delete newPosPrices[cellKey];
    }

    return {
      ...product,
      posPrices: newPosPrices,
    };
  });

  return {
    ...order,
    products: updatedProducts,
    totaalbedragCents: previousOrderTotalCents,
  };
}
