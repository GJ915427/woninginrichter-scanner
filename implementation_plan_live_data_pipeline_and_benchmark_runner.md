# Implementatieplan: 100% Robuuste Live Data Pipeline & Dynamische Referentieverificatie

## 1. Probleemanalyse & Doelstelling
De recente audit heeft aangetoond dat de huidige referentiedataset (`benchmark-ground-truth-130.json`) weliswaar over hoogwaardige Floorplanner verdiepingsplattegronden beschikt, maar dat de inputdata (`telemetry_input`) kunstmatig is gevuld met de begane-grondcontour uit de tekening zelf. Hierdoor test de benchmark momenteel niet of onze rekencomponenten op basis van **echte, live openbare overheidsdata** zelfstandig tot dezelfde tekening kunnen komen.

Bovendien zijn in de live data pipeline van de applicatie (`/api/building` en onderliggende clients) cruciale hiaten geconstateerd:
1. **Verblijfsobjecten (VBO) & Voordeuren breuk:** In `/api/building` wordt `bagClient.getVbosForPand(pandId)` aangeroepen, wat een runtime `TypeError` veroorzaakt omdat deze methode niet bestaat. De bestaande methode `getVerblijfsobjectenByPand` in `KadasterBagClient` gebruikt bovendien een ongeldige queryparameter (`?pandidentificatie=`), wat leidt tot HTTP 400 Bad Request. Hierdoor worden voordeurpunten en gebruiksoppervlaktes nooit geretourneerd.
2. **EP-Online (Energielabel) overgeslagen bij pandklik:** Het energielabel wordt momenteel alleen opgevraagd als de frontend expliciet `postcode` en `huisnummer` meestuurt in de queryparameters. Bij pandselectie via kaartklik of pandId blijft het energielabel ten onrechte leeg.
3. **Kadaster DKK (Digitale Kadastrale Kaart / Perceelgrenzen) ontbreekt:** Er is geen client voor de DKK WFS v5_0 van het Kadaster (`kadastralekaart:Perceel` en `kadastralekaart:KadastraleGrens`), waardoor erfgrenzen, mandeligheid en perceelsgrootte niet bepaald kunnen worden.
4. **BGT Erfscheidingen & Terrein:** Schuttingen/keermuren (`scheiding`) en onbegroeid terrein (`onbegroeidterreindeel`) worden nog niet uitgevraagd.

### Doelstelling
1. De Live Data Pipeline transformeren naar een **100% complete, foutloze en robuuste overheidsdata-aggregator** die live alle relevante open data (BAG, 3D BAG, AHN, BGT, DKK, EP-Online) binnenhaalt.
2. Een **Live Pipeline Evaluator & Benchmark Runner** introduceren die voor referentie-adressen real-time de live data pipeline doorloopt, de gebouwgeometrie en verdiepingen berekent via onze componenten, en het resultaat vergelijkt met de referentiedata (zonder statische data te bakken in de test).

---

## 2. Architecturaal Ontwerp

### 2.1 Unificatie van het Live Data Pipeline Contract
Elke aanroep naar de live pipeline (`/api/building` en de interne evaluator) levert een compleet datamodel op:
```typescript
interface UnifiedBuildingData {
  pandId: string;
  bag: {
    identificatie: string;
    status: string;
    bouwjaar: number;
    oppervlakte: number;
    geometrieRD: Polygon2D;
    vboHrefs: string[];
  };
  vbos: Array<{
    identificatie: string;
    oppervlakte: number;
    gebruiksdoel: string;
    status: string;
    adres: {
      straatnaam: string;
      huisnummer: number;
      huisletter?: string;
      toevoeging?: string;
      postcode: string;
      woonplaats: string;
    };
    entrancePointRD: [number, number];
    entrancePointWgs84: [number, number];
  }>;
  cityJson: CityJSON3DModel | null; // 3D BAG LoD 2.2 daken, nok, goot
  ahn: AHNElevationResult;          // Maaiveldhoogte NAP (3D BAG datum of WMS fallback)
  bgt: {
    installaties: BgtGebouwInstallatie[];
    bomen: BgtVegetatieObject[];
    wegdelen: BgtWegdeel[];
    scheidingen: BgtScheiding[];
    terreindelen: BgtTerreindeel[];
  };
  kadaster: {
    perceel: KadasterPerceel | null;
    grenzen: KadasterGrens[];
  };
  neighbors: BagBuildingData[];
  epOnline: EpOnlineResult | null;
}
```

### 2.2 Herstel van VBO & Voordeurresolutie (Kadaster BAG OGC API v2)
- Het Pand-object in de Kadaster BAG API bevat in `feature.properties['verblijfsobject.href']` een array met directe REST-URL's naar alle gekoppelde verblijfsobjecten.
- `KadasterBagClient` krijgt de methode `getVerblijfsobjectenForPand(pandId: string, vboHrefs?: string[])`. Deze methode haalt parallel de gekoppelde VBO-documenten op.
- Per VBO wordt de exacte puntgeometrie (ingang/voordeur) in RD geëxtraheerd en wordt het adres (postcode, huisnummer, straat) gekoppeld.

