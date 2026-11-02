/**
 * src/utils/matrix-overlay-state.ts
 *
 * Pure reducer- en helper-functies voor de Matrix Overlay State Coordinator en referentiële data-integriteit.
 * 100% zuiver functioneel zonder React hooks; deterministisch testbaar in Node.js Vitest (Zero DOM dependency).
 */

import { ActiveOverlay, CellPriceData, MatrixOrder, MatrixProduct } from '../types/matrix';
import { calculateOrderTotalCents } from './matrix-pricing';

export type OverlayAction =
  | { type: 'OPEN'; payload: ActiveOverlay }
  | { type: 'CLOSE' };

/**
 * Pure state reducer voor de Single-Active Overlay Coordinator.
 * Garandeert dat het openen van een overlay eerdere overlays direct atomair overschrijft.
 */
export function matrixOverlayReducer(
  state: ActiveOverlay | null,
  action: OverlayAction
): ActiveOverlay | null {
  switch (action.type) {
    case 'OPEN':
      return action.payload;
    case 'CLOSE':
      return null;
    default:
      return state;
  }
}

/**
 * Construeert een consistente sleutel voor celopslag in posPrices.
 * Gebruikt compound keys (`${positionId}__${subPos}`) bij gesplitste regels.
 */
export function buildCellKey(positionId: string, subPos?: string): string {
  if (subPos && subPos.trim() !== '') {
    return `${positionId}__${subPos.trim()}`;
  }
  return positionId;
}

/**
 * Parseert een cel-sleutel naar de basis-positie ID en optionele sub-positie letter.
 */
export function parseCellKey(cellKey: string): { positionId: string; subPos?: string } {
  if (cellKey.includes('__')) {
    const [posId, sub] = cellKey.split('__');
    return { positionId: posId, subPos: sub };
  }
  return { positionId: cellKey };
}

/**
 * Resolvet de CellPriceData voor een product op een positie, met fallback van compound key naar basis-key.
 */
export function resolveCellData(
  product: MatrixProduct,
  positionId: string,
  subPos?: string
): CellPriceData | undefined {
  if (!product.posPrices) return undefined;

  if (subPos) {
    const compoundKey = buildCellKey(positionId, subPos);
    if (product.posPrices[compoundKey]) {
      return product.posPrices[compoundKey];
    }
  }

  return product.posPrices[positionId];
}

/**
 * Evalueert of een touch- of pointerbeweging de verplaatsingsdrempel overschrijdt (standaard 10px).
 * Gebruikt voor het annuleren van 500ms long-press timers tijdens vloeiend scrollen.
 */
export function isGestureBeyondThreshold(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  thresholdPx = 10
): boolean {
  const deltaX = currentX - startX;
  const deltaY = currentY - startY;
  return Math.hypot(deltaX, deltaY) > thresholdPx;
}

/**
 * Voert een 4-ledige referentiële cascading verwijdering uit van een positie:
 * 1. Filtert de positie uit de betreffende Room.positions.
 * 2. Wist atomair alle basis-sleutels én compound-sleutels (`${posId}__*`) uit alle MatrixProduct.posPrices.
 * 3. Filtert de posId uit alle Room.clusters[].positionIds en snoeit lege clusters (positionIds.length === 0).
 * 4. Herrekent het totale orderbedrag (order.totaalbedragCents) atomair via de CPQ engine.
 */
export function cascadeDeletePosition(order: MatrixOrder, positionId: string): MatrixOrder {
  // 1 & 3: Etages en ruimtes bijwerken (posities filteren en clusters snoeien)
  const updatedEtages = order.etages.map((etage) => ({
    ...etage,
    rooms: etage.rooms.map((room) => {
      const remainingPositions = room.positions.filter((p) => p.id !== positionId);
      const remainingClusters = (room.clusters || [])
        .map((cl) => ({
          ...cl,
          positionIds: cl.positionIds.filter((id) => id !== positionId),
        }))
        .filter((cl) => cl.positionIds.length > 0);

      return {
        ...room,
        positions: remainingPositions,
        clusters: remainingClusters,
      };
    }),
  }));

  // 2: Cellen en compound keys wissen in alle producten
  const updatedProducts = order.products.map((product) => {
    const newPosPrices: Record<string, CellPriceData> = {};
    for (const [key, val] of Object.entries(product.posPrices)) {
      if (key !== positionId && !key.startsWith(`${positionId}__`)) {
        newPosPrices[key] = val;
      }
    }
    return {
      ...product,
      posPrices: newPosPrices,
    };
  });

  // 4: Order samenstellen en atomair ordertotaal herberekenen
  const tempOrder: MatrixOrder = {
    ...order,
    etages: updatedEtages,
    products: updatedProducts,
  };

  const newTotalCents = calculateOrderTotalCents(tempOrder);

  return {
    ...tempOrder,
    totaalbedragCents: newTotalCents,
  };
}

