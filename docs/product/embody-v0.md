# Embody v0

**Status:** Skeleton  
**Repo / product:** `embody` (`acnlabs/embody`)  
**Workplace:** studio

> Not a robot. Not an SDK. The workplace where a joined ACN agent acquires, binds, trains, manages, and controls bodies — sim and real — and uses them in physical-world tasks.

**North star:** any machine type, sim and robot, train and drive, then act on ACN tasks.  
**v0 probe:** one kind (`microduck`), localhost sim, attach + session. Not the product boundary.

## Naming

| Slot | Value |
|---|---|
| GitHub / product | `acnlabs/embody` |
| Local `asset_ref` prefix | `embody:` (this machine's ledger only) |
| Workplace | studio (acquire / bind / train / manage / control / show) |

Do not name the repo embody-studio or embot. `embot` is spoken language for an attached body, not a second product.

## Effect

An agent uses Embody to **get, bind, train, manage, and control** bodies of various kinds (simulation and real machines), and through those bodies take part in physical-world work and collaboration.

```text
ACN task / message     →  agent decides
Embody on this machine →  that body moves (sim or robot)
status numbers         →  agent replies on ACN
```

Embody does not forward ACN. ACN does not remote the body. The body is the actuator.

## Layers

```text
ACN                  identity / messages / tasks / wallet
                     collaboration. whoami reads agent_id. Not a body remote.
AgentPlanet          launch / Credits / embed / Store
                     not the body ledger, not the control plane
embody               workplace on this machine
                     acquire / bind / train / manage / control
kind runtime         how this machine type trains and moves
                     first: microduck-skill — not the platform
Hub                  weights. Agent finds the card. attach stores a pointer.
```

```text
ACN agent (identity)
  → whoami (bind this machine)
  → agent finds a Hub card
  → body add / policy attach   (local)
  → studio session             (local → kind runtime → sim or later robot)
```

- Not part of the AgentPlanet monorepo.
- Not merged with [microduck-plugin](https://github.com/acnlabs/microduck-plugin).
- Not official Pollen firmware.
- Do not drive or manage a body through ACN or AgentPlanet.
- Do not debit Credits to own or move a body.
- Do not turn Embody into a Hub catalog or a robot SDK.

v0 does not change the ACN protocol. Join may later carry an optional public card; that is a nameplate, not a remote. Embody only consumes `agent_id` from `POST /agents/join` / `GET /agents/me`.

## Cardinality

One joined agent → many bodies. Each body → many Hub policies and its own session. Sessions are not globally exclusive.

A body has a `kind` (machine type). Session verbs dispatch to that kind's **runtime**. The runtime is a seam so a second machine does not copy Microduck into the kernel. It is not a plugin store. v0 ships one runtime: `microduck` → [microduck-skill](https://github.com/acnlabs/microduck-plugin). Other slugs may be recorded; session errors until a runtime exists. The Microduck runtime also refuses a second localhost sim — runtime limit, not a kernel rule.

Join does not attach a body. `whoami` only binds this machine to an `agent_id`. A body is a machine type (`kind`), not a sim/real split. Sim vs robot is session `venue` — see [body-runtime-v0.md](./body-runtime-v0.md). v0 sessions are `venue=sim`.

## Objects

| Object | `asset_ref` | `asset_kind` | Meaning |
|---|---|---|---|
| Body | `embody:body:{id}` | `body` | A machine-type slot (`kind` slug). Sim and robot share this body; they are session venues. |
| Policy | `embody:policy:{id}` | `policy` | Pointer at a Hub graph (`policy.onnx`). One trick, one graph. |

These rows live in `$EMBODY_HOME` (default `~/.embody/state.json`). That file is the workplace ledger on this machine. It is not an ACN profile and not an AgentPlanet registry.

Policy preview: `https://huggingface.co/{repo}/resolve/main/preview.mp4`. A raw `/resolve/main/` click downloads; play the clip on the model card. The agent finds the Hub repo; Embody does not search.

## Studio

| Verb | North star | v0 probe |
|---|---|---|
| Acquire | Add a kind, hang a Hub card, later pair a real unit | `body add`, `policy attach` |
| Bind | This machine ↔ agent; this robot ↔ body | `whoami` |
| Train | Studio verb; the kind runtime trains (no generic PPO in the kernel) | Runtime only. No `train` in this kernel. |
| Manage | Many bodies, many cards, venues | `body` / `policy` list, attach |
| Control | Session on sim or robot | `prepare` / `start` / `pull` / `do` / `status` / `stop` (`venue=sim`) |
| Show | Card + numbers | Hub preview URL; body card reports numbers only |

Datacollect and real-robot lines stay in the kind runtime. Real-robot commands print by default. JSONL does not enter official PPO.

## Kind runtime

Contract: [body-runtime-v0.md](./body-runtime-v0.md). Kernel dispatches `prepare` / `start` / `pull` / `do` / `status` / `stop` by `kind`. `start` always `prepare`s first. It does not call vendor scripts or runtime-private env. It does not search Hub.

| `kind` | Runtime | v0 |
|---|---|---|
| `microduck` | [microduck-skill](https://github.com/acnlabs/microduck-plugin) | `prepare` → `doctor.sh --clone`; session → `control.sh` |
| anything else | none | body + cards ok; session errors |

Microduck examples (not bundled, not official Pollen): `neil-jo/microduck-walk` (`start`), `neil-jo/microduck-polite-bow` (`pull` + `do`).

## Kernel rules

One trick, one graph. Hub delivery. Agent finds the card. Cards report numbers. Robot commands print by default. A second kind is a new runtime, not a kernel feature.

Out of this probe: Jobs training CLI, real-robot pair, Credits, a second body kind, leaderboards, Hub search in Embody.

## What is not a control plane

| Layer | May do | Must not do |
|---|---|---|
| ACN | Identity, tasks, collaboration. Optional later: a public nameplate. | Session verbs. Joint commands. Own the workplace ledger. |
| AgentPlanet | Launch / Credits / embed / Store. | Body title. Body remote. Charge `source=embody`. |
| embody | Acquire / bind / train (dispatch) / manage / control on this machine. | Call ACN or AgentPlanet to start / do / stop. Search Hub. |
| kind runtime | Train and move this machine type. | Become the platform. Rank Hub cards for the workplace. |

`registry print` dumps the **local** ledger. It does not POST.
