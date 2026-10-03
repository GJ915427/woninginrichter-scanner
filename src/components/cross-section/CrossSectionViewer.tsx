'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Ruler,
  Layers,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { BENCHMARK_TYPOLOGIES, BenchmarkTypology, analyzeTypology } from '@/fixtures/benchmark-typologies';
import { Point2D, Segment2D } from '@/domain/geometry/types';
import { FloorBuilder } from '@/domain/architectural/floor-builder';
import { NEN2580Calculator } from '@/domain/architectural/nen2580-calculator';
import { LabelLayoutEngine } from '@/domain/architectural/label-layout-engine';

export interface CrossSectionViewerProps {
  typology?: BenchmarkTypology;
  buildingData?: any;
  address?: string;
  analysis?: ReturnType<typeof analyzeTypology>;
  className?: string;
  showNEN2580Lines?: boolean;
  showFloorSlabs?: boolean;
  showDatumLines?: boolean;
  showJoggedLabels?: boolean;
}

export function CrossSectionViewer({
  typology: passedTypology,
  buildingData,
  address,
  analysis: initialAnalysis,
  className = '',
  showNEN2580Lines: initialShowNEN2580 = true,
  showFloorSlabs: initialShowSlabs = true,
  showDatumLines: initialShowDatum = true,
  showJoggedLabels: initialShowLabels = true,
}: CrossSectionViewerProps) {
  // Layer toggles
  const [showNEN2580Lines, setShowNEN2580Lines] = useState(initialShowNEN2580);
  const [showFloorSlabs, setShowFloorSlabs] = useState(initialShowSlabs);
  const [showDatumLines, setShowDatumLines] = useState(initialShowDatum);
  const [showJoggedLabels, setShowJoggedLabels] = useState(initialShowLabels);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState<Point2D>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<Point2D>({ x: 0, y: 0 });
  const panStartRef = useRef<Point2D>({ x: 0, y: 0 });

  const typology = passedTypology ?? BENCHMARK_TYPOLOGIES[0];

  // Analyze typology (floors, etc.)
  const analysis = useMemo(() => {
    return initialAnalysis ?? analyzeTypology(typology);
  }, [initialAnalysis, typology]);

  const { floors } = analysis;
  const heights = typology.heightAttributes;

  // Determine section cut length (building depth)
  const roofProfile = typology.roofProfile;
  const minProfileX = Math.min(...roofProfile.map((p) => p.x));
  const maxProfileX = Math.max(...roofProfile.map((p) => p.x));
  const buildingDepth = maxProfileX - minProfileX;

  // Ground datum and drempelpeil
  const groundNAP = heights.groundLevelNAP;
  const drempelNAP = groundNAP + 0.15;
  const ridgeNAP = heights.ridgeHeightNAP ?? 10.0;
  const eavesNAP = heights.eavesHeightNAP ?? 6.0;

  // Find attic floor level for NEN 2580 headroom calculation
  const atticFloor = floors.find((f) => f.isAttic) ?? floors[floors.length - 1];
  const atticElevation = atticFloor ? atticFloor.elevationNAP : groundNAP + 5.6;

  // NEN 2580 clearance lines calculation
  const nenClearance = useMemo(() => {
    const clearance150 = atticElevation + 1.50;
    const clearance260 = atticElevation + 2.60;

    // Convert roof profile to Segment2D array for NEN2580Calculator
    const segments: Segment2D[] = [];
    for (let i = 0; i < roofProfile.length - 1; i++) {
      segments.push({
        p1: { x: roofProfile[i].x, y: roofProfile[i].y },
        p2: { x: roofProfile[i + 1].x, y: roofProfile[i + 1].y },
      });
    }

    const inter150 = NEN2580Calculator.intersectHorizontalLine(
      segments,
      clearance150,
      'nen2580_150'
    );
    const inter260 = NEN2580Calculator.intersectHorizontalLine(
      segments,
      clearance260,
      'nen2580_260'
    );

    return {
      elevation150: clearance150,
      elevation260: clearance260,
      intersections150: inter150,
      intersections260: inter260,
    };
  }, [atticElevation, roofProfile]);

  // Elevation markers for 1D vertical stack with LabelLayoutEngine
  const verticalStack = useMemo(() => {
    const rawMarkers: Array<{
      id: string;
      text: string;
      nominalY: number;
      color: string;
    }> = [
      {
        id: 'ground',
        text: `Maaiveld: ${groundNAP >= 0 ? '+' : ''}${groundNAP.toFixed(2)}m NAP`,
        nominalY: groundNAP,
        color: '#64748b',
      },
      {
        id: 'drempel',
        text: `Peil = 0.00 (${drempelNAP >= 0 ? '+' : ''}${drempelNAP.toFixed(2)}m NAP)`,
        nominalY: drempelNAP,
        color: '#0284c7',
      },
      ...floors.slice(1).map((floor) => ({
        id: `floor-${floor.id}`,
        text: `${floor.name}: +${(floor.elevationNAP - drempelNAP).toFixed(2)}m (+${floor.elevationNAP.toFixed(2)}m NAP)`,
        nominalY: floor.elevationNAP,
        color: '#1e293b',
      })),
      {
        id: 'nen-150',
        text: `NEN 2580 GO Wonen (+1.50m)`,
        nominalY: nenClearance.elevation150,
        color: '#d97706',
      },
      {
        id: 'nen-260',
        text: `NEN 2580 Verblijfsgebied (+2.60m)`,
        nominalY: nenClearance.elevation260,
        color: '#b45309',
      },
      {
        id: 'ridge',
        text: `Nokhoogte: +${ridgeNAP.toFixed(2)}m NAP`,
        nominalY: ridgeNAP,
        color: '#475569',
      },
    ];

    // Sort markers by nominalY ascending
    const sortedMarkers = rawMarkers.sort((a, b) => a.nominalY - b.nominalY);

    // Resolve vertical stack to guarantee no label collision (minSpacing = 0.45m in section scale)
    const resolved = LabelLayoutEngine.resolveVerticalStack(sortedMarkers, 0.45);

    // Map marker colors by id
    const colorMap = new Map<string, string>();
    for (const m of rawMarkers) {
      colorMap.set(m.id, m.color);
    }

    // Compute jogged leader lines for each marker
    const leaderTargetX = buildingDepth + 2.4; // labels placed on the right side of the cross-section
    const items = resolved.map((item) => {
      const leaderPoints = LabelLayoutEngine.computeJoggedLeaderPoints(
        item,
        leaderTargetX,
        0.5
      );
      return {
        ...item,
        leaderPoints,
        targetX: leaderTargetX,
        color: colorMap.get(item.id) ?? '#1e293b',
      };
    });

    return items;
  }, [groundNAP, drempelNAP, floors, nenClearance, ridgeNAP, buildingDepth]);

  // Section Bounding Box in Section Coordinates (meters)
  const bbox = useMemo(() => {
    const minX = -2.5;
    const maxX = buildingDepth + 5.5; // space for labels on right
    const minY = groundNAP - 1.2;
    const maxY = ridgeNAP + 1.5;

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [groundNAP, ridgeNAP, buildingDepth]);

  // Section coordinate to SVG mapper
  // SVG X = (x - bbox.minX)
  // SVG Y = (bbox.maxY - napY) (higher NAP = top of SVG)
  const toSvgX = (x: number): number => x - bbox.minX;
  const toSvgY = (napY: number): number => bbox.maxY - napY;

  // Zoom & Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = (e.clientX - dragStartRef.current.x) / 20;
    const dy = (e.clientY - dragStartRef.current.y) / 20;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.min(Math.max(z * factor, 0.5), 4.0));
  };

  const handleReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // SVG path for roof profile
  const roofPolyPath = useMemo(() => {
    if (roofProfile.length === 0) return '';
    const points = roofProfile.map((p) => `${toSvgX(p.x).toFixed(2)},${toSvgY(p.y).toFixed(2)}`);
    return points.join(' ');
  }, [roofProfile, bbox]);

  return (
    <div
      className={`relative flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden select-none ${className}`}
    >
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-700">
        <div className="flex items-center gap-2 font-medium">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span>Verticale Doorsnede (Langssnede A-A)</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500">NEN 2580 & AHN5 Profiel</span>
        </div>

        {/* View Layer Toggles */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowNEN2580Lines((v) => !v)}
            title="NEN 2580 stahoogtelijnen (1.50m & 2.60m)"
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              showNEN2580Lines
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
            }`}
          >
            NEN 2580 Lijnen
          </button>
          <button
            type="button"
            onClick={() => setShowFloorSlabs((v) => !v)}
            title="Verdiepingsvloeren"
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              showFloorSlabs
                ? 'bg-blue-100 text-blue-800'
                : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Vloeren
          </button>
          <button
            type="button"
            onClick={() => setShowDatumLines((v) => !v)}
            title="Maaiveld & Peil referentielijnen"
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              showDatumLines
                ? 'bg-sky-100 text-sky-800'
                : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Maaiveld / Peil
          </button>
          <button
            type="button"
            onClick={() => setShowJoggedLabels((v) => !v)}
            title="1D verticale stapellabels"
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              showJoggedLabels
                ? 'bg-slate-300 text-slate-800'
                : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Hoogtematen
          </button>
        </div>
      </div>

      {/* Main SVG Container */}
      <div
        className="relative flex-1 min-h-[440px] bg-slate-50/50 cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          data-testid="cross-section-svg"
          viewBox={`0 0 ${bbox.width} ${bbox.height}`}
          className="w-full h-full"
          style={{ touchAction: 'none' }}
        >
          <defs>
            {/* 1m Grid */}
            <pattern
              id="section-grid"
              width="1"
              height="1"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 1 0 L 0 0 0 1"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="0.02"
              />
            </pattern>

            {/* Concrete Hatch for Floor Slabs */}
            <pattern
              id="concrete-hatch"
              width="0.25"
              height="0.25"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="0.25"
                stroke="#94a3b8"
                strokeWidth="0.04"
              />
            </pattern>

            {/* Ground Soil Pattern */}
            <pattern
              id="earth-soil-pattern"
              width="0.5"
              height="0.5"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0.5" x2="0.5" y2="0" stroke="#cbd5e1" strokeWidth="0.03" />
              <line x1="0.2" y1="0.5" x2="0.5" y2="0.2" stroke="#cbd5e1" strokeWidth="0.03" />
            </pattern>
          </defs>

          {/* Applied Pan & Zoom Group */}
          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            style={{ transformOrigin: `${bbox.width / 2}px ${bbox.height / 2}px` }}
          >
            {/* Background Grid */}
            <rect
              x="0"
              y="0"
              width={bbox.width}
              height={bbox.height}
              fill="url(#section-grid)"
            />

            {/* Ground Soil Layer below Maaiveld */}
            {showDatumLines && (
              <rect
                x="0"
                y={toSvgY(groundNAP)}
                width={bbox.width}
                height={bbox.height - toSvgY(groundNAP)}
                fill="url(#earth-soil-pattern)"
                opacity="0.6"
              />
            )}

            {/* Maaiveld Datum Line (AHN5) */}
            {showDatumLines && (
              <g className="ground-datum-line">
                <line
                  data-testid="ground-datum-line"
                  x1="0"
                  y1={toSvgY(groundNAP)}
                  x2={toSvgX(buildingDepth + 1.5)}
                  y2={toSvgY(groundNAP)}
                  stroke="#475569"
                  strokeWidth="0.08"
                />
                {/* NAP Benchmark Marker (Inverted Triangle) */}
                <polygon
                  points={`${toSvgX(-0.5)},${toSvgY(groundNAP)} ${toSvgX(-0.3)},${toSvgY(
                    groundNAP - 0.35
                  )} ${toSvgX(-0.7)},${toSvgY(groundNAP - 0.35)}`}
                  fill="#475569"
                />
              </g>
            )}

            {/* Drempelpeil Line (+0.15m boven maaiveld) */}
            {showDatumLines && (
              <g className="drempelpeil-line">
                <line
                  data-testid="drempelpeil-line"
                  x1="0"
                  y1={toSvgY(drempelNAP)}
                  x2={toSvgX(buildingDepth + 1.5)}
                  y2={toSvgY(drempelNAP)}
                  stroke="#0284c7"
                  strokeWidth="0.06"
                  strokeDasharray="0.3 0.15"
                />
              </g>
            )}

            {/* Building Envelope Interior Background */}
            <polygon
              points={`
                ${toSvgX(0)},${toSvgY(drempelNAP)}
                ${toSvgX(0)},${toSvgY(eavesNAP)}
                ${roofProfile
                  .map((p) => `${toSvgX(p.x).toFixed(2)},${toSvgY(p.y).toFixed(2)}`)
                  .join(' ')}
                ${toSvgX(buildingDepth)},${toSvgY(eavesNAP)}
                ${toSvgX(buildingDepth)},${toSvgY(drempelNAP)}
              `}
              fill="#ffffff"
            />

            {/* Exterior Walls (Front & Rear Facades in Section Cut) */}
            <g className="facade-walls">
              {/* Front Facade Wall (at x = 0) */}
              <rect
                data-testid="front-wall-section"
                x={toSvgX(-0.35)}
                y={toSvgY(roofProfile[0].y)}
                width="0.35"
                height={toSvgY(groundNAP - 0.6) - toSvgY(roofProfile[0].y)}
                fill="#334155"
                stroke="#1e293b"
                strokeWidth="0.04"
              />
              {/* Rear Facade Wall (at x = buildingDepth) */}
              <rect
                data-testid="rear-wall-section"
                x={toSvgX(buildingDepth)}
                y={toSvgY(roofProfile[roofProfile.length - 1].y)}
                width="0.35"
                height={
                  toSvgY(groundNAP - 0.6) -
                  toSvgY(roofProfile[roofProfile.length - 1].y)
                }
                fill="#334155"
                stroke="#1e293b"
                strokeWidth="0.04"
              />
            </g>

            {/* Roof Profile Polyline */}
            <polyline
              data-testid="roof-profile-line"
              points={roofPolyPath}
              fill="none"
              stroke="#1e293b"
              strokeWidth="0.22"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Dynamic Floor Slabs */}
            {showFloorSlabs &&
              floors.map((floor) => {
                const slabTopY = toSvgY(floor.elevationNAP);
                const slabThickness = 0.28; // 28cm floor slab thickness
                const slabHeight = slabThickness;

                return (
                  <g key={`slab-${floor.id}`} className="floor-slab">
                    {/* Floor Slab Rect */}
                    <rect
                      data-testid={`floor-slab-${floor.id}`}
                      x={toSvgX(0)}
                      y={slabTopY}
                      width={buildingDepth}
                      height={slabHeight}
                      fill="url(#concrete-hatch)"
                      stroke="#475569"
                      strokeWidth="0.04"
                    />
                    {/* Finished Floor Level Line (OK Vloer) */}
                    <line
                      x1={toSvgX(0)}
                      y1={slabTopY}
                      x2={toSvgX(buildingDepth)}
                      y2={slabTopY}
                      stroke="#0f172a"
                      strokeWidth="0.06"
                    />
                    {/* Floor Label inside Section */}
                    <text
                      x={toSvgX(buildingDepth / 2)}
                      y={slabTopY + slabHeight + 0.35}
                      textAnchor="middle"
                      fontSize="0.26"
                      fontWeight="600"
                      fill="#475569"
                    >
                      {floor.name}
                    </text>
                  </g>
                );
              })}

            {/* NEN 2580 Clearance Lines */}
            {showNEN2580Lines && (
              <g className="nen-2580-clearance">
                {/* 1.50m GO Wonen Clearance Line */}
                <line
                  data-testid="nen-150-line"
                  x1={toSvgX(0)}
                  y1={toSvgY(nenClearance.elevation150)}
                  x2={toSvgX(buildingDepth)}
                  y2={toSvgY(nenClearance.elevation150)}
                  stroke="#d97706"
                  strokeWidth="0.08"
                  strokeDasharray="0.3 0.15"
                />

                {/* 1.50m Boundary Intersection Markers */}
                {nenClearance.intersections150.xHits.map((xHit, idx) => (
                  <circle
                    key={`nen-inter-150-${idx}`}
                    cx={toSvgX(xHit)}
                    cy={toSvgY(nenClearance.elevation150)}
                    r="0.10"
                    fill="#d97706"
                    stroke="#ffffff"
                    strokeWidth="0.03"
                  />
                ))}

                {/* 2.60m Verblijfsgebied Clearance Line */}
                <line
                  data-testid="nen-260-line"
                  x1={toSvgX(0)}
                  y1={toSvgY(nenClearance.elevation260)}
                  x2={toSvgX(buildingDepth)}
                  y2={toSvgY(nenClearance.elevation260)}
                  stroke="#b45309"
                  strokeWidth="0.08"
                  strokeDasharray="0.3 0.15"
                />

                {/* 2.60m Boundary Intersection Markers */}
                {nenClearance.intersections260.xHits.map((xHit, idx) => (
                  <circle
                    key={`nen-inter-260-${idx}`}
                    cx={toSvgX(xHit)}
                    cy={toSvgY(nenClearance.elevation260)}
                    r="0.10"
                    fill="#b45309"
                    stroke="#ffffff"
                    strokeWidth="0.03"
                  />
                ))}
              </g>
            )}

            {/* 1D Vertical Stacked Elevation Labels with Jogged Leaders */}
            {showJoggedLabels &&
              verticalStack.map((item) => {
                const svgAnchorX = toSvgX(buildingDepth + 0.1);
                const svgAnchorY = toSvgY(item.nominalY);
                const svgLabelX = toSvgX(item.targetX);
                const svgLabelY = toSvgY(item.joggedY);

                // Jogged points: [anchor -> mid1 -> mid2 -> label]
                const jogMidX = (svgAnchorX + svgLabelX) / 2;

                return (
                  <g key={`v-label-${item.id}`} className="vertical-label-group">
                    {/* Horizontal tick mark at actual elevation */}
                    <line
                      x1={svgAnchorX}
                      y1={svgAnchorY}
                      x2={svgAnchorX + 0.3}
                      y2={svgAnchorY}
                      stroke={item.color}
                      strokeWidth="0.04"
                    />

                    {/* Jogged leader line */}
                    <path
                      d={`M ${svgAnchorX + 0.3} ${svgAnchorY} L ${jogMidX} ${svgAnchorY} L ${jogMidX} ${svgLabelY} L ${svgLabelX - 0.1} ${svgLabelY}`}
                      fill="none"
                      stroke={item.color}
                      strokeWidth="0.03"
                      strokeDasharray="0.1 0.05"
                    />

                    {/* Label background pill */}
                    <rect
                      x={svgLabelX}
                      y={svgLabelY - 0.18}
                      width="3.2"
                      height="0.36"
                      rx="0.06"
                      fill="#ffffff"
                      stroke={item.color}
                      strokeWidth="0.02"
                      opacity="0.95"
                    />

                    {/* Label text */}
                    <text
                      x={svgLabelX + 0.15}
                      y={svgLabelY + 0.02}
                      dominantBaseline="middle"
                      fontSize="0.18"
                      fontWeight="600"
                      fill={item.color}
                    >
                      {item.text}
                    </text>
                  </g>
                );
              })}
          </g>
        </svg>

        {/* Floating Zoom & Pan Controls */}
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 p-1 rounded-lg bg-white/90 backdrop-blur-xs border border-slate-200 shadow-md">
          <button
            type="button"
            data-testid="cs-zoom-in-button"
            onClick={() => setZoom((z) => Math.min(z * 1.25, 4.0))}
            title="Inzoomen (+)"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-700 active:scale-95"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            data-testid="cs-zoom-out-button"
            onClick={() => setZoom((z) => Math.max(z * 0.8, 0.5))}
            title="Uitzoomen (-)"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-700 active:scale-95"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            data-testid="cs-reset-view-button"
            onClick={handleReset}
            title="Reset weergave"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-700 active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Legend / Info Overlay */}
        <div className="absolute bottom-3 left-3 pointer-events-none flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-xs border border-slate-200 shadow-xs text-[11px] text-slate-600">
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-0.5 bg-[#475569]" />
            <span>Maaiveld (AHN5)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-0.5 bg-[#0284c7] border-t border-dashed" />
            <span>Drempelpeil (+0.15m)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-0.5 bg-[#d97706] border-t border-dashed" />
            <span>NEN 2580 GO (1.50m)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-0.5 bg-[#b45309] border-t border-dashed" />
            <span>VG Hoogte (2.60m)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CrossSectionViewer;
