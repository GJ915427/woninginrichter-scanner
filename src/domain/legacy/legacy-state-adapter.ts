import { Point2D } from './collinear-simplifier';
import { RDNAPTransformer } from '../geometry/rd-nap-trans';

export interface LegacyBuildingState {
  address: string;
  pandId: string;
  vboId: string;
  bouwjaar: number | null;
  oppervlakte: number;
  pandOppervlakte: number;
  gebruiksdoel: string;
  pandStatus: string;
  vboStatus: string;
  volumeM3: number | null;
  nokhoogte: number;
  goothoogte: number;
  bouwlagen: number;
  oppDakPlat: number;
  oppDakSchuin: number;
  hellingshoek: number;
  dakType: string;
  inferredRoofType: 'slanted' | 'flat' | 'composite';
  oppScheidingsmuur: number;
  oppBuitenmuur: number | null;
  bouwtypologie: string;
  pandGeometry: any;
  bag3d: any;
  aantalVerblijfsobjecten: number;
  gebouwIsObject: boolean;
  streetViewHeading?: number;
  perceeloppervlakte?: number | null;
  perceelAanduiding?: string | null;
  wozWaarde?: number | null;
  polygonCoords?: Array<[number, number]>;
  basePoints?: Point2D[];
}

export function convertCoordinatesToMeters(rawCoords: Array<[number, number]>): Point2D[] {
  if (!rawCoords || rawCoords.length === 0) return [];
  const R = 6378137;
  const lat0 = (rawCoords[0][1] * Math.PI) / 180;
  const cosLat0 = Math.cos(lat0);

  return rawCoords.map((c) => ({
    x: (((c[0] - rawCoords[0][0]) * Math.PI) / 180) * R * cosLat0,
    y: -(((c[1] - rawCoords[0][1]) * Math.PI) / 180) * R,
  }));
}

/**
 * 1-on-1 contract bridge between raw /api/building payload and legacy UI state.
 * Eliminates all undefined dashes ('—') by resolving real building attributes.
 */
