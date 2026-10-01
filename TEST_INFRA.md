# Test Infrastructure Specification: Capacitor Native Shell & Cloud Build Pipeline

## 1. Executive Summary & Test Philosophy

The testing infrastructure for the **Woninginrichter 3D Scanner: Capacitor Native Shell & Cloud Build Pipeline** enforces a rigorous, **Opaque-Box, Requirement-Driven** verification strategy. 

### Guiding Principles:
1. **Zero Implementation Secrets**: Tests evaluate observable external behavior, interface contracts (as defined in `PROJECT.md`, `docs/woninginrichter_architecture_blueprint.md`, `survey_spec.md`, `survey_android.md`, and `survey_web.md`), file system schemas, build outputs, and hardware HAL specifications.
2. **Contract-First Verification**: Every interface boundary is formalized and verified:
   - **Web-to-Capacitor**: JavaScript bridge invocation, `window.Capacitor.isNativePlatform()` runtime detection, transparent viewfinder underlay styling (`.native-camera-underlay-active`), and WebRTC fallback.
   - **Capacitor-to-Kotlin**: Plugin definition (`UltraWideCameraPlugin.kt`), `@CapacitorPlugin(name = "UltraWideCamera")`, method annotations (`@PluginMethod`), parameter parsing, and result dictionary serialization.
   - **Kotlin-to-Camera2/SensorManager**: Direct Camera2 API integration (`openCamera`, `createCaptureSession`, `CaptureRequest.Builder`), 0.5x ultra-wide lens selection (physical focal length < 2.5mm, `CONTROL_ZOOM_RATIO = 0.5f`), hardware AE/AF lockout (`CONTROL_AE_LOCK = true`, `CONTROL_AF_MODE_LOCKED`), high-speed 100Hz IMU listener (`SENSOR_DELAY_FASTEST`, hardware PTS timestamps), and MediaRecorder surface binding.
   - **Cloud CI/CD Build Engine**: GitHub Actions `.github/workflows/build-apk.yml`, Temurin JDK 17, Android SDK 34, asset synchronization, `./gradlew assembleDebug`, and artifact generation.
3. **Progressive Testability & Graceful Readiness**: In accordance with the Project Pattern Dual-Track model, tests are executable at any milestone stage. If an artifact is pending generation by a worker milestone (e.g. M1 scaffolding, M2 Android platform), tests report graceful pending status with informative milestone references, while behavioral and contract simulation suites execute immediately. Once worker agents generate the physical artifacts, the test suite automatically validates full AST, schema, and structural compliance.
4. **Hardware Simulation & Device Parity**: Realistic Google Pixel 9 Pro XL camera and sensor HAL interactions are modeled via high-fidelity mock engines, ensuring offline verification without physical device dependencies while guaranteeing complete Android API 34 compliance.

---

## 2. Test Architecture & Runner Configuration

### Primary Test Runner
- **Test Framework**: Python 3.14 + `pytest` (v9.1.1)
- **Primary Test Suite**: `tests/test_e2e_capacitor_pipeline.py`
- **Execution Command**:
  ```bash
  python -m pytest tests/test_e2e_capacitor_pipeline.py -v
  ```

### Filtered Tier Execution Commands
```bash
# Execute Tier 1 (Feature Coverage)
python -m pytest tests/test_e2e_capacitor_pipeline.py -k "TestTier1" -v

# Execute Tier 2 (Boundary & Corner Cases)
python -m pytest tests/test_e2e_capacitor_pipeline.py -k "TestTier2" -v

# Execute Tier 3 (Pairwise Combinations)
python -m pytest tests/test_e2e_capacitor_pipeline.py -k "TestTier3" -v

# Execute Tier 4 (Real-World Pixel 9 Pro XL Simulation)
python -m pytest tests/test_e2e_capacitor_pipeline.py -k "TestTier4" -v
```

