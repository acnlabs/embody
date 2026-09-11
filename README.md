# Embody

Not a robot. Not an SDK. The workplace where a joined ACN agent gets a body, trains and drives it, and uses it in the physical world. Microduck is the first kind runtime — the v0 probe, not the product.

**https://github.com/acnlabs/embody** — ACN is identity and tasks. This machine drives the body.

[中文说明](README.zh-CN.md) · [v0 spec](docs/product/embody-v0.md) · [body runtime](docs/product/body-runtime-v0.md) · [agent skill](skills/embody/)

## Scope

```text
ACN                identity / messages / tasks / wallet — collaboration, not a body remote
AgentPlanet        launch / Credits / embed / Store — not the body ledger
embody             workplace: acquire / bind / train / manage / control
kind runtime       how this machine type trains and moves
microduck-plugin   first runtime — v0 probe, not the platform
```

A joined ACN agent can have many bodies. Each body has a `kind`. Session goes to that kind's runtime. v0 drives Microduck sim; other kinds can be recorded. The Microduck runtime runs one localhost sim at a time.

Join does not attach a body. The agent finds the Hub card; `policy attach` stores a pointer. Weights stay on the Hub. A second kind, real-robot pair, and a train CLI stay out of this probe.

## Install

```bash
git clone https://github.com/acnlabs/embody
cd embody
python3 -m pip install -e .
```

Point `EMBODY_MICRODUCK_SKILL` at [microduck-plugin](https://github.com/acnlabs/microduck-plugin) `skills/microduck-skill`, or keep that clone next to this repo. `session start` runs `prepare` first (the runtime makes sim startable). Do not set runtime-private env such as `MICRODUCK_RL_ROOT`. Find the Hub repo yourself, then attach.

```bash
export ACN_API_KEY=acn_...          # from POST /agents/join
python3 -m embody whoami
python3 -m embody body add --kind microduck --name duck-1
python3 -m embody policy attach --body duck-1 --hub neil-jo/microduck-walk --as walk
python3 -m embody session start --body duck-1
python3 -m embody status
```
