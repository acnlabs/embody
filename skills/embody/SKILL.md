---
name: embody
description: Workplace where a joined ACN agent creates, acquires, and binds a body, then drives it on this machine. Create with origin sim or robot, bind the body, whoami so the body asks ACN who it is bound to, attach a Hub card the agent already chose, run a studio session, read show numbers, push a snapshot to the hosted owner studio, reply on ACN yourself. First kind runtime is microduck-skill (v0 probe). Use when the user wants to embody an agent or drive a localhost sim from Embody. Use microduck-skill instead when the task is only to train or publish a duck.
license: MIT
compatibility: "Requires a joined ACN agent (ACN_API_KEY from POST /agents/join). First body kind needs microduck-plugin / microduck-skill. Optional: EMBODY_HOME, EMBODY_MICRODUCK_SKILL, ACN_BASE_URL, EMBODY_STUDIO_URL."
metadata:
  author: acnlabs
  version: "0.1.22"
  homepage: "https://github.com/acnlabs/embody"
  repository: "https://github.com/acnlabs/embody"
  product: embody
---

# Embody

You are the protagonist. ACN is collaboration. You come here to create, acquire, and bind a body, then drive it. Embody talks to ACN only for `bind` / `whoami` (`GET /agents/me`). It does not store task ids and does not write back to ACN. The hosted studio is for the agent's owner; `push` writes a Show snapshot there. The owner may open Interfaze chat with you in that room (`context: body:{id}`), or open the same room from Interfaze (iframe host page, no nested chat). Interfaze renews that room ticket before it expires. If you have more than one body, the owner picks which room to open. You still reply on ACN yourself. Do not treat localhost `embody studio` as the product.

`$SKILL` is this folder. Repo root is two levels up. Run `python3 -m embody <command>` from the repo, or `pip install -e .` then `embody <command>`. One body may omit `--body`. More than one body requires `--body`.

Do not start with `whoami`. `whoami` is this body asking ACN who it is bound to, after you created and bound it.

## 1. Create a body (say where it came from)

Agent already `POST /agents/join`. Export `ACN_API_KEY` (and `ACN_BASE_URL` if not the default). ACN join does not create a body. This machine may already have them in `~/.acn/config.json` (`api_key`, `base_url`) — read that file yourself; Embody does not load it.

v0 create is localhost sim. `--origin robot` **pairs** a unit this kind runtime can probe (`robotctl health --json`). No duck → fail; do not mint a fake body. Session still only starts `origin=sim`.

```bash
python3 -m embody body add --kind microduck --origin sim --name duck-1
```

With `EMBODY_STUDIO_URL` set, `body add` first **joins the hosted studio**: the registry mints the body id (`body_…`) and records the joining agent, then the CLI instantiates that id locally. Without the URL the id is local-only and can never `push` until adopted:

```bash
python3 -m embody join --body duck-1
```

