from __future__ import annotations

import json
from typing import Any

from embody.models import Body, hub_resolve


def lift_runtime_numbers(adapter: dict[str, Any]) -> dict[str, Any] | None:
    """Pass through JSON the kind runtime printed. Do not invent a verdict."""
    raw = adapter.get("stdout")
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    if not text:
        return None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def next_hint(body: Body) -> str:
    if not body.bound_agent_id:
        return "bind this body to the agent, then whoami"
    if not body.policies:
        return "find a Hub USER/NAME with policy.onnx yourself, then policy attach --hub"
    if body.session is None:
        if any(p.startable for p in body.policies):
            return "session start"
        return "attach a perpetual card, then session start"
    return "session status for numbers; session do ALIAS for episodic; session stop when done"


def show_for(
    body: Body,
    *,
    adapter: dict[str, Any] | None = None,
    numbers_error: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        **body_card(body),
        "numbers": lift_runtime_numbers(adapter) if adapter else None,
        "note": "numbers only; do not invent a fallen verdict",
    }
    if numbers_error:
        payload["numbers_error"] = numbers_error
    return payload


def body_card(body: Body) -> dict[str, Any]:
    return {
        "id": body.id,
        "name": body.name,
        "kind": body.kind,
        "origin": body.origin,
        "bound_agent_id": body.bound_agent_id,
        "asset_ref": body.asset_ref,
        "session_running": body.session is not None,
        "session": None if body.session is None else body.session.to_dict(),
        "next": next_hint(body),
        "cards": [
            {
                "alias": policy.alias,
                "hub": policy.hub,
                "startable": policy.startable,
                "mode": "perpetual" if policy.startable else "episodic",
                "preview": policy.preview_url,
                "onnx": hub_resolve(policy.hub, "policy.onnx"),
            }
            for policy in body.policies
        ],
    }
