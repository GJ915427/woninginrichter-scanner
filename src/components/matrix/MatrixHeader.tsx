'use client';

import React from 'react';
import { Etage, Position, HeaderLevelVisibility } from '../../types/matrix';

export interface MatrixHeaderProps {
  etages: Etage[];
  selectedColumnIds: Set<string>;
  onToggleColumnSelection: (positionId: string) => void;
  visibleLevels?: HeaderLevelVisibility;
  onOpenLevelVisibility?: (position: { x: number; y: number }, isHover?: boolean) => void;
  onHeaderContextMenu?: (type: 'etage' | 'room' | 'cluster' | 'position', title: string, id: string, e: React.MouseEvent) => void;
}

interface FlattenedPosition {
  position: Position;
  roomId: string;
  roomName: string;
  etageId: string;
  etageName: string;
}

/**
 * 4-lagige dynamische sticky header conform Matrix V5 Architectuur.
 * Ondersteunt dynamische niveau-zichtbaarheid, dockende groepskoppen
 * en uniforme positie-cluster weergave (<220 regels, 0 hooks conform INV-GOV-22).
 */
export function MatrixHeader({
  etages,
  selectedColumnIds,
  onToggleColumnSelection,
  visibleLevels,
  onOpenLevelVisibility,
  onHeaderContextMenu,
}: MatrixHeaderProps) {
  const levels: HeaderLevelVisibility = visibleLevels ?? { etage: true, ruimte: true, cluster: true, positie: true };
  const topEtage = 0;
  const topRuimte = levels.etage ? 36 : 0;
  const topCluster = (levels.etage ? 36 : 0) + (levels.ruimte ? 34 : 0);
  const topPosities = (levels.etage ? 36 : 0) + (levels.ruimte ? 34 : 0) + (levels.cluster ? 28 : 0);

  const visibleLevelsCount = (levels.etage ? 1 : 0) + (levels.ruimte ? 1 : 0) + (levels.cluster ? 1 : 0) + 1;
  const firstVisibleLevelId = levels.etage ? 'etage' : levels.ruimte ? 'ruimte' : levels.cluster ? 'cluster' : 'positie';

  const renderTowerCell = (levelId: string, topOffset: number) => {
    if (levelId !== firstVisibleLevelId) return null;
    return (
      <th
        rowSpan={visibleLevelsCount}
        data-testid="header-tower-col1"
        style={{ top: `${topOffset}px` }}
        className="sticky z-30 w-[160px] min-w-[160px] max-w-[160px] bg-amber-50 px-3 py-2 text-center text-amber-950 border-r border-b border-amber-200 align-middle shadow-2xs select-none"
      >
        <div className="font-bold text-xs text-amber-900">Algemeen</div>
        <div className="text-[10px] text-amber-800 font-normal">Projectscope Diensten</div>
      </th>
    );
  };

  const allPositions: FlattenedPosition[] = etages.flatMap((e) =>
    e.rooms.flatMap((r) => r.positions.map((pos) => ({ position: pos, roomId: r.id, roomName: r.name, etageId: e.id, etageName: e.name })))
  );

  const handleOpenLevelVisibility = (e: React.MouseEvent<HTMLTableCellElement>, isHover: boolean) => {
    if (!onOpenLevelVisibility) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onOpenLevelVisibility({ x: Math.round(rect.right + 8), y: Math.round(rect.top) }, isHover);
  };

  const handleCtx = (type: 'etage' | 'room' | 'cluster' | 'position', title: string, id: string, e: React.MouseEvent) => {
    if (onHeaderContextMenu) {
      e.preventDefault();
      e.stopPropagation();
      onHeaderContextMenu(type, title, id, e);
    }
  };

  return (
    <thead>
      {/* RIJ 1: ETAGE HEADER (h: 36px) */}
      {levels.etage && (
        <tr data-level="etage" style={{ top: `${topEtage}px` }} className="sticky z-30 bg-slate-100 text-xs font-bold text-slate-800 border-b border-slate-200 h-[36px] tr-etage">
          <th
            style={{ top: `${topEtage}px`, left: '0px' }}
            onClick={(e) => handleOpenLevelVisibility(e, false)}
            title="Klik hierop om niveau-zichtbaarheid aan te passen"
            className="sticky left-0 z-40 w-[280px] min-w-[280px] max-w-[280px] sticky-col-0 bg-slate-100 px-4 py-1 text-left font-semibold text-slate-600 border-r border-b border-slate-300 h-[36px] cursor-pointer hover:bg-slate-200/60 transition select-none"
          >
            Etage
          </th>
          {renderTowerCell('etage', topEtage)}
          {etages.map((etage) => {
            const totalPos = etage.rooms.reduce((acc, r) => acc + r.positions.length, 0);
            if (totalPos === 0) return null;
            return (
              <th key={etage.id} colSpan={Math.max(1, totalPos)} style={{ top: `${topEtage}px` }} onContextMenu={(e) => handleCtx('etage', etage.name, etage.id, e)} className="sticky z-30 bg-slate-100 px-3 py-1 text-left overflow-hidden font-bold text-slate-800 border-r border-b border-slate-300 cursor-context-menu select-none h-[36px]">
                <span className="sticky-group-label-etage inline-flex will-change-transform min-h-[26px] h-full items-center gap-1.5 px-3 py-0.5 rounded bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 transition">{etage.name}</span>
              </th>
            );
          })}
        </tr>
      )}

      {/* RIJ 2: RUIMTE HEADER (h: 34px) */}
      {levels.ruimte && (
        <tr data-level="ruimte" style={{ top: `${topRuimte}px` }} className="sticky z-30 bg-slate-50 text-xs font-semibold text-slate-700 border-b border-slate-200 h-[34px] tr-ruimte">
          <th
            style={{ top: `${topRuimte}px`, left: '0px' }}
            onClick={(e) => handleOpenLevelVisibility(e, false)}
            title="Klik hierop om niveau-zichtbaarheid aan te passen"
            className="sticky left-0 z-40 w-[280px] min-w-[280px] max-w-[280px] sticky-col-0 bg-slate-50 px-4 py-1 text-left text-slate-600 border-r border-b border-slate-300 h-[34px] cursor-pointer hover:bg-slate-200/60 transition select-none"
          >
            Ruimte
          </th>
          {renderTowerCell('ruimte', topRuimte)}
          {etages.flatMap((etage) =>
            etage.rooms.map((room) => (
              <th key={room.id} colSpan={Math.max(1, room.positions.length)} style={{ top: `${topRuimte}px` }} onContextMenu={(e) => handleCtx('room', room.name, room.id, e)} className="sticky z-30 bg-slate-50 px-3 py-1 text-left overflow-hidden text-slate-700 border-r border-b border-slate-200 text-xs cursor-context-menu select-none h-[34px]">
                <span className="sticky-group-label-room inline-flex will-change-transform min-h-[24px] h-full items-center gap-1 px-2.5 py-0.5 rounded bg-white/80 border border-slate-200 hover:bg-white transition">
                  <span>{room.name}</span>
                  <span className="text-[10px] text-slate-400 font-normal">({room.positions.length} pos)</span>
                </span>
              </th>
            ))
          )}
        </tr>
      )}

      {/* RIJ 3: CLUSTER HEADER (h: 28px) - UNIFORM VOOR ALLE ORDERS */}
      {levels.cluster && (
        <tr data-level="cluster" style={{ top: `${topCluster}px` }} className="sticky z-30 bg-white text-[11px] text-slate-500 border-b border-slate-200 h-[28px] tr-positie-cluster">
          <th
            style={{ top: `${topCluster}px`, left: '0px' }}
            onClick={(e) => handleOpenLevelVisibility(e, false)}
            title="Klik hierop om niveau-zichtbaarheid aan te passen"
            className="sticky left-0 z-40 w-[280px] min-w-[280px] max-w-[280px] sticky-col-0 bg-white px-4 py-0.5 text-left text-slate-500 border-r border-b border-slate-300 font-normal h-[28px] cursor-pointer hover:bg-slate-200/60 transition select-none"
          >
            Cluster
          </th>
          {renderTowerCell('cluster', topCluster)}
          {etages.flatMap((etage) =>
            etage.rooms.flatMap((room) => {
              if (room.clusters && room.clusters.length > 0) {
                const cluster = room.clusters[0];
                const clusteredPositions = room.positions.filter((p) => cluster.positionIds.includes(p.id));
                const remainingPositions = room.positions.filter((p) => !cluster.positionIds.includes(p.id));
                return (
                  <React.Fragment key={room.id + '-clusters'}>
                    <th colSpan={Math.max(1, clusteredPositions.length)} style={{ top: `${topCluster}px` }} onContextMenu={(e) => handleCtx('cluster', cluster.name, cluster.id, e)} className="sticky z-30 bg-blue-50/50 px-3 py-0.5 text-left overflow-hidden text-blue-700 border-r border-b border-blue-200 font-medium cursor-context-menu select-none hover:bg-blue-100/50 transition h-[28px]">
                      <span className="sticky-group-label-cluster inline-flex will-change-transform items-center gap-1 px-2.5 py-0.5 rounded-pill bg-blue-100 text-blue-700 font-semibold text-[10px]">{cluster.name}</span>
                    </th>
                    {remainingPositions.map((pos) => (
                      <th key={pos.id} style={{ top: `${topCluster}px` }} className="sticky z-30 px-3 py-0.5 text-center text-slate-400 border-r border-b border-slate-200 h-[28px]">—</th>
                    ))}
                  </React.Fragment>
                );
              }
              return room.positions.map((pos) => (
                <th key={pos.id} style={{ top: `${topCluster}px` }} className="sticky z-30 px-3 py-0.5 text-center text-slate-400 border-r border-b border-slate-200 h-[28px]">—</th>
              ));
            })
          )}
        </tr>
      )}

      {/* RIJ 4: POSITIES (h: 54px) - ALTIJD ZICHTBAAR */}
      <tr data-level="positie" style={{ top: `${topPosities}px` }} className="sticky z-30 bg-slate-50/90 text-xs font-semibold text-slate-800 border-b-2 border-slate-300 h-[54px] tr-posities">
        <th
          style={{ top: `${topPosities}px`, left: '0px' }}
          onClick={(e) => handleOpenLevelVisibility(e, false)}
          title="Klik hierop om niveau-zichtbaarheid aan te passen"
          className="sticky left-0 z-40 w-[280px] min-w-[280px] max-w-[280px] sticky-col-0 bg-slate-100 px-4 py-2 text-left font-bold text-slate-900 border-r border-b border-slate-300 h-[54px] cursor-pointer hover:bg-slate-200/60 transition select-none"
        >
          Artikelen & Diensten
        </th>
        {renderTowerCell('positie', topPosities)}
        {allPositions.map(({ position }) => {
          const isSelected = selectedColumnIds.has(position.id);
          return (
            <th
              key={position.id}
              style={{ top: `${topPosities}px` }}
              onClick={() => onToggleColumnSelection(position.id)}
              onContextMenu={(e) => handleCtx('position', position.name, position.id, e)}
              className={`sticky z-30 w-[160px] min-w-[160px] max-w-[160px] px-3 py-1 text-center border-r border-b border-slate-300 cursor-pointer select-none transition h-[54px] ${
                isSelected ? 'bg-blue-100/90 ring-2 ring-blue-500 ring-inset' : 'bg-slate-50/90 hover:bg-blue-50/50'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="font-bold text-slate-900 truncate">{position.name}</span>
              </div>
              {position.vlak && (
                <div className="text-[10px] text-slate-500 font-normal leading-tight truncate">{position.vlak}</div>
              )}
              <div className="text-[10px] text-slate-500 font-normal truncate">{position.type}</div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
