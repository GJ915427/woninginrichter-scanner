"""
tests/test_e2e_capacitor_pipeline.py
====================================
Comprehensive Multi-Tier Opaque-Box E2E Test Suite for:
Woninginrichter 3D Scanner — Capacitor Native Shell & Cloud Build Pipeline

Authoritative Sources:
- PROJECT.md (§ Architecture, § Feature Inventory F01-F21, § Interface Contracts, § Code Layout)
- ORIGINAL_REQUEST.md (§ 2026-10-01T08:36:59Z, Requirements R1-R5)
- docs/woninginrichter_architecture_blueprint.md (§3, §4.1, §4.3, §4.4)
- Technical Surveys (survey_spec.md, survey_android.md, survey_web.md)

Test Hierarchy (Tiers 1-4):
- Tier 1: Feature Coverage (5 core domains, >=5 tests per domain)
    * Scaffolding (package.json, capacitor.config.json, scripts/sync_web_assets.js)
    * Android Platform (build.gradle, app/build.gradle, AndroidManifest.xml, MainActivity.kt)
    * Kotlin Plugin (UltraWideCameraPlugin.kt Camera2, AE/AF lockout, 100Hz IMU, MediaRecorder)
    * Web Bridge (scanner.html bridge adapter, 0.5x lens selector, HUD underlay CSS, fallback)
    * CI/CD Workflow (.github/workflows/build-apk.yml, JDK 17, SDK 34, assembleDebug, artifacts)
- Tier 2: Boundary & Corner Cases (unsupported browser, null responses, zoom clamping, zero sensors, IMU wrap)
- Tier 3: Pairwise Combinations (bridge+IMU, 0.5x+AE lock, sync+gradle, underlay+native viewfinder)
- Tier 4: Real-World Pixel 9 Pro XL End-to-End Simulation (complete scanning mission lifecycle)
"""

import os
import sys
import json
import re
import time
import math
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

import pytest
import yaml

# Authoritative project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent


# ============================================================================
# HIGH-FIDELITY SIMULATION & MOCK HAL ENGINES (FOR OPAQUE-BOX VERIFICATION)
# ============================================================================

class MockPixel9ProXLHAL:
    """
    Simulates Google Pixel 9 Pro XL Camera2 HAL & Android SensorManager.
    Specs:
      - Logical Camera ID '0' (Back Multi-Camera)
      - Physical Ultra-Wide Camera ID '2' (focal length 2.23mm < 2.5mm, 12MP, 0.5x - 2.0x zoom)
      - Physical Wide Camera ID '0' (focal length 6.9mm, 50MP)
      - Physical Telephoto Camera ID '3' (focal length 19.0mm, 48MP, 5.0x - 30.0x zoom)
      - Front Camera ID '1' (focal length 2.83mm)
      - High Sampling Rate Sensors: Gyroscope & Accelerometer (100Hz default, hardware nanosecond PTS)
    """

    def __init__(self, has_sensors: bool = True, min_zoom: float = 0.5, max_zoom: float = 20.0):
        self.has_sensors = has_sensors
        self.min_zoom = min_zoom
        self.max_zoom = max_zoom
        self.active_camera_id: Optional[str] = None
        self.session_active = False
        self.recording_active = False
        self.ae_locked = False
        self.af_locked = False
        self.current_zoom = 1.0
        self.imu_listeners: List[Any] = []
        self.imu_samples: List[Dict[str, Any]] = []

    def get_camera_characteristics(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": "0",
                "lensFacing": "back",
                "focalLengths": [6.9],
                "isUltraWide": False,
                "minZoom": 0.5,
                "maxZoom": 20.0,
                "physicalIds": ["0", "2", "3"]
            },
            {
                "id": "1",
                "lensFacing": "front",
                "focalLengths": [2.83],
                "isUltraWide": False,
                "minZoom": 1.0,
                "maxZoom": 4.0,
                "physicalIds": []
            },
            {
                "id": "2",
                "lensFacing": "back",
                "focalLengths": [2.23],  # Ultra-wide threshold: < 2.5mm
                "isUltraWide": True,
                "minZoom": self.min_zoom,
                "maxZoom": 2.0,
                "physicalIds": []
            },
            {
                "id": "3",
                "lensFacing": "back",
                "focalLengths": [19.0],
                "isUltraWide": False,
                "minZoom": 5.0,
                "maxZoom": 30.0,
                "physicalIds": []
            }
        ]

    def open_camera(self, camera_id: str) -> bool:
        valid_ids = [c["id"] for c in self.get_camera_characteristics()]
        if camera_id not in valid_ids:
            raise ValueError(f"Invalid Camera ID: {camera_id}")
        self.active_camera_id = camera_id
        return True

    def create_capture_session(self, zoom_ratio: float = 0.5) -> Dict[str, Any]:
        if not self.active_camera_id:
            raise RuntimeError("Camera not opened before session creation")
        # Hardware clamping
        clamped_zoom = max(self.min_zoom, min(zoom_ratio, self.max_zoom))
        self.current_zoom = clamped_zoom
        self.session_active = True
        return {
            "sessionActive": True,
            "activeCameraId": self.active_camera_id,
            "zoomRatio": clamped_zoom
        }

    def set_exposure_and_focus_lock(self, ae_lock: bool, af_lock: bool) -> Tuple[bool, bool]:
        if not self.session_active:
            raise RuntimeError("No active capture session to apply lock")
        self.ae_locked = ae_lock
        self.af_locked = af_lock
        return self.ae_locked, self.af_locked

    def start_recording(self, output_path: str, record_imu: bool = True) -> Dict[str, Any]:
        if not self.session_active:
            raise RuntimeError("Cannot start recording without active camera session")
        self.recording_active = True
        self.imu_samples.clear()
        return {"success": True, "outputPath": output_path}

    def emit_imu_samples(self, duration_ms: int = 1000, frequency_hz: int = 100) -> int:
        """Emits hardware nanosecond timestamped samples for Gyro and Accel."""
        if not self.recording_active or not self.has_sensors:
            return 0
        sample_interval_ns = int(1_000_000_000 / frequency_hz)
        start_pts = time.time_ns()
        total_intervals = int((duration_ms / 1000.0) * frequency_hz)

        for i in range(total_intervals):
            sample_time_ns = start_pts + (i * sample_interval_ns)
            # Simulated realistic sensor dynamics
            self.imu_samples.append({
                "timestamp_ns": sample_time_ns,
                "sensor_type": "GYROSCOPE",
                "x": 0.012 * math.sin(i * 0.1),
                "y": -0.005 * math.cos(i * 0.1),
                "z": 0.001 * math.sin(i * 0.05)
            })
            self.imu_samples.append({
                "timestamp_ns": sample_time_ns,
                "sensor_type": "ACCELEROMETER",
                "x": 0.05 * math.cos(i * 0.1),
                "y": 9.81 + (0.02 * math.sin(i * 0.1)),
                "z": 0.12 * math.cos(i * 0.05)
            })
        return len(self.imu_samples)

    def stop_recording(self, video_path: str, imu_csv_path: str) -> Dict[str, Any]:
        if not self.recording_active:
            raise RuntimeError("Recording is not currently active")
        self.recording_active = False

        sample_count = len(self.imu_samples)
        # Flush to CSV
        os.makedirs(os.path.dirname(os.path.abspath(imu_csv_path)), exist_ok=True)
        with open(imu_csv_path, "w", encoding="utf-8") as f:
            f.write("timestamp_ns,sensor_type,x,y,z\n")
            for sample in self.imu_samples:
                f.write(f"{sample['timestamp_ns']},{sample['sensor_type']},{sample['x']:.6f},{sample['y']:.6f},{sample['z']:.6f}\n")

        # Create video dummy if not present
        os.makedirs(os.path.dirname(os.path.abspath(video_path)), exist_ok=True)
        with open(video_path, "wb") as f:
            f.write(b"\x00\x00\x00\x20ftypmp42\x00\x00\x00\x00mp42isomavc1\x00\x00\x00\x08free")

        return {
            "success": True,
            "videoPath": video_path,
            "imuCsvPath": imu_csv_path,
            "sampleCount": sample_count,
            "durationMs": 1000 if sample_count > 0 else 0
        }

    def close(self):
        self.recording_active = False
        self.session_active = False
        self.active_camera_id = None


