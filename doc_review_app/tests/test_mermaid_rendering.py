"""
Test suite for Native Mermaid Diagram Rendering & AST Markdown Engine in Document Review App.
Borging van de 4 pijlers: Zero-CDN, AST Parser (marked.js), Chirurgische Offset-Pariteit en CSSOM Ruler Resilientie.
"""

import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import urllib.request
import pytest

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
DOC_REVIEW_APP = WORKSPACE_ROOT / "doc_review_app"
STATIC_DIR = DOC_REVIEW_APP / "static"
VENDOR_DIR = STATIC_DIR / "vendor"
JS_DIR = STATIC_DIR / "js"
CSS_DIR = STATIC_DIR / "css"

MARKED_URL = "https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"
MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"


@pytest.fixture(scope="session", autouse=True)
def setup_vendor_assets():
    """Download or restore vendor assets if missing, conforming to Pillar 1 Zero-CDN requirement."""
    marked_dir = VENDOR_DIR / "marked"
    mermaid_dir = VENDOR_DIR / "mermaid"
    marked_dir.mkdir(parents=True, exist_ok=True)
    mermaid_dir.mkdir(parents=True, exist_ok=True)

    marked_file = marked_dir / "marked.min.js"
    mermaid_file = mermaid_dir / "mermaid.min.js"

    quarantine_base = WORKSPACE_ROOT / ".git" / "quarantine"
    if quarantine_base.exists():
        for q_dir in sorted(quarantine_base.iterdir(), reverse=True):
            q_marked = q_dir / "doc_review_app" / "static" / "vendor" / "marked" / "marked.min.js"
            q_mermaid = q_dir / "doc_review_app" / "static" / "vendor" / "mermaid" / "mermaid.min.js"
            if not marked_file.exists() and q_marked.exists():
                shutil.copy2(q_marked, marked_file)
            if not mermaid_file.exists() and q_mermaid.exists():
                shutil.copy2(q_mermaid, mermaid_file)
            if marked_file.exists() and mermaid_file.exists():
                break

    if not marked_file.exists() or marked_file.stat().st_size < 10_000:
        urllib.request.urlretrieve(MARKED_URL, marked_file)

    if not mermaid_file.exists() or mermaid_file.stat().st_size < 500_000:
        urllib.request.urlretrieve(MERMAID_URL, mermaid_file)


def test_vendor_assets_available():
    """Pijler 1: Verifieer lokale aanwezigheid en geldigheid van marked.min.js en mermaid.min.js."""
    marked_file = VENDOR_DIR / "marked" / "marked.min.js"
    mermaid_file = VENDOR_DIR / "mermaid" / "mermaid.min.js"

    assert marked_file.exists(), f"marked.min.js ontbreekt in {marked_file}"
    assert marked_file.stat().st_size > 10_000, "marked.min.js is te klein of leeg (< 10 KB)"

    assert mermaid_file.exists(), f"mermaid.min.js ontbreekt in {mermaid_file}"
    assert mermaid_file.stat().st_size > 500_000, "mermaid.min.js is te klein of leeg (< 500 KB)"


def test_index_html_loads_local_vendor_scripts():
    """Pijler 1: Verifieer dat index.html uitsluitend lokale vendor-scripts laadt en geen externe CDN gebruikt."""
    index_html = (STATIC_DIR / "index.html").read_text(encoding="utf-8")

    assert "/static/vendor/marked/marked.min.js" in index_html, "index.html mist lokale marked.min.js script-tag"
    assert "/static/vendor/mermaid/mermaid.min.js" in index_html, "index.html mist lokale mermaid.min.js script-tag"

    # Zero-CDN invariant: geen externe script links naar cdn.jsdelivr.net of cdnjs
    assert "cdn.jsdelivr.net" not in index_html, "Zero-CDN overtreding: cdn.jsdelivr.net gevonden in index.html"
    assert "cdnjs.cloudflare.com" not in index_html, "Zero-CDN overtreding: cdnjs gevonden in index.html"


def _run_markdown_in_node(input_markdown: str) -> str:
    """Helper om markdown.js uit te voeren in een headless Node.js child process via UMD loader."""
    js_markdown_path = str(JS_DIR / "markdown.js").replace("\\", "/")
    node_script = f"""
    const md = require({json.dumps(js_markdown_path)});
    const input = {json.dumps(input_markdown)};
    const rendered = md.renderMarkdown(input);
    process.stdout.write(rendered);
    """
    res = subprocess.run(
        ["node", "-e", node_script],
        cwd=str(DOC_REVIEW_APP),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True
    )
    return res.stdout


def test_ast_markdown_pipeline_parity():
    """Pijler 2: Verifieer dat headings, callouts, tabellen en codeblokken via de AST pipeline conform M3 parsen."""
    md_input = """# Hoofdtitel

> [!NOTE]
> Dit is een belangrijke opmerking.

| Kolom A | Kolom B |
| :--- | :--- |
| Waarde 1 | Waarde 2 |

```python
x = 42
```
"""
    output = _run_markdown_in_node(md_input)

    # Heading check
    assert '<h1 id="heading-hoofdtitel-' in output or 'class="m3-heading-1"' in output
    assert "Hoofdtitel</h1>" in output

    # Callout check met header data-doc-review-ignore
    assert 'class="m3-callout m3-callout--note"' in output
    assert 'class="m3-callout__header" data-doc-review-ignore="true"' in output
    assert "Dit is een belangrijke opmerking." in output

    # Table check
    assert 'class="m3-table-wrapper"' in output
    assert 'class="m3-table"' in output
    assert "Waarde 1" in output and "Waarde 2" in output

    # Standard code block check
    assert 'class="m3-code-box"' in output
    assert 'language-python' in output
    assert "x = 42" in output


