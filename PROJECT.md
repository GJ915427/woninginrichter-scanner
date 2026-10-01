# Project: Woninginrichter 3D Scanner — Capacitor Native Shell & Cloud Build Pipeline

## Architecture
- **Web Application Layer**: `scanner.html`, HUD overlay, DOM sensors, WebGL/Three.js integration. Operates 100% backward-compatible in standard browsers via WebRTC `getUserMedia`.
- **Bridge Layer**: Safe runtime environment detection (`window.Capacitor?.isNativePlatform() && window.Capacitor?.Plugins?.UltraWideCamera`). Provides transparent underlay styling (`native-camera-underlay-active`) and bridges JS calls to native methods.
- **Capacitor Android Shell**: Capacitor 6.x container (`com.woninginrichter.scanner`), Gradle wrapper 8.2+, Android SDK 34, AndroidManifest with high-frequency IMU and camera permissions.
- **Native Android Plugin (`UltraWideCameraPlugin.kt`)**: Direct Camera2 API engine, physical ultra-wide lens selection (focal length < 2.5mm), 0.5x zoom ratio (`CONTROL_ZOOM_RATIO = 0.5f`), AE/AF lockout, hardware PTS 100Hz IMU telemetry (`SENSOR_DELAY_FASTEST`), MediaRecorder surface.
- **Cloud CI/CD Engine**: GitHub Actions workflow (`.github/workflows/build-apk.yml`) on `ubuntu-latest` with JDK 17 and Android SDK 34 compiling `app-debug.apk`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Capacitor Project Scaffolding | `package.json` with `@capacitor/core`, `@capacitor/android`, `@capacitor/cli`, and `capacitor.config.json` | M1 | Blueprint §3 |
| 2 | Web Asset Isolation & Sync | Script `scripts/sync_web_assets.js` and target `www/` (`index.html`, `scanner.html`, assets) | M1 | Survey Web & Android |
| 3 | Dual-Target Web/Native Compatibility | Standalone browser mode runs unchanged; native container loads `www/index.html` | M1 | ORIGINAL_REQUEST R1 |
| 4 | Android Platform File Tree | `android/` directory with `build.gradle`, `app/build.gradle`, `settings.gradle`, `gradle.properties`, wrapper | M2 | Blueprint §3 |
| 5 | Android Manifest & Permissions | `AndroidManifest.xml` with `CAMERA`, `RECORD_AUDIO`, `HIGH_SAMPLING_RATE_SENSORS`, hardware features | M2 | Blueprint §4.1 |
| 6 | Native Camera2 Core Engine | `UltraWideCameraPlugin.kt` Camera2 lifecycle (`CameraDevice`, `CaptureRequest`, `CameraCaptureSession`) | M2 | Blueprint §4.1 |
| 7 | Physical Ultra-Wide Lens Selection | Logical & physical camera ID enumeration, focal length < 2.5mm check | M2 | Blueprint §4.1 |
| 8 | 0.5x Hardware Zoom Lock | `CONTROL_ZOOM_RATIO = 0.5f` applied to capture request | M2 | Blueprint §4.1 |
| 9 | AE/AF Exposure & Focus Lockout | `CONTROL_AE_LOCK = true`, `CONTROL_AF_MODE_LOCKED` | M2 | Blueprint §4.1 |
| 10 | Hardware-Synced 100Hz IMU Logging | Zero-heap `SensorEventListener` with `SENSOR_DELAY_FASTEST`, hardware PTS timestamps | M2 | Blueprint §4.1 |
| 11 | MediaRecorder Video Pipeline | Native video recording to MP4 via MediaRecorder Surface | M2 | Blueprint §4.1 |
| 12 | Plugin Registration in MainActivity | `MainActivity.kt` registering `UltraWideCameraPlugin::class.java` | M2 | Blueprint §4.1 |
| 13 | Runtime Platform Detection | `scanner.html` `window.Capacitor.isNativePlatform()` safe detection with graceful browser fallback | M3 | Blueprint §4.3 |
| 14 | CameraBridgeAdapter in scanner.html | Unifies WebRTC fallback and native `UltraWideCamera` plugin calls | M3 | Survey Web §2 |
| 15 | Ultra-Wide Lens Button Binding | `[ 0.5x ]` UI button triggers native lens selection or WebRTC constraint switch | M3 | ORIGINAL_REQUEST R3 |
| 16 | Transparent Underlay HUD Styling | CSS `.native-camera-underlay-active` for seamless native viewfinder overlay | M3 | Blueprint §4.4 |
| 17 | Live Reload Server URL Configuration | `capacitor.config.json` developer config support for LAN live reload | M3 | ORIGINAL_REQUEST R3 |
| 18 | GitHub Actions CI/CD Workflow | `.github/workflows/build-apk.yml` compiling `app-debug.apk` in cloud | M4 | ORIGINAL_REQUEST R4 |
| 19 | Automated Cloud JDK & SDK Setup | Workflow configuration with Temurin JDK 17 and Android SDK 34 build-tools | M4 | Survey Android §4 |
| 20 | APK Artifact Packaging & Retention | Cloud artifact upload of `app-debug.apk` with 30-day retention | M4 | Survey Android §4 |
| 21 | Comprehensive Verification Test Suite | Multi-tier test suite covering static AST, schemas, mock sensors, and fallback logic | M5 | ORIGINAL_REQUEST R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Capacitor Scaffolding & Web Assets | `package.json`, `capacitor.config.json`, `scripts/sync_web_assets.js`, `www/` build target | none | DONE |
| M2 | Native Android Shell & Camera2 Plugin | `android/` project tree, `UltraWideCameraPlugin.kt`, `MainActivity.kt`, `AndroidManifest.xml`, gradle wrapper | M1 | DONE |
| M3 | Web-to-Native Bridge & Viewfinder | `scanner.html` bridge adapter, `[ 0.5x ]` lens trigger, fallback, transparent underlay CSS | M1, M2 | DONE |
| M4 | Automated Cloud Build Pipeline | `.github/workflows/build-apk.yml` with JDK 17, SDK 34, gradlew assembleDebug, artifact upload | M1, M2 | DONE |
| M5 | Final Milestone: E2E Verification & Adversarial Hardening | Pass 100% of E2E tests (Tiers 1-4) followed by Tier 5 adversarial hardening | M1, M2, M3, M4, TEST_READY.md | DONE |

