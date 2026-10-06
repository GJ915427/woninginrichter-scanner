"""Milestone 5 Empirical Challenger Test Suite.

Adversarial stress-testing, contract verification, and security analysis for:
- Material Design 3 tokens and strict #FF6D00 badge indicator color
- Viewport meta tag and mobile-first touch target dimensions (>= 48px)
- Markdown renderer security against malicious XSS payloads (Node.js execution harness)
- Markdown renderer code block and inline code placeholder restoration (Empirical bug reproduction)
- Unauthorized comment edit HTTP 403 error banner and snackbar contract
- DOM selection and offset stability
"""

import json
import re
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
STATIC_DIR = PROJECT_ROOT / "doc_review_app" / "static"
CSS_FILE = STATIC_DIR / "css" / "m3_theme.css"
HTML_FILE = STATIC_DIR / "index.html"
JS_MARKDOWN = STATIC_DIR / "js" / "markdown.js"
JS_COMMENTS = STATIC_DIR / "js" / "comments.js"
JS_SELECTION = STATIC_DIR / "js" / "selection.js"
JS_APP = STATIC_DIR / "js" / "app.js"


class TestMilestone5ContractAdherence:
    """Contract verification for M3 tokens, viewport, and touch targets."""

    def test_css_orange_badge_token_strict_contract(self):
        """Verify strict contract token #FF6D00 is defined and used for badges."""
        assert CSS_FILE.exists(), f"Missing CSS file: {CSS_FILE}"
        css_text = CSS_FILE.read_text(encoding="utf-8")

        # 1. Token definition at :root
        assert "--md-sys-color-badge-orange: #FF6D00;" in css_text or "--color-badge-orange: #FF6D00;" in css_text

        # 2. Orange badge component uses the token
        assert ".m3-orange-badge" in css_text
        badge_match = re.search(r"\.m3-orange-badge\s*\{([^}]+)\}", css_text)
        assert badge_match is not None, ".m3-orange-badge CSS rule not found"
        badge_body = badge_match.group(1)
        assert "var(--md-sys-color-badge-orange)" in badge_body or "#FF6D00" in badge_body

        # 3. Document nav badge uses the token
        nav_badge_match = re.search(r"\.document-nav-item__badge\s*\{([^}]+)\}", css_text)
        assert nav_badge_match is not None
        assert "var(--md-sys-color-badge-orange)" in nav_badge_match.group(1)

    def test_viewport_meta_tag_present_in_index_html(self):
        """Verify viewport meta tag exists with responsive width and initial-scale."""
        assert HTML_FILE.exists(), f"Missing HTML file: {HTML_FILE}"
        html_text = HTML_FILE.read_text(encoding="utf-8")

        # Regex match <meta name="viewport" content="...">
        viewport_match = re.search(r'<meta\s+name=["\']viewport["\']\s+content=["\']([^"\']+)["\']', html_text, re.IGNORECASE)
        assert viewport_match is not None, "Viewport meta tag is missing in index.html"
        content = viewport_match.group(1).lower()
        assert "width=device-width" in content
        assert "initial-scale=1.0" in content or "initial-scale=1" in content

    def test_touch_target_dimensions_minimum_48px(self):
        """Verify all interactive touch targets specify >= 48px dimensions or tap area expansion."""
        assert CSS_FILE.exists()
        css_text = CSS_FILE.read_text(encoding="utf-8")

        # Buttons
        btn_match = re.search(r"\.m3-button\s*\{([^}]+)\}", css_text)
        assert btn_match is not None
        assert "min-height: 48px;" in btn_match.group(1)
        assert "min-width: 48px;" in btn_match.group(1)

        # Icon buttons
        icon_btn_match = re.search(r"\.m3-icon-button\s*\{([^}]+)\}", css_text)
        assert icon_btn_match is not None
        icon_body = icon_btn_match.group(1)
        assert "min-width: 48px;" in icon_body or "width: 48px;" in icon_body
        assert "min-height: 48px;" in icon_body or "height: 48px;" in icon_body

        # Orange badge accessible touch target expansion via ::after pseudo-element
        badge_touch_match = re.search(r"\.m3-orange-badge::after\s*\{([^}]+)\}", css_text)
        assert badge_touch_match is not None
        badge_touch_body = badge_touch_match.group(1)
        assert "width: 48px;" in badge_touch_body or "min-width: 48px;" in badge_touch_body
        assert "height: 48px;" in badge_touch_body or "min-height: 48px;" in badge_touch_body


