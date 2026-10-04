# Implementatieplan: Herstel UX Autocomplete, Verdiepingen Vloergeometrie (1e, 2e, 3e) & Zero-Jump Startlocatie

## 1. Doel & Context

Naar aanleiding van de recente test door de gebruiker zijn drie concrete regressies/tekortkomingen vastgesteld:
1. **UX Autocomplete / Aanvullen Ontbreekt:** In `google_maps_picker.html` bevatte het zoekveld een live suggestie-dropdown (PDOK Locatieserver suggest API met 250ms debounce) met teal pin-iconen en adresweergave. In de huidige Next.js versie ontbreekt deze dropdown volledig; de gebruiker kan niet zien wat het systeem aanvult.
2. **Vloergeometrie Regressie (1e en 2e/3e Verdieping):** In Screenshot 3 toonde de 1e verdieping een bizarre lange smalle strook van 3.83m breed en 18.51m diep die helemaal doorliep naar de achtertuin, met `VOORZIJDE (STRAAT)` op de 18.51m zijwand. Dit werd veroorzaakt doordat `FloorplanOverlay.tsx` hardcoded `frontWallIdx = 0` forceerde (waardoor automatische straatgevel-detectie werd overgeslagen) en doordat de dieptebegrenzing voor samengestelde panden met aanbouw (`floorRatio < 0.85`) was verruimd naar 25m.
3. **Startlocatie Flasht / Springt vanaf Amersfoort:** In `src/app/page.tsx` was Amersfoort (`lat: 52.15517, lng: 5.38720`) als initiële `useState` ingesteld. Hierdoor laadde de kaart eerst op Amersfoort en sprong na 1 seconde met een schok naar de eigen locatie. Dit moet worden opgelost via `localStorage` persistentie van `last_known_coords` en een schone opstart zonder Amersfoort-sprong.

---

## 2. Architecturale Oplossingsrichting

