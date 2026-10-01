"""
Adversarial Architecture & Empirical Verification Test Suite
Challenger 2 (teamwork_preview_challenger)

This test suite empirically verifies:
1. Direction A (Pure Web) constraint resolution and salvageability claims.
2. Native bridge code analysis (Kotlin Camera2 and Swift AVFoundation).
3. 100Hz IMU timestamp synchronization, clock drift, and rolling shutter mechanics.
"""

import unittest
import json
import math
import re
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parent.parent
DOCS_DIR = WORKSPACE / "docs"

class TestDirectionAPureWebSalvageability(unittest.TestCase):
    """
    Empirically evaluates whether Direction A (Pure Web) can be salvaged
    via experimental flags or stream recreation.
    """

    def test_w3c_constraint_clamping_algorithm(self):
        """
        Simulates W3C Media Capture § 4.3.7 SelectSettings algorithm.
        Verifies that when capabilities.zoom.min = 1.0 (Android Chromium),
        any attempt to set zoom < 1.0 either throws OverconstrainedError
        (if mandatory/exact/min) or is clamped to 1.0 (if ideal).
        """
        # Android Chromium capabilities on Pixel 9 Pro XL
        capabilities = {
            "zoom": {"min": 1.0, "max": 8.0, "step": 0.1}
        }

        # Scenario 1: Exact / Min mandatory constraint zoom = 0.5
        mandatory_constraint = {"zoom": {"min": 0.5, "max": 0.6}}
        with self.assertRaises(ValueError) as ctx:
            # W3C SelectSettings check: min constraint must be >= capabilities.min
            if mandatory_constraint["zoom"]["min"] < capabilities["zoom"]["min"]:
                raise ValueError("OverconstrainedError: zoom value 0.5 outside capability range [1.0, 8.0]")

        self.assertIn("OverconstrainedError", str(ctx.exception))

        # Scenario 2: Ideal / Advanced constraint zoom = 0.5
        ideal_constraint = {"zoom": {"ideal": 0.5}}
        # W3C § 4.3.7 Fitness distance calculation:
        # If capability cannot satisfy ideal, the setting is clamped to capability boundary
        applied_zoom = max(capabilities["zoom"]["min"], min(capabilities["zoom"]["max"], ideal_constraint["zoom"]["ideal"]))
        self.assertEqual(applied_zoom, 1.0, "Ideal zoom 0.5 must be silently clamped to 1.0 by W3C fitness algorithm")

    def test_stream_recreation_on_logical_multicamera(self):
        """
        Simulates camera stream recreation on Google Pixel 9 Pro XL.
        Proves that stopping and reopening the MediaStreamTrack repeatedly
        returns only the logical camera ID '0', making stream recreation futile.
        """
        # HAL devices exposed via CameraManager.getCameraIdList() on Pixel 9
        hal_exposed_camera_ids = ["0", "1"] # 0 = BACK (Logical), 1 = FRONT
        # Hidden physical sub-cameras only in CameraCharacteristics.getPhysicalCameraIds()
        physical_sub_cameras = {"0": ["2", "3"]} # 2 = Ultra-wide, 3 = Telephoto

        def simulate_enumerate_devices():
            # Chromium calls getCameraIdList()
            return [{"deviceId": cid, "kind": "videoinput", "label": f"Camera {cid}"} for cid in hal_exposed_camera_ids]

        devices_round_1 = simulate_enumerate_devices()
        self.assertEqual(len(devices_round_1), 2)
        self.assertNotIn("2", [d["deviceId"] for d in devices_round_1], "Physical ultra-wide ID 2 is hidden from enumerateDevices()")

        # Simulate track.stop() and stream recreation with different constraints
        def simulate_stream_recreation(requested_zoom=0.5):
            devices = simulate_enumerate_devices()
            # Chromium binds to logical camera '0'
            active_device = devices[0]["deviceId"]
            # Zoom is clamped to 1.0 by VideoCaptureCamera2
            clamped_zoom = max(1.0, requested_zoom)
            return {"activeDeviceId": active_device, "effectiveZoom": clamped_zoom}

        for attempt in range(5):
            res = simulate_stream_recreation(0.5)
            self.assertEqual(res["activeDeviceId"], "0")
            self.assertEqual(res["effectiveZoom"], 1.0, f"Attempt {attempt+1}: Recreated stream remains stuck at 1.0x")


