'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Compass,
  Layers,
  Eye,
  EyeOff,
  Maximize2,
} from 'lucide-react';
import { BENCHMARK_TYPOLOGIES, BenchmarkTypology, analyzeTypology } from '@/fixtures/benchmark-typologies';
import { Point2D, Segment2D } from '@/domain/geometry/types';
import { Vector2D } from '@/domain/geometry/vector';
import { Polygon2D } from '@/domain/geometry/polygon';
import { PartyWallDetector } from '@/domain/architectural/party-wall-detector';
import { FrontFacadeDetector } from '@/domain/architectural/front-facade-detector';
import { LabelLayoutEngine } from '@/domain/architectural/label-layout-engine';

export interface FloorplanViewerProps {
  typology?: BenchmarkTypology;
  buildingData?: any;
  address?: string;
  analysis?: ReturnType<typeof analyzeTypology>;
  className?: string;
  showDimensions?: boolean;
  showRoomLabels?: boolean;
  showPartyWallHatching?: boolean;
  showVoorgevelBadge?: boolean;
  showNeighbors?: boolean;
}

export function FloorplanViewer({
  typology: passedTypology,
  buildingData,
  address,
  analysis: initialAnalysis,
  className = '',
  showDimensions: initialShowDimensions = true,
  showRoomLabels: initialShowRoomLabels = true,
  showPartyWallHatching: initialShowPartyWallHatching = true,
  showVoorgevelBadge: initialShowVoorgevelBadge = true,
  showNeighbors: initialShowNeighbors = true,
}: FloorplanViewerProps) {
  // Layer visibility state
  const [showDimensions, setShowDimensions] = useState(initialShowDimensions);
  const [showRoomLabels, setShowRoomLabels] = useState(initialShowRoomLabels);
  const [showPartyWallHatching, setShowPartyWallHatching] = useState(initialShowPartyWallHatching);
  const [showVoorgevelBadge, setShowVoorgevelBadge] = useState(initialShowVoorgevelBadge);
  const [showNeighbors, setShowNeighbors] = useState(initialShowNeighbors);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState<Point2D>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<Point2D>({ x: 0, y: 0 });
  const panStartRef = useRef<Point2D>({ x: 0, y: 0 });

  const typology = passedTypology ?? BENCHMARK_TYPOLOGIES[0];

  // Compute Domain Model Analysis
  const analysis = useMemo(() => {
    return initialAnalysis ?? analyzeTypology(typology);
  }, [initialAnalysis, typology]);

  const { frontFacade, partyWalls } = analysis;

  // Bounding Box Calculation encompassing target building, neighbors, street, and margin
  const bbox = useMemo(() => {
    const points: Point2D[] = [...typology.buildingPolygon.vertices];
    for (const neighbor of typology.neighboringBuildings) {
      points.push(...neighbor.polygon.vertices);
    }
    points.push(typology.streetAxisLine.p1, typology.streetAxisLine.p2);
    points.push(typology.entrancePoint);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const margin = 2.5; // meters margin around entire site
    return {
      minX: minX - margin,
      maxX: maxX + margin,
      minY: minY - margin,
      maxY: maxY + margin,
      width: maxX - minX + 2 * margin,
      height: maxY - minY + 2 * margin,
    };
  }, [typology]);

  // Coordinate mapper from RD / local coordinates to SVG coordinate system
  // SVG X = p.x - bbox.minX
  // SVG Y = bbox.maxY - p.y (Inverting Y so North is UP on screen)
  const toSvg = (p: Point2D): Point2D => ({
    x: p.x - bbox.minX,
    y: bbox.maxY - p.y,
  });

  const toSvgPolyString = (polygon: Polygon2D): string => {
    return polygon.vertices
      .map((p) => {
        const svgP = toSvg(p);
        return `${svgP.x.toFixed(3)},${svgP.y.toFixed(3)}`;
      })
      .join(' ');
  };

  // Convert room labels with LabelLayoutEngine using pole of inaccessibility (polylabel)
  const roomLabels = useMemo(() => {
    return typology.rooms.map((room) => {
      const placement = LabelLayoutEngine.computeRoomLabelPlacement(
        room.polygon,
        room.name
      );
      const svgPos = toSvg(placement.labelPosition);
      return {
        ...room,
        svgPosition: svgPos,
        areaM2: room.areaM2 || placement.areaM2,
      };
    });
  }, [typology.rooms, bbox]);

  // Exterior wall segments with party wall & front facade classification
  const wallSegments = useMemo(() => {
    const edges = typology.buildingPolygon.edges;
    return edges.map((edge, index) => {
      const isFront = index === frontFacade.frontEdgeIndex;
      const partySegment = partyWalls.find((pw) => pw.wallEdgeIndex === index);
      const isParty = Boolean(partySegment && partySegment.classification !== 'FREE');
      const classification = partySegment?.classification ?? 'FREE';

      return {
        index,
        edge,
        svgP1: toSvg(edge.p1),
        svgP2: toSvg(edge.p2),
        isFront,
        isParty,
        classification,
        partySegment,
      };
    });
  }, [typology.buildingPolygon, frontFacade, partyWalls, bbox]);

  // Front facade badge positioning
  const frontBadge = useMemo(() => {
    const frontWall = wallSegments.find((w) => w.isFront);
    if (!frontWall) return null;

    const midRD = {
      x: (frontWall.edge.p1.x + frontWall.edge.p2.x) / 2,
      y: (frontWall.edge.p1.y + frontWall.edge.p2.y) / 2,
    };

    // Outward normal offset (0.9m into street direction)
    const norm = frontFacade.outwardNormal;
    const badgeRD = {
      x: midRD.x + norm.x * 0.9,
      y: midRD.y + norm.y * 0.9,
    };

    return {
      svgPos: toSvg(badgeRD),
      svgEdgeMid: toSvg(midRD),
      normal: norm,
    };
  }, [wallSegments, frontFacade, bbox]);

  // Dimension chains using LabelLayoutEngine
  const dimensionChains = useMemo(() => {
    const targetBBox = typology.buildingPolygon.boundingBox();
    const widthEdge: Segment2D = {
      p1: { x: targetBBox.minX, y: targetBBox.minY },
      p2: { x: targetBBox.maxX, y: targetBBox.minY },
    };
    const depthEdge: Segment2D = {
      p1: { x: targetBBox.minX, y: targetBBox.maxY },
      p2: { x: targetBBox.minX, y: targetBBox.minY },
    };

    const chainWidth = LabelLayoutEngine.createDimensionChain(
      widthEdge,
      { x: 0, y: -1 }
    );
    const chainDepth = LabelLayoutEngine.createDimensionChain(
      depthEdge,
      { x: -1, y: 0 }
    );

    return [...chainWidth, ...chainDepth].map((item) => {
      return {
        ...item,
        svgStart: toSvg(item.startPoint),
        svgEnd: toSvg(item.endPoint),
      };
    });
  }, [typology.buildingPolygon, bbox]);

  // Pan & Zoom Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // left click only
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = (e.clientX - dragStartRef.current.x) / 20; // scale sensitivity
    const dy = (e.clientY - dragStartRef.current.y) / 20;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.5), 4.0));
  };

  const handleReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Door arc SVG path helper
  const renderDoor = (door: (typeof typology.doors)[0]) => {
    const svgHinge = toSvg(door.hinge);
    const svgLatch = toSvg(door.latch);
    const radius = Math.hypot(svgLatch.x - svgHinge.x, svgLatch.y - svgHinge.y);

    // Initial closed door angle
    const angleClosed = Math.atan2(svgLatch.y - svgHinge.y, svgLatch.x - svgHinge.x);
    // 90 deg swing
    const sweep = door.direction === 'left' ? -Math.PI / 2 : Math.PI / 2;
    const angleOpen = angleClosed + sweep;
    const openX = svgHinge.x + radius * Math.cos(angleOpen);
    const openY = svgHinge.y + radius * Math.sin(angleOpen);

    const sweepFlag = door.direction === 'left' ? 0 : 1;

    return (
      <g key={door.id} className="door-group opacity-85">
        {/* Door leaf (open position) */}
        <line
          x1={svgHinge.x}
          y1={svgHinge.y}
          x2={openX}
          y2={openY}
          stroke="#475569"
          strokeWidth="0.08"
        />
        {/* Door swing arc */}
        <path
          d={`M ${svgLatch.x} ${svgLatch.y} A ${radius} ${radius} 0 0 ${sweepFlag} ${openX} ${openY}`}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="0.04"
          strokeDasharray="0.1 0.05"
        />
        {/* Door hinge dot */}
        <circle cx={svgHinge.x} cy={svgHinge.y} r="0.06" fill="#1e293b" />
      </g>
    );
  };

  return (
    <div
      className={`relative flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden select-none ${className}`}
    >
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-700">
        <div className="flex items-center gap-2 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>2D Plattegrond (Bovenaanzicht)</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500">{typology.name}</span>
        </div>

        {/* View Layer Toggles */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowRoomLabels((v) => !v)}
            title="Ruimtelabels tonen/verbergen"
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              showRoomLabels
                ? 'bg-blue-100 text-blue-800'
                : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Ruimtes
          </button>
          <button
            type="button"
            onClick={() => setShowPartyWallHatching((v) => !v)}
            title="Mandelige muur arcering"
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              showPartyWallHatching
                ? 'bg-rose-100 text-rose-800'
                : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Mandelig
          </button>
          <button
            type="button"
            onClick={() => setShowVoorgevelBadge((v) => !v)}
            title="Voorgevel badge"
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              showVoorgevelBadge
                ? 'bg-sky-100 text-sky-800'
                : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Voorgevel
          </button>
          <button
            type="button"
            onClick={() => setShowDimensions((v) => !v)}
            title="Maatvoering ketens"
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              showDimensions
                ? 'bg-slate-300 text-slate-800'
                : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Maten
          </button>
          <button
            type="button"
            onClick={() => setShowNeighbors((v) => !v)}
            title="Aangrenzende percelen / buren"
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              showNeighbors
                ? 'bg-slate-300 text-slate-800'
                : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Buren
          </button>
        </div>
      </div>

      {/* Main SVG Canvas Container */}
      <div
        className="relative flex-1 min-h-[440px] bg-slate-50/50 cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          data-testid="floorplan-svg"
          viewBox={`0 0 ${bbox.width} ${bbox.height}`}
          className="w-full h-full"
          style={{
            touchAction: 'none',
          }}
        >
          <defs>
            {/* 1m CAD Grid */}
            <pattern
              id="floorplan-grid"
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

            {/* Red Diagonal Hatch Pattern for Party Walls */}
            <pattern
              id="party-wall-hatch"
              width="0.3"
              height="0.3"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="0.3"
                stroke="#dc2626"
                strokeWidth="0.08"
              />
            </pattern>

            {/* Dimension Tick Marker */}
            <marker
              id="dim-tick"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto"
            >
              <line
                x1="2"
                y1="8"
                x2="8"
                y2="2"
                stroke="#64748b"
                strokeWidth="1.5"
              />
            </marker>

            {/* Street / Facade Arrow */}
            <marker
              id="arrow-voorgevel"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284c7" />
            </marker>
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
              fill="url(#floorplan-grid)"
            />

            {/* Street Axis Line & Street Name */}
            {(() => {
              const sP1 = toSvg(typology.streetAxisLine.p1);
              const sP2 = toSvg(typology.streetAxisLine.p2);
              const midX = (sP1.x + sP2.x) / 2;
              const midY = (sP1.y + sP2.y) / 2;
              return (
                <g className="street-axis">
                  <line
                    x1={sP1.x}
                    y1={sP1.y}
                    x2={sP2.x}
                    y2={sP2.y}
                    stroke="#0284c7"
                    strokeWidth="0.1"
                    strokeDasharray="0.6 0.3"
                  />
                  <text
                    x={midX}
                    y={midY + 0.35}
                    textAnchor="middle"
                    fontSize="0.28"
                    fontWeight="600"
                    fill="#0284c7"
                    letterSpacing="0.05em"
                  >
                    OPENBARE WEG / STRAATAS
                  </text>
                </g>
              );
            })()}

            {/* Neighboring Buildings (Cadastral Context) */}
            {showNeighbors &&
              typology.neighboringBuildings.map((neighbor) => {
                const center = toSvg(neighbor.polygon.centroid());
                return (
                  <g key={neighbor.id} className="neighbor-building opacity-70">
                    <polygon
                      points={toSvgPolyString(neighbor.polygon)}
                      fill="#f1f5f9"
                      stroke="#94a3b8"
                      strokeWidth="0.06"
                      strokeDasharray="0.2 0.1"
                    />
                    <text
                      x={center.x}
                      y={center.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="0.26"
                      fill="#64748b"
                      fontStyle="italic"
                    >
                      Buurpand
                    </text>
                  </g>
                );
              })}

            {/* Target Building Floor Slab Base */}
            <polygon
              data-testid="target-building-polygon"
              points={toSvgPolyString(typology.buildingPolygon)}
              fill="#ffffff"
              stroke="none"
            />

            {/* Interior Rooms */}
            {typology.rooms.map((room) => (
              <polygon
                key={room.id}
                data-testid={`room-${room.id}`}
                points={toSvgPolyString(room.polygon)}
                fill="#f8fafc"
                stroke="#cbd5e1"
                strokeWidth="0.06"
              />
            ))}

            {/* Doors & Swing Arcs */}
            {typology.doors.map((door) => renderDoor(door))}

            {/* Entrance Point Marker */}
            {(() => {
              const svgEnt = toSvg(typology.entrancePoint);
              return (
                <g className="entrance-marker">
                  <circle
                    cx={svgEnt.x}
                    cy={svgEnt.y}
                    r="0.14"
                    fill="#0284c7"
                    stroke="#ffffff"
                    strokeWidth="0.04"
                  />
                </g>
              );
            })()}

            {/* Exterior Walls & Party Walls */}
            {wallSegments.map((w) => {
              const isParty = w.isParty && showPartyWallHatching;

              return (
                <g key={`wall-${w.index}`}>
                  {/* Base Wall Line */}
                  <line
                    data-testid={`wall-segment-${w.index}`}
                    x1={w.svgP1.x}
                    y1={w.svgP1.y}
                    x2={w.svgP2.x}
                    y2={w.svgP2.y}
                    stroke={
                      w.isFront
                        ? '#0284c7' // Voorgevel = Blauw
                        : isParty
                        ? '#dc2626' // Mandelig = Rood
                        : '#1e293b' // Vrijstaand = Donker leisteen
                    }
                    strokeWidth={isParty ? '0.34' : '0.28'}
                    strokeLinecap="square"
                  />

                  {/* Party Wall Diagonal Hatch Strip */}
                  {isParty && w.partySegment && (
                    <line
                      x1={w.svgP1.x}
                      y1={w.svgP1.y}
                      x2={w.svgP2.x}
                      y2={w.svgP2.y}
                      stroke="url(#party-wall-hatch)"
                      strokeWidth="0.32"
                      strokeLinecap="square"
                    />
                  )}
                </g>
              );
            })}

            {/* Room Labels (Placed at Pole of Inaccessibility via Polylabel) */}
            {showRoomLabels &&
              roomLabels.map((room) => (
                <g
                  key={`label-${room.id}`}
                  className="room-label pointer-events-none"
                >
                  <text
                    x={room.svgPosition.x}
                    y={room.svgPosition.y - 0.12}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="0.30"
                    fontWeight="700"
                    fill="#1e293b"
                  >
                    {room.name}
                  </text>
                  <text
                    x={room.svgPosition.x}
                    y={room.svgPosition.y + 0.24}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="0.22"
                    fontWeight="500"
                    fill="#64748b"
                  >
                    {room.areaM2.toFixed(1)} m²
                  </text>
                </g>
              ))}

            {/* Voorgevel Badge at Street Facade */}
            {showVoorgevelBadge && frontBadge && (
              <g
                data-testid="voorgevel-badge"
                className="voorgevel-indicator pointer-events-none"
              >
                {/* Connecting arrow from badge to facade */}
                <line
                  x1={frontBadge.svgPos.x}
                  y1={frontBadge.svgPos.y}
                  x2={frontBadge.svgEdgeMid.x}
                  y2={frontBadge.svgEdgeMid.y}
                  stroke="#0284c7"
                  strokeWidth="0.06"
                  markerEnd="url(#arrow-voorgevel)"
                />
                {/* Badge Pill Background */}
                <rect
                  x={frontBadge.svgPos.x - 1.1}
                  y={frontBadge.svgPos.y - 0.22}
                  width="2.2"
                  height="0.44"
                  rx="0.22"
                  fill="#0284c7"
                  filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.25))"
                />
                {/* Badge Text */}
                <text
                  x={frontBadge.svgPos.x}
                  y={frontBadge.svgPos.y + 0.02}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="0.18"
                  fontWeight="800"
                  letterSpacing="0.08em"
                  fill="#ffffff"
                >
                  VOORGEVEL
                </text>
              </g>
            )}

            {/* Dimension Chains */}
            {showDimensions &&
              dimensionChains.map((dim, idx) => {
                const midX = (dim.svgStart.x + dim.svgEnd.x) / 2;
                const midY = (dim.svgStart.y + dim.svgEnd.y) / 2;

                return (
                  <g key={`dim-${idx}`} className="dimension-chain">
                    <line
                      x1={dim.svgStart.x}
                      y1={dim.svgStart.y}
                      x2={dim.svgEnd.x}
                      y2={dim.svgEnd.y}
                      stroke="#64748b"
                      strokeWidth="0.03"
                      markerStart="url(#dim-tick)"
                      markerEnd="url(#dim-tick)"
                    />
                    <rect
                      x={midX - 0.5}
                      y={midY - 0.16}
                      width="1.0"
                      height="0.32"
                      fill="#ffffff"
                      opacity="0.9"
                    />
                    <text
                      x={midX}
                      y={midY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="0.20"
                      fontWeight="600"
                      fill="#334155"
                    >
                      {dim.label}
                    </text>
                  </g>
                );
              })}
          </g>
        </svg>

        {/* Floating North Arrow (Noordpijl) */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/90 backdrop-blur-xs border border-slate-200 shadow-xs pointer-events-none text-slate-800 text-[11px] font-bold">
          <Compass className="w-4 h-4 text-sky-600 animate-spin-slow" />
          <span>N</span>
        </div>

        {/* Floating Zoom & Pan Controls */}
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 p-1 rounded-lg bg-white/90 backdrop-blur-xs border border-slate-200 shadow-md">
          <button
            type="button"
            data-testid="zoom-in-button"
            onClick={() => setZoom((z) => Math.min(z * 1.25, 4.0))}
            title="Inzoomen (+)"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-700 active:scale-95"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            data-testid="zoom-out-button"
            onClick={() => setZoom((z) => Math.max(z * 0.8, 0.5))}
            title="Uitzoomen (-)"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-700 active:scale-95"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            data-testid="reset-view-button"
            onClick={handleReset}
            title="Reset weergave"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-700 active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Legend / Status Overlay */}
        <div className="absolute bottom-3 left-3 pointer-events-none flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-xs border border-slate-200 shadow-xs text-[11px] text-slate-600">
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-1 bg-[#0284c7] rounded-sm" />
            <span>Voorgevel</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-1 bg-[#dc2626] rounded-sm" />
            <span>Mandelige muur</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-1 bg-[#1e293b] rounded-sm" />
            <span>Buitengevel</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FloorplanViewer;
