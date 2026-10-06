import { Polygon2D } from '../../domain/geometry/polygon';
import { BagBuildingData, AddressPoint, BoundingBoxRD } from '../types';

export const EPSG_28992_CRS = 'http://www.opengis.net/def/crs/EPSG/0/28992';

export interface VerblijfsobjectPoint extends AddressPoint {
  oppervlakte?: number;
  gebruiksdoel?: string;
  status?: string;
}

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
    const vboHrefs: string[] = feature.properties?.['verblijfsobject.href'] || [];

    const result: BagBuildingData & { vboHrefs?: string[] } = {
      identificatie: feature.properties.identificatie,
      status: feature.properties.status || 'Pand in gebruik',
      bouwjaar: feature.properties.oorspronkelijkBouwjaar || feature.properties.bouwjaar,
      oorspronkelijkBouwjaar: feature.properties.oorspronkelijkBouwjaar,
      oppervlakte:
        feature.properties.oppervlakte ||
        (geom && typeof (geom as any).area === 'function' ? Math.round((geom as any).area()) : undefined),
      geometrieRD: geom,
      vboHrefs,
    };

    return result;
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
        const vboHrefs: string[] = f.properties?.['verblijfsobject.href'] || [];
        results.push({
          identificatie: f.properties.identificatie,
          status: f.properties.status || 'Pand in gebruik',
          bouwjaar: f.properties.oorspronkelijkBouwjaar || f.properties.bouwjaar,
          oorspronkelijkBouwjaar: f.properties.oorspronkelijkBouwjaar,
          oppervlakte: f.properties.oppervlakte,
          geometrieRD: geom,
          vboHrefs,
        } as BagBuildingData);
      } catch {
        // Skip unparseable features
      }
    }

    return results;
  }

  /**
   * Fetches Verblijfsobjecten (address entrance points) associated with a Pand.
   * Ondersteunt zowel directe href-resolutie als query-fallback.
   */
  async getVerblijfsobjectenForPand(
    pandId: string,
    vboHrefs?: string[]
  ): Promise<VerblijfsobjectPoint[]> {
    let resolvedHrefs = vboHrefs;
    const cleanId = pandId.replace(/^NL\.IMBAG\.Pand\./, '');

    // 1. Indien expliciete hrefs meegegeven, resolveer deze parallel
    if (resolvedHrefs && resolvedHrefs.length > 0) {
      const fromHrefs = await this.fetchVbosFromHrefs(resolvedHrefs);
      if (fromHrefs.length > 0) return fromHrefs;
    }

    // 2. Probeer eerst Pand op te halen voor verblijfsobject.href
    try {
      const pand = await this.getPandById(cleanId);
      resolvedHrefs = (pand as any)?.vboHrefs;
      if (resolvedHrefs && resolvedHrefs.length > 0) {
        const fromHrefs = await this.fetchVbosFromHrefs(resolvedHrefs);
        if (fromHrefs.length > 0) return fromHrefs;
      }
    } catch {
      // Fallthrough naar collection query
    }

    // 3. Fallback: bevraag collection direct (voor mock-tests en endpoints die query ondersteunen)
    try {
      const url = `${this.baseUrl}/collections/verblijfsobject/items?pandidentificatie=${encodeURIComponent(cleanId)}&crs=${encodeURIComponent(EPSG_28992_CRS)}&limit=50`;
      const res = await this.fetchFn(url);
      if (!res.ok) return [];

      const data = await res.json();
      const features = data?.features || [];
      const addressPoints: VerblijfsobjectPoint[] = [];

      for (const f of features) {
        const geom = f.geometry;
        if (geom && geom.type === 'Point' && Array.isArray(geom.coordinates)) {
          addressPoints.push({
            id: f.properties?.identificatie || f.id,
            rdCoordinates: [geom.coordinates[0], geom.coordinates[1]],
            huisnummer: f.properties?.huisnummer,
            huisletter: f.properties?.huisletter,
            toevoeging: f.properties?.huisnummertoevoeging || f.properties?.toevoeging,
            postcode: f.properties?.postcode,
            woonplaats: f.properties?.woonplaatsnaam || f.properties?.woonplaats_naam,
            oppervlakte: f.properties?.oppervlakte,
            gebruiksdoel: f.properties?.gebruiksdoel,
            status: f.properties?.status,
          });
        }
      }

      return addressPoints;
    } catch {
      return [];
    }
  }

  private async fetchVbosFromHrefs(hrefs: string[]): Promise<VerblijfsobjectPoint[]> {
    const promises = hrefs.map(async (href) => {
      try {
        const url = href.includes('?')
          ? `${href}&crs=${encodeURIComponent(EPSG_28992_CRS)}`
          : `${href}?crs=${encodeURIComponent(EPSG_28992_CRS)}`;
        const res = await this.fetchFn(url);
        if (!res.ok) return null;
        const vboItem = await res.json();
        const props = vboItem.properties || {};
        const geom = vboItem.geometry;

        let rdCoordinates: [number, number] = [0, 0];
        if (geom && geom.type === 'Point' && Array.isArray(geom.coordinates)) {
          rdCoordinates = [geom.coordinates[0], geom.coordinates[1]];
        }

        const point: VerblijfsobjectPoint = {
          id: props.identificatie || vboItem.id,
          rdCoordinates,
          huisnummer: props.huisnummer,
          huisletter: props.huisletter || undefined,
          toevoeging: props.toevoeging || props.huisnummertoevoeging || undefined,
          postcode: props.postcode || undefined,
          woonplaats: props.woonplaats_naam || props.woonplaatsnaam || props.woonplaats || undefined,
          oppervlakte: props.oppervlakte,
          gebruiksdoel: props.gebruiksdoel,
          status: props.status,
        };
        return point;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.filter((item): item is VerblijfsobjectPoint => item !== null);
  }

  /**
   * Alias for backward compatibility with route callers
   */
  async getVbosForPand(pandId: string, vboHrefs?: string[]): Promise<VerblijfsobjectPoint[]> {
    return this.getVerblijfsobjectenForPand(pandId, vboHrefs);
  }

  /**
   * Fetches Verblijfsobjecten (address entrance points) associated with a Pand.
   */
  async getVerblijfsobjectenByPand(pandId: string): Promise<VerblijfsobjectPoint[]> {
    return this.getVerblijfsobjectenForPand(pandId);
  }
}
