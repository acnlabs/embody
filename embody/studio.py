from __future__ import annotations

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from embody.show import owner_payload

PAGE = Path(__file__).with_name("studio.html")
DEFAULT_BIND = "127.0.0.1"
DEFAULT_PORT = 8766


class StudioHandler(SimpleHTTPRequestHandler):
    """Debug localhost Show. Product owner studio is hosted web/."""

    def do_GET(self) -> None:
        if self.path.split("?", 1)[0] == "/api/show":
            self._json(owner_payload())
            return
        if self.path.split("?", 1)[0] in {"/", "/index.html"}:
            body = PAGE.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404, "owner studio only serves / and /api/show")

    def do_POST(self) -> None:
        self.send_error(405, "owner studio does not drive the body")

    def log_message(self, fmt: str, *args: Any) -> None:
        return

    def _json(self, payload: dict[str, Any]) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


def serve(bind: str = DEFAULT_BIND, port: int = DEFAULT_PORT) -> ThreadingHTTPServer:
    if bind not in {"127.0.0.1", "localhost"}:
        raise ValueError("studio is for the owner on this machine; bind 127.0.0.1")
    return ThreadingHTTPServer((bind, port), StudioHandler)
