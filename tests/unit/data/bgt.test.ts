import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdokBgtClient } from '@/data/bgt/pdok-bgt-client';

describe('PdokBgtClient Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch gebouwinstallaties (luifels, bordessen, trappen) around bounding box', async () => {
    const mockResponse = {
      features: [
        {
          id: 'gbi-1',
          properties: { plus_type: 'luifel', relatieve_hoogteligging: 0 },
          geometry: {
            type: 'Polygon',
            coordinates: [[[179410, 312880], [179412, 312880], [179412, 312881], [179410, 312881], [179410, 312880]]]
          }
        }
      ]
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const client = new PdokBgtClient();
    const result = await client.getGebouwInstallaties([5.73, 50.80, 5.74, 50.81]);

    expect(result.length).toBe(1);
    expect(result[0].type).toBe('luifel');
  });

  it('should fetch trees / vegetation points around bounding box', async () => {
    const mockResponse = {
      features: [
        {
          id: 'veg-1',
          properties: { 'bgt-type': 'boom' },
          geometry: {
            type: 'Point',
            coordinates: [179405, 312875]
          }
        }
      ]
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const client = new PdokBgtClient();
    const trees = await client.getVegetatieObjecten([5.73, 50.80, 5.74, 50.81]);

    expect(trees.length).toBe(1);
    expect(trees[0].coord.x).toBe(179405);
  });
});
