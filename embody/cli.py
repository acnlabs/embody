from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

from embody import adapter_microduck
from embody.acn import AcnError, acn_base_url, api_key, fetch_me
from embody.models import (
    BODY_KINDS,
    Body,
    Claim,
    Policy,
    Session,
    State,
    asset_ref,
    hub_resolve,
    new_id,
    utc_now,
)
from embody.store import load, save


class CliError(RuntimeError):
    pass


def _dump(payload: dict[str, Any]) -> int:
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


def _require_claim(state: State) -> Claim:
    if state.claim is None:
        raise CliError("no claim yet — run: python3 -m embody claim")
    return state.claim


def _require_body(state: State) -> Body:
    _require_claim(state)
    if state.body is None:
        raise CliError("no body yet — run: python3 -m embody body register --kind microduck")
    return state.body


def cmd_claim(args: argparse.Namespace) -> int:
    state = load()
    if args.offline:
        agent_id = args.agent_id
        if not agent_id:
            raise CliError("--offline requires --agent-id")
        verified = False
        base = None
    else:
        me = fetch_me()
        agent_id = str(me["agent_id"])
        if args.agent_id and args.agent_id != agent_id:
            raise CliError(f"--agent-id {args.agent_id} does not match ACN /agents/me ({agent_id})")
        verified = True
        base = acn_base_url()

    if state.claim and state.claim.agent_id != agent_id and not args.replace:
        raise CliError(
            f"already claimed by {state.claim.agent_id}; pass --replace to take over (v0 is 1:1)"
        )
    if state.claim and state.claim.agent_id != agent_id and args.replace:
        state.body = None
        state.policies = []
        state.session = None

    state.claim = Claim(
        agent_id=agent_id,
        claimed_at=utc_now(),
        verified=verified,
        acn_base_url=base,
    )
    path = save(state)
    return _dump(
        {
            "ok": True,
            "claim": state.claim.to_dict(),
            "state": str(path),
            "note": "join does not attach a body",
        }
    )


def cmd_body_register(args: argparse.Namespace) -> int:
    kind = args.kind
    if kind not in BODY_KINDS:
        raise CliError(f"unknown body kind {kind!r}; v0 supports: {', '.join(sorted(BODY_KINDS))}")
    state = load()
    claim = _require_claim(state)
    if state.body is not None and not args.replace:
        raise CliError(f"body already registered ({state.body.asset_ref}); pass --replace")
    local_id = new_id("body")
    state.body = Body(
        id=local_id,
        kind=kind,
        asset_ref=asset_ref("body", local_id),
        adapter=adapter_microduck.ADAPTER_ID,
        registered_at=utc_now(),
    )
    path = save(state)
    return _dump(
        {
            "ok": True,
            "agent_id": claim.agent_id,
            "body": state.body.to_dict(),
            "state": str(path),
            "embot": "spoken name for this attached body",
        }
    )


def cmd_policy_attach(args: argparse.Namespace) -> int:
    hub = args.hub.strip().strip("/")
    if "/" not in hub:
        raise CliError("--hub must be USER/REPO")
    alias = args.as_name or hub.rsplit("/", 1)[-1].replace("-", "_")
    startable = not args.episodic
    if args.perpetual:
        startable = True
    state = load()
    _require_body(state)
    existing = state.policy_by_alias(alias)
    if existing is not None and not args.replace:
        raise CliError(f"alias {alias!r} already attached to {existing.hub}; pass --replace")
    local_id = existing.id if existing else new_id("policy")
    policy = Policy(
        id=local_id,
        alias=alias,
        hub=hub,
        asset_ref=asset_ref("policy", local_id),
        startable=startable,
        preview_url=hub_resolve(hub, "preview.mp4"),
        attached_at=utc_now(),
    )
    state.policies = [p for p in state.policies if p.alias != alias]
    state.policies.append(policy)
    path = save(state)
    return _dump(
        {
            "ok": True,
            "policy": policy.to_dict(),
            "card": {
                "preview": policy.preview_url,
                "onnx": hub_resolve(hub, "policy.onnx"),
                "note": "resolve/main on a card plays; a raw click downloads",
            },
            "state": str(path),
        }
    )


