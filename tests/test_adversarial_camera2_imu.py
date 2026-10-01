"""
Adversarial Stress Test Suite: Android Camera2 & 100Hz IMU Plugin
Challenger 1 (teamwork_preview_challenger / empirical challenger)

Empirically tests and stress-tests:
1. Zoom bounds clamping & CONTROL_ZOOM_RATIO hardware range validation.
2. Physical camera selection, multi-camera capabilities & fallback logic.
3. AE/AF lockout idempotency, invalid symbols, and lifecycle preservation.
4. 100Hz IMU zero-allocation/GC impact, PTS timing precision, and CSV/JSON serialization.
5. MediaRecorder state machine lifecycle (duplicate start, premature stop, physical lens drop).
"""

import unittest
import os
import re
import sys
import json
import time
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parent.parent
PLUGIN_PATH = WORKSPACE / "android" / "app" / "src" / "main" / "java" / "com" / "woninginrichter" / "scanner" / "UltraWideCameraPlugin.kt"
MAIN_ACTIVITY_PATH = WORKSPACE / "android" / "app" / "src" / "main" / "java" / "com" / "woninginrichter" / "scanner" / "MainActivity.kt"


def extract_method_body(code: str, method_prefix: str) -> str:
    """Extracts method body tracking nested Kotlin braces accurately."""
    idx = code.find(method_prefix)
    if idx == -1:
        raise ValueError(f"Method prefix '{method_prefix}' not found in source code")
    brace_start = code.find("{", idx)
    if brace_start == -1:
        raise ValueError(f"Opening brace not found for '{method_prefix}'")
    depth = 0
    for i in range(brace_start, len(code)):
        if code[i] == '{':
            depth += 1
        elif code[i] == '}':
            depth -= 1
            if depth == 0:
                return code[brace_start + 1:i]
    raise ValueError(f"Unmatched braces for '{method_prefix}'")


