import { Polygon2D } from '../../domain/geometry/polygon';
import { BagBuildingData, AddressPoint, BoundingBoxRD } from '../types';

export const EPSG_28992_CRS = 'http://www.opengis.net/def/crs/EPSG/0/28992';

export interface KadasterBagClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export class KadasterBagClient {
  private baseUrl: string;
  private fetchFn: typeof fetch;

  constructor(options: KadasterBagClientOptions = {}) {
    this.baseUrl =
      options.baseUrl || 'https://api.pdok.nl/kadaster/bag/ogc/v2';
    this.fetchFn = options.fetchFn || fetch.bind(globalThis);
  }

  /**
   * Helper to parse GeoJSON polygon / multipolygon into a Polygon2D.
   */
  static parseGeoJSONGeometry(geometry: any): Polygon2D {
    if (!geometry || !geometry.coordinates) {
      throw new Error('Invalid GeoJSON geometry: missing coordinates');
    }

    if (geometry.type === 'Polygon') {
      const ring = geometry.coordinates[0]; // Exterior ring
      return Polygon2D.fromArray(ring);
    }

    if (geometry.type === 'MultiPolygon') {
      // Find the polygon part with largest area
      let largestPoly: Polygon2D | null = null;
      let maxArea = -1;

      for (const polyCoords of geometry.coordinates) {
        if (polyCoords.length > 0) {
          const poly = Polygon2D.fromArray(polyCoords[0]);
          const a = poly.area();
          if (a > maxArea) {
            maxArea = a;
            largestPoly = poly;
          }
        }
      }

      if (!largestPoly) {
        throw new Error('MultiPolygon has no valid rings');
      }
      return largestPoly;
    }

    throw new Error(`Unsupported GeoJSON geometry type: ${geometry.type}`);
  }

  /**
   * Fetches a single Pand by its BAG identificatie (e.g. "0905100000018803" or "NL.IMBAG.Pand.0905100000018803").
   */
  async getPandById(identificatie: string): Promise<BagBuildingData | null> {
    const cleanId = identificatie.replace(/^NL\.IMBAG\.Pand\./, '');
    const url = `${this.baseUrl}/collections/pand/items?identificatie=${encodeURIComponent(cleanId)}&crs=${encodeURIComponent(EPSG_28992_CRS)}`;

    const res = await this.fetchFn(url);
    if (!res.ok) {
      throw new Error(`Kadaster BAG API error: status ${res.status}`);
    }

    const data = await res.json();
    const features = data?.features || [];
    if (features.length === 0) return null;

    const feature = features[0];
    const geom = KadasterBagClient.parseGeoJSONGeometry(feature.geometry);

    return {
      identificatie: feature.properties.identificatie,
      status: feature.properties.status || 'Pand in gebruik',
      bouwjaar: feature.properties.oorspronkelijkBouwjaar || feature.properties.bouwjaar,
      oorspronkelijkBouwjaar: feature.properties.oorspronkelijkBouwjaar,
      oppervlakte:
        feature.properties.oppervlakte ||
        (geom && typeof (geom as any).area === 'function' ? Math.round((geom as any).area()) : undefined),
      geometrieRD: geom,
    };
  }

  /**
   * Fetches all Panden within a bounding box in RD (EPSG:28992).
   */
  async getPandenByBbox(
    bbox: BoundingBoxRD,
    limit: number = 20
  ): Promise<BagBuildingData[]> {
    const bboxStr = `${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY}`;
    const url = `${this.baseUrl}/collections/pand/items?bbox=${bboxStr}&bbox-crs=${encodeURIComponent(EPSG_28992_CRS)}&crs=${encodeURIComponent(EPSG_28992_CRS)}&limit=${limit}`;

    const res = await this.fetchFn(url);
    if (!res.ok) {
      throw new Error(`Kadaster BAG API error: status ${res.status}`);
    }

    const data = await res.json();
    const features = data?.features || [];

    const results: BagBuildingData[] = [];
    for (const f of features) {
      try {
        const geom = KadasterBagClient.parseGeoJSONGeometry(f.geometry);
        results.push({
          identificatie: f.properties.identificatie,
          status: f.properties.status || 'Pand in gebruik',
          bouwjaar: f.properties.oorspronkelijkBouwjaar || f.properties.bouwjaar,
          oorspronkelijkBouwjaar: f.properties.oorspronkelijkBouwjaar,
          oppervlakte: f.properties.oppervlakte,
          geometrieRD: geom,
        });
      } catch {
        // Skip unparseable features
      }
    }

    return results;
  }

  /**
   * Fetches Verblijfsobjecten (address entrance points) associated with a Pand.
   */
  async getVerblijfsobjectenByPand(pandId: string): Promise<AddressPoint[]> {
    const cleanId = pandId.replace(/^NL\.IMBAG\.Pand\./, '');
    const url = `${this.baseUrl}/collections/verblijfsobject/items?pandidentificatie=${encodeURIComponent(cleanId)}&crs=${encodeURIComponent(EPSG_28992_CRS)}&limit=50`;

    const res = await this.fetchFn(url);
    if (!res.ok) {
      // In case the collection isn't available or returns 404, gracefully return empty
      return [];
    }

    const data = await res.json();
    const features = data?.features || [];

    const addressPoints: AddressPoint[] = [];
    for (const f of features) {
      const geom = f.geometry;
      if (geom && geom.type === 'Point' && Array.isArray(geom.coordinates)) {
        addressPoints.push({
          id: f.properties.identificatie || f.id,
          rdCoordinates: [geom.coordinates[0], geom.coordinates[1]],
          huisnummer: f.properties.huisnummer,
          huisletter: f.properties.huisletter,
          toevoeging: f.properties.huisnummertoevoeging,
          postcode: f.properties.postcode,
          woonplaats: f.properties.woonplaatsnaam,
        });
      }
    }

    return addressPoints;
  }
}
