import { PDOKLocationResult } from '../types';
import { RDNAPTransformer } from '../../domain/geometry/rd-nap-trans';

export interface PDOKSuggestItem {
  id: string;
  type: string;
  weergavenaam: string;
  score: number;
}

export type AddressSuggestion = PDOKSuggestItem;

export interface PDOKLookupDoc {
  id: string;
  type: string;
  weergavenaam: string;
  centroide_rd?: string; // e.g. "POINT(121657.123 487392.456)"
  centroide_ll?: string;
  boundingbox_rd?: string; // e.g. "BOX(121600.0 487300.0 121700.0 487500.0)"
  adresseerbaarobject_id?: string;
  pandidentificatie?: string | string[];
  huisnummer?: number;
  huisletter?: string;
  huisnummertoevoeging?: string;
  postcode?: string;
  woonplaatsnaam?: string;
  straatnaam?: string;
  score?: number;
}

export interface PDOKClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export class PdokLocatieserverClient {
  private baseUrl: string;
  private fetchFn: typeof fetch;

  constructor(options: PDOKClientOptions = {}) {
    this.baseUrl =
      options.baseUrl || 'https://api.pdok.nl/bzk/locatieserver/search/v3_1';
    this.fetchFn = options.fetchFn || fetch.bind(globalThis);
  }

  /**
   * Parses WKT string "POINT(121657.123 487392.456)" into [x, y].
   */
  static parsePointWKT(wkt?: string): [number, number] {
    if (!wkt) return [0, 0];
    const match = wkt.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (!match) return [0, 0];
    return [parseFloat(match[1]), parseFloat(match[2])];
  }

  /**
   * Parses WKT string "BOX(minX minY maxX maxY)" into [minX, minY, maxX, maxY].
   */
  static parseBoxWKT(wkt?: string): [number, number, number, number] {
    if (!wkt) return [0, 0, 0, 0];
    const match = wkt.match(
      /BOX\s*\(\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\)/i
    );
    if (!match) return [0, 0, 0, 0];
    return [
      parseFloat(match[1]),
      parseFloat(match[2]),
      parseFloat(match[3]),
      parseFloat(match[4]),
    ];
  }

  /**
   * Converts a PDOK lookup doc to our standardized PDOKLocationResult.
   */
  static mapDocToLocationResult(doc: PDOKLookupDoc): PDOKLocationResult {
    const rdCoords = PdokLocatieserverClient.parsePointWKT(doc.centroide_rd);
    const bbox = PdokLocatieserverClient.parseBoxWKT(doc.boundingbox_rd);

    // Extract primary BAG identificatie (prefer pandidentificatie, fallback to id)
    let bagId = doc.id;
    if (doc.pandidentificatie) {
      bagId = Array.isArray(doc.pandidentificatie)
        ? doc.pandidentificatie[0]
        : doc.pandidentificatie;
    } else if (doc.adresseerbaarobject_id) {
      bagId = doc.adresseerbaarobject_id;
    }

    const wgs84 = RDNAPTransformer.rdToWgs84(rdCoords[0], rdCoords[1]);
    const pandIds = doc.pandidentificatie
      ? (Array.isArray(doc.pandidentificatie) ? doc.pandidentificatie : [doc.pandidentificatie])
      : [];

    return {
      bagId,
      address: doc.weergavenaam || '',
      rdCoordinates: rdCoords,
      boundingBox: bbox,
      score: doc.score,
      type: doc.type,
      id: doc.id,
      weergavenaam: doc.weergavenaam || '',
      straatnaam: doc.straatnaam || '',
      huisnummer: doc.huisnummer || 0,
      huisletter: doc.huisletter,
      huisnummertoevoeging: doc.huisnummertoevoeging,
      postcode: doc.postcode || '',
      woonplaatsnaam: doc.woonplaatsnaam || '',
      centroideRd: { x: rdCoords[0], y: rdCoords[1] },
      centroideWgs84: { lat: wgs84.lat, lng: wgs84.lng },
      adresseerbaarObjectId: doc.adresseerbaarobject_id,
      pandIds,
    };
  }

  /**
   * Suggests addresses matching a query prefix.
   */
  async suggest(query: string, rows: number = 5): Promise<PDOKSuggestItem[]> {
    if (!query || query.trim().length === 0) return [];

    const url = `${this.baseUrl}/suggest?q=${encodeURIComponent(query)}&rows=${rows}`;
    const res = await this.fetchFn(url);
    if (!res.ok) {
      throw new Error(`PDOK suggest failed with HTTP status ${res.status}`);
    }

    const data = await res.json();
    const docs = data?.response?.docs || [];
    return docs.map((d: any) => ({
      id: d.id,
      type: d.type,
      weergavenaam: d.weergavenaam,
      score: d.score,
    }));
  }

  /**
   * Looks up full metadata for an address document ID.
   */
  async lookup(id: string): Promise<PDOKLocationResult | null> {
    if (!id) return null;

    const url = `${this.baseUrl}/lookup?id=${encodeURIComponent(id)}&fl=*`;
    const res = await this.fetchFn(url);
    if (!res.ok) {
      throw new Error(`PDOK lookup failed with HTTP status ${res.status}`);
    }

    const data = await res.json();
    const docs: PDOKLookupDoc[] = data?.response?.docs || [];
    if (docs.length === 0) return null;

    return PdokLocatieserverClient.mapDocToLocationResult(docs[0]);
  }

  /**
   * Free-text search returning full location results in RD coordinates.
   */
  async search(query: string, rows: number = 5): Promise<PDOKLocationResult[]> {
    if (!query || query.trim().length === 0) return [];

    const url = `${this.baseUrl}/free?q=${encodeURIComponent(query)}&fl=*&rows=${rows}`;
    const res = await this.fetchFn(url);
    if (!res.ok) {
      throw new Error(`PDOK search failed with HTTP status ${res.status}`);
    }

    const data = await res.json();
    const docs: PDOKLookupDoc[] = data?.response?.docs || [];
    return docs.map(PdokLocatieserverClient.mapDocToLocationResult);
  }

  /**
   * Reverse geocoding from WGS84 lat/lon to PDOK location in RD.
   */
  async reverse(
    lat: number,
    lon: number,
    distanceMeters: number = 50
  ): Promise<PDOKLocationResult | null> {
    const url = `${this.baseUrl}/reverse?lat=${lat}&lon=${lon}&distance=${distanceMeters}&fl=*&rows=1`;
    const res = await this.fetchFn(url);
    if (!res.ok) {
      throw new Error(`PDOK reverse failed with HTTP status ${res.status}`);
    }

    const data = await res.json();
    const docs: PDOKLookupDoc[] = data?.response?.docs || [];
    if (docs.length === 0) return null;

    return PdokLocatieserverClient.mapDocToLocationResult(docs[0]);
  }
}
