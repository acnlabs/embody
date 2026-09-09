from __future__ import annotations

import re
from typing import Any

from embody.adapter_microduck import ADAPTER_ID, AdapterError as PackError, MicroduckRuntime
from embody.models import Body, Policy, State
from embody.runtime import BodyRuntime, BodyRuntimeError


KIND_RE = re.compile(r"^[a-z][a-z0-9_-]{0,31}$")

# kind → pack. Kernel only looks up this table; it does not know control.sh.
_PACKS: dict[str, BodyRuntime] = {
    MicroduckRuntime.kind: MicroduckRuntime(),
}

AdapterError = BodyRuntimeError


def validate_kind(kind: str) -> str:
    if not KIND_RE.match(kind):
        raise BodyRuntimeError(
            f"invalid body kind {kind!r}; use a lowercase slug (e.g. microduck, unitree-g1)"
        )
    return kind


def adapter_id_for(kind: str) -> str:
    pack = _PACKS.get(kind)
    return pack.adapter_id if pack is not None else "none"


def get_runtime(kind: str) -> BodyRuntime | None:
    return _PACKS.get(kind)


def guard_concurrency(state: State, body: Body) -> None:
    pack = get_runtime(body.kind)
    if pack is None:
        raise BodyRuntimeError(
            f"no body-runtime pack for kind={body.kind!r}. "
            "Record the body and attach cards; session waits until a pack exists. "
            "See docs/product/body-runtime-v0.md."
        )
    try:
        pack.guard_start(state, body)
    except PackError as exc:
        raise BodyRuntimeError(str(exc)) from exc


def run(
    body: Body,
    op: str,
    *,
    policy: Policy | None = None,
    alias: str | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    pack = get_runtime(body.kind)
    if pack is None:
        raise BodyRuntimeError(
            f"no body-runtime pack for kind={body.kind!r}. "
            "See docs/product/body-runtime-v0.md."
        )
    try:
        if op == "prepare":
            return pack.prepare(dry_run=dry_run)
        if op == "start":
            if policy is None:
                raise BodyRuntimeError("start needs a perpetual policy card")
            prepared = pack.prepare(dry_run=dry_run)
            started = pack.start(policy, dry_run=dry_run)
            return {**started, "prepare": prepared}
        if op == "pull":
            if policy is None:
                raise BodyRuntimeError("pull needs a policy card")
            return pack.pull(policy, dry_run=dry_run)
        if op == "do":
            if not alias:
                raise BodyRuntimeError("do needs a policy alias")
            return pack.do(alias, dry_run=dry_run)
        if op == "status":
            return pack.status(dry_run=dry_run)
        if op == "stop":
            return pack.stop(dry_run=dry_run)
    except PackError as exc:
        raise BodyRuntimeError(str(exc)) from exc
    raise BodyRuntimeError(f"unknown session verb {op!r}")


# Re-export for callers that still mention the first pack id.
MICRODUCK_ADAPTER_ID = ADAPTER_ID
