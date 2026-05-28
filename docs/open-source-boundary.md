# Open Source Boundary

本文声明本仓库开源时可以说什么、不能说什么。能力边界冲突时，以 `../docs/authority-map.md` 和对应 verify 脚本为准。

## 可以公开声明

```text
这是一个 clean-room Claude Code-like Core 学习项目。
它用 course -> lab -> core 的方式教学。
Lab 和 Core verify 脚本提供 deterministic local evidence。
Core 10-14 已把 20 个 starter cases 迁移成 executable repo seeds。
Core 15-17 已记录 8 个 codex-local reference runs，并建立 token/cost/pricing boundary。
Core 18-26 已建立 Production Upgrade deterministic local evidence chain。
```

## 不能公开声明

```text
这是 Claude Code 源码复刻。
这是 Anthropic 官方实现。
这是生产级 Claude Code 替代品。
它已经达到真实 70%-80% 大仓库成功率。
它已经有 Claude Code baseline。
它已经有跨 Agent RelativeScore。
本地示例价格表等于真实厂商账单。
Core 18 cache simulation 等于真实 provider cache billing。
```

## Clean-room 内容边界

可以进入仓库：

```text
自己写的课程、源码、verify case 和 fixture。
公开产品行为的抽象学习总结。
公开 API 文档下的接口适配思路。
不含密钥和私有原文的结构化运行证据。
```

不能进入仓库：

```text
非公开源码。
反编译或还原出的源码片段。
官方或第三方提取的 Claude Code prompt 原文。
真实 API key、token、账号信息。
带 secret 的 trace、raw log 或截图。
```

## Evidence 说法模板

推荐：

```text
Core 18 proves a deterministic local cache-aware context report with stable prefix, dynamic tail, eviction, artifacts, and cache simulation.
```

中文可写成：

```text
Core 18 证明本地脚本可以稳定生成“缓存感知上下文报告”，包括稳定前缀、动态尾部、裁剪、附件和缓存模拟。
```

不要写成：

```text
Core 18 已实现真实 provider prompt caching 成本优化。
```

推荐：

```text
Core 17 produces configured estimated USD from an explicit local pricing table.
```

中文可写成：

```text
Core 17 能用显式本地价格表计算配置化美元估算。
```

不要写成：

```text
Core 17 证明真实厂商账单成本。
```

## Issue 和 PR 边界

提交 issue 或 PR 时，请尽量说明：

```text
修改的是 course、lab、core、docs 还是 verify。
这个修改新增了什么证据。
有没有改变当前能力声明。
是否需要更新 README、CURRENT_STATE、docs/index 或 authority-map。
```