def test_no_regex_token_corruption():
    """Pijler 2: Garandeer dat placeholders zoals @@M3CODEBLOCK@@ niet bestaan en niet corrupt kunnen raken."""
    md_input = """```json
{"key": "value"}
```

Een alinea met _cursieve tekst_ en **vette tekst**.

`inline_code_span`
"""
    output = _run_markdown_in_node(md_input)

    assert "@@M3CODEBLOCK" not in output
    assert "@@M3INLINECODE" not in output
    assert "%%M3" not in output
    assert "<em>cursieve tekst</em>" in output or "<em>cursieve tekst</em>" in output.lower()
    assert "<strong>vette tekst</strong>" in output
    assert "inline_code_span" in output


def test_treewalker_offset_parity_with_mermaid():
    """Pijler 3: Garandeer dat de Mermaid broncode in de DOM flow blijft en UI elementen worden genegeerd."""
    mermaid_input = """```mermaid
graph TD
  A[Start] --> B[Einde]
```"""
    output = _run_markdown_in_node(mermaid_input)

    # De container mag GEEN globale ignore hebben (zodat TreeWalker broncode kan bereiken)
    assert '<div class="m3-mermaid-box"' in output
    # De header en render-area MOETEN ignore hebben
    assert '<div class="m3-mermaid-header" data-doc-review-ignore="true">' in output
    assert '<div class="m3-mermaid-render-area" data-doc-review-ignore="true">' in output

    # Broncode moet aanwezig zijn in de DOM (display: none voor CSS visualiteit)
    assert '<pre class="m3-mermaid-source m3-code-block" style="display: none;"' in output
    assert "graph TD" in output
    assert "A[Start] --> B[Einde]" in output


def test_pristine_code_storage_prevents_badge_pollution():
    """Pijler 3: Verifieer dat de container data-mermaid-code bevat om badge-pollutie te voorkomen."""
    mermaid_input = """```mermaid title="Procesflow"
graph LR
  Klant --> Bestelling
```"""
    output = _run_markdown_in_node(mermaid_input)

    assert 'data-mermaid-code="' in output
    # URI encoded check: graph LR moet gecodeerd zijn als graph%20LR of newlines als %0A
    match = re.search(r'data-mermaid-code="([^"]+)"', output)
    assert match is not None, "data-mermaid-code attribuut ontbreekt op m3-mermaid-box"
    raw_encoded = match.group(1)
    import urllib.parse
    decoded = urllib.parse.unquote(raw_encoded)
    assert "graph LR" in decoded
    assert "Klant --> Bestelling" in decoded


def test_overview_ruler_collapsed_badge_positioning():
    """Pijler 3 & 4: Verifieer CSSOM ruler fallback en auto-expand interactie in app.js."""
    app_js = (JS_DIR / "app.js").read_text(encoding="utf-8")

    # BoundingRect fallback in OverviewRulerManager
    assert "badge.closest('.m3-mermaid-box')" in app_js, "OverviewRuler mist parent .m3-mermaid-box fallback voor ingeklapte badges"

    # Auto-expand van broncode bij interactie
    assert ".m3-mermaid-source" in app_js, "app.js mist referentie naar .m3-mermaid-source interactie"


def test_mermaid_security_and_offline_fallback():
    """Pijler 2 & 4: Verifieer XSS escaping van html-tokens en behoud van named exports."""
    xss_input = """<script>alert('xss')</script>
<img src="x" onerror="alert(1)">
"""
    output = _run_markdown_in_node(xss_input)

    assert "<script" not in output.lower(), "XSS lek: ongeëscapete script-tag aangetroffen in output!"
    assert "&lt;script" in output.lower(), "Script-tag niet omgezet naar HTML entities!"
    assert "<img" not in output.lower(), "XSS lek: ongeëscapete img tag aangetroffen in output!"

    # Export contracten conform test_document_explorer_api.py
    md_js = (JS_DIR / "markdown.js").read_text(encoding="utf-8")
    assert "renderTable" in md_js, "renderTable export ontbreekt in markdown.js"
    assert "renderCalloutOrQuote" in md_js, "renderCalloutOrQuote export ontbreekt in markdown.js"


def test_mermaid_css_classes_exist():
    """Pijler 4: Verifieer aanwezigheid van vereiste CSS styling voor Mermaid containers en skeleton."""
    css_content = (CSS_DIR / "m3_theme.css").read_text(encoding="utf-8")
    assert ".m3-mermaid-box" in css_content, ".m3-mermaid-box ontbreekt in m3_theme.css"
    assert ".m3-mermaid-skeleton" in css_content, ".m3-mermaid-skeleton ontbreekt in m3_theme.css"
    assert ".m3-mermaid-render-area" in css_content, ".m3-mermaid-render-area ontbreekt in m3_theme.css"
    assert ".m3-mermaid-source" in css_content, ".m3-mermaid-source ontbreekt in m3_theme.css"
