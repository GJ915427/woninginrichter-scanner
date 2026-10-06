/**
 * Floorplanner FML v2 and 130-Building Benchmark Contracts.
 * Governs parsing of Floorplanner CAD vectors, outer-wall polygon extraction,
 * and correlation with official Kadaster BAG telemetry.
 */

export interface FmlPoint2D {
  x: number;
  y: number;
}

export interface FmlOpening {
  refid?: string;
  type: string; // 'door' | 'window' | 'opening'
  width?: number;
  z_height?: number;
  z?: number;
  t?: number;
}

export interface FmlWall {
  a: FmlPoint2D;
  b: FmlPoint2D;
  thickness: number; // in cm
  balance?: number;
  az?: { z: number; h: number };
  bz?: { z: number; h: number };
  openings?: FmlOpening[];
}

export interface FmlDesign {
  id: number;
  floor_id?: number;
  name: string;
  walls: FmlWall[];
}

export interface FmlFloor {
  id: number;
  project_id?: number;
  name: string;
  level: number; // 0 = Begane grond, 1 = 1e verdieping, etc.
  height: number; // plafondhoogte in cm (bijv. 280)
  designs: FmlDesign[];
}

export interface FmlProject {
  id: number;
  user_id?: number;
  public: boolean;
  name: string;
  description?: string | null;
  project_url?: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
  floor_count?: number;
  creator_email?: string;
  floors: FmlFloor[];
}

export interface ExtractedFloorPolygon {
  level: number;
  name: string;
  heightCm: number;
  outerPolygonM: Array<[number, number]>;
  measuredGrossAreaM2: number;
  wallCount: number;
  isClosed: boolean;
}

export type TypologyCategory130 =
  | 'tussenwoning'
  | 'hoekwoning'
  | 'twee_onder_een_kap'
  | 'vrijstaand'
  | 'appartement'
  | 'samengesteld'
  | 'samengesteld_schuin';

export interface BenchmarkRecord130 {
  id: string; // e.g. "BM-FP-001"
  project_id: number;
  address: {
    street: string;
    houseNumber: string;
    city: string;
    postalCode: string;
  };
  typology: TypologyCategory130;
  meta: {
    inmeter: string;
    source_url: string;
    funda_url?: string;
    verified_at: string;
    original_project_name: string;
    bag_vbo_oppervlakte?: number;
    fml_oppervlakte?: number;
    nen2580_surface_difference_pct?: number;
    fml_validation_status?: 'VALIDATED_NEN2580' | 'REJECTED_TOLERANCE_EXCEEDED';
  };
  telemetry_input: {
    pandId: string;
    vboId: string;
    bagFootprint2D: Array<[number, number]>;
    vboEntrancePoint: [number, number];
    bouwjaar: number;
    oppervlakteVboM2: number;
  };
  ground_truth_floors: ExtractedFloorPolygon[];
}
