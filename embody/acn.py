from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


DEFAULT_ACN_BASE = "https://api.acnlabs.dev"


class AcnError(RuntimeError):
    pass


def acn_base_url() -> str:
    return (os.environ.get("ACN_BASE_URL") or DEFAULT_ACN_BASE).rstrip("/")


def api_key() -> str | None:
    key = os.environ.get("ACN_API_KEY")
    return key.strip() if key else None


def fetch_me(timeout: float = 15.0) -> dict[str, Any]:
    key = api_key()
    if not key:
        raise AcnError("ACN_API_KEY is required (from POST /agents/join)")
    url = f"{acn_base_url()}/api/v1/agents/me"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise AcnError(f"ACN /agents/me failed ({exc.code}): {body}") from exc
    except urllib.error.URLError as exc:
        raise AcnError(f"ACN unreachable: {exc.reason}") from exc
    if not isinstance(payload, dict):
        raise AcnError("ACN /agents/me returned a non-object")
    agent_id = payload.get("agent_id") or payload.get("id")
    if not agent_id:
        raise AcnError("ACN /agents/me missing agent_id")
    payload["agent_id"] = str(agent_id)
    return payload
