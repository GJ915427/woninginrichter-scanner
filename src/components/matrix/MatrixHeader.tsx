'use client';

import React from 'react';
import { Etage, Position } from '../../types/matrix';

export interface MatrixHeaderProps {
  etages: Etage[];
  columnSelectMode: boolean;
  selectedColumnIds: Set<string>;
  onToggleColumnSelection: (positionId: string) => void;
  onHeaderContextMenu?: (
    type: 'etage' | 'room' | 'cluster' | 'position',
    title: string,
    id: string,
    e: React.MouseEvent
  ) => void;
}

interface FlattenedPosition {
  position: Position;
  roomId: string;
  roomName: string;
  etageId: string;
  etageName: string;
}

/**
 * 4-lagige sticky header conform de SSOT Matrix Architectuur.
 * Geometrisch gecalibreerde offsets:
 * - Rij 1: Etage (top: 0px, h-36px, z-30, col 0 z-40)
 * - Rij 2: Ruimte (top: 36px, h-34px, z-30, col 0 z-40)
 * - Rij 3: Cluster (top: 70px, h-28px, z-30, col 0 z-40)
 * - Rij 4: Posities (top: 98px / 70px, h-54px, z-30, col 0 z-40)
 * Voldoet aan INV-GOV-22 (<250 regels, 0 hooks) en border-separate rendering.
 */
