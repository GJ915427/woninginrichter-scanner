"""
Empirical Test Suite for Camera2 Final Precision Fixes
======================================================
Target: android/app/src/main/java/com/woninginrichter/scanner/UltraWideCameraPlugin.kt

Verifies:
1. Method name typo onSurfaceTextureDestroyDestroyed -> onSurfaceTextureDestroyed.
2. Resource re-entrancy cleanup in startPreview before re-allocation:
   - previewSurface?.release() and previewSurface = null
   - captureSession?.close() and captureSession = null
   - cameraDevice?.close() and cameraDevice = null
"""

import unittest
from pathlib import Path

PLUGIN_PATH = Path("android/app/src/main/java/com/woninginrichter/scanner/UltraWideCameraPlugin.kt")


def extract_method_body(code: str, method_signature: str) -> str:
    """Extracts the body of a Kotlin method by matching balanced curly braces."""
    idx = code.find(method_signature)
    if idx == -1:
        return ""
    start_brace = code.find("{", idx)
    if start_brace == -1:
        return ""
    depth = 0
    end_brace = -1
    for i in range(start_brace, len(code)):
        if code[i] == "{":
            depth += 1
        elif code[i] == "}":
            depth -= 1
            if depth == 0:
                end_brace = i
                break
    if end_brace != -1:
        return code[start_brace + 1:end_brace]
    return ""


class TestCamera2PrecisionFixes(unittest.TestCase):
    """Verifies the two Camera2 precision fixes."""

    @classmethod
    def setUpClass(cls):
        with open(PLUGIN_PATH, "r", encoding="utf-8") as f:
            cls.code = f.read()

    def test_surface_texture_destroyed_method_name_typo_fixed(self):
        """Verify onSurfaceTextureDestroyed method name satisfies TextureView.SurfaceTextureListener."""
        self.assertNotIn(
            "onSurfaceTextureDestroyDestroyed",
            self.code,
            "Typo 'onSurfaceTextureDestroyDestroyed' must not exist in source code!"
        )
        self.assertIn(
            "override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean",
            self.code,
            "Must implement 'override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean'"
        )

    def test_start_preview_reentrancy_resource_cleanup(self):
        """Verify startPreview cleans up previewSurface, captureSession, and cameraDevice before reallocating."""
        start_preview_body = extract_method_body(self.code, "fun startPreview(call: PluginCall)")
        self.assertTrue(len(start_preview_body) > 0, "startPreview method body could not be extracted!")

        # Verify previewSurface release and nullification
        self.assertIn("previewSurface?.release()", start_preview_body)
        self.assertIn("previewSurface = null", start_preview_body)

        # Verify captureSession close and nullification
        self.assertIn("captureSession?.close()", start_preview_body)
        self.assertIn("captureSession = null", start_preview_body)

        # Verify cameraDevice close and nullification
        self.assertIn("cameraDevice?.close()", start_preview_body)
        self.assertIn("cameraDevice = null", start_preview_body)

        # Verify cleanup happens before re-allocating Surface(textureView!!.surfaceTexture)
        realloc_idx = start_preview_body.find("previewSurface = Surface(textureView!!.surfaceTexture)")
        self.assertGreater(realloc_idx, 0, "previewSurface re-allocation line not found")

        release_idx = start_preview_body.rfind("previewSurface?.release()", 0, realloc_idx)
        self.assertGreater(release_idx, 0, "previewSurface release must occur before re-allocation")

        session_close_idx = start_preview_body.rfind("captureSession?.close()", 0, realloc_idx)
        self.assertGreater(session_close_idx, 0, "captureSession close must occur before re-allocation")

        device_close_idx = start_preview_body.rfind("cameraDevice?.close()", 0, realloc_idx)
        self.assertGreater(device_close_idx, 0, "cameraDevice close must occur before re-allocation")


if __name__ == "__main__":
    unittest.main()
