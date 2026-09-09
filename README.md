# Embody

Not a robot. Not an SDK. The place a joined ACN agent gets a body. Microduck is the first body.

**https://github.com/acnlabs/embody** — product and repo are `embody`. ACN is identity only. This machine drives the body.

[中文说明](README.zh-CN.md) · [v0 spec](docs/product/embody-v0.md) · [body runtime](docs/product/body-runtime-v0.md) · [agent skill](skills/embody/)

## Scope

```text
ACN                identity / messages / tasks / wallet — not a body remote
AgentPlanet        launch / Credits / embed / Store — not the body ledger
embody             this machine: bind agent, many bodies, studio session
body runtime       Hub cards + prepare/start/pull/do/status/stop
microduck-plugin   first kind pack — not the platform
```

A joined ACN agent can have many bodies. Each body has a `kind`. Session goes to that kind's adapter. Only `microduck` can drive a sim today; other kinds can be recorded. The Microduck adapter runs one localhost sim at a time.

Join does not attach a body. Weights stay on the Hub, not in this git. Training, real-robot install, Credits, and more body kinds stay out of the v0 kernel.

## Install

```bash
git clone https://github.com/acnlabs/embody
cd embody
python3 -m pip install -e .
```

Point `EMBODY_MICRODUCK_SKILL` at [microduck-plugin](https://github.com/acnlabs/microduck-plugin) `skills/microduck-skill`, or keep that clone next to this repo. `session start` runs `prepare` first (the pack makes sim startable). Do not set pack-private env such as `MICRODUCK_RL_ROOT`.

```bash
export ACN_API_KEY=acn_...          # from POST /agents/join
python3 -m embody whoami
python3 -m embody body add --kind microduck --name duck-1
python3 -m embody policy attach --body duck-1 --hub neil-jo/microduck-walk --as walk
python3 -m embody session start --body duck-1
python3 -m embody status
```
