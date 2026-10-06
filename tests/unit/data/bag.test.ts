import { describe, it, expect } from 'vitest';
import { KadasterBagClient } from '@/data/bag/kadaster-bag-client';

describe('KadasterBagClient Unit Tests', () => {
  const samplePandFeature = {
    type: 'Feature',
    id: 'NL.IMBAG.Pand.0905100000018803',
    properties: {
      identificatie: '0905100000018803',
      status: 'Pand in gebruik',
      oorspronkelijkBouwjaar: 1978,
      oppervlakte: 145,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [180000, 315000],
          [180008, 315000],
          [180008, 315010],
          [180000, 315010],
          [180000, 315000],
        ],
      ],
    },
  };

  const sampleVboFeature = {
    type: 'Feature',
    id: 'NL.IMBAG.Verblijfsobject.0905010000018803',
    properties: {
      identificatie: '0905010000018803',
      huisnummer: 153,
      huisletter: 'B',
      postcode: '6267AE',
      woonplaatsnaam: 'Cadier en Keer',
    },
    geometry: {
      type: 'Point',
      coordinates: [180004, 314999.8],
    },
  };

  it('should parse GeoJSON polygon into Polygon2D', () => {
    const poly = KadasterBagClient.parseGeoJSONGeometry(samplePandFeature.geometry);
    expect(poly.vertices.length).toBe(4);
    expect(poly.area()).toBe(80); // 8x10 = 80 m²
  });

  it('should fetch Pand by ID via OGC client', async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({ features: [samplePandFeature] }), {
        status: 200,
      });

    const client = new KadasterBagClient({ fetchFn: mockFetch as any });
    const pand = await client.getPandById('0905100000018803');

    expect(pand).not.toBeNull();
    expect(pand!.identificatie).toBe('0905100000018803');
    expect(pand!.status).toBe('Pand in gebruik');
    expect(pand!.bouwjaar).toBe(1978);
    expect(pand!.geometrieRD.area()).toBe(80);
  });

  it('should fetch Panden by bbox in RD (EPSG:28992)', async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({ features: [samplePandFeature] }), {
        status: 200,
      });

    const client = new KadasterBagClient({ fetchFn: mockFetch as any });
    const panden = await client.getPandenByBbox({
      minX: 179900,
      minY: 314900,
      maxX: 180100,
      maxY: 315100,
    });

    expect(panden.length).toBe(1);
    expect(panden[0].identificatie).toBe('0905100000018803');
  });

  it('should fetch Verblijfsobjecten by Pand ID', async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({ features: [sampleVboFeature] }), {
        status: 200,
      });

    const client = new KadasterBagClient({ fetchFn: mockFetch as any });
    const vbos = await client.getVerblijfsobjectenByPand('0905100000018803');

    expect(vbos.length).toBe(1);
    expect(vbos[0].id).toBe('0905010000018803');
    expect(vbos[0].huisnummer).toBe(153);
    expect(vbos[0].huisletter).toBe('B');
    expect(vbos[0].rdCoordinates).toEqual([180004, 314999.8]);
  });
});
