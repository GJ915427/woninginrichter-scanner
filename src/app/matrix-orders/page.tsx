'use client';

import React from 'react';
import { useMatrixState } from '../../components/matrix/useMatrixState';
import { MatrixHeader } from '../../components/matrix/MatrixHeader';
import { MatrixProductRow } from '../../components/matrix/MatrixProductRow';
import { MatrixActionBar } from '../../components/matrix/MatrixActionBar';
import { MatrixSidebar } from '../../components/matrix/MatrixSidebar';
import { MatrixMediaDrawer } from '../../components/matrix/MatrixMediaDrawer';
import { centsToEuroString } from '../../utils/matrix-pricing';
import { Position } from '../../types/matrix';

export default function MatrixOrdersPage() {
  const {
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
    sidebarOpen,
    setSidebarOpen,
    selectOrder,
    toggleColumnSelection,
    toggleColumnSelectMode,
    openStepper,
    closeStepper,
    updateQuantity,
    setActiveDrawer,
    setActiveMediaTab,
  } = useMatrixState();

  // Flatten all positions for rows
  const allPositions: Position[] = [];
  selectedOrder.etages.forEach((etage) => {
    etage.rooms.forEach((room) => {
      room.positions.forEach((pos) => {
        allPositions.push(pos);
      });
    });
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
      {/* ORDERS EXPLORER ZIJBALK */}
      <MatrixSidebar
        orders={orders}
        currentIndex={currentOrderIndex}
        onSelectOrder={selectOrder}
        isOpen={sidebarOpen}
        onToggleOpen={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* HOOFDWERKBLAD */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* BOVENSTE STATUSBALK (Order Metadata) */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold font-mono text-slate-900">
                  {selectedOrder.id}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {selectedOrder.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Offerte: <span className="font-mono">{selectedOrder.offerte}</span> • Datum: {selectedOrder.orderdatum}
              </p>
            </div>

            <div className="h-8 w-px bg-slate-200 hidden sm:block" />

            <div className="hidden md:block">
              <div className="text-xs font-bold text-slate-800">
                {selectedOrder.klant} ({selectedOrder.plaats})
              </div>
              <div className="text-[11px] text-slate-500">
                Verkoper: {selectedOrder.verkoper} • Filiaal: {selectedOrder.filiaal}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {selectedOrder.scopeDescription && (
              <div className="hidden lg:block text-right">
                <div className="text-xs font-medium text-slate-600">Projectscope</div>
                <div className="text-[11px] text-slate-500 font-medium max-w-xs truncate">
                  {selectedOrder.scopeDescription}
                </div>
              </div>
            )}

            <div className="text-right pl-4 border-l border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-400">
                Totaalbedrag (incl. BTW)
              </div>
              <div className="text-base font-bold font-mono text-slate-950">
                {centsToEuroString(selectedOrder.totaalbedragCents)}
              </div>
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
          onOpenMediaDrawer={(tab) => {
            setActiveMediaTab(tab);
            setActiveDrawer('media');
          }}
        />

        {/* MATRIX TABEL VIEWPORT */}
        <main id="matrix-viewport" className="flex-1 overflow-auto bg-slate-100">
          <table
            id="matrix-table"
            style={{ borderCollapse: 'separate', borderSpacing: 0 }}
            className="w-max bg-white"
          >
            {/* VASTE KOLOMBREEDTES SSOT */}
            <colgroup>
              <col className="w-[280px] min-w-[280px] max-w-[280px]" />
              <col className="w-[160px] min-w-[160px] max-w-[160px]" />
              {allPositions.map((pos) => (
                <col key={pos.id} className="w-[160px] min-w-[160px] max-w-[160px]" />
              ))}
            </colgroup>

            {/* 4 STICKY HEADER RIJEN */}
            <MatrixHeader
              etages={selectedOrder.etages}
              columnSelectMode={columnSelectMode}
              selectedColumnIds={selectedColumnIds}
              onToggleColumnSelection={toggleColumnSelection}
            />

            {/* PRODUCT RIJEN */}
            <tbody className="divide-y divide-slate-200">
              {selectedOrder.products.map((product, idx) => (
                <MatrixProductRow
                  key={product.id}
                  product={product}
                  positions={allPositions}
                  rowIndex={idx}
                  activeStepper={activeStepper}
                  onOpenStepper={openStepper}
                  onCloseStepper={closeStepper}
                  onUpdateQuantity={updateQuantity}
                />
              ))}
            </tbody>
          </table>
        </main>
      </div>

      {/* WERF MEDIA SLIDE-OVER DRAWER */}
      <MatrixMediaDrawer
        isOpen={activeDrawer === 'media'}
        activeTab={activeMediaTab}
        onClose={() => setActiveDrawer(null)}
        onTabChange={setActiveMediaTab}
      />
    </div>
  );
}
