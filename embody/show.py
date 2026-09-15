from __future__ import annotations

import json
from typing import Any

from embody.adapters import AdapterError, run as run_adapter
from embody.models import Body, Policy, hub_card_url, hub_resolve, utc_now
from embody.store import load


def public_runtime_error(exc: BaseException | str) -> str:
    """Owner-facing line. Never paste a Python traceback into Show."""
    text = str(exc).strip()
    if "Connection refused" in text or "Errno 61" in text:
        return "localhost sim is not listening (127.0.0.1:8765). session start, then push."
    if "Traceback" in text:
        last = next((line.strip() for line in reversed(text.splitlines()) if line.strip()), text)
        return last[:240]
    return text[:240]


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


def agent_control(
    op: str,
    *,
    alias: str | None = None,
    x: float | None = None,
    y: float | None = None,
    yaw: float | None = None,
    numbers: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """One verb the owner room appends. Not a joint table."""
    event: dict[str, Any] = {"source": "agent", "op": op, "at": utc_now()}
    if alias:
        event["alias"] = alias
    if op == "twist":
        event["x"] = 0.0 if x is None else float(x)
        event["y"] = 0.0 if y is None else float(y)
        event["yaw"] = 0.0 if yaw is None else float(yaw)
    if isinstance(numbers, dict) and isinstance(numbers.get("executed"), bool):
        event["executed"] = numbers["executed"]
    return event


def with_control(show: dict[str, Any], event: dict[str, Any]) -> dict[str, Any]:
    return {**show, "control": event}


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


def live_show(body: Body) -> dict[str, Any]:
    adapter = None
    numbers_error = None
    if body.session is not None:
        try:
            adapter = run_adapter(body, "status", dry_run=False)
        except AdapterError as exc:
            numbers_error = public_runtime_error(exc)
    return show_for(body, adapter=adapter, numbers_error=numbers_error)


def owner_payload() -> dict[str, Any]:
    state = load()
    return {
        "ok": True,
        "audience": "owner",
        "workplace": "studio",
        "agent": None if state.agent is None else state.agent.to_dict(),
        "show": [live_show(b) for b in state.bodies],
        "note": "Owner observation. The agent drives. Embody does not store task ids.",
    }


def body_card(body: Body) -> dict[str, Any]:
    return {
        "id": body.id,
        "name": body.name,
        "kind": body.kind,
        "origin": body.origin,
        "bound_agent_id": body.bound_agent_id,
        "asset_ref": body.asset_ref,
        "build": body.build,
        "session_running": body.session is not None,
        "session": None if body.session is None else body.session.to_dict(),
        "next": next_hint(body),
        "cards": [_card_row(policy) for policy in body.policies],
        "training": None if body.training is None else body.training.to_dict(),
    }


def _card_row(policy: Policy) -> dict[str, Any]:
    row: dict[str, Any] = {
        "alias": policy.alias,
        "hub": policy.hub,
        "startable": policy.startable,
        "mode": "perpetual" if policy.startable else "episodic",
        "preview": policy.preview_url,
        "onnx": hub_resolve(policy.hub, "policy.onnx"),
        "card": hub_card_url(policy.hub),
    }
    if policy.curves_url:
        row["curves"] = policy.curves_url
    return row
