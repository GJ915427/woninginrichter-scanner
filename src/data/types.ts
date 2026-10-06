import { Polygon2D } from '../domain/geometry/polygon';
import { Point3D } from '../domain/geometry/types';

export interface RDCoordinates {
  x: number;
  y: number;
}

export interface BoundingBoxRD {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface AddressPoint {
  id: string;
  rdCoordinates: [number, number];
  addressString?: string;
  huisnummer?: number;
  huisletter?: string;
  toevoeging?: string;
  postcode?: string;
  woonplaats?: string;
}

export interface PDOKLocationResult {
  bagId: string;
  address: string;
  rdCoordinates: [number, number];
  boundingBox: [number, number, number, number]; // [minX, minY, maxX, maxY]
  score?: number;
  type?: string;
  id?: string;
  weergavenaam?: string;
  straatnaam?: string;
  huisnummer?: number;
  huisletter?: string;
  huisnummertoevoeging?: string;
  postcode?: string;
  woonplaatsnaam?: string;
  centroideRd?: { x: number; y: number };
  centroideWgs84?: { lat: number; lng: number };
  adresseerbaarObjectId?: string;
  pandIds?: string[];
}

export interface BagBuildingData {
  identificatie: string;
  status: string;
  geometrieRD: Polygon2D;
  bouwjaar?: number;
  verblijfsobjecten?: AddressPoint[];
  oorspronkelijkBouwjaar?: number;
  oppervlakte?: number;
}

export interface SemanticSurface {
  type: 'WallSurface' | 'RoofSurface' | 'GroundSurface' | 'OuterCeilingSurface' | 'FloorSurface' | string;
  surfaceIndex?: number;
  faceIndices: number[][]; // Array of face vertex index arrays
  polygon3D?: Point3D[];
  lod?: '1.2' | '1.3' | '2.2';
}

export interface CityJSON3DModel {
  pandId: string;
  vertices: Point3D[];
  surfaces: SemanticSurface[];
  lod: '1.2' | '1.3' | '2.2';
  groundHeightNAP: number;
  roofHeightNAP: number;
  gutterHeightNAP?: number;
  roofType?: string;
  attributes?: Record<string, any>;
}

export interface AHNElevationResult {
  groundLevelNAP: number;
  source: 'AHN5' | 'AHN4' | 'AHN3' | '3D_BAG' | 'FALLBACK';
  uncertaintyMeters?: number;
}
