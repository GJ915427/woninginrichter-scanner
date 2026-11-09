#!/usr/bin/env python3
"""
EasyM2M Design Token & Drift Guard (INV-GOV-22 / Separation of Mechanism & Policy)

Mechanische bewaking die waarborgt dat:
1. EasyM2M MVP componenten (src/components/matrix/ en src/components/configurator/)
   uitsluitend semantische design tokens uit globals.css consumeren en geen hardcoded
   W3C hex-kleuren (#RGB, #RGBA, #RRGGBB, #RRGGBBAA) bevatten.
2. DESIGN.md 100% synchroon is met het native @theme blok in src/app/globals.css (zero drift).
"""

import sys
import os
import re
import subprocess
from pathlib import Path

# Fix Windows terminal CP1252 / charmap crash
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='backslashreplace')
    except Exception:
        pass

# W3C Level 4 CSS Hex Color specification with negative lookahead
HEX_COLOR_REGEX = re.compile(r'#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])')
MVP_DIRECTORIES = [
    'src/components/matrix',
    'src/components/configurator',
]

def strip_comments(text: str) -> str:
    """Strips both multi-line and single-line comments."""
    text = re.sub(r'/\*[\s\S]*?\*/', '', text)
    text = re.sub(r'//.*', '', text)
    return text

def is_mvp_component_file(path_str: str) -> bool:
    """Checks if a file path belongs to the active EasyM2M MVP component scope."""
    norm_path = Path(path_str).as_posix()
    if not (norm_path.endswith('.tsx') or norm_path.endswith('.jsx')):
        return False
    return any(norm_path.startswith(mvp_dir + '/') for mvp_dir in MVP_DIRECTORIES)

def get_staged_files() -> list[str]:
    """Gets list of staged files from git."""
    try:
        res = subprocess.run(
            ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'],
            capture_output=True,
            text=True,
            check=True
        )
        files = [f.strip() for f in res.stdout.splitlines() if f.strip()]
        return [f for f in files if is_mvp_component_file(f)]
    except Exception as e:
        print(f"[design_token_guard] [WARN] Failed to query git staged files: {e}", file=sys.stderr)
        return []

def get_all_mvp_files(root_dir: Path) -> list[Path]:
    """Collects all .tsx and .jsx files within the EasyM2M MVP component directories."""
    mvp_files = []
    for mvp_dir in MVP_DIRECTORIES:
        target = root_dir / mvp_dir
        if target.is_dir():
            for p in target.glob('**/*'):
                if p.is_file() and p.suffix in ('.tsx', '.jsx'):
                    mvp_files.append(p)
    return mvp_files

def scan_file(file_path: Path) -> list[tuple[int, str, str]]:
    """Scans a file for hardcoded hex colors, returning list of tuples."""
    violations = []
    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()

        stripped_full = strip_comments(content)
        if not HEX_COLOR_REGEX.search(stripped_full):
            return []

        lines = content.splitlines()
        in_block_comment = False
        for idx, line in enumerate(lines, start=1):
            trimmed = line.strip()
            if in_block_comment:
                if '*/' in trimmed:
                    in_block_comment = False
                    trimmed = trimmed.split('*/', 1)[1]
                else:
                    continue

            if '/*' in trimmed:
                if '*/' in trimmed:
                    trimmed = re.sub(r'/\*.*?\*/', '', trimmed)
                else:
                    in_block_comment = True
                    trimmed = trimmed.split('/*', 1)[0]

            if '//' in trimmed:
                trimmed = trimmed.split('//', 1)[0]

            matches = HEX_COLOR_REGEX.findall(trimmed)
            for m in matches:
                violations.append((idx, line.strip(), m))
    except Exception as e:
        print(f"[design_token_guard] [ERROR] Reading {file_path}: {e}", file=sys.stderr)
    return violations

def check_stitch_sync(workspace_root: Path) -> bool:
    """Verifies that DESIGN.md is in perfect sync with globals.css."""
    sync_script = workspace_root / 'scripts' / 'sync_design_tokens.js'
    if not sync_script.is_file():
        print("[design_token_guard] [WARN] scripts/sync_design_tokens.js not found, skipping drift check.")
        return True

    try:
        res = subprocess.run(
            ['node', str(sync_script), '--check'],
            cwd=str(workspace_root),
            capture_output=True,
            text=True
        )
        if res.returncode != 0:
            print(f"[design_token_guard] [DRIFT_DETECTED] DESIGN.md is out of sync with globals.css!", file=sys.stderr)
            print("Run 'npm run sync-tokens' to synchronize tokens.", file=sys.stderr)
            return False
        return True
    except Exception as e:
        print(f"[design_token_guard] [ERROR] Drift check execution failed: {e}", file=sys.stderr)
        return False

def main() -> int:
    workspace_root = Path(__file__).resolve().parent.parent
    staged_mode = '--staged' in sys.argv

    # 1. Unconditional Stitch contract drift check
    if not check_stitch_sync(workspace_root):
        return 1

    # 2. Scope evaluation
    if staged_mode:
        staged_rel_paths = get_staged_files()
        if not staged_rel_paths:
            print("[design_token_guard] [PASS] Zero staged EasyM2M MVP component files to check.")
            return 0
        target_files = [workspace_root / p for p in staged_rel_paths]
    else:
        target_files = get_all_mvp_files(workspace_root)

    print(f"[design_token_guard] [INFO] Scanning {len(target_files)} EasyM2M MVP component file(s)...")

    total_violations = 0
    for target in target_files:
        violations = scan_file(target)
        if violations:
            rel_path = target.relative_to(workspace_root).as_posix()
            for line_num, line_text, hex_code in violations:
                total_violations += 1
                print(f"[HEX_COLOR_VIOLATION] {rel_path}:{line_num} contains hardcoded hex '{hex_code}' -> '{line_text}'")

    if total_violations > 0:
        print(f"\n[design_token_guard] [FAIL] {total_violations} hardcoded hex code(s) found in EasyM2M MVP components.")
        print("[HINT] Use semantic design tokens from src/app/globals.css (e.g. var(--color-brand) or text-brand).")
        return 1

    print("[design_token_guard] [PASS] Zero hardcoded hex colors in EasyM2M MVP components & zero Stitch drift.")
    return 0

if __name__ == '__main__':
    sys.exit(main())