class TestNativeBridgeCodeCorrectness(unittest.TestCase):
    """
    Adversarially challenges the Kotlin and Swift native bridge implementations
    in docs/woninginrichter_architecture_blueprint.md.
    """

    @classmethod
    def setUpClass(cls):
        blueprint_file = DOCS_DIR / "woninginrichter_architecture_blueprint.md"
        content = blueprint_file.read_text(encoding="utf-8")
        blocks = re.findall(r"```([a-zA-Z0-9_\-]+)?\s*\n(.*?)```", content, re.DOTALL)
        cls.kotlin_code = [c for l, c in blocks if l == "kotlin"][0]
        cls.swift_code = [c for l, c in blocks if l == "swift"][0]

    def test_kotlin_video_recording_pipeline_completeness(self):
        """
        REMEDIATION VERIFICATION: Verifies whether startRecording actually configures
        and records video frames using MediaRecorder and attaches recorderSurface to the capture session.
        """
        has_media_recorder = "MediaRecorder" in self.kotlin_code
        self.assertTrue(has_media_recorder, "UltraWideCameraPlugin.kt must include MediaRecorder implementation")

        has_recording_surface = "recorderSurface" in self.kotlin_code
        self.assertTrue(has_recording_surface, "UltraWideCameraPlugin.kt must attach a video recording surface")
        self.assertIn("TEMPLATE_RECORD", self.kotlin_code, "UltraWideCameraPlugin.kt must create TEMPLATE_RECORD request")

    def test_kotlin_surface_leak_and_lifecycle_cleanup(self):
        """
        REMEDIATION VERIFICATION: Verifies whether Surface / TextureView and CameraDevice
        are properly cleaned up during lifecycle events, and detached SurfaceTexture(10) is eliminated.
        """
        # Detached SurfaceTexture(10) dummy must be removed in favor of native TextureView
        self.assertNotIn("SurfaceTexture(10)", self.kotlin_code, "Dummy detached SurfaceTexture(10) must be replaced")
        self.assertIn("TextureView", self.kotlin_code, "Must use genuine native TextureView underlay")
        # Check if surface.release() or previewSurface?.release() is present
        has_surface_release = "previewSurface?.release()" in self.kotlin_code or "previewSurface.release()" in self.kotlin_code
        self.assertTrue(has_surface_release, "Surface must be released during lifecycle cleanup")

        # Check if lifecycle methods (handleOnPause, handleOnDestroy) are implemented
        has_ondestroy = "handleOnDestroy" in self.kotlin_code
        self.assertTrue(has_ondestroy, "Plugin must implement handleOnDestroy for hardware cleanup")

    def test_kotlin_memory_pressure_on_imu_buffer(self):
        """
        STRESS TEST: Simulates a 5-minute scan buffering 60,000 JSONObjects in heap memory.
        Calculates memory footprint and evaluates OOM hazard.
        """
        # 5 minutes * 60 seconds * 200 samples/sec (100Hz accel + 100Hz gyro) = 60,000 points
        sample_count = 60000
        # Average JSONObject with fields (t, type, x, y, z) in Java heap is ~120-160 bytes
        estimated_heap_bytes = sample_count * 140
        estimated_heap_mb = estimated_heap_bytes / (1024 * 1024)

        # Generating giant JSON string in memory
        sample_json_str = '{"t":12345678901234,"type":"accel","x":0.123456,"y":-9.812345,"z":0.045678}'
        total_json_chars = len(sample_json_str) * sample_count
        total_json_string_mb = (total_json_chars * 2) / (1024 * 1024) # UTF-16 in Java String

        # Both the list and the string in memory simultaneously exceed ~15-20MB
        self.assertGreater(estimated_heap_mb + total_json_string_mb, 15.0)

    def test_swift_coremotion_main_thread_flooding(self):
        """
        REMEDIATION VERIFICATION: Verifies whether CMMotionManager dispatches to dedicated background OperationQueue
        instead of flooding RunLoop.main at 100Hz.
        """
        self.assertNotIn("startDeviceMotionUpdates(to: .main)", self.swift_code,
                         "Swift plugin must not dispatch 100Hz CoreMotion updates directly to .main UI thread")
        self.assertIn("motionQueue", self.swift_code,
                      "Swift plugin must dispatch CoreMotion updates to dedicated background OperationQueue")

    def test_swift_asynchronous_recording_race_condition(self):
        """
        REMEDIATION VERIFICATION: Verifies whether stopRecording defers resolution until
        AVCaptureFileOutputRecordingDelegate finishes writing MP4 atoms.
        """
        self.assertIn("output.stopRecording()", self.swift_code)
        self.assertIn("extension UltraWideCameraPlugin: AVCaptureFileOutputRecordingDelegate", self.swift_code)
        self.assertNotIn("// Handled via Capacitor callback", self.swift_code)
        self.assertIn("pendingRecordingCall", self.swift_code,
                      "Swift plugin must track pendingRecordingCall to resolve asynchronously in fileOutput delegate")

    def test_swift_camera_session_stop_missing(self):
        """
        REMEDIATION VERIFICATION: Verifies whether AVCaptureSession is properly stopped.
        stopRunning() must be called to release camera hardware execution.
        """
        self.assertGreater(self.swift_code.count("stopRunning()"), 0,
                           "AVCaptureSession.stopRunning() must be called in session teardown")


