from __future__ import annotations

import json
from pathlib import Path

import pytest

from embody import adapter_microduck
from embody.adapters import get_runtime
from embody.cli import main
from embody.models import State, asset_ref, hub_resolve
from embody.store import load, save, state_path


@pytest.fixture
def home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setenv("EMBODY_HOME", str(tmp_path))
    monkeypatch.delenv("ACN_API_KEY", raising=False)
    return tmp_path


def run(argv: list[str]) -> dict:
    assert main(argv) == 0
    return load().to_dict()


def test_runtime_registry() -> None:
    pack = get_runtime("microduck")
    assert pack is not None
    assert pack.adapter_id == "microduck-skill"
    assert get_runtime("unitree-g1") is None


def test_asset_prefix_locked() -> None:
    assert asset_ref("body", "body_abc").startswith("embody:")
    assert hub_resolve("neil-jo/microduck-walk", "preview.mp4").endswith(
        "/neil-jo/microduck-walk/resolve/main/preview.mp4"
    )


def test_whoami_body_policy_registry(home: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["claim"]) == 1
    assert main(["whoami", "--offline", "--agent-id", "agent-1"]) == 0
    assert main(["body", "add", "--kind", "microduck", "--name", "duck-1"]) == 0
    assert main(["policy", "attach", "--hub", "neil-jo/microduck-walk", "--as", "walk"]) == 0
    assert main(
        [
            "policy",
            "attach",
            "--hub",
            "neil-jo/microduck-polite-bow",
            "--as",
            "polite_bow",
            "--episodic",
        ]
    ) == 0
    state = load()
    assert state.agent is not None and state.agent.agent_id == "agent-1"
    assert state.agent.verified is False
    assert len(state.bodies) == 1
    body = state.bodies[0]
    assert body.name == "duck-1"
    assert body.kind == "microduck"
    assert body.asset_ref.startswith("embody:body:")
    walk = body.policy_by_alias("walk")
    bow = body.policy_by_alias("polite_bow")
    assert walk is not None and walk.startable is True
    assert bow is not None and bow.startable is False
    assert bow.preview_url.endswith("/resolve/main/preview.mp4")

    capsys.readouterr()
    assert main(["registry", "print"]) == 0
    printed = json.loads(capsys.readouterr().out)
    assert printed["source"] == "embody"
    kinds = {row["asset_kind"] for row in printed["assets"]}
    assert kinds == {"body", "policy"}
    for row in printed["assets"]:
        assert row["owner_id"] == "agent-1"


def test_many_bodies_need_flag(home: Path) -> None:
    run(["whoami", "--offline", "--agent-id", "agent-1"])
    run(["body", "add", "--kind", "microduck", "--name", "duck-1"])
    run(["body", "add", "--kind", "microduck", "--name", "duck-2"])
    assert main(["policy", "attach", "--hub", "neil-jo/microduck-walk", "--as", "walk"]) == 1
    assert (
        main(
            [
                "policy",
                "attach",
                "--body",
                "duck-2",
                "--hub",
                "neil-jo/microduck-walk",
                "--as",
                "walk",
            ]
        )
        == 0
    )
    state = load()
    assert state.bodies[0].policies == []
    assert state.bodies[1].policy_by_alias("walk") is not None


def test_switch_agent_needs_replace(home: Path) -> None:
    run(["whoami", "--offline", "--agent-id", "agent-1"])
    run(["body", "add", "--kind", "microduck"])
    assert main(["whoami", "--offline", "--agent-id", "agent-2"]) == 1
    assert main(["whoami", "--offline", "--agent-id", "agent-2", "--replace"]) == 0
    state = load()
    assert state.agent is not None
    assert state.agent.agent_id == "agent-2"
    assert state.bodies == []


def test_invalid_body_kind(home: Path) -> None:
    run(["whoami", "--offline", "--agent-id", "agent-1"])
    assert main(["body", "add", "--kind", "Unitree G1"]) == 1