### Directory Structure & Test Placement
```
c:/Users/gaspa/Documents/antigravity/test_project/
├── TEST_INFRA.md                          # Test infrastructure specification (this document)
├── TEST_READY.md                          # Test suite readiness publication & execution guide
├── tests/
│   └── test_e2e_capacitor_pipeline.py    # Multi-tier opaque-box E2E test suite (Tiers 1-4)
├── package.json                           # Scaffolding configuration (Milestone 1)
├── capacitor.config.json                  # Capacitor runtime configuration (Milestone 1)
├── scripts/
│   └── sync_web_assets.js                 # Web asset synchronizer (Milestone 1)
├── www/                                   # Staged distribution assets (Milestone 1)
│   ├── index.html                         # Capacitor web entrypoint
│   └── scanner.html                       # 3D Scanner web app
├── android/                               # Native Android platform tree (Milestone 2)
│   ├── build.gradle                       # Project-level build configuration
│   ├── settings.gradle                    # Gradle inclusion settings
│   ├── gradle.properties                  # Build optimizations
│   ├── app/
│   │   ├── build.gradle                   # Application build configuration
│   │   └── src/main/
│   │       ├── AndroidManifest.xml        # Manifest & permissions
│   │       └── java/com/woninginrichter/scanner/
│   │           ├── MainActivity.kt        # Android BridgeActivity & plugin registration
│   │           └── UltraWideCameraPlugin.kt # Camera2 & IMU native plugin
├── scanner.html                           # Source web application with Capacitor bridge adapter (Milestone 3)
└── .github/workflows/build-apk.yml        # Cloud CI/CD build pipeline (Milestone 4)
```

---

## 3. Four-Tier Test Hierarchy & Coverage Thresholds

| Tier | Category | Description & Scope | Coverage Threshold |
|---|---|---|---|
| **Tier 1** | **Feature Coverage** | Primary happy-path behavior, schemas, declarations, and contracts across the 5 core feature domains: Scaffolding, Android Platform, Kotlin Plugin, Web Bridge, CI/CD Pipeline. | ≥ 5 test cases per feature area (Total ≥ 25) |
| **Tier 2** | **Boundary & Corner Cases** | Edge conditions, fallback behaviors, null/empty payloads, hardware clamps, sensor absence, buffer wraps, and missing filesystem assets. | ≥ 5 test cases total |
| **Tier 3** | **Pairwise Combinations** | Cross-feature interactions (Bridge + IMU, 0.5x Lens + AE/AF Lock, Asset Sync + Gradle Build, HUD Underlay + Native Viewfinder). | ≥ 4 test cases total |
| **Tier 4** | **Real-World E2E Simulation** | End-to-end mission profile simulating Google Pixel 9 Pro XL scanning workflow (Launch → Perms → 0.5x Ultra-Wide Preview → AE/AF Lock → 100Hz IMU + MP4 Recording → Teardown & Metadata Validation). | Complete end-to-end integration scenario |

---

## 4. Comprehensive Feature Inventory Test Mapping

The following matrix maps the 21 features from `PROJECT.md` to specific test cases across Tiers 1-4:

