from __future__ import annotations

import json
import os
from pathlib import Path

from embody.adapters import fill_build, scrub_sim_build
from embody.models import State


def default_home() -> Path:
    raw = os.environ.get("EMBODY_HOME")
    if raw:
        return Path(raw).expanduser()
    return Path.home() / ".embody"


def state_path(home: Path | None = None) -> Path:
    return (home or default_home()) / "state.json"


def load(home: Path | None = None) -> State:
    path = state_path(home)
    if not path.is_file():
        return State()
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"corrupt embody state: {path}")
    state = State.from_dict(data)
    dirty = False
    for body in state.bodies:
        if fill_build(body) or scrub_sim_build(body):
            dirty = True
    if dirty:
        save(state, home)
    return state


def save(state: State, home: Path | None = None) -> Path:
    path = state_path(home)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state.to_dict(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(path)
    return path
