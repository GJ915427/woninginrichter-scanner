import io
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

WORKSPACE = Path(__file__).resolve().parent.parent
DOCS_DIR = WORKSPACE / "docs"

rca_text = (DOCS_DIR / "camera2_webrtc_rca_report.md").read_text(encoding="utf-8")

def show(text, start_str, end_str):
    s = text.find(start_str)
    if s == -1:
        print("START NOT FOUND:", start_str)
        return
    e = text.find(end_str, s)
    if e == -1:
        e = s + 4000
    print(text[s:e])

print(">>> 1. GEOMETRIC MATH (RCA 1.2):")
show(rca_text, "### 1.2 Mathematical Proof: Why Zoom $< 1.0$ is Impossible in `SCALER_CROP_REGION`", "## 2. Android Camera2 HAL Architecture")

print("\n" + "="*70 + "\n>>> 2. W3C § 4.3.7 (RCA 4.1):")
show(rca_text, "### 4.1 The Mechanism: W3C Media Capture § 4.3.7 \"Advanced\" Constraint Processing", "### 4.2 Code Walkthrough in Web Applications")
