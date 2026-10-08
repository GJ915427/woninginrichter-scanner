# Domein- en Procesmodel Woninginrichting (EasyM2M)

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
Het proces wordt gedragen door zeven nauw samenwerkende rollen (zes interne medewerkers van de woninginrichter en de klant):
1. **Verkoper / Adviseur:** Voert het adviesgesprek in de showroom of winkel, inventariseert wensen, legt klantdata en voorlopige productkeuzen vast en plant de inmeetafspraak in.
2. **Inmeter:** Bezoekt de klantlocatie, valideert de bouwkundige situatie, legt routes, schetsen, foto's en exacte maten vast en past draft-producten aan waar de situatie dat vereist.
3. **Controleur:** Veelal de inmeter zelf (of een ervaren werkvoorbereider); voert een onafhankelijke 4-ogen controle uit op de consistentie tussen verkoopofferte, meetverslag en ERP-invoer vóórdat definitieve inkooporders worden verstuurd.
4. **Planner:** Beheert de capaciteit en plant zowel de inmeetorders als de definitieve montagedata in, inclusief toewijzing van de juiste monteurskwalificaties.
5. **Monteur:** Voert de fysieke montage uit op locatie, verifieert vooraf/achteraf de ruimtelijke toestand met foto's/video's (schadepreventie), vinkt posities af en registreert montagebevindingen.
6. **Servicemonteur:** Lost eventuele opleverbevindingen, naleveringen of restpunten gericht op locatie op via een nieuwe montageloop.
7. **Klant:** Particuliere of zakelijke opdrachtgever; fungeert als formele ondertekenaar bij sleutelmomenten in het dossier (inmeetorder, verkooporder, opleverontvangst en servicerapport).

### 1.3 Systeemarchitectuur & Integratiekader (ERP & Outlook)
* **ERP-integratie (LogicTrade):** In versie 1 valt een geautomatiseerde orderdoorvoer buiten de scope van het portaal. Offertes, leveranciersorders (inkoop) en facturatie vinden primair plaats vanuit het ERP-systeem. Voor het opvragen van actuele catalogusproducten en productspecificaties is een API-koppeling met LogicTrade wenselijk.
* **Tweeweg Agendasynchronisatie (Outlook):** De agenda in het portaal en Microsoft Outlook is volledig tweeweg gesynchroniseerd. Zodra een inmeet- of montageorder wordt ingepland of gewijzigd (in het portaal óf in Outlook), wordt dit realtime over en weer bijgewerkt. *(De automatische herbevestiging van datumwijzigingen naar de klant is gereserveerd voor de backlog).*

### 1.4 Hoofdlijnen van de 6 Ketenfasen & Conditionele Workflow-Overgangen (Gates)
Het complete maatwerktraject verloopt via 6 vaste fasen. Hoewel de fasen identiek zijn, verschillen de te registreren parameters per productcategorie, productgroep en product. De overgang tussen fasen wordt bewaakt door conditionele workflow-gates:

* **Fase 1: De Intentiefase**  
  * *Inhoud:* Verkoper en klant maken een principekeuze van te offreren producten en werkzaamheden en plannen een inmeetafspraak. Optioneel wordt een voorlopige prijsindicatie afgegeven op basis van klantopgave.  
  * *Gate (Afsluiting):* Formeel afgesloten met een door de klant digitaal ondertekende **Inmeetorder**.
* **Fase 2: De Inmeetfase & Schouw**  
  * *Inhoud:* De inmeter meet op locatie alle posities exact in, maakt overzichts- en detailfoto's en legt schetsen vast. Eventueel voorafgegaan door een schouw (conceptmeting in ruwbouw).  
  * *Gate (Afsluiting):* Formeel afgesloten met een gevalideerd digitaal **Inmeetverslag**.
* **Fase 3: De Offertefase**  
  * *Inhoud:* Verkoper vertaalt het inmeetverslag naar een definitieve calculatie en offerte in het ERP-systeem en bespreekt deze met de klant.  
  * *Gate (Afsluiting):* Formeel afgesloten met een door de klant digitaal ondertekende **Verkooporder**.
* **Fase 4: De Bestelfase**  
  * *Inhoud:* Vier-ogen kwaliteitscontrole door de controleur op meet- en verkoopdata ter voorkoming van productiefouten, gevolgd door verzending van inkooporders naar leveranciers.  
  * *Gate (Afsluiting):* Formeel afgesloten met geaccordeerde **Inkooporders**; de fysieke binnenmelding van goederen in het magazijn fungeert als trigger voor de montagefase.
* **Fase 5: De Montagefase**  
  * *Inhoud:* Planner plant montageafspraak; monteurs monteren alle posities conform portaalinstructie, voeren voor/na schadeborging uit en registreren montagebevindingen.  
  * *Gate (Afsluiting):* Formeel afgesloten met een door de klant ondertekende **Opleverontvangst / Opleverrapport**.
* **Fase 6: De Servicefase**  
  * *Inhoud:* Servicemonteur lost geregistreerde montagebevindingen gericht op locatie op via een nieuwe montageloop.  
  * *Gate (Afsluiting):* Formeel afgesloten met een door de klant ondertekend definitief **Opleverontvangst / Servicerapport**.

### 1.5 Detailbeschrijving van de 6 Ketenfasen

#### 1.5.1 Fase 1: De Intentiefase (Verkoop & Inmeetorder)
* **Wensen & Gegevensverzameling:** De verkoper inventariseert in de showroom of adviesruimte de wensen van de klant. Alles wat noodzakelijk is voor een succesvolle inmeting wordt gestructureerd vastgelegd:
  * *Klantgegevens:* NAW-gegevens, telefoonnummer en e-mailadres.
  * *Ruimtelijke indeling:* Etages en ruimtes binnen het pand.
  * *Productgroepen & Posities:* Raamdecoratie, Gordijnen, Vloerbekleding en Trapbekleding, gekoppeld aan de beoogde montage-/inmeetposities.
  * *Productselectie met specificaties:* Producten en productspecificaties die de klant kiest om in te laten meten.
* **Werkzaamheden & Gerelateerde Artikelen/Diensten:** In deze fase worden ook al direct de bijbehorende werkzaamheden en gerelateerde artikelen vastgelegd, zoals legkosten/legloon, plinten (bij vloeren: MDF, plakplint of hoge plint), hoekprofielen en afwerklijsten.
* **Gewenste Montagedatum & Afspraakregels:** Vastlegging van een eventuele gewenste montagedatum door de klant (bijv. bij een gefaseerde verbouwing). Als standaard default geldt: er wordt géén vaste periode afgesproken; zodra alle goederen binnen zijn in het centrale magazijn wordt de montage direct ingepland op het eerst mogelijke tijdstip.
* **Conceptmaten van de Klant:** Mogelijkheid om indicatieve maten in te voeren die de klant zelf heeft meegenomen naar de showroom. Deze conceptmaten dienen voor de initiële prijsindicatie en worden bij de inmeting (Fase 2) definitief getoetst.
* **Vrij Opmerkingenveld Verkoper:** Een ruim, vrij notitieveld waarin de verkoper speciale klantwensen, bouwkundige aandachtspunten of showroomafspraken kan noteren.
* **Draft-Status van Producten:** De gekozen producten hebben de status 'draft' (concept); tijdens de inmeetfase kan en mag de inmeter gemotiveerd afwijken op basis van de fysieke bouwkundige realiteit op locatie.
* **Conditionele Overgang (Workflow Gate):** De software dwingt af dat een inmeetorder pas kan worden gegenereerd wanneer aan alle minimale invoercondities is voldaan: volledige contactgegevens, geselecteerde ruimtes en gekoppelde producten en/of productgroepen (in de praktijk zijn dit meestal specifiek gekozen producten; *(GJ: navragen bij Guy of dit ook voorkomt op zuiver productgroepniveau)*).
* **Inmeetorder & Klantbevestiging:** De inmeetorder zelf wordt aangemaakt in het ERP-systeem *(GJ: met Stefan bespreken hoe de exacte afstemming/synchronisatie verloopt)*. De inmeetafspraak wordt ingepland via het portaal, waarna de klant direct vanuit het portaal een automatische bevestigingsmail van de inmeetafspraak ontvangt.
* **Catalogus API & Agenda-Sync:** Voor het actueel ophalen van producten en productspecificaties is een API-integratie met LogicTrade wenselijk. De inplanning van de inmeetafspraak synchroniseert direct met Microsoft Outlook.

#### 1.5.2 Fase 2: De Inmeetfase & Schouw (Opname op Locatie)
* **Voorbereiding & Digitale Overdracht:** De inmeter vertrekt naar de klantlocatie met het volledige digitale dossier uit de verkoopfase op zijn tablet.
* **Conditionele Inmeetworkflow:** De inmeter doorloopt een vaste, gestandaardiseerde workflow met verplichte stappen:
  * *Entree & Looproutes:* Maken van overzichtsfoto's en filmpjes van de entree, het trappenhuis, de lift en de aanlooproutes naar de montagelocatie (logistieke toegankelijkheid).
  * *Ruimteniveau:* Maken van een duidelijke maatschets van de ruimte (voorzien van genummerde posities), overzichtsfoto's en specifieke ruimtelijke notities.
  * *Positieniveau:* Vastleggen van alle vereiste basis- en detailmaten (hoogte, breedte, montagelijnen, obstakels), detailfoto's van kozijnen of vloeren, en gerichte instructies voor offerte en montage.
  * *Capaciteits- & Monteursindicatie:* Inschatting van de benodigde montagetijd (uren) en eventueel vereiste specialistische vaardigheden (bijv. meesterstoffeerder voor trappen).
* **Productaanpassing door Inmeter:** Indien de live situatie uitwijst dat een gekozen draft-product technisch niet monteerbaar is (bijv. te geringe plaatsingsdiepte of ongeschikte ondergrond), heeft de inmeter de bevoegdheid het product in overleg aan te passen naar een technisch haalbaar alternatief.
* **Bouwkundige Schouw (Optioneel):** In situaties van ruwbouw of grootschalige renovatie kan de inmeetfase worden voorafgegaan door een 'schouw' (een conceptmeting waarbij maten en definitieve productkeuzen indicatief zijn en in een later stadium definitief worden gemaakt).
* **Afsluiting & Inmeetverslag:** De klant tekent niets na afloop van de inmeting. De fase wordt formeel afgesloten met het genereren van het officiële digitale inmeetverslag, dat direct beschikbaar is voor zowel de verkoper als de klant in het Klantportaal. De klant krijgt in het portaal echter een gefilterde weergave met minder informatie te zien: o.a. krijgt de klant de definitieve ingemeten productiematen pas te zien ná het definitief tekenen van de verkooporder in Fase 3 (ter bescherming van het inmeetintellect en faalkostenbeheersing). *(Voor gedetailleerde inmeetmethodieken en rekenregels per categorie, zie Deel 3).*

#### 1.5.3 Fase 3: De Offertefase (Calculatie, ERP & Verkooporder)
* **Dossieroverdracht naar Calculatie:** Het inmeetverslag en de klantwensen vormen het fundament voor de offerteberekening.
* **ERP-Verwerking:** De definitieve maten en productspecificaties worden in het ERP-systeem (LogicTrade) ingevoerd (in V1 handmatig door de verkoper/calculator, in latere fasen via een API-koppeling).
* **Offerte-uitgifte & Verkooptraject:** De verkoper stelt de offerte op binnen het ERP-systeem en verstuurt deze naar de klant (valt buiten de directe werking van het portaal).
* **Orderstatusflow & Uitzonderingenbeheer (95% vs. 5%):**
  * *Reguliere flow (95%):* De klant accordeert de offerte zonder wijzigingen; de verkooporder is inhoudelijk 1-op-1 identiek aan de calculatie.
  * *Afwijkingsflow (5%):* Indien de klant alsnog wijzigingen wenst (kleur, stofkeuze, aantal posities), past de verkoper zowel het dossier in het portaal als de order in het ERP handmatig aan.
* **Afsluiting:** De offertefase wordt formeel afgesloten met een door de klant ondertekende verkooporder.

#### 1.5.4 Fase 4: De Bestelfase (Verificatie door Controleur & Inkooporders)
* **Vier-Ogen Kwaliteitsborging:** Voordat inkooporders definitief naar toeleveranciers en fabrieken worden verzonden, voert een onafhankelijke controleur (in de praktijk veelal de inmeter zelf) een grondige visuele check uit.
* **Verificatieproces:** De controleur toetst de ingevoerde ERP-gegevens integraal aan de oorspronkelijke notities van de verkoper, het inmeetverslag en de fotobijlagen. Hiermee worden kostbare maat- en specificatiefouten in de productieketen geëlimineerd. *(Toekomstperspectief: Zodra er een automatische API-koppeling is gerealiseerd tussen het inmeetportaal en het ERP, zal deze handmatige vier-ogencontrole aanzienlijk verminderen of voor gestandaardiseerde orders zelfs geheel verdwijnen).*
* **Plaatsing van Inkooporders:** Na formele goedkeuring door de controleur worden de inkooporders gefiatteerd en verzonden naar de leveranciers.
* **Trigger voor Montagefase:** Na verzending bevindt het dossier zich in een wachtstatus tot de materialen fysiek in het magazijn arriveren en 'binnengemeld' worden. Deze magazijnbinnenmelding vormt de directe operationele trigger voor de planner om de montagefase in gang te zetten (het binnenmeldingsproces zelf is geen onderdeel van het portaal).

#### 1.5.5 Fase 5: De Montagefase (Planning, Uitvoering & Opleverontvangst)
* **Montageplanning:** Zodra goederen binnen zijn, plant de planner de montagedatum en wijst de benodigde monteurs toe. De klant ontvangt geautomatiseerd een bevestiging via het portaal; de afspraak wordt gesynchroniseerd met Microsoft Outlook.
* **Digitale Werkinstructie voor Monteurs:** Monteurs zien op hun tablet direct alle relevante montage-informatie: ruimtenummers, posities, montagewijzen, bijzonderheden en de route/toegang tot de werkplek.
* **Schadepreventie & Fotorapportage (Vooraf & Achteraf):**
  * Voor aanvang van de werkzaamheden maken de monteurs foto's en korte video's van de bestaande toestand van de ruimte en de route (ter voorkoming van discussies over reeds aanwezige beschadigingen).
  * Na afronding van de montage leggen zij het eindresultaat fotografisch vast.