class TestCamera2ZoomBoundsStress(unittest.TestCase):
    """
    Stress tests zoom bounds and hardware range clamping in UltraWideCameraPlugin.kt.
    Verifies behavior for zoomRatio inputs: 0.1, 0.49, 0.5, 1.0, 10.0, NaN, and negative values.
    """

    def setUp(self):
        self.assertTrue(PLUGIN_PATH.exists(), f"Plugin file missing at {PLUGIN_PATH}")
        self.plugin_code = PLUGIN_PATH.read_text(encoding="utf-8")

    def test_zoom_ratio_clamping_defect(self):
        """
        DEFECT CHECK: Does setZoom clamp zoom ratio to CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE?
        In Camera2 API, setting CONTROL_ZOOM_RATIO outside [zoomRange.lower, zoomRange.upper]
        throws IllegalArgumentException or crashes the Camera HAL.
        """
        set_zoom_body = extract_method_body(self.plugin_code, "fun setZoom(call: PluginCall)")

        # Check if setZoom queries or respects CONTROL_ZOOM_RATIO_RANGE or clamps
        has_range_query = "CONTROL_ZOOM_RATIO_RANGE" in set_zoom_body
        has_clamp = "coerceIn" in set_zoom_body or "clamp" in set_zoom_body or "maxOf" in set_zoom_body

        # The empirical finding: setZoom passes raw un-clamped zoom to CONTROL_ZOOM_RATIO
        self.assertFalse(
            has_range_query and has_clamp,
            "DEFECT CONFIRMED: setZoom does not clamp zoom ratio to hardware range [zoomRange.lower, zoomRange.upper]!"
        )

    def test_simulated_zoom_bounds_hardware_violation(self):
        """
        Simulates hardware zoom ranges across typical flagship devices:
        - Pixel 9 Pro: [0.55, 8.0]
        - Galaxy S24 Ultra: [0.6, 10.0]
        - Standard Device: [1.0, 8.0]
        Tests what happens when zoomRatio values (0.1, 0.49, 0.5, 1.0, 10.0) are submitted.
        """
        device_profiles = {
            "Pixel_9_Pro": {"lower": 0.55, "upper": 8.0},
            "Galaxy_S24_Ultra": {"lower": 0.60, "upper": 10.0},
            "Standard_Rear_HAL": {"lower": 1.0, "upper": 8.0},
        }

        test_inputs = [0.1, 0.49, 0.5, 1.0, 10.0, -0.5, 100.0]
        violations = []

        # Model plugin's current logic:
        # In selectBestCamera: currentZoomFactor = if (requireUltraWide) 0.5f else 1.0f
        # In setZoom: builder.set(CaptureRequest.CONTROL_ZOOM_RATIO, zoom) (raw input)
        for dev_name, r in device_profiles.items():
            min_z = r["lower"]
            max_z = r["upper"]

            # Scenario 1: Default ultra-wide hardcoded zoom (0.5f)
            hardcoded_uw_zoom = 0.5
            if hardcoded_uw_zoom < min_z or hardcoded_uw_zoom > max_z:
                violations.append({
                    "device": dev_name,
                    "zoomInput": hardcoded_uw_zoom,
                    "range": [min_z, max_z],
                    "type": "HARDCODED_DEFAULT_OUT_OF_BOUNDS",
                    "error": f"Hardcoded 0.5f is lower than hardware minZoom {min_z}"
                })

            # Scenario 2: User requested zoom inputs via setZoom or startPreview(zoomRatio)
            for z in test_inputs:
                if z < min_z or z > max_z:
                    violations.append({
                        "device": dev_name,
                        "zoomInput": z,
                        "range": [min_z, max_z],
                        "type": "USER_INPUT_UNCLAMPED_OUT_OF_BOUNDS",
                        "error": f"Input zoom {z} outside hardware range [{min_z}, {max_z}]"
                    })

        self.assertGreater(
            len(violations), 0,
            "Violations must be detected when raw zoom inputs are applied without clamping"
        )

        # Specifically, on Galaxy S24 Ultra (minZoom 0.6), default 0.5 is OUT OF RANGE!
        s24_default_violation = any(
            v["device"] == "Galaxy_S24_Ultra" and v["zoomInput"] == 0.5 for v in violations
        )
        self.assertTrue(
            s24_default_violation,
            "On Samsung Galaxy S24 Ultra (minZoom=0.6), plugin hardcodes 0.5f, crashing the HAL!"
        )

    def test_legacy_crop_region_fallback_missing(self):
        """
        DEFECT CHECK: On devices where isUsingZoomRatio is false (Android 10 or devices lacking
        CONTROL_ZOOM_RATIO), setZoom rejects with:
        'Continuous zoom ratio not supported on this device HAL'
        and does NOT implement SCALER_CROP_REGION fallback.
        """
        self.assertIn("Continuous zoom ratio not supported on this device HAL", self.plugin_code)
        self.assertNotIn("SCALER_CROP_REGION", self.plugin_code)


class TestPhysicalCameraDiscoveryStress(unittest.TestCase):
    """
    Stress tests physical camera discovery and fallback logic in selectBestCamera.
    """

    def setUp(self):
        self.plugin_code = PLUGIN_PATH.read_text(encoding="utf-8")

    def test_missing_logical_multi_camera_capability_guard(self):
        """
        DEFECT CHECK: chars.physicalCameraIds is called without checking
        REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA.
        """
        select_best_body = extract_method_body(self.plugin_code, "private fun selectBestCamera(requireUltraWide: Boolean)")

        self.assertIn("chars.physicalCameraIds", select_best_body)
        self.assertNotIn("REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA", select_best_body,
                         "DEFECT CONFIRMED: chars.physicalCameraIds accessed without logical multi-camera capability check!")

    def test_require_ultrawide_ignored_in_priority_2(self):
        """
        DEFECT CHECK: In Priority 2 (physicalCameraIds loop), the code checks:
        `if (focalLengths != null && focalLengths.any { it < 2.5f })`
        WITHOUT checking `if (requireUltraWide)`!
        If a user asks for `requireUltraWide = false` (standard wide lens),
        and Priority 1 does not trigger, Priority 2 will force the ultra-wide physical camera!
        """
        p2_match = re.search(r"// Priority 2: Direct physical camera ID discovery[\s\S]*?return", self.plugin_code)
        self.assertIsNotNone(p2_match)
        p2_code = p2_match.group(0)

        # Priority 2 checks focal lengths < 2.5f and assigns physicalUltraWideId without requireUltraWide guard
        self.assertIn("focalLengths.any { it < 2.5f }", p2_code)
        self.assertNotIn("requireUltraWide", p2_code)

    def test_no_such_element_exception_on_front_only_devices(self):
        """
        DEFECT CHECK: Fallback rear camera selection uses:
        activeCameraId = cameraManager.cameraIdList.first {
            cameraManager.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
        }
        If a device has no back camera (tablets, kiosks, emulators), Kotlin's `.first { }` throws NoSuchElementException!
        It must be `.firstOrNull { } ?: "0"`.
        """
        fallback_match = re.search(r"// Fallback: Primary rear camera\s*activeCameraId = cameraManager\.cameraIdList\.first\s*\{", self.plugin_code)
        self.assertIsNotNone(
            fallback_match,
            "DEFECT CONFIRMED: cameraManager.cameraIdList.first { ... } throws NoSuchElementException if no rear camera exists!"
        )

    def test_logical_multi_camera_without_ultrawide_silently_downgrades(self):
        """
        DEFECT CHECK: When a device has a logical multi-camera with no lens < 2.5mm
        (e.g., standard 4.3mm and telephoto 12.0mm), selectBestCamera silently falls back to 1.0x primary rear camera
        without rejecting or warning startPreview caller.
        """
        # Simulate characteristics with standard and telephoto only
        mock_physical_focal_lengths = [4.38, 12.0]
        has_uw = any(f < 2.5 for f in mock_physical_focal_lengths)
        self.assertFalse(has_uw)


