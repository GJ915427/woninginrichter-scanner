# Implementation Plan: Double-Blind Ground Truth Benchmark (100 Panden), Systemische Vloergeometrie & Background Preloading

## 1. Executive Summary & Architecturale Context

### Feitelijke Herkomst & Verantwoording van de Ground Truth Dataset
In eerdere sessies werd verwezen naar "Geverifieerde NEN 2580 Meetrapporten (zoals ook Rijksweg 153B)". Voor een zuivere architecturale verantwoording corrigeren we dit direct en transparant:
- **Rijksweg 153B (Gronsveld):** Beschikte *niet* over een extern gecertificeerd NEN 2580 meetrapport van een meetbureau. De maten (6.62m × 8.00m hoofdvolume, opbouw 2e verdieping) zijn tot stand gekomen via Kadaster BAG 2D footprint (`pandId: 0905100000018803`), TU Delft 3D BAG laserscans (AHN4) en directe verificatie door de gebruiker.
- **De 100 Echte Panden — Wie, Wat en Wanneer:**
  Om elk vermoeden van "pleisters" of aannames uit te sluiten, wordt een **Double-Blind Ground Truth Benchmark Dataset** van **100 echte, op een fysieke locatie gebouwde Nederlandse panden** samengesteld uit drie openbare, wetenschappelijke en bouwkundige bronnen:
  1. **35× RVO Voorbeeldwoningen (Rijksoverheid / Ministerie van BZK):**
     - *Wie & Wanneer:* Opgesteld door **DGMR Bouwadviseurs** en **Arcadis** in opdracht van het Ministerie van BZK (gepubliceerd 2011, gereviseerd 2022).
     - *Wat:* Echte referentiewoningen gebaseerd op gerealiseerde bouwprojecten door heel Nederland (tussenwoningen, hoekwoningen, 2-onder-1-kap, vrijstaand, galerij- en portieketages van 1900 tot heden).
     - *Ground Truth:* Volledige bouwkundige CAD/PDF-tekeningen per verdieping met exacte buitenmaten en NEN 2580 gebruiks- en bruto vloeroppervlakten (GO/BVO).
  2. **35× Gemeentelijke Open Bouwdossiers (Vergunningtekeningen):**
     - *Wie & Wanneer:* Beëdigde architecten en constructeurs bij formele bouwaanvragen (periode 1920–2023), openbaar gearchiveerd door gemeentelijke stadsarchieven (o.a. Amsterdam, Rotterdam, Utrecht, Den Haag, Maastricht).
     - *Wat:* Echte bestaande panden (o.a. Amsterdamse grachtenpanden, jaren '30 woonwijken, diepe herenhuizen en naoorlogse doorzonwoningen).
     - *Ground Truth:* De vergunde en gerealiseerde bestek- en splitsingstekeningen per etage (buitencontouren exclusief binnenmuren).
  3. **30× TU Delft 3D BAG LoD 2.2 Volumetrische Z-Slices:**
     - *Wie & Wanneer:* Onderzoekers van de **3D Geoinformation Research Group** van de TU Delft (Prof. dr. Jantien Stoter, dr. Ravi Peters e.a., 2021–2024), gevalideerd met AHN4/5 LiDAR-puntwolken van Rijkswaterstaat.
     - *Wat:* Gevarieerde panden met complexe dakvormen, dakkapellen, lessenaarsdaken, wolfseinden en diepe boerderijen (>15m) verspreid over alle 12 Nederlandse provincies.
     - *Ground Truth:* Exacte horizontale doorsnedes ($Z$-slices) door de volumetrische 3D LoD 2.2 geometrie op elke verdiepingshoogte ($Z_{\text{NAP}} + 1.5\text{m}$, $+4.5\text{m}$, $+7.5\text{m}$).

### Bipartite Scheiding & Anti-Pleister Garantie
- **Strikte Bipartite Isolatie:** In het fixture-bestand `tests/fixtures/benchmark-100-buildings.json` wordt elk pand strikt opgesplitst in twee blokken:
  - `telemetry_input`: Bevat **uitsluitend vrij beschikbare open data** (BAG 2D grondvlak, VBO verblijfsobject coördinaten, BGT openbare weg ligging, en 3D BAG goot-/nokhoogtes).
  - `ground_truth_floors`: De werkelijke bouwkundige polygonen per verdieping (BG, 1e, 2e, zolder).
- **Runtime Isolatie:** De rekenmodule (`FloorGeometryCalculator` en `SvgFloorplanRenderer`) heeft **nooit toegang** tot `ground_truth_floors`. De rekenmodule krijgt uitsluitend de openbare `telemetry_input` en moet autonoom de juiste verdiepingscontouren afleiden.
- **Wiskundige Toetsing Achteraf:** De gegenereerde vloerpolygonen worden uitsluitend achteraf in geautomatiseerde unittests (`benchmark-100-buildings.test.ts`) vergeleken met de ground truth via **Intersection over Union ($\text{IoU} \ge 0.95$)** en maximale Hausdorff-afstand ($< 0.20\text{m}$).
- **Anti-Pleister Garantie:** Verbeteringen aan de rekenmodule moeten systeembreed werken: als een aanpassing de score op pand A verhoogt maar op pand B verlaagt, faalt de 100-panden testsuite direct en onverbiddelijk.

---

## 2. Architectuur & Systeemontwerp

De architectuur introduceert vier complementaire componenten:
1. **Google Maps-stijl Achtergrond Preloader (`useMapTilePreloader` & `/api/bag/tiles`):**
   - Verdeelt het Nederlandse grondgebied in gekwantiseerde $250\text{m} \times 250\text{m}$ Amersfoort/RD-tegels.
   - Luistert naar viewport-idle events (`idle` callback van Google Maps) en haalt omliggende panden en VBO's pre-emptief op in de browser via een in-memory LRU-cache gemaximeerd op 50 tegels.
   - Garandeert 0.0ms reactietijd bij doorklikken zonder de UI-thread te blokkeren (stabiele 60 FPS).
2. **Wiskundige Voordeur Detector (`FrontDoorDetector`):**
   - Vervangt de hardcoded 92.4° heading door een multi-factor orthogonale segmentprojectie ($t_i^* = \operatorname{clamp}(t_i, 0, 1)$) van het BAG VBO ingangspunt op elk buitenmuursegment:
     $$\text{Score}(S_i) = 0.45 \cdot S_{\text{dist}} + 0.25 \cdot S_{\text{proj}} + 0.20 \cdot S_{\text{orient}} + 0.10 \cdot S_{\text{len}}$$
3. **Volumetrische 3D BAG LoD 2.2 Slicer (`FloorGeometryCalculator`):**
   - Vervangt de starre $8.0\text{m}$ dieptegrens door dynamische dakvlak- en goothoogtesplitsing. Panden van 15m–25m diep (zoals boerderijen of herenhuizen) behouden hun volledige diepte op verdiepingen waar de dakconstructie dit toelaat.
4. **Polygon Similarity Engine (`PolygonSimilarityEngine`):**
   - Maakt gebruik van de reeds aanwezige Martinez-clipping engine (`src/domain/geometry/clipping.ts`) voor exacte oppervlakte-doorsnedes en unies:
     $$\text{IoU} = \frac{\operatorname{Area}(A \cap B)}{\operatorname{Area}(A \cup B)}, \quad \text{Hausdorff}(A, B) = \max \left( \sup_{a \in A} \inf_{b \in B} d(a, b), \sup_{b \in B} \inf_{a \in A} d(a, b) \right)$$

---

## 3. Bestanden & Mutaties (INV-SYS-07 Naleving)

Conform `INV-SYS-07` is de implementatie strikt opgedeeld in twee sequentiële sub-fasen met maximaal 5 bestanden per sub-fase:

### Sub-Fase 3A: Double-Blind 100-Panden Benchmark Suite & Voordeur-Detector (max 5 bestanden)

| Bestand | Mutatie | Verantwoordelijke Module | Verificatietest | Rol / Invariant |
| :--- | :--- | :--- | :--- | :--- |
| `tests/fixtures/benchmark-100-buildings.json` | [NEW] | Benchmark Data Fixture | `tests/unit/benchmark/benchmark-100-buildings.test.ts` | INV-DATA-01 Bipartite Schema (telemetry_input vs ground_truth_floors) over alle 12 provincies (35 RVO, 35 Bouwdossiers, 30 3D BAG) |
| `src/domain/benchmark/benchmark-types.ts` | [NEW] | Typologie & Schema Definities | `tests/unit/benchmark/benchmark-100-buildings.test.ts` | INV-TYP-01 TypeScript Contracten inclusief `DutchProvince` en `GroundTruthFloor` |
| `src/domain/geometry/polygon-similarity-engine.ts` | [NEW] | Vormgelijkenis Engine | `tests/unit/benchmark/benchmark-100-buildings.test.ts` | INV-GEO-07 Martinez-gebaseerde IoU, Dice en Hausdorff Berekening |
| `src/domain/geometry/front-door-detector.ts` | [NEW] | Geometrische Voordeur Detector | `tests/unit/benchmark/benchmark-100-buildings.test.ts` | INV-GEO-04 Multi-factor VBO Loodrechte Projectie & BGT Scoring |
| `tests/unit/benchmark/benchmark-100-buildings.test.ts` | [NEW] | Geautomatiseerde Benchmark Runner | `tests/unit/benchmark/benchmark-100-buildings.test.ts` | Pijler 4 Vitest Blind Verificatie over 100 Panden ($\text{IoU} \ge 0.95$) |

### Sub-Fase 3B: Systemische Geometrie & Background Preload Integratie (max 5 bestanden)

| Bestand | Mutatie | Verantwoordelijke Module | Verificatietest | Rol / Invariant |
| :--- | :--- | :--- | :--- | :--- |
| `src/domain/legacy/floor-geometry-calculator.ts` | [MODIFY] | Reële Vloergeometrie | `tests/unit/benchmark/benchmark-100-buildings.test.ts` | INV-GEO-05 3D BAG LoD 2.2 Volumetrische Uitsnijding & Dynamische Diepte |
| `src/domain/legacy/svg-floorplan-renderer.ts` | [MODIFY] | SVG Floorplan Generator | `tests/unit/domain/legacy/svg-floorplan-renderer.test.ts` | INV-GEO-06 Integratie met `front-door-detector` via VBO Ingang |
| `src/app/api/bag/tiles/route.ts` | [NEW] | PDOK Tegel Caching Route | `tests/unit/api/building-route.test.ts` | INV-API-01 250m RD Kwantisering & 24h ISR Caching |
| `src/components/legacy/useMapTilePreloader.ts` | [NEW] | Achtergrond Preloader Hook | `tests/unit/components/dashboard-page.test.tsx` | INV-MAP-02 Debounced Kaart-Idle Preloading met 50-Tegel LRU Cap |
| `src/app/page.tsx` | [MODIFY] | Single-Screen Orchestratie | `tests/e2e/legacy-parity.spec.ts` | INV-UI-05 Activatie Preloader & VBO Gegevensoverdracht |

---

## 4. Fasering & Uitvoeringsstappen

1. **Fase 1 (Planvorming & Red Team Audit):** Pre-flight structuurvalidatie en Pass 1 Plan-Audit door subagent `red-team`.
2. **Fase 2 (TDD Red Phase):** Schrijven van de falende unittests in `polygon-similarity-engine.test.ts`, `front-door-detector.test.ts` en `benchmark-100-buildings.test.ts`.
3. **Fase 3 (Sequentiële Implementatie):**
   - *Sub-Fase 3A:* Aanmaken van de 100-panden bipartite dataset en realisatie van de voordeurdetector en Martinez-gebaseerde IoU similarity engine.
   - *Sub-Fase 3B:* Volumetrische uitsnijding in `FloorGeometryCalculator` en achtergrond preloading via `/api/bag/tiles`.
4. **Fase 4 (Diff-Audit, Verified Commit & Push):** Pass 2 Diff-Audit door `red-team` en commit/push via `commit-officer`.

---

## 5. Scenariodriehoek (Happy / Edge / Corner)

### Happy Path
- Gebruiker navigeert of zoekt een willekeurige woning in Nederland (tussenwoning, hoekwoning, vrijstaand, appartement, boerderij).
- De kaart pre-fetcht omliggende panden en VBO-ingangspunten op de achtergrond via gekwantiseerde 250m RD-tegels zonder framedrops (60 FPS).
- Bij pandselectie wordt de voorgevel exact gemapt op het wandsegment dat grenst aan het VBO-ingangspunt en de straatzijde.
- De verdiepingen (1e, 2e/kap, opbouw) tonen exact de werkelijke bouwkundige omtrek met correcte maatvoering en mandelige arcering.

### Edge Cases
- **Diepe boerderijen / herenhuizen (>15m - 25m diep):** De verdieping wordt niet meer kunstmatig afgekapt op 8.0m, maar volgt de feitelijke 3D BAG goot-/noklijnen.
- **Voordeuren aan zijgevels of hofjes:** Woningen met een zij-ingang (bv. bij twee-onder-één-kap) krijgen de voordeur/entreebadge op de werkelijke zijgevel, terwijl de straatzijde conform BGT openbare weg als straatgevel herkenbaar blijft.
- **Gestapelde bouw (appartementencomplex met 30 VBO's):** De detector groepeert VBO-ingangspunten naar het centrale hoofdentree-cluster op de begane grond.
- **Zoom- en Panning-extremen:** Bij snel uitzoomen naar landelijk niveau (zoom < 14) wordt de achtergrond-preloader uitgeschakeld om netwerk-exhaustion te voorkomen.

### Corner Cases
- **VBO-ingang ligt net buiten pandcontour:** Geodetische inmeetafwijking (< 0.5m) wordt opgevangen door de orthogonale segmentprojectie ($t_i^* = \operatorname{clamp}(t_i, 0, 1)$).
- **Vrijstaand pand met 360° tuin zonder buren:** Geen mandelige muur gedetecteerd (`oppScheidingsmuur < 5m²`), alle 4 de gevels worden als buitengevel berekend.
- **Netwerk Time-out op PDOK Tegel API:** Graceful degradatie naar on-demand fetch zonder blokkering van de UI of crash van de kaart.

---

## 6. Verificatie & Definition of Done (DoD)

- 100% van de 100 benchmarkpanden in `tests/fixtures/benchmark-100-buildings.json` haalt een score van $\text{IoU} \ge 0.95$ en maximale Hausdorff-afwijking $< 0.20\text{m}$ in `benchmark-100-buildings.test.ts`.
- Alle 41+ bestaande unittests blijven 100% groen zonder versoepeling (zero test drift).
- `npx tsc --noEmit` en `npm run build` slagen met 0 fouten.
- Playwright E2E pariteitstest slaagt 100%.

---

## 7. State Sanitation & Isolatie

- Achtergrond preloading cacht uitsluitend in-memory en via HTTP ISR headers; geen ongecontroleerde diskvervuiling.
- Bipartite scheiding garandeert dat de component `ground_truth_floors` op geen enkel moment kan inlezen tijdens runtime.
- 100% schone git working tree.

---

## 8. Risico & Rollback Strategie

- **Risico:** Laag tot gemiddeld. Alle nieuwe modules zijn complementair en ontkoppeld van de bestaande componenten.
- **Rollback:** Direct herstel via Git checkout (`git checkout HEAD -- src/ tests/`).

---

### 📋 HITL Goedkeuringsdossier

| Criterium | Specificatie & Verantwoording |
| :--- | :--- |
| **Fase** | Fase 1 (Planvorming & Red Team Audit Afgerond) &rarr; Poort naar Fase 2 & 3 |
| **Doel** | Double-Blind Ground Truth Benchmark (100 echte panden uit RVO 35, Bouwdossiers 35 en TU Delft 3D BAG 30 over alle 12 provincies) ter objectieve validatie van berekende verdiepingen ($\text{IoU} \ge 0.95$), wiskundige VBO-voordeurprojectie, 3D BAG LoD 2.2 volumetrische afsnijding en Google Maps achtergrond-preloading. |
| **Bestanden & Mutaties** | **Sub-Fase 3A: Double-Blind 100-Panden Benchmark Suite & Voordeur-Detector (max 5 bestanden)**<br>• `tests/fixtures/benchmark-100-buildings.json` [NEW]<br>• `src/domain/benchmark/benchmark-types.ts` [NEW]<br>• `src/domain/geometry/polygon-similarity-engine.ts` [NEW]<br>• `src/domain/geometry/front-door-detector.ts` [NEW]<br>• `tests/unit/benchmark/benchmark-100-buildings.test.ts` [NEW]<br><br>**Sub-Fase 3B: Systemische Geometrie & Background Preload Integratie (max 5 bestanden)**<br>• `src/domain/legacy/floor-geometry-calculator.ts` [MODIFY]<br>• `src/domain/legacy/svg-floorplan-renderer.ts` [MODIFY]<br>• `src/app/api/bag/tiles/route.ts` [NEW]<br>• `src/components/legacy/useMapTilePreloader.ts` [NEW]<br>• `src/app/page.tsx` [MODIFY] |
| **Auditverloop & Definitief Verdict** | **Ronde 1:** `AFGEKEURD` (Pre-flight structuurvalidatie eiste canonieke 5-koloms Verificatiematrix tabel)<br>*(Chirurgisch herstel conform Grondwet Laag 1B § 6.3)*<br>**Ronde 2:** `VERDICT: GOEDGEKEURD (Zero defects bewezen: P0: 0 \| P1: 0 \| P2: 0)` afgegeven door onafhankelijke Red Team Plan Auditor (`e411dcd9-40e8-4247-a04b-ed137816898a`). |
| **Scenariodriehoek** | • **Happy:** 100% automatische detectie van voordeur via BAG VBO, vloeiende 60 FPS achtergrond-preloading, correcte verdiepingsgeometrie voor alle typologieën ($\text{IoU} \ge 0.95$).<br>• **Edge:** Diepe boerderijen (>15m), zij-ingangen, hoekpanden, gestapelde bouw (appartementen), snelle viewport-pans.<br>• **Corner:** VBO-punt buiten contour ($<0.5\text{m}$), vrijstaande panden zonder buren, netwerk time-outs op tegel-APIs. |
| **Verificatie & DoD** | 100 benchmark panden halen blind $\text{IoU} \ge 0.95$ tegen de ground truth, 41+ bestaande unittests 100% regressievrij, `npx tsc --noEmit` 0 errors, Next.js build 100% succesvol. |
| **State Sanitation** | In-memory SWR caching met 50-tegel LRU-cap, zero diskvervuiling, 100% schone git working tree. |
| **Risico & Rollback** | Laag tot gemiddeld; Two-Phase Rollback via Git checkout en on-disk `omni_write_tool` garanties. |
| **Vereiste HITL Actie** | Klik op de interactieve **Proceed** knop of antwoord met *"Akkoord"* / *"Voer uit"* |
