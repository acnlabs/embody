from __future__ import annotations

import os
import subprocess
from pathlib import Path


ADAPTER_ID = "microduck-skill"


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
