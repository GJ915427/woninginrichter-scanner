import React, { useState } from 'react';
import { RotateCw, RotateCcw, ZoomIn, ZoomOut, Box, Layers, Maximize } from 'lucide-react';

export interface Surface3D {
  id: string;
  type: 'RoofSurface' | 'WallSurface' | 'GroundSurface';
  normal?: [number, number, number];
  vertices: [number, number, number][]; // 3D coordinates [X, Y, Z]
}

export interface Building3DData {
  pandId?: string;
  surfaces?: Surface3D[];
  center?: [number, number, number];
  dimensions?: { width: number; length: number; height: number };
  roofType?: string;
}

export interface Isometric3DViewerProps {
  pandId?: string;
  buildingData?: any;
  typology?: any;
  address?: string;
  className?: string;
}

export function Isometric3DViewer({
  pandId,
  buildingData,
  typology,
  address,
  className = '',
}: Isometric3DViewerProps) {
  const [rotationAngleDeg, setRotationAngleDeg] = useState(45);
  const [zoom, setZoom] = useState(1.0);

  // Extract dimensions
  const width = buildingData?.metrics?.width || typology?.dimensions?.width || 8.0;
  const length = buildingData?.metrics?.length || typology?.dimensions?.length || 10.0;
  const eaveH = buildingData?.eaveHeight || typology?.heights?.goothoogte || 6.0;
  const ridgeH = buildingData?.ridgeHeight || typology?.heights?.nokhoogte || 9.0;
  const roofType = buildingData?.roofType || typology?.roofProfile?.type || 'Zadeldak';
  const effectivePandId = pandId || buildingData?.pandId || '0953100000003503';

  // Real or generated 3D surfaces
  const surfaces: Surface3D[] = React.useMemo(() => {
    if (buildingData?.surfaces3D && buildingData.surfaces3D.length > 0) {
      return buildingData.surfaces3D;
    }

    // Procedural LoD 2.2 surfaces based on real building metrics
    const hw = width / 2.0;
    const hl = length / 2.0;
    const isSloped = ridgeH > eaveH + 0.5;

    const list: Surface3D[] = [];

    // Ground Surface (z=0)
    list.push({
      id: 'ground',
      type: 'GroundSurface',
      normal: [0, 0, -1],
      vertices: [
        [-hw, -hl, 0],
        [hw, -hl, 0],
        [hw, hl, 0],
        [-hw, hl, 0],
      ],
    });

    // Wall Surfaces (Front, Right, Back, Left)
    list.push({
      id: 'wall-front',
      type: 'WallSurface',
      normal: [0, -1, 0],
      vertices: [
        [-hw, -hl, 0],
        [hw, -hl, 0],
        [hw, -hl, eaveH],
        [-hw, -hl, eaveH],
      ],
    });

    list.push({
      id: 'wall-right',
      type: 'WallSurface',
      normal: [1, 0, 0],
      vertices: isSloped
        ? [
            [hw, -hl, 0],
            [hw, hl, 0],
            [hw, hl, eaveH],
            [hw, 0, ridgeH],
            [hw, -hl, eaveH],
          ]
        : [
            [hw, -hl, 0],
            [hw, hl, 0],
            [hw, hl, eaveH],
            [hw, -hl, eaveH],
          ],
    });

    list.push({
      id: 'wall-back',
      type: 'WallSurface',
      normal: [0, 1, 0],
      vertices: [
        [hw, hl, 0],
        [-hw, hl, 0],
        [-hw, hl, eaveH],
        [hw, hl, eaveH],
      ],
    });

    list.push({
      id: 'wall-left',
      type: 'WallSurface',
      normal: [-1, 0, 0],
      vertices: isSloped
        ? [
            [-hw, hl, 0],
            [-hw, -hl, 0],
            [-hw, -hl, eaveH],
            [-hw, 0, ridgeH],
            [-hw, hl, eaveH],
          ]
        : [
            [-hw, hl, 0],
            [-hw, -hl, 0],
            [-hw, -hl, eaveH],
            [-hw, hl, eaveH],
          ],
    });

    // Roof Surfaces
    if (isSloped) {
      list.push({
        id: 'roof-front',
        type: 'RoofSurface',
        normal: [0, -0.707, 0.707],
        vertices: [
          [-hw, -hl, eaveH],
          [hw, -hl, eaveH],
          [hw, 0, ridgeH],
          [-hw, 0, ridgeH],
        ],
      });
      list.push({
        id: 'roof-back',
        type: 'RoofSurface',
        normal: [0, 0.707, 0.707],
        vertices: [
          [hw, hl, eaveH],
          [-hw, hl, eaveH],
          [-hw, 0, ridgeH],
          [hw, 0, ridgeH],
        ],
      });
    } else {
      list.push({
        id: 'roof-flat',
        type: 'RoofSurface',
        normal: [0, 0, 1],
        vertices: [
          [-hw, -hl, eaveH],
          [hw, -hl, eaveH],
          [hw, hl, eaveH],
          [-hw, hl, eaveH],
        ],
      });
    }

    return list;
  }, [buildingData, width, length, eaveH, ridgeH]);

  // Project 3D coordinate to 2D screen coordinate
  const project3DTo2D = (x: number, y: number, z: number) => {
    const theta = (rotationAngleDeg * Math.PI) / 180.0;
    const phi = (32.0 * Math.PI) / 180.0; // Isometric inclination
    const baseScale = 18.0 * zoom;

    const rx = x * Math.cos(theta) - y * Math.sin(theta);
    const ry = x * Math.sin(theta) + y * Math.cos(theta);

    const screenX = 300 + rx * baseScale;
    const screenY = 250 - (ry * Math.sin(phi) + z * Math.cos(phi)) * baseScale;

    return { x: screenX, y: screenY, depth: ry };
  };

  const sortedSurfaces = React.useMemo(() => {
    const theta = (rotationAngleDeg * Math.PI) / 180.0;
    return [...surfaces].sort((a, b) => {
      const avgYA =
        a.vertices.reduce((sum, v) => sum + (v[0] * Math.sin(theta) + v[1] * Math.cos(theta)), 0) /
        a.vertices.length;
      const avgYB =
        b.vertices.reduce((sum, v) => sum + (v[0] * Math.sin(theta) + v[1] * Math.cos(theta)), 0) /
        b.vertices.length;
      return avgYA - avgYB;
    });
  }, [surfaces, rotationAngleDeg]);

  const getSurfaceStyle = (surf: Surface3D) => {
    if (surf.type === 'RoofSurface') {
      return { fill: '#334155', stroke: '#94a3b8', fillOpacity: 0.95 };
    }
    if (surf.type === 'WallSurface') {
      const isSunlit = surf.normal ? surf.normal[0] > 0 || surf.normal[1] < 0 : false;
      return {
        fill: isSunlit ? '#cbd5e1' : '#64748b',
        stroke: '#475569',
        fillOpacity: 0.9,
      };
    }
    return { fill: '#0f172a', stroke: '#1e293b', fillOpacity: 0.7 };
  };

  return (
    <div
      data-testid="isometric-3d-viewer"
      className={`flex flex-col h-full w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl ${className}`}
    >
      {/* Control Bar */}
      <div className="flex items-center justify-between p-3 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white block">3D BAG LoD 2.2 Volumemodel</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-teal-400 font-mono">
                {effectivePandId}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                {roofType}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              Rotatie: {rotationAngleDeg}° • Schaal: {zoom.toFixed(1)}x
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setRotationAngleDeg((prev) => (prev - 45 + 360) % 360)}
            aria-label="Roteer linksom"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setRotationAngleDeg((prev) => (prev + 45) % 360)}
            aria-label="Roteer rechtsom"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-800 mx-1" />
          <button
            onClick={() => setZoom((z) => Math.min(2.0, z + 0.1))}
            aria-label="Zoom in"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
            aria-label="Zoom uit"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3D SVG Projection Canvas */}
      <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
        <svg
          viewBox="0 0 600 450"
          className="w-full h-full max-h-[500px]"
          data-testid="isometric-3d-svg"
        >
          {/* Subtle Ground Grid */}
          {[-8, -4, 0, 4, 8].map((gridStep) => {
            const p1 = project3DTo2D(-12, gridStep, 0);
            const p2 = project3DTo2D(12, gridStep, 0);
            return (
              <line
                key={`grid-x-${gridStep}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#1e293b"
                strokeWidth="1"
              />
            );
          })}
          {[-8, -4, 0, 4, 8].map((gridStep) => {
            const p1 = project3DTo2D(gridStep, -12, 0);
            const p2 = project3DTo2D(gridStep, 12, 0);
            return (
              <line
                key={`grid-y-${gridStep}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#1e293b"
                strokeWidth="1"
              />
            );
          })}

          {/* Render 3D Surfaces dynamically */}
          {sortedSurfaces.map((surf) => {
            const style = getSurfaceStyle(surf);
            const pointsStr = surf.vertices
              .map((v) => {
                const pt = project3DTo2D(v[0], v[1], v[2]);
                return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
              })
              .join(' ');

            return (
              <polygon
                key={surf.id}
                points={pointsStr}
                fill={style.fill}
                fillOpacity={style.fillOpacity}
                stroke={style.stroke}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            );
          })}
        </svg>

        {/* Legend Overlay */}
        <div className="absolute bottom-4 left-4 bg-slate-950/80 backdrop-blur-md rounded-xl p-2.5 border border-slate-800 text-[11px] space-y-1 text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-slate-700 border border-slate-500 inline-block" />
            <span>Dakvlakken (RoofSurface)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-slate-400 border border-slate-600 inline-block" />
            <span>Wanden (WallSurface)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
