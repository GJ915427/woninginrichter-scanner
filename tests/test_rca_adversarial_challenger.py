"""
Empirical Adversarial Challenger Test Suite
Tests and verifies the claims in:
1. docs/camera2_webrtc_rca_report.md
2. docs/smartphone_hardware_browser_matrix.md
3. tests/test_camera_constraints.js
4. scanner.html
"""

import sys
import os
import io
import re
from pathlib import Path

# Force utf-8 output in Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

WORKSPACE = Path(__file__).resolve().parent.parent
DOCS_DIR = WORKSPACE / "docs"
TESTS_DIR = WORKSPACE / "tests"

def inspect_sections():
    rca_file = DOCS_DIR / "camera2_webrtc_rca_report.md"
    matrix_file = DOCS_DIR / "smartphone_hardware_browser_matrix.md"
    scanner_file = WORKSPACE / "scanner.html"
    test_constraints_file = TESTS_DIR / "test_camera_constraints.js"

    rca_text = rca_file.read_text(encoding="utf-8")
    matrix_text = matrix_file.read_text(encoding="utf-8")
    constraints_text = test_constraints_file.read_text(encoding="utf-8")
    scanner_text = scanner_file.read_text(encoding="utf-8")

    print("=== CHALLENGE 2: W3C MEDIA CAPTURE § 4.3.7 IN RCA REPORT ===")
    lines = rca_text.splitlines()
    for i, line in enumerate(lines):
        if any(k in line.lower() for k in ["4.3.7", "selectsettings", "advanced constraint", "silently discard"]):
            print(f"--- Around line {i+1} ---")
            for j in range(max(0, i-3), min(len(lines), i+15)):
                print(f"{j+1}: {lines[j]}")
            print()

    print("=== CHALLENGE 3: PIXEL VS SAMSUNG ENUMERATION IN RCA REPORT ===")
    for i, line in enumerate(lines):
        if any(k in line.lower() for k in ["logical_multi_camera", "getphysicalcameraids", "getcameraidlist", "samsung"]):
            if any(p in line.lower() for p in ["samsung", "pixel", "enumeration", "expose"]):
                print(f"--- Around line {i+1} ---")
                for j in range(max(0, i-2), min(len(lines), i+10)):
                    print(f"{j+1}: {lines[j]}")
                print()

    print("=== CHALLENGE 3: SMARTPHONE HARDWARE BROWSER MATRIX PIXEL VS SAMSUNG ===")
    m_lines = matrix_text.splitlines()
    for i, line in enumerate(m_lines):
        if any(k in line.lower() for k in ["pixel 9 pro xl", "samsung galaxy s24", "samsung galaxy s23"]):
            print(f"--- Matrix line {i+1} ---")
            for j in range(max(0, i-2), min(len(m_lines), i+12)):
                print(f"{j+1}: {m_lines[j]}")
            print()

    print("=== TEST_CAMERA_CONSTRAINTS.JS TEST 1.6 DETAILS ===")
    c_lines = constraints_text.splitlines()
    for i, line in enumerate(c_lines):
        if "1.6" in line or "Pixel 9" in line:
            print(f"--- Constraints line {i+1} ---")
            for j in range(max(0, i-5), min(len(c_lines), i+30)):
                print(f"{j+1}: {c_lines[j]}")
            print()

    print("=== SCANNER.HTML ENUMERATION LOGIC ===")
    s_lines = scanner_text.splitlines()
    for i, line in enumerate(s_lines):
        if any(k in line.lower() for k in ["enumeratedevices", "resolvecamerastream", "getlenscapabilities", "ultrawide", "togglelens"]):
            if "function" in line or "const" in line or "let" in line or "async" in line:
                print(f"--- Scanner line {i+1} ---")
                for j in range(max(0, i-1), min(len(s_lines), i+15)):
                    print(f"{j+1}: {s_lines[j]}")
                print()

if __name__ == "__main__":
    inspect_sections()
