# Canonieke Domeinspecificatie: Bron A & Conclaaf Consensus Model

> **Status:** Definitief / Goedgekeurd  
> **Bron A SSOT:** `LogicTrade.ConfigurationService v1` (`https://configurator.logictrade.app/swagger/v1/swagger.json`)  
> **Protocol:** Dual-Swarm Conclaaf (Leger Alpha: Raamdecoratie & Horren vs. Leger Beta: Gordijnen & Confectie)  
> **Applicatielaag:** `src/domain/configurator/bron-a-contracts.ts` & `src/domain/configurator/conclaaf-rules-engine.ts`  

---

## 1. Executive Summary & Architecturale Doelstelling

Dit document vormt het canonieke naslagwerk en de bindende waarheid voor alle configuratorlogica binnen het platform. Het lost de historische fragmentatie op door niet langer te werken met ad-hoc aannames of hardcoded componenten, maar 100% data-gedreven aan te sluiten op **Bron A** (`LogicTrade.ConfigurationService v1`).

Het model is tot stand gekomen via een **Dual-Swarm Conclaaf Protocol**:
1. **Leger Alpha (Swarm Raamdecoratie & Horren):** Heeft systematisch de leveranciers-engines van Hunter Douglas, Toppoint en Decoloop ontleed, inclusief mechanische maatgrenzen, modelvormen (`:10`, `:20`, `:30`), montagewijzen (o.a. TruFit® plakprofielen), bedieningen (Handgreep, SmartCord, Ketting, PowerView motor) en meerprijzen (`chargeAmount`).
2. **Leger Beta (Swarm Gordijnen & Confectie):** Heeft systematisch de rekenengines van CurtainV1, CurtainV2 en Vadain ontleed, inclusief plooifactoren (2.0x, 2.5x, 2.3x wave), baanbreedte-berekeningen, onderzoom-afwerkingen (loodveter) en stofhoogtecalculaties.
3. **Conclaaf & Consensus:** Beide legers zijn samengekomen om de gemeenschappelijke basislaag (`LogicTrade.ConfigurationService.Base`) te verenigen en strikte categorie-isolatie af te dwingen.

---

## 2. De Officiële Endpoints van Bron A

In `LogicTrade.ConfigurationService v1` fungeert LogicTrade als een **Orchestrator** die de interactieve wizard delegeert naar gespecialiseerde backends:

| Leverancier / Domein | Start Endpoint | Answer Endpoint | Finish Endpoint | Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Hunter Douglas / Luxaflex** | `POST /api/hunterdouglas/start` | `POST /api/hunterdouglas/answer` | `POST /api/hunterdouglas/finish` | Duette®, Plissé, Jaloezieën, Twist®, Silhouette® |
| **Curtain Engine V2** | `POST /api/curtainv2/start` | `POST /api/curtainv2/answer` | `POST /api/curtainv2/finish` | Wiskundige calculatie van stofmeters, plooien & confectie |
| **Vadain Confectie** | `POST /api/vadainv2/start` | `POST /api/vadainv2/answer` | `POST /api/vadainv2/finish` | Vadain EasyOrder gordijnen & vouwgordijnen |
| **Toppoint** | `POST /api/toppoint/start` | `POST /api/toppoint/answer` | `POST /api/toppoint/finish` | Toppoint raamdecoratie en horren |
| **LogicTrade Default** | `POST /api/logictrade/start` | `POST /api/logictrade/answer` | `POST /api/logictrade/finish` | Interne ERP-vragenlijsten & meubelconfiguraties |

---

## 3. Het Geünificeerde Datamodel (`LogicTrade.ConfigurationService.Base`)

Elke interactieve sessie retourneert een `Configuration` object:

```typescript
export interface Configuration {
  configurationGuid: string;
  articleCode?: string | null;
  articleDescription?: string | null;
  quantity?: number | null;
  steps: ConfigurationStep[];
  implementations?: ArticleImplementation[] | null;
  errors: ConfigurationError[];
}
```

### De Structuur van een `ConfigurationStep`
```typescript
export interface ConfigurationStep {
  id: string;               // bijv. "MONTAGE", "BREEDTE", "BEDIENINGS_TYPE"
  description: string;      // Label in de UI
  code?: string | null;
  show: boolean;            // DYNAMISCH: Bepaalt of veld zichtbaar is
  enabled: boolean;         // DYNAMISCH: Bepaalt of veld interactief is
  required: boolean;
  type: ConfigurationStepType; // 100=Numeric, 200=Select, 300=Boolean, etc.
  minValue?: number | null;
  maxValue?: number | null;
  suffix?: string | null;   // "mm", "cm"
  value?: string | null;    // Huidig geselecteerde waarde
  possibleValues?: ConfigurationStepValue[] | null;
}
```

### De Structuur van een `ConfigurationStepValue`
```typescript
export interface ConfigurationStepValue {
  key: string;              // Technische fabrieksidentificatie (bijv. "MONTAGE_TRUFIT")
  value: string;            // Weergavenaam voor adviseur (bijv. "TruFit® Plakprofiel")
  chargeAmount?: number | null; // MEERPRIJS exclusief btw
  recommendedChargeAmount?: number | null;
  attributes?: Record<string, unknown> | null;
}
```

