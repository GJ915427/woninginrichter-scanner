"""Deliverable Validation Test Suite.

Validates that all five project deliverables exist under `docs/` and strictly
satisfy all technical requirements for Root Cause Analysis (R1), Smartphone
Hardware & Browser Matrix (R2), Commercial Scanning Benchmarks (R3), and
Architectural Blueprints (R4), as well as Master Synthesis.
"""

import json
import os
import re
import unittest
from pathlib import Path


WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = WORKSPACE_ROOT / "docs"

DELIVERABLE_FILES = {
    "r1": "camera2_webrtc_rca_report.md",
    "r2": "smartphone_hardware_browser_matrix.md",
    "r3": "commercial_scanning_benchmark.md",
    "r4": "woninginrichter_architecture_blueprint.md",
    "master": "CAMERA2_WEBRTC_ULTRAWIDE_MASTER_REPORT.md",
}


def read_deliverable(key: str) -> str:
    """Read deliverable markdown content by key."""
    filename = DELIVERABLE_FILES[key]
    path = DOCS_DIR / filename
    if not path.is_file():
        raise FileNotFoundError(f"Deliverable file not found: {path}")
    return path.read_text(encoding="utf-8")


def check_balanced_delimiters(code: str) -> tuple[bool, str]:
    """Check that parentheses, brackets, and braces are balanced in code.
    
    Skips strings, comments, and character literals.
    """
    stack = []
    pairs = {")": "(", "}": "{", "]": "["}
    in_single_quote = False
    in_double_quote = False
    in_backtick = False
    in_triple_double = False
    in_single_line_comment = False
    in_multi_line_comment = False
    escape = False

    i = 0
    n = len(code)
    line_num = 1
    col_num = 0

    while i < n:
        ch = code[i]
        col_num += 1

        if ch == "\n":
            line_num += 1
            col_num = 0
            if in_single_line_comment:
                in_single_line_comment = False
            i += 1
            continue

        if in_single_line_comment:
            i += 1
            continue

        if in_multi_line_comment:
            if ch == "*" and i + 1 < n and code[i + 1] == "/":
                in_multi_line_comment = False
                i += 2
                col_num += 1
                continue
            i += 1
            continue

        if escape:
            escape = False
            i += 1
            continue

        if ch == "\\":
            if in_single_quote or in_double_quote or in_backtick or in_triple_double:
                escape = True
            i += 1
            continue

        # Triple quote check
        if ch == '"' and i + 2 < n and code[i : i + 3] == '"""':
            in_triple_double = not in_triple_double
            i += 3
            col_num += 2
            continue

        if in_triple_double:
            i += 1
            continue

        # Comment initiation
        if not (in_single_quote or in_double_quote or in_backtick):
            if ch == "/" and i + 1 < n:
                if code[i + 1] == "/":
                    in_single_line_comment = True
                    i += 2
                    col_num += 1
                    continue
                elif code[i + 1] == "*":
                    in_multi_line_comment = True
                    i += 2
                    col_num += 1
                    continue

        if ch == '"' and not in_single_quote and not in_backtick:
            in_double_quote = not in_double_quote
            i += 1
            continue

        if ch == "'" and not in_double_quote and not in_backtick:
            in_single_quote = not in_single_quote
            i += 1
            continue

        if ch == "`" and not in_single_quote and not in_double_quote:
            in_backtick = not in_backtick
            i += 1
            continue

        if in_single_quote or in_double_quote or in_backtick:
            i += 1
            continue

        # Delimiters
        if ch in "({[":
            stack.append((ch, line_num, col_num))
        elif ch in ")}]":
            if not stack:
                return False, f"Unexpected closing delimiter '{ch}' at {line_num}:{col_num}"
            top, top_line, top_col = stack.pop()
            if pairs[ch] != top:
                return False, f"Mismatched delimiter: expected closing for '{top}' (opened at {top_line}:{top_col}) but got '{ch}' at {line_num}:{col_num}"

        i += 1

    if in_multi_line_comment:
        return False, "Unclosed multi-line comment"
    if in_double_quote or in_single_quote or in_backtick or in_triple_double:
        return False, "Unclosed string literal"
    if stack:
        top, top_line, top_col = stack[-1]
        return False, f"Unclosed delimiter '{top}' opened at {top_line}:{top_col}"

    return True, "Delimiters balanced successfully"


