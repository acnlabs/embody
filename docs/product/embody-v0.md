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
embody             bind agent, many bodies, studio, registry payload
body runtime       session verbs + Hub cards — docs/product/body-runtime-v0.md
microduck-plugin   first kind pack — not the platform
```

```text
ACN agent
  → whoami (bind this machine)
  → body add (many kinds)
  → studio session (runtime verbs)
  → kind pack (microduck-skill today)
       → Hub policy
       → localhost sim
  → AgentPlanet registry (source=embody)
```

- Not part of the AgentPlanet monorepo.
- Not merged with [microduck-plugin](https://github.com/acnlabs/microduck-plugin).
- Not official Pollen firmware.
- Do not debit Credits with `source=embody`.

## Cardinality

One joined agent → many bodies. Each body → many Hub policies and its own session. Sessions are not globally exclusive.

Any slug kind can be added. Session commands dispatch by `kind`. Only `microduck` has an adapter today (`microduck-skill`). Other kinds store the body and policies; `session` fails until an adapter exists. The Microduck adapter also refuses a second localhost sim — adapter limit, not a kernel rule.

Join does not attach a body. `whoami` only binds this machine to an `agent_id`. A body is a machine type (`kind`), not a sim/real split. Sim vs robot is session `venue` — see [body-runtime-v0.md](./body-runtime-v0.md). v0 sessions are `venue=sim`.

## Objects

| Object | `asset_ref` | `asset_kind` | Meaning |
|---|---|---|---|
| Body | `embody:body:{id}` | `body` | A machine-type slot (`kind` slug). Sim and robot share this body; they are session venues. |
| Policy | `embody:policy:{id}` | `policy` | Pointer at a Hub graph (`policy.onnx`). One trick, one graph. |

Registerable on AgentPlanet. Not Store-listable in v0. Policy preview: `https://huggingface.co/{repo}/resolve/main/preview.mp4`. A raw `/resolve/main/` click downloads; play the clip on the model card.

Local state: `$EMBODY_HOME` (default `~/.embody/state.json`). That file is not the platform registry.

## Studio (v0)

| Verb | v0 |
|---|---|
| Train | Adapter only. No trainer in this kernel. |
| Manage | `whoami`, `body add` / `list`, policy attach / list. |
| Control | Session start / pull / do / status / stop per body. |
| Show | Card fields + Hub preview URL. Body card reports numbers only. |

Datacollect and real-robot lines stay in the adapter. Real-robot commands print by default. JSONL does not enter official PPO.

## Body runtime

Contract: [body-runtime-v0.md](./body-runtime-v0.md). Kernel dispatches `start` / `pull` / `do` / `status` / `stop` by `kind`. It does not call `control.sh`.

| `kind` | Pack | Session |
|---|---|---|
| `microduck` | [microduck-skill](https://github.com/acnlabs/microduck-plugin) | pack maps verbs → `control.sh` |
| anything else | none | body + cards ok; session errors |

Microduck examples (not bundled, not official Pollen): `neil-jo/microduck-walk` (`start`), `neil-jo/microduck-polite-bow` (`pull` + `do`).

## Kernel rules

See the body-runtime contract. Short form: one trick one graph; Hub delivery; search is not a store; cards report numbers; robot commands print by default.

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
