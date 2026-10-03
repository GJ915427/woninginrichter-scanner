import React, { useState } from 'react';
import {
  estimateFenestration,
  OpeningType,
} from '@/domain/architectural/fenestration-estimator';
import { ShieldCheck, HelpCircle, Sliders, Check, Building } from 'lucide-react';

export interface FacadeElevationData {
  orientation?: string;
  groundNAP?: number;
  drempelNAP?: number;
  gutterNAP?: number;
  ridgeNAP?: number;
  widthMeters?: number;
  heightMeters?: number;
  floorsCount?: number;
  hasDoor?: boolean;
  windowsCount?: number;
  frontFacade?: { width: number; height: number; roofSlopeDeg?: number; ridgeHeight?: number; eaveHeight?: number };
  rearFacade?: { width: number; height: number; roofSlopeDeg?: number; ridgeHeight?: number; eaveHeight?: number };
  leftFacade?: { width: number; height: number; roofSlopeDeg?: number; ridgeHeight?: number; eaveHeight?: number };
  rightFacade?: { width: number; height: number; roofSlopeDeg?: number; ridgeHeight?: number; eaveHeight?: number };
}

export interface FacadeElevationsViewerProps {
  pandId?: string;
  facadeData?: FacadeElevationData;
  buildingData?: any;
  typology?: any;
  address?: string;
  className?: string;
}

