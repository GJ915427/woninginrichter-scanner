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
* **Domein:** De context is een woninginrichter die gespecialiseerd is in vier kernproductgroepen: Raamdecoratie, Gordijnen, Vloerbekleding en Trapbekleding.
* **Doelstelling van het Portaal:** Het realiseren van een integraal digitaal portaal dat het complete ketenproces ondersteunt — vanaf het eerste verkoopadvies en inmeten tot en met de montage en nazorg/service.
* **Architectuur & Scope V1:** Ontwikkeld als een multi-tenant SaaS-inmeetplatform voor woninginrichters, met woninginrichter GiW (*Groter in Wonen*) als primaire V1 lanceerpartner en referentietopologie. In versie 1 (V1) wordt de oplossing initieel operationeel gemaakt voor deze primaire tenant, met configureerbare isolatie voor toekomstige tenants.

### 1.2 De 7 Rollen in de Keten
Het procesmodel van EasyM2M onderkent zeven primaire rollen die als een estafette samenwerken binnen de woninginrichtingsketen. De procesmatige interactie tussen deze rollen borgt een foutloze overdracht van commercie naar techniek en montage:
1. **Verkoper (Adviseur / Winkel / Showroom):** Brengt de klantbehoefte in kaart, adviseert over materialen, kleuren en stijlen, voert de globale (concept)maten in, stelt de initiële offerte op en initieert de inmeetopdracht in Fase 1.
2. **Inmeter (Technisch Opnemer op Locatie):** Bezoekt het object in Fase 2, meet alle bouwkundige elementen in volgens de vaste meetstandaarden (§3.1), beoordeelt de bouwkundige staat en ondergronden, legt foto's en obstakels vast en doorloopt de kwalitatieve inmeetchecklist.
3. **Controleur (Werkvoorbereider / Technisch Beoordelaar):** Voert in Fase 4 de cruciale vier-ogencontrole uit; toetst de inmeetgegevens aan de verkooporder, controleert fabrieksbestelmaten, signaleert afwijkingen en geeft de order technisch en margematig vrij voor inkoop.
4. **Planner (Capaciteits- en Routeplanner):** Bewaakt de dwingende productvolgorde (vloeren en droogtijden vóór raambekleding, §4.4), plant inmeet- en montageafspraken in op het planningsdashboard (§4.1/§4.3), en stuurt afspraakbevestigingen naar monteurs en de klant.
5. **Monteur (Uitvoerend Vakman):** Ontvangt de digitale werkbon met blijvende maten, doorloopt de verplichte ingangscontrole vóór uitpakken (§3.1.2), monteert de materialen op locatie conform Arbo- en veiligheidsprotocollen (§4.8), en verzorgt de oplevering aan de klant.
6. **Servicemonteur (Nazorg & Garantie):** Handelt eventuele montagebevindingen, transportschades of garantievraagstukken zelfstandig af in Fase 6 met een gerichte serviceorder.
7. **Klant (Opdrachtgever / Bewoner / Projectontwikkelaar):** Particuliere of zakelijke opdrachtgever; verschaft toegang tot het pand voor inmeting en montage, deelt specifieke wensen en eventuele bekende leidingtrajecten en vloerverwarming met de inmeter, accordeert het inmeetverslag (inclusief de vastgelegde situatie en de standaard aansprakelijkheidsvoorwaarde voor verborgen leidingen en ondergrondafwijkingen: eventueel meerwerk door afwijkingen t.o.v. de opgave is voor rekening van de klant), en tekent voor oplevering na montage.  
   *(Let op V1-scope: Het digitaal accorderen van offertes via een interactief consumentenportaal en realtime statusvolging vallen buiten de scope van V1 en gelden als mogelijke toekomstige functionaliteiten; in V1 verloopt de offerte-afstemming via de verkoopadviseur en e-mail/winkel).*

* **Ondersteunende Operationele Rollen in de Keten:** *(Ter informatie opgenomen; deze ondersteunende rollen zijn geen onderdeel van het inmeetportaal zelf)*  
  * **Backoffice Medewerker (bijv. Stan):** Verwerkt inkomende orderbevestigingen van fabrikanten (zoals Luxaflex en Toppoint). Voert het externe orderbevestigingsnummer en de bevestigde leverweek (standaard gealloceerd op zondag van de productieweek) in het systeem in, bewaakt leveranciersstatussen (*Onbevestigd*, *Bevestigd*, *Te laat binnen*), en bewaakt eventuele meerwerkkosten of fabricageafwijkingen conform het financieel escalatieprotocol.
  * **Magazijnmedewerker (bijv. Simon):** Verzorgt de dagelijkse fysieke goederenontvangst in het centrale magazijn, toetst colli-aantallen op uiterlijke beschadigingen en meldt leveringen direct af in het systeem. Vormt de directe trigger voor de status *Compleet Binnen* (visueel zwart/donker in het planningsdashboard), wat de noodzakelijke voorwaarde is voor definitieve montageplanning. Monteurs leggen aan het einde van de werkdag ervoor zelf materialen en gereedschappen klaar; Carlo legt de papieren werkbonnen klaar (nu nog niet digitaal).
  * **Klantenservice & Losse Onderdelen:** Reguliere klantvragen en de afhandeling van onderdelenservice worden in de praktijk afgehandeld door Simon en Carlo.

*(Voor de gedetailleerde taakomschrijvingen, de vier-ogencontrole en de fijnmazige RBAC-portaalrechten per rol: zie Deel 5, §5.2 en §5.4).*

### 1.3 Systeemarchitectuur & Integratiekader (ERP & Outlook)
* **ERP-integratie (LogicTrade):** In versie 1 valt een geautomatiseerde orderdoorvoer buiten de scope van het portaal. Offertes, leveranciersorders (inkoop) en facturatie vinden primair plaats vanuit het ERP-systeem. Voor het opvragen van actuele catalogusproducten en productspecificaties is een API-koppeling met LogicTrade in de toekomst wenselijk.
* **Tweeweg Agendasynchronisatie (Outlook):** De agenda in het portaal en Microsoft Outlook is volledig tweeweg gesynchroniseerd. Zodra een inmeet- of montageorder wordt ingepland of gewijzigd (in het portaal óf in Outlook), wordt dit realtime over en weer bijgewerkt. *(De automatische herbevestiging van datumwijzigingen naar de klant is gereserveerd voor de backlog).*

### 1.4 Hoofdlijnen van de 6 Ketenfasen & Conditionele Workflow-Overgangen (Gates)
Het complete maatwerktraject verloopt via 6 vaste fasen. Hoewel de fasen identiek zijn, verschillen de te registreren parameters per productcategorie, productgroep en product. De overgang tussen fasen wordt bewaakt door conditionele workflow-gates:

* **Fase 1: De Intentiefase**  
  * *Inhoud:* Verkoper en klant maken een principekeuze van te offreren producten en werkzaamheden en plannen een inmeetafspraak. Heeft de klant globale maten meegenomen (bijv. 11 Duettes), dan berekent de adviseur binnen 20 minuten een nauwkeurige conceptofferte op de winkelvloer. Bij akkoord op het prijsniveau (bijv. € 7.000,- tot € 9.000,-) wordt de status in het portaal direct omgezet naar **"Order - Nog Nameten"**. Hierdoor transformeert het traject van een vrijblijvende lead naar een bindende orderverificatie, waarbij de inmeting (Fase 2) fungeert als definitieve verificatiecheck. Het 'dwingend' structureren van het showroomproces helpt in de overbrugging van kenniskloven tussen ervaren krachten en junior medewerkers/nieuwe filialen (zoals Maastricht).  
  * *Gate (Afsluiting):* Formeel afgesloten met een **Inmeetorder** of **Voorlopige Verkooporder ("Order - Nog Nameten")** *(Opmerking: digitaal ondertekenen en eventueel betalen van de inmeetorder is een backlog functionaliteit; streven naar substantiële aanbetalingen tot 80% en het vooraf innen van de € 75,- inmeetbijdrage conform §1.5.1; Opm: Check bij Stefan of dit inderdaad het streven is)*.
* **Fase 2: De Inmeetfase & Schouw**  
  * *Inhoud:* De inmeter meet op locatie alle posities exact in, maakt overzichts- en detailfoto's en legt schetsen vast. Eventueel voorafgegaan door een schouw (conceptmeting in ruwbouw). De inmeettool is softwarematig leidend en dwingend: inmetingen kunnen niet worden afgesloten zonder verplichte parameters zoals montagehoogtes, ondergronden en plintinstructies.  
  * *Gate (Afsluiting):* Formeel afgesloten met een gevalideerd digitaal **Inmeetverslag**.
* **Fase 3: De Offertefase**  
  * *Inhoud:* Verkoper vertaalt het inmeetverslag naar een definitieve calculatie en offerte in het ERP-systeem en bespreekt deze met de klant.  
  * *Gate (Afsluiting):* Formeel afgesloten met een **Verkooporder** *(Opmerking: digitaal ondertekenen en eventueel (deel)betaling van de order is een backlog functionaliteit)*.
* **Fase 4: De Bestelfase**  
  * *Inhoud:* Vier-ogen kwaliteitscontrole door de controleur op meet- en verkoopdata ter voorkoming van overname- en invoerfouten, gevolgd door verzending van inkooporders naar leveranciers. Bevat de verplichte Orderbevestiging-validatie (ACK Gate) en Spookorder-Alerting ter voorkoming van niet-geproduceerde orders *(Opm: Check bij Carlo wat hiermee bedoeld werd; casus De La Croix bij Luxaflex)*.  
  * *Gate (Afsluiting):* Formeel afgesloten met geaccordeerde **Inkooporders** voorzien van geregistreerd fabrikant-bevestigingsnummer en verwachte leverweek; deze geaccordeerde inkooporder met verwachte leverweek vormt reeds de montagetrigger zodat de klant tijdig een montageweek heeft, waarna de fysieke binnenmelding van goederen in het magazijn fungeert als definitieve verificatie vóór montage.
* **Fase 5: De Montagefase**  
  * *Inhoud:* Planner plant montageafspraak gebaseerd op de ervaring van de planner (een wiskundig Dynamisch Montageplannings-Algoritme met factoren voor reistijd, uitpaktijd, producttijd en ondergrondfactor is een wens/idee voor de toekomst); monteurs monteren alle posities conform instructie, voeren nulmeting en schadeborging uit en registreren opleverbevindingen. Het montage-gereed rapport wordt realtime verzonden aan klant en planner, waarna planner restcapaciteit toewijst (ad-hoc klussen zoals hordeur Eijsden).  
  * *Gate (Afsluiting):* Formeel afgesloten met een **Opleverontvangst / Opleverrapport** *(Opmerking: digitale ondertekening door de klant op de tablet is een backlog functionaliteit / buiten scope V1; in V1 tekent de klant op de papieren bon of per acceptatiebevestiging)*.
* **Fase 6: De Servicefase**  
  * *Inhoud:* Servicemonteur lost geregistreerde montagebevindingen gericht op locatie op via een nieuwe montageloop.  
  * *Gate (Afsluiting):* Formeel afgesloten met een door de klant ondertekend definitief **Opleverontvangst / Servicerapport**.

### 1.5 Detailbeschrijving van de 6 Ketenfasen

