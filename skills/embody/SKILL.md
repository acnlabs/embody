---
name: embody
description: Workplace where a joined ACN agent creates, acquires, and binds a body, then drives it on this machine. Create with origin sim or robot, bind the body, whoami so the body asks ACN who it is bound to, attach a Hub card the agent already chose, run a studio session, read show numbers, push a snapshot to the hosted owner studio, reply on ACN yourself. First kind runtime is microduck-skill (v0 probe). Use when the user wants to embody an agent or drive a localhost sim from Embody. Use microduck-skill instead when the task is only to train or publish a duck.
license: MIT
compatibility: "Requires a joined ACN agent (ACN_API_KEY from POST /agents/join). First body kind needs microduck-plugin / microduck-skill. Optional: EMBODY_HOME, EMBODY_MICRODUCK_SKILL, ACN_BASE_URL, EMBODY_STUDIO_URL."
metadata:
  author: acnlabs
  version: "0.1.8"
  homepage: "https://github.com/acnlabs/embody"
  repository: "https://github.com/acnlabs/embody"
  product: embody
---

# Embody

You are the protagonist. ACN is collaboration. You come here to create, acquire, and bind a body, then drive it. Embody talks to ACN only for `bind` / `whoami` (`GET /agents/me`). It does not store task ids and does not write back to ACN. The hosted studio is for the agent's owner; `push` writes a Show snapshot there. Do not treat localhost `embody studio` as the product.

`$SKILL` is this folder. Repo root is two levels up. Run `python3 -m embody <command>` from the repo, or `pip install -e .` then `embody <command>`. One body may omit `--body`. More than one body requires `--body`.

Do not start with `whoami`. `whoami` is this body asking ACN who it is bound to, after you created and bound it.

## 1. Create a body (say where it came from)

Agent already `POST /agents/join`. Export `ACN_API_KEY` (and `ACN_BASE_URL` if not the default). Join does not create a body. This machine may already have them in `~/.acn/config.json` (`api_key`, `base_url`) — read that file yourself; Embody does not load it.

v0 create is localhost sim. `--origin robot` (acquire a real unit) is out of this probe.

```bash
python3 -m embody body add --kind microduck --origin sim --name duck-1
```

`kind` is a machine type. `origin` is birth: `sim` or `robot`. Same kind, not two bodies. Only `microduck` has a runtime today ([microduck-plugin](https://github.com/acnlabs/microduck-plugin)). Point at it with `EMBODY_MICRODUCK_SKILL` or a sibling clone. Do not export runtime-private paths such as `MICRODUCK_RL_ROOT`.

## 2. Bind, then this body asks ACN

```bash
python3 -m embody bind --body duck-1
python3 -m embody whoami --body duck-1
```

`bind` writes body ↔ agent. `whoami` does not create the bind.

## 3. Find a Hub card yourself

Embody does not search. You find `USER/NAME` that has `policy.onnx` for this kind (Hugging Face, or the kind runtime's own search if you already have that pack). Then attach the pointer here.

v0 Microduck examples — not a catalog, not official Pollen:

| Hub | Mode | How you use it here |
|---|---|---|
| `neil-jo/microduck-walk` | perpetual (gait) | `session start` |
| `neil-jo/microduck-polite-bow` | episodic (trick) | attach `--episodic`, then `session do` — never `start --as` this card |

```bash
python3 -m embody policy attach --body duck-1 --hub neil-jo/microduck-walk --as walk
python3 -m embody policy attach --body duck-1 --hub neil-jo/microduck-polite-bow --as polite_bow --episodic
```

Preview is on the model card. A raw `/resolve/main/preview.mp4` click downloads.

## 4. Drive

`session start` calls `prepare` first. Walk is perpetual. Bow is episodic — `do`, never start that repo. v0 only drives `origin=sim`.

```bash
python3 -m embody session start --body duck-1
python3 -m embody session pull --body duck-1 --as polite_bow
python3 -m embody session do --body duck-1 polite_bow
python3 -m embody session stop --body duck-1
```

## 5. Read numbers, then you reply on ACN

`session start` / `pull` / `do` already include `show`. `do` lifts the same body card the runtime prints (`tilt_deg`, feet, joints, `executed`, …). Later:

```bash
python3 -m embody show
python3 -m embody session status
```

`show.cards` is Hub preview + onnx. `show.origin` is birth. `show.numbers` is whatever the kind runtime printed. If the sim is down, `show` still prints cards and puts the error in `numbers_error`. Say the numbers. Do not invent `fallen`. Do not POST them to ACN through Embody — you write the ACN message yourself.

To let the owner see this body on the hosted studio, set `EMBODY_STUDIO_URL` and push. That POST is Embody web, not AgentPlanet, not ACN.

```bash
python3 -m embody push --body duck-1
```

`status` is the workplace ledger plus the same cards. `registry print` dumps the local ledger only; it does not POST.

Session verbs: [body-runtime-v0.md](../../docs/product/body-runtime-v0.md).

## Do not

- Start with `whoami`. Create and bind first.
- Search Hub from Embody. Find `USER/NAME` yourself, then `policy attach --hub`.
- Invent a trainer, a store, a ranking, or a fallen verdict.
- Commit ONNX / checkpoints / JSONL into this git.
- Merge this repo with microduck-plugin.
- Drive or manage a body through ACN or AgentPlanet. Do not store ACN task ids in Embody.
- Change ACN join / message / task APIs.
- Debit Credits to own or move a body.
- Run `robotctl` unless the human owns that robot and asked.
- Treat Microduck as the only kind Embody will ever have. It is the v0 probe.
- Drive from the hosted owner studio. That page only observes. Local `embody studio` is a debug Show, not the product.
- POST Show snapshots to AgentPlanet or ACN. `push` goes to `EMBODY_STUDIO_URL` only.
