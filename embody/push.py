from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from embody.acn import api_key
from embody.models import Body
from embody.show import live_show

DEFAULT_PUSH_PATH = "/api/agent/show"
DEFAULT_INBOX_PATH = "/api/agent/inbox"


class PushError(RuntimeError):
    pass


def transient_push_error(exc: BaseException) -> bool:
    """SSL / proxy / 5xx blips. Auth and unknown body stay fatal."""
    text = str(exc).lower()
    if "acn_api_key is required" in text or "embody_studio_url is required" in text:
        return False
    if any(f"push failed ({code})" in text for code in ("401", "403", "404", "400")):
        return False
    if "unreachable" in text or "ssl" in text or "eof" in text or "timed out" in text:
        return True
    if any(f"push failed ({code})" in text for code in ("429", "500", "502", "503", "504")):
        return True
    return False


def studio_url() -> str:
    raw = (os.environ.get("EMBODY_STUDIO_URL") or "").strip().rstrip("/")
    if not raw:
        raise PushError(
            "EMBODY_STUDIO_URL is required — hosted owner studio, not localhost embody studio"
        )
    return raw


def push_document(body: Body, *, show: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "ok": True,
        "audience": "owner",
        "workplace": "studio",
        "show": show if show is not None else live_show(body),
        "note": "Observation snapshot. Embody web stores this; AgentPlanet does not.",
    }


def _studio_request(
    url: str,
    *,
    method: str,
    data: bytes | None = None,
    timeout: float,
) -> dict[str, Any]:
    key = api_key()
    if not key:
        raise PushError("ACN_API_KEY is required to push (hosted studio checks /agents/me)")
    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }
    if data is not None:
        headers["Content-Type"] = "application/json; charset=utf-8"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise PushError(f"embody web push failed ({exc.code}): {body}") from exc
    except urllib.error.URLError as exc:
        raise PushError(f"embody web unreachable: {exc.reason}") from exc
    except TimeoutError as exc:
        raise PushError("embody web unreachable: timed out") from exc
    if not isinstance(payload, dict):
        raise PushError("embody web returned a non-object")
    return payload


def post_show(document: dict[str, Any], *, timeout: float = 15.0) -> dict[str, Any]:
    url = f"{studio_url()}{DEFAULT_PUSH_PATH}"
    return _studio_request(
        url,
        method="POST",
        data=json.dumps(document, ensure_ascii=False).encode("utf-8"),
        timeout=timeout,
    )


def take_inbox(body_id: str, *, timeout: float = 5.0) -> dict[str, Any] | None:
    token = (body_id or "").strip()
    if not token:
        raise PushError("body id required to read drive inbox")
    url = f"{studio_url()}{DEFAULT_INBOX_PATH}/{urllib.parse.quote(token, safe='')}"
    payload = _studio_request(url, method="GET", timeout=timeout)
    cmd = payload.get("command")
    return cmd if isinstance(cmd, dict) else None