#### 1.5.1 Fase 1: De Intentiefase (Verkoop & Inmeetorder)
* **Wensen & Gegevensverzameling:** De verkoper inventariseert in de showroom de wensen van de klant. Alles wat noodzakelijk is voor een succesvolle inmeting wordt gestructureerd vastgelegd:
  * *Klantgegevens:* NAW-gegevens, telefoonnummer en e-mailadres.
  * *Ruimtelijke indeling:* Etages en ruimtes binnen het pand.
  * *Productgroepen & Posities:* Raamdecoratie, Gordijnen, Vloerbekleding en Trapbekleding, gekoppeld aan de beoogde montage-/inmeetposities.
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
* **Conditionele Overgang (Workflow Gate):** De software dwingt af dat een inmeetorder pas kan worden gegenereerd wanneer aan alle minimale invoercondities is voldaan: volledige contactgegevens, geselecteerde ruimtes en gekoppelde producten en/of productgroepen (in de praktijk zijn dit meestal specifiek gekozen producten, maar het kan ook op productgroepniveau).
* **Inmeetorder & Klantbevestiging:** De inmeetorder zelf wordt aangemaakt in het ERP-systeem *(GJ: met Stefan bespreken hoe de exacte afstemming/synchronisatie verloopt)*. De inmeetafspraak wordt ingepland via het portaal, waarna de klant direct vanuit het portaal een automatische bevestigingsmail van de inmeetafspraak ontvangt.
* **LogicTrade ERP-Koppeling & MVP-Scope:**  
  * *Databasekoppeling Artikelen & Prijzen:* *(Geen onderdeel van MVP-scope V1; gepland voor latere fase / backlog)* Directe databasekoppeling met LogicTrade voor het actueel ophalen en valideren van artikel- en prijsdata (reeds 20.000 van de ruim 100.000 artikelen ingelezen). Hierdoor kan de showroomadviseur direct merkoverstijgend schakelen tussen Luxaflex, Toppoint, Zonnelux en Sunway zonder handmatige overtypefouten.  
  * *Externe Fabrikantenconfigurators buiten V1:* Volledige externe configurators van fabrikanten vallen buiten de initiële MVP-scope; de focus ligt op snelle validatie tegen de ERP-artikelenlijst.  
  * *Agenda-Sync:* De inplanning van de inmeetafspraak synchroniseert direct met Microsoft Outlook.

#### 1.5.2 Fase 2: De Inmeetfase & Schouw (Opname op Locatie)
* **Voorbereiding & Digitale Overdracht:** De inmeter vertrekt naar de klantlocatie met het volledige digitale dossier uit de verkoopfase op zijn tablet.
* **Conditionele Inmeetworkflow:** De inmeter doorloopt een vaste, gestandaardiseerde workflow met verplichte stappen:
  * *Entree & Looproutes:* Maken van overzichtsfoto's en filmpjes van de entree, het trappenhuis, de lift en de aanlooproutes naar de montagelocatie (logistieke toegankelijkheid).
  * *Ruimteniveau:* Maken van een duidelijke maatschets van de ruimte (voorzien van genummerde posities), overzichtsfoto's en specifieke ruimtelijke notities.
  * *Positieniveau:* Vastleggen van alle vereiste basis- en detailmaten (hoogte, breedte, montagelijnen, obstakels), detailfoto's van kozijnen of vloeren, en gerichte instructies voor offerte en montage.
  * *Capaciteits- & Monteursindicatie:* Inschatting van de benodigde montagetijd (uren) en eventueel vereiste specialistische vaardigheden (bijv. meesterstoffeerder voor trappen).
* **Productaanpassing door Inmeter:** Indien de live situatie uitwijst dat een gekozen draft-product technisch niet monteerbaar is (bijv. te geringe plaatsingsdiepte of ongeschikte ondergrond), heeft de inmeter de bevoegdheid het product in overleg aan te passen naar een technisch haalbaar alternatief.
* **Bouwkundige Schouw (Optioneel):** In situaties van ruwbouw of grootschalige renovatie kan de inmeetfase worden voorafgegaan door een 'schouw' (een conceptmeting waarbij maten en definitieve productkeuzen indicatief zijn en in een later stadium definitief worden gemaakt).
* **Afsluiting & Inmeetverslag:** De klant tekent niets na afloop van de inmeting. De fase wordt formeel afgesloten met het genereren van het officiële digitale inmeetverslag, dat direct beschikbaar is voor de verkoper. De klant ontvangt in eerste instantie een bevestiging per e-mail (directe toegang van de klant tot het Klantportaal is gereserveerd voor een latere fase). De klant krijgt hierbij een gefilterde weergave met minder informatie te zien: o.a. krijgt de klant de definitieve ingemeten productiematen pas te zien ná het definitief tekenen van de verkooporder in Fase 3 (ter bescherming van het inmeetintellect en faalkostenbeheersing). *(Voor gedetailleerde inmeetmethodieken en rekenregels per categorie, zie Deel 3).*

#### 1.5.3 Fase 3: De Offertefase (Calculatie, ERP & Verkooporder)
* **Dossieroverdracht naar Calculatie:** Het inmeetverslag en de klantwensen vormen het fundament voor de offerteberekening.
* **ERP-Verwerking:** De definitieve maten en productspecificaties worden in het ERP-systeem (LogicTrade) ingevoerd (in V1 handmatig door de verkoper/calculator, in latere fasen via een API-koppeling).
* **Offerte-uitgifte & Verkooptraject:** De verkoper stelt de offerte op binnen het ERP-systeem en verstuurt deze naar de klant (valt buiten de directe werking van het portaal).
  * *Automatische Klantvriendelijke Productomschrijvingen (AU20 & AE20 Casus):* *(Wens/idee)* Indien op een offerte of orderbevestiging uitsluitend een cryptische fabrikant-modelcode staat (zoals `AU20`, `AS20` of `AE20`), begrijpt de klant niet wat er besteld is. Dit leidt bij levering regelmatig tot ernstige aflevergeschillen (*"die code zegt me niets, dit heb ik niet besteld"*). Het portaal genereert daarom automatisch een **volledige, klantvriendelijke functionele omschrijving** op alle klantgerichte documenten (bijv. *"Duette 25 mm, vrijhangend, SmartCord-bediening met Top-Down / Bottom-Up"* of bij `AE20`: *"Duette 32 mm, vrijhangend, elektrisch PowerView met Top-Down / Bottom-Up, incl. magnetische laadkabel en Pebble handzender"*). De compacte fabriekscode blijft op de achtergrond behouden voor de technische bestelregels in LogicTrade, EDI-berichten en fabrieksorders.
  * *Fabrieksprijsstaffels & Meetneutraliteit (10–20 cm Intervallen):* *(Wens/idee; zie §3.3.2)* Fabrikantprijslijsten zijn opgebouwd in vaste staffelintervallen (bijv. breedte 1,40–1,60 m × hoogte 1,40–1,60 m). Indien een klant in de showroom een conceptmaat doorgeeft van 1,45 × 1,55 m en de inmeter meet op locatie 1,48 × 1,52 m, valt dit binnen exact hetzelfde staffelblok. Het portaal toont direct dat de berekende prijs 100% prijsneutraal blijft, waardoor offertes direct definitief gemaakt kunnen worden zonder tijdrovende hercalculaties.
  * *Transparante Btw-Weergave op Documenten:* *(Wens/idee)* Terwijl fabrikantcatalogi toeslagen exclusief btw specificeren, toont het consumentenportaal en de offerte alle bedragen consistent inclusief 21% btw.
* **Orderstatusflow & Uitzonderingenbeheer (95% vs. 5%):**
  * *Reguliere flow (95%):* De klant accordeert de offerte zonder wijzigingen; de verkooporder is inhoudelijk 1-op-1 identiek aan de calculatie.
  * *Afwijkingsflow (5%):* Indien de klant alsnog wijzigingen wenst (kleur, stofkeuze, aantal posities), past de verkoper zowel het dossier in het portaal als de order in het ERP handmatig aan.
* **Afsluiting:** De offertefase wordt formeel afgesloten met een door de klant ondertekende verkooporder.

#### 1.5.4 Fase 4: De Bestelfase (Verificatie door Controleur & Inkooporders)
* **Vier-Ogen Kwaliteitsborging:** Voordat inkooporders definitief naar toeleveranciers en fabrieken worden verzonden, voert een onafhankelijke controleur (in de praktijk veelal de inmeter zelf) een grondige visuele check uit.
* **Verificatieproces:** De controleur toetst de ingevoerde ERP-gegevens integraal aan de oorspronkelijke notities van de verkoper, het inmeetverslag en de fotobijlagen. Hiermee worden kostbare maat- en specificatiefouten in de productieketen geëlimineerd. *(Toekomstperspectief: Zodra er een automatische API-koppeling is gerealiseerd tussen het inmeetportaal en het ERP, zal deze handmatige vier-ogencontrole aanzienlijk verminderen of voor gestandaardiseerde orders zelfs geheel verdwijnen).*
* **Plaatsing van Inkooporders & Leveranciersbevestigingen:** Na formele goedkeuring door de controleur worden de inkooporders gefiatteerd en verzonden naar de toeleveranciers en fabrikanten (zoals Luxaflex en Toppoint).
  * *Verwerking Orderbevestigingen door Backoffice (Stan in LogicTrade):* De backoffice (Stan) verwerkt de inkomende fabrieksbevestigingen in LogicTrade, voert het externe fabrikant-ordernummer in en legt de bevestigde leverweek vast (standaard gealloceerd op zondag van de productieweek).
  * *Bewaking Levertijdstatussen in LogicTrade:* LogicTrade bewaakt de status van inkooporders: *Onbevestigd* (geen orderbevestiging retour), *Bevestigd* (orderbevestiging en leverweek verwerkt in LogicTrade) en *Te laat binnen* (bevestigde leverweek verstreken zonder magazijnbinnenmelding).
* **Financieel Escalatie- & Foutafhandelingsprotocol:** Fouten ontstaan door overname of verkeerd invullen (bijv. plintenaantallen of afwijkende stofcodes) worden direct door de controleur gesignaleerd. Indien door de controleur gesignaleerd, wordt de afhandeling volgens Carlo volgens deze governance gedaan:
  * *Onder € 200 - € 300:* Collegiale oplossing, in overleg met de klant (bijvoorbeeld "sam-sam" / coulance), of bij grote totaalprojecten intern geabsorbeerd door de retailer.
  * *Boven € 200 - € 300:* Indien met de klant geen minnelijke oplossing mogelijk is, vindt directe escalatie plaats naar de directie (Stefan).
* **Trigger voor Montagefase:** Na verzending bevindt het dossier zich in een wachtstatus tot de materialen fysiek in het magazijn arriveren en 'binnengemeld' worden. Deze magazijnbinnenmelding vormt de directe operationele trigger voor de planner om de montagefase in gang te zetten (het binnenmeldingsproces zelf is geen onderdeel van het portaal).

#### 1.5.5 Fase 5: De Montagefase (Planning, Uitvoering & Opleverontvangst)
* **Magazijnontvangst & Montageplanning:**
  * *Binnenmelding als Trigger (Simon):* De dagelijkse goederenontvangst en binnenmelding door de magazijnmedewerker activeert de status *Compleet Binnen* (visueel zwart/donker op het planningsdashboard).
  * *Twee Planningsstromen:*
    * **Route A (Magazijngestuurd - Standaard):** Zodra alle orderregels compleet binnen zijn (status Zwart), neemt de planning contact op met de klant om de montagedatum vast te leggen.
    * **Route B (Vooruitplanning bij Harde Deadlines):** Bij dwingende verhuisdata plant de verkoopadviseur/planner de montage vooraf in, met een verplichte buffer van 2 tot 3 weken ná de door de fabrikant bevestigde leverweek (om transport- en fabricagevertragingen betrouwbaar op te vangen).
  * *Wekelijkse Week-Vooruit Controlecyclus (Guy):* De operationeel manager/planner controleert wekelijks alle dossiers voor de komende werkweek op magazijncompleetheid; bij onverhoopte vertragingen wordt direct geschakeld vóórdat de monteur vertrekt.
* **Digitale Werkinstructie voor Monteurs:** Monteurs zien op hun tablet direct alle relevante montage-informatie: ruimtenummers, posities, montagewijzen, uitsluitend definitieve productiematen, bijzonderheden en de route/toegang tot de werkplek.
* **Schadepreventie & Fotorapportage (Vooraf & Achteraf):**
  * Voor aanvang van de werkzaamheden maken de monteurs foto's en korte video's van de bestaande toestand van de ruimte en de route (ter voorkoming van discussies over reeds aanwezige beschadigingen).
  * Na afronding van de montage leggen zij het eindresultaat fotografisch vast.
