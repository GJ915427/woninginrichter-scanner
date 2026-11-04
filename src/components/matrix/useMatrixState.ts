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
  const [columnSelectMode, setColumnSelectMode] = useState<boolean>(false);
  const [selectedColumnIds, setSelectedColumnIds] = useState<Set<string>>(new Set());

  // Single-Active Overlay State Machine Coordinator
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay | null>(null);
  const [highlightedCellKey, setHighlightedCellKey] = useState<string | null>(null);

  // Filter & UI instellingen
  const [activeMediaTab, setActiveMediaTab] = useState<'foto' | 'video' | 'opmerking'>('foto');
  const [mediaContextFilter, setMediaContextFilter] = useState<'position' | 'room' | 'project'>('project');
  const [rollupLevel, setRollupLevel] = useState<RollupLevel>('positie');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

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

  // Header Collapse State
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);

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

  const toggleColumnSelectMode = useCallback(() => {
    setColumnSelectMode((prev) => {
      if (prev) {
        setSelectedColumnIds(new Set());
      }
      return !prev;
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

  // CRUD: Cel bijwerken met automatische CPQ herberekening
  const updateCell = useCallback(
    (cellKey: string, updates: Partial<CellPriceData>, productId?: string) => {
      const { positionId, subPos } = parseCellKey(cellKey);

      setOrders((prev) =>
        prev.map((order, idx) => {
          if (idx !== currentOrderIndex) return order;

          const updatedProducts = order.products.map((product) => {
            if (productId && product.id !== productId) {
              return product;
            }
            const currentCell = resolveCellData(product, positionId, subPos);
            if (!currentCell) return product;

            const updatedCell: CellPriceData = {
              ...currentCell,
              ...updates,
            };

            const key = buildCellKey(positionId, subPos);
            return {
              ...product,
              posPrices: {
                ...product.posPrices,
                [key]: updatedCell,
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

  return {
    orders,
    currentOrderIndex,
    selectedOrder,
    fsmStage,
    setFsmStage,
    columnSelectMode,
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
    // Niveau-Zichtbaarheid & Header Collapse (V5)
    visibleLevels,
    setVisibleLevels,
    toggleLevelVisibility,
    isHeaderCollapsed,
    setIsHeaderCollapsed,
    // Handlers
    selectOrder,
    goToNextOrder,
    goToPreviousOrder,
    toggleColumnSelection,
    toggleColumnSelectMode,
    clearColumnSelection,
    addMediaItem,
    updateQuantity,
    deletePosition,
    updateCell,
    assignProductToCell,
    assignVlakToPosition,
    mergePositionsToCluster,
    dissolveCluster,
  };
}
