from __future__ import annotations

import json
import os
import shutil
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
    try:
        proc = subprocess.run(argv, check=False, text=True, capture_output=True, timeout=8)
    except subprocess.TimeoutExpired as exc:
        raise AdapterError("microduck-skill timed out talking to localhost sim") from exc
    return {
        "ok": proc.returncode == 0,
        "returncode": proc.returncode,
        "argv": argv,
        "skill": str(skill),
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    }


class MicroduckRuntime:
    """First kind runtime. Maps body-runtime verbs to microduck-skill control.sh."""

    kind = KIND
    adapter_id = ADAPTER_ID
    # Evidenced by the official 61-dim policy obs (gyro, projected gravity,
    # joints, last action, commands) and by status telemetry (tilt + feet).
    # Pollen lists a front camera on the real robot; it is not in that sim
    # contract. Do not put `camera` on a sim build.
    default_build = {
        "bom": "microduck-sim",
        "modules": {"imu": True, "foot_contact": True},
    }

    def guard_start(self, state, body) -> None:
        busy = state.running_by_kind(self.kind, except_id=body.id)
        if not busy:
            return
        other = busy[0]
        raise AdapterError(
            f"microduck-skill already has a session on {other.name or other.id}; "
            "this runtime runs one localhost sim at a time. "
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

    def twist(self, x: float, y: float, yaw: float, *, dry_run: bool) -> dict:
        return _checked(
            "twist",
            "--x",
            str(x),
            "--y",
            str(y),
            "--yaw",
            str(yaw),
            dry_run=dry_run,
        )

    def halt(self, *, dry_run: bool) -> dict:
        return _checked("stop", dry_run=dry_run)

    def status(self, *, dry_run: bool) -> dict:
        return _checked("status", dry_run=dry_run)

    def stop(self, *, dry_run: bool) -> dict:
        return _checked("shutdown", dry_run=dry_run)

    def probe(self) -> dict:
        """Read-only. Record this unit's as-built. Does not start a session or robotctl policy."""
        payload, via = _probe_payload()
        return {"ok": True, "via": via, "build": build_from_probe(payload)}


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


PROBE_ENV = "EMBODY_ROBOT_PROBE"
_MODULE_ALIASES = {
    "imu": ("imu",),
    "foot_contact": ("foot_contact", "feet"),
    "camera": ("camera",),
    "tof": ("tof", "lidar"),
}


def _walk_dicts(obj: object):
    if isinstance(obj, dict):
        yield obj
        for value in obj.values():
            yield from _walk_dicts(value)
    elif isinstance(obj, list):
        for item in obj:
            yield from _walk_dicts(item)


def _first_str(payload: dict, keys: tuple[str, ...]) -> str | None:
    for node in _walk_dicts(payload):
        for key in keys:
            value = node.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def _explicit_bool(value: object) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, dict):
        if isinstance(value.get("present"), bool):
            return bool(value["present"])
        if isinstance(value.get("ok"), bool):
            return bool(value["ok"])
        if isinstance(value.get("camera"), bool):
            return bool(value["camera"])
    return None


def _module_flag(payload: dict, names: tuple[str, ...]) -> bool | None:
    for node in _walk_dicts(payload):
        for name in names:
            if name not in node:
                continue
            flag = _explicit_bool(node[name])
            if flag is not None:
                return flag
    return None


def build_from_probe(payload: dict) -> dict:
    """As-built from a probe payload. Missing keys stay missing."""
    if not isinstance(payload, dict):
        raise AdapterError("robot probe payload must be a JSON object")
    build: dict = {"bom": "microduck"}
    serial = _first_str(payload, ("serial", "serial_number", "device_serial"))
    if serial:
        build["serial"] = serial
    modules: dict[str, bool] = {}
    for name, aliases in _MODULE_ALIASES.items():
        flag = _module_flag(payload, aliases)
        if flag is not None:
            modules[name] = flag
    if modules:
        build["modules"] = modules
    return build


def _probe_payload() -> tuple[dict, str]:
    fixture = (os.environ.get(PROBE_ENV) or "").strip()
    if fixture:
        path = Path(fixture).expanduser()
        if not path.is_file():
            raise AdapterError(f"{PROBE_ENV} is not a file: {path}")
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise AdapterError(f"{PROBE_ENV} is not JSON: {exc}") from exc
        if not isinstance(payload, dict):
            raise AdapterError(f"{PROBE_ENV} must be a JSON object")
        return payload, "fixture"

    robotctl = shutil.which("robotctl")
    if not robotctl:
        raise AdapterError(
            "no Microduck reachable: robotctl is not on PATH. "
            "Pairing records a unit this runtime can probe (robotctl health --json). "
            "This machine has no duck. Create a sim: --origin sim"
        )
    try:
        proc = subprocess.run(
            [robotctl, "health", "--json"],
            check=False,
            text=True,
            capture_output=True,
            timeout=8,
        )
    except TimeoutError as exc:
        raise AdapterError("no Microduck reachable: robotctl health timed out") from exc
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "robotctl health failed").strip()
        raise AdapterError(
            f"no Microduck reachable: {err[:240]}. Create a sim: --origin sim"
        )
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise AdapterError(
            f"robotctl health --json was not JSON ({exc}); cannot record a build"
        ) from exc
    if not isinstance(payload, dict):
        raise AdapterError("robotctl health --json must be an object")
    return payload, "robotctl"