* **Positie-Afvinking & Montagebevindingen:**
  * Elke montagepositie wordt na plaatsing individueel afgevinkt in de app, inclusief foto van het gemonteerde product en eventuele montagenotities.
  * Indien er sprake is van restpunten, transportschade, productiefouten of naleveringen, registreert de monteur direct een duidelijke 'montagebevinding' met toelichting en detailfoto's ten behoeve van de servicemonteur.
* **Afleverbon / Opleverdocument & Verplichte Opleveringsvragen:**
  * De digitale werkbon dwingt de monteur om drie verplichte opleveringsvragen af te vinken alvorens te laten ondertekenen:
    1. *Is onderhavig leverproduct met de klant doorgenomen?*
    2. *Is de werking en bedieningsfunctie (o.a. SmartCord, motoren, afstandsbediening, plooival) aan de klant gedemonstreerd?*
    3. *Zijn alle geleverde goederen gecontroleerd op compleetheid en schadevrijheid?*
* **Facturatie 1 Werkdag Vooraf & Mobiele PIN-Restantbetaling:**
  * Facturatie vindt standaard plaats één werkdag voorafgaand aan de montage (op vrijdag voor montage op maandag of dinsdag).
  * De factuur specificeert het factuurtotaal minus de reeds voldane aanbetaling; het openstaande restantbedrag wordt bij oplevering door de klant direct per mobiele PIN aan de monteurs voldaan.
* **Afsluiting & Klantenacceptatie:** Na gezamenlijke inspectie tekent de klant op de tablet voor ontvangst op het digitale opleverrapport. Eventuele montagebevindingen worden hierop expliciet vermeld en direct gerouteerd naar de servicefase.

#### 1.5.6 Fase 6: De Servicefase (Oplossing Montagebevindingen door Servicemonteur)
* **Doelgerichte Oplossing:** De tijdens de oplevering vastgelegde montagebevindingen worden door de planner ingepland en door de servicemonteur op locatie verholpen.
* **Procesvoering in het Portaal:** De servicemonteur gebruikt het portaal om de exacte bevindingen, foto's en instructies in te zien en het herstelresultaat digitaal en fotografisch vast te leggen. Deze fase verloopt operationeel als een gerichte herhaling van de montageworkflow met dezelfde waarborgen voor kwaliteit.
* **Dossierafsluiting:** De servicefase wordt formeel afgesloten met een door de klant digitaal ondertekend definitief opleverontvangst / servicerapport, waarmee het volledige ketendossier foutloos en sluitend is afgerond.

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
Het horizontale niveau binnen een eenheid/wooneenheid waarop één of meerdere ruimtes zich bevinden (bijv. *Kelder, Souterrain, Begane grond, 1e verdieping, Zolder/Vliering of Entresol/Tussenvloer*).  

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

### 2.7 Niveau 7: Productlagen (Sub-posities met suffix 1a, 1b...)
Een productlaag definieert het concrete product of de bewerking die op een positie wordt aangebracht. Hierbij onderscheiden we twee verschijningsvormen:
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

### 2.8 Niveau 8: Vloer-specifieke Positieregels
* **1. Volledige ruimte (Standaard):** Als er in de gehele ruimte één vloer moet worden gelegd, dan is dat **1 positie voor de hele ruimte** (bijv. in Ruimte Woonkamer --> Positie 1: Vloer).
* **2. Zones / Deelvlakken binnen ÉÉN ruimte:** Als er een vloer in een gedeelte (cq in een zone) van een ruimte moet worden gelegd (bijv. binnen de Woonkamer: Deel A *Zithoek* krijgt parket en Deel B *Eethoek* krijgt PVC, of een verzonken *Droogloopmat* bij de tuindeur), dan krijgt **elke zone binnen die ruimte zijn eigen positie** (*bijv. 1: Vloer zithoek, 2: Vloer eethoek*). Tussen de zones leg je de overgang/scheiding vast (bijv. een overgangsprofiel of dilatatievoeg).
* **3. Doorlopende vloer over MEERDERE aparte ruimtes:** Als één vloer drempelloos doorloopt over meerdere aparte ruimtes (bijv. van *Woonkamer* naar *Hal* of *Keuken*), dan **meet je altijd in per ruimte** (i.v.m. afwijkende hoeken, radiatoren en plintlengtes per vertrek). Je moet over verschillende ruimtes (op een verdieping) kunnen aangeven dat de vloer doorloopt: *drempelloos* (één doorlopend legpatroon en centrale startlijn) of met een *overgang/scheiding* (zoals een dorpel, dilatatiestrip, T-profiel of kitvoeg).

---

## Deel 3: Productcategorieën, Inmeetmethodieken & Rekenregels (De 4 Categorieën in Detail)

Commercieel, functioneel en op de werkvloer wordt er strikt gesproken over **4 aparte productcategorieën**:
1. **Gordijnen & Rails**
2. **Raamdecoratie (Binnenzonwering, Horren & Buitenscreens)**
3. **Vloerbekleding**
4. **Trapbekleding & Traprenovatie**

Omdat productspecificaties, stof- en materiaaleigenschappen, confectievormen en montagetechnieken een directe sturende impact hebben op de inmeetmethodiek, toleranties, aftrekberekeningen en opleverchecklisten, zijn de productdefinities en de inmeet- en rekenregels in dit deel integraal samengebracht.

---

### 3.1 Algemene Inmeetprincipes (Domeinoverstijgend voor Meerdere Categorieën)

#### 3.1.1 Het Principebesluit: Dagmaat vs. Blijvende Maat, UI Drie-eenheid & Standaard Montagesituaties
Binnen EasyM2M geldt een fundamenteel en domeinoverstijgend principebesluit over hoe maatvoering, montagesituaties en fabrieksberekeningen in de software worden gemodelleerd en gepresenteerd:

* **De Bronmaat is ALTIJD de Dagmaat (Strakke Maat):**  
  De inmeter meet en registreert in het veld te allen tijde de daadwerkelijke, strakke fysieke opening (de 'dagmaat'). De inmeter hoeft — en mag — op de ladder nooit zelfstandig fabrieksaftrekken, spelingen of confectietoenames uit het hoofd te gaan uitrekenen of direct als bestelmaat in te voeren. Dit voorkomt menselijke rekenfouten onder tijdsdruk op de bouwplaats.
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
    * *Rekenvoorbeeld patroonrapport:* Bij een patroonrapport van 64 cm en een snijhoogte van 270 cm wordt de snijmaat naar boven afgerond op een veelvoud van 64 cm (5 × 64 = 320 cm) om perfecte horizontale patroonaansluiting over de gehele breedte te garanderen.
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
* **Buigradii Rekenvoorbeeld (Huismerk Rail R=10 vs. Standaard R=15 & R=20):**  
  Bij railbochten (in erkers of bij retourbochten naar de muur) bepaalt de buigradius de exacte zaagmaat en een soepele geleiding van de glijders:
  * *Huismerk GiW rail (Radius R = 10 cm):* U-maten: 25 cm wandlinks + 170 cm breedte + 25 cm wandrechts (som = 220 cm) → Correctie 2 bochten met R = 10 cm: 2 × [2R - (π × R)/2] = 2 × [20 - 15,7] = 8,6 cm reductie → **Werkelijke zaaglengte profiel = 211,4 cm**.
  * *Designrail extern (Radius R = 20 cm):* Zelfde U-maten (som = 220 cm) → Correctie 2 bochten met R = 20 cm: 2 × [40 - 31,4] = 17,2 cm reductie → **Werkelijke zaaglengte profiel = 202,8 cm**.
  * *Standaard fabrieksbocht:* Radius R = 15 cm (bochtontwikkeling ca. 23,6 cm).
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

### 3.3 Categorie 2: Raamdecoratie (Binnenzonwering, Horren & Buitenscreens)

#### 3.3.1 Productgroepen, Merken & Configuratoren
* **Binnenzonwering & Merken:**  
  * *Merken & Fabrikanten:* Hunter Douglas (*Luxaflex, Sunway*), **Toppoint** (volledig geïntegreerd voor raamdecoratie en insectenwering).  
  * *Private label / Huismerk:* Dealer-eigen huismerken (zoals *Groter in Wonen*, in het ERP en op inkoopbonnen vastgelegd onder de merkcode **'GiW'**, o.a. geproduceerd door *Zonnelux* als private label).  
  * *Productgroepen:* Rolgordijnen (standaard voorzien van montageprofiel t.b.v. snelle montage en klantvriendelijke afklikbaarheid bij schilderen), Duettes / plissés, Silhouette (kantelbare stoffen lamellen tussen transparante sluiers), Duo-rolgordijnen / Twist (afwisselend dichte en transparante banen), Jaloezieën (horizontaal hout/alu, verticaal textiel, pvc en aluminium zoals Luminette/Allure), Vouwgordijnen, Paneelgordijnen, en **Insectenwering / Horren** (plisséhordeuren, rolhorren, inzethorren en vaste hordeuren).
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
* **Verticale Lamellen, Paneelgordijnen & Buitenscreens:**  
  * *Verticale Lamellen:* Leverbaar in textiel (inclusief luxe transparante segmenten zoals Versos), hoogwaardig PVC (vochtbestendig voor keukens/badkamers) en aluminium.  
  * *Paneelgordijnen:* Zelfstandige productgroep voor schuifpuien en grote glaswanden (meersporige rails met brede schuivende stofpanelen).  
  * *Facette definitief geschrapt:* Facette wordt niet meer besteld en is uit het actieve assortiment verwijderd.  
  * *Buitenscreens & Buitenzonwering:* Wordt als zelfstandige buitengroep gepositioneerd (windvaste ZIP-screens, solar/accu en 230V bedraad).
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

#### 3.3.3 Bedieningssystemen, Kindveiligheid (EN 13120) & Arbo-Veiligheid (Hoge Ramen)
* **Bedieningsvormen & Aandrijving:**
  * *Handmatig:* Ketting, koord, handgreepbediening (LiteRise), SmartCord (veersysteem met intrekbaar enkelvoudig koord op constante vaste lengte, pompende slagen voor optrekken, 100% Child Safe), eindloze ketting of koord voorzien van kettingspanner of breekbare koordbreker.
  * *Elektrisch & Smart Home:* AE10 (1 motor) en AE20 (2 motoren voor onafhankelijke Top-Down / Bottom-Up aansturing), PowerView, Somfy.
  * *Accu & USB-C:* Oplaadbare accumotoren (geen vaste 230V bekabeling noodzakelijk).
* **Kindveiligheid & Child Safety (EN 13120) & Dwingende Montagehoogte-Gating:**  
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

#### 3.3.4 Insectenwering (Horren) & Buitenscreens
* **Insectenwering (Horren) als Functionele Productgroep:**  
  Insectenwering/horren vallen binnen het domeinmodel volwaardig onder **Categorie 2 (Raamdecoratie / Zonwering)**. In tegenstelling tot decoratieve raambekleding is een hor een zuiver effectief en functioneel werend product: insecten buiten houden met een maximale transparantie van het gaas en minimale visuele verstoring van het kozijnaanzicht.
  * **Toonaangevende Merken in het Portaal:** **Luxaflex** en **Toppoint** (volledig geïntegreerd met typecodes, stalen en profielkleuren).
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
* **Buitenscreens & Zipscreens:**
  * Windvaste ZIP-screens (ritsscreens) met ritsgeleiding in zijprofielen.
  * *Aandrijving:* Solar / Accu-aandrijving met geïntegreerd zonnepaneel op de cassette (geen geveldoorvoer of 230V bekabeling benodigd); 230V bedraad blijft leverbaar.

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
* **TruFit / FrameFix Kleefmontage:**  
  Montage zonder boren direct op het glas of de glaslat met hoogwaardige 3M kleefstrips. Vereist grondige voorbehandeling (ontvetten met isopropanol en aanbrengen van hechtprimer). Toepasbaar tot een maximale breedte van 1300 mm.
