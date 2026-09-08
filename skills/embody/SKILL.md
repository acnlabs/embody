---
name: embody
description: Give a joined ACN agent a body. Claim one body, attach Hub policies, run a studio sim session through the first adapter (microduck-skill). Use when the user wants to embody an agent, attach a Microduck, hang a Hub policy, or drive a localhost sim from Embody — not when they only want to train a duck (use microduck-skill) or make a film (use comiclaw-studio).
license: MIT
compatibility: "Requires a joined ACN agent (ACN_API_KEY from POST /agents/join). First body kind needs microduck-plugin / microduck-skill. Optional: EMBODY_HOME, EMBODY_MICRODUCK_SKILL, ACN_BASE_URL."
metadata:
  author: acnlabs
  version: "0.1.0"
  homepage: "https://github.com/acnlabs/embody"
  repository: "https://github.com/acnlabs/embody"
  product: embody
  source: embody
  asset_prefix: "embody:"
---

# Embody

Not a robot. Not an SDK. The place a joined ACN agent gets a body.

`$SKILL` = this folder. Repo root is two levels up. Run:

```bash
python3 -m embody <command>
```

from the repo, or `pip install -e .` then `embody <command>`.

**studio** is the workplace, not the repo name. **embot** is spoken language for the attached body.

## Preconditions

1. Agent already `POST /agents/join`. Export `ACN_API_KEY`. Join does not attach a body.
2. v0: one agent ↔ one body (`kind=microduck`) ↔ several Hub policies.
3. First adapter: [microduck-plugin](https://github.com/acnlabs/microduck-plugin). Set `EMBODY_MICRODUCK_SKILL` or keep that clone next to embody.

## Do

```bash
python3 -m embody claim
python3 -m embody body register --kind microduck
python3 -m embody policy attach --hub neil-jo/microduck-walk --as walk
python3 -m embody policy attach --hub neil-jo/microduck-polite-bow --as polite_bow
python3 -m embody session start
python3 -m embody session do polite_bow
python3 -m embody status
python3 -m embody registry print
```

Walk is perpetual — `session start` uses that Hub repo. Bow is episodic — attach + `do`, never `start --repo`.

## Do not

- Invent a trainer, a store, a ranking, or a fallen verdict.
- Commit ONNX / checkpoints / JSONL into embody git.
- Merge this repo with microduck-plugin.
- Change ACN join / message / task APIs.
- Debit Credits with `source=embody`.
- Run `robotctl` unless the human owns that robot and asked.
- Resubmit microduck-skill to ClawHub from this repo.
