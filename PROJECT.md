# Project: Plattegrond- & Doorsnede-Engine & Next.js Techstack Harmonisatie (`easy_hosting`)

## Architecture
- **Clean Architecture & Layer Separation**:
  - **Data Layer (`src/data/`)**:
    - `pdok-locatieserver-client.ts`: Address search, suggestions, and lookup returning RD coordinates + bag_identificatie.
    - `kadaster-bag-client.ts`: OGC API Features client querying Panden, Verblijfsobjecten, and Kadastrale Percelen in EPSG:28992.
    - `three-d-bag-client.ts`: 3D BAG CityJSON 2.0 streaming parser converting LoD 1.2, 1.3, and 2.2 semantic surfaces (`WallSurface`, `RoofSurface`, `GroundSurface`) into metric RD + NAP coordinates using `metadata.transform`.
    - `ahn-elevation-client.ts`: AHN5 elevation point querying for ground level datum.
  - **Domain / Math Layer (`src/domain/`)**:
    - `geometry/vector.ts`: Immutable 2D and 3D vector, matrix, and affine transformation mathematics.
    - `geometry/polygon.ts`: Polygon definitions, bounding boxes, normal computation, and area calculation.
    - `geometry/clipping.ts`: 2D boolean clipping wrappers around `martinez-polygon-clipping` for footprint intersections, void subtraction, and parcel overlap.
    - `geometry/triangulation.ts`: Triangulation wrapper around `earcut` for CityJSON non-triangular 3D faces.
    - `architectural/front-facade-detector.ts`: Multi-signal composite objective scoring (BAG entrance proximity, street centerline alignment, cadastral frontage) to deterministically identify the front facade.
    - `architectural/party-wall-detector.ts`: Collinear interval projection ($t \in [0, 1]$) with 0.15m epsilon buffer against adjacent `Pand in gebruik` geometries.
    - `architectural/floor-builder.ts`: Dynamic floor levels partitioned from AHN5 ground datum, gutter height, and ridge height.
    - `architectural/nen2580-calculator.ts`: 3D plane-mesh slicing at 1.50m (GO Wonen) and 2.60m (Verblijfsgebied) clearance lines.
    - `architectural/label-layout-engine.ts`: 1D interval stacking with jogged leaders for elevation markers and 2D pole-of-inaccessibility (`@mapbox/polylabel`) for room labels.
  - **UI / Presentation Layer (`src/components/` & `src/views/`)**:
    - `src/components/floorplan/FloorplanViewer.tsx`: Interactive declarative SVG floorplan viewer with zoom/pan, wall rendering, party wall hatching, room tags, and zero-overlap dimensioning.
    - `src/components/cross-section/CrossSectionViewer.tsx`: Declarative SVG cross-section viewer with roof slopes, dynamic floors, NEN 2580 clearance lines, and stacked elevation chips.
    - `src/components/ui/InspectionChips.tsx`: Material Design 3 inspection badges (Voorgevel, Mandelig, AHN5, NEN 2580, 3D BAG LoD).
    - `src/app/`: Next.js 16 App Router pages and API routes (`src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`).
  - **Testing Infrastructure (`tests/`)**:
    - `tests/unit/`: Vitest unit tests for 100% geometric domain math, CityJSON parsing, and party wall logic.
    - `tests/e2e/`: Playwright headless visual regression tests on 5 benchmark building typologies without label overlaps or console errors.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | RCA & Geometry Library Evaluation | Formal RCA report & geometry library benchmarking (martinez, earcut, domain math) | M1 | DISPATCH R1 |
