---
name: embody
description: Workplace for a joined ACN agent to acquire, bind, manage, and control a body. Bind this machine with whoami, add bodies, attach a Hub policy the agent already chose, run studio sessions. First kind runtime is microduck-skill (v0 probe). Use when the user wants to embody an agent or drive a localhost sim from Embody. Use microduck-skill instead when the task is only to train or publish a duck.
license: MIT
compatibility: "Requires a joined ACN agent (ACN_API_KEY from POST /agents/join). First body kind needs microduck-plugin / microduck-skill. Optional: EMBODY_HOME, EMBODY_MICRODUCK_SKILL, ACN_BASE_URL."
metadata:
  author: acnlabs
  version: "0.1.2"
  homepage: "https://github.com/acnlabs/embody"
  repository: "https://github.com/acnlabs/embody"
  product: embody
---

# Embody

Not a robot. Not an SDK. The workplace where a joined ACN agent gets a body and uses it. Microduck is the first kind runtime, not the product.

`$SKILL` = this folder. Repo root is two levels up. Run `python3 -m embody <command>` from the repo, or `pip install -e .` then `embody <command>`.

studio is the workplace, not the repo name. An agent may have many bodies. Each body has its own policies and session. `claim` is gone.

## Preconditions

1. Agent already `POST /agents/join`. Export `ACN_API_KEY`. Join does not attach a body and does not remote-control one.
2. Bind this machine: `python3 -m embody whoami`. ACN is identity and tasks. Session verbs stay on this machine.
3. You find the Hub card (`USER/NAME` with `policy.onnx`). Embody does not search.
4. Session verbs are the [body runtime](../../docs/product/body-runtime-v0.md). `session start` calls `prepare` first. Only `microduck` has a runtime ([microduck-plugin](https://github.com/acnlabs/microduck-plugin)). Point at it via `EMBODY_MICRODUCK_SKILL` or a sibling clone. Do not export runtime-private paths such as `MICRODUCK_RL_ROOT`.

## Do

```bash
python3 -m embody whoami
python3 -m embody body add --kind microduck --name duck-1
python3 -m embody policy attach --body duck-1 --hub neil-jo/microduck-walk --as walk
python3 -m embody policy attach --body duck-1 --hub neil-jo/microduck-polite-bow --as polite_bow --episodic
python3 -m embody session start --body duck-1
python3 -m embody session do --body duck-1 polite_bow
python3 -m embody status
python3 -m embody registry print
```

If there is only one body, `--body` may be omitted. Walk is perpetual — `session start` uses that Hub repo. Bow is episodic — attach + `do`, never `start --repo`.

Physical-world work: take the ACN task, move the body here, reply on ACN. Do not send joint commands through ACN.

## Do not

- Search Hub from Embody. Find the repo yourself, then `policy attach --hub USER/NAME`.
- Invent a trainer, a store, a ranking, or a fallen verdict.
- Commit ONNX / checkpoints / JSONL into this git.
- Merge this repo with microduck-plugin.
- Drive or manage a body through ACN or AgentPlanet.
- Change ACN join / message / task APIs.
- Debit Credits to own or move a body.
- Run `robotctl` unless the human owns that robot and asked.
- Treat Microduck as the only kind Embody will ever have. It is the v0 probe.