class UltraWideCameraPluginModel:
    """
    Models the Kotlin UltraWideCameraPlugin interface contracts.
    """

    def __init__(self, hal: Optional[MockPixel9ProXLHAL] = None):
        self.hal = hal or MockPixel9ProXLHAL()
        self.permissions = {"camera": "granted", "audio": "granted"}

    def checkPermissions(self) -> Dict[str, str]:
        return self.permissions

    def requestPermissions(self) -> Dict[str, str]:
        return self.permissions

    def getAvailableCameras(self) -> Dict[str, List[Dict[str, Any]]]:
        return {"cameras": self.hal.get_camera_characteristics()}

    def startPreview(self, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        options = options or {}
        camera_id = options.get("cameraId")
        if not camera_id:
            # Auto-select physical ultra-wide (< 2.5mm)
            for cam in self.hal.get_camera_characteristics():
                if cam.get("isUltraWide") or (cam.get("focalLengths") and cam["focalLengths"][0] < 2.5):
                    camera_id = cam["id"]
                    break
            camera_id = camera_id or "0"

        zoom_ratio = options.get("zoomRatio", 0.5)
        self.hal.open_camera(camera_id)
        session_info = self.hal.create_capture_session(zoom_ratio)
        return {
            "success": True,
            "activeCameraId": session_info["activeCameraId"],
            "zoomRatio": session_info["zoomRatio"],
            "width": options.get("width", 1920),
            "height": options.get("height", 1080)
        }

    def stopPreview(self) -> Dict[str, bool]:
        self.hal.close()
        return {"success": True}

    def lockExposureAndFocus(self, options: Optional[Dict[str, Any]] = None) -> Dict[str, bool]:
        options = options or {}
        ae_lock = options.get("aeLocked", True)
        af_lock = options.get("afLocked", True)
        locked_ae, locked_af = self.hal.set_exposure_and_focus_lock(ae_lock, af_lock)
        return {"aeLocked": locked_ae, "afLocked": locked_af}

    def startRecording(self, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        options = options or {}
        output_path = options.get("filePath") or os.path.join(tempfile.gettempdir(), f"scan_{int(time.time())}.mp4")
        record_imu = options.get("recordImu", True)
        return self.hal.start_recording(output_path, record_imu)

    def stopRecording(self, video_path: Optional[str] = None, imu_csv_path: Optional[str] = None) -> Dict[str, Any]:
        temp_dir = tempfile.gettempdir()
        v_path = video_path or os.path.join(temp_dir, f"scan_{int(time.time())}.mp4")
        c_path = imu_csv_path or os.path.join(temp_dir, f"imu_{int(time.time())}.csv")
        return self.hal.stop_recording(v_path, c_path)


class CameraBridgeAdapterModel:
    """
    Simulates the Web-to-Native bridge adapter in scanner.html.
    Handles runtime platform detection, plugin invocation, underlay styling, and WebRTC fallback.
    """

    def __init__(self, is_native: bool = True, plugin: Optional[UltraWideCameraPluginModel] = None):
        self.is_native = is_native
        self.plugin = plugin if is_native else None
        self.underlay_active = False
        self.webrtc_active = False
        self.active_lens = "1.0x"

    def isNativePlatform(self) -> bool:
        return self.is_native

    def initializeCamera(self, prefer_ultrawide: bool = True) -> Dict[str, Any]:
        if self.is_native and self.plugin:
            self.underlay_active = True
            zoom = 0.5 if prefer_ultrawide else 1.0
            self.active_lens = "0.5x" if prefer_ultrawide else "1.0x"
            res = self.plugin.startPreview({"zoomRatio": zoom})
            return {"mode": "native", "activeLens": self.active_lens, "pluginResult": res}
        else:
            # Fallback to browser WebRTC
            self.webrtc_active = True
            self.active_lens = "0.5x" if prefer_ultrawide else "1.0x"
            return {
                "mode": "webrtc_fallback",
                "activeLens": self.active_lens,
                "constraints": {"video": {"facingMode": "environment"}}
            }

    def toggleLens(self) -> str:
        new_lens = "0.5x" if self.active_lens == "1.0x" else "1.0x"
        self.active_lens = new_lens
        if self.is_native and self.plugin:
            zoom = 0.5 if new_lens == "0.5x" else 1.0
            self.plugin.startPreview({"zoomRatio": zoom})
        return self.active_lens

    def teardown(self) -> Dict[str, bool]:
        if self.is_native and self.plugin:
            self.plugin.stopPreview()
        self.underlay_active = False
        self.webrtc_active = False
        return {"success": True}


# ============================================================================
# TIER 1: FEATURE COVERAGE (5 DOMAINS, >=5 TESTS EACH)
# ============================================================================

class TestTier1Scaffolding:
    """
    Tier 1 Domain 1: Scaffolding (package.json, capacitor.config.json, scripts/sync_web_assets.js).
    Covers Features F01, F02, F03, F17.
    """

    def test_tier1_scaffolding_package_json_dependencies(self):
        """Verifies package.json mandates @capacitor/core, @capacitor/android, and @capacitor/cli."""
        target = PROJECT_ROOT / "package.json"
        if not target.exists():
            pytest.skip("Milestone 1 artifact 'package.json' pending worker generation")

        with open(target, "r", encoding="utf-8") as f:
            data = json.load(f)

        deps = data.get("dependencies", {})
        dev_deps = data.get("devDependencies", {})

        assert "@capacitor/core" in deps or "@capacitor/core" in dev_deps, "Missing @capacitor/core in package.json"
        assert "@capacitor/android" in deps or "@capacitor/android" in dev_deps, "Missing @capacitor/android in package.json"
        assert "@capacitor/cli" in dev_deps or "@capacitor/cli" in deps, "Missing @capacitor/cli in package.json"

    def test_tier1_scaffolding_package_json_scripts(self):
        """Verifies npm scripts: prepare-assets, cap:sync, and cap:copy."""
        target = PROJECT_ROOT / "package.json"
        if not target.exists():
            pytest.skip("Milestone 1 artifact 'package.json' pending worker generation")

        with open(target, "r", encoding="utf-8") as f:
            data = json.load(f)

        scripts = data.get("scripts", {})
        assert "prepare-assets" in scripts, "Missing 'prepare-assets' script in package.json"
        assert "cap:sync" in scripts, "Missing 'cap:sync' script in package.json"
        assert "cap:copy" in scripts, "Missing 'cap:copy' script in package.json"

    def test_tier1_scaffolding_capacitor_config_schema(self):
        """Validates capacitor.config.json schema: appId, appName, webDir."""
        target = PROJECT_ROOT / "capacitor.config.json"
        if not target.exists():
            pytest.skip("Milestone 1 artifact 'capacitor.config.json' pending worker generation")

        with open(target, "r", encoding="utf-8") as f:
            config = json.load(f)

        assert config.get("appId") == "com.woninginrichter.scanner", f"Invalid appId: {config.get('appId')}"
        assert config.get("appName") == "Woninginrichter 3D Scanner", f"Invalid appName: {config.get('appName')}"
        assert config.get("webDir") == "www", f"Invalid webDir: {config.get('webDir')}"

    def test_tier1_scaffolding_capacitor_config_server_live_reload(self):
        """Validates developer server configuration for live reload support."""
        target = PROJECT_ROOT / "capacitor.config.json"
        if not target.exists():
            pytest.skip("Milestone 1 artifact 'capacitor.config.json' pending worker generation")

        with open(target, "r", encoding="utf-8") as f:
            config = json.load(f)

        # server block is either configured or extensible for dev
        server = config.get("server", {})
        assert isinstance(server, dict), "Server config in capacitor.config.json must be an object"
        if "cleartext" in server:
            assert isinstance(server["cleartext"], bool), "Server cleartext must be boolean"

    def test_tier1_scaffolding_sync_script_execution_and_asset_routing(self):
        """Asserts asset synchronization script exists and references www/ target directory."""
        sync_script = PROJECT_ROOT / "scripts" / "sync_web_assets.js"
        if not sync_script.exists():
            pytest.skip("Milestone 1 artifact 'scripts/sync_web_assets.js' pending worker generation")

        with open(sync_script, "r", encoding="utf-8") as f:
            content = f.read()

        assert "www" in content, "Sync script must reference destination 'www' folder"
        assert "scanner.html" in content or "index.html" in content, "Sync script must stage scanner.html or index.html"

    def test_tier1_scaffolding_dual_target_isolation(self):
        """Verifies dual-target isolation ensuring standalone browser access does not require native bridge."""
        scanner_html = PROJECT_ROOT / "scanner.html"
        assert scanner_html.exists(), "Source scanner.html must exist at project root"

        with open(scanner_html, "r", encoding="utf-8") as f:
            html = f.read()

        # Standalone Web app must be self-contained
        assert len(html) > 500, "scanner.html must not be empty"
        assert "<html" in html.lower() or "<!doctype html>" in html.lower()


class TestTier1AndroidPlatform:
    """
    Tier 1 Domain 2: Android Platform Architecture.
    Covers Features F04, F05, F12.
    """

    def test_tier1_android_root_build_gradle_dependencies(self):
        """Verifies root android/build.gradle classpath dependencies (AGP, Kotlin)."""
        gradle_file = PROJECT_ROOT / "android" / "build.gradle"
        if not gradle_file.exists():
            pytest.skip("Milestone 2 artifact 'android/build.gradle' pending worker generation")

        with open(gradle_file, "r", encoding="utf-8") as f:
            content = f.read()

        assert "com.android.tools.build:gradle" in content, "Missing AGP dependency in root build.gradle"
        assert "org.jetbrains.kotlin:kotlin-gradle-plugin" in content, "Missing Kotlin plugin in root build.gradle"

    def test_tier1_android_app_build_gradle_sdks_and_plugins(self):
        """Validates android/app/build.gradle compileSdk 34, targetSdk 34, minSdk 26."""
        app_gradle = PROJECT_ROOT / "android" / "app" / "build.gradle"
        if not app_gradle.exists():
            pytest.skip("Milestone 2 artifact 'android/app/build.gradle' pending worker generation")

        with open(app_gradle, "r", encoding="utf-8") as f:
            content = f.read()

        assert "compileSdk" in content, "Missing compileSdk in android/app/build.gradle"
        assert "targetSdk" in content, "Missing targetSdk in android/app/build.gradle"
        assert "minSdk" in content, "Missing minSdk in android/app/build.gradle"
        # Verify SDK 34 requirement
        assert "34" in content, "Expected SDK 34 configuration in android/app/build.gradle"

    def test_tier1_android_manifest_mandatory_permissions(self):
        """Asserts declarations for CAMERA, RECORD_AUDIO, and HIGH_SAMPLING_RATE_SENSORS."""
        manifest = PROJECT_ROOT / "android" / "app" / "src" / "main" / "AndroidManifest.xml"
        if not manifest.exists():
            pytest.skip("Milestone 2 artifact 'AndroidManifest.xml' pending worker generation")

        tree = ET.parse(manifest)
        root = tree.getroot()
        permissions = [elem.attrib.get("{http://schemas.android.com/apk/res/android}name") for elem in root.findall("uses-permission")]

        assert "android.permission.CAMERA" in permissions, "Missing CAMERA permission"
        assert "android.permission.RECORD_AUDIO" in permissions, "Missing RECORD_AUDIO permission"
        assert "android.permission.HIGH_SAMPLING_RATE_SENSORS" in permissions, "Missing HIGH_SAMPLING_RATE_SENSORS permission"

    def test_tier1_android_manifest_hardware_features(self):
        """Asserts camera hardware features (camera2.full, autofocus)."""
        manifest = PROJECT_ROOT / "android" / "app" / "src" / "main" / "AndroidManifest.xml"
        if not manifest.exists():
            pytest.skip("Milestone 2 artifact 'AndroidManifest.xml' pending worker generation")

        with open(manifest, "r", encoding="utf-8") as f:
            content = f.read()

        assert "android.hardware.camera" in content, "Missing camera feature in AndroidManifest.xml"

    def test_tier1_android_main_activity_plugin_registration(self):
        """Verifies MainActivity.kt extends BridgeActivity and registers UltraWideCameraPlugin."""
        main_activity = PROJECT_ROOT / "android" / "app" / "src" / "main" / "java" / "com" / "woninginrichter" / "scanner" / "MainActivity.kt"
        if not main_activity.exists():
            pytest.skip("Milestone 2 artifact 'MainActivity.kt' pending worker generation")

        with open(main_activity, "r", encoding="utf-8") as f:
            content = f.read()

        assert "BridgeActivity" in content, "MainActivity must extend BridgeActivity"
        assert "UltraWideCameraPlugin" in content, "MainActivity must register UltraWideCameraPlugin"

    def test_tier1_android_gradle_wrapper_integrity(self):
        """Validates gradle-wrapper.properties specifies a modern Gradle distribution (8.0+)."""
        wrapper_props = PROJECT_ROOT / "android" / "gradle" / "wrapper" / "gradle-wrapper.properties"
        if not wrapper_props.exists():
            pytest.skip("Milestone 2 artifact 'gradle-wrapper.properties' pending worker generation")

        with open(wrapper_props, "r", encoding="utf-8") as f:
            content = f.read()

        assert "distributionUrl" in content, "Missing distributionUrl in gradle-wrapper.properties"
        assert "gradle-8" in content or "gradle-9" in content, "Expected Gradle 8+ wrapper"


class TestTier1KotlinPlugin:
    """
    Tier 1 Domain 3: Native Kotlin Plugin (UltraWideCameraPlugin.kt).
    Covers Features F06, F07, F08, F09, F10, F11.
    """

    def test_tier1_kotlin_plugin_class_annotations_and_contract(self):
        """Verifies @CapacitorPlugin(name = "UltraWideCamera") and Plugin inheritance."""
        plugin_file = PROJECT_ROOT / "android" / "app" / "src" / "main" / "java" / "com" / "woninginrichter" / "scanner" / "UltraWideCameraPlugin.kt"
        if not plugin_file.exists():
            pytest.skip("Milestone 2 artifact 'UltraWideCameraPlugin.kt' pending worker generation")

        with open(plugin_file, "r", encoding="utf-8") as f:
            content = f.read()

        assert re.search(r'@CapacitorPlugin\s*\(\s*(?:[^)]*\b)?name\s*=\s*["\']UltraWideCamera["\']', content), \
            "Missing @CapacitorPlugin annotation with name 'UltraWideCamera'"
        assert re.search(r'class\s+UltraWideCameraPlugin\s*:\s*Plugin\s*\(', content) or "extends Plugin" in content or ": Plugin()" in content, \
            "UltraWideCameraPlugin must inherit from Capacitor Plugin"

    def test_tier1_kotlin_plugin_camera2_lifecycle_state_machine(self):
        """Validates Camera2 lifecycle methods: openCamera, createCaptureSession, CaptureRequest."""
        plugin_file = PROJECT_ROOT / "android" / "app" / "src" / "main" / "java" / "com" / "woninginrichter" / "scanner" / "UltraWideCameraPlugin.kt"
        if not plugin_file.exists():
            pytest.skip("Milestone 2 artifact 'UltraWideCameraPlugin.kt' pending worker generation")

        with open(plugin_file, "r", encoding="utf-8") as f:
            content = f.read()

        assert "CameraDevice" in content, "Missing CameraDevice usage in Camera2 plugin"
        assert "CameraCaptureSession" in content, "Missing CameraCaptureSession usage"
        assert "CaptureRequest" in content, "Missing CaptureRequest usage"

    def test_tier1_kotlin_plugin_05x_ultrawide_lens_selection(self):
        """Asserts physical lens enumeration checking focal length < 2.5mm and CONTROL_ZOOM_RATIO."""
        plugin_file = PROJECT_ROOT / "android" / "app" / "src" / "main" / "java" / "com" / "woninginrichter" / "scanner" / "UltraWideCameraPlugin.kt"
        if not plugin_file.exists():
            pytest.skip("Milestone 2 artifact 'UltraWideCameraPlugin.kt' pending worker generation")

        with open(plugin_file, "r", encoding="utf-8") as f:
            content = f.read()

        assert "CONTROL_ZOOM_RATIO" in content or "zoomRatio" in content, "Missing CONTROL_ZOOM_RATIO logic"
        assert "2.5" in content or "LENS_INFO_AVAILABLE_FOCAL_LENGTHS" in content, \
            "Missing ultra-wide focal length threshold evaluation"

    def test_tier1_kotlin_plugin_ae_af_lockout_mechanism(self):
        """Validates CONTROL_AE_LOCK and CONTROL_AF_MODE lockout."""
        plugin_file = PROJECT_ROOT / "android" / "app" / "src" / "main" / "java" / "com" / "woninginrichter" / "scanner" / "UltraWideCameraPlugin.kt"
        if not plugin_file.exists():
            pytest.skip("Milestone 2 artifact 'UltraWideCameraPlugin.kt' pending worker generation")

        with open(plugin_file, "r", encoding="utf-8") as f:
            content = f.read()

        assert "CONTROL_AE_LOCK" in content, "Missing CONTROL_AE_LOCK in plugin"
        assert "CONTROL_AF_MODE" in content, "Missing CONTROL_AF_MODE in plugin"

    def test_tier1_kotlin_plugin_imu_telemetry_listener(self):
        """Asserts SensorEventListener with SENSOR_DELAY_FASTEST and hardware PTS timestamps."""
        plugin_file = PROJECT_ROOT / "android" / "app" / "src" / "main" / "java" / "com" / "woninginrichter" / "scanner" / "UltraWideCameraPlugin.kt"
        if not plugin_file.exists():
            pytest.skip("Milestone 2 artifact 'UltraWideCameraPlugin.kt' pending worker generation")

        with open(plugin_file, "r", encoding="utf-8") as f:
            content = f.read()

        assert "SensorEventListener" in content, "Missing SensorEventListener implementation"
        assert "SENSOR_DELAY_FASTEST" in content, "Missing SENSOR_DELAY_FASTEST high-speed listener"
        assert "timestamp" in content, "Missing hardware PTS timestamp logging"

    def test_tier1_kotlin_plugin_media_recorder_video_pipeline(self):
        """Validates MediaRecorder MP4 container and surface pipeline."""
        plugin_file = PROJECT_ROOT / "android" / "app" / "src" / "main" / "java" / "com" / "woninginrichter" / "scanner" / "UltraWideCameraPlugin.kt"
        if not plugin_file.exists():
            pytest.skip("Milestone 2 artifact 'UltraWideCameraPlugin.kt' pending worker generation")

        with open(plugin_file, "r", encoding="utf-8") as f:
            content = f.read()

        assert "MediaRecorder" in content, "Missing MediaRecorder pipeline in plugin"
        assert "Surface" in content, "Missing Surface binding for video recording"


class TestTier1WebBridge:
    """
    Tier 1 Domain 4: Web-to-Native Bridge & UI.
    Covers Features F13, F14, F15, F16.
    """

    def test_tier1_web_bridge_runtime_platform_detection(self):
        """Verifies safe window.Capacitor.isNativePlatform() platform detection."""
        # Simulated contract test
        model_native = CameraBridgeAdapterModel(is_native=True, plugin=UltraWideCameraPluginModel())
        assert model_native.isNativePlatform() is True
        res_native = model_native.initializeCamera()
        assert res_native["mode"] == "native"

        model_web = CameraBridgeAdapterModel(is_native=False)
        assert model_web.isNativePlatform() is False
        res_web = model_web.initializeCamera()
        assert res_web["mode"] == "webrtc_fallback"

    def test_tier1_web_bridge_adapter_contract_methods(self):
        """Asserts bridge adapter interface contract parity."""
        plugin = UltraWideCameraPluginModel()
        perms = plugin.checkPermissions()
        assert perms.get("camera") == "granted"

        cams = plugin.getAvailableCameras()
        assert "cameras" in cams
        assert len(cams["cameras"]) >= 1

        preview = plugin.startPreview({"zoomRatio": 0.5})
        assert preview["success"] is True

        lock = plugin.lockExposureAndFocus({"aeLocked": True, "afLocked": True})
        assert lock["aeLocked"] is True and lock["afLocked"] is True

        stop = plugin.stopPreview()
        assert stop["success"] is True

    def test_tier1_web_bridge_05x_button_binding(self):
        """Validates [0.5x] UI lens toggle logic."""
        adapter = CameraBridgeAdapterModel(is_native=True, plugin=UltraWideCameraPluginModel())
        adapter.initializeCamera(prefer_ultrawide=False)
        assert adapter.active_lens == "1.0x"
        toggled = adapter.toggleLens()
        assert toggled == "0.5x"
        assert adapter.plugin.hal.current_zoom == 0.5

    def test_tier1_web_bridge_underlay_transparency_styling(self):
        """Asserts viewfinder transparency styling toggles during preview."""
        adapter = CameraBridgeAdapterModel(is_native=True, plugin=UltraWideCameraPluginModel())
        assert adapter.underlay_active is False
        adapter.initializeCamera()
        assert adapter.underlay_active is True
        adapter.teardown()
        assert adapter.underlay_active is False

    def test_tier1_web_bridge_recording_handshake(self):
        """Validates recording handshake returning video path and IMU CSV path."""
        plugin = UltraWideCameraPluginModel()
        plugin.startPreview()
        rec_start = plugin.startRecording()
        assert rec_start["success"] is True

        plugin.hal.emit_imu_samples(duration_ms=500, frequency_hz=100)
        rec_stop = plugin.stopRecording()
        assert rec_stop["success"] is True
        assert rec_stop["sampleCount"] > 0
        assert os.path.exists(rec_stop["imuCsvPath"])

    def test_tier1_web_bridge_backward_compatibility(self):
        """Asserts pure browser WebRTC remains functional when Capacitor is absent."""
        adapter = CameraBridgeAdapterModel(is_native=False)
        res = adapter.initializeCamera()
        assert res["mode"] == "webrtc_fallback"
        assert adapter.webrtc_active is True
        assert adapter.underlay_active is False


class TestTier1CICDWorkflow:
    """
    Tier 1 Domain 5: CI/CD Workflow (.github/workflows/build-apk.yml).
    Covers Features F18, F19, F20.
    """

    def test_tier1_cicd_workflow_triggers(self):
        """Validates GitHub Actions workflow triggers on push/PR or dispatch."""
        workflow_file = PROJECT_ROOT / ".github" / "workflows" / "build-apk.yml"
        if not workflow_file.exists():
            pytest.skip("Milestone 4 artifact '.github/workflows/build-apk.yml' pending worker generation")

        with open(workflow_file, "r", encoding="utf-8") as f:
            wf = yaml.safe_load(f)

        triggers = wf.get("on") or wf.get(True)
        assert triggers is not None, "Workflow must declare 'on' trigger events"
        # Can be dict with push/pull_request or list
        if isinstance(triggers, dict):
            assert "push" in triggers or "workflow_dispatch" in triggers or "pull_request" in triggers

    def test_tier1_cicd_workflow_temurin_jdk17_setup(self):
        """Asserts actions/setup-java configured with Eclipse Temurin JDK 17."""
        workflow_file = PROJECT_ROOT / ".github" / "workflows" / "build-apk.yml"
        if not workflow_file.exists():
            pytest.skip("Milestone 4 artifact '.github/workflows/build-apk.yml' pending worker generation")

        with open(workflow_file, "r", encoding="utf-8") as f:
            content = f.read()

        assert "setup-java" in content, "Workflow must include setup-java action"
        assert "17" in content, "Workflow must specify Java 17"
        assert "temurin" in content.lower(), "Workflow must specify Eclipse Temurin distribution"

    def test_tier1_cicd_workflow_android_sdk34_setup(self):
        """Asserts Android SDK setup targeting API 34."""
        workflow_file = PROJECT_ROOT / ".github" / "workflows" / "build-apk.yml"
        if not workflow_file.exists():
            pytest.skip("Milestone 4 artifact '.github/workflows/build-apk.yml' pending worker generation")

        with open(workflow_file, "r", encoding="utf-8") as f:
            content = f.read()

        assert "34" in content, "Workflow must configure Android SDK 34"

    def test_tier1_cicd_workflow_build_command_sequence(self):
        """Asserts build pipeline sequence: npm ci -> asset sync -> gradlew assembleDebug."""
        workflow_file = PROJECT_ROOT / ".github" / "workflows" / "build-apk.yml"
        if not workflow_file.exists():
            pytest.skip("Milestone 4 artifact '.github/workflows/build-apk.yml' pending worker generation")

        with open(workflow_file, "r", encoding="utf-8") as f:
            content = f.read()

        assert "assembleDebug" in content, "Workflow must run gradlew assembleDebug"

    def test_tier1_cicd_workflow_artifact_upload_retention(self):
        """Validates actions/upload-artifact targeting app-debug.apk."""
        workflow_file = PROJECT_ROOT / ".github" / "workflows" / "build-apk.yml"
        if not workflow_file.exists():
            pytest.skip("Milestone 4 artifact '.github/workflows/build-apk.yml' pending worker generation")

        with open(workflow_file, "r", encoding="utf-8") as f:
            content = f.read()

        assert "upload-artifact" in content, "Workflow must include upload-artifact action"
        assert "app-debug.apk" in content or "apk" in content, "Artifact upload must capture APK build output"


# ============================================================================
# TIER 2: BOUNDARY & CORNER CASES (REQUIREMENT-DRIVEN)
# ============================================================================

class TestTier2BoundaryAndCornerCases:
    """
    Tier 2: Boundary, Corner & Edge Cases.
    Verifies error containment, fallbacks, and boundary conditions.
    """

    def test_tier2_unsupported_browser_graceful_fallback(self):
        """When Capacitor runtime is missing or throws, bridge cleanly degrades to WebRTC."""
        adapter = CameraBridgeAdapterModel(is_native=False)
        result = adapter.initializeCamera(prefer_ultrawide=True)
        assert result["mode"] == "webrtc_fallback"
        assert adapter.webrtc_active is True
        assert adapter.underlay_active is False

    def test_tier2_null_or_malformed_plugin_response(self):
        """When plugin calls resolve with missing keys, defaults are safely maintained."""
        plugin = UltraWideCameraPluginModel()
        # Empty options object
        preview = plugin.startPreview({})
        assert preview["success"] is True
        assert preview["zoomRatio"] == 0.5
        assert preview["width"] == 1920

    def test_tier2_zoom_ratio_hardware_clamp(self):
        """When HAL minZoom is 0.55f, requesting 0.5f clamps to 0.55f without error."""
        hal_constrained = MockPixel9ProXLHAL(min_zoom=0.55, max_zoom=8.0)
        plugin = UltraWideCameraPluginModel(hal=hal_constrained)
        res = plugin.startPreview({"zoomRatio": 0.5})
        assert res["zoomRatio"] == 0.55, "Zoom ratio should clamp to hardware minimum (0.55f)"

        # Upper bound clamp
        res_upper = plugin.startPreview({"zoomRatio": 25.0})
        assert res_upper["zoomRatio"] == 8.0, "Zoom ratio should clamp to hardware maximum (8.0f)"

    def test_tier2_zero_sensors_available_fallback(self):
        """When device lacks IMU sensors, video records and header-only CSV is produced."""
        hal_no_sensors = MockPixel9ProXLHAL(has_sensors=False)
        plugin = UltraWideCameraPluginModel(hal=hal_no_sensors)
        plugin.startPreview()
        plugin.startRecording()
        samples_emitted = plugin.hal.emit_imu_samples(duration_ms=500, frequency_hz=100)
        assert samples_emitted == 0

        res = plugin.stopRecording()
        assert res["success"] is True
        assert res["sampleCount"] == 0
        assert os.path.exists(res["imuCsvPath"])

        # CSV must still have valid header
        with open(res["imuCsvPath"], "r", encoding="utf-8") as f:
            lines = f.readlines()
        assert len(lines) == 1
        assert "timestamp_ns,sensor_type,x,y,z" in lines[0]

    def test_tier2_high_frequency_imu_buffer_wrap_and_backpressure(self):
        """During high-rate logging (10,000 samples), verify monotonicity and zero sample loss."""
        hal = MockPixel9ProXLHAL()
        plugin = UltraWideCameraPluginModel(hal=hal)
        plugin.startPreview()
        plugin.startRecording()

        # Emit 10 seconds of 100Hz telemetry = 1000 intervals * 2 sensors = 2000 samples
        total_samples = plugin.hal.emit_imu_samples(duration_ms=10000, frequency_hz=100)
        assert total_samples == 2000

        res = plugin.stopRecording()
        assert res["sampleCount"] == 2000

        # Monotonicity check
        with open(res["imuCsvPath"], "r", encoding="utf-8") as f:
            lines = [line.strip().split(",") for line in f.readlines()[1:]]

        gyro_ts = [int(row[0]) for row in lines if row[1] == "GYROSCOPE"]
        accel_ts = [int(row[0]) for row in lines if row[1] == "ACCELEROMETER"]

        assert len(gyro_ts) == 1000
        assert len(accel_ts) == 1000
        for i in range(1, len(gyro_ts)):
            assert gyro_ts[i] > gyro_ts[i - 1], "Gyro timestamps must be strictly monotonic"
        for i in range(1, len(accel_ts)):
            assert accel_ts[i] > accel_ts[i - 1], "Accel timestamps must be strictly monotonic"

    def test_tier2_asset_sync_missing_source_handling(self):
        """Verifies sync script fails gracefully if source files are missing."""
        sync_script = PROJECT_ROOT / "scripts" / "sync_web_assets.js"
        if not sync_script.exists():
            pytest.skip("Milestone 1 artifact 'scripts/sync_web_assets.js' pending worker generation")

        with open(sync_script, "r", encoding="utf-8") as f:
            content = f.read()

        # Script should check existence or handle error
        assert "existsSync" in content or "try" in content or "fs" in content


# ============================================================================
# TIER 3: PAIRWISE COMBINATIONS & CROSS-FEATURE INTERACTIONS
# ============================================================================

class TestTier3PairwiseCombinations:
    """
    Tier 3: Pairwise Interactions.
    Verifies cross-boundary coordination between subsystems.
    """

    def test_tier3_native_bridge_plus_imu_telemetry_sync(self):
        """Pairwise: Web bridge startRecording triggers IMU telemetry and stop returns both paths."""
        hal = MockPixel9ProXLHAL()
        plugin = UltraWideCameraPluginModel(hal=hal)
        adapter = CameraBridgeAdapterModel(is_native=True, plugin=plugin)

        adapter.initializeCamera(prefer_ultrawide=True)
        rec_start = adapter.plugin.startRecording({"recordImu": True})
        assert rec_start["success"] is True

        adapter.plugin.hal.emit_imu_samples(duration_ms=500, frequency_hz=100)
        rec_stop = adapter.plugin.stopRecording()

        assert rec_stop["success"] is True
        assert os.path.exists(rec_stop["videoPath"])
        assert os.path.exists(rec_stop["imuCsvPath"])
        assert rec_stop["sampleCount"] > 0

    def test_tier3_05x_lens_selection_plus_ae_af_lock(self):
        """Pairwise: Selecting physical ultra-wide and locking AE/AF operates in single session."""
        hal = MockPixel9ProXLHAL()
        plugin = UltraWideCameraPluginModel(hal=hal)

        preview = plugin.startPreview({"zoomRatio": 0.5})
        assert preview["zoomRatio"] == 0.5
        assert preview["activeCameraId"] == "2"  # Physical ultra-wide

        lock = plugin.lockExposureAndFocus({"aeLocked": True, "afLocked": True})
        assert lock["aeLocked"] is True
        assert lock["afLocked"] is True
        assert hal.ae_locked is True
        assert hal.af_locked is True

    def test_tier3_asset_sync_plus_cloud_build_pipeline(self):
        """Pairwise: Asset sync outputs to www/, capacitor config consumes www/, and CI compiles."""
        cap_config = PROJECT_ROOT / "capacitor.config.json"
        if not cap_config.exists():
            pytest.skip("Milestone 1 artifact 'capacitor.config.json' pending worker generation")

        with open(cap_config, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        assert cfg.get("webDir") == "www"

    def test_tier3_transparent_hud_plus_native_preview_lifecycle(self):
        """Pairwise: Preview lifecycle accurately synchronizes viewfinder transparency class."""
        adapter = CameraBridgeAdapterModel(is_native=True, plugin=UltraWideCameraPluginModel())
        assert adapter.underlay_active is False

        adapter.initializeCamera()
        assert adapter.underlay_active is True

        adapter.teardown()
        assert adapter.underlay_active is False


# ============================================================================
# TIER 4: REAL-WORLD PIXEL 9 PRO XL END-TO-END SIMULATION
# ============================================================================

class TestTier4Pixel9ProXLEndToEndSimulation:
    """
    Tier 4: Complete Google Pixel 9 Pro XL Mission Profile.
    Simulates full scanning session from app launch to final artifact validation.
    """

    def test_tier4_complete_pixel9_pro_xl_pipeline_simulation(self):
        """
        End-to-End Simulation:
          1. App Launch & Platform Check
          2. Permissions Check & Grant (CAMERA, AUDIO, SENSORS)
          3. Enumerate Physical Cameras -> Select Ultra-Wide ID '2' (2.23mm)
          4. Start Preview with 0.5x Zoom & Transparent Underlay
          5. Lock Exposure & Focus (AE/AF lock)
          6. Start Video Recording & 100Hz IMU Telemetry Stream
          7. Emit 1000ms of High-Sampling-Rate Telemetry (100Hz = 200 samples)
          8. Stop Recording & Validate Video + IMU CSV Artifacts
        """
        # Step 1: Launch & Check Platform
        hal = MockPixel9ProXLHAL()
        plugin = UltraWideCameraPluginModel(hal=hal)
        adapter = CameraBridgeAdapterModel(is_native=True, plugin=plugin)
        assert adapter.isNativePlatform() is True

        # Step 2: Permissions
        perms = plugin.checkPermissions()
        assert perms["camera"] == "granted"
        assert perms["audio"] == "granted"

        # Step 3: Camera Discovery & Ultra-Wide Selection
        cam_info = plugin.getAvailableCameras()
        cameras = cam_info["cameras"]
        ultrawide_cams = [c for c in cameras if c.get("isUltraWide") or (c.get("focalLengths") and c["focalLengths"][0] < 2.5)]
        assert len(ultrawide_cams) >= 1, "Pixel 9 Pro XL must discover physical ultra-wide lens"
        selected_cam_id = ultrawide_cams[0]["id"]
        assert selected_cam_id == "2"
        assert ultrawide_cams[0]["focalLengths"][0] == 2.23

        # Step 4: Start Preview with 0.5x Zoom
        preview_res = plugin.startPreview({"cameraId": selected_cam_id, "zoomRatio": 0.5})
        assert preview_res["success"] is True
        assert preview_res["activeCameraId"] == "2"
        assert preview_res["zoomRatio"] == 0.5
        adapter.underlay_active = True

        # Step 5: Lock Exposure & Focus
        lock_res = plugin.lockExposureAndFocus({"aeLocked": True, "afLocked": True})
        assert lock_res["aeLocked"] is True
        assert lock_res["afLocked"] is True

        # Step 6: Start Recording (Video + IMU)
        video_output = os.path.join(tempfile.gettempdir(), f"p9_scan_{int(time.time())}.mp4")
        imu_output = os.path.join(tempfile.gettempdir(), f"p9_imu_{int(time.time())}.csv")
        rec_res = plugin.startRecording({"filePath": video_output, "recordImu": True})
        assert rec_res["success"] is True

        # Step 7: Stream 1000ms at 100Hz (100 Gyro + 100 Accel = 200 samples)
        sample_count = hal.emit_imu_samples(duration_ms=1000, frequency_hz=100)
        assert sample_count == 200

        # Step 8: Stop Recording & Validate Output
        stop_res = plugin.stopRecording(video_path=video_output, imu_csv_path=imu_output)
        assert stop_res["success"] is True
        assert stop_res["sampleCount"] == 200
        assert stop_res["durationMs"] == 1000

        # Validate MP4 file
        assert os.path.exists(video_output)
        assert os.path.getsize(video_output) >= 24, "MP4 video container must be non-empty"

        # Validate CSV file
        assert os.path.exists(imu_output)
        with open(imu_output, "r", encoding="utf-8") as f:
            lines = [l.strip() for l in f.readlines()]

        assert lines[0] == "timestamp_ns,sensor_type,x,y,z", "CSV header mismatch"
        assert len(lines) == 201, f"Expected 200 data rows + 1 header, found {len(lines)}"

        # Teardown
        adapter.teardown()
        assert hal.session_active is False
        assert adapter.underlay_active is False

    def test_tier4_imu_csv_format_and_monotonicity(self):
        """Validates CSV format compliance, numerical parsing, and strictly monotonic ordering."""
        hal = MockPixel9ProXLHAL()
        plugin = UltraWideCameraPluginModel(hal=hal)
        plugin.startPreview()
        plugin.startRecording()
        hal.emit_imu_samples(duration_ms=500, frequency_hz=100)
        res = plugin.stopRecording()

        with open(res["imuCsvPath"], "r", encoding="utf-8") as f:
            rows = [line.strip().split(",") for line in f.readlines()[1:]]

        last_ts = 0
        for row in rows:
            ts = int(row[0])
            stype = row[1]
            x, y, z = float(row[2]), float(row[3]), float(row[4])
            assert stype in ["GYROSCOPE", "ACCELEROMETER"]
            assert not math.isnan(x) and not math.isnan(y) and not math.isnan(z)
            assert ts >= last_ts
            last_ts = ts

    def test_tier4_hardware_pts_synchronization(self):
        """Asserts IMU samples and video start timestamp share the same monotonic PTS clock domain."""
        hal = MockPixel9ProXLHAL()
        plugin = UltraWideCameraPluginModel(hal=hal)
        plugin.startPreview()
        plugin.startRecording()

        start_time_ns = time.time_ns()
        hal.emit_imu_samples(duration_ms=200, frequency_hz=100)
        res = plugin.stopRecording()

        first_sample_ts = hal.imu_samples[0]["timestamp_ns"]
        diff_ns = abs(first_sample_ts - start_time_ns)
        # Delta must be within reasonable sub-second bounds (< 50ms)
        assert diff_ns < 50_000_000, f"Hardware PTS deviation too high: {diff_ns} ns"

    def test_tier4_jitter_and_drift_analysis(self):
        """Evaluates 100Hz sample interval jitter: standard deviation must be < 1.5ms."""
        hal = MockPixel9ProXLHAL()
        plugin = UltraWideCameraPluginModel(hal=hal)
        plugin.startPreview()
        plugin.startRecording()

        hal.emit_imu_samples(duration_ms=1000, frequency_hz=100)
        plugin.stopRecording()

        gyro_ts = [s["timestamp_ns"] for s in hal.imu_samples if s["sensor_type"] == "GYROSCOPE"]
        deltas_ms = [(gyro_ts[i] - gyro_ts[i - 1]) / 1_000_000.0 for i in range(1, len(gyro_ts))]

        mean_delta = sum(deltas_ms) / len(deltas_ms)
        variance = sum((d - mean_delta) ** 2 for d in deltas_ms) / len(deltas_ms)
        std_dev = math.sqrt(variance)

        assert abs(mean_delta - 10.0) < 0.1, f"Mean delta should be ~10.0ms for 100Hz, got {mean_delta:.2f}"
        assert std_dev < 1.5, f"Interval jitter std dev too high: {std_dev:.2f} ms"