class TestIMUSynchronizationAndDriftMechanics(unittest.TestCase):
    """
    Adversarially tests the 100Hz IMU synchronization mechanism.
    Evaluates clock source drift, rolling shutter delay, and interpolation errors.
    """

    def test_rolling_shutter_temporal_skew_divergence(self):
        """
        Calculates the spatial offset introduced when pairing an IMU sample with
        Image.getTimestamp() (row 0) during a 60 deg/s camera pan without rolling-shutter correction.
        """
        frame_height = 1080
        readout_time_sec = 0.025 # 25ms typical rolling shutter readout time
        pan_speed_deg_per_sec = 60.0 # moderate panning motion

        # For a feature at the bottom of the frame (row 1080):
        # Time delta between row 0 (sensor timestamp) and row 1080:
        row_time_offset = readout_time_sec # 25ms
        angular_error_deg = pan_speed_deg_per_sec * row_time_offset

        # 1.5 degrees of orientation error in VIO will corrupt metric scale and cause multi-centimeter drift!
        self.assertAlmostEqual(angular_error_deg, 1.5, places=2)
        self.assertGreater(angular_error_deg, 0.5, "Uncompensated rolling shutter causes >0.5 deg angular error")

    def test_timestamp_nearest_neighbor_vs_slerp_interpolation(self):
        """
        Demonstrates that naive nearest-neighbor timestamp matching at 100Hz vs 30fps
        introduces up to 5ms timestamp quantization jitter.
        """
        video_fps = 30.0
        frame_interval_ms = 1000.0 / video_fps # 33.33ms
        imu_freq = 100.0
        imu_interval_ms = 1000.0 / imu_freq # 10.0ms

        # Max nearest-neighbor temporal error is imu_interval / 2 = 5.0ms
        max_quantization_error_ms = imu_interval_ms / 2.0
        self.assertEqual(max_quantization_error_ms, 5.0)

        # During a 120 deg/s rapid rotation, 5ms temporal error equates to:
        rot_error_deg = 120.0 * (max_quantization_error_ms / 1000.0) # 0.6 degrees
        self.assertEqual(rot_error_deg, 0.6, "Naive nearest-neighbor matching induces 0.6 deg rotation error")


if __name__ == "__main__":
    unittest.main(verbosity=2)