def cmd_policy_list(_args: argparse.Namespace) -> int:
    state = load()
    _require_body(state)
    return _dump({"ok": True, "policies": [p.to_dict() for p in state.policies]})


def _control(*argv: str, dry_run: bool) -> dict[str, Any]:
    result = adapter_microduck.run_control(*argv, dry_run=dry_run)
    if not result.get("ok"):
        err = str(result.get("stderr") or result.get("stdout") or "adapter failed")
        raise CliError(err.strip() or "adapter failed")
    return result


def _startable_policy(state: State, alias: str | None) -> Policy:
    if alias:
        policy = state.policy_by_alias(alias)
        if policy is None:
            raise CliError(f"unknown policy alias {alias!r}")
        if not policy.startable:
            raise CliError(
                f"{alias} is episodic — pull + session do, do not start --repo "
                f"(hub {policy.hub})"
            )
        return policy
    startable = [p for p in state.policies if p.startable]
    if not startable:
        raise CliError("attach a perpetual policy first (e.g. --hub neil-jo/microduck-walk)")
    return startable[0]


def cmd_session_start(args: argparse.Namespace) -> int:
    state = load()
    body = _require_body(state)
    policy = _startable_policy(state, args.as_name)
    dry = bool(args.dry_run)
    adapter = _control("start", "--repo", policy.hub, "--detach", dry_run=dry)
    state.session = Session(
        id=new_id("session"),
        started_at=utc_now(),
        adapter=body.adapter,
        start_hub=policy.hub,
    )
    path = save(state)
    return _dump(
        {
            "ok": True,
            "session": state.session.to_dict(),
            "policy": policy.to_dict(),
            "adapter": adapter,
            "state": str(path),
            "workplace": "studio",
        }
    )


def cmd_session_pull(args: argparse.Namespace) -> int:
    state = load()
    _require_body(state)
    policy = state.policy_by_alias(args.as_name)
    if policy is None:
        raise CliError(f"unknown policy alias {args.as_name!r} — attach first")
    adapter = _control("pull", policy.hub, "--as", policy.alias, dry_run=bool(args.dry_run))
    return _dump({"ok": True, "policy": policy.to_dict(), "adapter": adapter})


def cmd_session_do(args: argparse.Namespace) -> int:
    state = load()
    _require_body(state)
    if state.session is None:
        raise CliError("no studio session — run: python3 -m embody session start")
    policy = state.policy_by_alias(args.alias)
    if policy is None:
        raise CliError(f"unknown policy alias {args.alias!r}")
    adapter = _control("do", policy.alias, dry_run=bool(args.dry_run))
    return _dump({"ok": True, "policy": policy.to_dict(), "adapter": adapter})


def cmd_session_status(args: argparse.Namespace) -> int:
    state = load()
    _require_body(state)
    adapter = _control("status", dry_run=bool(args.dry_run))
    return _dump(
        {
            "ok": True,
            "session": None if state.session is None else state.session.to_dict(),
            "body": None if state.body is None else state.body.to_dict(),
            "adapter": adapter,
            "note": "body card reports numbers only; do not invent a fallen verdict",
        }
    )


def cmd_session_stop(args: argparse.Namespace) -> int:
    state = load()
    _require_body(state)
    adapter = _control("stop", dry_run=bool(args.dry_run))
    state.session = None
    path = save(state)
    return _dump({"ok": True, "adapter": adapter, "state": str(path)})


def cmd_status(_args: argparse.Namespace) -> int:
    state = load()
    return _dump(
        {
            "ok": True,
            "product": "embody",
            "source": "embody",
            "asset_prefix": "embody:",
            "workplace": "studio",
            "spoken_body": "embot",
            "acn_key_present": bool(api_key()),
            "claim": None if state.claim is None else state.claim.to_dict(),
            "body": None if state.body is None else state.body.to_dict(),
            "policies": [p.to_dict() for p in state.policies],
            "session": None if state.session is None else state.session.to_dict(),
        }
    )