* **Positie-Afvinking & Montagebevindingen:**
  * Elke montagepositie wordt na plaatsing individueel afgevinkt in de app, inclusief foto van het gemonteerde product en eventuele montagenotities.
  * Indien er sprake is van restpunten, transportschade, productiefouten of naleveringen, registreert de monteur direct een duidelijke 'montagebevinding' met toelichting en detailfoto's ten behoeve van de servicemonteur.
* **Afsluiting & Klantenacceptatie:** Na gezamenlijke inspectie tekent de klant op de tablet voor ontvangst op de digitale opleverontvangst / het opleverrapport. Eventuele montagebevindingen worden hierop expliciet vermeld en direct gerouteerd naar de servicefase.

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
  * *Klant-Alias (Vrij overschrijfbaar in de UI):* Elke positie krijgt automatisch een herkenbare beschrijvende suggestie (*"Raam links voorgevel"*, *"Voordeurglas"*, *"Schuifpui tuin"*); deze naam is te allen tijde door degene/de rol die is ingelogd (met de juiste rechten) direct in de UI te overschrijven naar wens van de klant.
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

#### 3.1.1 Het Principebesluit: Dagmaat vs. Blijvende Maat & UI Drie-eenheid
Het fundament van het inmeet- en berekeningsproces rust op het strikte onderscheid tussen de bouwkundige werkelijkheid en de uiteindelijke productiemaat:
* **De Inmeter Meet Altijd Dagmaat Waar Het Kan:**  
  De inmeter voert in de basis **altijd waar het kan de strakke, gemeten 'dagmaat'** (de kale werkelijkheid van het kozijn, de nis, de muur of de trap) in de software in. Indien de fysieke situatie een zuivere dagmaatmeting niet toelaat (bijv. bij complexe overlap of ontbrekende neggekanten), wordt direct de blijvende maat met expliciete aanduiding vastgelegd. Pas wanneer een specifiek product en een specifieke montagewijze (*in de dag* versus *op de dag*) aan de positie worden gekoppeld, kan de definitieve productiemaat worden afgeleid.
* **Situatie-afhankelijkheid & Toepassing:**  
  De dagmaat ligt 100% vast bij de toepassing van een specifiek product. Wanneer de toewijzing echter afhankelijk is van de specifieke bouwkundige situatie ter plekke (zoals uitstekende obstakels, afwijkende neggekanten of beperkte kozijndieptes), is het hanteren van een zuivere dagmaat niet altijd direct mogelijk zonder contextuele validatie. Pas bij het definitief toekennen van het producttype en de gewenste montagewijze treedt de berekeningslogica in werking.
* **Transparantie in de Gebruikersinterface: De Drie-eenheid:**  
  Voor elk product toont de gebruikersinterface te allen tijde transparant **drie parallelle elementen**:
  ```
  [1] Gemeten Maat (Dagmaat)  -->  [2] Gehanteerde Rekenregel (Formule & Bron)  -->  [3] Resulterende Maat (Blijvende Maat / Bestelmaat)
  ```
  Hierdoor is voor zowel de inmeter, adviseur, calculator als monteur direct inzichtelijk hoe elke productiemaat wiskundig tot stand is gekomen.
* **Handmatige Override & Verplichte Audittrail (Geen 'Black Box'):**  
  De werkvoorbereider, adviseur of inmeter kan de automatisch berekende productiemaat/blijvende maat te allen tijde **handmatig overschrijven** (override) zolang een zeldzame bouwkundige uitzondering nog niet in de rekenregels is opgenomen.  
  * Zodra een berekende maat handmatig wordt overschreven, toont de UI een duidelijke markering (`[Handmatige Aanpassing]`) en **verplicht** de software het invoeren van een korte reden/toelichting (bijv. *"Klant wenst extra overlap i.v.m. lichtkier"*, *"Afwijkende plintdikte 28 mm i.p.v. standaard 18 mm"* of *"Scheve negge vereist asymmetrische speling"*).
  * Elke handmatige aanpassing of herberekening wordt automatisch geregistreerd in het auditlogboek (inclusief tijdstempel, oude waarde, nieuwe waarde, reden en auteur) en geprint op de montage-instructie en werkbon voor de monteur, zodat het doorstrepen en handmatig corrigeren van papieren bonnen definitief verleden tijd is.
* **Scope-afbakening Versie 1 (V1):**  
  Volledig geautomatiseerde bestelconversie en directe EDI-koppelingen naar externe fabrikantportalen vallen nadrukkelijk buiten de functionele scope van Versie 1. De software ondersteunt in V1 de inmeter en binnendienst met de aangeleverde rekenregels en gevalideerde blijvende maten, waarna de orderverwerking plaatsvindt via de gecontroleerde werkvoorbereiding.

#### 3.1.2 Uniforme Werkwijze, Referentiepunten & Visuele Opname
* **Filosofie van de Uniforme Werkwijze:**  
  Een kwalitatieve inmeting staat of valt met standaardisatie. Software maakt zelfstandig geen rekenfouten, mits de juiste invoer op de juiste plek belandt. Door iedere adviseur en inmeter exact dezelfde vaste werkwijze te laten hanteren, worden menselijke vergissingen, verwisselingen van breedte en hoogte en misverstanden tussen inmeting en montage tot een absoluut minimum beperkt.
* **Vaste Meetvolgorde & Werken per Gevelopening:**  
  * **Strikte Meetvolgorde:** Altijd **eerst de breedte, daarna pas de hoogte**.
  * **Werken per Gevelopening:** De inmeter werkt en registreert strikt **per afzonderlijke gevelopening** (Positie 1, 2, 3...) in plaats van kriskras over een wandvlak. Dit elimineert nummeringssprongen in de software en waarborgt dat posities en meervoudige raamdecoratieproducten eenduidig aan elkaar gekoppeld blijven.
  * *Horizontaal (Breedte B1, B2, B3):* Altijd gemeten van **boven naar onder** (B1 = boven, B2 = midden, B3 = onder, gemeten van links naar rechts).
  * *Verticaal (Hoogte H1, H2, H3):* Altijd gemeten van **links naar rechts** (H1 = links, H2 = midden, H3 = rechts, gemeten van boven naar onder).
  * *Dagkant- & Neggemetingen (D1, D2):* D1 = dagkant/negge links, D2 = dagkant/negge rechts (beschikbare inbouwdiepte).
  * *Diagonale Kruismetingen (D1, D2):* Gestandaardiseerd voor haaksheids- en scheefstandscontrole bij kozijnen of nissen: **D1 meet van linksonder naar rechtsboven (↙ → ↗)** en **D2 meet van rechtsonder naar linksboven (↘ → ↖)**. Het verschil tussen D1 en D2 toont direct de mate van scheefstand of afwijking van de 90°-hoek.
* **De Gouden 3-Punts Meetregel & Verloop-Communicatie:**  
  * **Altijd minimaal 3 breedtes en 3 hoogtes:** Zelfs bij ramen die op het oog zuiver recht lijken, meet de inmeter altijd minimaal 3 breedtes (B1, B2, B3) en 3 hoogtes (H1, H2, H3).
  * *Waarom minimaal 3 metingen?*  
    1. *Verloop & scheefstand detecteren:* In de bouwpraktijk vertoont een gevelopening vrijwel altijd verloop van 1 tot 2 cm (bijv. H1 = 85 cm, H2 = 84 cm, H3 = 83 cm).
    2. *Verloopcommunicatie met de klant (voorkomen opleverklachten):* Wordt een verloop van > 5 mm geconstateerd? Dan bespreekt de inmeter dit ter plekke met de klant en legt dit vast op het digitale inmeetverslag (*"Verloop van X mm besproken met klant; risico op optische scheefstand of lichtkieren geaccepteerd"*). Hiermee wordt voorkomen dat de klant de monteur bij oplevering aanspreekt op scheefhangen of kieren.
    3. *Maatbepaling:* De kleinste strakke breedte en kleinste strakke hoogte bepalen de blijvende maat (bestelmaat) bij montage in de dag.
  * *Kruismeting uitsluitend bij uitzondering:* In de dagelijkse praktijk is een tijdrovende kruismeting op standaard ramen overbodig, omdat de 3 breedtes en 3 hoogtes eventueel verloop al aantonen. Een diagonale kruismeting is uitsluitend verplicht bij:
    1. Zichtbaar scheve openingen of grote erkers;
    2. Vaste kadersystemen die exact haaks moeten sluiten (zoals TruFit of FrameFix).
* **Ingangscontrole Monteurs Vóór Boren en Uitpakken (Faalkosten- en Schadeborging):**  
  Monteurs mogen nooit blindelings beginnen met boren of verpakkingen opensnijden op basis van doosstickers of werkbonnen.  
  * *Vast protocol bij binnenkomst:*  
    1. *Laser-controlemeting:* De monteur pakt direct zijn laserafstandsmeter en meet in 10 seconden snel de strakke breedte en hoogte van de opening (klik-klik).  
    2. *Vergelijking met fabriekssticker & werkbon:* De monteur vergelijkt deze controlematen met de productiesticker op de gesloten doos en de inmeetbon.  
    3. *Vrijgave voor montage:* Pas wanneer de gemeten maten matchen met het product (binnen de toleranties), legt de monteur de beschermdeken neer, opent de verpakking en start het boorwerk.  
    4. *Escalatie bij afwijking:* Wijkt het geleverde product af van de opening (bijv. doossticker vermeldt 1,50 m of 2,38 m terwijl de sparing 2,24 m is)? Dan blijft de verpakking hermetisch gesloten en neemt de monteur direct contact op met de binnendienst/planning. Dit voorkomt onnodige gaten in klantmuren en garandeert dat ongeschonden producten direct retour fabrikant kunnen.
* **Trapeziumramen & Schuine Gevels (Wiskundige Inmeetregel):**  
  Bij schuine raampartijen of trapeziumramen meet de inmeter uitsluitend:
  1. De **rechte breedte** aan de onderzijde (of bovenzijde bij omgekeerd trapezium);
  2. De **kortste hoogte** (punt-naar-punt);
  3. De **grootste hoogte** (punt-naar-punt).  
  * **Strikt verbod op tussenhoogtemeting:** Er mag bij trapeziumramen **geen tussenmaat in het midden** worden gemeten. Indien een tussenmaat niet exact op het wiskundige middenpunt wordt opgenomen, ontstaat een afwijking die de wiskundige berekeningsalgoritmen van de confectie- en productiesoftware corrumpeert. De fabrikant berekent de exacte schuinte en snijhoek zuiver wiskundig op basis van de breedte en de twee uiterste hoogtematen.
* **Kijkrichting (Binnen vs. Buiten):**  
  * *Standaard (Raamdecoratie, Gordijnen & Binnentoepassingen):* De inmeter staat in de ruimte en kijkt van **binnen naar buiten** tegen het kozijn of het vlak aan. Links is fysiek links vanuit de kamer gezien.
  * *Uitzondering (Buitenzonwering & Screens):* Bij buitentoepassingen (zoals zipscreens of rolluiken gemonteerd op de buitengevel) wordt gemeten en gekeken **van buitenaf tegen de gevel**. De software markeert deze kijkrichting expliciet in de positie-interface (`[Kijkrichting: Buitenaf Gevel]`).
* **Montagehoogte, Reikhoogte & Child Safety (EN 13120):**  
  Montagehoogte (afstand van afgewerkte vloer tot bovenzijde montagesteun) is een **verplicht invoerveld** voor alle raamdecoratie en gordijnen.  
  1. *Materieelkeuze monteur:* Geeft logistiek aan of een standaard huishoudtrap (tot 2,60 m) volstaat of dat een kamersteiger/hoge bordestrap (vanaf 3,50 m) moet worden meegeladen.  
  2. *Child Safety (EN 13120):* Bedieningskettingen en -koorden moeten te allen tijde minimaal **1,50 m boven de afgewerkte vloer** hangen.  
  3. *Reikhoogte-advies:* Bij handbediende Top-Down / Bottom-Up plissés en Duettes op een montagehoogte > 2,10 m kan de bovenste handgreep niet meer vanaf de vloer worden bediend. De inmeettool toont verplicht een adviesmelding om een magnetische bedieningsstang aan de order toe te voegen of over te stappen op SmartCord® / accumotorisatie (bespreken met klant).
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

#### 3.1.3 Meetpuntdichtheid & Scheefstandscontrole (Het 50 cm Raster)
Kozijnen en muren zijn in de praktijk zelden perfect haaks of waterpas. Daarom geldt een strikt meervoudig meetprotocol:
* **Drie Breedtematen & Drie Hoogtematen (De Basis):**  
  Voor elke gevelopening worden minimaal 3 breedtematen (boven, midden, onder) en 3 hoogtematen (links, midden, rechts) gemeten en geregistreerd.
* **Het 50 cm Raster & Meetpuntdichtheid (Max. 50 cm tussen Meetpunten):**  
  Om scheluwe kozijnen, doorzakkende bovendorpels of scheve vensterbanken nauwkeurig te detecteren, mag de afstand tussen twee opeenvolgende meetpunten **nooit meer dan 50 cm** bedragen:
  * *Tot en met 50 cm breedte/hoogte:* Minimaal 2 meetpunten (uiterst links en uiterst rechts: 0 cm en 50 cm → tussenafstand ≤ 50 cm).
  * *Van 51 cm tot en met 100 cm breedte/hoogte:* **Minimaal 3 meetpunten** (uiterst links, exact in het midden en uiterst rechts: bijv. 0 cm, 50 cm en 100 cm → tussenafstand ≤ 50 cm; bij 100 cm zijn dus al 3 meetpunten vereist).
  * *Van 101 cm tot en met 150 cm breedte/hoogte:* **Minimaal 4 meetpunten** (bijv. 0, 50, 100 en 150 cm).
  * *Boven 150 cm breedte/hoogte:* Om de maximaal 50 cm een extra meetpunt (bijv. bij een raampartij van 3,20 m breed: minimaal 8 breedtematen over de volledige overspanning).
  * *Rekenregel:* Het minimum aantal meetpunten bedraagt: `Aantal meetpunten = roundup(Afmeting / 50 cm) + 1`.