* **Standaard Monteursinstructie bij Draaikiepramen & Kiepstandbegrenzing (Filtertrechter):**  
  De vaste default-instructie op de werkbon luidt: *"Rekening houden met kiepstand (steunen zover mogelijk naar achteren plaatsen)"*. De monteur lijnt dit ter plekke uit met de laser (bijv. 32 mm). Alleen wanneer de klant expliciet eist dat het doek bij geopende kiepstand neerwaarts blijft hangen, voert de adviseur een harde afwijkende afstand (bijv. 3 cm) en montageafspraak in.  
  * *Protocol Kiepstandbegrenzing (Beslag-Nok vs. Montagewijze):* Bij montage 'In de dag' boven of voor een draaikiepraam toetst de inmeetworkflow via een dynamische vraagboom of de kiepuitslag van de raamvleugel kan worden begrensd. Veel modern draaikiepbeslag bevat een verstelbaar schuifje of begrenzingsnok in de bovensponning waarmee de kiepstand kan worden verkleind. Kan het beslag worden begrensd, dan kan de cassette veilig in de dag blijven hangen zonder dat het raam er bij openen tegenaan slaat. Is het beslag niet instelbaar of kantelt het raam te ver naar voren, dan switcht de filtertrechter direct naar montage **'Op de dag'** of montage direct op de raamvleugel (**TruFit / FrameFix / Glaslatmontage**).

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

#### 3.3.11 Portaal-Inmeetchecklist & Veldinspectie: Raamdecoratie & Binnenzonwering (5 kolommen, 21 inspectiepunten)
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
| **Buitenscreens & Horren (ZIP-screens, Solar & Inzethorren)** | Strakste dagmaat breedte en hoogte; buitengevelinspectie | *In de dag:* Kast- en geleidermaat = dagmaat - 2 mm; *Op de dag (buiten):* Dagmaat + breedte zijgeleiders + kasthoogte | Vlakheid buitengevel; obstakels (waterdorpels, ventilatieroosters); zonnepaneeloriëntatie bij solar | Buitenwerkse maat (mm), kasttype (afgeschuind/rond), ZIP-ritsgeleiders, motortype (Solar/230V), doekcode |

### 3.4 Categorie 3: Vloerbekleding

#### 3.4.1 Productsoorten, Rolbreedtes & Legpatronen
* **Zachte Vloeren op Rol (Tapijt & Vinyl):**  
  * *Rolbreedtes Tapijt:* Geleverd op **4 meter én 5 meter breed** (voorkomt onnodige naden bij kamers breder dan 4m).  
  * *Rolbreedtes Vinyl:* Standaard 4 meter breed (optioneel 2 of 3 meter).  
  * *Tapijt op Vloerverwarming (Advies Volvlakkig Verlijmen):* Bij aanwezigheid van vloerverwarming is het traditioneel spannen van tapijt op rubber ondertapijt met spanlatten **volledig uitgesloten**; de ingesloten luchtlaag en de dikte van het ondertapijt isoleren te sterk, waardoor het warmterendement verloren gaat. In situaties met vloerverwarming adviseert het portaal dat het tapijt **volvlakkig verlijmd (geplakt)** moet worden met een geschikte emissiearme dispersielijm met een lage warmtedoorgangsweerstand (`R <= 0,15 m²K/W`).  
  * *Trapbekleding met Ondertapijt (Vast All-in Tarief per Trede):* Bij het bekleden van trappen met tapijt op rubber ondertapijt (zoals Black Pearl) wordt het ondertapijt niet per strekkende meter van een volle rol berekend (wat bij discountformules leidde tot verplichte afname van een complete rol van 7,30 meter voor een trapje van slechts 3 meter). De woninginrichter hanteert een **vast all-in voorraad-tarief per trede** (inclusief benodigd rubber ondertapijt, spuitlijm en arbeidsloon). Omdat ondertapijt en lijm voorraadartikelen zijn, betaalt de klant exact voor het aantal treden zonder restmateriaalverspilling.
* **Marmoleum:**  
  * *Vaste rolbreedte:* 2 meter breed.
* **Harde Vloeren (PVC & Laminaat):**  
  * *Uitvoeringsvormen:* Dryback (plak-PVC), Click-PVC, Laminaat.
  * *Legpatronen:* Rechte plank, Visgraat (90°), Hongaarse punt (sergeantstrepen, 45° of 60°), Weense punt (72°), Tegel (met of zonder voegstrips/accentbiezen), Bies & Band afwerking.

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
  3. *Vochtmeting (Capacitieve Strooiveldmeting):*  
     * *Standaard veldmeting:* Vochtmeting doen wij **niet volgens de carbidmeting**. Wij gebruiken een geijkte elektronische **vochtmeter die werkt volgens het principe van capacitieve strooiveldmeting** om snel, betrouwbaar en volledig niet-destructief de vochttoestand in de oppervlaktezone te meten.
     * Bij te hoge vochtwaarden in de oppervlaktezone dwingt het portaal automatisch een droogtijd-blokkade af.
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
* **Voorbeeld Vloeren (Harde Vloeren - 22 Pakken PVC/Laminaat):**  
  42,0 m² (Netto laseroppervlakte) → +12% snijverlies visgraat (47,04 m²) afgerond op volle pakken à 2,16 m² → **22 pakken (47,52 m²)** (bij standaard wildverband 10%: 42,4 m² × 1,10 = 46,64 m² → 22 pakken à 2,15 m² = 47,30 m²).
* **Voorbeeld Egaline Zandcement Dekvloer:**  
  Gemiddeld verbruik = 1,6 kg per m² per mm laagdikte.  
  Voor 42 m² bij een vereiste egalisatielaag van 3 mm (klasse NEN-EN 13813 voor verlijmd PVC) is benodigd:  
  42 m² × 3 mm × 1,6 kg = 201,6 kg → 201,6 / 25 kg per zak = 8,06 → **9 zakken egaline** + 1 can primer

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
| **4** | Restvochtconditie & droogte-akkoord: is restvocht binnen toelaatbare norm? | Altijd (alle vloeren op minerale dekvloer) | Numeriek [Capacitieve indicatiewaarde / CM-%] + Radio [Binnen norm / Te hoog of Droogtijd vereist], default: Binnen norm | Niet-destructieve capacitieve meting; bij te hoog restvocht blokkeert het portaal de definitieve legplanning en plant hermeting in (§3.4.2). |
| **5** | Opstook- en afkoelprotocol vloerverwarming doorlopen & afgetekend? | Als vloerverwarming aanwezig = Ja | Radio [Ja (afgetekend aanwezig) / Nee (nog niet doorlopen) / N.v.t.], default: Nee | Zonder getekend opstookprotocol blokkeert het portaal de montageplanning; waarschuwt klant dat fabrieksgarantie vervalt bij overslagen protocol. |
| **6** | Ondergrondconditie & egalisatie-opbouw: poriën, diepe freessleuven of sterke zuiging? | Als egalisatie vereist = Ja of vloertype = Verlijmd PVC (Dryback) | Dropdown [Standaard egalisatie (2–3 mm) / Verzwaard of Dichtsmeren sleuven (min. 3 mm spiegelglad) / Vezelversterkt op hout], default: Standaard egalisatie (2–3 mm) | Berekent automatisch het benodigde aantal zakken egaline (kg/m²) en cans primer op basis van netto m² en gekozen laagdikte (§3.4.2). |
| **7** | Ondervloergeschiktheid & normconformiteit (druksterkte CS ≥ 200 kPa, R ≤ 0,15 m²K/W)? | Als vloertype = Click-PVC of Laminaat | Dropdown [Gecertificeerde hoge densiteit CS ≥ 200 kPa / Standaard schuim (alleen laminaat) / Geïntegreerde onderlaag], default: Gecertificeerde hoge densiteit | Voorkomt uitbreken van klikverbindingen door te zachte ondervloer; toetst R-waarde bij vloerverwarming (§3.4.2). |
| **8** | Algeheel boorverbod vloeren; leidingcontrole bij tapijtspanlatten (nagelen vs montagekit)? | Als vloertype = Tapijt met spijkerlatten op ondertapijt | Radio [Geen leidingen / vloerverwarming in vloer (spijkeren toegestaan) / Leidingen aanwezig (spijkerverbod: latten verlijmen met montagekit)], default: Geen leidingen / vloerverwarming in vloer (spijkeren toegestaan) | Bij leidingen of vloerverwarming: absoluut spijkerverbod ter voorkoming van leidingbreuk; activeert automatische meerprijs voor verlijming van spanlatten met hoogwaardige montagekit (§3.1.7). |
| **9** | 10 dB VvE contactgeluidnorm (alleen bij etagevloeren/appartementen)? | Als type woning = Appartement / Bovenwoning | Radio [Ja (10 dB certificaat verplicht) / Nee (grondgebonden woning)], default: Grondgebonden woning | Bij Ja: filtert ondervloeren uitsluitend op TNO/TÜV 10 dB ΔLlin gecertificeerde producten en genereert VvE-certificaatbijlage bij oplevering. |
| **10** | Legrichting & vleugoriëntatie met klant afgestemd: evenwijdig aan lichtinval? | Altijd (alle vloeren) | Dropdown [In de lengte / Lichtinval volgend / In de breedte / Afgestemd op klantontwerp], default: In de lengte / Lichtinval volgend | Legt bindende legrichting vast op werkbon; voorkomt esthetische discussies en zichtbare naden bij tegenlicht (§3.4.3). |
| **11** | Visgraatindeling & bandsymmetrie gecontroleerd: optische hartlijn en slips > halve strook? | Als legpatroon = Visgraat / Hongaarse punt / Patroonvloer | Checkbox [Hartlijn bepaald; slips > halve strook gegarandeerd], default: Niet aangevinkt | Voegt verplichte uitzet-instructie toe voor monteur; berekent 10–15% extra snijverlies in ordercalculatie (§3.4.4). |
| **12** | Draaispeling binnendeuren: behouden deuren na installatie min. 4–6 mm vrije speling? | Altijd (alle vloeren) | Radio [Voldoende speling (≥ 5 mm) / Deuren klemmen of inkorten vereist], default: Voldoende speling | Toetst berekende vloerdikte aan huidige onderruimte deuren; signaleert direct eventuele noodzaak tot deurbewerking (§3.4.5). |
| **13** | Deurinkortingsadvies & klantakkoord: wie kort binnendeuren in (klant vs monteur)? | Verschijnt als draaispeling deuren = Deuren klemmen of inkorten vereist | Numeriek [Aantal opdekdeuren] + Numeriek [Aantal stompe deuren] + Dropdown [Klant regelt / Monteur kort in (meerwerk)], default: Klant regelt | Indien Monteur: berekent zaaguren op werkbon (opdekdeur met cirkelzaag/geleiderail; waarschuwt bij stompe deuren/glasdeuren conform 4-stappenplan §3.4.5). |
| **14** | Dilatatiedekking plinten: biedt plintdikte (15–18 mm) ruim voldoende dekking over uitzetvoeg? | Als vloertype = Click-PVC of Laminaat (zwevende vloer) | Dropdown [Hoge MDF-plint (15–18 mm dekking) / Plakplint (min. 20 mm) / Muurplint te dun (< 12 mm risico)], default: Hoge MDF-plint (15–18 mm) | Blokkeert plinten < 12 mm bij zwevende vloeren met grote krimp-/uitzetwerking; voorkomt kieren na seizoenswisseling. |
| **15** | Ruimtecomplexiteit & aansnijrisico: plattegrond met veel nissen/hoeken (extra snijverlies)? | Altijd (alle vloeren) | Radio [Rechthoekig / Eenvoudig (5% snijverlies) / Complex met nissen/hoeken (7–10% snijverlies)], default: Rechthoekig / Eenvoudig | Verhoogt de snijverliesfactor in de automatische m²-calculatie om tekorten op de montagedag uit te sluiten (§3.4.4). |
| **16** | Acclimatisatiecondities (pakken 48u horizontaal opslaan bij 18–22 °C)? | Altijd (alle vloeren) | Checkbox [Klant geïnformeerd over acclimatisatie-eisen], default: Aangevinkt | Plaatst waarschuwing op leveringsbon en werkorder; borgt geldigheid fabrieksgarantie m.b.t. krimp en uitzetting. |

