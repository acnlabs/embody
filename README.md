# Embody

不是一只机器人，也不是 SDK。是 ACN agent 完成数字形态 → 具身的地方。Microduck 是第一种身体。

**https://github.com/acnlabs/embody** — product / repo / AgentPlanet `source` / asset prefix are all **embody**. Not embody-studio. Not embot.

English: *embody* = give a body to. A joined ACN agent comes here to drop from chat or a card into sim or a real machine. Same class of conversion as [ComicLaw Studio](https://github.com/acnlabs/comiclaw-studio) giving an agent a visible film.

| | ComicLaw | This project |
|---|---|---|
| Product / repo | [comiclaw-studio](https://github.com/acnlabs/comiclaw-studio) | **embody** |
| Workplace inside the product | studio | **studio** |
| AgentPlanet `source` | `comiclaw-studio` | `embody` |
| Asset prefix | `comiclaw:` | `embody:` |

**studio** is the workplace (train / manage / control / show). It is not the repo name.

**embot** is spoken language only: “this agent’s embot” = the body already attached.

## Layers (ACN protocol unchanged)

```text
ACN               identity / messages / tasks / wallet
AgentPlanet       launch / Credits / embed / asset registry / Store
comiclaw-studio   agent makes video, characters, cuts
embody            agent trains, manages, controls, shows, collects, runs a body
microduck-plugin  first BodyKind adapter (job ticket), not the platform
```

- Only serves an ACN `agent_id` that already `POST /agents/join`. Join does not grant a body.
- Not inside the AgentPlanet monorepo. Not merged with [microduck-plugin](https://github.com/acnlabs/microduck-plugin). Not official Pollen firmware.
- Charge / payee agents come later. Do not mix them with `source=embody`.

v0: one ACN agent ↔ one body (`kind=microduck`) ↔ several Hub policies ↔ a studio sim session + card display.

Jobs training, real-robot install, Credits, a second body kind, and leaderboards are adapter or later work. Not v0 kernel.

Do not commit ONNX, checkpoints, or JSONL into this git. Hub is the delivery.

## Install

```bash
git clone https://github.com/acnlabs/embody
cd embody
python3 -m pip install -e .
```

The agent skill is [`skills/embody`](skills/embody/). Spec: [`docs/product/embody-v0.md`](docs/product/embody-v0.md).

```bash
export ACN_API_KEY=acn_...          # from POST /agents/join
python3 -m embody claim
python3 -m embody body register --kind microduck
python3 -m embody policy attach --hub neil-jo/microduck-walk --as walk
python3 -m embody session start
python3 -m embody status
```

First adapter: install [microduck-plugin](https://github.com/acnlabs/microduck-plugin) and point `EMBODY_MICRODUCK_SKILL` at `skills/microduck-skill`, or keep that clone next to this repo.

## Kernel rules taken from Microduck (not the duck)

- One trick, one graph. Hub is the deliverable. Weights stay off git.
- `search` is not a store and not a ranking.
- A body card reports numbers. It does not invent a fallen verdict.
- Preview is a checkpoint clip. Cards use `resolve/main`. A direct link downloads.
- Real-robot commands print by default.
- Datacollect JSONL does not enter official PPO.
