# Body runtime v0

**Status:** Kernel contract  
**Used by:** studio session (`start` / `pull` / `do` / `status` / `stop`)  
**First implementation:** `kind=microduck` → [microduck-plugin](https://github.com/acnlabs/microduck-plugin)

Embody does not know how a robot walks. It knows how a **body** is used: identity, Hub policy cards, and these verbs. A new machine adds a thin pack that implements this file. It does not copy microduck-skill.

## Layers

```text
studio / CLI
  → body runtime (this document)
       → kind pack (microduck-skill, later others)
            → vendor sim / firmware
```

Kernel: bind agent, many bodies, attach cards, dispatch verbs, print AgentPlanet payload.  
Kind pack: trainer, ONNX shape, localhost control, vendor install lines.

## How an agent gets a body

Join ACN does not attach a body. `whoami` only binds this machine to an `agent_id`.

| Path | Meaning |
|---|---|
| Sim slot | `body add --kind …` — record a body of that machine type. Studio can open a sim session. |
| Real machine | Pair later: this physical unit belongs to the agent. Same body, not a second `kind`. |

Do not mint `microduck-sim` and `microduck-real` as two bodies. Same Hub cards run on both venues.

## Body vs venue

| Term | Meaning |
|---|---|
| `body` | Machine type identity (`kind=microduck`, …). One agent may have many. |
| `venue` | Where this session runs: `sim` or `robot`. |

v0 CLI sessions are `venue=sim`. `venue=robot` is in the contract; packs still print install lines by default and do not run them unless a human owns that machine and asked.

## Policy card

One trick, one graph. Hub is the deliverable. Weights stay off embody git.

| Field | Contract |
|---|---|
| Artifact | `{hub}/resolve/main/policy.onnx` |
| Preview | `{hub}/resolve/main/preview.mp4` (checkpoint clip; a raw resolve click downloads) |
| Mode | `perpetual` (base / gait) or `episodic` (short trick) |

`search` lists Hub cards. It is not a store and not a ranking.

## Session verbs

Studio always uses these names. Missing verb → adapter error, not a kernel fallback.

| Verb | Meaning | Perpetual | Episodic |
|---|---|---|---|
| `start` | Open a session on this body (`venue=sim` today) using a perpetual card | required | refuse |
| `pull` | Load a named card into the running session | optional | required before `do` |
| `do` | Fire a named episodic card | n/a | required |
| `status` | Numbers only (`tilt`, feet, joints, …). No fallen verdict | required | required |
| `stop` | End this body's session | required | required |

Many bodies may have sessions at once. An adapter may refuse a second session **of its own kind**. That is not a global lock.

Real-robot install is not a session verb. Packs may print vendor commands after publish. They run those commands only when a human owns that machine and asked.

Datacollect JSONL is not training input unless that pack says so.

## Kind pack

A pack registers `kind` → adapter id and implements the verbs. v0 table:

| `kind` | Pack | Notes |
|---|---|---|
| `microduck` | microduck-skill | `control.sh`; one localhost sim |
| other slugs | none | Body and cards may exist; session errors |

Do not lift into the kernel: observation/action size, PPO, Jobs, `robotctl`, Viser, joint indices.

## Out of this contract

Train, smoke, export, Hub upload, preview record, deploy print. Those stay in the pack (or never exist). Embody does not invent a trainer.