/**
 * Muteert of voegt een cel toe in een order en synchroniseert het ordertotaal atomair.
 */
export function updateCellInOrder(
  order: MatrixOrder,
  productId: string,
  positionId: string,
  cellData: CellPriceData,
  subPos?: string
): MatrixOrder {
  const cellKey = buildCellKey(positionId, subPos || cellData.subPos);

  const updatedProducts = order.products.map((product) => {
    if (product.id !== productId) return product;

    return {
      ...product,
      posPrices: {
        ...product.posPrices,
        [cellKey]: cellData,
      },
    };
  });

  const tempOrder: MatrixOrder = {
    ...order,
    products: updatedProducts,
  };

  const newTotalCents = calculateOrderTotalCents(tempOrder);

  return {
    ...tempOrder,
    totaalbedragCents: newTotalCents,
  };
}

/**
 * Voegt posities samen in een cluster binnen een specifieke ruimte.
 * Verwijdert de opgegeven posities eerst uit eventuele bestaande clusters in die ruimte om duplicaten te voorkomen.
 */
export function mergePositionsIntoCluster(
  order: MatrixOrder,
  roomId: string,
  clusterName: string,
  positionIds: string[]
): MatrixOrder {
  if (!positionIds || positionIds.length === 0) return order;

  const posSet = new Set(positionIds);

  const updatedEtages = order.etages.map((etage) => ({
    ...etage,
    rooms: etage.rooms.map((room) => {
      if (room.id !== roomId) return room;

      // 1. Verwijder deze posities uit bestaande clusters
      const cleanedClusters = (room.clusters || [])
        .map((cl) => ({
          ...cl,
          positionIds: cl.positionIds.filter((id) => !posSet.has(id)),
        }))
        .filter((cl) => cl.positionIds.length > 0);

      // 2. Bestaat er al een cluster met exact deze naam?
      const existingIdx = cleanedClusters.findIndex(
        (cl) => cl.name.trim().toLowerCase() === clusterName.trim().toLowerCase()
      );

      const finalClusters = [...cleanedClusters];
      if (existingIdx >= 0) {
        const existing = finalClusters[existingIdx];
        const mergedIds = Array.from(new Set([...existing.positionIds, ...positionIds]));
        finalClusters[existingIdx] = {
          ...existing,
          positionIds: mergedIds,
        };
      } else {
        finalClusters.push({
          id: `cluster-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: clusterName.trim(),
          positionIds: Array.from(posSet),
        });
      }

      return {
        ...room,
        clusters: finalClusters,
      };
    }),
  }));

  return {
    ...order,
    etages: updatedEtages,
  };
}

/**
 * Wijst een bouwkundig vlak (bv. 'Wand Voorgevel', 'Erker') toe aan een specifieke positie.
 */
export function assignVlakToPositionInOrder(
  order: MatrixOrder,
  positionId: string,
  vlak: string
): MatrixOrder {
  const updatedEtages = order.etages.map((etage) => ({
    ...etage,
    rooms: etage.rooms.map((room) => ({
      ...room,
      positions: room.positions.map((pos) => {
        if (pos.id !== positionId) return pos;
        return {
          ...pos,
          vlak: vlak.trim(),
        };
      }),
    })),
  }));

  return {
    ...order,
    etages: updatedEtages,
  };
}

/**
 * Ontbindt een specifiek cluster in een ruimte zonder de onderliggende posities te verwijderen.
 */
export function dissolveClusterInOrder(
  order: MatrixOrder,
  roomId: string,
  clusterId: string
): MatrixOrder {
  const updatedEtages = order.etages.map((etage) => ({
    ...etage,
    rooms: etage.rooms.map((room) => {
      if (room.id !== roomId) return room;
      return {
        ...room,
        clusters: (room.clusters || []).filter((cl) => cl.id !== clusterId),
      };
    }),
  }));

  return {
    ...order,
    etages: updatedEtages,
  };
}

/**
 * Zoekt de unieke cel-sleutel en productId behorende bij een ERP orderregelnummer.
 * Wordt gebruikt voor de interactieve koppeling vanuit de LogicTrade Audit-Trail tabel.
 */
export function findCellKeyByOrderLine(
  order: MatrixOrder,
  line: number
): { productId: string; cellKey: string } | null {
  for (const product of order.products) {
    if (!product.posPrices) continue;
    for (const [cellKey, cellData] of Object.entries(product.posPrices)) {
      if (cellData && cellData.line === line) {
        return {
          productId: product.id,
          cellKey,
        };
      }
    }
  }
  return null;
}

export function findOrderLineByCompoundKey(
  order: MatrixOrder,
  compoundKey: string | null
): number | null {
  if (!compoundKey) return null;
  for (const product of order.products) {
    if (!product.posPrices) continue;
    for (const [cellKey, cellData] of Object.entries(product.posPrices)) {
      if (cellData && `${product.id}-${cellKey}` === compoundKey) {
        return cellData.line ?? null;
      }
    }
  }
  return null;
}