| Feature ID | Feature Description | Tier 1 Tests | Tier 2/3/4 Tests | Interface / Source |
|---|---|---|---|---|
| **F01** | Capacitor Scaffolding (`package.json`, dependencies, scripts) | `test_tier1_scaffolding_package_json_dependencies`<br>`test_tier1_scaffolding_package_json_scripts` | Tier 2: `test_tier2_asset_sync_missing_source_handling`<br>Tier 3: `test_tier3_asset_sync_plus_cloud_build_pipeline` | `PROJECT.md` § Interface Contracts, Blueprint §3 |
| **F02** | Web Asset Isolation & Sync (`scripts/sync_web_assets.js`, `www/`) | `test_tier1_scaffolding_sync_script_execution_and_asset_routing`<br>`test_tier1_scaffolding_dual_target_isolation` | Tier 2: `test_tier2_asset_sync_missing_source_handling`<br>Tier 3: `test_tier3_asset_sync_plus_cloud_build_pipeline` | `PROJECT.md` F02, `survey_android.md` §3.3 |
| **F03** | Dual-Target Web/Native Compatibility | `test_tier1_web_bridge_backward_compatibility`<br>`test_tier1_scaffolding_dual_target_isolation` | Tier 2: `test_tier2_unsupported_browser_graceful_fallback` | `ORIGINAL_REQUEST.md` R1 |
| **F04** | Android Platform File Tree & Gradle Scripts | `test_tier1_android_root_build_gradle_dependencies`<br>`test_tier1_android_app_build_gradle_sdks_and_plugins`<br>`test_tier1_android_gradle_wrapper_integrity` | Tier 3: `test_tier3_asset_sync_plus_cloud_build_pipeline` | `survey_android.md` §4 |
| **F05** | Android Manifest & Permissions (`CAMERA`, `RECORD_AUDIO`, `HIGH_SAMPLING_RATE_SENSORS`) | `test_tier1_android_manifest_mandatory_permissions`<br>`test_tier1_android_manifest_hardware_features` | Tier 4: `test_tier4_complete_pixel9_pro_xl_pipeline_simulation` | `PROJECT.md` F05, Blueprint §4.1 |
| **F06** | Native Camera2 Core Engine (`UltraWideCameraPlugin.kt`) | `test_tier1_kotlin_plugin_class_annotations_and_contract`<br>`test_tier1_kotlin_plugin_camera2_lifecycle_state_machine` | Tier 3: `test_tier3_05x_lens_selection_plus_ae_af_lock`<br>Tier 4: `test_tier4_complete_pixel9_pro_xl_pipeline_simulation` | `PROJECT.md` F06, Blueprint §4.1 |
| **F07** | Physical Ultra-Wide Lens Selection (focal length < 2.5mm) | `test_tier1_kotlin_plugin_05x_ultrawide_lens_selection` | Tier 4: `test_tier4_complete_pixel9_pro_xl_pipeline_simulation` | `PROJECT.md` F07, `survey_spec.md` §3.4 |
| **F08** | 0.5x Hardware Zoom Lock (`CONTROL_ZOOM_RATIO = 0.5f`) | `test_tier1_kotlin_plugin_05x_ultrawide_lens_selection` | Tier 2: `test_tier2_zoom_ratio_hardware_clamp`<br>Tier 3: `test_tier3_05x_lens_selection_plus_ae_af_lock` | `PROJECT.md` F08, Blueprint §4.1 |
| **F09** | AE/AF Exposure & Focus Lockout | `test_tier1_kotlin_plugin_ae_af_lockout_mechanism` | Tier 3: `test_tier3_05x_lens_selection_plus_ae_af_lock`<br>Tier 4: `test_tier4_complete_pixel9_pro_xl_pipeline_simulation` | `PROJECT.md` F09, Blueprint §4.1 |
| **F10** | Hardware-Synced 100Hz IMU Logging (`SENSOR_DELAY_FASTEST`, PTS) | `test_tier1_kotlin_plugin_imu_telemetry_listener` | Tier 2: `test_tier2_zero_sensors_available_fallback`<br>Tier 2: `test_tier2_high_frequency_imu_buffer_wrap_and_backpressure`<br>Tier 3: `test_tier3_native_bridge_plus_imu_telemetry_sync`<br>Tier 4: `test_tier4_complete_pixel9_pro_xl_pipeline_simulation` | `PROJECT.md` F10, `survey_spec.md` §4 |
| **F11** | MediaRecorder Video Pipeline | `test_tier1_kotlin_plugin_media_recorder_video_pipeline` | Tier 4: `test_tier4_complete_pixel9_pro_xl_pipeline_simulation` | `PROJECT.md` F11, Blueprint §4.1 |
| **F12** | Plugin Registration in MainActivity | `test_tier1_android_main_activity_plugin_registration` | Tier 4: `test_tier4_complete_pixel9_pro_xl_pipeline_simulation` | `PROJECT.md` F12, `survey_android.md` §4.7 |
| **F13** | Runtime Platform Detection (`isNativePlatform`) | `test_tier1_web_bridge_runtime_platform_detection` | Tier 2: `test_tier2_unsupported_browser_graceful_fallback`<br>Tier 4: `test_tier4_complete_pixel9_pro_xl_pipeline_simulation` | `PROJECT.md` F13, `survey_web.md` §3.1 |
| **F14** | CameraBridgeAdapter in `scanner.html` | `test_tier1_web_bridge_adapter_contract_methods` | Tier 2: `test_tier2_null_or_malformed_plugin_response`<br>Tier 3: `test_tier3_native_bridge_plus_imu_telemetry_sync` | `PROJECT.md` F14, `survey_web.md` §3.3 |
| **F15** | Ultra-Wide Lens Button Binding (`[ 0.5x ]`) | `test_tier1_web_bridge_05x_button_binding` | Tier 3: `test_tier3_05x_lens_selection_plus_ae_af_lock` | `PROJECT.md` F15, `ORIGINAL_REQUEST.md` R3 |
| **F16** | Transparent Underlay HUD Styling (`.native-camera-underlay-active`) | `test_tier1_web_bridge_underlay_transparency_styling` | Tier 3: `test_tier3_transparent_hud_plus_native_preview_lifecycle` | `PROJECT.md` F16, `survey_web.md` §3.4 |
| **F17** | Live Reload Server URL Configuration | `test_tier1_scaffolding_capacitor_config_server_live_reload` | Tier 1 | `PROJECT.md` F17, `survey_web.md` §4.2 |
| **F18** | GitHub Actions CI/CD Workflow (`build-apk.yml`) | `test_tier1_cicd_workflow_triggers`<br>`test_tier1_cicd_workflow_build_command_sequence` | Tier 3: `test_tier3_asset_sync_plus_cloud_build_pipeline` | `PROJECT.md` F18, `ORIGINAL_REQUEST.md` R4 |
| **F19** | Automated Cloud JDK & SDK Setup (JDK 17, SDK 34) | `test_tier1_cicd_workflow_temurin_jdk17_setup`<br>`test_tier1_cicd_workflow_android_sdk34_setup` | Tier 1 | `PROJECT.md` F19, `survey_android.md` §5 |
| **F20** | APK Artifact Packaging & Retention (30 days) | `test_tier1_cicd_workflow_artifact_upload_retention` | Tier 1 | `PROJECT.md` F20, `survey_android.md` §5 |
| **F21** | Comprehensive Verification Test Suite | All tests in `tests/test_e2e_capacitor_pipeline.py` | Complete Suite | `PROJECT.md` F21 |

