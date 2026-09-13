from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from embody.acn import api_key

JOIN_PATH = "/api/agent/bodies"


class JoinError(RuntimeError):
    pass


def studio_configured() -> bool:
    return bool((os.environ.get("EMBODY_STUDIO_URL") or "").strip())


def _studio_url() -> str:
    raw = (os.environ.get("EMBODY_STUDIO_URL") or "").strip().rstrip("/")
    if not raw:
        raise JoinError("EMBODY_STUDIO_URL is required — hosted owner studio mints body ids")
    return raw


def join_body(
    *,
    name: str | None,
    kind: str,
    origin: str,
    local_id: str | None = None,
    build: dict[str, Any] | None = None,
    timeout: float = 15.0,
) -> dict[str, Any]:
    key = api_key()
    if not key:
        raise JoinError("ACN_API_KEY is required to join (hosted studio checks /agents/me)")
    payload: dict[str, Any] = {"kind": kind, "origin": origin}
    if name:
        payload["name"] = name
    if local_id:
        payload["id"] = local_id
    if build:
        payload["build"] = build
    req = urllib.request.Request(
        f"{_studio_url()}{JOIN_PATH}",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "Content-Type": "application/json; charset=utf-8",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise JoinError(f"embody web join failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise JoinError(f"embody web unreachable: {exc.reason}") from exc
    if not isinstance(body, dict) or not isinstance(body.get("body"), dict):
        raise JoinError("embody web join returned a bad payload")
    return body


def leave_body(body_id: str, timeout: float = 15.0) -> dict[str, Any]:
    key = api_key()
    if not key:
        raise JoinError("ACN_API_KEY is required to remove a hosted body")
    token = body_id.strip()
    if not token:
        raise JoinError("body id required")
    req = urllib.request.Request(
        f"{_studio_url()}{JOIN_PATH}/{urllib.parse.quote(token, safe='')}",
        headers={
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
        method="DELETE",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return {"ok": True, "missing": True, "id": token}
        detail = exc.read().decode("utf-8", errors="replace")
        raise JoinError(f"embody web leave failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise JoinError(f"embody web unreachable: {exc.reason}") from exc
    if not isinstance(payload, dict):
        raise JoinError("embody web leave returned a bad payload")
    return payload
