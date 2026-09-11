from __future__ import annotations

import re
from typing import Any

from embody.adapter_microduck import ADAPTER_ID, AdapterError as KindError, MicroduckRuntime
from embody.models import Body, Policy, State
from embody.runtime import BodyRuntime, BodyRuntimeError


KIND_RE = re.compile(r"^[a-z][a-z0-9_-]{0,31}$")

# kind → runtime. Kernel only looks up this table; it does not know vendor scripts.
_RUNTIMES: dict[str, BodyRuntime] = {
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
    runtime = _RUNTIMES.get(kind)
    return runtime.adapter_id if runtime is not None else "none"


def get_runtime(kind: str) -> BodyRuntime | None:
    return _RUNTIMES.get(kind)


def guard_concurrency(state: State, body: Body) -> None:
    runtime = get_runtime(body.kind)
    if runtime is None:
        raise BodyRuntimeError(
            f"no kind runtime for kind={body.kind!r}. "
            "Record the body and attach cards; session waits until a runtime exists. "
            "See docs/product/body-runtime-v0.md."
        )
    try:
        runtime.guard_start(state, body)
    except KindError as exc:
        raise BodyRuntimeError(str(exc)) from exc


def run(
    body: Body,
    op: str,
    *,
    policy: Policy | None = None,
    alias: str | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    runtime = get_runtime(body.kind)
    if runtime is None:
        raise BodyRuntimeError(
            f"no kind runtime for kind={body.kind!r}. "
            "See docs/product/body-runtime-v0.md."
        )
    try:
        if op == "prepare":
            return runtime.prepare(dry_run=dry_run)
        if op == "start":
            if policy is None:
                raise BodyRuntimeError("start needs a perpetual policy card")
            prepared = runtime.prepare(dry_run=dry_run)
            started = runtime.start(policy, dry_run=dry_run)
            return {**started, "prepare": prepared}
        if op == "pull":
            if policy is None:
                raise BodyRuntimeError("pull needs a policy card")
            return runtime.pull(policy, dry_run=dry_run)
        if op == "do":
            if not alias:
                raise BodyRuntimeError("do needs a policy alias")
            return runtime.do(alias, dry_run=dry_run)
        if op == "status":
            return runtime.status(dry_run=dry_run)
        if op == "stop":
            return runtime.stop(dry_run=dry_run)
    except KindError as exc:
        raise BodyRuntimeError(str(exc)) from exc
    raise BodyRuntimeError(f"unknown session verb {op!r}")


# Re-export for callers that still mention the first runtime id.
MICRODUCK_ADAPTER_ID = ADAPTER_ID
