from __future__ import annotations

import os
import subprocess
from pathlib import Path


ADAPTER_ID = "microduck-skill"
KIND = "microduck"


class AdapterError(RuntimeError):
    pass


def _candidates() -> list[Path]:
    out: list[Path] = []
    env = os.environ.get("EMBODY_MICRODUCK_SKILL")
    if env:
        out.append(Path(env).expanduser())
    here = Path(__file__).resolve()
    out.append(here.parents[2] / "microduck-plugin" / "skills" / "microduck-skill")
    out.append(here.parents[1].parent / "microduck-plugin" / "skills" / "microduck-skill")
    home = Path.home()
    out.append(home / ".agents" / "skills" / "microduck-skill")
    out.append(home / ".cursor" / "skills" / "microduck-skill")
    return out


def resolve_skill() -> Path:
    seen: set[Path] = set()
    for raw in _candidates():
        path = raw.resolve() if raw.exists() else raw
        if path in seen:
            continue
        seen.add(path)
        skill_md = path / "SKILL.md"
        control = path / "scripts" / "control.sh"
        if skill_md.is_file() and control.is_file():
            return path
    raise AdapterError(
        "microduck-skill not found. Set EMBODY_MICRODUCK_SKILL or clone "
        "https://github.com/acnlabs/microduck-plugin next to embody."
    )


def control_argv(skill: Path, *args: str) -> list[str]:
    return [str(skill / "scripts" / "control.sh"), *args]


def run_control(*args: str, dry_run: bool = False) -> dict[str, object]:
    _adopt_default_rl_root()
    skill = resolve_skill()
    argv = control_argv(skill, *args)
    if dry_run:
        return {"ok": True, "dry_run": True, "argv": argv, "skill": str(skill)}
    proc = subprocess.run(argv, check=False, text=True, capture_output=True)
    return {
        "ok": proc.returncode == 0,
        "returncode": proc.returncode,
        "argv": argv,
        "skill": str(skill),
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    }


class MicroduckRuntime:
    """First kind pack. Maps body-runtime verbs to microduck-skill control.sh."""

    kind = KIND
    adapter_id = ADAPTER_ID

    def guard_start(self, state, body) -> None:
        busy = state.running_by_kind(self.kind, except_id=body.id)
        if not busy:
            return
        other = busy[0]
        raise AdapterError(
            f"microduck-skill already has a session on {other.name or other.id}; "
            "this pack runs one localhost sim at a time. "
            f"Stop it: python3 -m embody session stop --body {other.name or other.id}"
        )

    def prepare(self, *, dry_run: bool) -> dict:
        skill = resolve_skill()
        argv = [str(skill / "scripts" / "doctor.sh"), "--clone"]
        if dry_run:
            return {"ok": True, "dry_run": True, "argv": argv, "skill": str(skill)}
        proc = subprocess.run(argv, check=False, text=True, capture_output=True)
        _adopt_default_rl_root()
        # doctor.sh --clone also checks Jobs/train env. prepare only needs sim startable.
        if not _sim_ready():
            err = (proc.stderr or proc.stdout or "prepare failed").strip()
            raise AdapterError(err or "prepare failed: no microduck_rl checkout")
        return {
            "ok": True,
            "returncode": proc.returncode,
            "argv": argv,
            "skill": str(skill),
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "note": "sim startable"
            if proc.returncode == 0
            else "sim startable (doctor also checks Jobs/train; those are not required)",
        }

    def start(self, policy, *, dry_run: bool) -> dict:
        return _checked("start", "--repo", policy.hub, "--detach", dry_run=dry_run)

    def pull(self, policy, *, dry_run: bool) -> dict:
        return _checked("pull", policy.hub, "--as", policy.alias, dry_run=dry_run)

    def do(self, alias: str, *, dry_run: bool) -> dict:
        return _checked("do", alias, dry_run=dry_run)

    def status(self, *, dry_run: bool) -> dict:
        return _checked("status", dry_run=dry_run)

    def stop(self, *, dry_run: bool) -> dict:
        return _checked("shutdown", dry_run=dry_run)


def _default_rl_root() -> Path:
    return Path.home() / ".local" / "src" / "microduck_rl"


def _is_rl_checkout(path: Path) -> bool:
    return (path / "pyproject.toml").is_file() and (path / "src" / "mjlab_microduck").is_dir()


def _sim_ready() -> bool:
    env = os.environ.get("MICRODUCK_RL_ROOT")
    if env and _is_rl_checkout(Path(env)):
        return True
    return _is_rl_checkout(_default_rl_root())


def _adopt_default_rl_root() -> None:
    """Pack-private. Kernel does not set or document this variable."""
    if os.environ.get("MICRODUCK_RL_ROOT"):
        return
    default = _default_rl_root()
    if _is_rl_checkout(default):
        os.environ["MICRODUCK_RL_ROOT"] = str(default)


def _checked(*args: str, dry_run: bool) -> dict:
    try:
        result = run_control(*args, dry_run=dry_run)
    except AdapterError:
        raise
    if not result.get("ok"):
        err = str(result.get("stderr") or result.get("stdout") or "microduck-skill failed")
        raise AdapterError(err.strip() or "microduck-skill failed")
    return result
