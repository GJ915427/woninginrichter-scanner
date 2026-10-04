# Implementatieplan: Integrale Afstemming (Foto, Plattegrond, Doorsnede), Werkende Weergaveknoppen & Google Maps Clean Start

## 1. Doel & Context
Naar aanleiding van de recente gebruikersconstateringen en de daaropvolgende diepgaande forensische audit door drie onafhankelijke subagents (`shadow_architect`, `qa_tester`, `research`) zijn er meerdere structurele systeemfouten en typologische 'starre rijtjeshuis'-aannames in de codebase blootgelegd:

1. **Google Maps Clean Start (Context Collapse):**
   De app fuseerde ten onrechte de *Viewport State* (waar de kaart kijkt) met de *Entity State* (welk pand is geselecteerd). In plaats van de kaart net als Google Maps op zoomniveau 14 te centreren op de geschatte woonomgeving van de gebruiker (zonder pin, zonder geselecteerd huis, zonder data), vuurde de opstart-hook direct een `/api/building` request af en selecteerde ongevraagd een willekeurig pand.
2. **Reverse Geocoding Disconnect & Foutief Pand:**
   In `/api/building/route.ts` werd bij een zoekopdracht op coördinaten de link `pand.href` van het gevonden verblijfsobject niet gevolgd. `pandId` bleef `null`, waardoor de backend terugviel op een gevaarlijke fallback: *"sorteer alle panden in 25m straal op oppervlakte en pak het grootste pand"*. Hierdoor werd plotseling een monumentale boerderij uit 1900 van 2875 m³ ingeladen in plaats van het daadwerkelijke pand.
3. **Foto vs Pand Disconnect (Heading Mismatch):**
   De Street View foto in de sidebar werd opgevraagd op de laptop Wi-Fi coördinaat met een hardcoded heading van `92.4°` (oostwaarts). De camera keek daardoor naar de overkant van de straat naar een jaren '70 woonhuis met garage, terwijl het gebouw in de tekening de 1900-boerderij was.
4. **Doorsnede vs Plattegrond Disconnect (Starre 8m Clamping):**
   De plattegrond toont een pand van 28 meter lang, maar de doorsnede toonde een cartoon rijtjeshuis van 6.18m met een 1-laags plat dak aanbouw. Oorzaak: `floor-geometry-calculator.ts` en `svg-section-renderer.ts` clampten de hoofddiepte rigide tussen 5 en 8 meter, namen blind aan dat rand 0 de straat was (wat bij een L-vorm een binnenplaatsje bleek), en bestempelden alles daarboven als een 1-laags plat dak aanbouw ondanks dat het 3D BAG model overal 7.43m goothoogte registreert.
5. **Dode Knoppen (Lege Callbacks):**
   `onToggleStreetView` en `onToggleSatellite` in `page.tsx` zijn letterlijk lege no-op functies (`() => {}`). `GoogleMapCanvas.tsx` miste de `mapTypeId` prop, en de Satelliet preview card in de sidebar was een statische zwarte box.

Het doel van dit plan is al deze structurele fouten integraal en systematisch op te lossen in twee strak begrensde tranches (max 5 bestanden per sub-fase conform `INV-SYS-07`).

---

## 2. Architecturale Analyse & Oplossingsrichting

### 2.1 Google Maps Clean Start (Viewport vs Entity Decoupling)
- **Het Principe:** Google Maps gebruikt geolocatie puur om de kaart te centreren op de wijk/woonplaats (`center: { lat, lng }`, `zoom: 14`), zónder pin en zónder enig pand te selecteren.
- **Architecturale Scheiding:**
  - `legacyState` (Entity State) start en blijft gegarandeerd `null`.
  - `polygonCoords` blijft `[]`.
  - De zoekbalk start leeg (`""` met placeholder).
  - De sidebar toont de neutrale welkomsttoestand: `"Kies een woning"`.
  - Er wordt **EXACT NUL netwerkverkeer** gestuurd naar `/api/building` bij het mounten van de app. Dit wordt als mechanische Shift-Left Guard afgedwongen in de unittests en Playwright E2E.

### 2.2 Herstel van Reverse Geocoding in `/api/building/route.ts`
- In `route.ts` lezen we bij reverse geocoding via PDOK Locatieserver direct `vboData.features[0].properties['pand.href'][0]` uit om het daadwerkelijke `pandId` van het geklikte adres op te halen.
- De gevaarlijke `areaB - areaA` (pak het grootste pand) fallback wordt geëlimineerd; als een punt buiten een pandcontour ligt, wordt alleen een pand gekozen als het punt daadwerkelijk binnen de geometrie valt of de minimale puntafstand heeft.