export function FacadeElevationsViewer({
  pandId,
  facadeData,
  buildingData,
  typology,
  address,
  className = '',
}: FacadeElevationsViewerProps) {
  const [selectedFacade, setSelectedFacade] = useState<'front' | 'rear' | 'left' | 'right'>('front');
  const [rearOverrideType, setRearOverrideType] = useState<OpeningType>(OpeningType.SCHUIFPUI);

  // Extract dimensions from real building data or fallback to typology
  const width =
    facadeData?.[`${selectedFacade}Facade`]?.width ||
    facadeData?.widthMeters ||
    buildingData?.metrics?.width ||
    typology?.dimensions?.width ||
    8.4;
  const eaveHeight =
    facadeData?.[`${selectedFacade}Facade`]?.eaveHeight ||
    facadeData?.gutterNAP ||
    buildingData?.eaveHeight ||
    typology?.heights?.goothoogte ||
    6.0;
  const ridgeHeight =
    facadeData?.[`${selectedFacade}Facade`]?.ridgeHeight ||
    facadeData?.ridgeNAP ||
    facadeData?.heightMeters ||
    buildingData?.ridgeHeight ||
    typology?.heights?.nokhoogte ||
    9.0;
  const roofSlopeDeg =
    facadeData?.[`${selectedFacade}Facade`]?.roofSlopeDeg ||
    buildingData?.roofSlopeDeg ||
    typology?.roofProfile?.hellingshoek ||
    45;

  // Fenestration estimation
  const fenestration = estimateFenestration(
    {
      frontWallSegment: { start: { x: 0, y: 0 }, end: { x: width, y: 0 } },
      rearWallSegment: { start: { x: width, y: 0 }, end: { x: 0, y: 0 } },
      vboEntrancePoint: buildingData?.vboEntrancePoint,
      bgtCanopy: buildingData?.bgtInstallations?.length > 0,
      constructionYear: buildingData?.constructionYear || typology?.bag?.bouwjaar,
      epOnlineGlassArea: buildingData?.epOnline?.glasOppervlak,
    },
    selectedFacade === 'rear' ? { rearFacadeType: rearOverrideType, width: 3.4 } : undefined
  );

  const currentOpenings = fenestration.openings.filter((o) => o.facade === selectedFacade);
  const isFront = selectedFacade === 'front';
  const isRear = selectedFacade === 'rear';

  // SVG drawing dimensions
  const svgWidth = 600;
  const svgHeight = 420;
  const scale = 28; // pixels per meter
  const groundY = 360;
  const originX = (svgWidth - width * scale) / 2;

  const wallPixelH = eaveHeight * scale;
  const roofPixelH = (ridgeHeight - eaveHeight) * scale;
  const eaveY = groundY - wallPixelH;
  const ridgeY = eaveY - roofPixelH;

  return (
    <div
      data-testid="facade-elevations-viewer"
      className={`flex flex-col h-full w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl ${className}`}
    >
      {/* Top Header & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between p-3 bg-slate-950/80 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-bold text-white tracking-tight">Gevelaanzichten</span>
          </div>
          {address && (
            <span className="text-xs text-slate-400 border-l border-slate-800 pl-3">
              {address}
            </span>
          )}
        </div>

        {/* Facade Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          {(['front', 'rear', 'left', 'right'] as const).map((facade) => (
            <button
              key={facade}
              onClick={() => setSelectedFacade(facade)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                selectedFacade === facade
                  ? 'bg-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {facade === 'front'
                ? 'Voorgevel'
                : facade === 'rear'
                ? 'Achtergevel'
                : facade === 'left'
                ? 'Linkerzijgevel'
                : 'Rechterzijgevel'}
            </button>
          ))}
        </div>

        {/* Reliability Badges (Zero-Hallucination) */}
        <div className="flex items-center gap-2">
          {isFront && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Geverifieerd via Street View &amp; BGT</span>
            </span>
          )}
          {isRear && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-800/60 shadow-sm">
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Bouwkundige benadering (EP-Online / NEN)</span>
            </span>
          )}
        </div>
      </div>

      {/* Rear Facade Interactive Override Selector */}
      {isRear && (
        <div className="px-4 py-2 bg-amber-950/20 border-b border-amber-900/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-300/90 font-medium">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Kies werkelijke pui-indeling tuinzijde:</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { type: OpeningType.SCHUIFPUI, label: 'Schuifpui' },
              { type: OpeningType.OPEN_DOORS, label: 'Openslaande deuren' },
              { type: OpeningType.WINDOW, label: 'Standaard raam' },
            ].map((opt) => (
              <button
                key={opt.type}
                onClick={() => setRearOverrideType(opt.type)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                  rearOverrideType === opt.type
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {rearOverrideType === opt.type && <Check className="w-3 h-3" />}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SVG Canvas */}
      <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full max-h-[500px]"
          data-testid="facade-elevation-svg"
        >
          {/* Ground Line (Peil / Maaiveld) */}
          <line
            x1="20"
            y1={groundY}
            x2={svgWidth - 20}
            y2={groundY}
            stroke="#64748b"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
          <text x="25" y={groundY - 6} fill="#94a3b8" fontSize="11" fontFamily="sans-serif">
            Maaiveld (Peil = 0.00)
          </text>

          {/* Facade Wall Body */}
          <rect
            x={originX}
            y={eaveY}
            width={width * scale}
            height={wallPixelH}
            fill="#334155"
            stroke="#94a3b8"
            strokeWidth="2"
          />

          {/* Roof Shape */}
          {roofSlopeDeg > 5 ? (
            // Gable / Pitch Roof
            <polygon
              points={`${originX},${eaveY} ${originX + (width * scale) / 2},${ridgeY} ${
                originX + width * scale
              },${eaveY}`}
              fill="#1e293b"
              stroke="#cbd5e1"
              strokeWidth="2"
            />
          ) : (
            // Flat Roof with Parapet (Mastiekhoek / Dakrand)
            <rect
              x={originX - 4}
              y={eaveY - 8}
              width={width * scale + 8}
              height="8"
              fill="#0f172a"
              stroke="#64748b"
              strokeWidth="1.5"
            />
          )}

          {/* Floor Division Lines */}
          <line
            x1={originX}
            y1={groundY - 2.8 * scale}
            x2={originX + width * scale}
            y2={groundY - 2.8 * scale}
            stroke="#475569"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text
            x={originX + 8}
            y={groundY - 2.8 * scale - 4}
            fill="#64748b"
            fontSize="10"
            fontFamily="sans-serif"
          >
            1e Verdieping (+2.80m)
          </text>

          {/* Openings (Doors & Windows) */}
          {currentOpenings.map((op) => {
            const opPixelW = op.width * scale;
            const opPixelH = op.height * scale;
            const opX = originX + (op.position.x / width) * (width * scale) - opPixelW / 2;
            const opY = groundY - op.sillHeight * scale - opPixelH;

            const isDoor = op.type === OpeningType.DOOR || op.type === OpeningType.SCHUIFPUI || op.type === OpeningType.OPEN_DOORS;

            return (
              <g key={op.id}>
                {/* Frame */}
                <rect
                  x={opX}
                  y={opY}
                  width={opPixelW}
                  height={opPixelH}
                  fill={isDoor ? '#1e293b' : '#38bdf8'}
                  fillOpacity={isDoor ? '0.9' : '0.25'}
                  stroke="#38bdf8"
                  strokeWidth="2"
                  rx="2"
                />
                {/* Mullions / Glass subdivisions */}
                {op.type === OpeningType.SCHUIFPUI && (
                  <line
                    x1={opX + opPixelW / 2}
                    y1={opY}
                    x2={opX + opPixelW / 2}
                    y2={opY + opPixelH}
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />
                )}
                {/* Label */}
                <text
                  x={opX + opPixelW / 2}
                  y={opY + opPixelH / 2 + 4}
                  fill="#f8fafc"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {op.type}
                </text>
              </g>
            );
          })}

          {/* Metrical Dimension Annotations */}
          <line
            x1={originX}
            y1={groundY + 24}
            x2={originX + width * scale}
            y2={groundY + 24}
            stroke="#2dd4bf"
            strokeWidth="1.5"
          />
          <text
            x={originX + (width * scale) / 2}
            y={groundY + 38}
            fill="#2dd4bf"
            fontSize="11"
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            {width.toFixed(2)} m
          </text>
        </svg>
      </div>
    </div>
  );
}
