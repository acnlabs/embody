from __future__ import annotations

import os
import signal
import subprocess
import sys
from typing import TYPE_CHECKING

from embody.store import default_home

if TYPE_CHECKING:
    from embody.models import Body


def watch_alive(pid: int | None) -> bool:
    if pid is None or pid <= 1:
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def spawn_watch(body: Body) -> int:
    log = default_home() / "watch.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env.setdefault("PYTHONUNBUFFERED", "1")
    handle = log.open("ab")
    try:
        proc = subprocess.Popen(
            [sys.executable, "-m", "embody", "push", "--watch", "--body", body.id],
            stdin=subprocess.DEVNULL,
            stdout=handle,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            env=env,
            close_fds=True,
        )
    finally:
        handle.close()
    return proc.pid


def stop_watch(pid: int | None) -> None:
    if not watch_alive(pid):
        return
    assert pid is not None
    try:
        os.killpg(pid, signal.SIGTERM)
    except (ProcessLookupError, PermissionError, OSError):
        try:
            os.kill(pid, signal.SIGTERM)
        except (ProcessLookupError, PermissionError, OSError):
            return