---

#### 3.4.7 Inmeet- en Rekenmatrix: Vloerbekleding

| Productgroep | Primaire Dagmaat (Invoer Inmeter) | Blijvende Maat (Formule & Aftrekregel) | Verplichte Referentie & Validatie | Output naar Productie & Montage |
| :--- | :--- | :--- | :--- | :--- |
| **PVC & Laminaat (Dryback, Click, Visgraat)** | Netto m² laser-contourmeting lengte × breedte incl. alle nissen en deuropeningen | Bestelhoeveelheid m² = Netto m² + snijverliestoeslag (Wildverband +10%; Visgraat +12%; Hongaarse/Weense punt +15%; Bies & band +12%), afgerond naar boven op hele pakken (bijv. à 2,16 m²) | Vochtmeting (capacitieve bolmeter / strooiveldmeting), 2m rei vlakheidsmeting (egalisatieklasse), 10 dB VvE-geluidsnorm (etagevloer), algeheel boorverbod (kitten) | Aantal te bestellen pakken PVC/laminaat, zakken egaline (1,6 kg/m²/mm laagdikte), cans primer, strekkende meters plinten (+10%), aantal binnendeuren advies timmerman |
| **Tapijt & Vinyl (Kamerbreed op Rol)** | Uiterste maximale lengte en uiterste breedte per ruimte (inclusief diepste nissen, convectorputten en doorgangen) | Afsnijmaat rol = Langste lengte + 10 cm snijmarge (5 cm rondom); Rolbreedte keuze 400 cm of 500 cm breed | Vleugrichting pijlvector (identiek in alle aansluitende ruimtes), coupon- en restantrol hergebruik voor overlopen/kasten, algeheel boorverbod (profielen kitten) | Rolafsnede (strekkende meters op 400/500 cm rol), m² ondertapijt / rubber vilt, strekkende meters spanlatten, overgangsprofielen |

---

### 3.5 Categorie 4: Trapbekleding & Traprenovatie

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

#### 3.5.3 Rekenvoorbeelden Trapbekleding
* **Voorbeeld Trapbekleding Tapijt (Rechte & Verdreven Treden):**  
  (10 rechte treden × 0,48 m) + (4 verdreven draaitreden × 0,62 m grootste ontwikkelde maat) = **7,28 strekkende meter tapijtstrook** → Uitsnijden met meedraaiende radiale vleugrichting per trede.  
  *Bij dichte trap met 9 rechte treden, 4 verdreven treden en 13 stootborden:* (9 × 55 cm) + (4 × 65 cm) + (13 × 20 cm) + 50 cm = 10,65 strekkende meter loper (gesneden uit 2,70 m van een 400 cm rol).

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
  Om te voorkomen dat ervaren verkoopadviseurs overspoeld raken met administratief uitzoekwerk en het opzoeken van losse onderdeelnummers (wat in de huidige praktijk door Simon en Carlo wordt opgevangen), is een gestructureerde servicemodule voor losse onderdelen een wens/idee voor een latere fase:  
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
    Het standaard uitgangspunt in de woninginrichting. Montage wordt pas ingepland nadat álle orderregels en materialen fysiek in het centrale magazijn zijn binnengekomen en door de magazijnmedewerker (Simon) zijn binnengemeld. Dit activeert de status *Compleet Binnen* (visueel zwart/donker in het dashboard), waarna de planner contact opneemt met de klant voor een definitieve afspraak.
  * **Route B (Vooruitplanning bij Harde Deadlines):**  
    Indien de klant een harde deadline heeft (bijv. verhuisdatum of sleuteloverdracht), plant de adviseur/planner de montage vooraf in. Hierbij geldt een **strikte veiligheidsbuffer van 2 tot 3 weken** ná de door de fabrikant bevestigde leverweek (zondag productieweek) om leververtragingen betrouwbaar op te vangen.

* **Dashboard Kleurencodering & Ketenstatussen:**  
  * *Zwart / Donker:* Compleet binnen in het centraal magazijn (gereed voor montageplanning).  
  * *Licht:* Reeds definitief ingepland in de montageagenda.  
  * *Onbevestigd:* Inkooporder is verzonden naar leverancier; orderbevestiging met productieweek nog niet retour verwerkt.  
  * *Bevestigd:* Orderbevestiging verwerkt door backoffice (Stan) met extern ordernummer en definitieve leverweek.  
  * *Te laat binnen:* Bevestigde leverweek verstreken zonder magazijnbinnenmelding (automatisch attentiesignaal voor planner en backoffice).
* **Fabrikant-Orderbevestiging (ACK Gate) & Spookorder-Alerting (Casus De La Croix):**  
  * *Aanleiding:* Twee Duettes TruFit besteld voor klant De La Croix met beoogde levering in week 39; intern bestond wel een inkoopordernummer, maar de order was onvindbaar in het leveranciersportaal van Luxaflex (door een eerdere portalstoring nooit aangekomen). Pas in de geplande montage-/uitleverweek werd de vermissing ontdekt.  
  * *De Orderbevestiging-Gate (ACK Gate):* Een inkooporder mag in het portaal nooit de status 'Definitief Besteld' behouden zonder actieve registratie van het **officiële externe orderbevestigingsnummer van de fabrikant**.  
  * *48-Uurs Spookorder-Alerting:* Indien een geplaatste inkooporder na 48 uur nog géén extern orderbevestigingsnummer heeft gekregen van de fabrikant (Luxaflex, Sunway, Vadain, Toppoint), triggert het dashboard een rode attentiemelding (*"Spookorder-Alert: géén fabrikantbevestiging ontvangen"*) voor de backoffice (Stan) om direct telefonisch contact op te nemen met de leverancier.  
  * *Dwingende Merkvalidatie op Regels:* Voorkomt verwarring tussen leveranciers van soortgelijke systemen (zoals Luxaflex TruFit vs Sunway FrameFix); het exacte merk en portaal is een verplicht veld op inkoopregelniveau.

* **Wekelijkse Week-Vooruit Controlecyclus (Guy):**  
  De operationeel manager/hoofdplanner (Guy) toetst wekelijks alle dossiers die voor de komende werkweek op de rol staan. Indien een order onverhoopt nog niet compleet binnen is, wordt direct geschakeld met toeleveranciers en de klant vóórdat de monteur op pad gaat.

* **Financieel Escalatieprotocol bij Uitvoerings- en Orderfouten:**  
  Indien tijdens de verificatie of montage fouten worden geconstateerd door overname of verkeerd invullen (bijv. plintenaantallen of afwijkende stofcodes), verloopt de afhandeling conform het escalatieprotocol in §1.5.4 (onder € 200 - € 300 collegiaal / bijvoorbeeld sam-sam; daarboven escalatie naar de directie).

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
  * *Mobiele PIN-Restantbetaling bij Oplevering:* Het openstaande saldo wordt na ondertekening direct per mobiele PIN aan de monteur voldaan, waarna de betalingstransactie realtime in het dossier wordt geregistreerd.
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
* **Realtime Digitale Afmelding, Magazijnregie & Benutting van Restcapaciteit:**  
  * *Probleemanalyse:* Monteurs die vroegtijdig gereed zijn (bijv. om 14:30 of 15:00 uur) rijden historisch direct naar het magazijn, doen daar informeel voorwerk en leveren hun papieren bonnen pas om 16:50 uur in. Hierdoor blijven openstaande spoed- en serviceklussen (zoals een hordeur van 30 min in Eijsden of het vastzetten van een losgekomen gordijnrail) onnodig liggen tot een latere week.  
  * *Realtime Oplevernotificatie:* Zodra de monteur de klant digitaal laat aftekenen op de tablet, verstuurt het portaal direct een geautomatiseerd gereed-signaal (push-notificatie / e-mail / dashboard alert) naar de planner en showroom (*"Monteur X is om [Tijd] gereed met Order Y"*). Door op de notificatielink te klikken, opent direct het opleverdossier met opleverfoto's en betalingsstatus.  
  * *Directe Toewijzing van Restcapaciteit:* De planner ziet direct de vrijgekomen uren (bijv. 1,5 tot 2 uur restcapaciteit) en kan de monteur direct routeren naar een nabijgelegen korte service- of montageklus (zoals het direct meepakken van de hordeur in Eijsden) voordat de monteur naar het magazijn terugkeert.  
  * *Magazijnregie & Rol Magazijnmeester (Stefan):* De magazijnmeester legt 's ochtends alle materialen en digitale werkbonnen klaar voor de vertrekkende bussen, bewaakt retouren en restmaterialen, en stuurt de logistieke doorstroom vanuit het centrale magazijn aan.

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

## Deel 5: Het Portaal: Functioneel Ontwerp, UX/UI, Schermen & Rol-Specifieke Functionaliteit per Ketenfase

### 5.1 Overkoepelende UX/UI-Architectuur & Design Governance (Conform Robust Engineering)
Het **EasyM2M Portaal** is ontworpen als een geïntegreerde 'Single Source of Truth' (SSOT) omgeving voor de woninginrichting. Het platform brengt het complete traject van showroom-intake, inmeting op locatie, calculatie, planning en montage naadloos samen in één centraal, dynamisch dossier.

* **UI/UX Design Governance & Usability Baseline:**  
  Het portaal wordt ontworpen conform de enterprise usability-standaarden en governance-richtlijnen van de *Robust Engineering Architectuur*:
  * *NN/g Heuristic 8 (Aesthetic & Minimalist Design):* Geen overbodige permanente zijbalken of schermvervuiling. Informatie die niet direct noodzakelijk is voor de actieve taak wordt niet continu getoond, maar is contextueel en op aanvraag (on-demand via drawers of popovers) beschikbaar.
  * *Fitts' Law Touch Target Compliance:* Alle interactieve elementen, knoppen, selectoren en touch-targets op tablets en mobiele apparaten voldoen aan de minimale fysieke afmeting van **44×44px** (`min-h-[44px] min-w-[44px]`), zodat inmeters op de ladder en verkopers in de showroom foutloos met één hand kunnen navigeren.
  * *Clean Component Separation & Zero Cumulative Layout Shift (CLS):* Duidelijke scheiding tussen visuele presentatielagen en proceslogica; stabiele schermindelingen zonder verspringende interfaces tijdens data-invoer.

* **Dynamische Rol- en Fase-Filtering (Conditional Rendering):**  
  De visuele interface past zich adaptief aan op basis van twee orthogonale dimensies:
  1. *De Rol van de Ingelogde Gebruiker:* Bepaalt welke gegevensvelden en acties beschikbaar zijn. Zo ziet de monteur op zijn werkbon *uitsluitend definitieve productiematen en blijvende maten* (geen voorlopige conceptmaten of showroomnotities), terwijl de verkoper *geen maten definitief kan maken* (deze velden zijn vergrendeld en voorbehouden aan de inmeter). De inmeter ziet technische maatvoering, rasters en meetchecklists, maar geen commerciële verkooptotalen.
  2. *De Ketenfase van het Dossier:* Bepaalt welke procesacties actief zijn (bijv. inmeetafspraak inplannen in Fase 1, inmeting afronden in Fase 2, technische validatie voltooien in Fase 4).

* **Systeemafbakening met LogicTrade (ERP):**  
  Het portaal richt zich zuiver op de inmeet- en uitvoeringsketen. Het daadwerkelijke splitsen, vrijgeven en verzenden van inkooporders naar leveranciers gebeurt in het ERP (**LogicTrade**) en wordt *niet* door het portaal uitgevoerd. In Fase 4 toetst de werkvoorbereider in het portaal de technische haalbaarheid en zet de status op *"Technisch Gevalideerd / Vrijgegeven voor ERP (LogicTrade)"*, waarna LogicTrade de orderafhandeling en inkooplogistiek overneemt.

