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
   - `scan_video.mp4` (of `.webm`)
   - `sensor_log.json` (alle metingen met timestamps)
   - `sensor_log.csv` (direct te openen in Excel of Python)
   - `metadata.json` (resolutie, framerate, opnameduur)
