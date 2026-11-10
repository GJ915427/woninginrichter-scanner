'use client';

// [VISUAL-MUTATION-AUTHORIZED: UX verfijning Hoofdscherm 4: banner eliminatie, sidebar verwijdering en semantische navigatie-interactie]
import React, { useState, useMemo, useEffect } from 'react';
import { useMatrixState } from '@/components/matrix/useMatrixState';
import { MatrixHeader } from '@/components/matrix/MatrixHeader';
import { MatrixProductRow } from '@/components/matrix/MatrixProductRow';
import { MatrixActionBar } from '@/components/matrix/MatrixActionBar';
import { MatrixTopNav } from '@/components/matrix/MatrixTopNav';
import { MatrixClusterFloatingBar } from '@/components/matrix/MatrixClusterFloatingBar';
import { MatrixAuditTrailTable } from '@/components/matrix/MatrixAuditTrailTable';
import { MatrixOverlayCoordinator } from '@/components/matrix/MatrixOverlayCoordinator';
import { Position, FSM_STAGES } from '@/types/matrix';
import { buildCellKey, findCellKeyByOrderLine, findOrderLineByCompoundKey } from '@/utils/matrix-overlay-state';
import { syncStickyGroupHeaders } from '@/utils/matrix-docking';
import { useMatrixOrderBundle } from '@/hooks/useMatrixOrderBundle';
import { useLiveOrderList } from '@/hooks/useLiveOrderList';
import { LabMatrixOrderMetaCard } from './LabMatrixOrderMetaCard';
import { useLabKeyboardShortcuts } from './useLabKeyboardShortcuts';

/**
 * Matrix Orders Lab Spike Page (Hoofdscherm 4)
 * Geïsoleerde route op /lab/matrix-orders conform INV-GOV-22 (<235 LOC).
 */
