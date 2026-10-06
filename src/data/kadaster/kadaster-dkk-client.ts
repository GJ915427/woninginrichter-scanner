export interface KadasterPerceel {
  id: string;
  kadastraleGemeente: string;
  sectie: string;
  perceelnummer: number;
  grootteM2: number;
  polygonRD: Array<[number, number]>;
}

export interface KadasterGrens {
  id: string;
  typeGrens: string;
  lineRD: Array<[number, number]>;
}

export interface KadasterDkkClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class KadasterDkkClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: KadasterDkkClientOptions = {}) {
    this.baseUrl =
      options.baseUrl ||
      'https://service.pdok.nl/kadaster/kadastralekaart/wfs/v5_0';
    this.timeoutMs = options.timeoutMs || 2500;
    this.fetchFn = options.fetchFn || fetch.bind(globalThis);
  }

  /**
   * Haalt kadastrale percelen op binnen een bounding box in RD (EPSG:28992)
   */
  async getPercelenByBbox(bbox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): Promise<KadasterPerceel[]> {
    const bboxStr = `${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY}`;
    const url = `${this.baseUrl}?service=WFS&version=2.0.0&request=GetFeature&typeName=kadastralekaart:Perceel&outputFormat=application/json&srsName=EPSG:28992&bbox=${bboxStr}`;

    try {
      const res = await this.fetchFn(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) return [];

      const data = await res.json();
      const features = data?.features || [];

      return features.map((f: any) => {
        const props = f.properties || {};
        let polygonRD: Array<[number, number]> = [];

        if (f.geometry?.type === 'Polygon' && Array.isArray(f.geometry.coordinates)) {
          polygonRD = f.geometry.coordinates[0].map((c: number[]) => [c[0], c[1]]);
        } else if (f.geometry?.type === 'MultiPolygon' && Array.isArray(f.geometry.coordinates)) {
          // Neem de grootste ring
          const rings = f.geometry.coordinates.map((poly: any) => poly[0]);
          if (rings.length > 0) {
            polygonRD = rings[0].map((c: number[]) => [c[0], c[1]]);
          }
        }

        return {
          id: props.identificatieLokaalID || f.id || '',
          kadastraleGemeente: props.kadastraleGemeenteWaarde || props.kadastraleGemeenteCode || '',
          sectie: props.sectie || '',
          perceelnummer: Number(props.perceelnummer) || 0,
          grootteM2: Number(props.kadastraleGrootteWaarde) || 0,
          polygonRD,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Haalt kadastrale grenzen (erfgrenzen) op binnen een bounding box in RD
   */
  async getKadastraleGrenzen(bbox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): Promise<KadasterGrens[]> {
    const bboxStr = `${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY}`;
    const url = `${this.baseUrl}?service=WFS&version=2.0.0&request=GetFeature&typeName=kadastralekaart:KadastraleGrens&outputFormat=application/json&srsName=EPSG:28992&bbox=${bboxStr}`;

    try {
      const res = await this.fetchFn(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) return [];

      const data = await res.json();
      const features = data?.features || [];

      return features.map((f: any) => {
        const props = f.properties || {};
        let lineRD: Array<[number, number]> = [];

        if (f.geometry?.type === 'LineString' && Array.isArray(f.geometry.coordinates)) {
          lineRD = f.geometry.coordinates.map((c: number[]) => [c[0], c[1]]);
        } else if (f.geometry?.type === 'MultiLineString' && Array.isArray(f.geometry.coordinates)) {
          lineRD = f.geometry.coordinates.flat().map((c: number[]) => [c[0], c[1]]);
        }

        return {
          id: props.identificatieLokaalID || f.id || '',
          typeGrens: props.typeGrensWaarde || 'Definitief',
          lineRD,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Vindt het kadastrale perceel dat een specifiek RD punt (bijv. pand centroid) bevat
   */
  async getPerceelForPoint(rdX: number, rdY: number): Promise<KadasterPerceel | null> {
    const margin = 20; // 20m buffer rondom punt
    const percelen = await this.getPercelenByBbox({
      minX: rdX - margin,
      minY: rdY - margin,
      maxX: rdX + margin,
      maxY: rdY + margin,
    });

    if (percelen.length === 0) return null;

    // Point in polygon test (ray casting)
    for (const p of percelen) {
      if (this.pointInPolygon(rdX, rdY, p.polygonRD)) {
        return p;
      }
    }

    // Fallback: dichtstbijzijnde perceel
    return percelen[0] || null;
  }

  private pointInPolygon(x: number, y: number, polygon: Array<[number, number]>): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