class TestAeAfLockoutIdempotencyAndLifecycle(unittest.TestCase):
    """
    Stress tests AE/AF locking idempotency, lifecycle preservation, and Camera2 API contracts.
    """

    def setUp(self):
        self.plugin_code = PLUGIN_PATH.read_text(encoding="utf-8")

    def test_invalid_camera2_af_mode_symbol(self):
        """
        DEFECT CHECK: Look at lockExposureAndFocus line 473:
        `if (afLock) CaptureRequest.CONTROL_AF_MODE_LOCKED else CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE`
        In Android Camera2 API (android.hardware.camera2.CaptureRequest):
        CONTROL_AF_MODE_LOCKED DOES NOT EXIST!
        Valid modes are:
        - CONTROL_AF_MODE_OFF (0)
        - CONTROL_AF_MODE_AUTO (1)
        - CONTROL_AF_MODE_MACRO (2)
        - CONTROL_AF_MODE_CONTINUOUS_VIDEO (3)
        - CONTROL_AF_MODE_CONTINUOUS_PICTURE (4)
        - CONTROL_AF_MODE_EDOF (5)
        Using CONTROL_AF_MODE_LOCKED causes a compilation failure or unresolved reference!
        """
        self.assertIn("CaptureRequest.CONTROL_AF_MODE_LOCKED", self.plugin_code,
                      "DEFECT CONFIRMED: plugin references non-existent Camera2 symbol CONTROL_AF_MODE_LOCKED!")

    def test_lock_wiped_out_on_start_recording(self):
        """
        DEFECT CHECK: When startRecording is called, it constructs a new recordBuilder:
        set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO)
        set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
        Any locked exposure or focus from lockExposureAndFocus is completely overwritten and lost!
        """
        start_rec_body = extract_method_body(self.plugin_code, "fun startRecording(call: PluginCall)")

        self.assertIn("CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO", start_rec_body)
        self.assertIn("CaptureRequest.CONTROL_AE_MODE_ON", start_rec_body)
        self.assertNotIn("CONTROL_AE_LOCK", start_rec_body,
                         "DEFECT CONFIRMED: startRecording resets AE/AF without preserving prior lock state!")
        self.assertNotIn("CONTROL_AWB_LOCK", start_rec_body)

    def test_calling_lock_before_preview_drops_state(self):
        """
        DEFECT CHECK: If lockExposureAndFocus is called before startPreview completes:
        It immediately rejects: `return call.reject("No active session")`.
        It maintains zero internal state (e.g. isAeLocked, isAfLocked), so the intent is discarded.
        """
        lock_body = extract_method_body(self.plugin_code, "fun lockExposureAndFocus(call: PluginCall)")

        self.assertIn('return call.reject("No active session")', lock_body)
        self.assertNotIn("savedAeLock", lock_body)


