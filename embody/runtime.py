from __future__ import annotations

from typing import Any, Protocol

from embody.models import Body, Policy, State


class BodyRuntimeError(RuntimeError):
    """Body-runtime failure (no kind runtime, refused verb, or runtime error)."""


class BodyRuntime(Protocol):
    kind: str
    adapter_id: str
    # As-built manifest a sim body of this kind is born with. Robot units record
    # their own at pairing instead.
    default_build: dict[str, Any]

    def probe(self) -> dict[str, Any]: ...

    def guard_start(self, state: State, body: Body) -> None: ...

    def prepare(self, *, dry_run: bool) -> dict[str, Any]: ...

    def start(self, policy: Policy, *, dry_run: bool) -> dict[str, Any]: ...

    def pull(self, policy: Policy, *, dry_run: bool) -> dict[str, Any]: ...

    def do(self, alias: str, *, dry_run: bool) -> dict[str, Any]: ...

    def status(self, *, dry_run: bool) -> dict[str, Any]: ...

    def stop(self, *, dry_run: bool) -> dict[str, Any]: ...
