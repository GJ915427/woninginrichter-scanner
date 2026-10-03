import { Point2D, Point3D, Segment2D, BoundingBox2D } from '../geometry/types';
import { Polygon2D } from '../geometry/polygon';

export interface EdgeScoreDetail {
  edgeIndex: number;
  segment: Segment2D;
  length: number;
  outwardNormal: Point2D;
  entranceScore: number;
  streetAlignScore: number;
  streetDistScore: number;
  frontageParallelScore: number;
  compositeScore: number;
}

export interface FrontFacadeResult {
  frontEdgeIndex: number;
  frontEdge: Segment2D;
  outwardNormal: Point2D;
  orientationAngleRad: number; // Angle relative to North (0 = North, PI/2 = East, etc.)
  orientationLabel?: string;   // Human-readable direction (e.g. 'Oost', 'Zuidwest')
  allEdgeScores: EdgeScoreDetail[];
  confidence: number;
}

export type PartyWallClassification = 'FREE' | 'PARTIAL' | 'FULL';

export interface PartyWallSegment {
  wallEdgeIndex: number;
  originalSegment: Segment2D;
  classification: PartyWallClassification;
  sharedInterval: [number, number]; // [tStart, tEnd] in [0, 1]
  sharedLengthMeters: number;
  sharedSegment?: Segment2D;
  neighborPandId?: string;
}

export interface BuildingHeightAttributes {
  groundLevelNAP: number;      // AHN ground datum (b3_h_maaiveld)
  eavesHeightNAP?: number;     // Gutter/eaves level (b3_h_dak_50p or min roof height)
  ridgeHeightNAP?: number;     // Ridge level (b3_h_dak_max)
  roofType?: string;           // 'mansarde' | 'zadeldak' | 'plat' | 'schilddak' | string
}

export interface FloorLevel {
  id: string;
  name: string;                // e.g. "Begane Grond", "1e Verdieping", "Zolder"
  elevationNAP: number;        // Finished floor level (OK Vloer)
  heightMeters: number;        // Story ceiling / clear height
  isAttic: boolean;
  isGroundFloor: boolean;
  usableAreaM2?: number;       // NEN 2580 GO Wonen
}

export interface HeadroomIntersection {
  zLevel: number;
  type: 'nen2580_150' | 'nen2580_260';
  xHits: number[];
  usableWidthMeters: number;
  segments: Segment2D[];
}

export interface NEN2580SliceResult {
  floorId: string;
  floorLevelNAP: number;
  usable150Line: HeadroomIntersection;
  verblijf260Line: HeadroomIntersection;
  usableWidthMeters: number;
  atticUsableRatio?: number;
}

export interface LabelStackItem {
  id: string;
  nominalY: number;
  joggedY: number;
  isJogged: boolean;
  text: string;
  x?: number;
  side?: 'left' | 'right';
}

export interface RoomLabelResult {
  roomName: string;
  labelPosition: Point2D;      // 2D Pole of Inaccessibility inside polygon
  areaM2: number;
  distanceToBoundary: number;
}

export interface DimensionChainItem {
  tier: 1 | 2 | 3;             // 1: Openings/piers, 2: Volumes, 3: Total dimension
  offsetMeters: number;
  startPoint: Point2D;
  endPoint: Point2D;
  dimensionMeters: number;
  label: string;
}

export interface FloorplanViewModel {
  walls: Array<{
    start: Point2D;
    end: Point2D;
    thickness: number;
    isPartyWall: boolean;
    isFrontFacade: boolean;
    partyWallSegment?: PartyWallSegment;
  }>;
  rooms: Array<{
    name: string;
    areaM2: number;
    labelPosition: Point2D;
    polygon: Point2D[];
  }>;
  badges: Array<{
    type: 'front_facade' | 'party_wall';
    position: Point2D;
    label: string;
  }>;
  viewBox: {
    minX: number;
    minY: number;
    width: number;
    height: number;
  };
}

export interface CrossSectionViewModel {
  groundLevelNAP: number;
  floors: Array<{
    name: string;
    elevationNAP: number;
    heightMeters: number;
    outline: Point2D[];
  }>;
  roofProfile: Point2D[];
  clearanceLines: Array<{
    heightMeters: number;
    type: 'nen2580_150' | 'nen2580_260';
    segments: Array<{ start: Point2D; end: Point2D }>;
  }>;
  labels: Array<{
    text: string;
    anchorY: number;
    joggedY: number;
    x: number;
  }>;
}