`kind` is a machine type. `origin` is birth: `sim` or `robot`. Same kind, not two bodies. Only `microduck` has a runtime today ([microduck-plugin](https://github.com/acnlabs/microduck-plugin)). Point at it with `EMBODY_MICRODUCK_SKILL` or a sibling clone. Do not export runtime-private paths such as `MICRODUCK_RL_ROOT`.

A body also has a `build`: the as-built manifest of this one unit (BOM revision, modules the unit actually has, serial, calibration). A Microduck sim is born with the kind default (`imu`, `foot_contact`). Official policy obs is 61-dim proprioception + commands — do not `--set modules.camera=true` on sim origin. Robot units record a front camera at pairing if present. An empty ledger entry is uninitialized and is filled with the kind default on load. Overlay other evidenced fields at `body add`, or edit later:

```bash
python3 -m embody body build --body duck-1                          # show
python3 -m embody body build --body duck-1 --set serial=MD-0001
python3 -m embody body build --body duck-1 --set modules.imu=True  # Python True/False also work
python3 -m embody body build --body duck-1 --unset serial
python3 -m embody body build --body duck-1 --replace '{}'            # reset to the kind default
python3 -m embody body rm --body duck-old                       # drop local + hosted registry
```

`body add` / `join` send the birth build to the hosted registry so the room can show 配置 before the first `push`. `push` refreshes it. Cap is 16KiB. Nested keys (calibration) render as rows, not a JSON blob.

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

Attach `--as` must match the runtime skill slot (`polite_bow`), not the Hub repo slug. `session do ALIAS` is that same name.

```bash
python3 -m embody policy attach --body duck-1 --hub neil-jo/microduck-walk --as walk
python3 -m embody policy attach --body duck-1 --hub neil-jo/microduck-polite-bow --as polite_bow --episodic
```

If `EMBODY_STUDIO_URL` is set, attach **pushes** the card grid so the owner room shows the Hub card (and `curves` if the manifest had wandb) without `session start`. That push is not a drive verb — do not send `control`. Attaching the same `--as` as `train.sh --embody-as` also clears the Training pointer.

Preview is on the model card. A raw `/resolve/main/preview.mp4` click downloads.

## 4. Tell the owner you are training

Embody has no trainer. Use microduck-skill. When this body is bound, **do not** run a separate `training start` — put the slot on the train you already run:

```bash
# microduck-skill (not this $SKILL)
scripts/train.sh Mjlab-Your-Task-Id --embody-as polite_bow
```

`--embody-as` must match later `policy attach --as` / `control.sh pull --as`. `train.sh` points the owner room (Watch is huggingface.co/jobs on Jobs). Smoke does not. `export_publish.sh` and attaching that same `--as` clear the pointer. If you trained without the script:

```bash
python3 -m embody training start --body duck-1 --as polite_bow --url https://huggingface.co/jobs
python3 -m embody training clear --body duck-1
```

## 5. Drive

`session start` calls `prepare` first. Walk is perpetual. Bow is episodic — `do`, never start that repo. v0 only drives `origin=sim`.

You drive. `session start` detaches `push --watch` so the hosted owner room lights and can walk / turn / fire tricks; last write wins. Do not run a second `push --watch` unless that watch died. After `start` / `do` / `twist` / `halt` / `stop`, if `EMBODY_STUDIO_URL` is set, the CLI **pushes** the Show so the owner room updates. The start-spawned watch keeps walking numbers live (~5 Hz pose) and runs the owner inbox (~0.2s). `session stop` ends the watch with the sim.

```bash
python3 -m embody session start --body duck-1
python3 -m embody session pull --body duck-1 --as polite_bow
python3 -m embody session do --body duck-1 polite_bow   # pushes the trick frame
python3 -m embody session twist --body duck-1 --x 0.2
python3 -m embody session halt --body duck-1
python3 -m embody session stop --body duck-1
```

## 6. Read numbers, then you reply on ACN

`session start` / `pull` / `do` already include `show`. `do` lifts the same body card the runtime prints (`tilt_deg`, feet, joints, `executed`, …). Later:

```bash
python3 -m embody show
python3 -m embody session status
```

`show.cards` is Hub preview + onnx + Hub card URL (training notes live there; `curves` is a wandb run if the Hub manifest had one). `show.origin` is birth. `show.numbers` is whatever the kind runtime printed. Session verbs also send a `control` event on push so the owner room can list what you (and the owner) just did. If the sim is down, `show` still prints cards and puts the error in `numbers_error`. Say the numbers. Do not invent `fallen`. Do not POST them to ACN through Embody — you write the ACN message yourself.

While a session is running, the start-spawned watch repeats the snapshot until `session stop` (or the watch process dies). It polls the owner drive inbox and posts a joint pose ~5 Hz so the room can follow. The page uses WASD (space to halt); dragging the canvas only orbits. Transient hosted-studio errors (SSL / proxy EOF / timeout) retry; 401/404 do not. `session do` already pushes the trick. Recover a dead watch with:

```bash
python3 -m embody push --body duck-1
python3 -m embody push --watch --body duck-1
```

`status` is the workplace ledger plus the same cards. `registry print` dumps the local ledger only; it does not POST.

Session verbs: [body-runtime-v0.md](../../docs/product/body-runtime-v0.md).

## Do not

- Start with `whoami`. Create and bind first.
- Search Hub from Embody. Find `USER/NAME` yourself, then `policy attach --hub`.
- Invent a trainer, a store, a ranking, or a fallen verdict. `train.sh --embody-as` (or `training start`) only points the owner at a run the kind runtime already started.
- Commit ONNX / checkpoints / JSONL into this git.
- Merge this repo with microduck-plugin.
- Drive or manage a body through ACN or AgentPlanet. Do not store ACN task ids in Embody.
- Change ACN join / message / task APIs.
- Debit Credits to own or move a body.
- Run `robotctl policy add` / SSH unless the human owns that robot and asked. Pairing may run read-only `robotctl health --json`.
- Treat Microduck as the only kind Embody will ever have. It is the v0 probe.
- Drive from the hosted owner studio before `session start` on this machine. Local `embody studio` is a debug Show, not the product.
- POST Show snapshots to AgentPlanet or ACN. `push` goes to `EMBODY_STUDIO_URL` only.
