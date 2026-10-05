/**
 * Benchmark Typologies, Schemas and Types for Double-Blind Ground Truth Verification.
 * Supports nationwide testing across all 12 Dutch provinces and multiple architectural typologies.
 */

export enum DutchProvince {
  Groningen = 'Groningen',
  Friesland = 'Friesland',
  Drenthe = 'Drenthe',
  Overijssel = 'Overijssel',
  Flevoland = 'Flevoland',
  Gelderland = 'Gelderland',
  Utrecht = 'Utrecht',
  NoordHolland = 'Noord-Holland',
  ZuidHolland = 'Zuid-Holland',
  Zeeland = 'Zeeland',
  NoordBrabant = 'Noord-Brabant',
  Limburg = 'Limburg',
}

export type BenchmarkTypologyCategory =
  | 'tussenwoning'
  | 'hoekwoning'
  | 'twee_onder_een_kap'
  | 'vrijstaand'
  | 'boerderij'
  | 'herenhuis'
  | 'appartement'
  | 'monument'
  | 'nieuwbouw_plat';

export type BenchmarkSourceType =
  | 'RVO_VOORBEELDWONING'
  | 'GEMEENTELIJK_BOUWDOSSIER'
  | 'TU_DELFT_3D_BAG';

export interface BenchmarkSourceInfo {
  type: BenchmarkSourceType;
  reference: string;
  date: string;
  author: string;
}

export interface TelemetryInput {
  pandId: string;
  vboId: string;
  address: {
    street: string;
    number: string;
    postalCode: string;
    city: string;
    province: DutchProvince;
  };
  footprint2D: Array<[number, number]>;
  vboEntrancePoint: [number, number];
  streetAxisSegment?: [[number, number], [number, number]];
  heightTelemetry: {
    groundNapM: number;
    eavesNapM: number;
    ridgeNapM: number;
    roofType: 'plat' | 'zadeldak' | 'schilddak' | 'mansarde' | 'samengesteld';
  };
}

export interface GroundTruthFloor {
  floorLevel: 'BG' | '1e' | '2e' | '3e' | 'zolder';
  floorLabel: string;
  elevationRelativeM: number;
  polygon: Array<[number, number]>;
  expectedBvoM2: number;
  expectedGoM2: number;
}

export interface BenchmarkBuildingRecord {
  id: string;
  name: string;
  typology: BenchmarkTypologyCategory;
  source: BenchmarkSourceInfo;
  telemetry_input: TelemetryInput;
  ground_truth_floors: GroundTruthFloor[];
}

export interface SimilarityResult {
  iou: number;
  dice: number;
  hausdorffDistanceM: number;
  areaDeltaM2: number;
  relativeAreaDeltaPct: number;
  passed: boolean;
}