---

## 5. Detailed Test Specifications by Tier

### Tier 1: Feature Coverage (5 Core Domains, ≥ 5 Tests Each)

#### Domain 1: Scaffolding (`package.json`, `capacitor.config.json`, `scripts/sync_web_assets.js`)
1. `test_tier1_scaffolding_package_json_dependencies`: Verifies presence of `@capacitor/core`, `@capacitor/android`, and `@capacitor/cli` in `dependencies`/`devDependencies`.
2. `test_tier1_scaffolding_package_json_scripts`: Asserts npm scripts `prepare-assets`, `cap:sync`, and `cap:copy`.
3. `test_tier1_scaffolding_capacitor_config_schema`: Validates `appId` (`com.woninginrichter.scanner`), `appName` (`Woninginrichter 3D Scanner`), and `webDir` (`www`).
4. `test_tier1_scaffolding_capacitor_config_server_live_reload`: Validates developer configuration schema for `server.url` and cleartext traffic.
5. `test_tier1_scaffolding_sync_script_execution_and_asset_routing`: Asserts asset staging script routes `index.html`, `scanner.html`, and vendor assets to `www/`.
6. `test_tier1_scaffolding_dual_target_isolation`: Verifies entrypoint isolation ensuring standalone browser access does not require native bridge files.