---

### 5.2 Schermindeling & Navigatiestructuur: Slanke Header & Contextueel Hoofdcanvas
Om maximale werkruimte, visuele rust en een foutloze focus op de actieve taak te garanderen, hanteert het portaal een **slank 2-zone interactiemodel** (zonder overbodige, permanente zijbalken):

```
+---------------------------------------------------------------------------------------------------------+
| SLANKE HEADER: Dossier #2026-8812 | [Klant: Fam. Jansen ▾] | Status: [Fase 1: Showroom ▾] | Inlog: Jan |
+---------------------------------------------------------------------------------------------------------+
| TAAKGERICHT HOOFDCANVAS (Volledige schermbreedte voor de actieve taak)                                  |
|                                                                                                         |
| [ + Ruimte Toevoegen ]  Presets: [ Woonkamer ] [ Keuken ] [ Slaapkamer 1 ] [ Trap ]                     |
|                                                                                                         |
| ┌─ RUIMTE: Woonkamer ────────────────────────────────────────────────────────┐ ┌─ SLIDE-OVER DRAWER ──┐|
| │ Product: Duette 25 mm SmartCord (Kleur: Linen)                             │ │ [X] Klant- & Adres   │|
| │ Montagewijze: In de dag | Bediening: Rechts                                │ │                      │|
| │                                                                            │ │ Fam. Jansen          │|
| │ Positie 1: Voorgevel links  [ Concept: 1200 x 1800 mm ]                    │ │ Tel: 06-12345678     │|
| │ Positie 2: Voorgevel rechts [ Concept: 1200 x 1800 mm ]                    │ │ Mail: jansen@mail.nl │|
| │ Positie 3: Zijraam          [ Concept:  900 x 1400 mm ] (Bediening: Links) │ │                      │|
| │                                                                            │ │ Montageadres:        │|
| │ Contextuele Foto's (Ruimte): [ Foto Woonkamer ] [ + Foto ]                 │ │ Bouwnummer 42        │|
| │                                                                            │ │ Woonpark De Zeelt    │|
| │ Knoppen: [ Toepassen in meerdere ruimtes... ] [ + Extra positie hier ]    │ │ Poort 2 melden       │|
| └────────────────────────────────────────────────────────────────────────────┘ └──────────────────────┘|
|                                                                                                         |
| Actiebalk: [ Minimal Dataset Compleet: 3 Ruimtes, 5 Ramen ]  ->  [ Knop: Inmeetafspraak Plannen ]       |
+---------------------------------------------------------------------------------------------------------+
```

1. **De Slanke Universele Header (Context & On-Demand Details):**  
   * Biedt een uiterst compacte permanente statusregel bovenaan het scherm met alleen de primaire sleutelgegevens: Dossiernummer, Klantnaam, Globale Ketenfase (badge met duidelijke kleurcode), Vestiging en Ingelogde Gebruiker.
   * **Klant- & Adresgegevens On-Demand:** De klantnaam fungeert als interactieve knop (`[Klant: Fam. Jansen ▾]`). Een klik hierop opent een elegante slide-over drawer of modal met de volledige contactgegevens, factuuradres, montageadres (inclusief nieuwbouwproject, bouwnummer/kavelnummer en bouwplaatsnavigatie conform §5.7). Hierdoor zijn adresdetails altijd binnen 1 klik bereikbaar.
   * **Processtatus On-Demand:** Een klik op de statusbadge opent de interactieve ketentijdlijn met de historische fase-overgangen en detailstatussen.

2. **Het Taakgerichte Hoofdcanvas (Fase-Afhankelijke Werkruimte):**  
   * Benut de volledige breedte en hoogte van het scherm voor de taak die de gebruiker op dat moment uitvoert.
   * *In Fase 1 (Verkoop / Showroom):* Het dynamische **Ruimte- & Product-Canvas** (geen starre boomstructuur, maar een vloeiende kaarten-wizard geoptimaliseerd voor snel ruimtes kiezen, producten toekennen en batchgewijs kopiëren).
   * *In Fase 2 (Inmeting op Locatie):* De **Mobiele Inmeet-Wizard** met het 50 cm raster, directe laserkoppeling, de interactieve 5-koloms checklist en touch-invoer.
   * *In Fase 3 & 4 (Offerte & Werkvoorbereiding):* Het **Technisch Validatiebord** (waarin de ruimtelijke boomstructuur uit Deel 2 optioneel als inklapbare navigatie kan worden geactiveerd om snel door tientallen posities te lopen).
   * *In Fase 5 (Montage):* De **Mobiele Werkbon** waarin de monteur uitsluitend de definitieve productiematen, montagetijden, steunafstanden en opleverhandtekening ziet.

3. **Contextuele Mediatheek (Gekoppeld aan Ruimte of Positie):**  
   * Foto's, video-opnames en schetsen vormen **geen losse globale widget**, maar zijn direct contextueel verankerd op het niveau waar ze logisch en fysiek thuishoren:
     * *Op Ruimte-niveau:* Overzichtsfoto's van het vertrek, foto's van de vloerconditie, of plattegrondschetsen die door de klant zijn meegebracht.
     * *Op Positie-niveau:* Detailfoto's van een specifiek kozijn, voorzien van stylus-aantekeningen en markeringen van afwijkende klinken, lateien of obstakels.

---

### 5.3 De Showroom-UX voor de Verkoper: Snelle Ruimte-Intake & De "Kopieer & Pas Aan" Workflow (Fase 1)
In de adviesfase in de showroom (Fase 1) moet de verkoper snel en flexibel kunnen meebewegen met het gesprek met de klant. Een starre boomstructuur werkt in deze fase vertragend. Het portaal ondersteunt daarom de **"Kopieer & Pas Aan" (Batch Copy & Fine-tune) Workflow**:

* **1. Snelle Ruimte-Selectie & Aanmaak:**  
  De verkoper voegt met één klik standaardruimtes toe via handige presets (*Woonkamer*, *Keuken*, *Slaapkamer 1*, *Slaapkamer 2*, *Zolder*, *Hal*, *Overloop*, *Trap*) of typt direct een vrije ruimtenaam in.
* **2. Product- & Configuratiekeuze per Ruimte:**  
  Binnen een ruimte selecteert de adviseur de beoogde productgroep (bijv. Duette 25 mm, Inbetween gordijn op rail, Horizontale jaloezie 50 mm, Verlijmd PVC) en kiest de basisparameters (stofgroep/collectie, montagewijze, bedieningstype).
* **3. De Batch-Actie "Toepassen in Meerdere Ruimtes" (Multi-Room Re-use):**  
  In de praktijk kiest een klant heel vaak hetzelfde product of dezelfde serie voor meerdere vertrekken (bijvoorbeeld identieke Duettes in alle 3 de slaapkamers, of hetzelfde inbetween-gordijn in de woonkamer én eetkamer):
  * Met de knop **[ Toepassen in meerdere ruimtes... ]** opent de verkoper een eenvoudige checklist van de overige aangemaakte ruimtes.
  * Na selectie dupliceert het portaal de geconfigureerde productlaag direct in bulk naar alle aangevinkte ruimtes.
* **4. De Actie "Meervoudig Toepassen binnen Zelfde Ruimte" (Multi-Position Re-use):**  
  In één kamer bevinden zich veelal meerdere ramen (bijvoorbeeld 3 identieke ramen in de voorgevel van de woonkamer):
  * Met de knop **[ Dupliceer naar extra positie in deze ruimte ]** (of via een snelkeuze `Aantal ramen: 3`) maakt het systeem direct Positie 1, Positie 2 en Positie 3 aan met exact dezelfde productconfiguratie.
* **5. Snelle Finetuning per Positie:**  
  Na de batch-kopie kan de verkoper in een compact overzicht direct per individuele positie kleine nuances aanpassen:
  * De indicatieve conceptmaten invoeren (bijv. B120 × H180 cm voor raam 1 en 2; B90 × H140 cm voor raam 3).
  * De bedieningszijde wijzigen (bijv. raam links bediening links; raam rechts bediening rechts).
  * Een afwijkende stof- of voeringsoptie kiezen (bijv. in de slaapkamers dezelfde Duette-stof, maar met een verduisterende *Blackout*-coating in plaats van semi-transparant).
* **6. De Geïntegreerde Showroom Intake-Checklist (95% Conversiegarantie):**  
  Om de kenniskloof tussen doorgewinterde verkoopadviseurs en junior verkopers te overbruggen, bevat het portaal een compacte, interactieve intake-checklist:  
  * *Kwalificatie Inmeetbijdrage (€ 75,-):* Vastlegging van het inmeettarief (wordt bij definitieve aankoop gecrediteerd).  
  * *Vloerensloop & Afvoer Gescheiden:* Twee expliciete vinkopties: *\"Bestaande vloer verwijderen/oppakken\"* én *\"Bestaande vloer afvoeren\"* (uitgangspunt: klant levert schoon en leeg op, tenzij aangevinkt).  
  * *Montageprofiel Rolgordijnen:* Standaard suggestie/selectie van montageprofiel t.o.v. losse steunen (montagegemak voor monteur, afklikbaar voor de klant bij schilderwerk, structureel hogere brutomarge).  
  * *Kozijn- & Horreninspectie:* Snelle toets bij insectenwering: draairichting (binnen/buiten), aanwezigheid van een **waterkering/lekrand** (resulteert direct in selectie van benodigde opvulprofielen) en buitendorpelafloop.  
  * *Stalenregistratie:* Vastlegging van uitgeleende stalenboeken, staalkaarten of kleurstalen aan de klant.
* **7. Direct Inplannen van de Inmeetafspraak:**  
  Zodra de ruimtes, productgroepen en minimale dataset zijn ingevoerd, ontgrendelt het systeem direct de inmeetagenda. De verkoper hoeft geen offerteregels uit te rekenen om de inmeter te laten rijden.

---

### 5.4 De Minimale Dataset voor het Inplannen van een Inmeetafspraak (Fase 1 Gatekeeper)
Om te voorkomen dat inmeters op pad worden gestuurd naar onvolledige of onrijpe projecten, dwingt het portaal een mechanische **validatiepoort (gatekeeper)** af. De verkoper kan pas een datum en tijdslot in de inmeetagenda selecteren wanneer onderstaande minimale dataset volledig en correct is ingevoerd:

#### A. Verplichte Velden (Blokkerend vóór Agenda-Vrijgave):
1. **Klantidentificatie & Contact:**  
   * Volledige naam van de opdrachtgever/contactpersoon.
   * Geldig telefoonnummer (voor telefonische verificatie en notificatie vooraf).
   * Geldig e-mailadres (voor automatische afspraakbevestiging en dossierkoppeling).
2. **Gevalideerd Montage- / Bezoekadres:**  
   * *Bestaande bouw:* Straat, huisnummer, toevoeging, postcode en woonplaats.
   * *Nieuwbouw / Woning in aanbouw (conform §5.7):* Projectnaam, Bouwnummer of Kavelnummer (verplicht identificatiekenmerk), Woonplaats, en specifieke bouwplaatsinstructie / navigatieaanwijzing (bijv. poortnummer of meldpunt).
3. **Ruimtelijke Selectie (Minimaal 1 Ruimte):**  
   * De verkoper moet minimaal één ruimte toevoegen aan het dossier (bijv. *Woonkamer*, *Keuken*, *Slaapkamer 1*, *Trap*) conform de ruimtelijke hiërarchie (Deel 2).
