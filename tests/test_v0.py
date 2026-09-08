from __future__ import annotations

import json
from pathlib import Path

import pytest

from embody import adapter_microduck
from embody.cli import main
from embody.models import asset_ref, hub_resolve
from embody.store import load


@pytest.fixture
def home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setenv("EMBODY_HOME", str(tmp_path))
    return tmp_path


def run(argv: list[str]) -> dict:
    assert main(argv) == 0
    return load().to_dict()


def test_asset_prefix_locked() -> None:
    assert asset_ref("body", "body_abc").startswith("embody:")
    assert hub_resolve("neil-jo/microduck-walk", "preview.mp4").endswith(
        "/neil-jo/microduck-walk/resolve/main/preview.mp4"
    )


def test_claim_body_policy_registry(home: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["claim", "--offline", "--agent-id", "agent-1"]) == 0
    assert main(["body", "register", "--kind", "microduck"]) == 0
    assert main(["policy", "attach", "--hub", "neil-jo/microduck-walk", "--as", "walk"]) == 0
    assert main(
        ["policy", "attach", "--hub", "neil-jo/microduck-polite-bow", "--as", "polite_bow", "--episodic"]
    ) == 0
    state = load()
    assert state.claim is not None and state.claim.agent_id == "agent-1"
    assert state.claim.verified is False
    assert state.body is not None
    assert state.body.kind == "microduck"
    assert state.body.asset_ref.startswith("embody:body:")
    walk = state.policy_by_alias("walk")
    bow = state.policy_by_alias("polite_bow")
    assert walk is not None and walk.startable is True
    assert bow is not None and bow.startable is False
    assert bow.preview_url.endswith("/resolve/main/preview.mp4")

    capsys.readouterr()
    assert main(["registry", "print"]) == 0
    printed = json.loads(capsys.readouterr().out)
    assert printed["source"] == "embody"
    assert printed["store_listable"] is False
    kinds = {row["asset_kind"] for row in printed["assets"]}
    assert kinds == {"body", "policy"}
    for row in printed["assets"]:
        assert row["asset_ref"].startswith("embody:")
        assert row["source"] == "embody"
        assert row["owner_id"] == "agent-1"


def test_v0_one_agent(home: Path) -> None:
    run(["claim", "--offline", "--agent-id", "agent-1"])
    assert main(["claim", "--offline", "--agent-id", "agent-2"]) == 1
    assert main(["claim", "--offline", "--agent-id", "agent-2", "--replace"]) == 0
    assert load().claim is not None
    assert load().claim.agent_id == "agent-2"


def test_unknown_body_kind(home: Path) -> None:
    run(["claim", "--offline", "--agent-id", "agent-1"])
    assert main(["body", "register", "--kind", "quadruped"]) == 1


def test_session_dry_run_calls_adapter(
    home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    skill = tmp_path / "microduck-skill"
    scripts = skill / "scripts"
    scripts.mkdir(parents=True)
    (skill / "SKILL.md").write_text("# microduck-skill\n", encoding="utf-8")
    control = scripts / "control.sh"
    control.write_text("#!/bin/sh\necho mock\n", encoding="utf-8")
    control.chmod(0o755)
    monkeypatch.setenv("EMBODY_MICRODUCK_SKILL", str(skill))

    run(["claim", "--offline", "--agent-id", "agent-1"])
    run(["body", "register", "--kind", "microduck"])
    run(["policy", "attach", "--hub", "neil-jo/microduck-walk", "--as", "walk"])
    run(
        [
            "policy",
            "attach",
            "--hub",
            "neil-jo/microduck-polite-bow",
            "--as",
            "polite_bow",
            "--episodic",
        ]
    )

    assert main(["session", "start", "--as", "polite_bow", "--dry-run"]) == 1
    assert main(["session", "start", "--dry-run"]) == 0
    started = adapter_microduck.control_argv(skill, "start", "--repo", "neil-jo/microduck-walk", "--detach")
    assert load().session is not None
    assert load().session.start_hub == "neil-jo/microduck-walk"

    assert main(["session", "pull", "--as", "polite_bow", "--dry-run"]) == 0
    assert main(["session", "do", "polite_bow", "--dry-run"]) == 0
    assert main(["session", "status", "--dry-run"]) == 0
    assert main(["session", "stop", "--dry-run"]) == 0
    assert load().session is None
    assert started[-1] == "--detach"
