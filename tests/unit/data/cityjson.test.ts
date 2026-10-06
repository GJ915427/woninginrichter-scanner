import { describe, it, expect } from 'vitest';
import { ThreeDBagClient } from '@/data/cityjson/three-d-bag-client';
import { AhnElevationClient } from '@/data/ahn/ahn-elevation-client';

describe('ThreeDBagClient & CityJSON 2.0 Unit Tests', () => {
  // Realistic CityJSON 2.0 sample representing an authentic Dutch building
  const sampleCityJSON = {
    type: 'CityJSON',
    version: '2.0',
    metadata: {
      transform: {
        scale: [0.001, 0.001, 0.001],
        translate: [180000.0, 315000.0, 50.0],
      },
    },
    feature: {
      type: 'CityJSONFeature',
      id: 'NL.IMBAG.Pand.0905100000018803',
      CityObjects: {
        'NL.IMBAG.Pand.0905100000018803': {
          type: 'Building',
          attributes: {
            b3_h_maaiveld: 50.5,
            b3_h_dak_50p: 56.5,
            b3_h_dak_max: 59.8,
            b3_dak_type: 'zadeldak',
            b3_mutatie_ahn4_ahn5: true,
            b3_rmse: 0.04,
          },
          children: ['NL.IMBAG.Pand.0905100000018803-0'],
        },
        'NL.IMBAG.Pand.0905100000018803-0': {
          type: 'BuildingPart',
          parents: ['NL.IMBAG.Pand.0905100000018803'],
          geometry: [
            {
              type: 'MultiSurface',
              lod: '2.2',
              boundaries: [
                // Ground surface (z=0 -> 50.0m NAP)
                [[0, 1, 2, 3]],
                // Wall 1
                [[0, 1, 5, 4]],
                // Wall 2
                [[1, 2, 6, 5]],
                // Roof 1 (sloping)
                [[4, 5, 8, 7]],
                // Roof 2 (sloping)
                [[5, 6, 9, 8]],
              ],
              semantics: {
                surfaces: [
                  { type: 'GroundSurface' },
                  { type: 'WallSurface' },
                  { type: 'RoofSurface' },
                ],
                values: [0, 1, 1, 2, 2], // 0: ground, 1: wall, 1: wall, 2: roof, 2: roof
              },
            },
          ],
        },
      },
      vertices: [
        // Quantized integer coordinates
        [0, 0, 500],        // 0: (180000, 315000, 50.5)
        [6000, 0, 500],     // 1: (180006, 315000, 50.5)
        [6000, 10000, 500], // 2: (180006, 315010, 50.5)
        [0, 10000, 500],    // 3: (180000, 315010, 50.5)
        [0, 0, 6500],       // 4: (180000, 315000, 56.5)
        [6000, 0, 6500],    // 5: (180006, 315000, 56.5)
        [6000, 10000, 6500],// 6: (180006, 315010, 56.5)
        [0, 5000, 9800],    // 7: (180000, 315005, 59.8) - Ridge
        [3000, 5000, 9800], // 8: Ridge mid
        [6000, 5000, 9800], // 9: Ridge end
      ],
    },
  };

  it('should unpack quantized vertices using metadata.transform', () => {
    const rawVertices = [
      [0, 0, 500],
      [6000, 10000, 6500],
    ];
    const transform = {
      scale: [0.001, 0.001, 0.001] as [number, number, number],
      translate: [180000, 315000, 50] as [number, number, number],
    };

    const transformed = ThreeDBagClient.transformVertices(rawVertices, transform);

    expect(transformed[0].x).toBe(180000);
    expect(transformed[0].y).toBe(315000);
    expect(transformed[0].z).toBe(50.5);

    expect(transformed[1].x).toBe(180006);
    expect(transformed[1].y).toBe(315010);
    expect(transformed[1].z).toBe(56.5);
  });

  it('should parse CityJSON 2.0 model and extract semantic surfaces', () => {
    const model = ThreeDBagClient.parseCityJSON(sampleCityJSON, '2.2');

    expect(model.pandId).toBe('NL.IMBAG.Pand.0905100000018803');
    expect(model.lod).toBe('2.2');
    expect(model.groundHeightNAP).toBe(50.5);
    expect(model.gutterHeightNAP).toBe(56.5);
    expect(model.roofHeightNAP).toBe(59.8);
    expect(model.roofType).toBe('zadeldak');

    // Check surfaces
    expect(model.surfaces.length).toBe(5);

    const ground = model.surfaces.find((s) => s.type === 'GroundSurface');
    expect(ground).toBeDefined();
    expect(ground!.polygon3D).toBeDefined();
    expect(ground!.polygon3D!.length).toBe(4);

    const walls = model.surfaces.filter((s) => s.type === 'WallSurface');
    expect(walls.length).toBe(2);

    const roofs = model.surfaces.filter((s) => s.type === 'RoofSurface');
    expect(roofs.length).toBe(2);
  });

  it('should extract AHN ground datum and building heights via AhnElevationClient', () => {
    const model = ThreeDBagClient.parseCityJSON(sampleCityJSON, '2.2');

    const datum = AhnElevationClient.getGroundDatumFrom3DBAG(model);
    expect(datum.groundLevelNAP).toBe(50.5);
    expect(datum.source).toBe('AHN5');
    expect(datum.uncertaintyMeters).toBe(0.04);

    const heights = AhnElevationClient.getBuildingHeights(model);
    expect(heights.groundLevelNAP).toBe(50.5);
    expect(heights.eavesHeightNAP).toBe(56.5);
    expect(heights.ridgeHeightNAP).toBe(59.8);
    expect(heights.roofType).toBe('zadeldak');
  });

  it('should fetch model from API via custom fetch function', async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify(sampleCityJSON), { status: 200 });

    const client = new ThreeDBagClient({ fetchFn: mockFetch as any });
    const model = await client.get3DModel('0905100000018803');

    expect(model.pandId).toBe('NL.IMBAG.Pand.0905100000018803');
    expect(model.roofType).toBe('zadeldak');
  });
});