def test_non_microduck_has_no_session_adapter(home: Path) -> None:
    run(["whoami", "--offline", "--agent-id", "agent-1"])
    run(["body", "add", "--kind", "unitree-g1", "--name", "g1"])
    body = load().body_by_token("g1")
    assert body is not None
    assert body.adapter == "none"
    run(["policy", "attach", "--body", "g1", "--hub", "someone/g1-walk", "--as", "walk"])
    assert main(["session", "start", "--body", "g1", "--dry-run"]) == 1


def test_v1_state_migrates(home: Path) -> None:
    raw = {
        "version": 1,
        "claim": {
            "agent_id": "agent-1",
            "claimed_at": "2026-09-08T00:00:00+00:00",
            "verified": False,
            "acn_base_url": None,
        },
        "body": {
            "id": "body_old",
            "kind": "microduck",
            "asset_ref": "embody:body:body_old",
            "adapter": "microduck-skill",
            "registered_at": "2026-09-08T00:00:00+00:00",
        },
        "policies": [
            {
                "id": "policy_old",
                "alias": "walk",
                "hub": "neil-jo/microduck-walk",
                "asset_ref": "embody:policy:policy_old",
                "startable": True,
                "preview_url": "https://huggingface.co/neil-jo/microduck-walk/resolve/main/preview.mp4",
                "attached_at": "2026-09-08T00:00:00+00:00",
            }
        ],
        "session": None,
    }
    path = state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(raw), encoding="utf-8")
    state = load()
    assert state.agent is not None and state.agent.agent_id == "agent-1"
    assert len(state.bodies) == 1
    assert state.bodies[0].policy_by_alias("walk") is not None
    save(state)
    again = State.from_dict(json.loads(path.read_text(encoding="utf-8")))
    assert again.agent is not None


def _mock_skill(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    skill = tmp_path / "microduck-skill"
    scripts = skill / "scripts"
    scripts.mkdir(parents=True)
    (skill / "SKILL.md").write_text("# microduck-skill\n", encoding="utf-8")
    control = scripts / "control.sh"
    control.write_text("#!/bin/sh\necho mock\n", encoding="utf-8")
    control.chmod(0o755)
    monkeypatch.setenv("EMBODY_MICRODUCK_SKILL", str(skill))
    return skill


def test_session_per_body_and_adapter_one_sim(
    home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    skill = _mock_skill(tmp_path, monkeypatch)
    run(["whoami", "--offline", "--agent-id", "agent-1"])
    run(["body", "add", "--kind", "microduck", "--name", "duck-1"])
    run(["body", "add", "--kind", "microduck", "--name", "duck-2"])
    run(["policy", "attach", "--body", "duck-1", "--hub", "neil-jo/microduck-walk", "--as", "walk"])
    run(["policy", "attach", "--body", "duck-2", "--hub", "neil-jo/microduck-walk", "--as", "walk"])
    run(
        [
            "policy",
            "attach",
            "--body",
            "duck-1",
            "--hub",
            "neil-jo/microduck-polite-bow",
            "--as",
            "polite_bow",
            "--episodic",
        ]
    )

    assert main(["session", "start", "--body", "duck-1", "--as", "polite_bow", "--dry-run"]) == 1
    assert main(["session", "start", "--body", "duck-1", "--dry-run"]) == 0
    assert load().body_by_token("duck-1") is not None
    assert load().body_by_token("duck-1").session is not None
    assert load().body_by_token("duck-1").session.start_hub == "neil-jo/microduck-walk"
    assert main(["session", "start", "--body", "duck-2", "--dry-run"]) == 1
    assert main(["session", "pull", "--body", "duck-1", "--as", "polite_bow", "--dry-run"]) == 0
    assert main(["session", "do", "--body", "duck-1", "polite_bow", "--dry-run"]) == 0
    assert main(["session", "stop", "--body", "duck-1", "--dry-run"]) == 0
    assert load().body_by_token("duck-1").session is None
    assert main(["session", "start", "--body", "duck-2", "--dry-run"]) == 0
    started = adapter_microduck.control_argv(
        skill, "start", "--repo", "neil-jo/microduck-walk", "--detach"
    )
    assert started[-1] == "--detach"
