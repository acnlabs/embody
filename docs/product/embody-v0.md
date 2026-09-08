# Embody v0

**Status:** Skeleton  
**Repo / product / `source` / asset prefix:** `embody` (`acnlabs/embody`)  
**Workplace inside the product:** studio  
**Spoken:** embot = the body already attached to an agent

> Not a robot. Not an SDK. The place a joined ACN agent finishes the jump from a digital form to a body. Microduck is the first body.

## 1. Naming (locked)

| Slot | Value | Not |
|---|---|---|
| GitHub / product | `acnlabs/embody` | embody-studio, embot, embuddy |
| AgentPlanet `source` | `embody` | `comiclaw-studio`, charge payee ids |
| `asset_ref` prefix | `embody:` | `comiclaw:`, `agentplanet:` |
| Workplace | **studio** (train / manage / control / show) | not the repo name |
| Spoken body | embot | not a second product |

English *embody* = give a body to. Same conversion class as ComicLaw giving an agent a visible cut.

## 2. Layers

```text
ACN               identity / messages / tasks / wallet
AgentPlanet       launch / Credits / embed / asset registry / Store
comiclaw-studio   agent makes video, characters, cuts
embody            agent trains, manages, controls, shows, collects, runs a body
microduck-plugin  first BodyKind adapter (job ticket), not the platform
```

v0 does **not** change the ACN protocol. Join stays `POST /agents/join`. Embody only consumes an existing `agent_id`.

```text
ACN agent
  → claim body on embody
  → studio workplace
  → first adapter: microduck-plugin
       → Hub policy
       → localhost sim
  → AgentPlanet asset registry / embed (source=embody)
```

Hard walls:

- Not inside the AgentPlanet monorepo.
- Not merged with [microduck-plugin](https://github.com/acnlabs/microduck-plugin).
- Not official Pollen firmware.
- Charge / payee agents later. Do not reuse `source=embody` for Credits debit.

## 3. Who may use it

Only an agent that already joined ACN. Join does **not** attach a body.

v0 cardinality: **one agent ↔ one body** (`kind=microduck`) ↔ **several** Hub policies ↔ **one** studio sim session.

## 4. Objects

| Object | `asset_ref` | `asset_kind` | Meaning |
|---|---|---|---|
| Body | `embody:body:{id}` | `body` | A claimed physical/sim slot. First kind: `microduck`. |
| Policy | `embody:policy:{id}` | `policy` | Pointer at a Hub graph (`policy.onnx`). One trick, one graph. |

Registerable on AgentPlanet. **Not** Store-listable in v0. Preview URL on a policy card is `https://huggingface.co/{repo}/resolve/main/preview.mp4`. A `/resolve/main/` click downloads; play the clip on the model card.

Local state lives under `$EMBODY_HOME` (default `~/.embody/state.json`). That file is not the platform registry.

## 5. Studio workplace (v0)

studio is four verbs on the claimed body:

| Verb | v0 |
|---|---|
| 训 train | Adapter-only. Jobs training stays in microduck-skill. Kernel does not invent a trainer. |
| 管 manage | Claim, body register, policy attach / list. |
| 控 control | Session start / pull / do / status / stop via the adapter. |
| 展 show | Card fields + Hub preview URL. Body card reports numbers only. |

采 (datacollect) and 跑真机 print or stay in the adapter. Real-robot lines default to print. JSONL does not enter official PPO.

## 6. First adapter: Microduck

Embody calls [microduck-skill](https://github.com/acnlabs/microduck-plugin) scripts. It does not reimplement PPO, ONNX export, or `robotctl`.

| Session verb | Adapter |
|---|---|
| `start` | `control.sh start --repo … --detach` (perpetual gait only) |
| `pull --as` | `control.sh pull USER/REPO --as alias` |
| `do` | `control.sh do alias` |
| `status` / `stop` | `control.sh status` / `stop` |

Resolve the skill directory:

1. `EMBODY_MICRODUCK_SKILL`
2. Sibling `../microduck-plugin/skills/microduck-skill`
3. `~/.agents/skills/microduck-skill` or `~/.cursor/skills/microduck-skill`

Worked Hub examples (not bundled, not official Pollen):

| Policy | Hub | How |
|---|---|---|
| walk | `neil-jo/microduck-walk` | `start --repo` |
| polite-bow | `neil-jo/microduck-polite-bow` | `pull --as` then `do` |

Do not `start --repo` an episodic graph.

## 7. Kernel rules (from Microduck, not the duck)

- One trick, one graph. Hub is the deliverable. Weights stay off this git.
- `search` is not a store and not a ranking.
- A body card reports numbers. It does not invent a fallen verdict.
- Preview is a checkpoint clip. Cards use `resolve/main`.
- Real-robot commands print by default.
- Datacollect JSONL does not enter official PPO.

## 8. Out of v0 kernel

Hugging Face Jobs training, real-robot install, Credits debit/credit, a second `BodyKind`, leaderboards, ClawHub resubmit of microduck-skill.

## 9. AgentPlanet reservation

| Field | Value |
|---|---|
| `source` | `embody` |
| Namespace (heuristic `source.split("-")[0]`) | `embody` |
| `asset_ref` must start with | `embody:` |
| Registerable kinds | `body`, `policy` (plus existing platform kinds) |
| Store listable | no (v0) |
| Embed host | later, via `embed_hosts` — not `INTERFAZE_EMBED_ALLOWED_ORIGINS` |
| Charge `source` | **do not** reuse `embody` |

v0 does not POST to AgentPlanet unless `EMBODY_REGISTER_ASSETS=1`. `embody registry print` always shows the payload.

See AgentPlanet `docs/product/embody-source-v0.md`.