def extract_code_blocks(markdown_text: str, languages: list[str] | None = None) -> list[tuple[str, str]]:
    """Extract code blocks with specified language annotations."""
    pattern = r"```([a-zA-Z0-9_\-]+)?\s*\n(.*?)```"
    matches = re.findall(pattern, markdown_text, re.DOTALL)
    results = []
    for lang, code in matches:
        lang_norm = lang.strip().lower() if lang else ""
        if languages is None or lang_norm in [l.lower() for l in languages]:
            results.append((lang_norm, code))
    return results


class TestDeliverableFilesExistence(unittest.TestCase):
    """1. Existence and substantial completeness of all 5 deliverable files."""

    def test_all_five_deliverables_exist(self):
        """Validates that all five specified deliverable files exist in docs/."""
        for key, filename in DELIVERABLE_FILES.items():
            path = DOCS_DIR / filename
            self.assertTrue(path.exists(), f"Missing deliverable: {filename}")
            self.assertTrue(path.is_file(), f"Deliverable is not a regular file: {filename}")

    def test_deliverables_substantial_and_structured(self):
        """Validates that deliverables have substantial length and Markdown headers."""
        for key, filename in DELIVERABLE_FILES.items():
            content = read_deliverable(key)
            self.assertGreater(
                len(content),
                10000,
                f"Deliverable {filename} is too brief ({len(content)} chars, expected > 10,000 chars)",
            )
            # Must contain top-level title and subheadings
            self.assertTrue(
                re.search(r"^#\s+.+", content, re.MULTILINE),
                f"Deliverable {filename} lacks top-level '# ' heading",
            )
            h2_matches = re.findall(r"^##\s+.+", content, re.MULTILINE)
            self.assertGreaterEqual(
                len(h2_matches),
                3,
                f"Deliverable {filename} has insufficient sections ({len(h2_matches)} H2 headings found, expected >= 3)",
            )


class TestR1RootCauseAnalysisCoverage(unittest.TestCase):
    """2. Coverage of R1 (Root Cause Analysis)."""

    def setUp(self):
        self.rca_content = read_deliverable("r1")
        self.master_content = read_deliverable("master")

    def test_chromium_source_citations(self):
        """Validates presence of Chromium source citations."""
        # VideoCaptureCamera2.java
        self.assertIn(
            "VideoCaptureCamera2.java",
            self.rca_content,
            "RCA must cite 'VideoCaptureCamera2.java'",
        )
        # PhotoCapabilityDouble.MIN_ZOOM
        self.assertIn(
            "PhotoCapabilityDouble.MIN_ZOOM",
            self.rca_content,
            "RCA must cite 'PhotoCapabilityDouble.MIN_ZOOM'",
        )
        # Blink references
        blink_pattern = r"\bBlink\b|MediaStreamTrack|applyConstraints|MediaStreamVideoSource"
        self.assertTrue(
            re.search(blink_pattern, self.rca_content),
            "RCA must reference Blink / MediaStreamTrack constraint processing pipeline",
        )

    def test_android_camera2_hal_keys(self):
        """Validates presence of Android Camera2 HAL keys."""
        # CONTROL_ZOOM_RATIO_RANGE or CONTROL_ZOOM_RATIO
        self.assertTrue(
            "CONTROL_ZOOM_RATIO_RANGE" in self.rca_content or "CONTROL_ZOOM_RATIO" in self.rca_content,
            "RCA must cite Camera2 HAL key 'CONTROL_ZOOM_RATIO_RANGE' or 'CONTROL_ZOOM_RATIO'",
        )
        # SCALER_CROP_REGION
        self.assertIn(
            "SCALER_CROP_REGION",
            self.rca_content,
            "RCA must cite Camera2 HAL key 'SCALER_CROP_REGION'",
        )
        # REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA
        self.assertIn(
            "REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA",
            self.rca_content,
            "RCA must cite 'REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA'",
        )

    def test_w3c_media_capture_constraint_handling(self):
        """Validates explanation of W3C constraint dropping vs OverconstrainedError."""
        # Explanation of OverconstrainedError
        self.assertIn(
            "OverconstrainedError",
            self.rca_content,
            "RCA must explain OverconstrainedError behavior on basic constraints",
        )
        # Explanation of advanced constraints being silently dropped/ignored
        advanced_explanation = (
            "advanced" in self.rca_content.lower()
            and any(term in self.rca_content.lower() for term in ["drop", "discard", "ignore", "silent", "fail"])
        )
        self.assertTrue(
            advanced_explanation,
            "RCA must explain that W3C advanced constraints are dropped silently without raising OverconstrainedError",
        )

    def test_chromium_bug_references(self):
        """Validates presence of Chromium bug tracker references."""
        bug_refs = re.findall(
            r"(?:crbug(?:\.com)?\b|issues\.chromium\.org|bugs\.chromium\.org|chromium\s+issue|bug\s+#?\d{5,})",
            self.rca_content,
            re.IGNORECASE,
        )
        self.assertGreater(
            len(bug_refs),
            0,
            "RCA must include Chromium bug tracker references (crbug, issues.chromium.org, etc.)",
        )