4. **Beoogde Productcategorie / Productgroep (Minimaal 1 per ruimte):**  
   * Aan elke geselecteerde ruimte moet minimaal één productgroep zijn gekoppeld (bijv. Gordijnen & Rails, Duette & Plissé, Horizontale Jaloezieën, Verlijmd PVC, of Traprenovatie).  
   * *Waarom verplicht?* Dit is essentieel voor de capaciteitsplanning van de retailer:
     * *Inmeettijd-calculatie:* Een traprenovatie vergt 45–60 minuten opnametijd, terwijl twee gordijnrails in 15–20 minuten zijn ingemeten. Het portaal berekent op basis van de gekozen groepen automatisch de benodigde tijdslotduur in de agenda.
     * *Specialisme-toewijzing:* Vloeren en traprenovaties vereisen specifieke apparatuur (vochtmeter, reitest, 3D-markers) en een ander vakspecialisme dan raamdecoratie en confectiestoffen.
5. **Indicatieve Montagewens & Demontagestatus:**  
   * Montage door retailer gewenst (Ja / Nee / Nader te bepalen).
   * Oude raambekleding/vloer aanwezig die gedemonteerd moet worden (Ja / Nee).

#### B. Wat is NADRUKKELIJK NIET Verplicht in Fase 1?
* **Conceptmaten:** Zijn volledig optioneel. Heeft de klant globale afmetingen meegenomen, dan noteert de verkoper deze als indicatie. Heeft de klant geen maten, dan blijft het veld leeg zonder dat het de inmeetafspraak blokkeert.
* **Klantfoto's:** Zijn optioneel. Foto's van stalen of de huidige woning die de klant toont kunnen direct worden opgeslagen in de contextuele mediatheek van de ruimte, maar zijn geen voorwaarde.
* **Definitieve Artikel-, Stof- of Kleurkeuze:** De klant hoeft in de showroom nog geen bindende keuze te maken; de selectie van de productgroep en een globale prijsklasse volstaat voor de inmeetopdracht.

---

### 5.5 Rol-Specifieke Schermen & Functionaliteitsmatrix per Ketenfase (Wat Ziet en Kan Wie?)
Binnen het taakgerichte canvas geldt het fundamentele architectuurprincipe: **"Veel van de schermen wat iedereen ziet zijn gelijk, maar sommige rollen zien meer of minder informatie, en sommige rollen kunnen meer of minder doen."**

#### De Keteninteractiematrix per Rol en Ketenfase:

| Rol | Fase 1: Intentie & Intake | Fase 2: Inmeting & Schouw | Fase 3: Offerte & Calculatie | Fase 4: Bestelling & Inkoop | Fase 5: Planning & Montage | Fase 6: Service & Nazorg |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Verkoper** | **Volledig Actief:** Ruimtes/producten toevoegen, \"Kopieer & Pas Aan\" workflow, intake-checklist (inmeetbijdrage € 75,-, vloerensloop/afvoer, montageprofiel), optionele conceptmaten en klantfoto's, inmeetafspraak inplannen. | **Informatief:** Volgt status; kan geen meetwaarden muteren. | **Volledig Actief:** Uitbrengen van offertes op basis van inmeetdata; beheer van revisies (V1 → V2). | **Informatief:** Ziet bestelstatus; orderafhandeling loopt via ERP. | **Informatief:** Ziet montagedatum ter informatie voor klant. | **Informatief:** Ziet servicemeldingen van eigen klanten. |
| **Inmeter** | **Inzage:** Ziet nieuwe afspraak in persoonlijke agenda met ruimtes en wensen. | **Volledig Actief:** Mobiele inmeet-app, 50 cm raster, maten definitief maken (Geverifieerd), 5-koloms checklist, contextuele foto-annotatie. | **Bevroren:** Inmeetbon is read-only; geeft toelichting bij vragen. | **N.v.t.** | **N.v.t.** | **N.v.t.** |
| **Ordercontroleur / Backoffice** | **N.v.t.** | **Technisch Toezicht:** Signaleert binnengekomen inmetingen op dashboard. | **Actief:** Ondersteunt verkoper bij complexe maatwerk-calculaties. | **Volledig Actief:** Vier-ogenprincipe, conditional logic toets, maten 'bevriezen', verwerking orderbevestigingen toeleveranciers (Stan), bewaking leverweek, financieel escalatieprotocol (€ 200 - € 300). | **Ondersteunend:** Handelt eventuele technische naleveringen af. | **Actief:** Bestelt vervangende service-onderdelen via ERP. |
| **Planner** | **Capaciteit:** Beheert beschikbare tijdsloten in inmeetagenda. | **Monitoring:** Bewaakt realtime voortgang van inmeetroutes. | **Voorbereiding:** Ziet goedgekeurde verkooporders aankomen. | **Logistiek:** Monitort magazijnbinnenmeldingen (status Compleet Binnen / Zwart in dashboard). | **Volledig Actief:** Grafisch planbord (Route A magazijngestuurd vs Route B vooruitplanning met 2-3 wk buffer), week-vooruit controlecyclus (Guy), busindeling, droogtijden (egalisatie), toewijzen rolsteiger ≥ 4m. | **Ondersteunend:** Plant servicebezoeken in overleg met klant. |
| **Monteur** | **N.v.t.** | **N.v.t.** | **N.v.t.** | **N.v.t.** | **Volledig Actief:** Mobiele werkbon met **uitsluitend definitieve productiematen**, steunafstanden, foto-upload, afvinken van de 3 opleveringsvragen, registratie mobiele PIN-betaling en aftekening opleverbon. | **N.v.t.** |
| **Servicemonteur** | **N.v.t.** | **N.v.t.** | **N.v.t.** | **N.v.t.** | **N.v.t.** | **Volledig Actief:** Mobiele serviceticket-app, dossierhistorie, herstelrapport en aftekening nazorg. |

---

