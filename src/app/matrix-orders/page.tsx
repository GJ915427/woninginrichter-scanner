'use client';

import React, { useMemo } from 'react';
import { useMatrixState } from '../../components/matrix/useMatrixState';
import { MatrixHeader } from '../../components/matrix/MatrixHeader';
import { MatrixProductRow } from '../../components/matrix/MatrixProductRow';
import { MatrixActionBar } from '../../components/matrix/MatrixActionBar';
import { MatrixSidebar } from '../../components/matrix/MatrixSidebar';
import { MatrixTopNav } from '../../components/matrix/MatrixTopNav';
import { MatrixClusterFloatingBar } from '../../components/matrix/MatrixClusterFloatingBar';
import { MatrixAuditTrailTable } from '../../components/matrix/MatrixAuditTrailTable';
import { MatrixOverlayCoordinator } from '../../components/matrix/MatrixOverlayCoordinator';
import { centsToEuroString } from '../../utils/matrix-pricing';
import { Position, FsmProcessStep } from '../../types/matrix';
import { buildCellKey, findCellKeyByOrderLine, findOrderLineByCompoundKey } from '../../utils/matrix-overlay-state';

/**
 * Matrix Orders Browser Pagina conform INV-GOV-22 (<250 regels, <=4 hooks).
 * Integreert TopNav, Cluster Floating Bar, Audit-Trail Split-View en Overlay Coordinator.
 */