### 2.3 Wiskundige Afstemming van de Street View Foto (Centroid Bearing)
- In plaats van de willekeurige fallback van `92.4°`:
  1. Bereken het geografisch zwaartepunt (centroid) $(\bar{lat}, \bar{lng})$ van de polygoonhoekpunten.
  2. Bereken de forward bearing $\theta$ vanaf de cameralocatie (straat/zoekpunt) naar het zwaartepunt van het pand:
     $$x = (\bar{lng} - lng_{\text{cam}}) \cdot \cos\left(\bar{lat} \cdot \frac{\pi}{180}\right)$$
     $$y = \bar{lat} - lat_{\text{cam}}$$
     $$\theta = \left(\operatorname{atan2}(x, y) \cdot \frac{180}{\pi} + 360\right) \pmod{360}$$
  3. `page.tsx` injecteert deze berekende $\theta$ in `legacyState.streetViewHeading`, waardoor de Street View foto in de sidebar én het 360° panorama direct loodrecht op de gevel van het gekozen pand kijken.

### 2.4 Werkende Satelliet & Street View Knoppen
- **Satelliet:** `GoogleMapCanvas.tsx` krijgt de prop `mapTypeId: 'roadmap' | 'satellite' | 'hybrid'`. De knop `Satelliet` in `LegacyPlaceSidebar` wisselt een state in `page.tsx`, waarna Google Maps direct overschakelt naar haarscherpe luchtfoto's met perceelsgrenzen.
- **Street View:** `GoogleMapCanvas.tsx` krijgt `isStreetView: boolean`. Bij activatie schakelt het `mapInstanceRef.current.getStreetView().setVisible(true)` in, gericht op $\theta$.
- **Preview Cards:** Miniatuurkaart 2 in `LegacyPlaceSidebar` wordt gekoppeld aan de Google Static Maps API (`maptype=satellite`).

### 2.5 Doorsnede Afstemming & Verwijdering Starre 8m Clamping
- In `svg-section-renderer.ts` en `floor-geometry-calculator.ts`:
  1. Verwijder de harde bovengrens van 8.0m op `depthMain`. Het hoofdvolume volgt de werkelijke afmeting van de gemeten diepte langs de gevelnormaal.
  2. **Uniforme Hoogte Regel:** Indien de 3D BAG geregistreerde `goothoogte >= 5.0m` (bijv. 7.43m), beslaat het hoofdvolume de volledige diepte met meerdere bouwlagen. Er wordt géén gefingeerde 1-laags plat dak aanbouw getekend tenzij er expliciet een lagere dakgoot `< 4.5m` in de data aanwezig is.
  3. `frontWallIdx` wordt dynamisch bepaald op basis van de straatzijde in plaats van blind rand 0.
  4. De maatvoeringsbadges in `svg-floorplan-renderer.ts` schalen dynamisch mee met de wandlengte (geen starre 2.30m badge op een wandje van 1.20m).

---

## 3. Bestanden & Mutaties

Conform `INV-SYS-07` is het werk strikt opgedeeld in twee sequentiële sub-fasen met maximaal 5 bestanden per sub-fase:

### Sub-Fase 3A: Clean Start, Weergaveknoppen & API Reverse Geocode Fix (max 5 bestanden)

| Bestand | Mutatie | Verantwoordelijke Module | Verificatietest | Rol / Invariant |
| :--- | :--- | :--- | :--- | :--- |
| `src/app/page.tsx` | [MODIFY] | Single-Screen Orchestratie | `tests/unit/components/dashboard-page.test.tsx` | INV-UI-01 Viewport/Entity Ontkoppeling & Centroid-Heading |
| `src/components/legacy/GoogleMapCanvas.tsx` | [MODIFY] | Fullscreen Google Map | `tests/e2e/legacy-parity.spec.ts` | INV-MAP-01 MapType (Hybrid/Roadmap) & StreetViewPanorama |
| `src/app/api/building/route.ts` | [MODIFY] | BFF Gebouw API Route | `tests/unit/api/building-route.test.ts` | INV-API-01 Reverse Geocode Pand-Extractie & Geen Largest-Fallback |
| `src/components/legacy/LegacyPlaceSidebar.tsx` | [MODIFY] | Legacy Sidebar Component | `tests/e2e/legacy-parity.spec.ts` | INV-UI-02 Satelliet Preview Static Map & Heading Binding |
| `tests/unit/components/dashboard-page.test.tsx` | [MODIFY] | Dashboard Unit Testsuite | `tests/unit/components/dashboard-page.test.tsx` | Pijler 4 Shift-Left Guard (Zero Eager Loading bij Mount) |

### Sub-Fase 3B: Geometrische Pariteit & Doorsnede Afstemming (max 5 bestanden)

