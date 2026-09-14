from __future__ import annotations

import math

TWIST_X = 0.3
TWIST_Y = 0.2
TWIST_YAW = 1.5


def _clamp(value: object, lo: float, hi: float) -> float:
    try:
        n = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(n):
        return 0.0
    return max(lo, min(hi, n))


def clamp_twist(x: object, y: object, yaw: object) -> tuple[float, float, float]:
    return (
        _clamp(x, -TWIST_X, TWIST_X),
        _clamp(y, -TWIST_Y, TWIST_Y),
        _clamp(yaw, -TWIST_YAW, TWIST_YAW),
    )