class TestR2HardwareAndBrowserMatrixCoverage(unittest.TestCase):
    """3. Coverage of R2 (Smartphone Hardware & Browser Matrix)."""

    def setUp(self):
        self.matrix_content = read_deliverable("r2")

    def test_pixel_family_coverage(self):
        """Validates coverage of all required Google Pixel devices."""
        pixel_models = [
            "Pixel 6 Pro",
            "Pixel 7 Pro",
            "Pixel 8 Pro",
            "Pixel 9 Pro",
            "Pixel 9 Pro XL",
        ]
        for model in pixel_models:
            self.assertIn(
                model,
                self.matrix_content,
                f"Hardware matrix must explicitly cover '{model}'",
            )

    def test_samsung_galaxy_family_coverage(self):
        """Validates coverage of all required Samsung Galaxy devices."""
        samsung_models = [
            "S21 Ultra",
            "S22 Ultra",
            "S23 Ultra",
            "S24 Ultra",
        ]
        for model in samsung_models:
            self.assertTrue(
                re.search(rf"\b{model}\b", self.matrix_content),
                f"Hardware matrix must explicitly cover Samsung '{model}'",
            )

    def test_apple_iphone_family_coverage(self):
        """Validates coverage of Apple iPhone Pro family (11 Pro through 16 Pro Max)."""
        iphone_generations = [
            "11 Pro",
            "12 Pro",
            "13 Pro",
            "14 Pro",
            "15 Pro",
            "16 Pro",
        ]
        for gen in iphone_generations:
            self.assertTrue(
                re.search(rf"\biPhone\s+{gen}\b", self.matrix_content),
                f"Hardware matrix must cover 'iPhone {gen}' (through 16 Pro Max)",
            )

    def test_xiaomi_and_oneplus_oppo_coverage(self):
        """Validates coverage of Xiaomi, OnePlus, and Oppo flagship families."""
        self.assertTrue(
            re.search(r"\bXiaomi\b", self.matrix_content, re.IGNORECASE),
            "Hardware matrix must cover Xiaomi family",
        )
        self.assertTrue(
            re.search(r"\bOnePlus\b", self.matrix_content, re.IGNORECASE),
            "Hardware matrix must cover OnePlus family",
        )
        self.assertTrue(
            re.search(r"\bOppo\b", self.matrix_content, re.IGNORECASE),
            "Hardware matrix must cover Oppo family",
        )

    def test_markdown_comparison_tables_present(self):
        """Validates presence of Markdown comparison tables."""
        tables = re.findall(r"(\|[^\n]+\|\n\|(?:\s*[-:]+[-| :]*\s*)\|\n(?:\|[^\n]+\|\n?)+)", self.matrix_content)
        self.assertGreaterEqual(
            len(tables),
            1,
            "Hardware matrix must contain at least one formatted Markdown comparison table",
        )


