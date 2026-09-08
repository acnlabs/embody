from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


SOURCE = "embody"
BODY_KINDS = frozenset({"microduck"})


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def asset_ref(kind: str, local_id: str) -> str:
    return f"embody:{kind}:{local_id}"


def hub_resolve(repo: str, filename: str) -> str:
    return f"https://huggingface.co/{repo}/resolve/main/{filename}"


@dataclass
class Claim:
    agent_id: str
    claimed_at: str
    verified: bool
    acn_base_url: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Claim:
        return cls(
            agent_id=str(data["agent_id"]),
            claimed_at=str(data["claimed_at"]),
            verified=bool(data.get("verified", False)),
            acn_base_url=data.get("acn_base_url"),
        )


@dataclass
class Body:
    id: str
    kind: str
    asset_ref: str
    adapter: str
    registered_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Body:
        return cls(
            id=str(data["id"]),
            kind=str(data["kind"]),
            asset_ref=str(data["asset_ref"]),
            adapter=str(data["adapter"]),
            registered_at=str(data["registered_at"]),
        )


@dataclass
class Policy:
    id: str
    alias: str
    hub: str
    asset_ref: str
    startable: bool
    preview_url: str
    attached_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Policy:
        return cls(
            id=str(data["id"]),
            alias=str(data["alias"]),
            hub=str(data["hub"]),
            asset_ref=str(data["asset_ref"]),
            startable=bool(data.get("startable", False)),
            preview_url=str(data.get("preview_url") or hub_resolve(data["hub"], "preview.mp4")),
            attached_at=str(data["attached_at"]),
        )


@dataclass
class Session:
    id: str
    started_at: str
    adapter: str
    start_hub: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Session:
        return cls(
            id=str(data["id"]),
            started_at=str(data["started_at"]),
            adapter=str(data["adapter"]),
            start_hub=data.get("start_hub"),
        )


@dataclass
class State:
    version: int = 1
    claim: Claim | None = None
    body: Body | None = None
    policies: list[Policy] = field(default_factory=list)
    session: Session | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "claim": None if self.claim is None else self.claim.to_dict(),
            "body": None if self.body is None else self.body.to_dict(),
            "policies": [p.to_dict() for p in self.policies],
            "session": None if self.session is None else self.session.to_dict(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> State:
        policies = [Policy.from_dict(p) for p in data.get("policies") or []]
        claim = data.get("claim")
        body = data.get("body")
        session = data.get("session")
        return cls(
            version=int(data.get("version") or 1),
            claim=None if claim is None else Claim.from_dict(claim),
            body=None if body is None else Body.from_dict(body),
            policies=policies,
            session=None if session is None else Session.from_dict(session),
        )

    def policy_by_alias(self, alias: str) -> Policy | None:
        for policy in self.policies:
            if policy.alias == alias:
                return policy
        return None
