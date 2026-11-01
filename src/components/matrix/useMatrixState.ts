'use client';

import { useState, useCallback, useMemo } from 'react';
import { MatrixOrder, RollupLevel, CellPriceData } from '../../types/matrix';
import { MATRIX_ORDERS_MOCK_DATA } from '../../fixtures/matrix-mock-data';

export interface ActiveStepperState {
  productId: string;
  positionId: string;
}

export function useMatrixState(initialOrders: MatrixOrder[] = MATRIX_ORDERS_MOCK_DATA) {
  const [orders, setOrders] = useState<MatrixOrder[]>(initialOrders);
  const [currentOrderIndex, setCurrentOrderIndex] = useState<number>(2); // Default to Jaspers (V26001376)
  const [fsmStage, setFsmStage] = useState<number>(5); // Default to Bestellen (Actueel)
  const [columnSelectMode, setColumnSelectMode] = useState<boolean>(false);
  const [selectedColumnIds, setSelectedColumnIds] = useState<Set<string>>(new Set());
  const [activeStepper, setActiveStepper] = useState<ActiveStepperState | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<'media' | 'product' | null>(null);
  const [activeMediaTab, setActiveMediaTab] = useState<'foto' | 'video' | 'opmerking'>('foto');
  const [rollupLevel, setRollupLevel] = useState<RollupLevel>('positie');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  const selectedOrder = useMemo(() => {
    return orders[currentOrderIndex] ?? orders[0];
  }, [orders, currentOrderIndex]);

  const selectOrder = useCallback((index: number) => {
    if (index >= 0 && index < orders.length) {
      setCurrentOrderIndex(index);
      setActiveStepper(null);
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

  const openStepper = useCallback((productId: string, positionId: string) => {
    setActiveStepper({ productId, positionId });
  }, []);

  const closeStepper = useCallback(() => {
    setActiveStepper(null);
  }, []);

  const updateQuantity = useCallback((productId: string, positionId: string, delta: number) => {
    setOrders((prevOrders) => {
      return prevOrders.map((order, idx) => {
        if (idx !== currentOrderIndex) return order;

        const updatedProducts = order.products.map((product) => {
          if (product.id !== productId) return product;

          const currentCell: CellPriceData | undefined = product.posPrices[positionId];
          if (!currentCell) return product;

          const newQty = Math.max(0, currentCell.quantity + delta);
          const newTotalPrice = newQty * currentCell.unitPriceCents;

          const updatedCell: CellPriceData = {
            ...currentCell,
            quantity: newQty,
            totalPriceCents: newTotalPrice,
          };

          return {
            ...product,
            posPrices: {
              ...product.posPrices,
              [positionId]: updatedCell,
            },
          };
        });

        return {
          ...order,
          products: updatedProducts,
        };
      });
    });
  }, [currentOrderIndex]);

  return {
    orders,
    currentOrderIndex,
    selectedOrder,
    fsmStage,
    setFsmStage,
    columnSelectMode,
    selectedColumnIds,
    activeStepper,
    activeDrawer,
    activeMediaTab,
    rollupLevel,
    sidebarOpen,
    setSidebarOpen,
    selectOrder,
    toggleColumnSelection,
    toggleColumnSelectMode,
    clearColumnSelection,
    openStepper,
    closeStepper,
    updateQuantity,
    setActiveDrawer,
    setActiveMediaTab,
    setRollupLevel,
  };
}