#### Het Monteur-Opleverscherm: Directe Oplevering & PIN-Registratie (Fase 5)
Bij aanvang en afronding van de montagewerkzaamheden toont het mobiele monteursscherm een dedicated kwaliteitsmodule die een waterdichte uitvoering borgt:
0. **Nulmeting bij Binnenkomst (Foto- & Videoschadepreventie):**  
   Vóór aanvang van de werkzaamheden legt de monteur verplicht de bestaande situatie van de ruimtes, vloeren, wanden en looproutes vast (foto's of korte videorondgang). Dit beschermt de woninginrichter tegen onterechte claims van klanten over reeds aanwezige stuc-, wand- of vloerbeschadigingen (bijv. parketschade bij egaliseren).
1. **Verplichte 3-Punts Kwaliteitsafvinking:**
   * `[x]` *Product doorgenomen met klant:* Het gemonteerde product is fysiek samen met de klant bekeken.
   * `[x]` *Werking & bediening gedemonstreerd:* De werking van handgreep, ketting, SmartCord of elektrische aansturing/app is volledig gedemonstreerd en begrepen door de klant.
   * `[x]` *Compleetheid & schadevrijheid gecontroleerd:* Geen beschadigingen aan product, kozijnen of interieur; eventuele montagebevindingen/restpunten zijn fotografisch vastgelegd.
   * *Dwingend 4-Delig Fotoprotocol bij Restpunten/Claims:* Indien bij de inspectie transportschade, fabrieksfouten of maatafwijkingen worden geconstateerd, dwingt de app vóór het indienen van de serviceorder het **4-delige fotoprotocol** af (1. overzicht, 2. detail, 3. open/dicht, en 4. **rolmaat/meetlat strak langs het defect** conform fabrikanteisen zoals Luxaflex; zie §4.6).
2. **Financiële Afwikkeling & Mobiele PIN-Registratie:**
   * Het scherm toont automatisch het openstaande restantbedrag (Factuurtotaal minus eerdere Aanbetaling).
   * De monteur activeert het mobiele PIN-apparaat. Na succesvolle pintransactie registreert de monteur de betaalbevestiging/transactiecode direct in het dossier.
3. **Digitale Ondertekening Opleverbon & Realtime Gereed-Signaal:**
   * De klant tekent op het scherm voor ontvangst, werking en betaling. De getekende opleverbon wordt direct per e-mail aan de klant verzonden en archiveert het dossier.
   * **Geautomatiseerd Gereed-Signaal naar Planning & Kantoor:** Op het moment van ondertekening stuurt het systeem direct een geautomatiseerd gereed-signaal naar de planner en showroom. Hierdoor wordt de vrijgekomen dagcapaciteit direct inzichtelijk voor het oppakken van ad-hoc serviceklussen (zoals een hordeur van 30 min in Eijsden of herstel van een gordijnrail).

---

### 5.6 Retailer-Organisatie, Interne Rollen & Autorisatiematrix (CRUD & Status-Gating)

#### 5.6.1 Retailer-Organisatie & Beheerder (Admin)
* **De Retailer Beheerder (Admin):**  
  De centrale beheerrol binnen het retailbedrijf. Verantwoordelijk voor het inrichten van vestigingen en showrooms, het aanmaken en beheren van interne medewerkersaccounts, het toewijzen van gebruikersrollen, en het configureren van bedrijfsspecifieke parameters (zoals standaarduurtarieven, leverancierskoppelingen en algemene voorwaarden).
* **Medewerkersaccounts & Multi-User Toegang:**  
  Iedere interne medewerker beschikt over een strikt persoonlijk account met two-factor authentication (2FA). Alle mutaties, overrules en statustransities worden gelogd op medewerkersniveau.
* **Vestigingen & Showrooms (Optioneel):**  
  Ondersteuning voor retailers met meerdere fysieke winkellocaties. Klanten en dossiers zijn gekoppeld aan een primaire vestiging, maar kunnen indien geautoriseerd over meerdere vestigingen worden ingezien.

#### 5.6.2 De 6 Operationele Medewerker-Rollen in Detail
1. **Verkoper (Showroom, Advies & Offerte):**
   * *Verantwoordelijkheid:* Klantbegeleiding in de showroom of aan huis, smaak- en stalenadvies, initiële productconfiguratie via de "Kopieer & Pas Aan" workflow, calculatie van voorlopige prijzen, uitbrengen van offertes, en het direct in overleg met de klant inplannen van de inmeetafspraak op de agenda van de inmeter.
   * *Scherm- & Data-Rechten:* Toegang tot productcatalogus, stalenbeheer, klantwensen, offerte- en orderinvoer, invoer van optionele conceptmaten en klantfoto's, en het direct inplannen van de inmeetafspraak in de inmeetagenda.  
   * *Strikte Beperking:* De verkoper kan **nooit maten definitief maken** (deze velden zijn vergrendeld) en heeft géén toegang tot managementrapportages (buiten scope V1).
2. **Inmeter (Technische Opname & Haalbaarheid ter Plekke):**
   * *Verantwoordelijkheid:* Bezoekt het fysieke pand (Fase 2) voor de exacte maatvoering volgens het meetraster (max. 50 cm tussenruimte). Bepaalt de technische rekenregels (dagmaat vs blijvende maat), toetst pakkethoogte en draaikiepraam-vrijgave, bepaalt de montagevolgorde bij gekoppelde posities in hoeken, doorloopt de vaste 5-koloms inmeetchecklist (§3.1.8 / §3.2.6 / §3.3.11 / §3.4.6 / §3.5.5), registreert ondergrond- en inspectiebeperkingen, en schat de benodigde montageduur in per positie.
   * *Scherm- & Data-Rechten:* Mobiele/tablet inmeet-app, registreren van laser- en strakke maten, toevoegen en annoteren van contextuele foto's (stylus), en het **definitief valideren van de inmeetmaten (Status: Geverifieerd op Locatie)**.  
   * *Strikte Beperking:* Ziet geen offertetotalen of verkoopprijzen.
3. **Ordercontroleur / Werkvoorbereider (Kwaliteitscontrole & Vier-ogenprincipe):**
   * *Verantwoordelijkheid:* Voert het vier-ogenprincipe uit vóór overdracht naar het ERP. Vergelijkt de inmeetbon met de showroomofferte (profielkleur, bedieningszijde, montagewijze, plooitype). Toetst conditional logic beslisbomen en initieert revisies (V1 → V2) bij technische uitsluitingen met 100% behoud van ingemeten maten.
   * *Scherm- & Data-Rechten:* Volledige inzage in technische en commerciële configuratiedata. Bevoegd om maten te vergrendelen (**Status: Productie-Definitief**) en het dossier vrij te geven voor orderverwerking in LogicTrade.
4. **Planner (Capaciteit, Materieel & Logistiek):**
   * *Verantwoordelijkheid:* Vertaling van gevalideerde orders naar een haalbare uitvoeringsplanning zodra materialen in het ERP beschikbaar zijn gemeld. Koppelt montageafspraken aan specifieke vakdisciplines (vloerenleggers vs raamdecorateurs), bewaakt de dwingende productvolgorde (vloer en droogtijd eerst, daarna raambekleding), plant tijdsblokken en reserveert specialistisch klimmaterieel (rolsteiger ≥ 4m).
   * *Scherm- & Data-Rechten:* Grafisch planbord, route- en capaciteitskalender, toewijzen van monteurs en busvoorraden, order- en montagestatussen wijzigen.
5. **Monteur (Vakmatige Uitvoering op Locatie):**
   * *Verantwoordelijkheid:* Fysieke plaatsing en installatie van materialen (egaliseren, vloeren leggen, rails en gordijnen ophangen, raamdecoratie monteren). Hanteert de door de inmeter voorgeschreven montagevolgorde en laat documenten aftekenen door de klant.
   * *Scherm- & Data-Rechten:* Mobiele werkbon-app, inzien van werkopdrachten, montagetijden, technische instructies en montagefoto's, uploaden van opleverfoto's, laten ondertekenen van Tussenbonnen (betredingsverbod) en definitieve opleveringsbevestigingen.
   * *Strikte Kwaliteits-Gating:* De monteur ziet op zijn scherm **uitsluitend definitieve productiematen en blijvende maten**! Ziet GEEN conceptmaten of voorlopige schetsen om fatale montagefouten op de ladder uit te bannen.
6. **Servicemonteur (Nazorg, Garantie & Reparaties):**
   * *Verantwoordelijkheid:* Zelfstandig afhandelen van restpunten na de oplevering, garantieclaims, herstelwerkzaamheden en mechanische bijstellingen.
   * *Scherm- & Data-Rechten:* Mobiele serviceticket-app, inzien van historisch opleverdossier, aanvragen van vervangende onderdelen via het ERP, en laten ondertekenen van servicemeldingen.

#### 5.6.3 Autorisatie- en CRUD-Gating Matrix per Data-Entiteit

| Data-Entiteit | Verkoper | Inmeter | Werkvoorbereider | Planner | Monteur | Servicemonteur |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Klant- & Adresgegevens** | C / R / U | R | R / U | R | R | R |
| **Ruimtes & Positiestructuur** | C / R / U | C / R / U | R / U | R | R | R |
| **Conceptmaten & Klantnotities** | C / R / U | R | R | R | **Geen Toegang** | **Geen Toegang** |
| **Geverifieerde Inmeetmaten** | R | **C / R / U (Lock)** | R / Overrule | R | R | R |
| **Productie-Definitieve Maten** | R | R | **Lock (Bevriezen)**| R | **R (Werkbon)** | R |
| **Offertes & Calculaties** | C / R / U | **Geen Toegang**| C / R / U | **Geen Toegang**| **Geen Toegang**| **Geen Toegang**|
| **ERP-Overdracht (LogicTrade)** | **Geen Toegang**| **Geen Toegang**| **Vrijgave voor ERP** | R | **Geen Toegang**| C / R (Service) |
| **Montageplanning & Planbord** | R | R | R | **C / R / U** | R | R |
| **Werkbon & Opleverhandtekening**| R | R | R | R | **U / Sign** | **U / Sign** |

*Legenda: C = Create (Aanmaken), R = Read (Inzien), U = Update (Wijzigen), Lock = Formeel valideren / vergrendelen, Sign = Digitaal laten ondertekenen door klant.*

---

### 5.7 Klant- & Projectadresbeheer: Factuuradres vs. Montageadres & Nieuwbouw
Elke klant heeft in het portaal twee functionele adresrollen:

* **1. Factuuradres (Financieel & Juridisch):**
  * Het officiële vestigings- of woonadres van de opdrachtgever waar facturen, betaalverzoeken en juridische overeenkomsten naartoe worden gestuurd.
  * Betreft altijd een regulier, gevalideerd adres (Straat, Huisnummer, Toevoeging, Postcode, Woonplaats, Land).

* **2. Montageadres / Bezoekadres / Projectlocatie (Fysiek & Logistiek):**
  * De fysieke locatie waar de inmeter de maten komt opnemen en waar de monteurs de goederen leveren en installeren.
  * **Standaardregel (Default):** Het montageadres is automatisch gelijk aan het factuuradres (*"Montageadres is hetzelfde als factuuradres"* staat standaard aangevinkt).
  * **Afwijkend Montageadres (Twee Verschijningsvormen):**
    * **Optie A: Bestaande Bouw (Regulier Bezoekadres):**
      * Bijvoorbeeld bij een verhuizing naar een bestaande woning, een kantoorlocatie of een tweede woning.
      * Invoer: Reguliere straat, huisnummer, toevoeging, postcode en plaats (gevalideerd via de landelijke postcodecheck).
    * **Optie B: Nieuwbouw / Woning in Aanbouw (Projectlocatie zonder regulier adres):**
      * Komt veelvuldig voor bij nieuwbouwprojecten waar de klant al tijdens de ruwbouw of vanaf bouwtekening een inrichting koopt.
      * *Kenmerken in de praktijk:* De landelijke postcode is vaak nog niet actief in de BAG-database, officiële huisnummers kunnen tijdens de bouw nog wijzigen (bijv. bij kavelopsplitsing), en navigatiesystemen herkennen de straatnaam nog niet op het afgesloten bouwterrein.
      * *Specifieke Invoervelden voor Nieuwbouw:*
        * **Projectnaam:** De overkoepelende naam van het bouwproject (bijv. *"Woonpark De Zeelt Fase 2"*).
        * **Bouwnummer / Kavelnummer:** De unieke contractuele identificatie (bijv. *"Bouwnummer 34"* of *"Kavel B12"*) — **verplicht identificatiekenmerk**.
        * **Plaats / Gemeente:** De vestigingsplaats van het nieuwbouwproject.
        * **Voorlopige Straatnaam & Huisnummer:** *(Optioneel, indien reeds toegekend door de projectontwikkelaar).*
        * **Bouwplaats-instructies & Navigatie:** Vrije werkaanwijzing voor inmeter en monteur (bijv. *"Ingang bouwterrein via Noorderringweg poort 2, melden bij bouwkeet hoofdaannemer, sleutel bij uitvoerder Jan"* of GPS-coördinaten/Plus Code).
      * *Omzettings-trigger (Workflow):* De inmeter meet in de ruwbouwfase op basis van het bouwnummer en de bouwtekening. Vóór de definitieve montage en oplevering dwingt het portaal af dat het voorlopige nieuwbouwadres wordt omgezet en verrijkt naar een definitief, gevalideerd BAG-adres met definitief huisnummer en postcode.

---

### 5.8 Beveiliging, Autorisatie & Gegevensscheiding (RBAC & Multi-Tenancy)
* **Strikte Dossier-Isolatie:** Klanten en hun genodigden hebben uitsluitend toegang tot hun eigen projectdossier. Gegevens van andere klanten of interne bedrijfsinformatie van de retailer zijn strikt afgeschermd.
* **Eén Centrale Waarheid:** Zowel de retailer als de klant kijken in het portaal naar dezelfde realtime status: dezelfde strakke inmeetmaten, dezelfde gehanteerde rekenregels, dezelfde montagedatums en dezelfde opleverdocumenten.

---

### 5.9 Architectuurprincipe: De 80/20-Regel & Gestructureerde vs. Vrije Invoer in het Portaal
* **Snelheid voor 80% Standaardsituaties:**  
  Om de inmeetapplicatie en het portaal ter plaatse snel, intuïtief en efficiënt te houden, wordt het formulier **niet overladen met honderden complexe dropdowns en invoervelden voor zeldzame woonsituaties (de 10-20% uitzonderingen)**.
* **Borging via Vrije Notities & Foto-Annotatie:**  
  Uitzonderingen (zoals afwijkende klinkspeling, schuin plafondverloop, stucprofielen of bijzondere obstakels) worden gedocumenteerd via een **vrij opmerkingenveld per positie** gecombineerd met een **verplichte foto-upload waarin de inmeter direct met stylus markeringen en maataantekeningen schetst**.

---

### 5.10 Klant-Domein: Klant Admin & Externe Toegang (Toekomstige Functionaliteit — Buiten Scope Versie 1)
> [!NOTE] Toekomstige Functionaliteit (Buiten Scope Versie 1)
> Het Klantportaal en het externe Klant-Domein zijn gereserveerd voor een latere release en vallen nadrukkelijk buiten de scope van Versie 1 (V1). In V1 verloopt de communicatie via de reguliere contactkanalen en de interne medewerkersrollen. Onderstaande specificatie beschrijft de architectuur voor toekomstige versies, waarin de klant zelfstandig foto's, filmpjes en plattegronden kan uploaden, conceptmaten kan invoeren ter voorbereiding op het showroomadvies, en de uitvoeringsstatus kan volgen.

* **Eigen Klantaccount (Toekomstige Release):** Elke particuliere of zakelijke opdrachtgever ontvangt bij het eerste contact of de offerteaanvraag een persoonlijk account voor het Klantportaal.
* **Klant Admin (Eigenaar van het Klantdossier):**
  * De primaire contractant/opdrachtgever is automatisch de **Klant Admin** van het eigen dossier.
  * Heeft volledige zeggenschap over het project: kan offertes digitaal accorderen, betalingen inzien, planning volgen, en opleverbonnen ondertekenen.
  * **Uitnodigingsbevoegdheid:** De Klant Admin kan zelfstandig **andere personen uitnodigen** om toegang te krijgen tot het portaal en hen een specifieke rol toekennen binnen zijn project.
* **Selfservice Conceptinvoer & Media-Upload (Toekomstige Release):**  
  De klant kan proactief eigen foto's en video-opnames van de woonsituatie uploaden, evenals indicatieve conceptmaten (breedte × hoogte per raam of vloeroppervlakte) invoeren ter voorbereiding op het adviesgesprek in de showroom. Daarnaast kunnen plattegronden, keukenplannen, leidingschema's en kozijntekeningen worden geüpload, zodat adviseur en inmeter vooraf optimaal geïnformeerd zijn.

#### Rollen binnen het Toekomstige Klantportaal:
* **1. Klant Admin (Hoofdopdrachtgever / Eigenaar):**  
  Volledige rechten binnen het eigen dossier: ondertekenen, financiële inzage, planning wijzigen/bevestigen, en het beheren van genodigden.
* **2. Gezinslid / Partner (Mede-beslisser):**  
  Volledige inzage in de geselecteerde producten, stoffen, kleuren en visualisaties; mogelijkheid om keuzes te bevestigen of opmerkingen achter te laten; inzien van montagedata.
* **3. Architect / Interieurarchitect / Stylist (Professioneel Ontwerper):**  
  Toegang tot technische maten, strakke dagmaten, plattegronden, kleur- en materiaalstalen, en montagewijzen; kan opmerkingen toevoegen aan posities en esthetische richtlijnen uploaden. Heeft géén inzage in persoonlijke financiële gegevens van de klant.
* **4. Aannemer / Bouwbegeleider / Klusbedrijf (Bouwkundige Partner):**  
  Inzage in de uitvoeringsplanning, bouwkundige randvoorwaarden, vochtmetingsresultaten, droogtijden en oplevereisen. Zorgt voor naadloze aansluiting tussen bouwwerkzaamheden en inrichtingsmontage.
* **5. Projectleider / Locatiemanager (Zakelijke Opdrachtgevers / B2B):**  
  Coördinatie van sleutelbeheer, pandtoegang, goederenliften, parkeerontheffingen en operationele aftekening van deelleveringen ter plekke.

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
