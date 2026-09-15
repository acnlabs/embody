from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from embody.models import hub_resolve

_WATCH_HOSTS = {"huggingface.co", "www.huggingface.co", "wandb.ai", "www.wandb.ai"}


def curves_url_from_training(training: dict[str, Any]) -> str | None:
    """wandb run page only. Hub card is a separate link."""
    for key in ("wandb", "wandb_url", "curves"):
        url = _as_wandb_url(training.get(key))
        if url:
            return url
    return _as_wandb_url(training.get("wandb_run_path") or training.get("wandb-run-path"))


def _as_wandb_url(raw: Any) -> str | None:
    text = str(raw or "").strip()
    if not text:
        return None
    if text.startswith("https://wandb.ai/"):
        return text.split("?", 1)[0][:240]
    parts = [p for p in text.strip("/").split("/") if p]
    if len(parts) == 3 and not text.startswith("http"):
        return f"https://wandb.ai/{parts[0]}/{parts[1]}/runs/{parts[2]}"
    return None


def watch_page_url(raw: Any) -> str | None:
    """Owner Watch link. Hugging Face or wandb https only."""
    text = str(raw or "").strip()
    if not text:
        return None
    parsed = urllib.parse.urlparse(text)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or host not in _WATCH_HOSTS:
        return None
    return text.split("?", 1)[0][:240]


def lift_curves_url(hub: str, *, timeout: float = 2.0) -> str | None:
    """Best-effort Hub manifest. Attach still works if this misses."""
    if os.environ.get("PYTEST_CURRENT_TEST"):
        return None
    repo = (hub or "").strip().strip("/")
    if "/" not in repo:
        return None
    url = hub_resolve(repo, "manifest.json")
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError, ValueError):
        return None
    if not isinstance(payload, dict):
        return None
    training = payload.get("training")
    if not isinstance(training, dict):
        return None
    return curves_url_from_training(training)