* **Scheefstandscontrole & Diagonale Kruismeting:**  
  * De software toetst automatisch het verloop tussen de uiterste maten. Bij een maattolerantie-overschrijding (> 5 mm verloop) geeft de UI direct een waarschuwing: `⚠️ Scheefstand Gedetecteerd`.
  * Bij vermoeden van een parallellogram (waarbij overstaande zijden wel gelijk zijn maar de hoeken niet haaks), voert de inmeter verplicht een **diagonale kruismeting** uit (kruislingse meting van linksonder naar rechtsboven en van rechtsonder naar linksboven). Indien de diagonalen meer dan 5 mm verschillen, is sprake van scheefstand die specifieke montagemaatregelen vereist.
* **Kritieke Maatbepaling:**  
  * *In de Dag:* De strakste (kleinste) gemeten maat geldt als uitgangspunt voor de productiemaatberekening.
  * *Op de Dag:* De grootste gemeten maat geldt als referentie voor de benodigde overlap.

#### 3.1.4 Hoogtematen, Bovenlichten & Montagehoogte
* **Driedelige Hoogteregistratie:**  
  Bij gevelopeningen met borstweringen registreert de inmeter drie afzonderlijke hoogtematen:
  1. *Borstweringhoogte:* Vloer tot onderkant kozijn/vensterbank.
  2. *Kozijnhoogte (Dagmaathoogte):* Onderkant kozijn tot bovenkant kozijn.
  3. *Latei-/Plafondhoogte:* Bovenkant kozijn tot onderkant afgewerkt plafond.
* **Bovenlichten & Tussenregels:**  
  Ramen met bovenlichten (vaste beglazing boven een tussenkader of stolpraam) kunnen naar keuze van de klant als één doorlopende positie of als twee gescheiden posities worden geconfigureerd. Indien gescheiden, wordt de hoogte van de tussenregel exact ingemeten om te waarborgen dat tussenprofielen van de raambekleding visueel samenvallen met het kozijnkader.

#### 3.1.5 Meetapparatuur & Handmatige Validatie in V1
* **Geijkte Meetapparatuur:**  
  Inmetingen worden uitgevoerd met professionele, geijkte laserafstandmeters met vlakke referentie-aanslag en meetnauwkeurigheid ±1 mm, aangevuld met een stijve stalen rolmaat met magnetische kop voor detail- en nismetingen.
* **Validatieproces in Versie 1 (V1):**  
  In Versie 1 van de software voert de inmeter de lasermeting uit, **controleert de meetwaarde visueel op de display van de lasermeter**, en toetst deze tegen de fysieke situatie alvorens de waarde bewust handmatig in de applicatie in te voeren.
* **Toekomstige Doorontwikkeling (Expliciet Buiten Scope V1):**  
  Directe Bluetooth-doorschieting of geautomatiseerde sensoroverdracht vanuit meetapparatuur naar de tablet wordt aangemerkt als een mogelijke toekomstige verrijking, maar valt **nadrukkelijk buiten de functionele scope van Versie 1**. De bewuste menselijke invoer en validatie waarborgen dat de inmeter reflecteert op de ingevoerde getallen en afwijkingen direct signaleert.
* **Vakmanschap & Klantvertrouwen:**  
  Het inmeetbezoek is hét moment waarop de klant deskundigheid en professionaliteit ervaart. Een rustige, gestructureerde werkwijze waarbij de inmeter metingen hardop toetst, details inspecteert en bewuste controlemomenten inbouwt, straalt betrouwbaarheid en vakmanschap uit en versterkt het vertrouwen in de uiteindelijke oplevering.

#### 3.1.6 Gekoppelde Posities & Hoekopstellingen
* **Hoekramen & Erkers:**  
  Bij twee of meer ramen die in een hoek van 90° (of een andere hoek) op elkaar aansluiten, ontstaat bij plaatsing in of op de dag een fysiek conflict tussen de elkaar kruisende bovenbakken, profielen of pakketten.
* **Vaste Montagevolgorde & Reserveringsregel (bijv. Jaloezieën in een Hoek):**  
  * *Positie 1 (Leidend / Eerst monteren):* Eén van de twee posities wordt aangewezen als het doorlopende deel en wordt ingemeten over de volledige breedte tot in de hoek.
  * *Positie 2 (Aansluitend / Volgend):* De haaks aansluitende positie wordt ingemeten tot tegen de voorkant van de geprojecteerde bovenbak van Positie 1. De software trekt de dieptemaat van de gekozen bovenbak (bijv. 50 mm bij jaloezieën, 45 mm bij Duette) automatisch af van de gemeten dagmaat van Positie 2.
  * De montagevolgorde wordt expliciet vastgelegd op de werkbon: eerst Positie 1 monteren, daarna Positie 2 aansluiten.

