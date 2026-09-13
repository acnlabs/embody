from __future__ import annotations

import copy
import json
import re
from typing import Any

from embody.adapter_microduck import ADAPTER_ID, AdapterError as KindError, MicroduckRuntime
from embody.models import ORIGIN_SIM, Body, Policy, State
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


MAX_BUILD_BYTES = 16 * 1024


def default_build_for(kind: str) -> dict[str, Any]:
    runtime = _RUNTIMES.get(kind)
    if runtime is None:
        return {}
    return copy.deepcopy(runtime.default_build)


def fill_build(body: Body) -> bool:
    """Empty manifest means uninitialized. Fill the kind default. True if written."""
    if body.build:
        return False
    filled = default_build_for(body.kind)
    if not filled:
        return False
    body.build = filled
    return True


def sim_modules_allowed(kind: str) -> set[str]:
    modules = default_build_for(kind).get("modules")
    if not isinstance(modules, dict):
        return set()
    return {key for key, value in modules.items() if value is True}


def scrub_sim_build(body: Body) -> bool:
    """Drop sim module keys the kind does not evidence (e.g. leftover camera)."""
    if body.origin != ORIGIN_SIM or not body.build:
        return False
    if not default_build_for(body.kind):
        return False
    modules = body.build.get("modules")
    if not isinstance(modules, dict):
        return False
    allowed = sim_modules_allowed(body.kind)
    kept = {key: value for key, value in modules.items() if key in allowed}
    if kept == modules:
        return False
    body.build = {**body.build, "modules": kept}
    return True


def assert_sim_build(origin: str, kind: str, build: dict[str, Any]) -> dict[str, Any]:
    """Sim may only declare modules the kind runtime evidents. Size-capped either origin."""
    if origin == ORIGIN_SIM and default_build_for(kind):
        modules = build.get("modules")
        if isinstance(modules, dict):
            allowed = sim_modules_allowed(kind)
            unknown = sorted(key for key in modules if key not in allowed)
            if unknown:
                have = ", ".join(sorted(allowed)) or "none"
                raise BodyRuntimeError(
                    f"sim cannot declare modules {', '.join(unknown)}; "
                    f"this kind's sim evidents {have}. "
                    "Official Microduck policy obs is 61-dim proprioception + commands "
                    "(no onboard camera). Record a real camera at robot pairing."
                )
    return assert_build_size(build)


def assert_build_size(build: dict[str, Any]) -> dict[str, Any]:
    raw = json.dumps(build, ensure_ascii=False).encode("utf-8")
    if len(raw) > MAX_BUILD_BYTES:
        raise BodyRuntimeError(f"build exceeds {MAX_BUILD_BYTES} bytes")
    return build


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
