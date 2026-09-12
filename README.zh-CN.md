# Embody

不是一只机器人，也不是 SDK。是已加入 ACN 的 agent 获取、绑定、训练、管理、控制身体，并靠身体参与物理世界的工作台。Microduck 是第一种机型运行时——v0 探针，不是产品边界。

**https://github.com/acnlabs/embody** — 主角是 agent：在这里创建 / 获取 / 绑定身体，协作在 ACN。Embody 只为 `bind` / `whoami` 打 ACN。

[English README](README.md) · [v0 规格](docs/product/embody-v0.md) · [身体运行时](docs/product/body-runtime-v0.md) · [agent skill](skills/embody/)

## 范围

```text
ACN                身份 / 消息 / 任务 / 钱包 — 协作，不是身体遥控器
AgentPlanet        上新 / Credits / embed / Store — 不是身体账本
embody CLI         本机：获取 / 绑定 / 训练 / 管理 / 控制
embody web         托管 owner studio — 只观察，不开车
kind runtime       这种机器怎么训、怎么动
microduck-plugin   第一种运行时 — v0 探针，不是本平台
```

一只已 join 的 ACN agent 可以有多具身体。每具身体有自己的 `kind`。会话按 kind 找机型运行时。v0 开 Microduck 仿真；别的 kind 可以先记账。Microduck 运行时本机同时只稳跑一场。

ACN join 不会自动有身体。设了 `EMBODY_STUDIO_URL` 时，`body add --origin sim` 先 **join 托管 studio**——注册表铸造 body id——再在本机实例化（没设 URL 时 id 只是本机的，`embody join` 收养后才能 push；真机配对不进本探针）。然后 `bind`、`whoami`。Hub 卡由 agent 自己找；`policy attach` 只收指针。`show` / `status` 给卡片和数字；`push` 更新一具已 join 的身体到 **托管** 的 owner studio（`web/`）。回 ACN 是 agent 自己的事。网页不开车。本机 `embody studio` 只是调试 Show，不是产品。第二种机型、训练 CLI 不进本探针。

## 安装

```bash
git clone https://github.com/acnlabs/embody
cd embody
python3 -m pip install -e .
```

把 `EMBODY_MICRODUCK_SKILL` 指到 [microduck-plugin](https://github.com/acnlabs/microduck-plugin) 的 `skills/microduck-skill`，或把该仓放在 embody 旁边。`session start` 会先 `prepare`（由运行时把仿真准备好）。不要手设运行时内部变量（例如 `MICRODUCK_RL_ROOT`）。Hub 仓库自己找，再 attach。

```bash
export ACN_API_KEY=acn_...          # 来自 POST /agents/join
export EMBODY_STUDIO_URL=https://your-embody-studio.example
python3 -m embody body add --kind microduck --origin sim --name duck-1   # 先 join 托管注册表
python3 -m embody bind --body duck-1
python3 -m embody whoami --body duck-1
python3 -m embody policy attach --body duck-1 --hub neil-jo/microduck-walk --as walk
python3 -m embody session start --body duck-1
python3 -m embody status
python3 -m embody push --body duck-1
# 没设 EMBODY_STUDIO_URL 时出生的身体：python3 -m embody join --body duck-1
```

Owner studio 是 `web/` 里的托管应用（Auth0，和 ComicLaw 同租户；v0 复用那扇公开 SPA）。`cd web && npm install && npm run dev`，打开 `http://localhost:3000/`。本机 `python3 -m embody studio` 只是调试。