#### 3.1.7 Bouwkundige Ondergronden & Boorrestricties per Bouwlaag
De bouwkundige constructie verschilt sterk per bouwlaag en bepaalt direct de montagetechniek, benodigde bevestigingsmiddelen en montagetijd:
* **Constructieverschillen per Verdieping:**  
  * *Begane Grond:* Vaak massief gewapend beton, breedplaat of zandcementdekvloeren. Vereist SDS-boorhamers, zware pluggen of keilbouten.
  * *Verdiepingen:* Vaak houten balklagen, gipskartonplafonds op rachelwerk of holle kanaalplaten. Gipskarton bezit onvoldoende uittrekwaarde voor dynamische trekbelastingen (zoals zware gordijnen of koordbediening). De inmeter inspecteert **indien mogelijk** (bijv. in een vroege ruwbouwfase vóór het aanbrengen van het gips, waarbij foto's met maataanduiding vanaf links worden vastgelegd, zoals "eerste rachel op 58 cm") de aanwezigheid van houten rachels of achterhout. Bij afwezigheid of onbekendheid van achterhout wordt zware plafondbelasting vermeden of wandmontage voorgeschreven.
* **Stucprofielen No-Drill Zone:**  
  Rond alle dagkanten, hoeken en raamkanten bevindt zich in gestukte wanden een metalen of kunststof hoekbeschermer (stucprofiel). Binnen een zone van **3 tot 5 cm vanaf de hoek geldt een absoluut boorverbod**. Boren in deze zone veroorzaakt scheuren en afspringen van het stucwerk. Bevestigingen dienen ofwel direct in het kozijn, ofwel minimaal 5 cm buiten de dagkant te worden geplaatst.
* **Gevelopeningen, Kozijndetails & Bevestigingstechniek:**  
  * *Hout:* Direct schroeven zonder voorboren (bij hardhout voorboren met houtboor Ø 2,5 mm).
  * *Kunststof:* Nooit zomaar boren in holle kunststof kamers wegens risico op koudebruggen en lekkage van isolatielucht. Uitsluitend boren met speciale klemsteunen, schroeven in de interne staalversterking, of kleefmontage (TruFit / FrameFix).
  * *Aluminium:* Voorboren met metaalboor en tappen of zelftappende metaalschroeven toepassen.
* **Dekvloer-Inspectievoorbehoud & Vochtmeting:**  
  Bij vloerbekleding registreert de inmeter het type constructie- en dekvloer (zandcement vs. anhydriet vs. hout). Vochtmeting gebeurt standaard niet-destructief met een **capacitieve bolvochtmeter (strooiveldmeting)** om snel en betrouwbaar de oppervlaktezone te scannen. De destructieve Carbid-meting (CM-meting) is prijzig en wordt gereserveerd als formele escalatie- en bewijslastmeting bij ernstige twijfel of juridische geschillen (< 2,0% / met vloerverwarming < 1,5% bij zandcement; < 0,5% / met vloerverwarming < 0,3% bij anhydriet).
* **Algeheel Boorverbod in álle Vloeren:**  
  Op **álle vloeren geldt een absoluut en algeheel boor- en schroefverbod** (ter voorkoming van schade aan vloerverwarming, water-/gasleidingen, elektra, betonijzer en nieuwbouwgaranties). Deuraansluitingen, plintmontage, overgangsprofielen en deurstoppers mogen uitsluitend worden verlijmd met geschikte MS-polymeerkitten of montagelijm.
* **Geluidsnormering Harde Vloeren (10 dB VvE-Norm):**  
  Bij montage van harde vloeren (laminaat, PVC) in appartementencomplexen en etagevloeren geldt conform VvE-reglementen een verplichte contactgeluidreductie van minimaal ΔLlin ≥ 10 dB (aantoonbaar met TNO/TÜV certificaat). **Akoestische randvoorwaarde:** De vloer moet rondom **volledig vrij liggen van alle wanden, kozijnen en leidingen**; elk contact met plinten of wanden veroorzaakt geluidslekken (akoestische bruggen) waardoor de 10 dB werking tenietgedaan wordt.

#### 3.1.8 Integrale Inmeetchecklist & Hiërarchisch Matrix-Model: Bestaande Situatie, Uitvoeringscondities & Nieuwe Situatie
Tijdens het inmeten doorloopt de inmeter een gestandaardiseerde inmeetchecklist. De software dwingt mechanisch af dat een (deel)meting pas formeel kan worden afgerond en vrijgegeven als alle verplichte checklist-items van die positie of ruimte zijn afgehandeld.

* **Bestaande Situatie & Demontage:** Vastlegging van demontage door klant vs. monteur, hergebruik van bestaande rails/onderdelen, en afvoer van afval/oude vloeren.
* **Nieuwe Situatie & Configuraties (Conceptverificatie):** De checklist dekt nadrukkelijk ook de nieuwe situatie af. Keuzes zoals de bedieningszijde (links of rechts bij een Duette/rolgordijn), montagewijze (in de dag vs op de dag, wand vs plafond) of klinkvrijheid zijn veelal reeds in het verkoopgesprek (Fase 1) verkend en staan als concept geregistreerd in het dossier. De inmeter toetst deze conceptwaarden ter plekke aan de fysieke werkelijkheid en bevestigt deze definitief.
* **Domeinspecifieke Checklist-Verankering:** Om maximale vakinhoudelijke diepgang te waarborgen, zijn de specifieke checklist-items direct ondergebracht bij de respectievelijke categoriehoofdstukken hieronder: gordijnen & rails (3.2.6), raamdecoratie (3.3.11), vloeren (3.4.6) en trapbekleding (3.5.5).

#### Architectuur van de 2-Dimensionale Hiërarchische Inmeetchecklist-Matrix
Om faalkosten uit te bannen en de inmeter op de ladder niet te overspoelen met irrelevante vragen, is de checklist opgezet als een wiskundig sluitende **2-Dimensionale Matrix**:
1. **Dimensie 1: Producttaxonomie & Scope (Horizontaal):** De kolommen representeren de hiërarchische niveaus van het assortiment:
   * **[C] Categorie-niveau:** Universele vragen die verplicht gelden voor *elk* product binnen de categorie (bijv. bouwkundige schouw, kozijnmateriaal, vochtmeting).
   * **[G] Productgroep-niveau:** Vragen die specifiek gelden voor een samenhangende groep producten (bijv. alle rails & roedes, alle duettes & plissés, alle dryback PVC-vloeren).
   * **[P] Product- / Optiespecifiek-niveau:** Vragen die uitsluitend van toepassing zijn op één specifiek product, montagesysteem of technische optie (bijv. Wave-plooi, TruFit-plakprofiel, LiteRise-handgreepbediening, LED-verlichting in stootborden).
   * **[-] Niet van toepassing:** De vraag is voor dit specifieke product of deze groep logisch irrelevant en wordt in de software verborgen.
2. **Dimensie 2: Chronologische Inmeetfasen op Locatie (Verticaal):** De rijen volgen de fysieke, logische werkvolgorde van de opnemer in de ruimte:
   * **Fase A: Bestaande Situatie, Demontage & Schouw:** Wat is de status quo? Oude raambekleding/vloer/trapbekleding aanwezig; wie demonteert en wie voert af; hergebruik van bestaande voorzieningen.
   * **Fase B: Bouwkundig Vlak & Ondergrond:** Waarop wordt gemonteerd of gelegd? Draagkracht muren/plafonds (beton, stuc op riet, holle gipsplaat); kozijnmateriaal (hout, kunststof, aluminium, staal); vlakheid (2m aluminium rei) en vochtgehalte (CM-meting) van de dekvloer.
   * **Fase C: Montagewijze & Bevestigingsmethode:** Hoe wordt het bevestigd? In de dag vs. op de dag vs. op de raamvleugel; wand- vs. plafondmontage; boorvrije systemen (TruFit, FrameFix, klemsteunen); koofdieptes en vrije lateihoogtes.
   * **Fase D: Maatvoering, Vrijloop & Fysieke Obstakels:** Past en functioneert het product? 3 meetpunten (B1–B3, H1–H3); klinkvrijheid (≥ 25 mm); kantelhoek draaikiepramen; radiator- en vensterbankoverstekken; lamel- en doekpakkethoogte; doorgangshoogtes.
   * **Fase E: Bediening, Aansturing & Kindveiligheid:** Hoe wordt het bediend? Bedieningszijde links/rechts; reikhoogte LiteRise (max. 220 cm); EN 13120 kindveiligheid (ketting ≥ 150 cm boven afwerkvloerpeil); 230V stroompunten en accu-laadaansluitingen.
   * **Fase F: Logistiek, Uitvoeringscondities & Oplevering:** Kan de monteur het realiseren? Bereikbaarheid & werkhoogte (> 300 cm vereist rolsteiger / 2-mans montage); binnendeurspeling (< 4 mm vereist inkorten deuren); afvalstromen; digitaal inmeetverslag genereren.

* **Dynamische Software-Filtering & Overerving:** Wanneer een inmeter een meetregel aanmaakt, selecteert de software op basis van de gekoppelde verkooporderregels automatisch de van toepassing zijnde productgroep en opties. Hierdoor worden alle generieke `[C]`-vragen, de relevante `[G]`-vragen en alleen de actieve `[P]`-vragen samengesteld tot een compacte, foutloze veldchecklist.

### 3.2 Categorie 1: Gordijnen & Rails

#### 3.2.1 Productassortiment, Merken & Configuratoren
* **Producten:** Overgordijnen, Vitrage, Inbetweens, Fopgordijntjes.
* **Rails & Roedes:** Losse rails, roedes, rails met hoeken/bochten (bijv. links 20 cm, rechts 30 cm retourbocht).  
  * *Merken & Configuratoren:* Hoogwaardige designrails en roedes (*Interstil*) beschikken over een eigen **Interstil Configurator** voor orderinvoer en technische verificatie. Complexe bogen (zoals erkers > 70% ronding) worden direct door Interstil zelf op locatie ingemeten (zie 3.2.3).
* **Merken, Confectie & Configurators:**  
  * *Gordijnstoffen & Ateliers:* Hunter Douglas merken (*De Ploeg, Kendix, Artelux*), evenals *House of Happiness / Frisco, Holland Haag* en *Mart Visser* worden centraal geconfigureerd via **Woontotaal**.  
  * *White label / Huismerk:* Confectie via *Vadain* gebruikt een eigen configurator, ingebed via ERP-systeem **Logic Trade**. In het systeem en op inkoopbonnen wordt dit eenduidig aangeduid met merkcode **'GiW'** (Groter in Wonen), nooit als 'merkloos'.

#### 3.2.2 Stofuitvoeringen, Plooitypes & Confectieberekening
* **Plooitypes & Confectievormen:**
  * *Enkele Plooi:* Bescheiden stofverbruik (1,8× tot 2,0× de railbreedte).
  * *Dubbele Plooi (Vlinderplooi):* Standaard luxe valling (2,2× tot 2,5× de railbreedte).
  * *Retourplooi (Enkele of Dubbele Retourplooi):* Afwisselend naar voren en achteren geplooide confectie. Bij montage strak onder het plafond geldt: **hoofdje = 0 mm**, zodat het gordijn niet tegen het plafond aanloopt.
  * *Wave-Plooi (Wave 6 cm & Wave 8 cm):* Vaste runner-afstand via koord, hangt altijd strak en gelijkmatig onder de rail (hangwijze verplicht onder de rail):
    * *60 mm runnergordel:* Resulteert in een totale golfdiepte van **12 cm** (**6 cm naar voren en 6 cm naar achteren**). Vereiste vrije koofruimte / afstand tot glas: **8 tot 10 cm** (minimaal 10 cm koofdiepte voor een enkele rail).
    * *80 mm runnergordel:* Resulteert in een diepere en luxere golf van **16 cm** (**8 cm naar voren en 8 cm naar achteren**). Vereiste vrije koofruimte / afstand tot glas: **10 tot 12 cm** (minimaal 15 cm koofdiepte voor een enkele rail).
    * Bij onvoldoende vrije diepte (bijv. uitstekende vensterbank of radiator) dwingt de software automatisch 60 mm runners af of signaleert verlengde wandsteunen.
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
* **Voorbeeld Confectiehoogte Gordijnen:**  
  260,0 cm (Gemeten strakke hoogte) - 2,0 cm (Wave-railhoogte) - 1,5 cm (Vloerspeling harde vloer) = **256,5 cm (Confectiehoogte)**.

#### 3.2.3 Rails, Roedes, Bochten & Montagewijze
* **Steunafstanden & Bevestiging:**  
  Gordijnrails worden standaard gemonteerd met plafondsteunen of wandsteunen om de maximaal **70 cm**. Bij zware stoffen (zoals gevoerde velours of verduisterende gordijnen) wordt de steunafstand verkleind naar maximaal **50 cm**.
* **Complexe Railtraçés & Risicoafwenteling (Interstil Inmeting):**  
  Bij complexe railverbuigingen (meer dan 70% ronding, meer dan 5 hoeken, gecompliceerde erkers of afgeschuinde plafonds) wordt de inmeting **door fabrikant Interstil zelf op locatie uitgevoerd**. De inmeetkosten van de fabrikant zijn verwaarloosbaar ten opzichte van de faalkosten van een verkeerd gewalste designroede; het maatvoeringsrisico ligt hierdoor contractueel bij de fabrikant. Reguliere bochten en hoeken worden bij voorkeur **op locatie gebogen** door de monteur met het mobiele buigblok voor een perfecte pasvorm.
* **Meerdelige Rails & Tussenverbinders:**  
  Bij raillengtes > 6,00 m of bij moeilijke transportroutes (zoals een smal trappenhuis) wordt de rail opgedeeld in meerdere delen met interne verbindingsstukken. De positie van de tussenverbinder (links, rechts of in het midden) wordt **altijd in overleg met de klant** bepaald en vastgelegd.
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

#### 3.2.4 Vloerspeling & Vrijhangende Maten
* **Harde Vloeren (Tegels, Parket, PVC, Gietvloer):**  
  Vaste aftrek van **15 mm** boven de afgewerkte vloer.
* **Zachte Vloeren (Hoogpolig Tapijt, Karpet):**  
  Vaste aftrek van **20 mm** om slepen en wrijving te voorkomen.
* **Slepend Gordijn:**  
  Standaard toeslag van **+50 mm** (overschrijfbaar door klant/inmeter met verplichte toelichting, bijv. tot +100 mm voor een royale klassieke valling).
* **Confectiehoogte Formule per Railtype:**  
  De confectiehoogte wordt berekend op basis van de werkelijke railhoogte van het gekozen profiel:  
  `H_confectie = Kleinste strakke hoogte - Railhoogte (per railtype) - Vloerspeling`  
  *Standaard railhoogtes in de software:*  
  * Standaard railprofiel: 15–20 mm  
  * Wave-railprofiel: 20 mm  
  * Wave Pro Smal: 15 mm  
  * Interstil designroedes: tot 35 mm  
  *Blijvende maat overschrijving:* De inmeter heeft te allen tijde de bevoegdheid om de berekende blijvende confectiehoogte handmatig te overschrijven (bijv. bij een scheeflopende vloer of om het gordijn optisch strakker te laten aansluiten). Elke overschrijving vereist een verplichte toelichting in het dossier en wordt gelogd.

#### 3.2.5 Gordijnpakketten & Doorgangscontrole
* **Pakketbreedte Gordijnen & Vrije Muurruimte:**  
  Bij gordijnen bepalen de plooisoort (enkel, dubbel, wave) en stofzwaarte de pakketbreedte in opgeschoven toestand. De inmeter toetst of er naast het kozijn voldoende muurruimte beschikbaar is om het gordijnpakket buiten de dagopening en buiten de draaicirkel van openslaande deuren of draairamen te parkeren, zodat maximale lichtinval en ongehinderde doorgang gewaarborgd blijven.

#### 3.2.6 Hiërarchische Inmeetchecklist-Matrix: Gordijnen & Rails
Onderstaande matrix definieert de integrale inmeetchecklist voor Categorie 1 (Gordijnen & Rails), gerangschikt in de chronologische werkvolgorde van de inmeter op locatie (Fase A t/m F). In elke cel staat aangegeven op welk hiërarchisch niveau de checkvraag resideert: **[C]** Categorie-breed (geldt voor elk product), **[G]** Productgroep-niveau, **[P]** Product-/Optie-specifiek, of **[-]** Niet van toepassing.

| Nr. | Fase | Checkvraag / Veldinspectie | [C] Gordijnen & Rails (Algemeen) | [G] Groep: Rails & Roedes | [G] Groep: Gordijnstoffen & Plooien | [P] Optie: Wave-Plooi (Wave 60/80) | [P] Optie: Elektrische Rail (Somfy/Forest) | Software-Validatie & Gating |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | **Fase A: Schouw** | Oude rails/ophanging aanwezig; demontage door klant vs. monteur? | **[C]** | **[G]** | - | - | - | Verplicht veld; bepaalt demontage-arbeidsuren in Fase 4 planning. |
| **2** | **Fase A: Schouw** | Hergebruik bestaande rail (inspectie glijders, bochten, steunen, pluggen)? | - | **[G]** | - | - | - | Keuze hergebruik vs. nieuw; blokkeert nieuwe railregel indien hergebruikt. |
| **3** | **Fase B: Ondergrond** | Plafondconstructie & draagkracht (massief beton, stuc op riet, gipsplaat)? | **[C]** | **[G]** | - | - | - | Bepaalt montagemateriaal (SDS boorhamer vs. speciale hollewandpluggen). |
| **4** | **Fase B: Ondergrond** | Plafondhoogteverloop & vlakheid (verschil H1, H2, H3 > 15 mm)? | - | - | **[G]** | - | - | Automatische validatie op H1-H3: verschil > 15 mm signaleert schuin afsnijden. |
| **5** | **Fase C: Montage** | Montagewijze: Plafondmontage vs. Wandmontage (lateihoogte ≥ 50–70 mm)? | - | **[G]** | - | - | - | Veldterm "over de dagkant": controle vrije lateihoogte boven het kozijn. |
| **6** | **Fase C: Montage** | Koofdiepte & koofhoogte (nisruimte vóór en achter de rail)? | - | **[G]** | - | **[P]** (min. 10 cm Wave 60; min. 15 cm Wave 80; min. 18–20 cm dubbel) | - | Validatie: Wave 60 vereist 12 cm golfruimte (6 voor/6 achter); Wave 80 vereist 16 cm. |
| **7** | **Fase C: Montage** | Railbochten & buigradii (erker/hoek, R=10/15/20 cm, retour naar wand)? | - | **[G]** | - | - | - | >70% ronding/5 hoeken: Interstil inmeting; regulier: buigen op locatie met buigblok. |
| **8** | **Fase D: Maatvoering** | Obstakeloverstek vensterbank / radiator / kruk (wandsteun = overstek + 5 cm)? | **[C]** | **[G]** | - | **[P]** (Wave-diepte overstek) | - | Berekent automatisch de benodigde wandsteunlengte (6, 10, 15 of 20 cm). |
| **9** | **Fase D: Maatvoering** | Vloerspeling t.o.v. vloertype (15 mm harde vloer, 20 mm tapijt, +50 mm slepend)? | - | - | **[G]** | - | - | Bepaalt aftrek: H_confectie = Kleinste H - Railhoogte (15–35 mm) - Vloerspeling. |
| **10** | **Fase D: Maatvoering** | Overlap bij stelgordijnen (standaard 100 mm overlap in het midden)? | - | - | **[G]** | - | - | Verrekent 10 cm extra stofbreedte in de confectieberekening. |
| **11** | **Fase D: Maatvoering** | Pakketbreedte & doorgangscontrole (gordijnpakket vrij van glas/deur)? | **[C]** | - | **[G]** | **[P]** (Wave-pakket factor) | - | Toetst vrije muurbreedte links/rechts; signaleert lichtverlies bij te krappe muur. |
| **12** | **Fase E: Bediening** | Bedieningstype: Handbediend, trekstang vs. gemotoriseerd? | **[C]** | **[G]** | - | - | - | Valideert conceptwaarde; koppelt trekstanglengte aan vloerhoogte. |
| **13** | **Fase E: Bediening** | 230V stroompunt aan motorzijde (binnen 1 meter links of rechts)? | - | - | - | - | **[P]** (230V voeding links/rechts) | Blokkade: Geen stroompunt aanwezig vereist elektricien-order vóór montage. |
| **14** | **Fase F: Logistiek** | Bereikbaarheid & werkhoogte (kamerhoogte > 300 cm = rolsteiger nodig)? | **[C]** | **[G]** | - | - | - | Voegt steiger / 2-mans montagetarief toe aan orderbegroting. |

*Bestaande situatie-afspraken:* Oude rails verwijderen door klant of monteur; hergebruik van bestaande rail (inspectie glijders, bochten, steunbeugels en muurpluggen).  
*Nieuwe situatie & concepttoetsing:* Montagewijze (wand vs plafond), railmodel en kleur, pakketzijde (links, rechts of stel), overlap bij stelgordijnen (standaard 100 mm), plafondhoogteverloop (bolling/holling), vensterbank- of radiatoroverstek.

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
  * *Merken & Fabrikanten:* Hunter Douglas (*Luxaflex, Sunway*).  
  * *Private label / Huismerk:* Dealer-eigen huismerken (zoals *Groter in Wonen*, in het ERP en op inkoopbonnen vastgelegd onder de merkcode **'GiW'**, o.a. geproduceerd door *Zonnelux* als private label).  
  * *Productgroepen:* Rolgordijnen, Duettes / plissés, Silhouette (kantelbare stoffen lamellen tussen transparante sluiers), Duo-rolgordijnen / Twist (afwisselend dichte en transparante banen), Jaloezieën (horizontaal hout/alu, verticaal textiel, pvc en aluminium zoals Luminette/Allure), Vouwgordijnen, Paneelgordijnen.
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
* **Standaardisatie Montageprofiel vs. Losse Montagesteunen (Faalkostenreductie):**  
  * *Voorkeur voor montageprofiel:* In de woninginrichtingspraktijk geldt het dwingende beleid om rolgordijnen en raamdecoratie standaard te adviseren en offreren met een **montageprofiel (draagprofiel)** in plaats van losse montagesteuntjes.  
  * *Praktijkproblemen losse steunen (Meers-casus):* Bij een project in Meers resulteerden losse steunen op een scheef plafond in scheefhangende steuntjes, een rolgordijn dat 1,5 cm te breed leek, aanliep tegen de dagkant en doek dat begon te rafelen.  
  * *Voordelen montageprofiel:*  
    1. *Maximale stelbaarheid & uitvullen:* Het doorlopende profiel kan perfect waterpas worden uitgevuld met stelplaatjes, ongeacht hoe scheef het plafond of de muur loopt.  
    2. *Vrije boorpositie:* De monteur hoeft niet exact op de kwetsbare buitenhoeken van de nis te boren (waar vaak wapening, leidingen of broze hoeken zitten), maar kan de bevestigingsclips over de gehele breedte van het profiel vrij verdelen.  
    3. *Opvangen motorkant-asymmetrie:* Bij een elektrisch rolgordijn staat de steun aan de motorkant fysiek verder naar binnen dan aan de niet-motorkant om symmetrische speling van het doek te creëren. Een montageprofiel absorbeert deze asymmetrie kant-en-klaar in de fabriek, waardoor de monteur het rolgordijn er simpelweg tussen klikt.  
    4. *Montagesnelheid & Kostensystematiek:* Een montageprofiel is in aanschaf iets duurder, maar reduceert de montagetijd aanzienlijk ("boren, pluggen, profiel inklikken"). De tijdwinst compenseert de materiaalkosten ruimschoots. In het ERP en offertesysteem (LogicTrade) worden montagetijden en prijzen productspecifiek ingericht.
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
* **Kindveiligheid & Child Safety (EN 13120):**  
  Bij koord- en kettingbediening moet het bedieningskoord minimaal **150 cm boven het vloerniveau** hangen, verplicht voorzien zijn van een breekbare kettingslot of vastgezette veiligheidskoordhouder/kettingspanner.
* **Arbo-Veiligheid bij Hoge Ramen, Vides & Traphallen (> 2,5 m werkhoogte):**  
  Bij ramen boven trapgaten, vides en bordessen geldt:
  * Inzet van een gecertificeerde uitschuifladder van minimaal **2,5 meter**.
  * Plaatsing van de ladderpoten uitsluitend tegen een stabiel **stootbord** of massieve vloer/wand; nooit los op een tredevlak zonder borging.
  * Verplicht gebruik van **beschermdekens** om beschadiging aan stootborden en wanden te voorkomen.
  * Indien werkhoogte > 4 m is een rolsteiger of gecertificeerd bordesplatform verplicht.
  * **Directe Input voor Planning & Montage (Deel 4):** Bovenstaande Arbo- en veiligheidsaspecten gelden niet alleen voor de inmeter, maar vormen verplichte sturende data voor de montageplanning (Fase 5 / Deel 4). Het portaal genereert op basis hiervan automatisch de benodigde materieellijst voor de montagewagen (zoals een rolsteiger, bordesplatform of gecertificeerde trapladder) en verhoogt automatisch de berekende montage-doorlooptijd voor de betreffende posities.

#### 3.3.4 Insectenwering (Horren) & Buitenscreens
* **Insectenwering (Horren):** Inrolhorren, Plisséhorren (met expliciete keuze tussen binnenmontage en buitenmontage op het kozijn), Inzethorren (voor draaikiepramen).
* **Buitenscreens & Zipscreens:**
  * Windvaste ZIP-screens (ritsscreens) met ritsgeleiding in zijprofielen.
  * *Aandrijving:* Solar / Accu-aandrijving met geïntegreerd zonnepaneel op de cassette (geen geveldoorvoer of 230V bekabeling benodigd); 230V bedraad blijft leverbaar.

---

#### 3.3.5 Inmeetinstructies per Plaatsings- en Montagewijze (Wat meet de inmeter exact?)
Om absolute passing te garanderen en productiefouten uit te sluiten, hanteert de inmeter per situatie en montagewijze een vast inmeetprotocol:

* **Ontrafeling van Montagelocatie vs. Montagevlak vs. Steuntenterminologie:**  
  In de praktijk ontstaat vaak begripsverwarring doordat de termen "in de dag" en "op de dag" door fabrikanten zowel voor de ruimtelijke positie als voor het type montagesteun worden gebruikt. De inmeettool hanteert een strikt 2-assige scheiding:  
  1. **As 1: Montagelocatie (Waar hangt het product?):**  
     * `In de dag`: Binnen de kozijnopening / tussen de dagkanten van de nis.  
     * `Op de dag`: Vóór de opening, overlappend over het kozijn of op de wand/boven de opening.  
     * `Op de vleugel / Glaslat`: Direct bevestigd op het draaiende raamdeel of op het glas (TruFit, klemsteun).  
  2. **As 2: Montagevlak / Bevestiging (Waartegen wordt geschroefd?):**  
     * `Bovenmontage / Plafond`: Bevestiging omhoog in de bovenste dagkant (latei) of het plafond -> vereist bovenclips (fabrikantterm: "in de dag-steun").  
     * `Wandmontage / Achterwand`: Bevestiging achterwaarts tegen het verticale kozijnprofiel of de muur -> vereist haakse wandsteunen (fabrikantterm: "op de dag-steun").  
     * `Zijmontage / Kopse montage`: Bevestiging zijwaarts tegen de linker en rechter dagkant (bijv. in erkers of bij zachte plafonds).  
  3. **Edge cases & Foto-annotatie op Tablet:**  
     * Bij situaties met een zacht gipsplafond, spanplafond of holle koof waarboven niet geboord mag worden: het product hangt ruimtelijk "in de dag", maar wordt met wandsteunen tegen het houten of aluminium kozijnkader geschroefd ("In de dag met wandmontage").  
     * Erkersituaties: aan één zijde een kopse wandsteun en aan de andere zijde een plafondclip.  
     * De inmeter documenteert deze situaties via de **foto-annotatietool op de tablet**: met stylus/vinger worden montagelijnen, pijlrichtingen en schroefpunten direct op de situatiefoto getekend.

* **In de dag (in het kozijn / tussen de muren van de nis):**
  * **Wat meten?**
    1. *Breedte op 3 hoogtes:* B1 (bovenin waar de bak/steunen komen), B2 (midden) en B3 (onderin bij de vensterbank/dorpel).  
       **Strikte inmeetregel:** De **kleinste / strakste breedte** is altijd de primaire dagmaat die in de software wordt ingevoerd!
    2. *Hoogte op 3 breedtes:* H1 (links), H2 (midden) en H3 (rechts). De strakste hoogte geldt als invoer.
    3. *Diagonale kruismeting (X1 en X2):* Van linkerbovenhoek naar rechteronderhoek en vice versa. Een verschil van > 5 mm signaleert scheefstand/parallellogram (risico op schuintrekkende doeken of lamelklemmen).
  * **Rekenregel / Aftrek:** De software berekent automatisch de blijvende productiemaat conform de fabrieksaftrekmatrix (zie 3.3.9): bijv. Duette AU10/AU20 -8 mm; jaloezieën -10 mm; rolgordijn -5 mm op het mechanisme.
* **Op de dag (over het kozijn / op de wand of op het plafond vóór de nis):**
  * **Wat meten?**
    1. *Strakke gevelopening:* Meet de strakke dagmaat breedte en hoogte van het kozijn/raamgat.
    2. *Vrije overlapruimte rondom:*
       * *Links en rechts:* Breedte van de kozijnstijlen of muurdam tot aan de hoek (gewenste overlap standaard **+50 tot +100 mm per zijde** ter voorkoming van zijwaartse lichtspleten).
       * *Bovenzijde (Latei):* Hoogte van bovenzijde kozijn tot het plafond (minimaal 70–100 mm muurhoogte vereist voor wandsteunen bovenbak).
       * *Onderzijde:* Afstand tot vensterbank of vloer (overlap standaard **+50 tot +100 mm** onder het kozijn, mits geen vensterbank).
    3. *Obstakeloverstek:* Hoever steken klinken of uitzetters vóór het kozijn uit? (Bepaalt de noodzaak voor verlengde wandsteunen van 60–108 mm).
  * **Rekenregel:** Bestelbreedte = Dagmaat breedte + overlap links + overlap rechts. Bestelhoogte = Dagmaat hoogte + overlap boven + overlap onder. De software past hierbij automatische staffeloptimalisatie toe (zie 3.3.10).
* **Op de raamvleugel / Glaslatmontage (Draaikiepramen, TruFit & Klemsteunen):**
  * **Wat meten?**
    1. *Strakke glasmaat:* Zichtbare breedte en hoogte van de glasruit tussen de rubbers/glaslatten.
    2. *Glaslatdiepte & Glaslatvorm:* Diepte van de glaslat (minimaal 18–25 mm voor schroefmontage in de glaslat). Controleer of de glaslat recht, afgerond of sterk schuin (> 15°) is.
    3. *Sponningdikte vleugel:* Bij klemsteunen (montage zonder boren op kunststof/aluminium draaikiepramen): meet de dikte van de opdekrand/vleugel (standaard 15–24 mm) en controleer of er minimaal 3 mm speling is met het vaste kader.
    4. *TruFit / FrameFix hechtstrook:* Vlakke kleefstrook van minimaal 15 mm breedte op het glas of de aluminium/kunststof glaslat.
* **Bedieningsmaten & Kindveiligheid (EN 13120):**
  * **Wat meten?**
    1. *Montagehoogte bovenbak:* Afstand van de vloer tot de bovenzijde van het product (montagepunt).
    2. *Kettinglengte:* De onderzijde van de bedieningsketting moet minimaal **150 cm boven het afwerkvloerpeil** hangen: Kettinglengte ≤ Montagehoogte - 150 cm.
    3. *Reikhoogte LiteRise / Handgreep:* Bij montagehoogtes > 210 cm kan een handbediende Top-Down / Bottom-Up niet meer met de hand vanaf de vloer bediend worden; de software signaleert verplicht een bedieningsstok of overstap naar SmartCord / motorisatie.

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

#### 3.3.9 Aftrekmatrices per Producttype (In de Dag)
* **Duette & Plissé:**  
  Blijvende breedte = strakste dagmaat **-7 mm tot -8 mm** (afhankelijk van fabrikant/pompsysteem EOS: bijv. Luxaflex AU10/AU20 rekent -8 mm). Hoogte = dagmaat -0 mm.
* **Horizontale Jaloezieën (Aluminium 25/50 mm, Hout 50 mm):**  
  Blijvende breedte = strakste dagmaat **-10 mm** (5 mm aan weerszijden). Hoogte = dagmaat -0 mm.
* **Rolgordijnen:**  
  Systeembreedte = strakste dagmaat **-5 mm**. Let op: de doekbreedte is altijd **30 tot 35 mm smaller** dan de systeembreedte wegens steunen en bedieningsmechanisme (resulteert in een lichtkier van ca. 15-18 mm per zijde).

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

#### 3.3.11 Hiërarchische Inmeetchecklist-Matrix: Raamdecoratie & Binnenzonwering

Onderstaande matrix definieert de integrale inmeetchecklist voor Categorie 2 (Raamdecoratie, Horren & Binnenzonwering), gerangschikt in de chronologische werkvolgorde van de inmeter op locatie (Fase A t/m F). In elke cel staat aangegeven op welk niveau de checkvraag resideert: **[C]** Categorie-breed (geldt voor elk raamdecoratieproduct), **[G]** Productgroep-niveau, **[P]** Product-/Optie-specifiek, of **[-]** Niet van toepassing.

| Nr. | Fase | Checkvraag / Veldinspectie | [C] Raamdecoratie (Algemeen) | [G] Horizontale Jaloezieën | [G] Duette & Plissé | [G] Rolgordijnen | [G] Horren & Screens | [P] TruFit / FrameFix (Boorvrij) | [P] Klemsteun Draaikiep | [P] LiteRise / Handgreep | [P] Accu-Motor (Brel/Somfy) | Software-Validatie & Gating |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | **Fase A: Schouw** | Oude raambekleding/folie aanwezig; demontage door klant vs. monteur? | **[C]** | - | - | - | - | - | - | - | - | Verplicht procesveld; registreert demontagetijd en verantwoordelijkheid. |
| **2** | **Fase A: Schouw** | Afvoer van oud materiaal gewenst door monteur vs. klant zelf afvoeren? | **[C]** | - | - | - | - | - | - | - | - | Verplicht veld; stuurt afvalcontainer- en milieutoeslag in werkorder aan. |
| **3** | **Fase A: Schouw** | Herplaatsing van gedemonteerd product naar andere positie in woning? | **[C]** | - | - | - | - | - | - | - | - | Genereert zelfstandige orderpositie met eigen inmeting en gatencontrole. |
| **4** | **Fase A: Schouw** | Ingangscontrole monteur: Lasercontrole dagmaten vs. doossticker vóór boren? | **[C]** | **[G]** | **[G]** | **[G]** | **[G]** | - | - | - | - | Faalkostenpreventie: bij maatafwijking blijft verpakking dicht en volgt melding. |
| **5** | **Fase B: Ondergrond** | Kozijnmateriaal & staat (hout, kunststof, aluminium, staal; boorverbod)? | **[C]** | - | - | - | - | - | - | - | - | Kunststof met boorverbod forceert TruFit, FrameFix of Klemsteun. |
| **6** | **Fase B: Ondergrond** | Verloopcontrole (minimaal 3 breedtes, 3 hoogtes; verloop > 5 mm besproken)? | **[C]** | **[G]** | **[G]** | **[G]** | **[G]** | - | - | - | - | Verloop > 5 mm verplicht vastleggen op meetverslag ter voorkoming van klachten. |
| **7** | **Fase B: Ondergrond** | Diagonale haaksheid kozijn (kruismeting X1, X2 bij scheefstand of kaders)? | **[C]** | **[G]** | **[G]** | **[G]** | **[G]** | - | - | - | - | Verschil > 5 mm triggert scheefstandwaarschuwing en klemrisico bij kaders. |
| **8** | **Fase C: Montage** | Montagelocatie (In/Op de dag/Vleugel) & Montagevlak (Plafond/Wand/Kopse)? | **[C]** | **[G]** | **[G]** | **[G]** | **[G]** | - | - | - | - | Scheidt locatie van vlak; bepaalt juiste steun (plafondclip vs wandbeugel). |
| **9** | **Fase C: Montage** | Montagesteun keuze: Standaard montageprofiel vs. losse montagesteuntjes? | - | - | **[G]** | **[G]** (Standaard) | - | - | - | - | - | Montageprofiel standaard; absorbeert motorkant-asymmetrie en scheefstand. |
| **10** | **Fase C: Montage** | Doortrekkende zijgeleiders tot vloer/plint bij verdiepingshoge puien? | - | - | - | **[G]** (Geleiders) | **[G]** | - | - | - | - | Verplichte detailfoto; legt vast of geleider doorloopt tot vloer of stopt op plint. |
| **11** | **Fase C: Montage** | Inbouwdiepte dagkant t.o.v. systeemdiepte bovenbak / cassette? | - | **[G]** (≥30mm voor 25mm; ≥65mm voor 50mm) | **[G]** (≥35mm voor 25mm; ≥75mm voor 64mm) | **[G]** (≥70–90mm cassette) | **[G]** | - | - | - | - | Onvoldoende diepte forceert overschakeling naar 'Op de dag'. |
| **12** | **Fase C: Montage** | Glaslatdiepte & contour (diepte ≥ 18–25 mm, schuinte > 15°)? | - | - | **[G]** (bij glaslatmontage) | - | - | **[P]** (plakstrook ≥ 15 mm) | - | - | - | Schuinte > 15° vereist wigvormige compensatie-adapters. |
| **13** | **Fase C: Montage** | Sponningdikte raamvleugel (15–24 mm) & kaderruimte (≥ 3 mm)? | - | - | - | - | - | - | **[P]** (15–24 mm vleugel) | - | - | Speling < 3 mm sluit klemsteun uit (raam sluit niet meer). |
| **14** | **Fase D: Maatvoering** | Klinkvrijheid & raambeslag (speling tussen product en raamkruk ≥ 25 mm)? | **[C]** | **[G]** | **[G]** | **[G]** | - | **[P]** | **[P]** | - | - | Klinkruimte < 25 mm blokkeert bestelling; vereist afstandsteun/krukverlenger. |
| **15** | **Fase D: Maatvoering** | Draaikiepraam openingsradius & valhoek (kanteling ≤ 15°)? | **[C]** | **[G]** | **[G]** | - | - | **[P]** | **[P]** | - | - | Bij valramen: openingsbegrenzer verplicht om botsing te voorkomen. |
| **16** | **Fase D: Maatvoering** | Pakkethoogte t.o.v. naar binnendraaiend raam (bovenzijde kozijn/latei)? | - | **[G]** (lamelpakket) | **[G]** (plissépakket) | **[G]** (rolcassette) | - | - | - | - | - | Toetst of het raam nog geopend kan worden bij opgetrokken product. |
| **17** | **Fase D: Maatvoering** | Afrolrichting doek (standaard afrollend vs. contra-rollend)? | - | - | - | **[G]** | - | - | - | - | - | Contra-rollend verplicht indien kruk of raamboompje uitsteekt. |
| **18** | **Fase E: Bediening** | Bedieningszijde links vs. rechts (t.o.v. meubels, wanden en looproute)? | **[C]** | **[G]** | **[G]** | **[G]** | - | - | - | - | - | Valideert conceptwaarde; voorkomt bediening achter een kast of deur. |
| **19** | **Fase E: Bediening** | Montagehoogte bovenbak (invoerveld voor trap- en steigerkeuze monteur)? | **[C]** | **[G]** | **[G]** | **[G]** | **[G]** | - | - | - | - | Verplicht veld: selecteert huishoudtrap (≤2,6m) of kamersteiger (>3,5m). |
| **20** | **Fase E: Bediening** | Kindveiligheid EN 13120: ketting-/koordhoogte ≥ 150 cm boven vloer? | **[C]** | **[G]** | **[G]** | **[G]** | - | - | - | - | - | Mechanische blokkade: Kettinglengte ≤ Montagehoogte - 150 cm. |
| **21** | **Fase E: Bediening** | Reikhoogte LiteRise / handgreep (montagehoogte > 210 cm adviseert stang)? | - | - | **[G]** | - | - | - | - | **[P]** (> 210 cm) | - | Boven 210 cm: adviseert bedieningsstok of SmartCord/motorisatie. |
| **22** | **Fase E: Bediening** | Accu-laadpunt bereikbaarheid (USB-C magnetische kabel binnen bereik)? | - | - | - | - | - | - | - | - | **[P]** (Accu USB-C poort) | Toetst bereikbaarheid laadpoort; adviseert optionele magnetische verlengkabel. |
| **23** | **Fase F: Logistiek** | Uitvoeringscondities (vensterbank vrij, meubels verplaatst, deken gereed)? | **[C]** | - | - | - | - | - | - | - | - | Klantinstructie en beschermingsprotocol vastleggen in inmeetverslag. |

*Bestaande situatie-afspraken:* Aanwezigheid van oude jaloezieën, screens of folies; demontage en afvoer door klant of monteur; herplaatsing naar andere positie als zelfstandige orderpositie; controle op lijmresten of boorgaten.  
*Nieuwe situatie & concepttoetsing:* Bedieningszijde links of rechts (conceptwaarde uit verkoopgesprek valideren t.o.v. wanden, deuren en looproutes); Bedieningstype (handgreep LiteRise, SmartCord, ketting of gemotoriseerd); Montagewijze (in de dag vs. op de dag, wand- vs plafondsteunen, montageprofiel vs losse steunen, boorvrij TruFit/FrameFix); Klinkspeling & draaikiepvrijheid (toetsing klinkafstand ≥ 25 mm en kiepstandhoek, eventueel plaatsen van kier- of openingsbegrenzer); Kindveiligheid (bedieningshoogte minimaal 150 cm boven het afwerkvloerpeil); Reikhoogte (bedieningsstang bij montagehoogte > 210 cm); Vaste ingangscontrole met laser vóór openen van verpakkingen.

---

#### 3.3.12 Inmeet- en Rekenmatrix: Raamdecoratie & Binnenzonwering

| Productgroep | Primaire Dagmaat (Invoer Inmeter) | Blijvende Maat (Formule & Aftrekregel) | Verplichte Referentie & Validatie | Output naar Productie & Montage |
| :--- | :--- | :--- | :--- | :--- |
| **Duette / Plissé (AU10, AU20, AE20, AS20, EOS)** | Strakste dagmaat breedte op 3 punten (B1, B2, B3) & hoogte op 3 punten (H1, H2, H3); Diagonaal X1/X2 bij kaders | *In de dag:* Blijvende breedte = strakste dagmaat - 8 mm, Hoogte = dagmaat - 0 mm; *Op de dag:* Dagmaat + gewenste overlap (2 × 50-100 mm); *Vleugel/TruFit:* Glasmaat | Glaslatdiepte ≥ 25 mm (in de dag) of vlakke hechtstrook ≥ 15 mm; klinkvrijheid ≥ 25 mm; wand- vs plafondmontage | Fabrieks-productiemaat (blijvende maat op sticker), modelcode EOS (bijv. AU20), bedieningszijde, montagesteunen |
| **Horizontale Jaloezieën Aluminium (16, 25, 35, 50, 70 mm)** | Strakste dagmaat breedte (B1, B2, B3) & hoogte (H1, H2, H3); Diagonaal X1/X2 | *In de dag:* Blijvende breedte = strakste dagmaat - 10 mm (5 mm per zijde), Hoogte = dagmaat - 0 mm; *Op de dag:* Dagmaat + gewenste overlap | Pakkethoogte t.o.v. draaiende ramen/deuren; lameldoorloop gekoppelde sets ≤ 12 mm; TDBU alleen bij 25 mm | Productiemaat (mm), lamelbreedte (16/25/35/50/70 mm), pakkethoogte, tuimel-/bedieningszijde, ladderband/-koord |
| **Houten Jaloezieën (50 / 65 mm)** | Strakste dagmaat breedte (B1, B2, B3) & hoogte (H1, H2, H3); Diagonaal X1/X2 | *In de dag:* Blijvende breedte = strakste dagmaat - 10 mm, Hoogte = dagmaat - 0 mm; *Op de dag:* Dagmaat + gewenste overlap | Zwaar gewicht hout; zware bovenbakdiepte (min. 65 mm); pakkethoogtecontrole bij draaiende delen | Productiemaat (mm), houtsoort/kleur, ladderband breedte (25/38 mm), tuimel- en optrekzijde |
| **Rolgordijnen & Duo-Rolgordijnen (met Montageprofiel)** | Strakste dagmaat breedte (B1, B2, B3) & hoogte (H1, H2, H3) | *In de dag:* Systeembreedte = strakste dagmaat - 5 mm (doek ca. 35 mm smaller dan systeem); *Op de dag:* Dagmaat + overlap | Montageprofiel standaard; absorbeert motorkantasymmetrie; doorloop zijgeleiders vloer/plint bij pui | Systeembreedte (mm), doekbreedte (mm), buisdiameter (28/38/50 mm), montageprofiel-type, kettinglengte |
| **Verticale Lamellen (Textiel/Versos, PVC, Aluminium) & Paneelgordijnen** | Strakste dagmaat breedte op 3 punten & hoogte op 3 punten; niscontrole | *In de dag:* Railbreedte = dagmaat - 10 mm; Hoogte = dagmaat minus 15–20 mm vloer-/vensterbankspeling; *Op de dag:* + overlap | Pakketbreedte lamellen/panelen (vrije raamopening); railspoor (2-, 3-, 4- of 5-sporig); lamelbreedte (89/127 mm) | Railmaat (mm), lamelhoogte (mm), pakketzijde (links/rechts/stel), materiaalsoort (textiel/pvc/alu), aantal panelen |
| **Buitenscreens & Horren (ZIP-screens, Solar & Inzethorren)** | Strakste dagmaat breedte en hoogte; buitengevelinspectie | *In de dag:* Kast- en geleidermaat = dagmaat - 2 mm; *Op de dag (buiten):* Dagmaat + breedte zijgeleiders + kasthoogte | Vlakheid buitengevel; obstakels (waterdorpels, ventilatieroosters); zonnepaneeloriëntatie bij solar | Buitenwerkse maat (mm), kasttype (afgeschuind/rond), ZIP-ritsgeleiders, motortype (Solar/230V), doekcode |

### 3.4 Categorie 3: Vloerbekleding

#### 3.4.1 Productsoorten, Rolbreedtes & Legpatronen
* **Zachte Vloeren op Rol (Tapijt & Vinyl):**  
  * *Rolbreedtes Tapijt:* Geleverd op **4 meter én 5 meter breed** (voorkomt onnodige naden bij kamers breder dan 4m).  
  * *Rolbreedtes Vinyl:* Standaard 4 meter breed (optioneel 2 of 3 meter).
* **Marmoleum:**  
  * *Vaste rolbreedte:* 2 meter breed.
* **Harde Vloeren (PVC & Laminaat):**  
  * *Uitvoeringsvormen:* Dryback (plak-PVC), Click-PVC, Laminaat.
  * *Legpatronen:* Rechte plank, Visgraat (90°), Hongaarse punt (sergeantstrepen, 45° of 60°), Weense punt (72°), Tegel (met of zonder voegstrips/accentbiezen), Bies & Band afwerking.

#### 3.4.2 Ondervloeren, Egalisatie & Voorbehandeling (Ondergrond, Vocht & Vlakheid)
* **Ondervloeren & Voorbehandeling:**  
  * *Ondervloeren:* Drukvaste ondervloeren met geïntegreerd dampscherm (verplicht voor Click-PVC en laminaat ter bescherming van de klikverbinding), rubber ondervloeren en wolvilt (voor tapijt), spaanplaat/jumpax ondervloersystemen, spanlatten.  
  * *Egalisatie & Primers:* Hechtprimer voor zuigende (zandcement) of niet-zuigende (monoliet beton, tegels) ondergronden; 1× of 2× projectmatig egaliseren van de dekvloer.
* **Inmeetinstructies Ondergrond & Conditiemeting (Wat meet de inmeter exact?):**  
  De inmeter verifieert de bouwkundige conditie van de ondervloer vóór vrijgave naar planning en stoffering:
  1. *Type dekvloer:* Vaststellen of de constructievloer bestaat uit zandcement, calciumsulfaat (anhydriet), monoliet beton, hout/balklaag of tegelvloer.
  2. *Vlakheidsmeting (2-meter rei):* Controleer met een 2-meter aluminium rei en meetspie de vlakheid. Oneffenheden en glooiingen van > 2 mm onder de 2-meter rei vereisen mechanisch schuren en projectegalisatie conform NEN-EN 13813 (klasse NEN-vlakheid voor verlijmd PVC).
  3. *Vochtmeting (Capacitief vs. Carbidemethode/CM):*  
     * *Standaard veldmeting:* Niet-destructieve capacitieve meting met een geijkte **bolvochtmeter (strooiveldmeting)** om snel en betrouwbaar de oppervlaktezone te scannen.
     * *Formele normering & escalatie (CM-meting):* De destructieve Carbid-meting geldt als formele escalatie- en bewijslastmeting bij twijfel of geschillen. Grenswaarden:
       * *Zandcementdekvloer:* Maximaal **2,0 CM-%** (zonder vloerverwarming) of maximaal **1,5 CM-%** (met vloerverwarming).  
       * *Anhydrietgietvloer:* Maximaal **0,5 CM-%** (zonder vloerverwarming) of maximaal **0,3 CM-%** (met vloerverwarming).  
     * Bij overschrijding van deze grenswaarden dwingt het portaal automatisch een droogtijd-blokkade af.
  4. *Algeheel Boorverbod in álle Vloeren:*  
     Op **álle vloeren geldt een absoluut en algeheel boor- en schroefverbod** (ter voorkoming van schade aan vloerverwarming, leidingwerk, nieuwbouwgaranties en betonconstructies). Plinten, overgangsprofielen en deurstoppers worden te allen tijde verlijmd/gekit met montagelijm of MS-polymeerkit.
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
* **Deelafspraken Plinten:**  
  Inclusief registratie van de deelafspraak bij ontbrekende plinten (wie levert, zaagt, plaatst en kit/schildert).

#### 3.4.6 Hiërarchische Inmeetchecklist-Matrix: Vloerbekleding
Onderstaande matrix definieert de integrale inmeetchecklist voor Categorie 3 (Vloerbekleding), gerangschikt in de chronologische werkvolgorde van de inmeter op locatie (Fase A t/m F). In elke cel staat aangegeven op welk niveau de checkvraag resideert: **[C]** Categorie-breed (geldt voor elke vloer), **[G]** Productgroep-niveau, **[P]** Product-/Optie-specifiek, of **[-]** Niet van toepassing.

| Nr. | Fase | Checkvraag / Veldinspectie | [C] Vloerbekleding (Algemeen) | [G] Verlijmd PVC (Dryback) | [G] Click-PVC & Laminaat | [G] Tapijt & Vinyl | [P] Visgraat / Patroonvloer | [P] Vloerverwarming / -koeling | [P] Deuren Inkorten (Advies) | Software-Validatie & Gating |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | **Fase A: Schouw** | Oude vloer/lijmresten aanwezig; strippen/schuren door klant vs. monteur? | **[C]** | **[G]** | - | **[G]** | - | - | - | Bepaalt schuur- en freesuren; definieert afvoercontainer. |
| **2** | **Fase B: Ondergrond** | Type dekvloer & hechtsterkte (zandcement, anhydriet, beton, hout)? | **[C]** | **[G]** | - | - | - | - | - | Selecteert primersoort (poreus/zuigend vs. calciumsulfaat/dicht). |
| **3** | **Fase B: Ondergrond** | Vlakheidsmeting 2m rei (oneffenheden > 2 mm onder de rei)? | **[C]** | **[G]** (vlakheid < 2 mm verplicht) | **[G]** (vlakheid < 2 mm) | - | **[P]** (zeer strenge tolerantie) | - | - | Oneffenheden > 2 mm activeert verplicht egalisatieadvies (NEN-EN 13813). |
| **4** | **Fase B: Ondergrond** | Vochtmeting dekvloer (capacitieve bolmeter standaard; CM-norm)? | **[C]** | **[G]** | **[G]** | - | - | **[P]** (striktere norm) | - | Zandcement < 2,0% (vvw < 1,5%); Anhydriet < 0,5% (vvw < 0,3%). Blokkade bij overschrijding! |
| **5** | **Fase B: Ondergrond** | Opstook- en afkoelprotocol vloerverwarming doorlopen & afgetekend? | - | - | - | - | - | **[P]** (opstookprotocol) | - | Zonder getekend protocol vervalt fabrieksgarantie; software blokkeert planning. |
| **6** | **Fase C: Montage** | Egalisatielaagdikte & primerverbruik (1,6 kg/m² per mm laagdikte)? | - | **[G]** (min. 2–3 mm egaline) | - | - | **[P]** (min. 3 mm spiegelglad) | - | - | Berekent automatisch het aantal zakken egaline en cans primer. |
| **7** | **Fase C: Montage** | Drukvaste ondervloer & dampremming (CS ≥ 200 kPa, SD > 100 m)? | - | - | **[G]** (geschikte ondervloer) | - | - | **[P]** (warmteweerstand R ≤ 0,15 m²K/W) | - | Voorkomt doortekening en breuk van klikverbindingen. |
| **8** | **Fase C: Montage** | Algeheel boorverbod vloeren & dilatatieruimte (8–10 mm)? | **[C]** (boorverbod; kitten) | - | **[G]** (dilatatievoeg verplicht) | - | - | - | - | Absoluut boorverbod in álle vloeren; profielen en plinten verlijmen. |
| **9** | **Fase C: Montage** | 10 dB VvE contactgeluidnorm (alleen bij etagevloeren/appartementen)? | **[C]** (etagevloer) | - | **[G]** (10 dB ondervloer) | - | - | - | - | Verplicht 10 dB certificaat; randen rondom 100% akoestisch vrijhouden. |
| **10** | **Fase D: Maatvoering** | Legrichting & vleugvector (evenwijdig aan hoofdlichtinval / lengte)? | **[C]** | **[G]** | **[G]** | **[G]** (vleugrichting) | - | - | - | Valideert esthetische oriëntatie en looprichting in de ruimte. |
| **11** | **Fase D: Maatvoering** | Hartlijn & bies/band uitzetten (startpunt visgraatpatroon)? | - | - | - | - | **[P]** (hartlijn & bies) | - | - | Bepaalt symmetrische aansnijding langs buitenmuren. |
| **12** | **Fase D: Maatvoering** | Deurnaadspeling t.o.v. vloeropbouw (restruimte onder deurblad)? | **[C]** | **[G]** | **[G]** | **[G]** | - | - | **[P]** (deurspeling < 4 mm) | Restruimte < 4 mm signaleert adviespunt: klant laat deuren inkorten door timmerman. |
| **13** | **Fase D: Maatvoering** | Aantal en type binnendeuren met te krappe speling tellen? | - | - | - | - | - | - | **[P]** (aantal deuren tellen) | Telt aantal knelpunten; legt advies vast in inmeetverslag (geen eigen montagedienst). |
| **14** | **Fase D: Maatvoering** | Plinttype & dilatatiedekking (MDF renovatie 18/28 mm vs. plakplint)? | **[C]** | **[G]** | **[G]** | - | - | - | - | Controleert of plintdikte de dilatatievoeg (8–10 mm) volledig afdekt. |
| **15** | **Fase D: Maatvoering** | Snijverliespercentage & volle pakken (10% recht, 12–15% visgraat)? | **[C]** | **[G]** | **[G]** | **[G]** | **[P]** (12–15% toeslag) | - | - | Rondt netto m² automatisch af naar volle verpakkingseenheden. |
| **16** | **Fase F: Logistiek** | Acclimatisatiecondities (pakken 48u horizontaal opslaan bij 18–22 °C)? | **[C]** | **[G]** | **[G]** | - | - | - | - | Instructie op inmeetverslag: materialen tijdig binnen leveren. |

*Bestaande situatie-afspraken:* Aanwezigheid van oud tapijt, verlijmd linoleum of parket; verwijderen en afvoeren door woninginrichter of opdrachtgever; lijmresten strippen en schuren; vochtmeting dekvloer (capacitief / CM-meting).  
*Nieuwe situatie & concepttoetsing:* Type plint (MDF renovatieplint, plakplint, hoge plint), legrichting (lengte/breedte/lichtinval), deurkier-hoogte (signalerend advies deuren inkorten door timmerman bij restantruimte < 4 mm), 10 dB VvE-norm op etagevloeren, dilatatievoegen en overgangsprofielen (alles lijmen/kitten conform boorverbod).

---

#### 3.4.7 Inmeet- en Rekenmatrix: Vloerbekleding

| Productgroep | Primaire Dagmaat (Invoer Inmeter) | Blijvende Maat (Formule & Aftrekregel) | Verplichte Referentie & Validatie | Output naar Productie & Montage |
| :--- | :--- | :--- | :--- | :--- |
| **PVC & Laminaat (Dryback, Click, Visgraat)** | Netto m² laser-contourmeting lengte × breedte incl. alle nissen en deuropeningen | Bestelhoeveelheid m² = Netto m² + snijverliestoeslag (Wildverband +10%; Visgraat +12%; Hongaarse/Weense punt +15%; Bies & band +12%), afgerond naar boven op hele pakken (bijv. à 2,16 m²) | Vochtmeting (capacitieve bolmeter / CM-norm), 2m rei vlakheidsmeting (egalisatieklasse), 10 dB VvE-geluidsnorm (etagevloer), algeheel boorverbod (kitten) | Aantal te bestellen pakken PVC/laminaat, zakken egaline (1,6 kg/m²/mm laagdikte), cans primer, strekkende meters plinten (+10%), aantal binnendeuren advies timmerman |
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

#### 3.5.5 Hiërarchische Inmeetchecklist-Matrix: Trapbekleding & Traprenovatie
Onderstaande matrix definieert de integrale inmeetchecklist voor Categorie 4 (Trapbekleding & Traprenovatie), gerangschikt in de chronologische werkvolgorde van de inmeter op locatie (Fase A t/m F). In elke cel staat aangegeven op welk niveau de checkvraag resideert: **[C]** Categorie-breed (geldt voor elke trap), **[G]** Productgroep-niveau, **[P]** Product-/Optie-specifiek, of **[-]** Niet van toepassing.

| Nr. | Fase | Checkvraag / Veldinspectie | [C] Trapbekleding (Algemeen) | [G] Traditionele Trapstoffering (Tapijt) | [G] Traprenovatie (Overzettreden) | [P] Cortex Renovatie (CNC-Export) | [P] LED-Verlichting in Stootborden | [P] Open Trap Rondom Bekleden | Software-Validatie & Gating |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | **Fase A: Schouw** | Oude trapbekleding & lijmresten (verwijderd, gevlakt, schroeven verzinkt)? | **[C]** | **[G]** | **[G]** | - | - | - | Verplicht veld; registreert schuurwerk en lijmverwijdering. |
| **2** | **Fase B: Ondergrond** | Trede-stabiliteit & kraakvrijheid (krakende treden constructief schroeven)? | **[C]** | **[G]** | **[G]** | - | - | - | Vastzetten van losse treden vóór montage voorkomt latere schade. |
| **3** | **Fase B: Ondergrond** | Trapconstructie: Dichte trap (met stootborden) vs. Open trap (rondom)? | **[C]** | **[G]** | **[G]** | - | - | **[P]** (open trap rondom) | Bepaalt of achterzijde treden en contra-profielen worden berekend. |
| **4** | **Fase B: Ondergrond** | Trapneusconstructie: Overhangende neus afzagen vs. uitvullen met latten? | - | - | **[G]** (trapneuscontrole) | **[P]** | - | - | Overzetstootbord vereist een haakse, vlakke trapneus. |
| **5** | **Fase B: Ondergrond** | Wel-trede vlakheid (overgang naar bovenverdieping afwijking ≤ 3 mm)? | **[C]** | **[G]** | **[G]** | - | - | - | Afwijking > 3 mm vereist uitvullen / egaliseren van de wel-trede. |
| **6** | **Fase C: Montage** | Rubber ondertapijt & spijkerlatten (trededemping en spanning)? | - | **[G]** (ondertapijt verplicht) | - | - | - | - | Activeert rubber ondertapijt en spanlatten in calculatie. |
| **7** | **Fase C: Montage** | 4 optische markers per trede geplaatst en gefotografeerd voor 3D-scan? | - | - | - | **[P]** (4 markers per trede) | - | - | Validatie: Foto's van alle treden uploaden; genereert CNC-freesbestanden. |
| **8** | **Fase C: Montage** | Mammoet montagelijm & geluiddemping (elastische verlijming)? | - | - | **[G]** (MS-polymeerkit) | **[P]** | - | - | Berekent automatisch het aantal kokers montagelijm (ca. 1 koker per 2 treden). |
| **9** | **Fase D: Maatvoering** | Radiale vleugrichting bij draaiende treden (spilzijde vs. brede buitenzijde)? | - | **[G]** (vleugrichting) | - | - | - | - | Voorkomt kleur- en vleugverschil tussen trapdelen. |
| **10** | **Fase D: Maatvoering** | Zijkantafwerking bij open trap (alu contra-profielen, kantenband)? | - | - | **[G]** | - | - | **[P]** (afdekprofielen) | Berekent meters zijkantprofiel voor open zijkanten. |
| **11** | **Fase E: Bediening** | 230V stroompunt aanwezig onder de trap voor LED-transformator? | - | - | - | - | **[P]** (230V stroompunt) | - | Blokkade: Geen stroompunt aanwezig vereist elektricien-order. |
| **12** | **Fase E: Bediening** | Uitsparingen bewegingssensoren in trede 1 (onder) en trede 13/14 (boven)? | - | - | - | - | **[P]** (sensoren treden) | - | Bepaalt boorposities voor automatische trapverlichting. |
| **13** | **Fase F: Logistiek** | Veiligheid, antislip en uitharding (antislipstrip & 24u beloopbaar)? | **[C]** | - | **[G]** (antisliprubber) | **[P]** | - | - | Opleverinstructie voor klant: 24 uur niet zwaar belasten. |

*Bestaande situatie-afspraken:* Oude bekleding verwijderd; lijmresten gevlakt; stabiliteit tredevlakken (kraken verhelpen); staat van stootborden en trapwangen.  
*Nieuwe situatie & concepttoetsing:* Overzettreden vs. stoffering; type trapneus en antislipstrip; verlichting in stootborden; zijkantafwerking (open zijkanten / afdeklijsten).

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
  * **Status per Data-Element:** Elk individueel data-element in het dossier heeft een eigen status in de workflow:
    * Indicatief: Ingevoerd in de showroom op basis van klantopgave, stalenkeuze en/of op basis van een schouw (Fase 1).
    * Geverifieerd: Ter plekke getoetst en vastgelegd door de inmeter (Fase 2).
    * Gecalculeerd / Geoffreerd: Vertaald naar bindende orderregels in het ERP (Fase 3).
    * Gecontroleerd & Vrijgegeven: Getoetst door de ordercontroleur en vrijgegeven voor inkoop (Fase 4).
    * Gemonteerd & Opgeleverd: Fysiek geïnstalleerd en geaccordeerd door de klant (Fase 5/6).
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

### 4.2 Systeemintegratie & De Keten naar Productie
* **De Drie Stappen van Klantwens naar Productie:**  
  1. *Stap 1: Fysieke Inmeting & Bouwkundige Parameters:* De inmeter legt de zuivere werkelijkheid vast (dagmaten, ondergronden, kozijntypen, obstakels).
  2. *Stap 2: Productconfiguratie & Validatie:* De specifieke productuitvoering wordt gekoppeld aan de positie. De software past conditional logic toe en toetst de technische haalbaarheid.
  3. *Stap 3: Productie- en Montageafgeleiden:* De gevalideerde parameters genereren geautomatiseerd de productiemaat voor de fabrikant en de montage-instructie voor de werkbon.
* **De Vier Gekoppelde Domeinen:**  
  Aan elke gevalideerde productuitvoering hangen vier integrale domeinen vast:
  * *1. Productieparameters:* Blijvende maat, pakkethoogte, bedieningszijde, doekrolrichting.
  * *2. Montagelogistiek:* Benodigde montagetijd, steunafstanden, bevestigingsmiddelen (schroeven/pluggen per ondergrond), klimmateriaal (trap/steiger).
  * *3. Confectie- & Maatwerkvoorschriften:* Plooidiepte, baanverdeling, rapportafstemming, retourbochten.
  * *4. Calculatie & Kostprijs:* Staffelsprongen, toeslagen voor specials (TruFit, zijgeleiding, elektrische motoren), zaag- en buigtarieven.
* **Bestel- en Configuratielandschap:**  
  Elk productartikel vereist specifieke invoerparameters: Basisartikel, Merk & Serie, Bedieningswijze (handmatig vs elektrisch), Aansluitzijde / Laadpoort (links of rechts), Montagemateriaal / Steunen (wand vs plafond).
* **Conditional Logic & Uitsluitings-Beslisbomen in de Configurator:**  
  Om te voorkomen dat technisch onmogelijke combinaties worden verkocht, dwingt de software automatische restricties af:
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

* **Materiaallogistiek voor Monteurs (Automatische Materiaalcalculatie):**  
  Monteurs moeten bulkproducten meenemen naar de klus (bijv. zakken egaline, emmers lijm, rollen ondervloer).  
  * *Automatische berekening in het Portaal:* Op basis van het aantal m², de laagdikte en het verbruik per mm berekent het systeem automatisch het exact benodigde aantal (bijv. `# zakken egaline van 25 kg`).  
  * *Magazijn & Busbepakking:* Dit berekende aantal komt direct in de planning en op de werkbon te staan, zodat het magazijn dit klaarzet en de monteur zijn bus met het juiste gewicht en volume kan inladen.

### 4.6 Afspraaklogica, Tijdsblokken & Klantcommunicatie
* **Tijdsblokken & Klantcommunicatie (Afspraaklogica):**  
  * **Tijdsblokken:** Afspraken (voor inmeter en monteur) worden gepland in tijdsblokken waarbinnen de medewerker arriveert (bijv. *Ochtendblok 08:30 - 12:30*, *Middagblok 13:00 - 17:00*).  
  * **Klant-instructies & Bellen voor aankomst:** Klanten bellen vaak vooraf voor een specifieker richttijdstip of vragen expliciet: *"Bel/app 15 minuten van tevoren naar mobiel nummer X"*. Dit is een verplicht instructieveld op de afspraak.  
  * **Backlog-idee (Picnic-model):** Inmeter/monteur tikt 'Onderweg' aan in de app --> automatisch sms/WhatsApp-bericht naar de klant met verwachte aankomsttijd en eventueel realtime locatie.

* **Tussenbonnen vs. Eindoplevering:**  
  Na tussentijdse bezoeken (zoals na het egaliseren) tekent de klant een **Tussenbon / Veiligheidsinstructie** (bijv. *"Vloer geëgaliseerd, betreden verboden tot morgen 12:00 uur"*). Pas bij afronding van de allerlaatste montage-afspraak wordt het officiële **Opleverontvangst / Opleverrapport** door de klant ondertekend, inclusief eventuele restpunten voor de After Service Monteur.

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
  Veiligheidsrestricties en vereist klimmaterieel die tijdens de inmeetfase zijn geregistreerd, worden automatisch doorgezet naar de werkbon van de monteur en de planning.
* **Protocol Hoge Montage in Trapgat / Vide:**  
  * *Materieeleis:* Hoge montage in een trapportaal of vide (> 2,5 m werkhoogte) vereist verplicht een **uitschuifladder van minimaal 2,5 meter**. Indien de werkhoogte > 4 m is, wordt automatisch een **rolsteiger of bordesplatform** ingepland.
  * *Plaatsingsprotocol:* De ladder wordt stabiel op een rechte trede geplaatst, voorzien van **zachte beschermingsdekens** tegen krassen/beschadiging, en stevig afgesteund tegen het **stootbord** van de bovengelegen trede (fysieke borging tegen wegglijden).

## Deel 5: Gebruikers, Rollen & Autorisatiestructuur (Retailer & Klant)

In het ecosysteem van de woninginrichter werken interne medewerkers en externe klanten samen binnen één centraal portaal. Hierbij geldt een strikte scheiding van bevoegdheden via Role-Based Access Control (RBAC).

### 5.1 Retailer-Organisatie & Interne Medewerkers (De Woninginrichter)
* **Centrale Accountcreatie:** Alle medewerkers van de woninginrichter beschikken over een eigen beveiligd account in het portaal.
* **Retailer Beheerder (Admin):**
  * De beheerder beheert de organisatie, vestigingen en gebruikersaccounts van de retailer.
  * Heeft de exclusieve bevoegdheid om nieuwe medewerkers uit te nodigen, accounts te deactiveren en specifieke rollen/bevoegdheden toe te wijzen.
  * Beheert vestigingstoegang en globale systeemparameters (zoals standaard marges en rekenregels).

### 5.2 De 6 Interne Medewerker-Rollen
Binnen de retailer worden de volgende 6 operationele vakrollen onderscheiden:

* **1. Verkoper (Showroom, Advies & Offerte):**
  * *Verantwoordelijkheid:* Klantbegeleiding in de showroom of aan huis, smaak- en productadvies, initiële productconfiguratie, calculatie van voorlopige prijzen en uitbrengen van offertes.
  * *Portaalrechten:* Toegang tot productcatalogus, stalenbeheer, klantwensen, offerte- en orderinvoer, status van lopende verkopen.

* **2. Inmeter (Technische Opname & Haalbaarheid ter Plekke):**
  * *Verantwoordelijkheid:* Bezoekt het fysieke pand (Fase 2) voor de exacte maatvoering volgens het meetraster (max. 50 cm tussenruimte). Bepaalt de technische rekenregels (dagmaat vs bestelmaat), toetst pakkethoogte en draaikiepraam-vrijgave, bepaalt de montagevolgorde bij gekoppelde posities in hoeken, doorloopt de vaste intake-checklist (demontage/afvoer en hechtingscontrole oude vloer/trap), registreert ondergrond- en inspectiebeperkingen, en schat de benodigde montageduur in per positie.
  * *Portaalrechten:* Mobiele/tablet inmeet-app, registreren van laser- en strakke maten, toevoegen van situatie- en detailfoto's, vastleggen van montage-aanwijzingen voor de werkvoorbereiding en montage.

* **3. Ordercontroleur / Werkvoorbereider (Kwaliteitscontrole & Vier-ogenprincipe):**
  * *Verantwoordelijkheid (Het Vier-ogenprincipe):* Voordat bestellingen definitief worden doorgezet naar externe leveranciers/ateliers (de transitie van rood naar geel), voert de ordercontroleur een grondige controle uit.
  * *Dubbele Verificatie:* Toetst de orderregels niet alleen aan de inmeetbon van de inmeter, maar vergelijkt deze ook integraal met de **initiële winkelofferte van de verkoper**:
    * Klopt de gekozen profiel-/systeemkleur (bijv. showroomkeuze wit vs. foutieve bestelling zwart)?
    * Klopt de bedieningszijde (links vs rechts) met de fysieke situatie en klantkeuze?
    * Klopt het montagetype (in de dag vs op de dag)?
    * Klopt het geoffreerde plooitype (enkele plooi vs wave-plooi)?
  * *Correctie & Escalatie:* Foutieve invoer of tegenstrijdigheden worden direct geretourneerd naar de verkoper of inmeter ter correctie vóór verzending.
  * *Portaalrechten:* Vrijgave van inkooporders (rood --> geel), handmatig beheren van externe ordernummers, autorisatie van 'fictief verzenden' bij externe portalen, en beheer van leverancierscommunicatie.

* **4. Planner (Capaciteit, Materieel & Logistiek):**
  * *Verantwoordelijkheid:* Vertaling van goedgekeurde orders naar een haalbare uitvoeringsplanning zodra alle orderregels op groen staan. Koppelt montageafspraken aan specifieke vakdisciplines en competenties (vloerenleggers vs raamdecorateurs vs meesterstoffeerders), bewaakt de dwingende productvolgorde (vloer en droogtijd eerst, daarna raambekleding), plant tijdsblokken en stuurt communicatie aan (zoals de '15-30 minuten vooraf bellen'-notificatie).
  * *Portaalrechten:* Grafisch planbord, route- en capaciteitskalender, toewijzen van monteurs en busvoorraden, order- en montagestatussen wijzigen.

* **5. Monteur (Vakmatige Uitvoering op Locatie):**
  * *Verantwoordelijkheid:* Fysieke plaatsing en installatie van de materialen (egaliseren, pvc/tapijt leggen, rails en gordijnen ophangen, raamdecoratie monteren). Hanteert de door de inmeter voorgeschreven montagevolgorde (bijv. in hoeken), signaleert eventueel meerwerk, en laat documenten aftekenen door de klant.
  * *Portaalrechten:* Mobiele werkbon-app, inzien van werkopdrachten, montagetijden, technische instructies en foto's, uploaden van opleverfoto's, laten ondertekenen van Tussenbonnen (bijv. betredingsverbod na egalisatie) en opleveringsbevestigingen.

* **6. Servicemonteur (Nazorg, Garantie & Reparaties):**
  * *Verantwoordelijkheid:* Zelfstandig afhandelen van restpunten na de oplevering, garantieclaims, herstelwerkzaamheden (zoals het vervangen van een beschadigde lamel), en mechanische bijstellingen (zoals het fijn afstellen of begrenzen van de kiepstand van een draaikiepraam wanneer deze tegen de raamdecoratie aanloopt).
  * *Portaalrechten:* Servicetickets, reparatiebonnen, nazorgplanning, bestellen van vervangende service-onderdelen, registreren van afgeronde servicemeldingen.

---

### 5.3 Klant-Domein: Klant Admin & Externe Toegang
* **Eigen Klantaccount:** Elke particuliere of zakelijke opdrachtgever ontvangt bij het eerste contact of de offerteaanvraag een persoonlijk account voor het Klantportaal.
* **Klant Admin (Eigenaar van het Klantdossier):**
  * De primaire contractant/opdrachtgever is automatisch de **Klant Admin** van het eigen dossier.
  * Heeft volledige zeggenschap over het project: kan offertes digitaal accorderen, betalingen inzien, planning volgen, en opleverbonnen ondertekenen.
  * **Uitnodigingsbevoegdheid:** De Klant Admin kan zelfstandig **andere personen uitnodigen** om toegang te krijgen tot het portaal en hen een specifieke rol toekennen binnen zijn project.
* **Document- en Plannen-Upload:** De klant (of diens architect/aannemer) kan proactief plattegronden, keukenplannen, leidingschema's en kozijntekeningen uploaden naar het dossier. Hierdoor kan de inmeter en verkoper vooraf meedenken en tijdig waarschuwen voor draaiende keukendeuren, kastenwanden of afwijkende kozijnafmetingen.

### 5.4 Rollen binnen het Klantportaal
Binnen een klantdossier kunnen verschillende externe rollen worden toegekend:

* **1. Klant Admin (Hoofdopdrachtgever / Eigenaar):**
  * Volledige rechten binnen het eigen dossier: ondertekenen, financiële inzage, planning wijzigen/bevestigen, en het beheren van genodigden.

* **2. Gezinslid / Partner (Mede-beslisser):**
  * *Doel:* Betrokken huisgenoot of partner die actief meebeslist over interieurkeuzes.
  * *Rechten:* Volledige inzage in de geselecteerde producten, stoffen, kleuren en 3D/interieurvisualisaties; mogelijkheid om keuzes te bevestigen of opmerkingen achter te laten; inzien van montagedata.

* **3. Architect / Interieurarchitect / Stylist (Professioneel Ontwerper):**
  * *Doel:* De externe ontwerper of stylist die het interieurplan bewaakt en afstemt met de woninginrichter.
  * *Rechten:* Toegang tot technische maten, strakke dagmaten, plattegronden, kleur- en materiaalstalen, en montagewijzen; kan opmerkingen toevoegen aan posities en esthetische richtlijnen uploaden. Heeft géén inzage in persoonlijke financiële gegevens van de klant.

* **4. Aannemer / Bouwbegeleider / Klusbedrijf (Bouwkundige Partner):**
  * *Doel:* De partij die verantwoordelijk is voor de ruwbouw, stucwerk of voorbereiding (zoals het tijdig verwijderen van de oude vloer of het opleveren van een strakke dekvloer).
  * *Rechten:* Inzage in de uitvoeringsplanning, bouwkundige randvoorwaarden, vochtmetingsresultaten, droogtijden en oplevereisen. Zorgt voor naadloze aansluiting tussen bouwwerkzaamheden en inrichtingsmontage.

* **5. Projectleider / Locatiemanager (Zakelijke Opdrachtgevers / B2B):**
  * *Doel:* Contactpersoon op locatie bij zakelijke projecten (kantoren, zorgcomplexen, recreatiewoningen).
  * *Rechten:* Coördinatie van sleutelbeheer, pandtoegang, goederenliften, parkeerontheffingen en operationele aftekening van deelleveringen ter plekke.

---

### 5.5 Klant- & Projectadresbeheer: Factuuradres vs. Montageadres & Nieuwbouw
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

### 5.6 Beveiliging, Autorisatie & Gegevensscheiding (RBAC & Multi-Tenancy)
* **Strikte Dossier-Isolatie:** Klanten en hun genodigden hebben uitsluitend toegang tot hun eigen projectdossier. Gegevens van andere klanten of interne bedrijfsinformatie van de retailer (zoals inkoopprijzen, brutomarges of leverancierskortingen) zijn strikt afgeschermd.
* **Eén Centrale Waarheid:** Zowel de retailer als de klant kijken in het portaal naar dezelfde realtime status: dezelfde strakke inmeetmaten, dezelfde gehanteerde rekenregels, dezelfde montagedatums en dezelfde opleverdocumenten.

---

### 5.7 Architectuurprincipe: De 80/20-Regel & Gestructureerde vs. Vrije Invoer in het Portaal
* **Snelheid voor 80% Standaardsituaties:**  
  Om de inmeetapplicatie en het portaal ter plaatse snel, intuïtief en efficiënt te houden, wordt het formulier **niet overladen met honderden complexe dropdowns en invoervelden voor zeldzame woonsituaties (de 10-20% uitzonderingen)**.
* **Borging via Vrije Notities & Foto-Annotatie:**  
  Uitzonderingen (zoals afwijkende klinkspeling, schuin plafondverloop, stucprofielen of bijzondere obstakels) worden gedocumenteerd via een **vrij opmerkingenveld per positie** gecombineerd met een **verplichte foto-upload waarin de inmeter direct met stylus markeringen en maataantekeningen schetst**.
* **Standaard Monteursinstructie bij Draaikiepramen:**  
  De vaste default-instructie op de werkbon luidt: *"Rekening houden met kiepstand (steunen zover mogelijk naar achteren plaatsen)"*. De monteur lijnt dit ter plekke uit met de laser (bijv. 32 mm). Alleen wanneer de klant expliciet eist dat het doek bij geopende kiepstand neerwaarts blijft hangen, voert de adviseur een harde afwijkende afstand (bijv. 3 cm) en montageafspraak in.

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
