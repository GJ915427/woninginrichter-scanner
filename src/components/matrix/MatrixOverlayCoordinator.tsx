'use client';

import React from 'react';
import { ActiveOverlay, MatrixOrder, CellPriceData } from '../../types/matrix';
import { MatrixContextMenu } from './MatrixContextMenu';
import { MatrixMediaDrawer } from './MatrixMediaDrawer';
import { MatrixFSMModal } from './MatrixFSMModal';
import { MatrixProductEditDrawer } from './MatrixProductEditDrawer';
import { MatrixAssignVlakModal } from './MatrixAssignVlakModal';
import { MatrixClusterModal } from './MatrixClusterModal';
import { resolveCellData, buildCellKey } from '../../utils/matrix-overlay-state';

export interface MatrixOverlayCoordinatorProps {
  activeOverlay: ActiveOverlay | null;
  selectedOrder: MatrixOrder;
  activeMediaTab: 'foto' | 'video' | 'opmerking';
  onClose: () => void;
  onTabChange: (tab: 'foto' | 'video' | 'opmerking') => void;
  onDeletePosition: (positionId: string) => void;
  onSelectPositionForCluster: (positionId: string) => void;
  onOpenAssignVlak: (positionId: string, currentVlak?: string, roomId?: string) => void;
  onSaveVlak: (positionId: string, vlak: string) => void;
  onSaveCluster: (roomId: string, clusterName: string, positionIds: string[]) => void;
  onDissolveCluster: (roomId: string, clusterId: string) => void;
  onOpenMedia: (
    level: 'order' | 'etage' | 'room' | 'vlak' | 'cluster' | 'position' | 'cell',
    entityId: string,
    title?: string
  ) => void;
  onUpdateCell: (cellKey: string, updates: Partial<CellPriceData>) => void;
  onAssignProductToCell: (
    productId: string,
    positionId: string,
    subPos?: string,
    initialData?: Partial<CellPriceData>
  ) => void;
  onCellClick: (
    productId: string,
    positionId: string,
    subPos?: string,
    cellData?: CellPriceData
  ) => void;
}

/**
 * MatrixOverlayCoordinator (INV-GOV-22)
 * Centraliseert alle modale vensters, drawers en floating contextmenu's.
 * Zorgt ervoor dat page.tsx slank en zuiver binnen het regellimiet (<250 regels) blijft.
 */
export function MatrixOverlayCoordinator({
  activeOverlay,
  selectedOrder,
  activeMediaTab,
  onClose,
  onTabChange,
  onDeletePosition,
  onSelectPositionForCluster,
  onOpenAssignVlak,
  onSaveVlak,
  onSaveCluster,
  onDissolveCluster,
  onOpenMedia,
  onUpdateCell,
  onAssignProductToCell,
  onCellClick,
}: MatrixOverlayCoordinatorProps) {
  if (!activeOverlay) return null;

  // Resolven van product en celdata voor cell_edit drawer
  const editProduct =
    activeOverlay.type === 'cell_edit'
      ? selectedOrder.products.find((p) => p.id === activeOverlay.productId)
      : undefined;

  const editCellData =
    activeOverlay.type === 'cell_edit' && editProduct
      ? resolveCellData(editProduct, activeOverlay.positionId, activeOverlay.subPos)
      : undefined;

  return (
    <>
      {/* 1. Context Menu */}
      {activeOverlay.type === 'context_menu' && (
        <MatrixContextMenu
          type={activeOverlay.menuType || activeOverlay.contextType || 'position'}
          title={activeOverlay.title || activeOverlay.contextTitle || 'Menu'}
          anchorPosition={activeOverlay.anchorPosition || { x: activeOverlay.x || 100, y: activeOverlay.y || 100 }}
          onClose={onClose}
          onDelete={
            activeOverlay.positionId
              ? () => onDeletePosition(activeOverlay.positionId!)
              : undefined
          }
          onSelectForCluster={
            activeOverlay.positionId
              ? () => onSelectPositionForCluster(activeOverlay.positionId!)
              : undefined
          }
          onAssignVlak={
            activeOverlay.positionId
              ? () => onOpenAssignVlak(activeOverlay.positionId!)
              : undefined
          }
          onAttachMedia={
            activeOverlay.positionId
              ? () => onOpenMedia('position', activeOverlay.positionId!, activeOverlay.title)
              : () => onOpenMedia('order', selectedOrder.id, selectedOrder.klant)
          }
          onEdit={
            activeOverlay.productId && activeOverlay.positionId
              ? () => onCellClick(activeOverlay.productId!, activeOverlay.positionId!, activeOverlay.subPos)
              : undefined
          }
        />
      )}

      {/* 2. Media Drawer */}
      {(activeOverlay.type === 'media' || activeOverlay.type === 'media_drawer') && (
        <MatrixMediaDrawer
          isOpen={true}
          activeTab={activeMediaTab}
          onClose={onClose}
          onTabChange={onTabChange}
          items={selectedOrder.media || []}
          currentPositionId={activeOverlay.positionId || 'pos_wk_pui'}
        />
      )}

      {/* 3. FSM Modal */}
      {activeOverlay.type === 'fsm_modal' && (
        <MatrixFSMModal
          isOpen={true}
          step={{
            ...activeOverlay.step,
            name: activeOverlay.step?.name || activeOverlay.step?.label || activeOverlay.label || 'Status',
          }}
          onClose={onClose}
        />
      )}

      {/* 4. Cell Edit Drawer */}
      {activeOverlay.type === 'cell_edit' && editProduct && (
        <MatrixProductEditDrawer
          isOpen={true}
          productName={editProduct.name}
          productCode={editProduct.code}
          positionName={activeOverlay.positionId}
          subPos={activeOverlay.subPos}
          initialData={editCellData}
          onClose={onClose}
          onSave={(data) => {
            const key = activeOverlay.cellKey || buildCellKey(activeOverlay.positionId, activeOverlay.subPos);
            if (editCellData) {
              onUpdateCell(key, data);
            } else {
              onAssignProductToCell(activeOverlay.productId, activeOverlay.positionId, activeOverlay.subPos, data);
            }
          }}
          onDelete={
            editCellData
              ? () => {
                  const key = activeOverlay.cellKey || buildCellKey(activeOverlay.positionId, activeOverlay.subPos);
                  onUpdateCell(key, { quantity: 0, totalPriceCents: 0 });
                }
              : undefined
          }
        />
      )}

      {/* 5. Assign Vlak Modal */}
      {activeOverlay.type === 'assign_vlak' && (
        <MatrixAssignVlakModal
          isOpen={true}
          positionId={activeOverlay.positionId}
          currentVlak={activeOverlay.currentVlak}
          onSave={onSaveVlak}
          onClose={onClose}
        />
      )}

      {/* 6. Cluster Modal */}
      {activeOverlay.type === 'cluster_modal' && (
        <MatrixClusterModal
          isOpen={true}
          roomId={activeOverlay.roomId}
          clusterId={activeOverlay.clusterId}
          positionIds={activeOverlay.positionIds || []}
          onSave={onSaveCluster}
          onDissolve={onDissolveCluster}
          onClose={onClose}
        />
      )}
    </>
  );
}
