# Woninginrichter 3D & IMU Scanner WebApp
*Mobiele video- en sensordata recorder voor 3D reconstructie en plattegronden*

Deze webapplicatie is speciaal ontworpen om op elke moderne smartphone (Android én iPhone) tegelijkertijd videobeelden en hoogfrequente bewegings- en zwaartekrachtsensoren (IMU) op te nemen.

---

## 🌐 Live Website (Direct te openen op je smartphone)

De webapplicatie is direct via HTTPS bereikbaar op:  
👉 **[https://gj915427.github.io/woninginrichter-scanner/](https://gj915427.github.io/woninginrichter-scanner/)**

> **Eenmalig GitHub Pages aanzetten (kost 10 seconden):**  
> 1. Ga naar [Repository Settings > Pages](https://github.com/GJ915427/woninginrichter-scanner/settings/pages).  
> 2. Kies onder **Build and deployment** bij **Branch**: `main` en map `/ (root)`.  
> 3. Klik op **Save**.  
> Binnen 1 minuut is de link live op je smartphone!

---

## 📱 Functionaliteiten op je Smartphone

1. **Achtercamera Viewfinder:** Volledig scherm met continue autofocus.
2. **Realtime IMU Sensor Logging (60Hz - 100Hz):**
   - Lineaire versnelling ($X, Y, Z$ in $m/s^2$)
   - Gyroscoop rotatiesnelheid ($\alpha, \beta, \gamma$)
   - Zwaartekrachtvector (weet exact wat verticaal/horizontaal is)
3. **Visuele Hoekbegeleiding (Pitch HUD):** Toont live of je de camera in de optimale hoek van 10° tot 20° omlaag houdt (voor gelijktijdige detectie van vloerplinten en kozijnen).
4. **Kant-en-klaar Exportpakket (.zip):**
   Zodra je stopt, pakt de app op je telefoon direct een `.zip` bestand in met:
   - `scan_video.mp4` (of `.webm`)\n   - `sensor_log.json` (alle metingen met timestamps)
   - `sensor_log.csv` (direct te openen in Excel of Python)
   - `metadata.json` (resolutie, framerate, opnameduur)

---

## 🏛️ Canonieke 130-Panden Ground-Truth Benchmark (Floorplanner FML & BAG)

Het project beschikt over een onafhankelijke, dubbelblinde referentie-testsuite gebaseerd op officiële inmeettekeningen (Floorplanner FML / NEN 2580 meetrapporten van bureaus zoals Zibber en 123meten) en Kadaster BAG data:

### MECE Typologische Verdeling (Exact 130 Panden)
- **35 Tussenwoningen:** Rijtjeshuizen uit diverse bouwjaren (1906–2022), met en zonder aanbouw (o.a. Singel 13 Bussum, project `21000075`).
- **25 Hoekwoningen:** Panden met gevelsprongen, zijramen, tuin-setbacks en zij-ingangen/aanbouwen.
- **25 Twee-onder-één-kap woningen:** Woningen met verspringende garages (voorgevelrooilijn setback) en achterbouwen.
- **20 Vrijstaande woningen & villa's:** Vrijstaande panden met royale footprints en meerdere bouwlagen.
- **15 Appartementen / maisonnettes:** Stedelijke woonlagen en twee-laags maisonnettes.
- **10 Samengestelde panden:** Historische panden met schuine erfgrenzen en samengestelde contouren.

### Dubbelblinde Architectuur & Bipartiete Isolatie
De rekenmodule (`computeFloorGeometry`) ontvangt tijdens runtime **uitsluitend** openbare kadastrale telemetry (`telemetry_input` met 2D BAG footprint en BAG VBO ingangscoördinaat). De werkelijke meettekeningen (`ground_truth_floors`) blijven hermetisch afgeschermd en worden uitsluitend achteraf gebruikt voor objectieve geometrische toetsing.

### Rotatie-invariante Verificatie & Kwaliteitseisen
Via `PolygonSimilarityEngine.calculateRotationInvariantSimilarity` worden berekende contouren getoetst tegen de FML grondwaarheid op:
- **Intersection over Union (IoU):** $\ge 0.95$ (95%)
- **Bidirectionele Hausdorff-afstand:** $\le 0.20\text{m}$ (20 cm)
- **NEN 2580 / BBMI Oppervlakte Koppelingsgarantie:** $\le 5.0\%$ (maximaal toelaatbare afwijking tussen gemeten FML GO en officiële BAG VBO GO conform de Waarderingskamer norm).

### Uitvoeren van de Benchmark & Ingestie
```bash
# Offline benchmark referentietest (< 150ms in Vitest)
npm run test:benchmark

# Authentieke referentie-ingestie runner (3-traps Funda/Floorplanner harvester)
npm run harvest:reference
```
*Draait offline in Vitest in $< 100\text{ms}$ zonder externe netwerkafhankelijkheden.*

---

## 🏛️ Live Openbare Data Pipeline & Dynamische Verificatie

Naast de statische offline-benchmark beschikt de architectuur over een **100% dynamische Live Data Pipeline** die bij elke pandevaluatie alle openbare overheidsdata live aggregeert:
1. **Kadaster BAG 2.0 (OGC API v2):** 2D pandgeometrie (RD), bouwjaar, status en officiële verblijfsobjecten (VBO) via `verblijfsobject.href` met exacte voordeurcoördinaten en GO-oppervlaktes.
2. **TU Delft 3D BAG (LoD 2.2 CityJSON):** 3D dakvlakken, individuele nok- en goothoogtes, dakvormen en maaiveldhoogte.
3. **PDOK AHN (Actueel Hoogtebestand Nederland - WMS):** Betrouwbare NAP-maaiveldhoogte fallback met 2000ms `AbortSignal.timeout` guard.
4. **Kadaster DKK (Digitale Kadastrale Kaart - WFS v5_0):** Echte kadastrale percelen (`kadastralekaart:Perceel`) en erfgrenzen (`kadastralekaart:KadastraleGrens`) voor mandeligheid en perceelsoppervlakte.
5. **PDOK BGT (Basisregistratie Grootschalige Topografie):** Openbare wegdelen (rijbanen, trottoirs), erfscheidingen (`scheiding_lijn`), tuinen/erven (`onbegroeidterreindeel`) en bomen.
6. **RVO EP-Online:** Definitief energielabel (A++++ t/m G) gekoppeld via het primaire VBO-adres.

### Uitvoeren van de Live Pipeline Benchmark
```bash
npm run test:pipeline
```
*Toetst referentieadressen real-time via de live pipeline en verifieert de berekende verdiepingen tegen de grondwaarheid zonder data statisch op te slaan.*