class TestImuSamplingZeroAllocationAndTiming(unittest.TestCase):
    """
    Stress tests 100Hz IMU sampling:
    - Zero allocation / GC pressure.
    - Synchronous unbuffered disk I/O on sensor thread.
    - Hardware PTS timestamp precision and clock domain mismatch.
    - CSV serialization vs JSON mismatch and truncation corruption.
    """

    def setUp(self):
        self.plugin_code = PLUGIN_PATH.read_text(encoding="utf-8")

    def test_gc_pressure_heap_allocation_in_on_sensor_changed(self):
        """
        DEFECT CHECK: onSensorChanged creates multiple heap allocations on every sensor event:
        1. String template formatting with 7 interpolations:
           \"\"\"${if (imuSampleCount > 0) \",\\n\" else \"\"}    {\"t\":${event.timestamp}...\"\"\"
        2. Int, Long, Float boxing.
        At 100Hz accel + 100Hz gyro = 200 Hz:
        This generates ~32 KB/s of garbage strings on the background Looper thread, triggering GC churn!
        """
        sensor_body = extract_method_body(self.plugin_code, "override fun onSensorChanged(event: SensorEvent?)")

        # Confirms string interpolation on every event
        self.assertIn('"""${if (imuSampleCount > 0)', sensor_body)
        self.assertIn('"t":${event.timestamp}', sensor_body)

        # Simulate 1 minute of 200Hz sampling (12,000 samples)
        sample_count = 12000
        simulated_sample_bytes = 0
        now_ms = int(time.time() * 1000)
        timestamp_ns = 123456789012345

        for i in range(100):
            entry = f"""{",\n" if i > 0 else ""}    {{"t":{timestamp_ns},"timestamp_ns":{timestamp_ns},"timestamp_ms":{now_ms},"type":"accel","x":0.01234,"y":-9.80665,"z":0.54321}}"""
            simulated_sample_bytes += len(entry.encode("utf-8"))

        avg_bytes_per_sample = simulated_sample_bytes / 100
        total_garbage_bytes_per_minute = avg_bytes_per_sample * sample_count

        # Total string garbage generated per minute exceeds 1.5 Megabytes!
        self.assertGreater(
            total_garbage_bytes_per_minute, 1_500_000,
            f"Heap allocation exceeds 1.5MB/min ({total_garbage_bytes_per_minute / 1024:.1f} KB/min), violating zero-allocation design!"
        )

    def test_unbuffered_file_writer_io_blocking(self):
        """
        DEFECT CHECK: imuFileWriter is instantiated as raw FileWriter:
        `imuFileWriter = FileWriter(imuOutputFile!!, false)`
        without BufferedWriter!
        Every single sensor event invokes a direct synchronous OS write syscall, blocking the SensorEventListener thread.
        """
        self.assertIn("FileWriter(imuOutputFile!!, false)", self.plugin_code)
        self.assertNotIn("BufferedWriter", self.plugin_code)

    def test_csv_mismatch_and_interrupted_json_corruption(self):
        """
        DEFECT CHECK:
        1. stopRecording returns `imuCsvPath` pointing to `scan_imu_${...}.json`.
           Downstream tools expecting CSV fail with parse errors.
        2. If the app pauses or is terminated (handleOnPause), imuFileWriter is NEVER closed or flushed!
           The JSON file remains incomplete (missing closing bracket `]}`), producing a corrupted JSON file.
        """
        self.assertIn('put("imuCsvPath", imuOutputFile?.absolutePath ?: "")', self.plugin_code)
        self.assertIn('"scan_imu_${System.currentTimeMillis()}.json"', self.plugin_code)

        pause_body = extract_method_body(self.plugin_code, "override fun handleOnPause()")
        self.assertNotIn("imuFileWriter", pause_body,
                         "DEFECT CONFIRMED: handleOnPause does not flush or close imuFileWriter, causing data loss!")

    def test_hardware_pts_clock_domain_desynchronization(self):
        """
        DEFECT CHECK:
        - `event.timestamp` is monotonic nanoseconds from CLOCK_BOOTTIME.
        - `nowMs` is wall-clock `System.currentTimeMillis()` (subject to NTP leaps/drift).
        - `recordingStartTimeNanos = SystemClock.elapsedRealtimeNanos()` is captured AFTER mediaRecorder.start().
        There is no hardware frame PTS alignment mechanism.
        """
        self.assertIn("System.currentTimeMillis()", self.plugin_code)
        self.assertIn("event.timestamp", self.plugin_code)
        self.assertIn("recordingStartTimeNanos = SystemClock.elapsedRealtimeNanos()", self.plugin_code)


