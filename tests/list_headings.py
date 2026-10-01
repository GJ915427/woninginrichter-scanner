import io
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

WORKSPACE = Path(__file__).resolve().parent.parent
DOCS_DIR = WORKSPACE / "docs"

rca_text = (DOCS_DIR / "camera2_webrtc_rca_report.md").read_text(encoding="utf-8")
matrix_text = (DOCS_DIR / "smartphone_hardware_browser_matrix.md").read_text(encoding="utf-8")

print("=== RCA HEADINGS ===")
for line in rca_text.splitlines():
    if line.startswith("#"):
        print(line)

print("\n=== MATRIX HEADINGS ===")
for line in matrix_text.splitlines():
    if line.startswith("#"):
        print(line)