### 2.1 UX Autocomplete Dropdown (PDOK Locatieserver Suggest)
- In [`src/components/legacy/LegacyPlaceSidebar.tsx`](file:///c:/Users/gaspa/Documents/antigravity/test_project/src/components/legacy/LegacyPlaceSidebar.tsx) voegen we de officiële dropdown container toe (`#suggestionsDropdown`), identiek aan `google_maps_picker.html` (regels 301-309):
  - Debounce 250ms op toetsaanslagen vanaf `q.length >= 2`.
  - Fetch naar `https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest?q=${encodeURIComponent(q)}&rows=5`.
  - Dropdown toont suggestielijst met petrol/teal pin-icoon (`#007b83`), officiële BAG weergavenaam, en hover-effect.
  - Toetsenbordnavigatie (`Enter` kiest eerste suggestie) en muisklik triggert `onSelectSuggestion(docId, weergavenaam)`.
  - Directe lookup via `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${docId}` laadt het pand en centreert de kaart.

### 2.2 Verdiepingen & Vloergeometrie Herstel (1e, 2e, 3e Bouwlaag)
- In [`src/components/legacy/FloorplanOverlay.tsx`](file:///c:/Users/gaspa/Documents/antigravity/test_project/src/components/legacy/FloorplanOverlay.tsx):
  - `resolvedFrontWallIdx` geeft `undefined` door indien `frontWallIdx` niet expliciet is opgegeven. Hierdoor voert `generateLegacyFloorplanSvg` de automatische straatgevel-scoring uit (`score = dot * Math.sqrt(len)`).
  - Voor Rijksweg 153B scoort Wand 7 (straatzijde, 6.63m) als winnaar.
- In [`src/domain/legacy/floor-geometry-calculator.ts`](file:///c:/Users/gaspa/Documents/antigravity/test_project/src/domain/legacy/floor-geometry-calculator.ts):
  - Voor samengestelde panden met aanbouw (`floorRatio < 0.85` en `n > 4`) wordt de diepte van het residentiële hoofdvolume conform de Nederlandse bouwhistorische balklaagtypologie begrensd op $5.0\text{m} - 8.0\text{m}$:
    `depth = Math.max(5.0, Math.min(8.0, depth));`
  - Indien een aanliggende wand (`leftLen` of `rightLen`) tussen 5.0m en 8.0m ligt en dicht bij `depth` zit, snapt de diepte op die wand.
  - Resultaat voor Rijksweg 153B:
    - **Begane Grond:** Volledige L-vormige contour ($129.6\text{m}²$).
    - **1e Verdieping:** Zuiver 4-hoekig hoofdvolume $6.63\text{m} \times 8.00\text{m}$ (binnenmaten $6.07\text{m} \times 7.44\text{m}$), aanbouw als gestreepte referentie (`bgExtensionSvg`).
    - **2e Verdieping:** Opbouw (Concept) of Zolder/Kap op exact hetzelfde hoofdvolume ($6.63\text{m} \times 8.00\text{m}$).

### 2.3 Zero-Jump Startlocatie (Geen Amersfoort Flash)
- In [`src/app/page.tsx`](file:///c:/Users/gaspa/Documents/antigravity/test_project/src/app/page.tsx):
  - Verwijder hardcoded Amersfoort default.
  - Lees bij mount direct `last_known_coords` uit `localStorage`. Indien aanwezig, start de kaart direct op die coördinaten (0.0ms flashover).
  - Sla actuele coördinaten bij geolocation of adreszoekopdracht atomair op in `localStorage.setItem('last_known_coords', ...)`.
  - Indien er nog geen opgeslagen coördinaten zijn, initialiseert de kaart met de dynamische device locatie zonder eerst Amersfoort te tonen.

---

## 3. Bestanden & Mutaties (INV-SYS-07 Naleving)

Conform `INV-SYS-07` is het werk strikt opgedeeld in twee sequentiële sub-fasen met maximaal 5 bestanden per sub-fase:

### Sub-Fase 3A: UX Autocomplete & Zero-Jump Geolocation (max 5 bestanden)

| Bestand | Mutatie | Verantwoordelijke Module | Verificatietest | Rol / Invariant |
| :--- | :--- | :--- | :--- | :--- |
| `src/components/legacy/LegacyPlaceSidebar.tsx` | [MODIFY] | Legacy Sidebar Component | `tests/unit/components/address-autocomplete.test.tsx` | INV-UI-04 PDOK Suggest Dropdown, 250ms Debounce & Selectie |
| `src/app/page.tsx` | [MODIFY] | Single-Screen Orchestratie | `tests/unit/components/dashboard-page.test.tsx` | INV-UI-01 Zero-Jump LocalStorage Persistentie & Geen Amersfoort Flash |
| `src/components/legacy/GoogleMapCanvas.tsx` | [MODIFY] | Fullscreen Google Map | `tests/e2e/legacy-parity.spec.ts` | INV-MAP-01 Vloeiende Initialisatie zonder Schokkerige Pan |
| `tests/unit/components/address-autocomplete.test.tsx` | [NEW] | Autocomplete Unit Testsuite | `tests/unit/components/address-autocomplete.test.tsx` | Pijler 4 TDD Dekking voor PDOK Suggestie-Ophaling |
| `tests/unit/components/dashboard-page.test.tsx` | [MODIFY] | Dashboard Unit Testsuite | `tests/unit/components/dashboard-page.test.tsx` | Pijler 4 Shift-Left Guard voor Geolocation & Dropdown |

### Sub-Fase 3B: Verdiepingen & Vloergeometrie Pariteit (max 5 bestanden)

| Bestand | Mutatie | Verantwoordelijke Module | Verificatietest | Rol / Invariant |
| :--- | :--- | :--- | :--- | :--- |
| `src/components/legacy/FloorplanOverlay.tsx` | [MODIFY] | Floorplan Overlay Container | `tests/e2e/legacy-parity.spec.ts` | INV-UI-03 Automatische Straatdetectie (`frontWallIdx ?? undefined`) |
| `src/domain/legacy/floor-geometry-calculator.ts` | [MODIFY] | Reële Vloergeometrie | `tests/unit/domain/legacy/floor-geometry-calculator.test.ts` | INV-GEO-02 Hoofdvolume Begrenzing 5.0m-8.0m voor Panden met Aanbouw |
| `src/domain/legacy/svg-floorplan-renderer.ts` | [MODIFY] | SVG Floorplan Generator | `tests/unit/domain/legacy/svg-floorplan-renderer.test.ts` | INV-GEO-03 Scoringformule `dot * Math.sqrt(len)` Pariteit |
| `tests/unit/domain/legacy/floor-geometry-calculator.test.ts` | [MODIFY] | Geometrie Calculator Testsuite | `tests/unit/domain/legacy/floor-geometry-calculator.test.ts` | Pijler 4 1e en 2e Verdieping Hoofdvolume Validatie |
| `tests/e2e/legacy-parity.spec.ts` | [MODIFY] | Playwright Pariteitstest | `tests/e2e/legacy-parity.spec.ts` | Pijler 4 E2E Regressiebescherming & Verdiepingen Pariteit |

---

## 4. Fasering & Uitvoering

1. **Fase 1: Planvorming & Red Team Audit (Cold-Start Gate):**
   - Validatie via structural checker en Pass 1 audit door subagent `red-team`.
   - Presentatie van het canonieke 9-criteria HITL Goedkeuringsdossier.
2. **Fase 2: TDD Test Design (Red Phase):**
   - Schrijf falende tests voor de autocomplete dropdown in `tests/unit/components/address-autocomplete.test.tsx`.
   - Schrijf falende tests voor de 1e verdieping hoofdvolume afmetingen in `tests/unit/domain/legacy/floor-geometry-calculator.test.ts`.
3. **Fase 3: Sequentiële Implementatie (Green Phase):**
   - Implementeer Sub-Fase 3A en Sub-Fase 3B.
   - Valideer 5-Pillar gates: Types, Lint, Tests (100% groen), Build.
4. **Fase 4: Diff-Audit, Verified Commit & Push:**
   - Subagent `red-team` Pass 2 Diff-Audit.
   - Subagent `commit-officer` verified git commit en remote push.

---

## 5. Scenariodriehoek (Happy / Edge / Corner)

### Happy Path
- **Gebruiker typt in zoekbalk:** Na het typen van "henneme" verschijnt binnen 250ms een elegante witte dropdown met suggesties zoals "Hennemettenstraat Gronsveld".
- **Gebruiker klikt op suggestie:** De dropdown sluit, het adres wordt ingeladen, de kaart zoomt direct in op het pand en alle verdiepingen zijn beschikbaar.
- **Verdiepingen selector:** Begane grond toont het gehele pand; 1e Verdieping toont het zuivere hoofdvolume ($6.63\text{m} \times 8.00\text{m}$) met straatbadge aan de voorzijde; 2e Verdieping toont de opbouw/zolder.
- **Herstart app:** App opent direct op de laatst bekende locatie zonder Amersfoort flashover.

### Edge Cases
- **Geen suggesties gevonden:** Dropdown toont een vriendelijke melding "Geen adressen gevonden" of blijft verborgen.
- **Snelle toetsinvoer:** Debounce voorkomt overbodige netwerkverzoeken; tussentijdse verzoeken worden geannuleerd.
- **Panden met $\ge 4$ bouwlagen:** Knoppenstructuur past zich dynamisch aan aan het aantal bouwlagen uit BAG.

### Corner Cases
- **Netwerkfout bij suggesties:** Dropdown valt stil terug zonder de UI te blokkeren; handmatige invoer met Enter blijft werken.
- **Lege localStorage:** Eerste bezoek zonder eerdere locatie start elegant via HTML5 geolocation zonder sprong.

---

## 6. Verificatie & Definition of Done (5-Pillar Gates)

- **Pijler 1 (Types):** `npx tsc --noEmit` &rarr; 0 errors.
- **Pijler 2 (Lint):** Geen codekwaliteitswaarschuwingen.
- **Pijler 3 (Guards):** Zero unauthorized visual drift, conform `guards_engine.py`.
- **Pijler 4 (Tests):** Alle 40+ unit test suites groen, Playwright E2E pariteitstest geslaagd.
- **Pijler 5 (Build):** Next.js 16 productie-build (`npm run build`) 100% succesvol.

---

## 7. Goedkeuringsdossier & Verantwoording

### 📋 HITL Goedkeuringsdossier

| Criterium | Specificatie & Verantwoording |
| :--- | :--- |
| **Fase** | Fase 1 (Planvorming & Red Team Audit Afgerond) &rarr; Poort naar Fase 2 & 3 |
| **Doel** | Herstel van UX Autocomplete (PDOK suggest dropdown), Vloergeometrie Pariteit (1e verdieping $6.63\text{m} \times 8.00\text{m}$ hoofdvolume i.p.v. 18.5m strip, 2e opbouw, 3e zolder) en Zero-Jump startlocatie (eliminatie Amersfoort flashover) |
| **Bestanden & Mutaties** | **Sub-Fase 3A: UX Autocomplete & Zero-Jump Geolocation (max 5 bestanden)**<br>• `src/components/legacy/LegacyPlaceSidebar.tsx` [MODIFY]<br>• `src/app/page.tsx` [MODIFY]<br>• `src/components/legacy/GoogleMapCanvas.tsx` [MODIFY]<br>• `tests/unit/components/address-autocomplete.test.tsx` [NEW]<br>• `tests/unit/components/dashboard-page.test.tsx` [MODIFY]<br><br>**Sub-Fase 3B: Verdiepingen & Vloergeometrie Pariteit (max 5 bestanden)**<br>• `src/components/legacy/FloorplanOverlay.tsx` [MODIFY]<br>• `src/domain/legacy/floor-geometry-calculator.ts` [MODIFY]<br>• `src/domain/legacy/svg-floorplan-renderer.ts` [MODIFY]<br>• `tests/unit/domain/legacy/floor-geometry-calculator.test.ts` [MODIFY]<br>• `tests/e2e/legacy-parity.spec.ts` [MODIFY] |
| **Auditverloop & Definitief Verdict** | **Ronde 1:** `AFGEKEURD` (Ontbrekende autocomplete dropdown, 17.95m strip regressie op 1e verdieping, en Amersfoort flash geconstateerd door HITL en subagents)<br>*(Chirurgisch herstel conform Legacy Autocomplete en Floor Geometry audits)*<br>**Ronde 2:** `VERDICT: GOEDGEKEURD (Zero defects bewezen)` Resterend: P0: 0 \| P1: 0 \| P2: 0 |
| **Scenariodriehoek** | • **Happy:** Zoekbalk vult live aan met PDOK suggesties; 1e en 2e verdieping tonen het zuivere $6.63\text{m} \times 8.00\text{m}$ hoofdvolume; app start op laatst bekende locatie zonder Amersfoort flashover<br>• **Edge:** Typen zonder resultaat geeft geen fouten; panden met afwijkende geometrie volgen de automatische straatgevel-scoring<br>• **Corner:** Trage netwerkverbinding veroorzaakt geen race conditions bij autocomplete; localStorage corruptie valt veilig terug |
| **Verificatie & DoD** | TDD tests voor autocomplete en verdiepingen, 100% unittests groen, 0 type/lint errors, Next.js build & Playwright E2E pariteit |
| **State Sanitation** | Geen geheugenlekken in debounce timers, schone ontkoppeling van suggestiestatus en pandselectie |
| **Risico & Rollback** | Laag risico (gestructureerd in 2 tranches van 5 bestanden conform `INV-SYS-07`). Rollback via `omni_write_tool` / Git checkout |
| **Vereiste HITL Actie** | Klik op de interactieve **Proceed** knop of antwoord met *"Akkoord"* / *"Voer uit"* |
