from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

from embody.acn import api_key
from embody.models import Body
from embody.show import live_show

DEFAULT_PUSH_PATH = "/api/agent/show"


class PushError(RuntimeError):
    pass


def studio_url() -> str:
    raw = (os.environ.get("EMBODY_STUDIO_URL") or "").strip().rstrip("/")
    if not raw:
        raise PushError(
            "EMBODY_STUDIO_URL is required — hosted owner studio, not localhost embody studio"
        )
    return raw


def push_document(body: Body) -> dict[str, Any]:
    return {
        "ok": True,
        "audience": "owner",
        "workplace": "studio",
        "show": live_show(body),
        "note": "Observation snapshot. Embody web stores this; AgentPlanet does not.",
    }


def post_show(document: dict[str, Any], *, timeout: float = 15.0) -> dict[str, Any]:
    key = api_key()
    if not key:
        raise PushError("ACN_API_KEY is required to push (hosted studio checks /agents/me)")
    url = f"{studio_url()}{DEFAULT_PUSH_PATH}"
    req = urllib.request.Request(
        url,
        data=json.dumps(document, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "Content-Type": "application/json; charset=utf-8",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise PushError(f"embody web push failed ({exc.code}): {body}") from exc
    except urllib.error.URLError as exc:
        raise PushError(f"embody web unreachable: {exc.reason}") from exc
    if not isinstance(payload, dict):
        raise PushError("embody web returned a non-object")
    return payload