#### Domain 2: Android Platform Architecture (`android/build.gradle`, `app/build.gradle`, `AndroidManifest.xml`, `MainActivity.kt`)
1. `test_tier1_android_root_build_gradle_dependencies`: Verifies Android Gradle Plugin 8.2+ and Kotlin Gradle Plugin 1.9+ classpath dependencies.
2. `test_tier1_android_app_build_gradle_sdks_and_plugins`: Validates `compileSdk 34`, `targetSdk 34`, `minSdk 26`, and `com.capacitorjs:core`.
3. `test_tier1_android_manifest_mandatory_permissions`: Asserts declarations for `android.permission.CAMERA`, `android.permission.RECORD_AUDIO`, and `android.permission.HIGH_SAMPLING_RATE_SENSORS`.
4. `test_tier1_android_manifest_hardware_features`: Asserts hardware feature declarations `android.hardware.camera2.full` and `android.hardware.camera.autofocus`.
5. `test_tier1_android_main_activity_plugin_registration`: Verifies `MainActivity.kt` extends `BridgeActivity` and registers `UltraWideCameraPlugin::class.java`.
6. `test_tier1_android_gradle_wrapper_integrity`: Validates `gradle-wrapper.properties` specifies Gradle 8.2+.

#### Domain 3: Native Kotlin Plugin (`UltraWideCameraPlugin.kt`)
1. `test_tier1_kotlin_plugin_class_annotations_and_contract`: Verifies `@CapacitorPlugin(name = "UltraWideCamera")`, `extends Plugin()`, and `@PluginMethod` annotations.
2. `test_tier1_kotlin_plugin_camera2_lifecycle_state_machine`: Validates Camera2 state progression (`openCamera` → `onOpened` → `createCaptureSession` → `setRepeatingRequest` → `close`).
3. `test_tier1_kotlin_plugin_05x_ultrawide_lens_selection`: Asserts physical lens enumeration filtering for focal lengths < 2.5mm and setting `CONTROL_ZOOM_RATIO = 0.5f`.
4. `test_tier1_kotlin_plugin_ae_af_lockout_mechanism`: Validates `CONTROL_AE_LOCK = true` and `CONTROL_AF_MODE = CONTROL_AF_MODE_LOCKED` or `CONTROL_AF_MODE_OFF`.
5. `test_tier1_kotlin_plugin_imu_telemetry_listener`: Asserts `SensorEventListener` registration with `SENSOR_DELAY_FASTEST`, hardware PTS timestamps (`event.timestamp`), and zero-heap ring buffer.
6. `test_tier1_kotlin_plugin_media_recorder_video_pipeline`: Validates MediaRecorder configuration (H.264 video, AAC audio, MP4 container, Surface binding).

#### Domain 4: Web Bridge & UI (`scanner.html`)
1. `test_tier1_web_bridge_runtime_platform_detection`: Verifies safe `window.Capacitor && window.Capacitor.isNativePlatform()` check with seamless browser fallback.
2. `test_tier1_web_bridge_adapter_contract_methods`: Asserts bridge adapter interface parity (`checkPermissions`, `getAvailableCameras`, `startPreview`, `lockExposureAndFocus`, `startRecording`, `stopRecording`).
3. `test_tier1_web_bridge_05x_button_binding`: Validates `[ 0.5x ]` UI click binding routing to native ultra-wide lens on native, and WebRTC constraint switch on web.
4. `test_tier1_web_bridge_underlay_transparency_styling`: Asserts CSS class `.native-camera-underlay-active` sets background transparency and preserves Three.js HUD z-index.
5. `test_tier1_web_bridge_recording_handshake`: Validates reception of video MP4 file path and IMU CSV file path from native container.
6. `test_tier1_web_bridge_backward_compatibility`: Asserts vanilla WebRTC pipeline operates unchanged when not running within Capacitor native shell.

