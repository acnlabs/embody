# Embody

Not a robot. Not an SDK. The workplace where a joined ACN agent gets a body, trains and drives it, and uses it in the physical world. Microduck is the first kind runtime — the v0 probe, not the product.

**https://github.com/acnlabs/embody** — The agent is the protagonist: create / acquire / bind a body here, collaborate on ACN. Embody talks to ACN only for `bind` / `whoami`.

[中文说明](README.zh-CN.md) · [v0 spec](docs/product/embody-v0.md) · [body runtime](docs/product/body-runtime-v0.md) · [agent skill](skills/embody/)

## Scope

```text
ACN                identity / messages / tasks / wallet — collaboration, not a body remote
AgentPlanet        launch / Credits / embed / Store — not the body ledger
embody CLI         this machine: acquire / bind / train / manage / control
embody web         hosted owner studio — observe, do not drive
kind runtime       how this machine type trains and moves
microduck-plugin   first runtime — v0 probe, not the platform
```

A joined ACN agent can have many bodies. Each body has a `kind`. Session goes to that kind's runtime. v0 drives Microduck sim; other kinds can be recorded. The Microduck runtime runs one localhost sim at a time.

ACN join does not create a body. With `EMBODY_STUDIO_URL` set, `body add --origin sim` first **joins the hosted studio** — the registry mints the body id — then instantiates it locally (without the URL the id is local-only until `embody join` adopts it; robot pair is out of this probe). Then `bind`, then `whoami`. The agent finds the Hub card; `policy attach` stores a pointer. `show` / `status` expose cards and live numbers; `push` updates a joined body on the **hosted** owner studio (`web/`). The agent replies on ACN. The web page does not drive. Local `embody studio` is a debug Show, not the product. A second kind and a train CLI stay out of this probe.

## Install

```bash
git clone https://github.com/acnlabs/embody
cd embody
python3 -m pip install -e .
```

Point `EMBODY_MICRODUCK_SKILL` at [microduck-plugin](https://github.com/acnlabs/microduck-plugin) `skills/microduck-skill`, or keep that clone next to this repo. `session start` runs `prepare` first (the runtime makes sim startable). Do not set runtime-private env such as `MICRODUCK_RL_ROOT`. Find the Hub repo yourself, then attach.

```bash
export ACN_API_KEY=acn_...          # from POST /agents/join
export EMBODY_STUDIO_URL=https://your-embody-studio.example
python3 -m embody body add --kind microduck --origin sim --name duck-1   # joins the hosted registry first
python3 -m embody bind --body duck-1
python3 -m embody whoami --body duck-1
python3 -m embody policy attach --body duck-1 --hub neil-jo/microduck-walk --as walk
python3 -m embody session start --body duck-1
python3 -m embody status
python3 -m embody push --body duck-1
# a body born without EMBODY_STUDIO_URL: python3 -m embody join --body duck-1
```

Owner studio is the hosted app in `web/` (Auth0, same tenant as ComicLaw; v0 reuses that public SPA). `cd web && npm install && npm run dev`, then open `http://localhost:3000/`. Local `python3 -m embody studio` is debug only.