| 2 | Project Scaffolding & Dependencies | Next.js 16, React 19, TypeScript strict, Tailwind CSS v4, Lucide React, Vitest, Playwright | M2 | DISPATCH R2 |
| 3 | Tailwind CSS v4 Theme & PostCSS | CSS-first configuration `@import 'tailwindcss';` with `@theme inline` design tokens | M2 | easy_hosting |
| 4 | Vitest & Playwright Config Alignment | `vitest.config.ts` (fileParallelism: false) and `playwright.config.ts` (webServer, screenshot diffs) | M2 | easy_hosting |
| 5 | Data Layer: PDOK & Kadaster BAG OGC Clients | Type-safe clients for Locatieserver & Kadaster BAG OGC API in EPSG:28992 | M3 | DISPATCH R2 |
| 6 | Data Layer: 3D BAG CityJSON 2.0 Parser | Parser with metric transform scaling and LoD 1.2/1.3/2.2 semantic surface extraction | M3 | DISPATCH R2 |
| 7 | Domain Math: Vector2D/3D & Transform Core | Pure TypeScript vector, polygon, and 2D/3D affine transformation functions | M3 | DISPATCH R2 |
| 8 | Domain Math: 2D Boolean Polygon Clipping | `martinez-polygon-clipping` integration for parcel and wall footprints | M3 | DISPATCH R1/R3 |
| 9 | Architectural Domain: Front Facade Detection | Multi-signal composite scoring (entrance point, street axis, parcel frontage) | M3 | DISPATCH R3 |
| 10 | Architectural Domain: Party Wall Detection | Topologically exact 1D interval projection against neighboring parcels | M3 | DISPATCH R3 |
| 11 | Architectural Domain: Dynamic Floors & NEN 2580 | Floor builder with AHN5 ground datum and 1.50m/2.60m headroom cutting planes | M3 | DISPATCH R3 |
| 12 | Architectural Domain: Zero-Overlap Label Engine | 1D interval stacking with jogged leaders and pole-of-inaccessibility placement | M3 | DISPATCH R3 |
| 13 | UI: Declarative SVG Floorplan Component | Interactive React component rendering walls, party walls, doors, windows, and badges | M4 | DISPATCH R2/R3 |
| 14 | UI: Declarative SVG Cross-Section Component | Interactive React component rendering vertical sections, roof typologies, and floor heights | M4 | DISPATCH R2/R3 |
| 15 | UI: MD3 Inspection Badges & Chips | Material Design 3 chips for Voorgevel, Mandelige muur, AHN5, NEN 2580 | M4 | DISPATCH R2 |
| 16 | UI: Benchmark Viewer Page | Next.js App Router page loading and switching between 5 benchmark typologies | M4 | DISPATCH R4 |
| 17 | Testing: 100% Vitest Unit Test Suite | Comprehensive unit tests for geometry, clipping, front facade, party walls, and NEN 2580 | M5 | DISPATCH R4 |
| 18 | Testing: Playwright Visual Regression Suite | E2E visual regression tests on 5 benchmark typologies with zero label overlap & no console errors | M5 | DISPATCH R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | RCA & Geometry Library Evaluation | Formal RCA report & computational geometry benchmarking | none | DONE |
| 2 | Techstack Harmonisatie conform `easy_hosting` | Scaffolding Next.js App Router, TS strict, Tailwind v4, configs, scripts | M1 | DONE |
| 3 | Deterministisch Bouwkundig Domeinmodel & Data Layer | Data clients (PDOK, BAG OGC, 3D BAG), pure math domain, party walls, NEN 2580 | M2 | DONE |
| 4 | UI / Presentation Layer | Declarative SVG floorplan, cross-section, MD3 chips, Next.js page | M3 | DONE |
| 5 | Geautomatiseerde Testsuite & Victory Verification | 100% Vitest unit tests, Playwright headless visual regression, 0 console errors | M4 | DONE |

## Interface Contracts
### Data Layer ↔ Domain Layer
- `PDOKLocationResult`: `{ bagId: string, address: string, rdCoordinates: [number, number], boundingBox: [number, number, number, number] }`
- `BagBuildingData`: `{ identificatie: string, status: string, geometrieRD: Polygon2D, bouwjaar: number, verblijfsobjecten: AddressPoint[] }`
- `CityJSON3DModel`: `{ vertices: Vector3D[], surfaces: SemanticSurface[], lod: '1.2' | '1.3' | '2.2', groundHeightNAP: number, roofHeightNAP: number }`

### Domain Layer ↔ UI Presentation Layer
- `FloorplanViewModel`:
  - `walls`: Array of `{ start: Point2D, end: Point2D, thickness: number, isPartyWall: boolean, isFrontFacade: boolean }`
  - `rooms`: Array of `{ name: string, areaM2: number, labelPosition: Point2D, polygon: Point2D[] }`
  - `badges`: Array of `{ type: 'front_facade' | 'party_wall', position: Point2D, label: string }`
  - `viewBox`: `{ minX: number, minY: number, width: number, height: number }`
- `CrossSectionViewModel`:
  - `groundLevelNAP`: number
  - `floors`: Array of `{ name: string, elevationNAP: number, heightMeters: number, outline: Point2D[] }`
  - `roofProfile`: Array<Point2D>
  - `clearanceLines`: Array<{ heightMeters: number, type: 'nen2580_150' | 'nen2580_260', segments: Array<{ start: Point2D, end: Point2D }> }>
  - `labels`: Array<{ text: string, anchorY: number, joggedY: number, x: number }>`

## Code Layout
- `package.json`
- `tsconfig.json`
- `tsconfig.e2e.json`
- `postcss.config.mjs`
- `vitest.config.ts`
- `playwright.config.ts`
- `eslint.config.mjs`
- `src/`
  - `app/`
    - `layout.tsx`
    - `page.tsx`
    - `globals.css`
  - `data/`
    - `pdok/`
    - `bag/`
    - `cityjson/`
  - `domain/`
    - `geometry/`
    - `architectural/`
    - `nen2580/`
  - `components/`
    - `floorplan/`
    - `cross-section/`
    - `ui/`
- `tests/`
  - `unit/`
  - `e2e/`
  - `fixtures/` (5 benchmark typologies: rijwoning tussen, hoekwoning, twee-onder-een-kap, vrijstaande villa, pand met verspringende aanbouw)
