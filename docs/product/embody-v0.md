# Embody v0

**Status:** Skeleton  
**Repo / product:** `embody` (`acnlabs/embody`)  
**Workplace:** studio

> Not a robot. Not an SDK. The workplace where a joined ACN agent acquires, binds, trains, manages, and controls bodies — sim and real — and uses them in physical-world tasks.

**North star:** any machine type, sim and robot, train and drive. The **agent** then uses that body while collaborating on ACN.  
**v0 probe:** one kind (`microduck`), localhost sim, attach + session. Not the product boundary.

## Naming

| Slot | Value |
|---|---|
| GitHub / product | `acnlabs/embody` |
| Local `asset_ref` prefix | `embody:` (this machine's ledger only) |
| Workplace | studio (acquire / bind / train / manage / control / show) |

Do not name the repo embody-studio or embot. `embot` is spoken language for an attached body, not a second product.

## Effect

The **agent** is the protagonist. It comes to Embody to **create, acquire, and bind** a body, then train / manage / control it. The same agent collaborates on ACN. Embody talks to ACN only for bind / `whoami` (`/agents/me`). They do not talk about tasks or control.

```text
ACN  ←→  agent  ←→  body on this machine (Embody)
     tasks, collab      create / bind / drive
```

```text
agent arrives
  → create (sim) or acquire (robot) a body — origin is written on the body
  → bind that body to the agent
  → that body whoami: asks ACN who it is bound to
  → attach cards, drive, read numbers; agent replies on ACN
```

The agent is the only stitch between collaboration and the body. Embody does not store task ids, fetch work, or write back to ACN. ACN does not send joint commands.

## Layers

```text
ACN                  identity / messages / tasks / wallet
                     collaboration. bind / whoami read agent_id. Not a body remote.
AgentPlanet          launch / Credits / embed / Store
                     not the body ledger, not the control plane
                     owner login may read my-agents (who owns which agent)
embody CLI           workplace on this machine
                     acquire / bind / train / manage / control
embody web           hosted owner studio (Auth0, same tenant as ComicLaw)
                     observe rooms. Agent push writes snapshots here.
kind runtime         how this machine type trains and moves
                     first: microduck-skill — not the platform
Hub                  weights. Agent finds the card. attach stores a pointer.
```

```text
ACN agent (protagonist)
  → body add --origin sim      (create; robot acquire is out of this probe)
  → bind                       (this body ↔ this agent)
  → whoami                     (this body asks ACN who it is bound to)
  → agent finds a Hub card
  → policy attach              (local)
  → studio session             (local → kind runtime; origin=sim)
```

The hosted page is the product surface for the **agent's owner**. It is not a localhost HTTP. Local `embody studio` is a debug Show only. Login is Auth0 on the same tenant as ComicLaw / AgentPlanet (`audience=https://api.agentplanet.org`). v0 reuses ComicLaw's public SPA client and `/auth/callback` so the owner uses the same door. Owner identity may read AgentPlanet `my-agents`. Body snapshots stay on Embody web.

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

Join does not create or attach a body. The agent creates or acquires one first; `origin` is `sim` or `robot` at birth. Same `kind`, not `microduck-sim` / `microduck-real`. `bind` writes body ↔ agent. `whoami` is that body asking ACN. v0 create is `--origin sim` only. See [body-runtime-v0.md](./body-runtime-v0.md).

## Objects

| Object | `asset_ref` | `asset_kind` | Meaning |
|---|---|---|---|
| Body | `embody:body:{id}` | `body` | A machine-type slot (`kind` + `origin`). Sim and robot are birth origin, not two kinds. |
| Policy | `embody:policy:{id}` | `policy` | Pointer at a Hub graph (`policy.onnx`). One trick, one graph. |

These rows live in `$EMBODY_HOME` (default `~/.embody/state.json`) on the machine that drives. That file is the workplace ledger. It is not an ACN profile and not an AgentPlanet registry. The hosted studio keeps **observation snapshots** the agent `push`es; that copy is Embody's own, not AgentPlanet.

Policy preview: `https://huggingface.co/{repo}/resolve/main/preview.mp4`. A raw `/resolve/main/` click downloads; play the clip on the model card. The agent finds the Hub repo; Embody does not search.

## Studio

| Verb | North star | v0 probe |
|---|---|---|
| Acquire | Create a sim or later acquire a real unit | `body add --origin sim` (robot pair out of probe) |
| Bind | This body ↔ this agent; body asks ACN | `bind`, then `whoami` |
| Train | Studio verb; the kind runtime trains (no generic PPO in the kernel) | Runtime only. No `train` in this kernel. |
| Manage | Many bodies, many cards, venues | `body` / `policy` list, attach |
| Control | Session on the body's origin | `prepare` / `start` / `pull` / `do` / `status` / `stop` (v0: `origin=sim`) |
| Show | Card + numbers | CLI `show` / `status`. Agent `push`es a snapshot to hosted owner studio (`web/`). Hub preview + onnx; live `numbers` pass through. No fallen verdict. Agent drives and replies on ACN. Local `embody studio` is debug only. |

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

Out of this probe: Jobs training CLI, real-robot pair, Credits, a second body kind, leaderboards, Hub search in Embody, any Embody↔ACN task pipe.

## What is not a control plane

| Layer | May do | Must not do |
|---|---|---|
| ACN | Identity, tasks, collaboration with the **agent**. Optional later: a public nameplate. | Session verbs. Joint commands. Own the workplace ledger. Talk to the body. |
| AgentPlanet | Launch / Credits / embed / Store. Owner identity: `my-agents`. | Body title. Body remote. Charge `source=embody`. Receive body POSTs. |
| embody CLI | Create / bind / drive on this machine. `push` a Show snapshot to Embody web. | Call ACN about tasks. Store task ids. Search Hub. Bind the laptop instead of the body. POST the AgentPlanet registry. |
| embody web | Hosted owner rooms. Auth0 (same tenant as ComicLaw). Accept agent `push`. | Session verbs. Hub search. Credits. Interfaze (until embed_hosts). Localhost-as-product. |
| kind runtime | Train and move this machine type. | Become the platform. Rank Hub cards for the workplace. |

`registry print` dumps the **local** ledger. It does not POST. `push` writes to **Embody web**, not AgentPlanet.
