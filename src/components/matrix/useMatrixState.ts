import { useState, useCallback, useMemo } from 'react';
import { MatrixOrder, RollupLevel, CellPriceData, ActiveOverlay, HeaderLevelVisibility, MediaItem } from '../../types/matrix';
import { MATRIX_ORDERS_MOCK_DATA } from '../../fixtures/matrix-mock-data';
import {
  cascadeDeletePosition,
  buildCellKey,
  parseCellKey,
  resolveCellData,
  assignVlakToPositionInOrder,
  dissolveClusterInOrder,
  mergePositionsIntoCluster,
} from '../../utils/matrix-overlay-state';
import { calculateOrderTotalCents } from '../../utils/matrix-pricing';
import {
  applyCellPatch,
  createCellSnapshot,
  rollbackCellPatch,
  normalizeSubLine,
} from '../../lib/matrix/matrix-mutation-engine';
import { updateMatrixCellRpc } from '../../lib/supabase/order-mutation-client';
import { fetchMatrixOrderBundle } from '../../hooks/useMatrixOrderBundle';

export interface ActiveStepperState {
  productId: string;
  positionId: string;
}

/**
 * State orchestration hook voor de Matrix Orders Browser.
 * Enforces Single-Active Overlay Coordinator conform INV-GOV-21.
 * Biedt CRUD cascading opschoning en deterministische CPQ herberekening.
 */
