import { Point2D } from '@/domain/geometry/types';

export interface BgtGebouwInstallatie {
  id: string;
  type: 'luifel' | 'balkon' | 'bordes' | 'toegangstrap' | string;
  relatieveHoogteligging: number;
  polygon: Point2D[];
}

export interface BgtVegetatieObject {
  id: string;
  type: string;
  coord: Point2D;
}

export interface BgtWegdeel {
  id: string;
  functie: string; // 'rijbaan', 'voetpad', 'fietspad', 'inrit', etc.
  status: string;
  straatnaam?: string;
  polygon: Point2D[];
}

export interface BgtScheiding {
  id: string;
  type: string; // 'hek', 'muur', 'draadafscheiding', etc.
  status: string;
  line: Point2D[];
}

export interface BgtTerreindeel {
  id: string;
  fysiekVoorkomen: string; // 'erf', 'tuin', 'verhard', etc.
  status: string;
  polygon: Point2D[];
}

export class PdokBgtClient {
  private readonly baseUrl = 'https://api.pdok.nl/lv/bgt/ogc/v1';

  /**
   * Haalt gebouwinstallaties (luifels, bordessen, trappen) op binnen een bounding box [minLng, minLat, maxLng, maxLat]
   */
  async getGebouwInstallaties(bbox: [number, number, number, number]): Promise<BgtGebouwInstallatie[]> {
    const url = `${this.baseUrl}/collections/gebouwinstallatie/items?bbox=${bbox.join(',')}&f=json&limit=50`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.features) return [];

      return data.features.map((f: any) => {
        const coords = f.geometry?.coordinates?.[0] || [];
        const polygon: Point2D[] = coords.map((c: number[]) => ({ x: c[0], y: c[1] }));
        return {
          id: f.id || f.properties?.lokaalid || '',
          type: f.properties?.plus_type || f.properties?.type || 'installatie',
          relatieveHoogteligging: f.properties?.relatieve_hoogteligging ?? 0,
          polygon,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Haalt geregistreerde bomen (stamposities) op rondom het perceel
   */
  async getVegetatieObjecten(bbox: [number, number, number, number]): Promise<BgtVegetatieObject[]> {
    const url = `${this.baseUrl}/collections/vegetatieobject_punt/items?bbox=${bbox.join(',')}&f=json&limit=50`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.features) return [];

      return data.features.map((f: any) => ({
        id: f.id || '',
        type: f.properties?.['bgt-type'] || 'boom',
        coord: {
          x: f.geometry?.coordinates?.[0] || 0,
          y: f.geometry?.coordinates?.[1] || 0,
        },
      }));
    } catch {
      return [];
    }
  }

  /**
   * Haalt openbare wegdelen (rijbanen, trottoirs/voetpaden, fietspaden) op binnen een bounding box
   */
  async getWegdelen(bbox: [number, number, number, number]): Promise<BgtWegdeel[]> {
    const url = `${this.baseUrl}/collections/wegdeel/items?bbox=${bbox.join(',')}&f=json&limit=50`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.features) return [];

      return data.features.map((f: any) => {
        const coords = f.geometry?.coordinates?.[0] || [];
        const polygon: Point2D[] = coords.map((c: number[]) => ({ x: c[0], y: c[1] }));
        return {
          id: f.id || f.properties?.lokaalid || '',
          functie:
            f.properties?.['bgt-functie'] ||
            f.properties?.plus_functie ||
            f.properties?.functie ||
            'wegdeel',
          status: f.properties?.['bgt-status'] || f.properties?.status || 'bestaand',
          straatnaam: f.properties?.openbare_ruimte_naam || undefined,
          polygon,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Haalt erfscheidingen (hekken, tuinmuren, keermuren) op binnen een bounding box
   */
  async getScheidingen(bbox: [number, number, number, number]): Promise<BgtScheiding[]> {
    const url = `${this.baseUrl}/collections/scheiding_lijn/items?bbox=${bbox.join(',')}&f=json&limit=50`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.features) return [];

      return data.features.map((f: any) => {
        const coords = f.geometry?.coordinates || [];
        const line: Point2D[] = coords.map((c: number[]) => ({ x: c[0], y: c[1] }));
        return {
          id: f.id || f.properties?.lokaalid || '',
          type: f.properties?.plus_type || f.properties?.type || 'scheiding',
          status: f.properties?.['bgt-status'] || f.properties?.status || 'bestaand',
          line,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Haalt onbegroeide terreindelen (erven, tuinen, verharding) op binnen een bounding box
   */
  async getTerreindelen(bbox: [number, number, number, number]): Promise<BgtTerreindeel[]> {
    const url = `${this.baseUrl}/collections/onbegroeidterreindeel/items?bbox=${bbox.join(',')}&f=json&limit=50`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.features) return [];

      return data.features.map((f: any) => {
        const coords = f.geometry?.coordinates?.[0] || [];
        const polygon: Point2D[] = coords.map((c: number[]) => ({ x: c[0], y: c[1] }));
        return {
          id: f.id || f.properties?.lokaalid || '',
          fysiekVoorkomen:
            f.properties?.plus_fysiek_voorkomen ||
            f.properties?.fysiek_voorkomen ||
            'onbegroeidterreindeel',
          status: f.properties?.status || 'bestaand',
          polygon,
        };
      });
    } catch {
      return [];
    }
  }
}