### 2.3 Kadaster DKK Client (WFS v5_0)
- `KadasterDkkClient` bevraagt `https://service.pdok.nl/kadaster/kadastralekaart/wfs/v5_0`.
- Ondersteunt bevraging op basis van een bounding box in RD (`EPSG:28992`).
- Haalt `kadastralekaart:Perceel` op (kadastrale aanduiding, grootte en perceelpolygoon) en `kadastralekaart:KadastraleGrens` (erfgrenzen).
- Stelt het domeinmodel in staat om mandelige gevels te identificeren door de pandgeometrie te snijden met de perceelgrenzen.

### 2.4 Dynamische EP-Online Resolutie
- Als `postcode` en `huisnummer` ontbreken in de request-parameters, worden deze automatisch ontleend aan het primaire verblijfsobject van het pand.
- Vervolgens wordt `epClient.getLabel(postcode, huisnummer, toevoeging)` parallel opgeroepen.

### 2.5 Live Pipeline Benchmark Evaluator
- `LivePipelineEvaluator` maakt het mogelijk om voor elk referentieadres programmatisch de live data op te halen.
- Vertaalt de `UnifiedBuildingData` naar de invoer voor `FloorGeometryCalculator`.
- Berekent de verdiepingsplattegronden en toetst de geometrische overeenkomst (IoU $\ge 0.95$, Hausdorff $\le 0.20$m) met de Floorplanner grondwaarheid.

---

## 3. Bestanden & Mutaties

### Sub-Fase 3A: Herstel & Completering Core Overheidsdata (BAG VBO, DKK & EP-Online)

| Bestand | Mutatie | Target Symbolen / Secties | Verificatie Testcases | Verantwoording |
| :--- | :---: | :--- | :--- | :--- |
| `src/data/bag/kadaster-bag-client.ts` | `[MODIFY]` | `KadasterBagClient.getVerblijfsobjectenForPand`, `vboHrefs` extractie in `getPandById` | VM-PIPE-01 | Zorgt voor betrouwbare VBO-ophaling via `verblijfsobject.href` zonder 400-fouten. |
| `src/data/kadaster/kadaster-dkk-client.ts` | `[NEW]` | `KadasterDkkClient`, `getPerceelByBbox`, `getKadastraleGrenzen` | VM-PIPE-02 | Integreert de Kadastrale Kaart WFS v5_0 voor perceelgrenzen en mandeligheidsanalyse. |
| `src/data/bgt/pdok-bgt-client.ts` | `[MODIFY]` | `getScheidingen`, `getTerreindelen` | VM-PIPE-03 | Breidt BGT uit met schuttingen/muren (`scheiding`) en tuinen/erven (`onbegroeidterreindeel`). |
| `src/app/api/building/route.ts` | `[MODIFY]` | Integratie `getVerblijfsobjectenForPand`, auto EP-Online koppeling, DKK perceelsgrenzen | VM-PIPE-04 | Garandeert een 100% compleet API-antwoord met alle open data bronnen. |
| `tests/unit/data/live-pipeline-clients.test.ts` | `[NEW]` | Testsuite voor BAG VBO, DKK WFS, BGT scheidingen en auto-EP label | VM-PIPE-01 t/m 04 | Mechanische verificatie van alle data clients onder normale en storingscondities. |

### Sub-Fase 3B: Live Pipeline Verificatie Runner & Geometrie Integratie

| Bestand | Mutatie | Target Symbolen / Secties | Verificatie Testcases | Verantwoording |
| :--- | :---: | :--- | :--- | :--- |
| `src/domain/pipeline/live-pipeline-evaluator.ts` | `[NEW]` | `LivePipelineEvaluator.evaluateAddress`, `transformToTelemetryInput` | VM-PIPE-05 | Aggregeert live openbare data en bereidt deze voor op berekening door de geometrie-engine. |
| `src/domain/legacy/floor-geometry-calculator.ts` | `[MODIFY]` | Integratie VBO voordeuroriëntatie en DKK erfgrenzen in verdiepingsuitsnijding | VM-PIPE-06 | Verrijkt de vloerberekening met exacte voordeur- en erfgrenzenvectoren. |
| `tests/integration/live-pipeline-benchmark.test.ts` | `[NEW]` | End-to-end integratietest voor dynamische verificatie van referentieadressen | VM-PIPE-07 | Toetst live opgehaalde open data tegen de Floorplanner referentiedataset. |
| `package.json` | `[MODIFY]` | Script `"test:pipeline"` | VM-PIPE-08 | Registreert het gestandaardiseerde evaluatiecommando in CI/CD. |
| `README.md` | `[MODIFY]` | Sectie "Openbare Data Pipeline & Live Verificatie" | VM-PIPE-09 | Documenteert de architectuur en de werking van de live pipeline evaluator. |

---

## 4. Verificatiematrix (5-Koloms)

