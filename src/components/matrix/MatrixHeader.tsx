'use client';

import React from 'react';
import { Etage, Position } from '../../types/matrix';

export interface MatrixHeaderProps {
  etages: Etage[];
  columnSelectMode: boolean;
  selectedColumnIds: Set<string>;
  onToggleColumnSelection: (posId: string) => void;
  onHeaderContextMenu?: (
    type: 'etage' | 'room' | 'cluster' | 'position',
    title: string,
    id: string,
    e: React.MouseEvent
  ) => void;
}

/**
 * Sticky tabelheaders conform INV-GOV-22 (<250 regels).
 * - Dynamische clusterrij: verbergt automatisch indien geen clusters aanwezig zijn.
 * - Contextmenu triggers op alle 4 niveaus (Etage, Ruimte, Cluster, Positie) met Fitts' Law touch targets >= 44px.
 * - Dynamische sticky top offsets (top-66px vs top-98px).
 */
export function MatrixHeader({
  etages,
  columnSelectMode,
  selectedColumnIds,
  onToggleColumnSelection,
  onHeaderContextMenu,
}: MatrixHeaderProps) {
  // Bepaal of er ten minste één cluster aanwezig is in het project
  const hasClusters = etages.some((e) =>
    e.rooms.some((r) => r.clusters && r.clusters.length > 0)
  );

  // Flatten all positions across etages & rooms
  const allPositions: {
    position: Position;
    roomId: string;
    roomName: string;
    etageId: string;
    etageName: string;
  }[] = [];

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
      {/* RIJ 1: ETAGE HEADER (top: 0px) */}
      <tr style={{ top: '0px' }} className="sticky top-0 z-20 bg-slate-100 text-xs font-bold text-slate-800 border-b border-slate-200">
        <th
          style={{ top: '0px', left: '0px' }}
          className="sticky left-0 top-0 z-30 w-[280px] min-w-[280px] max-w-[280px] bg-slate-100 px-4 py-2 text-left font-semibold text-slate-600 border-r border-slate-200"
        >
          etage
        </th>
        <th className="w-[160px] min-w-[160px] max-w-[160px] bg-amber-50/80 px-3 py-2 text-center text-amber-900 border-r border-amber-200 font-bold">
          Algemeen
        </th>
        {etages.map((etage) => {
          const totalPos = etage.rooms.reduce((acc, r) => acc + r.positions.length, 0);
          if (totalPos === 0) return null;
          return (
            <th
              key={etage.id}
              colSpan={Math.max(1, totalPos)}
              onContextMenu={(e) => handleContextMenu('etage', etage.name, etage.id, e)}
              className="bg-slate-100 px-3 py-2 text-center font-bold text-slate-800 border-r border-slate-300 cursor-context-menu select-none"
            >
              <span className="inline-flex min-h-[32px] items-center gap-1.5 px-3 py-1 rounded bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 transition">
                🏢 {etage.name}
              </span>
            </th>
          );
        })}
      </tr>

      {/* RIJ 2: RUIMTE HEADER (top: 34px) */}
      <tr style={{ top: '34px' }} className="sticky top-[34px] z-20 bg-slate-50 text-xs font-semibold text-slate-700 border-b border-slate-200">
        <th
          style={{ top: '34px', left: '0px' }}
          className="sticky left-0 top-[34px] z-30 w-[280px] min-w-[280px] max-w-[280px] bg-slate-50 px-4 py-2 text-left text-slate-600 border-r border-slate-200"
        >
          ruimte
        </th>
        <th className="w-[160px] min-w-[160px] max-w-[160px] bg-amber-50/50 px-3 py-2 text-center text-amber-800 border-r border-amber-200 text-[11px]">
          Project
        </th>
        {etages.flatMap((etage) =>
          etage.rooms.map((room) => (
            <th
              key={room.id}
              colSpan={Math.max(1, room.positions.length)}
              onContextMenu={(e) => handleContextMenu('room', room.name, room.id, e)}
              className="bg-slate-50 px-3 py-2 text-center text-slate-700 border-r border-slate-200 text-xs cursor-context-menu select-none"
            >
              <span className="inline-flex min-h-[32px] items-center gap-1 px-2.5 py-1 rounded bg-white/80 border border-slate-200 hover:bg-white transition">
                <span>{room.name}</span>
                <span className="text-[10px] text-slate-400 font-normal">({room.positions.length} pos)</span>
              </span>
            </th>
          ))
        )}
      </tr>

      {/* RIJ 3: CLUSTER / VLAK HEADER (top: 66px) - CONDITIONEEL GERENDERD */}
      {hasClusters && (
        <tr style={{ top: '66px' }} className="sticky top-[66px] z-20 bg-white text-[11px] text-slate-500 border-b border-slate-200">
          <th
            style={{ top: '66px', left: '0px' }}
            className="sticky left-0 top-[66px] z-30 w-[280px] min-w-[280px] max-w-[280px] bg-white px-4 py-1.5 text-left text-slate-500 border-r border-slate-200 font-normal"
          >
            positie-cluster
          </th>
          <th className="w-[160px] min-w-[160px] max-w-[160px] bg-amber-50/30 px-3 py-1.5 text-center text-amber-700 border-r border-amber-200">
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
                      onContextMenu={(e) => handleContextMenu('cluster', cluster.name, cluster.id, e)}
                      className="bg-blue-50/50 px-3 py-1 text-center text-blue-700 border-r border-blue-200 font-medium cursor-context-menu select-none hover:bg-blue-100/50 transition"
                    >
                      🔗 {cluster.name}
                    </th>
                    {remainingPositions.map((pos) => (
                      <th key={pos.id} className="px-3 py-1 text-center text-slate-400 border-r border-slate-200">
                        —
                      </th>
                    ))}
                  </React.Fragment>
                );
              }
              return room.positions.map((pos) => (
                <th key={pos.id} className="px-3 py-1 text-center text-slate-400 border-r border-slate-200">
                  —
                </th>
              ));
            })
          )}
        </tr>
      )}

      {/* RIJ 4: POSITIES MET DYNAMISCHE STICKY OFFSET (top: 98px met cluster, top: 66px zonder cluster) */}
      <tr
        style={{ top: hasClusters ? '98px' : '66px' }}
        className={`sticky ${hasClusters ? 'top-[98px]' : 'top-[66px]'} z-20 bg-slate-50/90 text-xs font-semibold text-slate-800 border-b-2 border-slate-300`}
      >
        <th
          style={{ top: hasClusters ? '98px' : '66px', left: '0px' }}
          className={`sticky left-0 ${hasClusters ? 'top-[98px]' : 'top-[66px]'} z-30 w-[280px] min-w-[280px] max-w-[280px] bg-slate-100 px-4 py-2.5 text-left font-bold text-slate-900 border-r border-slate-200`}
        >
          Artikelen & Diensten
        </th>
        <th className="w-[160px] min-w-[160px] max-w-[160px] bg-amber-50 px-3 py-2.5 text-center text-amber-950 border-r border-amber-200">
          <div className="font-bold">Algemeen</div>
          <div className="text-[10px] text-amber-800 font-normal">Projectscope Diensten</div>
        </th>
        {allPositions.map(({ position }) => {
          const isSelected = selectedColumnIds.has(position.id);
          return (
            <th
              key={position.id}
              onClick={() => columnSelectMode && onToggleColumnSelection(position.id)}
              onContextMenu={(e) => handleContextMenu('position', position.name, position.id, e)}
              className={`w-[160px] min-w-[160px] max-w-[160px] px-3 py-2 text-center border-r border-slate-200 transition-colors min-h-[44px] cursor-context-menu select-none ${
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
