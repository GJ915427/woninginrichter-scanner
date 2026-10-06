/**
 * Standalone Adversarial Empirical Stress Test Harness
 * Can be executed directly via: npx tsx tests/adversarial_engine_stress.ts
 * or via Vitest: npx vitest run tests/adversarial_engine_stress.ts
 */

import { Polygon2D } from '../src/domain/geometry/polygon';
import { PolygonClipping } from '../src/domain/geometry/clipping';
import { Vector2D, Vector3D } from '../src/domain/geometry/vector';
import { Point2D, Point3D, Segment2D } from '../src/domain/geometry/types';
import { FrontFacadeDetector } from '../src/domain/architectural/front-facade-detector';
import { PartyWallDetector } from '../src/domain/architectural/party-wall-detector';
import { NEN2580Calculator, RoofSegment2D } from '../src/domain/architectural/nen2580-calculator';
import { LabelLayoutEngine } from '../src/domain/architectural/label-layout-engine';

interface StressResult {
  suite: string;
  test: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: StressResult[] = [];

function assert(condition: boolean, suite: string, test: string, details: string) {
  if (condition) {
    results.push({ suite, test, status: 'PASS', details });
    console.log(`[PASS] [${suite}] ${test}`);
  } else {
    results.push({ suite, test, status: 'FAIL', details });
    console.error(`[FAIL] [${suite}] ${test} - ${details}`);
  }
}

export function runAdversarialStressSuite() {
  console.log('================================================================');
  console.log('STARTING EMPIRICAL ADVERSARIAL STRESS TEST SUITE');
  console.log('================================================================\n');

  // --- Suite 1: Geometric Core Stress ---
  const suite1 = '1. Geometric Stress: Non-Convex & Degenerate Polygons';

  // 1.1 Non-convex C-polygon
  const cPoly = new Polygon2D([
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 1.5 },
    { x: 3, y: 1.5 },
    { x: 3, y: 4.5 },
    { x: 6, y: 4.5 },
    { x: 6, y: 6 },
    { x: 0, y: 6 },
  ]);
  assert(Math.abs(cPoly.area() - 27) < 1e-4, suite1, '1.1 Non-convex C-poly area is 27 m²', `area=${cPoly.area()}`);
  assert(cPoly.windingOrder() === 'CCW', suite1, '1.2 Winding order is CCW', `winding=${cPoly.windingOrder()}`);
  assert(cPoly.containsPoint({ x: 4.5, y: 3.0 }) === false, suite1, '1.3 Cavity interior returns false', 'Cutout evaluated');
  assert(cPoly.containsPoint({ x: 1.5, y: 3.0 }) === true, suite1, '1.4 Solid interior returns true', 'Solid spine evaluated');
  assert(cPoly.containsPoint({ x: 3.0, y: 3.0 }, true) === true, suite1, '1.5 Boundary point returns true', 'Boundary evaluated');

  // 1.2 Figure-8 pinched
  const figure8 = new Polygon2D([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 5, y: 5 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
    { x: 5, y: 5 },
  ]);
  const f8Centroid = figure8.centroid();
  assert(Number.isFinite(f8Centroid.x) && Number.isFinite(f8Centroid.y), suite1, '1.6 Figure-8 centroid is finite', `(${f8Centroid.x}, ${f8Centroid.y})`);