class TestR3CommercialMarketLeadersCoverage(unittest.TestCase):
    """4. Coverage of R3 (Commercial Market Leaders)."""

    def setUp(self):
        self.benchmark_content = read_deliverable("r3")

    def test_commercial_leaders_covered(self):
        """Validates thorough coverage of all 5 commercial market leaders."""
        leaders = [
            "CubiCasa",
            "MagicPlan",
            "Matterport",
            "Polycam",
            "Canvas",
        ]
        for leader in leaders:
            self.assertTrue(
                re.search(rf"\b{leader}\b", self.benchmark_content, re.IGNORECASE),
                f"Commercial benchmark must cover '{leader}'",
            )

    def test_technical_depth_and_technologies(self):
        """Validates coverage of scanning technologies and native vs web architecture."""
        technologies = ["LiDAR", "ARKit", "ARCore"]
        for tech in technologies:
            self.assertTrue(
                re.search(rf"\b{tech}\b", self.benchmark_content, re.IGNORECASE),
                f"Commercial benchmark must evaluate technology '{tech}'",
            )

        # Native vs Web capture evaluation
        native_web_discussion = (
            "native" in self.benchmark_content.lower()
            and ("webrtc" in self.benchmark_content.lower() or "getusermedia" in self.benchmark_content.lower())
        )
        self.assertTrue(
            native_web_discussion,
            "Commercial benchmark must analyze native SDK vs web/WebRTC capture architecture",
        )

    def test_benchmark_markdown_tables(self):
        """Validates presence of structured benchmark comparison tables."""
        tables = re.findall(r"(\|[^\n]+\|\n\|(?:\s*[-:]+[-| :]*\s*)\|\n(?:\|[^\n]+\|\n?)+)", self.benchmark_content)
        self.assertGreaterEqual(
            len(tables),
            1,
            "Commercial benchmark must contain at least one formatted comparison table",
        )


class TestR4ArchitecturalBlueprintsCoverage(unittest.TestCase):
    """5. Coverage of R4 (Architectural Blueprints)."""

    def setUp(self):
        self.blueprint_content = read_deliverable("r4")

    def test_architectural_directions_a_b_c(self):
        """Validates evaluation of Directions A, B, and C."""
        for direction in ["Direction A", "Direction B", "Direction C"]:
            self.assertIn(
                direction,
                self.blueprint_content,
                f"Architecture blueprint must evaluate '{direction}'",
            )

    def test_kotlin_plugin_code_block(self):
        """Validates presence of syntactically valid Kotlin plugin code."""
        blocks = extract_code_blocks(self.blueprint_content, ["kotlin", "kt"])
        self.assertGreater(len(blocks), 0, "Blueprint must contain a Kotlin code block")

        plugin_block = None
        for lang, code in blocks:
            if "UltraWideCameraPlugin" in code or "CameraManager" in code or "CapacitorPlugin" in code:
                plugin_block = code
                break

        self.assertIsNotNone(
            plugin_block,
            "Kotlin code block must contain UltraWideCameraPlugin / CameraManager implementation",
        )

        balanced, msg = check_balanced_delimiters(plugin_block)
        self.assertTrue(balanced, f"Kotlin code block syntax delimiter error: {msg}")

        self.assertTrue(
            "class" in plugin_block and "fun" in plugin_block,
            "Kotlin code block must define classes and functions",
        )

    def test_swift_plugin_code_block(self):
        """Validates presence of syntactically valid Swift plugin code."""
        blocks = extract_code_blocks(self.blueprint_content, ["swift"])
        self.assertGreater(len(blocks), 0, "Blueprint must contain a Swift code block")

        plugin_block = None
        for lang, code in blocks:
            if "UltraWideCameraPlugin" in code or "AVCapture" in code or "CAPPlugin" in code:
                plugin_block = code
                break

        self.assertIsNotNone(
            plugin_block,
            "Swift code block must contain UltraWideCameraPlugin / AVCapture implementation",
        )

        balanced, msg = check_balanced_delimiters(plugin_block)
        self.assertTrue(balanced, f"Swift code block syntax delimiter error: {msg}")

        self.assertTrue(
            "class" in plugin_block and "func" in plugin_block,
            "Swift code block must define classes and functions",
        )

    def test_typescript_bridge_code_block(self):
        """Validates presence of syntactically valid TypeScript bridge code."""
        blocks = extract_code_blocks(self.blueprint_content, ["typescript", "ts"])
        self.assertGreater(len(blocks), 0, "Blueprint must contain a TypeScript code block")

        bridge_block = None
        for lang, code in blocks:
            if "registerPlugin" in code or "interface" in code or "UltraWideCamera" in code:
                bridge_block = code
                break

        self.assertIsNotNone(
            bridge_block,
            "TypeScript code block must declare bridge interface or registerPlugin",
        )

        balanced, msg = check_balanced_delimiters(bridge_block)
        self.assertTrue(balanced, f"TypeScript code block delimiter error: {msg}")

    def test_capacitor_configuration_code_block(self):
        """Validates presence of Capacitor configuration code block."""
        blocks = extract_code_blocks(self.blueprint_content)
        config_block = None
        for lang, code in blocks:
            if any(kw in code for kw in ["capacitor.config", "appId", "appName", "CapacitorConfig", "@capacitor/cli"]):
                config_block = code
                break

        self.assertIsNotNone(
            config_block,
            "Blueprint must contain a Capacitor configuration code block",
        )

        balanced, msg = check_balanced_delimiters(config_block)
        self.assertTrue(balanced, f"Capacitor config code block delimiter error: {msg}")

    def test_three_phase_roadmap(self):
        """Validates presence and definition of a 3-Phase Roadmap."""
        self.assertTrue(
            re.search(r"Phase\s+1", self.blueprint_content, re.IGNORECASE),
            "Blueprint roadmap must define Phase 1",
        )
        self.assertTrue(
            re.search(r"Phase\s+2", self.blueprint_content, re.IGNORECASE),
            "Blueprint roadmap must define Phase 2",
        )
        self.assertTrue(
            re.search(r"Phase\s+3", self.blueprint_content, re.IGNORECASE),
            "Blueprint roadmap must define Phase 3",
        )


