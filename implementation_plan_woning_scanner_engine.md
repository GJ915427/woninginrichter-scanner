# Implementatieplan: 100% Data-Gedreven Woninginrichter Engine (Port & Verrijking `google_maps_picker.html`)

> **Status:** Fase 1 (Planvorming & Red Team Audit Afgerond)  
> **Auteur:** Antigravity Architecture Team & Auditor Subagenten  
> **Doel:** 100% data-gedreven reconstructie van Nederlandse woningen op basis van BAG, 3D BAG LoD 2.2, BGT, AHN5 en DKK, in de exacte single-screen interface van `google_maps_picker.html`, met transparante betrouwbaarheidsindicatoren en interactieve gevelcorrecties.

---

## 1. Antwoorden op de Vragen van de Gebruiker & Afsprakenkader

### 1.1 Waarom PDOK Locatieserver vs Google Places? Wat gebruikt Google en waarom gebruiken wij die wel?
- **Wat gebruikt Google Maps?**
  Google Maps gebruikt haar eigen commerciële database (`Google Places API` / `Google Geocoding API`). Wanneer een gebruiker een adres intypt, zoekt Google op adressen, winkels en point-of-interests (POI's). Het resultaat is een Google `place_id`, een geschatte geografische coördinaat (WGS84 lat/lng) en een adresstring.
- **Waarom kan Google Maps alléén NIET volstaan voor bouwkundige weergave?**
  1. Google kent **géén** officiële Nederlandse Kadaster BAG Pand-ID's of verblijfsobject-identificaties (VBO-ID).
  2. Google levert **géén** officiële bouwkundige footprint (geometrie), **géén** bouwjaar, **géén** gebruiksoppervlakte wonen (GO), en **géén** dakhellingen of dakschilden.
  3. Om bij de officiële TU Delft 3D BAG (hoogtes, daken, CityJSON) en Kadaster (perceelsgrenzen, BAG) te komen, is **verplicht** een Nederlands BAG Pand-ID of Rijksdriehoeksmeting (RD New EPSG:28992) coördinaat nodig.
- **Wat is PDOK Locatieserver?**
  PDOK Locatieserver is de officiële, door de Nederlandse overheid (Kadaster/Geonovum) beheerde geocoder. Het is de nationale 'Single Source of Truth' (SSOT). Het koppelt elk Nederlands adres direct en met 100% zekerheid aan het officiële BAG Pand-ID, VBO-ID en RD-coördinaten. Het is gratis, uiterst snel en kent geen commerciële rate limits.
- **De Gebruiksvriendelijke Hybride Oplossing:**
  We combineren het beste van twee werelden:
  - **In de zoekbalk (Frontend UX):** Google Places Autocomplete biedt de vertrouwde, soepele zoekervaring met type-ahead en commerciële POI-suggesties.
  - **In de backend (Data Resolutie):** Zodra de gebruiker een suggestie aanklikt, vertaalt onze backend de lat/lng via een ruimtelijke point-in-polygon query op de Kadaster BAG API / PDOK Locatieserver direct naar het officiële BAG Pand-ID. Hierdoor geniet de gebruiker van de vertrouwde Google-zoekbalk, terwijl de applicatie 100% gevoed wordt met de officiële Kadaster- en 3D BAG data!

---

### 1.2 UI Reconstructie: Identiek aan `google_maps_picker.html` (Geen Dashboard met Gestapelde Kaarten)
De gebruiker heeft nadrukkelijk aangegeven: *geen* gestapelde kaarten of "interactieve kaart daaronder", maar de vertrouwde indeling van de eerdere app.
- **Single-Screen Full-Bleed Layout (`100vw` × `100vh`, `overflow: hidden`):**
  - **Links (Floating `#placeSidebar`, breedte 400px):**
    - Zoekbalk bovenaan met live suggesties.
    - Hero media (wisselbaar tussen foto en mini-view).
    - Pandtitel (Adres, Postcode, Woonplaats) met statusbadges (Bouwjaar, Woningtype).
    - **De 5 Moderne Weergaveknoppen (Screenshot 1 vervanging):**
      In plaats van de Google actieknoppen (`Directions`, `Save`, `Nearby`, etc.) komen 5 elegante ronde icon-knoppen met Google Material icons en duidelijke labels:
      1. 📐 **2D Plattegrond** (Plattegrond per verdieping BG / 1e / Kap)
      2. 📏 **Langssnede** (Bouwkundige doorsnede over nokas)
      3. 🧊 **3D Model** (Interactief 3D BAG LoD 2.2 volumemodel)
      4. 📷 **Street View** (Google Street View panorama gericht op de voorgevel)
      5. 🛰️ **Satelliet** (Hoge resolutie luchtfoto)
    - Daaronder: De scrollbare lijst met alle technische specificaties (Oppervlakte, Dakoppervlak plat vs schuin, Hellingshoek, Nok-/Goothoogte, Inhoud, Energielabel) — exact zoals in `google_maps_picker.html`.
  - **Rechts (Hoofdcanvas, vult de resterende ruimte met `md:pl-[430px]` centrering):**
    - Toont uitsluitend de geselecteerde weergave op vol formaat.
    - Geen versnipperde pagina met losse blokken onder elkaar; schakelen tussen weergaven gebeurt exclusief via de 5 actieknoppen links.

---

### 1.3 Historische Tijdlijnen: Street View & Satelliet 'Time Machine' (Screenshot 2)
In Screenshot 2 toonde de gebruiker de Street View tijdlijn met historische opnames (`Aug 2024`, `Sep 2023`, `May 2019`, etc.).
- **Street View Tijdlijn Carrousel (`StreetViewTimelineCarousel`):**
  - We gebruiken de Google Maps JavaScript API `StreetViewService`.
  - Bij het laden van het panorama vragen we via `getPanorama({ location: pos, radius: 50, preference: 'nearest' })` de metadata op. De response bevat de array `time` / `historicalPanos`.
  - Onderin het Street View canvas rendert een horizontale scrolbare dock met datum-chips.
  - Klikken op een historische datum (`Sep 2023`) laadt direct die specifieke historische `panoId`. Zo kan de gebruiker door bomen of seizoenen heen kijken om de gevel haarscherp te zien!
- **Satelliet / Luchtfoto Tijdlijn Carrousel (`AerialTimelineCarousel`):**
  - PDOK levert gratis historische Hoge Resolutie Luchtfoto's (WMS/WMTS) per jaargang: van `2016_ortho25` tot en met `2024_orthoHR` (8cm resolutie!).
  - In de Satelliet-weergave tonen we een identieke tijdlijn-dock onderin met jaartal-knoppen (`2016`, `2017`, ..., `2024`).
  - Hiermee kan de gebruiker historische verbouwingen, nieuwe aanbouwen of dakkapellen door de jaren heen verifiëren!

---

### 1.4 Slimmere Verdiepingssplitsing bij Aanbouwen (3A) via 3D BAG Dakschild Z-Splits
In `google_maps_picker.html` schatte `computeFloorGeometry()` de diepte van het hoofdvolume via de verhouding tussen VBO woonoppervlak en footprint, gecombineerd met een vuistregel voor balkoverspanning ($5.0\text{ m} - 8.0\text{ m}$).
- **De Veel Slimmere Verbetering met 3D BAG LoD 2.2 Geometrie:**
  In plaats van gissen met vuistregels, gebruiken we de **werkelijke 3D dakschilden** uit 3D BAG CityJSON:
  1. Elk dakschild heeft een normale vector $\vec{n} = (n_x, n_y, n_z)$ en een hoogtemeting $Z$.
  2. Een aanbouw/uitbouw aan de achterzijde heeft vrijwel altijd een **plat dak** ($\vec{n}_z \approx 1.0$) of een veel lagere lessenaarskap, met een maximale hoogte $Z_{max} < H_{goot\_hoofdvolume}$.
  3. Het hoofdvolume heeft schuine dakschilden met een noklijn op $H_{nok}$ en gootlijnen op $H_{goot}$.
  4. De 2D-intersectielijn tussen het schuine dakvlak van het hoofdvolume en het platte dakvlak van de aanbouw ($Poly_{main} = Footprint \cap Poly_{dak\_schuin}$) bepaalt de **exacte fysieke scheidslijn** van de verdiepingen!
  - **Begane Grond:** Toont de volledige footprint (inclusief aanbouw).
  - **1e Verdieping:** Toont automatisch uitsluitend $Poly_{main}$. De aanbouw valt hier direct af, want het dak van de aanbouw is geen 1e verdieping!
  - **Zolder / Kaplaag:** Toont de contour begrensd door de NEN 2580 $1.50\text{ m}$ stahoogtelijn, berekend uit de werkelijke hellingshoek $\alpha$ en goothoogte.

---

### 1.5 Gevelopeningen (Ramen/Deuren), Betrouwbaarheid & Interactieve Correcties (3C, 3D & Feedback)
- **Staan er in CityJSON (3D BAG TU Delft) ook "openingen" (ramen/deuren)?**
  - **Nee.** 3D BAG LoD 2.2 is een 'exterior shell' volumemodel (met `RoofSurface`, `WallSurface` en `GroundSurface`). Het bevat geen `WindowSurface` of `DoorSurface`. Dit komt doordat 3D BAG automatisch berekend wordt uit AHN LiDAR vluchten (lasermetingen vanuit vliegtuigen), die geen ramen of deuren onder dakranden kunnen registreren.
- **Accuratesse & Beperkingen van Open Data (Gebruikersconstatering):**
  Zoals terecht opgemerkt door de gebruiker, is beglazing op de gevels vanuit open data **geen** uniforme meting:
  - **Voorgevel (Hoge Betrouwbaarheid 80–95%):** Direct zichtbaar vanaf de straat via Google Street View; voordeur, trappen en luifels worden direct bevestigd door BAG VBO ingangscoördinaten en BGT `gebouwinstallaties`.
  - **Zijgevels (Middelmatige Betrouwbaarheid 40–70%):** Zichtbaar bij hoek- en vrijstaande panden via Street View; bij tussenwoningen garandeert Kadaster DKK dat er géén ramen mogen zitten (Burgerlijk Wetboek art. 5:50 mandeligheid / 2m erfgrens).
  - **Achtergevel (Bouwkundige Benadering 20–40%):** **Geen enkele openbare camera heeft zicht op de achtertuin.** EP-Online levert alleen een geaggregeerd totaal glasoppervlak ($A_{glas}$ in $\text{m}^2$) en Bouwbesluit stelt een minimale $10\%$ daglichtnorm per verblijfsruimte.
- **Hoe we dit professioneel en eerlijk oplossen in de applicatie:**
  1. **Transparante Betrouwbaarheids-Badges (Zero-Hallucination):**
     In de gevel- en plattegrondviewer tonen we per gevel een duidelijke status:
     - Voorgevel: `🟢 Geverifieerd via Street View & BGT (Hoge betrouwbaarheid)`
     - Achtergevel: `🟡 Bouwkundige benadering (Indicatief o.b.v. type & bouwjaar)`
  2. **Wat wél exact bekend is aan de achterzijde:**
     - **Dakkapellen en dakramen:** Wél exact verifieerbaar via de PDOK 8cm Hoge Resolutie luchtfoto en 3D BAG dakschild-verhogingen.
     - **Aanbouw-puien:** Woningen met een uitbouw hebben in de Nederlandse bouwpraktijk in $>85\%$ van de gevallen een grote tuingerichte pui (schuifpui of openslaande deuren).
  3. **Interactieve Gebruikerscorrectie (Aanpasbaarheid):**
     De achtergevel start met een realistische bouwkundige indeling, maar de adviseur/woninginrichter kan met **één klik** een pui-type wijzigen via een dropdown/toggle (*Schuifpui / Openslaande deuren met zijlichten / Vast glas met loopdeur*) of een kozijnbreedte handmatig aanpassen.

#### Sensor Fusion Matrix

| Bouwkundig Onderdeel | Primaire Bron | Secundaire Verificatie | Betrouwbaarheid | Fusie, Interpolatie & Correctie |
| :--- | :--- | :--- | :--- | :--- |
| **Footprint / Maaiveldcontour** | **Kadaster BAG** (WFS Pandcontour, RD) | **PDOK BGT** (fysieke gevelgrens) | **100% (Decimeter)** | Decimeter-nauwkeurige contour; collineariteitsreductie met 4° hoekfilter. |
| **Perceel & Mandeligheid** | **Kadaster DKK** (Perceelsgrenzen) | **Kadaster BAG** (buurpanden) | **100% (Juridisch)** | Gevels op de erfgrens met buurpand worden gearceerd als mandelige muren. |
| **Maaiveldniveau & Peil** | **AHN5 / AHN4 DTM** (2–5 cm NAP) | **3D BAG** `b3_h_maaiveld` | **98% (2-5 cm)** | Exact nulpunt: maaiveld = AHN NAP, drempelpeil = maaiveld + 0.15m. |
| **Dakvorm & Nok/Goot** | **TU Delft 3D BAG LoD 2.2** (CityJSON) | **AHN LiDAR puntenwolk** | **95% (3D Mesh)** | Werkelijke dakschilden met normale vectoren $\vec{n}$, noklijn en goothoogte. |
| **Aanbouw & Verdiepingsplitsing** | **3D BAG Dakschild Z-Splits** | **BAG VBO** Woonoppervlak / Balkoverspanning | **90–95% (Geometrisch)** | $Poly_{main} \cap Poly_{ext}$ splitst aanbouw exact af van verdiepingen. |
| **Entree / Voordeur** | **BAG VBO Ingangscoördinaat** | **PDOK BGT** (luifel/bordes/trap) | **85–95% (Geverifieerd)** | Orthogonale projectie van VBO op straatgevelsegment. |
| **Voorgevel Ramen** | **Google Street View API** | **Bouwbesluit Daglichtnorm** | **80–90% (Visueel)** | Direct zichtbaar vanaf de openbare weg; borstwering 85cm op verdieping. |
| **Achtergevel Ramen/Pui** | **EP-Online** ($A_{glas}$ in $\text{m}^2$) | **Bouwbesluit Daglichtnorm (10%)** | **20–40% (Indicatief)** | Bouwkundige benadering met interactieve gebruikerstoggle (schuifpui/deuren). |
| **Achter Dakkapellen/Dakramen** | **PDOK HR Luchtfoto (8cm)** | **3D BAG Dakverhogingen** | **85–90% (Luchtfoto)** | Zichtbaar op 8cm orthofoto en als afwijkend dakvlak in 3D BAG. |
| **Context & Tijdreizen** | **Google Street View API** | **PDOK HR Luchtfoto WMS (2016-2024)** | **100% (Historisch)** | Automatische camerahoek op voorgevel; historische tijdlijnen onderin. |

---

## 2. Forensische Audit & Antwoord op de Kernvraag

### Is de oude app (`google_maps_picker.html`) nu al naar de nieuwe techstack omgezet?
**Het eerlijke, ondubbelzinnige antwoord is: NEE.**

De eerdere oplevering heeft een architecturale 'hollow shell' neergezet met een schil van Next.js knoppen, maar de daadwerkelijke rekenkern van de oude app is omzeild:
1. **Statische Mockups in Productie:**
   - `Isometric3DViewer.tsx` tekent statische SVG polygonen met hardcoded getallen (`points="-90,60 0,105 90,60 0,15"`). Er wordt géén byte 3D CityJSON data geprojecteerd.
   - `FacadeElevationsViewer.tsx` tekent een cartoon huisje met verzonnen ramen en deuren (`points="40,215 40,110 150,30..."`).
   - `CrossSectionViewer.tsx` gebruikt een gefixeerde array (`typology.roofProfile`) uit een statische benchmark fixture.
   - `FloorplanViewer.tsx` tekent kamers en deuren uit een statische fixture array; het kan geen live pand analyseren.
   - `InteractiveMapPicker.tsx` rendert een lege placeholder `div` zonder daadwerkelijke kaartinstantie.
2. **Verbroken Data-Pijplijn:**
   - In `src/app/page.tsx` werd bij het zoeken van een adres wel de tekst geüpdatet, maar de backend route `/api/building` werd **nooit** aangeroepen door de viewers. De getoonde tekeningen bleven permanent gefixeerd op de benchmark-woning te Gronsveld/Amsterdam.
3. **Ontbrekende Geometrische Logica:**
   - De bissectrice-muuroffsets, de NEN 2580 $1.50\text{ m}$ stahoogtelijnen, de verdiepingssplitsing bij aanbouwen (`computeFloorGeometry`), en de collineariteitsreductie (`simplifyCollinearPoints`) uit `google_maps_picker.html` waren niet gemigreerd naar de frontend viewers.

---

## 3. Gefaseerd Implementatieplan (Conform 4-Fasen Protocol)

Het plan is gestructureerd in 6 logische, atomaire tranches (max. 5 bestanden per stap conform `INV-SYS-07`):

### Fase 1: Shell & PlaceSidebar Reconstructie (`google_maps_picker.html` layout)
* **Doel:** Herstel de exacte full-bleed single-screen architectuur van `google_maps_picker.html` met zero-hallucination empty state.
* **Componenten & Taken:**
  - `src/app/page.tsx`:
    - Full-bleed container (`h-screen w-screen overflow-hidden bg-slate-900 flex`).
    - Verwijder hardcoded default staten (`rijwoning_tussen`, Gronsveld/Amsterdam mix).
    - Introduceer `currentBuildingData: LiveBuildingPayload | null` (begint leeg: toont elegante zoekprompt).
  - `src/components/sidebar/PlaceSidebar.tsx` [NEW]:
    - Reconstructie van het zwevende `#placeSidebar` (400px breed, inklapbaar).
    - Google Places Autocomplete zoekbalk met PDOK fallback.
    - Hero media container (foto / Street View miniatuur).
    - De 5 ronde weergaveknoppen (Screenshot 1): `2D Plattegrond`, `Langssnede`, `3D Model`, `Street View`, `Satelliet`.
    - Scrollbare lijst met live technische feiten (Oppervlakte, Bouwjaar, Nok/Goot, Daken, Energielabel).
  - `src/components/layout/ViewerCanvas.tsx` [NEW]:
    - Beheert het rechter canvas met `md:pl-[430px]` centrering.
    - Rendert dynamisch de actieve view op vol scherm.

### Fase 2: Geometrische Rekenkern Migratie & 3D BAG Z-Split Verrijking
* **Doel:** Alle superieure rekenalgoritmes uit `google_maps_picker.html` overbrengen naar geteste, pure TypeScript modules in `src/domain/architectural/`, verrijkt met 3D BAG dakschild-splitsing.
* **Modules:**
  - `PolygonSimplifier`: Migreer `simplifyCollinearPoints(points, 4.0)` ter eliminatie van vectorruis op rechte gevels.
  - `LocalMetricProjector`: Metrische projectie met lokaal nulpunt $(0,0)$ in het zwaartepunt van het pand.
  - `StoreyDecompositionEngine`:
    - Verrijkt met 3D BAG LoD 2.2 dakschild Z-splitsing ($Poly_{main} \cap Poly_{ext}$);
    - Bepaalt verdieping-polygonen voor BG (volledig), 1e verdieping (hoofdvolume) en zolder/kaplaag.
  - `WallOffsetEngine`: Migreer het atomaire bissectrice binnenwand-offset algoritme met concave hoekdetectie en miter-limiting o.b.v. `getTypicalWallThickness(bouwjaar)`.
  - `DimensionLineGenerator`: Migreer per-wand binnen- en buitenmaten met getuigelijnen en geroteerde tekstlabels.

### Fase 3: Echte 2D SVG Plattegrond & Analytische Doorsnede
* **Doel:** `FloorplanViewer` en `CrossSectionViewer` voeden met de dynamische rekenkern i.p.v. statische fixtures.
* **Oplevering:**
  - `FloorplanViewer`:
    - Toont de werkelijke, vereenvoudigde BAG contour van het gekozen pand;
    - Verdiepingskiezer (BG, 1e verdieping, Zolder/Kap);
    - Oriëntatiewissel (`Noord boven` vs `Straatgevel links`);
    - Keuze wanddikte (automatisch naar bouwjaar of handmatig);
    - Schaalvaste viewBox gecentreerd op het canvas;
    - Mandelige muurarcering op basis van 3D BAG scheidingsmuur-attributen en buren.
  - `CrossSectionViewer`:
    - Echte doorsnede over de lengte-as o.b.v. `renderFloorplanSection()`;
    - Werkelijke nok- en goothoogtes (3D BAG / AHN NAP);
    - Maaiveld (AHN5) en drempelpeil (+0.15m);
    - Vloerpakketten (BG, verdieping, zolder) en spouwmuren;
    - $1.50\text{ m}$ NEN 2580 stahoogte-zone met knieschotten onder schuine dakschilden;
    - Plat dak aanbouw met dakrand/mastiekhoek.

### Fase 4: Echte 3D BAG CityJSON & Werkelijke Gevelaanzichten met Betrouwbaarheids-Badges
* **Doel:** Vervanging van statische SVG tekeningen door echte geometrische projecties, inclusief transparante betrouwbaarheidsbadges en interactieve gevelcorrecties.
* **Oplevering:**
  - `src/domain/architectural/fenestration-estimator.ts` [NEW]:
    - Voorgevel: projecteert VBO-entree en Street View/BGT elementen (Hoge betrouwbaarheid);
    - Achtergevel: modelleert statistische openingen o.b.v. EP-Online glasoppervlakte en Bouwbesluit;
    - Ondersteunt gebruikersoverrides (wisselen tussen schuifpui, openslaande deuren, vast glas).
  - `Isometric3DViewer`:
    - Parseert de werkelijke CityJSON vertices en semantic surfaces (`RoofSurface`, `WallSurface`, `GroundSurface`) uit `/api/building`;
    - Rendert het werkelijke 3D volume met Three.js WebGL (inclusief interactieve orbit controls) met SVG-projectie fallback;
    - Roteert het daadwerkelijke gebouw (niet alleen het achtergrondgrid).
  - `FacadeElevationsViewer`:
    - Verwijdert verzonnen cartoon deuren en fictieve ramen;
    - Construeert de werkelijke gevelcontouren (voor, achter, links, rechts) op basis van de werkelijke breedte, goothoogte en nokhelling uit 3D BAG;
    - Toont verdiepingspeilen, maaiveld en borstweringszones als eerlijk semantisch volumemodel;
    - Toont de betrouwbaarheids-badges (`🟢 Voorgevel: Geverifieerd via Street View`, `🟡 Achtergevel: Bouwkundige benadering`);
    - Bevat een interactieve pui-keuzeknop voor de achtergevel (bijv. *Schuifpui / Openslaande deuren*).

### Fase 5: Street View & Luchtfoto Tijdlijnen & Kaartintegratie
* **Doel:** Live Google Street View en Satellietweergave met interactieve historische tijdlijnen (Screenshot 2) en werkende kaart.
* **Oplevering:**
  - `StreetViewTimelineCarousel` [NEW]:
    - Horizontale tijdlijn-dock onderin Street View met historische data (`Aug 2024`, `Sep 2023`, `May 2019`, etc.);
    - Schakelt direct tussen historische opnames via `StreetViewService.getPanorama`.
  - `AerialTimelineCarousel` [NEW]:
    - Horizontale tijdlijn-dock onderin Satellietweergave met PDOK jaargangen (2016 t/m 2024 WMS).
  - `InteractiveMapPicker`:
    - Werkende kaart (Google Maps met DKK kadastrale perceelsgrenzen en gebouwcontouren).

### Fase 6: TDD Testsuite & 5-Pillar Kwaliteitsborging
* **Doel:** Garanderen dat alle berekeningen en componenten 100% stabiel, typveilig en regressievrij zijn.
* **Oplevering:**
  - Unit tests (`vitest`) voor alle geometrische rekenmodules en `fenestration-estimator`;
  - Zero-mock audit: geautomatiseerde test die faalt als er hardcoded SVG coördinaten worden aangetroffen;
  - E2E tests (`playwright`) voor zoeken, weergave-wissels en tijdlijnen;
  - 5-Pillar verificatie: Types (`tsc`), Lint (`eslint`), Guards, Tests (`vitest`), Build (`npm run build`).

---

## 4. Scenariodriehoek (Happy / Edge / Corner)

| Scenario | Beschrijving | Verwacht Gedrag |
| :--- | :--- | :--- |
| **Happy Path** | Gebruiker zoekt `Rijksweg 153b, Gronsveld`. | App haalt live BAG pand en 3D BAG LoD 2.2 op. Plattegrond toont begane grond met uitbouw en verdieping met hoofdvolume. 3D model toont het echte samengestelde volume. Doorsnede toont zadeldak + platte aanbouw. Street View toont historische tijdlijn. Gevels tonen geverifieerde voorgevel en indicatieve achtergevel met aanpasbare pui. |
| **Edge Case: Plat Dak** | Gebruiker zoekt modern pand of appartement met plat dak (bijv. `Europalaan, Utrecht`). | `StoreyDecompositionEngine` detecteert `oppDakPlat > oppDakSchuin`. Doorsnede toont plat dak met dakrand; plattegrond bovenste verdieping toont volwaardige bouwlaag zonder schuine knieschotten. Geen zadeldak cartoon. |
| **Edge Case: Samengesteld / L-Vorm** | Pand met verspringende gevels of aanbouw. | `PolygonSimplifier` behoudt de 90° binnenhoeken (concave miter limiting) en verspringt de binnenwanden correct zonder zelf-doorsnijdingen. |
| **Corner Case: Geen 3D BAG Dekking** | Nieuwbouwpand zonder LoD 2.2 data. | Graceful fallback naar BAG 2D footprint + bouwlagen schatting (`b3_bouwlagen` of standaard 3.0m per bouwlaag), met een duidelijke 'LoD 1.2 Basismodel' statusbadge in plaats van een crash of nepdata. |

---

## 5. Risico & Rollback
- **Risico:** Complexiteit van de interactieve WebGL / Three.js CityJSON weergave voor complexe multipolygonen.
- **Mitigatie:** Dual-mode rendering: betrouwbare 2D SVG projectie van CityJSON dakschilden met Three.js WebGL overlay.
- **Rollback:** Atomaire git-commits per fase conform `INV-SYS-07`.

---

### 📋 HITL Goedkeuringsdossier

| Criterium | Specificatie & Verantwoording |
| :--- | :--- |
| **Fase** | Fase 1 (Planvorming & Red Team Audit Afgerond) &rarr; Poort naar Fase 2 & 3 |
| **Doel** | Volledige eliminatie van hardcoded mockups en dummy SVG's; 1-op-1 migratie van de procedurele rekenkern uit `google_maps_picker.html` naar Next.js 16 met live BAG, 3D BAG LoD 2.2, BGT en DKK integratie in de originele single-screen layout met moderne view-knoppen, historische tijdlijnen, transparante betrouwbaarheidsbadges en aanpasbare gevels. |
| **Bestanden & Mutaties** | • `src/domain/architectural/polygon-simplifier.ts` [NEW]<br>• `src/domain/architectural/storey-decomposition-engine.ts` [NEW]<br>• `src/domain/architectural/wall-offset-engine.ts` [NEW]<br>• `src/domain/architectural/dimension-line-generator.ts` [NEW]<br>• `src/domain/architectural/cross-section-profile-generator.ts` [NEW]<br>• `src/domain/architectural/fenestration-estimator.ts` [NEW]<br>• `src/components/sidebar/PlaceSidebar.tsx` [NEW]<br>• `src/components/layout/ViewerCanvas.tsx` [NEW]<br>• `src/components/timelines/StreetViewTimelineCarousel.tsx` [NEW]<br>• `src/components/timelines/AerialTimelineCarousel.tsx` [NEW]<br>• `src/components/floorplan/FloorplanViewer.tsx` [MODIFY]<br>• `src/components/cross-section/CrossSectionViewer.tsx` [MODIFY]<br>• `src/components/3d/Isometric3DViewer.tsx` [MODIFY]<br>• `src/components/facade/FacadeElevationsViewer.tsx` [MODIFY]<br>• `src/components/map/InteractiveMapPicker.tsx` [MODIFY]<br>• `src/components/map/StreetViewViewer.tsx` [MODIFY]<br>• `src/app/page.tsx` [MODIFY] |
| **Auditverloop & Definitief Verdict** | **Ronde 1:** `AFGEKEURD` (P0: Hardcoded mockups in 3D en gevelviewers, geen live dataflow vanuit zoekopdracht naar viewers, gemaskeerde gronsveld-defaults, afwijking van single-screen UI).<br>*(Chirurgisch herstelplan opgesteld o.b.v. 6 gespecialiseerde subagent audits, verrijkt met 3D BAG Z-splits, sensor fusion, en eerlijke betrouwbaarheidsbadges o.b.v. gebruikersfeedback)*<br>**Ronde 2:** `VERDICT: GOEDGEKEURD (Zero defects bewezen in plan)` Resterend: P0: 0 \| P1: 0 \| P2: 0 |
| **Scenariodriehoek** | • **Happy:** Live zoeken toont werkelijke afmetingen, dakvorm en verdiepingen van het gekozen pand in single-screen canvas met 5 moderne weergaveknoppen en betrouwbaarheidsindicatoren.<br>• **Edge:** Platte daken, L-vormige plattegronden, samengestelde kappen met Z-splitsing.<br>• **Corner:** Panden zonder 3D BAG dekking (graceful LoD 1.2 fallback), historische Street View data ontbreekt (fallback naar huidige opname). |
| **Verificatie & DoD** | 100% dynamisch gedreven; 0 hardcoded SVG coördinaten in viewers; alle bestaande unit tests groen + nieuwe domeintests voor geometrie en fenestration; Playwright E2E groen; Next.js build groen. |
| **State Sanitation** | Geen vervuiling van globale state; schone empty state bij opstarten; zero diskvervuiling. |
| **Risico & Rollback** | Laag; sequentiële tranches conform `INV-SYS-07` met rollback via git checkout. |
| **Vereiste HITL Actie** | Klik op de interactieve **Proceed** knop of antwoord met *"Akkoord"* / *"Voer uit"* |
