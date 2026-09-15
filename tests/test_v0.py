from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import pytest

from embody import adapter_microduck
from embody.adapters import get_runtime
from embody.cli import main
from embody.drive import clamp_twist
from embody.models import Session, State, asset_ref, hub_resolve
from embody.push import PushError, post_show, transient_push_error
from embody.show import lift_runtime_numbers, public_runtime_error
from embody.store import load, save, state_path


@pytest.fixture
def home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setenv("EMBODY_HOME", str(tmp_path))
    monkeypatch.delenv("ACN_API_KEY", raising=False)
    monkeypatch.delenv("EMBODY_STUDIO_URL", raising=False)
    monkeypatch.delenv("EMBODY_ROBOT_PROBE", raising=False)
    return tmp_path


def run(argv: list[str]) -> dict:
    assert main(argv) == 0
    return load().to_dict()


def add_sim(name: str | None = None) -> None:
    argv = ["body", "add", "--kind", "microduck", "--origin", "sim"]
    if name:
        argv += ["--name", name]
    run(argv)


def bind_offline(agent_id: str = "agent-1", body: str | None = None) -> None:
    argv = ["bind", "--offline", "--agent-id", agent_id]
    if body:
        argv += ["--body", body]
    run(argv)


def test_lift_runtime_numbers() -> None:
    raw = {"tilt_deg": 4.2, "ok": True, "feet": {"left": {"contact": True}}}
    assert lift_runtime_numbers({"stdout": json.dumps(raw)}) == raw


def test_hub_curves_url_from_training() -> None:
    from embody.hub import curves_url_from_training, lift_curves_url

    assert (
        curves_url_from_training({"wandb": "https://wandb.ai/acn/mjlab_microduck/runs/abc"})
        == "https://wandb.ai/acn/mjlab_microduck/runs/abc"
    )
    assert (
        curves_url_from_training({"wandb_run_path": "acn/mjlab_microduck/xyz"})
        == "https://wandb.ai/acn/mjlab_microduck/runs/xyz"
    )
    assert curves_url_from_training({"repo": "pollen-robotics/microduck_rl"}) is None
    assert lift_curves_url("neil-jo/microduck-walk") is None
    assert lift_runtime_numbers({"stdout": "not-json\n"}) is None
    assert lift_runtime_numbers({"stdout": ""}) is None
    assert lift_runtime_numbers({}) is None


def test_runtime_registry() -> None:
    runtime = get_runtime("microduck")
    assert runtime is not None
    assert runtime.adapter_id == "microduck-skill"
    assert get_runtime("unitree-g1") is None


def test_asset_prefix_locked() -> None:
    assert asset_ref("body", "body_abc").startswith("embody:")
    assert hub_resolve("neil-jo/microduck-walk", "preview.mp4").endswith(
        "/neil-jo/microduck-walk/resolve/main/preview.mp4"
    )


def test_whoami_body_policy_registry(home: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["claim"]) == 1
    assert main(["whoami", "--offline", "--agent-id", "agent-1"]) == 1
    add_sim("duck-1")
    assert main(["whoami", "--offline", "--agent-id", "agent-1"]) == 1
    assert main(["bind", "--offline", "--agent-id", "agent-1"]) == 0
    assert main(["whoami", "--offline", "--agent-id", "agent-1"]) == 0
    body = load().bodies[0]
    assert body.origin == "sim"
    assert body.bound_agent_id == "agent-1"
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
    assert body.origin == "sim"
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

    capsys.readouterr()
    assert main(["status"]) == 0
    workplace = json.loads(capsys.readouterr().out)
    assert workplace["note"].startswith("local workplace")
    card = workplace["show"][0]
    aliases = {row["alias"] for row in card["cards"]}
    assert aliases == {"walk", "polite_bow"}
    walk_card = next(row for row in card["cards"] if row["alias"] == "walk")
    assert walk_card["mode"] == "perpetual"
    assert walk_card["onnx"].endswith("/policy.onnx")
    assert walk_card["preview"].endswith("/preview.mp4")
    assert walk_card["card"] == "https://huggingface.co/neil-jo/microduck-walk"
    assert "curves" not in walk_card
    assert card["next"] == "session start"

    capsys.readouterr()
    assert main(["show"]) == 0
    shown = json.loads(capsys.readouterr().out)
    assert shown["show"][0]["numbers"] is None
    assert shown["show"][0]["cards"]


def test_many_bodies_need_flag(home: Path) -> None:
    add_sim("duck-1")
    add_sim("duck-2")
    bind_offline(body="duck-1")
    bind_offline(body="duck-2")
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
    add_sim("duck-1")
    bind_offline("agent-1")
    assert main(["bind", "--offline", "--agent-id", "agent-2"]) == 1
    assert main(["bind", "--offline", "--agent-id", "agent-2", "--replace"]) == 0
    state = load()
    assert state.agent is not None
    assert state.agent.agent_id == "agent-2"
    assert len(state.bodies) == 1
    assert state.bodies[0].bound_agent_id == "agent-2"


def test_origin_robot_refused_without_unit(home: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["body", "add", "--kind", "microduck", "--origin", "robot"]) == 1
    err = json.loads(capsys.readouterr().err)
    assert "no Microduck reachable" in err["error"]
    assert load().bodies == []


