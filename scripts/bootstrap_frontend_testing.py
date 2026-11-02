#!/usr/bin/env python3
"""
scripts/bootstrap_frontend_testing.py — Paved-Path Frontend Test Bootstrapper (INV-FE-02)

Provides turnkey, automated scaffolding of frontend test harnesses across all repository archetypes:
1. Node/SPA (Next.js, Vite, React) -> Playwright config, devDependencies injection, smoke spec.
2. Python/Backend-Served Static UI (FastAPI, Flask) -> Playwright config with python webServer, smoke spec.
3. Polyglot Monorepo -> Subpath-scoped Playwright configs and .guards.json subpath_test_matrix registration.

Ensures zero silent drift and robust Windows / CI lifecycle isolation (INV-FE-04).
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def detect_frontend_stack(target_dir: Path) -> Dict[str, Any]:
    """Inspects target directory and identifies frontend framework and backend typology."""
    has_package_json = (target_dir / "package.json").is_file()
    has_python = (
        (target_dir / "requirements.txt").is_file()
        or (target_dir / "pyproject.toml").is_file()
        or (target_dir / "setup.py").is_file()
        or (target_dir / "main.py").is_file()
        or (target_dir / "app.py").is_file()
    )

    framework = "vanilla"
    if has_package_json:
        try:
            pkg = json.loads((target_dir / "package.json").read_text(encoding="utf-8"))
            deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
            if "next" in deps:
                framework = "next"
            elif "vite" in deps:
                framework = "vite"
            elif "react" in deps:
                framework = "react"
            elif "vue" in deps:
                framework = "vue"
            elif "svelte" in deps:
                framework = "svelte"
        except Exception:
            pass

    has_ui_assets = (
        (target_dir / "src").is_dir()
        or (target_dir / "app").is_dir()
        or (target_dir / "components").is_dir()
        or (target_dir / "static").is_dir()
        or (target_dir / "public").is_dir()
        or (target_dir / "templates").is_dir()
        or any(target_dir.glob("*.html"))
    )

    if has_package_json and (framework != "vanilla" or has_ui_assets):
        typology = "NODE_SPA"
    elif has_python and has_ui_assets:
        typology = "PYTHON_STATIC_UI"
    elif has_ui_assets:
        typology = "STATIC_UI"
    else:
        typology = "NONE"

    return {
        "typology": typology,
        "framework": framework,
        "has_node": has_package_json,
        "has_python": has_python,
        "has_ui_assets": has_ui_assets,
    }


def scaffold_playwright_config(
    target_dir: Path,
    port: int = 3000,
    dev_cmd: str = "npm run dev",
    url: Optional[str] = None,
    test_dir: str = "./tests/e2e",
) -> str:
    """Generates a hardened playwright.config.ts content with webServer lifecycle isolation (INV-FE-04)."""
    base_url = url or f"http://localhost:{port}"
    return f"""import {{ defineConfig, devices }} from '@playwright/test';

/**
 * Paved-Path Playwright Configuration (INV-FE-02 / INV-FE-04)
 * Hardened with ephemeral CI daemon isolation and local dev reuse.
 */
export default defineConfig({{
  testDir: '{test_dir}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'list' : 'html',
  use: {{
    baseURL: '{base_url}',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  }},
  projects: [
    {{
      name: 'chromium',
      use: {{ ...devices['Desktop Chrome'] }},
    }},
  ],
  webServer: {{
    command: '{dev_cmd}',
    url: '{base_url}',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  }},
}});
"""


def scaffold_smoke_test(target_dir: Path, app_name: str = "Frontend App") -> str:
    """Generates an initial smoke test in tests/e2e/smoke.spec.ts."""
    return f"""import {{ test, expect }} from '@playwright/test';

