# Domein- en Procesmodel Woninginrichting (EasyM2M)

> **Het Doel:**  
> *"Een tevreden klant die blij is met het eindresultaat én de wijze waarop dit resultaat tot stand is gekomen."*  
>   
> **Missie & Ketenbelofte:**  
> *"Hét foutloze ketendossier voor maatwerk in de woninginrichting — van de eerste kennismaking op de winkelvloer tot de digitale opleverhandtekening na montage."*  
>   
> In de maatwerkinrichting kost elke fout en elke miscommunicatie geld, tijd en ergernis.  
> Met EasyM2M:  
> • **Geen meetfouten** — wél millimeterprecisie direct naar de fabriek.  
> • **Geen miscommunicatie** — wél foto's en instructies per montageplek.  
> • **Geen discussies achteraf** — wél een sluitend dossier met getekende oplevering.

---

## Deel 1: Procesmodel & De 6 Ketenfasen (EasyM2M)

### 1.1 Context, Domeinafbakening & Multi-Tenant SaaS Architectuur
* **Domein:** De context is een woninginrichter die gespecialiseerd is in 6 hoofdcategorieën conform **Assortimentsprofiel A**. Losse meubelen (banken, kasten), slaapcomfort (bedden/boxsprings) en losse karpetten vallen buiten de kern van deze configuratiescope.
  * *Wat is Assortimentsprofiel A?* In de branche staat 'Profiel A' voor de full-service maatwerk woninginrichter en woningstoffeerder. Deze richt zich exclusief op vaste vloer-, wand- en raamafwerkingen en buitenzonwering die projectmatig worden geadviseerd, ingemeten, op maat geconfectioneerd en vakkundig gemonteerd. Dit onderscheidt de formule scherp van meubelzaken (los meubilair zoals bankstellen, eetkamertafels en kasten), beddenspeciaalzaken (slaapcomfort, ledikanten en matrassen) en doe-het-zelf bouwmarkten of tapijthallen. Alles binnen Profiel A betreft confectie- en maatwerkartikelen die nauwgezet ingemeten en vakkundig op locatie gemonteerd worden.
  * *Integrale Taxonomieboom (De 6 Categorieën & Productgroepen):*

```text
📁 assortiment-easym2m/
├── 📁 1-gordijnen-en-rails/
│   ├── 📄 1.1-stoffen-confectie-en-microflex
│   └── 📄 1.2-rails-roedes-interstil-en-motoren
├── 📁 2-raamdecoratie-en-horren/
│   ├── 📄 2.1-binnenzonwering-duette-plisse-jaloezie-shutters
│   ├── 📄 2.2-boorvrije-kaders-easyclick-perfectfit-velux
│   └── 📄 2.3-horren-inzet-plisse-pollen-petscreen
├── 📁 3-vaste-vloerbekleding-en-dekvloertechniek/
│   ├── 📄 3.1-harde-vloeren-pvc-parket-gietvloer
│   ├── 📄 3.2-zachte-en-elastische-vloeren-tapijt-vinyl-marmoleum
│   └── 📄 3.3-ondervloeren-cm-vochtmeting-coral-inloopzones
├── 📁 4-trapbekleding-en-traprenovatie/
│   ├── 📄 4.1-traprenovatie-pvc-overzettreden-synchroon
│   ├── 📄 4.2-open-trappen-contratreden-en-trapstoffering
│   └── 📄 4.3-trapleuningen-met-led-en-balustrades
├── 📁 5-buitenzonwering-en-gevelsystemen/
│   ├── 📄 5.1-rolluiken-voorzet-inbouw-opbouw-solar
│   ├── 📄 5.2-verticale-gevelscreens-windklasse-6
│   └── 📄 5.3-knikarmschermen-markiezen-lamellendaken
└── 📁 6-diensten-montage-en-logistiek/
    ├── 📄 6.1-gordijnconfectie-en-gordijnrailmontage-cat-1
    ├── 📄 6.2-binnenzonwering-en-horrenmontage-cat-2
    ├── 📄 6.3-vloeren-legservice-en-randafwerking-cat-3
    ├── 📄 6.4-trapbekleding-en-traprenovatie-montage-cat-4
    ├── 📄 6.5-buitenzonwering-en-gevelmontage-cat-5
    ├── 📄 6.6-inmeting-bouwkundige-schouw-en-deurinspectie
    ├── 📄 6.7-sloop-ondergrondsanering-en-voorbewerking
    ├── 📄 6.8-montagelogistiek-verticaal-transport-en-afvalbeheer
    └── 📄 6.9-service-garantie-en-nazorg
```

  *Hiërarchische Assortimentsstructuur:*
    1. **Categorie 1: Gordijnen & Rails**
       * *Productgroepen:* Baanstoffen (met patroonrapport), Kamerhoge stoffen (naadloos), Inbetweens & Vitrages, Rails & Roedes (inclusief bochten/buigradii en trekstangen), Wave-gordijnsystemen (Wave 6 cm / 8 cm).
    2. **Categorie 2: Raamdecoratie (Binnenzonwering & Horren)**
       * *Productgroepen:* Horizontale & Verticale Jaloezieën (Hout, Bamboe, Aluminium, Polywood), Rolgordijnen & Duo-rolgordijnen, Plissé & Duette shades, Vouwgordijnen, Vaste en inklemmende Horren (Inzethorren, Plissé hordeuren).
    3. **Categorie 3: Vaste Vloerbekleding & Dekvloertechniek**
       * *Productgroepen:* Massief & Meerlaags Parket (Eiken toplaag 3–6 mm), Dryback PVC (verlijmd) & Click-PVC, Marmoleum & Linoleum, Vast Tapijt & Naaldvilt, PU-Gietvloeren, Egaline & Dekvloerprimers, Schoonloopsystemen (Forbo Coral, Emco) en Scratch no More vloerbescherming.
    4. **Categorie 4: Trapbekleding, Traprenovatie & Trapelementen**
       * *Productgroepen:* Traditionele Trapstoffering (Tapijt op trap), Geweven Traplopers (Sisal/Wol) met roedes en bandering, Overzettreden (Cortex composiet, CPL/HPL) met stootborden en trapneusprofielen, Trapwangen & Balustrades, Geïntegreerde LED-trapverlichting met sensoren.
    5. **Categorie 5: Buitenzonwering, Gevelsystemen & Rolluiken**
       * *Productgroepen (V1 MVP):* Knikarmschermen (Terrasschermen), Ritsscreens (Zipscreens), Uitvalschermen, Markiezen, Lamellendaken & Vrijstaande overkappingen (Brustor B200), Glazen schuifwanden (10 mm ESG) en Terrasverwarming (Solamagic, Bromic).
       * *Productgroepen (V2 Backlog):* Rolluiken (Voorzet-, Opbouw- en Inbouwrolluiken; buiten V1 MVP geplaatst conform verkoopdata).
    6. **Categorie 6: Diensten, Montage & Montagelogistiek**
       * *Productgroepen:* 6.1 Gordijnconfectie & Gordijnrailmontage (Cat 1), 6.2 Binnenzonwering- & Horrenmontage (Cat 2), 6.3 Vloeren Legservice & Randafwerking (Cat 3), 6.4 Trapbekleding & Traprenovatie Montage (Cat 4), 6.5 Buitenzonwering & Gevelmontage (Cat 5), 6.6 Inmeting, Bouwkundige Schouw & Technisch Advies, 6.7 Sloop, Ondergrondsanering & Voorbewerking, 6.8 Montagelogistiek, Verticaal Transport & Afvalbeheer, 6.9 Service, Garantie & Nazorg.
  * *V1 MVP Scope Buitenzonwering (Rolluiken in V2 Backlog):* Conform de historische verkoopdata van GSW (de afgelopen 2 jaar nauwelijks verkocht) behoren **rolluiken** in V1 expliciet **niet tot de MVP scope**. Categorie 5 richt zich in de actieve V1 MVP exclusief op knikarmschermen, ritsscreens, markiezen en uitvalschermen. Rolluiken zijn integraal verplaatst naar de V2 Backlog.
* **Doelstelling van het Portaal:** Het realiseren van een integraal digitaal portaal dat het complete ketenproces ondersteunt — vanaf het eerste verkoopadvies en inmeten tot en met de montage en nazorg/service.
* **Conditionele Checklisten & Verplichte Acties als Kernwaarde:** Het fundament van EasyM2M wordt gevormd door contextuele, dynamische checklisten en verplichte inspectie- en montage-acties. Zij borgen dat kritieke bouwkundige condities (ondergronden, leidingwerk, kindveiligheid, obstakels) direct aan de bron worden gevalideerd, waardoor overdrachtsfouten worden geëlimineerd.
* **Architectuur & Scope V1:** Ontwikkeld als een multi-tenant SaaS-inmeetplatform voor woninginrichters, met woninginrichter GiW (*Groter in Wonen*) als primaire V1 lanceerpartner en referentietopologie. In versie 1 (V1) wordt de oplossing initieel operationeel gemaakt voor deze primaire tenant, met configureerbare isolatie voor toekomstige tenants.
* **MVP-Afbakening Arbeid & Montage:** In de EasyM2M MVP worden alle berekeningen met betrekking tot arbeid, montagetijden, stelposten en legloon handmatig ingevoerd en/of berekend in het ERP-systeem (LogicTrade). Geautomatiseerde arbeidsberekening binnen het platform is expliciet uitgesloten van de MVP-scope.

#### Scope-Consolidatietabel (Versie 1 MVP vs. Versie 2 Backlog)
Om de functionele scope en architecturale afbakening eenduidig te formaliseren, classificeert het platform alle procesonderdelen in twee fasen:

| Functionaliteit / Domeinketen | Versie 1 (V1 MVP — Actieve Scope) | Versie 2 (V2 — Geplande Roadmap & Backlog) |
| :--- | :--- | :--- |
| **Portaal & Schermarchitectuur** | 6 Hoofdschermen (`Home`, `Klant`, `Object`, `Project`, `Ruimte`, `Product`) met de Dynamische Hiërarchische Matrix; slanke universele header en context-subheader | Consumenten-Klantportaal (rechtstreekse interactieve toegang voor particuliere klant tot projectstatus en dossier) |
| **Productgroepen & Assortiment** | 6 categorieën in V1 MVP conform Profiel A: Gordijnen & Rails, Raamdecoratie, Vaste Vloerbekleding & Dekvloertechniek, Trapbekleding & Traprenovatie, Buitenzonwering & Gevelsystemen (excl. rolluiken), en Diensten & Montage | Rolluiken (voorzet-, opbouw- en inbouwrolluiken; conform 2-jarige verkoopdata GSW nauwelijks verkocht en buiten V1 MVP geplaatst); maatwerk zonnedoeken, vlaggenmasten en industriële terrasoverkappingen |
| **Afsprakenbeheer & Montagecondities** | Operationele `KalenderAfspraak` gekoppeld aan projecten; contractuele werkafspraken en montagecondities direct vastgelegd op Positie-, Ruimte- en Projectniveau | Tab B (Afsprakenspiegel) en Tab C (Documentendossier) als geaggregeerde schermen op Hoofdscherm 4; rol-agenda op Home; geautomatiseerde AI-routeplanning en live GPS-verkeersprognoses voor monteursbussen |
| **Mobiele Buitendienst & Klantnotificatie** | Uitvoering via uniform webportaal op tablets (Hoofdscherm 6 Product en Hoofdscherm 4 Project) met fotoregistratie van opleverresultaat en issue-meldingsflow | Mobiele Monteurs-Cockpit (`/monteur/vandaag`), 1-tik "Onderweg"-status, videonulmeting, swipeable positiekaarten; klantnotificatie bij vertrek ("soms 15 min van tevoren bellen of klant belt voor specifiek tijdstip" met vertrek aangeven en realtime locatie/ETA Picnic-stijl) |
| **Verkoop, Inkoop, Logistiek & Betalingen** | PDF-generatie van Meet-, Montage- en Afterservicerapporten met optionele handtekeningen (afhankelijk van realisatie-effort) en directe SRP e-mailverzending; orders en artikelen gekoppeld aan LogicTrade ERP | Digitaal offerte versturen en ondertekenen vanuit M2M met ERP-sync; direct bestellen vanuit M2M met ERP-sync; goederenontvangst en binnenmelden via M2M met ERP-sync; financiële betalingen (iDEAL/PIN) binnen M2M afhandelen |
| **Arbeid, Montage & Calculatie** | Handmatige invoer van arbeid en montagetarieven en/of calculatie in LogicTrade ERP; geautomatiseerde arbeidsberekening valt buiten V1 MVP | Geautomatiseerde calculatiemodules voor arbeid, montagetijdnormen en legloonregels binnen het platform |
| **Meetinvoer & Rekenregels** | UI Drie-eenheid (dagmaat invoer, automatische aftrek- en productiemaat), conditionele inspectie- en montagechecklisten per productgroep; subtiel rood `Draft` status-icoon met hover-tooltip; wiskundige rekenregels voor pakgrootte-afronding (vloeren) en stuklijsten voor trappen | LiDAR 3D-ruimtescanning en automatische vector-contourherkenning uit point-clouds |
| **Documentendossier & Export** | PDF-generatie van Meet-, Montage- en Afterservicerapporten met optionele digitale handtekeningen en directe SRP e-mailverzending | Realtime tweewegs order-mutatiesynchronisatie met externe ERP-systemen (V1: éénrichting links/exports) |

### 1.2 De 7 Rollen in de Keten
Het procesmodel van EasyM2M onderkent zeven primaire rollen die als een estafette samenwerken binnen de woninginrichtingsketen. De procesmatige interactie tussen deze rollen borgt een foutloze overdracht van commercie naar techniek en montage:
1. **Verkoper (Adviseur / Winkel / Showroom):** Brengt de klantbehoefte in kaart, adviseert over materialen, kleuren en stijlen, voert de globale (concept)maten in, stelt de initiële offerte op en initieert de inmeetopdracht in Fase 1.
2. **Inmeter (Technisch Opnemer op Locatie):** Bezoekt het object in Fase 2, meet alle bouwkundige elementen in volgens de vaste meetstandaarden (§3.1), beoordeelt de bouwkundige staat en ondergronden, legt foto's en obstakels vast en doorloopt de kwalitatieve inmeetchecklist.
3. **Controleur (Werkvoorbereider / Technisch Beoordelaar):** Voert in Fase 4 de cruciale vier-ogencontrole uit; toetst de inmeetgegevens aan de verkooporder, controleert fabrieksbestelmaten, signaleert afwijkingen en geeft de order technisch en margematig vrij voor inkoop.
4. **Planner (Capaciteits- en Routeplanner):** Bewaakt de dwingende productvolgorde (vloeren en droogtijden vóór raambekleding, §4.4), plant inmeet- en montageafspraken in via de `AfspraakPlannerModal` binnen het projectdossier (Hoofdscherm 4: Project Tab A: Bezoeken & Planning) en bewaakt de dagagenda op Hoofdscherm 1 (Home), en stuurt afspraakbevestigingen naar monteurs en de klant.
5. **Monteur (Uitvoerend Vakman):** Ontvangt de digitale werkbon met blijvende maten, doorloopt de verplichte ingangscontrole vóór uitpakken (§3.1.2), monteert de materialen op locatie conform Arbo- en veiligheidsprotocollen (§4.8), en verzorgt de oplevering aan de klant.
6. **Servicemonteur (Nazorg & Garantie):** Handelt eventuele montagebevindingen, transportschades of garantievraagstukken zelfstandig af in Fase 6 met een gerichte serviceorder.
7. **Klant (Opdrachtgever / Bewoner / Projectontwikkelaar):** Particuliere of zakelijke opdrachtgever; verschaft toegang tot het pand voor inmeting en montage, deelt specifieke wensen en eventuele bekende leidingtrajecten en vloerverwarming met de inmeter, accordeert het inmeetverslag (inclusief de vastgelegde situatie en de standaard aansprakelijkheidsvoorwaarde voor verborgen leidingen en ondergrondafwijkingen: eventueel meerwerk door afwijkingen t.o.v. de opgave is voor rekening van de klant), en tekent voor oplevering na montage.  
   *(Let op V1-scope: Het digitaal accorderen van offertes via een interactief consumentenportaal en realtime statusvolging vallen buiten de scope van V1 en gelden als mogelijke toekomstige functionaliteiten; in V1 verloopt de offerte-afstemming via de verkoopadviseur en e-mail/winkel).*

* **Ondersteunende Operationele Rollen in de Keten:** *(Ter informatie opgenomen; deze ondersteunende rollen zijn geen onderdeel van het inmeetportaal zelf)*  
  * **Backoffice Medewerker:** Verwerkt inkomende orderbevestigingen van fabrikanten (zoals Luxaflex en Toppoint). Voert het externe orderbevestigingsnummer en de bevestigde leverweek (standaard gealloceerd op zondag van de productieweek) in het ERP-systeem in, bewaakt leveranciersstatussen (*Onbevestigd*, *Bevestigd*, *Te laat binnen*), en bewaakt eventuele meerwerkkosten of fabricageafwijkingen conform het financieel escalatieprotocol.
  * **Magazijnmedewerker:** Verzorgt de dagelijkse fysieke goederenontvangst in het centrale magazijn, toetst colli-aantallen op uiterlijke beschadigingen en meldt leveringen direct af in het ERP-systeem. Goederenontvangst wordt primair bijgehouden in LogicTrade ERP. In EasyM2M verifieert de planner de beschikbaarheid van goederen via de *Pre-Action Checklist Gate* bij het definitief plannen en starten van de montage. Monteurs leggen aan het einde van de werkdag ervoor zelf materialen en gereedschappen klaar; de werkvoorbereiding verzorgt de dossieroverdracht.
  * **Klantenservice & Losse Onderdelen:** Reguliere klantvragen en de afhandeling van onderdelenservice worden in de praktijk afgehandeld door de operationele servicecoördinatie.

*(Voor de gedetailleerde taakomschrijvingen, de vier-ogencontrole en de fijnmazige RBAC-portaalrechten per rol: zie Deel 5, §5.2 en §5.4).*

### 1.3 Systeemarchitectuur & Integratiekader (ERP & Outlook)
* **ERP-integratie (LogicTrade):** In versie 1 valt een geautomatiseerde orderdoorvoer buiten de scope van het portaal. Offertes, leveranciersorders (inkoop) en facturatie vinden primair plaats vanuit het ERP-systeem. Voor het opvragen van actuele catalogusproducten en productspecificaties is een API-koppeling met LogicTrade in de toekomst wenselijk.
* **Tweeweg Agendasynchronisatie (Outlook):** De agenda in het portaal en Microsoft Outlook is volledig tweeweg gesynchroniseerd. Zodra een inmeet- of montageorder wordt ingepland of gewijzigd (in het portaal óf in Outlook), wordt dit realtime over en weer bijgewerkt. *(De automatische herbevestiging van datumwijzigingen naar de klant is gereserveerd voor de backlog).*

### 1.4 Hoofdlijnen van de 6 Ketenfasen & Conditionele Workflow-Overgangen (Gates)
Het complete maatwerktraject verloopt organisatorisch via 6 vaste ketenfasen (1. Intake, 2. Offerte, 3. Order, 4. Inkoop/Controle, 5. Montage, 6. Nazorg/Afronding), die in het EasyM2M-portaal deterministisch worden gereflecteerd in 5 data-driven projectstatussen (`Intake` → `Offerte` → `Order` → `Geleverd` → `Afgerond`). Hoewel de fasen identiek zijn, verschillen de te registreren parameters per productcategorie, productgroep en product. Inmeten is binnen deze opzet géén starre lineaire ketenfase waar ieder project verplicht op één vast moment doorheen moet, maar een transversale procesactie die op elk gewenst moment kan worden uitgevoerd om productspecificaties en maten van concept naar definitief te brengen. De overgang tussen fasen wordt bewaakt door conditionele workflow-gates:

* **Fase 1: De Intake- & Intentiefase**  
  * *Inhoud:* Verkoper en klant inventariseren wensen, ruimtes en te offreren producten/werkzaamheden en plannen een inmeetafspraak. Heeft de klant globale maten meegenomen (bijv. 11 Duettes), dan berekent de adviseur binnen 20 minuten een nauwkeurige indicatieve calculatie op de winkelvloer. Bij akkoord op het berekende prijsniveau (een exacte prijs op basis van de ingevoerde productspecificaties en conceptmaten, geen vrijblijvende prijsrange) wordt de projectstatus in het portaal direct omgezet naar **Order** (met maatstatus per positie op `concept`). Hierdoor transformeert het traject van een vrijblijvende lead direct naar een bindende verkooporder, waarbij de transversale inmeetactie fungeert als verificatiecheck. Het dwingend structureren van het showroomproces overbrugt kenniskloven tussen ervaren krachten en junior medewerkers.  
  * *Gate (Afsluiting):* Formeel afgesloten met een **Inmeetorder** of **Verkooporder** (met status `Order` en maatstatus op `concept`) *(Opmerking: digitaal ondertekenen en eventueel betalen van de inmeetorder is een backlog functionaliteit; streven naar substantiële aanbetalingen conform §1.5.1)*.
* **Transversale Procesactie: Inmeten & Schouw op Locatie**  
  * *Inhoud & Positie in het Proces:* Alle statussen in het portaal zijn data-driven. Inmeten is conceptueel géén starre lineaire bottleneck waar elk dossier verplicht vóóraf doorheen moet. Het is een transversale **procesactie** die kan plaatsvinden in Fase 1, Fase 2 of Fase 3 zolang de maten niet definitief zijn en er nog geen inmeetafspraak gepland staat. De maatstatus per artikel/positie kent de waarden `concept` vs. `definitief`. Na de inmeetactie op locatie worden de maten via `[ Definitief Maken ]` op `definitief` gezet (al kan een positie in uitzonderlijke situaties nog op `concept` blijven staan indien nameten noodzakelijk blijft). Het proces kent twee dynamische hoofdroutes:  
    * **Traject A (Meetgestuurd / Regulier):** Intake & Wensen (optioneel gestart met globale conceptmaten) → Inmeetafspraak plannen & inmeting op locatie → Maten op 'definitief' via `[ Definitief Maken ]` → Calculatie & Offerte → Orderakkoord (projectstatus `Order`).  
    * **Traject B (Showroom-direct / Directe Order):** Intake met globale conceptmaten in showroom → Direct commercieel akkoord & Orderbevestiging (projectstatus `Order`, maatstatus op `concept`) → Inmeetactie op locatie ter verificatie → Maten op 'definitief' via `[ Definitief Maken ]` → Vrijgave inkoop in ERP.  
    Tijdens de inmeetactie meet de inmeter op locatie alle posities exact in, maakt overzichts- en detailfoto's en legt schetsen en montagerichtlijnen vast. Eventueel voorafgegaan door een schouw (conceptmeting in ruwbouw). De inmeettool is softwarematig leidend en dwingend: inmetingen kunnen niet worden afgesloten zonder verplichte parameters zoals montagehoogtes, ondergronden en plintinstructies.  
  * *Gate (Afsluiting):* Formeel afgesloten zodra alle posities van het inmeetdossier definitief zijn gemaakt via `[ Definitief Maken ]` en de inmeter het inmeetbezoek afrondt.
* **Fase 2: De Offertefase**  
  * *Inhoud:* Indien de klant in de showroom niet direct tot aankoop overgaat, stelt de adviseur op basis van de intake of een voorafgaande inmeting een gespecificeerde offerte op in LogicTrade ERP. De offerte bevat gedetailleerde calculaties en voorwaarden. **Verplichte Conceptmaten-Clausule:** Indien een offerte wordt opgesteld op basis van conceptmaten, wordt er automatisch en verplicht een vaste bepalingsregel opgenomen: *"Deze offerte/orderbevestiging is gebaseerd op voorlopige conceptmaten; specificaties, benodigde hoeveelheden en prijzen worden definitief vastgesteld en eventueel herzien zodra de definitieve inmeting op locatie heeft plaatsgevonden en eventuele maatafwijkingen zijn geconstateerd."*  
  * *Gate (Afsluiting):* Formeel afgesloten met een door de klant geaccordeerde offerte die in LogicTrade ERP wordt omgezet naar een verkooporder (projectstatus `Order`).
* **Fase 3: De Orderfase**  
  * *Inhoud:* Het project bevindt zich in de actieve orderstatus (hetzij rechtstreeks ontstaan vanuit de showroomintake op conceptmaten, hetzij na acceptatie van de offerte). Indien er nog posities met maatstatus `concept` aanwezig zijn, moet de transversale inmeetactie op locatie worden uitgevoerd alvorens de order technisch kan worden vrijgegeven voor productie en inkoop.
  * *Gate (Afsluiting):* Alle posities bezitten maatstatus `definitief`, en de order is administratief en technisch gevalideerd voor inkoop.
* **Fase 4: De Bestelfase (Interne Controle & Inkoop in LogicTrade ERP — INV-ERP-02)**  
  * *Inhoud:* Het daadwerkelijk bestellen en inkopen van materialen is 100% het domein van LogicTrade ERP en geen handeling in EasyM2M (het portaal kent dan ook géén bestelknop of blokkerende bestelstatus; het project behoudt in het portaal de status `Order`). Binnen LogicTrade voert de controleur/werkvoorbereider de vier-ogen kwaliteitscontrole uit op meet- en verkoopdata ter voorkoming van overname- en invoerfouten, gevolgd door verzending van inkooporders naar leveranciers. Bevat de verplichte Orderbevestiging-validatie (ACK Gate) en Spookorder-Alerting ter voorkoming van niet-geproduceerde orders*.  
  * *Gate (Afsluiting in ERP):* Formeel afgesloten binnen LogicTrade met geaccordeerde **Inkooporders** voorzien van geregistreerd fabrikant-bevestigingsnummer en verwachte leverweek; deze geaccordeerde inkooporder met verwachte leverweek vormt reeds de montagetrigger voor de planner, waarna de fysieke binnenmelding van goederen in het magazijn fungeert als definitieve verificatie vóór montage.
* **Fase 5: De Montagefase (Uitvoering & Status 'Geleverd')**  
  * *Inhoud:* Planner plant montageafspraak zodra goederen binnen zijn; monteurs monteren alle posities conform instructie, borgen schadevrij werken en handelen gemonteerde producten af via de knop `[ Gemonteerd ]`. Indien alle producten zonder restpunten zijn gemonteerd, krijgen de producten direct de status `'gereed'`. Zijn er restpunten of beschadigingen, dan worden deze vastgelegd als `Opmerking` van het type `openstaande_actie` en krijgt het product de status `'geleverd'`.  
  * *Gate (Afsluiting in Portaal):* Zodra aan de strikte macro-statusconditie is voldaan (`products.length > 0` en 100% van de onderliggende producten heeft status `'geleverd'` OF `'gereed'`), verspringt de berekende projectstatus in het portaal deterministisch naar **Geleverd**.
* **Fase 6: De Nazorg- & Afrondingsfase (Restpunten, Service & Status 'Afgerond')**  
  * *Inhoud:* Eventuele restpunten, transportschades of nazorgmeldingen die tijdens de montage zijn geregistreerd als `openstaande_actie` worden door de servicemonteur op locatie opgelost. Zolang er $\ge 1$ openstaande actie resteert, blijft de status `Geleverd` gehandhaafd. Zodra alle openstaande acties zijn afgehandeld en gesloten, krijgen ook de laatste producten de status `'gereed'`.  
  * *Gate (Afsluiting in Portaal):* Pas zodra aan de eindconditie is voldaan (`products.length > 0` én 100% van de producten heeft status `'gereed'` ÉN count(openstaande_actie) = 0), ontgrendelt de afronding en verspringt het projectdossier deterministisch naar de eindstatus **Afgerond**.
### 1.5 Detailbeschrijving van de 6 Ketenfasen & Transversale Inmeetactie

#### 1.5.1 Fase 1: De Intake- & Intentiefase (Verkoop & Inmeetorder)
* **Wensen & Gegevensverzameling:** De verkoper inventariseert in de showroom de wensen van de klant. Alles wat noodzakelijk is voor een succesvolle inmeting wordt gestructureerd vastgelegd:
  * *Klantgegevens:* NAW-gegevens, telefoonnummer en e-mailadres.
  * *Ruimtelijke indeling:* Etages en ruimtes binnen het pand.
  * *Productgroepen & Posities:* Gordijnen & Rails, Raamdecoratie, Vaste Vloerbekleding & Dekvloertechniek, Trapbekleding & Traprenovatie, Buitenzonwering & Gevelsystemen én Diensten, Montage & Montagelogistiek (Categorie 1 t/m 6) worden gekoppeld aan de geïnventariseerde ruimtes of projectbreed via pos_project_algemeen.
  * *Productselectie met specificaties:* Producten en productspecificaties die de klant kiest om in te laten meten.
* **Werkzaamheden & Gerelateerde Artikelen/Diensten:** In deze fase worden ook al direct de bijbehorende werkzaamheden en gerelateerde artikelen vastgelegd, zoals legkosten/legloon, plinten (bij vloeren: MDF, plakplint of hoge plint), hoekprofielen en afwerklijsten.
  * *Sloop- en Afvoerwerkzaamheden Bestaande Vloeren:* Uitdrukkelijke splitsing van **vloer verwijderen / oppakken** én **vloer afvoeren** als twee afzonderlijke, optionele calculatieposten. Standaard uitgangspunt is dat de klant zelf zorgt voor een schone, lege ondervloer; indien de woninginrichter dit verzorgt, toetst de inmeter in Fase 2 de hechtingsconditie en worden beide posten separaat gecalculeerd.
  * *Herhangen & Verplaatsen van Bestaande Raambekleding:* Vragen van klanten over het demonteren van oude jaloezieën of gordijnen en het herhangen daarvan naar een achterafkamer (bijv. werkkamer of zolder) worden direct in de showroomintake als specifieke montageposities en calculatieposten geregistreerd, zodat de inmeter deze opneemt en de montageplanning sluitend is.
  * *Commerciële Aanbeveling Montageprofiel bij Rolgordijnen:* Standaard aanbieden van een montageprofiel t.o.v. losse steunen (aanzienlijk snellere montage, esthetisch strakker, door de klant eenvoudig afklikbaar bij schilderwerkzaamheden, en structureel hogere orderwaarde en brutomarge).
  * *Transparante All-in Montage & Quick-Step Master Installers:* In de calculatie hanteert de woninginrichter een transparant all-in montagetarief van bijv. € 25,50 per m² voor het vakkundig leggen van laminaat. In tegenstelling tot prijsvechters (zoals Carpetright met schreeuwende lokprijzen van € 14,50/m² maar verborgen meerkosten voor losse lijm, los ondertapijt en zzp-risico's), biedt de onderneming 100% zekerheid en garantie. Alle eigen monteurs zijn gecertificeerd als **Quick-Step Master Installer** en leggen verplicht **iedere twee jaar opnieuw een praktijkexamen en certificeringstraining** af bij Quick-Step. Dit keurmerk staat officieel vermeld op de Quick-Step website en eigen kanalen, en fungeert als krachtig kwaliteitsargument in het verkoopgesprek.
* **Inmeetbijdrage / Drempelkwalificatie (€ 75,-) & Aanbetalingsregie:**  
  * *Kwalificatiebijdrage (€ 75,- vooraf pinnen):* *(Wens/idee)* Vastleggen van een standaard inmeetbijdrage van € 75,- ter kwalificatie van de klantlead. De adviseur laat de klant dit bedrag bij voorkeur direct in de showroom pinnen; bij definitieve orderbevestiging wordt dit bedrag integraal in mindering gebracht op de factuur. Hierdoor gaat de inmeter in 99,9% van de situaties op pad met een serieuze, gekwalificeerde klant.  
  * *Aanbetalingsregie (Tot 80% Voorfinanciering):* *(Wens/idee)* Afstappen van het traditionele 'alles achteraf betalen' na oplevering. Naar analogie van de automotive- en keukensector stuurt het beleid bij definitieve orderverlening op substantiële voorfinanciering (tot 80% aanbetaling bij maatwerkorders), waardoor liquiditeitsrisico's worden geëlimineerd en faalkosten vooraf worden afgedekt.
* **Showroom Intake-Checklist voor Verkopers & Specificatiediepte:** *(Wens/idee)* Gestructureerde vraagbegeleiding in het portaal om kenniskloven tussen ervaren krachten en junior adviseurs te overbruggen, waardoor de offerteconversie na inmeting op circa 95% zonder nabewerking blijft.
  * *Dwingende Specificatiediepte:* *(Wens/idee)* Het portaal verbiedt bij voorkeur beknopte, niet-volledige aanvragen. De intake dwingt direct gerelateerde producten en werkzaamheden af: bij Quick-Step laminaat/PVC inclusief 14 mm plinten en afkitten; bij gordijnrails (Interstil) inclusief exacte railafstanden en specifieke wand- of plafondsteunen *(Opm: artikelnummers van steunen is niet voor versie 1 en gaat naar de backlog)*.
  * *Snelle Modelcode-Selectie & Elektrische Uitvoeringen (AU10, AU20, AE20, AS20):* *(Wens/idee)* De adviseur kan direct vertrouwde modelcodes intikken:
    * `AU10` / `AS10`: Handbediend standaard vrijhangend.
    * `AU20` / `AS20`: Handbediend vrijhangend SmartCord met Top-Down / Bottom-Up.
    * `AE20`: Elektrisch vrijhangend PowerView met Top-Down / Bottom-Up.
  * *Accessoire-Gating bij Elektrische Bediening (PowerView AE20):* *(Wens/idee; voor de volledige technische SSOT zie §3.3.2)* Bij selectie van een elektrisch model (`AE20`) dwingt de software verplicht de selectie af van de vereiste randapparatuur: de **magnetische oplaadkabel** en de **hand- of wandzender (Pebble remote)**. Het dossier kan niet worden vrijgegeven zonder deze laad- en bedieningsaccessoires.
  * *Btw-Transparantie & Automatische Conversie:* *(Wens/idee)* Fabrikanten tonen catalogusprijzen en optietoeslagen (zoals motoren of TDBU) standaard exclusief btw. Het portaal converteert deze groothandelstarieven realtime naar consumentenbedragen **inclusief 21% btw**, waardoor verwarring en rekenfouten op de winkelvloer worden uitgesloten.
  * *Vastlegging Kritieke Frame- & Profielkleuren met Meerprijs:* *(Wens/idee)* Directe registratie van specifieke frame- en cassettekleuren met substantiële meerprijs (zoals de champagnekleur bij Zonnelux) om te voorkomen dat de klant achteraf meermalen moet worden nagebeld voor offertedetails.
* **Stalenbeheer & Registratie:** *(Wens/idee)* Registratie van aan de klant meegegeven stalenboeken, stalenkaarten of kleurwaaiers in het klantdossier.
* **Gewenste Montagedatum & Afspraakregels:** Vastlegging van een eventuele gewenste montagedatum door de klant (bijv. bij een gefaseerde verbouwing). Als standaard default geldt: er wordt géén vaste periode afgesproken; zodra alle goederen binnen zijn in het centrale magazijn wordt de montage direct ingepland op het eerst mogelijke tijdstip.
* **Conceptmaten van de Klant:** Mogelijkheid om indicatieve maten in te voeren die de klant zelf heeft meegenomen naar de showroom. Deze conceptmaten dienen voor de initiële prijsindicatie en worden bij de inmeting (Fase 2) definitief getoetst.
* **Vrij Opmerkingenveld Verkoper:** Een ruim, vrij notitieveld waarin de verkoper speciale klantwensen, bouwkundige aandachtspunten of showroomafspraken kan noteren.
* **Draft-Status van Producten:** De gekozen producten hebben de status 'draft' (concept); tijdens de inmeetfase kan en mag de inmeter gemotiveerd afwijken op basis van de fysieke bouwkundige realiteit op locatie.
* **Inmeetafspraak & Planning (Multi-Appointment):** Inmeetafspraken zijn direct gekoppeld aan het project (en montageadres/object). Aan één project kunnen **meerdere inmeetafspraken** worden gekoppeld (bijv. een eerste oriënterende schouw in ruwbouw, een hermeting na stucwerk/dekvloer, een controlemeting na kozijnplaatsing, of gescheiden inmeetmomenten voor verschillende productgroepen). Er geldt nadrukkelijk géén blokkerende minimale dataset: zelfs zonder dat er reeds ruimtes, producten of posities zijn ingevoerd, mag een inmeetafspraak worden ingepland (bijvoorbeeld voor een oriënterend adviesgesprek of bouwkundige verkenning op locatie). Het systeem kan een indicatief voorstel doen voor de benodigde tijdslotduur op basis van globale wensen, maar de verkoper bepaalt altijd zelf de definitieve duur van de afspraak.
* **Inmeetorder & Klantbevestiging:** De inmeetorder zelf wordt aangemaakt in het ERP-systeem*. De inmeetafspraak wordt ingepland via het portaal, waarna de klant direct vanuit het portaal een automatische bevestigingsmail van de inmeetafspraak ontvangt.
* **LogicTrade ERP-Koppeling & MVP-Scope:**  
  * *Databasekoppeling Artikelen & Prijzen:* *(Geen onderdeel van MVP-scope V1; gepland voor latere fase / backlog)* Directe databasekoppeling met LogicTrade voor het actueel ophalen en valideren van artikel- en prijsdata (reeds 20.000 van de ruim 100.000 artikelen ingelezen). Hierdoor kan de showroomadviseur direct merkoverstijgend schakelen tussen Luxaflex, Toppoint, Zonnelux en Sunway zonder handmatige overtypefouten.  
  * *Externe Fabrikantenconfigurators buiten V1:* Volledige externe configurators van fabrikanten vallen buiten de initiële MVP-scope; de focus ligt op snelle validatie tegen de ERP-artikelenlijst.  
  * *Agenda-Sync:* De inplanning van de inmeetafspraak synchroniseert direct met Microsoft Outlook.

#### 1.5.2 Transversale Procesactie: Inmeten & Schouw op Locatie
* **Voorbereiding & Digitale Overdracht:** De inmeter vertrekt naar de klantlocatie met het volledige digitale dossier uit de verkoopfase op zijn tablet. Inmeten is binnen EasyM2M géén lineaire verplichte bottleneck, maar een flexibele transversale procesactie die kan worden uitgevoerd in de intakefase, offertefase of na orderbevestiging.
* **Conditionele Inmeetworkflow:** De inmeter doorloopt een vaste, gestandaardiseerde workflow met verplichte stappen:
  * *Entree & Looproutes:* Maken van overzichtsfoto's en filmpjes van de entree, het trappenhuis, de lift en de aanlooproutes naar de montagelocatie (logistieke toegankelijkheid).
  * *Ruimteniveau:* Maken van een duidelijke maatschets van de ruimte (voorzien van genummerde posities), overzichtsfoto's en specifieke ruimtelijke notities.
  * *Positieniveau:* Vastleggen van alle vereiste basis- en detailmaten (hoogte, breedte, montagelijnen, obstakels), detailfoto's van kozijnen of vloeren, en gerichte instructies voor offerte en montage.
  * *Bijzonderheden, Extra Werk & Monteursindicatie:* Het inschatten van benodigde uren/montagetijd is uitdrukkelijk géén taak van de inmeter; dit wordt berekend door de planner. De inmeter registreert uitsluitend geconstateerde bijzonderheden, meerwerk/extra werk of de noodzaak voor specifieke specialistische vaardigheden (bijv. meesterstoffeerder voor trappen) via een gerichte opmerking in de conditionele checklist.
* **Productaanpassing door Inmeter:** Indien de live situatie uitwijst dat een gekozen draft-product technisch niet monteerbaar is (bijv. te geringe plaatsingsdiepte of ongeschikte ondergrond), heeft de inmeter de bevoegdheid het product in overleg aan te passen naar een technisch haalbaar alternatief.
* **Bouwkundige Schouw (Optioneel):** In situaties van ruwbouw of grootschalige renovatie kan de inmeetactie worden voorafgegaan door een 'schouw' (een conceptmeting waarbij maten en definitieve productkeuzen indicatief zijn en in een later stadium definitief worden gemaakt).
* **Afsluiting, Meetrapport & Ondertekening (Inclusief Deel-Meetrapport):** Na afloop van de inmeting – zodra alle ingevoerde posities door de inmeter via `[ Definitief Maken ]` op de status "definitief" zijn gezet (INV-STATE-01) – genereert het portaal het digitale **Meetrapport** (via de actieknop `[ Rapport Maken ]` met rapporttype *Meetrapport*). Hierin zijn alle geconstateerde bouwkundige details, opmerkingen en montagerichtlijnen verzameld. **Deel-Meetrapport Protocol:** Indien bepaalde ruimtes of verdiepingen zich nog in ruwbouw bevinden (of nog gestukt/geëgaliseerd moeten worden), kan de inmeter een *Deel-Meetrapport* genereren voor de reeds definitief ingemeten ruimtes; de resterende ruimtes blijven op maatstatus `concept` staan met een ingeplande vervolginmeting. De inmeter neemt het (deel-)meetrapport door met de klant. Eventuele klantopmerkingen worden ter plekke toegevoegd. Vervolgens ondertekent de klant het rapport digitaal op het scherm (INV-UI-02), waarna het meetrapport per e-mail aan de klant wordt verzonden. *(Voor gedetailleerde inmeetmethodieken en rekenregels per categorie, zie Deel 3).*

#### 1.5.3 Fase 2: De Offertefase (Calculatie, ERP & Verkooporder)
* **Dossieroverdracht naar Calculatie:** Het inmeetverslag en de klantwensen vormen het fundament voor de offerteberekening.
* **ERP-Verwerking:** De definitieve maten en productspecificaties worden in het ERP-systeem (LogicTrade) ingevoerd (in V1 handmatig door de verkoper/calculator, in latere fasen via een API-koppeling).
* **Offerte-uitgifte & Verkooptraject:** De verkoper stelt de offerte op binnen het ERP-systeem en verstuurt deze naar de klant (valt buiten de directe werking van het portaal).
  * *Automatische Klantvriendelijke Productomschrijvingen (AU20 & AE20 Casus):* *(Wens/idee)* Indien op een offerte of orderbevestiging uitsluitend een cryptische fabrikant-modelcode staat (zoals `AU20`, `AS20` of `AE20`), begrijpt de klant niet wat er besteld is. Dit leidt bij levering regelmatig tot ernstige aflevergeschillen (*"die code zegt me niets, dit heb ik niet besteld"*). Het portaal genereert daarom automatisch een **volledige, klantvriendelijke functionele omschrijving** op alle klantgerichte documenten (bijv. *"Duette 25 mm, vrijhangend, SmartCord-bediening met Top-Down / Bottom-Up"* of bij `AE20`: *"Duette 32 mm, vrijhangend, elektrisch PowerView met Top-Down / Bottom-Up, incl. magnetische laadkabel en Pebble handzender"*). De compacte fabriekscode blijft op de achtergrond behouden voor de technische bestelregels in LogicTrade, EDI-berichten en fabrieksorders.
  * *Fabrieksprijsstaffels & Meetneutraliteit (10–20 cm Intervallen):* *(Wens/idee; zie §3.3.2)* Fabrikantprijslijsten zijn opgebouwd in vaste staffelintervallen (bijv. breedte 1,40–1,60 m × hoogte 1,40–1,60 m). Indien een klant in de showroom een conceptmaat doorgeeft van 1,45 × 1,55 m en de inmeter meet op locatie 1,48 × 1,52 m, valt dit binnen exact hetzelfde staffelblok. Het portaal toont direct dat de berekende prijs 100% prijsneutraal blijft, waardoor offertes direct definitief gemaakt kunnen worden zonder tijdrovende hercalculaties.
  * *Transparante Btw-Weergave op Documenten:* *(Wens/idee)* Terwijl fabrikantcatalogi toeslagen exclusief btw specificeren, toont het consumentenportaal en de offerte alle bedragen consistent inclusief 21% btw.
* **Afsluiting Offertefase:** De offertefase wordt formeel afgesloten zodra de offerte in het ERP-systeem is opgesteld en door de verkoper aan de klant is aangeboden.

#### 1.5.4 Fase 3: De Orderfase (Commercieel Akkoord & Verkooporder)
* **Orderstatusflow & Uitzonderingenbeheer (95% vs. 5%):**
  * *Reguliere flow (95%):* De klant accordeert de offerte zonder wijzigingen; de verkooporder in LogicTrade ERP is inhoudelijk 1-op-1 identiek aan de calculatie en de projectstatus in het portaal wordt definitief `Order`.
  * *Afwijkingsflow (5%):* Indien de klant alsnog wijzigingen wenst (kleur, stofkeuze, aantal posities), past de verkoper zowel het dossier in het portaal als de order in het ERP handmatig aan.
* **Showroom-Direct Order (Traject B):** Bij verkoop in de showroom direct op conceptmaten ontstaat de orderstatus rechtstreeks vanuit de intake; de transversale inmeetactie op locatie brengt de maten vervolgens van concept naar definitief via `[ Definitief Maken ]`.
* **Afsluiting & Vrijgave:** De orderfase wordt formeel afgesloten met een getekende verkooporder en toekenning van de status `definitief` aan alle gekoppelde posities, waarna de order technisch klaar is voor inkoopcontrole.

#### 1.5.5 Fase 4: De Bestel- & Inkoopcontrolefase (ERP-Verificatie LogicTrade)
* **Vier-Ogen Kwaliteitsborging:** Voordat inkooporders definitief naar toeleveranciers en fabrieken worden verzonden, voert een onafhankelijke controleur (in de praktijk veelal de inmeter zelf) een grondige visuele check uit.
* **Verificatieproces:** De controleur toetst de ingevoerde ERP-gegevens integraal aan de oorspronkelijke notities van de verkoper, het inmeetverslag en de fotobijlagen. Hiermee worden kostbare maat- en specificatiefouten in de productieketen geëlimineerd. *(Toekomstperspectief: Zodra er een automatische API-koppeling is gerealiseerd tussen het inmeetportaal en het ERP, zal deze handmatige vier-ogencontrole aanzienlijk verminderen of voor gestandaardiseerde orders zelfs geheel verdwijnen).*
* **Plaatsing van Inkooporders & Leveranciersbevestigingen:** Na formele goedkeuring door de controleur worden de inkooporders gefiatteerd en verzonden naar de toeleveranciers en fabrikanten (zoals Luxaflex en Toppoint).
  * *Verwerking Orderbevestigingen door Backoffice (in LogicTrade):* De backoffice verwerkt de inkomende fabrieksbevestigingen in LogicTrade, voert het externe fabrikant-ordernummer in en legt de bevestigde leverweek vast (standaard gealloceerd op zondag van de productieweek).
  * *Bewaking Levertijdstatussen in LogicTrade:* LogicTrade bewaakt de status van inkooporders: *Onbevestigd* (geen orderbevestiging retour), *Bevestigd* (orderbevestiging en leverweek verwerkt in LogicTrade) en *Te laat binnen* (bevestigde leverweek verstreken zonder magazijnbinnenmelding).
* **Financieel Escalatie- & Foutafhandelingsprotocol:** Fouten ontstaan door overname of verkeerd invullen (bijv. plintenaantallen of afwijkende stofcodes) worden direct door de controleur gesignaleerd. Indien door de controleur gesignaleerd, wordt de afhandeling volgens deze governance uitgevoerd:
  * *Onder € 200 - € 300:* Collegiale oplossing, in overleg met de klant (bijvoorbeeld "sam-sam" / coulance), of bij grote totaalprojecten intern geabsorbeerd door de retailer.
  * *Boven € 200 - € 300:* Indien met de klant geen minnelijke oplossing mogelijk is, vindt directe escalatie plaats naar de directie.
* **Trigger voor Montagefase:** Na verzending bevindt het dossier zich in afwachting tot de materialen door toeleveranciers worden geleverd en in het magazijn worden binnengemeld in LogicTrade ERP. Deze magazijnbeschikbaarheid vormt de operationele trigger voor de planner om de montage definitief af te stemmen en in gang te zetten (het binnenmeldingsproces zelf is geen onderdeel van het portaal).

#### 1.5.6 Fase 5: De Montagefase (Planning, Uitvoering & Oplevering)
* **Magazijnontvangst & Montageplanning:**
  * *Binnenmelding als Operationele Trigger:* De dagelijkse goederenontvangst en binnenmelding door de magazijnmedewerker in LogicTrade ERP registreert de fysieke beschikbaarheid van goederen.
  * *Twee Planningsstromen:*
    * **Route A (Magazijngestuurd - Standaard):** Zodra alle orderregels compleet binnen zijn in het magazijn, neemt de planning contact op met de klant om de montagedatum vast te leggen.
    * **Route B (Vooruitplanning bij Harde Deadlines):** Bij dwingende verhuisdata plant de verkoopadviseur/planner de montage vooraf in, met een verplichte buffer van 2 tot 3 weken ná de door de fabrikant bevestigde leverweek (om transport- en fabricagevertragingen betrouwbaar op te vangen).
  * *Wekelijkse Week-Vooruit Controlecyclus:* De planner/werkvoorbereider controleert wekelijks alle dossiers voor de komende werkweek op magazijncompleetheid; bij onverhoopte vertragingen wordt direct geschakeld vóórdat de monteur vertrekt.
* **Digitale Werkinstructie voor Monteurs:** Monteurs zien op hun tablet direct alle relevante montage-informatie: ruimtenummers, posities, montagewijzen, uitsluitend definitieve productiematen, bijzonderheden en de route/toegang tot de werkplek.
* **Schadepreventie & Fotorapportage (Vooraf & Achteraf):**
  * Voor aanvang van de werkzaamheden maken de monteurs foto's en korte video's van de bestaande toestand van de ruimte en de route (ter voorkoming van discussies over reeds aanwezige beschadigingen).
  * Na afronding van de montage leggen zij het eindresultaat fotografisch vast.
* **Positie-Afvinking & Montagebevindingen:**
  * Elke montagepositie wordt na plaatsing individueel afgevinkt in de app, inclusief foto van het gemonteerde product en eventuele montagenotities.
  * Indien er sprake is van restpunten, transportschade, productiefouten of naleveringen, registreert de monteur direct een duidelijke 'montagebevinding' met toelichting en detailfoto's ten behoeve van de servicemonteur.
* **Montagerapport (Opleverdocument) & Verplichte Opleveringsvragen:**
  * De digitale werkbon dwingt de monteur om drie verplichte opleveringsvragen af te vinken alvorens te laten ondertekenen:
    1. *Is onderhavig leverproduct met de klant doorgenomen?*
    2. *Is de werking en bedieningsfunctie (o.a. SmartCord, motoren, afstandsbediening, plooival) aan de klant gedemonstreerd?*
    3. *Zijn alle geleverde goederen gecontroleerd op compleetheid en schadevrijheid?*
* **Facturatie & Betalingsafhandeling (ERP & Showroom):**
  * Facturatie en betalingen verlopen via het ERP-systeem, bankoverschrijving of pintransactie in de showroom/winkel.
  * Mobiel pinnen bij de monteur op locatie is in versie 1 (V1) buiten scope; de monteur richt zich uitsluitend op de vaktechnische montage en oplevering.
* **Afsluiting & Klantenacceptatie:** Na gezamenlijke inspectie tekent de klant op de tablet voor ontvangst op het digitale **Montagerapport**. Eventuele montagebevindingen worden hierop expliciet vermeld en direct gerouteerd naar de servicefase.

#### 1.5.7 Fase 6: De Nazorg- & Afrondingsfase (Restpunten, Service & Dossiersluiting)
* **Doelgerichte Oplossing:** De tijdens de oplevering vastgelegde montagebevindingen worden door de planner ingepland en door de servicemonteur op locatie verholpen.
* **Procesvoering in het Portaal:** De servicemonteur gebruikt het portaal om de exacte bevindingen, foto's en instructies in te zien en het herstelresultaat digitaal en fotografisch vast te leggen. Deze fase verloopt operationeel als een gerichte herhaling van de montageworkflow met dezelfde waarborgen voor kwaliteit.
* **Dossierafsluiting:** De servicefase wordt formeel afgesloten zodra alle openstaande acties zijn verholpen en gesloten. Het projectdossier wordt definitief overgezet naar de status **Afgerond** zodra `products.length > 0`, 100% van de producten de status `'gereed'` bezit en er 0 openstaande acties resteren.

---
## Deel 2: Ruimtelijke Hiërarchie

### 2.1 Niveau 1: Gebouw
Dit is het fysieke pand (huis, kantoor, flat, appartementencomplex, etc.) waar de eerste voordeur zit.  
*Logistieke gegevens:* Bevat de informatie voor planning en montage: adres, parkeersituatie, laad- en losmogelijkheden, aanwezigheid van een lift, trappenhuis en toegangsinstructies.

### 2.2 Niveau 2: (Verblijfs)object (BAG-Definitie & Werklocatie)
* **Officiële BAG-definitie:** *"De kleinste zelfstandige eenheid binnen een gebouw die geschikt is voor bewoning of bedrijvigheid, met een eigen afsluitbare toegang."*
* **Toepassing in de Woninginrichting-praktijk (Grondgebonden vs. Gestapelde bouw):**  
  * *Grondgebonden eengezinswoning:* In de reguliere particuliere praktijk valt het gebouw 1-op-1 samen met het verblijfsobject (`Gebouw = Verblijfsobject`).  
  * *Gestapelde bouw & Bedrijfsverzamelgebouwen:* Eén overkoepelend fysiek gebouw omvat meerdere zelfstandige verblijfsobjecten (bijv. *Appartement 4B*, *Studio 12*, *Kantoorruimte 2e etage West*). Elk verblijfsobject heeft zijn eigen afsluitbare toegang, eigen adres-/huisnummertoevoeging en eigen inmeet-/montageopdracht.  
  * *Route naar het object:* Cruciaal voor het montageproces en de calculatie is de route vanaf de buitendeur naar de voordeur van het verblijfsobject: centrale entree, tussenliggende brand- en tussendeuren, liften, trappenhuizen en galerijen bepalen de bereikbaarheid en sjouwtijd.  
  * *Standaard uitgangspunt:* Men start standaard vanuit het principe `Gebouw = Object`, maar kan binnen het project eenvoudig aanduiden dat een object zich in een groter verzamelgebouw bevindt.

### 2.3 Niveau 3: Verdieping
Het horizontale niveau binnen een wooneenheid waarop één of meerdere ruimtes zich bevinden (in het Nederlands domeinmodel canoniek aangeduid als **Verdieping**, in code-contracten/API's technisch gerepresenteerd als `floor` of `etage`; bijv. *Kelder, Souterrain, Begane grond, 1e verdieping, Zolder/Vliering of Entresol/Tussenvloer*).  

*Waarom dit een eigen niveau is:*
* **Plattegrond-structuur & Multi-Verdieping Ruimtes (Vides & Traphallen):**
  * *Standaard:* Bouwtekeningen en digitale plattegronden zijn primair per verdieping georganiseerd; inmeters en verkoopadviseurs werken visueel en functioneel per verdieping.
  * *Bouwkundige standaard voor Multi-Storey Spaces (BIM / IFC `IfcSpace`):* In de architectuur en bouwwereld wordt een ruimte die zich verticaal over meerdere verdiepingen uitstrekt (zoals een vide, traphal of atrium) gemodelleerd als een **Doorlopende Ruimte (Multi-Storey Space)**.
    * *Toewijzingsregel:* De ruimte wordt administratief en logistiek gekoppeld aan de laagste verdieping waar de betreedbare vloer start (meestal Begane grond), met een verdiepingbereik-attribuut `[Start: Begane grond, Eind: 1e verdieping]`.
    * *Verticale gevelpuien over verdiepingen heen:* Wanneer ramen verticaal boven elkaar geplaatst zijn en doorlopen van BG tot de verdieping (zoals bij een open vide of langs een trapopgang), behoren deze ramen tot het **doorlopende verticale wandvlak** van deze ruimte. De inmeettool projecteert deze wand als één doorlopende verticale geveldoorsnede, waarbij elk raam zijn eigen functionele montagewijze en reikhoogte/bedieningshoogte krijgt (bijv. onderraam: bedienbaar vanaf BG-vloer; bovenraam: bedienbaar vanaf bordes of overloop verdieping).
* **Constructie & Ondergrond:** Het type constructievloer kan verschillen per niveau (begane grond = vaak beton/zandcement met vloerverwarming; verdiepingen = vaak houten balklagen, kanaalplaten of breedplaatbeton). *(De gedetailleerde montagetechnische consequenties, boorrestricties, geluidsnormen en ondergrondregels zijn ondergebracht in Deel 3: Productcategorieën, Inmeetmethodieken & Rekenregels).*
* **Koppeling van Trappen:** Vormt het begin- en eindpunt voor trappen die verdiepingen met elkaar verbinden.

### 2.4 Niveau 4: Ruimte(s)
De afzonderlijke vertrekken in een object waar producten moeten worden geleverd of gemonteerd.  

* **Formele Nummering & Klant-Alias (Standaard Nummeringsconventie):**
  * *Unieke Nummering:* Elke ruimte wordt primair geïdentificeerd met een **uniek volgnummer (Ruimte 1, Ruimte 2, Ruimte 3...)**.
  * *Naam als Alias / Label:* De functionele ruimtenaam (*Hal, Woonkamer, Keuken, Slaapkamer 1, Ouderslaapkamer, Portaal, etc.*) fungeert als de **Klant-Alias** voor herkenbaarheid op offertes, orderbevestigingen en communicatie.
  * *Nummeringsvolgorde in het Object:*
    1. **Startpunt:** De hoofdentree / voordeur van het object.
    2. **Ruimte 1:** De ruimte waar je het object binnenstapt is altijd **Ruimte 1** (standaard de *Hal / Entree / Tochtportaal*).
    3. **Van beneden naar boven:** Eerst worden alle ruimtes op de laagste bouwlaag genummerd (Begane grond), daarna achtereenvolgens de 1e verdieping, 2e verdieping / zolder, en tot slot kelder/souterrain.
    4. **Van links naar rechts (of kloksgewijs):** Binnen elke verdieping worden de vertrekken vanaf het centrale verkeerspunt (entree of trapopgang) systematisch van **links naar rechts** (of met de klok mee) genummerd.
* **Ruimtecondities & Eigenschappen:**
  * Bevat vertrekcondities zoals afmetingen, bruto vloeroppervlak, omtrek, plafondhoogte, constructietype (beton/gips) en aanwezigheid van vloerverwarming.
  * *Multi-Verdieping Ruimtes (Hal / Vide):* Ruimtes die over meerdere bouwlagen doorlopen (zoals een open hal met trappenhuis) behouden hun nummering op het startniveau (bijv. *Ruimte 1: Hal (BG & 1e verdieping)*) met een ruimtelijke referentie op de bovenverdieping.
  * *Gespiegelde Woningtypen (Nieuwbouw):* Bij seriebouw levert de aannemer vaak generieke type-plattegronden; de ruimte kan een statusvlag *'Gespiegeld t.o.v. standaardtype'* bevatten zodat de oriëntatie van wanden, ramen en aansluitingen direct correct wordt geïnterpreteerd.

### 2.5 Niveau 5: Vlakken (Begrenzende Oppervlakken van de Ruimte)
Een ruimte bestaat bouwkundig en geometrisch uit begrenzende **Vlakken (Surfaces)**. Elke montage of producttoepassing grijpt fysiek aan op een specifiek vlak.

* **Vlaktypen binnen een Ruimte:**
  * **1. Verticale Vlakken (Wandvlakken & Gevels):**
    * *Wand A (Voorgevel / Straatzijde), Wand B (Rechterzijwand), Wand C (Achtergevel / Tuinzijde), Wand D (Linkerzijwand)*, plus eventuele tussenwanden of scheidingswanden.
    * *Attributen van het wandvlak:* Lengte, strakke hoogte, constructiemateriaal (massief beton, kalkzandsteen, cellenbeton, metal stud, houten skelet), afwerking (stucwerk, spachtelputz, behang) en aanwezigheid van stucprofielen / hoekprofielen op dagkanten.
  * **2. Horizontale Vlakken (Vloeren & Plafonds):**
    * *Vloervlak:* Constructievloer, type dekvloer (zandcement, anhydriet), aanwezigheid van vloerverwarming, dilataties.
    * *Plafondvlak:* Plafondhoogte (strak gemeten), constructietype (kanaalplaatbeton, breedplaat, houten balklaag met rachelwerk en gipskarton).
  * **3. Schuine Vlakken (Dakvlakken & Kapconstructies):**
    * *Schuin dakvlak links / rechts:* Dakhellingshoek (in graden), constructieve gordingen, sporen, knieschotten.
  * **4. Verbindende Elementen (Trappen & Bordessen):**
    * Verbindt ruimtes en verdiepingen fysiek met elkaar (gekoppeld aan de vertrekruimte met verwijzing naar de bestemmingsruimte/verdieping).
    * *Bordessen:* Vormen horizontale tussenplateaus die rekenkundig en montagetechnisch als separaat horizontaal vloervlak/stootbordovergang worden bemeten.
    * *Trap-ondergrond:* Standaard default in de UI is **Hout** (met keuzeopties voor beton, staal, of bestaande bekleding/lijmresten).
    * *Wangen bekleden:* Vaste intake-optie in de UI (*Standaard default: "Niet bekleed"*; optioneel 1 of 2 zijden meebekleden).

* **Verspringende, Complexe en Multi-Verdieping Ruimtes (De Hal / Vide Casus):**
  * Een complexe ruimte (zoals een hoge hal met traphuis en vide) heeft **niet één uniforme hoogte of één enkel plafond**, maar bestaat bouwkundig uit specifieke deelvlakken:
    * **Wandvlak 1 (Hoge Gevelwand):** Loopt over 2 verdiepingen door (vanaf BG-vloer tot aan het plafond van de 1e verdieping).
    * **Plafondvlak 1 (Hoog Plafond / Vide):** Het plafond hoog boven de vide/traphal (op 2-verdiepingshoogte).
    * **Wandvlak 2 (Lage Wand onder Bovenportaal):** Bevindt zich onder de overloop/het bovenportaal en heeft een normale enkel-verdiepingshoogte.
    * **Plafondvlak 2 (Laag Plafond onder Bovenportaal):** Het verlaagde horizontale vlak onder de constructievloer van de overloop.
    * **Vloervlak:** De doorlopende begane grondvloer.
  * *Modellering in de Software & Scope-notitie (MVP vs. Toekomstige Release):* In het conceptuele domeinmodel plaatst het vlak zich als zelfstandig niveau tussen Ruimte en Positie om elk deeloppervlak exact te definiëren qua afmetingen, hoogte en materiaal. **Let op (Applicatiescope):** In de eerste versie (v1) van de inmeetapplicatie wordt het vlak over verschillende niveaus nog niet geïmplementeerd. We werken dan nog met vlakken per verdieping. De impact en wenselijkheid van vlakken over meerdere verdiepingen wordt later onderzocht.


### 2.6 Niveau 6: Positie (Detail-locatie / Opening BINNEN een Vlak)
Een positie is een specifieke functionele montageplek of gevelopening die zich **altijd binnen een specifiek vlak bevindt**.

* **Positietypen per Vlak:**
  * **Binnen een Verticaal Wandvlak:**
    * *Gevelopeningen & Kozijnvakken:* Raam, voordeur, tuindeur, schuifpui, draaikiepraam, erkerkozijn.
    * *Wandsecties:* Een specifiek muurvlak voor wandbekleding (behang, akoestische vilt-lattenpanelen, lambrisering).
  * **Binnen een Horizontaal Vloervlak:**
    * *Vloerposities:* Volledig vloervlak, specifieke zone/deelvlak (bijv. zithoek vs eethoek), verzonken matput, convectorput, dilatatielijn.
  * **Binnen een Horizontaal Plafondvlak:**
    * *Plafondposities:* Gordijnrail-tracé (in het plafond of vóór de gevel), koofmontage, daklicht, lichtstraat.
  * **Binnen een Schuin Dakvlak:**
    * *Dakraamposities:* Dakraam (Velux, Fakro, Roto tuimelraam).
  * **Binnen een Trap-element:**
    * *Trapposities:* Rechte treden, draaitreden (halve draai / kwartslag), stootborden, wangen.
* **Positienummering & Identificatie:**
  * *Unieke Nummering per Ruimte/Vlak:* Posities worden uniform genummerd (**Positie 1, Positie 2, Positie 3...**).
  * *Klant-Alias & Individuele Naamgeving (Vrij overschrijfbaar in de UI):* Elke individuele positie krijgt een uniek nummer en automatisch een herkenbare beschrijvende suggestie (*"Raam links voorgevel"*, *"Voordeurglas"*, *"Schuifpui tuin"*); deze naam is te allen tijde door degene/de rol die is ingelogd (met de juiste rechten) direct in de UI te overschrijven naar wens van de klant (bijv. Positie 2: *"kiepraampje midden boven raampartij links"*).
  * *Combinaties van Posities / Samengestelde Raampartij (Positie-Groepering / Cluster):* Een pui of opening kan bouwkundig bestaan uit meerdere samenhangende posities (bijv. Positie 1, 2, 3 en 4: drie bovenraampjes en één groot raam beneden). In de software kan de **combinatie van posities een overkoepelende naam krijgen** (bijv. **"raampartij links"** of **"erker voorzijde"**). Binnen deze samengestelde groep kan vervolgens elke afzonderlijke positie een specifieke naam krijgen die refereert aan de combinatie (bijv. Positie 1: *"bovenraam links raampartij links"*, Positie 2: *"kiepraampje midden boven raampartij links"*, Positie 3: *"bovenraam rechts raampartij links"*, Positie 4: *"groot raam beneden raampartij links"*). Zowel de overkoepelende combinatienaam als de individuele positienamen kunnen door de ingelogde gebruiker met de juiste rechten direct in de UI worden ingevoerd en flexibel worden aangepast.
  * *Meetvolgorde & Nummeringsconventie (Z-Conventie per Opening):* Binnen een opening (bijv. een samengesteld kozijn met meerdere glasvakken, bovenlichten of draaiende delen) worden deelposities uniform gemeten en genummerd in de vorm van een **"Z"** (van **links naar rechts** en van **boven naar onder** in een zigzagpatroon: linksboven → rechtsboven → linksonder → rechtsonder). Traptreden worden uniform genummerd **van onder naar boven** (Trede 1 = onderste trede bij vertrekvloer).
* **2.6.1 Vloer-specifieke Positieregels (Behorend bij Niveau 6: Positie):**
  * *1. Volledige ruimte (Standaard):* Als er in de gehele ruimte één vloer moet worden gelegd, dan is dat **1 positie voor de hele ruimte** (bijv. in Ruimte Woonkamer --> Positie 1: Vloer).
  * *2. Zones / Deelvlakken binnen ÉÉN ruimte:* Als er een vloer in een gedeelte (cq in een zone) van een ruimte moet worden gelegd (bijv. binnen de Woonkamer: Deel A *Zithoek* krijgt parket en Deel B *Eethoek* krijgt PVC, of een verzonken *Droogloopmat* bij de tuindeur), dan krijgt **elke zone binnen die ruimte zijn eigen positie** (*bijv. 1: Vloer zithoek, 2: Vloer eethoek*). Tussen de zones leg je de overgang/scheiding vast (bijv. een overgangsprofiel of dilatatievoeg).
  * *3. Doorlopende vloer over MEERDERE aparte ruimtes:* Als één vloer drempelloos doorloopt over meerdere aparte ruimtes (bijv. van *Woonkamer* naar *Hal* of *Keuken*), dan **meet je altijd in per ruimte** (i.v.m. afwijkende hoeken, radiatoren en plintlengtes per vertrek). Je moet over verschillende ruimtes (op een verdieping) kunnen aangeven dat de vloer doorloopt via het attribuut `doorlopend_vanuit` (waarin de bronruimte wordt gerefereerd): *drempelloos* (één doorlopend legpatroon en centrale startlijn) of met een *overgang/scheiding* (zoals een dorpel, dilatatiestrip, T-profiel of kitvoeg). Dit borgt dat het zaagverlies en snijpercentage projectbreed/verdiepingbreed geoptimaliseerd berekend kan worden zonder kunstmatige opdelingsverliezen.

### 2.7 Niveau 7: Sub-posities (Productlagen met suffix 1a, 1b...)
Een productlaag definieert het concrete product of de bewerking die op een positie wordt aangebracht.
* **Single-Product Rule (Geen Letterbadge bij Enkelvoudig Product):**
  Indien er op een positie slechts **één enkel product** is toegewezen (bijv. alleen een Duette of alleen een PVC-vloer), wordt er in de UI en documenten **géén letterbadge (1a)** getoond. De positie toont eenvoudigweg de positie-identificatie (`Positie 1: Duette`). Pas zodra er sprake is van **twee of meer productlagen ($\ge 2$)** op dezelfde positie (bijv. 1a = Hor, 1b = Houten jaloezie, 1c = Overgordijn), worden de letters `1a`, `1b`, `1c` expliciet toegekend en getoond.
* **Synchrone Cluster-Notatie:**
  Bij een samengestelde raampartij of geclusterde posities (bijv. Positie 1 en 2 overkoepeld door één brede rail of gordijn) wordt de synchrone relatie aangeduid als `Positie 1-2` (of bij meerdere lagen `Positie 1-2a`).

Hierbij onderscheiden we twee verschijningsvormen:
* **1. Meerdere productlagen op één unieke positie (Sub-posities 1a, 1b...):**  
Dit betreft meerdere op elkaar aansluitende producten of bewerkingen op één fysieke positie:
* **Bij een Raam:** 1a = Hor, 1b = Houten jaloezie (in de dag), 1c = Overgordijn (op de dag).
* **Bij een Velux raam / Dakraam:** 2a = Buitenzonwering/screen (hittewering buiten), 2b = Verduisterend plissé in zijprofielen (binnen), 2c = Insectenhor voor tuimelraam.
* **Bij een Daklicht / Lichtstraat:** 3a = Horizontaal aangedreven plissé/honingraat (elektrisch/solar), 3b = Insectenwering/pollengaas.
* **Bij een Vloer:** Ook de positie Vloer kan meerdere productlagen hebben:  
  4a = Egalisatie / Primer (voorbehandeling),  
  4b = Ondervloer / Folie,  
  4c = Hoofdproduct (bijv. PVC dryback visgraat),  
  4d = Randafwerking (bijv. 42 strekkende meter hoge MDF plint).
* **Bij een Trap:** 5a = Overzettreden, 5b = Stootborden, 5c = Trapneusprofielen / LED-verlichting.
* **2. Productlaag over Meerdere Posities Heen (Multi-Positie Overkoepeling):**  
  Een productlaag hoeft niet beperkt te blijven tot één enkele positie, maar kan ook **over meerdere posities binnen hetzelfde vlak heen lopen**:
  * *Doorlopende Gordijnrail:* Eén enkele doorlopende gordijnrail die over Positie 1 én Positie 2 reikt (bijv. over twee losse ramen of een raam + balkondeur).
  * *Brede Duette / Binnenzonwering:* Eén brede Duette van bijv. 2,57 meter die twee aangrenzende raamposities integraal overkoepelt om een rustig gevelaanzicht en minder bedieningskoorden te realiseren.
  * *Modellering in de Applicatie:* De productlaag wordt gekoppeld aan de samengestelde/geaggregeerde posities (bijv. Laag 1-2a), terwijl de onderliggende posities 1 en 2 zelfstandig hun eigen dagmaten, glasmaten en specifieke bouwkundige openingseigenschappen behouden.

### 2.8 Projectbrede Posten & Diensten (Gepinde Kolom `pos_project_algemeen`)
Niet alle artikelen, bewerkingen of kosten in een woninginrichtingsproject zijn direct te herleiden naar één fysieke raamopening of specifieke vloerruimte. Denk aan:
* **Algemene transport- en voorrijkosten:** Vaste logistieke vergoeding voor inmeten of bezorging/montage.
* **Parkeerkosten & Vergunningen:** Specifieke binnenstedelijke parkeervergunningen of parkeerkosten op nacalculatie.
* **Steigerhuur & Valbeveiliging:** Huur van een rolsteiger voor hoge vides of trapopgangen over meerdere verdiepingen.
* **Algemene Afvalcontainer & Stortkosten:** Containerplaatsing voor grootschalige sloop- en afvoerwerkzaamheden.
* **Projectkortingen & Commerciële Totaalcorrecties:** Een algemene projectkorting of coulancepost over het gehele orderbedrag.
* **Arbeid, Uurloon & Montagetarieven (MVP-Afbakening):** In de EasyM2M MVP worden alle calculaties rondom arbeid, montagetijden, stelposten en uurtarieven handmatig ingevoerd of direct afgehandeld in het ERP-systeem (LogicTrade). Geautomatiseerde arbeidsberekening binnen de mobiele inmeetapp valt expliciet buiten de MVP-scope.

**Architecturale Verankering in het Systeem:**
Om te voorkomen dat deze algemene regels als 'spookposities' tussen de fysieke ruimtes en ramen belanden, worden zij in het datamodel en de matrix verankerd aan een speciale systeempositie:
`pos_project_algemeen` (behorend bij de virtuele ruimte *Project Algemeen* op *Objectniveau*).
In de Dynamische Hiërarchische Matrix (Hoofdscherm 4) wordt deze systeempositie weergegeven als een **vaste, gepinde kolom aan de uiterste linkerzijde** van de matrix. Hierdoor behoudt de gebruiker direct overzicht over de algemene projectkosten, zonder verstoring van de bouwkundige boomstructuur van verdiepingen en vertrekken.

---

## Deel 3: Productcategorieën, Inmeetmethodieken & Rekenregels (De 6 Categorieën in Detail)

Commercieel, functioneel en op de werkvloer wordt er gesproken over **6 categorieën** conform Profiel A van het productassortiment:
1. **Gordijnen & Rails**
2. **Raamdecoratie (Binnenzonwering & Horren)**
3. **Vaste Vloerbekleding & Dekvloertechniek**
4. **Trapbekleding, Traprenovatie & Trapelementen**
5. **Buitenzonwering, Gevelsystemen & Rolluiken**
6. **Diensten, Montage & Montagelogistiek**

Omdat productspecificaties, stof- en materiaaleigenschappen, confectievormen en montagetechnieken een directe sturende impact hebben op de inmeetmethodiek, toleranties, aftrekberekeningen en opleverchecklisten, zijn de productdefinities en de inmeet- en rekenregels in dit deel integraal samengebracht.

---

### 3.1 Algemene Inmeetprincipes (Domeinoverstijgend voor Meerdere Categorieën)

#### 3.1.1 Het Principebesluit: Dagmaat vs. Blijvende Maat, UI Drie-eenheid & Standaard Montagesituaties
Binnen EasyM2M geldt een fundamenteel en domeinoverstijgend principebesluit over hoe maatvoering, montagesituaties en fabrieksberekeningen in de software worden gemodelleerd en gepresenteerd:

* **Strikte Maateenheden Invariant (INV-UNIT-01):**  
  Alle lineaire afmetingen (breedtes, hoogtes, dieptes, dagmaten, productiematen, aftrekken, spelingen) worden in het gehele portaal, in alle rekenregels en in de API-contracten **ALTIJD en uitsluitend in millimeters (mm)** vastgelegd en berekend als integer. Oppervlakten worden uitgedrukt in vierkante meters ($m^2$, afgerond op 2 decimalen), volumes in liters of kilogrammen. Het gebruik van centimeters (cm) in invoervelden is strikt verboden ter preventie van schaalfouten met een factor 10.
* **De Bronmaat is ALTIJD de Dagmaat (Strakke Maat):**  
  De inmeter meet en registreert in het veld te allen tijde de daadwerkelijke, strakke fysieke opening (de 'dagmaat': B1..B3, H1..H3). De inmeter hoeft — en mag — op de ladder nooit zelfstandig fabrieksaftrekken, spelingen of confectietoenames uit het hoofd te gaan uitrekenen of direct als bestelmaat in te voeren. Dit voorkomt menselijke rekenfouten onder tijdsdruk op de bouwplaats.
* **De UI Drie-eenheid:**  
  In de gebruikersinterface van de inmeettool en het backofficeportaal worden voor elk maatvoeringsveld altijd drie elementen transparant getoond:
  1. **Gemeten Dagmaat:** Het invoerveld met de door de inmeter gemeten strakke maat (bijv. `2400 mm`).
  2. **Rekenregel / Formule:** De actieve formule die op basis van productgroep, montagewijze en merkconfigurator wordt toegepast (bijv. `Dagmaat - 10 mm`).
  3. **Blijvende Maat (Bestelmaat):** Het berekende resultaat dat als definitieve productiemaat naar fabrikant/atelier gaat (bijv. `2390 mm`).
* **Standaardisatie van de Drie Primaire Montagesituaties (Transversaal voor alle Verticale Montages):**  
  Voor gordijnrails, roedes en alle raamdecoratieproducten kiest de inmeter verplicht uit drie gestandaardiseerde situaties (waarbij de Montagehoogte te allen tijde een verplicht invoerveld is conform het universele protocol in §3.1.4):
  1. **In het plafond:** Bevestiging direct tegen het bouwkundige plafondvlak of in een plafondkoof (vergt plafondinspectie en SDS-boorhamer bij massief beton of speciale pluggen bij holle constructies).
  2. **Op de dag:** Bevestiging op de wand vóór/boven de opening. Hierbij geldt een **verplicht invoerveld Montagehoogte** (afstand van vloer tot bovenzijde steun conform §3.1.4) en een expliciete **checkbox 'Tegen het plafond'** (strak aansluitend tegen plafond gemonteerd zonder tussenkier).
  3. **In de dag:** Bevestiging tussen de dagkanten (binnen de negge). Bevat tevens de expliciete subkeuze **'Plafond van de negge'** (bevestiging tegen de bovenzijde/latei van de dagopening).
* **Handmatige Correctie (Override) door Inmeter & Audittrail:**  
  De uitgerekende blijvende maat is te allen tijde overschrijfbaar door de inmeter. Indien een specifieke bouwkundige situatie (bijv. een sterk wijkende dagkant, afwijkend stucwerk of een specifieke klantwens) afwijkt van de standaard formule, kan de inmeter de berekende maat handmatig corrigeren.
  * *Verplicht toelichtingsveld:* Zodra een inmeter de berekende maat overschrijft, toont de software verplicht een invoerveld voor een schriftelijke toelichting/reden. Zonder deze toelichting kan de meting niet worden opgeslagen.
  * *Visuele markering:* In de UI krijgt de overschreven waarde een opvallende kleurmarkering (oranje/rode badge: `[Handmatige Aanpassing]`), zodat de werkvoorbereider / controleur in Fase 4 direct ziet dat hier bewust is afgeweken van de standaard rekenregel.
  * *Audittrail & ERP Export:* De oorspronkelijke gemeten dagmaat, de standaard berekende maat én de handmatig gecorrigeerde maat blijven alle drie bewaard in de database inclusief tijdstempel en gebruikers-ID. Bij export naar ERP LogicTrade wordt altijd de definitief overschreven maat geëxporteerd als bindende bestelmaat.
* **Dwingende Inrichting van de Inmeettool ter Borging van de Kenniskloof:** *(Wens/idee)*  
  De inmeettool fungeert als het centrale kwaliteitsanker van de organisatie. Waar senior adviseurs (zoals Carlo) leunen op 35 jaar impliciete praktijkervaring om alle details vooraf te tackelen, helpt de inmeettool dezelfde foutloosheid te borgen bij junior adviseurs en nieuwe filialen (zoals Maastricht). Het dwingend inrichten van het inmeetdossier (waarbij de inmeter een meting pas kan afronden nadat relevante parameters zoals montagehoogte, ondergrondclassificatie, montagewijze, plint- en zaaginspectie zijn ingevoerd) is het beoogde streefbeeld. Dit elimineert ad-hoc telefoontjes, montagediscussies tussen verkoop en inmeter (Guy), en faalkosten op locatie.

#### 3.1.2 Uniforme Werkwijze, Referentiepunten & Visuele Opname
* **Filosofie van de Uniforme Werkwijze & Uitbanning Vage Meetbonnen:**  
  Een kwalitatieve inmeting staat of valt met standaardisatie. Software maakt zelfstandig geen rekenfouten, mits de juiste invoer op de juiste plek belandt. Door iedere adviseur en inmeter exact dezelfde vaste werkwijze te laten hanteren, worden menselijke vergissingen, verwisselingen van breedte en hoogte en misverstanden tussen inmeting en montage tot een absoluut minimum beperkt.  
  * *Verbod op Beknopte 1-Regelige Meetbonnen (De Kelly vs. Carlo Casus):* In de praktijk leiden vage, beknopte meetbonnen (zoals bij verkoopadviseur Kelly: *"meten zoveel ramen gordijnen"*) tot ernstige procesverstoringen. Inmeter Guy moet ter plekke bij de klant het complete advieswerk opnieuw doen (welke plooivorm, enkele of dubbele retourplooi, benodigde railafstand, type waverail), wat leidt tot dubbel werk, tijdverlies en trage, incomplete overdrachten naar de binnendienst. Bij Carlo staat daarentegen alles vooraf in detail gespecificeerd (Quick-Step vloer inclusief 14 mm plint en kitten; Interstil designrails met exacte wand- of plafondsteun-artikelnummers). Het portaal dwingt daarom af dat een inmeetopdracht pas kan worden aangemaakt wanneer alle essentiële keuzes (plooitype, steunlengtes, railafstanden, plintafwerking) vooraf zijn ingevoerd. De inmeter meet gericht op en draagt het dossier direct digitaal over zonder mondelinge ruis.
* **Vaste Meetvolgorde & Werken per Gevelopening:**  
  * **Strikte Meetvolgorde:** Altijd **eerst de breedte, daarna pas de hoogte**.
  * **Werken per Gevelopening:** De inmeter werkt en registreert strikt **per afzonderlijke gevelopening** (Positie 1, 2, 3...) in plaats van kriskras over een wandvlak. Dit elimineert nummeringssprongen in de software en waarborgt dat posities en meervoudige raamdecoratieproducten eenduidig aan elkaar gekoppeld blijven.
  * *Montagehoogte (MH):* Wordt integraal gemeten en vastgelegd conform het universele protocol in §3.1.4.
  * *Horizontaal (Breedte B1, B2, B3):* Altijd gemeten van **boven naar onder** (B1 = boven, B2 = midden, B3 = onder, gemeten van links naar rechts).
  * *Verticaal (Hoogte H1, H2, H3):* Altijd gemeten van **links naar rechts** (H1 = links, H2 = midden, H3 = rechts, gemeten van boven naar onder).
  * *Dagkant- & Neggemetingen (D1, D2):* D1 = dagkant/negge links, D2 = dagkant/negge rechts (beschikbare inbouwdiepte).
  * *Diagonale Kruismetingen (D1, D2):* Gestandaardiseerd voor haaksheids- en scheefstandscontrole bij kozijnen of nissen: **D1 meet van linksonder naar rechtsboven (↙ → ↗)** en **D2 meet van rechtsonder naar linksboven (↘ → ↖)**. Het verschil tussen D1 en D2 toont direct de mate van scheefstand of afwijking van de 90°-hoek.
* **De Triadische Meetcontrole: Maatverloop, Scheefstand & Haaksheid:**  
  Om faalkosten en optische opleverklachten uit te sluiten, hanteert de inmeter drie complementaire controlemechanismen:  
  1. *Maatverloop Detecteren (De Gouden 3-Punts Meetregel):*  
     * **Altijd minimaal 3 breedtes en 3 hoogtes:** Zelfs bij ramen die op het oog zuiver recht lijken, meet de inmeter altijd minimaal 3 breedtes (B1, B2, B3: boven, midden, onder) en 3 hoogtes (H1, H2, H3: links, midden, rechts).  
     * *Doel van de 3-puntsmeting:* Toont het onderlinge **maatverloop** en maattoleranties tussen de bouwvlakken aan (bijv. een taps toelopende sparing, een afgeschuinde vensterbank of een doorhangend plafond; bijv. H1 = 85 cm, H2 = 84 cm, H3 = 83 cm). De kleinste strakke maat bepaalt de productiemaat bij montage in de dag.  
  2. *Scheefstand & Loodrechtheid Controleren (Waterpas / Kruislijnlaser):*  
     * *Waarom volstaan 3 hoogtemetingen niet voor scheefstand?* Drie lasermetingen tonen uitsluitend het onderlinge maatverschil tussen twee bouwvlakken, maar bepalen **niet** of de gevelopening zelf loodrecht en waterpas staat ten opzichte van de zwaartekracht. Een sparing kan immers overal exact 84 cm hoog en 120 cm breed zijn, maar toch als geheel 15 mm uit het lood staan.  
     * *Vaste waterpastoetsing:* De inmeter controleert de stijlen en de onderdorpel/vensterbank daarom altijd met een **(digitale) waterpas of kruislijnlaser**.  
     * *Optische scheefhang-preventie:* Als een kozijn uit het lood staat, hangt een zuiver waterpas gemonteerd product (zoals een horizontale jaloezie of rolgordijn) optisch scheef ten opzichte van de vensterbank of kozijnstijl (of vertoont taps toelopende lichtspleten).  
     * *Verloop- & Scheefstandscommunicatie met de klant (> 5 mm):* Wordt een maatverloop of scheefstand van > 5 mm geconstateerd? Dan bespreekt de inmeter dit ter plekke met de klant en legt dit bindend vast op het digitale inmeetverslag (*"Maatverloop van X mm / scheefstand van kozijn geconstateerd en besproken met klant; risico op optische scheefstand t.o.v. schuin kozijn of lichtkieren geaccepteerd"*). Hiermee wordt voorkomen dat de klant de monteur bij oplevering aanspreekt op scheefhangen.  
  3. *Haaksheid & Vormvastheid (Diagonale Kruismeting D1, D2):*  
     * Diagonale kruismetingen (D1 van linksonder naar rechtsboven ↙ → ↗, D2 van rechtsonder naar linksboven ↘ → ↖) tonen direct of een gevelopening een scheefgetrokken parallellogram vormt.  
     * *Toepassing:* Kruismetingen zijn verplicht bij zichtbaar scheve openingen, grote erkers en vaste kadersystemen die exact haaks moeten sluiten (zoals TruFit of FrameFix).  
* **Ingangscontrole Monteurs Vóór Boren en Uitpakken (Faalkosten- en Schadeborging):**  
  Monteurs mogen nooit blindelings beginnen met boren of verpakkingen opensnijden op basis van doosstickers of werkbonnen. **Dit omdat het in de praktijk regelmatig voorkomt dat leveranciers of fabrikanten niet het juiste product geleverd hebben, of dat er een andere maat in de doos blijkt te zitten dan wat er op de buitenzijde van de doos vermeld staat (verwisseling in de fabriek / inpakfout).**  
  * *Vast 5-stappenprotocol bij binnenkomst:*  
    1. *Laser-controlemeting:* De monteur pakt direct zijn laserafstandsmeter en meet in 10 seconden snel de strakke breedte en hoogte van de opening (klik-klik).  
    2. *Vergelijking met fabriekssticker & werkbon:* De monteur vergelijkt deze controlematen met de productiesticker op de gesloten doos en de inmeetbon.  
    3. *Fysieke maatcontrole inhoud vóór boren:* Zodra de doos voorzichtig wordt geopend, controleert de monteur eerst met het rolmaatje de werkelijke fysieke productmaat (bovenbakbreedte, lamelbreedte of raillengte) vóórdat er ook maar één boorgat in muur of kozijn wordt gemaakt.  
    4. *Vrijgave voor montage:* Pas wanneer de gemeten maten van de opening, de productiesticker én het fysieke product exact matchen (binnen de montagetoleranties), legt de monteur de beschermdeken neer, pakt het gereedschap en start het boorwerk.  
    5. *Escalatie bij afwijking:* Wijkt het geleverde product af van de opening of verschilt de fysieke maat in de doos van de fabriekssticker? Dan stopt de monteur onmiddellijk, laat de verpakking en het product onbeschadigd en neemt direct contact op met de binnendienst/planning (bijv. Carlo). Dit voorkomt onnodige en onherstelbare boorgaten in klantmuren en garandeert dat foutief geleverde producten direct gereclameerd en kosteloos geretourneerd kunnen worden aan de fabrikant.
* **Trapeziumramen & Schuine Gevels (Wiskundige Inmeetregel):**  
  Bij schuine raampartijen of trapeziumramen meet de inmeter uitsluitend:
  1. De **rechte breedte** aan de onderzijde (of bovenzijde bij omgekeerd trapezium);
  2. De **kortste hoogte** (punt-naar-punt);
  3. De **grootste hoogte** (punt-naar-punt).  
  * **Strikt verbod op tussenhoogtemeting:** Er mag bij trapeziumramen **geen tussenmaat in het midden** worden gemeten. Indien een tussenmaat niet exact op het wiskundige middenpunt wordt opgenomen, ontstaat een afwijking die de wiskundige berekeningsalgoritmen van de confectie- en productiesoftware corrumpeert. De fabrikant berekent de exacte schuinte en snijhoek zuiver wiskundig op basis van de breedte en de twee uiterste hoogtematen.
* **Kijkrichting (Binnen vs. Buiten):**  
  * *Standaard (Raamdecoratie, Gordijnen & Binnentoepassingen):* De inmeter staat in de ruimte en kijkt van **binnen naar buiten** tegen het kozijn of het vlak aan. Links is fysiek links vanuit de kamer gezien.
  * *Uitzondering (Buitenzonwering & Screens):* Bij buitentoepassingen (zoals zipscreens of rolluiken gemonteerd op de buitengevel) wordt gemeten en gekeken **van buitenaf tegen de gevel**. De software markeert deze kijkrichting expliciet in de positie-interface (`[Kijkrichting: Buitenaf Gevel]`).
* **Universele Leidingdetectie bij Verticale Wandmontage (Veiligheidsprotocol):**  
  Net zoals bij vloeren altijd gevraagd moet worden naar leidingen en vloerverwarming (vóórdat er ook maar iets aan een vloer gebeurt of tapijtspanlatten worden geslagen), geldt bij **elke montage in het verticale vlak (muur / wand / dagkant / kozijn)** een **strikte en verplichte standaardvraag naar in de muur liggende leidingen** (elektra, water, gas, cv, afvoer). De inmeter stelt deze vraag actief aan de klant, voert bij twijfel een detectiemeting uit met een leidingzoeker, en registreert het resultaat verplicht op de inmeetbon: *"Leidingdetectie verticale wand uitgevoerd: boorzone vrij van leidingen"* of *"Let op: leidingen aanwezig op X cm / risicozone gemarkeerd"*.
* **Drie Afzonderlijke Procesvragen voor Oude Raambekleding:**  
  Op de inmeetbon en checklist worden drie afzonderlijke vragen gesteld i.p.v. één samengestelde vraag:  
  1. *Demontage:* Moet bestaande raambekleding of raamfolie worden gedemonteerd? (Ja/Nee; door monteur of klant).  
  2. *Afvoer:* Moet het oude materiaal worden afgevoerd? (Ja/Nee; door monteur of klant).  
  3. *Herplaatsing naar andere positie:* Moet een gedemonteerd product op een andere plek in de woning worden herplaatst? (Ja/Nee). Indien ja: dit vormt een **zelfstandige orderpositie** die apart wordt ingemeten en geoffereerd, inclusief beoordeling of bestaande schroefgaten herbruikbaar zijn.
* **Vaste Referentiepunten & Klantverantwoordelijkheid bij Onvoltooide Situaties:**  
  * *Vloerpeil & Plafondpeil:* Er wordt gemeten vanaf het definitieve afwerkvloerpeil en tot aan het definitieve plafond.
  * *Onvoltooide Situaties (Nog aan te brengen vloeren of stucwerk):*  
    De inmeter doet **géén eigen aannames** over de dikte van nog te plaatsen vloeren (zoals tegels met lijmbed, parket of gietvloer) of nog aan te brengen plafondafwerkingen (stucwerk, spachtelputz, verlaagde plafonds).  
    1. De klant is te allen tijde zelf verantwoordelijk voor het exact en schriftelijk opgeven van de benodigde aftrekmaat in millimeters.
    2. De inmeter meet de ruwe strakke maat en registreert de door de klant opgegeven aftrek met de verplichte statusnotitie: *"Aftrekmaat conform schriftelijke opgave klant: X mm"*. Dit wordt direct opgenomen in het digitale meetverslag dat de klant per e-mail ontvangt.
    3. Is de exacte maat tijdens de inmeting nog onbekend (bijv. in afwachting van parketteur of aannemer)? Dan krijgt de positie de status **"Concept / In afwachting klantinfo"**. Zodra de klant de definitieve millimeters per e-mail aanlevert, logt de binnendienst (bijv. Carlo) dit met tijdstempel en gebruikers-ID in het dossier, waarna de status definitief wordt.
* **Visuele Maatschets & Overzichtsfoto-Opnameplicht:**  
  Voor elke bezochte ruimte of gevelwand geldt een strikte visuele vastleggingsplicht:
  * *Overzichtsfoto & Detailfoto's:* Minimaal één overzichtsfoto per vlak/ruimte waarop de gehele gevelpartij inclusief obstakels (radiatoren, leidingen, kranen, deuren) zichtbaar is. Van eventuele bijzonderheden of zaken die niet goed zichtbaar zijn op de overzichtsfoto's, worden detailfoto's vastgelegd.
  * *Complexe Railtracés & Fabrieksinmeting (Interstil):* Bij complexe railtracés (zoals roedes met meer dan 70% ronding of meer dan 5 hoeken) wordt de inmeting ter risicoafwenteling door fabrikant Interstil zelf uitgevoerd (zie 3.2.3). Eenvoudigere bogen en maatschetsen worden voorzien van exacte graden en detailfoto's van de dagkanten.

#### 3.1.3 Meetpuntdichtheid & Het 50 cm Raster-Algoritme
Voor standaard gevelopeningen volstaat de triadische 3-puntsmeting conform §3.1.2. Om echter bij grote overspanningen doorhangen van lateien, buiging van raamprofielen of verzakkingen van vloeren nauwkeurig te detecteren, hanteert EasyM2M het dynamische 50 cm raster-algoritme:

* **Het 50 cm Raster-Algoritme (Bij Afmetingen > 100 cm):**  
  Voor openingen breder of hoger dan 100 cm berekent de software het aantal vereiste tussenliggende meetpunten dynamisch:  
  `Aantal meetpunten = roundup(Afmeting in cm / 50 cm) + 1`  
  *Voorbeeld:* Een opening van 101 cm breedte genereert `roundup(101 / 50) + 1 = 3 + 1 = 4` meetpunten; een raampui van 340 cm breedte genereert `roundup(340 / 50) + 1 = 7 + 1 = 8` breedtemeetpunten gelijkmatig verdeeld over de overspanning.
* **Selectielogica voor Blijvende Maat:**  
  * *In de dag montage:* De software selecteert uit het raster altijd de **kleinste gemeten maat** als basis voor de aftrekberekening (zodat het product nergens klemt).
  * *Op de dag montage:* De software selecteert uit het raster altijd de **grootste gemeten maat** als basis voor de overlapberekening (zodat het product de opening te allen tijde volledig afdekt).

#### 3.1.4 Hoogtematen, Bovenlichten & Montagehoogte
* **Driedelige Hoogteregistratie:**  
  Bij gevelopeningen met borstweringen registreert de inmeter drie afzonderlijke hoogtematen:
  1. *Borstweringhoogte:* Vloer tot onderkant kozijn/vensterbank.
  2. *Kozijnhoogte (Dagmaathoogte):* Onderkant kozijn tot bovenkant kozijn.
  3. *Latei-/Plafondhoogte:* Bovenkant kozijn tot onderkant afgewerkt plafond.
* **Bovenlichten & Tussenregels:**  
  Ramen met bovenlichten (vaste beglazing boven een tussenkader of stolpraam) kunnen naar keuze van de klant als één doorlopende positie of als twee gescheiden posities worden geconfigureerd. Indien gescheiden, wordt de hoogte van de tussenregel exact ingemeten om te waarborgen dat tussenprofielen van de raambekleding visueel samenvallen met het kozijnkader.
* **Universele Verplichting van Montagehoogte (De Reken- en Veiligheidsspil):**  
  De **Montagehoogte (MH)** is de zuivere verticale afstand die **te allen tijde vanaf de definitieve vloer** wordt gemeten tot aan de **bovenkant van de montagebeugel (montagesteun)**, bovenbak of plafondbevestiging. Voor ELKE montagewijze — zowel 'In de dag' (zijwand of plafond van de negge), 'Op de dag' (wandmontage) als 'In het plafond' (plafondmontage) — is de Montagehoogte een **strikt verplicht invoerveld**. Dit onderscheid is cruciaal omdat een product of rail soms aanzienlijk lager hangt dan de beugel waaraan deze is bevestigd (bijv. gordijnrails aan pendels of staaldraden, zoals bij ziekenhuisbedden of hoge koven). Zonder deze waarde kan de software de bestelmaten, veiligheidsmarges en logistiek niet valideren. Deze waarde is mathematisch en operationeel noodzakelijk voor:
  1. *Wettelijke Kindveiligheid (EN 13120):* Berekent de maximaal toegestane bedieningskoord-/kettinglengte (`Kettinglengte ≤ Montagehoogte - 150 cm`). Bedieningskoorden en -kettingen moeten te allen tijde minimaal 1,50 m boven de afgewerkte vloer hangen en voorzien zijn van een goedgekeurde spanklem of breekketting.
  2. *Automatische Trekstangberekening:* Berekent de ideale confectielengte voor gordijntrekstangen (`Trekstanglengte = Montagehoogte - 140 cm`, automatisch afgerond naar 100, 125 of 150 cm). Hierdoor hangt het handvat ergonomisch op ca. 140–150 cm boven het vloerpeil.
  3. *Ergonomisch Reikhoogte-Advies:* Bij handbediende systemen (zoals Top-Down / Bottom-Up plissés en Duettes met LiteRise handgreep) op een montagehoogte > 2,10 m kan de bovenste handgreep niet meer vanaf de vloer worden bediend. De inmeettool toont verplicht een adviesmelding om een magnetische bedieningsstang aan de order toe te voegen of over te stappen op SmartCord® / accumotorisatie (bespreken met klant).
  4. *Arbo & Klimmaterieel voor de Bus:* Bepaalt of voor de monteur een standaard huishoudtrap (≤ 2,60 m) volstaat, of dat extra klimmaterieel (lange ladder, hoge trap, rolsteiger) via de Arbo-checklist op de werkbon voor de monteursbus moet worden aangestuurd (§4.8).
  * *Optie 'Tegen het plafond':* Bij montage "Op de dag" kan expliciet worden aangegeven of het product **tegen het plafond** moet komen te hangen (strak plafondaansluitend zonder tussenkier); de hoogte wordt berekend vanaf afgewerkte vloer tot plafond.

#### 3.1.5 Meetapparatuur & Handmatige Validatie in V1
* **Geijkte Meetapparatuur:**  
  Inmetingen worden uitgevoerd met professionele, geijkte laserafstandmeters met vlakke referentie-aanslag en meetnauwkeurigheid ±1 mm, aangevuld met een stijve stalen rolmaat met magnetische kop voor detail- en nismetingen.
* **Validatieproces in Versie 1 (V1):**  
  In Versie 1 van de software voert de inmeter de lasermeting uit, **controleert de meetwaarde visueel op de display van de lasermeter**, en toetst deze tegen de fysieke situatie alvorens de waarde bewust handmatig in de applicatie in te voeren.
* **Toekomstige Doorontwikkeling (Expliciet Buiten Scope V1):**  
  Directe Bluetooth-doorschieting of geautomatiseerde sensoroverdracht vanuit meetapparatuur naar de tablet, evenals 3D-inmeting met conceptmaten via speciale meet-tools of LiDAR/smartphone-apps, worden aangemerkt als mogelijke toekomstige verrijkingen, maar vallen **nadrukkelijk buiten de functionele scope van Versie 1**. De bewuste menselijke invoer en validatie in V1 waarborgen dat de inmeter reflecteert op de ingevoerde getallen en afwijkingen direct fysiek toetst en signaleert.
* **Vakmanschap & Klantvertrouwen:**  
  Het inmeetbezoek is hét moment waarop de klant deskundigheid en professionaliteit ervaart. Een rustige, gestructureerde werkwijze waarbij de inmeter metingen hardop toetst, details inspecteert en bewuste controlemomenten inbouwt, straalt betrouwbaarheid en vakmanschap uit en versterkt het vertrouwen in de uiteindelijke oplevering.

#### 3.1.6 Gekoppelde Posities & Hoekopstellingen
* **Hoekramen & Erkers:**  
  Bij twee of meer ramen die in een hoek van 90° (of een andere hoek) op elkaar aansluiten, ontstaat bij plaatsing in of op de dag een fysiek conflict tussen de elkaar kruisende bovenbakken, profielen of pakketten.
* **Vaste Montagevolgorde & Reserveringsregel (bijv. Jaloezieën in een Hoek):**  
  * *Positie 1 (Leidend / Eerst monteren):* Eén van de twee posities wordt aangewezen als het doorlopende deel en wordt ingemeten over de volledige breedte tot in de hoek.
  * *Positie 2 (Aansluitend / Volgend):* De haaks aansluitende positie wordt ingemeten tot tegen de voorkant van de geprojecteerde bovenbak van Positie 1. De software trekt de dieptemaat van de gekozen bovenbak (bijv. 50 mm bij jaloezieën, 45 mm bij Duette) automatisch af van de gemeten dagmaat van Positie 2.
  * De montagevolgorde wordt expliciet vastgelegd op de werkbon: eerst Positie 1 monteren, daarna Positie 2 aansluiten.

#### 3.1.7 Bouwkundige Ondergronden, Boorrestricties & Meerwerkclausule
De bouwkundige ondergrond van het montagevlak bepaalt welk bevestigingsmateriaal noodzakelijk is en beïnvloedt de montageduur:

* **Verplichte Ondergrondclassificatie van het Montagevlak & Klantakkoord:**  
  Voor elk gekozen montagevlak moet de inmeter verplicht aangeven welke ondergrond het is (het type bouwkundig constructiemateriaal):
  1. *Beton:* Massief beton, breedplaatvloer of kanaalplaat; vereist SDS boorhamer en universele nylon pluggen (bijv. Fischer UX / DuoPower).
  2. *Massieve steen / Kalkzandsteen / Baksteen:* Solide gemetselde constructiewanden; normale boor/klopboor en standaardpluggen.
  3. *Holle bouwsteen / Cellenbeton (Ytong) / Gipsblokken:* Zachte of poreuze wanden; vereist aangepaste pluggen of speciale cellenbetonschroeven.
  4. *Gipskarton / Metal stud / Fermacell:* Holle wanden of gipsplafonds. Fysieke controle op achterhout of houten rachels is bij afgewerkte woningen niet mogelijk zonder gipsplaten te slopen. De inmeter klopt verplicht op het plafond om vast te stellen of het massief beton dan wel gips/stucplaat betreft. Tenzij de klant aantoonbare ruwbouwfoto's of bemaatde tekeningen overlegt, mag de inmeter/monteur er nooit van uitgaan dat er achterhout aanwezig is. Zware producten (zoals houten jaloezieën 50 mm) mogen nooit zonder achterhout of goedgekeurde zware hollewandankers aan een gipsplafond worden gehangen om te voorkomen dat het plafond bij intensief bedienen naar beneden wordt getrokken; in die situatie dwingt het portaal een keuze voor wandmontage of constructieve versteviging af.
  5. *Hout / Kozijnhout:* Houten kozijnen of balklagen; direct voorboren en schroeven met houtschroeven zonder plug.
  6. *Kunststof / Aluminium:* Kozijnen; direct boren strikt verboden indien geen staalinlage aanwezig is; toepassen van klemsteunen, glaslatbevestiging of speciale adapters (TruFit, FrameFix).
  7. *Staal / Lateien:* Stalen balken of lateien boven raamopeningen; zelftappende metaalschroeven of klemconstructies.
  * *Wandmontage & Meldingsplicht Wandverwarming (Juridische Borging - SSOT):* Bij wandmontage (zoals wandsteunen voor gordijnrails en jaloezieën) vraagt de inmeter verplicht aan de klant of er wandverwarming of ingefreesde leidingen aanwezig zijn. Klanten hebben een actieve meldingsplicht. Het inmeetrapport legt de klantverklaring expliciet vast (*"Wandmontagevlak gecontroleerd met klant: klant verklaart dat er géén wandverwarming of leidingen in het montagevlak lopen"*). Dit sluit faalkosten (€ 300,- herstelkosten bij doorboorde waterleidingen met uithakken en stucen) en verzekeringsgeschillen juridisch uit. Deze paragraaf vormt de centrale SSOT voor alle leiding- en wandverwarmingsprotocollen.
  * *Klantakkoord & Standaard Meerwerkclausule:* In het inmeetverslag accordeert de klant expliciet de vastgestelde ondergrond en de verklaring dat de montage- en boorzones vrij zijn van leidingen en vloerverwarming. Het inmeetrapport bevat standaard de bindende clausule dat eventueel noodzakelijk meerwerk als gevolg van afwijkende ondergronden of onvoorziene/verzwegen leidingen te allen tijde voor rekening en risico van de klant komt.
* **Algeheel Boor- en Schroefverbod in álle Vloeren & Tapijtspanlatten (SSOT):**  
  Op álle vloeren geldt een absoluut en algeheel boor- en schroefverbod ter voorkoming van schade aan vloerverwarming, water-, gas- en elektraleidingen, betonijzer en nieuwbouwgaranties. Deuraansluitingen, plintmontage, overgangsprofielen en deurstoppers worden te allen tijde verlijmd/gekit met elastische MS-polymeerkitten of geschikte montagelijm.  
  *Uitzondering tapijtspanlatten (Nagelen vs. Montagekit):* Uitsluitend bij het traditioneel spannen van tapijt op ondertapijt worden houten spanlatten voorzien van stalen betonnageltjes in de dekvloer geslagen. Hiervoor toetst de inmeter verplicht: *"Lopen er leidingen of vloerverwarming in de vloer?"*. Indien ja of twijfel: **absoluut spijkerverbod**. De spanlatten worden in dat geval vooraf verlijmd met hoogwaardige montagekit (automatische meerprijs / toeslag voor montagelijm en droogtijd), óf er wordt overgestapt op een volvlakkig verlijmd ondertapijtsysteem (zie §3.4.1).
* **Plintinspectie & Zaagwerkzaamheden bij Raamdecoratie tot op de Vloer (Afbakening t.o.v. Vloerplinten):**  
  Indien raambekleding of gordijnrails doorlopen tot op de vloer (bijv. jaloezieën, duettes, paneelgordijnen, verticale lamellen of kamerhoge rails), toetst de inmeter verplicht de aanwezigheid van plinten en legt de gewenste bouwkundige aansluiting vast:  
  * *Tussen de plinten:* De breedte wordt ingemeten tussen de opstaande plinten (met behoud van een lichte speling naast de plint).  
  * *Tot op de plint:* Het product wordt over de plint gemonteerd en zakt tot strak bovenop de plint.  
  * *Plint openzagen / inkorten (Zaaginstructie & Meerwerk):* Indien een gordijnrail of raamdecoratieproduct strak doorloopt en de plint in de weg zit (zoals gebleken in de recente casus), legt de inmeter dit vooraf dwingend vast (*"Plint openzagen / inkorten noodzakelijk"*). Dit genereert direct een duidelijke montage-instructie op de digitale werkbon én een automatische meerwerkpost/zaagtoeslag op de order, zodat de monteur voorbereid met het juiste gereedschap op pad gaat en ad-hoc verrassingen of montagediscussies ter plekke worden uitgesloten. *(Noot afbakening: Deze zaaginstructie betreft uitsluitend het plaatselijk inzagen/inkorten van bestaande plinten ter plaatse van raamdecoratie en staat los van de overkoepelende calculatiesystematiek voor nieuwe vloerplinten in 2,40m lengtes conform §3.4.5).*
* **Montagetijd-Weegfactoren per Ondergrond (Koppeling Planningsalgoritme):**  
  De geselecteerde ondergrond stuurt in de planningsmodule direct de montageduurcorrectie aan (§4.2):  
  * *Hout:* Weegfactor 0.8 (snel schroeven zonder voorboren of pluggen; tot 5 producten binnen een half uur mogelijk).  
  * *Beton / Metselwerk:* Weegfactor 1.0 (standaard SDS-klopboren en universele pluggen).  
  * *Gipskarton / Holle wand:* Weegfactor 1.2 (hollewandankers, uitmeten van rachels of constructieve wandmontage).  
  * *IJzer / Staal / Lateien:* Weegfactor 1.5 (voor- en doorboren met metaalboren, koelen, zelftappers; aanzienlijk zwaardere montage-inspanning).
* **Stucprofielen & No-Drill Zones:**  
  Rondom strak gestucte dagkanten bevinden zich metalen of kunststof stucstopprofielen en hoekbeschermers. De inmeter markeert een **no-drill zone van 3 tot 5 cm** vanaf de dagkanthoek om afbrokkelen van stucwerk te voorkomen. Steunen worden minimaal 5 cm uit de hoek geplaatst.
* **Vloer- & Geluidsnormeringen (Kruisverwijzing):**  
  Voor specifieke dekvloernormen (zoals het standaard primeren van cement-/anhydrietvloeren, capacitieve oppervlaktevochtmeting en de 10 dB VvE contactgeluidnorm bij appartementen) wordt verwezen naar het categoriespecifieke hoofdstuk Vloerbekleding (§3.4.2).

#### 3.1.8 Integrale Inmeetchecklist & Portaal-Model: Bestaande Situatie, Uitvoeringscondities & Nieuwe Situatie
Tijdens het inmeten doorloopt de inmeter een gestandaardiseerde, dynamische inmeetchecklist. De software dwingt mechanisch af dat een positie of ruimte pas formeel kan worden afgerond en vrijgegeven als alle verplichte checklist-items van die positie succesvol zijn gevalideerd.

* **Bestaande Situatie & Demontage:** Vastlegging van demontage door klant vs. monteur, hergebruik van bestaande rails/onderdelen, en afvoer van afval/oude vloeren.
* **Nieuwe Situatie & Configuraties (Conceptverificatie):** De checklist dekt nadrukkelijk ook de nieuwe situatie af. Keuzes zoals de bedieningszijde (links of rechts bij een Duette/rolgordijn), montagewijze (in de dag vs op de dag, wand vs plafond) of klinkvrijheid zijn veelal reeds in het verkoopgesprek (Fase 1) verkend en staan als concept geregistreerd in het dossier. De inmeter toetst deze conceptwaarden ter plekke aan de fysieke werkelijkheid en bevestigt deze definitief.
* **Domeinspecifieke Checklist-Verankering:** Om maximale vakinhoudelijke diepgang te waarborgen, zijn de specifieke inspectiepunten direct ondergebracht bij de respectievelijke categoriehoofdstukken hieronder: gordijnen & rails (3.2.6), raamdecoratie (3.3.11), vloeren (3.4.6) en trapbekleding (3.5.5).

#### Architectuur van de Dynamische Portaal-Inmeetchecklist (Het 5-Koloms Model)
Om faalkosten uit te bannen en de inmeter op de ladder niet te overspoelen met statische, overvolle matrixen, is de checklist in het portaal en de inmeet-app gestructureerd volgens een uiterst scherp **5-koloms interactiemodel**. Dit model fungeert als het directe functionele ontwerp voor de software-wizard:
1. **Nr:** Het unieke volgnummer van het inspectiepunt binnen de categorie.
2. **Check / Inspectiepunt:** De inhoudelijke kwalitatieve verificatie, bouwkundige conditie, haalbaarheidstoets of veiligheidsinspectie.
3. **Conditie (Wanneer verschijnt dit?):** De exacte zichtbaarheidsregel (business logic). Vragen verschijnen uitsluitend wanneer ze relevant zijn (bijv. altijd, of uitsluitend bij verlijmd pvc, elektrische motoren, draaikiepramen of specifieke montagewijzen).
4. **Veldtype & Default in App:** Het concrete invoer- en bedieningselement in de mobiele app (Radiobutton, Dropdown, Checkbox, Numeriek invoerveld, of Foto-upload) inclusief een veilige standaardwaarde (default).
5. **Validatie & Gevolg (Wat doet het portaal?):** De geautomatiseerde downstream afhandeling in het portaal: validatieblokkades (gating), automatische toevoeging van toeslagen en demontage-uren aan de werkorder, reservering van specialistisch klimmaterieel op het planbord, en selectie van bevestigingsmiddelen op de pakbon voor de monteur.

* **Logische Volgorde van Inspectiefasen op Locatie:**  
  De inspectiepunten volgen binnen de wizard de natuurlijke, fysieke werkvolgorde van de opnemer in de ruimte:
  * *Fase A: Bestaande Situatie, Demontage & Schouw:* Oude raambekleding/vloer/trapbekleding; wie demonteert en wie voert af; hergebruik van bestaande voorzieningen.
  * *Fase B: Bouwkundig Vlak & Ondergrond:* Draagkracht muren/plafonds; kozijnmateriaal; vlakheid (2m rei) en restvocht dekvloer.
  * *Fase C: Montagewijze & Bevestigingsmethode:* In de dag vs. op de dag vs. raamvleugel; wand- vs. plafondmontage; boorvrije systemen; koofdieptes en leidingvrijheid.
  * *Fase D: Kwalitatieve Maatverificatie, Vrijloop & Fysieke Obstakels:* Kruk- en beslagvrijloop, draaikiep-kantelhoek, verloopakkoord (> 5 mm / > 15 mm). Numerieke maten (B1–B3, H1–H3) worden in de specifieke maatvelden ingevoerd; de checklist toetst de kwalitatieve randcondities.
  * *Fase E: Bediening, Aansturing & Veiligheid:* Bedieningszijde links/rechts, EN 13120 kindveiligheid, 230V stroompunten en accu-laadpunten.
  * *Fase F: Logistiek, Uitvoeringscondities & Oplevering:* Werkzone vrijmaken, Arbo-klimmaterieel (> 3 m), acclimatisatie en opleverinstructies.

### 3.2 Categorie 1: Gordijnen & Rails

#### 3.2.1 Productassortiment, Merken & Configuratoren
* **Producten:** Overgordijnen, Vitrage, Inbetweens.
* **Textielsoorten, Vezelsamenstelling & Weefsels:**
  * *Synthetische garens:* 100% PES (polyester) en **Trevira CS** (permanent vlamvertragend conform DIN 4102 B1 / NEN-EN 13773 klasse 1 voor projectinrichting en veeleisende particuliere toepassingen; vormvast en krimpvrij).
  * *Natuurlijke vezels:* Linnen, katoen en wol (luxe valling en natuurlijke structuur; hygroscopisch waardoor ademend en vochtregulerend).
  * *Weefselstructuren:* **Chenille** (zachte, volumineuze poolgarens met hoge slijtweerstand en rijke textuur) en velours (gesneden poolweefsel met intense kleurdiepte en hoge akoestische demping).
* **Voeringen, Tussenvoeringen & Akoestiek:**
  * *Interlining (Tussenvoering):* Geruwde katoenen molton (*interlining*), ingenaaid tussen de hoofd- en voeringstof. Biedt essentiële bescherming tegen ultraviolette UV-straling (vooral bij natuurlijke weefsels zoals zijde en linnen ter voorkoming van vezelveroudering en verkleuring) en geeft het gordijn een weelderig, vol en zwaar volume.
  * *Akoestische isolatie:* **Akoestische molton** met een gewogen geluidsabsorptiecoëfficiënt van **$\alpha_w \ge 0,65$** (alpha_w) voor effectieve nagalmreductie in moderne woningen met harde vloeren en grote glaspartijen.
  * *Thermische & Verduisterende voeringen:* **3-pass blackout** voering (lichtdichtheid 100%, opgebouwd uit een witte acryl-ruglaag, een zwarte blokkeerlaag en een witte tussenlaag ter bescherming van de stof) en thermische isolatielagen voor energiebesparing bij enkel glas of koude gevels.
* **Verzwarings- & Afwerkingsmaterialen:**
  * *Loodveter:* Standaard ingenaaid in de onderzoom bij vitrages en soepel vallende inbetweens: gewichtsklasse **25–50 g/m** (loodvrij polymeer-zinkcomposiet conform Europese **RoHS**- en **REACH**-milieurichtlijnen).
  * *Verzwaringsloodjes:* Rechthoekige loodjes van 15–30g in de hoeken van de zijzomen om opkrullen van hoeken te voorkomen.
* **Rails & Roedes:** Losse rails, roedes, rails met hoeken/bochten (bijv. links 20 cm, rechts 30 cm retourbocht).  
  * *Merken & Configuratoren:* Hoogwaardige designrails en roedes (*Interstil*) beschikken over een eigen **Interstil Configurator** voor orderinvoer en technische verificatie. Complexe bogen (zoals erkers > 70% ronding) worden direct door Interstil zelf op locatie ingemeten (zie 3.2.3).
* **Merken, Confectie & Configurators:**  
  * *Gordijnstoffen & Ateliers:* Hunter Douglas merken (*De Ploeg, Kendix, Artelux*), evenals *House of Happiness / Frisco, Holland Haag* en *Mart Visser* worden centraal geconfigureerd via **Woontotaal**.  
  * *White label / Huismerk:* Confectie via *Vadain* gebruikt een eigen configurator, ingebed via ERP-systeem **Logic Trade**. In het systeem en op inkoopbonnen wordt dit eenduidig aangeduid met merkcode **'GiW'** (Groter in Wonen), nooit als 'merkloos'.
* **Speciale Confectievorm: Paskamermodel (Trapgatgordijnen & Doorkijkramen):**  
  In situaties waarbij men tegen de achterzijde van de gordijnrail aankijkt — zoals bij een trapgatgordijn vanuit de hal of overloop, of bij een doorkijkraam/scheidingsgordijn — kijkt men bij standaardconfectie tegen de achterkant van de plooien aan. In dat geval wordt het gordijn geconfectioneerd als **Paskamermodel**: de plooien worden omgekeerd in het gordijn gestikt, zodat de nette, fraai afgewerkte voorzijde van de plooien naar de zichtzijde in het trapgat/vertrek wijst. Het portaal ondersteunt hiervoor de specifieke confectie-optie *'Paskamermodel (omgekeerde plooistiksels)'*.

#### 3.2.2 Stofuitvoeringen, Plooitypes & Confectieberekening
* **Plooitypes & Confectievormen:**
  * *Enkele Plooi:* Bescheiden stofverbruik (1,8× tot 2,0× de railbreedte).
  * *Dubbele Plooi (Vlinderplooi):* Standaard luxe valling (2,2× tot 2,5× de railbreedte).
  * *Driedubbele Plooi (Trioplooi):* Rijke, diepe plooivorming met een royale stofbehoefte (factor **2,7x–3,0x** de railbreedte). Dé aanbevolen confectiestandaard voor transparante vitrages en ragfijne inbetweens om voldoende body en optimale privacy te waarborgen.
  * *Retourplooi (Enkele of Dubbele Retourplooi):* Afwisselend naar voren en achteren geplooide confectie. Bij montage strak onder het plafond geldt: **hoofdje = 0 mm**, zodat het gordijn niet tegen het plafond aanloopt.
  * *Wave-Plooi (Wave 6 cm & Wave 8 cm):* Vaste runner-afstand via koord, hangt altijd strak en gelijkmatig onder de rail (hangwijze verplicht onder de rail):
    * *60 mm runnergordel:* Resulteert in een totale golfdiepte van **12 cm** (**6 cm naar voren en 6 cm naar achteren**). Afstand tot raam of achterwand: **exact 8 cm tot het hart van de rail** (vaste regel: 2 cm vrije speling vanaf het glas/obstakel + 6 cm halve golfdiepte). Minimaal 10 cm koofdiepte voor een enkele rail.
    * *80 mm runnergordel:* Resulteert in een diepere en luxere golf van **16 cm** (**8 cm naar voren en 8 cm naar achteren**). Afstand tot raam of achterwand: **exact 10 cm tot het hart van de rail** (vaste regel: 2 cm vrije speling vanaf het glas/obstakel + 8 cm halve golfdiepte). Minimaal 15 cm koofdiepte voor een enkele rail.
    * *Dubbele Rail (Wave + Vitrage / Twee Sporen):* Vereist een totale vrije koofdiepte van minimaal **18 tot 20 cm** om te voorkomen dat voor- en achtergordijn tegen elkaar aan schuren.
    * *Conflictwaarschuwing Wave-Plooi vs. Diepe Radiator/Vensterbank (Filtertrechter):* Een Wave-plooi vereist minimaal 16 tot 18 cm vrije diepte vanaf de achterwand. Omdat dieptematen van radiatoren in de inmeetsoftware niet als numerieke velden worden ingevoerd, wordt de aanwezigheid van een diepe radiator of vensterbank kwalitatief gesignaleerd en getoetst via de inmeet-checkvraag. Indien een conflict wordt geconstateerd, adviseert de software / inmeter verlengde wandsteunen (mits esthetisch acceptabel) óf adviseert dynamisch om te schakelen naar een **dubbele plooi (vlinderplooi)** of enkele plooi. Een traditionele plooi vraagt immers slechts 8 tot 10 cm diepte, waardoor het gordijn strak en vrij voor de radiator langs valt zonder lelijk voorover te knikken.
* **Indeling van de delen op de rail:**
  * **1 stuk links of rechts:** Waslabel standaard muurzijde ingenaaid.
  * **Stel (2 gelijke delen):** Gordijn sluit centraal in het midden met overlap (standaard 100 mm).
  * **Ongelijk stel (2 ongelijke delen):** Bijv. bij schuifpuien, balkondeuren of asymmetrische ramen (1 breed vast deel en 1 smaller loopdeel).
  * **Meerdere stukken / Meerdelig stel op 1 rail (3, 4 of meer delen):** Meerdere stukken gordijn aan één doorlopende rail (bijv. 4 stukken aan één rail van 4 meter). Elk afzonderlijk stuk krijgt een eigen confectiebreedte (linkse stuk, tweede stuk, etc.) en overlap.
  * Optionele eindstop-vergrendeling in de hoek.
* **Hangwijze:** Onder de rail (verplicht bij Wave, designrails en roedes) of vóór de rail (bedekt de profielrail aan het plafond).
* **Stofuitvoeringen & Baanstof/Rapportberekening:**
  * *Kamerhoge stoffen (280 - 320 cm, naadloos):* Confectie is naadloos over de gehele breedte.
  * *Baanstof / breedtestof (140 - 150 cm):* Banen moeten aan elkaar gestikt worden (verticale naden en patroonrapport).
    * Stofbehoefte = Aantal banen × (Gordijnhoogte + Zoomtoeslag + Rapportverspringing).
    * *Wiskundige Patroonrapport- & Snijverliesberekening (Dual-Layer Specificatie):*  
      **Laag 1: In gewone mensentaal voor adviseurs, inmeters en atelier:**  
      Bij gordijnstoffen met een herhalend verticaal patroon (patroonrapport) moeten alle banen aan elkaar gestikt worden zónder dat het patroon horizontaal verspringt. Om ervoor te zorgen dat de bloemen, strepen of figuren op exact dezelfde hoogte doorlopen, kan niet zomaar op de strakke gordijnmaat worden geknipt:  
      * *Stap 1 (Zoomtoeslag optellen):* Neem de gewenste afgewerkte confectiehoogte van het gordijn en tel daar de zomen bij op: standaard 10 cm voor de hoofdzoom (bovenzijde) en 20 cm voor de dubbele onderzoom (onderzijde). Dit geeft de minimaal benodigde stofhoogte per baan (bijv. 250 cm gordijn + 10 cm + 20 cm = 280 cm stof).  
      * *Stap 2 (Hele patronen tellen):* Deel deze benodigde stofhoogte door de hoogte van één patroonrapport (bijv. een patroon dat zich elke 64 cm herhaalt). Deel 280 cm door 64 cm = 4,375 patronen. Omdat een patroon nooit half geknipt mag worden, ronden we dit **altijd af naar boven** op een heel aantal patronen: 5 hele patronen.  
      * *Stap 3 (Bruto knipmaat bepalen):* Vermenigvuldig het aantal hele patronen met de patroonhoogte: 5 patronen × 64 cm = 320 cm. Dit is de werkelijke maat waarop de stof van de rol wordt afgeknipt (de bruto knipmaat).  
      * *Stap 4 (Snijverlies inzichtelijk maken):* Het verschil tussen wat we afknippen (320 cm) en wat we feitelijk nodig hebben inclusief zomen (280 cm) is het snijverlies: 320 cm - 280 cm = 40 cm afval per baan. Dit verlies is technisch noodzakelijk om het patroon over de gehele gordijnbreedte perfect horizontaal te laten aansluiten.  

      **Laag 2: Formele wiskundige specificatie voor softwareontwikkelaars & ERP-calculatie:**  
      Bij baanstoffen met een verticaal patroonrapport ($V_r$ in mm) berekent het algoritme de exacte knipmaat en het snijverlies via onderstaande discrete functies:  
      1. *Bruto benodigde kniphoogte vóór rapport:*  
         $$K = \text{Confectiehoogte} + 100\,\text{mm (hoofdzoom)} + 200\,\text{mm (onderzoom)}$$  
      2. *Aantal benodigde rapporten per baan (afronding naar boven):*  
         $$N = \left\lceil \frac{K}{V_r} \right\rceil$$  
      3. *Bruto knipmaat per baan:*  
         $$\text{Bruto knipmaat} = N \times V_r$$  
      4. *Snijverlies per baan:*  
         $$\text{Snijverlies} = (N \times V_r) - K$$  
    * *Rekenvoorbeeld patroonrapport:* Bij een confectiehoogte van 250 cm ($K = 250 + 10 + 20 = 280\,\text{cm}$) en een patroonrapport van 64 cm berekent het systeem: $N = \lceil 280 / 64 \rceil = 5$ rapporten. De bruto knipmaat bedraagt $5 \times 64 = 320\,\text{cm}$, met een berekend snijverlies van $320 - 280 = 40\,\text{cm}$ per baan om een perfecte horizontale patroonaansluiting over de gehele breedte te garanderen.
* **Confectiestandaard Overlap Middennaad (Stelgordijnen):**  
  Bij stelgordijnen (tweeledig sluitend vanuit het midden naar weerszijden) past het confectie-atelier standaard een overlap van **10 cm (100 mm)** toe op de stofbreedte. Dit waarborgt dat de gordijndelen in gesloten toestand overlappend over elkaar heen vallen, waardoor lichtkieren in het midden volledig worden geëlimineerd. Dit is een vast confectievoorschrift en géén checkvraag voor de inmeter.
* **Keuze Valgedrag Gordijn (Vrijhangend vs. Slepend):**  
  De klant bepaalt in samenspraak met de adviseur/inmeter het esthetische valgedrag van het gordijn:
  1. *Vrijhangend (Standaard Default):* Gordijn zweeft strak boven de vloer. Software hanteert de standaard aftrekmaten (-15 mm bij harde vloeren, -20 mm bij tapijt conform §3.2.4).
  2. *Slepend:* Gordijn rust luxueus en royaal op de vloer. Software telt automatisch een vaste toeslag van **+50 mm** op bij de berekende confectiehoogte (Confectiehoogte = Kleinste gemeten hoogte - Railhoogte + 50 mm).
* **Voorbeeld Confectiehoogte Gordijnen & Portaal-Default:**  
  260,0 cm (Gemeten strakke hoogte) - 2,0 cm (Wave-railhoogte) - 1,5 cm (Vloerspeling harde vloer) = **256,5 cm (Confectiehoogte)**.  
  * *Softwarematige Default & Verplichte Motivering bij Override:* In het inmeetportaal wordt de vloerspeling standaard vooringevuld met een **default-waarde** (15 mm voor harde vloeren, 20 mm voor tapijt). Indien de inmeter of adviseur deze waarde wenst aan te passen (bijv. naar 25 mm wegens ernstige vloeronvlakheid of naar 10 mm op uitdrukkelijk verzoek van de klant), **moet er in het portaal verplicht een opmerking/motivering bij geplaatst worden**. Zonder deze schriftelijke toelichting kan het veld niet gewijzigd of opgeslagen worden.

#### 3.2.3 Rails, Roedes, Bochten & Montagewijze
* **Steunafstanden & Bevestiging:**  
  Gordijnrails worden standaard gemonteerd met plafondsteunen of wandsteunen om de maximaal **70 cm**. Bij zware stoffen (zoals gevoerde velours of verduisterende gordijnen) wordt de steunafstand verkleind naar maximaal **50 cm**.
* **Complexe Railtraçés & Risicoafwenteling (Interstil Inmeting):**  
  Bij complexe railverbuigingen (meer dan 70% ronding, meer dan 5 hoeken, gecompliceerde erkers of afgeschuinde plafonds) wordt de inmeting **door fabrikant Interstil zelf op locatie uitgevoerd**. De inmeetkosten van de fabrikant zijn verwaarloosbaar ten opzichte van de faalkosten van een verkeerd gewalste designroede; het maatvoeringsrisico ligt hierdoor contractueel bij de fabrikant. Reguliere bochten en hoeken worden bij voorkeur **op locatie gebogen** door de monteur met het mobiele buigblok voor een perfecte pasvorm.
* **Bedieningswijze & Automatische Trekstangberekening:**  
  De bedieningswijze (handbediend, trekstang, koordbediend of elektrisch) is een configuratiekeuze van het railsysteem. Bij de keuze voor een trekstang berekent de software automatisch de ideale confectielengte op basis van de verplichte montagehoogte:  
  `Trekstanglengte = Montagehoogte - 140 cm`  
  De berekende waarde wordt door het systeem automatisch afgerond naar de dichtstbijzijnde standaard leverbare stangmaat: **100 cm, 125 cm of 150 cm**. Hierdoor hangt het handvat van de trekstang ergonomisch perfect op ca. 140–150 cm boven het vloerpeil.
* **Meerdelige Rails & Tussenverbinders:**  
  Bij raillengtes > 6,00 m of bij moeilijke transportroutes (zoals een smal trappenhuis) wordt de rail opgedeeld in meerdere delen met interne verbindingsstukken. De positie van de tussenverbinder (links, rechts of in het midden) wordt **altijd verplicht in overleg met de klant** bepaald, schriftelijk vastgelegd op de inmeetbon en door de klant geaccordeerd om esthetische discussies achteraf uit te sluiten.
* **Buigradii Rekenregels & Zaaglengtereductie (Dual-Layer Specificatie):**  
  **Laag 1: In gewone mensentaal voor inmeters en monteurs:**  
  Wanneer een gordijnrail in een erker of als retourbocht om de hoek loopt, snijdt de gebogen rail de haakse hoek af (een bocht is immers korter dan twee rechte hoeken tegen elkaar). Als een monteur de rail zou afzagen op de strakke optelsom van de wandmaten, wordt de rail te lang en past deze niet meer tussen de muren!  
  * *De vuistregel voor de zaaglengte:* Elke 90-graden bocht verkort de benodigde profiellengte ten opzichte van de strakke wandmaten:  
    - Bij een **kleine buigbocht (straal 10 cm, GiW huismerk):** scheelt elke bocht exact **4,3 cm** (afgerond van 4,29 cm). Heeft een U-rail twee bochten van 10 cm, dan trekken we in totaal $2 \times 4{,}3 = 8{,}6\text{ cm}$ af van de totale wandmaat. Bij wandmaten van 25 cm links + 170 cm midden + 25 cm rechts (samen 220 cm) is de werkelijke zaaglengte van de rail dus $220 - 8{,}6 = \mathbf{211{,}4\text{ cm}}$.  
    - Bij een **grote designbocht (straal 20 cm):** scheelt elke bocht maar liefst **8,6 cm** (afgerond van 8,58 cm). Twee bochten van 20 cm geven een totale reductie van $2 \times 8{,}6 = 17{,}2\text{ cm}$. De werkelijke zaaglengte wordt dan $220 - 17{,}2 = \mathbf{202{,}8\text{ cm}}$.  
    - Bij een **standaard fabrieksbocht (straal 15 cm):** scheelt elke bocht **6,4 cm** ($2 \times 6{,}4 = 12{,}8\text{ cm}$ reductie op twee bochten).  

  **Laag 2: Formele wiskundige specificatie voor software & zaagoptimalisatie:**  
  De geometrische verkorting per 90°-bocht bedraagt het verschil tussen de omgeschreven rechte hoek ($2R$) en het kwart-cirkelsegment $\frac{\pi \times R}{2}$:  
  $$\text{Reductie per 90°-bocht} = 2R - \frac{\pi \times R}{2} = R \times \left(2 - \frac{\pi}{2}\right) \approx R \times 0{,}4292$$  
  * *Huismerk GiW rail (Radius $R = 10\text{ cm}$):* U-maten: 25 cm wandlinks + 170 cm breedte + 25 cm wandrechts (som = 220 cm) $\to$ Correctie 2 bochten met $R = 10\text{ cm}$: $2 \times [2R - (\pi \times R)/2] = 2 \times [20 - 15{,}708] = 8{,}58\text{ cm} \approx 8{,}6\text{ cm}$ reductie $\to$ **Werkelijke zaaglengte profiel = 211,4 cm**.  
  * *Designrail extern (Radius $R = 20\text{ cm}$):* Zelfde U-maten (som = 220 cm) $\to$ Correctie 2 bochten met $R = 20\text{ cm}$: $2 \times [40 - 31{,}416] = 17{,}17\text{ cm} \approx 17{,}2\text{ cm}$ reductie $\to$ **Werkelijke zaaglengte profiel = 202,8 cm**.  
  * *Standaard fabrieksbocht:* Radius $R = 15\text{ cm}$ (bochtontwikkeling $\frac{\pi \times 15}{2} \approx 23{,}6\text{ cm}$, reductie per bocht $30 - 23{,}56 = 6{,}44\text{ cm}$).
* **Inmeetregel Hergebruik Bestaande Rails:**  
  Uitsluitend wanneer er een bestaande situatie is waarbij de klant een bestaande gordijnrail of roede **behoudt** en er uitsluitend nieuwe gordijnen op deze bestaande rail besteld worden, voert de inmeter direct de **blijvende maat** van de rail/roede in (en vinkt in de UI expliciet aan: `[x] Bestaande rail behouden - maat is blijvende railmaat`). In alle andere gevallen geldt onverkort: **meten is dagmaat invoeren**.
* **Bochten, Erkers & Ronde Systemen:**  
  * *Retourbochten aan Uiteinden:* Rails kunnen aan één of beide uiteinden worden voorzien van een retourbocht (buiging van 90° naar de wand toe). Dit zorgt voor een naadloze sluiting tegen de muur, elimineert zijwaartse lichtspleten en verhoogt de isolatie en privacy.
  * *Tussenbochten (Binnen- en Buitenhoeken):* Voor erkers, serres en hoekkozijnen worden rails op maat gebogen in binnenhoeken (hoek in de kamer) of buitenhoeken. De inmeter registreert exact de hoekgraad (bijv. 90°, 135° of afwijkend) en de tussenlengtes.
* **Montagesituaties & Bevestiging (In het plafond, Op de dag, In de dag) — Universeel Geldig voor álle Verticale Montages:**  
  Bij het bepalen van het montagevlak voor gordijnrails, roedes **én alle andere elementen die in het verticale vlak worden gemonteerd (dit protocol geldt transversaal voor álle verticale montages binnen de woninginrichting, zoals raamdecoratiebovenbakken, cassettes, screens, wandsteunen en profielen)** kiest de inmeter uit drie gestandaardiseerde situaties:  
  1. `In het plafond`: Rechtstreekse plafondmontage met plafondsteunen of verzonken railprofielen in het dragende bouwkundige plafond.  
  2. `Op de dag`: Wandmontage met wandsteunen tegen de muur of boven het kozijn; de inmeter voert verplicht de **montagehoogte** in (altijd gemeten vanaf de definitieve vloer tot de bovenkant van de montagebeugel) en kan aanvinken of de rail **tegen het plafond** moet komen te hangen (plafondaansluitend zonder open kier).  
  3. `In de dag`: Montage tussen de dagkanten van een nis of kozijn, met eventuele subkeuze voor **"Plafond van de negge"** (bevestiging omhoog in de bovenzijde van de nis/latei).  
  * *Montagehoogte Beugel vs. Railpositie (Afhangconstructies / Ziekenhuisbed-rails):* De montagehoogte van een gordijn wordt altijd vanaf de vloer tot aan de **bovenkant van de montagebeugel** gemeten. Er zijn echter situaties waarin de gordijnrail veel lager hangt dan de beugel waaraan deze is gemonteerd, zoals bij een ziekenhuisbed met een rail die aan draden of pendels hangt (vaak een paar meter lager). In de software worden de montagehoogte van de beugel en de fysieke hoogte van de bovenkant rail daarom als afzonderlijke parameters vastgelegd.  
  * *Ondergrondregistratie:* De inmeter registreert verplicht van welk materiaal het montagevlak is (beton, gipskarton, hout, kalkzandsteen, etc., conform §3.1.7).  
  * *Leidingcontrole muur:* Bij elke wandmontage (verticaal vlak) geldt de verplichte toetsing op leidingen en wandverwarming conform de universele meldingsplicht en het aansprakelijkheidsprotocol in §3.1.7.  
  * *Plafondmontage specificaties:* Standaard bij massief beton of breedplaat (met SDS-boorhamer en nylon pluggen 6 mm). Bij gipsplaatplafonds mag uitsluitend worden gemonteerd indien achterhout aantoonbaar is; anders geldt direct wandmontage.  
  * *Wandsteunlengtes:* Wandsteunen variëren van 3,5 cm (enkele rail) tot 15–20 cm (dubbele rail met wave).  
* **Inmeetinstructies per Plaatsings- en Montagewijze (Wat meet de inmeter exact?):**  
  De keuze van de montagewijze bepaalt welke fysieke maten de inmeter moet opnemen en welke aftrek/optelsom de software hanteert:
  * *In de dag / Nis / Wand-tot-Wand (in een koof of tussen twee muren):*
    * **Wat meten?** 
      1. *Strakke nisbreedte:* Meet de strakke wand-tot-wand maat op montageniveau (zowel aan de voorzijde als achterzijde van het geplande railtracé). De kleinste strakke maat geldt als invoer.
      2. *Strakke hoogte op 3 punten:* Meet de hoogte vanaf het plafond/bovenzijde nis tot de vloer of vensterbank op minimaal 3 posities: Links (H1), Midden (H2) en Rechts (H3). Doorhangende plafonds of aflopende vloeren worden direct gesignaleerd; de kleinste maat is sturend voor de confectiehoogte.
      3. *Koofdiepte / Nisdiepte:* Meet de vrije diepte tussen het raam/kozijn en de voorzijde van de koof/stucrand. Vereiste vrije koofdiepte: minimaal 10 cm voor Wave 60 mm (12 cm golf), minimaal 15 cm voor Wave 80 mm (16 cm golf), en minimaal 18–20 cm voor een dubbele rail (vitrage + overgordijn).
    * **Rekenregel:** Rail zaagmaat = strakke wand-/nisbreedte minus vaste nisafslag van **exact 15 mm** (`Rail zaagmaat = Strakke nisbreedte - 15 mm`). Confectiehoogte = kleinste strakke hoogte minus railhoogte minus vloerspeling (zie 3.2.4).
  * *Op de dag (over het raam / wand- of plafondmontage vóór de gevel):*
    * **Wat meten?**
      1. *Dagmaat kozijn:* Strakke kozijnbreedte en strakke kozijnhoogte.
      2. *Beschikbare vrije muurbreedte (Links & Rechts):* Vrije wandruimte naast het kozijn tot aan de hoek of obstakels om het geopende gordijnpakket buiten het raam te parkeren.
      3. *Vrije lateihoogte (veldterm "over de dagkant"):* Afstand van de bovenkant van de negge/kozijn tot aan het plafond (bepaalt of wandsteunen boven het kozijn passen: minimaal 50–70 mm nodig voor solide bevestiging).
      4. *Diepte overstek obstakels:* Hoever steekt de vensterbank, radiator, thermostaatknop of raamkruk naar voren uit vanaf de wand?
    * **Rekenregel:** Railbreedte = kozijnbreedte plus gewenste pakket-overlap (standaard **+150 tot +250 mm aan weerszijden**). Wandsteunlengte = overstek obstakel **+ 5 cm** vrije speling (zodat het gordijn soepel valt en niet knikt over de vensterbank).

#### 3.2.4 Meet- en Maatsystematiek Gordijnen: Referentievlak, Bruto Maten & Blijvende Maten (Confectiehoogte & Breedte)
Binnen EasyM2M worden de productiematen voor gordijnen berekend via een gestructureerde transformatie van brutomaten naar definitieve blijvende confectiematen:

* **Hoogte Bovenkant Rail & Keuze van het Referentievlak:**  
  * *Meten van de Railhoogte:* Naast de universele montagehoogte van de beugel (altijd gemeten vanaf de afgewerkte vloer, §3.2.3) wordt de hoogte van de **bovenkant van de rail** gemeten.  
  * *Keuze Referentievlak:* De bovenkant van de rail wordt gemeten ten opzichte van een specifiek **referentievlak**. Dit referentievlak kan bijvoorbeeld zijn:  
    1. Het **afgewerkte vloeroppervlak**;  
    2. De **vensterbank** (of een ander bouwkundig referentievlak zoals een borstwering of koof).  
* **Onderkant van het Gordijn t.o.v. het Referentievlak:**  
  De gewenste onderzijde (de valhoogte) van het gordijn wordt eveneens gedefinieerd ten opzichte van datzelfde referentievlak. Bijvoorbeeld:  
  * *"20 cm onder de vensterbank"* (bij een gordijn dat over de vensterbank valt);  
  * *"Tot op de vloer"* (bij kamerhoge gordijnen).  
* **Brutomaat Hoogte:**  
  De zuivere afstand gemeten vanaf de **bovenkant van de rail tot de onderkant van het gordijn** (bepaald via het referentievlak) vormt de **brutomaat hoogte**.  
* **Van Brutomaat naar Blijvende Maat Hoogte (Confectiehoogte):**  
  Van de brutomaat hoogte worden specifieke correcties afgetrokken of opgeteld om tot de definitieve **blijvende maat (confectiehoogte voor het atelier)** te komen:  
  * *Railhoogte & Haakcorrectie:* Afhankelijk van de hangwijze van het gordijn (hangt het gordijn onder de rail, vallen de haken in het profiel of hangt de stof vóór de rail); standaard railhoogtes in de software:  
    * Standaard railprofiel: 15–20 mm  
    * Wave-railprofiel: 20 mm  
    * Wave Pro Smal: 15 mm  
    * Interstil designroedes: tot 35 mm  
  * *Vloerspeling bij referentievlak Vloer (Default-aftrek):*  
    * *Harde Vloeren (Tegels, Parket, PVC, Gietvloer):* Standaard default-aftrek van **15 mm** boven de afgewerkte vloer in het inmeetportaal.  
    * *Zachte Vloeren (Hoogpolig Tapijt, Karpet):* Standaard default-aftrek van **20 mm** om slepen en wrijving te voorkomen.  
    * *Verzwaard Loodveterband (Extra -5 mm Aftrek):* Bij vitrages en inbetweens afgewerkt met een verzwaard loodveterband (i.p.v. een traditionele zoom) zakt de stof door het eigen gewicht strakker uit en kan de onderkant sneller op de grond gaan slepen. De software hanteert daarom bij selectie van *Onderzijde: Loodveter* automatisch een **extra aftrek van 5 mm (-5 mm)** bovenop de standaard vloerspeling om slepen op de vloer betrouwbaar uit te sluiten.  
    * *Slepend Gordijn:* Standaard toeslag van **+50 mm** (tot +100 mm voor een royale klassieke valling).  
  * *Rekenformule Blijvende Maat Hoogte:*  
    `H_confectie (Blijvende Maat Hoogte) = Brutomaat Hoogte - Rail/Haakcorrectie - Vloerspeling (+ Sleeptoeslag)`  
  * *Portaal-Default & Verplicht Toelichtingsveld bij Override:* De vloerspeling en aftrekken worden automatisch geladen op basis van het gekozen vloertype en de hangwijze. Indien de inmeter de berekende blijvende confectiehoogte handmatig aanpast (bijv. bij een scheeflopende vloer of specifieke klantwens), **is een schriftelijke toelichting in het portaal verplicht** om de wijziging te borgen in de audittrail.  
* **Brutomaat Breedte:**  
  In de breedte is de brutomaat **het vlak dat één of meerdere gordijnen in het zicht (de verticale weg) moet bedekken**.  
* **Van Brutomaat naar Blijvende Maat Breedte & Rail Zaagmaat:**  
  Op de brutomaat breedte worden specifieke toeslagen en correcties toegepast voor de definitieve railbreedte en confectiebreedte:  
  * *Overlap bij 2 Gordijnen (Stel):* Bij een stel gordijnen sluiten de delen centraal met een overlap (standaard **+100 mm**).  
  * *Retourbochten aan Uiteinden:* Bij retourbochten naar de muur (+90° omhangen) wordt de diepte van de bocht (bijv. links 20 cm, rechts 30 cm) opgeteld bij de benodigde stof- en railmaat om zijwaartse lichtspleten te elimineren.  
  * *Rondingen & Buigradii in de Rail:* Bij tussenbochten of erkers worden de gecorrigeerde zaagmaten berekend op basis van de buigradius (huismerk R=10 cm vs designrail R=20 cm conform §3.2.3).  
  * *Plooitoeslag & Stofbreedte:* De benodigde totale stofbreedte volgt uit de brutomaat breedte vermenigvuldigd met de plooifactor (enkele plooi 1,8–2,0×, dubbele vlinderplooi 2,2–2,5×, Wave 60 mm / 80 mm runnergordelverhouding).

#### 3.2.5 Gordijnpakketten & Doorgangscontrole
* **Pakketbreedte Gordijnen & Vrije Muurruimte:**  
  Bij gordijnen bepalen de plooisoort (enkel, dubbel, wave) en stofzwaarte de pakketbreedte in opgeschoven toestand. De inmeter toetst of er naast het kozijn voldoende muurruimte beschikbaar is om het gordijnpakket buiten de dagopening en buiten de draaicirkel van openslaande deuren of draairamen te parkeren, zodat maximale lichtinval en ongehinderde doorgang gewaarborgd blijven.

#### 3.2.6 Portaal-Inmeetchecklist & Veldinspectie: Gordijnen & Rails (5 kolommen, 11 inspectiepunten)
De inmeetchecklist voor gordijnen en rails is geoptimaliseerd voor directe verwerking in het portaal. Vragen verschijnen uitsluitend op basis van de geselecteerde productgroep en opties:

| Nr | Check / Inspectiepunt | Conditie (Wanneer verschijnt dit?) | Veldtype & Default in App | Validatie & Gevolg (Wat doet het portaal?) |
| :---: | :--- | :--- | :--- | :--- |
| **1** | Oude rails/ophanging aanwezig; demontage door klant vs. monteur? | Altijd (alle gordijnen & rails) | Radio [Geen / Klant verwijdert / Monteur verwijdert], default: Geen | Indien Monteur: berekent automatische demontagetijd en voegt orderregel en afvaltoeslag toe aan werkorder. |
| **2** | Hergebruik bestaande rail (inspectie glijders, bochten, steunen, pluggen)? | Als productgroep = Rails & Roedes én Bestaande rail hergebruiken = Ja | Radio [Ja (goedgekeurd) / Nee (afgekeurd/vervangen)], default: Nee | Bij Ja: dwingt inspectie af van glijders/steunen; waarschuwt klant dat garantie op soepele loop vervalt bij oude rails; monteursinstructie op werkbon. |
| **3** | Plafond-/wandconstructie & draagkracht (massief beton, stuc op riet, gipsplaat, hout)? | Altijd (alle gordijnen & rails) | Dropdown [Massief beton / Stuc op riet / Holle gipsplaat / Hout of Balk / Metal stud], default: Massief beton | Selecteert automatisch het juiste type schroeven en pluggen (bijv. hollewandpluggen / veerpluggen bij gips/riet) op de pakbon voor de monteur; bij stuc op riet toont app alert voor extra steunpunten. |
| **4** | Plafond-/vloerverloop > 15 mm bij gordijnen: advies en klantakkoord? | Automatisch getriggerd als Max(H1, H2, H3) - Min(H1, H2, H3) > 15 mm | Keuzemenu [Slepend confecteren (+3–5 cm) / Horizontaal hangen (lichtspleet accepteren) / Schuin afsnijden] + Checkbox [Klantakkoord verloop], default: Niet aangevinkt | Portaal blokkeert afronding zonder vinkje klantakkoord; past confectiehoogte-rekenregel aan en plaatst bindende opmerking op offerte en werkbon. |
| **5** | Leidingvrijheid montagezone: is de beoogde boorzone (wand, kozijn of plafond) gecontroleerd op leidingen? | Altijd (alle gordijnen & rails) | Checkbox [Leidingvrijheid gecontroleerd / akkoord klant], default: Niet aangevinkt | Verplichte veiligheidscheck conform §3.1.7 (vraag aan klant + leidingzoeker bij twijfel); blokkeert afronding zonder bevestiging; vrijwaart monteur voor verborgen leidingen. |
| **6** | Vrije ruimte golfslag / plooivrijloop: is er voldoende vrije ruimte rondom de rail (vóór > 8 cm, achter > 6 cm)? | Als plooitype = Wave-plooi (of dubbele plooi bij krappe koof/vensterbank) | Radio [Voldoende ruimte (≥ 8 cm vóór, ≥ 6 cm achter) / Beperkte ruimte of koof smal], default: Voldoende ruimte | Bij beperkte ruimte: berekent minimale steunafstand bij wandmontage (wandsteunen 10/15/20 cm) of adviseert enkele plooi; plaatst waarschuwing op werkbon. |
| **7** | Op locatie buigen? (Ja / Nee, default: Nee) | Als productgroep = Rails & Roedes | Radio [Ja / Nee], default: Nee | Indien Ja: genereert zaag- en buigtarief in calculatie en reserveert buigapparaat in busuitrusting van de monteur (§3.2.3). |
| **8** | Gewenst valgedrag gordijn: Vrijhangend vs. Slepend (Default: Vrijhangend)? | Als categorie = Gordijnen | Dropdown [Vrijhangend (standaard -15 tot -20 mm boven vloer) / Vloerrakend (0 tot -5 mm) / Slepend (+30 tot +50 mm)], default: Vrijhangend | Stuurt direct de blijvende confectiehoogte-formule in het atelier aan (§3.2.4); berekent exact benodigde stofmeters. |
| **9** | Pakketparkeerruimte & lichtinval: hangt het geopende gordijnpakket vrij van de dagopening/glaspartij? | Als montagewijze = Op de dag / Wandmontage | Radio [Volledig vrij op de muur / Overlap op glas (lichtreductie geaccordeerd)], default: Volledig vrij op de muur | Berekent vereiste railoverlengte links en rechts op basis van pakketbreedteformule (§3.2.5); voorkomt klachten over verlies van daglicht. |
| **10** | 230V stroompunt aan motorzijde (binnen 1 meter links of rechts)? | Als bediening = Elektrisch (230V railmotor) | Radio [Aanwezig conform opgave / Nog aan te leggen door klant of installateur], default: Aanwezig conform opgave | Indien Nog aan te leggen: markeert oplevervoorwaarde op werkbon en waarschuwt klant dat stroompunt gereed moet zijn vóór montagedatum; koppelt motorzijde (links/rechts) aan stroomlocatie. |
| **11** | Arbo & Extra klimmaterieel: welk extra materieel is vereist voor montage dat de standaard trap overstijgt? | Automatisch getriggerd als montagehoogte H > 3000 mm (of bereikbaarheid complex) | Dropdown [Geen (standaard trap ≤ 3 m) / Hoge ladder of Bordestrap (3–4 m) / Rolsteiger (≥ 4 m) / 2e monteur vereist], default: Geen | Reserveert rolsteiger/materieel in het planningssysteem, voegt Arbo-klimtoeslag en eventueel een 2e monteur toe aan de planningsorder (§4.8). |

---

#### 3.2.7 Inmeet- en Rekenmatrix: Gordijnen & Rails

| Productgroep | Primaire Dagmaat (Invoer Inmeter) | Blijvende Maat (Formule & Aftrekregel) | Verplichte Referentie & Validatie | Output naar Productie & Montage |
| :--- | :--- | :--- | :--- | :--- |
| **Rails & Roedes (Recht & Gebogen)** | Wand-tot-wand nisbreedte, of kozijnbreedte + gewenste overlap links/rechts; Bochtgraden / Uiteinde retour (15-25 cm) / Straal & Diameter bij ronde puien | *In de dag (nis):* Zaagmaat = Dagmaat - 15 mm; *Op de dag:* Dagmaat + pakketoverlap (2 × 150-250 mm); *Retourbocht:* Zaaglengte incl. buigtoeslag conform buigradius (R=10, R=15 of R=20) | Plafondtype (kanaalplaat/SDS vs. gips/hout), wand- vs plafondmontage, maximale steunafstand ≤ 70 cm (zware stoffen ≤ 50 cm), >70% rond Interstil inmeting | Zaagmaat rail (mm), aantal bochten/graden, aantal plafond-/wandsteunen, type glijders/runners (Wave 60/80 mm) |
| **Gordijnstoffen (Confectie)** | Plafond tot vloerpeil / bovenzijde vensterbank op 3 meetpunten (H1, H2, H3); Breedte railtracé | Confectiehoogte = Kleinste gemeten hoogte - railhoogte per gekozen profiel (15-35 mm) - vloerspeling (vast 15 mm harde vloer; vast 20 mm tapijt; standaard +50 mm slepend) | Definitief afwerkvloerpeil (of schriftelijke aftrek klant), wand vs plafond, in vs op de dag, plooitype (hoofdje = 0 mm bij strak plafond) | Maatwerk kniphoogte gordijn (cm), aantal banen (bij baanstof incl. rapport), aantal plooien / runners, zoommaat |

---

### 3.3 Categorie 2: Raamdecoratie (Binnenzonwering & Horren)

#### 3.3.1 Productgroepen, Merken & Configuratoren
* **Binnenzonwering & Merken:**  
  * *Merken & Fabrikanten:* Hunter Douglas (*Luxaflex, Sunway*), **Toppoint** (volledig geïntegreerd voor raamdecoratie en insectenwering).  
  * *Private label / Huismerk:* Dealer-eigen huismerken (zoals *Groter in Wonen*, in het ERP en op inkoopbonnen vastgelegd onder de merkcode **'GiW'**, o.a. geproduceerd door *Zonnelux* als private label).  
  * *Productgroepen:* Rolgordijnen (standaard voorzien van montageprofiel t.b.v. snelle montage en klantvriendelijke afklikbaarheid bij schilderen), Duettes / plissés, Silhouette (kantelbare stoffen lamellen tussen transparante sluiers), Duo-rolgordijnen / Twist (afwisselend dichte en transparante banen), Jaloezieën (horizontaal hout/alu, verticaal textiel, pvc en aluminium zoals Luminette/Allure), Vouwgordijnen, Paneelgordijnen, en **Insectenwering / Horren** (plisséhordeuren, rolhorren, inzethorren en vaste hordeuren).
* **Houten Jaloezieën & Houtsoorten:**  
  * *Abachi:* Zeer lichtgewicht tropisch hardhout met een rustige nerfstructuur. Dankzij het lage soortelijk gewicht uitermate geschikt voor brede raampartijen (tot 3000 mm breed) zonder overbelasting van het optrekmechanisme.  
  * *Basswood (Amerikaans Lindehout):* Dé kwaliteitsstandaard voor houten lamellen (50 mm en 65 mm). Homogeen van structuur, vormvast, ongevoelig voor temperatuurschommelingen en uitstekend dekkend te lakken of beitsen.  
  * *Bamboe:* Ecologisch verantwoord composiet van verlijmde bamboestrips. Dunne, elegante lamelopbouw met een karakteristieke natuurlijke tekening en hoge taaiheid.  
* **Shutters & Luikconstructies:**  
  * *Basswood Shutters:* Hoogwaardige binnenluiken met verstelbare lamellen (63 mm, 76 mm, 89 mm of 114 mm) in massief Basswood voor woon- en slaapkamers.  
  * *Polywood Shutters:* Vochtbestendige kunststof composiet shutters met een massieve aluminium kern tegen kromtrekken. Dé dwingende keuze voor vochtige ruimtes (badkamers, wellness en keukens).  
  * *Montagekaders:* Geleverd in L-kader (in de dag) of Z-kader (op de dag overlappend over de dagkant).  
* **Montagesystemen zonder Boren:**  
  * *EasyClick, FrameFix, Splendid Pliss & Louvolite Perfect Fit:* Slanke aluminium montageframes die magnetisch of met klemsteunen tussen de glaslatten van kunststof of aluminium draaikiepramen worden bevestigd. Volledig schadevrij zonder boren of schroeven, waardoor fabrieksgaranties op kozijnen behouden blijven.  
* **Trekstang- & Bedieningsformule:**  
  * Bij handbediende raamdecoratie en serresystemen met trekstang berekent de software automatisch de ideale stanglengte: `Trekstanglengte = Montagehoogte - 1400 mm`.
* **Duette® Marktaandeel & Onderhoudseigenschappen:**  
  Duettes / honingraatplissés vertegenwoordigen circa **80% van de raamdecoratieverkopen** in de woninginrichtingspraktijk.  
  * *Veelzijdigheid:* Toepasbaar in vrijwel elke bouwkundige situatie: rechthoekig, trapezium, driehoek, rond/boog, serre-/plafondmontage, vrijhangend, ingespannen met spandraden, direct op het glas (TruFit/klemsteunen), Top-Down / Bottom-Up en elektrisch.  
  * *Onderhoudsvriendelijkheid:* De gesloten honingraatstructuur vangt aanzienlijk minder zichtbaar stof op dan traditionele horizontale lamellen. Door de Duette® eenmaal volledig op en neer te trekken, dwarrelt eventueel oppervlakkig stof vanzelf van het doek af.
* **Complete Reeks Lamelbreedtes Aluminium Jaloezieën:**  
  Aluminium jaloezieën worden geleverd in vijf gestandaardiseerde lamelbreedtes:  
  * `16 mm`: Ultrafijne detaillering voor kleine ramen of smalle glaslatten.  
  * `25 mm`: De absolute standaard; meest verkocht, compacte inbouwdiepte, Top-Down / Bottom-Up optie beschikbaar.  
  * `35 mm`: Incidenteel toegepaste tussenmaat.  
  * `50 mm`: Robuuste, moderne industriële uitstraling; zeer populair bij grotere raampartijen (alleen traditioneel ophalen en tuimelen).  
  * `70 mm`: Extra brede XXL-lamellen voor zeer grote glasoppervlakken (zelden toegepast).  
  * *Bedieningsvormen jaloezieën:* Tuimelen via tuimelstang (tuimelen/fix), optrekken via koord (tuimelen/koord), monobediening via eindloze ketting, of elektrisch via motor (Somfy/PowerView).
* **Luxaflex Modelcodering & Systeemspecificaties (EOS-Systematiek):**  
  Luxaflex en Sunway hanteren een strikt logische modelcodering voor Duette® en Plissé:  
  * *Prefix (Positie & Montagevorm):*  
    * `A...` = **Vrijhangend** verticaal (zonder zijspandraden).  
    * `B...` = **Ingespannen** verticaal (voorzien van spandraden boven en onder, ideaal voor draaikiepramen).  
    * `P...` = **Plafond / Horizontaal / Serre** (horizontale of schuine dakmontage, voorzien van meervoudige metalen spandraden tegen doorhangen onder zwaartekracht; bediening via trekstang, slinger of motor, géén losse koorden mogelijk).  
  * *Letter 2 (Bedieningsmechanisme):*  
    * `..O..` = **Optrekkoord** (standaard handbediend koord, bijv. AO, BO).  
    * `..U..` = **SmartCord®** (intrekbaar enkelvoudig veermechanisme met constante koordlengte).  
    * `..K..` = **Kettingbediening** (eindloze metalen of kunststof ketting).  
    * `..E..` = **Elektrisch** (motorbediend, PowerView / 24V / accumotor).  
    * `..C..` = **LiteRise® / Handgreep** (veerbediend direct op de onder-/middenlijst).  
  * *Cijfer (Functie & Bedieningsconfiguratie):*  
    * `..10` = 1 bediening (standaard Bottom-Up).  
    * `..20` = 2 bedieningen (Top-Down / Bottom-Up, onafhankelijk bedienbare tussen- en onderlijst).  
    * `..30` = Dag & Nacht / 2 stoffen in 1 product (bijv. verduisterend onder en transparant boven).  
  * *Speciale Geometrische Modellen:*  
    * `BB60 / BB61`: Trapeziumramen en schuine gevels (ingespannen).  
    * `BB70 / BB71`: Driehoekige ramen (BB71 gelijkbenige driehoek met 2 maten: basisbreedte en nokhoogte).  
    * `BB80`: Vijfhoekige ramen.  
    * `PB70 / PB71`: Plafond- en serresystemen in schuine of getrapte constructies.
* **Verticale Lamellen & Paneelgordijnen:**  
  * *Verticale Lamellen:* Leverbaar in textiel (inclusief luxe transparante segmenten zoals Versos), hoogwaardig PVC (vochtbestendig voor keukens/badkamers) en aluminium.  
  * *Paneelgordijnen:* Zelfstandige productgroep voor schuifpuien en grote glaswanden (meersporige rails met brede schuivende stofpanelen).  
  * *Facette definitief geschrapt:* Facette wordt niet meer besteld en is uit het actieve assortiment verwijderd.
* **Configurator-uniformiteit:** Bestelsystemen (zoals Hunter Douglas configurator, Woontotaal, Logic Trade) hanteren in de kern exact dezelfde technische parameters; uitsluitend de vraagvolgorde verschilt per leverancier.
* **Productievoorschriften & Identificatie:**  
* **De Fabrieks-Productiesticker:**  
  Elk geleverd raamdecoratieproduct is voorzien van een fabrieks-productiesticker. **Cruciaal:** De fabriekssticker vermeldt altijd de **definitieve bestelmaat / productiemaat (blijvende maat)**, inclusief fabrieksaftrek. Deze maat mag **nooit** worden verward met de gemeten dagmaat. Bij montagecontrole controleert de monteur de maat op de sticker tegen de blijvende maat op de werkbon.

#### 3.3.2 Productspecifieke Eigenschappen, Lamellen & Montagetechnieken
* **Standaardisatie Montageprofiel vs. Losse Montagesteunen & Checkbox-Keuze (Faalkostenreductie):**  
  * *Voorkeur voor montageprofiel:* In de woninginrichtingspraktijk geldt het dwingende beleid om rolgordijnen en raamdecoratie standaard te adviseren en offreren met een **montageprofiel (draagprofiel)** in plaats van losse montagesteuntjes.  
  * *Checkbox [x] Incl. montageprofiel (Standaard aangevinkt, default: Ja):* In de inmeetsoftware en configurator wordt standaard de vraag/checkbox gesteld: `Checkbox: [x] Incl. montageprofiel` (Default: Ja).  
    - *Aangevinkt (Ja):* Montageprofiel wordt geconfigureerd en meegeleverd; het standaard montagetarief is van toepassing.  
    - *Uitgevinkt (Nee):* Montage geschiedt via losse montagesteuntjes. Omdat het afzonderlijk uitlijnen en waterpas stellen van losse montagesteuntjes extra arbeidstijd vergt, worden de **montagekosten verhoogd**.  
    - *V1 Scope-afbakening:* In versie 1 (V1) is het verhogen van de montagekosten bij het uitvinken van het montageprofiel een **handmatige handeling** van de adviseur/werkvoorbereider op de offerte/orderregel in het ERP (LogicTrade).  
  * *Praktijkproblemen losse steunen (Meers-casus):* Bij een project in Meers resulteerden losse steunen op een scheef plafond in scheefhangende steuntjes, een rolgordijn dat 1,5 cm te breed leek, aanliep tegen de dagkant en doek dat begon te rafelen.  
  * *Voordelen montageprofiel:*  
    1. *Maximale stelbaarheid & uitvullen:* Het doorlopende profiel kan perfect waterpas worden uitgevuld met stelplaatjes, ongeacht hoe scheef het plafond of de muur loopt.  
    2. *Vrije boorpositie:* De monteur hoeft niet exact op de kwetsbare buitenhoeken van de nis te boren (waar vaak wapening, leidingen of broze hoeken zitten), maar kan de bevestigingsclips over de gehele breedte van het profiel vrij verdelen.  
    3. *Opvangen motorkant-asymmetrie:* Bij een elektrisch rolgordijn staat de steun aan de motorkant fysiek verder naar binnen dan aan de niet-motorkant om symmetrische speling van het doek te creëren. Een montageprofiel absorbeert deze asymmetrie kant-en-klaar in de fabriek, waardoor de monteur het rolgordijn er simpelweg tussen klikt.  
    4. *Montagesnelheid & Kostensystematiek:* Een montageprofiel is in aanschaf iets duurder, maar reduceert de montagetijd aanzienlijk ("boren, pluggen, profiel inklikken"). De tijdwinst compenseert de materiaalkosten ruimschoots. In het ERP en offertesysteem (LogicTrade) worden montagetijden en prijzen productspecifiek ingericht.
* **Luxaflex Duette Elektrisch (Model AE20 PowerView) & Accessoire-Gating:**  
  * *Modelcodering Duette:*  
    * `AU10` / `AS10`: Handbediend standaard vrijhangend (onderlatbediening via SmartCord of LiteRise).  
    * `AU20` / `AS20`: Handbediend vrijhangend SmartCord met Top-Down / Bottom-Up bediening.  
    * `AE20`: Elektrisch vrijhangend PowerView met Top-Down / Bottom-Up (lithium-ion accumotor in 25 of 32 mm).  
    * `AU30` / `AS30`: Vrijhangend Dag & Nacht (twee stoffen met dubbele bediening).  
  * *Accessoire-Gating bij PowerView:* Bij selectie van `AE20` dwingt het portaal dwingend de configuratie van randapparatuur af:  
    1. *Magnetische oplaadkabel (Magnetic Charger):* Voor periodiek opladen van de interne accu.  
    2. *Bedieningszender:* Luxaflex Pebble meerkanaals handzender of draadloze wandzender.  
    Het portaal blokkeert orderafronding zolang deze componenten niet zijn geselecteerd.  
  * *Fabrieksprijsstaffels & Maatcorrecties:* Fabrikantprijslijsten zijn ingedeeld in staffels van 10 of 20 cm (bijv. 140–160 cm breedte × 140–160 cm hoogte). Binnen dezelfde staffel hebben kleine maatafwijkingen tussen de indicatieve conceptmaat van de klant en de definitieve inmeetwaarde geen invloed op de orderprijs.
* **Doorlopende Zijgeleiders tot Vloer/Plint (Verdiepingshoge Puien):**  
  * *Standaard:* Bij reguliere ramen stopt raamdecoratie met zijgeleiding strak op de vensterbank.  
  * *Verdiepingshoge puien (Spauwen-casus):* Bij ramen die van plafond tot de vloer doorlopen (bijv. vast glaspaneel onder en draaikiepraam boven) moet op de inmeet- en montagebon **expliciet worden vastgelegd** of de zijgeleiders moeten doorlopen tot op de afgewerkte vloer, óf moeten aansluiten boven de vloerplint.  
  * *Foto-vastlegging:* De inmeter maakt verplicht een detailfoto van de aansluiting tussen kozijn, vloer en plint, zodat de werkvoorbereiding direct ziet of de plint moet worden ingekeept of dat het geleideprofiel op de plint stopt.
* **Dagmaat vs. Blijvende Maat & LogicTrade Koppeling:**  
  * De software berekent uit de strakke dagmaat automatisch de blijvende maat (bestelmaat) conform de fabrikantregels.  
  * *Overschrijving door inmeter:* De inmeter heeft te allen tijde de bevoegdheid om de berekende blijvende maat handmatig te overschrijven (bijv. bij scheve wanden of afwijkende speling).  
  * *Kleurmarkering & Permanente Dagmaat:* Bij handmatige overschrijving kleurt het veld in de interface direct opvallend (rood/oranje) met een verplichte toelichtingsnotitie. De oorspronkelijke gemeten dagmaat blijft permanent zichtbaar als referentie.  
  * *Export naar LogicTrade / Fabrikantconfigurator:* Bij orderoverdracht naar LogicTrade of bestelsystemen wordt bij overschrijving **altijd de overschreven blijvende maat geëxporteerd**, zodat de fabrikant exact de gewenste bestelmaat produceert. Fabriekstoleranties (tot 25 mm toegestane afwijking bij textielconfectie en 5 tot 10 mm fabrieksaftrek per fabrikant) worden hierbij contractueel geborgd.
* **Technische Restricties & Montagetechnieken:**
  * *Aluminium Jaloezieën (25 mm vs. 50 mm):*
    * *25 mm lamellen:* Fijne detaillering; Top-Down / Bottom-Up (TDBU) is mogelijk.
    * *50 mm lamellen:* Robuuste uitstraling; Top-Down / Bottom-Up is bij 50 mm technisch niet mogelijk (alleen traditioneel ophalen en tuimelen).
  * *Tuimelen vs. Ophalen:* Jaloezieën hebben een aparte tuimelfunctie (kantelen via tuimelstang of tuimelkoord) én een optrekfunctie (ophalen via koord/motor), in tegenstelling tot rolgordijnen en duettes.
  * *Montagesystemen (op Glas & Kozijn):*
    * *Standaard:* In de dag (in kozijn) of op de dag (op muur/kozijn).
    * *Boorvrije montagesystemen:* TruFit (plakprofielen direct op het glas met handgreepbediening), Glide (smalle zijgeleiders), FrameFix (volledig magnetisch 4-zijdig frame dat zonder boren naadloos op kunststof of aluminium kozijnen hecht), Klem- en plakframes (Perfect Fit, SmartFit en klemsteunen voor draaikiepramen).

#### 3.3.3 Bedieningssystemen, Kindveiligheid (NEN-EN 13120) & Arbo-Veiligheid (Hoge Ramen)
* **Bedieningsvormen & Aandrijving:**
  * *Handmatig:* Ketting, koord, handgreepbediening (LiteRise), SmartCord (veersysteem met intrekbaar enkelvoudig koord op constante vaste lengte, pompende slagen voor optrekken, 100% Child Safe), eindloze ketting of koord voorzien van kettingspanner of breekbare koordbreker.
  * *Elektrisch & Smart Home:* AE10 (1 motor) en AE20 (2 motoren voor onafhankelijke Top-Down / Bottom-Up aansturing), PowerView, Somfy.
  * *Accu & USB-C:* Oplaadbare accumotoren (geen vaste 230V bekabeling noodzakelijk).
* **Kindveiligheid & Child Safety (NEN-EN 13120) & Dwingende Montagehoogte-Gating:**  
  Bij koord- en kettingbediening moet het bedieningskoord minimaal **150 cm boven het vloerniveau** hangen, verplicht voorzien zijn van een breekbare kettingslot of vastgezette veiligheidskoordhouder/kettingspanner.  
  * *Strikte Portaal-Gating Montagehoogte:* Om een definitief einde te maken aan de historische praktijk waarbij de montagehoogte structureel niet werd ingevuld en standaard op 2,60 m werd aangenomen (met te korte kettingen, nabestellingen en dubbele monteurritten tot gevolg), geldt de **Montagehoogte als verplicht, blokkerend numeriek invoerveld** voor alle koord- en kettingbediende producten.  
  * *Formule Kettinglengte:* Het portaal berekent de maximale kettinglengte automatisch: `Kettinglengte = Montagehoogte - 1500 mm`.  
  * *Uitzondering Keukenaanrecht / Vaste Werkbladen:* Indien een raam zich achter een aanrecht (werkbladhoogte ca. 90 cm) of vast bureau bevindt, is een bediening op 150 cm vanaf de vloer ergonomisch onbereikbaar voor de klant. De software biedt de override-optie *'Bediening boven aanrecht/vast obstakel'* waarbij met een goedgekeurd kettingspansysteem of breekbare koordbreker een kortere vrije afstand kan worden toegepast.
* **Arbo-Veiligheid bij Hoge Ramen, Vides & Traphallen (> 2,5 m werkhoogte):**  
  Bij ramen boven trapgaten, vides en bordessen geldt:
  * Inzet van een gecertificeerde uitschuifladder van minimaal **2,5 meter**.
  * Plaatsing van de ladderpoten uitsluitend tegen een stabiel **stootbord** of massieve vloer/wand; nooit los op een tredevlak zonder borging.
  * Verplicht gebruik van **beschermdekens** om beschadiging aan stootborden en wanden te voorkomen.
  * Indien werkhoogte > 4 m is een rolsteiger of gecertificeerd bordesplatform verplicht.
  * **Directe Input voor Planning & Montage (Deel 4):** Bovenstaande Arbo- en veiligheidsaspecten gelden niet alleen voor de inmeter, maar vormen verplichte sturende data voor de montageplanning (Fase 5 / Deel 4). *(Noot V1-scope: In versie 1 genereert het portaal geen volautomatische inkoop- of materieellijst; in plaats daarvan vinkt de inmeter in de Arbo-checklist aan welk extra klimmaterieel benodigd is [lange ladder, hoge trap, rolsteiger, anders...], waarna dit direct als concrete attentiewaarde op de digitale werkbon verschijnt zodat de bus voor vertrek juist beladen wordt).* 

#### 3.3.4 Insectenwering (Horren)
* **Insectenwering (Horren) als Functionele Productgroep:**  
  Insectenwering/horren vallen binnen het domeinmodel volwaardig onder **Categorie 2 (Raamdecoratie / Zonwering)**. In tegenstelling tot decoratieve raambekleding is een hor een zuiver effectief en functioneel werend product: insecten buiten houden met een maximale transparantie van het gaas en minimale visuele verstoring van het kozijnaanzicht.
  * **Toonaangevende Merken in het Portaal:** **Luxaflex** en **Toppoint** (volledig geïntegreerd met typecodes, stalen en profielkleuren).
  * **Gespecialiseerde Gaassoorten:**  
    * *Poll-tex Gaas:* Elektrostatisch geladen gaas dat pollen en allergenen actief aantrekt en tot meer dan 90% van de pollen uit de buitenlucht tegenhoudt (gecertificeerd door ECARF). Dé medische keuze voor bewoners met ernstige pollenallergieën en hooikoorts.  
    * *Petscreen (Dieren- & Kattenklauwbestendig Gaas):* Extra zwaar geweven vinyl-polyestergaas dat tot 7 keer sterker is dan traditioneel glasvezelgaas. Bestand tegen de scherpe nagels en klauwen van honden en katten.  
    * *ClearView Gaas:* Ultra-fijndradig antracietkleurig gaas dat een superieure luchtstroom en een nagenoeg onzichtbare doorkijk van binnen naar buiten garandeert met behoud van volledige insectenwering.  
  * **Producttypen binnen de Productgroep Insectenwering:**
    * **Plisséhordeuren:** Bij uitstek geschikt voor schuifpuien, openslaande deuren en balkondeuren. Voorzien van gevouwen harmonicagaas en een ultra-lage kunststof ondergeleider (slechts 3 tot 5 mm hoog) voor een drempelloze, rolstoelvriendelijke doorloop. Dankzij de flexibele kettingconstructie en speling in de bovenbak is dit systeem zeer vergevingsgezind voor kleine bouwkundige maatafwijkingen en lichte scheefstand.
    * **Oprolbare Hordeuren (Nultolerantie & Verplichte Waterpascontrole):** De oprolbare hordeur loopt in een strakke cassette met vaste zij- en ondergeleiders. In tegenstelling tot plisséhordeuren vereist dit product **absolute nultolerantie**: indien de vloer (parket, tegels) niet 100% waterpas ligt (zelfs 2 mm verloop) of de dagkant scheef gestukadoord is (ruitvorming), gaat het strak gespannen gaas blazen en loopt het mechanisme vast (€ 800,- faalkosten). Bij keuze voor een oprolbare hordeur schrijft het portaal dwingend een waterpasmeting op de vloer én een kruismeting (D1 vs D2) voor.
    * **Rolhorren (Ramen):** De klassieke veerbediende of soft-raise oplossing in een slanke cassette met borstelafdichting en windvaste gaasopsluiting in de zijgeleiders (geschikt voor standaard draairamen en dakramen).
    * **Inzethorren:** Dé standaardoplossing voor kunststof en houten draaikiepramen. Wordt zonder boren of schroeven gemonteerd door middel van flexibele RVS klemveren in de sponning, waardoor het raambeslag en de rubbers volledig intact blijven.
    * **Vaste & Scharnierende Hordeuren:** Uitgevoerd met zelfsluitende scharnieren, schopplaat aan de onderzijde en magneetsluiting.
  * **Specifieke Buitensituaties & Kozijn-Inmeetdiscipline:**
    * **Buitendorpels & Vensterbanken:** De inmeter controleert altijd de vlakheid, scheefstand en afloop van de dorpel/vensterbank naar buiten. Bij plisséhordeuren op afschot is een schuine onderlat of wigprofiel vereist om te voorkomen dat de ondergeleider hol staat of water naar binnen leidt.
    * **Kozijn met Waterkering (Lekrand):** Veel houten en kunststof buitenkozijnen zijn voorzien van een uitstekende lekrand of schuine waterkering aan de onderzijde of bovenzijde. De inmeter registreert dit direct in de checklist; het portaal selecteert automatisch de benodigde **opvulprofielen** om de hor zuiver verticaal en vlak op het kozijn te laten aansluiten.
    * **Montagewijzen & Plaatsing:** Onderscheid tussen 'In de dag' (tussen de neggen of in het kozijn), 'Op de dag' (op het buitenkozijn) en **stootmontage (naar stoots)** waarbij het profiel strak tegen de aanslag of het metselwerk wordt gemonteerd.
    * **Draairichting & Beslagspeling:** Bij naar buitendraaiende ramen monteert de monteur de hor aan de binnenzijde; bij naar binnendraaiende ramen (draaikiep) aan de buitenzijde. De inmeter controleert altijd de speling t.o.v. uitzetijzers, raamboompjes, ventilatieroosters en klinken.

---

#### 3.3.5 Inmeetinstructies per Plaatsings- en Montagewijze (Wat meet de inmeter exact?)
De selectie van de drie primaire montagesituaties (`In de dag` [incl. subkeuze 'Plafond van de negge'], `Op de dag` [incl. optie 'Tegen het plafond'], en `In het plafond`), waarbij de **Montagehoogte te allen tijde een strikt verplicht invoerveld is bij álle montages in het verticale vlak en aan het plafond**, de verplichte ondergrondclassificatie en de universele leidingdetectie in muren en wanden worden uitgevoerd conform de overkoepelende standaarden in §3.1.1, §3.1.2 en §3.1.7.

Hieronder volgen de specifieke meetinstructies en productspecifieke spelingen per situatie:

* **1. Situatie 'In de dag' (Plaatsing tussen de dagkanten van de opening):**  
  De inmeter meet de zuivere, strakke dagmaten op minimaal 3 posities (Boven B1, Midden B2, Onder B3; en Links H1, Midden H2, Rechts H3) conform §3.1.2.
  * *Standaard rekenregel:* De software berekent de blijvende maat automatisch op basis van de **kleinste gemeten breedte- en hoogtemaat**, verminderd met de productspecifieke fabrieksspeling (zie aftrekmatrix §3.3.12).
  * *Vrije dagkantdiepte:* De inmeter meet en registreert de beschikbare diepte van de negge/dagkant. Het product moet volledig binnen de negge vallen zonder vóór het wandvlak uit te steken:
    * Horizontale jaloezie 25 mm: minimale dagkantdiepte `30 mm`.
    * Horizontale jaloezie 50 mm: minimale dagkantdiepte `65 tot 75 mm`.
    * Duette® 25 mm: minimale dagkantdiepte `35 mm`.
    * Duette® 64 mm: minimale dagkantdiepte `75 mm`.
    * Rolgordijn met cassette: minimale dagkantdiepte `70 tot 90 mm`.
    * Bij onvoldoende diepte forceert de software een advies tot montage 'Op de dag' of speciale hoeksteunen.
  * *Klinkvrijheid:* Vaste controle op minimale vrije klinkspeling van 25 mm tussen productrand en hartlijn raamkruk conform §3.3.8.
  * *Diagonale Kruismeting (Haaksheidscontrole):* Gestandaardiseerd via `D1` (linksonder naar rechtsboven ↙ → ↗) en `D2` (rechtsonder naar linksboven ↘ → ↖) conform §3.1.2. Verschil > 5 mm activeert scheefstandwaarschuwing en klemrisico bij vaste kadersystemen.

* **2. Situatie 'Op de dag' (Plaatsing vóór/over de dagopening):**  
  De inmeter meet de strakke dagmaat en bepaalt in overleg met de klant de gewenste overlap over de gevelopening:
  * *Standaard overlap:* Standaard geldt een geadviseerde overlap van **50 tot 100 mm aan weerszijden** (totale breedte = `Dagmaat + 100 tot 200 mm`) en minimaal **100 mm aan de bovenzijde** voor de montagesteunen boven de dagkant/latei.
  * *Blijvende maat berekening:* De software berekent `Blijvende breedte = Grootste dagmaat B + linker overlap + rechter overlap`.
  * *Montagehoogte:* Verplicht veld (afstand vloer tot bovenzijde steun) voor het aansturen van de kettinglengte (EN 13120) en klimmaterieel (§4.8).
  * *Keuzeoptie 'Tegen het plafond':* Indien geselecteerd, wordt de bovenzijde van het product strak tegen het plafond gemonteerd; de hoogte wordt berekend vanaf afgewerkte vloer tot plafond.

* **3. Situatie 'Op het raamkozijn / Glaslatmontage' (Draaikiepramen & Deuren):**  
  * *Glaslatmontage:* De inmeter meet de exacte glasmaat (dagmaat tussen de binnenranden van de glaslatten) in de breedte en hoogte op 3 punten. De inmeter inspecteert de glaslatdiepte (min. 18–25 mm) en glaslatschuinte conform §3.3.8.
  * *Klemsteunmontage (Boorvrij):* De inmeter meet de breedte en hoogte van de beweegbare raamvleugel (buitenwerkse vleugelmaat) en controleert de sponningdikte (geschikt voor klemsteunen 15–24 mm) en de rubberkaderruimte (minimaal 3 mm vrije ruimte tussen kader en kozijn om tochtvrij sluiten te waarborgen).
  * *TruFit® / FrameFix (Geplakt of Magnetisch klemkader):* De inmeter meet de strakke glasmaat tot op de millimeter nauwkeurig; de software berekent de exacte kadermaat. Plakstrook vereist minimaal 15 mm vlakke glaslat.

* **4. Bedieningshoogte, Kindveiligheid & Reikhoogte:**  
  * *Child Safety EN 13120:* Formule `Kettinglengte ≤ Montagehoogte - 150 cm` wordt automatisch gevalideerd conform §3.1.2.
  * *LiteRise / Handgreep:* Bij montagehoogtes `> 2,10 m (210 cm)` signaleert de software verplicht een magnetische bedieningsstok of overstap naar SmartCord / accumotorisatie.

#### 3.3.6 Pakkethoogte & Doorgangscontrole bij Gevelopeningen
* **Pakketdikte in Opgetrokken Toestand:**  
  Elk type raambekleding en binnenzonwering heeft in opgetrokken toestand een fysiek pakket (bovenbak + samengevouwen lamellen, plooien of doekrol). De pakkethoogte is direct afhankelijk van de totale producthoogte en het stof-/materiaalpakket.
* **Doorgangscontrole bij Binnendraaiende Delen:**  
  Bij deuren, openslaande tuindeuren, stolpramen en draaikiepramen controleert de inmeter of het opgetrokken pakket de vrije doorgang of de draairichting belemmert:
  * Bij montage op de dag boven een draaiend deel moet de montagehoogte minimaal de vrije opening plus de volledige pakkethoogte bedragen, zodat de deur ongehinderd kan openen.
  * Bij onvoldoende ruimte tussen kozijn en plafond adviseert de inmeter montage direct op de vleugel (bijv. TruFit / FrameFix) of een alternatieve productgroep met geringere pakkethoogte (zoals Duette 25 mm i.p.v. houten jaloezieën 50 mm).

#### 3.3.7 Schuine Dakramen & Speciale Vormen
* **Dakhellingshoek & Tuimelas:**  
  Bij dakramen (Velux e.a.) noteert de inmeter de merkcode en het typenummer van het typeplaatje. Bij afwijkende schuine ramen meet de inmeter dakhelling, breedte boven/onder en hoogte links/rechts.
* **Horizontaalstelling:**  
  Bij montage van binnenzonwering in schuine of getrapte situaties wordt met laser/waterpas de exacte horizontaalstelling van de bovenbak gecontroleerd ter voorkoming van scheeftrekkende koorden en ongelijke lamelstanden.

#### 3.3.8 Draaikiepramen & Glaslatmontage
* **Klinkvrijheid Minimaal 2,5 cm (25 mm):**  
  Bij naar binnendraaiende delen en draaikiepramen moet tussen de rand van het product/zijprofiel en de hartlijn van de raamkruk minimaal **25 mm vrije ruimte** overblijven. Bij minder dan 25 mm botst de hand van de gebruiker tegen de raambekleding bij het bedienen van de kruk.
* **TruFit / FrameFix / EasyClick Montage (Borenloos):**  
  Montage zonder boren direct op het raamkozijn of glas: TruFit en FrameFix via hoogwaardige 3M kleefstrips op het glas of de glaslat (vooraf grondig ontvetten met isopropanol en hechtprimer, max. breedte 1300 mm), en EasyClick met een aluminium magneetframe dat met klemmen direct op de glaslat of het kozijnprofiel wordt vastgeklikt.
* **Standaard Monteursinstructie bij Draaikiepramen & Kiepstandbegrenzing (Filtertrechter):**  
  De vaste default-instructie op de werkbon luidt: *"Rekening houden met kiepstand (steunen zover mogelijk naar achteren plaatsen)"*. De monteur lijnt dit ter plekke uit met de laser (bijv. 32 mm). Alleen wanneer de klant expliciet eist dat het doek bij geopende kiepstand neerwaarts blijft hangen, voert de adviseur een harde afwijkende afstand (bijv. 3 cm) en montageafspraak in.  
  * *Protocol Kiepstandbegrenzing (Beslag-Nok vs. Montagewijze):* Bij montage 'In de dag' boven of voor een draaikiepraam toetst de inmeetworkflow via een dynamische vraagboom of de kiepuitslag van de raamvleugel kan worden begrensd. Veel modern draaikiepbeslag bevat een verstelbaar schuifje of begrenzingsnok in de bovensponning waarmee de kiepstand kan worden verkleind. Kan het beslag worden begrensd, dan kan de cassette veilig in de dag blijven hangen zonder dat het raam er bij openen tegenaan slaat. Is het beslag niet instelbaar of kantelt het raam te ver naar voren, dan switcht de filtertrechter direct naar montage **'Op de dag'** of montage direct op de raamvleugel (**TruFit / FrameFix / EasyClick / Glaslatmontage**).

#### 3.3.9 Mechanische Spelingen & Doekafslagen bij Plaatsing 'In de Dag'
Bij montage 'In de dag' berekent de software automatisch de blijvende productiemaat via de gecentraliseerde aftrekmatrix in §3.3.12. De bouwkundige en mechanische noodzaak van deze spelingen is als volgt:

* **Vrijloop Lamellen & Plissés (Voorkomen van Klemmen):**  
  Horizontale jaloezieën en Duette®/Plissé stoffen vereisen aan weerszijden vrije ruimte (4 tot 5 mm per zijde) om ongehinderd op en neer te bewegen zonder tegen kozijnrubbers, schroefkoppen of scheef stucwerk te schuren.
* **Doekafslag & Lichtspleten bij Rolgordijnen:**  
  Bij rolgordijnen en duo-rolgordijnen wordt de systeembreedte (bovenbak/steunen) met 5 mm versmald. Het geweven doek zelf is vanwege de kettingbediening, motorkop en lagerproppen altijd **30 tot 35 mm smaller** dan de gemeten dagmaat (ca. 18–20 mm lichtspleet aan de bedieningszijde en ca. 12–15 mm aan de contra-zijde). De inmeter bespreekt deze onvermijdelijke lichtspleet actief met de klant (vooral bij verduisterende slaapkamergordijnen) en adviseert bij bezwaar zijgeleiders of montage 'Op de dag'.
* **Verticale Lamellen (Textiel, PVC, Aluminium):**  
  De rail wordt 10 mm versmald; de lamellen worden met een vloer-/vensterbankspeling van 15 tot 20 mm gemonteerd om ritselen en kromtrekken over vensterbanken te voorkomen.

#### 3.3.10 Rekenvoorbeelden Raamdecoratie
* **Voorbeeld Raamdecoratie (In de Dag):**  
  1200 mm (Gemeten dagmaat) → -5 mm fabrieksreductie 'In de dag' (Luxaflex) → **1195 mm (Bestelmaat)** (bij Duette AU10/AU20: 1195 mm dagmaat → -8 mm → **1187 mm**).
* **Voorbeeld Raamdecoratie (Overlap 'Op de Dag' & 10 cm Staffel-optimalisatie):**  
  1080 mm (Gemeten dagmaat) → +140 mm (Standaard overlap 2 × 70 mm) = 1220 mm (Staffel t/m 1300 mm) → **Suggestie Software: Overlap 2 × 60 mm naar 1200 mm (Lagere prijsstaffel t/m 1200 mm: besparing € 25,- per raam)**.
* **Voorbeeld Hoogte-optimalisatie (Staffelgrens 2,60 m):**  
  2604 mm (Gemeten strakke hoogte) → Software signaleert prijssprong boven de 2,60 m grens → **Suggestie Software: Inkorten naar 2600 mm (-4 mm op overlap) behoudt normale prijsstaffel en voorkomt zware maattoeslag**.
* **Voorbeeld Modelcodering Mapping (EOS-Pompsysteem):**  
  Klantwens: Duette vrijhangend, SmartCord bediening, Top-Down / Bottom-Up → **Luxaflex/Sunway modelcode: AU20** | **Zonnelux modelcode: AS20** | *Elektrische uitvoering:* **AE20** | *Enkelvoudige bediening (boven naar onder):* **AU10**.
* **Voorbeeld Multi-Positie Duette (Samenvoegen Gevelopeningen):**  
  Positie 1 (Raam links, dagmaat 1080 mm) + Tussenstijl 170 mm + Positie 2 (Raam rechts, dagmaat 1080 mm) + Overlap 2 × 120 mm → **2570 mm (1 geaggregeerde Duette met SmartCord i.p.v. 2 losse delen)**.
* **Voorbeeld 25 mm Jaloezieën Set-Uitlijning:**  
  Bij gekoppelde ramen in één wandvlak moeten de horizontale lamellen visueel strak doorlopen. De fabrikant bouwt lamellen op in vaste stappen van 22 tot 25 mm. Bij bestelling markeert de software de posities als `[Gekoppelde Set - Lameldoorloop Verplicht]`, waarbij de fabriek de lamelponsing uitlijnt met een maximale afwijking van **≤ 12 mm**.
* **Voorbeeld Voordeur Klinkvrijheid:**  
  Glasingetogen voordeur met dagmaat glasbreedte 28 cm. Gewenste overlap op de dag: +5,5 cm aan scharnierzijde, maar slechts +2 cm aan klinkzijde wegens afstand tot de deurkruk. Bestelbreedte = 28 + 5,5 + 2 = 35,5 cm, waarbij klinkvrijheid (≥ 25 mm) behouden blijft.

#### 3.3.11 Portaal-Inmeetchecklist & Veldinspectie: Raamdecoratie & Binnenzonwering (5 kolommen, 28 inspectiepunten)
De inmeetchecklist voor raamdecoratie en binnenzonwering volgt een dynamische conditiestructuur in de inmeet-app, waardoor uitsluitend de relevante controles voor het gekozen producttype worden getoond:

| Nr | Check / Inspectiepunt | Conditie (Wanneer verschijnt dit?) | Veldtype & Default in App | Validatie & Gevolg (Wat doet het portaal?) |
| :---: | :--- | :--- | :--- | :--- |
| **1** | Oude raambekleding/folie aanwezig; demontage door klant vs. monteur? | Altijd (alle raamdecoratie) | Radio [Geen / Klant verwijdert / Monteur verwijdert], default: Geen | Indien Monteur: berekent automatische demontagetijd en voegt orderregel toe aan calculatie en werkorder. |
| **2** | Afvoer van oud materiaal gewenst door monteur vs. klant zelf afvoeren? | Verschijnt als demontage door monteur = Ja | Radio [Klant voert zelf af / Afvoer door monteur], default: Klant voert zelf af | Indien Monteur afvoert: berekent afvalcontainer- en milieutoeslag in werkorder. |
| **3** | Herplaatsing van gedemonteerd product naar andere positie in woning? | Verschijnt als oude raambekleding aanwezig = Ja | Radio [Ja / Nee], default: Nee | Genereert zelfstandige orderpositie met eigen inmeting, nieuwe bevestigingsmiddelen en gatencontrole (§3.1.2). |
| **4** | Kozijnverloop & maattolerantie-akkoord (> 5 mm): lichtspleet geaccordeerd? | Automatisch getriggerd als Max(B1..B3)-Min(B1..B3) > 5 mm of Max(H1..H3)-Min(H1..H3) > 5 mm bij 'In de dag' | Checkbox [Klant akkoord met lichtspleet door scheefstand/verloop], default: Niet aangevinkt | Verloop > 5 mm verplicht vastleggen op meetverslag ter voorkoming van klachten; blokkeert afronding zonder klantakkoord. |
| **5** | Haaksheid kozijn & scheefstandinspectie: klemmen kaders/geleiders niet (kruismeting D1/D2)? | Als montagewijze = In de dag en (product met zijgeleiding, horren of kadersysteem) | Radio [Zuiver haaks (verschil D1 vs D2 ≤ 5 mm) / Scheefstand geconstateerd (> 5 mm)], default: Zuiver haaks | Verschil tussen D1 en D2 > 5 mm triggert scheefstandwaarschuwing en klemrisico bij kaders; adviseert montage 'op de dag' of bouwkundig uitvullen (§3.1.2). |
| **6** | Leidingvrijheid montagevlak: is het montagevlak (in/op de dag/plafond) gecontroleerd op leidingen? | Altijd (alle raamdecoratie) | Checkbox [Leidingvrijheid gecontroleerd / akkoord klant], default: Niet aangevinkt | Verplichte veiligheidscheck conform §3.1.7 (vraag aan klant + leidingzoeker bij twijfel); blokkeert afronding zonder bevestiging. |
| **7** | Montagewijze met montageprofiel: Checkbox [x] Incl. montageprofiel? | Als productgroep = Horizontale Jaloezieën, Duette & Plissé of Rolgordijnen | Checkbox [Montageprofiel toepassen], default: Aangevinkt (Ja) | Bij Ja: voegt montageprofiel toe aan artikelopbouw, maakt clipmontage mogelijk en voorkomt meervoudige boorgaten in het kozijn. |
| **8** | Kozijnmontage & boorvrije geschiktheid (materiaal en boorrestricties)? | Alleen bij montage op raamvleugel of glaslat | Dropdown [Hout (schroeven) / Kunststof (klemsteun of boorvrij) / Aluminium (klemsteun of plakprofiel) / Staal], default: Kunststof | Sluit schroeven uit bij kunststof/aluminium zonder akkoord; selecteert boorvrije systemen (TruFit, FrameFix, klemsteunen) en genereert toeslag. |
| **9** | Aansluiting zijgeleiders op vloer/plint gecontroleerd: lopen geleiders ongehinderd door? | Als optie = Zijgeleiding (staaldraad, U-profiel of cassettegeleider) | Radio [Vrij tot ondergrond / Plint of dorpel in de weg], default: Vrij tot ondergrond | Bij obstakel: berekent ingekorte geleiderlengte of afstandsbussen voor geleiderhouders. |
| **10** | Vrije inbouwdiepte dagkant: biedt de negge voldoende diepte voor de gekozen cassette/bovenbak? | Als montagewijze = In de dag | Numeriek [Gemeten inbouwdiepte in mm], default: Leeg (verplicht invoeren) | Toetst automatisch aan systeemeisen (bijv. min. 65 mm voor jaloezie 50 mm, min. 40 mm voor Duette 25 mm); waarschuwt bij te krappe negge en adviseert 'Op de dag'. |
| **11** | Glaslatprofiel & dieptetoets: bieden glaslatten voldoende diepte (min. 18–20 mm) en zijn ze recht? | Als montagewijze = Op de glaslat / TruFit / FrameFix | Dropdown [Recht (≥ 18 mm) / Schuin of Afgerond / Te ondiep (< 18 mm)], default: Recht (≥ 18 mm) | Schuin of < 18 mm blokkeert standaard glaslatclips; selecteert klemsteunen of hoeksteunen voor vleugelmontage. |
| **12** | Klinkbediening & beslagvrijheid: kan de raamkruk ongehinderd worden bediend (> 25 mm speling)? | Als draairichting raam = Binnendraaiend of kruk steekt uit in dagopening | Radio [Kruk vrij (> 25 mm speling) / Kruk botst (verlengde kruk of afstandsteun vereist)], default: Kruk vrij | Bij krukbotsing: activeert afstandsteunen (bijv. 40–60 mm) of selecteert platte designkruk; voorkomt doekbeschadiging. |
| **13** | Kiepstandbotsing & openingsbegrenzing: kan het raam in val-/kiepstand openen zonder botsing? | Als raamtype = Draaikiepraam | Radio [Vrij in kiepstand / Beperkte kiepruimte (steunen naar achteren plaatsen)], default: Vrij in kiepstand | Voegt standaard monteursinstructie toe: "Rekening houden met kiepstand (steunen zover mogelijk naar achteren)"; adviseert indien nodig kiepbegrenzer (§3.3.8). |
| **14** | Doorgangsvrijheid binnendraaiend raam: zwaait raamvleugel vrij onder opgetrokken pakket door? | Als montagewijze = Op de dag / Boven het raam bij binnendraaiend raam | Numeriek [Vrije ruimte boven raamkozijn in mm], default: Leeg | Berekent of vrije lateihoogte ≥ pakkethoogte (tabel §3.3.6); waarschuwt indien raam bij openen tegen het opgetrokken pakket zal stoten. |
| **15** | Doekval & obstakelvrijheid: vereist uitstekend beslag/ventilatierooster een contra-rollend doek? | Als productgroep = Rolgordijnen | Radio [Standaard rollend (doek achterlangs) / Contra-rollend (doek voorlangs)], default: Standaard rollend | Contra-rollend selecteert voorwaartse doekafloop (+25–35 mm speling vanaf glas); voorkomt schuren over kruk of ventilatierooster. |
| **16** | Toegankelijkheid bedieningszijde: is gekozen bedieningszijde vrij van vaste obstakels? | Als bediening = Handmatig (ketting / koord) | Radio [Bediening Links / Bediening Rechts], default: Rechts | Controleert of gekozen zijde overeenkomt met intake verkoper; waarschuwt indien zijde geblokkeerd wordt door vaste wand of radiator. |
| **17** | Kindveiligheid EN 13120 inspectie: eindigen koorden/kettingen min. 150 cm boven de afwerkvloer? | Als bediening = Koord of Eindloze ketting | Checkbox [EN 13120 kindveiligheid gecontroleerd & bevestigd], default: Niet aangevinkt | Wettelijke EN 13120 validatie; app berekent maximale kettinglengte (Montagehoogte - 1500 mm); blokkeert order zonder vinkje en genereert spanners op werkbon (§3.3.3). |
| **18** | Ergonomische handgreepbediening (LiteRise): is handgreep opgetrokken bereikbaar zonder trap? | Als bediening = Handgreep / LiteRise / SmartCord | Radio [Bereikbaar vanaf vloer (bovenkant raam ≤ 220 cm) / Te hoog voor handgreep (bedieningsstang of motor vereist)], default: Bereikbaar vanaf vloer | Bij te hoog: blokkeert LiteRise of voegt telescopische bedieningsstang / accumotor toe (§3.3.3). |
| **19** | Accu-laadpunt bereikbaarheid: is USB-C poort bereikbaar of is 3m magneetkabel vereist? | Als bediening = Accu-motor (Brel, Somfy, MotionBlinds) | Radio [Laadpoort bereikbaar (< 2,5 m) / Verlengde magneetlaadkabel (3 m) vereist], default: Laadpoort bereikbaar | Voegt bij montagehoogte > 2500 mm automatisch een magnetische laadkabel van 3 meter toe aan de accessoire-order. |
| **20** | Arbo & Extra klimmaterieel: welk extra materieel is vereist voor montage dat trap overstijgt? | Automatisch getriggerd als montagehoogte H > 3000 mm | Dropdown [Geen (standaard trap ≤ 3 m) / Hoge ladder of Bordestrap (3–4 m) / Rolsteiger (≥ 4 m) / 2e monteur vereist], default: Geen | Reserveert rolsteiger/materieel in planning, berekent Arbo-toeslag en wijst 2 monteurs toe (§4.8). |
| **21** | Uitvoeringscondities (vensterbank vrij, meubels verplaatst, werkvloer afgedekt)? | Altijd (alle raamdecoratie) | Checkbox [Klant geïnformeerd over vrije werkzone], default: Aangevinkt | Genereert notificatie op afspraakbevestiging voor klant: "Werkzone rondom ramen vrijmaken vóór komst monteur". |
| **22** | Kozijnprofilering & Waterkering (lekrand) bij Horren: opvulprofiel benodigd? | Als productgroep = Insectenwering / Horren | Radio [Vlak kozijn / Kozijn met waterkering (lekrand)], default: Vlak kozijn | Bij aanwezigheid waterkering/lekrand: selecteert automatisch de benodigde opvulprofielen om de hor waterpas en naadloos te laten aansluiten. |
| **23** | Buitendorpel & Vensterbankinspectie bij Horren: vlakheid en afloop gecontroleerd? | Als productgroep = Insectenwering (plisséhordeur of rolhor) | Radio [Vlak en horizontaal / Afschot geconstateerd (schuin)], default: Vlak en horizontaal | Bij afschot: voegt automatisch een schuine onderlat/wigprofiel toe aan de calculatie en werkbon om kieren en scheefstand te voorkomen. |
| **24** | Montagewijze & Plaatsing Horren: In de dag, Op de dag of Stootmontage? | Als productgroep = Insectenwering / Horren | Dropdown [In de dag / Op de dag / Naar stoots (stootmontage)], default: In de dag | Bepaalt de exacte maatvoeringsreducties en de montagesteunkeuze voor de monteur op de werkbon. |
| **25** | Wandverwarming & leidingcontrole bij wandmontage: meldingsplicht klant geverifieerd? | Als montagewijze = Op de wand (wandsteunen) | Checkbox [Wandverwarming en leidingvrijheid gecontroleerd met klant], default: Niet aangevinkt | Verplichte risicoborging ter voorkoming van leidingboringen en waterschade (€ 300,- herstelkosten); legt de meldingsplicht van de klant juridisch vast op het meetrapport (§3.1.7). |
| **26** | Plafondconstructie bij zware producten (houten jaloezieën ≥ 50 mm): massief beton vs gips? | Als montagewijze = Tegen het plafond en (productgewicht > 8 kg of Jaloezieën 50 mm) | Radio [Massief beton (kloptest solide) / Gipsplaat of Hol plafond (achterhout/hollewandankers vereist)], default: Massief beton | Bij gipsplafond zonder achterhout: blokkeert directe zware plafondmontage en dwingt wandmontage of constructieve versteviging af om lostrekken te voorkomen. |
| **27** | Plintinspectie bij doorgang tot op de vloer: tussen de plinten vs tot op de plint? | Als producthoogte H reikt tot vloerniveau | Radio [Vrij van plinten / Tussen de plinten / Tot op de plint / Plint openzagen of inkorten (zaagwerk vereist)], default: Vrij van plinten | Bij 'Tussen de plinten' berekent software maat tussen plinten; bij 'Tot op de plint' zakt product tot bovenzijde plint; bij 'Plint openzagen/inkorten' genereert de software een zaaginstructie voor de monteur én een automatische meerwerkpost voor zaagwerkzaamheden op de order; voorkomt klemmen, scheefstand of ad-hoc zaagverrassingen op de bouwplaats (§3.1.7). |
| **28** | Vloervlakheid & Diagonaalmeting bij Oprolbare Horren: ondergrond 100% waterpas? | Als productgroep = Insectenwering en type = Oprolbare hor | Radio [100% Waterpas & Haaks (D1=D2) / Scheefstand/Afschot geconstateerd (plisséhordeur geadviseerd)], default: 100% Waterpas & Haaks | Nultolerantie-toets; bij > 2 mm verloop op parket/tegels of ruitvormige dagkant waarschuwt het portaal tegen doekblazen en adviseert plisséhordeur (§3.3.4). |

---

#### 3.3.12 Inmeet- en Rekenmatrix: Raamdecoratie & Binnenzonwering

| Productgroep | Primaire Dagmaat (Invoer Inmeter) | Blijvende Maat (Formule & Aftrekregel) | Verplichte Referentie & Validatie | Output naar Productie & Montage |
| :--- | :--- | :--- | :--- | :--- |
| **Duette / Plissé (AU10, AU20, AE20, AS20, EOS)** | Strakste dagmaat breedte op 3 punten (B1, B2, B3) & hoogte op 3 punten (H1, H2, H3); Diagonaal D1/D2 bij kaders | *In de dag:* Blijvende breedte = strakste dagmaat - 8 mm, Hoogte = dagmaat - 0 mm; *Op de dag:* Dagmaat + gewenste overlap (2 × 50-100 mm); *Vleugel/TruFit:* Glasmaat | Glaslatdiepte ≥ 25 mm (in de dag) of vlakke hechtstrook ≥ 15 mm; klinkvrijheid ≥ 25 mm; wand- vs plafondmontage; PowerView accessoire-gating | Fabrieks-productiemaat (blijvende maat op sticker), modelcode EOS (AU10/AU20/AS20 vs AE20 PowerView incl. Pebble en laadkabel), prijsstaffel (10–20 cm intervallen), bedieningszijde, montagesteunen |
| **Horizontale Jaloezieën Aluminium (16, 25, 35, 50, 70 mm)** | Strakste dagmaat breedte (B1, B2, B3) & hoogte (H1, H2, H3); Diagonaal D1/D2 | *In de dag:* Blijvende breedte = strakste dagmaat - 10 mm (5 mm per zijde), Hoogte = dagmaat - 0 mm; *Op de dag:* Dagmaat + gewenste overlap | Pakkethoogte t.o.v. draaiende ramen/deuren; lameldoorloop gekoppelde sets ≤ 12 mm; TDBU alleen bij 25 mm | Productiemaat (mm), lamelbreedte (16/25/35/50/70 mm), pakkethoogte, tuimel-/bedieningszijde, ladderband/-koord |
| **Houten Jaloezieën (50 / 65 mm)** | Strakste dagmaat breedte (B1, B2, B3) & hoogte (H1, H2, H3); Diagonaal D1/D2 | *In de dag:* Blijvende breedte = strakste dagmaat - 10 mm, Hoogte = dagmaat - 0 mm; *Op de dag:* Dagmaat + gewenste overlap | Zwaar gewicht hout; zware bovenbakdiepte (min. 65 mm); pakkethoogtecontrole bij draaiende delen | Productiemaat (mm), houtsoort/kleur, ladderband breedte (25/38 mm), tuimel- en optrekzijde |
| **Rolgordijnen & Duo-Rolgordijnen (met Montageprofiel)** | Strakste dagmaat breedte (B1, B2, B3) & hoogte (H1, H2, H3) | *In de dag:* Systeembreedte = strakste dagmaat - 5 mm (doek ca. 35 mm smaller dan systeem); *Op de dag:* Dagmaat + overlap | Montageprofiel standaard; absorbeert motorkantasymmetrie; doorloop zijgeleiders vloer/plint bij pui | Systeembreedte (mm), doekbreedte (mm), buisdiameter (28/38/50 mm), montageprofiel-type, kettinglengte |
| **Verticale Lamellen (Textiel/Versos, PVC, Aluminium) & Paneelgordijnen** | Strakste dagmaat breedte op 3 punten & hoogte op 3 punten; niscontrole | *In de dag:* Railbreedte = dagmaat - 10 mm; Hoogte = dagmaat minus 15–20 mm vloer-/vensterbankspeling; *Op de dag:* + overlap | Pakketbreedte lamellen/panelen (vrije raamopening); railspoor (2-, 3-, 4- of 5-sporig); lamelbreedte (89/127 mm) | Railmaat (mm), lamelhoogte (mm), pakketzijde (links/rechts/stel), materiaalsoort (textiel/pvc/alu), aantal panelen |
| **Insectenwering (Horren: Inzethorren, Rolhorren & Plisséhorren)** | Dagwerk breedte & hoogte (op de millimeter) | Inzethor: dagmaat sponning (0 mm aftrek). Rolhor & Plisséhor: dagmaat -2 mm voor soepele geleiding | Vlakheid buitendorpel; obstakels (waterkering/lekrand, ventilatieroosters); gaastype | Maatwerk breedte en hoogte (mm), profielkleur, klemveer-type of geleiderprofiel |

##### Aftrekmatrix Insectenwering (Horren) Detail

| Productgroep | Montagepositie | Aftrek Boven | Aftrek Onder | Aftrek Links | Aftrek Rechts | Blijvende Formule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Inzethorren** | Binnen | N.v.t. | N.v.t. | 0 mm | 0 mm | Dagmaat kozijnsponning = Bestelmaat (0 mm speling) |
| **Rolhorren & Plisséhorren** | Binnen | 2 mm | 0 mm | 1 mm | 1 mm | Dagmaat - 2 mm speling op geleiders |

### 3.4 Categorie 3: Vaste Vloerbekleding & Dekvloertechniek

#### 3.4.1 Productsoorten, Rolbreedtes & Legpatronen
* **Zachte Vloeren op Rol (Tapijt & Vinyl):**  
  * *Rolbreedtes Tapijt:* Geleverd op **4 meter én 5 meter breed** (voorkomt onnodige naden bij kamers breder dan 4m).  
  * *Rolbreedtes Vinyl:* Standaard 4 meter breed (optioneel 2 of 3 meter).  
  * *Tapijt op Vloerverwarming (Advies Volvlakkig Verlijmen):* Bij aanwezigheid van vloerverwarming is het traditioneel spannen van tapijt op rubber ondertapijt met spanlatten **volledig uitgesloten**; de ingesloten luchtlaag en de dikte van het ondertapijt isoleren te sterk, waardoor het warmterendement verloren gaat. In situaties met vloerverwarming adviseert het portaal dat het tapijt **volvlakkig verlijmd (geplakt)** moet worden met een geschikte emissiearme dispersielijm met een lage warmtedoorgangsweerstand (`R <= 0,15 m²K/W`).  
  * *Trapbekleding met Ondertapijt (Vast All-in Tarief per Trede):* Bij het bekleden van trappen met tapijt op rubber ondertapijt (zoals Black Pearl) wordt het ondertapijt niet per strekkende meter van een volle rol berekend (wat bij discountformules leidde tot verplichte afname van een complete rol van 7,30 meter voor een trapje van slechts 3 meter). De woninginrichter hanteert een **vast all-in voorraad-tarief per trede** (inclusief benodigd rubber ondertapijt, spuitlijm en arbeidsloon). Omdat ondertapijt en lijm voorraadartikelen zijn, betaalt de klant exact voor het aantal treden zonder restmateriaalverspilling.
* **Marmoleum & Linoleum:**  
  * *Vaste rolbreedte:* 2 meter breed. Natuurproduct op basis van lijnolie, houtmeel en jute rug.  
  * *Thermisch Gelaste Naden:* Bij projectmatige en intensieve particuliere toepassingen worden de naden naadloos afgewerkt met thermisch gelaste naden met bijpassend smeltlasdraad voor 100% vloeistofdichte hygiëne.
* **Harde Vloeren (PVC, Laminaat & Parket):**  
  * *Uitvoeringsvormen:* Dryback (plak-PVC), Click-PVC, Laminaat, en **Lamelparket / Multiplank**.  
  * *Lamelparket & Multiplank:* Meerlaags opgebouwde houten vloerdelen met een watervast verlijmde multiplex of berken drager en een massief eiken toplaag van 3–6 mm. Hoge dimensionale stabiliteit en uitstekend geschikt voor plaatsing op vloerverwarming conform strikte stookprotocolrichtlijnen.  
  * *Legpatronen:* Rechte plank, Visgraat (90°), Hongaarse punt (sergeantstrepen, 45° of 60°), Weense punt (72°), Tegel (met of zonder voegstrips/accentbiezen), Bies & Band afwerking.  
  * *Dilatatienormering:* Bij zwevende dekvloeren en kliksystemen is bij aaneengesloten vloeroppervlakken van meer dan 40 m² of lengtes van meer dan 8 meter een bouwkundige dilatatievoeg met overgangsprofiel verplicht om krimp- en uitzetspanningen op te vangen.
* **Minerale & PU-Gietvloeren:**  
  * Polyurethaan (PU) gietvloeren en minerale cementgebonden gietvloeren (*systemen van o.a. Arturo, Cemart*). Naadloze, vloeistofdichte en elastische afwerkvloeren die een specifieke voorbewerking (schuren, schraaplaag en topsealer) vereisen.
* **Schoonloop- & Entreesystemen:**  
  * **Forbo Coral** en **Emco** hoogwaardige schoonloop- en droogloopzones. Bij nieuwbouw en verbouw bij voorkeur geplaatst in een verzonken matput met verzonken aluminium putrandprofielen voor een drempelloze, vlakke overgang.
* **Kraspreventie & Meubelbescherming:**  
  * **Scratch no More** viltglijders met speciaal droogloopvezelmateriaal voor stoel- en tafelpoten, die krassen door zand en vuil op harde vloeren (PVC, parket, gietvloeren) effectief voorkomen.

#### 3.4.2 Ondervloeren, Egalisatie & Voorbehandeling (Ondergrond, Vocht & Vlakheid)
* **Ondervloeren & Voorbehandeling:**  
  * *Ondervloeren per Volle Rol (Quick-Step Ondervloer):* Ondervloeren (zoals Quick-Step ondervloer van 15 m² per rol) worden in de calculatie en offerte uitsluitend per **volle rol** verkocht (conform de handelspraktijk bij bouwmarkten en groothandels). Het portaal berekent automatisch: `Aantal rollen = ceil(Netto m² / Rolinhoud m²)`. Bijvoorbeeld: bij een oppervlakte van 62 m² berekent het systeem `ceil(62 / 15) = 5 rollen (75 m²)`, met een berekend overschot van 13 m².  
  * *Restmateriaal-Governance bij Oplevering:* De klant betaalt voor de volle rollen en heeft het recht op het restmateriaal. Tijdens de oplevering (Fase 5) stelt de monteur verplicht de kwaliteitsvraag: *"Wilt u het restmateriaal behouden of mogen wij het meenemen?"* Indien de klant het overschot niet wenst, neemt de monteur het mee terug naar het centraal magazijn, waar het wordt ingeboekt als magazijn-reservevoorraad voor kleine herstellingen of serviceklussen (bijv. bij een tekort van 2 meter op een volgende klus).  
  * *Ondervloersystemen:* Drukvaste ondervloeren met geïntegreerd dampscherm (verplicht voor Click-PVC en laminaat ter bescherming van de klikverbinding), rubber ondervloeren en wolvilt (voor tapijt), spaanplaat/jumpax ondervloersystemen, spanlatten.  
  * *Egalisatie & Primers:* **Alle anhydriet- en cementdekvloeren worden altijd standaard geprimerd** vóór egalisatie of verlijming; 1× of 2× projectmatig egaliseren van de dekvloer.
* **Inmeetinstructies Ondergrond & Conditiemeting (Wat meet de inmeter exact?):**  
  De inmeter verifieert de bouwkundige conditie van de ondervloer vóór vrijgave naar planning en stoffering:
  1. *Type dekvloer:* Vaststellen of de constructievloer bestaat uit zandcement, calciumsulfaat (anhydriet), monoliet beton, hout/balklaag of tegelvloer. Alle anhydriet- en cementdekvloeren worden altijd geprimerd.
  2. *Vlakheidsmeting (2-meter rei):* Controleer met een 2-meter aluminium rei en meetspie de vlakheid. Oneffenheden en glooiingen van > 2 mm onder de 2-meter rei vereisen mechanisch schuren en projectegalisatie conform NEN-EN 13813 (klasse NEN-vlakheid voor verlijmd PVC).
  3. *Vochtmeting (Hybride Veldmeting: Capacitieve Screening & CM-Validatie):*  
     * *Niet-destructieve Oppervlaktescreening (Standaard Intake):* De inmeter voert standaard een snelle, niet-destructieve capacitieve strooiveldmeting uit over meerdere representatieve meetpunten van de dekvloer (met name hoeken, gevelzones en koudere plekken): < 40 digit (veilig), 40–70 digit (twijfelzone), > 70 digit (nat/blokkade).
     * *Bindende CM-Meting conform NEN 2741 (Carbid-Methode) bij Direct Verlijmd PVC & Anhydriet:* Voor direct verlijmde vloeren (Dryback PVC) en voor calciumsulfaatgebonden gietvloeren (anhydriet) is de chemische CM-meting conform NEN 2741 juridisch en garantietechnisch doorslaggevend: zandcementdekvloer max. 2,0 CM-% (zonder vloerverwarming) / max. 1,5 CM-% (met vloerverwarming); anhydrietdekvloer max. 0,5 CM-% (zonder vloerverwarming) / max. 0,3 CM-% (met vloerverwarming). Bij overschrijding blokkeert het portaal de montageplanning en wordt automatisch een hermetingsafspraak voorgesteld.
  4. *Algeheel Boorverbod in álle Vloeren:*  
     Op **álle vloeren geldt conform §3.1.7 een absoluut en algeheel boor- en schroefverbod** (ter voorkoming van schade aan vloerverwarming, leidingwerk, nieuwbouwgaranties en betonconstructies). Plinten, overgangsprofielen en deurstoppers worden te allen tijde verlijmd/gekit met montagelijm of MS-polymeerkit. Uitzondering betreft het traditioneel spannen van tapijt met spanlatten, waarbij de controle op leidingvrijheid en vloerverwarming verplicht is conform het SSOT-protocol in §3.1.7.
  5. *Geluidsnormering Harde Vloeren (10 dB VvE-Norm bij Appartementen):*  
     Bij montage op etagevloeren (verdiepingen) in appartementencomplexen geldt conform VvE-reglementen een verplichte contactgeluidreductie van minimaal **ΔLlin ≥ 10 dB** (met officieel certificaat). De vloer moet rondom **volledig vrij liggen van wanden en kozijnen**; elk contact met plinten of muren veroorzaakt akoestische lekken waardoor de 10 dB normering vervalt.
  6. *Vloerverwarming & Opstookprotocol:* Registratie van aanwezigheid vloerverwarming (traditioneel ingestort, infrees-vloerverwarming of elektrische matten) en valideren of het officiële opstook- en afkoelprotocol volledig is doorlopen en ondertekend.

#### 3.4.3 Maatbepaling, Zone-indeling & Vleugrichting
* **Langste Lengte & Breedte:**  
  In tegenstelling tot harde vloeren en raamdecoratie wordt bij tapijt en kamerbreed vinyl altijd de **ruime uiterste zaagmaat** ingemeten. De inmeter meet de langste lengte en langste breedte inclusief alle diepe nissen, convectorputten, deurposten en drempels, en voegt hier standaard **+10 cm marge in totaal** (5 cm rondom) aan toe voor het afsnijden op locatie.
* **Vleugrichting (Poolrichting bij Tapijt/Vinyl):**  
  De richting van de pool bepaalt de lichtreflectie en kleurwaarneming. In aangrenzende ruimtes moet de vleug altijd in dezelfde richting lopen (standaard naar het licht / naar de hoofdentree). De inmeter registreert de vleugrichting met een duidelijke **pijlvector in de grafische interface**.
* **Coupon- en Restantrol Hergebruik:**  
  Bij tapijt- of vinylbanen (standaardrolbreedte 400 cm) berekent de software of afsnijdsels en coupons hergebruikt kunnen worden voor kasten, overlopen of inloopkasten.

#### 3.4.4 Rekenregels & Calculatievoorbeelden Vloerbekleding

##### A. Pakgrootte-afronding (Harde Vloeren: Dryback PVC, Click-PVC, Laminaat, Parket)
Voor harde vloeren geldt deterministische plafond-arithmetiek op basis van netto gemeten oppervlakte, snijverliespercentage en fabrieks-pakinhoud:
$$\text{oppervlakte\_bruto} = \text{oppervlakte\_netto} \times (1 + \text{snijverlies\_percentage})$$
$$\text{aantal\_pakken} = \left\lceil \frac{\text{oppervlakte\_bruto}}{\text{pakinhoud\_m2}} \right\rceil$$
$$\text{oppervlakte\_gefactureerd} = \text{aantal\_pakken} \times \text{pakinhoud\_m2}$$
$$\text{overschot\_m2} = \text{oppervlakte\_gefactureerd} - \text{oppervlakte\_netto}$$

*Snijverlies-percentages conform legpatroon:*
- Wildverband / rechte stroken: $8\% - 10\%$
- Diagonaal gelegd: $12\%$
- Visgraat (90°): $10\% - 15\%$ (standaard $12\%$)
- Hongaarse punt (45° / 60°): $15\% - 18\%$
- Toeslag complexe ruimte (schuine wanden, convectorputten): $+2\% - 5\%$

##### B. Rolbreedte-calculatie (Zachte Vloeren: Kamerbreed Tapijt & Vinyl op 400/500 cm rol)
Bij vloerbedekking op rol wordt gerekend in strekkende meters van de volle rolbreedte (400 cm of 500 cm) inclusief kopse afsnijmarge van $+10\,\text{cm}$ (5 cm rondom) en breedte-afsnijmarge van $+10\,\text{cm}$:
$$\text{snijlengte\_m1} = \frac{\text{ruimtelengte\_mm} + 100}{1000}$$
$$\text{benodigde\_banen} = \left\lceil \frac{\text{ruimtebreedte\_mm} + 100}{\text{rolbreedte\_mm}} \right\rceil$$
$$\text{totaal\_strekkende\_meters} = \text{benodigde\_banen} \times \text{snijlengte\_m1}$$
$$\text{oppervlakte\_gefactureerd} = \text{totaal\_strekkende\_meters} \times \frac{\text{rolbreedte\_mm}}{1000}$$
$$\text{restant\_afsnede\_m2} = \text{oppervlakte\_gefactureerd} - \text{oppervlakte\_netto}$$

##### C. Praktijk- en Calculatievoorbeelden Vloeren
* **Voorbeeld Vloeren (Harde Vloeren - 22 Pakken PVC/Laminaat):**  
  42,0 m² (Netto laseroppervlakte) → +12% snijverlies visgraat (47,04 m²) afgerond op volle pakken à 2,16 m² → **22 pakken (47,52 m²)** (bij standaard wildverband 10%: 42,0 m² × 1,10 = 46,20 m² → 22 pakken à 2,15 m² = 47,30 m²). Overschot = 5,52 m² reserve voor plintuitvulling en nalevering.
* **Voorbeeld Egaline Zandcement Dekvloer:**  
  Gemiddeld verbruik = 1,6 kg per m² per mm laagdikte.  
  Voor 42 m² bij een vereiste egalisatielaag van 3 mm (klasse NEN-EN 13813 voor verlijmd PVC) is benodigd:  
  42 m² × 3 mm × 1,6 kg = 201,6 kg → 201,6 / 25 kg per zak = 8,06 → **9 zakken egaline** + 1 can primer (10 kg à 100 g/m²).

#### 3.4.5 Plinten, Randafwerking, Deurspeling & Deuropeningen (Inclusief 4-Stappenplan)
* **Randafwerkingen & Profielen:**  
  Hoge MDF plinten, plakplinten, overgangsprofielen, dilatatiestrips.
* **Deurspeling & Deurnaad-Inmeting:**  
  De inmeter meet bij alle binnendeuren de vrije ruimte tussen de bestaande dekvloer en de onderzijde van het deurblad.  
  * *Berekening restantspeling:* Vrije deurnaadhoogte minus totale nieuwe vloeropbouw (egalisatielaag 3 mm + lijmbed 1 mm + PVC 2,5 mm = **6,5 mm totale opbouw**; of Click-PVC + ondervloer = **7,0 tot 9,0 mm**).  
  * Indien de resterende speling onder de deur < 4 mm bedraagt, signaleert de software dat de deuren moeten worden ingekort. De inmeter registreert exact het **aantal knelpunten** en het deurtype (opdek vs. stomp).
* **Beleid Deuren Inkorten (Strikte Taakafbakening):**  
  De eigen monteurs van de woninginrichter korten **definitief géén binnendeuren meer in**. Dit beleid is ingesteld om substantiële schaderisico's (zoals het splijten van fineerdeuren, beschadiging van honingraatconstructies of contact met interne stalen stabilisatiestaven) uit te sluiten. De inmeter registreert de noodzaak tot inkorten uitsluitend als **signalerend adviespunt in het inmeetverslag**. De klant draagt zelf zorg voor het inkorten via een aannemer of timmerman.
* **Het 4-Stappenplan Ontbrekende Plinten:**  
  1. *Stap 1: Bestaande Situatie:* Controleren of er bestaande plinten zijn en of deze behouden, overzet- of verwijderd moeten worden.  
  2. *Stap 2: Strekkende Meters Meten:* Meten van alle netto wandlengtes minus kozijnopeningen.  
  3. *Stap 3: Verstek- en Zaagverlies:* Toevoegen van +10% zaagmarge voor binnen- en buitenverstekken.  
  4. *Stap 4: Deuraansluitingen & Diktecontrole:* Afstemmen van de plintdikte (standaard 18 mm vs. renovatie 28 mm) op architraven en deurkozijnen ter voorkoming van uitstekende plintkoppen.
* **Calculatiesystematiek Plinten (2,40m Lengtes & Afrondingsreserve):**  
  * *Standaard Fabriekslengtes:* Plinten worden geleverd in vaste fabriekslengtes van **2,40 meter**.  
  * *Rekenformule in het Portaal:* Op basis van de netto gemeten strekkende meters wandlengte berekent de calculatiemodule direct het benodigde aantal lengtes:  
    `Aantal plinten = ceil(Netto strekkende meters / 2,4) + reserve (minimaal 1 extra lengte)`  
    *Rekenvoorbeeld uit de praktijk:* Bij 13,3 meter plint berekent het systeem: `13,3 / 2,4 = 5,54` lengtes → naar boven afgerond op 6 lengtes, plus minimaal 1 reserveplint → de monteur neemt 7 plinten (of bij een samengestelde order 14 plinten) mee in de bus om zaagverlies en reserve te waarborgen.  
  * *Twee Prijsmodellen:* Het portaal ondersteunt twee afzonderlijke prijsstructuren:  
    1. *Inclusief montage (vast all-in tarief, bijv. € 19,95 per lengte):* Omvat levering, zagen in verstek, montage en afkitten.  
    2. *Exclusief montage:* Zuivere levering van plintlengtes indien de klant of aannemer de montage zelf uitvoert.
* **Deelafspraken Plinten:**  
  Inclusief registratie van de deelafspraak bij ontbrekende plinten (wie levert, zaagt, plaatst en kit/schildert).

#### 3.4.6 Portaal-Inmeetchecklist & Veldinspectie: Vloerbekleding (5 kolommen, 16 inspectiepunten)
De inmeetchecklist voor vloerbekleding structureert alle bouwkundige en technische controles voor een foutloze verlijming of zwevende installatie:

| Nr | Check / Inspectiepunt | Conditie (Wanneer verschijnt dit?) | Veldtype & Default in App | Validatie & Gevolg (Wat doet het portaal?) |
| :---: | :--- | :--- | :--- | :--- |
| **1** | Oude vloer/lijmresten aanwezig; strippen/schuren door klant vs. monteur? | Altijd (alle vloeren) | Radio [Geen (reeds schoon/nieuwbouw) / Klant verwijdert / Monteur verwijdert], default: Geen | Bepaalt schuur- en freesuren; definieert afvalcontainer; berekent slooptoeslag in offerte. |
| **2** | Type dekvloer & hechtsterkte (zandcement, anhydriet, beton, hout)? | Altijd (alle vloeren) | Dropdown [Zandcement / Anhydriet (calciumsulfaat) / Monoliet beton / Houten balkenvloer of Fermacell], default: Zandcement | Selecteert automatisch de juiste primersoort (poreus/zuigend vs calciumsulfaat/dicht) en schuurkorrel (§3.4.2). |
| **3** | Vlakheid dekvloer & egalisatie-noodzaak: voldoet dekvloer aan tolerantienorm (reitest)? | Altijd (alle vloeren) | Radio [Vlak conform norm (< 2 mm onder 2m rei) / Oneffenheden of egalisatie vereist (> 2 mm)], default: Oneffenheden of egalisatie vereist | Oneffenheden > 2 mm activeert verplicht egalisatieadvies (NEN-EN 13813 conform §3.4.2); bij Dryback PVC is egalisatie altijd verplicht. |
| **4** | Restvochtconditie & droogte-akkoord: is restvocht binnen toelaatbare norm? | Altijd (alle vloeren op minerale dekvloer) | Numeriek [Capacitieve indicatiewaarde / CM-%] + Radio [Binnen norm / Te hoog of Droogtijd vereist], default: Binnen norm | Hybride meting: capacitieve screening (<40 veilig, 40-70 caution, >70 nat); bij Dryback PVC/anhydriet CM-meting bindend (zandcement max 2.0/1.5%, anhydriet max 0.5/0.3%); overschrijding blokkeert legplanning (§3.4.2). |
| **5** | Opstook- en afkoelprotocol vloerverwarming doorlopen & afgetekend? | Als vloerverwarming aanwezig = Ja | Radio [Ja (afgetekend aanwezig) / Nee (nog niet doorlopen) / N.v.t.], default: Nee | Zonder getekend opstookprotocol blokkeert het portaal de montageplanning; waarschuwt klant dat fabrieksgarantie vervalt bij overslagen protocol. |
| **6** | Ondergrondconditie & egalisatie-opbouw: poriën, diepe freessleuven of sterke zuiging? | Als egalisatie vereist = Ja of vloertype = Verlijmd PVC (Dryback) | Dropdown [Standaard egalisatie (2–3 mm) / Verzwaard of Dichtsmeren sleuven (min. 3 mm spiegelglad) / Vezelversterkt op hout], default: Standaard egalisatie (2–3 mm) | Berekent automatisch het benodigde aantal zakken egaline (kg/m²) en cans primer op basis van netto m² en gekozen laagdikte (§3.4.2). |
| **7** | Ondervloergeschiktheid & normconformiteit (druksterkte CS ≥ 200 kPa, R ≤ 0,15 m²K/W)? | Als vloertype = Click-PVC of Laminaat | Dropdown [Gecertificeerde hoge densiteit CS ≥ 200 kPa / Standaard schuim (alleen laminaat) / Geïntegreerde onderlaag], default: Gecertificeerde hoge densiteit | Voorkomt uitbreken van klikverbindingen door te zachte ondervloer; toetst R-waarde bij vloerverwarming (§3.4.2). |
| **8** | Algeheel boorverbod vloeren; leidingcontrole bij tapijtspanlatten (nagelen vs montagekit)? | Als vloertype = Tapijt met spijkerlatten op ondertapijt | Radio [Geen leidingen / vloerverwarming in vloer (spijkeren toegestaan) / Leidingen aanwezig (spijkerverbod: latten verlijmen met montagekit)], default: Geen leidingen / vloerverwarming in vloer (spijkeren toegestaan) | Bij leidingen of vloerverwarming: absoluut spijkerverbod ter voorkoming van leidingbreuk; activeert automatische meerprijs voor verlijming van spanlatten met hoogwaardige montagekit (§3.1.7). |
| **9** | 10 dB VvE contactgeluidnorm (alleen bij etagevloeren/appartementen)? | Als type woning = Appartement / Bovenwoning | Radio [Ja (10 dB certificaat verplicht) / Nee (grondgebonden woning)], default: Grondgebonden woning | Bij Ja: filtert ondervloeren uitsluitend op TNO/TÜV 10 dB ΔLlin gecertificeerde producten en genereert VvE-certificaatbijlage bij oplevering. |
| **10** | Legrichting & vleugoriëntatie met klant afgestemd: evenwijdig aan lichtinval? | Altijd (alle vloeren) | Dropdown [In de lengte / Lichtinval volgend / In de breedte / Afgestemd op klantontwerp], default: In de lengte / Lichtinval volgend | Legt bindende legrichting vast op werkbon; voorkomt esthetische discussies en zichtbare naden bij tegenlicht (§3.4.3). |
| **11** | Visgraatindeling & bandsymmetrie gecontroleerd: optische hartlijn en slips > halve strook? | Als legpatroon = Visgraat / Hongaarse punt / Patroonvloer | Checkbox [Hartlijn bepaald; slips > halve strook gegarandeerd], default: Niet aangevinkt | Voegt verplichte uitzet-instructie toe voor monteur; berekent 10–15% extra snijverlies in ordercalculatie (§3.4.4). |
| **12** | Vrije speling deuren: behouden binnendeuren na installatie min. 4–6 mm vrije speling? | Altijd (alle vloeren) | Radio [Voldoende speling (≥ 5 mm) / Deuren klemmen of advies inkorten], default: Voldoende speling | Toetst berekende vloerdikte aan huidige onderruimte deuren; signaleert direct eventuele noodzaak tot deurbewerking via adviserend inmeetrapport (§3.4.5). |
| **13** | Deurinkortingsadvies & afspraak: wie draagt zorg voor het inkorten van de binnendeuren? | Verschijnt als vrije speling deuren = Deuren klemmen of advies inkorten | Numeriek [Aantal deuren te korten] + Dropdown [Klant regelt via timmerman/aannemer / Alleen speling registreren], default: Klant regelt via timmerman/aannemer | Conform het strikte deurenbeleid (§3.4.5) korten eigen monteurs geen deuren in; legt bindende afspraak vast voor de klant en legt noodzakelijke bodemspeling vast (4–6 mm na vloerplaatsing). |
| **14** | Dilatatiedekking plinten: biedt plintdikte (15–18 mm) ruim voldoende dekking over uitzetvoeg? | Als vloertype = Click-PVC of Laminaat (zwevende vloer) | Dropdown [Hoge MDF-plint (15–18 mm dekking) / Plakplint (min. 20 mm) / Muurplint te dun (< 12 mm risico)], default: Hoge MDF-plint (15–18 mm) | Blokkeert plinten < 12 mm bij zwevende vloeren met grote krimp-/uitzetwerking; voorkomt kieren na seizoenswisseling. |
| **15** | Ruimtecomplexiteit & aansnijrisico: plattegrond met veel nissen/hoeken (extra snijverlies)? | Altijd (alle vloeren) | Radio [Rechthoekig / Eenvoudig (5% snijverlies) / Complex met nissen/hoeken (7–10% snijverlies)], default: Rechthoekig / Eenvoudig | Verhoogt de snijverliesfactor in de automatische m²-calculatie om tekorten op de montagedag uit te sluiten (§3.4.4). |
| **16** | Acclimatisatiecondities (pakken 48u horizontaal opslaan bij 18–22 °C)? | Altijd (alle vloeren) | Checkbox [Klant geïnformeerd over acclimatisatie-eisen], default: Aangevinkt | Plaatst waarschuwing op leveringsbon en werkorder; borgt geldigheid fabrieksgarantie m.b.t. krimp en uitzetting. |

---

#### 3.4.7 Inmeet- en Rekenmatrix: Vloerbekleding

| Productgroep | Primaire Dagmaat (Invoer Inmeter) | Blijvende Maat (Formule & Aftrekregel) | Verplichte Referentie & Validatie | Output naar Productie & Montage |
| :--- | :--- | :--- | :--- | :--- |
| **PVC & Laminaat (Dryback, Click, Visgraat)** | Netto m² laser-contourmeting lengte × breedte incl. alle nissen en deuropeningen | Bestelhoeveelheid m² = Netto m² + snijverliestoeslag (Wildverband +10%; Visgraat +12%; Hongaarse/Weense punt +15%; Bies & band +12%), afgerond naar boven op hele pakken (bijv. à 2,16 m²) | Vochtmeting (capacitieve bolmeter / strooiveldmeting), 2m rei vlakheidsmeting (egalisatieklasse), 10 dB VvE-geluidsnorm (etagevloer), algeheel boorverbod (kitten) | Aantal te bestellen pakken PVC/laminaat, zakken egaline (1,6 kg/m²/mm laagdikte), cans primer, strekkende meters plinten (+10%), aantal binnendeuren met advies inkorten (signalering naar aannemer/klant; monteur kort géén deuren in) |
| **Tapijt & Vinyl (Kamerbreed op Rol)** | Uiterste maximale lengte en uiterste breedte per ruimte (inclusief diepste nissen, convectorputten en doorgangen) | Afsnijmaat rol = Langste lengte + 10 cm snijmarge (5 cm rondom); Rolbreedte keuze 400 cm of 500 cm breed | Vleugrichting pijlvector (identiek in alle aansluitende ruimtes), coupon- en restantrol hergebruik voor overlopen/kasten, algeheel boorverbod (profielen kitten) | Rolafsnede (strekkende meters op 400/500 cm rol), m² ondertapijt / rubber vilt, strekkende meters spanlatten, overgangsprofielen |

---

### 3.5 Categorie 4: Trapbekleding, Traprenovatie & Trapelementen

#### 3.5.1 Trapvormen, Bekledingssystemen & Producten
* **Toepassingen & Vormen:**  
  Dichte trap, open trap, rechte steektrap, trappen met draaiing (*onderkwart, bovenkwart, dubbele kwartslag / tweekwart*) en bordestrappen.
* **Producten & Bekledingsvormen:**  
  * *Traditionele Trapstoffering (Tapijt op de Trap):*  
    * Rondom bekleden/inpakken van open treden of bekleden van dichte treden met stootborden.  
    * Wangen bekleden (optioneel 1 of 2 zijden).
  * *Cortex Composiet Traprenovatie (Exclusief High-End Systeem):*  
    * *Materiaal & Constructie:* Massieve composiet overzettreden met naadloos doorlopende, afgeronde trapneus (geen losse aluminium of kunststof trapneusprofielen nodig) en bijpassende of contrasterende stootborden.  
    * *Verlijming:* Rechtstreeks volvlaks verlijmd op de bestaande trapconstructie met extreem sterke high-tack polymeermontagelijm (*mammoetlijm*).  
    * *LED-Verlichting & Bewegingssensoren:* Optionele geïntegreerde LED-strips in trede of wang met afstandsbediening én automatische bewegingssensoren bij begin (onder) en einde (boven) van de trap, waardoor de verlichting automatisch inschakelt bij betreden.  
  * *Accessoires:* Trapneusprofielen, antislipstrips.
* **Trapwangen, Balustrades & Trapleuningen:**  
  * *Trapwangen:* Wangen bekleden in bijpassend CPL/vinyl of contrasterend geschilderd/gecoat (RAL 9010 of RAL 9005).  
  * *Balustrades & Spijlen:* Traphekken en balustrades met moderne ranke stalen spijlen (poedercoating RAL 9005 matzwart fijnstructuur).  
  * *Trapleuningen met LED-verlichting:* Ronde of rechthoekige trapleuningen in massief eiken of zwart staal met optioneel geïntegreerde diffuse LED-lijn aan de onderzijde van de leuning.
* **Vakdiscipline:** Vereist een gespecialiseerde en schaarse vakdiscipline stofferen/traprenovatie (slechts 1-2 monteurs per vestiging).

---

#### 3.5.2 Inmeetmethodiek Trap & Afmetingen
* **Rechte Treden (Ontwikkelde Maat):**  
  De inmeter meet 1 representatieve rechte trede integraal: vanaf de aansluiting onder het stootbord, over de aantrede, om de trapneus heen en inclusief de optrede (totale ontwikkelde maat, bijv. 48 cm of 55 cm).  
  Ontwikkelde Trede-afmeting = Aantrede (horizontaal loopvlak) + Optrede (verticale hoogte) + Neusoversteek + 5 cm stofmarge  
  Totale behoefte rechte treden = Ontwikkelde maat × Aantal rechte treden.
* **Verdreven Treden (Draaiing / Kwartslag):**  
  Bij verdreven treden varieert de breedte en diepte van de binnenspil naar de buitenboom. De inmeter meet altijd de **grootste maat aan de buitenzijde** (buitenbocht) plus 5 cm marge. Totale behoefte = Grootste ontwikkelde maat × Aantal verdreven treden.
* **Radiaal Meedraaiende Vleug:**  
  Bij tapijtbekleding op trappen moet de poolrichting altijd van boven naar beneden over de trede aflopen (met de looprichting mee). Bij verdreven treden moet het tapijt radiaal meedraaien met de bocht; banen worden trapsgewijs schuin gesneden.
* **Wel-trede Portaalvlakheid:**  
  De bovenste trede (de wel-trede) sluit direct aan op de vloer van de overloop. De inmeter controleert de hoogtegelijkheid tussen wel-trede en afwerkvloer; hoogteverschil > 3 mm vereist een overgangsprofiel of egalisatie van het portaal.

#### 3.5.3 Rekenregels, Bill-of-Materials (BOM) & Kwantificering Trapbekleding (Dual-Layer Specificatie)

##### A. Traplopers (Sisal / Wol / Flatweave)
**Laag 1: In gewone mensentaal voor adviseurs en trapstoffeerders:**  
Een traploper is een gecentreerde tapijtloper op een houten of geschilderde trap. Om de exacte loperlengte en bandering te bepalen, hanteren we een helder stappenplan:  
* *Stap 1 (Trapmaten optellen):* Meet voor elke trede het horizontale loopvlak (de aantrede), de verticale opstap (de optrede) en het vooroverstekende randje (de trapneus). Tel al deze maten van alle treden bij elkaar op.  
* *Stap 2 (Plooispeling toevoegen):* Omdat de loper strak in de hoek van de trede gedreven wordt en om de trapneus vouwt, telt het atelier **2 cm extra speling per trede** op voor de plooiing en het strakspannen.  
* *Stap 3 (Kopse reserve toevoegen):* Aan het begin onderaan de trap en bij de beëindiging bovenaan is extra loperstof nodig om de loper netjes om te vouwen en onzichtbaar vast te nieten. We tellen hiervoor standaard **30 cm vaste reserve** op bij het totaal.  
* *Stap 4 (Bandering berekenen):* De loper wordt aan beide zijkanten afgewerkt met katoenen of linnen band. De benodigde bandlengte is eenvoudigweg **twee keer de totale loperlengte** (linkerkant + rechterkant).  
* *Stap 5 (Bevestigingsmaterialen):* Voor elke trede is 1 metalen traploperroede nodig, met aan weerszijden een bevestigingsoog (dus 2 roedeklemmen per trede).  

**Laag 2: Formele wiskundige specificatie voor ERP & bestelsystemen:**  
* **Breedte loper:** Standaard 60, 70, 80, 90 of 100 cm.  
* **Vrije trapwang-marge:** $(\text{trapbreedte} - \text{loperbreedte}) / 2$, aan beide zijden identiek gecentreerd.  
* **Totale Lengte loper ($L_{\text{lopertotaal}}$):**  
  $$L_{\text{lopertotaal}} = \sum_{i=1}^{N_{\text{treden}}} (\text{aantrede}_i + \text{optrede}_i + \text{neusoversteek}_i) + (N_{\text{treden}} \times 2\,\text{cm extra voor plooi}) + 30\,\text{cm reserve}$$  
* **Afwerking randen (Bandering over dubbele lengte):**  
  $$\text{lengte\_bandering} = 2 \times L_{\text{lopertotaal}}\,\text{meter}$$  
* **Bevestigingsmaterialen & BOM Traploper:**  
  - Traploperroedes: 1 roede per trede (metaal: messing, chroom, nikkel, matzwart).  
  - Roedeklemmen / oogjes: $2 \times N_{\text{treden}}$ stuks (links en rechts van de loper).  
  - Ondertapijt stroken (rubber/vilt): 1 strook per aantrede/optrede ter geluiddemping en slijtagepreventie.  

##### B. PVC Overzettreden & Traprenovatie (Coretec / Belakos / Trenovo / Cortex)
**Laag 1: In gewone mensentaal voor calculators en montageteams:**  
Traprenovatie met harde overzettreden kent strikte verpakkingseenheden die altijd naar boven moeten worden afgerond op volle verpakkingen:  
* *Rechte treden (Volle dozen à 4 stuks):* Rechte overzettreden worden door de fabrikant uitsluitend per **volle doos van 4 stuks** geleverd. Heeft een trap bijvoorbeeld 9 rechte treden? Dan delen we $9 / 4 = 2{,}25$ en ronden dit altijd naar boven af: er moeten **3 volle dozen** besteld worden (12 treden, waarvan 3 rest/zaagreserve).  
* *Verdreven draaitreden (XL-kits à 2 stuks):* Schuine draaitreden in de bocht van de trap zijn breder en dieper en worden geleverd in **XL-sets van 2 stuks**. Voor bijvoorbeeld 4 verdreven treden zijn $4 / 2 = \mathbf{2\text{ kits}}$ nodig; bij 5 verdreven treden $5 / 2 = 2{,}5 \to \mathbf{3\text{ kits}}$ (6 treden).  
* *Stootborden:* Voor elke trede is exact 1 stootbord nodig (plus eventueel 1 extra voor de aansluiting met de overloop).  
* *Montagelijm (Mammoetlijm verbruik):* Overzettreden worden volvlaks verlijmd met extreem sterke High-Tack elastische montagelijm (*Mammoetlijm*). De vuistregel is: **1 koker à 290 ml per 2,5 treden**. Voor een trap van 13 treden is dit $13 / 2{,}5 = 5{,}2$, wat naar boven wordt afgerond op **6 kokers**. De monteur grijpt zo nooit mis.  

**Laag 2: Formele wiskundige specificatie voor ERP & magazijnbeheer:**  
* **Rechte treden (Doos à 4 stuks, $100 \times 30\,\text{cm}$ of $100 \times 38\,\text{cm}$):**  
  $$\text{dozen\_recht} = \left\lceil \frac{N_{\text{recht}}}{4} \right\rceil$$  
* **Verdreven treden (XL-kits à 2 stuks, $130 \times 40\,\text{cm}$ of $140 \times 45\,\text{cm}$):**  
  $$\text{kits\_verdreven} = \left\lceil \frac{N_{\text{verdreven}}}{2} \right\rceil$$  
* **Stootborden:** 1 stootbord per trede ($N_{\text{stootborden}} = N_{\text{treden}}$) plus optioneel 1 wel-trede stootbord bij aansluiting overloop.  
* **Kantprofielen & Trapwangen:** U-profielen of aluminium afdekkappen voor zijkanten bij open trap; afdeklijsten voor trapwangen.  
* **High-Tack Polymeerkit (Mammoetlijm norm 1 koker per 2,5 treden):**  
  $$\text{kokers\_mammoetlijm} = \left\lceil \frac{N_{\text{treden}}}{2{,}5} \right\rceil$$  
* **Geïntegreerde LED-verlichting (Optioneel):** $N_{\text{treden}}$ stuks LED-strips, 1 centrale transformator/controller (230V $\to$ 24V), en 2 automatische bewegingssensoren (onderste en bovenste trede).

* **Voorbeeld Trapbekleding Tapijt (Rechte & Verdreven Treden):**  
  (10 rechte treden × 0,48 m) + (4 verdreven draaitreden × 0,62 m grootste ontwikkelde maat) = **7,28 strekkende meter tapijtstrook** → Uitsnijden met meedraaiende radiale vleugrichting per trede.  
  *Bij dichte trap met 9 rechte treden, 4 verdreven treden en 13 stootborden:* (9 × 55 cm) + (4 × 65 cm) + (13 × 20 cm) + 50 cm = 10,65 strekkende meter loper (gesneden uit 2,70 m van een 400 cm rol). Bandering: $(2 \times 10{,}65) + 0{,}40 = 21{,}70\,\text{m}^1$ katoenen band. Roedes: 9 stuks op de rechte treden, 18 klemmen.

#### 3.5.4 Traprenovatie Overzettreden & Digitalisering
* **Inmeetinstructies Traprenovatie Overzettreden (Wat meet de inmeter exact?):**  
  Bij harde traprenovatie (Cortex, CPL/HPL) worden overzettreden volvlaks verlijmd over de bestaande treden. De inmeter inspecteert en meet de volgende bouwkundige parameters:
  1. *Trapneusprofiel & Overstek:* Controleer de vorm van de bestaande trapneus (recht, rond of geprofileerd). Indien de neus te ver oversteekt of aan de onderzijde hol is, moet de neus worden afgezaagd of aan de onderzijde worden uitgevuld met opvulstroken zodat een strakke, haakse hoek ontstaat voor het nieuwe stootbord.
  2. *Individuele Tredecontouren:* Elke trede verschilt qua hoekverdraaiing en diepte tussen binnenspil en buitenboom.
  3. *Wel-trede Portaalvlakheid:* Controleer het niveauverschil tussen de wel-trede (bovenste trede) en de afwerkvloer van de overloop. Een hoogteverschil > 3 mm vereist een overgangs-uitloopprofiel of egalisatie van de overloop.
  4. *Open vs. Dichte Trapuitvoering:* Bij een open trap worden rondom doorlopende overzet-kappen (U-vormige treden) toegepast; bij een dichte trap wordt elke overzettrede gecombineerd met een bijpassend of wit stootbord.
  5. *LED-Verlichting & Elektra:* Controleer de aanwezigheid van een 230V voedingspunt (wandcontactdoos onder de trapkast of bij de overloop). Bepaal de freespositie voor geïntegreerde LED-lijnen onder de neus en de inbouwlocaties van de automatische bewegingssensoren in het onderste en bovenste stootbord.
* **Optische Marker-Inmeting (Fotogrammetrie t.b.v. Cortex Traprenovatie):**  
  Voor massieve Cortex composiet overzettreden worden 4 gekalibreerde optische markers op de hoekpunten van elke individuele trede geplaatst en met de tabletcamera gefotografeerd. De software berekent direct de millimeter-exacte 3D vector-contour en exporteert dit als geautomatiseerd snijbestand voor de CNC-freesmachine in de fabriek.
* **Kostenafweging Digitalisering vs. Fabrieksinmeter:**  
  De inzet van digitale sjablonen bespaart de externe kosten van een gespecialiseerde fabrieksinmeter (standaard **€150 toeslag per trap**). De eigen woninginrichter meet de trap zelfstandig in en behoudt de regie over planning en marge.

#### 3.5.5 Portaal-Inmeetchecklist & Veldinspectie: Trapbekleding & Traprenovatie (5 kolommen, 13 inspectiepunten)
De inmeetchecklist voor trappen borgt zowel traditionele stoffering als moderne overzettrede-renovatie via een strakke portaal-workflow:

| Nr | Check / Inspectiepunt | Conditie (Wanneer verschijnt dit?) | Veldtype & Default in App | Validatie & Gevolg (Wat doet het portaal?) |
| :---: | :--- | :--- | :--- | :--- |
| **1** | Oude trapbekleding & lijmresten (verwijderd, gevlakt, schroeven verzinkt)? | Altijd (alle trappen) | Radio [Kaal & lijmvrij (door klant) / Oude bekleding nog aanwezig (verwijderen door monteur) / Schoon opgeleverd], default: Kaal & lijmvrij | Indien verwijderen door monteur: berekent schuurwerk, lijmverwijdering en afvalkosten in werkorder. |
| **2** | Trede-stabiliteit & kraakvrijheid (krakende treden constructief schroeven)? | Altijd (alle trappen) | Radio [Trap stabiel & kraakvrij / Krakende treden aanwezig (vastschroeven vereist)], default: Trap stabiel & kraakvrij | Indien krakend: voegt stel- en schroefuren toe op de werkbon; vastzetten van losse treden vóór montage voorkomt latere schade. |
| **3** | Trapconstructie: Dichte trap (met stootborden) vs. Open trap (rondom)? | Altijd (alle trappen) | Dropdown [Dichte trap (treden + stootborden) / Open trap (treden rondom bekleden) / Open trap (alleen bovenzijde)], default: Dichte trap | Bepaalt of achterzijde treden en contra-profielen worden berekend in materiaalbehoefte en montagetijd (§3.5.1). |
| **4** | Trapneusprofiel & haaksheid: trapneus zuiver haaks of bouwkundig uitvullen? | Als productgroep = Traprenovatie (overzettreden) | Radio [Reeds haaks / vlak / Afzagen trapneus vereist / Uitvullen met latten vereist], default: Afzagen trapneus vereist | Overzetstootbord vereist een haakse, vlakke trapneus; registreert zaag- of uitvuluren en materialen op werkbon (§3.5.4). |
| **5** | Aansluiting wel-trede & verdiepingsvloer: sluit bovenste trede vlak aan (≤ 3 mm)? | Altijd (alle trappen) | Radio [Vlakke aansluiting (afwijking ≤ 3 mm) / Hoogteverschil aanwezig (> 3 mm, uitvullen vereist)], default: Vlakke aansluiting | Afwijking > 3 mm vereist uitvullen / egaliseren van de wel-trede en voegt een egalisatiepost en speciaal overgangsprofiel toe (§3.5.2/§3.5.4). |
| **6** | Ondertapijt en spijkerlatten geverifieerd (akoestische demping en slijtvastheid)? | Als productgroep = Traditionele Trapstoffering (Tapijt) | Radio [Ja (ondertapijt + spanlatten toepassen) / Nee (rechtstreeks verlijmen)], default: Ja | Activeert rubber ondertapijt en spanlatten in calculatie en werkbon (§3.5.2). |
| **7** | 4 optische markers per trede geplaatst en gefotografeerd voor 3D-scan? | Als productgroep = Cortex Traprenovatie (digitale fotogrammetrie) | Foto-upload [Minimaal 1 foto per trede met 4 zichtbare markers], default: Geen bestanden | Portaal valideert aanwezigheid foto's voor alle treden; exporteert geautomatiseerde CNC-freesbestanden naar fabriek (§3.5.4). |
| **8** | Trede-ondergrond & lijmhechting: trede-oppervlak schoon, ontvet en ontstoft? | Als productgroep = Traprenovatie (overzettreden) | Checkbox [Treden schoon en ontvet; primer akkoord], default: Niet aangevinkt | Berekent automatisch het aantal kokers montagelijm (MS-polymeerkit, ca. 1 koker per 2 treden) op basis van het tredeaantal (§3.5.4). |
| **9** | Vleugloop bij draaiende treden gecontroleerd: loopt vleug uniform omlaag? | Als productgroep = Traditionele Trapstoffering (Tapijt) | Checkbox [Vleugrichting uniform van boven naar beneden aflopend], default: Niet aangevinkt | Voorkomt kleur- en vleugverschil tussen trapdelen; instructie op snijplan (§3.5.2). |
| **10** | Inspectie open zijkanten & kopse kanten: afwerking met kantenband/contraprofiel? | Als trapconstructie = Open trap of trede met open zijkant | Radio [Geen open zijkanten / 1 zijde open / 2 zijden open] + Dropdown [Kantenband / Aluminium profiel / Overzetkapje], default: Geen open zijkanten | Berekent strekkende meters afwerkprofiel/kantenband op basis van aantal open treden en voegt artikel toe aan bestelling. |
| **11** | 230V stroompunt aanwezig onder de trap voor LED-transformator? | Als optie = LED-verlichting in stootborden / traptreden | Radio [230V stroompunt aanwezig onder trap / Nog aan te leggen door elektricien], default: 230V stroompunt aanwezig | Blokkade: Geen stroompunt aanwezig vereist elektricien-order vóór montagedag; vermeldt waarschuwing op orderbevestiging. |
| **12** | Sensorposities & kabeltraject trapverlichting: posities visueel getoetst? | Als optie = LED-verlichting in stootborden / traptreden | Checkbox [Sensorposities en kabeltraject in wang visueel goedgekeurd], default: Niet aangevinkt | Bepaalt boorposities voor automatische trapverlichting; stuurt kabeltraject in trapwang aan op de werkbon. |
| **13** | Antislipvoorziening & beloopbaarheid: strip gespecificeerd en droogprotocol? | Altijd (alle traprenovaties en trapstofferingen) | Dropdown [Geïntegreerde rubber antislipstrip / Freesprofiel / Geen antislip (glad)], default: Geïntegreerde rubber antislipstrip | Selecteert antislip-inleg op bestelling; genereert verplichte opleverinstructie voor klant: 24 uur na montage niet zwaar belasten i.v.m. lijmuitharding. |

---

#### 3.5.6 Inmeet- en Rekenmatrix: Trapbekleding & Traprenovatie

| Productgroep | Primaire Dagmaat (Invoer Inmeter) | Blijvende Maat (Formule & Aftrekregel) | Verplichte Referentie & Validatie | Output naar Productie & Montage |
| :--- | :--- | :--- | :--- | :--- |
| **Traditionele Trapstoffering (Tapijt & Loper)** | Aantal rechte treden × ontwikkelde maat (aantrede + optrede + neus + 5 cm); Aantal verdreven treden × grootste ontwikkelde maat buitenzijde (+ 5 cm); Aantal stootborden × hoogte (+ 3 cm); Wangmaten (1 of 2 zijden) | Totale lengte tapijtstrook = Som ontwikkelde treden + som stootborden + 50 cm snijreserve (gesneden uit 400 cm rol) | Radiaal meedraaiende vleugrichting (pool altijd van boven naar beneden aflopend over de trede), staat van stootborden/wangen, trapkraakverhelping | Strekkende meters loper/tapijtstrook, m² rubber ondertapijt / spanlatten, trapneuzen / profielen, specialistische stoffeer-montagetijd |
| **Cortex Traprenovatie (Composiet Overzettreden)** | Digitale fotogrammetrie / optische markers (4 per trede) via tabletcamera voor alle treden, stootborden en wel-trede | Directe millimeter-exacte 3D vector-contour per trede (CNC freesbestand voor fabriek) | Trapneusoverstek controle (afzagen vs uitvullen), wel-trede portaalvlakheid ≤ 3 mm, 230V stroompunt t.b.v. LED-sensoren | CNC freesbestanden overzettreden, stootborden, mammoetlijm polymeer kokers, LED-sets incl. bewegingssensoren, afdeklijsten |

---

### 3.6 Categorie 5: Buitenzonwering, Gevelsystemen & Rolluiken

#### 3.6.1 Productassortiment & Toepassingen (V1 MVP Scope & V2 Backlog)
Buitenzonwering, Gevelsystemen & Buitenleven vormt een volwaardige kernproductgroep binnen het integrale assortimentsmodel van EasyM2M. Voor de initiële Versie 1 (V1 MVP) Scope geldt op basis van de historische verkoopdata van de afgelopen twee jaar dat de operationele focus ligt op Knikarmschermen, Ritsscreens, Buitenleven en Markiezen; **Rolluiken vallen buiten de V1 MVP scope en zijn gealloceerd naar de V2 Backlog**. De technische productspecificaties, materialen en normeringen van zowel de actieve V1 producten als de V2 rolluiken zijn hieronder integraal gedocumenteerd als Single Source of Truth:
1. **Knikarmschermen (Terrasschermen):** Twee- of meerarmige doekschermen met een uitval van 2,50 tot 4,00 meter en breedtes tot 7,00 meter per deel.
2. **Ritsscreens (ZIP-screens):** Windvaste vlakschermen voorzien van een ritsgeleidingssysteem in aluminium zijgeleiders; fungeren tevens als insectenwering. Gecertificeerd conform **Windklasse 6** volgens **NEN-EN 13561** (bestand tegen zware storm tot 10 Beaufort).
3. **Buitenleven & Terrasoverkappingen:**
   * *Lamellendaken:* Luxe aluminium lamellendaken (**Brustor B200**) met kantelbare lamellen voor variabele zonwering, ventilatie en waterdichte afsluiting met geïntegreerde waterafvoer in de aluminium staanders.
   * *Glazen Schuifwanden:* Meersporen glazen schuifwanden met **10 mm ESG** gehard veiligheidsglas op aluminium looprails met tochtborstels en optionele meenemers.
   * *Terrasverwarming & Comfort:* Hoogwaardige infraroodstralers van **Solamagic** of **Bromic** (korte golf IR-A, vermogen 1500–2500W per element).
4. **Markiezen:** Traditionele houten of aluminium kapconstructies voor klassieke gevels en horeca.
5. **3.6.1 Rolluiken (Voorzet-, Opbouw- & Inbouwsystemen — V2 Backlog & Roadmap):**  
   Beveiligende, isolerende en verduisterende aluminium lamellenpantsers (dubbelwandig gerold aluminium met CFK-vrij PU-schuim).  
   * *Kastmaten & Vormen:* Gestandaardiseerde kastmaten 137 mm, 150 mm, 165 mm, 180 mm en 205 mm; leverbaar in 45° afgeschuind (`45_graden`), rond of half-rond.  
   * *Aandrijving & Zonne-energie:* Somfy io 230V bedraad of 100% autonoom Solar met **Somfy Oximo Solar io** motor, interne **LiFePO4** lithium-accu en monokristallijn zonnepaneel op de cassette (geen geveldoorboring benodigd).  
   * *Inbraakwerendheid:* Gecertificeerd conform **RC2** en **RC3** (**NEN-EN 1627**), voorzien van automatische optilbeveiliging (veerconsoles / starre verbinders).

#### 3.6.2 Constructieve Inmeetparameters & Veiligheidsnormen (NEN-EN 13561, NEN 2608 & NEN-EN 1627)
* **Gevelbelasting & Windklasse (NEN-EN 13561):** Conform de Europese norm **NEN-EN 13561** moeten knikarmschermen en ritsscreens bestand zijn tegen specifieke windbelastingen: Windklasse 1 t/m 6 (ritsscreens klasse 6 bestand tot windkracht 10 Beaufort / zware storm).
* **Inbraakwerendheid & Beveiliging (NEN-EN 1627):** Rolluiken worden optioneel uitgerust met weerstandsklasse **RC2** of **RC3** conform **NEN-EN 1627**, voorzien van versterkte geleiders en optilbeveiliging.
* **Valbeveiliging bij Verdiepingshoge Puien (NEN 2608 / NEN-EN 1991-1-1):** Bij verdiepingshoge ramen fungeert de ritsscreenconstructie conform **NEN 2608** als fysieke doorvalbeveiliging.
* **Metselwerk- & Latei-inspectie:**
  * *Metselwerk:* De inmeter inspecteert de staat van de gevelstenen en voegwerk. Bij kalkzandsteen, holle snelbouwsteen of gevelisolatie is verankering uitsluitend toegestaan met **chemische ankers (zeefhulzen + injectiemortel)** en draadeinden M10/M12.
  * *Latei / Rollagen:* Direct boren in dragende betonnen lateien boven ramen is alleen toegestaan na verificatie van de wapeningsdiepte; boren in losse rollagen is ten strengste verboden.
* **Afstandsbussen bij Gevelisolatie (ETICS):** Bij buitengevels met isolatie en stucwerk berekent het portaal automatisch de benodigde stalen drukvaste afstandsbussen om de klemkracht direct op de dragende achterconstructie over te brengen zonder isolatiedeuking.

#### 3.6.3 Elektrische Aansluiting & Automatisering
* **230V Doorvoer & Voedingspunt:** De inmeter registreert de exacte positie van het 230V voedingspunt (binnen of buiten) en bepaalt het veilige boorgat voor de kabeldoorvoer (onder afschot naar buiten boren ter voorkoming van inwaterend regenwater).
* **Solar-Motoren (Zonne-energie op Accu):** Optioneel leverbaar met geïntegreerd zonnepaneel op de cassette en interne LiFePO4 lithium-accu; hierbij is géén kabeldoorvoer naar binnen of 230V netaansluiting vereist (100% draadloze montage).
* **Motoren & Sensoren:** Standaard uitgerust met Somfy io-homecontrol of vergelijkbare radiogestuurde motoren, gecombineerd met draadloze zonsensoren en een automatische **windbeveiliging (trillingssensor / Eolis 3D WireFree)** die het scherm bij plotselinge windvlagen automatisch intrekt.

#### 3.6.4 Inmeet- en Rekenmatrix: Buitenzonwering & Gevelsystemen

| Productgroep | Primaire Dagmaat (Invoer Inmeter) | Blijvende Maat (Formule & Aftrekregel) | Verplichte Referentie & Validatie | Output naar Productie & Montage |
| :--- | :--- | :--- | :--- | :--- |
| **Knikarmscherm (Terras)** | Breedte gevelzone (mm) & Gewenste uitval (mm); Montagehoogte bovenkant cassette | Blijvende breedte = Gekozen cassettebreedte; Vrije doorloophoogte bij maximale uitval ≥ 2000 mm | Geveltype (massief vs spouw), latei-inspectie, chemische ankers M12, 230V voedingszijde | Cassettebreedte (mm), uitval (mm), doekdessin, motorzijde (L/R), muursteunposities, afstandsbussen |
| **Ritsscreen (ZIP-screen)** | Dagmaat kozijn breedte (B1..B3) & hoogte (H1..H3) | *Op de dag:* Breedte = Dagmaat + 2 × geleiderbreedte (2 × 35 mm); *In de dag:* Breedte = Strakste dagmaat - 5 mm | Haaksheid dagkant (D1/D2 ≤ 3 mm), afschot buitendorpel, kabeldoorvoerlocatie, windklasse (1..6) conform NEN-EN 13561, valbeveiliging NEN 2608 | Kastmaat (85/95/105/125 mm), geleidertype, doektype (Serge 1% of 5%), zender / schakelaar |
| **Rolluik Aluminium (Voorzet/Opbouw)** | Dagmaat breedte (B1..B3) & hoogte (H1..H3) | *Op de dag:* Breedte = Dagmaat + 2 × kastgeleider (2 × 53 mm); *In de dag:* Breedte = Strakste dagmaat - 5 mm | Klink- en waterslagvrijheid, rolluikkastafmeting (137, 150, 165, 180, 205 mm) t.o.v. bovendorpel, RC2/RC3 NEN-EN 1627 met optilbeveiliging | Blijvende breedte en hoogte, lameltype, kastafschuining (45° / 45_graden of rond), bediening (Somfy io / Solar LiFePO4) |

---

### 3.7 Categorie 6: Diensten, Montage & Montagelogistiek

> **MVP-Afbakening & Arbeidscalculatie:**  
> Conform het architectuurbesluit in §1.1 en §2.8 worden loontarieven, urennormen en montagetijdscalculaties in de EasyM2M MVP handmatig ingevoerd of verwerkt in het externe ERP (LogicTrade / AFAS). Paragraaf 3.7 definieert de **technische inmeet- en schouwparameters** die door de inmeter op locatie worden vastgesteld voor een veilige, haalbare montage en logistieke voorbereiding conform het canonieke 9-productgroepen stelsel (6.1 t/m 6.9).

#### 3.7.1 Gordijnconfectie & Gordijnrailmontage (Cat 1)
* **Atelierconfectie:** Confectioneren van gordijnen, inbetweens en vitrages per baan of strekkende meter (enkele plooi, dubbele/vlinderplooi, wave-plooi 60/80 mm).
* **Railmontage:** Monteren van aluminium gordijnrails (Wepro, Stas, KS), roedes en binnenloopsystemen aan wand of plafond; buigen van bochten; draperen en afhangen van gordijnen per m¹.
* **Elektrische Aandrijving:** Plaatsen en afstellen van 230V/accugevoede railmotoren (Somfy Glydea, MotionBlinds).

#### 3.7.2 Binnenzonwering- & Horrenmontage (Cat 2)
* **Kozijnmontage:** Vakkundige montage van Duette®, plissés, jaloezieën, rolgordijnen en vouwgordijnen conform NEN-EN 13120 (kindveiligheid).
* **Boorvrije Montagesystemen:** Plaatsen van EasyClick, TruFit en PerfectFit kaders via magneetband of klemsteunen op aluminium en kunststof draai-kiepramen zonder kozijnbeschadiging.
* **Insectenwering & Horren:** Inmeten en monteren van vaste inzethorren, rolhorren, plissé hordeuren en voorzethorren.

#### 3.7.3 Vloeren Legservice & Randafwerking (Cat 3)
* **Vloerinstallatie:** Ambachtelijk leggen van Dryback PVC (stroken en visgraatverband incl. walsen met 50 kg wals), Click-PVC, laminaat, marmoleum en vinyl; volvlaks verlijmen of spannen van kamerbreed tapijt op ondertapijt.
* **Ondervloeren:** Uitrollen en afplakken van akoestische en drukvaste ondervloeren (10 dB $\Delta L_{\text{lin}}$ / 21 dB $\Delta L_w$ contactgeluidreductie).
* **Randafwerking:** Verstek zagen en verlijmen van hoge MDF-plinten (68/90/120 mm), afkitten met acrylaatkit aan wandzijde en overschilderbare polymeerkit aan vloerzijde per m¹; plaatsen van plakplinten en dilatatieprofielen.

#### 3.7.4 Trapbekleding & Traprenovatie Montage (Cat 4)
* **Trapstoffering met Tapijt:** Bekleden van dichte of open trappen (12 tot 16 treden) met tapijt, trapmatten of traplopers inclusief roedes; stofferen van stootborden en zijkanten (trapwangen).
* **Traprenovatie met Overzettreden:** Vakkundig zagen, kalibreren en verlijmen van PVC- of laminaat-overzettreden met elastische MS-polymeerlijm; monteren van geïntegreerde aluminium neusprofielen en uitlooptreden aansluitend op overloopvloer.
* **Accessoires:** Uitfrezen en aansluiten van geïntegreerde LED-treeverlichting en monteren van trapleuningen.

#### 3.7.5 Buitenzonwering & Gevelmontage (Cat 5)
* **Gevelmontage & Verankering:** Chemische ankerverankering (M10/M12 injectiemortel) van knikarmschermen, ritsscreens en rolluiken aan de buitengevel conform NEN-EN 13561 (Windklasse 6) en NEN 2608.
* **Elektrotechnische Aansluiting:** Boren van kabeldoorvoeren, aansluiten van 230V motoren (Somfy io), monteren van zon/wind-automaten en inleren van afstandsbedieningen/app-sturing.

#### 3.7.6 Inmeting, Bouwkundige Schouw & Technisch Advies
* **3D Laser-inmeting:** Digitale opmeting van breedte, hoogte, dagmaten, kozijndieptes en haaksheid van raam- en vloeroppervlakken.
* **Bouwfysische Schouw Dekvloer:** CM-vochtmeting conform NEN 2741 (max. 2,0% CM cementdekvloer zonder VV, max. 1,5% met VV, max. 0,5% anhydriet); vlakheidsmeting met 2-meter rei conform NEN-EN 13813; controle op scheurvorming en dilataties.
* **Deurinspectie & Beleid Deuren Inkorten (Strikte Taakafbakening):**
  * Doordat een nieuwe vloeropbouw het peil met 5 tot 15 mm kan verhogen, kunnen binnendeuren gaan klemmen op de vloer of dorpels.
  * **Strikte Taakafbakening (Geen Uitvoering door Stoffeerders):** Conform de operationele beleidslijn van lanceerpartner *Groter in Wonen* (vestiging Gronsveld, zie ook domeinmodel §3.4.5) voeren eigen stoffeerders en vloerenleggers **definitief géén zaag- of schaafwerkzaamheden aan binnendeuren** meer uit. Dit beleid is ingesteld wegens substantiële aansprakelijkheids- en schaderisico's (zoals het splijten van kwetsbaar fineer, constructiebreuk bij honingraatdeuren of beschadiging van stalen stabilisatiestaven in kamerhoge deuren).
  * **Inmeetprocedure & Adviesrol:** Bij speling < 4 mm tussen de toekomstige vloerhoogte en de onderkant van de deur registreert de technisch inmeter het knelpunt op het inmeetverslag:
    * Type deur: **opdekdeur** (paumelles, opdekrand) vs. **stompe deur** (insteekscharnieren).
    * Gemeten speling en benodigde inkorting (in mm).
    * Status: *Signalerend adviespunt* ten behoeve van de aannemer, timmerman of opdrachtgever. De klant draagt zelf de verantwoordelijkheid voor het tijdig laten inkorten en opnieuw afhangen van de deuren vóór de vloerinstallatie.

#### 3.7.7 Sloop, Ondergrondsanering & Voorbewerking
* **Verwijderen Bestaande Vloerbekleding:**  
  De inmeter inventariseert het type te verwijderen vloer (volvlakkig verlijmd tapijt, zwevend laminaat, verlijmd PVC, parket op spaanplaat) en toetst de hechtingssterkte aan de dekvloer.
* **Afvoeren & Containerlogistiek:**  
  Het portaal registreert de netto oppervlakte ondergrondsanering (in m²) en stelt vast of afvoer via de reguliere monteurswagen mogelijk is of dat plaatsing van een afvalcontainer op de oprit/straat noodzakelijk is.
* **Schuren & Lijmresten:**  
  Vastleggen van de benodigde voorbewerking (diamantschuren van watervaste lijmresten, affrezen van egalisatieresten, verwijderen van tapijtspanlatten).
* **Egalisatie & Vloertechniek:**  
  Aanbrengen hechtprimer en gieten van egaline (standaard 2–3 mm vs. renovatielagen > 3 mm, $1{,}6\,\text{kg/m}^2/\text{mm}$); aanbrengen 2K epoxy vochtscherm met kwartszand instrooien.

#### 3.7.8 Montagelogistiek, Verticaal Transport & Afvalbeheer
* **Schouw Trappenhuis & Doorgang:**  
  Bij levering op etages toetst de inmeter de bereikbaarheid: aanwezigheid van een geschikte personen-/goederenlift, breedte van het trappenhuis en de draaicirkel van bordessen (met name bij zware tapijtrollen van 400/500 cm of lange gordijnrails).
* **Inzet Ladderlift / Verhuislift:**  
  Indien intern transport onmogelijk is of arbo-risico's oplevert, markeert de inmeter de noodzaak voor een verhuislift / ladderlift per dagdeel, inclusief inspectie van de opstelplaats aan de gevel en eventuele gemeentelijke vergunningsplicht.
* **Materieel & Steigers:** Rolsteiger / hoogwerker conform Arbowetgeving bij montage boven 2,5 meter werkhoogte; containerplaatsing (3 of 6 m³) voor bouw- en sloopafval.
* **Logistiek & Milieu:** Postcode-staffels transport- en bezorgkosten; Cradle-to-Cradle scheiding en recyclingbijdrage voor PVC-snijafval.

#### 3.7.9 Service, Garantie & Nazorg
* **CBW-Garantiebezoeken:** Uitvoeren van inspecties en herstelwerkzaamheden onder CBW-erkende garantievoorwaarden.
* **Nazorg & Regiewerk:** Nalevering monteren, nastellen van deuren en draai-kiepsystemen na zetting; uurtarief ervaren monteur / 2e man assistentie; projectregie bij complete woninginrichting.
* **Onderhoudscontracten:** Periodiek reinigen en smeren van screens/rolluiken en onderhoudsadvies voor PVC/houten vloeren.

#### 3.7.10 Inmeet- en Rekenmatrix Diensten & Montage

| Dienstgroep / Bewerking | Primaire Eenheid | Registratie Inmeter & Schouwcondities | MVP Portaalactie | Output naar Werkbon & ERP |
| :--- | :--- | :--- | :--- | :--- |
| **Gordijn- & Railmontage** | m¹ / stuks | Railbreedte, montagehoogte, wand/plafond, elektrische aansluiting | Berekent railmontage per m¹ en afhangen | Post naar ERP werkbon |
| **Binnenzonwering & Horren** | stuks | In/op de dag, kozijntype, kindveiligheid NEN-EN 13120, TruFit/klemsteun | Registreert montagewijze per raam | Post naar ERP werkbon |
| **Vloeren Legservice** | $m^2$ / m¹ | Type vloer (Dryback/Click), legpatroon (visgraat), plinttype en afkitten | Berekent m² leggen en m¹ plinten afkitten | Post `vloer_legservice_m2` naar ERP |
| **Trapbekleding & Renovatie** | stuks treden | Aantal treden open/dicht, overzettreden vs tapijt, wangen, LED | Registreert treden en afwerkopties | Post naar ERP werkbon |
| **Buitenzonwering Montage** | stuks | Gevelconstructie, latei, chemische ankers M12, 230V/Solar | Registreert ankers en bekabeling | Post naar ERP werkbon |
| **Inmeting & Deurinspectie** | stuks_knelpunten | 3D laser-inmeting, deurspleet peilmeting (< 4 mm) | Signaleert `advies_inkorten` | Adviesrapport voor aannemer/klant; monteur zaagt niet |
| **Sloop & Verwijderen Vloer** | $m^2$ | Type vloer (verlijmd vs zwevend), hechtlaag, tapijtbekleding | Registreert oppervlakte en slooptijdindicatie | Post `sloop_vloer_m2` naar ERP-offerte |
| **Egalisatie & Primeren** | $m^2$ / laagdikte mm | Type dekvloer, reitest (> 2 mm), vloerverwarmingssleuven | Berekent zakkenverbruik ($1,6\,\text{kg/m}^2/\text{mm}$) | Materiaalbehoefte en egalisatiepost |
| **Ladderlift & Logistiek** | dagdeel / forfait | Etagehoogte, raamdoorgang, gevelopstelplaats, afvalcontainer | Registreert materieelnoodzaak en container | Reservering materieel en post in `pos_project_algemeen` |
| **Service & Regiewerk** | uren / forfait | Nazorg, CBW-garantie, projectregie villa/woning | Registreert man-uren en regie-omvang | Post regie-uren naar ERP |

#### 3.7.11 Samenvattende ERP Verpakkings- & Logistiekgovernance
Om logistieke faalkosten, materiaaltekorten en retourstromen te elimineren, hanteert EasyM2M in samenwerking met het ERP-systeem (LogicTrade) een strikte **ERP Verpakkingsgovernance**. Bestellingen naar fabrikanten en groothandels worden automatisch afgerond op basis van de fysieke verpakkings- en besteleenheden per materiaalgroep:

| Materiaalgroep / Categorie | Fysieke Besteleenheid | Afrondingsformule & Calculatieregels | Restmateriaal- en Retourbeleid |
| :--- | :--- | :--- | :--- |
| **Gordijnen (Baanstof met rapport)** | Volle banen / strekkende meters | Afronding per baan op een geheel veelvoud van het verticaal rapport ($N \times V_r$); confectiebreedte afgerond op hele banen; volle rollen stof bij projectorders | Restcoupons worden meegeleverd aan de klant of verwerkt als kussenhoezen/stalen. |
| **Gordijnen (Kamerhoge stof)** | Strekkende meters van volle rol | Breedte rail $\times$ plooifactor + 20 cm zoomtoeslag; rapportafronding of volle rollen bij projectorders | Afsnijdsels onderzoom/zijzoom; klantbehoud conform §3.2. |
| **Ondervloeren (Rollen)** | Volle rollen (bijv. 15 m² per rol) | $\lceil \text{Netto } m^2 / 15 \rceil$ volle rollen; klant betaalt voor de afgeronde volle rol | Monteur vraagt bij oplevering of klant overschot wil behouden; restvoorraad naar magazijn. |
| **Harde Vloeren (PVC, Laminaat, Parket)** | Volle pakken / dozen ($m^2$ per pak) | $\lceil (\text{Netto } m^2 \times (1 + \text{Snijverlies})) / \text{Pakinhoud} \rceil$ volle pakken | Klant behoudt minimaal 1 gesloten reservepak voor toekomstig herstel / plankvervanging. |
| **Traprenovatie (Rechte overzettreden)** | Standaarddozen à 4 stuks | $\lceil N_{\text{recht}} / 4 \rceil$ volle dozen | Ongebruikte rechte treden worden als spare parts overgedragen aan de klant. |
| **Traprenovatie (Verdreven treden XL)** | XL-kits à 2 stuks (paar) | $\lceil N_{\text{verdreven}} / 2 \rceil$ kits | Maatwerk mallen en overmaatse treden; geen fabrieksretour mogelijk. |
| **High-Tack Montagemortel / Mammoetlijm** | Kokers à 290 ml | $\lceil N_{\text{treden}} / 2{,}5 \rceil$ kokers | Aangebroken kokers blijven bij monteur; volle kokers retour voorraad. |
| **Egaline (Cementgebonden)** | Zakken à 25 kg | $\lceil (\text{Netto } m^2 \times \text{laagdikte mm} \times 1{,}6) / 25 \rceil$ volle zakken | Droog bewaren; restzakken retour centraal magazijn. |
| **Ladderlift / Hijsmiddelen** | Dagdelen (ochtend / middag) | Vaste boeking per dagdeel van 4 uur inclusief gecertificeerd bedienend personeel | Annulering minimaal 24 uur vooraf bij windkracht $\ge 6$ Bft. |

---
## Deel 4: Plannings- en Uitvoeringsstructuur (Gefaseerde Montage & Afhankelijkheden)

### 4.1 De Integrale Customer Lifecycle: Van Eerste Klantcontact tot Tevreden Klant & Data-Status
Het ketenproces is een integrale **Customer Lifecycle** waarin vanaf het eerste showroomcontact een dynamisch klantdossier wordt opgebouwd dat meegroeit tot en met een tevreden klant die de oplevering met enthousiasme accepteert:

* **Het Doel:** Niet alleen het foutloos monteren van een product, maar een tevreden klant die blij is met het eindresultaat én de wijze waarop dit resultaat tot stand is gekomen.
* **Continue Data-Vastlegging, Status per Element & Versiebeheer:**  
  Vanaf het allereerste gesprek wordt een rijk palet aan gegevens vastgelegd: van klantwensen, leefstijl en ruimtelijke indeling tot specifieke producten, stoffen, kleuren, opties, maten en bouwkundige condities.
  * **Gedifferentieerde Statussen per Data-Entiteit:**  
    In tegenstelling tot een starre, lineaire statusreeks kent elk specifiek type data-entiteit binnen het dossier een eigen, natuurlijke levenscyclus:
    * **1. Maatvoering & Positiedata (Geometrische entiteiten):**
      * *Concept / Indicatief:* Showroomopgave door de klant of globale schatting door de verkoper (Fase 1). Nadrukkelijk geblokkeerd voor inkoop of productie.
      * *Geverifieerd op Locatie:* Fysiek met laser ingemeten en digitaal vastgelegd door de inmeter conform het meetraster (Fase 2). Blijvende maat wordt automatisch berekend.
      * *Handmatig Overruled (met audit-log):* Maat gecorrigeerd door inmeter of werkvoorbereider met verplichte redenopgave (bijv. bouwkundige speling of scheefstand).
      * *Productie-Definitief (Bevroren):* Definitief vastgesteld en vergrendeld voor inkoop. Kan niet meer worden gemuteerd zonder formele revisieprocedure.
    * **2. Commerciële Entiteiten (Offerte & Calculatie):**
      * *Concept:* Voorlopige calculatie op basis van indicatieve maten of stalenkeuze (Fase 1).
      * *Uitgebracht:* Bindende offerte formeel verzonden naar de klant ter beoordeling.
      * *Herziening Vereist (Revisiebeheer V1 → V2):* Indien een offerte wordt afgewezen of de klant alternatieve stoffen/opties wenst, wordt een nieuwe revisie (V2) gegenereerd. De geverifieerde maten en ruimtestructuur blijven 100% behouden als centrale waarheid; uitsluitend artikel- en prijsregels muteren.
      * *Geaccordeerd:* Digitaal of schriftelijk ondertekend door de klant; geeft order vrij voor ordercontrole.
    * **3. Inkoop- & Fabrieksorders (Logistieke entiteiten):**
      * *Concept Inkooporder:* Samengesteld op basis van de geaccordeerde offerte en definitieve productiematen.
      * *Gecontroleerd & Vrijgegeven:* Getoetst door de ordercontroleur conform het vier-ogenprincipe op technische maakbaarheid (Fase 4).
      * *Besteld bij Fabrikant / Atelier:* Formeel verzonden via EDI of leveranciersportaal met uniek extern ordernummer.
      * *Geleverd in Magazijn:* Fysiek binnengekomen in het magazijn, gecontroleerd op compleetheid en klaargezet voor montage.
    * **4. Uitvoerings- & Montage-orders (Operationele entiteiten):**
      * *Ingepland:* Toegewezen aan het juiste montageteam, datum en tijdsblok, rekening houdend met dwingende productvolgorde en droogtijden (Fase 5).
      * *In Uitvoering:* Monteur is op locatie en heeft de start van de montagewerkzaamheden gemeld via de mobiele app.
      * *Opgeleverd & Geaccordeerd:* Fysiek geïnstalleerd, werkbon en opleverprotocol digitaal ondertekend door de klant zonder openstaande punten.
      * *Oplevering onder Voorbehoud / Servicegeval:* Oplevering met vastgelegde restpunten of geconstateerde materiaalschade; triggert direct een servicemelding (Fase 6).
    * **5. Media- & Notitie-entiteiten (Documentaire entiteiten):**
      * *Actief:* Gekoppeld aan een ruimtelijk niveau (Object, Verdieping, Ruimte, Vlak, Positie) of producttoewijzing; voorzien van `timestamp`, `auteur`, optionele `titel` en contextuele tagging (`situatie_vooraf`, `technisch_detail`, `obstakel`, `eindresultaat`).
      * *Gearchiveerd:* Historisch bewaard bij eerdere projectrevisies; blijft te allen tijde traceerbaar.
    * **6. Issue- & Restpunt-entiteiten (Kwaliteits- en Nazorg-entiteiten):**
      * *Open:* Aangemaakt door monteur tijdens oplevering of backoffice n.a.v. een servicemelding; gekoppeld aan specifiek product.
      * *In behandeling:* Beoordeeld door servicecoördinator; eventuele vervangende onderdelen besteld in ERP.
      * *Ingepland:* Gekoppeld aan een Afterservice-afspraak op Hoofdscherm 4.
      * *Opgelost / Gesloten:* Fysiek hersteld door servicemonteur en vastgelegd in een Afterservicerapport. Projectafsluiting vereist dwingend 0 openstaande issues (INV-GATE-01).
  * **Offerte- en Calculatieversies (Versiebeheer & Alternatieven):**  
    Het dossier ondersteunt volwaardig versiebeheer voor offertes en productkeuzes (bijv. Offerteversie 1.0, 1.1, 1.2 of parallelle calculatie-opties A en B). Dit is essentieel voor de commerciële praktijk:
    * *Voorbeeld:* Er wordt initieel een offerte uitgebracht op basis van een exclusieve A-merk stof of een premium Luxaflex-oplossing. Vervolgens verzoekt de klant om een alternatieve offerte op basis van een voordeligere stofklasse of op basis van het eigen GiW-huismerk.
    * *Data-Integriteit bij Versiewissels:* De bouwkundige ruimtestructuur, gevelopeningen en geverifieerde inmeetmaten blijven 100% behouden en herbruikbaar als één centrale waarheid. Uitsluitend de gekoppelde productconfiguratie, materiaalparameters, leveranciersselectie en prijsregels wisselen per versie.
* **Informatieverzameling in de Intentiefase vs. Inmeetfase:**  
  In de intentiefase (Fase 1) wordt aanzienlijk méér informatie verkregen dan sec noodzakelijk is voor het inmeten. Denk aan budgetindicaties, stijlvoorkeuren, verbouwingsplanning, geplande werkzaamheden (plinten, egalisatie) en klantprioriteiten. Al deze informatie is essentieel om later in de keten de juiste beslissingen te nemen.
* **Minimale Informatie voor een Betrouwbare Prijsindicatie in Fase 1:**  
  Om reeds in de showroom een realistische voorlopige prijsindicatie te kunnen calculeren vóórdat de inmeter op locatie is geweest, is een minimale dataset vereist:
  1. Ruimtelijke toewijzing (welke ruimtes/posities).
  2. Productgroep en beoogde productlijn (bijv. Duette 25 mm of Wave-gordijn).
  3. Indicatieve maten van de klant (breedte × hoogte in cm, meegenomen naar de showroom).
  4. Stof-/materiaalprijsgroep of indicatieve stalenkeuze.
  5. Indicatie van bijbehorende werkzaamheden (bijv. wel/geen montage, demontage oude situatie, plinten).
* **Van Prijsindicatie naar Bindende Offerte:**  
  Pas wanneer de inmeter de fysieke situatie heeft geschouwd, de exacte maten heeft opgenomen en de bouwkundige haalbaarheid heeft gevalideerd, worden de conceptwaarden definitief gemaakt en kan een bindende offerte (Fase 3) worden uitgebracht.
* **Servicemodule voor Onderdelen & Reparaties (Ontlasting Showroomverkoop):** *(Wens/idee)*  
  Om te voorkomen dat ervaren verkoopadviseurs overspoeld raken met administratief uitzoekwerk en het opzoeken van losse onderdeelnummers (wat in de huidige praktijk door de magazijn- en backoffice-coördinatie wordt opgevangen), is een gestructureerde servicemodule voor losse onderdelen een wens/idee voor een latere fase:  
  * *Onderdelenbeheer & Fabrikantcodes:* Gestandaardiseerde registratie van veelvoorkomende service-artikelen (losse kettingmechanismen, SmartCord nippeltjes, afdekkapjes, kettingspanners, glijders en adapters) gekoppeld aan de oorspronkelijke inkooporder of het productdossier.  
  * *Zelfstandige Bestelling door Backoffice / Klantenservice:* De centrale klantenservice kan aan de hand van het inkoopordernummer direct het juiste fabrieksonderdeel afroepen zonder dat de verkoopadviseur van de winkelvloer wordt gehaald, waardoor showroomverkoopcapaciteit en commerciële omzet maximaal worden beschermd.

### 4.2 De Keten naar Montage, Oplevering & Klanttevredenheid (Integratie van Verkoop tot Tevreden Klant)
De keten is nadrukkelijk méér dan een route naar productie: het is een geïntegreerd kwaliteitstraject dat **begint bij de verkoper in de showroom** (intake, stalenadvies, indicatieve calculatie en het direct inplannen van het inmeetbezoek) en **eindigt bij een fysieke montage, vlekkeloze oplevering en een enthousiaste klant** die trots is op het eindresultaat.

Waar Deel 1 het overkoepelende procesmodel op hoofdlijnen schetst, zoomt Deel 4 zuiver in op de **concrete data-overdracht van montage-, plannings- en uitvoeringsparameters**:
* **De Doorstroming van Showroom naar Montage:**  
  1. *Stap 1: Verkoop-Intake & Afspraakplanning (Verkoper):* Vastlegging van klantwensen, leefstijl, ruimte-indeling en stalenkeuze. De verkoper plant direct in de showroom in overleg met de klant de inmeetafspraak in op de agenda van de inmeter.
  2. *Stap 2: Fysieke Inmeting & Kwalitatieve Schouw (Inmeter):* Verificatie van zuivere dagmaten, bouwkundige vlakken (beton/stuc/gips), leidingvrijheid, klinkspelingen en obstakels. De inmeter registreert direct de montagewijze, steuntoepassingen en het benodigde klimmaterieel.
  3. *Stap 3: Technische Validatie & Bestelspecificatie (Werkvoorbereider):* Toetsing via conditional logic aan fabricage- en montagegrenzen (vier-ogenprincipe). Genereren van definitieve productiematen voor de fabriek én gedetailleerde montage-instructies voor de werkbon.
  4. *Stap 4: Uitvoering, Oplevering & Klantbeleving (Monteur):* Vakkundige montage volgens voorgeschreven volgorde, controle van werking en kindveiligheid, en digitale aftekening van het opleverprotocol met de tevreden klant.
* **De Vier Gekoppelde Parameterdomeinen voor Uitvoering:**  
  Aan elke gevalideerde productpositie hangen vier parameterdomeinen vast die noodzakelijk zijn voor een vlekkeloze realisatie:
  * *1. Productieparameters:* Blijvende maat, pakkethoogte, bedieningszijde, doekrolrichting.
  * *2. Montagelogistiek:* Benodigde montagetijd per positie, steunafstanden, specifieke bevestigingsmiddelen (schroeven/pluggen per type ondergrond), en Arbo-klimmateriaal (trap/rolsteiger).
  * *3. Confectie- & Maatwerkvoorschriften:* Plooidiepte, baanverdeling, patroonhoogte/rapportafstemming, retourbochten en uitlijninstructies.
  * *4. Calculatie & Kostprijs:* Staffelsprongen, toeslagen voor specials (TruFit, zijgeleiding, elektrische motoren), zaag- en buigtarieven, en eventuele zaaguren voor binnendeuren.
* **Het Dynamisch Montageplannings-Algoritme (Calculatie van Montagetijden):** *(Wens/idee / ambitie voor de toekomst; in de huidige praktijk plant men grotendeels op ervaring)*  
  In plaats van starre cumulaties (zoals de historische methode: 5 jaloezieën = 5 × 45 min = 3 uur 45 min) of puur onderbuikgevoel, kan de planningsmodule in een latere fase de montageduur berekenen via een gestandaardiseerd rekenalgoritme:  
  `Geplande Montagetijd = Vaste Reistijd (regio) + Aanvangstijd per klus + Som(Product Basistijd × Factor Ondergrond) + Toeslag Voorbereiding/Meerwerk`  
  * *Vaste Reistijd (T_reis):* Automatisch berekend op basis van postcode/regio. Binnenstraal/lokaal: 15–30 min; Buitenregio (bijv. Midden-Limburg): 45–60 min.  
  * *Vaste Aanvangstijd per klus (T_basis):* Éénmalig per adres voor aankomst, klantbegroeting, werkzone-inspectie, gereedschap/ladder binnenbrengen en uitpakken (standaard 15–20 min).  
  * *Product Basistijd (T_product):* Zuivere montagetijd na uitpakken (bijv. jaloezie / duette: 10–12 min per product i.p.v. 45 min; gordijnrail: 15–20 min per rail).  
  * *Factor Ondergrond (F_ondergrond):* Hout = factor 0.8; Beton = factor 1.0; Gips = factor 1.2; Staal/ijzer = factor 1.5 (§3.1.7).  
  * *Toeslag Voorbereiding & Meerwerk (T_meerwerk):* Extra gecalculeerde uren voor specifieke voorbereidingen, zoals plinten openzagen/inkorten (15 min per positie) of tapijtspanlatten verlijmen met montagekit (20 min).
* **Conditional Logic & Uitsluitings-Beslisbomen in de Invoer:**  
  Om faalkosten en onmogelijke montagesituaties direct bij de bron uit te sluiten, hanteert de configurator automatische restricties:
  * *Duette Handgreep > 1,30 m:* Zodra de breedte > 1300 mm is, wordt de bedieningsoptie 'Handgreep/LiteRise/TruFit' geblokkeerd en dwingt het systeem SmartCord, koordbediening of motorisering af.
  * *Jaloezie 50 mm TDBU:* Zodra 50 mm lamelbreedte is geselecteerd, vervalt de optie 'Top-Down / Bottom-Up' wegens overschrijding van het maximaal toelaatbare pakketgewicht voor veersystemen.

### 4.3 Planningsparameters & Directe Registratie bij Inmeten
De planning is geen statische éénmalige afspraak voor de hele order, maar een dynamisch proces waarin verschillende producten, ruimtes en zelfs **sub-posities apart kunnen worden gepland**:

* **Inbreng van de Inmeter voor de Planning (Directe Registratie bij Inmeten):**  
  Tijdens de inmeetfase (Fase 2) geeft de inmeter al direct per positie of productlaag aan:  
  * **Verwachte montageduur:** Hoeveel tijd (in uren/minuten) er daadwerkelijk nodig is op basis van de fysieke situatie ter plekke (bijv. scheve muren, moeilijke hoeken, hard beton vs zacht gips, of bewerkelijke hoogtes).
  * **Montagevolgorde bij Gekoppelde Posities (Hoeken):** De inmeter legt dwingend de hangvolgorde vast (eerst Positie A tot in de hoek, daarna aansluitend Positie B), zodat de monteur op de werkopdracht direct de juiste volgorde aanhoudt en schade of foute pasvorm voorkomt.
  * **Specifieke Werkaanwijzingen & Beslagaanpassingen:** Bijv. het ter plekke signaleren dat de kiepstand van een draaikiepraam begrensd moet worden om botsing met de lamellen te voorkomen (duidelijke instructie voor monteur of klant).  
  * **Specifiek persoon / competentie:** Of er een specifieke monteur of specialist nodig is (bijv. ervaren meesterstoffeerder voor een moeilijke draaitrap, of een specialist voor elektrische Somfy/domotica motoren).

* **De Twee Planningsstromen & Ketenlogistiek:**
  * **Route A (Magazijngestuurd - Standaardtraject):**  
    Het standaard uitgangspunt in de woninginrichting. Montage wordt pas ingepland nadat álle orderregels en materialen fysiek in het centrale magazijn zijn binnengekomen en door de magazijnmedewerker zijn binnengemeld. Dit activeert de status *Compleet Binnen* (visueel zwart/donker in het dashboard), waarna de planner contact opneemt met de klant voor een definitieve afspraak.
  * **Route B (Vooruitplanning bij Harde Deadlines):**  
    Indien de klant een harde deadline heeft (bijv. verhuisdatum of sleuteloverdracht), plant de adviseur/planner de montage vooraf in. Hierbij geldt een **strikte veiligheidsbuffer van 2 tot 3 weken** ná de door de fabrikant bevestigde leverweek (zondag productieweek) om leververtragingen betrouwbaar op te vangen.

* **Dashboard Kleurencodering & Ketenstatussen:**  
  * *Zwart / Donker:* Compleet binnen in het centraal magazijn (gereed voor montageplanning).  
  * *Licht:* Reeds definitief ingepland in de montageagenda.  
  * *Onbevestigd:* Inkooporder is verzonden naar leverancier; orderbevestiging met productieweek nog niet retour verwerkt.  
  * *Bevestigd:* Orderbevestiging verwerkt door de backoffice met extern ordernummer en definitieve leverweek.  
  * *Te laat binnen:* Bevestigde leverweek verstreken zonder magazijnbinnenmelding (automatisch attentiesignaal voor planner en backoffice).
* **Fabrikant-Orderbevestiging (ACK Gate) & Spookorder-Alerting (Casus De La Croix):**  
  * *Aanleiding:* Twee Duettes TruFit besteld voor klant De La Croix met beoogde levering in week 39; intern bestond wel een inkoopordernummer, maar de order was onvindbaar in het leveranciersportaal van Luxaflex (door een eerdere portalstoring nooit aangekomen). Pas in de geplande montage-/uitleverweek werd de vermissing ontdekt.  
  * *De Orderbevestiging-Gate (ACK Gate):* Een inkooporder mag in het portaal nooit de status 'Definitief Besteld' behouden zonder actieve registratie van het **officiële externe orderbevestigingsnummer van de fabrikant**.  
  * *48-Uurs Spookorder-Alerting:* Indien een geplaatste inkooporder na 48 uur nog géén extern orderbevestigingsnummer heeft gekregen van de fabrikant (Luxaflex, Sunway, Vadain, Toppoint), triggert het dashboard een rode attentiemelding (*"Spookorder-Alert: géén fabrikantbevestiging ontvangen"*) voor de backoffice om direct telefonisch contact op te nemen met de leverancier.  
  * *Dwingende Merkvalidatie op Regels:* Voorkomt verwarring tussen leveranciers van soortgelijke systemen (zoals Luxaflex TruFit vs Sunway FrameFix); het exacte merk en portaal is een verplicht veld op inkoopregelniveau.

* **Wekelijkse Week-Vooruit Controlecyclus:**  
  De planner/werkvoorbereider toetst wekelijks alle dossiers die voor de komende werkweek op de rol staan. Indien een order onverhoopt nog niet compleet binnen is, wordt direct geschakeld met toeleveranciers en de klant vóórdat de monteur op pad gaat.

* **Financieel Escalatieprotocol bij Uitvoerings- en Orderfouten:**  
  Indien tijdens de verificatie of montage fouten worden geconstateerd door overname of verkeerd invullen (bijv. plintenaantallen of afwijkende stofcodes), verloopt de afhandeling conform het escalatieprotocol in §1.5.5 (onder € 200 - € 300 collegiaal / bijvoorbeeld sam-sam; daarboven escalatie naar de directie).

### 4.4 Fasering, Droogtijden & Vakdisciplines
* **Aparte planning per sub-positie wegens droogtijden:**  
  Verschillende bewerkingen op dezelfde positie kunnen niet tegelijkertijd plaatsvinden. Egaline (sub-positie 4a) moet bijv. 24 tot 48 uur drogen voordat er geschuurd of verlijmd kan worden (sub-positie 4c). Tussen deze sub-posities zit een verplichte technische wachttijd waarin de ruimte niet betreden mag worden.

* **Planning op basis van vakdisciplines en competenties:**  
  Verschillende producten vereisen verschillende monteurs. Een vloerenlegger/stoffeerder (egaline, PVC, tapijt) is een andere vakman met ander materieel dan een raamdecorateur (gordijnen, elektrische rails, horren). Deze worden als aparte monteurs op eigen datums en tijdstippen ingepland.

* **Productvolgorde en stofgevoeligheid:**  
  Er is een vaste volgorde tussen productgroepen om beschadiging en vervuiling te voorkomen:  
  `Eerst vloeren egaliseren, schuren en leggen  -->  Pas daarna gordijnen en raamdecoratie monteren`.  
  *Reden:* Schuren veroorzaakt veel fijnstof dat in gordijnstoffen trekt, en de exacte valhoogte van een gordijn tot de vloer kan pas definitief worden afgemeten/afgehangen als de definitieve vloer er al in ligt.

* **Ruimte-volgorde en fasering op klantverzoek:**  
  Er kan een specifieke volgorde zijn in de ruimtes die gedaan worden (bijv. op verzoek van de klant eerst de 1e verdieping afronden zodat meubels/dozen daar geplaatst kunnen worden, en pas een week later de begane grond).

* **Systeemoplossing in het Portaal ('Alles in 1 keer, tenzij'):**  
  Het basisuitgangspunt voor de planner is dat **alles standaard in 1 montage-afspraak wordt gepland** ("alles tenzij"), aangezien dat in de praktijk het meeste voorkomt.  
  Vanuit dat uitgangspunt kan de planner echter heel eenvoudig één of meerdere onderdelen, ruimtes of sub-posities (zoals egaliseren) **loskoppelen en apart inplannen** wanneer droogtijden, verschillende vakdisciplines of wensen van de klant daarom vragen.

### 4.5 Materiaal- & Inmeetlogistiek voor Monteurs
* **Benodigdheden voor de Inmeter (Inmeetplanning & Materiaal):**  
  Ook het inmeetbezoek zelf wordt gepland en vereist specifieke voorbereiding:  
  * **Stalen meenemen:** Specifieke stalenboeken, stalenkaarten of kleurwaaiers die de inmeter moet meenemen om ter plekke in het licht van de klant te tonen.  
  * **Speciaal gereedschap / Hoogte:** Als een kamer te hoog is (bijv. vide of herenhuis > 3,5m) en een normale huishoudtrap ontoereikend is, moet vooraf in de planning worden opgenomen dat de inmeter een **hoge ladder of speciale trap** meeneemt in de bus.

*(Noot V1-scope voor montage-uitrusting: In versie 1 genereert het portaal geen volautomatische inkoop- of materieellijst voor gereedschappen; de inmeter vinkt in de Arbo-checklist aan welk extra klimmaterieel benodigd is [lange ladder, hoge trap, rolsteiger, anders...], waarna dit direct als concrete attentiewaarde op de digitale werkbon voor de bus wordt geplaatst).*

* **Materiaallogistiek voor Monteurs (Automatische Materiaalcalculatie):**  
  Monteurs moeten bulkproducten meenemen naar de klus (bijv. zakken egaline, emmers lijm, rollen ondervloer).  
  * *Automatische berekening in het Portaal:* Op basis van het aantal m², de laagdikte en het verbruik per mm berekent het systeem automatisch het exact benodigde aantal (bijv. `# zakken egaline van 25 kg`).  
  * *Magazijn & Busbepakking:* Dit berekende aantal komt direct in de planning en op de werkbon te staan, zodat het magazijn dit klaarzet en de monteur zijn bus met het juiste gewicht en volume kan inladen.

### 4.6 Afspraaklogica, Tijdsblokken & Klantcommunicatie
* **Tijdsblokken & Klantcommunicatie (Afspraaklogica):**  
  * **Tijdsblokken:** Afspraken (voor inmeter en monteur) worden gepland in tijdsblokken waarbinnen de medewerker arriveert (bijv. *Ochtendblok 08:30 - 12:30*, *Middagblok 13:00 - 17:00*).  
  * **Klant-instructies & Bellen voor aankomst:** Klanten bellen vaak vooraf voor een specifieker richttijdstip of vragen expliciet: *"Bel/app 15 minuten van tevoren naar mobiel nummer X"*. Dit is een verplicht instructieveld op de afspraak.  
  * **Backlog-idee (Picnic-model):** Inmeter/monteur tikt 'Onderweg' aan in de app --> automatisch sms/WhatsApp-bericht naar de klant met verwachte aankomsttijd en eventueel realtime locatie.

* **Tussenbonnen vs. Eindoplevering & Digitale Afleverbon:**  
  Na tussentijdse bezoeken (zoals na het egaliseren) tekent de klant een **Tussenbon / Veiligheidsinstructie** (bijv. *"Vloer geëgaliseerd, betreden verboden tot morgen 12:00 uur"*). Pas bij afronding van de allerlaatste montage-afspraak wordt het officiële **Opleverontvangst / Opleverrapport (Afleverbon)** door de klant ondertekend, inclusief eventuele restpunten voor de After Service Monteur.
  * *De Drie Verplichte Opleveringsvragen:* Vóórdat het handtekeningveld op de tablet wordt vrijgegeven, moet de monteur verplicht drie kwaliteitsvragen bevestigen:  
    1. *Is onderhavig leverproduct met de klant doorgenomen?*  
    2. *Is de werking en bedieningsfunctie (o.a. SmartCord, motoren, afstandsbediening, plooival) aan de klant gedemonstreerd?*  
    3. *Zijn alle geleverde goederen gecontroleerd op compleetheid en schadevrijheid?*
  * *Facturatie 1 Werkdag Vooraf:* Facturatie vindt standaard plaats één werkdag voorafgaand aan de montage (vrijdag voor maandag/dinsdag). De factuur vermeldt de totaalsom minus de eerdere aanbetaling.  
  * *Financiële Afhandeling & Facturatiebeleid:* Het openstaande restantbedrag wordt niet per mobiele PIN bij de monteur geïnd (mobiel pinnen valt in Versie 1 buiten scope conform §1.5.6 en §5.5). De financiële restantafhandeling verloopt via de reguliere debiteurenkanalen van het ERP (voorafbetaling per bank of facturatie vanuit de showroom), waardoor de monteur op locatie zich 100% kan focussen op het vakmanschap en de technische oplevering.
* **Digitale Werkboncommunicatie & Geen Ad-Hoc Verstoringen:**  
  Bij niet-spoedeisende afwijkingen (bijv. een niet-passende inzethor) bellen monteurs de planning of showroom niet ad-hoc op. Dergelijke telefoontjes verstoren de lopende werkzaamheden zonder dat het probleem op dat moment telefonisch kan worden opgelost. De monteur documenteert de afwijking met foto's en werkelijk gemeten afmetingen direct digitaal op de **digitale werkbon / afleverbon**. De backoffice en planner pakken dit bij binnenkomst van de bonnen gestructureerd op.
* **Het 3-Staps Root Cause Analyseprotocol bij Maatafwijkingen:**  
  Bij elke geconstateerde maatafwijking (bijv. casus inzethor: etiket 1,27 m vs werkelijke productmaat 1,22 m) doorloopt de kwaliteitscontroleur direct drie verificatiestappen:  
  1. *Stap 1: Verificatie Inmeetverslag:* Controle van de originele inmeetwaarde van de inmeter.  
  2. *Stap 2: Verificatie Portaal- & LogicTrade Invoer:* Toetsing van de invoer in het portaal en ERP (opsporen van eventuele type- of overnamefouten, zoals verwarring tussen 5 mm fabrieksreductie en 5 cm).  
  3. *Stap 3: Verificatie Fabrikant & Etikettering:* Indien inmeetwaarde en orderinvoer beide 1,27 m vermelden maar het fysiek geleverde product 1,22 m meet, ligt de bronoorzaak bij de fabrikant en wordt direct een kosteloze spoedherlevering onder fabrieksgarantie geclaimd.
* **Dwingend 4-Delig Fotoprotocol bij Fabrikantclaims & Service (Eijsden & Doekfouten Casus):**  
  Fabrikanten (zoals Luxaflex) hanteren uiterst rigide acceptatie-eisen voor service- en garantieclaims (bijv. casus Eijsden waarbij een jaloezie 1,5 cm te kort was, of weeffouten/gaatjes in verduisterende gordijnstoffen). Indien de servicemelding niet exact volgens fabrieksspecificatie is onderbouwd, wijst de fabrikant de claim categorisch af. Dit dwong adviseurs in het verleden om klanten na te bellen (die niet op een ladder durven) of moest inmeter Guy opnieuw naar de klant rijden puur voor een aanvullende foto.  
  Om herhaalbezoeken en claimafwijzingen uit te sluiten, activeert het portaal bij melding van een transportschade, productiefout, weeffout of maatafwijking een **dwingend 4-delig fotoprotocol** dat integraal op de tablet moet worden afgerond:  
  1. *Foto 1 (Overzichtsopname):* Het volledige product in de ruimte en de context van de gevelopening.  
  2. *Foto 2 (Detailopname van het Defect):* Scherpe macrofoto van de beschadiging, weeffout, loslatende lamel of montageschade.  
  3. *Foto 3 (Functionele Toestand):* Twee vergelijkende opnamen: het product in volledig **geopende toestand** én in volledig **gesloten toestand**.  
  4. *Foto 4 (Maatverificatie met Meetlat/Rolmaat):* **Een scherpe foto waarbij een rolmaat of meetlat strak langs het product of de afwijking wordt gehouden**, zodat het maatverschil (bijv. 15 mm tekort) of de exacte locatie van de doekfout onomstotelijk en meetbaar is vastgelegd voor de claimafdeling van de fabrikant.  
  5. *Foto 5 (Fabriekssticker & Productielabel):* **Scherpe close-up van de originele fabrikantsticker / barcode** op de cassette, doekzoom of verpakking (waarmee fabrikanten zoals Luxaflex en Somfy het chargenummer, productiedatum en order-ID direct verifiëren voor snelle garantieafhandeling).
* **Realtime Digitale Afmelding, Magazijnregie & Benutting van Restcapaciteit:**  
  * *Probleemanalyse:* Monteurs die vroegtijdig gereed zijn (bijv. om 14:30 of 15:00 uur) rijden historisch direct naar het magazijn, doen daar informeel voorwerk en leveren hun papieren bonnen pas om 16:50 uur in. Hierdoor blijven openstaande spoed- en serviceklussen (zoals een hordeur van 30 min in Eijsden of het vastzetten van een losgekomen gordijnrail) onnodig liggen tot een latere week.  
  * *Realtime Oplevernotificatie:* Zodra de monteur de klant digitaal laat aftekenen op de tablet, verstuurt het portaal direct een geautomatiseerd gereed-signaal (push-notificatie / e-mail / dashboard alert) naar de planner en showroom (*"Monteur X is om [Tijd] gereed met Order Y"*). Door op de notificatielink te klikken, opent direct het opleverdossier met opleverfoto's en betalingsstatus.  
  * *Directe Toewijzing van Restcapaciteit:* De planner ziet direct de vrijgekomen uren (bijv. 1,5 tot 2 uur restcapaciteit) en kan de monteur direct routeren naar een nabijgelegen korte service- of montageklus (zoals het direct meepakken van de hordeur in Eijsden) voordat de monteur naar het magazijn terugkeert.  
  * *Magazijnregie & Rol Magazijnmeester:* De magazijnmeester legt 's ochtends alle materialen en digitale werkbonnen klaar voor de vertrekkende bussen, bewaakt retouren en restmaterialen, en stuurt de logistieke doorstroom vanuit het centrale magazijn aan.

### 4.7 Specialistische Disciplines (Traprenovatie) & Liftafmetingen
* **Schaarse Vakdiscipline Traprenovatie & Monteur-Competenties:**  
  * Binnen de woninginrichter-organisatie is traprenovatie/-stoffering een uiterst specialistische discipline die in de praktijk vaak door slechts 1 of 2 monteurs wordt beheerst.  
  * De planningsmodule dient monteur-competenties (*skills/certificeringen*) te ondersteunen, waarbij orders met trapbekleding als harde restrictie uitsluitend kunnen worden toegewezen aan monteurs met de competentie *Traprenovatie/Trapstoffering*.  
  * *Calculatie Inmeet- en Montagetijd (Cortex Traprenovatie):*  
    * *Inmeettijd:* Indien de dealer zelf meet via de marker-kit, bedraagt de inmeettijd ca. **120 minuten (2 uur)** per trap (iedere trede en ieder stootbord apart voorbereiden, fotograferen en valideren op scheefstand). De dealer kan deze tijdrovende stap ook uitbesteden aan de fabrikant (*Fabrieks-inmeting* tegen vast tarief van ca. € 150,-).  
    * *Montagetijd:* Dankzij de tot op de millimeter CNC-uitgezoolde prefab treden bedraagt de fysieke montageduur door de monteur slechts een **halve dag (ca. 4 uur)**.  
    * *LED-bewegingssensoren:* Montage en aansluiting van sensoren onderaan en bovenaan de trap vereist afstemming met het aanwezige stroompunt.
* **Liftafmetingen vs. Productlengtes:** Lange lengtes (gordijnrails van 4 tot 6 meter) en tapijt-/vinylrollen van 4 of 5 meter breed passen vrijwel nooit in een standaard personenlift. De inmeter en planner moeten vooraf verifiëren of de draairadius in het trappenhuis toereikend is, dan wel dat een verhuislift via het gevelkozijn moet worden ingezet.

---

### 4.8 Veiligheids- en Materieellijst op de Werkbon (Arbo- en Montageprotocollen)
* **Automatische Overdracht naar Uitvoering:**  
  Veiligheidsrestricties en vereist klimmaterieel die tijdens de inmeetfase door de inmeter zijn aangevinkt op de Arbo-checklist (`Lange ladder`, `Hoge trap`, `Rolsteiger`, of `Anders...` met toelichting), worden direct als laadinstructie doorgezet naar de werkbon van de monteur en de planning. Hierdoor wordt de bus vóór vertrek uitgerust met het juiste zware klimmaterieel.
* **Protocol Hoge Montage in Trapgat / Vide:**  
  * *Materieeleis:* Hoge montage in een trapportaal of vide (> 2,5 m werkhoogte) vereist verplicht een **uitschuifladder van minimaal 2,5 meter**. Indien de werkhoogte > 4 m is, wordt automatisch een **rolsteiger of bordesplatform** ingepland.
  * *Plaatsingsprotocol:* De ladder wordt stabiel op een rechte trede geplaatst, voorzien van **zachte beschermingsdekens** tegen krassen/beschadiging, en stevig afgesteund tegen het **stootbord** van de bovengelegen trede (fysieke borging tegen wegglijden).

---

### 4.9 Compleet Relationeel Entiteitenmodel, Data-Contracten & Concurrency (OCC)

Het datamodel van EasyM2M is relationeel, audit-trail gebaseerd en ontworpen voor naadloze offline synchronisatie op tablets.

#### 4.9.1 TypeScript Entiteit-Interfaces & Cardinaliteiten

```typescript
// 1. Klant, Project & Administratieve Context
export interface Klant {
  id: string; // UUID v4
  relatienummer_erp?: string; // Koppeling met LogicTrade
  naam: string;
  email: string;
  telefoon: string;
  factuuradres: Adres;
  created_at: string; // ISO 8601
  updated_at: string;
  version_id: number; // OCC teller
}

export interface Project {
  id: string;
  project_nummer: string;
  klant_id: string;
  verblijfsobject_id: string;
  status: 'Intake' | 'Offerte' | 'Order' | 'Geleverd' | 'Afgerond';
  offerte_kenmerk_logictrade?: string;
  order_kenmerk_logictrade?: string;
  heeft_conceptmaten: boolean;
  ruimtes?: Ruimte[];
  kalender_afspraken?: KalenderAfspraak[];
  werkafspraken_en_montagecondities?: WerkafspraakEnMontageconditie[];
  inhoudelijke_afspraken?: WerkafspraakEnMontageconditie[]; // Alias voor achterwaartse compatibiliteit
  issues?: Issue[];
  rapporten?: RapportDossier[];
  version_id: number;
  created_at: string;
  updated_at: string;
}

// 2. Ruimtelijke Hiërarchie
export interface Verblijfsobject {
  id: string;
  klant_id: string;
  naam: string; // bijv. "Woonhuis" of "Appartement 4B"
  adres: Adres;
  toegangsinstructies?: string;
  is_nieuwbouw: boolean;
  bouwnummer?: string;
  einddatum?: string; // Voor logische deletes
  projecten?: Project[];
  verdiepingen?: Verdieping[];
  version_id: number;
}

export interface Verdieping {
  id: string;
  object_id: string;
  volgorde: number;
  naam: string; // "Begane grond", "1e verdieping"
  code: string; // "BG", "1V", "ZOL"
  ruimtes?: Ruimte[];
}

export interface Ruimte {
  id: string;
  verdieping_id: string;
  volgnummer: number; // Ruimte 1, Ruimte 2
  naam: string; // Alias / label (bijv. "Woonkamer")
  bruto_oppervlakte_m2?: number;
  omtrek_m1?: number;
  plafondhoogte_mm?: number;
  vloerverwarming: boolean;
  type_dekvloer?: 'zandcement' | 'calciumsulfaat_anhydriet' | 'hout' | 'monoliet_beton';
  ondervloer_type?: string;
  vochtpercentage?: number;
  vlakken?: Vlak[];
}

export interface Vlak {
  id: string;
  ruimte_id: string;
  type: 'wand' | 'vloer' | 'plafond' | 'dakvlak' | 'trap';
  code: string; // "Wand A", "Vloer", "Plafond"
  ondergrond_materiaal?: string;
  posities?: Positie[];
}

export interface PositieCluster {
  id: string;
  ruimte_id: string;
  naam: string; // bijv. "Erker voorgevel" of "Raampartij links"
  positie_ids: string[];
}

export interface Positie {
  id: string;
  vlak_id: string;
  cluster_id?: string;
  volgnummer: number;
  naam: string; // "Raam links", "Vloer zithoek"
  maatstatus: 'concept' | 'definitief';
  handmatige_override: boolean;
  dagmaat_b1_mm?: number;
  dagmaat_b2_mm?: number;
  dagmaat_b3_mm?: number;
  dagmaat_h1_mm?: number;
  dagmaat_h2_mm?: number;
  dagmaat_h3_mm?: number;
  productiemaat_breedte_mm?: number;
  productiemaat_hoogte_mm?: number;
  montagehoogte_mm?: number; // Universal Mounting Height t.b.v. EN 13120
  doorlopend_vanuit_positie_id?: string; // Vloerdoorloop
  inspectie_resultaten?: InspectieResultaat[];
  product_toewijzingen?: ProductToewijzing[];
  version_id: number;
}

export type ProductStatus = 'draft' | 'definitief' | 'geleverd' | 'gereed';

export interface ProductToewijzing {
  id: string;
  positie_id: string;
  laag_suffix?: string; // 'a', 'b', 'c' bij ≥ 2 lagen
  artikel_code_erp: string;
  artikel_omschrijving: string;
  productgroep: 'gordijnen' | 'raamdecoratie' | 'vloeren' | 'trappen' | 'buitenzonwering' | 'diensten';
  montagewijze: 'in_de_dag' | 'op_de_dag' | 'in_het_kozijn' | 'op_het_kozijn' | 'tussen_twee_muren' | 'plafond' | 'wand' | 'verlijmd' | 'zwevend' | 'n.v.t.';
  eenheid: 'm2' | 'm1' | 'stuks' | 'pak' | 'set' | 'dagdeel' | 'forfait' | 'stuks_knelpunten';
  tariefeenheid_diensten?: 'uur' | 'm1' | 'm2' | 'stuk' | 'forfait';
  aantal_besteld: number;
  status: ProductStatus;
  rekenformule?: string;
  dimension_spec?: DimensionSpec;
  prijs_incl_btw: number;
  opmerkingen?: Opmerking[];
  issues?: Issue[];
}

// Polymorfe Dimensie- en Calculatiespecificaties per Productgroep
export type DimensionSpec =
  | CurtainDimensionSpec
  | BlindDimensionSpec
  | FloorDimensionSpec
  | StairDimensionSpec
  | OutdoorDimensionSpec
  | ServiceDimensionSpec;

export interface CurtainDimensionSpec {
  type: 'gordijnen';
  referentie_type: 'blijvende_maat' | 'bruto_maat';
  confectiehoogte_mm: number;
  railbreedte_mm: number;
  plooitype: 'enkel' | 'dubbel_vlinder' | 'wave' | 'retourplooi';
  stofbreedte_cm: number;
  rapport_hoogte_cm?: number;
  aantal_banen: number;
  stofverbruik_m1: number;
}

export interface BlindDimensionSpec {
  type: 'raamdecoratie';
  montagewijze: 'in_de_dag' | 'op_de_dag' | 'op_raamvleugel';
  b1_mm: number;
  b2_mm: number;
  b3_mm: number;
  h1_mm: number;
  h2_mm: number;
  h3_mm: number;
  strakste_dagmaat_b_mm: number;
  strakste_dagmaat_h_mm: number;
  productiemaat_b_mm: number;
  productiemaat_h_mm: number;
  bediening: 'ketting_links' | 'ketting_rechts' | 'motor_24v' | 'motor_solar' | 'handgreep';
  pakkethoogte_mm?: number;
}

export interface FloorDimensionSpec {
  type: 'vloeren';
  netto_oppervlakte_m2: number;
  legpatroon: 'wildverband' | 'diagonaal' | 'visgraat' | 'hongaarse_punt';
  snijverlies_percentage: number;
  bruto_oppervlakte_m2: number;
  pakinhoud_m2?: number; // Bij harde vloeren (laminaat, PVC)
  aantal_pakken?: number;
  rolbreedte_cm?: 400 | 500; // Bij tapijt/vinyl op rol
  strekkende_meters_m1?: number;
  vleugrichting_graden: number;
  plintlengte_m1: number;
  deurspeling_status: 'akkoord' | 'advies_inkorten';
  advies_inkorten_aantal?: number;
}

export interface StairDimensionSpec {
  type: 'trappen';
  trapvorm: 'recht' | 'onderkwart' | 'bovenkwart' | 'tweekwart' | 'bordes';
  bekledingstype: 'tapijt_volledig' | 'traploper' | 'overzettreden_pvc' | 'overzettreden_composiet';
  aantal_rechte_treden: number;
  aantal_verdreven_treden: number;
  totaal_treden: number;
  aantal_stootborden: number;
  heeft_wangen: boolean;
  loperbreedte_mm?: number;
  roedes_aantal?: number;
  pvc_rechte_dozen_a_4?: number;
  pvc_verdreven_kits_a_2?: number;
  kokers_mammoetlijm?: number;
  led_traptreden_aantal?: number;
}

export interface OutdoorDimensionSpec {
  type: 'buitenzonwering';
  systeemtype: 'knikarmscherm' | 'ritsscreen' | 'rolluik' | 'markies';
  montagewijze: 'gevel_op_de_dag' | 'in_de_dag' | 'plafond_uitval';
  breedte_mm: number;
  uitval_of_hoogte_mm: number;
  windklasse: 'klasse_1' | 'klasse_2' | 'klasse_3' | 'klasse_4' | 'klasse_5' | 'klasse_6'; // NEN-EN 13561 windklassen 1..6
  kastmaat_mm?: 137 | 150 | 165 | 180 | 205; // Gestandaardiseerde kastmaten rolluiken
  kastvorm?: '45_graden' | 'rond' | 'half_rond'; // Kastvormprofiel
  inbraakwerendheid_rc?: 'geen' | 'RC2' | 'RC3'; // NEN-EN 1627 met optilbeveiliging
  valbeveiliging_nen2608?: boolean; // NEN 2608 / NEN-EN 1991-1-1 doorvalbeveiliging
  gevelconstructie: 'spouwmuur_baksteen' | 'beton' | 'kalkzandsteen' | 'gevelisolatie_etics';
  verankeringstype: 'keilbout' | 'chemisch_anker_m10' | 'chemisch_anker_m12' | 'afstandsbussen_staal';
  bediening: 'somfy_io_230v' | 'solar_accu' | 'handmatig_oogwindwerk';
  motorzijde: 'links' | 'rechts';
  sensor_type?: 'geen' | 'zon_wind_automaat' | 'trillingssensor_eolis';
}

export interface ServiceDimensionSpec {
  type: 'diensten';
  dienst_type:
    | 'gordijn_rail_montage'
    | 'binnenzonwering_montage'
    | 'vloer_legservice'
    | 'trap_stoffering_montage'
    | 'buitenzonwering_montage'
    | 'inmeet_schouw_service'
    | 'sloop_egalisatie_service'
    | 'logistiek_materieel_service'
    | 'overige_diensten'
    | 'sloop_ondergrond'
    | 'egalisatie'
    | 'deuradvies'
    | 'verticaal_transport'
    | 'montage_algemeen';
  tariefeenheid?: 'uur' | 'm1' | 'm2' | 'stuk' | 'forfait';
  ondergrond_sanering_m2?: number;
  egalisatie_laagdikte_mm?: number;
  advies_deuren_inkorten?: boolean;
  aantal_deuren_knelpunten?: number;
  verticaal_transport_ladderlift?: boolean;
  afvalcontainer_plaatsing?: boolean;
  opmerkingen_montagelogistiek?: string;
}

// 3. Documentair, Inspectie & Kwaliteit
export interface InspectieResultaat {
  id: string;
  positie_id?: string;
  ruimte_id?: string;
  type: 'vocht' | 'vlakheid' | 'kinderveiligheid_en13120' | 'vloerverwarming' | 'leidingdetectie' | 'obstakel';
  waarde_gemeten: string | number;
  eenheid?: 'CM-%' | 'mm' | 'klasse';
  norm_grenswaarde?: string | number;
  akkoord: boolean;
  toelichting?: string;
  foto_ids?: string[];
}

export interface RapportDossier {
  id: string;
  project_id: string;
  afspraak_id?: string;
  type: 'Meetrapport' | 'Montagerapport' | 'Afterservicerapport';
  status: 'concept' | 'definitief_ondertekend';
  klant_akkoord_verklaring: boolean;
  klant_handtekening_blob?: string;
  uitvoerder_handtekening_blob?: string;
  getekend_op?: string;
  document_url_pdf?: string;
  vorderingen_voldaan: boolean;
  version_id: number;
}

export interface Media {
  id: string;
  entiteit_type: 'object' | 'verdieping' | 'ruimte' | 'vlak' | 'positie' | 'product';
  entiteit_id: string;
  media_type: 'foto' | 'video';
  uri: string;
  titel?: string;
  rol: 'situatie_vooraf' | 'technisch_detail' | 'obstakel' | 'eindresultaat' | 'garantiesticker';
  auteur: string;
  created_at: string;
}

export interface Opmerking {
  id: string;
  entiteit_type: 'object' | 'verdieping' | 'ruimte' | 'vlak' | 'positie' | 'product';
  entiteit_id: string;
  type: 'notitie' | 'instructie' | 'openstaande_actie';
  tekst: string;
  foto_ids?: string[];
  opgelost?: boolean;
  auteur: string;
  created_at: string;
  resolved_at?: string;
}

export interface Notitie {
  id: string;
  entiteit_type: 'object' | 'verdieping' | 'ruimte' | 'vlak' | 'positie' | 'product';
  entiteit_id: string;
  media_id?: string; // Optionele binding aan foto
  tekst: string;
  auteur: string;
  created_at: string;
}

export interface Issue {
  id: string;
  product_toewijzing_id: string;
  project_id: string;
  afspraak_id?: string; // Gekoppelde Afterservice-afspraak
  titel: string;
  beschrijving: string;
  status: 'open' | 'in_behandeling' | 'ingepland' | 'opgelost';
  ernst: 'laag' | 'middel' | 'kritiek_blokkerend';
  created_at: string;
  resolved_at?: string;
  resolutie_notitie?: string;
}

// 4. Planning, Kalender & Inhoudelijke Afspraken (Scheiding der Machten)
export interface KalenderAfspraak {
  id: string;
  project_id: string;
  type: 'inmeting' | 'hermeting' | 'montage' | 'afterservice' | 'servicebezoek';
  status: 'concept' | 'ingepland' | 'onderweg' | 'aangekomen_bezig' | 'afgerond' | 'geannuleerd' | 'verplaatst';
  datum: string; // YYYY-MM-DD
  tijdvak_start: string; // HH:mm
  tijdvak_eind: string;
  uitvoerder_ids: string[];
  voertuig_kenteken?: string;
  klimmaterieel_nodig: boolean;
  stalen_meenemen?: string[];
  sleutel_instructie?: string;
  parkeer_instructie?: string;
  ruimte_ids?: string[];
  positie_ids?: string[];
  product_toewijzing_ids?: string[];
  vertrokken_at?: string;
  aangekomen_at?: string;
  afgerond_at?: string;
  notities?: string;
  rapport_type?: 'Meetrapport' | 'Montagerapport' | 'Afterservicerapport';
  version_id: number;
  created_at: string;
  updated_at: string;
}

export interface WerkafspraakEnMontageconditie {
  id: string;
  project_id: string;
  niveau: 'positie' | 'ruimte' | 'project';
  ruimte_id?: string;
  positie_id?: string;
  categorie: 'plinten' | 'ondervloer_sloop' | 'deuren_inkorten' | 'leidingwerk_risico' | 'bouwkundige_vlakheid' | 'conceptmaten_disclaimer' | 'aanwezigheid_klant' | 'chemische_verankering' | 'algemene_conditie';
  titel: string;
  omschrijving: string;
  verantwoordelijke_partij: 'winkelier' | 'monteur' | 'klant' | 'derde_aannemer';
  status: 'overeengekomen' | 'concept' | 'gewijzigd' | 'vervallen';
  bron: 'offerte' | 'inmeting' | 'showroom_overleg';
  klant_akkoord: boolean;
  akkoord_datum?: string;
  version_id: number;
  created_at: string;
  updated_at: string;
}

export type InhoudelijkeAfspraak = WerkafspraakEnMontageconditie; // Backward-compatible type alias
```

#### 4.9.2 Optimistic Concurrency Control (OCC) & Conflictresolutie
* **Detectie via `version_id`:** Elke mutatie op Project-, Positie- of Afspraakniveau verhoogt de `version_id`.
* **HTTP 409 Conflict:** Indien een update wordt ingediend met een verouderde `version_id`, weigert de backend de mutatie met `HTTP 409 Conflict`. De client toont direct een diff-modal met de recente wijzigingen van de collega en biedt een merge-mogelijkheid.
* **Freeze Invariant voor Definitieve Maten (INV-STATE-01):** Zodra een inmeter een positie op maatstatus `definitief` zet, wordt het record bevroren (`frozen_at: timestamp`). Wijzigingen vereisen een expliciete handmatige deblokkering met verplichte audit-log reden.
* **Project Closure Gating Invariant (INV-GATE-01):**
  $$\text{canCloseProject} \iff (\text{project.status} = \text{'Geleverd'}) \land (\text{count}(\text{issues.status} \ne \text{'opgelost'}) = 0)$$

---

## Deel 5: Het Portaal: Functioneel Ontwerp, UX/UI, Schermen & Data-Driven State Machine

### 5.1 Overkoepelende UX/UI-Architectuur, State-Gating & Systeemafbakening
Het **EasyM2M Portaal** is ontworpen als een geïntegreerde 'Single Source of Truth' (SSOT) omgeving voor de woninginrichting. Het platform brengt het complete traject van verkoopadvies, inmeting op locatie, calculatie, planning en montage naadloos samen in één centraal, dynamisch dossier.

* **UI/UX Design Governance & Usability Baseline:**  
  Het portaal wordt ontworpen conform enterprise usability-standaarden en governance-richtlijnen van de *Robust Engineering Architectuur*:
  * *NN/g Heuristic 8 (Aesthetic & Minimalist Design):* Geen overbodige permanente zijbalken of schermvervuiling. Informatie die niet direct noodzakelijk is voor de actieve taak wordt contextueel en op aanvraag (on-demand via drawers of popovers) aangeboden.
  * *Buitendienst Touch Ergonomie & Fitts' Law (INV-UI-02):* Alle interactieve elementen, knoppen, selectoren en touch-targets op tablets en mobiele apparaten voldoen verplicht aan de minimale fysieke afmeting van **44×44px** (`min-h-[44px] min-w-[44px]`), zodat inmeters op de ladder en verkopers in de showroom foutloos met één hand kunnen navigeren.
  * *Clean Component Separation & Zero Cumulative Layout Shift (CLS):* Duidelijke scheiding tussen visuele presentatielagen en proceslogica; stabiele schermindelingen zonder verspringende interfaces tijdens data-invoer.

* **Data-Driven State Machine & Status-Gating (INV-STATE-01):**  
  Het portaal sluit gebruikers **niet** op in starre, lineaire procesfasen of statische wizards.
  1. *Status als Berekende Eigenschap van de Data:* Het projectdossier heeft een status die mathematisch en deterministisch voortvloeit uit de geaggregeerde *state* van de onderliggende data-entiteiten (posities, maten, checklists, mediadossiers, opleveringsdocumenten).
  2. *Rol-Bevoegdheid op Entiteit-States:* Rollen bepalen welke medewerker bevoegd is om specifieke *states* van data-entiteiten te wijzigen. Zo kan uitsluitend een **inmeter** ingevoerde posities en meetwaarden op de state `definitief` zetten (verkopers kunnen deze status niet toekennen).
  3. *Systeembrede Gatekeeper over Alle Transitiegrenzen:* De data-driven gatekeeper (`INV-STATE-01`) bewaakt mathematisch de workflow- en statusovergangen in de keten.
#### 5.1.1 De 4 Canonieke Data-Driven Macro-Projectstatussen & Transities (INV-STATE-01)
Het projectdossier doorloopt deterministisch 4 macro-overgangen tussen de 5 vaste projectstatussen (`Intake` → `Offerte` → `Order` → `Geleverd` → `Afgerond`):
1. **Transitie 1: `Intake` → `Offerte`:** Calculatie en offerte kunnen **altijd direct worden opgesteld**, hetzij na inmeting ter plekke (Traject A), hetzij direct in de showroom op basis van klantmaten of richtmaten (Traject B). Een definitief inmeetrapport is **nadrukkelijk géén voorwaarde** voor het uitbrengen van een offerte.
2. **Transitie 2: `Offerte` → `Order` (Commercieel Akkoord):** Een verkooporder kan direct worden geaccordeerd en gesloten (bijv. klant accordeert direct in de showroom met globale of eigen maten). Een definitief of getekend meetrapport is **géén blokkerende voorwaarde** voor het sluiten van een order. In alle gevallen is de resulterende projectstatus uniform **Order**:
        * *Order met Definitieve Maten:* Indien reeds vooraf ingemeten, staat de maatstatus van de posities direct op `definitief`.
        * *Order met Conceptmaten:* Wordt een order geaccordeerd zónder definitieve inmeting, dan is de projectstatus onverminderd **Order**, maar staat de maatstatus van (een van) de posities op `concept`. "Nog nameten / inmeten" is hierbij een **procesactie** (geen projectstatus). Zelfs indien 9 van de 10 posities definitief zijn en slechts 1 maat op concept staat, blijft de projectstatus `Order` en toont het portaal contextueel de waarschuwing:  
          `⚠️ [Melding: Order bevat conceptmaten — Inmeting/nameten vereist vóór bestelling/productie!]`.
3. **Transitie 3: `Order` → `Geleverd` (Montage & Oplevering):** Beschikbaar zodra de projectstatus `Order` is. De monteur doorloopt verplicht de visuele nulmeting. Na afronding van de montagewerkzaamheden en het verzenden van het digitale **Montagerapport** via `[ Rapport Maken ]` springt de berekende projectstatus deterministisch op **Geleverd**.
4. **Transitie 4: `Geleverd` → `Afgerond` (Projectafsluiting — INV-GATE-01):** Het projectdossier kan via de actieknop `[ Project Sluiten / Afronden ]` definitief worden overgezet naar de eindstatus **Afgerond** uitsluitend indien `project.status === 'Geleverd'` én er 0 openstaande service-issues resteren.
#### 5.1.2 Transversale Procesacties (Inmeten, Inkoop in ERP & Afterservice)
* **Procesactie A: Inmeetafspraak & Meetrapport (Transversaal):** Inmeten is géén statische projectstatus maar een procesactie. Een inmeetafspraak kan worden ingepland bij status `Intake`, `Offerte` óf `Order`. Na afronding zet de inmeter de posities op `definitief` en genereert het **Meetrapport** (via `[ Rapport Maken ]`).
* **Procesactie B: Inkoop & Bestellen in LogicTrade ERP (INV-ERP-02):** Bestellen en inkopen is 100% het domein van LogicTrade ERP en vormt géén onderdeel van EasyM2M. Er bevindt zich in het portaal dan ook géén bestelknop; het project behoudt in EasyM2M de status `Order`.  
* **Procesactie C: Restpunten, Issues & Afterservice-afspraken:** Registratie van service-issues ontgrendelt op Hoofdscherm 4 de actie `[ Afterservice Afspraak Plannen ]`. De servicemonteur lost issues op en legt dit vast in een **Afterservicerapport** (via `[ Rapport Maken ]`).

* **Systeemafbakening met LogicTrade (ERP) en Fase 4 (INV-ERP-02):**  
  Het portaal richt zich zuiver op de ruimtelijke hiërarchie, de inmeetpraktijk, visuele verificatie en de fysieke montage op locatie.
  * *Geen Validatieknop naar ERP in het Portaal:* Het portaal bevat géén technische 'validatieknop' om orders vrij te geven naar LogicTrade.
  * *Fase 4 is een Interne ERP-Check:* Fase 4 is een administratieve en technische controle **binnen LogicTrade** waarin de werkvoorbereider/ordercontroleur toetst of alle orderregels in het ERP 1-op-1 overeenkomen met de papieren opname en het digitale inmeetverslag. De inkooporders staan op dat moment in LogicTrade klaar om daadwerkelijk bij fabrikanten en toeleveranciers besteld te worden.

---

### 5.2 Navigatiestructuur: Slanke Header & De 6 Hoofdschermen

Om maximale werkruimte, rust en een snelle taakfocus te bieden, hanteert het portaal een **slanke universele header met context-subheader** gecombineerd met **6 logische hoofdschermen**:

```text
+-------------------------------------------------------------------------------------------------------------------------------+
| SLANKE HEADER: [Logo] | Home | Klant | Object | Project | Ruimte | Product | [🔍]         | Inlog: Jan (GSW)       |
+-------------------------------------------------------------------------------------------------------------------------------+
| CONTEXT-SUBHEADER: Familie Jansen | Keizersgracht 42, Amsterdam | 20261030-001 | Woonkamer | Status: Order                    |
+-------------------------------------------------------------------------------------------------------------------------------+
| TAAKGERICHT HOOFDCANVAS (Volledige schermbreedte afgestemd op de geselecteerde entiteit)                                     |
+-------------------------------------------------------------------------------------------------------------------------------+
```

#### 1. De Slanke Universele Header & Context-Subheader
* Vaste statusbalk bovenaan het scherm die overal identiek blijft.
* **Ingelogde Medewerker:** Toont rechts de naam en organisatie van de ingelogde gebruiker (bijv. *"Jan (GSW)"*).
* **Hoofdmenu (Rij 1):** Directe horizontale navigatie tussen de 6 hoofdschermen (`Home`, `Klant`, `Object`, `Project`, `Ruimte`, `Product`). Geoptimaliseerd voor touch-bediening op tablets; schaalt bij compacte schermformaten responsief naar een toegankelijk hamburgermenu.
* **Context-Subheader (Rij 2):** Progressieve contextuele statusbalk direct onder het hoofdmenu die dynamisch inzicht biedt in de actieve werkcontext:
  * *Progressieve weergave:* Is er nog niets geselecteerd, dan is de balk rustig en leeg. Zodra er keuzes worden gemaakt, toont de balk progressief en zonder beschrijvende voorvoegsels zuiver de actieve waarden: Klant (bijv. *Familie Jansen*), Klant + Object (bijv. *Keizersgracht 42, Amsterdam*), Klant + Object + Project-ID (strikt `YYYYMMDD-xxx` formaat, bijv. *20261030-001*), inclusief de geselecteerde Ruimte (bijv. *Woonkamer*) en de actuele macro-projectstatus (bijv. *Order*). De projectomschrijving wordt hier bewust niet getoond om de header strak en compact te houden.
  * Elk segment in de subheader is direct interactief en klikbaar om met één tik terug te springen naar de betreffende detailcontext.
* **Compact Zoekicoon met Popover `[🔍]`:** De header bevat een compact zoekicoon `[🔍]`. Klikken of aantikken opent een snelle zoek-popover (voor klantnamen, objectadressen, projectnummers en ordercodes).
  * *Intelligente Contextnavigatie:* Bevindt de gebruiker zich reeds op een specifiek entiteitsscherm (bijv. Klant) en hoort het zoekresultaat bij die entiteit, dan wordt het resultaat direct in het actieve scherm geladen. In alle andere situaties navigeert het systeem direct naar Hoofdscherm 4 (Project) met het gekozen dossier als actieve context.

---

#### 2. Hoofdscherm 1: Home (Cockpit, Snelle Intake & Dagagenda van Vandaag)
* **Centrale Cockpit:** Landingsscherm voor ingelogde medewerkers van de woninginrichter.
* **Centrale Intake via `+ Nieuw Project`:** Alle nieuwe dossiers starten uniform via de centrale knop:
  * `[ + Nieuw Project ]` &rarr; Opent een gestroomlijnde 3-staps intake-wizard:
    1. *Stap 1: Klant selecteren of aanmaken* (zoek bestaande klant of maak direct een nieuwe particuliere/zakelijke relatie aan).
    2. *Stap 2: Montageadres / Object selecteren of toevoegen* (kies bestaand object of voer nieuw adres/kavel in).
    3. *Stap 3: Project initialiseren* (direct starten van het verkoop- en inmeetdossier).
* **Projectgekoppelde Werkvoorraad:** Planning en afspraken zijn primair geankerd aan het concrete project (Hoofdscherm 4). Op Hoofdscherm 1 toont het portaal de snelle project-intake en recente projectactiviteit. Een geavanceerde rol-overstijgende dagagenda op dit niveau is gealloceerd naar de V2 Backlog.
* **Recente Activiteit:** Overzicht van recent gewijzigde projecten, standaard gesorteerd op `laatste wijziging DESC`.

---

#### 3. Hoofdscherm 2: Klant (Relatiebeheer & Communicatiehistorie)
* **Klantdetailweergave:** Toont alle stamgegevens van de geselecteerde klant (naam, contactgegevens, e-mail, telefoonnummer, debiteurennummer en factuuradres).
* **Meerdere Montageadressen / Objecten:** Een klant kan één of meerdere montageadressen/objecten bezitten (analogie met bezorgadressen; essentieel voor particulieren met een tweede woning of zakelijke B2B-klanten met meerdere vestigingen en panden).
* **Gekoppelde Projecten:** Overzicht van alle lopende en historische projecten van deze klant, gegroepeerd per montageadres/object.
* **Diepe Doorkliknavigatie:**
  * Klikken op een montageadres linkt direct door naar het betreffende **Objectscherm** (Hoofdscherm 3).
  * Klikken op een project linkt direct door naar het betreffende **Projectscherm** (Hoofdscherm 4).
* **Fallback bij Geen Selectie:** Indien er geen specifieke klant is gekozen, toont de pagina direct een overzichtelijke lijst van alle klanten van de retailer, standaard gesorteerd op `laatste wijziging DESC`.
* **CRU-Functionaliteit (Geen Delete):** Volledige ondersteuning voor Create, Read en Update. Er is nadrukkelijk **géén delete-knop** aanwezig (een delete zou in de praktijk uitsluitend bij overlijden aan de orde zijn; dit wordt in V1 nadrukkelijk niet gefaciliteerd om data-integriteit te borgen).
* **Direct Toevoegen:** Vanuit het klantscherm kan de adviseur met één klik direct nieuwe montageadressen (objecten) en nieuwe projecten toevoegen.

---

#### 4. Hoofdscherm 3: Object / Montageadres
* **Objectgegevens:** Toont de fysieke gegevens van het montageadres en de ruimtelijke context (in eerste instantie tekstueel adres, in latere fases uitbreidbaar met bouwtekeningen en pandkenmerken).
* **Ruimtelijke Hiërarchie & Visuele Structuur (Boom- & Kaartenweergave):**  
  Geeft een overzichtelijke visuele structuur (visuele boom- of kaartenweergave) van de aan het object gekoppelde ruimtelijke niveaus conform Deel 2: *Verdiepingen → Ruimtes → Vlakken → Posities & Positie-clusters*.
  * **Volledige CRUD op Alle Niveaus:** Directe en intuïtieve CRUD (Create, Read, Update, Delete) op alle ruimtelijke niveaus: verdiepingen, ruimtes, vlakken, posities, positie-clusters en specifieke montagelocaties.
  * **Default Indeling bij Aanmaken:** Elk nieuw object start met een overzichtelijke standaard boomstructuur:  
    `Object (<straat> <huisnummer> <plaats>) → Begane Grond (BG) → Ruimte 1 → Vlak 1 → Positie 1`.  
    *(Het topniveau Object toont het adres en is niet deletebaar in de boom; met één enkele klik op de Object-rij opent de gebruiker direct het Object — het eigenschappen-/detailpaneel van het object — voor inspectie en bewerking van adres- en montagedata).*
  * **Bediening & Knoppen per Niveau:**
    * Elk niveau heeft een duidelijke **naam** en een uniek **ID**.
    * **`[+]` Knop:** Maakt direct een onderliggend niveau aan (bijv. een nieuwe Ruimte onder BG, een nieuw Vlak onder een Ruimte, of een nieuwe Positie onder een Vlak).
    * **`[×]` Knop:** Verwijdert het desbetreffende niveau (met bevestiging indien er onderliggende entiteiten aanwezig zijn).
    * **Inline Editing:** Klikken of aantikken van de naam opent direct inline tekstbewerking om het niveau te hernoemen.
  * **Positie-Clusters Samenstellen:** Meerdere posities kunnen eenvoudig worden geselecteerd via **longpress (lang indrukken)** op touchscreens (of rechtermuisklik / expliciete selectiemodus op desktop) en via drag-and-drop of actiebalk worden samengevoegd tot een **Positie-cluster** (bijv. een doorlopende pui of samengestelde erker). Het cluster krijgt een overkoepelende naam en wordt geïdentificeerd aan de hand van de onderliggende positie-IDs.
  * **Sub-posities Exclusief op Hoofdscherm 4:** Sub-posities (`1a`, `1b`...) kunnen op Hoofdscherm 3 nadrukkelijk **niet** worden aangemaakt. Zij vertegenwoordigen productlagen en ontstaan uitsluitend functioneel zodra er in de matrix op Hoofdscherm 4 (Project) concrete producten of diensten aan een positie of cluster worden toegewezen.
* **Fallback bij Geen Selectie:**
  * Is er geen specifiek object gekozen, maar wel een klant geselecteerd? Het scherm toont alle objecten van die gekozen klant.
  * Is er ook géén klant geselecteerd? Het scherm toont alle objecten van de retailer gesorteerd op `projectchangedate DESC`.
* **CRUD-Functionaliteit & Logische Deletes:** Objecten kunnen worden toegevoegd, gewijzigd en **logisch worden beëindigd** door een *einddatum* aan het object te koppelen (waardoor historische projectdata en meetdossiers te allen tijde bewaard blijven).

---

#### 5. Hoofdscherm 4: Project & De Dynamische Hiërarchische Matrix (De 3-Zone Architectuur)
De centrale visuele werkruimte van het project is georganiseerd volgens een modulaire **3-Zone Architectuur**:

##### Zone 1: Project Header & Status-Balk (INV-UI-04)
* **Projectcontext:** Toont de gekoppelde klantgegevens, het montageadres (object), debiteurennummer en projectnummer.
* **De Actuele Data-Driven Projectstatus:** In de header van Hoofdscherm 4 is **uitsluitend de actuele berekende status** van het project zichtbaar (een van de 5 canonieke statussen: `Intake`, `Offerte`, `Order`, `Geleverd` of `Afgerond`). Er wordt géén statische procespijplijn getoond waarin alle 5 statussen tegelijk zichtbaar zijn.
* **Conceptmaten-Statusindicator:** Indien er $\ge 1$ positie in het project de maatstatus `concept` heeft, toont de header een compact, subtiel rood **Draft** status-icoon met interactieve hover-tooltip (*"Dossier bevat nog conceptmaten — definitief nameten vereist vóór productie/montage"*). Er wordt géén opdringerige of schermverstorende amber waarschuwingsbanner getoond.
* **De Canonieke Contextuele Actieknoppen:** Op Hoofdscherm 4 bevinden zich actieknoppen die contextueel ontgrendelen op basis van de actuele projectstatus en de staat van de onderliggende data:
  1. `[ Inmeten Starten ]` &rarr; Directe actieknop voor de inmeter op locatie om de inmeetworkflow te activeren en posities definitief te maken via `[ Definitief Maken ]`.
  2. `[ Inmeetafspraak Plannen ]` &rarr; Altijd direct beschikbaar zolang maten op `concept` staan of indien hermeten gewenst is. Opent de `AfspraakPlannerModal` (§5.10.1).
  3. `[ Rapport Maken ]` &rarr; Geünificeerde rapportknop die op elk gewenst moment een compleet PDF-dossier genereert via een modale dialoog (*Meetrapport*, *Montagerapport*, *Afterservicerapport*). Het *Meetrapport* kan te allen tijde worden gegenereerd (ook tussentijds tijdens intake of conceptfase).
  4. `[ Montageafspraak Plannen ]` &rarr; Beschikbaar zodra de macro-projectstatus `Order` is (de planner behoudt de flexibiliteit om conform Route B / §1.5.6 vooruit te plannen bij harde deadlines). Indien er nog posities met maatstatus `concept` aanwezig zijn, toont het planningsscherm de tooltip-notificatie dat nameten vereist is.
  5. `[ Starten Montage ]` &rarr; Dwingend en mechanisch vergrendeld (hard-gated via `INV-ORDER-02`) zolang er nog $\ge 1$ positie in het project de maatstatus `concept` heeft! Montage kan pas daadwerkelijk worden gestart wanneer álle posities de status `definitief` hebben bereikt (`all_positions_definitive == true`).
  6. `[ Afterservice Afspraak Plannen ]` &rarr; Wordt direct actief zodra er $\ge 1$ openstaande actie op productniveau is geregistreerd. Opent de planning voor een servicebezoek.
  7. `[ Project Sluiten / Afronden ]` &rarr; Uitsluitend actief wanneer `products.length > 0`, 100% van de producten de status `'gereed'` bezit én er 0 openstaande acties resteren. Zet de status deterministisch op **Afgerond**.
* **Verplichte Pre-Action Checklist Gate & Checklist-Beheermodule:**  
  Vóórdat elk van deze acties definitief kan worden uitgevoerd of geopend, toont het portaal eerst een **verplichte checklist** (`PreActionChecklistDialog` §5.10.3) die de gebruiker moet doorlopen en afvinken. Zonder het succesvol doorlopen van de specifieke pre-action vragenlijst (bijv. bereikbaarheid klant en parkeersituatie vóór inmeetplanning; goederenstatus en hulpmiddelen vóór montageplanning) kan de actie niet worden voltooid.
  * **Checklist-Beheermodule (Centraal & Contextueel Beheer):**
    * *Contextueel Pennetje `[✏️]`:* Wanneer een gebruiker met beheerdersrechten is ingelogd, wordt bij elke individuele checklistregel in het portaal een direct bewerkpennetje (`min-h-[44px] min-w-[44px]`) getoond. Een klik hierop opent direct de beheermodule gefilterd op die specifieke regel voor directe aanpassing.
    * *Regelbeheer Scherm:* Scherm binnen de beheermodule voor het aanmaken, bewerken, configureren van het invoertype (tekst, getal, ja/nee, keuzeopties, handtekening) en het instellen van dynamische weergavecondities voor individuele checkvragen.
    * *Overzichtsscherm Ketenacties & Verplichte Media-Checks:* Centraal overzichtsscherm waarin alle procesacties en verplichte checks ketenbreed worden beheerd en geconfigureerd (zoals verplichte videorondgang van looproutes en vertrekken, detailfoto's van kozijnen en ondergronden, opmerkingen, Arbo-veiligheidsvragen en opleverhandtekening).

##### Zone 2: Contextuele Dossier-Panels (Inklapbaar / Tabbladen)
Onder de header bevindt zich een inklapbaar paneel met vier tabbladen die direct inzicht bieden in afspraken, condities, contractuele documenten en financiën:
* **Tab A: Bezoeken & Planning (Operationele Agenda):**  
  * Overzicht van alle geplande, actieve en historische kalenderafspraken gekoppeld aan dit project (inmetingen, hermetingen, montages, afterservice-bezoeken).
  * Toont per afspraak: datum, tijdvak, type, statusbadge (`concept`, `ingepland`, `onderweg`, `aangekomen_bezig`, `afgerond`), toegewezen uitvoerders, voertuig, klimmaterieel-indicatie en de specifieke scope op ruimtes en posities (`ruimte_ids`, `positie_ids`).
  * Directe actieknop: `[ + Afspraak Inplannen ]` &rarr; Opent de `AfspraakPlannerModal` (§5.10.1).
* **Tab B: Integrale Conditie- & Afsprakenspiegel (Geaggregeerde Samenvatting):**  
  * Dit tabblad is nadrukkelijk **géén operationele agenda** (de agenda bevindt zich in Tab A), maar fungeert als de **centrale geaggregeerde samenvattingsspiegel** van alle contractuele en uitvoeringscondities van het dossier. Hier worden alle afspraken die op Positie-, Ruimte- of Projectniveau zijn geregistreerd in één overzichtelijk dashboard gebundeld getoond (conform AST #2 feedback):
    * *Plinten:* Wie levert de plinten, wie monteert ze, en wie verzorgt het afkitten (`winkelier` vs. `klant`).
    * *Ondervloer & Sloop:* Wie sloopt en voert de oude vloerbedekking/tegels af (`klant` vs. `winkelier` als meerwerk).
    * *Binnendeuren inkorten:* Strikt geclassificeerd als verantwoordelijkheid voor de klant (via eigen timmerman of aannemer) conform de bindende veiligheidsnorm van §3.4.5; monteurs korten geen binnendeuren in.
    * *Leidingwerk & Vloerverwarming:* Registratie van leidingverloop en expliciete aanwijsplicht/risico-aanvaarding door klant conform §3.4.4.
    * *Bouwkundige Vlakheid & Restvocht:* Vastgelegde toleranties, droogtijden en noodzakelijke voorbehandelingen (egaliseren, primer).
    * *Chemische Verankering & Gevel:* Specifieke montagecondities bij buitenzonwering (verankering in betonlatei vs. spouwmuur, afstandsbussen bij ETICS).
    * *Conceptmaten Disclaimer:* Expliciet voorbehoud dat conceptmaten een indicatie vormen en dat maatafwijkingen > 5% na definitieve inmeting kunnen leiden tot prijscorrecties conform §4.9.1.
    * *Aanwezigheid Klant:* Afspraken over wie aanwezig is bij aanvang en oplevering, sleuteloverdracht en parkeerinstructies.
  * Toont per conditie het toepassingsniveau (`positie`, `ruimte`, `project`), de `verantwoordelijke_partij` (`winkelier`, `monteur`, `klant`, `derde_aannemer`), status (`overeengekomen`, `concept`, `gewijzigd`), bron (`offerte`, `inmeting`, `showroom_overleg`) en of er expliciet klantakkoord is vastgelegd (`klant_akkoord: boolean` + akkoorddatum).
  * Directe actieknop: `[ + Conditie / Werkafspraak Toevoegen ]` &rarr; Opent de `InhoudelijkeAfspraakModal` (§5.10.2).
* **Tab C: Documenten & Dossier (LogicTrade & Formele Rapporten):**  
  * Directe koppeling naar documenten uit LogicTrade: offertes, orderbevestigingen, inkoopbonnen en facturen, voorzien van **directe klikbare PDF-links** (openen in een slide-over preview drawer zodat de actieve matrixstatus en selectie behouden blijven).
  * Direct overzicht van formele rapporten die binnen het portaal zijn gegenereerd en digitaal zijn ondertekend (*Meetrapport*, *Montagerapport*, *Afterservicerapport*).
* **Tab D: Financiële Samenvatting (Optioneel Overzicht):**  
  * Totaalbedragen offerte, order, openstaand saldo en betalingsstatussen (gesynchroniseerd vanuit ERP).

##### Zone 3: De Dynamische Hiërarchische Matrix
Het volledige centrale werkblad waarin alle ruimtelijke niveaus (inclusief posities en positie-clusters) overzichtelijk kruisen met generieke producten en diensten:
* **Rijen (Producten & Werkzaamheden/Diensten):** De rijen in de matrix representeren de generieke Producten / Artikelen (bijv. *Duette 25mm*, *Inbetween*, *PVC Verlijmd*) en Werkzaamheden/Diensten (bijv. *Egaliseren*, *Inmeten*, *Montage*).
* **Kolommen (Ruimtelijke Hiërarchie & Zichtbaarheid van Niveaus):** De kolommen representeren de volledige ruimtelijke hiërarchie conform Hoofdscherm 4 (*Verdieping → Ruimte → Vlak → Positie / Positie-cluster*) met volledige vrijheid in naamgeving (bijv. *"Raam links voorgevel"*, *"Schuifpui achter"*, *"Dakraam zolder"*). In de kolomkoppen is de hiërarchische groepering visueel van boven naar beneden opgebouwd, waarbij elementen van hetzelfde hiërarchische niveau op exact gelijke visuele hoogte staan.
  * *Zichtbaarheid van Niveaus (In- en Uitschakelen):* De gebruiker kan via niveautoggles eenvoudig bepalen welke ruimtelijke niveaus zichtbaar zijn in de matrix (bijv. Verdieping verbergen, uitsluitend Ruimte en Positie tonen). **Fail-safe Invariant (INV-UI-06):** Er moet te allen tijde minimaal één niveau zichtbaar blijven; het gelijktijdig uitschakelen van alle niveaus wordt door de interface geblokkeerd.
* **Sub-posities in Matrixcellen (Linkerbovenhoek):** Sub-posities (`1a`, `1b`...) worden **niet** als aparte kolommen of rijen weergegeven. Wanneer meerdere producten worden toegewezen aan één positie (of aan een positie-cluster, bijv. `1a, 2a, 3a` en `1b, 2b, 3b` voor een gecombineerde rail en gordijn), ontstaan functionele sub-posities / productlagen. De letter van de sub-positie (`a`, `b`, `c`...) wordt subtiel en compact in de **linkerbovenhoek van de desbetreffende matrixcel** getoond. Indien er op een positie slechts 1 enkel product/laag aanwezig is, wordt **géén letter** getoond (de letter verschijnt uitsluitend wanneer er daadwerkelijk meerdere productlagen op die positie zijn toegewezen).
* **Cellen & Directe Toewijzing / Navigatie (INV-UI-05):** Tonen de toewijzingen en cardinaliteiten:
  * *Lege Cel:* Aantikken of klikken op een lege matrixcel wijst het desbetreffende product of de dienst direct toe aan die positie (cardinaliteit = 1).
  * *Gevulde Cel:* Aantikken of klikken op een reeds gevulde cel opent direct de **Product Slide-over Drawer** (`MatrixProductEditDrawer` §5.10.4), waarin productspecificaties, meetwaarden, issues en toewijzingen direct bewerkt of ontkoppeld kunnen worden zonder dat de gebruiker het overzicht of de scrollpositie van de matrix verliest (een 'Volledig scherm' actieknop leidt desgewenst direct door naar Hoofdscherm 6 (Product)).
* **Niet-toegewezen Posten (Vaste Linkerkolom conform /matrix-orders):** Posten die (nog) niet aan een specifieke positie zijn gekoppeld of inherent projectbreed zijn (zoals voorrijkosten, projecttoeslagen of algemene egaline), bevinden zich in de **vaste (pinned) linkerkolom van de matrix**, identiek aan de referentie-implementatie op `http://localhost:8088/matrix-orders` (en niet onder de matrix).
* **Fallback bij Geen Selectie:**
  * Indien geen specifiek project gekozen: toont alle projecten van de actieve klant.
  * Indien ook geen klant gekozen: toont alle projecten van de retailer gesorteerd op `changedate DESC`.

---

#### 6. Hoofdscherm 5: Ruimte
* **Ruimtelijke Context:** Toont de specifieke gegevens van het vertrek (bijv. *Woonkamer*, *Keuken*, *Slaapkamer 1*, *Trap*).
* **Plattegrond & Schets:** Weergave van de 2D-plattegrond of maatschets van het vertrek.
* **Contextuele Mediatheek:** Foto's en videorondgangen kunnen direct aan de ruimte worden gekoppeld (bijv. overzichtsfoto's van lichtinval, wandafwerking of vloerconditie).
* **Hergebruik Matrixstructuur:** Toont de posities en Positie-clusters binnen deze ruimte als kolommen en de toegewezen producten/diensten als rijen, in exact dezelfde vertrouwde weergave als op projectniveau.
* **CRUD op Ruimte-Entiteiten:** Direct aanmaken, wijzigen en beheren van vlakken, posities en Positie-clusters, en het toekennen van producten aan posities (waarbij meerdere producten op één positie automatisch subposities `1a`, `1b` vormen).

---

#### 7. Hoofdscherm 6: Product
* **Productdetailweergave:** Gekoppeld aan een specifieke positie of Positie-cluster (of direct als niet-toegewezen post aan een hoger niveau/object).
* **De 5 Rol-gebaseerde Acties op het Productscherm:**  
  Het productscherm ondersteunt 5 kernactiviteiten, strikt gekoppeld aan de rol van de ingelogde medewerker en de fase van het dossier:
  1. *Verkoper (Adviseur) — Productconfiguratie in Fases & Conceptmaten:*  
     De adviseur configureert het product stapsgewijs: van initiële inspiratie en globale stof-/materiaaloriëntatie in de showroom tot een gedetailleerde concept-offerte en definitieve artikelconfiguratie. De verkoper kan direct globale klantmaten invoeren (voorzien van een duidelijke amberkleurige `[CONCEPT]` badge) om een betrouwbare conceptcalculatie te genereren.
  2. *Inmeter — [ Definitief Maken ] van Meetwaarden:*  
     De inmeter controleert de bouwkundige situatie ter plekke en legt de definitieve productiematen vast.  
     *Conditionele Gate:* De actieknop `[ Definitief Maken ]` wordt ontgrendeld zodra de inmeter de verplichte inspectiepunten en product-specifieke checklistvragen heeft doorlopen en gevalideerd. Na bevestiging krijgt de positie direct maatstatus `definitief`.
  3. *Monteur — [ Gemonteerd ] Afhandeling & Oplevering:*  
     Na afronding van de montagewerkzaamheden klikt de monteur op de actieknop `[ Gemonteerd ]`.  
     *Workflow & Status-Toekenning:*  
     * *Zonder Restpunten:* Indien het product schadevrij en compleet is geplaatst, krijgt het product direct de status `'gereed'`.  
     * *Met Restpunten of Schade:* Indien er sprake is van transportschade, productiefouten of ontbrekende delen, registreert de monteur direct een `Opmerking` van het type `openstaande_actie` met detailfoto's. Het product krijgt in dat geval de status `'geleverd'` (zodat het project in status `Geleverd` blijft totdat nazorg is voltooid).
  4. *Monteur / Servicemonteur — Afhandelen en Afvinken van Aftersales:*  
     De servicemonteur handelt openstaande service-orders of herstelwerkzaamheden voor dit product af en vinkt de herstelacties af (uitsluitend na het uploaden van herstelbewijsmateriaal en verificatie van de checklist).
  5. *Inmeter / Werkvoorbereider — [ Hermeting Vlaggen ]:*  
     Indien tijdens de verificatie of gewijzigde bouwkundige omstandigheden (zoals een nieuw aangebrachte dekvloer of stucwerk) hermeting vereist is, klikt de gebruiker op `[ Hermeting Vlaggen ]`. Na selectie van de reden in een dropdown wordt de maatstatus van de positie direct op `HERMETEN_VEREIST` gezet en ontgrendelt in het portaal direct de inmeettrigger voor de planner.
* **Issue- & Openstaande Punten Registratie op Productniveau (Aftersales & Garantie):**  
  Op het productscherm registreert de monteur, servicemonteur of adviseur **Issues / Openstaande Punten** voor het specifieke product (bijv. beschadigde lamel, klemmend mechanisme, afwijkende kleur, nalevering onderdeel):
  * *Issue Registratie & Status:* Elk geregistreerd issue krijgt een status (`Open`, `In behandeling`, `Ingepland`, `Opgelost`) en toont de gekoppelde aftersales-acties.
  * *Detailweergave van een Issue:* Bij het openen van een issue ziet de gebruiker direct de gekoppelde aftersales-actie(s). Vanuit het geopende issue kan:
    * Direct een afterservice-afspraak worden geïnitieerd (die doorverwijst naar de projectplanning).
    * Direct een **Nieuw Project** worden geïnitieerd (wanneer het issue buiten de garantie valt, bijv. door de klant veroorzaakte latere schade of een wens voor complete vernieuwing). Het nieuwe project erft automatisch de klant-, object- en positiecontext over, waarbij de historische product- en meetdata behouden blijven als referentiekader.
  * *Overkoepelende Afspraakplanning op Projectniveau (Hoofdscherm 4):* Een **Afterservice-afspraak** zelf wordt op **Projectniveau** gepland. In het projectoverzicht (Hoofdscherm 4) kan de planner/adviseur één of meerdere openstaande issues (ook over meerdere verschillende producten binnen het project heen) selecteren en hiervoor in één handeling een gecombineerde afterservice-afspraak met de servicemonteur inplannen. Dit blijft te allen tijde mogelijk, **ook nadat het oorspronkelijke project reeds is gesloten of gearchiveerd**.
* **Dynamische Technische & Esthetische Specificaties per Productgroep:**  
  Het specificatiepaneel past zich dynamisch aan op basis van de geselecteerde productgroep:
  * *Raamdecoratie:* Merk, collectie, kleur/dessin, lamelbreedte, montagewijze (in de dag / op de dag, montageprofiel vs losse steunen), bedieningszijde en type motorisering.
  * *Gordijnen & Vitrages:* Stofnummer, confectie- en plooitype (enkel, dubbel, wave), voering (lichtdoorlatend/verduisterend), pakketverdeling (links, rechts, stel) en railtype.
  * *Vloeren:* Vloertype (PVC stroken/visgraat, laminaat, parket, gietvloer), slijtlaagdikte, legmethode (verlijmd vs click), plinttype (plakplint vs hoge MDF-plint) en overgangsprofielen.
  * *Traprenovatie & Bekleding:* Uitvoering (stoffering met ondertapijt vs overzettreden CPL/hout/PVC), neusprofielen (antislip), stootborden en geïntegreerde LED-tredeverlichting.
  * *Buitenzonwering & Gevelsystemen:* Type (knikarmscherm, ritsscreen, rolluik, markies), windklasse (NEN-EN 13561), gevelconstructie & verankering (chemisch anker M10/M12, lateiboring), kastmaat, geleidertype, bediening (230V Somfy io vs Solar accu-motor) en sensoren (zon/wind/trilling).
* **Dynamische Meetgegevens per Productgroep & De UI Drie-eenheid:**  
  Het meetpaneel toont transparant de UI Drie-eenheid (Gemeten Dagmaat B1..B3 en H1..H3 $\to$ Rekenformule/Aftrek $\to$ Blijvende Bestelmaat) met automatische validatie:
  * *Raamdecoratie:* Meervoudige dagmaten (B1, B2, B3 en H1, H2, H3 in mm), strakke productiematen, aftrekmaten/spelingen voor draaikiepramen, ventilatieroosters, pakkethoogte en verplichte **Montagehoogte (MH in mm)** ten behoeve van de EN 13120 kindveiligheidscoefficient.
  * *Maatafwijkings-Alert (> 5%):* Indien de door de inmeter definitief gemeten dagmaat > 5% afwijkt van de oorspronkelijke showroom-conceptmaat, toont het scherm een attentievlag die de verkoopadviseur attendeert op een eventuele commerciële prijsherziening conform de conceptmaten-clausule.
  * *Gordijnen:* Railbreedte, hoogte vanaf plafond/rail tot vloer, gewenste vloervrijloop, pakketbreedte en afloop van vensterbanken.
  * *Vloeren:* Netto vloeroppervlakte (m²), snijverliespercentage, restvochtpercentage van de dekvloer (CM-meting verplicht bij anhydriet), speling onder binnendeuren en dilatatievoegen.
  * *Traprenovatie:* Aantal treden, tredebreedtes, optreden, aantreden, draaiingen / kwartslagen en trapwangafmetingen.
* **Inspectie- en Montagechecklisten:** Directe toegang tot de specifieke checklistpunten voor deze productgroep (§3.1 t/m §3.5), inclusief het contextuele beheerderspennetje `[✏️]`.

---

#### Overkoepelende Schermprincipes
* **Consistente Herhaling van Visuele Elementen:** Kerncomponenten (zoals de matrix en de media-uploader) keren op meerdere schermen terug met een aangepaste selectie of filtercontext.
* **Diepgaande Doorklikstructuur:** Gebruikers kunnen overal met één klik springen tussen gerelateerde entiteiten: *Klant &harr; Object &harr; Project &harr; Ruimte &harr; Product*.
* **Universeel Beeld- en Notitiebeheer op Alle Schermen & Ruimtelijke Niveaus (INV-MEDIA-01):**  
  Foto's, video's en notities kunnen flexibel worden gekoppeld aan **elk niveau van de ruimtelijke hiërarchie**: Object, Etage/Verdieping, Ruimte, Vlak, Positie én Positie-cluster. Elk hoofdscherm biedt twee georganiseerde overzichten (beide standaard aflopend gesorteerd op tijdstip: `tijdstip desc`):
  * **Galerij met Foto's & Films:** Visueel overzicht van alle vastgelegde beelden en video's binnen het actieve ruimtelijke niveau.
  * **Galerij / Overzicht met Notities:** Chronologisch tekstoverzicht van alle gemaakte notities, observaties en instructies.  
  Notities kunnen zelfstandig worden geregistreerd of direct worden gekoppeld aan een specifieke foto of video (waarbij de notitie de inhoudelijke toelichting vormt). Elk geregistreerd item bevat de volgende metadata:
  * **`timestamp`:** Nauwkeurige registratiedatum en -tijd (ISO 8601, default sortering `tijdstip desc`).
  * **`auteur`:** De actieve ingelogde gebruiker inclusief rol (bijv. *Jan de Vries (Showroomadviseur)* of *Karel Bakker (Inmeter)*).
  * **`titel` (optioneel):** Korte aanduiding van het beeldmateriaal (bijv. *"Voordeurkozijn linksboven"* of *"Overzicht zithoek"*).
  * **`ruimtelijke context`:** Het gekoppelde niveau (Object, Verdieping, Ruimte, Vlak, Positie of Cluster).  
  Media en notities erven contextueel door naar bovenliggende niveaus (foto's, video's en notities op positie-, vlak- of ruimteniveau zijn ook direct traceerbaar en filterbaar op verdieping-, project- en objectniveau).

---

### 5.3 Visuele Toewijzing & Flexibele Ruimte-Opbouw
Het portaal faciliteert directe visuele interactie en toewijzing over de volledige ruimtelijke structuur:

* **1. Directe Celtoewijzing & Toegankelijke Tik-Bediening (Tap-to-Assign conform INV-UI-03):**  
  In de Dynamische Hiërarchische Matrix worden producten en diensten direct aan posities gekoppeld door simpelweg op de kruisende matrixcel te klikken of te tikken. Voor projectbrede diensten en posten (zoals voorrijkosten, algehele egaline of afvalcontainer) vindt de toewijzing plaats in de vaste, gepinde linkerkolom van de matrix (gekoppeld aan `pos_project_algemeen`). Op tablets en touchscreens garandeert dit snelle één-vinger-bediening (min. 44×44px touch targets) zonder foutgevoelige drag-and-drop gebaren.
* **2. Directe Celtoewijzing & Drawer-Navigatie (INV-UI-05):**  
  Celinteractie in de matrix is direct en taakgericht:  
  * **Lege Matrixcel:** Aantikken of klikken op een lege cel wijst het desbetreffende product of de dienst direct toe aan de positie (cardinaliteit = 1).  
  * **Gevulde Matrixcel:** Aantikken of klikken op een reeds toegewezen cel opent direct de **Product Slide-over Drawer** (`MatrixProductEditDrawer`), waarin de productspecificaties, meetwaarden, issues en toewijzingen direct bewerkt of ontkoppeld kunnen worden zonder verlies van het matrixoverzicht of de actieve scrollpositie.
* **3. Flexibele Positie- & Subpositie-Structuur (Posities én Clusters):**  
  Binnen een ruimte kunnen posities direct worden aangemaakt. Wordt meer dan één product aan dezelfde positie **óf aan een cluster van posities** (Positie-cluster, erkerpartij of samengestelde kozijnpui) gekoppeld (bijvoorbeeld een gordijnrail, inbetween én overgordijn aan hetzelfde raamkader), dan splitst het systeem deze automatisch en transparant in subposities (bijv. *Positie 1a: Rail*, *Positie 1b: Inbetween*, *Positie 1c: Overgordijn*).
* **4. Modulair & Hiërarchisch Checklist-Framework (INV-CHK-01):**  
  Checklists zijn binnen het portaal volledig generiek en orthogonaal gemodelleerd:
  * **Universele Scope-Koppeling:** Een checklist kan flexibel worden gekoppeld aan:
    * **Procesacties:** Pre-inmeet, inmeetopname, werkvoorbereiding, pre-montage, oplevering of afterservice.
    * **Ruimtelijke Niveaus:** Object, Verdieping, Ruimte, Vlak, Positie én Positie-clusters / samengestelde puien.
    * **Producthiërarchie:** Categorie, Productgroep, Producttype, Product of Subpositie.
  * **Dynamische Evaluatiecondities per Individuele Vraag:** Elke afzonderlijke checkvraag kan worden voorzien van een specifieke weergaveconditie. Een vraag verschijnt uitsluitend in de gebruikersinterface wanneer de onderliggende parameters daadwerkelijk van toepassing zijn (bijv. conditie `ondergrond === 'anhydriet'` of `bediening === 'elektrisch'`). Hierdoor ontstaat nul formuliervervuiling en blijft het portaal overzichtelijk.
* **5. Gedifferentieerde Praktijkvoorbeelden per Productcategorie:**  
  De conditionele checklists ondersteunen alle kerndisciplines van de woninginrichter:
  * **Vloeren (PVC / Laminaat / Parket / Gietvloeren):**
    * *Vloerensloop & Afvoer Gescheiden:* Twee expliciete vinkopties: *"Bestaande vloer verwijderen/oppakken"* én *"Bestaande vloer afvoeren"*.
    * *Ondergrond & Conditie:* Type ondervloer (zandcement, anhydriet, hout, bestaande tegelvloer), restvochtmeting (CM-meting verplicht bij anhydriet vóór egalisatie), aanwezigheid van vloerverwarming/vloerkoeling inclusief opstookprotocol.
    * *Deur- en Aansluitinspectie:* Speling onder binnendeuren (advies inkorten ja/nee), plintkeuze (plakplint vs hoge MDF-plint), dilatatievoegen en overgangsprofielen.
  * **Raamdecoratie (Rolgordijnen, Horizontale/Verticale Jaloezieën, Plissés/Duette®):**
    * *Montagewijze & Profielen:* Keuze voor montageprofiel ten opzichte van losse steunen (montagegemak, strakke aansluiting, eenvoudig afklikbaar bij later schilderwerk).
    * *Kozijn- & Raaminspectie:* Draairichting (naar binnen/buiten), aanwezigheid van ventilatieroosters, hendels of raamuitzetters, aanwezigheid van een **waterkering of lekrand** (bepaalt de noodzaak van opvulprofielen) en afloop van de vensterbank/buitendorpel.
    * *Veiligheid (Child Safety):* Borging van ketting-/koordspanners op minimaal 1500 mm boven vloerniveau conform EN 13120.
  * **Gordijnen & Gordijnrails:**
    * *Bevestiging & Ondergrond:* Plafondmontage (beton vs holle gipsplaten/stucwerk, chemische ankers/hollewandpluggen) of wandmontage (lengte van de wandsteunen i.v.m. vrijloop vensterbank of convectorput).
    * *Pakket & Confectie:* Enkele plooi, dubbele vlinderplooi of wave-plooi; pakketverdeling (links, rechts of stel/midden); berekening van de pakketbreedte zodat het raam bij geopende gordijnen volledig vrijvalt.
    * *Vrijloop & Verwarming:* Vrijloop ten opzichte van radiatoren, vensterbanken en hendels ter voorkoming van schuren of warmtestuwing.
  * **Horren & Kozijnen:**
    * *Kozijntype & Materiaal:* Hout, kunststof of aluminium; draaikiepraam, naar buitendraaiend raam, dakraam of schuifpui.
    * *Inmeting Dagmaat & Sponning:* Exacte dagmaatmeting breedte/hoogte; diepte van de raamsponning; aanwezigheid van lekdorpels of buitenzonwering.
    * *Montagetechniek:* Inzethor zonder boren/schroeven (met RVS klemveren), voorzethor (wervels/magneten) of rolhor (geschroefd op of in de dag).
  * **Elektrische Bediening & Domotica:**
    * *Voedingsbron:* 230V vast netvoedingspunt (links of rechts voorbereid door installateur) vs geïntegreerde oplaadbare Li-ion accumotor.
    * *Aansturingsprotocol:* Directe afstandsbediening (bijv. Somfy RTS/io, Brel, MotionBlinds) vs slimme hub/bridge-integratie (Zigbee, Matter, Apple Home, Google Home).
  * **Trapbekleding & Traprenovatie:**
    * *Trapconstructie:* Open trap (enkel- of dubbelzijdig bekleden) vs dichte trap (met stootborden); aantal treden, aanwezigheid van draaiing/kwart; staat van de ondergrond (lijmresten verwijderen).
    * *Uitvoering:* Tapijtstoffering met ondertapijt vs traprenovatie met overzettreden (CPL/hout/PVC) inclusief geïntegreerde antislip-neusprofielen en eventuele LED-tredeverlichting.

---

### 5.4 Projectafspraken & Flexibele Planning (Inmeting, Montage & Afterservice)
* **Directe Koppeling aan het Project (Multi-Appointment conform INV-PLAN-01):**  
  Afspraken hangen functioneel en relationeel direct aan het **Project** (binnen de administratieve entiteiten-driehoek Klant → Object → Project, te onderscheiden van de bouwkundige ruimtelijke niveaus). Aan één project kunnen **meerdere afspraken** van verschillende types worden gekoppeld ($N \ge 1$), zoals een oriënterende ruwbouwschouw, controlemeting, montagedagen of afterservice-bezoeken.
  * *Zichtbaarheid op het Projectscherm:* Alle ingeplande en historische afspraken behorende bij het project zijn direct inzichtelijk op Hoofdscherm 4 (Project, Zone 2: Tab A & Tab B).
  * *Specifieke Afspraakinstructies & Opmerkingen:* Aan elke afzonderlijke afspraak kan de planner/verkoper een specifieke instructie of contextuele opmerking koppelen (bijv. *"fysieke stalen meenemen"*, *"klant 15 minuten van tevoren bellen"*, of *"sleutel afhalen bij de buren op nummer 12"*).
* **Flexibele Dataset bij Planning (SSOT conform §1.5.1):**  
  Zoals vastgelegd in de SSOT (§1.5.1) kan een afspraak direct worden ingepland zodra een klant- of projectcontact bestaat. Er geldt nadrukkelijk géén blokkerende minimale dataset: vooraf hoeven nog geen ruimtes, producten of posities te zijn gedefinieerd.
* **Verkoper / Planner Bepaalt de Tijdsduur (Geldt voor Alle Afspraken):**  
  De adviseur, verkoper of planner bepaalt te allen tijde zelf de gewenste tijdsduur van een afspraak (geldt uniform voor inmeet-, montage- en afterservice-afspraken) in overleg met de klant en monteur/inmeter. Het systeem kan een indicatieve adviestijd berekenen op basis van de globale omvang of normtijden, maar legt geen starre limieten op en blokkeert de agenda onder geen enkel beding.

---

### 5.5 Montagewerkplek, Beeldregistratie & Rapporten (Uniform Webportaal)

#### 5.5.1 Montagewerkplek op het Uniforme Webportaal (V1 MVP Scope - Actief)
* **1. Montagewerkplek op het Uniforme Webportaal (V1 MVP Scope):**  
  Voor de Versie 1 (V1 MVP) Scope werkt de monteur via het uniforme webportaal (primair Hoofdscherm 6 Product en Hoofdscherm 4 Project), responsive geoptimaliseerd voor touchscreens en tablets (44×44px touch-targets). De monteur doorloopt de volgende taken op het webportaal:
  * **Taakuitvoering in V1:**
    * De monteur opent het project op Hoofdscherm 4 en inspecteert de geplande afspraak en montagelocatie.
    * Per positie/product navigeert de monteur naar Hoofdscherm 6 (Product) voor de definitieve maten, montagewijze en specificaties.
    * Na plaatsing handelt de monteur het product af via de knop `[ Gemonteerd ]`. Bij succes krijgt het product direct status `'gereed'`; bij eventuele restpunten of transportschade registreert de monteur direct een `Opmerking` van het type `openstaande_actie` met detailfoto's en krijgt het product de status `'geleverd'`.
    * Na afhandeling van alle posities genereert de monteur het digitale **Montagerapport** via de geünificeerde knop `[ Rapport Maken ]`.
* **2. Volledige Inzage ter Voorbereiding:**  
  De monteur heeft vooraf volledige inzage in het complete projectdossier (inclusief eerdere opmerkingen, meetwaarden, foto's, situatieschetsen en montagerichtlijnen). Dit stelt de monteur in staat om de montagedag optimaal voor te bereiden en eventuele specifieke materiaaleisen of gereedschappen vooraf mee te nemen.
* **3. Schadepreventie & Beeldregistratie:**  
  * **Startopname (Status Vooraf):** Bij binnenkomst en vóór aanvang van de werkzaamheden legt de monteur de bestaande situatie van het gehele traject (entree/voordeur, corridors, trappenhuizen, liften) en van alle verschillende montageplekken en vertrekken vast via foto's en een volledige videoregistratie van de looproute. Dit vormt het objectieve bewijs van de status vóór aanvang en beschermt de retailer tegen onterechte aansprakelijkheidsclaims over reeds bestaande stuc- of vloerbeschadigingen.
  * **Opleveropname (Achteraf):** Na afronding van de montage legt de monteur het voltooide resultaat fotografisch of op video vast ter documentatie van een deugdelijke oplevering.
  * **Flexibel Beeldmateriaal:** Het beeldprotocol is situatie-afhankelijk en niet gebonden aan een star 4-delig schema. Monteurs en inmeters bepalen in het veld zelf hoeveel foto's en video's noodzakelijk zijn om de bouwkundige werkelijkheid vast te leggen.
* **4. Universeel Opmerkingen- en Mediaprotocol:**  
  * Tekstuele opmerkingen, foto's en video's kunnen op elk niveau in de ruimtelijke hiërarchie worden toegevoegd: aan het **Object** (Niveau 2), de **Ruimte** (Niveau 4), het **Vlak** (Niveau 5) én de **Positie / Subpositie** (Niveau 6/7).
  * Daarnaast kunnen aan individuele foto's en video's weer specifieke opmerkingen en toelichtingen worden gehangen.
  * Elke opmerking en elk mediabestand wordt onveranderlijk vastgelegd met een uniek `id`, de `auteur_rol`, `auteur_naam` en een exacte `timestamp_iso`.
* **5. Automatische Rapportgeneratie & Service-orders:**  
  * Zowel het inmeetverslag als het opleververslag worden door het systeem automatisch samengesteld.
  * Alle tijdens het proces geregistreerde opmerkingen, meetgegevens, foto-annotaties en eventuele openstaande service-orders / restpunten worden integraal op het verslag afgedrukt.
  * Bij de oplevering heeft de klant de mogelijkheid om een eigen slotopmerking toe te voegen.
* **6. Digitale Handtekening op Glas:**  
  De klant ondertekent het inmeetverslag of opleververslag digitaal op het scherm (conform de touch-invariants in §5.8).
* **7. Single Responsibility (SRP) Berichtencomponent:**  
  Alle uitgaande communicatie (afspraakbevestigingen van inmeting/montage, toezending van het ondertekende inmeetverslag en opleververslag als PDF) wordt afgehandeld door één centrale, ontkoppelde notificatie-engine naar het gevalideerde e-mailadres van de klant.
* **8. Geen Mobiele PIN-betaling in V1:**  
  Financiële afhandeling via een mobiel PIN-apparaat valt nadrukkelijk buiten de scope van Versie 1; facturatie en betalingsverkeer verlopen via de reguliere administratieve keten of het ERP-systeem.

#### 5.5.2 Geavanceerde Monteurs-Cockpit & Slimme Buitendienst (V2 Backlog & Roadmap)
De volgende innovatieve functionaliteiten zijn gealloceerd naar de **V2 Backlog & Roadmap** voor doorontwikkeling na de initiële uitrol van het uniforme webportaal:
* **Mobiele Monteurs-Cockpit (`/monteur/vandaag` — Buitendienst Smartphone Touch Workflow):**  
  Een gescheiden mobiele cockpit geoptimaliseerd voor buitendienstmonteurs op smartphones:
  * **Ochtendoverzicht & Busbelading (Digitale Laadlijst):**
    * Overzicht van alle voor vandaag ingeplande afspraken op chronologische volgorde met route-optimalisatie.
    * Dynamische laadlijst per afspraak: toont exact welke goederen, pakketten en montagematerialen per positie moeten worden ingeladen vanuit het magazijn (inclusief referentie naar magazijnlocatie en controlecheck).
    * Waarschuwingsbadge voor specifiek benodigd gereedschap: klimmaterieel (rolsteiger, hoge trap), stalenwaaiers of specifieke lijmen/primers.
    * Direct inzicht in sleutel-, parkeer- en toegangsinstructies.
  * **Onderweg & Aankomst (1-Tik Status & Klantnotificatie met Live ETA):**
    * Met één tik activeert de monteur de status `[ Onderweg ]`. Dit triggert optioneel een automatische SMS/e-mailnotificatie naar de klant met verwachte aankomsttijd (ETA, Picnic-model).
    * Bij aankomst klikt de monteur op `[ Aangekomen / Starten ]`, wat de afspraakstatus op `aangekomen_bezig` zet en direct de schadepreventie-intake activeert.
  * **Swipeable Positiekaarten & Interactieve Montagekaarten:**
    * Per vertrek presenteert de app swipeable kaarten voor elke individuele positie met directe fotovastlegging en inline instructies.

---

### 5.6 Rollen, Rechten & Autorisatie in Versie 1 (Operationele Transparantie & SaaS-Isolatie)
* **1. Operationeel Uitgangspunt voor Versie 1: Volledige Transparantie:**  
  Binnen het retailbedrijf geldt in Versie 1: **"Voor nu mag en ziet iedereen alles."** Er is bewust géén fijnmazige uitsluitingsmatrix per scherm of veld geïmplementeerd. Alle interne medewerkersrollen (Verkoper, Inmeter, Werkvoorbereider, Planner, Monteur, Servicemonteur) hebben volledige lees- en mutatierechten over de 6 hoofdschermen, zodat de samenwerking op de werkvloer en tussen binnen- en buitendienst soepel verloopt zonder bureaucratische blokkades.
* **2. Strikte Multi-Tenant SaaS-Isolatie (Zero-Leakage Multi-Tenancy):**  
  De scheiding tussen verschillende retailers/bedrijven is 100% absoluut en mechanisch afgedwongen. Een medewerker van Retailer A kan onder geen enkele voorwaarde data, klanten, projecten of prijsafspraken van Retailer B inzien of wijzigen.
* **3. Particuliere Klanten Geen Inlogtoegang in V1:**  
  Particuliere klanten hebben in Versie 1 géén inlogaccount of toegang tot het portaal. Alle klantinteractie verloopt via documenten (PDF-offertes, ondertekende inmeet- en opleververslagen via e-mail) en persoonlijk contact.

---

### 5.7 Klant- & Projectadresbeheer: Meerdere Montagelocaties & Logische Deletes
* **1. Meerdere Montageadressen / Objecten per Klant:**  
  Elke klant (particulier of zakelijk) kan beschikken over één factuuradres en één of meerdere afzonderlijke montageadressen/objecten (analogie met bezorgadressen bij zakelijke klanten met meerdere vestigingen). Projecten worden gekoppeld aan een specifiek montageadres/object van de klant.
* **2. Logische Deletes via Einddatum:**  
  Objecten worden nooit fysiek uit de database verwijderd (ter bescherming van historische garanties, revisies en meetdata), maar worden logisch gedeactiveerd door het registreren van een einddatum.
* **3. Bestaande Bouw vs. Nieuwbouw:**  
  * *Bestaande Bouw:* Regulier adres (straat, huisnummer, toevoeging, postcode, woonplaats).  
  * *Nieuwbouw / Woning in Aanbouw:* Projectnaam, bouwnummer of kavelnummer (**verplicht identificatiekenmerk**), woonplaats en specifieke bouwplaatsinstructies/navigatieaanwijzingen (bijv. poortnummer, contactpersoon uitvoerder). Vóór definitieve oplevering wordt het nieuwbouwadres verrijkt naar een definitief BAG-adres.
* **4. Showrooms en Retailer-Vestigingen Buiten V1 Scope:**  
  Het inrichten en beheren van meerdere winkellocaties/vestigingen voor de retailer zelf valt buiten de scope van Versie 1.

---

### 5.8 Buitendienst Touch Ergonomie, Fitts' Law & Digitale Handtekening (INV-UI-02)
* **1. Fitts' Law Touch Targets:**  
  Alle knoppen, selectoren, formuliervelden en interactieve matrixcellen op tablets en mobiele apparaten hebben een minimale interactieve afmeting van **44×44px** (`min-h-[44px] min-w-[44px]`) om trefzekere bediening in het veld te garanderen.
* **2. Digitale Handtekening Canvas:**  
  * Het canvas voor de digitale handtekening van de klant (bij inmeet- en opleververslag) specificeert expliciet `touch-action: none` om te voorkomen dat het aanraken van het canvas leidt tot onbedoeld scrollen of zoomen van de pagina.  
  * Het canvas heeft een minimale hoogte van 160px voor comfortabele hand- en polsbeweging.  
  * Voorzien van een goed bereikbare wisknop (`min-h-[44px] min-w-[44px]`) om de handtekening eenvoudig te kunnen wissen en opnieuw te zetten.  
  * Mechanische validatie: een leeg handtekeningveld kan niet worden ingediend (`signature.isEmpty() === false`).

---

### 5.9 Architectuurprincipe: De 80/20-Regel & Gestructureerde vs. Vrije Invoer in het Portaal
* **1. Snelheid voor 80% Standaardsituaties:**  
  Om de applicatie in de showroom en op locatie snel en intuïtief te houden, worden formulieren niet overladen met honderden complexe dropdowns en uitzonderingsvelden.
* **2. Borging via Vrije Notities, Foto's & Video-Annotatie:**  
  Bouwkundige en montagetechnische uitzonderingen (de 20% afwijkingen zoals bijzondere leidingen, afwijkende klinkspeling of schuin stucwerk) worden vastgelegd via vrije opmerkingenvelden en annotaties op foto's en video's met stylus of touch.

---

### 5.10 Formele Specificatie van Modals, Drawers & Dialogen

De interactieve dialoogvensters en slide-over componenten in het portaal volgen een strikt taakgericht ontwerp met Fitts' Law touch targets (`min-h-[44px] min-w-[44px]`), Optimistic Concurrency Control (`version_id`) en fail-closed validatie:

#### 5.10.1 AfspraakPlannerModal
* **Context & Triggers:** Geactiveerd via `[ + Afspraak inplannen ]` (op Hoofdscherm 4 Zone 2 Tab A: Bezoeken & Planning en via de dagagenda op Hoofdscherm 1: Home) of via de status-actieknoppen `[ Inmeetafspraak Plannen ]`, `[ Montageafspraak Plannen ]` en `[ Afterservice Afspraak Plannen ]`.
* **Invoer- en Configuratievelden:**
  * *Afspraaktype:* Dropdownkeuze (`inmeting`, `hermeting`, `montage`, `afterservice`, `servicebezoek`).
  * *Datum & Tijdvak:* Datumkiezer en start-/eindtijd (`tijdvak_start`, `tijdvak_eind` in `HH:mm`). De planner/adviseur bepaalt te allen tijde zelf de tijdsduur conform §5.4; het systeem toont een indicatieve adviestijd op basis van historische calculatie.
  * *Uitvoerders:* Meervoudige selectie van gekwalificeerde monteurs of inmeters (`uitvoerder_ids: string[]`) met realtime bezettingscontrole en conflictwaarschuwing.
  * *Voertuig:* Kentekenselectie (`voertuig_kenteken?: string`).
  * *Klimmaterieel & Gereedschap:* Checkbox `klimmaterieel_nodig: boolean` (reserveert automatisch rolsteiger of hoge trap gekoppeld aan het voertuig conform §4.8) en checklist voor specifieke stalenwaaiers (`stalen_meenemen`).
  * *Instructies:* Vrije tekstvelden voor `sleutel_instructie`, `parkeer_instructie` en algemene afspraaknotities.
  * *Scope (Gefaseerde Toewijzing):* Selectiebox voor specifieke ruimtes (`ruimte_ids`), posities (`positie_ids`) en producttoewijzingen (`product_toewijzing_ids`) die tijdens dit specifieke bezoek worden behandeld (essentieel voor meerdaagse montages of droogtijdfasering conform §4.3).
* **Validatie & OCC:** Controleert `version_id` van het project ter voorkoming van gelijktijdige overschrijvingen en waarschuwt bij overlap in de agenda van de gekozen uitvoerder.

#### 5.10.2 InhoudelijkeAfspraakModal
* **Context & Triggers:** Geactiveerd via `[ + Conditie / Werkafspraak Toevoegen ]` in Zone 2 Tab B van Hoofdscherm 4 (Project).
* **Invoer- en Configuratievelden:**
  * *Niveau:* Keuzeoptie voor het toepassingsniveau (`positie`, `ruimte`, `project`).
  * *Categorie:* Dropdownkeuze conform het datamodel (`plinten`, `ondervloer_sloop`, `deuren_inkorten`, `leidingwerk_risico`, `bouwkundige_vlakheid`, `conceptmaten_disclaimer`, `aanwezigheid_klant`, `chemische_verankering`, `algemene_conditie`).
  * *Titel & Omschrijving:* Korte herkenbare titel en gedetailleerde inhoudelijke omschrijving van de gemaakte afspraak of conditie.
  * *Ruimtelijke Binding (Optioneel):* Keuzeoptie om de afspraak projectbreed te laten gelden of specifiek te koppelen aan een `ruimte_id` of `positie_id`.
  * *Verantwoordelijke Partij:* Keuzerondjes (`winkelier`, `monteur`, `klant`, `derde_aannemer`).
  * *Bron:* Herkomst van de afspraak (`offerte`, `inmeting`, `showroom_overleg`).
  * *Klantakkoord:* Checkbox `klant_akkoord: boolean` en optioneel registratiedatum (`akkoord_datum`).
* **Normvalidatie:** Indien categorie `deuren_inkorten` wordt geselecteerd, dwingt de interface conform de bindende norm van §3.4.5 af dat de verantwoordelijkheid bij `klant` (via timmerman/aannemer) ligt; toewijzing aan de monteur is uitgesloten.

#### 5.10.3 PreActionChecklistDialog
* **Context & Triggers:** Verplichte procesgate die automatisch opent vóórdat een van de 6 macro-actieknoppen op Hoofdscherm 4 definitief kan worden uitgevoerd.
* **Werking & Hard Gate:**
  * Toont de dynamisch geconfigureerde vragenlijst gekoppeld aan de desbetreffende ketenactie (bijv. bereikbaarheid en parkeersituatie vóór inmeetplanning; goederen gereed en hulpmiddelen vóór montageplanning; nulmeting en EN 13120 vóór montageafronding).
  * Ondersteunt diverse invoertypes: binaire checks (`ja`/`nee`), getalsinvoer (bijv. restvocht CM-%), selectielijsten en verplichte fotouploads.
  * De actieknop `[ Bevestigen & Uitvoeren ]` is strikt vergrendeld (`disabled`) zolang niet alle verplichte vragen succesvol en conform de acceptatiecriteria zijn beantwoord.
* **Contextueel Beheerderpennetje `[✏️]`:** Gebruikers met beheerdersrechten zien bij elke vraag een pen-icoon (`min-h-[44px] min-w-[44px]`) om direct de beheermodule te openen en de vraagstelling, condities of invoertypes aan te passen.

#### 5.10.4 MatrixProductEditDrawer
* **Context & Triggers:** Slide-over paneel dat vanaf de rechterzijde van het scherm inschuift wanneer een gebruiker klikt of tikt op een reeds gevulde cel in de Dynamische Matrix (Hoofdscherm 4 Zone 3 of Hoofdscherm 5) conform `INV-UI-05`.
* **Voordeel & UX-Continuïteit:** De onderliggende matrix, filterinstellingen en scrollpositie blijven 100% intact en zichtbaar op de achtergrond.
* **Inhoud & Bewerking:**
  * *Productidentificatie:* Collectie, kleurnummer, dessin, afmetingen en sub-positieletter (`a`, `b`...).
  * *Meetwaarden & Maatstatus:* Inzage in dagmaten (B1..B3, H1..H3), montagehoogte (MH) en toggle tussen `concept` en `definitief` (indien geautoriseerd).
  * *Koppeling aan Inspecties:* Directe koppeling naar relevante bouwkundige meetresultaten (`InspectieResultaat` zoals vocht of EN 13120).
  * *Actieve Issues:* Overzicht van openstaande servicemeldingen voor dit specifieke artikel.
* **Actieknoppen:** `[ Opslaan & Sluiten ]`, `[ Product Ontkoppelen ]` en `[ Naar Volledig Productscherm ]` (doorklik naar Hoofdscherm 6 (Product)).

#### 5.10.5 OpleverRapportSignOffDialog
* **Context & Triggers:** Geactiveerd via de mobiele cockpit (`/monteur/vandaag` knop `[ Oplevering & Afronding ]`) of via de knop `[ Rapport Maken ]` (Montagerapport) op Hoofdscherm 4 (Project).
* **Componenten:**
  * *Geconsolideerde Opleverchecklist:* Verificatie dat alle posities gemonteerd zijn, afval is opgeruimd, bediening is gedemonstreerd en EN 13120 kinderveiligheidsvoorzieningen zijn gemonteerd.
  * *Restpunten & Issues Overzicht:* Toont eventuele tijdens de montage geregistreerde openstaande punten of naleveringen.
  * *Klantopmerkingen:* Vrij tekstveld voor slotopmerkingen van de consument.
  * *Handtekening Canvas (Klant & Monteur):* HTML5 canvas met `touch-action: none` (min. 160px hoog, met wisknop) conform §5.8. Beide handtekeningen zijn verplicht.
* **Afhandeling:** Na bevestiging wordt direct een verzegeld PDF-document gegenereerd, opgeslagen als `RapportDossier` met `status: 'definitief_ondertekend'`, en via de SRP-notificatiecomponent per e-mail naar de klant gezonden.

#### 5.10.6 IssueRegistrationModal
* **Context & Triggers:** Geactiveerd via `[ Issue / Servicepunt Melden ]` op Hoofdscherm 6 (Product), in de `MatrixProductEditDrawer` of op de mobiele monteurs-cockpit (`/monteur/vandaag`).
* **Invoer- en Configuratievelden:**
  * *Context:* Automatisch gekoppeld aan het actieve project, montageadres, ruimte, positie en specifiek artikel.
  * *Titel & Omschrijving:* Heldere titel en gedetailleerde toelichting van het defect, ontbrekende onderdeel of transportschade.
  * *Ernst:* Keuzeselectie (`laag`, `middel`, `kritiek_blokkerend`).
  * *Foto- en Videobewijs:* Directe camerakoppeling voor het vastleggen van beeldmateriaal van de beschadiging of afwijking.
  * *Oorzaak & Verantwoording:* Classificatie van de grondoorzaak (`productiefout_fabriek`, `transportschade`, `montagebeschadiging`, `inmeetfout`, `klantschade`).
* **Vervolgacties:** Biedt na registratie direct de keuze om een servicemelding door te zetten naar de werkvoorbereiding, een `afterservice`-afspraak in te plannen (Hoofdscherm 4) of bij schade buiten garantie direct een nieuw vervolgproject te initiëren.

---

## Bijlage A: ERP Ketenintegratie & Stoplichtsysteem (Ter Informatie - Buiten Scope V1)

Het onderstaande stoplichtmodel beschrijft de orderstatusflow en magazijnlogistiek binnen het ERP-systeem (zoals LogicTrade) van de woninginrichter. Dit model is ter referentie en context opgenomen; directe geautomatiseerde ERP-statuskoppelingen vallen buiten de scope van Versie 1 (V1).

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. ROOD: Te bestellen bij toeleverancier / atelier          │
│    • Wordt actief na akkoord definitieve offerte + aanbetaling│
└──────────────────────────────┬──────────────────────────────┘
                               │ Inkooporder verzonden
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. GEEL / ORANJE: Besteld bij leverancier / In productie    │
│    • Inkoopnummer gekoppeld; ordernummer fabriek volgt na   │
│      24-48u orderbevestiging (invoer door backoffice).      │
│    • Fictief verzenden: schermoptie bij externe portalen.   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Goederen ontvangen in magazijn
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. GROEN: Binnengekomen & Gecontroleerd / Dienst Gereed     │
│    • Materiële goederen: fysiek op voorraad in centraal     │
│      magazijn (Veilingweg), gecontroleerd en gestickerd.    │
│    • Niet-materiële diensten (inmeten, montage, afvoer):    │
│      STAAN PER DEFINITIE DIRECT OP GROEN!                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ALLE orderregels GROEN?
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ TRIGGER MONTAGEPLANNING (Dashboard Planner):                │
│ Order licht op als 'Compleet voor montage-afspraak'.        │
└─────────────────────────────────────────────────────────────┘
```

* **1. Rood (Te bestellen bij leverancier):**
  * Materiële artikelen (gordijnstoffen, raamdecoratie, PVC, tapijt, overzettreden) worden direct na akkoord op de verkooporder en eventuele aanbetaling klaargezet voor inkoop.
* **2. Geel / Oranje (Besteld bij leverancier / In productie):**
  * Zodra de inkooporder naar de leverancier/fabriek is verzonden, springt de orderregel op geel.
  * Het systeem genereert direct een intern inkoopordernummer. Het externe ordernummer van de leverancier staat initieel op 'onbekend' en wordt binnen 24 tot 48 uur na ontvangst en controle van de fabrieks-orderbevestiging door de backoffice ingevoerd.
  * *Fictief verzenden (Schermoptie in ERP):* Wanneer een orderregel handmatig is ingevoerd in een extern leveranciersportaal (zoals bijv. Hunter Douglas of Luxaflex) buiten een directe EDI-koppeling om, kan de regel handmatig op 'fictief verzonden' worden gezet om de gele status te activeren en administratieve stagnatie te voorkomen.
* **3. Groen (Binnengekomen & Gecontroleerd / Dienst Gereed):**
  * *Materiële goederen:* Fysiek gearriveerd op het centrale magazijn van de dealer, gecontroleerd op afmetingen en transportschade, voorzien van een projectsticker en klaargezet in de stelling/orderrekken door monteurs of magazijnmedewerkers.
  * *Niet-materiële diensten & Services (Inmeetservice, montagekosten, legloon, demontage & afvoer):* **Staan per definitie direct standaard op GROEN!** Deze posten behoeven immers geen fysieke levering door een externe fabriek.
* **4. De Montage-Trigger voor de Planner (Dashboard LogicTrade):**
  * Het planningsdashboard bewaakt de orderstatus: zolang er nog materiële regels op rood of geel staan, kan de montage niet definitief worden vastgelegd.
  * Pas zodra **alle orderregels van de gehele order op GROEN staan**, verschijnt het project automatisch op het dashboard van de planner als *"Order Compleet / Gereed voor Montage-afspraak"*. Dit sluit uit dat monteurs met een onvolledig pakket naar de klant rijden.
* **5. Inkooporder-Splitsing per Leverancier & Margemonitoring:**
  * *Splitsing per leverancier:* Een samengestelde verkooporder wordt in het ERP automatisch uitgesplitst in separate inkooporders per externe fabrikant/atelier.
  * *Margemonitoring door Ordercontroleur:* Vóór definitieve verzending van de inkooporders toetst de ordercontroleur/backoffice de brutomarges en eventuele toeslagen (zoals plooitoeslagen, strijken, spoedlevering of bijzondere zoomafwerkingen), zodat calculatieverschillen direct worden opgemerkt en gecorrigeerd.