export function MatrixHeader({
  etages,
  columnSelectMode,
  selectedColumnIds,
  onToggleColumnSelection,
  onHeaderContextMenu,
}: MatrixHeaderProps) {
  const hasClusters = etages.some((e) =>
    e.rooms.some((r) => r.clusters && r.clusters.length > 0)
  );

  const row4Top = hasClusters ? '98px' : '70px';

  const allPositions: FlattenedPosition[] = [];
  etages.forEach((etage) => {
    etage.rooms.forEach((room) => {
      room.positions.forEach((pos) => {
        allPositions.push({
          position: pos,
          roomId: room.id,
          roomName: room.name,
          etageId: etage.id,
          etageName: etage.name,
        });
      });
    });
  });

  const handleContextMenu = (
    type: 'etage' | 'room' | 'cluster' | 'position',
    title: string,
    id: string,
    e: React.MouseEvent
  ) => {
    if (onHeaderContextMenu) {
      e.preventDefault();
      e.stopPropagation();
      onHeaderContextMenu(type, title, id, e);
    }
  };

  return (
    <thead>
      {/* RIJ 1: ETAGE HEADER (top: 0px, h: 36px) */}
      <tr style={{ top: '0px' }} className="sticky top-0 z-30 bg-slate-100 text-xs font-bold text-slate-800 border-b border-slate-200 h-[36px]">
        <th
          style={{ top: '0px', left: '0px' }}
          className="sticky left-0 top-0 z-40 w-[280px] min-w-[280px] max-w-[280px] bg-slate-100 px-4 py-1 text-left font-semibold text-slate-600 border-r border-b border-slate-300 h-[36px]"
        >
          etage
        </th>
        <th
          style={{ top: '0px' }}
          className="sticky top-0 z-30 w-[160px] min-w-[160px] max-w-[160px] bg-amber-50/80 px-3 py-1 text-center text-amber-900 border-r border-b border-amber-200 font-bold h-[36px]"
        >
          Algemeen
        </th>
        {etages.map((etage) => {
          const totalPos = etage.rooms.reduce((acc, r) => acc + r.positions.length, 0);
          if (totalPos === 0) return null;
          return (
            <th
              key={etage.id}
              colSpan={Math.max(1, totalPos)}
              style={{ top: '0px' }}
              onContextMenu={(e) => handleContextMenu('etage', etage.name, etage.id, e)}
              className="sticky top-0 z-30 bg-slate-100 px-3 py-1 text-center font-bold text-slate-800 border-r border-b border-slate-300 cursor-context-menu select-none h-[36px]"
            >
              <span className="inline-flex min-h-[26px] h-full items-center gap-1.5 px-3 py-0.5 rounded bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 transition">
                🏢 {etage.name}
              </span>
            </th>
          );
        })}
      </tr>

      {/* RIJ 2: RUIMTE HEADER (top: 36px, h: 34px) */}
      <tr style={{ top: '36px' }} className="sticky top-[36px] z-30 bg-slate-50 text-xs font-semibold text-slate-700 border-b border-slate-200 h-[34px]">
        <th
          style={{ top: '36px', left: '0px' }}
          className="sticky left-0 top-[36px] z-40 w-[280px] min-w-[280px] max-w-[280px] bg-slate-50 px-4 py-1 text-left text-slate-600 border-r border-b border-slate-300 h-[34px]"
        >
          ruimte
        </th>
        <th
          style={{ top: '36px' }}
          className="sticky top-[36px] z-30 w-[160px] min-w-[160px] max-w-[160px] bg-amber-50/50 px-3 py-1 text-center text-amber-800 border-r border-b border-amber-200 text-[11px] h-[34px]"
        >
          Project
        </th>
        {etages.flatMap((etage) =>
          etage.rooms.map((room) => (
            <th
              key={room.id}
              colSpan={Math.max(1, room.positions.length)}
              style={{ top: '36px' }}
              onContextMenu={(e) => handleContextMenu('room', room.name, room.id, e)}
              className="sticky top-[36px] z-30 bg-slate-50 px-3 py-1 text-center text-slate-700 border-r border-b border-slate-200 text-xs cursor-context-menu select-none h-[34px]"
            >
              <span className="inline-flex min-h-[24px] h-full items-center gap-1 px-2.5 py-0.5 rounded bg-white/80 border border-slate-200 hover:bg-white transition">
                <span>{room.name}</span>
                <span className="text-[10px] text-slate-400 font-normal">({room.positions.length} pos)</span>
              </span>
            </th>
          ))
        )}
      </tr>

      {/* RIJ 3: CLUSTER / VLAK HEADER (top: 70px, h: 28px) - CONDITIONEEL GERENDERD */}
      {hasClusters && (
        <tr style={{ top: '70px' }} className="sticky top-[70px] z-30 bg-white text-[11px] text-slate-500 border-b border-slate-200 h-[28px]">
          <th
            style={{ top: '70px', left: '0px' }}
            className="sticky left-0 top-[70px] z-40 w-[280px] min-w-[280px] max-w-[280px] bg-white px-4 py-0.5 text-left text-slate-500 border-r border-b border-slate-300 font-normal h-[28px]"
          >
            positie-cluster
          </th>
          <th
            style={{ top: '70px' }}
            className="sticky top-[70px] z-30 w-[160px] min-w-[160px] max-w-[160px] bg-amber-50/30 px-3 py-0.5 text-center text-amber-700 border-r border-b border-amber-200 h-[28px]"
          >
            —
          </th>
          {etages.flatMap((etage) =>
            etage.rooms.flatMap((room) => {
              if (room.clusters && room.clusters.length > 0) {
                const cluster = room.clusters[0];
                const clusteredPositions = room.positions.filter((p) => cluster.positionIds.includes(p.id));
                const remainingPositions = room.positions.filter((p) => !cluster.positionIds.includes(p.id));
                return (
                  <React.Fragment key={room.id + '-clusters'}>
                    <th
                      colSpan={Math.max(1, clusteredPositions.length)}
                      style={{ top: '70px' }}
                      onContextMenu={(e) => handleContextMenu('cluster', cluster.name, cluster.id, e)}
                      className="sticky top-[70px] z-30 bg-blue-50/50 px-3 py-0.5 text-center text-blue-700 border-r border-b border-blue-200 font-medium cursor-context-menu select-none hover:bg-blue-100/50 transition h-[28px]"
                    >
                      🔗 {cluster.name}
                    </th>
                    {remainingPositions.map((pos) => (
                      <th
                        key={pos.id}
                        style={{ top: '70px' }}
                        className="sticky top-[70px] z-30 px-3 py-0.5 text-center text-slate-400 border-r border-b border-slate-200 h-[28px]"
                      >
                        —
                      </th>
                    ))}
                  </React.Fragment>
                );
              }
              return room.positions.map((pos) => (
                <th
                  key={pos.id}
                  style={{ top: '70px' }}
                  className="sticky top-[70px] z-30 px-3 py-0.5 text-center text-slate-400 border-r border-b border-slate-200 h-[28px]"
                >
                  —
                </th>
              ));
            })
          )}
        </tr>
      )}

      {/* RIJ 4: POSITIES MET DYNAMISCHE STICKY OFFSET (top: 98px met cluster, top: 70px zonder cluster, h: 54px) */}
      <tr
        style={{ top: row4Top }}
        className={`sticky ${hasClusters ? 'top-[98px]' : 'top-[70px]'} z-30 bg-slate-50/90 text-xs font-semibold text-slate-800 border-b-2 border-slate-300 h-[54px]`}
      >
        <th
          style={{ top: row4Top, left: '0px' }}
          className={`sticky left-0 ${hasClusters ? 'top-[98px]' : 'top-[70px]'} z-40 w-[280px] min-w-[280px] max-w-[280px] bg-slate-100 px-4 py-2 text-left font-bold text-slate-900 border-r border-b border-slate-300 h-[54px]`}
        >
          Artikelen & Diensten
        </th>
        <th
          style={{ top: row4Top }}
          className={`sticky ${hasClusters ? 'top-[98px]' : 'top-[70px]'} z-30 w-[160px] min-w-[160px] max-w-[160px] bg-amber-50 px-3 py-2 text-center text-amber-950 border-r border-b border-amber-200 h-[54px]`}
        >
          <div className="font-bold">Algemeen</div>
          <div className="text-[10px] text-amber-800 font-normal">Projectscope Diensten</div>
        </th>
        {allPositions.map(({ position }) => {
          const isSelected = selectedColumnIds.has(position.id);
          return (
            <th
              key={position.id}
              style={{ top: row4Top }}
              onClick={() => columnSelectMode && onToggleColumnSelection(position.id)}
              onContextMenu={(e) => handleContextMenu('position', position.name, position.id, e)}
              className={`sticky ${hasClusters ? 'top-[98px]' : 'top-[70px]'} z-30 w-[160px] min-w-[160px] max-w-[160px] px-3 py-1 text-center border-r border-b border-slate-200 transition-colors min-h-[54px] h-[54px] cursor-context-menu select-none ${
                columnSelectMode ? 'cursor-pointer hover:bg-blue-100/60' : ''
              } ${isSelected ? 'bg-blue-100/80 ring-2 ring-blue-500' : 'bg-slate-50'}`}
            >
              <div className="min-h-[44px] flex flex-col justify-center items-center">
                <span className="font-bold text-slate-900 text-xs leading-tight truncate max-w-[145px]">
                  {position.name}
                </span>
                {position.vlak && (
                  <span className="text-[10px] text-slate-500 font-normal leading-tight truncate max-w-[145px]">
                    {position.vlak}
                  </span>
                )}
                <span className="text-[9px] text-slate-400 font-mono">
                  {position.type}
                </span>
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