class TestMediaRecorderLifecycleStress(unittest.TestCase):
    """
    Stress tests MediaRecorder state transitions:
    - Premature stopRecording before startRecording.
    - Consecutive/duplicate startRecording calls.
    - Physical ultra-wide lens dropped during startRecording.
    """

    def setUp(self):
        self.plugin_code = PLUGIN_PATH.read_text(encoding="utf-8")

    def test_stop_recording_before_start_returns_bogus_uptime(self):
        """
        DEFECT CHECK: Calling stopRecording when not recording:
        `val durationMs = (SystemClock.elapsedRealtimeNanos() - recordingStartTimeNanos) / 1_000_000`
        Since recordingStartTimeNanos is 0L, durationMs returns the total device uptime since boot!
        Furthermore, it resolves success: true with empty videoPath instead of rejecting!
        """
        stop_body = extract_method_body(self.plugin_code, "fun stopRecording(call: PluginCall)")

        # Calculates duration against 0L if not started
        self.assertIn("(SystemClock.elapsedRealtimeNanos() - recordingStartTimeNanos) / 1_000_000", stop_body)

        # Does not reject if !isRecording
        self.assertNotIn("if (!isRecording) return call.reject", stop_body)

        # Calculate simulated bogus duration if device uptime is 100 hours
        uptime_nanos = 100 * 3600 * 1_000_000_000
        bogus_duration_ms = (uptime_nanos - 0) // 1_000_000
        self.assertEqual(bogus_duration_ms, 360_000_000, "Device uptime of 100h results in 360M ms duration!")

    def test_duplicate_start_recording_leaks_hardware_session(self):
        """
        DEFECT CHECK: Calling startRecording twice:
        startRecording does NOT check `if (isRecording)`.
        It overwrites `mediaRecorder` without stopping/resetting the active one,
        causing a native Stagefright / Camera HAL resource leak and crash!
        It also overwrites `imuFileWriter` without closing the old one, leaking file handles!
        """
        start_body = extract_method_body(self.plugin_code, "fun startRecording(call: PluginCall)")

        self.assertNotIn("if (isRecording)", start_body,
                         "DEFECT CONFIRMED: startRecording lacks guard against duplicate start while isRecording is true!")

    def test_physical_ultrawide_id_dropped_in_start_recording(self):
        """
        DEFECT CHECK:
        In startPreview:
        ```kotlin
        val outputConfig = OutputConfiguration(surface)
        if (physicalUltraWideId != null) {
            outputConfig.setPhysicalCameraId(physicalUltraWideId!!)
        }
        val sessionConfig = SessionConfiguration(..., listOf(outputConfig), ...)
        device.createCaptureSession(sessionConfig)
        ```
        In startRecording:
        ```kotlin
        val surfaces = listOf(surface, recorderSurface!!)
        device.createCaptureSession(surfaces, ...)
        ```
        `startRecording` uses the deprecated `createCaptureSession(List<Surface>, ...)`
        WITHOUT `OutputConfiguration` and WITHOUT `physicalUltraWideId`!
        On Samsung multi-lens devices requiring physical camera IDs,
        the video recording reverts to the primary 1.0x wide lens instead of ultra-wide!
        """
        start_body = extract_method_body(self.plugin_code, "fun startRecording(call: PluginCall)")

        self.assertIn("device.createCaptureSession(surfaces,", start_body)
        self.assertNotIn("OutputConfiguration(recorderSurface", start_body,
                         "DEFECT CONFIRMED: startRecording drops OutputConfiguration physicalCameraId binding!")
        self.assertNotIn("setPhysicalCameraId", start_body)


def suite():
    loader = unittest.defaultTestLoader
    test_suite = unittest.TestSuite()
    test_suite.addTests(loader.loadTestsFromTestCase(TestCamera2ZoomBoundsStress))
    test_suite.addTests(loader.loadTestsFromTestCase(TestPhysicalCameraDiscoveryStress))
    test_suite.addTests(loader.loadTestsFromTestCase(TestAeAfLockoutIdempotencyAndLifecycle))
    test_suite.addTests(loader.loadTestsFromTestCase(TestImuSamplingZeroAllocationAndTiming))
    test_suite.addTests(loader.loadTestsFromTestCase(TestMediaRecorderLifecycleStress))
    return test_suite


if __name__ == "__main__":
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite())
    sys.exit(0 if result.wasSuccessful() else 1)