class TestMasterReportSynthesis(unittest.TestCase):
    """6. Master Report Cross-Synthesis."""

    def setUp(self):
        self.master_content = read_deliverable("master")

    def test_master_report_domains_integration(self):
        """Validates that master report integrates R1, R2, R3, and R4."""
        # R1 synthesis
        self.assertTrue(
            re.search(r"VideoCaptureCamera2|MIN_ZOOM|SCALER_CROP_REGION|OverconstrainedError", self.master_content),
            "Master report must synthesize R1 Root Cause Analysis",
        )
        # R2 synthesis
        self.assertTrue(
            re.search(r"Pixel|Galaxy|iPhone", self.master_content),
            "Master report must synthesize R2 Hardware Matrix",
        )
        # R3 synthesis
        self.assertTrue(
            re.search(r"CubiCasa|MagicPlan|Matterport|Polycam|Canvas", self.master_content),
            "Master report must synthesize R3 Commercial Benchmarks",
        )
        # R4 synthesis
        self.assertTrue(
            re.search(r"Direction|Capacitor|Plugin|Roadmap", self.master_content),
            "Master report must synthesize R4 Architecture Blueprints",
        )

    def test_master_report_cross_references(self):
        """Validates that master report cross-references the individual domain reports."""
        r1_ref = bool(re.search(r"camera2_webrtc_rca_report|DOC-RCA-CAM2-001|Root Cause Analysis", self.master_content, re.I))
        r2_ref = bool(re.search(r"smartphone_hardware_browser_matrix|DOC-MAT-HW-002|Hardware.*Matrix", self.master_content, re.I))
        r3_ref = bool(re.search(r"commercial_scanning_benchmark|DOC-BENCH-MKT-003|Commercial.*Benchmark", self.master_content, re.I))
        r4_ref = bool(re.search(r"woninginrichter_architecture_blueprint|DOC-ARCH-DIRB-004|Architecture.*Blueprint", self.master_content, re.I))

        self.assertTrue(r1_ref, "Master report must reference R1 Root Cause Analysis report")
        self.assertTrue(r2_ref, "Master report must reference R2 Hardware Matrix report")
        self.assertTrue(r3_ref, "Master report must reference R3 Commercial Benchmark report")
        self.assertTrue(r4_ref, "Master report must reference R4 Architecture Blueprint report")


if __name__ == "__main__":
    unittest.main(verbosity=2)
