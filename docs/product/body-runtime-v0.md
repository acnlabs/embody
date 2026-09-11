# Body runtime v0

**Status:** Kernel contract  
**Used by:** studio session (`prepare` / `start` / `pull` / `do` / `status` / `stop`)  
**First implementation:** `kind=microduck` → [microduck-plugin](https://github.com/acnlabs/microduck-plugin)

Embody does not know how a robot walks. It knows how a **body** is used: identity, Hub policy pointers, and these verbs. A new machine type adds a thin **kind runtime** that implements this file. It does not copy microduck-skill. The runtime is a seam, not a plugin store.

## Layers

```text
studio / CLI
  → body runtime (this document)
       → kind runtime (microduck-skill first)
            → vendor sim / firmware
```

Kernel: agent creates a body (origin at birth), binds it, asks whoami, attaches cards, dispatches verbs.  
Kind runtime: trainer, ONNX shape, localhost control, vendor install lines.

Session verbs never go to ACN or AgentPlanet. Embody does not store ACN task ids. Hub discovery is the agent's job. This contract does not search.

## How an agent gets a body

The agent is the protagonist. Join ACN does not create a body. Origin is written at birth.

| Path | Meaning | v0 |
|---|---|---|
| Create | `body add --kind … --origin sim` — this machine opens a sim of that kind. | yes |
| Acquire | `--origin robot` — pair a physical unit. Same `kind`, not a second body. | out of probe |
| Bind | `bind` — this body ↔ this agent. | yes |
| Confirm | `whoami` — this body asks ACN who it is bound to. | yes |

Do not mint `microduck-sim` and `microduck-real` as two bodies. Same Hub cards. Session follows the body's `origin`. v0 only starts `origin=sim`.

## Policy card

One trick, one graph. Hub is the deliverable. Weights stay off embody git. The agent finds `USER/NAME`; `policy attach --hub` stores the pointer.

| Field | Contract |
|---|---|
| Artifact | `{hub}/resolve/main/policy.onnx` |
| Preview | `{hub}/resolve/main/preview.mp4` (checkpoint clip; a raw resolve click downloads) |
| Mode | `perpetual` (base / gait) or `episodic` (short trick) |

Hub is not a store. Downloads/likes are not quality.

## Session verbs

Studio always uses these names. Missing verb → adapter error, not a kernel fallback.

| Verb | Meaning | Perpetual | Episodic |
|---|---|---|---|
| `prepare` | Make `origin=sim` startable on this machine. No-op if already ready. Not train, not cloud sim, not robot pair. | required | required |
| `start` | Kernel calls `prepare` first. Then open a session on this body's origin (v0: `sim`) using a perpetual card | required | refuse |
| `pull` | Load a named card into the running session | optional | required before `do` |
| `do` | Fire a named episodic card | n/a | required |
| `status` | Numbers only (`tilt`, feet, joints, …). Kernel lifts runtime JSON as `show.numbers`. No fallen verdict | required | required |
| `stop` | End this body's session | required | required |

`prepare` failed → do not `start`. The kernel never reads runtime-private paths (no `MICRODUCK_RL_ROOT` in embody). A runtime may set those only inside its process, including on later verbs (`pull` / `do` / `stop` are new CLI processes). A runtime may run a broader doctor; `prepare` succeeds when **sim is startable**, not when train/Jobs env is complete.

Many bodies may have sessions at once. A runtime may refuse a second session **of its own kind**. That is not a global lock.

Real-robot install is not a session verb. Runtimes may print vendor commands after publish. They run those commands only when a human owns that machine and asked.

Datacollect JSONL is not training input unless that runtime says so.

## Kind runtime

A runtime registers `kind` → adapter id and implements the verbs. v0 table:

| `kind` | Runtime | Notes |
|---|---|---|
| `microduck` | microduck-skill | `prepare` → `doctor.sh --clone` then adopt default checkout; `stop` → `control.sh shutdown`; other verbs → `control.sh`; one localhost sim |
| other slugs | none | Body and cards may exist; session errors |

Do not lift into the kernel: observation/action size, PPO, Jobs, `robotctl`, Viser, joint indices, Hub search.

## Out of this contract

Train, smoke, export, Hub upload, preview record, deploy print, Hub search. Those stay in the kind runtime or with the agent (or never exist). Embody does not invent a trainer or a catalog.
