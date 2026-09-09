# Embody v0

**Status:** Skeleton  
**Repo / product:** `embody` (`acnlabs/embody`)  
**Workplace:** studio

> Not a robot. Not an SDK. The place a joined ACN agent gets a body. Microduck is the first body.

## Naming

| Slot | Value |
|---|---|
| GitHub / product | `acnlabs/embody` |
| Local `asset_ref` prefix | `embody:` (this machine's ledger only) |
| Workplace | studio (train / manage / control / show) |

Do not name the repo embody-studio or embot. `embot` is spoken language for an attached body, not a second product.

## Layers

```text
ACN                identity / messages / tasks / wallet
                   whoami reads agent_id. Not a body remote.
AgentPlanet        launch / Credits / embed / Store
                   not the body ledger, not the control plane
embody             this machine: bind agent, bodies, studio session
body runtime       session verbs + Hub cards — docs/product/body-runtime-v0.md
microduck-plugin   first kind pack — not the platform
```

```text
ACN agent (identity)
  → whoami (bind this machine)
  → body add / policy attach   (local)
  → studio session             (local → kind pack → sim or later robot)
```

- Not part of the AgentPlanet monorepo.
- Not merged with [microduck-plugin](https://github.com/acnlabs/microduck-plugin).
- Not official Pollen firmware.
- Do not drive or manage a body through ACN or AgentPlanet.
- Do not debit Credits to own or move a body.

v0 does not change the ACN protocol. Join may later carry an optional public card; that is a nameplate, not a remote. Embody only consumes `agent_id` from `POST /agents/join` / `GET /agents/me`.

## Cardinality

One joined agent → many bodies. Each body → many Hub policies and its own session. Sessions are not globally exclusive.

Any slug kind can be added. Session commands dispatch by `kind`. Only `microduck` has an adapter today (`microduck-skill`). Other kinds store the body and policies; `session` fails until an adapter exists. The Microduck adapter also refuses a second localhost sim — adapter limit, not a kernel rule.

Join does not attach a body. `whoami` only binds this machine to an `agent_id`. A body is a machine type (`kind`), not a sim/real split. Sim vs robot is session `venue` — see [body-runtime-v0.md](./body-runtime-v0.md). v0 sessions are `venue=sim`.

## Objects

| Object | `asset_ref` | `asset_kind` | Meaning |
|---|---|---|---|
| Body | `embody:body:{id}` | `body` | A machine-type slot (`kind` slug). Sim and robot share this body; they are session venues. |
| Policy | `embody:policy:{id}` | `policy` | Pointer at a Hub graph (`policy.onnx`). One trick, one graph. |

These rows live in `$EMBODY_HOME` (default `~/.embody/state.json`). That file is the workplace ledger on this machine. It is not an ACN profile and not an AgentPlanet registry.

Policy preview: `https://huggingface.co/{repo}/resolve/main/preview.mp4`. A raw `/resolve/main/` click downloads; play the clip on the model card.

## Studio (v0)

| Verb | v0 |
|---|---|
| Train | Adapter only. No trainer in this kernel. |
| Manage | `whoami`, `body add` / `list`, policy attach / list. |
| Control | Session prepare / start / pull / do / status / stop per body. |
| Show | Card fields + Hub preview URL. Body card reports numbers only. |

Datacollect and real-robot lines stay in the adapter. Real-robot commands print by default. JSONL does not enter official PPO.

## Body runtime

Contract: [body-runtime-v0.md](./body-runtime-v0.md). Kernel dispatches `prepare` / `start` / `pull` / `do` / `status` / `stop` by `kind`. `start` always `prepare`s first. It does not call `control.sh` or pack env vars.

| `kind` | Pack | Session |
|---|---|---|
| `microduck` | [microduck-skill](https://github.com/acnlabs/microduck-plugin) | `prepare` → `doctor.sh --clone`; session → `control.sh` |
| anything else | none | body + cards ok; session errors |

Microduck examples (not bundled, not official Pollen): `neil-jo/microduck-walk` (`start`), `neil-jo/microduck-polite-bow` (`pull` + `do`).

## Kernel rules

See the body-runtime contract. Short form: one trick one graph; Hub delivery; search is not a store; cards report numbers; robot commands print by default.

Out of v0: Jobs training, real-robot install, Credits, a second body kind, leaderboards.

## What is not a control plane

| Layer | May do | Must not do |
|---|---|---|
| ACN | Identity. Optional later: a public nameplate that this agent has bodies. | Session verbs. Joint commands. Own the workplace ledger. |
| AgentPlanet | Launch / Credits / embed / Store. | Body title. Body remote. Charge `source=embody`. |
| embody | Bind this machine, add bodies, attach cards, drive the session. | Call ACN or AgentPlanet to start / do / stop. |

`registry print` dumps the **local** ledger. It does not POST.