def registry_payload(state: State) -> dict[str, Any]:
    claim = _require_claim(state)
    assets: list[dict[str, Any]] = []
    if state.body is not None:
        assets.append(
            {
                "asset_ref": state.body.asset_ref,
                "source": "embody",
                "asset_kind": "body",
                "owner_type": "agent",
                "owner_id": claim.agent_id,
                "display_name": f"{state.body.kind} body",
                "bound_agent_id": claim.agent_id,
            }
        )
    for policy in state.policies:
        assets.append(
            {
                "asset_ref": policy.asset_ref,
                "source": "embody",
                "asset_kind": "policy",
                "owner_type": "agent",
                "owner_id": claim.agent_id,
                "display_name": policy.alias,
                "bound_agent_id": claim.agent_id,
                "preview_url": policy.preview_url,
            }
        )
    return {
        "source": "embody",
        "asset_prefix": "embody:",
        "store_listable": False,
        "posted": False,
        "assets": assets,
        "note": "v0 prints the payload. POST only if EMBODY_REGISTER_ASSETS=1.",
    }


def cmd_registry_print(_args: argparse.Namespace) -> int:
    payload = registry_payload(load())
    if os.environ.get("EMBODY_REGISTER_ASSETS") == "1":
        payload["posted"] = False
        payload["note"] = (
            "EMBODY_REGISTER_ASSETS=1 is reserved; v0 still does not POST. "
            "Use AgentPlanet POST /api/assets/registry with source=embody."
        )
    return _dump({"ok": True, **payload})


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="embody",
        description="ACN agents get a body. Microduck is the first adapter.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    claim = sub.add_parser("claim", help="claim embody for a joined ACN agent")
    claim.add_argument("--agent-id")
    claim.add_argument("--offline", action="store_true", help="skip /agents/me (tests / airgap)")
    claim.add_argument("--replace", action="store_true")
    claim.set_defaults(func=cmd_claim)

    body = sub.add_parser("body", help="register the one v0 body")
    body_sub = body.add_subparsers(dest="body_cmd", required=True)
    body_reg = body_sub.add_parser("register")
    body_reg.add_argument("--kind", default="microduck")
    body_reg.add_argument("--replace", action="store_true")
    body_reg.set_defaults(func=cmd_body_register)

    policy = sub.add_parser("policy", help="attach a Hub policy pointer")
    policy_sub = policy.add_subparsers(dest="policy_cmd", required=True)
    attach = policy_sub.add_parser("attach")
    attach.add_argument("--hub", required=True)
    attach.add_argument("--as", dest="as_name")
    attach.add_argument("--episodic", action="store_true", help="pull + do only (e.g. bow)")
    attach.add_argument("--perpetual", action="store_true")
    attach.add_argument("--replace", action="store_true")
    attach.set_defaults(func=cmd_policy_attach)
    listed = policy_sub.add_parser("list")
    listed.set_defaults(func=cmd_policy_list)

    session = sub.add_parser("session", help="studio sim session via microduck-skill")
    session_sub = session.add_subparsers(dest="session_cmd", required=True)
    start = session_sub.add_parser("start")
    start.add_argument("--as", dest="as_name")
    start.add_argument("--dry-run", action="store_true")
    start.set_defaults(func=cmd_session_start)
    pull = session_sub.add_parser("pull")
    pull.add_argument("--as", dest="as_name", required=True)
    pull.add_argument("--dry-run", action="store_true")
    pull.set_defaults(func=cmd_session_pull)
    do = session_sub.add_parser("do")
    do.add_argument("alias")
    do.add_argument("--dry-run", action="store_true")
    do.set_defaults(func=cmd_session_do)
    status = session_sub.add_parser("status")
    status.add_argument("--dry-run", action="store_true")
    status.set_defaults(func=cmd_session_status)
    stop = session_sub.add_parser("stop")
    stop.add_argument("--dry-run", action="store_true")
    stop.set_defaults(func=cmd_session_stop)

    st = sub.add_parser("status", help="local claim / body / policies")
    st.set_defaults(func=cmd_status)

    registry = sub.add_parser("registry", help="AgentPlanet payload (source=embody)")
    registry_sub = registry.add_subparsers(dest="registry_cmd", required=True)
    printed = registry_sub.add_parser("print")
    printed.set_defaults(func=cmd_registry_print)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return int(args.func(args))
    except (CliError, AcnError, adapter_microduck.AdapterError, ValueError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