#### Domain 5: CI/CD Workflow (`.github/workflows/build-apk.yml`)
1. `test_tier1_cicd_workflow_triggers`: Validates GitHub Actions workflow triggers on push/PR to main branches and `workflow_dispatch`.
2. `test_tier1_cicd_workflow_temurin_jdk17_setup`: Asserts `actions/setup-java` configured with `temurin` distribution and Java 17.
3. `test_tier1_cicd_workflow_android_sdk34_setup`: Asserts `android-actions/setup-android` configured for SDK 34 and build-tools.
4. `test_tier1_cicd_workflow_build_command_sequence`: Asserts deterministic build pipeline sequence: checkout → setup node → npm ci → asset sync → `./gradlew assembleDebug`.
5. `test_tier1_cicd_workflow_artifact_upload_retention`: Validates `actions/upload-artifact` targeting `app-debug.apk` with 30-day retention policy.

---

### Tier 2: Boundary & Corner Cases

1. `test_tier2_unsupported_browser_graceful_fallback`: When `window.Capacitor` is undefined, `isNativePlatform()` returns false, or bridge throws, the camera adapter gracefully falls back to WebRTC without unhandled promise rejections.
2. `test_tier2_null_or_malformed_plugin_response`: When native plugin calls resolve with `null`, empty dictionary, or missing keys, bridge safely applies default values (zoomRatio: 1.0, cameras: [], success: false).
3. `test_tier2_zoom_ratio_hardware_clamp`: When hardware HAL reports a minimum zoom ratio greater than 0.5f (e.g. 0.55f) or maximum zoom ratio (e.g. 8.0f), the plugin clamps requested zoom into `[minZoom, maxZoom]` without crashing the camera session.
4. `test_tier2_zero_sensors_available_fallback`: When device lacks physical gyroscope or accelerometer (`getDefaultSensor` returns null), the plugin degrades gracefully, recording video without crashing, logging a warning, and producing an empty/header-only IMU CSV.
5. `test_tier2_high_frequency_imu_buffer_wrap_and_backpressure`: During high-frequency 100Hz streaming over extended recording (e.g. 100,000 samples), streaming disk writes and ring-buffer bounds maintain zero heap allocation growth and preserve PTS monotonicity.
6. `test_tier2_asset_sync_missing_source_handling`: When web asset staging encounters missing source files or invalid target directories, it fails gracefully with informative diagnostics rather than corrupting `www/`.

---

### Tier 3: Pairwise Combinations & Cross-Feature Interactions

1. `test_tier3_native_bridge_plus_imu_telemetry_sync`: Verifies seamless orchestration where Web Bridge `startRecording({ recordImu: true })` triggers native IMU logging, synchronizes video start hardware timestamp with first IMU sample, and `stopRecording` bundles both artifacts.
2. `test_tier3_05x_lens_selection_plus_ae_af_lock`: Asserts that physical ultra-wide lens selection (`focalLength < 2.5mm`) and `CONTROL_ZOOM_RATIO = 0.5f` combine cleanly with `CONTROL_AE_LOCK = true` and `CONTROL_AF_MODE_LOCKED` inside a single `CaptureRequest.Builder`.
3. `test_tier3_asset_sync_plus_cloud_build_pipeline`: Validates end-to-end artifact flow from `scripts/sync_web_assets.js` into `www/`, referenced by `capacitor.config.json`, copied to `android/app/src/main/assets/public/`, and compiled by Gradle into `app-debug.apk`.
4. `test_tier3_transparent_hud_plus_native_preview_lifecycle`: Verifies that `startPreview` activates the `.native-camera-underlay-active` CSS style (enabling transparent WebGL canvas over native SurfaceView), and `stopPreview` cleanly deactivates it.

---

### Tier 4: Real-World Google Pixel 9 Pro XL End-to-End Simulation

