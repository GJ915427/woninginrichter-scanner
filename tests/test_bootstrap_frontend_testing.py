import pytest
from pathlib import Path
import sys

# Ensure scripts directory is available for import
scripts_path = Path(__file__).parent.parent / "scripts"
if str(scripts_path) not in sys.path:
    sys.path.insert(0, str(scripts_path))

from bootstrap_frontend_testing import (
    detect_frontend_stack,
    scaffold_playwright_config,
    check_frontend_readiness,
)


def test_detect_frontend_stack_nextjs(tmp_path: Path):
    # Mock Next.js package.json
    pkg = tmp_path / "package.json"
    pkg.write_text('{"dependencies": {"next": "^14.0.0", "react": "^18.0.0"}}', encoding="utf-8")
    
    stack = detect_frontend_stack(tmp_path)
    assert stack["framework"] == "next"
    assert stack["typology"] == "NODE_SPA"


def test_scaffold_playwright_config_structure(tmp_path: Path):
    config_content = scaffold_playwright_config(
        target_dir=tmp_path,
        port=8088,
        dev_cmd="npm run dev",
        url="http://localhost:8088",
        test_dir="tests/e2e",
    )
    assert "baseURL: 'http://localhost:8088'" in config_content
    assert "reuseExistingServer: !process.env.CI" in config_content
    assert "testDir: 'tests/e2e'" in config_content


def test_check_frontend_readiness_missing(tmp_path: Path):
    is_ready, missing = check_frontend_readiness(tmp_path)
    assert not is_ready
    assert len(missing) > 0
