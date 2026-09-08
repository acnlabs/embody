from __future__ import annotations

from typing import Any, Protocol

from embody.models import Body, Policy, State


class BodyRuntimeError(RuntimeError):
    """Body-runtime failure (no pack, refused verb, or pack error)."""


class BodyRuntime(Protocol):
    kind: str
    adapter_id: str

    def guard_start(self, state: State, body: Body) -> None: ...

    def start(self, policy: Policy, *, dry_run: bool) -> dict[str, Any]: ...

    def pull(self, policy: Policy, *, dry_run: bool) -> dict[str, Any]: ...

    def do(self, alias: str, *, dry_run: bool) -> dict[str, Any]: ...

    def status(self, *, dry_run: bool) -> dict[str, Any]: ...

    def stop(self, *, dry_run: bool) -> dict[str, Any]: ...