## Interface Contracts
### Web (`scanner.html`) ↔ Native Plugin (`UltraWideCameraPlugin`)
- **Plugin Name**: `UltraWideCamera`
- **Methods**:
  - `checkPermissions() -> Promise<{ camera: string, audio: string }>`
  - `requestPermissions() -> Promise<{ camera: string, audio: string }>`
  - `getAvailableCameras() -> Promise<{ cameras: Array<{ id: string, lensFacing: string, focalLengths: number[], isUltraWide: boolean, minZoom: number, maxZoom: number }> }>`
  - `startPreview(options: { cameraId?: string, zoomRatio?: number, width?: number, height?: number }) -> Promise<{ success: boolean, activeCameraId: string, zoomRatio: number, width: number, height: number }>`
  - `stopPreview() -> Promise<{ success: boolean }>`
  - `lockExposureAndFocus(options: { aeLocked: boolean, afLocked: boolean }) -> Promise<{ aeLocked: boolean, afLocked: boolean }>`
  - `startRecording(options: { filePath?: string, recordImu?: boolean }) -> Promise<{ success: boolean, outputPath: string }>`
  - `stopRecording() -> Promise<{ success: boolean, videoPath: string, imuCsvPath: string, sampleCount: number, durationMs: number }>`

### Capacitor Scaffolding ↔ Build Engine
- `package.json`: scripts `prepare-assets`, `cap:sync`, `cap:copy`.
- `capacitor.config.json`: `appId: "com.woninginrichter.scanner"`, `appName: "Woninginrichter 3D Scanner"`, `webDir: "www"`.
- Output APK Path: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Code Layout
- `package.json`: Root Node configuration and dependencies.
- `capacitor.config.json`: Capacitor platform configuration.
- `scripts/sync_web_assets.js`: Asset synchronization into `www/`.
- `www/`: Distribution web assets target (`index.html`, `scanner.html`).
- `scanner.html`: Source web application with backward-compatible bridge.
- `android/`: Android platform root.
  - `build.gradle`: Project-level build script.
  - `settings.gradle`: Gradle project inclusion settings.
  - `gradle.properties`: Android build optimizations.
  - `gradlew`, `gradlew.bat`, `gradle/wrapper/*`: Gradle wrapper executable and configuration.
  - `app/build.gradle`: Android application module build script.
  - `app/src/main/AndroidManifest.xml`: Android manifest with camera & sensor permissions.
  - `app/src/main/java/com/woninginrichter/scanner/MainActivity.kt`: Android main activity.
  - `app/src/main/java/com/woninginrichter/scanner/UltraWideCameraPlugin.kt`: Native Camera2 & IMU plugin.
- `.github/workflows/build-apk.yml`: GitHub Actions automated cloud build workflow.
- `tests/`: Automated test suite for offline verification and mock validation.
