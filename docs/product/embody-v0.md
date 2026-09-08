# Embody v0

**Status:** Skeleton  
**Repo / product / `source` / asset prefix:** `embody` (`acnlabs/embody`)  
**Workplace:** studio

> Not a robot. Not an SDK. The place a joined ACN agent gets a body. Microduck is the first body.

## Naming

| Slot | Value |
|---|---|
| GitHub / product | `acnlabs/embody` |
| AgentPlanet `source` | `embody` |
| `asset_ref` prefix | `embody:` |
| Workplace | studio (train / manage / control / show) |

Do not name the repo embody-studio or embot. `embot` is spoken language for an attached body, not a second product.

v0 does not change the ACN protocol. Embody only consumes an `agent_id` from `POST /agents/join`.

## Layers

```text
ACN                identity / messages / tasks / wallet
AgentPlanet        launch / Credits / embed / asset registry
embody             claim a body, attach Hub policies, run a studio session
microduck-plugin   first body adapter — not this platform
```

```text
ACN agent
  → claim on embody
  → studio
  → microduck-plugin
       → Hub policy
       → localhost sim
  → AgentPlanet registry (source=embody)
```

- Not part of the AgentPlanet monorepo.
- Not merged with [microduck-plugin](https://github.com/acnlabs/microduck-plugin).
- Not official Pollen firmware.
- Do not debit Credits with `source=embody`.

## Cardinality

One joined agent ↔ one body (`kind=microduck`) ↔ several Hub policies ↔ one studio sim session.

Join does not attach a body.

## Objects

| Object | `asset_ref` | `asset_kind` | Meaning |
|---|---|---|---|
| Body | `embody:body:{id}` | `body` | Claimed sim/hardware slot. First kind: `microduck`. |
| Policy | `embody:policy:{id}` | `policy` | Pointer at a Hub graph (`policy.onnx`). One trick, one graph. |

Registerable on AgentPlanet. Not Store-listable in v0. Policy preview: `https://huggingface.co/{repo}/resolve/main/preview.mp4`. A raw `/resolve/main/` click downloads; play the clip on the model card.

Local state: `$EMBODY_HOME` (default `~/.embody/state.json`). That file is not the platform registry.

## Studio (v0)

| Verb | v0 |
|---|---|
| Train | Adapter only. No trainer in this kernel. |
| Manage | Claim, body register, policy attach / list. |
| Control | Session start / pull / do / status / stop via the adapter. |
| Show | Card fields + Hub preview URL. Body card reports numbers only. |

Datacollect and real-robot lines stay in the adapter. Real-robot commands print by default. JSONL does not enter official PPO.

## First adapter: Microduck

Embody calls [microduck-skill](https://github.com/acnlabs/microduck-plugin) scripts. It does not reimplement PPO, ONNX export, or `robotctl`.

| Session | Adapter |
|---|---|
| `start` | `control.sh start --repo … --detach` (perpetual only) |
| `pull --as` | `control.sh pull USER/REPO --as alias` |
| `do` | `control.sh do alias` |
| `status` / `stop` | `control.sh status` / `stop` |

Skill path: `EMBODY_MICRODUCK_SKILL`, then sibling `../microduck-plugin/skills/microduck-skill`, then `~/.agents/skills/microduck-skill` or `~/.cursor/skills/microduck-skill`.

| Policy | Hub | How |
|---|---|---|
| walk | `neil-jo/microduck-walk` | `start --repo` |
| polite-bow | `neil-jo/microduck-polite-bow` | `pull --as` then `do` |

Do not `start --repo` an episodic graph. These Hub graphs are not bundled and not official Pollen weights.

## Kernel rules

- One trick, one graph. Hub is the deliverable. Weights stay off this git.
- `search` is not a store and not a ranking.
- A body card reports numbers. It does not invent a fallen verdict.
- Preview is a checkpoint clip. Cards use `resolve/main`.
- Real-robot commands print by default.
- Datacollect JSONL does not enter official PPO.

Out of v0: Jobs training, real-robot install, Credits, a second body kind, leaderboards.

## AgentPlanet reservation

| Field | Value |
|---|---|
| `source` | `embody` |
| `asset_ref` | must start with `embody:` |
| Registerable kinds | `body`, `policy` |
| Store listable | no (v0) |
| Embed host | later, via `embed_hosts` |
| Charge `source` | do not reuse `embody` |

`embody registry print` shows the payload. v0 does not POST unless that flow is enabled later.

See AgentPlanet `docs/product/embody-source-v0.md`.
