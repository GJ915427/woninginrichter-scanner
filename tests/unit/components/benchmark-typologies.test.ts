import { describe, it, expect } from 'vitest';
import {
  BENCHMARK_TYPOLOGIES,
  BENCHMARK_TYPOLOGY_MAP,
  analyzeTypology,
} from '@/fixtures/benchmark-typologies';

describe('Benchmark Typologies Dataset', () => {
  it('should contain exactly 5 diverse Dutch building typologies', () => {
    expect(BENCHMARK_TYPOLOGIES).toHaveLength(5);
    const expectedIds = [
      'rijwoning_tussen',
      'hoekwoning',
      'twee_onder_een_kap',
      'vrijstaande_villa',
      'verspringende_aanbouw',
    ];
    for (const id of expectedIds) {
      expect(BENCHMARK_TYPOLOGY_MAP[id]).toBeDefined();
    }
  });

  it('should verify rijwoning_tussen has dual party walls and street frontage', () => {
    const rijwoning = BENCHMARK_TYPOLOGY_MAP['rijwoning_tussen'];
    expect(rijwoning).toBeDefined();
    expect(rijwoning.neighboringBuildings).toHaveLength(2);
    expect(rijwoning.heightAttributes.roofType).toBe('zadeldak');

    const analysis = analyzeTypology(rijwoning);
    expect(analysis.frontFacade).toBeDefined();
    expect(analysis.frontFacade.confidence).toBeGreaterThan(0.5);

    const fullWalls = analysis.partyWalls.filter((w) => w.classification === 'FULL');
    expect(fullWalls.length).toBe(2);
    expect(analysis.mandeligStats.mandeligPercentage).toBeGreaterThan(50);
  });

  it('should verify hoekwoning has 1 party wall and 1 free side wall', () => {
    const hoekwoning = BENCHMARK_TYPOLOGY_MAP['hoekwoning'];
    expect(hoekwoning).toBeDefined();
    expect(hoekwoning.neighboringBuildings).toHaveLength(1);

    const analysis = analyzeTypology(hoekwoning);
    const sharedWalls = analysis.partyWalls.filter((w) => w.classification !== 'FREE');
    expect(sharedWalls.length).toBe(1);
    expect(sharedWalls[0].classification).toBe('FULL');
    expect(analysis.mandeligStats.freeCount).toBe(3);
  });

  it('should verify twee_onder_een_kap has 1 shared party wall', () => {
    const tweeKapper = BENCHMARK_TYPOLOGY_MAP['twee_onder_een_kap'];
    expect(tweeKapper).toBeDefined();
    expect(tweeKapper.neighboringBuildings).toHaveLength(1);

    const analysis = analyzeTypology(tweeKapper);
    const sharedWalls = analysis.partyWalls.filter((w) => w.classification !== 'FREE');
    expect(sharedWalls.length).toBe(1);
    expect(sharedWalls[0].classification).toBe('FULL');
  });

  it('should verify vrijstaande_villa has 0 party walls (0% mandelig)', () => {
    const villa = BENCHMARK_TYPOLOGY_MAP['vrijstaande_villa'];
    expect(villa).toBeDefined();

    const analysis = analyzeTypology(villa);
    const sharedWalls = analysis.partyWalls.filter((w) => w.classification !== 'FREE');
    expect(sharedWalls.length).toBe(0);
    expect(analysis.mandeligStats.mandeligPercentage).toBe(0);
    expect(analysis.mandeligStats.freeCount).toBe(4);
  });

  it('should verify verspringende_aanbouw has a PARTIAL party wall on staggered extension', () => {
    const aanbouw = BENCHMARK_TYPOLOGY_MAP['verspringende_aanbouw'];
    expect(aanbouw).toBeDefined();
    expect(aanbouw.buildingPolygon.vertexCount).toBe(6);

    const analysis = analyzeTypology(aanbouw);
    const partialWall = analysis.partyWalls.find((w) => w.classification === 'PARTIAL');
    expect(partialWall).toBeDefined();

    const intervalLength = partialWall!.sharedInterval[1] - partialWall!.sharedInterval[0];
    expect(intervalLength).toBeLessThan(0.85);
  });

  it('should calculate floor slabs for all 5 typologies', () => {
    for (const typology of BENCHMARK_TYPOLOGIES) {
      const analysis = analyzeTypology(typology);
      expect(analysis.floors.length).toBeGreaterThanOrEqual(2);
      expect(analysis.floors[0].isGroundFloor).toBe(true);
      expect(analysis.floors[0].elevationNAP).toBeCloseTo(
        typology.heightAttributes.groundLevelNAP + 0.15,
        2
      );
    }
  });
});