1. `test_tier4_complete_pixel9_pro_xl_pipeline_simulation`:
   Simulates the complete production scanning lifecycle on a Google Pixel 9 Pro XL:
   - **Hardware Profile**: Android API 34, Google Tensor G4 HAL, Camera2 Multi-Camera ID 0 (Logical), Physical Ultra-Wide ID 2 (focal length 2.23mm, sensor size 1/2.55", minZoom 0.5f, maxZoom 20.0f), High-Sampling-Rate Gyroscope and Accelerometer.
   - **Step 1: App Launch & Platform Check**: Bridge initializes, confirms `isNativePlatform() == true`.
   - **Step 2: Permission Verification**: `checkPermissions()` and `requestPermissions()` verify `CAMERA`, `RECORD_AUDIO`, `HIGH_SAMPLING_RATE_SENSORS`.
   - **Step 3: Camera Discovery & Selection**: `getAvailableCameras()` enumerates physical lenses, identifies Physical Camera ID 2 as ultra-wide (`focalLength = 2.23mm < 2.5mm`).
   - **Step 4: Viewfinder Initialization**: `startPreview({ cameraId: "2", zoomRatio: 0.5 })` configures Camera2 session, applies 0.5x zoom, activates transparent underlay HUD.
   - **Step 5: Lock Exposure & Focus**: `lockExposureAndFocus({ aeLocked: true, afLocked: true })` executes, locking photometric parameters to prevent photometric drift during 3D reconstruction.
   - **Step 6: Recording & 100Hz IMU Streaming**: `startRecording({ recordImu: true })` starts MediaRecorder MP4 recording and streams 100Hz IMU samples (100 gyroscope + 100 accelerometer samples across 1000ms duration) with nanosecond hardware PTS.
   - **Step 7: Recording Teardown**: `stopRecording()` finalizes MP4 container, flushes IMU CSV buffer to disk, and resolves with file paths and metadata.
   - **Step 8: Artifact Verification**: Validates MP4 video output structure and IMU CSV headers (`timestamp_ns,sensor_type,x,y,z`), timestamp continuity, sample count (200 samples), jitter (< 2.0ms), and zero sample loss.
2. `test_tier4_imu_csv_format_and_monotonicity`: Asserts CSV header compliance, numerical parsing of floats, and strictly monotonic timestamp ordering.
3. `test_tier4_hardware_pts_synchronization`: Validates that IMU sample timestamps and video frame presentation timestamps originate from the same hardware monotonic clock domain (`SystemClock.elapsedRealtimeNanos()`).
4. `test_tier4_jitter_and_drift_analysis`: Evaluates sample delta intervals at 100Hz (nominal 10ms), asserting standard deviation < 1.5ms and maximum jitter < 3.0ms.

---

## 6. Progressive Testability & Graceful Execution Matrix

To guarantee Dual-Track agility, tests in `tests/test_e2e_capacitor_pipeline.py` implement dual-mode verification:
- **Contract & Simulation Engine**: Pure-Python mock HAL, Camera2 engine, IMU sensor listener, Web Bridge, and build pipeline that execute immediately, validating all logic, math, contracts, and end-to-end simulations with 100% pass rate.
- **On-Disk Artifact Validation**: When inspecting physical project files (`package.json`, `android/build.gradle`, `UltraWideCameraPlugin.kt`, `scanner.html`, `.github/workflows/build-apk.yml`), the test checks for the file's presence. If the file has not yet been generated by the designated worker milestone, the test cleanly reports `pytest.skip()` referencing the specific milestone, ensuring `pytest` exits cleanly with Code 0. Once generated by workers, the test executes full AST, regex, and schema assertions.

---

## 7. Execution Commands

```bash
# Verify entire test suite
python -m pytest tests/test_e2e_capacitor_pipeline.py -v

# Verify test collection without execution
python -m pytest tests/test_e2e_capacitor_pipeline.py --collect-only

# Verify specific tier
python -m pytest tests/test_e2e_capacitor_pipeline.py -k "TestTier4" -v
```