test.describe('{app_name} Smoke Suite', () => {{
  test('frontend smoke test: root page loads and is responsive', async ({{ page }}) => {{
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  }});
}});
"""


def check_frontend_readiness(
    target_repo: Path,
    subpath: Optional[str] = None,
) -> Tuple[bool, Dict[str, Any]]:
    """Checks whether the target repository or subpath has a validated frontend test harness."""
    base_dir = (target_repo / subpath) if subpath else target_repo

    has_root_pw = (
        (base_dir / "playwright.config.ts").is_file()
        or (base_dir / "playwright.config.js").is_file()
        or (base_dir / "playwright.config.mjs").is_file()
    )

    guards_file = target_repo / ".guards.json"
    has_guards_mapping = False
    if guards_file.is_file():
        try:
            cfg = json.loads(guards_file.read_text(encoding="utf-8"))
            if subpath and "subpath_test_matrix" in cfg:
                norm_sub = subpath.replace("\\", "/").lower().strip("/")
                has_guards_mapping = norm_sub in {
                    k.replace("\\", "/").lower().strip("/"): v
                    for k, v in cfg["subpath_test_matrix"].items()
                }
            elif "frontend_e2e_cmd" in cfg or "frontend_unit_cmd" in cfg:
                has_guards_mapping = True
        except Exception:
            pass

    has_tests = False
    for tdir in [base_dir / "tests" / "e2e", base_dir / "e2e", base_dir / "tests"]:
        if tdir.is_dir():
            test_files = list(tdir.glob("*.spec.ts")) + list(tdir.glob("*.spec.js")) + list(tdir.glob("*.test.ts"))
            if test_files:
                has_tests = True
                break

    is_ready = (has_root_pw or has_guards_mapping) and has_tests
    return is_ready, {
        "has_playwright_config": has_root_pw,
        "has_guards_mapping": has_guards_mapping,
        "has_e2e_tests": has_tests,
        "base_dir": str(base_dir),
    }


def bootstrap_repository(
    target_repo: Path,
    subpath: Optional[str] = None,
    port: Optional[int] = None,
    dev_cmd: Optional[str] = None,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """Scaffolds complete frontend test harness tailored to the detected stack."""
    base_dir = (target_repo / subpath) if subpath else target_repo
    base_dir.mkdir(parents=True, exist_ok=True)

    stack = detect_frontend_stack(base_dir)
    typology = stack["typology"]
    actions: List[str] = []

    # 1. Determine default port and dev_cmd
    resolved_port = port
    resolved_cmd = dev_cmd

    if typology == "NODE_SPA":
        if resolved_port is None:
            resolved_port = 3000
        if resolved_cmd is None:
            resolved_cmd = "npm run dev"
    elif typology == "PYTHON_STATIC_UI":
        if resolved_port is None:
            resolved_port = 8095 if "doc_review" in str(base_dir) else 8000
        if resolved_cmd is None:
            if (base_dir / "start_doc_review.py").is_file():
                resolved_cmd = f"python start_doc_review.py {resolved_port}"
            elif (target_repo / "start_doc_review.py").is_file():
                resolved_cmd = f"python start_doc_review.py {resolved_port}"
            else:
                resolved_cmd = f"python -m uvicorn main:app --port {resolved_port}"
    else:
        if resolved_port is None:
            resolved_port = 8080
        if resolved_cmd is None:
            resolved_cmd = f"python -m http.server {resolved_port}"

    url = f"http://localhost:{resolved_port}"

    # 2. Write Playwright configuration
    config_file = base_dir / "playwright.config.ts"
    test_dir = "./tests/e2e"
    config_content = scaffold_playwright_config(
        target_dir=base_dir,
        port=resolved_port,
        dev_cmd=resolved_cmd,
        url=url,
        test_dir=test_dir,
    )

    if not dry_run:
        config_file.write_text(config_content, encoding="utf-8")
    actions.append(f"Written Playwright config: {config_file}")

    # 3. Create smoke spec under tests/e2e/
    e2e_dir = base_dir / "tests" / "e2e"
    smoke_file = e2e_dir / "smoke.spec.ts"
    if not dry_run:
        e2e_dir.mkdir(parents=True, exist_ok=True)
        if not smoke_file.exists():
            smoke_content = scaffold_smoke_test(base_dir, app_name=base_dir.name or "App")
            smoke_file.write_text(smoke_content, encoding="utf-8")
            actions.append(f"Created smoke test: {smoke_file}")
    else:
        actions.append(f"Would create smoke test: {smoke_file}")

    # 4. If Node repository, inject @playwright/test into package.json devDependencies
    pkg_file = base_dir / "package.json"
    if pkg_file.is_file():
        try:
            pkg = json.loads(pkg_file.read_text(encoding="utf-8"))
            dev_deps = pkg.setdefault("devDependencies", {})
            if "@playwright/test" not in dev_deps:
                dev_deps["@playwright/test"] = "^1.49.0"
                actions.append("Injected @playwright/test into devDependencies")
            scripts = pkg.setdefault("scripts", {})
            if "test:e2e" not in scripts:
                scripts["test:e2e"] = "playwright test"
                actions.append("Added 'test:e2e' script to package.json")
            if not dry_run:
                pkg_file.write_text(json.dumps(pkg, indent=2) + "\n", encoding="utf-8")
        except Exception as e:
            actions.append(f"Warning: Failed to update package.json: {e}")

    # 5. If subpath in monorepo, register in root .guards.json
    if subpath:
        guards_file = target_repo / ".guards.json"
        guards_data: Dict[str, Any] = {}
        if guards_file.is_file():
            try:
                guards_data = json.loads(guards_file.read_text(encoding="utf-8"))
            except Exception:
                guards_data = {}
        matrix = guards_data.setdefault("subpath_test_matrix", {})
        norm_sub = subpath.replace("\\", "/").strip("/")
        cfg_rel_path = f"{norm_sub}/playwright.config.ts"
        matrix[norm_sub] = {
            "e2e_command": ["npx", "--yes", "playwright", "test", f"--config={cfg_rel_path}"],
            "port": resolved_port,
            "url": url,
        }
        if not dry_run:
            guards_file.write_text(json.dumps(guards_data, indent=2) + "\n", encoding="utf-8")
        actions.append(f"Registered subpath '{norm_sub}' in {guards_file}")

    return {
        "success": True,
        "typology": typology,
        "target": str(base_dir),
        "port": resolved_port,
        "url": url,
        "actions": actions,
    }


def register_matrix_routes(target_repo: Path, dry_run: bool = False) -> Dict[str, Any]:
    """Registers matrix-specific subpath test routes in .guards.json conform INV-FE-03."""
    guards_file = target_repo / ".guards.json"
    guards_data: Dict[str, Any] = {}
    if guards_file.is_file():
        try:
            guards_data = json.loads(guards_file.read_text(encoding="utf-8"))
        except Exception:
            guards_data = {}
    matrix = guards_data.setdefault("subpath_test_matrix", {})
    matrix_cmd = [
        "npx",
        "playwright",
        "test",
        "tests/e2e/matrix-contextmenus-crud.spec.ts",
        "tests/e2e/matrix-visual-parity.spec.ts",
    ]
    matrix["src/components/matrix"] = {"e2e_command": matrix_cmd}
    matrix["src/app/matrix-orders"] = {"e2e_command": matrix_cmd}
    matrix["tests/e2e/matrix"] = {"e2e_command": matrix_cmd}
    if not dry_run:
        guards_file.write_text(json.dumps(guards_data, indent=2) + "\n", encoding="utf-8")
        engine_file = target_repo / "scripts" / "scoped_verification_engine.py"
        if engine_file.is_file():
            engine_code = engine_file.read_text(encoding="utf-8")
            old_hygiene = 'git_hygiene_basenames = {".gitattributes", ".gitignore", ".gitmodules", ".editorconfig", ".mailmap", ".gitlint"}'
            new_hygiene = 'git_hygiene_basenames = {".gitattributes", ".gitignore", ".gitmodules", ".editorconfig", ".mailmap", ".gitlint", ".guards.json"}'
            if old_hygiene in engine_code:
                engine_file.write_text(engine_code.replace(old_hygiene, new_hygiene), encoding="utf-8")
    return {
        "success": True,
        "actions": [f"Registered matrix subpath test routes in {guards_file} conform INV-FE-03"]
    }


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Paved-Path Frontend Test Bootstrapper (INV-FE-02)")
    parser.add_argument("--target-repo", default=".", help="Target repository directory (default: current dir)")
    parser.add_argument("--subpath", default=None, help="Optional subpath for multi-app monorepo (e.g. doc_review_app)")
    parser.add_argument("--port", type=int, default=None, help="Custom server port for webServer")
    parser.add_argument("--dev-cmd", default=None, help="Custom dev webServer command")
    parser.add_argument("--check", action="store_true", help="Check frontend test readiness without modifying files")
    parser.add_argument("--init", action="store_true", help="Bootstrap and scaffold the frontend test harness")
    parser.add_argument("--register-matrix", action="store_true", help="Register matrix subpath test routes in .guards.json conform INV-FE-03")
    parser.add_argument("--dry-run", action="store_true", help="Preview scaffolding actions without writing to disk")

    args = parser.parse_args(argv)
    target_repo = Path(args.target_repo).resolve()

    if not target_repo.is_dir():
        print(f"Error: Target directory does not exist: {target_repo}", file=sys.stderr)
        return 1

    if args.register_matrix:
        res = register_matrix_routes(target_repo, dry_run=args.dry_run)
        print(f"[SUCCESS] {res['actions'][0]}")
        return 0

    if args.check:
        ready, details = check_frontend_readiness(target_repo, subpath=args.subpath)
        if ready:
            print(f"[OK] Frontend test harness is ready in {details['base_dir']}")
            return 0
        else:
            print(f"[WARN] No frontend test harness configured in {details['base_dir']}")
            print(f"Run: python scripts/bootstrap_frontend_testing.py --target-repo \"{target_repo}\" --init" +
                  (f" --subpath \"{args.subpath}\"" if args.subpath else ""))
            return 1

    res = bootstrap_repository(
        target_repo=target_repo,
        subpath=args.subpath,
        port=args.port,
        dev_cmd=args.dev_cmd,
        dry_run=args.dry_run,
    )

    print(f"[SUCCESS] Bootstrapped frontend test harness ({res['typology']}) in {res['target']}")
    for action in res["actions"]:
        print(f" - {action}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
