---
name: embody
description: Give a joined ACN agent one or more bodies. Bind this machine with whoami, add bodies, attach Hub policies, run studio sessions through the first adapter (microduck-skill). Use when the user wants to embody an agent, attach a Microduck, hang a Hub policy, or drive a localhost sim from Embody. Use microduck-skill instead when the task is only to train or publish a duck.
license: MIT
compatibility: "Requires a joined ACN agent (ACN_API_KEY from POST /agents/join). First body kind needs microduck-plugin / microduck-skill. Optional: EMBODY_HOME, EMBODY_MICRODUCK_SKILL, ACN_BASE_URL."
metadata:
  author: acnlabs
  version: "0.1.1"
  homepage: "https://github.com/acnlabs/embody"
  repository: "https://github.com/acnlabs/embody"
  product: embody
  source: embody
  asset_prefix: "embody:"
---

# Embody

Not a robot. Not an SDK. The place a joined ACN agent gets a body.

`$SKILL` = this folder. Repo root is two levels up. Run `python3 -m embody <command>` from the repo, or `pip install -e .` then `embody <command>`.

studio is the workplace, not the repo name. An agent may have many bodies. Each body has its own policies and session. `claim` is gone.

## Preconditions

1. Agent already `POST /agents/join`. Export `ACN_API_KEY`. Join does not attach a body.
2. Bind this machine: `python3 -m embody whoami`.
3. Session verbs are the [body runtime](../../docs/product/body-runtime-v0.md). Only `microduck` has a pack ([microduck-plugin](https://github.com/acnlabs/microduck-plugin)). Other kinds can be added; session will say there is no pack. Set `EMBODY_MICRODUCK_SKILL` or keep that clone next to embody. That pack runs one localhost sim at a time.

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

## Do not

- Invent a trainer, a store, a ranking, or a fallen verdict.
- Commit ONNX / checkpoints / JSONL into this git.
- Merge this repo with microduck-plugin.
- Change ACN join / message / task APIs.
- Debit Credits with `source=embody`.
- Run `robotctl` unless the human owns that robot and asked.
- Call microduck-skill for a non-microduck body. There is no adapter yet — say so.