  // 1.3 Degenerate collinear
  const colH = new Polygon2D([
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 7, y: 0 },
    { x: 10, y: 0 },
  ]);
  assert(colH.area() === 0, suite1, '1.7 Degenerate collinear area is 0', `area=${colH.area()}`);
  assert(Number.isFinite(colH.centroid().x), suite1, '1.8 Collinear centroid avoids division by zero', `x=${colH.centroid().x}`);

  // --- Suite 2: Boolean Polygon Clipping ---
  const suite2 = '2. Boolean Clipping Under Extreme Configurations';
  const boxA = new Polygon2D([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]);

  // 2.1 Disjoint
  const boxDisjoint = new Polygon2D([
    { x: 100, y: 100 },
    { x: 110, y: 100 },
    { x: 110, y: 110 },
    { x: 100, y: 110 },
  ]);
  const isectDisjoint = PolygonClipping.intersection(boxA, boxDisjoint);
  assert(isectDisjoint.length === 0, suite2, '2.1 Disjoint intersection is empty', `length=${isectDisjoint.length}`);
  const unDisjoint = PolygonClipping.union(boxA, boxDisjoint);
  assert(unDisjoint.length === 2, suite2, '2.2 Disjoint union yields 2 polygons', `length=${unDisjoint.length}`);

  // 2.2 Identical
  const boxIdentical = new Polygon2D([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]);
  const isectIdentical = PolygonClipping.intersection(boxA, boxIdentical);
  assert(isectIdentical.length === 1 && Math.abs(isectIdentical[0].area() - 100) < 1e-4, suite2, '2.3 Identical intersection preserves area', `area=${isectIdentical[0]?.area()}`);

  // 2.3 Single vertex touch
  const boxCorner = new Polygon2D([
    { x: 10, y: 10 },
    { x: 20, y: 10 },
    { x: 20, y: 20 },
    { x: 10, y: 20 },
  ]);
  const isectCorner = PolygonClipping.intersection(boxA, boxCorner);
  assert(isectCorner.length === 0, suite2, '2.4 Corner-touching intersection is empty', `length=${isectCorner.length}`);

  // 2.4 Shared edge union
  const boxAdjacent = new Polygon2D([
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 10 },
    { x: 10, y: 10 },
  ]);
  const unAdjacent = PolygonClipping.union(boxA, boxAdjacent);
  assert(unAdjacent.length === 1 && Math.abs(unAdjacent[0].area() - 200) < 1e-4, suite2, '2.5 Flush edge union produces single 200m² polygon', `area=${unAdjacent[0]?.area()}`);

  // 2.5 Micro-overlap
  const boxSliver = new Polygon2D([
    { x: 9.9999, y: 0 },
    { x: 19.9999, y: 0 },
    { x: 19.9999, y: 10 },
    { x: 9.9999, y: 10 },
  ]);
  const isectSliver = PolygonClipping.intersection(boxA, boxSliver);
  assert(isectSliver.length === 1 && Math.abs(isectSliver[0].area() - 0.001) < 1e-3, suite2, '2.6 Sub-millimeter micro-overlap handled gracefully', `area=${isectSliver[0]?.area()}`);

  // --- Suite 3: Front Facade Detector ---
  const suite3 = '3. Architectural Stress: Front Facade Detector';
  const bldg8x10 = new Polygon2D([
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 10 },
    { x: 0, y: 10 },
  ]);

  // 3.1 Skewed diagonal street
  const skewedStreet: Segment2D = { p1: { x: -5, y: -6 }, p2: { x: 15, y: -2 } };
  const resSkewed = FrontFacadeDetector.detect(bldg8x10, { streetCenterline: skewedStreet });
  assert(resSkewed.frontEdgeIndex === 0 && resSkewed.outwardNormal.y < 0, suite3, '3.1 Skewed street correctly matches South facade', `idx=${resSkewed.frontEdgeIndex}`);

  // 3.2 U-shape courtyard entrance facade resolved
  const uBuilding = new Polygon2D([
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 6 },
    { x: 7, y: 6 },
    { x: 7, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]);
  const resU = FrontFacadeDetector.detect(uBuilding, {
    entrancePoint: { x: 5, y: 5.8 },
    streetCenterline: { p1: { x: -5, y: -5 }, p2: { x: 15, y: -5 } },
  });
  assert(resU.frontEdgeIndex === 2 && resU.frontEdge.p1.y === 6, suite3, '3.2 U-shape courtyard entrance facade resolved', `idx=${resU.frontEdgeIndex}`);

  // 3.3 Multi-entrance building with frontage disambiguation
  const resNorthDoorWithFrontage = FrontFacadeDetector.detect(bldg8x10, {
    entrancePoint: { x: 4, y: 10.1 }, // rear door
    streetCenterline: { p1: { x: -5, y: -4 }, p2: { x: 15, y: -4 } },
    parcelFrontage: { p1: { x: 8, y: 0 }, p2: { x: 0, y: 0 } }, // outward normal south
    weights: { entrance: 0.20, street: 0.40, frontage: 0.40 },
  });
  assert(resNorthDoorWithFrontage.frontEdgeIndex === 0, suite3, '3.3 Multi-entrance: South frontage & street overcome rear door', `idx=${resNorthDoorWithFrontage.frontEdgeIndex}`);

  // 3.4 Degenerate inputs
  const resEmpty = FrontFacadeDetector.detect(bldg8x10, {});
  assert(resEmpty.frontEdgeIndex >= 0 && Number.isFinite(resEmpty.confidence), suite3, '3.4 Empty options safely handled', `confidence=${resEmpty.confidence}`);

  // --- Suite 4: Party Wall Detector ---
  const suite4 = '4. Architectural Stress: Party Wall Detector';
  const bldgParty = new Polygon2D([
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 10 },
    { x: 0, y: 10 },
  ]);

  // 4.1 Overlap fraction 0.05 vs 0.50 vs 0.95
  const n05 = new Polygon2D([{ x: 6, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 0.5 }, { x: 6, y: 0.5 }]);
  const walls05 = PartyWallDetector.detect(bldgParty, [{ id: 'n05', polygon: n05 }]);
  assert(walls05[1]?.classification === 'PARTIAL', suite4, '4.1 5% overlap classified as PARTIAL', `class=${walls05[1]?.classification}`);

  const n50 = new Polygon2D([{ x: 6, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 5.0 }, { x: 6, y: 5.0 }]);
  const walls50 = PartyWallDetector.detect(bldgParty, [{ id: 'n50', polygon: n50 }]);
  assert(walls50[1]?.classification === 'PARTIAL', suite4, '4.2 50% overlap classified as PARTIAL', `class=${walls50[1]?.classification}`);

  const n95 = new Polygon2D([{ x: 6, y: 0.25 }, { x: 12, y: 0.25 }, { x: 12, y: 9.75 }, { x: 6, y: 9.75 }]);
  const walls95 = PartyWallDetector.detect(bldgParty, [{ id: 'n95', polygon: n95 }]);
  assert(walls95[1]?.classification === 'FULL', suite4, '4.3 95% overlap classified as FULL', `class=${walls95[1]?.classification}`);

  // 4.2 Tolerance 0.14m vs 0.16m
  const n14 = new Polygon2D([{ x: 6.14, y: 0 }, { x: 12.14, y: 0 }, { x: 12.14, y: 10 }, { x: 6.14, y: 10 }]);
  const walls14 = PartyWallDetector.detect(bldgParty, [{ id: 'n14', polygon: n14 }]);
  assert(walls14[1]?.classification === 'FULL', suite4, '4.4 0.14m gap within 0.15m tolerance detected', `class=${walls14[1]?.classification}`);

  const n16 = new Polygon2D([{ x: 6.16, y: 0 }, { x: 12.16, y: 0 }, { x: 12.16, y: 10 }, { x: 6.16, y: 10 }]);
  const walls16 = PartyWallDetector.detect(bldgParty, [{ id: 'n16', polygon: n16 }]);
  assert(walls16[1]?.classification === 'FREE', suite4, '4.5 0.16m gap beyond tolerance classified as FREE', `class=${walls16[1]?.classification}`);

  // 4.3 Angle tolerance testSegmentPair
  const matchParallel = PartyWallDetector.testSegmentPair({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0.1, y: 0 }, { x: 0.1, y: 10 });
  assert(matchParallel !== null, suite4, '4.6 Parallel wall within tolerance accepted', 'Matched');
  const rad7 = (7 * Math.PI) / 180;
  const match7Deg = PartyWallDetector.testSegmentPair({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0.05, y: 0 }, { x: 0.05 + 10 * Math.sin(rad7), y: 10 * Math.cos(rad7) });
  assert(match7Deg === null, suite4, '4.7 7-degree rotated wall rejected (>6°)', 'Rejected');

  // --- Suite 5: NEN 2580 Calculator ---
  const suite5 = '5. Architectural Stress: NEN 2580 Calculator';

  // 5.1 Low headroom (<1.50m peak)
  const lowRoof: RoofSegment2D[] = [
    { p1: { x: 0, y: 6.0 }, p2: { x: 3, y: 7.20 } },
    { p1: { x: 3, y: 7.20 }, p2: { x: 6, y: 6.0 } },
  ];
  const lowResult = NEN2580Calculator.computeAtticHeadroom('attic_low', 6.00, lowRoof, 6.00);
  assert(lowResult.usable150Line.usableWidthMeters === 0 && lowResult.atticUsableRatio === 0, suite5, '5.1 Low attic (<1.50m) yields 0m usable width', `w=${lowResult.usable150Line.usableWidthMeters}`);
  assert(NEN2580Calculator.calculateUsableArea(0, 10) === 0, suite5, '5.2 GO Wonen is 0.0 m² for low attic', 'Calculated 0');

  // 5.2 Mansard roof (franse kap)
  const mansardRoof: RoofSegment2D[] = [
    { p1: { x: 0, y: 6.00 }, p2: { x: 1.0, y: 8.00 } },
    { p1: { x: 1.0, y: 8.00 }, p2: { x: 3.0, y: 9.00 } },
    { p1: { x: 3.0, y: 9.00 }, p2: { x: 5.0, y: 8.00 } },
    { p1: { x: 5.0, y: 8.00 }, p2: { x: 6.0, y: 6.00 } },
  ];
  const mansardResult = NEN2580Calculator.computeAtticHeadroom('attic_mansard', 6.00, mansardRoof, 6.00);
  assert(Math.abs(mansardResult.usable150Line.usableWidthMeters - 4.50) < 1e-4, suite5, '5.3 Mansard 1.50m usable width is 4.50m', `w=${mansardResult.usable150Line.usableWidthMeters}`);
  assert(Math.abs(mansardResult.verblijf260Line.usableWidthMeters - 1.60) < 1e-4, suite5, '5.4 Mansard 2.60m usable width is 1.60m', `w=${mansardResult.verblijf260Line.usableWidthMeters}`);

  // 5.3 M-shaped multi-pitch
  const mRoof: RoofSegment2D[] = [
    { p1: { x: 0, y: 6 }, p2: { x: 2, y: 9 } },
    { p1: { x: 2, y: 9 }, p2: { x: 4, y: 7 } },
    { p1: { x: 4, y: 7 }, p2: { x: 6, y: 9 } },
    { p1: { x: 6, y: 9 }, p2: { x: 8, y: 6 } },
  ];
  const mResult = NEN2580Calculator.computeAtticHeadroom('attic_m', 6.00, mRoof, 8.00);
  assert(mResult.usable150Line.xHits.length === 4 && Math.abs(mResult.usable150Line.usableWidthMeters - 5.0) < 1e-4, suite5, '5.5 M-roof produces 4 xHits and 5.0m usable width', `w=${mResult.usable150Line.usableWidthMeters}`);

  // --- Suite 6: Label Layout Engine ---
  const suite6 = '6. Architectural Stress: Label Layout Engine';

  // 6.1 Severe label congestion (10 markers in 0.10m)
  const congested = Array.from({ length: 10 }, (_, i) => ({
    id: `m_${i}`,
    nominalY: 3.00 + i * 0.01,
    text: `Level +${(3.00 + i * 0.01).toFixed(2)}`,
    side: 'right' as const,
  }));
  const resolved = LabelLayoutEngine.resolveVerticalStack(congested, 0.45);
  let strictlySpaced = true;
  for (let i = 1; i < resolved.length; i++) {
    if (resolved[i].joggedY - resolved[i - 1].joggedY < 0.45 - 1e-6) {
      strictlySpaced = false;
      break;
    }
  }
  assert(strictlySpaced && resolved.length === 10, suite6, '6.1 10 congested markers resolved with >=0.45m spacing', `spaced=${strictlySpaced}`);

  // 6.2 Dog-leg leader polyline points
  const leaderPts = LabelLayoutEngine.computeJoggedLeaderPoints(resolved[1], 10.0, 1.5);
  assert(leaderPts.length === 4 && leaderPts[0].x === 10.0 && leaderPts[3].x === 11.5, suite6, '6.2 Dog-leg leader points properly formed (4 points)', `pts=${leaderPts.length}`);

  // 6.3 Ultra-long Dutch room title
  const longTitle = 'Gemeenschappelijke multifunctionele ontspannings- en hobbyruimte';
  const lRoom = new Polygon2D([
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 6 },
    { x: 0, y: 6 },
  ]);
  const resLabel = LabelLayoutEngine.computeRoomLabelPlacement(lRoom, longTitle);
  assert(lRoom.containsPoint(resLabel.labelPosition) === true && resLabel.distanceToBoundary > 0.5, suite6, '6.3 Long title placed strictly inside L-shaped room via polylabel', `pos=(${resLabel.labelPosition.x}, ${resLabel.labelPosition.y})`);

  // 6.4 Identical elevations
  const dupes = [
    { id: '1', nominalY: 4.0, text: 'A', side: 'right' as const },
    { id: '2', nominalY: 4.0, text: 'B', side: 'right' as const },
    { id: '3', nominalY: 4.0, text: 'C', side: 'right' as const },
  ];
  const resDupes = LabelLayoutEngine.resolveVerticalStack(dupes, 0.5);
  assert(resDupes[1].joggedY === 4.5 && resDupes[2].joggedY === 5.0, suite6, '6.4 Identical elevations resolved deterministically', `y=[${resDupes.map(d => d.joggedY).join(', ')}]`);

  // --- Summary ---
  console.log('\n================================================================');
  console.log('STRESS TEST SUMMARY');
  console.log('================================================================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS: ${results.length}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    console.error(`VERDICT: REJECT (${failed} stress tests failed)`);
    return false;
  } else {
    console.log('VERDICT: APPROVE (All stress tests passed with 100% mathematical integrity)');
    return true;
  }
}

// Self-execute if executed via CLI
if (typeof require !== 'undefined' && require.main === module) {
  const success = runAdversarialStressSuite();
  process.exit(success ? 0 : 1);
}
