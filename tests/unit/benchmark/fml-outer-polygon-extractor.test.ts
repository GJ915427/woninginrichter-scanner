import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { FmlOuterPolygonExtractor } from '@/../scripts/fml-outer-polygon-extractor';
import { FmlProject } from '@/domain/benchmark/floorplanner-types';

describe('FmlOuterPolygonExtractor', () => {
  const fixturePath = path.join(__dirname, '../../fixtures/sample-fml-projects.json');
  const sampleData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  it('should extract a closed outer polygon and filter interior partition walls', () => {
    const project: FmlProject = sampleData.simple_room_with_partition;
    const extracted = FmlOuterPolygonExtractor.extractFloorPolygons(project);

    expect(extracted).toHaveLength(1);
    const bg = extracted[0];
    expect(bg.name).toBe('Begane grond');
    expect(bg.level).toBe(0);
    expect(bg.heightCm).toBe(280);
    expect(bg.isClosed).toBe(true);

    // 4 outer corners (partition wall should be excluded)
    expect(bg.outerPolygonM.length).toBeGreaterThanOrEqual(4);

    // Area: 600cm x 800cm = 6m x 8m = 48m2
    expect(bg.measuredGrossAreaM2).toBeCloseTo(48, 1);
  });

  it('should extract L-shaped ground floor and rectangular 1st floor from multi-story house', () => {
    const project: FmlProject = sampleData.l_shaped_house;
    const extracted = FmlOuterPolygonExtractor.extractFloorPolygons(project);

    expect(extracted).toHaveLength(2);

    const bg = extracted.find(f => f.level === 0);
    const firstFloor = extracted.find(f => f.level === 1);

    expect(bg).toBeDefined();
    expect(firstFloor).toBeDefined();

    // BG: (6m x 8m) + (3m x 4m) = 48 + 12 = 60m2
    expect(bg!.measuredGrossAreaM2).toBeCloseTo(60, 1);
    expect(bg!.outerPolygonM.length).toBeGreaterThanOrEqual(6);

    // 1e: 6m x 8m = 48m2
    expect(firstFloor!.measuredGrossAreaM2).toBeCloseTo(48, 1);
    expect(firstFloor!.outerPolygonM.length).toBeGreaterThanOrEqual(4);
  });

  it('should handle real-world coordinates from Singel 13 Bussum', () => {
    const project: FmlProject = sampleData.singel_13_bussum_snippet;
    const extracted = FmlOuterPolygonExtractor.extractFloorPolygons(project);

    expect(extracted).toHaveLength(1);
    const bg = extracted[0];

    // Width = 1223 - 848 = 375cm = 3.75m
    // Length = 1160 - 169 = 991cm = 9.91m
    // Expected Gross Area = 3.75 * 9.91 = 37.16m2
    expect(bg.measuredGrossAreaM2).toBeCloseTo(37.16, 1);
    expect(bg.isClosed).toBe(true);
  });
});