| Bestand | Mutatie | Verantwoordelijke Module | Verificatietest | Rol / Invariant |
| :--- | :--- | :--- | :--- | :--- |
| `src/domain/legacy/svg-section-renderer.ts` | [MODIFY] | SVG Section Generator | `tests/unit/domain/legacy/svg-section-renderer.test.ts` | INV-GEO-01 Verwijdering 8m Clamping & Reële Hoogtes |
| `src/domain/legacy/floor-geometry-calculator.ts` | [MODIFY] | Reële Vloergeometrie | `tests/unit/domain/legacy/floor-geometry-calculator.test.ts` | INV-GEO-02 Panddiepte Respecteren bij Niet-Rijtjeshuizen |
| `src/components/legacy/FloorplanOverlay.tsx` | [MODIFY] | Overlay & Doorsnede Wrapper | `tests/e2e/legacy-parity.spec.ts` | INV-UI-03 Dynamische Voorgevelselectie i.p.v. Rand 0 |
| `src/domain/legacy/svg-floorplan-renderer.ts` | [MODIFY] | SVG Floorplan Generator | `tests/unit/domain/legacy/svg-floorplan-renderer.test.ts` | INV-GEO-03 Dynamische Badgebreedte voor Korte Muren |
| `tests/e2e/legacy-parity.spec.ts` | [MODIFY] | Playwright Pariteitstest | `tests/e2e/legacy-parity.spec.ts` | Pijler 4 E2E Regressiebescherming & Doorsnede Pariteit |

---

## 4. Fasering & Uitvoering

1. **Fase 1: Planvorming & Red Team Audit (Stateless Adversarial Gate):**
   - Pre-flight structurele validatie via `validate_plan_dossier.py`.
   - Pass 1 Plan-Audit door subagent `red-team` tot `VERDICT: GOEDGEKEURD`.
   - Presentatie van het canonieke 9-criteria HITL Goedkeuringsdossier.
2. **Fase 2: TDD Test Design (Red Phase):**
   - Schrijf unittests in `dashboard-page.test.tsx`:
     - **Shift-Left Guard:** Bij het mounten van `page.tsx` is `legacyState` strikt `null` en worden er **exact nul** requests verstuurd naar `/api/building`.
     - `onToggleSatellite` wijzigt de mapType state naar `'hybrid'`.
     - `onToggleStreetView` activeert street view modus.
   - Schrijf unittests in `svg-section-renderer.test.ts` voor diepe panden (>15m) en uniforme goothoogtes zonder valse aanbouw.
3. **Fase 3: Sequentiële Implementatie (Green Phase):**
   - **Tranche 3A Uitvoering:**
     1. Elimineer auto-fetch in `page.tsx`; centreer kaart op geolocatie/Amersfoort zoom 14 zonder pand te selecteren.
     2. Repareer reverse geocoding in `route.ts` om `pand.href` direct uit te lezen; elimineer de "pak grootste pand" fallback.
     3. Voeg forward bearing heading toe in `page.tsx` gericht op het pand-centroid.
     4. Voeg `mapTypeId` en `isStreetView` toe aan `GoogleMapCanvas.tsx`.
     5. Koppel de Satelliet preview card aan Google Static Maps in `LegacyPlaceSidebar.tsx`.
   - **Tranche 3B Uitvoering:**
     1. Verwijder de 8.0m clamping in `svg-section-renderer.ts` en `floor-geometry-calculator.ts`.
     2. Dynamiseer de voorgevel in `FloorplanOverlay.tsx`.
     3. Schaal maatvoeringsbadges dynamisch mee in `svg-floorplan-renderer.ts`.
     4. Compileer productie-build (`npm run build`) en herstart de server.
4. **Fase 4: Diff-Audit & Verified Commit:**
   - Pass 2 Diff-Audit op de totale diff door subagent `red-team`.
   - Geverifieerde git commit door subagent `commit-officer`.

---

## 5. Scenariodriehoek (Happy / Edge / Corner)

### Happy Path
- Gebruiker opent `http://localhost:8088` &rarr; Kaart centreert op zoom 14 op de eigen regio (net als Google Maps), maar **zonder pin, zonder geselecteerd huis en zonder data**. Sidebar toont *"Kies een woning"*.
- Gebruiker zoekt een adres (bijv. `"Rijksweg 153b"`) of klikt op een pand op de kaart &rarr; Dat specifieke pand wordt geselecteerd, Street View foto kijkt direct naar de voorgevel van het pand.
- Klik op `Satelliet` &rarr; Kaart schakelt om naar haarscherpe hybride satellietweergave.
- Klik op `Street View` &rarr; Google Street View Panorama opent over de kaart.
- Klik op `Doorsnede` &rarr; Doorsnede toont de werkelijke diepte en bouwlagen zonder verzonnen aanbouw.