class TestAdversarialMarkdownRenderer:
    """Adversarial stress-testing and empirical defect verification of markdown.js using Node.js."""

    @classmethod
    def _render_markdown_in_node(cls, raw_input: str) -> str:
        js_code = f"""
        const md = require({json.dumps(str(JS_MARKDOWN))});
        const input = {json.dumps(raw_input)};
        const output = md.renderMarkdown(input);
        process.stdout.write(output);
        """
        proc = subprocess.run(
            ["node", "-e", js_code],
            capture_output=True,
            text=True,
            check=True
        )
        return proc.stdout

    def test_malicious_script_tags_neutralized(self):
        """Verify <script> tags in plain text, headers, and quotes are escaped."""
        payloads = [
            "<script>alert(1)</script>",
            "<SCRIPT SRC='http://evil.com/xss.js'></SCRIPT>",
            "# Header <script>alert('header')</script>",
            "> Quote <script>alert('quote')</script>",
            "* Bullet <script>alert('bullet')</script>",
            "1. List <script>alert('list')</script>",
            "**Bold <script>alert('bold')</script>**",
            "*Italic <script>alert('italic')</script>*"
        ]
        for p in payloads:
            out = self._render_markdown_in_node(p)
            assert "<script" not in out.lower(), f"Unescaped <script> tag found in output for payload: {p}\nOutput: {out}"
            assert "&lt;script" in out.lower()

    def test_malicious_img_svg_iframe_attributes_neutralized(self):
        """Verify image/svg/iframe tags and event handlers (onerror, onload) cannot execute."""
        payloads = [
            "<img src=x onerror=alert(1)>",
            "<img src=\"data:image/svg+xml;utf8,<svg onload=alert(1)>\" />",
            "<svg onload=alert(1)>",
            "<svg/onload=alert(1)>",
            "<iframe src=\"javascript:alert(1)\"></iframe>",
            "<body onload=alert('body')>",
            "<input autofocus onfocus=alert(1)>"
        ]
        for p in payloads:
            out = self._render_markdown_in_node(p)
            assert "<img" not in out.lower() or "&lt;img" in out.lower()
            assert "<svg" not in out.lower()
            assert "<iframe" not in out.lower()
            assert "onerror=" not in out or "&lt;img" in out.lower()
            assert "onload=" not in out or "&lt;" in out.lower()

    def test_placeholder_tampering_resistance(self):
        """Verify user supplying internal placeholder tokens cannot trigger unescaped script execution."""
        tamper_payload = "%%M3_CODE_BLOCK_0%% and %%M3_INLINE_CODE_0%% with <script>alert(1)</script>"
        out = self._render_markdown_in_node(tamper_payload)
        assert "<script>" not in out
        assert "&lt;script&gt;" in out

    def test_empirical_defect_code_block_token_corruption(self):
        """EMPIRICAL PROOF OF DEFECT:

        Demonstrate that code block placeholders (%%M3_CODE_BLOCK_0%%) are corrupted
        by the subsequent markdown italics regex (_([^_\\n]+)_), transforming _CODE_
        into <em>CODE</em>. As a result, the code block restoration regex
        (/%%M3_CODE_BLOCK_(\\d+)%%/g) fails to match, and the code block is never rendered.
        """
        code_block_payload = "```python\nx = 10\ny = 20\n```"
        out = self._render_markdown_in_node(code_block_payload)

        # The defect causes the placeholder to become %%M3<em>CODE</em>BLOCK_0%%
        has_corrupted_token = "%%M3<em>CODE</em>BLOCK_0%%" in out
        code_block_restored = "<pre class=\"m3-code-block\">" in out and "x = 10" in out

        # Assert defect resolution: The code block IS restored, and corrupted token is NOT present
        assert not has_corrupted_token, "Corrupted token %%M3<em>CODE</em>BLOCK_0%% found!"
        assert code_block_restored, "Code block was not restored!"

    def test_empirical_defect_inline_code_token_corruption(self):
        """EMPIRICAL PROOF OF DEFECT:

        Demonstrate that inline code placeholders (%%M3_INLINE_CODE_0%%) are corrupted
        by the subsequent markdown italics regex (_([^_\\n]+)_), transforming _INLINE_
        into <em>INLINE</em>. As a result, the inline code restoration regex
        (/%%M3_INLINE_CODE_(\\d+)%%/g) fails to match, and the inline code is never rendered.
        """
        inline_payload = "Run `npm install` to setup."
        out = self._render_markdown_in_node(inline_payload)

        # The defect causes the placeholder to become %%M3<em>INLINE</em>CODE_0%%
        has_corrupted_token = "%%M3<em>INLINE</em>CODE_0%%" in out
        inline_code_restored = "<code class=\"m3-inline-code\">" in out and "npm install" in out

        # Assert defect resolution: The inline code IS restored, and corrupted token is NOT present
        assert not has_corrupted_token, "Corrupted token %%M3<em>INLINE</em>CODE_0%% found!"
        assert inline_code_restored, "Inline code was not restored!"


