# 公开学习边界

这个项目当然是围绕 Claude Code 学习的。这里的“公开学习边界”只是在说明：我们学 Claude Code 的产品机制和 Agent Runtime 方法，可以研究真实产品工件暴露出的机制，但不把非公开源码、私有 Prompt 原文或第三方提取原文直接发布为本项目实现。

## 可以这样介绍

```text
Claude Code Core Lab 是一个中文学习项目。
它围绕 Claude Code 这类代码 Agent 的核心机制，
用 course -> lab -> core 的方式，
从零搭建一个可运行、可验证、可复盘的本地 Agent Core。
```

也可以说：

```text
这个项目学习 Claude Code 背后的产品问题：
模型看见什么、工具怎么执行、上下文怎么组织、计划怎么保持、失败怎么恢复、能力怎么验证。
```

## 不要这样介绍

```text
这是 Claude Code 源码复刻。
这是 Anthropic 官方实现。
这是 Claude Code 官方 Prompt 整理。
这是生产级 Claude Code 替代品。
它已经达到真实 70%-80% 大仓库成功率。
它已经有 Claude Code baseline。
它已经有跨 Agent RelativeScore。
```

## 为什么要守这个边界

因为本项目的目标是公开学习和可复现：

```text
代码必须是我们自己写的。
课程必须能解释证据来源。
verify 必须能在本地复现。
能力声明不能超过证据。
```

这样中文学习者才能放心使用，也方便其他人参与贡献。

## 证据怎么分层

| 层级 | 材料 | 可以怎么用 |
| --- | --- | --- |
| A | 官方文档、SDK、CLI 帮助、公开 preset 说明 | 可以公开引用，作为能力和接口边界依据 |
| B | Claude Code 分发物、source map、运行材料中抽取出的结构 | 可以学习机制，转译成我们自己的对象模型和验证 |
| C | 第三方版本 diff、提示词历史整理、社区观察 | 只能作研究线索，进入文档前要标注来源层级 |
| D | 本项目自己的抽象、实现和 verify | 只能声称本项目已经验证的能力 |

因此：

```text
可以研究 B/C 层材料揭示的产品机制。
可以把机制转译成课程、对象模型、验证矩阵和我们自己的实现。
不能把 B/C 层原文当作官方公开文档，也不能把原文直接复制进公开 Prompt Pack。
```

## 当前已经能公开说什么

```text
Lab 01-08 已覆盖 Runtime loop、MessageStore、工具、安全编辑、Context、Plan、Compaction、Eval。
Core 01-12 已把这些机制集成成可运行 Agent Core。
Core 13-14 已把 20 个 starter cases 迁移成 executable repo seeds。
Core 15-17 已记录 8 个 codex-local reference runs，并建立 token/cost/pricing boundary。
Core 18-26 已建立 Production Upgrade deterministic local evidence chain。
Core 27 已建立第一个 Product Surface deterministic local evidence：Settings / Permission Resolver。
Core 28 已建立第二个 Product Surface deterministic local evidence：Hooks Lifecycle。
Core 29 已建立第三个 Product Surface deterministic local evidence：Memory Source / CLAUDE.md / Auto Memory。
Core 30 已建立第四个 Product Surface deterministic local evidence：Checkpoint / Rewind。
Core 31 已建立第五个 Product Surface deterministic local evidence：Subagent Context Isolation。
Product Surface Study 已建立路线和验证矩阵，并已完成当前候选池 A-E；未来新候选仍用于判断 Claude Code 产品表层材料应补入已有课程，还是形成新的可验证 Core。
```

## 当前不能说什么

```text
20/20 executable 不等于生产级 benchmark。
codex-local baseline 不等于 Claude Code baseline。
configured estimated USD 不等于真实厂商账单。
cache simulation 不等于真实 provider cache billing。
没有第二 agent 真实 runs，就不能生成 RelativeScore。
```

## 可以进入仓库的材料

```text
自己写的课程、源码、verify case 和 fixture。
公开产品行为的抽象学习总结。
公开 API 文档下的接口适配思路。
不含密钥和私有原文的结构化运行证据。
```

## 不能进入仓库的材料

```text
非公开源码。
反编译或还原出的源码片段。
官方或第三方提取的 Claude Code Prompt 原文。
可还原私有 Prompt 或源码结构的大段摘录。
真实 API key、token、账号信息。
带 secret 的 trace、raw log 或截图。
```

## 说法示例

推荐：

```text
Core 18 证明本地脚本可以稳定生成“缓存感知上下文报告”，包括稳定前缀、动态尾部、裁剪、附件和缓存模拟。
```

不要写成：

```text
Core 18 已实现真实 provider prompt caching 成本优化。
```

推荐：

```text
Core 17 能用显式本地价格表计算配置化美元估算。
```

不要写成：

```text
Core 17 证明真实厂商账单成本。
```
