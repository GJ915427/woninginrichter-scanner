"""Runner script for Document Review Web Application on port 8095.

Designed for standalone execution and integration with EasyQuotes DTAP dev stack.
"""

import os
import sys
from pathlib import Path
import uvicorn

PORT = 8095
if len(sys.argv) > 1:
    try:
        PORT = int(sys.argv[1])
    except ValueError:
        pass
elif "PORT" in os.environ:
    try:
        PORT = int(os.environ["PORT"])
    except ValueError:
        pass

def main() -> None:
    script_dir = Path(__file__).resolve().parent
    if str(script_dir) not in sys.path:
        sys.path.insert(0, str(script_dir))

    log_path = script_dir / "doc_review_app" / "server.log"
    try:
        log_file = open(log_path, "a", encoding="utf-8", buffering=1)
        if sys.stdout is None:
            sys.stdout = log_file
        if sys.stderr is None:
            sys.stderr = log_file
    except Exception:
        pass

    if sys.stdout:
        print("=" * 65)
        print(" [*] Document Review Web Application (Google Material Design 3)")
        print(f" [*] URL: http://localhost:{PORT}")
        print("=" * 65)

    from doc_review_app.config import settings
    default_host = "0.0.0.0" if ("PORT" in os.environ or "RENDER" in os.environ) else settings.host
    host = os.getenv("DOC_REVIEW_HOST", default_host)

    uvicorn.run(
        "doc_review_app.main:app",
        host=host,
        port=PORT,
        log_level="info",
    )

if __name__ == "__main__":
    main()
