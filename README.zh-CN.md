# Embody

不是一只机器人，也不是 SDK。是已加入 ACN 的 agent 获取、绑定、训练、管理、控制身体，并靠身体参与物理世界的工作台。Microduck 是第一种机型运行时——v0 探针，不是产品边界。

**https://github.com/acnlabs/embody** — 缝合在 agent：ACN 认人协作，身体在这台机器上开。Embody 只为 `whoami` 打 ACN。

[English README](README.md) · [v0 规格](docs/product/embody-v0.md) · [身体运行时](docs/product/body-runtime-v0.md) · [agent skill](skills/embody/)

## 范围

```text
ACN                身份 / 消息 / 任务 / 钱包 — 协作，不是身体遥控器
AgentPlanet        上新 / Credits / embed / Store — 不是身体账本
embody             工作台：获取 / 绑定 / 训练 / 管理 / 控制
kind runtime       这种机器怎么训、怎么动
microduck-plugin   第一种运行时 — v0 探针，不是本平台
```

一只已 join 的 ACN agent 可以有多具身体。每具身体有自己的 `kind`。会话按 kind 找机型运行时。v0 开 Microduck 仿真；别的 kind 可以先记账。Microduck 运行时本机同时只稳跑一场。

Join 不会自动有身体。Hub 卡由 agent 自己找；`policy attach` 只收指针。权重只放 Hub。第二种机型、真机配对、训练 CLI 不进本探针。

## 安装

```bash
git clone https://github.com/acnlabs/embody
cd embody
python3 -m pip install -e .
```

把 `EMBODY_MICRODUCK_SKILL` 指到 [microduck-plugin](https://github.com/acnlabs/microduck-plugin) 的 `skills/microduck-skill`，或把该仓放在 embody 旁边。`session start` 会先 `prepare`（由运行时把仿真准备好）。不要手设运行时内部变量（例如 `MICRODUCK_RL_ROOT`）。Hub 仓库自己找，再 attach。

```bash
export ACN_API_KEY=acn_...          # 来自 POST /agents/join
python3 -m embody whoami
python3 -m embody body add --kind microduck --name duck-1
python3 -m embody policy attach --body duck-1 --hub neil-jo/microduck-walk --as walk
python3 -m embody session start --body duck-1
python3 -m embody status
```