def test_origin_robot_records_probe_build(
    home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    fixture = tmp_path / "health.json"
    fixture.write_text(
        json.dumps(
            {
                "serial": "MD-PROBE-1",
                "imu": {"ok": True},
                "media": {"camera": True},
                "tof": {"present": True},
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("EMBODY_ROBOT_PROBE", str(fixture))
    capsys.readouterr()
    assert main(["body", "add", "--kind", "microduck", "--origin", "robot", "--name", "duck-real"]) == 0
    out = json.loads(capsys.readouterr().out)
    body = load().bodies[0]
    assert body.origin == "robot"
    assert body.build["serial"] == "MD-PROBE-1"
    assert body.build["modules"]["camera"] is True
    assert body.build["modules"]["imu"] is True
    assert body.build["modules"]["tof"] is True
    assert out["probe"]["via"] == "fixture"
    bind_offline(body="duck-real")
    run(["policy", "attach", "--body", "duck-real", "--hub", "neil-jo/microduck-walk", "--as", "walk"])
    capsys.readouterr()
    assert main(["session", "start", "--body", "duck-real", "--dry-run"]) == 1
    err = json.loads(capsys.readouterr().err)
    assert "origin=robot" in err["error"]


def test_origin_robot_rejects_handwritten_build(home: Path) -> None:
    assert main(
        ["body", "add", "--origin", "robot", "--build", '{"modules":{"camera":true}}']
    ) == 1


def test_build_from_probe_skips_unknown_keys() -> None:
    from embody.adapter_microduck import build_from_probe

    build = build_from_probe({"serial": "X", "noise": 1})
    assert build == {"bom": "microduck", "serial": "X"}
    build = build_from_probe({"media": {"camera": False}, "imu": False})
    assert build["modules"]["camera"] is False
    assert build["modules"]["imu"] is False
    assert "foot_contact" not in build["modules"]


def test_whoami_mismatch(home: Path) -> None:
    add_sim("duck-1")
    bind_offline("agent-1")
    assert main(["whoami", "--offline", "--agent-id", "agent-2"]) == 1


def test_invalid_body_kind(home: Path) -> None:
    assert main(["body", "add", "--kind", "Unitree G1", "--origin", "sim"]) == 1


def test_non_microduck_has_no_session_adapter(home: Path) -> None:
    run(["body", "add", "--kind", "unitree-g1", "--origin", "sim", "--name", "g1"])
    bind_offline()
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
    assert state.bodies[0].origin == "sim"
    assert state.bodies[0].bound_agent_id == "agent-1"
    assert state.bodies[0].build["bom"] == "microduck-sim"
    save(state)
    again = State.from_dict(json.loads(path.read_text(encoding="utf-8")))
    assert again.agent is not None


def _mock_skill(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    skill = tmp_path / "microduck-skill"
    scripts = skill / "scripts"
    scripts.mkdir(parents=True)
    (skill / "SKILL.md").write_text("# microduck-skill\n", encoding="utf-8")
    control = scripts / "control.sh"
    control.write_text(
        "#!/bin/sh\n"
        'if [ "$1" = "status" ]; then echo \'{"tilt_deg": 1.5, "ok": true}\'; exit 0; fi\n'
        'if [ "$1" = "do" ]; then echo \'{"tilt_deg": 2.0, "ok": true, "executed": true}\'; exit 0; fi\n'
        'if [ "$1" = "twist" ]; then echo \'{"ok": true, "twist": true}\'; exit 0; fi\n'
        'if [ "$1" = "stop" ]; then echo \'{"ok": true, "halted": true}\'; exit 0; fi\n'
        "echo mock\n",
        encoding="utf-8",
    )
    control.chmod(0o755)
    doctor = scripts / "doctor.sh"
    doctor.write_text("#!/bin/sh\necho doctor ok\n", encoding="utf-8")
    doctor.chmod(0o755)
    monkeypatch.setenv("EMBODY_MICRODUCK_SKILL", str(skill))
    return skill


def test_session_per_body_and_adapter_one_sim(
    home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    skill = _mock_skill(tmp_path, monkeypatch)
    add_sim("duck-1")
    add_sim("duck-2")
    bind_offline(body="duck-1")
    bind_offline(body="duck-2")
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
    assert main(["session", "prepare", "--body", "duck-1", "--dry-run"]) == 0
    capsys.readouterr()
    assert main(["session", "start", "--body", "duck-1", "--dry-run"]) == 0
    started = json.loads(capsys.readouterr().out)
    assert started["show"]["control"]["op"] == "start"
    assert started["show"]["control"]["alias"] == "walk"
    assert load().body_by_token("duck-1") is not None
    assert load().body_by_token("duck-1").session is not None
    assert load().body_by_token("duck-1").session.start_hub == "neil-jo/microduck-walk"
    capsys.readouterr()
    assert main(["session", "status", "--body", "duck-1"]) == 0
    live = json.loads(capsys.readouterr().out)
    assert live["show"]["numbers"] == {"tilt_deg": 1.5, "ok": True}
    assert live["show"]["cards"]
    capsys.readouterr()
    assert main(["show", "--body", "duck-1"]) == 0
    shown = json.loads(capsys.readouterr().out)
    assert shown["show"][0]["numbers"] == {"tilt_deg": 1.5, "ok": True}
    assert main(["session", "start", "--body", "duck-2", "--dry-run"]) == 1
    assert main(["session", "pull", "--body", "duck-1", "--as", "polite_bow", "--dry-run"]) == 0
    capsys.readouterr()
    assert main(["session", "do", "--body", "duck-1", "polite_bow"]) == 0
    did = json.loads(capsys.readouterr().out)
    assert did["show"]["numbers"] == {"tilt_deg": 2.0, "ok": True, "executed": True}
    assert did["show"]["control"]["op"] == "do"
    assert did["show"]["cards"]
    assert "pushed" not in did
    assert main(["session", "stop", "--body", "duck-1", "--dry-run"]) == 0
    assert load().body_by_token("duck-1").session is None
    assert main(["session", "start", "--body", "duck-2", "--dry-run"]) == 0
    started = adapter_microduck.control_argv(
        skill, "start", "--repo", "neil-jo/microduck-walk", "--detach"
    )
    assert started[-1] == "--detach"
    prep = adapter_microduck.MicroduckRuntime().prepare(dry_run=True)
    assert prep["argv"][-1] == "--clone"
    assert prep["argv"][0].endswith("doctor.sh")
    stopped = adapter_microduck.MicroduckRuntime().stop(dry_run=True)
    assert stopped["argv"][-1] == "shutdown"
    twisted = adapter_microduck.MicroduckRuntime().twist(0.2, 0.0, 0.8, dry_run=True)
    assert twisted["argv"][-7:] == ["twist", "--x", "0.2", "--y", "0.0", "--yaw", "0.8"]
    halted = adapter_microduck.MicroduckRuntime().halt(dry_run=True)
    assert halted["argv"][-1] == "stop"


def test_session_do_pushes_owner_show(
    home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    _mock_skill(tmp_path, monkeypatch)
    add_sim("duck-1")
    bind_offline()
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
    stub = RegistryStub()
    try:
        monkeypatch.setenv("EMBODY_STUDIO_URL", stub.url)
        monkeypatch.setenv("ACN_API_KEY", "acn_test")
        monkeypatch.setattr("embody.cli.spawn_watch", lambda body: 4242)
        monkeypatch.setattr("embody.cli.stop_watch", lambda pid: None)
        capsys.readouterr()
        assert main(["join", "--body", "duck-1"]) == 0
        assert main(["session", "start", "--body", "duck-1"]) == 0
        capsys.readouterr()
        assert main(["session", "do", "--body", "duck-1", "polite_bow"]) == 0
        out = json.loads(capsys.readouterr().out)
        assert out["pushed"]["ok"] is True
        assert out["show"]["numbers"]["executed"] is True
        shows = [row for row in stub.requests if row["path"] == "/api/agent/show"]
        assert shows[-1]["body"]["show"]["numbers"]["executed"] is True
        assert shows[-1]["body"]["show"]["control"]["op"] == "do"
        assert shows[-1]["body"]["show"]["control"]["source"] == "agent"
        assert shows[-1]["body"]["show"]["control"]["alias"] == "polite_bow"
    finally:
        stub.close()


def test_policy_attach_pushes_cards_not_control(
    home: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    add_sim("duck-1")
    bind_offline()
    stub = RegistryStub()
    try:
        monkeypatch.setenv("EMBODY_STUDIO_URL", stub.url)
        monkeypatch.setenv("ACN_API_KEY", "acn_test")
        capsys.readouterr()
        assert main(["join", "--body", "duck-1"]) == 0
        capsys.readouterr()
        assert main(["policy", "attach", "--hub", "neil-jo/microduck-walk", "--as", "walk"]) == 0
        out = json.loads(capsys.readouterr().out)
        assert out["pushed"]["ok"] is True
        shows = [row for row in stub.requests if row["path"] == "/api/agent/show"]
        assert shows
        show = shows[-1]["body"]["show"]
        assert "control" not in show
        walk = next(row for row in show["cards"] if row["alias"] == "walk")
        assert walk["card"] == "https://huggingface.co/neil-jo/microduck-walk"
    finally:
        stub.close()


def test_show_keeps_cards_when_runtime_status_fails(
    home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    skill = _mock_skill(tmp_path, monkeypatch)
    (skill / "scripts" / "control.sh").write_text(
        "#!/bin/sh\necho sim down >&2\nexit 1\n", encoding="utf-8"
    )
    add_sim("duck-1")
    bind_offline()
    run(["policy", "attach", "--hub", "neil-jo/microduck-walk", "--as", "walk"])
    run(["session", "start", "--dry-run"])
    capsys.readouterr()
    assert main(["show"]) == 0
    shown = json.loads(capsys.readouterr().out)
    card = shown["show"][0]
    assert card["cards"][0]["alias"] == "walk"
    assert card["numbers"] is None
    assert "sim down" in card["numbers_error"]
    assert "Traceback" not in card["numbers_error"]


def test_session_stop_clears_when_sim_gone(
    home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    skill = _mock_skill(tmp_path, monkeypatch)
    add_sim("duck-1")
    bind_offline()
    run(["policy", "attach", "--hub", "neil-jo/microduck-walk", "--as", "walk"])
    run(["session", "start", "--dry-run"])
    (skill / "scripts" / "control.sh").write_text(
        "#!/bin/sh\necho gone >&2\nexit 1\n", encoding="utf-8"
    )
    (skill / "scripts" / "control.sh").chmod(0o755)
    assert main(["session", "stop"]) == 0
    assert load().bodies[0].session is None


def test_public_runtime_error_hides_traceback() -> None:
    raw = (
        "Traceback (most recent call last):\n"
        "  File \"x.py\", line 1, in <module>\n"
        "ConnectionRefusedError: [Errno 61] Connection refused\n"
    )
    out = public_runtime_error(raw)
    assert "Traceback" not in out
    assert "127.0.0.1:8765" in out
    assert public_runtime_error("sim down") == "sim down"


def test_prepare_ok_when_doctor_fails_but_sim_ready(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    skill = _mock_skill(tmp_path, monkeypatch)
    (skill / "scripts" / "doctor.sh").write_text(
        "#!/bin/sh\necho jobs missing\nexit 1\n", encoding="utf-8"
    )
    monkeypatch.setattr(adapter_microduck, "_adopt_default_rl_root", lambda: None)
    monkeypatch.setattr(adapter_microduck, "_sim_ready", lambda: True)
    out = adapter_microduck.MicroduckRuntime().prepare(dry_run=False)
    assert out["ok"] is True
    assert out["returncode"] == 1


def test_run_control_adopts_default_checkout(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _mock_skill(tmp_path, monkeypatch)
    checkout = tmp_path / "microduck_rl"
    (checkout / "src" / "mjlab_microduck").mkdir(parents=True)
    (checkout / "pyproject.toml").write_text("[project]\nname='x'\n", encoding="utf-8")
    monkeypatch.delenv("MICRODUCK_RL_ROOT", raising=False)
    monkeypatch.setattr(adapter_microduck, "_default_rl_root", lambda: checkout)
    adapter_microduck.run_control("status", dry_run=True)
    assert os.environ["MICRODUCK_RL_ROOT"] == str(checkout)


def test_owner_studio_observes(home: Path) -> None:
    from embody.show import owner_payload
    from embody.studio import serve

    add_sim("duck-1")
    bind_offline()
    run(["policy", "attach", "--hub", "neil-jo/microduck-walk", "--as", "walk"])
    payload = owner_payload()
    assert payload["audience"] == "owner"
    assert payload["show"][0]["origin"] == "sim"
    assert payload["show"][0]["cards"][0]["alias"] == "walk"
    assert payload["show"][0]["numbers"] is None

    assert main(["studio", "--bind", "0.0.0.0"]) == 1
    httpd = serve("127.0.0.1", 0)
    host, port = httpd.server_address[:2]
    thread = __import__("threading").Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        import urllib.error
        import urllib.request

        page = urllib.request.urlopen(f"http://{host}:{port}/", timeout=2).read().decode()
        assert "不是产品" in page
        assert "owner studio" in page
        shown = json.loads(
            urllib.request.urlopen(f"http://{host}:{port}/api/show", timeout=2).read().decode()
        )
        assert shown["audience"] == "owner"
        assert shown["show"][0]["name"] == "duck-1"
        req = urllib.request.Request(f"http://{host}:{port}/api/show", method="POST")
        try:
            urllib.request.urlopen(req, timeout=2)
            raise AssertionError("POST should be refused")
        except urllib.error.HTTPError as exc:
            assert exc.code == 405
    finally:
        httpd.shutdown()
        httpd.server_close()


def test_push_requires_studio_url_and_bind(home: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    add_sim("duck-1")
    assert main(["push", "--body", "duck-1"]) == 1
    bind_offline()
    monkeypatch.delenv("EMBODY_STUDIO_URL", raising=False)
    assert main(["push", "--body", "duck-1"]) == 1


class RegistryStub:
    """Fake hosted studio: a registry-aware join + push endpoint."""

    def __init__(self) -> None:
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
        import threading

        stub = self
        stub.registered = set()
        stub.requests: list[dict] = []
        stub.inbox: dict[str, dict] = {}

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self) -> None:
                length = int(self.headers.get("Content-Length", "0"))
                body = json.loads(self.rfile.read(length).decode())
                stub.requests.append(
                    {"path": self.path, "auth": self.headers.get("Authorization"), "body": body}
                )
                if self.path == "/api/agent/bodies":
                    wanted = body.get("id") or "body_aaaa11112222"
                    if wanted in stub.registered:
                        status, payload = 409, {"ok": False, "error": "taken"}
                    else:
                        stub.registered.add(wanted)
                        status, payload = 200, {
                            "ok": True,
                            "body": {"id": wanted},
                            "room": f"/b/{wanted}",
                        }
                elif self.path == "/api/agent/show":
                    show = (body or {}).get("show") or {}
                    if show.get("id") not in stub.registered:
                        status, payload = 404, {"ok": False, "error": "join first"}
                    else:
                        status, payload = 200, {"ok": True, "room": f"/b/{show['id']}"}
                elif self.path == "/api/agent/pose":
                    wanted = body.get("id")
                    if wanted not in stub.registered:
                        status, payload = 404, {"ok": False, "error": "join first"}
                    else:
                        status, payload = 200, {"ok": True}
                else:
                    status, payload = 404, {"ok": False}
                raw = json.dumps(payload).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            def do_GET(self) -> None:
                stub.requests.append(
                    {"path": self.path, "auth": self.headers.get("Authorization"), "body": None}
                )
                prefix = "/api/agent/inbox/"
                if self.path.startswith(prefix):
                    wanted = self.path[len(prefix) :]
                    if wanted not in stub.registered:
                        status, payload = 404, {"ok": False, "error": "join first"}
                    else:
                        cmd = stub.inbox.pop(wanted, None)
                        status, payload = 200, {"ok": True, "command": cmd}
                else:
                    status, payload = 404, {"ok": False}
                raw = json.dumps(payload).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            def do_DELETE(self) -> None:
                stub.requests.append(
                    {"path": self.path, "auth": self.headers.get("Authorization"), "body": None}
                )
                prefix = "/api/agent/bodies/"
                if self.path.startswith(prefix):
                    wanted = self.path[len(prefix) :]
                    stub.registered.discard(wanted)
                    status, payload = 200, {"ok": True, "removed": wanted}
                else:
                    status, payload = 404, {"ok": False}
                raw = json.dumps(payload).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            def log_message(self, *_args: object) -> None:
                return

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    @property
    def url(self) -> str:
        _host, port = self.httpd.server_address[:2]
        return f"http://127.0.0.1:{port}"

    def close(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()


def test_push_posts_to_embody_web_not_agentplanet(
    home: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    add_sim("duck-1")
    bind_offline()
    run(["policy", "attach", "--hub", "neil-jo/microduck-walk", "--as", "walk"])

    stub = RegistryStub()
    try:
        monkeypatch.setenv("EMBODY_STUDIO_URL", stub.url)
        monkeypatch.setenv("ACN_API_KEY", "acn_test")
        capsys.readouterr()
        assert main(["join", "--body", "duck-1"]) == 0
        joined = json.loads(capsys.readouterr().out)
        assert joined["joined"] is True
        assert main(["push", "--body", "duck-1"]) == 0
        out = json.loads(capsys.readouterr().out)
        assert out["pushed"] is True
        local_id = load().bodies[0].id
        assert out["room"] == f"/b/{local_id}"
        join_req, push_req = stub.requests
        assert join_req["path"] == "/api/agent/bodies"
        assert join_req["auth"] == "Bearer acn_test"
        assert join_req["body"]["id"] == local_id
        assert push_req["path"] == "/api/agent/show"
        assert push_req["auth"] == "Bearer acn_test"
        assert push_req["body"]["show"]["name"] == "duck-1"
        assert push_req["body"]["show"]["origin"] == "sim"
        assert "agentplanet" not in push_req["path"]
    finally:
        stub.close()


def test_push_refused_before_join(
    home: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    add_sim("duck-1")
    bind_offline()
    stub = RegistryStub()
    try:
        monkeypatch.setenv("EMBODY_STUDIO_URL", stub.url)
        monkeypatch.setenv("ACN_API_KEY", "acn_test")
        capsys.readouterr()
        assert main(["push", "--body", "duck-1"]) == 1
        err = json.loads(capsys.readouterr().err)
        assert "join first" in err["error"]
        assert stub.requests[0]["path"] == "/api/agent/show"
    finally:
        stub.close()


def test_body_add_joins_hosted_when_studio_set(
    home: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    stub = RegistryStub()
    try:
        monkeypatch.setenv("EMBODY_STUDIO_URL", stub.url)
        monkeypatch.setenv("ACN_API_KEY", "acn_test")
        capsys.readouterr()
        assert main(["body", "add", "--kind", "microduck", "--origin", "sim", "--name", "duck-9"]) == 0
        out = json.loads(capsys.readouterr().out)
        assert out["joined"] is True
        assert out["body"]["id"] == "body_aaaa11112222"
        assert out["room"] == "/b/body_aaaa11112222"
        join_req = stub.requests[0]
        assert join_req["path"] == "/api/agent/bodies"
        assert join_req["body"]["kind"] == "microduck"
        assert join_req["body"]["origin"] == "sim"
        assert join_req["body"]["name"] == "duck-9"
        assert join_req["body"]["build"]["bom"] == "microduck-sim"
        assert join_req["body"]["build"]["modules"]["imu"] is True
        assert "camera" not in join_req["body"]["build"]["modules"]
        assert "id" not in join_req["body"]
    finally:
        stub.close()


def test_join_conflict_fails(
    home: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    add_sim("duck-1")
    stub = RegistryStub()
    try:
        monkeypatch.setenv("EMBODY_STUDIO_URL", stub.url)
        monkeypatch.setenv("ACN_API_KEY", "acn_test")
        capsys.readouterr()
        assert main(["join", "--body", "duck-1"]) == 0
        assert main(["join", "--body", "duck-1"]) == 1
        err = json.loads(capsys.readouterr().err)
        assert "409" in err["error"]
    finally:
        stub.close()


def test_body_add_gets_kind_default_build(home: Path) -> None:
    add_sim("duck-1")
    body = load().bodies[0]
    assert body.build["bom"] == "microduck-sim"
    assert body.build["modules"]["imu"] is True
    assert "camera" not in body.build["modules"]


def test_body_add_build_overlay_rejects_sim_camera(home: Path, capsys: pytest.CaptureFixture[str]) -> None:
    argv = [
        "body", "add", "--kind", "microduck", "--origin", "sim", "--name", "duck-cam",
        "--build", '{"bom": "microduck-sim-cam", "modules": {"camera": true}}',
    ]
    assert main(argv) == 1
    err = json.loads(capsys.readouterr().err)
    assert "camera" in err["error"]
    assert load().bodies == []


def test_body_add_build_rejects_non_object(home: Path) -> None:
    assert main(["body", "add", "--origin", "sim", "--build", "[1, 2]"]) == 1
    assert main(["body", "add", "--origin", "sim", "--build", "{nope"]) == 1
    assert load().bodies == []


def test_body_build_set_unset_replace(home: Path, capsys: pytest.CaptureFixture[str]) -> None:
    add_sim("duck-1")
    capsys.readouterr()
    assert main(["body", "build", "--body", "duck-1"]) == 0
    shown = json.loads(capsys.readouterr().out)
    assert shown["changed"] is False
    assert shown["build"]["bom"] == "microduck-sim"

    argv = ["body", "build", "--body", "duck-1",
            "--set", "serial=MD-0001"]
    assert main(argv) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["changed"] is True
    assert out["build"]["serial"] == "MD-0001"
    assert "camera" not in out["build"]["modules"]

    assert main(["body", "build", "--body", "duck-1", "--set", "modules.camera=true"]) == 1
    err = json.loads(capsys.readouterr().err)
    assert "camera" in err["error"]

    assert main(["body", "build", "--body", "duck-1", "--unset", "serial"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert "serial" not in out["build"]
    assert out["build"]["modules"]["imu"] is True

    assert main(["body", "build", "--body", "duck-1", "--replace", '{"bom": "bare"}']) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["build"] == {"bom": "bare"}

    assert main(["body", "build", "--body", "duck-1", "--set", "modules.imu=True"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["build"]["modules"]["imu"] is True

    assert main(["body", "build", "--body", "duck-1", "--replace", "{}"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["build"]["bom"] == "microduck-sim"
    assert out["build"]["modules"]["imu"] is True
    assert "camera" not in out["build"]["modules"]

    assert main(["body", "build", "--body", "duck-1", "--set", "bad-item"]) == 1


def test_push_carries_build(
    home: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    add_sim("duck-1")
    bind_offline()
    run(["body", "build", "--body", "duck-1", "--set", "serial=MD-0001"])
    stub = RegistryStub()
    try:
        monkeypatch.setenv("EMBODY_STUDIO_URL", stub.url)
        monkeypatch.setenv("ACN_API_KEY", "acn_test")
        capsys.readouterr()
        assert main(["join", "--body", "duck-1"]) == 0
        assert main(["push", "--body", "duck-1"]) == 0
        capsys.readouterr()
        push_req = stub.requests[-1]
        build = push_req["body"]["show"]["build"]
        assert build["serial"] == "MD-0001"
        assert build["modules"]["imu"] is True
        assert "camera" not in build["modules"]
    finally:
        stub.close()


def test_unknown_kind_has_empty_default_build(home: Path) -> None:
    assert main(["body", "add", "--kind", "unitree-g1", "--origin", "sim"]) == 0
    assert load().bodies[0].build == {}


def test_load_backfills_missing_and_empty_build(home: Path) -> None:
    add_sim("duck-1")
    path = state_path()
    data = json.loads(path.read_text(encoding="utf-8"))
    del data["bodies"][0]["build"]
    path.write_text(json.dumps(data), encoding="utf-8")
    assert load().bodies[0].build["bom"] == "microduck-sim"
    on_disk = json.loads(path.read_text(encoding="utf-8"))
    assert on_disk["bodies"][0]["build"]["modules"]["imu"] is True

    data = json.loads(path.read_text(encoding="utf-8"))
    data["bodies"][0]["build"] = {}
    path.write_text(json.dumps(data), encoding="utf-8")
    assert load().bodies[0].build["modules"]["imu"] is True
    assert "camera" not in load().bodies[0].build["modules"]


def test_load_strips_unevidenced_sim_camera(home: Path) -> None:
    add_sim("duck-1")
    path = state_path()
    data = json.loads(path.read_text(encoding="utf-8"))
    data["bodies"][0]["build"]["modules"]["camera"] = True
    path.write_text(json.dumps(data), encoding="utf-8")
    body = load().bodies[0]
    assert "camera" not in body.build["modules"]
    assert body.build["modules"]["imu"] is True
    on_disk = json.loads(path.read_text(encoding="utf-8"))
    assert "camera" not in on_disk["bodies"][0]["build"]["modules"]


def test_body_rm_drops_local_and_hosted(
    home: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    add_sim("duck-1")
    bind_offline()
    stub = RegistryStub()
    try:
        monkeypatch.setenv("EMBODY_STUDIO_URL", stub.url)
        monkeypatch.setenv("ACN_API_KEY", "acn_test")
        capsys.readouterr()
        assert main(["join", "--body", "duck-1"]) == 0
        local_id = load().bodies[0].id
        assert local_id in stub.registered
        capsys.readouterr()
        assert main(["body", "rm", "--body", "duck-1"]) == 0
        out = json.loads(capsys.readouterr().out)
        assert out["removed"] == "duck-1"
        assert out["hosted"] is True
        assert load().bodies == []
        assert stub.requests[-1]["path"] == f"/api/agent/bodies/{local_id}"
        assert local_id not in stub.registered
    finally:
        stub.close()


def test_body_add_build_rejects_too_large(home: Path) -> None:
    huge = json.dumps({"pad": "x" * 20000})
    assert main(["body", "add", "--origin", "sim", "--build", huge]) == 1
    assert load().bodies == []


def _mark_running(name: str = "duck-1") -> None:
    state = load()
    body = state.body_by_token(name)
    assert body is not None
    body.session = Session(
        id="session_test",
        started_at="2026-09-13T00:00:00+00:00",
        adapter="microduck-skill",
    )
    save(state)


def test_session_start_spawns_watch(
    home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    _mock_skill(tmp_path, monkeypatch)
    add_sim("duck-1")
    bind_offline()
    run(["policy", "attach", "--hub", "neil-jo/microduck-walk", "--as", "walk"])
    spawned: list[str] = []
    stopped: list[int | None] = []
    monkeypatch.setattr(
        "embody.cli.spawn_watch", lambda body: spawned.append(body.id) or 4242
    )
    monkeypatch.setattr("embody.cli.stop_watch", lambda pid: stopped.append(pid))
    stub = RegistryStub()
    try:
        monkeypatch.setenv("EMBODY_STUDIO_URL", stub.url)
        monkeypatch.setenv("ACN_API_KEY", "acn_test")
        capsys.readouterr()
        assert main(["join", "--body", "duck-1"]) == 0
        capsys.readouterr()
        assert main(["session", "start", "--body", "duck-1"]) == 0
        out = json.loads(capsys.readouterr().out)
        assert out["watch"] == {"ok": True, "pid": 4242}
        assert "Owner room is live" in out["note"]
        body = load().bodies[0]
        assert body.session is not None
        assert body.session.watch_pid == 4242
        assert spawned == [body.id]
        capsys.readouterr()
        assert main(["session", "stop", "--body", "duck-1"]) == 0
        assert 4242 in stopped
        assert load().bodies[0].session is None
    finally:
        stub.close()


def test_session_start_skips_watch_without_studio(
    home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    _mock_skill(tmp_path, monkeypatch)
    add_sim("duck-1")
    bind_offline()
    run(["policy", "attach", "--hub", "neil-jo/microduck-walk", "--as", "walk"])

    def boom(_body: object) -> int:
        raise AssertionError("must not spawn watch without EMBODY_STUDIO_URL")

    monkeypatch.setattr("embody.cli.spawn_watch", boom)
    capsys.readouterr()
    assert main(["session", "start", "--body", "duck-1"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["watch"]["skipped"]
    assert load().bodies[0].session is not None
    assert load().bodies[0].session.watch_pid is None


def test_push_watch_refuses_second_alive_watch(
    home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    _mock_skill(tmp_path, monkeypatch)
    add_sim("duck-1")
    bind_offline()
    run(["policy", "attach", "--hub", "neil-jo/microduck-walk", "--as", "walk"])
    _mark_running()
    proc = subprocess.Popen(["sleep", "30"], start_new_session=True)
    try:
        state = load()
        assert state.bodies[0].session is not None
        state.bodies[0].session.watch_pid = proc.pid
        save(state)
        capsys.readouterr()
        assert main(["push", "--watch", "--body", "duck-1"]) == 1
        err = json.loads(capsys.readouterr().err)
        assert "already running" in err["error"]
    finally:
        proc.kill()
        proc.wait()


def test_stop_watch_kills_process_group() -> None:
    from embody.watch import stop_watch, watch_alive

    proc = subprocess.Popen(["sleep", "30"], start_new_session=True)
    try:
        assert watch_alive(proc.pid)
        stop_watch(proc.pid)
        proc.wait(timeout=2)
        assert not watch_alive(proc.pid)
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait()


def test_push_watch_refuses_without_session(home: Path) -> None:
    add_sim("duck-1")
    bind_offline()
    assert main(["push", "--watch", "--body", "duck-1"]) == 1
    assert main(["push", "--watch", "--body", "duck-1", "--interval", "0"]) == 1


def test_push_watch_stops_when_session_ends(
    home: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    add_sim("duck-1")
    bind_offline()
    _mark_running()

    def fake_document(body, **_kwargs):
        return {
            "ok": True,
            "audience": "owner",
            "workplace": "studio",
            "show": {
                "id": body.id,
                "name": body.name,
                "kind": body.kind,
                "origin": body.origin,
                "bound_agent_id": body.bound_agent_id,
                "session_running": body.session is not None,
            },
            "note": "test",
        }

    def fake_sleep(_seconds: float) -> None:
        state = load()
        state.bodies[0].session = None
        save(state)

    monkeypatch.setattr("embody.cli.push_document", fake_document)
    monkeypatch.setattr("embody.cli.live_show", lambda body: fake_document(body)["show"])
    monkeypatch.setattr("embody.cli.time.sleep", fake_sleep)

    stub = RegistryStub()
    try:
        monkeypatch.setenv("EMBODY_STUDIO_URL", stub.url)
        monkeypatch.setenv("ACN_API_KEY", "acn_test")
        capsys.readouterr()
        assert main(["join", "--body", "duck-1"]) == 0
        capsys.readouterr()
        assert main(["push", "--watch", "--body", "duck-1", "--interval", "0.01"]) == 0
        shows = [row for row in stub.requests if row["path"] == "/api/agent/show"]
        assert len(shows) == 2
        assert shows[0]["body"]["listen"] is True
        assert shows[0]["body"]["show"]["session_running"] is True
        assert shows[1]["body"]["show"]["session_running"] is False
    finally:
        stub.close()


def test_transient_push_error_classifies() -> None:
    assert transient_push_error(PushError("embody web unreachable: [SSL: UNEXPECTED_EOF_WHILE_READING]"))
    assert transient_push_error(PushError("embody web unreachable: timed out"))
    assert transient_push_error(PushError("embody web push failed (503): oops"))
    assert not transient_push_error(PushError("embody web push failed (401): ACN bearer required"))
    assert not transient_push_error(PushError("ACN_API_KEY is required to push (hosted studio checks /agents/me)"))


def test_post_show_wraps_timeout_as_transient(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def boom(*_args: object, **_kwargs: object) -> object:
        raise TimeoutError("The read operation timed out")

    monkeypatch.setattr("embody.push.urllib.request.urlopen", boom)
    monkeypatch.setenv("EMBODY_STUDIO_URL", "https://example.invalid")
    monkeypatch.setenv("ACN_API_KEY", "acn_test")
    with pytest.raises(PushError) as caught:
        post_show({"show": {}})
    assert "timed out" in str(caught.value)
    assert transient_push_error(caught.value)


def test_push_watch_retries_ssl_then_succeeds(
    home: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    add_sim("duck-1")
    bind_offline()
    _mark_running()
    hits = {"n": 0}

    def fake_document(body, **_kwargs):
        return {
            "ok": True,
            "show": {
                "id": body.id,
                "name": body.name,
                "kind": body.kind,
                "origin": body.origin,
                "bound_agent_id": body.bound_agent_id,
                "session_running": body.session is not None,
            },
        }

    def fake_post(_document):
        hits["n"] += 1
        if hits["n"] == 1:
            raise PushError("embody web unreachable: [SSL: UNEXPECTED_EOF_WHILE_READING] EOF")
        return {"ok": True, "room": "/b/body_test"}

    def fake_sleep(_seconds: float) -> None:
        if hits["n"] >= 2:
            state = load()
            state.bodies[0].session = None
            save(state)

    monkeypatch.setattr("embody.cli.push_document", fake_document)
    monkeypatch.setattr("embody.cli.live_show", lambda body: fake_document(body)["show"])
    monkeypatch.setattr("embody.cli.take_inbox", lambda _id: None)
    monkeypatch.setattr("embody.cli.post_pose", lambda *_a, **_k: {"ok": True})
    monkeypatch.setattr("embody.cli.post_show", fake_post)
    monkeypatch.setattr("embody.cli.time.sleep", fake_sleep)
    capsys.readouterr()
    assert main(["push", "--watch", "--body", "duck-1", "--interval", "0.01"]) == 0
    out = capsys.readouterr().out
    assert "hosted studio unreachable; retrying" in out
    assert hits["n"] == 3


def test_push_watch_401_does_not_retry(
    home: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    add_sim("duck-1")
    bind_offline()
    _mark_running()
    sleeps: list[float] = []

    def fake_document(body, **_kwargs):
        return {"ok": True, "show": {"id": body.id}}

    def fake_post(_document):
        raise PushError("embody web push failed (401): ACN bearer required")

    monkeypatch.setattr("embody.cli.push_document", fake_document)
    monkeypatch.setattr("embody.cli.live_show", lambda body: fake_document(body)["show"])
    monkeypatch.setattr("embody.cli.take_inbox", lambda _id: None)
    monkeypatch.setattr("embody.cli.post_pose", lambda *_a, **_k: {"ok": True})
    monkeypatch.setattr("embody.cli.post_show", fake_post)
    monkeypatch.setattr("embody.cli.time.sleep", sleeps.append)
    assert main(["push", "--watch", "--body", "duck-1"]) == 1
    assert sleeps == []


def test_clamp_twist_caps() -> None:
    assert clamp_twist(9, 9, 9) == (0.3, 0.2, 1.5)
    assert clamp_twist(-9, -9, -9) == (-0.3, -0.2, -1.5)
    assert clamp_twist("no", None, float("nan")) == (0.0, 0.0, 0.0)


def test_session_twist_and_halt_dry_run(
    home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    _mock_skill(tmp_path, monkeypatch)
    add_sim("duck-1")
    bind_offline()
    run(["policy", "attach", "--hub", "neil-jo/microduck-walk", "--as", "walk"])
    run(["session", "start", "--dry-run"])
    capsys.readouterr()
    assert main(["session", "twist", "--x", "0.2", "--yaw", "0.8", "--dry-run"]) == 0
    twisted = json.loads(capsys.readouterr().out)
    assert twisted["adapter"]["argv"][-7:] == ["twist", "--x", "0.2", "--y", "0.0", "--yaw", "0.8"]
    capsys.readouterr()
    assert main(["session", "halt", "--dry-run"]) == 0
    halted = json.loads(capsys.readouterr().out)
    assert halted["adapter"]["argv"][-1] == "stop"


def test_push_watch_runs_owner_inbox(
    home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    _mock_skill(tmp_path, monkeypatch)
    add_sim("duck-1")
    bind_offline()
    run(["policy", "attach", "--hub", "neil-jo/microduck-walk", "--as", "walk"])
    _mark_running()
    stub = RegistryStub()
    try:
        monkeypatch.setenv("EMBODY_STUDIO_URL", stub.url)
        monkeypatch.setenv("ACN_API_KEY", "acn_test")
        capsys.readouterr()
        assert main(["join", "--body", "duck-1"]) == 0
        stub.inbox[load().bodies[0].id] = {"op": "twist", "x": 0.2, "y": 0, "yaw": 0}

        def fake_sleep(_seconds: float) -> None:
            state = load()
            state.bodies[0].session = None
            save(state)

        monkeypatch.setattr("embody.cli.time.sleep", fake_sleep)
        capsys.readouterr()
        assert main(["push", "--watch", "--body", "duck-1", "--interval", "0.01"]) == 0
        out = capsys.readouterr().out
        assert '"drove"' in out
        assert '"op": "twist"' in out
        poses = [row for row in stub.requests if row["path"] == "/api/agent/pose"]
        assert poses
        assert poses[0]["body"]["listen"] is True
    finally:
        stub.close()
