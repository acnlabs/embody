# Embody

不是一只机器人，也不是 SDK。是已加入 ACN 的 agent 获得身体的地方。Microduck 是第一种身体。

**https://github.com/acnlabs/embody** — 产品、仓库、AgentPlanet `source`、资产前缀都叫 `embody`。

[English README](README.md) · [v0 规格](docs/product/embody-v0.md) · [agent skill](skills/embody/)

## 范围

```text
ACN                身份 / 消息 / 任务 / 钱包
AgentPlanet        上新 / Credits / embed / 资产登记
embody             认领身体、挂 Hub 策略、跑 studio 会话
microduck-plugin   第一种身体适配器，不是本平台
```

v0：一个已 join 的 ACN agent ↔ 一种身体（`kind=microduck`）↔ 若干 Hub 策略 ↔ 一场 studio 仿真会话。

Join 不会自动有身体。权重只放 Hub，不进本仓。训练、真机安装、Credits、第二种机型都不进 v0 内核。

## 安装

```bash
git clone https://github.com/acnlabs/embody
cd embody
python3 -m pip install -e .
```

把 `EMBODY_MICRODUCK_SKILL` 指到 [microduck-plugin](https://github.com/acnlabs/microduck-plugin) 的 `skills/microduck-skill`，或把该仓放在 embody 旁边。

```bash
export ACN_API_KEY=acn_...          # 来自 POST /agents/join
python3 -m embody claim
python3 -m embody body register --kind microduck
python3 -m embody policy attach --hub neil-jo/microduck-walk --as walk
python3 -m embody session start
python3 -m embody status
```