export default function MatrixOrdersLabPage() {
  const [viewMode, setViewMode] = useState<'matrix' | 'audit'>('matrix');

  const {
    orders, currentOrderIndex, selectedOrder, fsmStage,
    selectOrderById, statusAlert,
    selectedColumnIds, activeOverlay, openOverlay, closeOverlay,
    highlightedCellKey, setHighlightedCellKey, activeMediaTab, setActiveMediaTab,
    visibleLevels, toggleLevelVisibility,
    selectOrder, goToNextOrder, goToPreviousOrder,
    toggleColumnSelection, clearColumnSelection,
    addMediaItem, deletePosition, updateCell, assignProductToCell, assignVlakToPosition,
    mergePositionsToCluster, dissolveCluster, hydrateOrderBundle,
  } = useMatrixState();

  const { orders: liveOrders } = useLiveOrderList();
  const orderList = liveOrders.length > 0 ? liveOrders : orders;

  const orderId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('orderId') : null;
  const { order: liveOrder, isLoading: isOrderLoading } = useMatrixOrderBundle(orderId);
  useEffect(() => { if (liveOrder) hydrateOrderBundle(liveOrder); }, [liveOrder, hydrateOrderBundle]);

  const spatialPositions: Position[] = useMemo(
    () => selectedOrder.etages.flatMap((e) => e.rooms.flatMap((r) => r.positions)), [selectedOrder]
  );

  const isSingleRoom = useMemo(() => {
    if (selectedColumnIds.size <= 1) return true;
    const rooms = new Set(
      selectedOrder.etages.flatMap((e) =>
        e.rooms.filter((r) => r.positions.some((p) => selectedColumnIds.has(p.id))).map((r) => r.id)
      )
    );
    return rooms.size <= 1;
  }, [selectedColumnIds, selectedOrder]);

  const highlightedOrderLine = useMemo(
    () => findOrderLineByCompoundKey(selectedOrder, highlightedCellKey), [selectedOrder, highlightedCellKey]
  );

  const activeStep = FSM_STAGES.find((s) => s.step === fsmStage) ?? {
    step: fsmStage,
    label: 'Montage gepland',
    status: 'actueel' as const,
  };

  useLabKeyboardShortcuts({
    goToNextOrder,
    goToPreviousOrder,
    activeOverlay,
    closeOverlay,
  });

  useEffect(() => {
    if (viewMode === 'matrix') {
      requestAnimationFrame(() => {
        const viewport = document.getElementById('matrix-viewport');
        syncStickyGroupHeaders(viewport);
      });
    }
  }, [viewMode]);

  const handleSelectAuditLine = (line: number) => {
    const match = findCellKeyByOrderLine(selectedOrder, line);
    if (match) {
      const fullKey = `${match.productId}-${match.cellKey}`;
      setHighlightedCellKey(fullKey);
      setViewMode('matrix');
      requestAnimationFrame(() => {
        const viewport = document.getElementById('matrix-viewport');
        syncStickyGroupHeaders(viewport);
        document.getElementById(`matrix-cell-${fullKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      });
    }
  };

  const handleCellAuditHighlight = (productId: string, positionId: string, subPos?: string) => {
    const line = findOrderLineByCompoundKey(selectedOrder, `${productId}-${buildCellKey(positionId, subPos)}`);
    if (line !== null && line !== undefined) {
      document.getElementById(`audit-row-${line}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  if (orderId && isOrderLoading) {
    return (
      <div id="matrix-loading-skeleton" className="flex items-center justify-center min-h-[400px] text-slate-500 animate-pulse font-medium">
        Order data inladen...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800 flex-col">
      <MatrixTopNav activeTab="Project" />

      <LabMatrixOrderMetaCard
        selectedOrder={selectedOrder}
        orders={orderList}
        currentOrderIndex={currentOrderIndex}
        onSelectOrder={selectOrder}
        onSelectOrderId={selectOrderById}
        onOpenMedia={() => openOverlay({ type: 'media_drawer', positionId: 'pos_project_algemeen', title: `Werffoto's & Media (${selectedOrder.klant})` })}
        onToggleAuditTrail={() => setViewMode((prev) => (prev === 'matrix' ? 'audit' : 'matrix'))}
        isAuditTrailActive={viewMode === 'audit'}
      />

      <MatrixActionBar
        workflowStage={activeStep.label}
        statusAlert={statusAlert}
        onWorkflowStageClick={() => openOverlay({ type: 'fsm_modal', step: activeStep })}
      />

      <main className="flex-1 min-h-0 flex flex-col overflow-hidden p-4">
        <div
          id="matrix-viewport"
          className={viewMode === 'matrix' ? 'flex-1 min-h-[340px] flex flex-col overflow-auto bg-white rounded-xl shadow-xs border border-slate-200 scroll-pt-[130px] transition-all duration-200' : 'hidden'}
        >
          <table id="matrix-table" className="border-separate border-spacing-0 table-fixed min-w-max text-xs">
            <MatrixHeader
              etages={selectedOrder.etages}
              selectedColumnIds={selectedColumnIds}
              onToggleColumnSelection={toggleColumnSelection}
              visibleLevels={visibleLevels}
              onOpenLevelVisibility={(pos, isHover) => {
                if (isHover && activeOverlay && activeOverlay.type !== 'level_visibility') return;
                openOverlay({ type: 'level_visibility', anchorPosition: pos });
              }}
              onHeaderContextMenu={(type, title, id, e) =>
                openOverlay({ type: 'context_menu', contextType: type, contextTitle: title, positionId: id, anchorPosition: { x: e.clientX, y: e.clientY } })
              }
            />
            <tbody className="divide-y divide-slate-200 bg-white">
              {selectedOrder.products.map((product, idx) => {
                const categoryHeader = idx === 0 || selectedOrder.products[idx - 1].category !== product.category ? product.category : undefined;
                return (
                  <MatrixProductRow
                    key={product.id}
                    product={product}
                    positions={spatialPositions}
                    rowIndex={idx}
                    highlightedCellKey={highlightedCellKey}
                    categoryHeader={categoryHeader}
                    onProductClick={(p) => openOverlay({ type: 'product_drawer', productId: p.id })}
                    onCellClick={(pId, posId, sPos) => {
                      handleCellAuditHighlight(pId, posId, sPos);
                      openOverlay({ type: 'cell_edit', productId: pId, positionId: posId, subPos: sPos });
                    }}
                    onCellContextMenu={(pId, posId, sPos, e) =>
                      openOverlay({ type: 'context_menu', contextType: 'cell', contextTitle: `${pId} @ ${posId}${sPos ? ` [${sPos}]` : ''}`, productId: pId, positionId: posId, subPos: sPos, anchorPosition: { x: e.clientX, y: e.clientY } })
                    }
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          id="matrix-audit-trail-section"
          className={viewMode === 'audit' ? 'flex-1 min-h-[340px] flex flex-col overflow-auto' : 'hidden'}
        >
          <MatrixAuditTrailTable
            lines={selectedOrder.rawLines ?? []}
            highlightedLine={highlightedOrderLine}
            onSelectLine={handleSelectAuditLine}
            onOpenDocument={() => openOverlay({ type: 'media', positionId: 'pos_order_meta', title: `Historisch Document - ${selectedOrder.id}` })}
          />
        </div>
      </main>

      <MatrixClusterFloatingBar
        selectedPositionIds={Array.from(selectedColumnIds)}
        isSingleRoom={isSingleRoom}
        onClearSelection={clearColumnSelection}
        onOpenClusterModal={() =>
          openOverlay({ type: 'cluster_modal', roomId: selectedOrder.etages[0]?.rooms[0]?.id || 'room_bg_woonkamer', positionIds: Array.from(selectedColumnIds) })
        }
      />

      <MatrixOverlayCoordinator
        activeOverlay={activeOverlay}
        selectedOrder={selectedOrder}
        activeMediaTab={activeMediaTab}
        onClose={closeOverlay}
        onTabChange={setActiveMediaTab}
        visibleLevels={visibleLevels}
        onToggleLevelVisibility={toggleLevelVisibility}
        onDeletePosition={deletePosition}
        onSelectPositionForCluster={toggleColumnSelection}
        onOpenAssignVlak={(posId) => openOverlay({ type: 'assign_vlak', positionId: posId })}
        onSaveVlak={assignVlakToPosition}
        onSaveCluster={mergePositionsToCluster}
        onDissolveCluster={dissolveCluster}
        onOpenMedia={(level, id, title) => openOverlay({ type: 'media', positionId: id, title: title || `Media - ${id}` })}
        onCellClick={(pId, posId, sPos) => {
          handleCellAuditHighlight(pId, posId, sPos);
          openOverlay({ type: 'cell_edit', productId: pId, positionId: posId, subPos: sPos });
        }}
        onUpdateCell={(key, data, pId) => { updateCell(key, data, pId); closeOverlay(); }}
        onAssignProductToCell={(pId, posId, sPos, data) => { assignProductToCell(pId, posId, sPos, data); closeOverlay(); }}
        onAddNote={(note) => addMediaItem({
          id: `media-note-${Date.now()}`,
          entityType: 'order',
          entityId: selectedOrder.id,
          type: 'note',
          title: 'Werfnotitie',
          description: note,
          date: new Date().toLocaleDateString('nl-NL'),
          author: 'Jan (GSW)',
        })}
      />
    </div>
  );
}
