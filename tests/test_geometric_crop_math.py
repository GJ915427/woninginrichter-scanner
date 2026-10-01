"""
Empirical Mathematical and Geometric Verification: SCALER_CROP_REGION
Simulates Android Camera2 HAL3 / Chromium crop calculation for various zoom levels
and sensor topologies.
"""
import io
import sys
import unittest

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

class TestGeometricCropMath(unittest.TestCase):
    def setUp(self):
        # Pixel 9 Pro XL main sensor: 50 MP (GNK, 8192 x 6144 or binned 4080 x 3072)
        self.sensors = [
            {"name": "Pixel 9 Pro XL Full Sensor", "width": 8192, "height": 6144},
            {"name": "Pixel 9 Pro XL Binned 12MP", "width": 4080, "height": 3072},
            {"name": "Standard 4K UHD Sensor", "width": 3840, "height": 2160},
            {"name": "Standard 1080p FHD Sensor", "width": 1920, "height": 1080},
        ]

    def calculate_crop_region(self, sensor_w: int, sensor_h: int, zoom_factor: float):
        """
        Calculates centered crop region coordinates per Android Camera2 HAL3 specification
        and Chromium VideoCaptureCamera2.java.
        """
        crop_w = sensor_w / zoom_factor
        crop_h = sensor_h / zoom_factor
        crop_left = (sensor_w - crop_w) / 2.0
        crop_top = (sensor_h - crop_h) / 2.0
        crop_right = crop_left + crop_w
        crop_bottom = crop_top + crop_h
        return {
            "left": crop_left,
            "top": crop_top,
            "right": crop_right,
            "bottom": crop_bottom,
            "width": crop_w,
            "height": crop_h,
            "area_ratio": (crop_w * crop_h) / (sensor_w * sensor_h)
        }

    def test_zoom_unity_boundary(self):
        """Verify Z = 1.0 exactly equals the active array boundaries."""
        for s in self.sensors:
            crop = self.calculate_crop_region(s["width"], s["height"], 1.0)
            self.assertEqual(crop["left"], 0.0)
            self.assertEqual(crop["top"], 0.0)
            self.assertEqual(crop["right"], float(s["width"]))
            self.assertEqual(crop["bottom"], float(s["height"]))
            self.assertEqual(crop["area_ratio"], 1.0)

    def test_zoom_05x_out_of_bounds(self):
        """Empirically test Z = 0.5x on all sensors. Must be out of bounds in all 4 axes."""
        for s in self.sensors:
            w, h = s["width"], s["height"]
            crop = self.calculate_crop_region(w, h, 0.5)

            # Verification 1: Dimensions are doubled
            self.assertEqual(crop["width"], 2.0 * w)
            self.assertEqual(crop["height"], 2.0 * h)
            self.assertEqual(crop["area_ratio"], 4.0)

            # Verification 2: Left and Top are negative (-W/2, -H/2)
            self.assertEqual(crop["left"], -0.5 * w)
            self.assertEqual(crop["top"], -0.5 * h)
            self.assertLess(crop["left"], 0.0)
            self.assertLess(crop["top"], 0.0)

            # Verification 3: Right and Bottom exceed sensor array bounds (1.5W, 1.5H)
            self.assertEqual(crop["right"], 1.5 * w)
            self.assertEqual(crop["bottom"], 1.5 * h)
            self.assertGreater(crop["right"], float(w))
            self.assertGreater(crop["bottom"], float(h))

            # Verification 4: Violation margin is exactly 50% sensor width/height on every side
            self.assertEqual(0.0 - crop["left"], 0.5 * w)
            self.assertEqual(crop["right"] - w, 0.5 * w)

    def test_all_subunity_zooms_out_of_bounds(self):
        """Verify that ANY zoom factor Z < 1.0 (e.g. 0.99, 0.7, 0.5, 0.3) is out of bounds."""
        for s in self.sensors:
            w, h = s["width"], s["height"]
            for z in [0.99, 0.9, 0.75, 0.6, 0.5, 0.3, 0.1]:
                crop = self.calculate_crop_region(w, h, z)
                self.assertLess(crop["left"], 0.0, f"Left must be negative for Z={z}")
                self.assertLess(crop["top"], 0.0, f"Top must be negative for Z={z}")
                self.assertGreater(crop["right"], float(w), f"Right must exceed sensor width for Z={z}")
                self.assertGreater(crop["bottom"], float(h), f"Bottom must exceed sensor height for Z={z}")
                self.assertGreater(crop["area_ratio"], 1.0, f"Area ratio must exceed 1.0 for Z={z}")

    def test_hal_clamping_collapses_to_unity(self):
        """
        Verify that if an Android HAL clamps out-of-bounds coordinates to [0, 0, W, H],
        the effective zoom collapses back to 1.0x (or aspect-distorted 1.0x).
        """
        for s in self.sensors:
            w, h = s["width"], s["height"]
            crop = self.calculate_crop_region(w, h, 0.5)

            # Clamp coordinates
            clamped_left = max(0.0, crop["left"])
            clamped_top = max(0.0, crop["top"])
            clamped_right = min(float(w), crop["right"])
            clamped_bottom = min(float(h), crop["bottom"])

            clamped_w = clamped_right - clamped_left
            clamped_h = clamped_bottom - clamped_top

            effective_zoom_x = w / clamped_w
            effective_zoom_y = h / clamped_h

            self.assertEqual(effective_zoom_x, 1.0, "Clamped crop collapses to 1.0x zoom")
            self.assertEqual(effective_zoom_y, 1.0, "Clamped crop collapses to 1.0x zoom")

if __name__ == "__main__":
    unittest.main()
