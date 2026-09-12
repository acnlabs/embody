from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from embody import adapter_microduck
from embody.adapters import get_runtime
from embody.cli import main
from embody.models import State, asset_ref, hub_resolve
from embody.show import lift_runtime_numbers
from embody.store import load, save, state_path


@pytest.fixture
def home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setenv("EMBODY_HOME", str(tmp_path))
    monkeypatch.delenv("ACN_API_KEY", raising=False)
    monkeypatch.delenv("EMBODY_STUDIO_URL", raising=False)
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


def test_origin_robot_refused(home: Path) -> None:
    assert main(["body", "add", "--kind", "microduck", "--origin", "robot"]) == 1


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
    assert main(["session", "start", "--body", "duck-1", "--dry-run"]) == 0
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
    assert did["show"]["cards"]
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
        assert join_req["body"] == {"kind": "microduck", "origin": "sim", "name": "duck-9"}
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
