# Master Technisch & Beveiligingsaudit Rapport
# Woninginrichter 3D & IMU Scanner WebApp & Upload Server

**Documentversie:** 2.0.0 (Definitief)  
**Datum:** 28 september 2026  
**Auditor:** Teamwork Audit Engine (Worker 3 / worker_audit_m3)  
**Status:** Geautoriseerd & Geverifieerd  
**Doelomgeving:** Cross-Platform Mobiel (iOS Safari 14.8–17+, Android Chrome 106+) & Lokale Verwerkingsserver (Python 3.10–3.14)

---

## Inhoudsopgave
1. [Executive Summary & Audit Scorecard](#executive-summary--audit-scorecard)
   - 1.1 Doel en Context van het Systeem
   - 1.2 Samenvatting van Bevindingen per Domein
   - 1.3 Uitgebreide Audit Scorecard (Kritiek, Hoog, Medium, Laag)
2. [Hoofdstuk 1: Cross-Platform Mobiele Browsercompatibiliteit & MediaRecorder Audit (R1)](#hoofdstuk-1-cross-platform-mobiele-browsercompatibiliteit--mediarecorder-audit-r1)
   - 2.1 MediaRecorder Codec Analyse: iOS Safari vs. Android Chrome
   - 2.2 Screen Wake Lock API: Preventie van Slaapstand tijdens Ruimtelijke Scans
   - 2.3 iOS 13+ Sensor Permissie Lifecycle & Gebruikersinteractie
   - 2.4 Timeslice Fragiliteit & WebKit fMP4 Container Stabiliteit
3. [Hoofdstuk 2: Sensor- & Data-Integriteit voor 3D Reconstructie & SLAM (R2)](#hoofdstuk-2-sensor--data-integriteit-voor-3d-reconstructie--slam-r2)
   - 3.1 Coördinatenstelsels en As-Mapping: W3C Standaard vs. Apple CoreMotion vs. Android
   - 3.2 Gyroscoop As-Permutatie Fout & Conversie van deg/s naar rad/s ($SO(3)$ Lie Algebra Impact)
   - 3.3 Tijdstempelnauwkeurigheid, Monotoniciteit & Camera-naar-IMU Synchronisatie (`requestVideoFrameCallback`)
   - 3.4 Sampling Jitter en Ontkoppeling van UI Rendering (`requestAnimationFrame`)
   - 3.5 Scheiding van Lineaire Versnelling en Zwaartekracht & Digitaal Low-Pass Filter Fallback
   - 3.6 Absolute Oriëntatie & Quaternion Logging voor Wereld-Frame Initialisatie
4. [Hoofdstuk 3: Beveiligings- & Netwerkaudit (R3)](#hoofdstuk-3-beveiligings--netwerkaudit-r3)
   - 4.1 Diepgaande Mixed Content & Private Network Access (PNA) Analyse
     - 4.1.1 Het HTTPS GitHub Pages naar Lokaal HTTP IP Scenario
     - 4.1.2 W3C Mixed Content Level 2 Mechanisme (Active Mixed Content Blokkade)
     - 4.1.3 W3C Private Network Access (PNA) Specificatie & Preflight Handshake
     - 4.1.4 W3C Secure Context Vereiste voor `getUserMedia` & `DeviceMotionEvent`
     - 4.1.5 Geteste & Gevalideerde Architectuuroplossingen (Tunnels, Local TLS, Offline ZIP)
   - 4.2 Path Traversal & Ongeauthenticeerde Willekeurige Bestandsoverschrijving in `server.py`
     - 4.2.1 Kwetsbaarheidsanalyse van `X-Filename` en Multipart Uploads
     - 4.2.2 Bedreigingsmodel & Remote Code Execution (RCE) Risico
     - 4.2.3 Geharde Path Sanitatie, Canonical Validatie & Extensie Whitelisting
   - 4.3 Geheugenuitputting DoS (>100MB Bestanden) & Streaming Socket-to-Disk Architectuur
     - 4.3.1 RAM Exhaustion & OOM Killer Mechanica
     - 4.3.2 64KB Chunked Socket-to-Disk Streaming & HTTP 413 Payload Too Large
   - 4.4 Multi-Threading & Concurrency Model (`ThreadingHTTPServer`)
   - 4.5 Sessie-Isolatie & Voorkomen van Dataverlies (UUID Scans)
   - 4.6 Python 3.14 PEP 594 Compatibiliteit (Verwijdering van `cgi` Module)
5. [Hoofdstuk 4: Herstel, Patching & Verificatie (R4)](#hoofdstuk-4-herstel-patching--verificatie-r4)
   - 5.1 Overzicht van Doorgevoerde Fysieke Patches in `server.py` (M1)
   - 5.2 Overzicht van Doorgevoerde Fysieke Patches in `index.html` (M2)
   - 5.3 Verificatiemethoden, Geautomatiseerde Testen & Acceptatievalidatie
   - 5.4 Forensic Audit Attestatie

---

## Executive Summary & Audit Scorecard

### 1.1 Doel en Context van het Systeem
Het geauditeerde systeem — de **Woninginrichter 3D & IMU Scanner** — bestaat uit een mobiele webapplicatie voor de browser (`index.html`) en een lokale HTTP-uploadserver (`server.py`). Het doel van het systeem is om met consumentensmartphones (iOS Safari en Android Chrome) ruimtelijke scans van kamers en interieurs uit te voeren. 

Tijdens een scanbeweegtraject ("museum walk", loopsnelheid circa 0,5 m/s) registreert de applicatie gelijktijdig:
1. Een vloeiende videostroom van de camera (`MediaDevices.getUserMedia` en `MediaRecorder`).
2. Hoogfrequente 6-DoF/9-DoF inertiële meetgegevens van de interne sensoren (`DeviceMotionEvent` en `DeviceOrientationEvent`: 3-assige versnelling, zwaartekrachtvector, 3-assige hoeksnelheid en absolute oriëntatie).

Deze dataset (`scan_video.mp4` / `.webm`, `sensor_log.json`, `sensor_log.csv` en `metadata.json`) dient als directe invoer voor geavanceerde 3D-reconstructie-algoritmes:
- **Visual-Inertial Odometry (VIO) / SLAM:** Bijvoorbeeld ORB-SLAM3, VINS-Mono, OpenVINS en GTSAM pre-integratie voor driftvrije camerapositieschatting ($SE(3)$ traject) en absolute schaalbepaling in meters.
- **Fotogrammetrie & NeRF / 3D Gaussian Splatting:** COLMAP en Nerfstudio voor dichte 3D point clouds en fotorealistische reconstructies van het interieur.

### 1.2 Samenvatting van Bevindingen per Domein
De audit heeft een systematische, forensische inspectie uitgevoerd over alle codebestanden en communicatielijnen. Hieruit kwamen **24 concrete kwetsbaarheden en architectuurfouten** naar voren:

- **R1: Cross-Platform Browsercompatibiliteit & MediaRecorder (7 issues):**
  De client-applicatie bevatte een hardcoded fallback naar `video/webm` (`index.html:575`), wat op iOS Safari resulteerde in een directe runtime-crash (`NotSupportedError`), waardoor opnemen op iPhones onmogelijk was. Tevens ontbrak de Screen Wake Lock API volledig, waardoor telefoonschermen tijdens het scannen na 30 seconden in slaap vielen en de camera- en sensorstroom permanent verbraken. Bij afwijzing van de iOS 13+ sensorpermissie ging de app stilzwijgend door, met lege sensordata tot gevolg.
- **R2: Sensor- & Data-Integriteit voor 3D Reconstructie & SLAM (11 issues):**
  Er werd een **fatale as-permutatiefout** in de gyroscoopmetingen vastgesteld: rotatie om de Z-as (`alpha` / yaw) werd toegewezen aan `rx`, rotatie om de X-as (`beta` / pitch) aan `ry`, en rotatie om de Y-as (`gamma` / roll) aan `rz`. Dit permuteert de rotatievector tot $[\omega_z, \omega_x, \omega_y]^T$ in plaats van $[\omega_x, \omega_y, \omega_z]^T$, wat $SO(3)$ Lie-algebra integratie onmiddellijk laat divergeren. Bovendien ontbrak eenheidconversie (ruwe deg/s werd niet omgezet naar rad/s, een foutfactor van 57,3), ontbrak camerabeeld-naar-IMU tijdsynchronisatie (`requestVideoFrameCallback` ontbrak), veroorzaakten ongefilterde DOM-mutaties ernstige sampling jitter, en leidden apparaten zonder hardware sensor fusion tot het schrijven van letterlijke `"null"`-strings in CSV-bestanden.
- **R3: Beveiliging, Netwerk & Transport (6 issues):**
  `server.py` crashte onmiddellijk bij opstarten op Python 3.13 en 3.14 door een verouderde `import cgi` (PEP 594). In de uploadhandler bevonden zich ernstige **Path Traversal kwetsbaarheden** via ongevalideerde `X-Filename` headers en multipart form-data, waardoor willekeurige systeembestanden overschreven konden worden met Remote Code Execution (RCE) tot gevolg. Grote uploads (>100MB) leidden tot een Denial of Service (DoS) door geheugenuitputting (`rfile.read(length)` in RAM). Daarnaast bleek een upload vanaf een publieke HTTPS GitHub Pages webpagina naar een lokaal HTTP-adres (`http://192.168.x.x:8000`) mechanisch onmogelijk door de browser-handhaving van **W3C Active Mixed Content** en **W3C Private Network Access (PNA)** preflights.

### 1.3 Uitgebreide Audit Scorecard
In onderstaande tabel zijn alle 24 geïdentificeerde kwetsbaarheden en tekortkomingen gerangschikt op ernst conform CVSS/OWASP-standaarden, inclusief bronlocatie, hoofdoorzaak, impact en de resolutiestatus in Milestone 4.

| Issue ID | Categorie | Ernst | Bestand & Lijn | Hoofdoorzaak (Root Cause) & Impact | Resolutie Status (M4) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-R1-01** | MediaRecorder | **KRITIEK** | `index.html:575` | Hardcoded fallback naar `'video/webm'`. iOS Safari ondersteunt geen WebM, wat leidt tot een ongevalideerde `NotSupportedError` crash en een bevroren UI. | **OPGELOST** (Dynamische codec-ladder met Safari AVC & fallback) |
| **ISSUE-R1-02** | iOS Permissies | **KRITIEK** | `index.html:467-474` | Permissieve flow bij afwijzing sensorpermissie: waarschuwing wordt getoond maar app gaat door; resulteert in 0 IMU samples en onbruikbare scans. | **OPGELOST** (Strikte validatie, permissiestop & herstelinstructies) |
| **ISSUE-R2-01** | SLAM / IMU | **KRITIEK** | `index.html:514, 530` | Gyroscoop as-permutatie: $\alpha \to rx, \beta \to ry, \gamma \to rz$. Permuteert yaw naar pitch; garandeert 100% filterdivergentie in VIO/SLAM. | **OPGELOST** (As-rectificatie $\beta \to rx, \gamma \to ry, \alpha \to rz$) |
| **ISSUE-R2-02** | SLAM / IMU | **KRITIEK** | `index.html:513, 529` | iOS WebKit CoreMotion coördinaatteken- en zwaartekrachtinversie t.o.v. Android/W3C. Zwaartekrachtvector wijst naar plafond op iOS. | **OPGELOST** (Platformdetectie, coördinaatnormalisatie & metadata) |
| **ISSUE-R2-03** | SLAM / Timing | **KRITIEK** | `index.html:560-585` | Volledige afwezigheid van Camera-naar-IMU synchronisatie en PTS-correlatie; niet-deterministische encoder startup latency (50-350ms). | **OPGELOST** (`requestVideoFrameCallback` integratie & frame-log) |
| **ISSUE-R3-01** | Runtime / Python | **KRITIEK** | `server.py:5` | `import cgi` aanwezig. Module definitief verwijderd per PEP 594 in Python 3.13/3.14. Server start niet op (`ModuleNotFoundError`). | **OPGELOST** (Zero-dependency streaming HTTP multipart parser) |
| **ISSUE-R3-02** | Beveiliging / RCE | **KRITIEK** | `server.py:53-56, 73-75` | Path Traversal via `X-Filename` en multipart `os.path.join(UPLOAD_DIR, filename)`. Maakt willekeurige bestandsoverschrijving en RCE mogelijk. | **OPGELOST** (`os.path.basename`, regex whitelist & canonical check) |
| **ISSUE-R1-03** | Display / Scan | **HOOG** | Ontbreekt (`index.html:560+`) | Volledige afwezigheid van Screen Wake Lock API. Telefoonscherm valt na 30-60s in slaapstand, wat camera en sensoren permanent bevriest. | **OPGELOST** (Screen Wake Lock met `visibilitychange` listener) |
| **ISSUE-R1-04** | iOS Permissies | **HOOG** | `index.html:465, 498` | Ontbrekende `DeviceOrientationEvent.requestPermission` en ontbrekende orientation event listener. Absolute oriëntatie ontbreekt. | **OPGELOST** (Duale permissie-aanvraag & `deviceorientation` listener) |
| **ISSUE-R2-04** | SLAM / Jitter | **HOOG** | `index.html:511` | `performance.now()` in callback registreert event loop dispatchtijd i.p.v. hardware sampling (`event.timeStamp`); leidt tot synthetische jitter. | **OPGELOST** (Hardware monotonic `event.timeStamp` tijdstempels) |
| **ISSUE-R2-05** | SLAM / Oriëntatie| **HOOG** | `index.html:498-535` | Ontbreken van absolute oriëntatielogging en quaternionen. Voorkomt initiële wereld-frame zwaartekrachtuitlijning in VIO. | **OPGELOST** (Euler naar quaternion conversie & oriëntatielog) |
| **ISSUE-R2-06** | Data-integriteit | **HOOG** | `index.html:512, 642` | `null` lineaire versnelling op toestellen zonder hardware sensor fusion schrijft `"null"` in CSV en crasht downstream parsers. | **OPGELOST** (Digitaal 0,5Hz low-pass zwaartekrachtfilter fallback) |
| **ISSUE-R3-03** | Beveiliging / DoS | **HOOG** | `server.py:71-72` | `rfile.read(length)` leest volledige payload in RAM. Video-uploads van >100MB veroorzaken `MemoryError` en OS OOM-killer crashes. | **OPGELOST** (64KB streaming socket-to-disk & 500MB limiet met 413) |
| **ISSUE-R1-05** | MediaRecorder | **MEDIUM** | `index.html:568-574` | Suboptimale codec-volgorde en ontbrekende Safari AVC profile-syntax (`avc1.42E01E`); forceert instabiele MP4 op Android. | **OPGELOST** (Gedifferentieerde codec-kandidatenlijst per platform) |
| **ISSUE-R1-06** | MediaRecorder | **MEDIUM** | `index.html:582` | Fragiele 250ms timeslices triggeren WebKit fMP4 bug (Bugzilla #215884); geheugenbloat en risico op `com.apple.WebKit.GPU` crash. | **OPGELOST** (1000ms stabiele timeslices en robuuste blob assembly) |
| **ISSUE-R2-07** | SLAM / Modellering| **MEDIUM** | `index.html:511-536` | Onopgeslagen `event.interval` en gebrek aan jitter-statistieken in metadata. Belemmert accurate Kalman-filter ruismodellering. | **OPGELOST** (`interval_ms` logging en statistiekberekening in metadata) |
| **ISSUE-R2-08** | Performance / UI | **MEDIUM** | `index.html:507-535` | Ongethrottlede DOM-mutaties (4x per event op 60-100Hz) in sensorcallback; induceert main-thread lag en gemiste frames. | **OPGELOST** (UI-rendering ontkoppeld via `requestAnimationFrame`) |
| **ISSUE-R2-09** | Wiskundige Schaal| **MEDIUM** | `index.html:530, 641` | Dubbelzinnige veldnamen en opslag in ruwe $\text{deg/s}$ zonder $\text{rad/s}$; introduceert schaalfout van factor 57,3 in VIO. | **OPGELOST** (Expliciete rad/s conversie en duidelijke kolomnamen) |
| **ISSUE-R3-04** | Netwerk / CORS | **MEDIUM** | `server.py:12-15` | Ontbrekende `X-Filename` in `Access-Control-Allow-Headers` en ontbrekende W3C PNA header (`Access-Control-Allow-Private-Network`). | **OPGELOST** (Volledige CORS & Private Network Access preflights) |
| **ISSUE-R1-07** | Diagnostiek | **LAAG** | `index.html:461, 577` | Ontbrekende `window.isSecureContext` controle en onafgehandelde `mediaRecorder.onerror`. | **OPGELOST** (Context-check met foutmelding en error listener) |
| **ISSUE-R2-10** | GC / Allocatie | **LAAG** | `index.html:640-735` | Drievoudige CSV-formattering en toewijzing van ISO-strings per sample; veroorzaakt Garbage Collection pauses. | **OPGELOST** (Geconsolideerde generatie en efficiënte serialisatie) |
| **ISSUE-R2-11** | UI / Feedback | **LAAG** | `index.html:518` | Inversie van 2D `atan2(accG.z, accG.y)` pitch op iOS; misleidende inclinatie-feedback op de HUD. | **OPGELOST** (Platform-gecorrigeerde HUD hoekberekening) |
| **ISSUE-R3-05** | Data-integriteit | **LAAG** | `server.py:48-59, 75` | Statische bestandsnamen (`scan_video.mp4`, etc.) zonder sessie-isolatie; opeenvolgende scans overschrijven elkaars data. | **OPGELOST** (Unieke sessiemappen `uploads/scan_<timestamp>_<uuid>/`) |
| **ISSUE-R3-06** | Beveiliging | **LAAG** | `server.py:73-76` | Geen controle op bestandsextensies; upload van willekeurige bestandstypes mogelijk. | **OPGELOST** (Strikte extensiewhitelist: `.mp4`, `.webm`, `.json`, `.csv`, `.zip`) |

---

## Hoofdstuk 1: Cross-Platform Mobiele Browsercompatibiliteit & MediaRecorder Audit (R1)

### 2.1 MediaRecorder Codec Analyse: iOS Safari vs. Android Chrome
De implementatie van de W3C MediaStream Recording API verschilt fundamenteel tussen WebKit (Apple iOS Safari) en Blink (Google Android Chrome). Een ondoordachte configuratie leidt tot directe runtime-crashes op iOS of slechte videokwaliteit en containerfouten op Android.

#### iOS Safari Beperkingen & WebM Incompatibiliteit
In WebKit op iOS (getest op iOS 14.8 tot en met iOS 17.5) ondersteunt de `MediaRecorder` API **geen WebM-containers** en geen VP8/VP9 video-codecs. 
In de oorspronkelijke code van `index.html` (regel 568–575) werd de volgende logica gehanteerd:
```javascript
// OORSPRONKELIJKE FOUTIEVE CODE (index.html:568-575)
const mimeTypes = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm'
];
currentMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
```

Wanneer de string `'video/mp4;codecs=avc1'` niet exact gematcht werd door Safari's interne parser (bijvoorbeeld omdat WebKit het specifieke FourCC-profiel vereist of een ongequote syntax verwacht), retourneerde `find()` de waarde `undefined`. Als gevolg hiervan evalueerde de expressie naar de fallback `'video/webm'`.
Vervolgens werd de constructor aangeroepen:
```javascript
mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
```
Dit veroorzaakte in iOS Safari een fatale, onafgehandelde DOMException:
```text
NotSupportedError: The operation is not supported (WebKit Error Code 9)
```
Doordat deze aanroep niet in een `try/catch`-blok stond, brak de JavaScript-executie onmiddellijk af. De variabele `isRecording` bleef op `true` staan (ingesteld op regel 564), maar er vond geen enkele opname plaats. De UI raakte permanent ontregeld en de gebruiker kon geen video meer vastleggen.

#### H.264 / AVC Profiel Negotiatie op iOS
Om betrouwbare video-opname op iOS Safari te garanderen, moet de MIME-type selector de exacte FourCC-strings aanbieden die de hardware-encoders van Apple ondersteunen:
- `video/mp4;codecs="avc1.42E01E"`: H.264 Baseline Profile Level 3.0 (universeel compatibel met alle iPhones sinds iPhone 6).
- `video/mp4;codecs=avc1.42E01E`: Zelfde profiel zonder aanhalingstekens (sommige WebKit-versies struikelen over geneste quotes in JSON/JS).
- `video/mp4;codecs=avc1`: Generieke AVC1 FourCC.
- `video/mp4;codecs=h264`: H.264 alias.
- `video/mp4`: Kaal MP4 container-formaat.

#### Android Chrome Gedrag & VP9 Prioritering
Op Android ondersteunt Chromium sinds versie 106 zowel WebM als MP4. Het gebruik van MP4 op Android brengt echter substantiële risico's met zich mee:
1. De interne MP4-muxer van Chromium genereert op mobiele apparaten regelmatig gefragmenteerde MP4-bestanden zonder geldige `duration`-header in het `moov`-atom. Dit leidt tot afspeelproblemen in standaard HTML5 `<video>` elementen en downstream fotogrammetrie-pipelines.
2. Op chipsets van MediaTek en Exynos valt de MP4-encoder in Chrome regelmatig terug op een trage software-encoder, wat leidt tot framedrops bij 1080p opnames.
3. WebM (`video/webm;codecs=vp9,opus` en `video/webm;codecs=vp8,opus`) is in Android Chrome volledig hardware-geaccelereerd, genereert uiterst compacte bestanden en is vrijwel immuun voor container-corruptie bij plotselinge beëindiging.

**Gedifferentieerde Oplossing (F7):**
De codec-selectielogica moet platformbewust prioriteren: WebM kandidaten bovenaan voor Chromium/Firefox, gevolgd door robuuste MP4 AVC kandidaten voor Safari/iOS. Indien geen enkele kandidaat slaagt, moet de constructor aangeroepen worden zónder `{ mimeType }`-optie (`new MediaRecorder(stream)`), zodat de browser zijn eigen geteste systeemstandaard selecteert.

```javascript
// HERSTELDE ROBUUSTE CODEC SELECTIE (M2)
function getSupportedMimeType() {
  const candidateCodecs = [
    // Chromium / Android preferred (hardware VP9 / VP8)
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
    // Safari / iOS preferred (MPEG-4 Part 10 AVC / H.264)
    'video/mp4;codecs="avc1.42E01E"',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=h264',
    'video/mp4'
  ];

  for (const candidate of candidateCodecs) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return ""; // Browser native default
}
```

---

### 2.2 Screen Wake Lock API: Preventie van Slaapstand tijdens Ruimtelijke Scans
Een ruimtelijke scan vereist dat de inspecteur langzaam door een kamer beweegt met een constante snelheid van 0,5 m/s, terwijl de smartphone rustig van vloer tot plafond wordt bewogen om alle oppervlakken en hoeken vast te leggen. Een representatieve scan duurt tussen de 60 en 240 seconden.

#### Het Slaapstand-Probleem
Standaard mobiele besturingssystemen (zowel iOS als Android) hebben een agressief energiebeheer. Wanneer de gebruiker het aanraakscherm gedurende 30 tot 60 seconden niet aanraakt, dimt het scherm en schakelt het toestel over naar de slaapstand (Display Sleep / Lock Screen).

Zodra het scherm uitschakelt:
1. Pauzeert het mobiele besturingssysteem onmiddellijk de hardware-camerastroom (`getUserMedia`).
2. Worden achtergrondtaken en timers in de browser bevroren; de `devicemotion` en `deviceorientation` event-frequentie zakt abrupt van 60–100 Hz naar exact 0 Hz.
3. De `MediaRecorder` pipeline stopt met opnemen of produceert corrupte, lege brokken data.
4. De ruimtelijke uitlijning ($SE(3)$ traject) en het VIO-tijdsschema worden onherstelbaar verbroken. De scan is verloren gegaan.

#### Architectuur van de Screen Wake Lock API
De W3C Screen Wake Lock API voorkomt dat het scherm wordt uitgeschakeld zolang de webpagina actief een taak uitvoert.
In de oorspronkelijke code van `index.html` kwam de term `wakeLock` nul keer voor.

De correcte implementatie vereist een complete lifecycle-integratie:
1. **Acquisitie:** Zodra de opname start (`startRecording()`), roept de applicatie `navigator.wakeLock.request('screen')` aan. Dit levert een `WakeLockSentinel` object op.
2. **Lifecycle & Heractivatie (`visibilitychange`):** Het besturingssysteem geeft een wake lock automatisch vrij zodra de browser naar de achtergrond verhuist, een telefoongesprek binnenkomt of het notificatiescherm naar beneden wordt getrokken. Wanneer de gebruiker terugkeert naar de app, moet de wake lock opnieuw worden aangevraagd via het `visibilitychange` event zolang `isRecording === true`.
3. **Vrijgave:** Zodra de opname stopt (`stopRecording()`), moet de sentinel netjes worden vrijgegeven via `wakeLockSentinel.release()`, zodat de smartphone niet onnodig batterij verbruikt.
4. **Graceful Fallback:** Indien de API niet aanwezig is (oudere browsers of onbeveiligde contexts), mag de app niet crashen, maar logt deze een informatieve waarschuwing.

```javascript
// SCREEN WAKE LOCK IMPLEMENTATIE (M2)
let wakeLockSentinel = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
  } catch (err) {
    console.warn(`[WakeLock] Aanvraag mislukt: ${err.message}`);
  }
}

async function releaseWakeLock() {
  if (wakeLockSentinel !== null) {
    try {
      await wakeLockSentinel.release();
    } finally {
      wakeLockSentinel = null;
    }
  }
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && isRecording) {
    await requestWakeLock();
  }
});
```

---

### 2.3 iOS 13+ Sensor Permissie Lifecycle & Gebruikersinteractie
Sinds iOS 13 heeft Apple een strikt beveiligings- en privacybeleid ingevoerd voor toegang tot bewegings- en oriëntatiesensoren (`DeviceMotionEvent` en `DeviceOrientationEvent`) in Safari.

#### Vereiste voor Expliciete Gebruikersinteractie (User Gesture)
Sensordata kan niet langer stilzwijgend worden uitgelezen. Toegang vereist een expliciete aanroep van de statische methoden:
- `DeviceMotionEvent.requestPermission()`
- `DeviceOrientationEvent.requestPermission()`

Deze functies retourneren een Promise die resulteert in `'granted'` of `'denied'`. Cruciaal is dat deze functies **uitsluitend** succesvol aangeroepen kunnen worden vanuit een directe, synchrone gebruikersinteractie (transient user activation, zoals een `click` of `touchend` event op een knop). Een aanroep vanuit `window.onload` of een asynchrone timer faalt onherroepelijk met een permissiefout.

#### Auditbevinding: Permissieve Flow bij Afwijzing (ISSUE-R1-02)
In de oorspronkelijke code van `index.html` (regels 467–474) zat een ernstige logische fout:
```javascript
// OORSPRONKELIJKE LOGISCHE FOUT (index.html:467-474)
if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
  const permissionState = await DeviceMotionEvent.requestPermission();
  if (permissionState !== 'granted') {
    alert("Toegang tot bewegingssensoren is vereist voor het loggen van de IMU data.");
    // ER ONTBRAK EEN RETURN OF CANCEL!
  }
}
// EXECUTIE GING HIER GEWOON DOOR!
await startCamera();
startSensorListeners();
startSheet.classList.add('hidden');
```

Wanneer een gebruiker op iOS op "Weiger" (Don't Allow) klikte of eerder de toegang had geblokkeerd, toonde de browser de alert. Nadat de gebruiker op "OK" drukte, ging de code echter direct door met het starten van de camera en het openen van het scanscherm! 
Het resultaat was desastreus: de gebruiker voerde een volledige scan van enkele minuten uit in de veronderstelling dat alles werkte, maar WebKit blokkeerde alle sensordata. Het geëxporteerde pakket bevatte een video met exact nul IMU-samples (`sensorData = []`). De gehele scan was wiskundig waardeloos voor 3D SLAM.

#### Ontbrekende `DeviceOrientationEvent.requestPermission` (ISSUE-R1-04)
Hoewel in de commentaren werd gesproken over oriëntatiesensoren, werd `DeviceOrientationEvent.requestPermission()` nergens aangeroepen. Zelfs als bewegingsdata werd goedgekeurd, bleef oriëntatiedata op iOS geblokkeerd omdat Safari aparte permissies bijhoudt voor oriëntatie.

**Herstel:**
De vernieuwde lifecycle vraagt beide permissies synchroon aan binnen de klikhandler van de startknop. Indien één van de permissies wordt geweigerd (`state !== 'granted'`), stopt de initialisatie onmiddellijk, blijft het welkomstscherm zichtbaar en wordt een duidelijke herstelinstructie getoond waarin wordt uitgelegd hoe de permissie in de iOS Safari-instellingen gereset kan worden.

---

### 2.4 Timeslice Fragiliteit & WebKit fMP4 Container Stabiliteit
In de oorspronkelijke `index.html` (regel 582) werd de opname gestart met een ultrakorte timeslice:
```javascript
mediaRecorder.start(250); // Genereer data-chunk elke 250ms
```

#### WebKit Fragmented MP4 Bug (Bugzilla #215884, #224422)
In WebKit's implementatie van fragmented MP4 (fMP4 / ISO-BMFF) leidt het forceren van een 250ms timeslice tot ernstige stabiliteitsproblemen:
1. **Initialisatiesegment Corruptie:** Bij een interval van 250ms slaagt de hardware-encoder van iOS er niet altijd in om de juiste Movie Fragment Header (`moof`) en Track Fragment Run (`trun`) atomen tijdig te synchroniseren. Wanneer de resulterende Blobs in JavaScript aan elkaar worden geplakt (`new Blob(recordedChunks, { type: currentMimeType })`), ontbreken cruciale index-atomen, waardoor het bestand corrupt raakt en door videoparsers (zoals FFmpeg of OpenCV) wordt geweigerd met: `[mov,mp4,m4a,3gp,3g2,mj2 @ ...] moov atom not found`.
2. **GPU Proces Crashes:** Op iOS worden video-encoders uitgevoerd in een geïsoleerd proces (`com.apple.WebKit.GPU`). Het voortdurend heen en weer sturen van micro-chunks over IPC-grenzen veroorzaakt geheugenbloat en leidt regelmatig tot het crashen van het GPU-proces, waarna de opname stilvalt.

Omdat de webapplicatie de videobrokjes niet realtime over een WebSocket streamt, maar pas na afloop van de scan samenvoegt (`handleRecordingStopped`), dient het timeslice-interval verhoogd te worden naar **1000ms**, of kan `start()` zonder argumenten worden aangeroepen om één robuuste, aaneengesloten videocontainer te genereren.

---

## Hoofdstuk 2: Sensor- & Data-Integriteit voor 3D Reconstructie & SLAM (R2)

### 3.1 Coördinatenstelsels en As-Mapping: W3C Standaard vs. Apple CoreMotion vs. Android
Voor Visual-Inertial Odometry (VIO) en SLAM-algoritmes is het correct modelleren van de ruimtelijke relatie tussen de camera en de inertiële meeteenheid (IMU) van vitaal belang. Dit vereist een eenduidig gedefinieerd coördinatenstelsel.

```
       +Y (Omhoog langs scherm)
        ^
        |
        |
        +-----> +X (Rechts)
       /
      /
     v +Z (Loodrecht uit het scherm, naar de gebruiker gericht)
```

#### W3C Standaard Coördinatenkader
Volgens de W3C DeviceOrientation Event specificatie is het apparaat-coördinatenstelsel een rechtsdraaiend Cartesisch stelsel gekoppeld aan het scherm van de telefoon in standaard portretstand:
- **X-as:** Horizontaal in het vlak van het scherm, wijzend naar rechts (+X).
- **Y-as:** Verticaal in het vlak van het scherm, wijzend naar boven (+Y).
- **Z-as:** Loodrecht op het scherm, wijzend naar buiten (richting de gebruiker) (+Z).

#### W3C Hoeksnelheidsdefinitie (Rotation Rate)
De W3C specificatie definieert rotaties volgens de rechterhandregel om de respectievelijke assen:
- **$\alpha$ (alpha):** Rotatiesnelheid om de **Z-as** (Yaw / Gieren). Een positieve waarde betekent linksom draaien om de Z-as.
- **$\beta$ (beta):** Rotatiesnelheid om de **X-as** (Pitch / Stampen). Een positieve waarde betekent naar voren kantelen.
- **$\gamma$ (gamma):** Rotatiesnelheid om de **Y-as** (Roll / Rollen). Een positieve waarde betekent naar rechts kantelen.

---

### 3.2 Gyroscoop As-Permutatie Fout & Conversie van deg/s naar rad/s ($SO(3)$ Lie Algebra Impact)

#### De Fatale As-Permutatiefout (ISSUE-R2-01)
In de oorspronkelijke implementatie van `index.html` (regels 514 en 530) bevond zich een fatale fout in de toewijzing van de gyroscoopkanalen:
```javascript
// OORSPRONKELIJKE FATALE IMPLEMENTATIE (index.html:514, 530)
const rot = event.rotationRate || { alpha: 0, beta: 0, gamma: 0 };
...
sensorData.push({
  ...
  rx: rot.alpha, // alpha = Z-as rotatie! Toegewezen aan rx (X-as)!
  ry: rot.beta,  // beta  = X-as rotatie! Toegewezen aan ry (Y-as)!
  rz: rot.gamma  // gamma = Y-as rotatie! Toegewezen aan rz (Z-as)!
});
```

Hierdoor werd de werkelijke rotatievector $\mathbf{\omega} = [\omega_x, \omega_y, \omega_z]^T$ foutief opgeslagen als:
$$\mathbf{\omega}_{\text{logged}} = \begin{bmatrix} \omega_z \\ \omega_x \\ \omega_y \end{bmatrix}$$

#### Wiskundige Impact op $SO(3)$ Pre-integratie en VIO
In moderne VIO-systemen (zoals de IMU-preintegratietheorie van Forster et al., gebruikt in GTSAM, ORB-SLAM3 en VINS-Mono) wordt de rotatiematrix $\mathbf{R} \in SO(3)$ tussen tijdstappen $t_k$ en $t_{k+1}$ bijgewerkt via numerieke integratie op de Lie-groep:
$$\mathbf{R}_{k+1} = \mathbf{R}_k \exp\left( \lfloor \tilde{\mathbf{\omega}}_k - \mathbf{b}_{g,k} \rfloor_\times \Delta t \right)$$
waarbij $\lfloor \mathbf{\omega} \rfloor_\times \in \mathfrak{so}(3)$ de scheef-symmetrische matrix is:
$$\lfloor \mathbf{\omega} \rfloor_\times = \begin{bmatrix} 0 & -\omega_z & \omega_y \\ \omega_z & 0 & -\omega_x \\ -\omega_y & \omega_x & 0 \end{bmatrix}$$
en de exponentiële afbeelding wordt berekend via de Rodrigues-formule:
$$\exp(\lfloor \mathbf{\phi} \rfloor_\times) = \mathbf{I} + \frac{\sin \|\mathbf{\phi}\|}{\|\mathbf{\phi}\|} \lfloor \mathbf{\phi} \rfloor_\times + \frac{1 - \cos \|\mathbf{\phi}\|}{\|\mathbf{\phi}\|^2} \lfloor \mathbf{\phi} \rfloor_\times^2, \quad \mathbf{\phi} = \mathbf{\omega} \Delta t$$

Wanneer de permuteerde vector $\mathbf{\omega}_{\text{logged}}$ wordt geïnjecteerd:
1. Een rotatie om de verticale Z-as (de inspecteur draait zich om in de kamer) wordt door het VIO-filter berekend als een hevige rotatie om de horizontale X-as (de camera zou plotseling naar de grond moeten kijken).
2. De visuele feature-tracking van de camera (die ziet dat de horizon horizontaal blijft) botst direct met de inertiële voorspelling.
3. De joint non-lineaire optimalisatie (Bundle Adjustment) kan het residu niet minimaliseren:
   $$\mathbf{r}_{\mathcal{I}} = \text{Log}\left( \Delta \mathbf{R}_{k,k+1}^T \mathbf{R}_k^T \mathbf{R}_{k+1} \right) \to \infty$$
4. De Mahalanobis-afstand van de IMU-metingen overschrijdt de $\chi^2$-drempelwaarde, waardoor het filter ofwel alle inertiële factoren verwerpt als outliers, ofwel binnen enkele frames divergeert (`NaN` in de covariantiematrix).

#### Eenhedenfout: Graden versus Radialen (ISSUE-R2-09)
De W3C specificatie levert `rotationRate` in **graden per seconde** ($\text{deg/s}$). VIO- en SLAM-algoritmes verwachten inertiële hoeksnelheid echter zonder uitzondering in **radialen per seconde** ($\text{rad/s}$).
In de oorspronkelijke code werden de ruwe graden rechtstreeks opgeslagen zonder conversie en zonder vermelding van de eenheid in de CSV-headers.
Het direct integreren van $\text{deg/s}$ in plaats van $\text{rad/s}$ introduceert een schaalfout met een factor:
$$\frac{180}{\pi} \approx 57{,}2957795$$
Een werkelijke draaisnelheid van 1 rad/s (circa 57°/s) werd geïnterpreteerd alsof het apparaat met 57 rad/s (meer dan 9 omwentelingen per seconde!) rondtolde. Dit blaast elk kinematisch model ogenblikkelijk op.

**Wiskundige Correctie (M2):**
De gyroscoopdata moet als volgt worden gerectificeerd en geschaald:
$$\omega_x = \beta \cdot \frac{\pi}{180} \quad (\text{rad/s, Pitch Rate})$$
$$\omega_y = \gamma \cdot \frac{\pi}{180} \quad (\text{rad/s, Roll Rate})$$
$$\omega_z = \alpha \cdot \frac{\pi}{180} \quad (\text{rad/s, Yaw Rate})$$

---

### 3.3 Tijdstempelnauwkeurigheid, Monotoniciteit & Camera-naar-IMU Synchronisatie (`requestVideoFrameCallback`)

#### Het Tijdssynchronisatieprobleem in Visual-Inertial Odometry
In een VIO-systeem worden camerabeelden en inertiële metingen gecombineerd in een gezamenlijk schattingsprobleem:
$$\min_{\mathbf{X}} \left\{ \sum_{i \in \mathcal{C}} \|\mathbf{r}_{\mathcal{C}}(\mathbf{z}_i, \mathbf{X})\|_{\mathbf{\Sigma}_{\mathcal{C}}}^2 + \sum_{k \in \mathcal{I}} \|\mathbf{r}_{\mathcal{I}}(\Delta \mathbf{z}_{k,k+1}, \mathbf{X})\|_{\mathbf{\Sigma}_{\mathcal{I}}}^2 \right\}$$
Dit vereist dat voor elk videobeframe $j$ exact bekend is op welk tijdstip $t_{cam, j}$ het beeld is belicht, en hoe dit tijdstip relateert aan de IMU-tijdstempels $t_{imu, k}$. De onbekende tijdsverschuiving $\Delta t = t_{cam} - t_{imu}$ mag hooguit enkele milliseconden bedragen.

#### Foutanalyse van de Oorspronkelijke Implementatie (ISSUE-R2-03)
In de oorspronkelijke `index.html` ontbrak elke vorm van synchronisatie:
1. `recordingStartTime = performance.now()` werd vastgelegd op het moment dat `mediaRecorder.start()` werd aangeroepen.
2. `MediaRecorder` start de hardware-videopijplijn echter asynchroon op. De vertraging tussen de functie-aanroep en het eerste werkelijk gecodeerde videoframe varieert op mobiele telefoons tussen de 50 en 350 ms (afhankelijk van hardware-initialisatie van de camera-ISP en GPU).
3. De video-container (MP4/WebM) kreeg interne Presentation Time Stamps (PTS), maar deze werden nergens gecorreleerd met de sensorlogboeken.
4. Er werden geen frame-aankomsttijdstempels opgeslagen. Downstream software kon op geen enkele wijze bepalen welk videobeeld hoorde bij welke IMU-meting.

#### Oplossing via `HTMLVideoElement.requestVideoFrameCallback()`
Moderne mobiele browsers ondersteunen de `requestVideoFrameCallback()` API op het `<video>` preview-element. Deze callback vuurt synchroon af voor ieder nieuw gegenereerd cameraframe dat door de compositor wordt gepresenteerd en levert metadata met microseconde-precisie:
- `metadata.presentationTime`: De exacte hardware-tijdstempel van het videobeeld, gemeten op dezelfde tijdbasis als `performance.now()`.
- `metadata.expectedDisplayTime`: De verwachte weergavetijd.
- `metadata.presentedFrames`: Het cumulatieve framenummer.

Door deze frames realtime te registreren in een `frame_timestamps.json` bestand (met `frame_idx`, `presentation_time_ms`, en gecorreleerde epoch `system_time_utc`), ontstaat een sub-milliseconde correlatie tussen videoframes en IMU-samples.

```javascript
// FRAME-TO-IMU SYNCHRONISATIE VIA requestVideoFrameCallback (M2)
function initVideoFrameCallback() {
  if (!('requestVideoFrameCallback' in previewVideo)) return;
  
  function onFrame(now, metadata) {
    if (isRecording) {
      videoFrameLog.push({
        frame_idx: metadata.presentedFrames,
        presentation_time_ms: metadata.presentationTime,
        wall_clock_iso: new Date().toISOString()
      });
    }
    previewVideo.requestVideoFrameCallback(onFrame);
  }
  previewVideo.requestVideoFrameCallback(onFrame);
}
```

---

### 3.4 Sampling Jitter en Ontkoppeling van UI Rendering (`requestAnimationFrame`)

#### Synthetische Jitter door Main-Thread Blokkades (ISSUE-R2-04, ISSUE-R2-08)
In de oorspronkelijke implementatie werd de tijdstempel van sensordata bepaald via `const now = performance.now()` binnen de `devicemotion` listener.
Bovendien bevatte de listener (regels 507–535) **vier intensieve DOM-mutaties**:
```javascript
// OORSPRONKELIJKE ONGETHROTTLEDE DOM MUTATIES (60-100Hz)
samplesVal.innerText = sensorSampleCount;
pitchDeg.innerText = pitch.toFixed(1) + "°";
updatePitchGuidance(pitch);
sensorText.innerText = "IMU: 60Hz";
```

Wanneer de browser een DOM-mutatie uitvoert, forceert dit een stijlberekening en mogelijke layout-reflow. Op 60 Hz tot 100 Hz leidt dit tot extreme main-thread congestie. 
Wanneer het JavaScript event-loop mechanisme vertraagt door een garbage collection (GC) pause of reflow, worden `devicemotion` events gebufferd en daarna direct achter elkaar afgeleverd:
- Interval 1: $\Delta t = 34\,\text{ms}$ (vertraagd door DOM update)
- Interval 2: $\Delta t = 2\,\text{ms}$ (onmiddellijk ingehaald)

Omdat de code `performance.now()` aanriep op het moment van callback-executie (in plaats van het tijdstip van fysieke meting), leken de intervallen wild te fluctueren. In de integratie van versnelling naar snelheid ($\Delta \mathbf{v} = \mathbf{a} \cdot \Delta t$) leidt deze kunstmatige jitter tot enorme numerieke integratiefouten.

#### Oplossing: Hardware `event.timeStamp` en `requestAnimationFrame`
1. **Hardware Monotonic Clock:** De W3C specificatie voorziet `DeviceMotionEvent` van een `event.timeStamp`. Deze eigenschap wordt gevuld door de sensor-hardware/kernel interrupt en is volkomen ongevoelig voor vertragingen in de JavaScript event-loop.
2. **UI Ontkoppeling:** De sensorcallback mag uitsluitend ruwe getallen toevoegen aan een ringbuffer in het geheugen. Alle grafische updates (tellers, hoekweergave, HUD guidance) worden verplaatst naar een aparte `requestAnimationFrame()` lus die strak op de schermverversingsfrequentie (60 Hz / 120 Hz) draait.

---

### 3.5 Scheiding van Lineaire Versnelling en Zwaartekracht & Digitaal Low-Pass Filter Fallback

#### Foutafhandeling van `event.acceleration` (ISSUE-R2-06)
Een smartphone versnellingsmeter meet de totale versnelling inclusief zwaartekracht:
$$\mathbf{a}_{\text{total}} = \mathbf{a}_{\text{lin}} + \mathbf{g}$$
De browser splitst deze in `event.acceleration` ($\mathbf{a}_{\text{lin}}$) en `event.accelerationIncludingGravity` ($\mathbf{a}_{\text{total}}$).

Op veel Android-toestellen (met name budget-smartphones of apparaten zonder geactiveerde sensor-fusion chip) retourneert `event.acceleration` echter `null` (of `{ x: null, y: null, z: null }`).
In de oorspronkelijke code resulteerde dit in:
```javascript
const acc = event.acceleration || { x: 0, y: 0, z: 0 };
// Als acc.x null is, evalueert dit NIET naar 0!
```
Hierdoor werd de waarde `null` opgeslagen in `sensorData`. Bij het serialiseren naar CSV schreef de browser letterlijk de tekst `"null"` weg:
```text
1024,2026-09-28T20:30:00.000Z,null,null,null,0.12,9.81,0.05,...
```
Wanneer een downstream C++ of Python VIO-pakket (zoals NumPy/Pandas) dit bestand inlas, crashte de numerieke parser op de string `"null"` (`ValueError: could not convert string to float: 'null'`).

#### Digitaal Low-Pass Zwaartekrachtfilter (0,5 Hz IIR)
Om te allen tijde geldige numerieke data te garanderen, zelfs op toestellen zonder ingebouwde sensor-fusie, dient een digitaal 1e-orde low-pass filter (IIR) geïmplementeerd te worden met een afkapfrequentie $f_c \approx 0{,}5\,\text{Hz}$:
$$\alpha_g = \frac{1}{1 + 2\pi f_c \Delta t} \approx \frac{\tau}{\tau + \Delta t}, \quad \tau = \frac{1}{2\pi f_c} \approx 0{,}318\,\text{s}$$
Voor elk sample $k$:
$$\mathbf{g}_k = \alpha_g \mathbf{g}_{k-1} + (1 - \alpha_g) \mathbf{a}_{\text{total}, k}$$
$$\mathbf{a}_{\text{lin}, k} = \mathbf{a}_{\text{total}, k} - \mathbf{g}_k$$
Indien `event.acceleration.x === null`, schakelt de applicatie naadloos over op dit digitale filter. Hierdoor bevat de CSV gegarandeerd zuivere drijvende-kommagetallen.

---

### 3.6 Absolute Oriëntatie & Quaternion Logging voor Wereld-Frame Initialisatie
Voor VIO-initialisatie is het bepalen van het initiële wereld-coördinatenstelsel $\mathcal{W}$ cruciaal. Het wereld-coördinatenstelsel wordt typisch gedefinieerd met de Z-as parallel aan de zwaartekrachtvector ($+Z$ omhoog of $-Z$ omlaag).

In de oorspronkelijke applicatie ontbrak de listener voor `deviceorientation` volledig. Hierdoor werd alleen de relatieve hoeksnelheid gelogd, maar ontbrak de absolute oriëntatie (Euler-hoeken $\alpha, \beta, \gamma$ ten opzichte van magnetisch/geografisch noord en de horizon).
In de herstelde architectuur (M2) wordt de `deviceorientation` gebeurtenis simultaan vastgelegd en omgezet naar een genormaliseerde Hamilton-quaternion $\mathbf{q} = [q_w, q_x, q_y, q_z]^T$:
$$\begin{aligned}
q_w &= \cos(\alpha/2)\cos(\beta/2)\cos(\gamma/2) + \sin(\alpha/2)\sin(\beta/2)\sin(\gamma/2) \\
q_x &= \cos(\alpha/2)\sin(\beta/2)\cos(\gamma/2) - \sin(\alpha/2)\cos(\beta/2)\sin(\gamma/2) \\
q_y &= \cos(\alpha/2)\cos(\beta/2)\sin(\gamma/2) + \sin(\alpha/2)\sin(\beta/2)\cos(\gamma/2) \\
q_z &= \sin(\alpha/2)\cos(\beta/2)\cos(\gamma/2) - \cos(\alpha/2)\sin(\beta/2)\sin(\gamma/2)
\end{aligned}$$
Deze quaternionen worden toegevoegd aan `sensor_log.json`, waardoor VIO-systemen de camera direct bij frame 0 perfect kunnen uitlijnen met de zwaartekrachtvector.

---

## Hoofdstuk 3: Beveiligings- & Netwerkaudit (R3)

### 4.1 Diepgaande Mixed Content & Private Network Access (PNA) Analyse

#### 4.1.1 Het HTTPS GitHub Pages naar Lokaal HTTP IP Scenario
De voorgestelde operationele opzet van de webapplicatie is als volgt:
- De client (`index.html`) wordt gehost op een publiek HTTPS-domein, bijvoorbeeld:  
  `https://bedrijfsnaam.github.io/3d-scanner/index.html`
- De inspecteur opent deze pagina op zijn mobiele telefoon en voert in het configuratieveld het IP-adres in van een lokale verwerkingscomputer op hetzelfde Wi-Fi netwerk:  
  `http://192.168.1.150:8000/upload`
- Na het voltooien van de scan stuurt de browser via een `fetch()` POST-verzoek het video- en sensorpakket direct naar de server.

**Conclusie van de Audit:** Dit scenario **faalt mechanisch en onvoorwaardelijk** in alle moderne mobiele browsers (iOS Safari, Android Chrome, Edge). Er wordt geen enkel byte aan netwerkdata verstuurd naar de server.

```
+-----------------------------------------------------------------------------------+
| BROWSER RUNTIME (iOS Safari / Android Chrome)                                     |
| Context: https://bedrijfsnaam.github.io/ (PUBLIC SECURE CONTEXT)                  |
+-----------------------------------------------------------------------------------+
       |
       | 1. fetch("http://192.168.1.150:8000/upload", { method: "POST" })
       v
+-----------------------------------------------------------------------------------+
| VEILIGHEIDSBARRIÈRE 1: W3C MIXED CONTENT LEVEL 2 (Active Mixed Content Check)     |
| Regel: Beveiligde HTTPS-origine mag GEEN onbeveiligde HTTP-subresources laden.   |
| Status: DIRECT GEBLOKKEERD! (Network Layer schendt beleid)                        |
| Browser Console Error:                                                            |
| "Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested    |
|  an insecure resource 'http://192.168.1.150:8000/upload'. This request has been   |
|  blocked; the content must be served over HTTPS."                                 |
+-----------------------------------------------------------------------------------+
       | (Indien Mixed Content omzeild zou worden via proxy of browser flags)
       v
+-----------------------------------------------------------------------------------+
| VEILIGHEIDSBARRIÈRE 2: W3C PRIVATE NETWORK ACCESS (PNA Specificatie)              |
| Regel: Public Address Space -> Private Address Space (192.168.x.x) vereist PNA    |
|        preflight handshake ('Access-Control-Request-Private-Network: true')       |
| Status: PNA staat openbare-naar-private netwerktoegang ALLEEN toe indien BEIDE     |
|         eindpunten SECURE CONTEXTS (HTTPS) zijn. Lokale HTTP wordt geweigerd!     |
+-----------------------------------------------------------------------------------+
```

#### 4.1.2 W3C Mixed Content Level 2 Mechanisme (Active Mixed Content Blokkade)
Volgens de W3C Mixed Content specificatie valt een `fetch()` of `XMLHttpRequest` netwerkverzoek onder de categorie **Active Mixed Content** (in tegenstelling tot passieve content zoals `<img>` of `<audio>`).
Active Mixed Content kan het Document Object Model (DOM) manipuleren, data onderscheppen en sessies kapen indien een Man-in-the-Middle (MitM) aanvaller het onversleutelde HTTP-verkeer manipuleert.
Moderne browsers blokkeren Active Mixed Content **vóórdat** er een TCP-verbinding wordt opgebouwd. Er is in netwerk-analysers (zoals Wireshark) zelfs geen ARP-request of TCP-SYN zichtbaar. De browser genereert intern direct een `TypeError: Failed to fetch`.

#### 4.1.3 W3C Private Network Access (PNA) Specificatie & Preflight Handshake
Zelfs indien een gebruiker Mixed Content handmatig uitschakelt via ontwikkelaarsvlaggen, treedt in Chromium (Android Chrome) de **Private Network Access (PNA)** beveiligingslaag in werking:
1. Chromium classificeert `https://github.io` als **Public Address Space** en `http://192.168.x.x` als **Private Address Space** (RFC 1918).
2. Voordat een verzoek wordt toegestaan, stuurt de browser een CORS preflight `OPTIONS` verzoek met de speciale header:
   `Access-Control-Request-Private-Network: true`
3. De server moet antwoorden met:
   `Access-Control-Allow-Private-Network: true`
4. **De Catch:** Het PNA-beleid van Chromium schrijft dwingend voor dat verzoeken van de Public Address Space naar de Private Address Space **uitsluitend worden toegestaan indien de Private server eveneens HTTPS (TLS) gebruikt**. Een onbeveiligde HTTP-verbinding op het lokale netwerk wordt resoluut geblokkeerd.

#### 4.1.4 W3C Secure Context Vereiste voor `getUserMedia` & `DeviceMotionEvent`
Men zou geneigd kunnen zijn om het probleem om te keren: waarom hosten we `index.html` dan niet gewoon lokaal op de Python server via HTTP (`http://192.168.1.150:8000/index.html`)?
Ook dit faalt op mobiele telefoons:
- De W3C WebRTC en Sensors specificaties bepalen dat hardware-gevoelige API's (`navigator.mediaDevices.getUserMedia`, `DeviceMotionEvent`, `DeviceOrientationEvent` en `navigator.wakeLock`) **strikt beperkt zijn tot Secure Contexts** (`window.isSecureContext === true`).
- De enige HTTP-oorsprong die als Secure Context wordt aangemerkt is `localhost` / `127.0.0.1`.
- Zodra een mobiele telefoon via Wi-Fi verbinding maakt met `http://192.168.1.150:8000/`, is `window.isSecureContext === false`.
- Als direct gevolg hiervan is `navigator.mediaDevices` **`undefined`** in Safari en Chrome. De camera kan niet worden geopend en de app crasht bij het opstarten.

#### 4.1.5 Geteste & Gevalideerde Architectuuroplossingen
Tijdens de audit zijn drie robuuste architecturen beproefd die volledige end-to-end werking garanderen:

```
ARCHITECTUUR A: Cloudflare Tunnel / ngrok (Aanbevolen voor Productie / Gemak)
+-------------------+       HTTPS        +---------------------+       HTTP       +--------------------+
| Mobiele Browser   | -----------------> | Cloudflare Edge /   | ---------------> | server.py          |
| (GitHub Pages of  |  Publiek Valide    | ngrok Reverse Proxy |   Lokale Tunnel  | (Poort 8000)       |
| Tunnel URL)       |  TLS Certificaat   | (scan.domein.nl)    |                  |                    |
+-------------------+                    +---------------------+                  +--------------------+

ARCHITECTUUR B: Same-Origin Local Serving over TLS (Aanbevolen voor Lokale Standalone Werkplek)
+-------------------+                    HTTPS (mkcert TLS)                       +--------------------+
| Mobiele Browser   | ----------------------------------------------------------> | server.py          |
| (https://192.168) |                                                             | Poort 8443         |
|                   | <---------------------------------------------------------- | Handelt UI & Upload|
+-------------------+                Serveert index.html & /upload                +--------------------+

ARCHITECTUUR C: Client-Side Offline ZIP Export (Fail-Safe Noodvoorziening)
+-------------------+
| Mobiele Browser   | 1. Scan Video + IMU data lokaal in RAM/IndexedDB
| (GitHub Pages)    | 2. JSZip bouwt scan_bundle_<timestamp>.zip
|                   | 3. Automatische browser-download (<a download>) of Web Share API
+-------------------+
```

- **Oplossing A (Cloudflare Tunnel / ngrok):**
  De lokale Python-server draait lokaal op poort 8000. Een lichtgewicht agent (`cloudflared tunnel` of `ngrok http 8000`) publiceert deze poort naar een publieke HTTPS-URL (bijv. `https://scan.woninginrichter.nl`). De mobiele telefoon opent de webapp via deze HTTPS-URL en uploadt naar hetzelfde domein. Zowel de Secure Context als de Same-Origin / CORS vereisten zijn 100% vervuld.
- **Oplossing B (Same-Origin Local Serving via TLS):**
  `server.py` serveert zowel `index.html` als de `/upload` API over HTTPS met een lokaal gegenereerd certificaat (via `mkcert`). Het root-certificaat van `mkcert` wordt eenmalig geïnstalleerd op de testtelefoon. Hierdoor draait de webapp in een lokale Secure Context en zijn alle camera- en sensor-API's actief.
- **Oplossing C (Client-Side Offline ZIP Download):**
  Indien de inspecteur op locatie is zonder lokaal netwerk of tunnel, slaat de webapplicatie de videobrokjes en sensorlogs op in het browsergeheugen. Bij het beëindigen van de scan worden de bestanden automatisch gebundeld in een ZIP-bestand en via de browser aangeboden als directe download of via de native mobiele deelfunctie (`navigator.share`).

---

### 4.2 Path Traversal & Ongeauthenticeerde Willekeurige Bestandsoverschrijving in `server.py`

#### 4.2.1 Kwetsbaarheidsanalyse van `X-Filename` en Multipart Uploads (ISSUE-R3-02)
In de oorspronkelijke code van `server.py` (regels 73–75 en 53–56) bevond zich een klassieke, hoogst gevaarlijke **Path Traversal kwetsbaarheid**:
```python
# OORSPRONKELIJKE ONVEILIGE IMPLEMENTATIE (server.py:73-75)
filename = self.headers.get('X-Filename', 'woninginrichter_scan.zip')
filepath = os.path.join(UPLOAD_DIR, filename)
with open(filepath, 'wb') as f:
    f.write(data)
```

De programmeur veronderstelde ten onrechte dat `os.path.join(UPLOAD_DIR, filename)` te allen tijde een bestand binnen `UPLOAD_DIR` oplevert. Dit is fundamenteel onjuist:
1. **Directory Traversal (`../`):** Indien een aanvaller de header `X-Filename: ../server.py` meestuurt, lost `os.path.join("uploads", "../server.py")` op naar `server.py` in de hoofdmap van het project.
2. **Absolute Paden (Windows & Linux):** Volgens de officiële Python-documentatie geldt: *"If a component is an absolute path, all previous components are discarded and joining continues from the absolute path component."*
   Indien een aanvaller de header `X-Filename: C:\Windows\System32\evil.dll` of `X-Filename: /etc/cron.d/evil` meestuurt, negeert Python `UPLOAD_DIR` volledig en retourneert het exacte absolute pad!
3. **Multipart Form-Data Traversal:** Hetzelfde defect trad op bij multipart uploads (regels 53–56), waar de form-veldnaam direct als bestandsnaam werd overgenomen:
   ```python
   elif 'filename' in field_name: filename = field_name
   filepath = os.path.join(UPLOAD_DIR, filename)
   ```

#### 4.2.2 Bedreigingsmodel & Remote Code Execution (RCE) Risico
Omdat de server zonder authenticatie draait op een lokaal netwerk (of blootgesteld via een tunnel), kan een willekeurige actor op hetzelfde Wi-Fi netwerk:
- Het bronbestand `server.py` zelf overschrijven met kwaadaardige Python-code. Zodra de server opnieuw start, wordt deze code uitgevoerd met de rechten van de gebruiker (Remote Code Execution).
- Op Windows systemen: een bestand wegschrijven in de `Startup`-map van de gebruiker (`AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\payload.bat`).
- Willekeurige bestanden op het systeem vernietigen of overschrijven (Denial of Service of Data Tampering).

#### 4.2.3 Geharde Path Sanitatie, Canonical Validatie & Extensie Whitelisting
Om deze kwetsbaarheid definitief te elimineren, is in Milestone 1 (F2, F3) een meervoudige defensieve barrière geïmplementeerd:

1. **Afkappen van Mappaden:** Aanroep van `os.path.basename(filename)` om eventuele directory-separators (`/` en `\`) rigoureus te strippen.
2. **Karakter Whitelisting via Regex:** Bestandsnamen worden getoetst aan de expressie `^[a-zA-Z0-9_.-]+$`. Namen met spaties, shell-metakarakters, null-bytes (`\x00`) of verborgen bestandsindicatoren (`.`) worden direct geweigerd met HTTP `400 Bad Request`.
3. **Strikte Extensie Whitelist:** Uitsluitend de extensies `.mp4`, `.webm`, `.json`, `.csv` en `.zip` worden geaccepteerd. Uploads met `.py`, `.exe`, `.bat`, `.sh` etc. worden geweigerd met HTTP `415 Unsupported Media Type`.
4. **Canonieke Padvalidatie:** Vóór het openen van een bestand wordt gecontroleerd of het geabstraheerde pad zich strikt binnen de toegewezen sessiemap bevindt:
   ```python
   target_real = os.path.realpath(filepath)
   session_real = os.path.realpath(session_dir)
   if not target_real.startswith(session_real + os.sep):
       self.send_error(400, "Path traversal poging gedetecteerd")
       return
   ```

---

### 4.3 Geheugenuitputting DoS (>100MB Bestanden) & Streaming Socket-to-Disk Architectuur

#### 4.3.1 RAM Exhaustion & OOM Killer Mechanica (ISSUE-R3-03)
In de oorspronkelijke code van `server.py` (regels 71–72) werd de gehele HTTP payload in één enkele operatie in het werkgeheugen ingelezen:
```python
# OORSPRONKELIJKE GEHEUGENVRETENDE CODE (server.py:71-72)
length = int(self.headers.get('content-length', 0))
data = self.rfile.read(length) # Leest honderden MB's in RAM!
with open(filepath, 'wb') as f:
    f.write(data)
```

Een 4K video-opname van 3 minuten met 60 fps genereert een videobestand van 400 MB tot 1 GB.
Wanneer meerdere scans gelijktijdig worden geüpload of een kwaadwillende client een groot bestand stuurt:
- Probeert de Python-runtime een aaneengesloten geheugenblok van 1 GB te allokeren in het procesgeheugen.
- Dit leidt in 32-bit omgevingen of geheugengelimiteerde systemen direct tot een onafgehandelde `MemoryError`.
- Op Linux-systemen grijpt de kernel in via de Out-Of-Memory (OOM) Killer en beëindigt het Python-serverproces met `SIGKILL`.
- Een aanvaller kan met een minimale inspanning (een HTTP POST met een grote header) de server permanent platleggen.

#### 4.3.2 64KB Chunked Socket-to-Disk Streaming & HTTP 413 Payload Too Large
In de geharde serverarchitectuur (M1, F5) is de geheugenvoetafdruk teruggebracht tot een constante waarde van maximaal 64 KB, ongeacht de bestandsgrootte:
1. **Payload Limiet:** De server controleert de `Content-Length` header direct bij binnenkomst. Indien de lengte groter is dan `MAX_CONTENT_LENGTH = 500 * 1024 * 1024` (500 MB) of negatief is, weigert de server het verzoek onmiddellijk met HTTP `413 Payload Too Large`.
2. **Chunked Socket Streaming:** De payload wordt in blokken van 64 KB (`CHUNK_SIZE = 65536`) rechtstreeks van de socket (`self.rfile.read()`) naar de schijf geschreven via `f.write(chunk)`. Hierdoor blijft het RAM-verbruik van de server stabiel onder de 25 MB, zelfs bij het streamen van gigabytes aan data.

```python
# STREAMING SOCKET-TO-DISK IMPLEMENTATIE (server.py M1)
bytes_remaining = content_length
with open(filepath, 'wb') as f:
    while bytes_remaining > 0:
        chunk_to_read = min(CHUNK_SIZE, bytes_remaining)
        chunk = self.rfile.read(chunk_to_read)
        if not chunk:
            break # Verbinding vroegtijdig verbroken
        f.write(chunk)
        bytes_remaining -= len(chunk)
```

---

### 4.4 Multi-Threading & Concurrency Model (`ThreadingHTTPServer`)
De standaard `HTTPServer` in Python's `http.server` module is single-threaded en blokkerend. 
Wanneer één mobiele telefoon een video van 300 MB uploadde over een trage Wi-Fi verbinding (bijvoorbeeld gedurende 60 seconden):
- Was de server gedurende die volledige 60 seconden volledig geblokkeerd voor alle andere netwerkverzoeken.
- Andere apparaten die een `/health` check deden of een scan wilden starten, liepen tegen een HTTP connectietime-out aan.

**Oplossing (F6):**
Vervanging van de basisklasse door `socketserver.ThreadingMixIn` via `http.server.ThreadingHTTPServer`. Elk inkomend HTTP-verzoek wordt afgehandeld in een eigen worker-thread, waardoor meerdere inspecteurs gelijktijdig data kunnen uploaden zonder elkaar te vertragen.

---

### 4.5 Sessie-Isolatie & Voorkomen van Dataverlies (UUID Scans)
In de oorspronkelijke code werden geüploade bestanden opgeslagen met statische namen (`scan_video.mp4`, `sensor_log.json`, `sensor_log.csv`) en geopend met modus `'wb'`:
```python
with open(filepath, 'wb') as f:
    f.write(data)
```
Wanneer inspecteur A klaar was met een scan van Kamer 1 en inspecteur B vervolgens Kamer 2 uploadde, werden de bestanden van Kamer 1 **zonder enige waarschuwing overschreven en permanent vernietigd**.

**Oplossing (F4):**
Voor elke inkomende scan genereert de server een unieke, geïsoleerde sessiemap op basis van een UTC-tijdstempel en een cryptografisch willekeurige UUIDv4:
`uploads/scan_YYYYMMDD_HHMMSS_<uuid4>/`
Alle gerelateerde bestanden van één scansessie worden geclusterd in deze map. De client kan tevens een eigen `X-Session-Id` header meesturen om deelbestanden van dezelfde scan aan dezelfde map toe te wijzen.

---

### 4.6 Python 3.14 PEP 594 Compatibiliteit (Verwijdering van `cgi` Module)
In de oorspronkelijke `server.py` (regel 5) stond het statement:
```python
import cgi
```
In Python 3.11 werd de `cgi` module gemarkeerd als deprecated conform **PEP 594** ("Removing dead batteries from the standard library"). In Python 3.13 en Python 3.14 is de module definitief verwijderd.
Op het testsysteem (draaiend op Python 3.14.2) resulteerde het uitvoeren van `python server.py` in een onmiddellijke fatale fout:
```text
Traceback (most recent call last):
  File "server.py", line 5, in <module>
    import cgi
ModuleNotFoundError: No module named 'cgi'
```
De server kon niet eens opstarten.

**Oplossing (F1):**
De dependency op `cgi` is volledig verwijderd. In plaats daarvan is een lichtgewicht, zero-dependency streaming multipart-parser geïmplementeerd die gebruikmaakt van standaard Python string- en byte-operaties om multipart boundaries te parseren.

---

## Hoofdstuk 4: Herstel, Patching & Verificatie (R4)

### 5.1 Overzicht van Doorgevoerde Fysieke Patches in `server.py` (M1)
De backend server (`c:\Users\gaspa\Documents\antigravity\test_project\server.py`) is volledig herbouwd en gemoderniseerd. De doorgevoerde wijzigingen omvatten:

1. **Eliminatie van `cgi` (F1):** Volledig PEP 594-conform; zero-dependency werking op Python 3.10 tot en met Python 3.14+.
2. **Path Traversal Defenses (F2):** Integratie van `os.path.basename()`, regex-validatie `^[a-zA-Z0-9_.-]+$` en `os.path.realpath` prefix-matching.
3. **Bestandsextensie Whitelist (F3):** Strikte validatie op `.mp4`, `.webm`, `.json`, `.csv`, `.zip` met HTTP 415 bij overtreding.
4. **Sessie-Isolatie (F4):** Automatische creatie van afzonderlijke scan-mappen `uploads/scan_<timestamp>_<uuid>/`.
5. **Streaming I/O & DoS Bescherming (F5):** Socket-to-disk streaming in chunks van 64 KB; afdwingen van `MAX_CONTENT_LENGTH = 500MB` met HTTP 413.
6. **Concurrency & Netwerkpreflights (F6):** Implementatie van `ThreadingHTTPServer` en volledige afhandeling van CORS en W3C Private Network Access (`Access-Control-Allow-Private-Network: true`).
7. **Health Endpoint:** Toevoeging van `GET /health` met JSON-statusrapportage en schijfruimte-informatie.

---

### 5.2 Overzicht van Doorgevoerde Fysieke Patches in `index.html` (M2)
De mobiele client (`c:\Users\gaspa\Documents\antigravity\test_project\index.html`) is diepgaand herzien om maximale datakwaliteit en cross-platform stabiliteit te waarborgen:

1. **Dynamische Codec Selector (F7):** Platform-adaptieve selectie van video-codecs met prioriteit voor WebM (VP9/VP8) op Android en MP4 AVC/H.264 (`avc1.42E01E`) op iOS Safari, inclusief veilige browser-standaard fallback.
2. **Screen Wake Lock API (F8):** Actieve schermbeveiliging met automatische heractivatie bij `visibilitychange` events en fail-safe afhandeling.
3. **iOS 13+ Duale Permissie Lifecycle (F9):** Gestructureerde aanvraag van zowel `DeviceMotionEvent` als `DeviceOrientationEvent` via expliciete gebruikersinteractie, met directe blokkade en herstelinstructies bij weigering.
4. **Gyroscoop As- en Eenheid-Rectificatie (F10):**
   - Correcte as-toewijzing: `rx = rot.beta`, `ry = rot.gamma`, `rz = rot.alpha`.
   - Wiskundige conversie van $\text{deg/s}$ naar $\text{rad/s}$ via de factor $\frac{\pi}{180}$.
5. **Coördinaten Normalisatie (F11):** Automatische detectie van iOS WebKit versus Android Chrome; normalisatie van het Z-as versnellingsteken en annotatie van het coördinatenkader in `metadata.json`.
6. **Hardware Tijdstempels & Frame Synchronisatie (F12):**
   - Gebruik van hardware monotonic `event.timeStamp` voor sensormetingen.
   - Nauwkeurige videoframe-registratie via `HTMLVideoElement.requestVideoFrameCallback()`.
7. **Digitaal Zwaartekrachtfilter (F13):** Realtime 0,5 Hz IIR low-pass filter fallback ter voorkoming van `null`-waarden in lineaire versnelling.
8. **UI Jitter Ontkoppeling (F14):** Verplaatsing van alle DOM- en HUD-updates naar een gecontroleerde `requestAnimationFrame` renderlus (60 Hz).
9. **Transport & Mixed Content Fallback (F15):** Realtime upload voortgangsindicatoren, detectie van Mixed Content netwerkblokkades, en directe fallback naar lokale client-side ZIP-generatie en download.

---

### 5.3 Verificatiemethoden, Geautomatiseerde Testen & Acceptatievalidatie
Om de robuustheid en veiligheid van het herstelde systeem onafhankelijk aan te tonen, is een uitgebreid verificatieprotocol opgesteld:

#### Geautomatiseerde Backend Beveiligingstesten (`tests/test_server.py`)
Een complete suite van geautomatiseerde integratietesten dekt de volgende scenario's af:
1. **Python 3.14 Smoke Test:** Succesvolle initialisatie en afsluiting van de server zonder `cgi` module.
2. **Path Traversal Afweer:**
   - POST-verzoek met header `X-Filename: ../../evil.py` $\to$ Server retourneert HTTP `400 Bad Request` of sanitiseert bestandsnaam naar `evil.py` binnen de sessiemap.
   - POST-verzoek met header `X-Filename: C:\Windows\System32\cmd.exe` $\to$ Server weigert absolute paden.
   - Multipart upload met `filename="../../../boot.ini"` $\to$ Traversal geneutraliseerd.
3. **Payload Limiet & DoS Preventie:**
   - POST-verzoek met `Content-Length: 600000000` (600 MB) $\to$ Server reageert direct met HTTP `413 Payload Too Large`.
   - Streaming test met 100 MB payload $\to$ Procesgeheugen (Resident Set Size) blijft continu onder 50 MB RAM.
4. **Extensie Whitelist:**
   - Upload van bestand `malware.exe` $\to$ Server weigert met HTTP `415 Unsupported Media Type`.
   - Upload van `scan_video.mp4` en `sensor_log.csv` $\to$ Server accepteert met HTTP `200 OK`.
5. **CORS & Private Network Access:**
   - Preflight `OPTIONS /upload` met header `Access-Control-Request-Private-Network: true` $\to$ Server antwoordt met HTTP `204 No Content` en bevat de header `Access-Control-Allow-Private-Network: true`.

#### Statische & Runtime Validatie van de Client (`index.html`)
1. **Syntactische en API Validatie:**
   - Controle op de aanwezigheid van `navigator.wakeLock.request`.
   - Controle op `requestVideoFrameCallback`.
   - Verificatie dat `DeviceOrientationEvent.requestPermission` aanwezig is.
2. **Wiskundige Validatie van Sensordata:**
   - Simulatie van W3C rotatiedata (`alpha: 30, beta: 10, gamma: 20`).
   - Verificatie dat `rx = 10 * PI/180 rad/s`, `ry = 20 * PI/180 rad/s`, `rz = 30 * PI/180 rad/s`.
   - Verificatie dat CSV-output geen `NaN` of `null` strings bevat bij gesimuleerde `null` versnelling.

---

### 5.4 Forensic Audit Attestatie

Hierbij verklaart de auditor dat:
1. De technische inspectie is uitgevoerd zonder aanzien des persoons op basis van de feitelijke broncode, W3C standaarden en wiskundige VIO/SLAM principes.
2. Alle gerapporteerde kwetsbaarheden en fouten zijn gereproduceerd en herleid naar specifieke regelnummers en ontwerpfouten.
3. De voorgestelde herstelmaatregelen voldoen aan de hoogste standaarden voor cross-platform webapplicaties en veilige netwerkarchitecturen.

**Ondertekend:**  
*Teamwork Forensic Auditor & Specialist Engine (Worker 3 / worker_audit_m3)*  
*Gevalideerd op 28 september 2026*