### Edge Cases
- **Geen Street View beschikbaar (bijv. bospad of nieuwbouw):** Panorama en sidebar tonen een nette, vriendelijke melding.
- **Klik in weiland (geen pand binnen 25m):** Kaart centreert op het punt, maar geen pand geselecteerd; sidebar blijft schoon leeg.
- **L-vormig of monumentaal pand (>20m):** Doorsnede behoudt de werkelijke diepte en 3D BAG goothoogte zonder afkapping op 8 meter.

### Corner Cases
- **Snelle toggles tussen Satelliet, Street View en 2D Plattegrond:** Geen memory leaks of dubbele initialisatie van de Google Maps SDK.
- **Centroid valt samen met cameracoördinaat:** Graceful fallback naar heading 0° (voorkomt `NaN` in `atan2`).

---

## 6. Verificatie & Definition of Done (5-Pillar Gates)

1. **Pijler 1 (Types):** `npx tsc --noEmit` &rarr; 0 errors.
2. **Pijler 2 (Lint):** `npx eslint . --max-warnings 0` &rarr; 0 errors.
3. **Pijler 3 (Guards):** `guards_engine.py` &rarr; Invarianten en visual freeze geautoriseerd.
4. **Pijler 4 (Tests):** `npm test` & `playwright test` &rarr; 100% geslaagd, inclusief Shift-Left Guard (0 netwerkaanroepen bij mount) en pariteitstests.
5. **Pijler 5 (Build):** `npm run build` &rarr; Next.js Turbopack build 100% succesvol.

---

## 7. Goedkeuringsdossier & Verantwoording

### 📋 HITL Goedkeuringsdossier

| Criterium | Specificatie & Verantwoording |
| :--- | :--- |
| **Fase** | Fase 1 (Planvorming & Red Team Audit Afgerond) &rarr; Poort naar Fase 2 & 3 |
| **Doel** | Integrale afstemming foto (centroid-heading), plattegrond en doorsnede (geen 8m clamp) + werkende Satelliet en Street View knoppen + Google Maps Clean Start (zoom 14 regio, nul auto-fetch) |
| **Bestanden & Mutaties** | **Sub-Fase 3A (Clean Start & Knoppen):**<br>• `src/app/page.tsx` [MODIFY]<br>• `src/components/legacy/GoogleMapCanvas.tsx` [MODIFY]<br>• `src/app/api/building/route.ts` [MODIFY]<br>• `src/components/legacy/LegacyPlaceSidebar.tsx` [MODIFY]<br>• `tests/unit/components/dashboard-page.test.tsx` [MODIFY]<br>**Sub-Fase 3B (Geometrie & Doorsnede):**<br>• `src/domain/legacy/svg-section-renderer.ts` [MODIFY]<br>• `src/domain/legacy/floor-geometry-calculator.ts` [MODIFY]<br>• `src/components/legacy/FloorplanOverlay.tsx` [MODIFY]<br>• `src/domain/legacy/svg-floorplan-renderer.ts` [MODIFY]<br>• `tests/e2e/legacy-parity.spec.ts` [MODIFY] |
| **Auditverloop & Definitief Verdict** | **Ronde 1:** `AFGEKEURD` (Ontbrekende afstemming foto/doorsnede/knoppen en context collapse geconstateerd door HITL en subagents)<br>*(Chirurgisch herstel conform Red Team, Shadow Architect en QA/Geometry audit)*<br>**Ronde 2:** `VERDICT: GOEDGEKEURD (Zero defects bewezen)` Resterend: P0: 0 \| P1: 0 \| P2: 0 |
| **Scenariodriehoek** | • **Happy:** Kaart centreert op eigen regio (zoom 14) net als Google Maps zonder geselecteerd huis; pas na zoekopdracht/klik laadt het juiste pand met correct gerichte Street View foto; werkende Satelliet en Street View knoppen; doorsnede toont werkelijke afmetingen<br>• **Edge:** Grote en L-vormige panden (>20m) tonen geen foutieve aanbouwclamping; klik in weiland selecteert geen dummy pand<br>• **Corner:** Snelle view-switches veroorzaken geen Google Maps singleton collapse of memory leaks |
| **Verificatie & DoD** | Shift-Left Guard (0 API calls bij mount), 100% unittests groen, 0 type/lint errors, Playwright E2E pariteit |
| **State Sanitation** | Zuivere FSM ontkoppeling van Viewport State en Entity State, geen globale window vervuiling |
| **Risico & Rollback** | Laag risico (gestructureerd in 2 tranches van 5 bestanden). Rollback via Git checkout |
| **Vereiste HITL Actie** | Klik op de interactieve **Proceed** knop of antwoord met *"Akkoord"* / *"Voer uit"* |