export default function MatrixOrdersPage() {
  const {
    orders, currentOrderIndex, selectedOrder, fsmStage, setFsmStage,
    columnSelectMode, selectedColumnIds, activeOverlay, openOverlay, closeOverlay,
    highlightedCellKey, setHighlightedCellKey,
    activeMediaTab, setActiveMediaTab, sidebarOpen, setSidebarOpen,
    selectOrder, goToNextOrder, goToPreviousOrder,
    toggleColumnSelection, toggleColumnSelectMode, clearColumnSelection,
    deletePosition, updateCell, assignProductToCell,
    assignVlakToPosition, mergePositionsToCluster, dissolveCluster,
  } = useMatrixState();

  // Ruimtelijke posities afvlakken voor de tabelkolommen
  const allPositions = useMemo<Position[]>(() => {
    const list: Position[] = [];
    selectedOrder.etages.forEach((e) => e.rooms.forEach((r) => r.positions.forEach((p) => list.push(p))));
    return list;
  }, [selectedOrder]);

  // Single-room validatie voor multi-select cluster actiebalk
  const { isSingleRoom, activeRoomId, activeRoomName } = useMemo(() => {
    const selectedIds = Array.from(selectedColumnIds);
    if (selectedIds.length === 0) return { isSingleRoom: true, activeRoomId: undefined, activeRoomName: undefined };

    const roomsFound = new Map<string, string>();
    for (const etage of selectedOrder.etages) {
      for (const room of etage.rooms) {
        for (const pos of room.positions) {
          if (selectedIds.includes(pos.id)) {
            roomsFound.set(room.id, room.name);
          }
        }
      }
    }
    if (roomsFound.size === 1) {
      const [rId, rName] = Array.from(roomsFound.entries())[0];
      return { isSingleRoom: true, activeRoomId: rId, activeRoomName: rName };
    }
    return { isSingleRoom: false, activeRoomId: undefined, activeRoomName: undefined };
  }, [selectedColumnIds, selectedOrder]);

  // Audit-trail regel interactie: cel highlighten en scrollen
  const handleSelectAuditLine = (line: number) => {
    const match = findCellKeyByOrderLine(selectedOrder, line);
    if (match) {
      const fullKey = `${match.productId}-${match.cellKey}`;
      setHighlightedCellKey(fullKey);
      const el = document.getElementById(`matrix-cell-${fullKey}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }
  };

  const selectedPosArray = Array.from(selectedColumnIds);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
      {/* ORDERS EXPLORER ZIJBALK */}
      <MatrixSidebar
        orders={orders}
        currentIndex={currentOrderIndex}
        isOpen={sidebarOpen}
        onSelectOrder={selectOrder}
        onToggleOpen={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* HOOFDWERKBLAD */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOPNAVIGATIE & KRUIMELPAD */}
        <MatrixTopNav
          currentOrderIndex={currentOrderIndex}
          totalOrders={orders.length}
          onPreviousOrder={goToPreviousOrder}
          onNextOrder={goToNextOrder}
          customerName={selectedOrder.klant}
          projectName={selectedOrder.plaats}
        />

        {/* STATUSBALK (Order Metadata) */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold font-mono text-slate-900">{selectedOrder.id}</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">{selectedOrder.status}</span>
              </div>
              <p className="text-xs text-slate-500">
                Offerte: <span className="font-mono">{selectedOrder.offerte}</span> • Datum: {selectedOrder.orderdatum}
              </p>
            </div>
            <div className="h-8 w-px bg-slate-200 hidden sm:block" />
            <div className="text-xs">
              <span className="text-slate-500">Verkoper:</span>{' '}
              <span className="font-semibold text-slate-700">{selectedOrder.verkoper}</span>{' '}
              <span className="text-slate-400">({selectedOrder.filiaal})</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Totaal (incl. BTW)</div>
              <div className="text-xl font-bold font-mono text-blue-600">
                {centsToEuroString(selectedOrder.totaalbedragCents)}
              </div>
            </div>
          </div>
        </header>

        {/* FSM PROCESBALK & ACTIEKNOPPEN */}
        <MatrixActionBar
          currentStage={fsmStage}
          onStageChange={setFsmStage}
          columnSelectMode={columnSelectMode}
          selectedColumnCount={selectedColumnIds.size}
          onToggleColumnSelectMode={toggleColumnSelectMode}
          onOpenMediaDrawer={(tab: 'foto' | 'video' | 'opmerking') => {
            setActiveMediaTab(tab);
            openOverlay({ type: 'media' });
          }}
          onFsmStepClick={(step: FsmProcessStep) => openOverlay({ type: 'fsm_modal', step })}
          historischDocumentUrl={selectedOrder.historisch_document_url}
        />

        {/* MATRIX SCROLLABLE WEERGAVE */}
        <main className="flex-1 overflow-auto bg-slate-100/60 p-4">
          <div className="inline-block min-w-full align-middle bg-white rounded-xl shadow-sm border border-slate-200">
            <table id="matrix-table" className="min-w-full border-collapse text-left text-xs">
              <MatrixHeader
                etages={selectedOrder.etages}
                columnSelectMode={columnSelectMode}
                selectedColumnIds={selectedColumnIds}
                onToggleColumnSelection={toggleColumnSelection}
                onHeaderContextMenu={(type, title, id, e) =>
                  openOverlay({
                    type: 'context_menu',
                    contextType: type,
                    targetId: id,
                    positionId: type === 'position' ? id : undefined,
                    title,
                    anchorPosition: { x: e.clientX, y: e.clientY },
                  })
                }
              />

              <tbody className="divide-y divide-slate-200">
                {selectedOrder.products.map((product, idx) => (
                  <MatrixProductRow
                    key={product.id}
                    product={product}
                    positions={allPositions}
                    rowIndex={idx}
                    highlightedCellKey={highlightedCellKey}
                    onCellClick={(pId, posId, subPos) =>
                      openOverlay({ type: 'cell_edit', productId: pId, positionId: posId, subPos, cellKey: buildCellKey(posId, subPos) })
                    }
                    onCellContextMenu={(pId, posId, subPos, e) =>
                      openOverlay({
                        type: 'context_menu',
                        contextType: 'cell',
                        contextTitle: `${posId}`,
                        productId: pId,
                        positionId: posId,
                        subPos,
                        cellKey: buildCellKey(posId, subPos),
                        anchorPosition: { x: e.clientX, y: e.clientY },
                      })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* AUDIT-TRAIL SPLIT-VIEW TABEL */}
          {selectedOrder.rawLines && (
            <MatrixAuditTrailTable
              lines={selectedOrder.rawLines}
              highlightedLine={findOrderLineByCompoundKey(selectedOrder, highlightedCellKey)}
              onSelectLine={handleSelectAuditLine}
              onOpenDocument={selectedOrder.historisch_document_url ? () => window.open(selectedOrder.historisch_document_url, '_blank') : undefined}
            />
          )}
        </main>
      </div>

      {/* FLOATING ACTION TOOLBAR VOOR MULTI-SELECT CLUSTERS */}
      <MatrixClusterFloatingBar
        selectedPositionIds={selectedPosArray}
        isSingleRoom={isSingleRoom}
        roomName={activeRoomName}
        onOpenClusterModal={() => activeRoomId && openOverlay({ type: 'cluster_modal', roomId: activeRoomId, positionIds: selectedPosArray })}
        onClearSelection={clearColumnSelection}
      />

      {/* GECONSOLIDEERDE OVERLAY COORDINATOR VOOR MODALS & DRAWERS */}
      <MatrixOverlayCoordinator
        activeOverlay={activeOverlay}
        selectedOrder={selectedOrder}
        activeMediaTab={activeMediaTab}
        onClose={closeOverlay}
        onTabChange={setActiveMediaTab}
        onDeletePosition={deletePosition}
        onSelectPositionForCluster={toggleColumnSelection}
        onOpenAssignVlak={(posId) => openOverlay({ type: 'assign_vlak', positionId: posId })}
        onSaveVlak={assignVlakToPosition}
        onSaveCluster={mergePositionsToCluster}
        onDissolveCluster={dissolveCluster}
        onOpenMedia={(level, id, title) => openOverlay({ type: 'media', level, entityId: id, title })}
        onUpdateCell={updateCell}
        onAssignProductToCell={assignProductToCell}
        onCellClick={(pId, posId, subPos) => openOverlay({ type: 'cell_edit', productId: pId, positionId: posId, subPos, cellKey: buildCellKey(posId, subPos) })}
      />
    </div>
  );
}
