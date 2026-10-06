import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getBuilding } from '@/app/api/building/route';
import { GET as getTiles } from '@/app/api/bag/tiles/route';
import { PdokBgtClient } from '@/data/bgt/pdok-bgt-client';
import { AhnElevationClient } from '@/data/ahn/ahn-elevation-client';
import { KadasterBagClient } from '@/data/bag/kadaster-bag-client';
import { ThreeDBagClient } from '@/data/cityjson/three-d-bag-client';
import { Polygon2D } from '@/domain/geometry/polygon';

describe('Data Pipeline Integratie & Dual-Layer Verificatietests (VM-01 t/m VM-05)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Hiaat 1 & 2: AHN Elevation & BGT Wegdelen in /api/building (VM-01, VM-02, VM-05)', () => {
    it('VM-01: moet ahn en bgt.wegdelen opnemen in de gebouwrespons bij een succesvol pand', async () => {
      // Mock Kadaster BAG
      const mockPolygon = new Polygon2D([
        { x: 140000, y: 475000 },
        { x: 140010, y: 475000 },
        { x: 140010, y: 475010 },
        { x: 140000, y: 475010 },
        { x: 140000, y: 475000 },
      ]);

      vi.spyOn(KadasterBagClient.prototype, 'getPandById').mockResolvedValue({
        identificatie: '0375100000012345',
        status: 'Pand in gebruik',
        geometrieRD: mockPolygon,
        oorspronkelijkBouwjaar: 1906,
        bouwjaar: 1906,
        oppervlakte: 65,
      });

      vi.spyOn(KadasterBagClient.prototype, 'getVerblijfsobjectenByPand').mockResolvedValue([
        {
          id: '0375010000012345',
          rdCoordinates: [140005, 475000],
          addressString: 'Singel 13, Bussum',
          huisnummer: 13,
          postcode: '1402NR',
          woonplaats: 'Bussum',
        },
      ]);

      vi.spyOn(ThreeDBagClient.prototype, 'get3DModel').mockResolvedValue({
        pandId: '0375100000012345',
        vertices: [
          { x: 140000, y: 475000, z: 2.5 },
          { x: 140010, y: 475000, z: 2.5 },
          { x: 140010, y: 475010, z: 9.8 },
        ],
        surfaces: [],
        lod: '2.2',
        groundHeightNAP: 2.5,
        roofHeightNAP: 9.8,
        gutterHeightNAP: 6.1,
        roofType: 'zadeldak',
        attributes: { b3_mutatie_ahn4_ahn5: true },
      });

      vi.spyOn(PdokBgtClient.prototype, 'getWegdelen').mockResolvedValue([
        {
          id: 'G0375.12345',
          functie: 'rijbaan',
          status: 'bestaand',
          straatnaam: 'Singel',
          polygon: [
            { x: 5.16, y: 52.27 },
            { x: 5.17, y: 52.27 },
          ],
        },
        {
          id: 'G0375.12346',
          functie: 'voetpad',
          status: 'bestaand',
          straatnaam: 'Singel',
          polygon: [
            { x: 5.16, y: 52.27 },
            { x: 5.165, y: 52.27 },
          ],
        },
      ]);

      const req = new Request('http://localhost:8088/api/building?pandId=0375100000012345');
      const res = await getBuilding(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.pandId).toBe('0375100000012345');

      // AHN validatie
      expect(data.ahn).toBeDefined();
      expect(data.ahn.groundLevelNAP).toBe(2.5);
      expect(data.ahn.source).toBe('AHN5');

      // BGT Wegdelen validatie
      expect(data.bgt).toBeDefined();
      expect(data.bgt.wegdelen).toHaveLength(2);
      expect(data.bgt.wegdelen[0].functie).toBe('rijbaan');
      expect(data.bgt.wegdelen[0].straatnaam).toBe('Singel');
    });

    it('VM-02: moet terugvallen op AhnElevationClient wanneer 3D BAG ontbreekt', async () => {
      const mockPolygon = new Polygon2D([
        { x: 155000, y: 463000 },
        { x: 155010, y: 463000 },
        { x: 155010, y: 463010 },
        { x: 155000, y: 463010 },
        { x: 155000, y: 463000 },
      ]);

      vi.spyOn(KadasterBagClient.prototype, 'getPandById').mockResolvedValue({
        identificatie: '0307100000099999',
        status: 'Pand in gebruik',
        geometrieRD: mockPolygon,
        bouwjaar: 2024,
      });

      // 3D BAG ontbreekt (recente nieuwbouw)
      vi.spyOn(ThreeDBagClient.prototype, 'get3DModel').mockResolvedValue(null as any);

      // AHN WMS levert directe maaiveld fallback
      vi.spyOn(AhnElevationClient.prototype, 'getGroundElevationPoint').mockResolvedValue({
        groundLevelNAP: 4.85,
        source: 'AHN5',
        uncertaintyMeters: 0.05,
      });

      const req = new Request('http://localhost:8088/api/building?pandId=0307100000099999');
      const res = await getBuilding(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.cityJson).toBeNull();
      expect(data.ahn).toBeDefined();
      expect(data.ahn.groundLevelNAP).toBe(4.85);
      expect(data.ahn.source).toBe('AHN5');
    });

    it('VM-05: moet corner cases en timeouts elegant afvangen zonder HTTP crash', async () => {
      const mockPolygon = new Polygon2D([
        { x: 155000, y: 463000 },
        { x: 155010, y: 463000 },
        { x: 155000, y: 463000 },
      ]);

      vi.spyOn(KadasterBagClient.prototype, 'getPandById').mockResolvedValue({
        identificatie: '0000100000000000',
        status: 'Pand in gebruik',
        geometrieRD: mockPolygon,
      });

      vi.spyOn(ThreeDBagClient.prototype, 'get3DModel').mockRejectedValue(new Error('3D BAG timeout'));
      vi.spyOn(AhnElevationClient.prototype, 'getGroundElevationPoint').mockRejectedValue(new Error('WMS timeout'));
      vi.spyOn(PdokBgtClient.prototype, 'getWegdelen').mockRejectedValue(new Error('BGT network error'));

      const req = new Request('http://localhost:8088/api/building?pandId=0000100000000000');
      const res = await getBuilding(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.ahn.source).toBe('FALLBACK');
      expect(data.ahn.groundLevelNAP).toBe(0.0);
      expect(data.bgt.wegdelen).toEqual([]);
    });
  });

  describe('2. Hiaat 2: BGT Client getWegdelen Parsing (VM-03)', () => {
    it('VM-03: moet BGT wegdelen ophalen en correct mappen naar BgtWegdeel model', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              id: 'W01',
              properties: {
                'bgt-functie': 'rijbaan',
                'bgt-status': 'bestaand',
                openbare_ruimte_naam: 'Kerkstraat',
              },
              geometry: {
                coordinates: [
                  [
                    [5.123, 52.123],
                    [5.124, 52.123],
                    [5.124, 52.124],
                    [5.123, 52.123],
                  ],
                ],
              },
            },
          ],
        }),
      });

      const client = new PdokBgtClient();
      // Inject mock fetch via global
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch;

      try {
        const wegdelen = await client.getWegdelen([5.12, 52.12, 5.13, 52.13]);
        expect(wegdelen).toHaveLength(1);
        expect(wegdelen[0].functie).toBe('rijbaan');
        expect(wegdelen[0].status).toBe('bestaand');
        expect(wegdelen[0].straatnaam).toBe('Kerkstraat');
        expect(wegdelen[0].polygon).toHaveLength(4);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('3. Hiaat 4: BAG Tiles Preload Endpoint & Caching (VM-04)', () => {
    it('VM-04: moet de 250m tegel vullen met werkelijke panden en LRU cachen', async () => {
      const mockPolygon = new Polygon2D([
        { x: 155010, y: 463010 },
        { x: 155020, y: 463010 },
        { x: 155020, y: 463020 },
        { x: 155010, y: 463010 },
      ]);

      vi.spyOn(KadasterBagClient.prototype, 'getPandenByBbox').mockResolvedValue([
        {
          identificatie: '0307100000011111',
          status: 'Pand in gebruik',
          oorspronkelijkBouwjaar: 1985,
          geometrieRD: mockPolygon,
        },
      ]);

      // Unieke tegelcoördinaten om cache-conflict met andere tests te voorkomen
      const testTileX = 9999;
      const testTileY = 8888;

      const req1 = new Request(`http://localhost:8088/api/bag/tiles?tileX=${testTileX}&tileY=${testTileY}`);
      const res1 = await getTiles(req1);
      expect(res1.status).toBe(200);

      const data1 = await res1.json();
      expect(data1.fromCache).toBe(false);
      expect(data1.tileKey).toBe(`${testTileX}_${testTileY}`);
      expect(data1.buildings).toHaveLength(1);
      expect(data1.buildings[0].pandId).toBe('0307100000011111');
      expect(data1.buildings[0].bouwjaar).toBe(1985);
      expect(data1.buildings[0].footprint).toBeDefined();

      // Tweede aanroep moet uit de in-memory LRU cache komen
      const req2 = new Request(`http://localhost:8088/api/bag/tiles?tileX=${testTileX}&tileY=${testTileY}`);
      const res2 = await getTiles(req2);
      expect(res2.status).toBe(200);

      const data2 = await res2.json();
      expect(data2.fromCache).toBe(true);
      expect(data2.buildings).toHaveLength(1);
    });
  });
});
