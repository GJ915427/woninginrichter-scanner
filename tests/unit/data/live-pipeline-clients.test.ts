import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KadasterBagClient } from '@/data/bag/kadaster-bag-client';
import { KadasterDkkClient } from '@/data/kadaster/kadaster-dkk-client';
import { PdokBgtClient } from '@/data/bgt/pdok-bgt-client';

describe('Live Pipeline Data Clients (Sub-Fase 3A)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('VM-PIPE-01: KadasterBagClient VBO href resolution', () => {
    it('resolves verblijfsobjecten via direct hrefs with RD coordinates and address', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/collections/pand/items')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              features: [
                {
                  properties: {
                    identificatie: '0905100000018803',
                    status: 'Pand in gebruik',
                    bouwjaar: 1969,
                    'verblijfsobject.href': [
                      'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items/vbo-uuid-1',
                    ],
                  },
                  geometry: {
                    type: 'Polygon',
                    coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
                  },
                },
              ],
            }),
          });
        }

        if (url.includes('/collections/verblijfsobject/items/vbo-uuid-1')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: 'vbo-uuid-1',
              properties: {
                identificatie: '0905010000002118',
                huisnummer: 153,
                huisletter: 'B',
                postcode: '6247AD',
                woonplaats_naam: 'Gronsveld',
                oppervlakte: 173,
                gebruiksdoel: 'woonfunctie',
                status: 'Verblijfsobject in gebruik',
              },
              geometry: {
                type: 'Point',
                coordinates: [179413.5, 312880.2],
              },
            }),
          });
        }

        return Promise.resolve({ ok: false, status: 404 });
      });

      const client = new KadasterBagClient({ fetchFn: mockFetch as any });
      const vbos = await client.getVerblijfsobjectenForPand('0905100000018803');

      expect(vbos).toHaveLength(1);
      expect(vbos[0].id).toBe('0905010000002118');
      expect(vbos[0].huisnummer).toBe(153);
      expect(vbos[0].huisletter).toBe('B');
      expect(vbos[0].postcode).toBe('6247AD');
      expect(vbos[0].oppervlakte).toBe(173);
      expect(vbos[0].rdCoordinates).toEqual([179413.5, 312880.2]);
    });

    it('returns empty array gracefully when pand has no vbo hrefs', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ features: [] }),
      });

      const client = new KadasterBagClient({ fetchFn: mockFetch as any });
      const vbos = await client.getVerblijfsobjectenForPand('unknown-pand');
      expect(vbos).toEqual([]);
    });
  });

  describe('VM-PIPE-02: KadasterDkkClient WFS v5_0', () => {
    it('fetches kadastrale percelen and parses polygon and cadastral properties', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              id: 'perceel-1',
              properties: {
                identificatieLokaalID: '30940063970000',
                kadastraleGemeenteWaarde: 'Eijsden',
                sectie: 'F',
                perceelnummer: 639,
                kadastraleGrootteWaarde: 2163,
              },
              geometry: {
                type: 'Polygon',
                coordinates: [[[179350, 312850], [179400, 312850], [179400, 312900], [179350, 312850]]],
              },
            },
          ],
        }),
      });

      const client = new KadasterDkkClient({ fetchFn: mockFetch as any });
      const percelen = await client.getPercelenByBbox({ minX: 179300, minY: 312800, maxX: 179450, maxY: 312950 });

      expect(percelen).toHaveLength(1);
      expect(percelen[0].kadastraleGemeente).toBe('Eijsden');
      expect(percelen[0].sectie).toBe('F');
      expect(percelen[0].perceelnummer).toBe(639);
      expect(percelen[0].grootteM2).toBe(2163);
      expect(percelen[0].polygonRD).toHaveLength(4);
    });

    it('fetches kadastrale grenzen (erfgrenzen) and parses LineString geometries', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              id: 'grens-1',
              properties: {
                identificatieLokaalID: '470069479',
                typeGrensWaarde: 'Definitief',
              },
              geometry: {
                type: 'LineString',
                coordinates: [[179350, 312850], [179400, 312850]],
              },
            },
          ],
        }),
      });

      const client = new KadasterDkkClient({ fetchFn: mockFetch as any });
      const grenzen = await client.getKadastraleGrenzen({ minX: 179300, minY: 312800, maxX: 179450, maxY: 312950 });

      expect(grenzen).toHaveLength(1);
      expect(grenzen[0].id).toBe('470069479');
      expect(grenzen[0].typeGrens).toBe('Definitief');
      expect(grenzen[0].lineRD).toEqual([[179350, 312850], [179400, 312850]]);
    });

    it('pointInPolygon correctly identifies containing parcel', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              properties: {
                identificatieLokaalID: 'target-perceel',
                sectie: 'B',
                perceelnummer: 100,
                kadastraleGrootteWaarde: 500,
              },
              geometry: {
                type: 'Polygon',
                coordinates: [[[10, 10], [50, 10], [50, 50], [10, 50], [10, 10]]],
              },
            },
          ],
        }),
      });

      const client = new KadasterDkkClient({ fetchFn: mockFetch as any });
      const found = await client.getPerceelForPoint(25, 25);
      expect(found).not.toBeNull();
      expect(found?.id).toBe('target-perceel');
    });
  });

  describe('VM-PIPE-03: PdokBgtClient Scheidingen & Terreindelen', () => {
    it('fetches BGT scheiding_lijn (fences/walls) and maps coordinates', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              id: 'sch-1',
              properties: {
                type: 'hek',
                status: 'bestaand',
              },
              geometry: {
                type: 'LineString',
                coordinates: [[5.733, 50.805], [5.734, 50.805]],
              },
            },
          ],
        }),
      });

      globalThis.fetch = mockFetch as any;
      const client = new PdokBgtClient();
      const scheidingen = await client.getScheidingen([5.73, 50.80, 5.74, 50.81]);

      expect(scheidingen).toHaveLength(1);
      expect(scheidingen[0].type).toBe('hek');
      expect(scheidingen[0].line).toEqual([
        { x: 5.733, y: 50.805 },
        { x: 5.734, y: 50.805 },
      ]);
    });

    it('fetches BGT onbegroeidterreindeel (yards/gardens) and maps polygons', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              id: 'terrein-1',
              properties: {
                fysiek_voorkomen: 'erf',
                status: 'bestaand',
              },
              geometry: {
                type: 'Polygon',
                coordinates: [[[5.733, 50.805], [5.735, 50.805], [5.735, 50.806], [5.733, 50.805]]],
              },
            },
          ],
        }),
      });

      globalThis.fetch = mockFetch as any;
      const client = new PdokBgtClient();
      const terreinen = await client.getTerreindelen([5.73, 50.80, 5.74, 50.81]);

      expect(terreinen).toHaveLength(1);
      expect(terreinen[0].fysiekVoorkomen).toBe('erf');
      expect(terreinen[0].polygon).toHaveLength(4);
    });
  });
});
