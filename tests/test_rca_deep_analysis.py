"""
Targeted extraction script for RCA challenger findings
"""
import io
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

WORKSPACE = Path(__file__).resolve().parent.parent
DOCS_DIR = WORKSPACE / "docs"
TESTS_DIR = WORKSPACE / "tests"

rca_text = (DOCS_DIR / "camera2_webrtc_rca_report.md").read_text(encoding="utf-8")
matrix_text = (DOCS_DIR / "smartphone_hardware_browser_matrix.md").read_text(encoding="utf-8")
constraints_text = (TESTS_DIR / "test_camera_constraints.js").read_text(encoding="utf-8")
scanner_text = (WORKSPACE / "scanner.html").read_text(encoding="utf-8")

def print_section(title, text, start_phrase, end_phrase):
    print(f"=== {title} ===")
    start = text.find(start_phrase)
    if start == -1:
        print(f"NOT FOUND: {start_phrase}")
        return
    end = text.find(end_phrase, start)
    if end == -1:
        end = start + 2000
    print(text[start:end])
    print("\n" + "="*50 + "\n")

# 1. Section 1.2 in RCA (Geometric Math)
print_section("RCA SECTION 1.2: GEOMETRIC MATH", rca_text, "### 1.2 Mathematical Proof: Why Zoom < 1.0 is Impossible in `SCALER_CROP_REGION`", "### 1.3 Android 11+ `CONTROL_ZOOM_RATIO`")

# 2. Section 1.4 in RCA (W3C § 4.3.7)
print_section("RCA SECTION 1.4: W3C ADVANCED CONSTRAINTS", rca_text, "### 1.4 W3C Media Capture Specification Analysis (§ 4.3.7 vs Basic Constraints)", "### 1.5 Chromium Source Code Archaeology")

# 3. Section on Pixel vs Samsung in RCA & Matrix
print_section("RCA SECTION 2: LOGICAL MULTI-CAMERA & ENUMERATION", rca_text, "## 2. Android HAL3 & Logical Multi-Camera Architecture", "## 3. Chrome / Blink WebRTC Video Capture Pipeline")

# 4. Pixel 9 Pro XL entry in Matrix
print_section("MATRIX: PIXEL 9 PRO XL", matrix_text, "### 1.1 Google Pixel Family", "### 1.2 Samsung Galaxy Family")

# 5. Samsung Galaxy S24 Ultra entry in Matrix
print_section("MATRIX: SAMSUNG GALAXY S24 ULTRA", matrix_text, "### 1.2 Samsung Galaxy Family", "### 1.3 Apple iPhone Pro Family")

# 6. Test 1.6 in test_camera_constraints.js
print_section("TEST 1.6 IN TEST_CAMERA_CONSTRAINTS.JS", constraints_text, "test('1.6 Google Pixel 9 Pro XL camera layout", "suite('SUITE 2")