| ID | Testcase / Scenario | Input / Conditie | Verwachte Uitkomst | Verificatiemethode |
| :--- | :--- | :--- | :--- | :--- |
| **VM-PIPE-01** | VBO ophalen via `verblijfsobject.href` | Pand `0905100000018803` met 1 VBO | Retourneert VBO met GO $173\text{m}^2$, adres en exacte voordeurcoördinaat RD. | Unit test met fetch mock. |
| **VM-PIPE-02** | Kadaster DKK WFS v5_0 bevraging | Bbox rondom pand | Retourneert `kadastralekaart:Perceel` met sectie, nummer en perceelpolygoon. | Unit test met WFS XML mock. |
| **VM-PIPE-03** | BGT Scheidingen en Terreindelen | Bbox met schutting en tuin | Retourneert BGT-objecten met geometrie en typering (`tuin`, `erf`, `muur`). | Unit test met OGC JSON mock. |
| **VM-PIPE-04** | `/api/building` auto-EP lookup | Aanroep met alleen `pandId` (geen postcode) | VBO-adres wordt afgeleid; `epOnline` wordt automatisch gevuld. | API route integratietest. |
| **VM-PIPE-05** | Live Pipeline Evaluator | Adres `Singel 13, Bussum` | Haalt live BAG, VBO, 3D BAG en AHN op en genereert valide geometrie-input. | Integratietest. |
| **VM-PIPE-06** | DKK Erfgrens & Voordeur integratie | Pand met mandelige zijmuur | Berekent mandeligheid op basis van DKK erfgrens en voordeur op VBO-punt. | Domein rekenmodel test. |
| **VM-PIPE-07** | Dynamische Verificatie Referentiepand | Referentiepand uit de set | Berekende plattegrond behaalt $\text{IoU} \ge 0.95$ t.o.v. de Floorplanner referentievloer. | Benchmark test. |
| **VM-PIPE-08** | Vitest Testsuites & Regressie | Volledige testsuite (`npm test`) | 100% groen over alle suites (>200 tests). | Vitest runner. |
| **VM-PIPE-09** | Next.js Productie Build | `npm run build` | Foutloze Turbopack build en statische page data generatie. | Next.js compiler. |

---

## 5. De Scenariodriehoek

### 5.1 Happy Scenario
Een gebruiker of de evaluatierunner vraagt een adres op (bijv. `Rijksweg 153B Gronsveld` of `Singel 13 Bussum`). De live data pipeline bevraagt in parallel de Kadaster BAG (pand en VBO via `verblijfsobject.href`), TU Delft 3D BAG (dakvlakken LoD 2.2), PDOK AHN (maaiveldhoogte NAP), PDOK BGT (wegdelen, bomen, installaties, scheidingen) en Kadaster DKK (perceelgrens). Alle velden worden binnen 300 ms geaggregeerd. De geometrie-engine berekent direct de verdiepingscontouren met de echte voordeur en mandelige erfgrenzen, met een $\text{IoU} \ge 0.95$ t.o.v. de referentiedata.

### 5.2 Edge Scenario
1. **Pand met meerdere verblijfsobjecten (appartementencomplex / winkel-woning):**
   De pipeline haalt alle gekoppelde VBO's op via de href-array. Het hoofdadres wordt geselecteerd voor het energielabel, en alle ingangspunten worden geretourneerd.
2. **Onbekend/afwijkend perceel in DKK:**
   Wanneer een perceel nog niet is bijgewerkt in de DKK of buiten de actuele WFS-uitsnede valt, vangt `KadasterDkkClient` de fout defensief op en valt de erfgrensdetectie terug op BGT-wegdelen en naburige BAG-panden zonder dat de pipeline blokkeert.

### 5.3 Corner Scenario
1. **Netwerkfout / Timeout bij TU Delft of PDOK:**
   Als 3D BAG of DKK niet tijdig reageert ($>2000$ ms), vallen de clients terug op de AHN WMS en 2D BAG footprints via `AbortSignal.timeout`, waardoor `/api/building` gegarandeerd binnen de acceptabele responstijd blijft en nooit crasht.
2. **Geen energielabel geregistreerd in EP-Online:**
   Wanneer EP-Online een 404 retourneert (geen geregistreerd label), retourneert de pipeline netjes `epOnline: null` zonder de rest van de bouw- en geometriedata te verstoren.

---

## 6. Verificatieplan & DoD

1. **TypeScript Compilatie:** `npx tsc --noEmit` $\rightarrow$ 0 fouten.
2. **Linting:** `npx eslint . --max-warnings 0` $\rightarrow$ 0 fouten en 0 warnings.
3. **Vitest Unit & Integratietesten:** `npm test` $\rightarrow$ alle suites (>200 tests) 100% groen.
4. **Live Pipeline Benchmark:** `npm run test:pipeline` $\rightarrow$ slaagt met dynamische verificatie.
5. **Productie Build:** `npm run build` $\rightarrow$ 100% succesvol met Next.js Turbopack.
6. **Zero Test Drift:** Geen versoepeling van bestaande tests conform INV-GOV-18.

---

## 7. State Sanitation & Rollback

- **State Sanitation:** Geen statische mockdata in de broncode. Alle tijdelijke testdata geïsoleerd in `.cache/` of in-memory.
- **Rollback:** Directe terugdraaiing via `git restore` en `omni_write_tool`.