class TestUnauthorizedEditErrorBanner:
    """Stress-testing unauthorized comment edit error handling in comments.js and backend."""

    def test_comments_js_contains_strict_403_banner_contract(self):
        """Verify comments.js specifically checks for 403 and displays exact required banner."""
        assert JS_COMMENTS.exists()
        comments_text = JS_COMMENTS.read_text(encoding="utf-8")

        # Verify 403 condition check
        assert "err.status === 403" in comments_text or "status === 403" in comments_text

        # Verify exact error banner text
        expected_msg = "Forbidden: You cannot edit another user's comment"
        assert expected_msg in comments_text

        # Verify showToast error notification invocation
        assert f'showToast("{expected_msg}", \'error\');' in comments_text or f"showToast('{expected_msg}', 'error')" in comments_text

    def test_comments_js_fallback_on_general_errors(self):
        """Verify non-403 errors fall back to err.message or general error banner."""
        comments_text = JS_COMMENTS.read_text(encoding="utf-8")
        assert "Failed to update comment." in comments_text

    def test_app_js_snackbar_error_handling(self):
        """Verify showToast safely assigns textContent without innerHTML and applies m3-snackbar--error."""
        assert JS_APP.exists()
        app_text = JS_APP.read_text(encoding="utf-8")

        # Verify textContent is used to set message (safe against DOM XSS)
        assert "textContent = message" in app_text
        # Verify m3-snackbar--error class is applied
        assert "m3-snackbar--error" in app_text

    def test_backend_and_client_e2e_unauthorized_edit_rejection(
        self, client: TestClient, auth_headers_reviewer1, auth_headers_reviewer2
    ):
        """Empirically trigger unauthorized edit and verify backend returns HTTP 403 with exact payload."""
        # 1. Sync a test document
        sync_resp = client.post(
            "/api/documents/sync",
            headers=auth_headers_reviewer1,
            json={
                "filename": "challenger_test.md",
                "content": "# Title\nReviewer 1 test document text."
            }
        )
        assert sync_resp.status_code in (200, 201), f"Sync failed: {sync_resp.text}"
        doc_id = sync_resp.json()["id"]

        # 2. Reviewer 1 creates an annotation and root comment
        create_resp = client.post(
            f"/api/documents/{doc_id}/annotations",
            headers=auth_headers_reviewer1,
            json={
                "start_offset": 0,
                "end_offset": 7,
                "selected_text": "# Title",
                "comment_content": "Reviewer 1 initial comment"
            }
        )
        assert create_resp.status_code in (200, 201), f"Create annotation failed: {create_resp.text}"
        annotation_data = create_resp.json()
        comments = annotation_data.get("comments") or []
        comment_id = comments[0]["id"] if comments else annotation_data.get("root_comment", {}).get("id")

        # 3. Reviewer 2 attempts to edit Reviewer 1's comment
        edit_resp = client.put(
            f"/api/comments/{comment_id}",
            headers=auth_headers_reviewer2,
            json={"content": "Malicious modification by unauthorized reviewer"}
        )
        # Verify HTTP 403 Forbidden is returned
        assert edit_resp.status_code == 403
        resp_json = edit_resp.json()
        # Verify detail indicates forbidden ownership violation
        assert "forbidden" in resp_json.get("detail", "").lower() or "cannot edit" in resp_json.get("detail", "").lower()
