from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from embody.acn import AcnError, acn_base_url, api_key, fetch_me
from embody.adapters import AdapterError, adapter_id_for, guard_concurrency, run as run_adapter, validate_kind
from embody.models import (
    AgentBind,
    Body,
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


def _require_agent(state: State) -> AgentBind:
    if state.agent is None:
        raise CliError("no agent bound — run: python3 -m embody whoami")
    return state.agent


def _resolve_body(state: State, token: str | None) -> Body:
    _require_agent(state)
    if not state.bodies:
        raise CliError("no bodies — run: python3 -m embody body add --kind microduck")
    if token:
        body = state.body_by_token(token)
        if body is None:
            known = ", ".join(b.name or b.id for b in state.bodies)
            raise CliError(f"unknown --body {token!r}; have: {known}")
        return body
    if len(state.bodies) == 1:
        return state.bodies[0]
    known = ", ".join(b.name or b.id for b in state.bodies)
    raise CliError(f"multiple bodies; pass --body ({known})")


def cmd_whoami(args: argparse.Namespace) -> int:
    state = load()
    bind = bool(args.offline or args.agent_id or api_key())
    if not bind and args.refresh:
        raise CliError("whoami --refresh needs ACN_API_KEY or --offline --agent-id")
    if not bind:
        if state.agent is None:
            raise CliError("no agent bound — export ACN_API_KEY and run: python3 -m embody whoami")
        return _dump({"ok": True, "agent": state.agent.to_dict(), "bodies": len(state.bodies)})

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

    if state.agent and state.agent.agent_id != agent_id and not args.replace:
        raise CliError(
            f"this machine is bound to {state.agent.agent_id}; pass --replace to switch"
        )
    if state.agent and state.agent.agent_id != agent_id and args.replace:
        state.bodies = []

    state.agent = AgentBind(
        agent_id=agent_id,
        bound_at=utc_now(),
        verified=verified,
        acn_base_url=base,
    )
    path = save(state)
    return _dump(
        {
            "ok": True,
            "agent": state.agent.to_dict(),
            "bodies": len(state.bodies),
            "state": str(path),
            "note": "join does not attach a body",
        }
    )


def cmd_claim(_args: argparse.Namespace) -> int:
    raise CliError("claim is gone — bind this machine with: python3 -m embody whoami")


def cmd_body_add(args: argparse.Namespace) -> int:
    kind = validate_kind(args.kind)
    state = load()
    agent = _require_agent(state)
    name = args.name
    if name and any(b.name == name for b in state.bodies):
        raise CliError(f"body name {name!r} already exists")
    local_id = new_id("body")
    body = Body(
        id=local_id,
        kind=kind,
        asset_ref=asset_ref("body", local_id),
        adapter=adapter_id_for(kind),
        registered_at=utc_now(),
        name=name,
    )
    state.bodies.append(body)
    path = save(state)
    payload = {"ok": True, "agent_id": agent.agent_id, "body": body.to_dict(), "state": str(path)}
    if body.adapter == "none":
        payload["note"] = (
            f"kind={kind!r} has no session adapter yet. "
            "You can attach policies; session start/do will fail until an adapter exists."
        )
    return _dump(payload)


def cmd_body_list(_args: argparse.Namespace) -> int:
    state = load()
    _require_agent(state)
    return _dump(
        {
            "ok": True,
            "bodies": [
                {
                    **b.to_dict(),
                    "session_running": b.session is not None,
                }
                for b in state.bodies
            ],
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
    body = _resolve_body(state, args.body)
    existing = body.policy_by_alias(alias)
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
    body.policies = [p for p in body.policies if p.alias != alias]
    body.policies.append(policy)
    path = save(state)
    return _dump(
        {
            "ok": True,
            "body": body.name or body.id,
            "policy": policy.to_dict(),
            "card": {
                "preview": policy.preview_url,
                "onnx": hub_resolve(hub, "policy.onnx"),
                "note": "resolve/main on a card plays; a raw click downloads",
            },
            "state": str(path),
        }
    )


def cmd_policy_list(args: argparse.Namespace) -> int:
    state = load()
    body = _resolve_body(state, args.body)
    return _dump(
        {
            "ok": True,
            "body": body.name or body.id,
            "policies": [p.to_dict() for p in body.policies],
        }
    )


def _startable_policy(body: Body, alias: str | None) -> Policy:
    if alias:
        policy = body.policy_by_alias(alias)
        if policy is None:
            raise CliError(f"unknown policy alias {alias!r}")
        if not policy.startable:
            raise CliError(
                f"{alias} is episodic — pull + session do, do not start --repo "
                f"(hub {policy.hub})"
            )
        return policy
    startable = [p for p in body.policies if p.startable]
    if not startable:
        raise CliError("attach a perpetual policy first (e.g. --hub neil-jo/microduck-walk)")
    return startable[0]


def cmd_session_prepare(args: argparse.Namespace) -> int:
    state = load()
    body = _resolve_body(state, args.body)
    adapter = run_adapter(body, "prepare", dry_run=bool(args.dry_run))
    return _dump({"ok": True, "body": body.name or body.id, "adapter": adapter})


def cmd_session_start(args: argparse.Namespace) -> int:
    state = load()
    body = _resolve_body(state, args.body)
    policy = _startable_policy(body, args.as_name)
    guard_concurrency(state, body)
    adapter = run_adapter(body, "start", policy=policy, dry_run=bool(args.dry_run))
    body.session = Session(
        id=new_id("session"),
        started_at=utc_now(),
        adapter=body.adapter,
        start_hub=policy.hub,
    )
    path = save(state)
    return _dump(
        {
            "ok": True,
            "body": body.name or body.id,
            "session": body.session.to_dict(),
            "policy": policy.to_dict(),
            "adapter": adapter,
            "state": str(path),
        }
    )


def cmd_session_pull(args: argparse.Namespace) -> int:
    state = load()
    body = _resolve_body(state, args.body)
    policy = body.policy_by_alias(args.as_name)
    if policy is None:
        raise CliError(f"unknown policy alias {args.as_name!r} — attach first")
    adapter = run_adapter(body, "pull", policy=policy, dry_run=bool(args.dry_run))
    return _dump({"ok": True, "body": body.name or body.id, "policy": policy.to_dict(), "adapter": adapter})


def cmd_session_do(args: argparse.Namespace) -> int:
    state = load()
    body = _resolve_body(state, args.body)
    if body.session is None:
        raise CliError(
            f"no session on {body.name or body.id} — "
            f"run: python3 -m embody session start --body {body.name or body.id}"
        )
    policy = body.policy_by_alias(args.alias)
    if policy is None:
        raise CliError(f"unknown policy alias {args.alias!r}")
    adapter = run_adapter(body, "do", alias=policy.alias, dry_run=bool(args.dry_run))
    return _dump({"ok": True, "body": body.name or body.id, "policy": policy.to_dict(), "adapter": adapter})


def cmd_session_status(args: argparse.Namespace) -> int:
    state = load()
    body = _resolve_body(state, args.body)
    adapter = run_adapter(body, "status", dry_run=bool(args.dry_run))
    return _dump(
        {
            "ok": True,
            "body": body.to_dict(),
            "session": None if body.session is None else body.session.to_dict(),
            "adapter": adapter,
            "note": "body card reports numbers only; do not invent a fallen verdict",
        }
    )


def cmd_session_stop(args: argparse.Namespace) -> int:
    state = load()
    body = _resolve_body(state, args.body)
    adapter = run_adapter(body, "stop", dry_run=bool(args.dry_run))
    body.session = None
    path = save(state)
    return _dump({"ok": True, "body": body.name or body.id, "adapter": adapter, "state": str(path)})


def cmd_status(_args: argparse.Namespace) -> int:
    state = load()
    return _dump(
        {
            "ok": True,
            "product": "embody",
            "source": "embody",
            "asset_prefix": "embody:",
            "workplace": "studio",
            "acn_key_present": bool(api_key()),
            "agent": None if state.agent is None else state.agent.to_dict(),
            "bodies": [b.to_dict() for b in state.bodies],
        }
    )


def registry_payload(state: State) -> dict[str, Any]:
    agent = _require_agent(state)
    assets: list[dict[str, Any]] = []
    for body in state.bodies:
        assets.append(
            {
                "asset_ref": body.asset_ref,
                "source": "embody",
                "asset_kind": "body",
                "owner_type": "agent",
                "owner_id": agent.agent_id,
                "display_name": body.name or f"{body.kind} body",
                "bound_agent_id": agent.agent_id,
            }
        )
        for policy in body.policies:
            assets.append(
                {
                    "asset_ref": policy.asset_ref,
                    "source": "embody",
                    "asset_kind": "policy",
                    "owner_type": "agent",
                    "owner_id": agent.agent_id,
                    "display_name": policy.alias,
                    "bound_agent_id": agent.agent_id,
                    "preview_url": policy.preview_url,
                }
            )
    return {
        "source": "embody",
        "asset_prefix": "embody:",
        "store_listable": False,
        "posted": False,
        "assets": assets,
        "note": "local workplace ledger only. Does not POST to ACN or AgentPlanet.",
    }


def cmd_registry_print(_args: argparse.Namespace) -> int:
    return _dump({"ok": True, **registry_payload(load())})


def _add_body_flag(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--body", help="body id or --name; required if more than one body")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="embody",
        description="ACN agents get a body. Microduck is the first adapter.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    who = sub.add_parser("whoami", help="bind / show the ACN agent on this machine")
    who.add_argument("--agent-id")
    who.add_argument("--offline", action="store_true", help="skip /agents/me (tests / airgap)")
    who.add_argument("--replace", action="store_true", help="switch agent and drop local bodies")
    who.add_argument("--refresh", action="store_true")
    who.set_defaults(func=cmd_whoami)

    claim = sub.add_parser("claim", help=argparse.SUPPRESS)
    claim.set_defaults(func=cmd_claim)

    body = sub.add_parser("body", help="add / list bodies (many per agent)")
    body_sub = body.add_subparsers(dest="body_cmd", required=True)
    add = body_sub.add_parser("add")
    add.add_argument("--kind", default="microduck")
    add.add_argument("--name")
    add.set_defaults(func=cmd_body_add)
    listed = body_sub.add_parser("list")
    listed.set_defaults(func=cmd_body_list)

    policy = sub.add_parser("policy", help="attach a Hub policy to a body")
    policy_sub = policy.add_subparsers(dest="policy_cmd", required=True)
    attach = policy_sub.add_parser("attach")
    attach.add_argument("--hub", required=True)
    attach.add_argument("--as", dest="as_name")
    attach.add_argument("--episodic", action="store_true", help="pull + do only (e.g. bow)")
    attach.add_argument("--perpetual", action="store_true")
    attach.add_argument("--replace", action="store_true")
    _add_body_flag(attach)
    attach.set_defaults(func=cmd_policy_attach)
    plisted = policy_sub.add_parser("list")
    _add_body_flag(plisted)
    plisted.set_defaults(func=cmd_policy_list)

    session = sub.add_parser("session", help="studio session on one body")
    session_sub = session.add_subparsers(dest="session_cmd", required=True)
    prep = session_sub.add_parser("prepare")
    prep.add_argument("--dry-run", action="store_true")
    _add_body_flag(prep)
    prep.set_defaults(func=cmd_session_prepare)
    start = session_sub.add_parser("start")
    start.add_argument("--as", dest="as_name")
    start.add_argument("--dry-run", action="store_true")
    _add_body_flag(start)
    start.set_defaults(func=cmd_session_start)
    pull = session_sub.add_parser("pull")
    pull.add_argument("--as", dest="as_name", required=True)
    pull.add_argument("--dry-run", action="store_true")
    _add_body_flag(pull)
    pull.set_defaults(func=cmd_session_pull)
    do = session_sub.add_parser("do")
    do.add_argument("alias")
    do.add_argument("--dry-run", action="store_true")
    _add_body_flag(do)
    do.set_defaults(func=cmd_session_do)
    sstatus = session_sub.add_parser("status")
    sstatus.add_argument("--dry-run", action="store_true")
    _add_body_flag(sstatus)
    sstatus.set_defaults(func=cmd_session_status)
    stop = session_sub.add_parser("stop")
    stop.add_argument("--dry-run", action="store_true")
    _add_body_flag(stop)
    stop.set_defaults(func=cmd_session_stop)

    st = sub.add_parser("status", help="local agent and bodies")
    st.set_defaults(func=cmd_status)

    registry = sub.add_parser("registry", help="print this machine's body ledger")
    registry_sub = registry.add_subparsers(dest="registry_cmd", required=True)
    printed = registry_sub.add_parser("print")
    printed.set_defaults(func=cmd_registry_print)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return int(args.func(args))
    except (CliError, AcnError, AdapterError, ValueError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
