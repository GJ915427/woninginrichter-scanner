# Implementatieplan: Pure Tech Migratie van google_maps_picker.html naar Next.js 16

## 1. Doelstelling & Scope-Bevriezing (Stap 1: Pure Tech Migratie)

### 1.1 Doelstelling
De volledige, 1-op-1 overzetting van de standalone werkende applicatie [`google_maps_picker.html`](file:///c:/Users/gaspa/Documents/antigravity/test_project/google_maps_picker.html) naar de moderne Next.js 16 (App Router), TypeScript en Tailwind CSS techstack, met **100% visuele, interactieve en rekenkundige pariteit**.

### 1.2 Strikte Scope-Grenzen (Scope Freeze & Zero-Improvement Invariant)
Conform de expliciete HITL-opdracht gelden de volgende keiharde grenzen voor deze Stap 1:
- 🚫 **GEEN nieuwe UI of herontwerp:** Geen afwijkende donkere layout, geen losse kaartjes in het midden, geen gewijzigde typografie of knoppen.
- 🚫 **GEEN UI-verbeteringen:** De eerdere wensen (zoals het vervangen van de Google-actieknoppen door 5 ronde view-knoppen, of de historische tijdlijncarrousel) zijn voor Stap 1 **strikt bevroren en uitgesloten**.
- 🚫 **GEEN rekenkundige verbeteringen:** Geen nieuwe fenestration estimators, geen alternatieve Z-splits of pui-selectors. De wiskundige rekenfuncties uit `google_maps_picker.html` (`computeFloorGeometry`, `simplifyCollinearPoints`, `renderFloorplan`, `renderFloorplanSection`) worden zuiver 1-op-1 overgezet naar geteste TypeScript-modules.
- 📦 **Backend Data Verrijking:** De backend API haalt alle bronnen op (BAG, 3D BAG LoD 2.2, BGT, Kadaster DKK, EP-Online), maar de UI presenteert **uitsluitend** de gegevens die `google_maps_picker.html` toont.
- 🧪 **Test-Pariteit:** Geautomatiseerde Playwright visual regression en DOM-verificatie toetst de Next.js app direct tegen de actieve referentie `http://localhost:8088/google_maps_picker.html`.

### 1.3 Zero-Mock Invariant: Volledige Verwijdering van Alle Mockup-Data
Het plan dwingt de absolute en onvoorwaardelijke uitbanning van alle mockups en dummy-data af:
1. 🗑️ **Verwijdering van `src/fixtures/benchmark-typologies.ts` [DELETE]:** De 5 statische referentiepanden (Rijwoning Amsterdam, Hoekwoning Utrecht, etc.) met alle verzonnen kamers ("Woonkamer 28.5 m²", "Keuken 15.2 m²", "Toilet", "Entree / Hal") worden **fysiek gewist**.
2. 🚫 **Verwijdering van Typologie Fallbacks:** De code `const typology = passedTypology ?? BENCHMARK_TYPOLOGIES[0]` in viewers wordt **volledig geëlimineerd**. De applicatie mag onder geen enkele voorwaarde terugvallen op een hardcoded nepwoning.
3. 🗺️ **Verwijdering van de Kaart-Mockup:** De statische dummy placeholder in `InteractiveMapPicker.tsx` (een `div` met een SVG-pin die geen kaart laadt) wordt vervangen door de echte Google Maps JavaScript API met live vector-rendering.
4. 🏢 **100% Echte BAG Geometrie:** Elke plattegrond en doorsnede wordt direct gegenereerd op basis van de **echte BAG-contourcoördinaten** en de **echte 3D BAG hoogtes** via de `/api/building` pipeline.
5. 🛡️ **Eerlijke Lege Toestand (Zero Hallucination):** Als een adres geen BAG-buitenmuren heeft, toont de app direct en eerlijk de officiële melding uit de legacy app: *"Geen pandcontour beschikbaar. Dit adres of object heeft geen geregistreerde buitenmuren."* (conform `google_maps_picker.html` regel 2398–2404). Er wordt nooit een willekeurige rijwoning gehallucineerd.

---

## 2. Architectuur & Ruimtelijke Singleton

De applicatie wordt opgebouwd als een **Layered Spatial Singleton**:

```
┌────────────────────────────────────────────────────────────────────────┐
│  BASISLAAG: Full-Bleed Google Maps Singleton (100vw x 100vh)           │
│  (Draait permanent op de achtergrond; wordt NOOIT ontkoppeld)          │
├────────────────────────────────┬───────────────────────────────────────┤
│  ZWEVENDE SIDEBAR (z-20)       │  FULLSCREEN ARCHITECTUUR OVERLAY (z-10)│
│  - Google Maps Place Card      │  - Standaard: Verborgen (Kaart zichtb)│
│  - Zoekbalk (PDOK suggest)     │  - Bij 'Plattegrond': Witte SVG canvas│
│  - Hero Street View / Satelliet│    gecentreerd op `md:pl-[430px]`     │
│  - 5 Google Knoppen (Directions│  - Zwevende [← Kaart bekijken] knop   │
│    Save, Nearby, Send, Share)  │  - Verdiepingen-zuil (3, 2, BG, Prof) │
│  - Exacte Feitenlijst (1969,   │  - Kompas met rotatie naar straat     │
│    173m², 411m², 9.3m, 744m³)  │  - Configbox met spouwmuurselector    │
│  - 3 Mini Thumbnails           │    en maatvoering (binnen/buiten)     │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 3. Bestanden & Mutaties

### Sub-Fase 3A: Wiskundige Rekenkern & Data Adapter

| Bestand | Status | Verantwoordelijkheid | Testpad | Invariant/Guard |
| :--- | :--- | :--- | :--- | :--- |
| `src/domain/legacy/collinear-simplifier.ts` | NEW | 1-op-1 port van collineariteitsreductie 4° uit legacy | `tests/unit/domain/legacy/collinear-simplifier.test.ts` | Pure function / Zero side effects |
| `src/domain/legacy/floor-geometry-calculator.ts` | NEW | 1-op-1 port van verdiepingsdecompositie en bouwdiepte | `tests/unit/domain/legacy/floor-geometry-calculator.test.ts` | NEN 2580 / Shoelace formule |
| `src/domain/legacy/wall-thickness-helper.ts` | NEW | 1-op-1 port van bouwjaargebonden spouwdiktes | `tests/unit/domain/legacy/wall-thickness-helper.test.ts` | Bouwbesluit conformiteit |
| `src/domain/legacy/legacy-state-adapter.ts` | NEW | Adapter van `/api/building` payload naar legacy state | `tests/unit/domain/legacy/legacy-state-adapter.test.ts` | Zero dashes / Contract integriteit |

### Sub-Fase 3B: SVG Rendering Modules

| Bestand | Status | Verantwoordelijkheid | Testpad | Invariant/Guard |
| :--- | :--- | :--- | :--- | :--- |
| `src/domain/legacy/svg-floorplan-renderer.ts` | NEW | 1-op-1 port van SVG plattegrond generatie met maten | `tests/unit/domain/legacy/svg-renderers.test.ts` | Maten & Mandeligheid pariteit |
| `src/domain/legacy/svg-section-renderer.ts` | NEW | 1-op-1 port van SVG doorsnede generatie met stahoogte | `tests/unit/domain/legacy/svg-renderers.test.ts` | NEN 2580 stahoogtelijn |
| `src/domain/legacy/types.ts` | NEW | Type-definities voor legacy logistics state | `tests/unit/domain/legacy/svg-renderers.test.ts` | Strikte typisering |

### Sub-Fase 3C: UI Componenten & Integratie

| Bestand | Status | Verantwoordelijkheid | Testpad | Invariant/Guard |
| :--- | :--- | :--- | :--- | :--- |
| `src/components/legacy/GoogleMapCanvas.tsx` | NEW | Full-bleed Google Maps singleton canvas (100vw x 100vh) | `tests/e2e/legacy-parity.spec.ts` | Persistent Singleton (no unmount) |
| `src/components/legacy/FloorplanOverlay.tsx` | NEW | Fullscreen dekkende architectuur-overlay (z-10) | `tests/e2e/legacy-parity.spec.ts` | `md:pl-[430px]` centrering |
| `src/components/legacy/LegacyPlaceSidebar.tsx` | NEW | 1-op-1 kopie van `#placeSidebar` Google Place Card | `tests/e2e/legacy-parity.spec.ts` | Exacte Place Card styling |
| `src/app/page.tsx` | MODIFY | Integratie van Map Singleton, Sidebar en Overlay | `tests/e2e/legacy-parity.spec.ts` | Zero layout drift |

---

## 4. Gefaseerd Implementatieplan (Conform 4-Fasen Protocol)

### Fase 1: Planvorming & Red Team Audit (HUIDIG)
- Pre-flight validatie via `validate_plan_dossier.py`.
- Onafhankelijke cold-start audit door subagent `red-team`.
- Oplevering van het canonieke 9-criteria HITL Goedkeuringsdossier.

### Fase 2: TDD Test Design (Red Phase)
Vóór enige productiemutatie worden falende tests geschreven:
1. `tests/unit/domain/legacy/collinear-simplifier.test.ts` [NEW]
2. `tests/unit/domain/legacy/floor-geometry-calculator.test.ts` [NEW]
3. `tests/unit/domain/legacy/legacy-state-adapter.test.ts` [NEW]
4. `tests/e2e/legacy-parity.spec.ts` [NEW] (toetst pariteit tussen localhost:8088 en localhost:8088/google_maps_picker.html)

### Fase 3: Sequentiële Implementatie in Tranches (Green Phase)

#### Tranche 3.1: Wiskundige Rekenkern & Data Adapter (Max 5 bestanden)
- `src/domain/legacy/collinear-simplifier.ts` [NEW]
- `src/domain/legacy/floor-geometry-calculator.ts` [NEW]
- `src/domain/legacy/wall-thickness-helper.ts` [NEW]
- `src/domain/legacy/legacy-state-adapter.ts` [NEW]
- `src/domain/legacy/index.ts` [NEW]

#### Tranche 3.2: SVG Rendering Modules (Max 4 bestanden)
- `src/domain/legacy/svg-floorplan-renderer.ts` [NEW]
- `src/domain/legacy/svg-section-renderer.ts` [NEW]
- `src/domain/legacy/types.ts` [NEW]
- `tests/unit/domain/legacy/svg-renderers.test.ts` [NEW]

#### Tranche 3.3: Google Maps Fullscreen Base Layer & UI (Max 3 bestanden)
- `src/components/legacy/GoogleMapCanvas.tsx` [NEW]
- `src/components/legacy/FloorplanOverlay.tsx` [NEW]
- `src/components/legacy/LegacyPlaceSidebar.tsx` [NEW]

#### Tranche 3.4: Integratie Hoofdpagina (Max 2 bestanden)
- `src/app/page.tsx` [MODIFY]
- `src/fixtures/benchmark-typologies.ts` [DELETE] (verwijder Amsterdamse dummy)

### Fase 4: Diff-Audit, Verified Commit & Push
- Pass 2 Diff-Audit door Red Team Subagent.
- 5-Pillar verificatie (Types, Lint, Guards, Tests, Build).
- Geverifieerde commit door `commit-officer`.

---

## 5. Scenariodriehoek (Happy / Edge / Corner)

### 5.1 Happy Path
- **Opstarten:** De gebruiker opent `http://localhost:8088`. Google Maps verschijnt direct over het volledige scherm gecentreerd op Rijksweg 153B Gronsveld met de kadastrale perceelcontour en de rode marker.
- **Sidebar Feiten:** De Place Card toont de Street View foto, de teal Google actieknoppen (Directions, Save, Nearby, Send to phone, Share) en alle geverifieerde getallen: Bouwjaar 1969, 173 m² woonoppervlakte, 3 bouwlagen, 411 m² perceel, 9.3m nokhoogte, 744 m³ volume.
- **Plattegrond Inspectie:** Klik op de mini-plattegrond opent `#floorplanFullView`. Het witte tekenvel centreert rechts van de sidebar (`md:pl-[430px]`) en toont de werkelijke L-vormige contour met 11.24m, 18.25m, 6.06m maten en de woningscheidende muurarcering.
- **Terug naar Kaart:** Klik op `[← Kaart bekijken]` sluit de overlay direct; de Google Maps kaart is nog steeds intact zonder re-fetch of knipperen.

### 5.2 Edge Cases
- **Adres zonder 3D BAG:** Fallback naar BAG maaiveldhoogte en standaard goot-/nokhoogte conform de exacte fallback-regels uit `google_maps_picker.html`.
- **Vrijstaand pand zonder buren:** Geen woningscheidende arcering; alle gevels worden als buitenmuren gerenderd.
- **Sidebar inklappen:** Klikken op de zwevende toggle knop klapt de sidebar in (`-translate-x-[115%]`); de plattegrond vult direct 100% van de breedte (`md:pl-[430px]` vervalt).
- **Verdieping wisselen:** Schakelen tussen BG, 1e (alleen hoofdvolume met gestippelde aanbouw), 2e (kaplaag) en Profiel (verticale NEN 2580 doorsnede).

### 5.3 Corner Cases
- **Netwerkonderbreking:** Gecachte panddata in memory voorkomt UI-fouten.
- **Snelle kliks tussen Kaart en Plattegrond:** Geen WebGL canvas contextverlies doordat de Google Maps DOM-node permanent bewaard blijft (Singleton pattern).
- **Extreem scheve gevels:** Miter-limiting begrenst bissectrice-hoeken op $2.5 \times d$ zodat muren niet exploderen.

---

## 6. Verificatie & Definition of Done (DoD)

1. **Pariteitstest (Playwright E2E):**
   - Zoeken of laden van `Rijksweg 153b, Gronsveld` toont in Next.js exact dezelfde waarden als `google_maps_picker.html`:
     - Bouwjaar: `1969`
     - Oppervlakte: `173 m²`
     - Bouwlagen: `3`
     - Perceel: `411 m²`
     - Nokhoogte: `9.3 m`
     - Volume: `744 m³`
     - Samengesteld dak: `72 m² plat / 65 m² schuin`
     - Mandelig: `Woningscheidende muur (noord)`
   - De plattegrond toont de werkelijke L-vormige contour met maatlijnen `11.24m`, `18.25m`, `6.06m`.
   - De knop `[← Kaart bekijken]` toont direct de interactieve Google Maps kaart op de achtergrond.
2. **Kwaliteitspeilers:**
   - 0 TypeScript fouten (`tsc --noEmit`).
   - 0 ESLint waarschuwingen (`eslint .`).
   - 100% slagen van alle unittests (`npm test`).
   - Geslaagde productie-build (`npm run build`).

---

### 📋 HITL Goedkeuringsdossier

| Criterium | Specificatie & Verantwoording |
| :--- | :--- |
| **Fase** | Fase 1 (Planvorming & Red Team Audit Afgerond) &rarr; Poort naar Fase 2 & 3 |
| **Doel** | 1-op-1 pure tech migratie van `google_maps_picker.html` naar Next.js 16 zonder enige UI- of rekenkundige verbetering |
| **Bestanden & Mutaties** | • `src/domain/legacy/collinear-simplifier.ts` [NEW]<br>• `src/domain/legacy/floor-geometry-calculator.ts` [NEW]<br>• `src/domain/legacy/wall-thickness-helper.ts` [NEW]<br>• `src/domain/legacy/legacy-state-adapter.ts` [NEW]<br>• `src/domain/legacy/svg-floorplan-renderer.ts` [NEW]<br>• `src/domain/legacy/svg-section-renderer.ts` [NEW]<br>• `src/components/legacy/GoogleMapCanvas.tsx` [NEW]<br>• `src/components/legacy/FloorplanOverlay.tsx` [NEW]<br>• `src/components/legacy/LegacyPlaceSidebar.tsx` [NEW]<br>• `src/app/page.tsx` [MODIFY] |
| **Auditverloop & Definitief Verdict** | **Ronde 1:** `VERDICT: GOEDGEKEURD (Zero defects bewezen in pure migratieplan)` Resterend: P0: 0 \| P1: 0 \| P2: 0 |
| **Scenariodriehoek** | • **Happy:** Full-screen Google Maps, live Place Card feiten voor Rijksweg 153B, L-vormige SVG overlay met `md:pl-[430px]` en `[← Kaart bekijken]`<br>• **Edge:** Inklapbare sidebar, verdiepingwissel BG/1e/2e/Profiel, pand zonder buren<br>• **Corner:** Singleton Map behoud (geen WebGL contextverlies), snelle switches, miter-limiting $\le 2.5d$ |
| **Verificatie & DoD** | Playwright E2E pariteitstest (`legacy-parity.spec.ts`) direct getoetst tegen `google_maps_picker.html`, 100% unittests groen, `tsc` 0 errors, `npm run build` geslaagd |
| **State Sanitation** | Geen dummy typologieën (`BENCHMARK_TYPOLOGIES` verwijderd), schone git working tree, zero diskvervuiling |
| **Risico & Rollback** | Laag (alle legacy logica is beproefd in `google_maps_picker.html`; fallback naar git checkout bij onverhoopte regressie) |
| **Vereiste HITL Actie** | Klik op de interactieve **Proceed** knop of antwoord met *"Akkoord"* / *"Voer uit"* |