export function adaptBuildingPayloadToLegacyState(
  payload: any,
  address: string
): LegacyBuildingState {
  const bag = payload?.bag || {};
  const cityJson = payload?.cityJson || {};
  const attrs = cityJson?.attributes || {};
  const vbo = Array.isArray(payload?.vbos) && payload.vbos.length > 0 ? payload.vbos[0] : null;

  const groundHeight = cityJson?.groundHeightNAP ?? attrs?.b3_h_maaiveld ?? 0;
  const roofHeight = cityJson?.roofHeightNAP ?? attrs?.b3_h_dak_max ?? null;
  const gutterHeight = cityJson?.gutterHeightNAP ?? attrs?.b3_h_dak_min ?? null;

  let nokhoogte = 8.2;
  if (roofHeight != null && groundHeight != null) {
    nokhoogte = +(roofHeight - groundHeight).toFixed(2);
  }

  let goothoogte = 5.8;
  if (gutterHeight != null && groundHeight != null) {
    goothoogte = +(gutterHeight - groundHeight).toFixed(2);
  }

  const bouwlagen = attrs?.b3_bouwlagen ?? (nokhoogte >= 8.0 ? 3 : nokhoogte >= 5.0 ? 2 : 1);

  const oppDakPlat = attrs?.b3_opp_dak_plat ? Math.round(attrs.b3_opp_dak_plat) : 0;
  const oppDakSchuin = attrs?.b3_opp_dak_schuin ? Math.round(attrs.b3_opp_dak_schuin) : 0;

  let inferredRoofType: 'slanted' | 'flat' | 'composite' = 'slanted';
  let dakTypeLabel = '';
  if (oppDakPlat > 15 && oppDakSchuin > 15) {
    inferredRoofType = 'composite';
    dakTypeLabel = `Samengesteld (${oppDakPlat}m² plat / ${oppDakSchuin}m² schuin)`;
  } else if (oppDakPlat > oppDakSchuin * 1.5) {
    inferredRoofType = 'flat';
    dakTypeLabel = `Plat dak (${oppDakPlat}m²)`;
  } else {
    inferredRoofType = 'slanted';
    dakTypeLabel = `Zadeldak (${oppDakSchuin}m²)`;
  }

  const oppScheidingsmuur = attrs?.b3_opp_scheidingsmuur != null ? +attrs.b3_opp_scheidingsmuur.toFixed(1) : 0;
  let bouwtypologie = 'Onbekend';
  if (oppScheidingsmuur > 30) {
    bouwtypologie = 'Halfvrijstaand';
  } else if (oppScheidingsmuur > 0) {
    bouwtypologie = 'Geschakeld';
  } else {
    bouwtypologie = 'Vrijstaand';
  }

  const rawGebruiksdoel = vbo?.gebruiksdoel || 'woonfunctie';
  const gebruiksdoel = rawGebruiksdoel.charAt(0).toUpperCase() + rawGebruiksdoel.slice(1);

  let polygonCoords: Array<[number, number]> = [];
  let basePoints: Point2D[] = [];

  const rawGeom = bag?.geometrieRD || bag?.geometrieWGS84;
  if (rawGeom?.vertices && Array.isArray(rawGeom.vertices) && rawGeom.vertices.length > 2) {
    const verts = rawGeom.vertices;
    polygonCoords = verts.map((v: any) => {
      const w = RDNAPTransformer.rdToWgs84(v.x, v.y);
      return [w.lng, w.lat];
    });
    const v0 = verts[0];
    basePoints = verts.map((v: any) => ({
      x: +(v.x - v0.x).toFixed(2),
      y: -(v.y - v0.y).toFixed(2),
    }));
  } else if (rawGeom?.coordinates?.[0]) {
    let ring = rawGeom.coordinates[0];
    if (rawGeom.type === 'MultiPolygon') {
      ring = rawGeom.coordinates[0][0];
    }
    if (Array.isArray(ring) && ring.length > 2) {
      polygonCoords = ring;
      basePoints = convertCoordinatesToMeters(ring);
    }
  }

  return {
    address,
    pandId: payload?.pandId || bag?.identificatie || '-',
    vboId: vbo?.identificatie || '-',
    bouwjaar: bag?.bouwjaar ?? null,
    oppervlakte: vbo?.oppervlakte ?? bag?.oppervlakte ?? 0,
    pandOppervlakte: bag?.oppervlakte ?? 0,
    gebruiksdoel,
    pandStatus: bag?.status || 'Pand in gebruik',
    vboStatus: vbo?.status || 'Verblijfsobject in gebruik',
    volumeM3: attrs?.b3_volume_lod22 ? Math.round(attrs.b3_volume_lod22) : (attrs?.b3_volume_lod13 ? Math.round(attrs.b3_volume_lod13) : null),
    nokhoogte,
    goothoogte,
    bouwlagen,
    oppDakPlat,
    oppDakSchuin,
    hellingshoek: attrs?.b3_hellingshoek != null ? Math.round(attrs.b3_hellingshoek) : 35,
    dakType: attrs?.b3_dak_type || dakTypeLabel,
    inferredRoofType,
    oppScheidingsmuur,
    oppBuitenmuur: attrs?.b3_opp_buitenmuur != null ? +attrs.b3_opp_buitenmuur.toFixed(1) : null,
    bouwtypologie,
    pandGeometry: bag?.geometrieRD || bag?.geometrieWGS84 || null,
    bag3d: {
      oppGrond: attrs?.b3_opp_grond != null ? +attrs.b3_opp_grond.toFixed(1) : null,
      oppDakPlat,
      oppDakSchuin,
      oppScheidingsmuur,
      oppBuitenmuur: attrs?.b3_opp_buitenmuur != null ? +attrs.b3_opp_buitenmuur.toFixed(1) : null,
      volume: attrs?.b3_volume_lod22 ? Math.round(attrs.b3_volume_lod22) : null,
      nokhoogte,
      goothoogte,
      bouwlagen,
      hellingshoek: attrs?.b3_hellingshoek != null ? Math.round(attrs.b3_hellingshoek) : 35,
      inferredRoofType,
      dakTypeLabel,
      bouwtypologie,
      volumes: [],
      dakvlakken: [],
    },
    aantalVerblijfsobjecten: Array.isArray(payload?.vbos) ? payload.vbos.length : 1,
    gebouwIsObject: (Array.isArray(payload?.vbos) ? payload.vbos.length : 1) === 1,
    perceeloppervlakte: payload?.kadaster?.perceeloppervlakte ?? payload?.perceeloppervlakte ?? null,
    perceelAanduiding: payload?.kadaster?.perceelAanduiding ?? payload?.perceelAanduiding ?? null,
    wozWaarde: payload?.woz?.wozWaarde ?? payload?.wozWaarde ?? null,
    polygonCoords,
    basePoints,
  };
}
