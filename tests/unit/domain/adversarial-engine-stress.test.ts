import { describe, it, expect } from 'vitest';
import { Polygon2D } from '@/domain/geometry/polygon';
import { PolygonClipping } from '@/domain/geometry/clipping';
import { Vector2D, Vector3D } from '@/domain/geometry/vector';
import { Point2D, Point3D, Segment2D } from '@/domain/geometry/types';
import { FrontFacadeDetector } from '@/domain/architectural/front-facade-detector';
import { PartyWallDetector } from '@/domain/architectural/party-wall-detector';
import { NEN2580Calculator, RoofSegment2D } from '@/domain/architectural/nen2580-calculator';
import { LabelLayoutEngine } from '@/domain/architectural/label-layout-engine';

describe('Adversarial Empirical Stress Test Suite', () => {

  // =========================================================================
  // SECTION 1: GEOMETRIC DOMAIN STRESS TESTS
  // =========================================================================
  describe('1. Geometric Stress: Non-Convex, Self-Touching, and Degenerate Polygons', () => {

    it('1.1 should correctly compute geometric properties for non-convex C-shaped polygon', () => {
      // C-shaped non-convex polygon:
      // Outer box 6x6, cavity 3x3 on right side from y=1.5 to 4.5
      // Vertices CCW:
      // (0,0) -> (6,0) -> (6,1.5) -> (3,1.5) -> (3,4.5) -> (6,4.5) -> (6,6) -> (0,6)
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

      // Total area = 6x6 - 3x3 = 36 - 9 = 27 m²
      expect(cPoly.area()).toBeCloseTo(27, 4);
      expect(cPoly.windingOrder()).toBe('CCW');

      // Perimeter = 6 + 1.5 + 3 + 3 + 3 + 1.5 + 6 + 6 = 30m
      expect(cPoly.perimeter()).toBeCloseTo(30, 4);

      // Centroid: in non-convex shapes, the centroid may lie inside or near boundary
      const centroid = cPoly.centroid();
      expect(Number.isFinite(centroid.x)).toBe(true);
      expect(Number.isFinite(centroid.y)).toBe(true);

      // Verify point containment in concave cutout: (4.5, 3.0) is in the missing bite
      expect(cPoly.containsPoint({ x: 4.5, y: 3.0 })).toBe(false);

      // Verify point containment in solid regions: (1.5, 3.0) is inside left spine
      expect(cPoly.containsPoint({ x: 1.5, y: 3.0 })).toBe(true);
      // (4.5, 0.75) is inside bottom wing
      expect(cPoly.containsPoint({ x: 4.5, y: 0.75 })).toBe(true);
      // (4.5, 5.25) is inside top wing
      expect(cPoly.containsPoint({ x: 4.5, y: 5.25 })).toBe(true);

      // Boundary points
      expect(cPoly.containsPoint({ x: 3.0, y: 3.0 }, true)).toBe(true); // on inner vertical edge
      expect(cPoly.containsPoint({ x: 3.0, y: 3.0 }, false)).toBe(false); // exclude boundary
    });

    it('1.2 should handle self-touching and pinched figure-8 polygons without crashing', () => {
      // Figure-8 touching at center neck (5, 5)
      // Bottom loop: (0,0) -> (10,0) -> (5,5)
      // Top loop: (5,5) -> (10,10) -> (0,10) -> (5,5)
      const figure8 = new Polygon2D([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 5, y: 5 },
      ]);

      const bbox = figure8.boundingBox();
      expect(bbox.minX).toBe(0);
      expect(bbox.maxX).toBe(10);
      expect(bbox.minY).toBe(0);
      expect(bbox.maxY).toBe(10);

      // Area should compute without throwing
      const area = figure8.area();
      expect(Number.isFinite(area)).toBe(true);

      // Centroid must not produce NaN or infinity
      const centroid = figure8.centroid();
      expect(Number.isFinite(centroid.x)).toBe(true);
      expect(Number.isFinite(centroid.y)).toBe(true);

      // Closest point on boundary for neck (5, 5)
      const closest = figure8.closestPointOnBoundary({ x: 5, y: 5 });
      expect(closest.distance).toBeCloseTo(0, 4);
    });

    it('1.3 should handle degenerate polygons with all collinear vertices without division by zero', () => {
      // 4 points along a straight horizontal line
      const collinearH = new Polygon2D([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 7, y: 0 },
        { x: 10, y: 0 },
      ]);

      expect(collinearH.area()).toBe(0);
      expect(collinearH.signedArea()).toBe(0);

      // Centroid fallback: must compute mean without dividing by zero
      const centroidH = collinearH.centroid();
      expect(centroidH.x).toBeCloseTo(5, 1);
      expect(centroidH.y).toBeCloseTo(0, 4);

      // Bounding box
      const bboxH = collinearH.boundingBox();
      expect(bboxH.minY).toBe(0);
      expect(bboxH.maxY).toBe(0);

      // 4 points along diagonal
      const collinearDiag = new Polygon2D([
        { x: 0, y: 0 },
        { x: 2, y: 2 },
        { x: 5, y: 5 },
        { x: 8, y: 8 },
      ]);
      expect(collinearDiag.area()).toBe(0);
      const centroidDiag = collinearDiag.centroid();
      expect(Number.isFinite(centroidDiag.x)).toBe(true);
      expect(Number.isFinite(centroidDiag.y)).toBe(true);
    });

    it('1.4 should handle duplicate consecutive vertices and zero-area sliver polygons', () => {
      // Polygon with repeated vertices
      const polyWithDupes = new Polygon2D([
        { x: 0, y: 0 },
        { x: 0, y: 0 }, // duplicate
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 4, y: 4 }, // duplicate
        { x: 0, y: 4 },
      ]);

      expect(polyWithDupes.area()).toBeCloseTo(16, 4);

      // Micro sliver: width 1e-7
      const sliver = new Polygon2D([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 1e-7 },
        { x: 0, y: 1e-7 },
      ]);
      expect(sliver.area()).toBeLessThan(1e-5);
      expect(Number.isFinite(sliver.area())).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 2: BOOLEAN CLIPPING STRESS TESTS
  // =========================================================================
  describe('2. Geometric Stress: Boolean Polygon Clipping under Extreme Configurations', () => {
    const boxA = new Polygon2D([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);

    it('2.1 should handle completely disjoint polygons', () => {
      const boxDisjoint = new Polygon2D([
        { x: 100, y: 100 },
        { x: 110, y: 100 },
        { x: 110, y: 110 },
        { x: 100, y: 110 },
      ]);

      // Intersection must be empty
      const isect = PolygonClipping.intersection(boxA, boxDisjoint);
      expect(isect.length).toBe(0);

      // Union must return 2 separate polygons
      const un = PolygonClipping.union(boxA, boxDisjoint);
      expect(un.length).toBe(2);
      const totalUnionArea = un.reduce((sum, p) => sum + p.area(), 0);
      expect(totalUnionArea).toBeCloseTo(200, 4);

      // Difference A - Disjoint = A
      const diff = PolygonClipping.difference(boxA, boxDisjoint);
      expect(diff.length).toBe(1);
      expect(diff[0].area()).toBeCloseTo(100, 4);

      // XOR = 2 polygons
      const xor = PolygonClipping.xor(boxA, boxDisjoint);
      expect(xor.length).toBe(2);
    });

    it('2.2 should handle 100% identical overlapping polygons', () => {
      const boxIdentical = new Polygon2D([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]);

      const isect = PolygonClipping.intersection(boxA, boxIdentical);
      expect(isect.length).toBe(1);
      expect(isect[0].area()).toBeCloseTo(100, 4);

      const un = PolygonClipping.union(boxA, boxIdentical);
      expect(un.length).toBe(1);
      expect(un[0].area()).toBeCloseTo(100, 4);

      const diff = PolygonClipping.difference(boxA, boxIdentical);
      expect(diff.length).toBe(0);

      const xor = PolygonClipping.xor(boxA, boxIdentical);
      expect(xor.length).toBe(0);
    });

    it('2.3 should handle polygons touching only at a single vertex corner', () => {
      // boxCorner touches boxA only at (10, 10)
      const boxCorner = new Polygon2D([
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 },
      ]);

      // Intersection of 2D areas touching at 1 point should be empty (0-dimensional)
      const isect = PolygonClipping.intersection(boxA, boxCorner);
      expect(isect.length).toBe(0);

      // Difference should leave boxA intact
      const diff = PolygonClipping.difference(boxA, boxCorner);
      expect(diff.length).toBe(1);
      expect(diff[0].area()).toBeCloseTo(100, 4);
    });

    it('2.4 should handle adjacent polygons sharing a flush collinear edge', () => {
      // boxAdjacent shares edge from (10, 0) to (10, 10) with boxA
      const boxAdjacent = new Polygon2D([
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
        { x: 10, y: 10 },
      ]);

      // Shared edge intersection has 0 area
      const isect = PolygonClipping.intersection(boxA, boxAdjacent);
      expect(isect.length).toBe(0);

      // Union should merge both 10x10 boxes into one 20x10 rectangle
      const un = PolygonClipping.union(boxA, boxAdjacent);
      expect(un.length).toBe(1);
      expect(un[0].area()).toBeCloseTo(200, 4);
    });

    it('2.5 should handle concentric nested polygons (subtraction hole)', () => {
      // boxInner (4x4) is centered inside boxA (10x10) from (3,3) to (7,7)
      const boxInner = new Polygon2D([
        { x: 3, y: 3 },
        { x: 7, y: 3 },
        { x: 7, y: 7 },
        { x: 3, y: 7 },
      ]);

      // Intersection is the inner box
      const isect = PolygonClipping.intersection(boxA, boxInner);
      expect(isect.length).toBe(1);
      expect(isect[0].area()).toBeCloseTo(16, 4);

      // Union is the outer box
      const un = PolygonClipping.union(boxA, boxInner);
      expect(un.length).toBe(1);
      expect(un[0].area()).toBeCloseTo(100, 4);
    });

    it('2.6 should handle sub-millimeter micro-overlaps without floating-point failure', () => {
      // boxSliver overlaps boxA by only 0.0001m (0.1mm) along right edge
      const boxSliver = new Polygon2D([
        { x: 9.9999, y: 0 },
        { x: 19.9999, y: 0 },
        { x: 19.9999, y: 10 },
        { x: 9.9999, y: 10 },
      ]);

      const isect = PolygonClipping.intersection(boxA, boxSliver);
      expect(isect.length).toBe(1);
      // Area = 0.0001 * 10 = 0.001 m²
      expect(isect[0].area()).toBeCloseTo(0.001, 3);
    });
  });

  // =========================================================================
  // SECTION 3: FRONT FACADE DETECTOR ADVERSARIAL STRESS
  // =========================================================================
  describe('3. Architectural Stress: Front Facade Detector', () => {
    // 8x10 building:
    // Edge 0: South (0,0) -> (8,0)
    // Edge 1: East  (8,0) -> (8,10)
    // Edge 2: North (8,10) -> (0,10)
    // Edge 3: West  (0,10) -> (0,0)
    const building = new Polygon2D([
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 10 },
      { x: 0, y: 10 },
    ]);

    it('3.1 should correctly identify facade with heavily skewed diagonal street axes', () => {
      // Street runs diagonally at 30 degrees: p1=(-5, -6) to p2=(15, -2)
      // The South wall (y=0) faces this street directly
      const skewedStreet: Segment2D = {
        p1: { x: -5, y: -6 },
        p2: { x: 15, y: -2 },
      };

      const result = FrontFacadeDetector.detect(building, {
        streetCenterline: skewedStreet,
      });

      expect(result.frontEdgeIndex).toBe(0);
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.outwardNormal.y).toBeLessThan(0); // Faces South
    });

    it('3.2 should handle rotated building with skewed street and entrance point simultaneously', () => {
      // Rotate building by 30 degrees (angle phi = PI / 6)
      const phi = Math.PI / 6;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);

      const rotVertices = building.vertices.map((v) => ({
        x: v.x * cosP - v.y * sinP,
        y: v.x * sinP + v.y * cosP,
      }));
      const rotBuilding = new Polygon2D(rotVertices);

      // Entrance is near the rotated Edge 0 (South facade)
      const origMidEdge0 = { x: 4, y: -0.2 };
      const rotEntrance: Point2D = {
        x: origMidEdge0.x * cosP - origMidEdge0.y * sinP,
        y: origMidEdge0.x * sinP + origMidEdge0.y * cosP,
      };

      const result = FrontFacadeDetector.detect(rotBuilding, {
        entrancePoint: rotEntrance,
      });

      expect(result.frontEdgeIndex).toBe(0);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('3.3 should handle multi-entrance buildings and prioritize main entrance or frontage', () => {
      // Building with 2 doors:
      // Main entrance door on South facade at (4, -0.1)
      // Rear garden door on North facade at (4, 10.1)
      // Street is located South at y = -4
      const street: Segment2D = {
        p1: { x: -5, y: -4 },
        p2: { x: 15, y: -4 },
      };

      // Case A: When entrance is at South door, South facade (edge 0) wins clearly
      const resultSouth = FrontFacadeDetector.detect(building, {
        entrancePoint: { x: 4, y: -0.1 },
        streetCenterline: street,
      });
      expect(resultSouth.frontEdgeIndex).toBe(0);

      // Case B: If secondary rear garden door is at North wall, but cadastral frontage
      // outward normal points South towards the street, South facade (edge 0) is correctly resolved!
      const resultNorthDoorWithFrontage = FrontFacadeDetector.detect(building, {
        entrancePoint: { x: 4, y: 10.1 },
        streetCenterline: street,
        parcelFrontage: { p1: { x: 8, y: 0 }, p2: { x: 0, y: 0 } },
        weights: { entrance: 0.20, street: 0.40, frontage: 0.40 },
      });
      expect(resultNorthDoorWithFrontage.frontEdgeIndex).toBe(0);
    });

    it('3.4 should handle concave street frontages (U-shaped building facing street)', () => {
      // U-shaped building facing South street:
      // Left wing: x: 0..3, y: 0..10
      // Right wing: x: 7..10, y: 0..10
      // Recessed connector: x: 3..7, y: 6..10 (front courtyard facing south)
      // Vertices CCW:
      // (0,0) [edge 0: South tip left wing] -> (3,0) -> (3,6) -> (7,6) [edge 2: Recessed courtyard facade]
      // -> (7,0) -> (10,0) -> (10,10) -> (0,10)
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

      // Street is at y = -5
      const southStreet: Segment2D = {
        p1: { x: -5, y: -5 },
        p2: { x: 15, y: -5 },
      };

      // Entrance is on the recessed facade at (5, 5.8)
      const result = FrontFacadeDetector.detect(uBuilding, {
        entrancePoint: { x: 5, y: 5.8 },
        streetCenterline: southStreet,
      });

      // Recessed courtyard edge is from (3,6) to (7,6) (index 2)
      // It faces South (outward normal pointing south towards the courtyard)
      expect(result.frontEdgeIndex).toBe(2);
      expect(result.frontEdge.p1.y).toBe(6);
      expect(result.frontEdge.p2.y).toBe(6);
      expect(result.outwardNormal.y).toBeLessThan(0);
    });

    it('3.5 should safely degrade when given empty options or zero-length street segments', () => {
      // Empty options: must pick an edge with confidence >= 0 without error
      const emptyResult = FrontFacadeDetector.detect(building, {});
      expect(emptyResult.frontEdgeIndex).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(emptyResult.confidence)).toBe(true);

      // Zero-length degenerate street segment (p1 == p2)
      const pointStreet: Segment2D = {
        p1: { x: 4, y: -5 },
        p2: { x: 4, y: -5 },
      };
      const degenResult = FrontFacadeDetector.detect(building, {
        streetCenterline: pointStreet,
      });
      expect(degenResult.frontEdgeIndex).toBe(0);
      expect(Number.isFinite(degenResult.confidence)).toBe(true);

      // Distant entrance point (10,000m away)
      const distantResult = FrontFacadeDetector.detect(building, {
        entrancePoint: { x: 10000, y: 10000 },
      });
      expect(Number.isFinite(distantResult.confidence)).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 4: PARTY WALL DETECTOR ADVERSARIAL STRESS
  // =========================================================================
  describe('4. Architectural Stress: Party Wall Detector Tolerances & Overlap Fractions', () => {
    // Subject building: 6m wide (x: 0 to 6), 10m deep (y: 0 to 10)
    // Edge 0: (0,0) -> (6,0) (South)
    // Edge 1: (6,0) -> (6,10) (East)
    // Edge 2: (6,10) -> (0,10) (North)
    // Edge 3: (0,10) -> (0,0) (West)
    const building = new Polygon2D([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 10 },
      { x: 0, y: 10 },
    ]);

    it('4.1 should evaluate varied overlap fractions: 0.05 (tiny), 0.50 (partial), and 0.95 (full)', () => {
      // East wall length is 10.0m (edge 1).
      // Case A: 5% overlap = 0.50m (y: 0 to 0.50). Min shared length is 0.10m.
      // Should be detected as 'PARTIAL' (coverage = 0.05 < 0.85).
      const neighbor05 = new Polygon2D([
        { x: 6, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 0.50 },
        { x: 6, y: 0.50 },
      ]);
      const walls05 = PartyWallDetector.detect(building, [{ id: 'n05', polygon: neighbor05 }]);
      expect(walls05[1].classification).toBe('PARTIAL');
      expect(walls05[1].sharedLengthMeters).toBeCloseTo(0.50, 2);

      // Case B: 50% overlap = 5.0m (y: 0 to 5.0). Staggered neighbor (verspringende aanbouw).
      const neighbor50 = new Polygon2D([
        { x: 6, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 5.0 },
        { x: 6, y: 5.0 },
      ]);
      const walls50 = PartyWallDetector.detect(building, [{ id: 'n50', polygon: neighbor50 }]);
      expect(walls50[1].classification).toBe('PARTIAL');
      expect(walls50[1].sharedLengthMeters).toBeCloseTo(5.0, 2);

      // Case C: 95% overlap = 9.5m (y: 0.25 to 9.75). Standard terrace house tolerance.
      const neighbor95 = new Polygon2D([
        { x: 6, y: 0.25 },
        { x: 12, y: 0.25 },
        { x: 12, y: 9.75 },
        { x: 6, y: 9.75 },
      ]);
      const walls95 = PartyWallDetector.detect(building, [{ id: 'n95', polygon: neighbor95 }]);
      expect(walls95[1].classification).toBe('FULL'); // > 0.85 threshold
      expect(walls95[1].sharedLengthMeters).toBeCloseTo(9.5, 2);
    });

    it('4.2 should rigorously test tolerance boundaries (+-0.15m epsilon buffer)', () => {
      // East wall is at x = 6.0m (edge 1).
      // Gap 1: 0.14m (within 0.15m tolerance) -> MUST be detected
      const neighborWithin = new Polygon2D([
        { x: 6.14, y: 0 },
        { x: 12.14, y: 0 },
        { x: 12.14, y: 10 },
        { x: 6.14, y: 10 },
      ]);
      const wallsWithin = PartyWallDetector.detect(building, [{ id: 'nWithin', polygon: neighborWithin }]);
      expect(wallsWithin[1].classification).toBe('FULL');

      // Gap 2: 0.16m (exceeds 0.15m tolerance) -> MUST NOT be detected (FREE)
      const neighborBeyond = new Polygon2D([
        { x: 6.16, y: 0 },
        { x: 12.16, y: 0 },
        { x: 12.16, y: 10 },
        { x: 6.16, y: 10 },
      ]);
      const wallsBeyond = PartyWallDetector.detect(building, [{ id: 'nBeyond', polygon: neighborBeyond }]);
      expect(wallsBeyond[1].classification).toBe('FREE');
    });

    it('4.3 should reject walls with angular deviation exceeding the 6-degree threshold', () => {
      const pA: Point2D = { x: 0, y: 0 };
      const pB: Point2D = { x: 0, y: 10 };

      // Parallel segment at 0.10m distance:
      const pCPar: Point2D = { x: 0.10, y: 0 };
      const pDPar: Point2D = { x: 0.10, y: 10 };
      const matchParallel = PartyWallDetector.testSegmentPair(pA, pB, pCPar, pDPar);
      expect(matchParallel).not.toBeNull();

      // 7-degree rotated segment (exceeds 6 deg threshold):
      const rad7 = (7 * Math.PI) / 180;
      const pCRot: Point2D = { x: 0.05, y: 0 };
      const pDRot: Point2D = { x: 0.05 + 10 * Math.sin(rad7), y: 10 * Math.cos(rad7) };
      const match7Deg = PartyWallDetector.testSegmentPair(pA, pB, pCRot, pDRot);
      expect(match7Deg).toBeNull(); // Rejected due to angle > 6°
    });

    it('4.4 should handle complex terrace rows with both left and right neighbors simultaneously', () => {
      // Mid-terrace (rijwoning tussen):
      // West neighbor at x: -6 to 0, y: 0 to 10
      // East neighbor at x: 6 to 12, y: 0 to 10
      const westNeighbor = new Polygon2D([
        { x: -6, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: -6, y: 10 },
      ]);
      const eastNeighbor = new Polygon2D([
        { x: 6, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 10 },
        { x: 6, y: 10 },
      ]);

      const walls = PartyWallDetector.detect(building, [
        { id: 'west', polygon: westNeighbor },
        { id: 'east', polygon: eastNeighbor },
      ]);

      expect(walls[0].classification).toBe('FREE'); // South (street)
      expect(walls[1].classification).toBe('FULL'); // East (neighbor)
      expect(walls[2].classification).toBe('FREE'); // North (garden)
      expect(walls[3].classification).toBe('FULL'); // West (neighbor)
    });
  });

  // =========================================================================
  // SECTION 5: NEN 2580 CALCULATOR ADVERSARIAL STRESS
  // =========================================================================
  describe('5. Architectural Stress: NEN 2580 Calculator & Complex Roof Typologies', () => {

    it('5.1 should handle low-headroom attics (< 1.50m peak height) resulting in 0 m² GO Wonen', () => {
      // Attic floor at NAP 6.00m.
      // Very low roof: eaves at NAP 6.00m (x=0, x=6), ridge at NAP 7.20m (x=3).
      // Headroom at peak is only 1.20m!
      // Therefore, the 1.50m clearance line (NAP 7.50m) and 2.60m line (NAP 8.60m) are ABOVE the ridge!
      const lowRoof: RoofSegment2D[] = [
        { p1: { x: 0, y: 6.0 }, p2: { x: 3, y: 7.20 } },
        { p1: { x: 3, y: 7.20 }, p2: { x: 6, y: 6.0 } },
      ];

      const result = NEN2580Calculator.computeAtticHeadroom(
        'floor_low_attic',
        6.00,
        lowRoof,
        6.00
      );

      // Must produce 0 hits, 0 width, and 0 usable ratio without crashing or NaN
      expect(result.usable150Line.xHits.length).toBe(0);
      expect(result.usable150Line.usableWidthMeters).toBe(0);
      expect(result.verblijf260Line.xHits.length).toBe(0);
      expect(result.verblijf260Line.usableWidthMeters).toBe(0);
      expect(result.atticUsableRatio).toBe(0);

      // Usable area (GO Wonen) must be exactly 0 m²
      const goWonen = NEN2580Calculator.calculateUsableArea(result.usable150Line.usableWidthMeters, 10.0);
      expect(goWonen).toBe(0.0);
    });

    it('5.2 should compute exact clearance lines on Mansard roof (gebroken kap / franse kap)', () => {
      // Mansard roof with 4 segments across 6m span:
      // Floor at NAP 6.00m
      // Left steep pitch: (0, 6.00) -> (1.0, 8.00) (slope: 2.0m rise per 1m run = steep)
      // Left shallow pitch: (1.0, 8.00) -> (3.0, 9.00) (slope: 1.0m rise per 2m run)
      // Right shallow pitch: (3.0, 9.00) -> (5.0, 8.00)
      // Right steep pitch: (5.0, 8.00) -> (6.0, 6.00)
      const mansardRoof: RoofSegment2D[] = [
        { p1: { x: 0, y: 6.00 }, p2: { x: 1.0, y: 8.00 } },
        { p1: { x: 1.0, y: 8.00 }, p2: { x: 3.0, y: 9.00 } },
        { p1: { x: 3.0, y: 9.00 }, p2: { x: 5.0, y: 8.00 } },
        { p1: { x: 5.0, y: 8.00 }, p2: { x: 6.0, y: 6.00 } },
      ];

      const result = NEN2580Calculator.computeAtticHeadroom(
        'floor_mansard',
        6.00,
        mansardRoof,
        6.00
      );

      // 1.50m line is at z = 7.50m.
      // This intersects the steep lower slopes:
      // Left: y = 6 + 2*x = 7.50 -> x = 0.75
      // Right: y = 8 - 2*(x - 5) = 7.50 -> x = 5.25
      // Usable width = 5.25 - 0.75 = 4.50m
      expect(result.usable150Line.zLevel).toBe(7.50);
      expect(result.usable150Line.xHits.length).toBe(2);
      expect(result.usable150Line.xHits[0]).toBeCloseTo(0.75, 4);
      expect(result.usable150Line.xHits[1]).toBeCloseTo(5.25, 4);
      expect(result.usable150Line.usableWidthMeters).toBeCloseTo(4.50, 4);

      // 2.60m line is at z = 8.60m.
      // This intersects the shallow upper slopes:
      // Left: y = 8 + 0.5*(x - 1) = 8.60 -> x - 1 = 1.20 -> x = 2.20
      // Right: y = 9 - 0.5*(x - 3) = 8.60 -> 0.5*(x - 3) = 0.40 -> x = 3.80
      // Usable width = 3.80 - 2.20 = 1.60m
      expect(result.verblijf260Line.zLevel).toBe(8.60);
      expect(result.verblijf260Line.xHits.length).toBe(2);
      expect(result.verblijf260Line.xHits[0]).toBeCloseTo(2.20, 4);
      expect(result.verblijf260Line.xHits[1]).toBeCloseTo(3.80, 4);
      expect(result.verblijf260Line.usableWidthMeters).toBeCloseTo(1.60, 4);

      // Attic usable ratio: 4.50 / 6.00 = 0.75
      expect(result.atticUsableRatio).toBeCloseTo(0.75, 2);
    });

    it('5.3 should handle complex multi-pitch M-shaped roof with double valleys', () => {
      // M-shaped double gable roof over 8m span:
      // Floor at NAP 6.00m
      // Left gable: (0, 6) -> (2, 9) -> (4, 7) [central valley at z=7]
      // Right gable: (4, 7) -> (6, 9) -> (8, 6)
      const mRoof: RoofSegment2D[] = [
        { p1: { x: 0, y: 6 }, p2: { x: 2, y: 9 } },
        { p1: { x: 2, y: 9 }, p2: { x: 4, y: 7 } },
        { p1: { x: 4, y: 7 }, p2: { x: 6, y: 9 } },
        { p1: { x: 6, y: 9 }, p2: { x: 8, y: 6 } },
      ];

      // At 1.50m headroom (z = 7.50m):
      // The horizontal line cuts all 4 segments:
      // Seg 1 (x: 0->2, y: 6->9): y = 6 + 1.5*x = 7.50 -> x = 1.0
      // Seg 2 (x: 2->4, y: 9->7): y = 9 - 1.0*(x - 2) = 7.50 -> x = 3.5
      // Seg 3 (x: 4->6, y: 7->9): y = 7 + 1.0*(x - 4) = 7.50 -> x = 4.5
      // Seg 4 (x: 6->8, y: 9->6): y = 9 - 1.5*(x - 6) = 7.50 -> x = 7.0
      const result = NEN2580Calculator.computeAtticHeadroom(
        'floor_m_roof',
        6.00,
        mRoof,
        8.00
      );

      expect(result.usable150Line.xHits.length).toBe(4);
      expect(result.usable150Line.xHits[0]).toBeCloseTo(1.0, 4);
      expect(result.usable150Line.xHits[1]).toBeCloseTo(3.5, 4);
      expect(result.usable150Line.xHits[2]).toBeCloseTo(4.5, 4);
      expect(result.usable150Line.xHits[3]).toBeCloseTo(7.0, 4);
      // Total usable width = (3.5 - 1.0) + (7.0 - 4.5) = 2.5 + 2.5 = 5.0m
      expect(result.usable150Line.usableWidthMeters).toBeCloseTo(5.0, 4);
    });
  });

  // =========================================================================
  // SECTION 6: LABEL LAYOUT ENGINE ADVERSARIAL STRESS
  // =========================================================================
  describe('6. Architectural Stress: Label Layout Engine Congestion & Polylabel Stress', () => {

    it('6.1 should disperse severe elevation marker congestion (10 markers in 0.10m)', () => {
      // 10 elevation markers crammed between 3.00m and 3.09m
      const minSpacing = 0.45;
      const congested = Array.from({ length: 10 }, (_, i) => ({
        id: `marker_${i}`,
        nominalY: 3.00 + i * 0.01,
        text: `Level +${(3.00 + i * 0.01).toFixed(2)}`,
        side: 'right' as const,
      }));

      const resolved = LabelLayoutEngine.resolveVerticalStack(congested, minSpacing);

      expect(resolved.length).toBe(10);

      // Verify strict monotonic ascending order
      for (let i = 1; i < resolved.length; i++) {
        expect(resolved[i].joggedY).toBeGreaterThan(resolved[i - 1].joggedY);
        // Verify minimum distance constraint is strictly met
        const spacing = resolved[i].joggedY - resolved[i - 1].joggedY;
        expect(spacing).toBeGreaterThanOrEqual(minSpacing - 1e-6);
      }

      // Verify items from index 1 to 9 are flagged as isJogged
      for (let i = 1; i < resolved.length; i++) {
        expect(resolved[i].isJogged).toBe(true);
      }

      // Verify dog-leg leader polyline points are properly generated
      for (const item of resolved) {
        const leaderPts = LabelLayoutEngine.computeJoggedLeaderPoints(item, 10.0, 1.5);
        expect(leaderPts.length).toBe(item.isJogged ? 4 : 2);
        // Start point must be at anchor (x=10.0, y=item.nominalY)
        expect(leaderPts[0].x).toBe(10.0);
        expect(leaderPts[0].y).toBeCloseTo(item.nominalY, 4);
        // End point must be at jogged text position (x=11.5, y=item.joggedY)
        const lastPt = leaderPts[leaderPts.length - 1];
        expect(lastPt.x).toBe(11.5);
        expect(lastPt.y).toBeCloseTo(item.joggedY, 4);
      }
    });

    it('6.2 should handle ultra-long Dutch room titles in tiny, narrow, and L-shaped spaces', () => {
      const longTitle = 'Gemeenschappelijke multifunctionele ontspannings- en hobbyruimte';

      // Case A: Tiny toilet/meterkast: 0.90m x 1.10m
      const tinyRoom = new Polygon2D([
        { x: 0, y: 0 },
        { x: 0.90, y: 0 },
        { x: 0.90, y: 1.10 },
        { x: 0, y: 1.10 },
      ]);
      const resTiny = LabelLayoutEngine.computeRoomLabelPlacement(tinyRoom, longTitle);
      expect(resTiny.roomName).toBe(longTitle);
      expect(tinyRoom.containsPoint(resTiny.labelPosition)).toBe(true);
      expect(resTiny.areaM2).toBeCloseTo(0.99, 2);
      expect(resTiny.distanceToBoundary).toBeGreaterThan(0);

      // Case B: Narrow corridor: 12m long by 1.0m wide
      const narrowHallway = new Polygon2D([
        { x: 0, y: 0 },
        { x: 12.0, y: 0 },
        { x: 12.0, y: 1.0 },
        { x: 0, y: 1.0 },
      ]);
      const resHall = LabelLayoutEngine.computeRoomLabelPlacement(narrowHallway, longTitle);
      expect(narrowHallway.containsPoint(resHall.labelPosition)).toBe(true);
      expect(resHall.distanceToBoundary).toBeCloseTo(0.5, 1);

      // Case C: L-shaped living room with outside centroid
      const lRoom = new Polygon2D([
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 6 },
        { x: 0, y: 6 },
      ]);
      const resL = LabelLayoutEngine.computeRoomLabelPlacement(lRoom, longTitle);
      expect(lRoom.containsPoint(resL.labelPosition)).toBe(true);
      expect(resL.distanceToBoundary).toBeGreaterThan(0.5);
    });

    it('6.3 should resolve duplicate/near-zero vertical floor intervals without infinite loops', () => {
      // 4 markers at the EXACT same nominal elevation (e.g. 4.00m)
      const duplicateMarkers = [
        { id: 'm1', nominalY: 4.00, text: 'Slab Top', side: 'right' as const },
        { id: 'm2', nominalY: 4.00, text: 'Finish Floor', side: 'right' as const },
        { id: 'm3', nominalY: 4.00, text: 'Threshold', side: 'right' as const },
        { id: 'm4', nominalY: 4.00, text: 'Datum Ref', side: 'right' as const },
      ];

      const resolved = LabelLayoutEngine.resolveVerticalStack(duplicateMarkers, 0.40);

      expect(resolved.length).toBe(4);
      expect(resolved[0].joggedY).toBeCloseTo(4.00, 4);
      expect(resolved[1].joggedY).toBeCloseTo(4.40, 4);
      expect(resolved[2].joggedY).toBeCloseTo(4.80, 4);
      expect(resolved[3].joggedY).toBeCloseTo(5.20, 4);

      for (let i = 1; i < resolved.length; i++) {
        expect(resolved[i].isJogged).toBe(true);
      }
    });
  });

});
