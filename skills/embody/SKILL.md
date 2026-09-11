---
name: embody
description: Workplace for a joined ACN agent to acquire, bind, manage, and control a body on this machine. Bind with whoami, attach a Hub card the agent already chose, drive a studio session, read show/status numbers, then reply on ACN yourself. First kind runtime is microduck-skill (v0 probe). Use when the user wants to embody an agent or drive a localhost sim from Embody. Use microduck-skill instead when the task is only to train or publish a duck.
license: MIT
compatibility: "Requires a joined ACN agent (ACN_API_KEY from POST /agents/join). First body kind needs microduck-plugin / microduck-skill. Optional: EMBODY_HOME, EMBODY_MICRODUCK_SKILL, ACN_BASE_URL."
metadata:
  author: acnlabs
  version: "0.1.4"
  homepage: "https://github.com/acnlabs/embody"
  repository: "https://github.com/acnlabs/embody"
  product: embody
---

# Embody

You are the stitch. ACN is collaboration. This machine is the body. Embody talks to ACN only for `whoami` (`GET /agents/me`). It does not store task ids and does not write back to ACN.

`$SKILL` is this folder. Repo root is two levels up. Run `python3 -m embody <command>` from the repo, or `pip install -e .` then `embody <command>`. One body may omit `--body`. More than one body requires `--body`.

## 1. Bind this machine

Agent already `POST /agents/join`. Export `ACN_API_KEY`. Join does not attach a body.

```bash
python3 -m embody whoami
```

## 2. Record a body

```bash
python3 -m embody body add --kind microduck --name duck-1
```

`kind` is a machine type. Only `microduck` has a runtime today ([microduck-plugin](https://github.com/acnlabs/microduck-plugin)). Point at it with `EMBODY_MICRODUCK_SKILL` or a sibling clone. Do not export runtime-private paths such as `MICRODUCK_RL_ROOT`. Other kinds may be recorded; session waits until a runtime exists.

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

`session start` calls `prepare` first. Walk is perpetual. Bow is episodic — `do`, never start that repo.

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

`show.cards` is Hub preview + onnx. `show.numbers` is whatever the kind runtime printed. If the sim is down, `show` still prints cards and puts the error in `numbers_error`. Say the numbers. Do not invent `fallen`. Do not POST them to ACN through Embody — you write the ACN message yourself.

`status` is the workplace ledger plus the same cards. `registry print` dumps the local ledger only; it does not POST.

Session verbs: [body-runtime-v0.md](../../docs/product/body-runtime-v0.md).

## Do not

- Search Hub from Embody. Find `USER/NAME` yourself, then `policy attach --hub`.
- Invent a trainer, a store, a ranking, or a fallen verdict.
- Commit ONNX / checkpoints / JSONL into this git.
- Merge this repo with microduck-plugin.
- Drive or manage a body through ACN or AgentPlanet. Do not store ACN task ids in Embody.
- Change ACN join / message / task APIs.
- Debit Credits to own or move a body.
- Run `robotctl` unless the human owns that robot and asked.
- Treat Microduck as the only kind Embody will ever have. It is the v0 probe.
