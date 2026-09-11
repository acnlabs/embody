from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


SOURCE = "embody"
STATE_VERSION = 2
ORIGIN_SIM = "sim"
ORIGIN_ROBOT = "robot"
ORIGINS = {ORIGIN_SIM, ORIGIN_ROBOT}


def validate_origin(origin: str) -> str:
    if origin not in ORIGINS:
        raise ValueError(f"origin must be sim or robot, not {origin!r}")
    return origin


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def asset_ref(kind: str, local_id: str) -> str:
    return f"embody:{kind}:{local_id}"


def hub_resolve(repo: str, filename: str) -> str:
    return f"https://huggingface.co/{repo}/resolve/main/{filename}"


@dataclass
class AgentBind:
    agent_id: str
    bound_at: str
    verified: bool
    acn_base_url: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AgentBind:
        return cls(
            agent_id=str(data["agent_id"]),
            bound_at=str(data.get("bound_at") or data.get("claimed_at") or utc_now()),
            verified=bool(data.get("verified", False)),
            acn_base_url=data.get("acn_base_url"),
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
class Body:
    id: str
    kind: str
    asset_ref: str
    adapter: str
    registered_at: str
    origin: str = ORIGIN_SIM
    bound_agent_id: str | None = None
    name: str | None = None
    policies: list[Policy] = field(default_factory=list)
    session: Session | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "kind": self.kind,
            "origin": self.origin,
            "bound_agent_id": self.bound_agent_id,
            "asset_ref": self.asset_ref,
            "adapter": self.adapter,
            "registered_at": self.registered_at,
            "policies": [p.to_dict() for p in self.policies],
            "session": None if self.session is None else self.session.to_dict(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Body:
        policies = [Policy.from_dict(p) for p in data.get("policies") or []]
        session = data.get("session")
        bound = data["bound_agent_id"] if "bound_agent_id" in data else None
        return cls(
            id=str(data["id"]),
            kind=str(data["kind"]),
            asset_ref=str(data["asset_ref"]),
            adapter=str(data["adapter"]),
            registered_at=str(data["registered_at"]),
            origin=str(data.get("origin") or ORIGIN_SIM),
            bound_agent_id=str(bound) if bound else None,
            name=data.get("name"),
            policies=policies,
            session=None if session is None else Session.from_dict(session),
        )

    def policy_by_alias(self, alias: str) -> Policy | None:
        for policy in self.policies:
            if policy.alias == alias:
                return policy
        return None

    def matches(self, token: str) -> bool:
        return token in {self.id, self.name, self.asset_ref}


@dataclass
class State:
    version: int = STATE_VERSION
    agent: AgentBind | None = None
    bodies: list[Body] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "agent": None if self.agent is None else self.agent.to_dict(),
            "bodies": [b.to_dict() for b in self.bodies],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> State:
        if data.get("bodies") is None and (data.get("claim") or data.get("body") or data.get("agent")):
            return cls._from_v1(data)
        agent = data.get("agent")
        bind = None if agent is None else AgentBind.from_dict(agent)
        bodies: list[Body] = []
        for raw in data.get("bodies") or []:
            body = Body.from_dict(raw)
            if "bound_agent_id" not in raw and bind is not None:
                body.bound_agent_id = bind.agent_id
            bodies.append(body)
        return cls(
            version=int(data.get("version") or STATE_VERSION),
            agent=bind,
            bodies=bodies,
        )

    @classmethod
    def _from_v1(cls, data: dict[str, Any]) -> State:
        raw_agent = data.get("agent") or data.get("claim")
        body = data.get("body")
        bodies: list[Body] = []
        if body is not None:
            migrated = Body.from_dict(body)
            migrated.policies = [Policy.from_dict(p) for p in data.get("policies") or []]
            session = data.get("session")
            migrated.session = None if session is None else Session.from_dict(session)
            if raw_agent:
                migrated.bound_agent_id = str(raw_agent["agent_id"])
            bodies.append(migrated)
        return cls(
            version=STATE_VERSION,
            agent=None if raw_agent is None else AgentBind.from_dict(raw_agent),
            bodies=bodies,
        )

    def body_by_token(self, token: str) -> Body | None:
        hits = [b for b in self.bodies if b.matches(token)]
        if len(hits) == 1:
            return hits[0]
        return None

    def running_by_kind(self, kind: str, except_id: str | None = None) -> list[Body]:
        out: list[Body] = []
        for body in self.bodies:
            if body.kind != kind or body.session is None:
                continue
            if except_id is not None and body.id == except_id:
                continue
            out.append(body)
        return out