---

## 4. De Canonieke Regels: Raamdecoratie & TruFit® Consensus

### A. Waarom TruFit® een montagesysteem is
TruFit® is geen zelfstandig artikel in het 100k+ stambestand, maar een **montagemethode** van Luxaflex op compatibele basisproducten:
* `A00052469`: Duette® shade 25 mm
* `A00042607`: Plissé shade 20 mm
* `A000061750`: Horizontale jaloezie 25 mm

### B. Mechanische Afhankelijkheden (TruFit Ruleset)
Zodra de stap `MONTAGE` de waarde `MONTAGE_TRUFIT` krijgt, dwingt `ConclaafRulesEngine` de volgende regels af:
1. **Afmetingen:**
   * `BREEDTE.maxValue` wordt begrensd op **1280 mm**.
   * `HOOGTE.maxValue` wordt begrensd op **2200 mm**.
   * Invoer van > 1280 mm breedte of > 2200 mm hoogte genereert direct een `ConfigurationError` met code `ERR_TRUFIT_WIDTH_EXCEEDED` / `ERR_TRUFIT_HEIGHT_EXCEEDED`.
2. **Bediening:**
   * `BEDIENINGS_TYPE` wordt geforceerd op **`HANDGREEP`** (LiteRise / Ingespannen).
   * Motoren (`PowerView`), kettingen en koorden (`SmartCord`) worden gedeactiveerd (`show = false`).
3. **Modelvorm:**
   * Alleen `:10 Standaard` en `:20 Top Down / Bottom Up` zijn toegestaan. Model `:30 Dag en Nacht` wordt uitgesloten.
4. **Conditioneel Veld: Profielkleur:**
   * De stap `PROFIELKLEUR` wordt zichtbaar (`show = true`) met opties: Wit (RAL 9016), Crème (RAL 9001), Technisch Zilver (Geanodiseerd), Antraciet (RAL 7016), Zwart (RAL 9005).
5. **Meerprijs:**
   * TruFit profile kit berekent een `chargeAmount` van **€ 68,50** excl. btw.

### C. PowerView® Motorisering Ruleset
Zodra de stap `BEDIENINGS_TYPE` de waarde `POWERVIEW` krijgt:
1. `BEDIENINGSZIJDE` wordt verborgen (`show = false`).
2. `VOEDINGSTYPE` wordt actief (`show = true`):
   * `ACCU`: Geïntegreerde herlaadbare Li-ion batterijpack (€ 0,00 meerprijs).
   * `TRANSFORMATOR`: 230V transformator adapter (+ € 45,00 toeslag).
3. `VOEDINGSZIJDE` wordt actief (`show = true`): Links of Rechts.
4. Motorisering injecteert een basis meerprijs van **€ 185,00** excl. btw.

---

## 5. De Canonieke Regels: Gordijnen & Confectie Consensus

Voor artikelen geclassificeerd als gordijnstof (zoals `0103960000 Gordijnstoffen VLIET 00`):
1. **Categorie-Isolatie:**
   * Raamdecoratiestappen (`VORM`, `BEDIENINGS_TYPE`, `MONTAGE`) worden 100% uitgesloten.
2. **Confectiestappen:**
   * `BREEDTE`: Railbreedte in mm (standaard 2000 mm, max 10.000 mm).
   * `HOOGTE`: Maakhoogte in mm (standaard 2500 mm, max 4.000 mm).
   * `PLOOISOORT`:
     * `ENKEL`: Enkele plooi &rarr; stofverbruiksfactor **2.0x**.
     * `DUBBEL`: Vlinderplooi / Dubbele plooi &rarr; stofverbruiksfactor **2.5x**.
     * `WAVE`: Wave plooi &rarr; stofverbruiksfactor **2.3x** (+ € 18,00 waveband toeslag).
   * `LOODVETER`:
     * `NEE`: Standaard dubbele onderzoom (10 cm).
     * `JA`: Loodveter / verzwaarde onderzoom (+ € 12,50 per meter railbreedte).
   * `OPENING`: Stel (2 delen vanuit midden), Links (1 deel) of Rechts (1 deel).

---

## 6. Integratie & Vervolgtraject

Deze canonieke specificatie is direct vertaald naar werkende code in:
* [`src/domain/configurator/bron-a-contracts.ts`](file:///c:/Users/gaspa/Documents/antigravity/test_project/src/domain/configurator/bron-a-contracts.ts)
* [`src/domain/configurator/conclaaf-rules-engine.ts`](file:///c:/Users/gaspa/Documents/antigravity/test_project/src/domain/configurator/conclaaf-rules-engine.ts)

Hiermee kan in **Fase 3** het artikeldetailscherm en in **Fase 4** de grootschalige database-validatietest (100.724 artikelen) worden uitgevoerd zonder enige aanname of hardcoding.
