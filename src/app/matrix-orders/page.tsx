'use client';

import React from 'react';
import { useMatrixState } from '../../components/matrix/useMatrixState';
import { MatrixHeader } from '../../components/matrix/MatrixHeader';
import { MatrixProductRow } from '../../components/matrix/MatrixProductRow';
import { MatrixActionBar } from '../../components/matrix/MatrixActionBar';
import { MatrixSidebar } from '../../components/matrix/MatrixSidebar';
import { MatrixMediaDrawer } from '../../components/matrix/MatrixMediaDrawer';
import { MatrixContextMenu } from '../../components/matrix/MatrixContextMenu';
import { MatrixFSMModal } from '../../components/matrix/MatrixFSMModal';
import { MatrixProductEditDrawer } from '../../components/matrix/MatrixProductEditDrawer';
import { centsToEuroString } from '../../utils/matrix-pricing';
import { Position } from '../../types/matrix';
import { buildCellKey, resolveCellData } from '../../utils/matrix-overlay-state';

/**
 * Matrix Orders Browser Pagina conform INV-GOV-22 (<250 regels).
 */
export default function MatrixOrdersPage() {
  const {
    orders, currentOrderIndex, selectedOrder, fsmStage, setFsmStage,
    columnSelectMode, selectedColumnIds, activeOverlay, openOverlay, closeOverlay,
    activeMediaTab, setActiveMediaTab, sidebarOpen, setSidebarOpen,
    selectOrder, toggleColumnSelection, toggleColumnSelectMode,
    deletePosition, updateCell, assignProductToCell,
  } = useMatrixState();

  const allPositions: Position[] = [];
  selectedOrder.etages.forEach((e) => e.rooms.forEach((r) => r.positions.forEach((p) => allPositions.push(p))));

  const editProductId = activeOverlay && 'productId' in activeOverlay ? activeOverlay.productId : undefined;
  const editPositionId = activeOverlay && 'positionId' in activeOverlay ? activeOverlay.positionId : undefined;
  const editSubPos = activeOverlay && 'subPos' in activeOverlay ? activeOverlay.subPos : undefined;

  const editProduct = editProductId ? selectedOrder.products.find((p) => p.id === editProductId) : undefined;
  const editPosition = editPositionId ? allPositions.find((p) => p.id === editPositionId) : undefined;
  const editCellData = editProduct && editPositionId ? resolveCellData(editProduct, editPositionId, editSubPos) : undefined;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
      <MatrixSidebar
        orders={orders}
        currentIndex={currentOrderIndex}
        onSelectOrder={selectOrder}
        isOpen={sidebarOpen}
        onToggleOpen={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* BOVENSTE STATUSBALK */}
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
            <div className="hidden md:block">
              <div className="text-xs font-bold text-slate-800">{selectedOrder.klant} ({selectedOrder.plaats})</div>
              <div className="text-[11px] text-slate-500">Verkoper: {selectedOrder.verkoper} • Filiaal: {selectedOrder.filiaal}</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {selectedOrder.scopeDescription && (
              <div className="hidden lg:block text-right">
                <div className="text-xs font-medium text-slate-600">Projectscope</div>
                <div className="text-[11px] text-slate-500 font-medium max-w-xs truncate">{selectedOrder.scopeDescription}</div>
              </div>
            )}
            <div className="text-right pl-4 border-l border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-400">Totaalbedrag (incl. BTW)</div>
              <div className="text-base font-bold font-mono text-slate-950">{centsToEuroString(selectedOrder.totaalbedragCents)}</div>
            </div>
          </div>
        </header>

        {/* PROCESSTAPPEN & ACTIEBALK */}
        <MatrixActionBar
          currentStage={fsmStage}
          onStageChange={setFsmStage}
          columnSelectMode={columnSelectMode}
          selectedColumnCount={selectedColumnIds.size}
          onToggleColumnSelectMode={toggleColumnSelectMode}
          historischDocumentUrl={selectedOrder.historisch_document_url}
          onFsmStepClick={(step) =>
            openOverlay({
              type: 'fsm_modal',
              step: {
                name: step.label,
                code: `FSM_${step.step}`,
                status: 'completed',
                notes: `Processtap '${step.label}' is afgetekend en geverifieerd conform LogicTrade.`,
              },
            })
          }
          onOpenMediaDrawer={(tab) => {
            setActiveMediaTab(tab);
            openOverlay({ type: 'media' });
          }}
        />

        {/* MATRIX TABEL VIEWPORT */}
        <main id="matrix-viewport" className="flex-1 overflow-auto bg-slate-100">
          <table id="matrix-table" style={{ borderCollapse: 'separate', borderSpacing: 0 }} className="w-max bg-white">
            <colgroup>
              <col className="w-[280px] min-w-[280px] max-w-[280px]" />
              <col className="w-[160px] min-w-[160px] max-w-[160px]" />
              {allPositions.map((pos) => (<col key={pos.id} className="w-[160px] min-w-[160px] max-w-[160px]" />))}
            </colgroup>
            <MatrixHeader
              etages={selectedOrder.etages}
              columnSelectMode={columnSelectMode}
              selectedColumnIds={selectedColumnIds}
              onToggleColumnSelection={toggleColumnSelection}
              onHeaderContextMenu={(type, title, id, e) =>
                openOverlay({ type: 'context_menu', contextType: type, contextTitle: title, positionId: id, anchorPosition: { x: e.clientX, y: e.clientY } })
              }
            />
            <tbody className="divide-y divide-slate-200">
              {selectedOrder.products.map((product, idx) => (
                <MatrixProductRow
                  key={product.id}
                  product={product}
                  positions={allPositions}
                  rowIndex={idx}
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
        </main>
      </div>

      {/* WERF MEDIA SLIDE-OVER DRAWER */}
      <MatrixMediaDrawer
        isOpen={activeOverlay?.type === 'media' || activeOverlay?.type === 'media_drawer'}
        activeTab={activeMediaTab}
        onClose={closeOverlay}
        onTabChange={setActiveMediaTab}
        items={selectedOrder.media}
        currentPositionId={activeOverlay && 'positionId' in activeOverlay ? activeOverlay.positionId : 'pos_wk_pui'}
      />

      {/* FSM STATUS MODAL */}
      {activeOverlay?.type === 'fsm_modal' && activeOverlay.step && (
        <MatrixFSMModal
          isOpen={true}
          step={activeOverlay.step}
          onClose={closeOverlay}
          onViewDocument={selectedOrder.historisch_document_url ? () => window.open(selectedOrder.historisch_document_url, '_blank') : undefined}
        />
      )}

      {/* CONTEXT MENU */}
      {activeOverlay?.type === 'context_menu' && activeOverlay.anchorPosition && (
        <MatrixContextMenu
          type={activeOverlay.contextType || 'position'}
          title={activeOverlay.contextTitle || ''}
          anchorPosition={activeOverlay.anchorPosition}
          onClose={closeOverlay}
          onDelete={() => {
            if (activeOverlay.contextType === 'position' && activeOverlay.positionId) {
              deletePosition(activeOverlay.positionId);
            } else if (activeOverlay.contextType === 'cell' && activeOverlay.cellKey) {
              updateCell(activeOverlay.cellKey, { quantity: 0, totalPriceCents: 0 });
            }
          }}
          onEdit={() => {
            if (activeOverlay.productId && activeOverlay.positionId) {
              openOverlay({
                type: 'cell_edit',
                productId: activeOverlay.productId,
                positionId: activeOverlay.positionId,
                subPos: activeOverlay.subPos,
                cellKey: activeOverlay.cellKey,
              });
            }
          }}
          onAttachMedia={() => openOverlay({ type: 'media', positionId: activeOverlay.positionId })}
          onSelectForCluster={() => { if (activeOverlay.positionId) toggleColumnSelection(activeOverlay.positionId); }}
        />
      )}

      {/* PRODUCT EDIT DRAWER */}
      {activeOverlay?.type === 'cell_edit' && editProduct && (
        <MatrixProductEditDrawer
          isOpen={true}
          productName={editProduct.name}
          productCode={editProduct.code}
          positionName={editPosition?.name || editPositionId || 'Positie'}
          subPos={editSubPos}
          initialData={editCellData}
          onClose={closeOverlay}
          onSave={(data) => {
            const key = activeOverlay.cellKey || buildCellKey(editPositionId || '', editSubPos);
            if (editCellData) {
              updateCell(key, data);
            } else if (editProductId && editPositionId) {
              assignProductToCell(editProductId, editPositionId, editSubPos, data);
            }
          }}
          onDelete={
            editCellData
              ? () => {
                  const key = activeOverlay.cellKey || buildCellKey(editPositionId || '', editSubPos);
                  updateCell(key, { quantity: 0, totalPriceCents: 0 });
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