export function useMatrixState(initialOrders: MatrixOrder[] = MATRIX_ORDERS_MOCK_DATA) {
  const [orders, setOrders] = useState<MatrixOrder[]>(initialOrders);
  const [currentOrderIndex, setCurrentOrderIndex] = useState<number>(2); // Jaspers (V26001376)
  const [fsmStage, setFsmStage] = useState<number>(5); // Bestellen (Actueel)
  const [selectedColumnIds, setSelectedColumnIds] = useState<Set<string>>(new Set());

  // Single-Active Overlay State Machine Coordinator
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay | null>(null);
  const [highlightedCellKey, setHighlightedCellKey] = useState<string | null>(null);

  // Filter & UI instellingen
  const [activeMediaTab, setActiveMediaTab] = useState<'foto' | 'video' | 'opmerking'>('foto');
  const [mediaContextFilter, setMediaContextFilter] = useState<'position' | 'room' | 'project'>('project');
  const [rollupLevel, setRollupLevel] = useState<RollupLevel>('positie');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isOrderLoading, setIsOrderLoading] = useState<boolean>(false);
  const [statusAlert, setStatusAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Niveau-Zichtbaarheid State (V5)
  const [visibleLevels, setVisibleLevels] = useState<HeaderLevelVisibility>({
    etage: true,
    ruimte: true,
    cluster: true,
    positie: true,
  });

  const toggleLevelVisibility = useCallback((level: 'etage' | 'ruimte' | 'cluster') => {
    setVisibleLevels((prev) => ({
      ...prev,
      [level]: !prev[level],
    }));
  }, []);

  const hydrateOrderBundle = useCallback((orderBundle: MatrixOrder) => {
    setOrders((prev) => {
      const idx = prev.findIndex((o) => o.id === orderBundle.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = orderBundle;
        return next;
      }
      return [orderBundle, ...prev];
    });
    setCurrentOrderIndex(0);
  }, []);

  const selectedOrder = useMemo(() => {
    return orders[currentOrderIndex] ?? orders[0];
  }, [orders, currentOrderIndex]);

  // Backwards-compatible afgeleide velden voor legacy componenten
  const activeStepper: ActiveStepperState | null = useMemo(() => {
    if (activeOverlay?.type === 'stepper' && activeOverlay.productId && activeOverlay.positionId) {
      return { productId: activeOverlay.productId, positionId: activeOverlay.positionId };
    }
    return null;
  }, [activeOverlay]);

  const activeDrawer = useMemo<'media' | 'product' | null>(() => {
    if (activeOverlay?.type === 'media' || activeOverlay?.type === 'media_drawer') return 'media';
    if (activeOverlay?.type === 'cell_edit') return 'product';
    return null;
  }, [activeOverlay]);

  const openOverlay = useCallback((overlay: ActiveOverlay) => {
    setActiveOverlay(overlay);
  }, []);

  const closeOverlay = useCallback(() => {
    setActiveOverlay(null);
  }, []);

  const selectOrder = useCallback((index: number) => {
    if (index >= 0 && index < orders.length) {
      setCurrentOrderIndex(index);
      setActiveOverlay(null);
      setSelectedColumnIds(new Set());
    }
  }, [orders.length]);

  const toggleColumnSelection = useCallback((posId: string) => {
    setSelectedColumnIds((prev) => {
      const next = new Set(prev);
      if (next.has(posId)) {
        next.delete(posId);
      } else {
        next.add(posId);
      }
      return next;
    });
  }, []);

  const clearColumnSelection = useCallback(() => {
    setSelectedColumnIds(new Set());
  }, []);

  // Media & Notities toevoegen met automatische synchronisatie
  const addMediaItem = useCallback(
    (item: MediaItem) => {
      setOrders((prev) =>
        prev.map((order, idx) => {
          if (idx !== currentOrderIndex) return order;
          const currentMedia = order.media ?? [];
          return {
            ...order,
            media: [item, ...currentMedia],
          };
        })
      );
    },
    [currentOrderIndex]
  );

  // Legacy stepper handlers gemapt naar Single-Active Coordinator
  const openStepper = useCallback((productId: string, positionId: string) => {
    setActiveOverlay({ type: 'stepper', productId, positionId });
  }, []);

  const closeStepper = useCallback(() => {
    setActiveOverlay(null);
  }, []);

  const setActiveDrawer = useCallback((drawer: 'media' | 'product' | null) => {
    if (!drawer) {
      setActiveOverlay(null);
    } else if (drawer === 'media') {
      setActiveOverlay({ type: 'media' });
    }
  }, []);

  // CRUD: Verwijderen van een positie met 4-voudige cascade opschoning
  const deletePosition = useCallback(
    (posId: string) => {
      const updatedOrder = cascadeDeletePosition(selectedOrder, posId);

      setSelectedColumnIds((prev) => {
        const next = new Set(prev);
        next.delete(posId);
        return next;
      });

      setOrders((prev) =>
        prev.map((ord, idx) => (idx === currentOrderIndex ? updatedOrder : ord))
      );

      if (activeOverlay && 'positionId' in activeOverlay && activeOverlay.positionId === posId) {
        setActiveOverlay(null);
      }
    },
    [selectedOrder, currentOrderIndex, activeOverlay]
  );

  // CRUD: Cel bijwerken met automatische CPQ herberekening en optionele persistentie
  const updateCell = useCallback(
    (cellKey: string, updates: Partial<CellPriceData>, productId?: string) => {
      const { positionId, subPos } = parseCellKey(cellKey);
      const targetOrder = orders[currentOrderIndex];
      if (!targetOrder) return;

      const targetProduct = targetOrder.products.find((p) => !productId || p.id === productId);
      const targetCell = targetProduct ? resolveCellData(targetProduct, positionId, subPos) : undefined;
      const snapshot = targetProduct ? createCellSnapshot(targetOrder, targetProduct.id, positionId, subPos) : null;

      // 1. Optimistic Update in React state via pure mutation engine
      if (targetProduct) {
        const nextOrder = applyCellPatch(targetOrder, {
          productId: targetProduct.id,
          positionId,
          subPos,
          patch: updates,
        });

        setOrders((prev) =>
          prev.map((ord, idx) => (idx === currentOrderIndex ? nextOrder : ord))
        );
      }

      // 2. Database persistentie indien live order
      if (targetOrder.isLive && targetProduct && targetCell?.line) {
        const lineNum = targetCell.line;
        const subLineNum = normalizeSubLine(subPos);

        updateMatrixCellRpc({
          orderId: targetOrder.id,
          lineNumber: lineNum,
          subLine: subLineNum,
          patch: updates,
        }).then((res) => {
          if (res.success) {
            setStatusAlert({ message: 'Wijziging opgeslagen in database.', type: 'success' });
            setTimeout(() => setStatusAlert(null), 3000);
          } else if (snapshot) {
            setOrders((prev) =>
              prev.map((ord, idx) => (idx === currentOrderIndex ? rollbackCellPatch(ord, snapshot) : ord))
            );
            setStatusAlert({ message: `Opslaan mislukt: ${res.error || 'Databasefout'}`, type: 'error' });
          }
        }).catch((err) => {
          if (snapshot) {
            setOrders((prev) =>
              prev.map((ord, idx) => (idx === currentOrderIndex ? rollbackCellPatch(ord, snapshot) : ord))
            );
          }
          setStatusAlert({ message: `Netwerkfout bij opslaan: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
        });
      }
    },
    [currentOrderIndex, orders]
  );

  // CRUD: Product toewijzen aan lege cel
  const assignProductToCell = useCallback(
    (productId: string, positionId: string, subPos?: string, initialData?: Partial<CellPriceData>) => {
      const key = buildCellKey(positionId, subPos);
      const defaultCell: CellPriceData = {
        quantity: 1,
        unit: 'stuks',
        unitPriceCents: 15000,
        totalPriceCents: 15000,
        pricingMode: 'unit',
        isCalculated: true,
        ...initialData,
      };

      setOrders((prev) =>
        prev.map((order, idx) => {
          if (idx !== currentOrderIndex) return order;

          const updatedProducts = order.products.map((p) => {
            if (p.id !== productId) return p;
            return {
              ...p,
              posPrices: {
                ...p.posPrices,
                [key]: defaultCell,
              },
            };
          });

          const intermediateOrder = { ...order, products: updatedProducts };
          const recalculatedTotal = calculateOrderTotalCents(intermediateOrder);

          return {
            ...intermediateOrder,
            totaalbedragCents: recalculatedTotal,
          };
        })
      );
    },
    [currentOrderIndex]
  );

  // Legacy quantity incrementer
  const updateQuantity = useCallback(
    (productId: string, positionId: string, delta: number) => {
      const key = positionId;
      const product = selectedOrder.products.find((p) => p.id === productId);
      const currentCell = product?.posPrices[key];
      if (!currentCell) return;

      const newQty = Math.max(0, currentCell.quantity + delta);
      const newTotal = newQty * (currentCell.unitPriceCents || 0);

      updateCell(key, { quantity: newQty, totalPriceCents: newTotal }, productId);
    },
    [selectedOrder, updateCell]
  );

  const assignVlakToPosition = useCallback(
    (posId: string, vlak: string) => {
      const updatedOrder = assignVlakToPositionInOrder(selectedOrder, posId, vlak);
      setOrders((prev) =>
        prev.map((ord, idx) => (idx === currentOrderIndex ? updatedOrder : ord))
      );
    },
    [selectedOrder, currentOrderIndex]
  );

  const mergePositionsToCluster = useCallback(
    (roomId: string, clusterName: string, positionIds: string[]) => {
      const updatedOrder = mergePositionsIntoCluster(
        selectedOrder,
        roomId,
        clusterName,
        positionIds
      );
      setOrders((prev) =>
        prev.map((ord, idx) => (idx === currentOrderIndex ? updatedOrder : ord))
      );
      setSelectedColumnIds(new Set());
    },
    [selectedOrder, currentOrderIndex]
  );

  const dissolveCluster = useCallback(
    (roomId: string, clusterId: string) => {
      const updatedOrder = dissolveClusterInOrder(selectedOrder, roomId, clusterId);
      setOrders((prev) =>
        prev.map((ord, idx) => (idx === currentOrderIndex ? updatedOrder : ord))
      );
    },
    [selectedOrder, currentOrderIndex]
  );

  const goToNextOrder = useCallback(() => {
    setCurrentOrderIndex((prev) => Math.min(orders.length - 1, prev + 1));
    setActiveOverlay(null);
    setSelectedColumnIds(new Set());
    setHighlightedCellKey(null);
  }, [orders.length]);

  const goToPreviousOrder = useCallback(() => {
    setCurrentOrderIndex((prev) => Math.max(0, prev - 1));
    setActiveOverlay(null);
    setSelectedColumnIds(new Set());
    setHighlightedCellKey(null);
  }, []);

  const selectOrderById = useCallback(
    async (orderId: string) => {
      if (!orderId || !orderId.trim()) return;
      const cleanId = orderId.trim();
      const existingIdx = orders.findIndex((o) => o.id === cleanId);
      if (existingIdx >= 0) {
        setCurrentOrderIndex(existingIdx);
        setActiveOverlay(null);
        setSelectedColumnIds(new Set());
        return;
      }

      setIsOrderLoading(true);
      try {
        const bundle = await fetchMatrixOrderBundle(cleanId);
        if (bundle) {
          setOrders((prev) => [bundle, ...prev]);
          setCurrentOrderIndex(0);
          setActiveOverlay(null);
          setSelectedColumnIds(new Set());
        } else {
          setStatusAlert({ message: `Order ${cleanId} kon niet worden opgehaald.`, type: 'error' });
        }
      } catch (err) {
        setStatusAlert({
          message: `Fout bij laden van order ${cleanId}: ${err instanceof Error ? err.message : String(err)}`,
          type: 'error',
        });
      } finally {
        setIsOrderLoading(false);
      }
    },
    [orders]
  );

  return {
    orders,
    currentOrderIndex,
    selectedOrder,
    selectOrderById,
    isOrderLoading,
    statusAlert,
    setStatusAlert,
    fsmStage,
    setFsmStage,
    selectedColumnIds,
    activeOverlay,
    openOverlay,
    closeOverlay,
    highlightedCellKey,
    setHighlightedCellKey,
    // Backwards compatibility
    activeStepper,
    activeDrawer,
    openStepper,
    closeStepper,
    setActiveDrawer,
    // Media & UI
    activeMediaTab,
    setActiveMediaTab,
    mediaContextFilter,
    setMediaContextFilter,
    rollupLevel,
    setRollupLevel,
    sidebarOpen,
    setSidebarOpen,
    // Niveau-Zichtbaarheid (V5)
    visibleLevels,
    setVisibleLevels,
    toggleLevelVisibility,
    // Handlers
    selectOrder,
    goToNextOrder,
    goToPreviousOrder,
    toggleColumnSelection,
    clearColumnSelection,
    addMediaItem,
    updateQuantity,
    deletePosition,
    updateCell,
    assignProductToCell,
    assignVlakToPosition,
    mergePositionsToCluster,
    dissolveCluster,
    setOrders,
    hydrateOrderBundle,
  };
}
