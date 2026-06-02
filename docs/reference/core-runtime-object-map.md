# 核心运行时对象地图（Core Runtime Object Map）：用少数对象读完 Lab 01 到 Core 31

本文给学习者一个压缩地图：不要把 8 个 Lab 和 31 个 Core 当成 39 个孤立功能点，而要把它们看成少数运行时对象（Runtime object）不断长出来的证据链。

它是学习辅助图，不替代课程、Core 文档或 verify 脚本。具体行为仍以 `src/**/*.verify.mjs` 和对应 `docs/core/core-XX-*.md` 为准。

## 1. 最小世界观

本项目的核心问题是：

```text
一个代码智能体如何在本地、可验证、可恢复、可审计的运行时（Runtime）里完成代码任务？
```

最小对象链是：

```text
用户目标（User Goal）
  -> 会话（Session）
  -> 上下文（Context）
  -> 模型请求（ModelRequest）
  -> 模型决策（ModelDecision）
  -> 权限 / 策略（Permission / Policy）
  -> 工具运行时（ToolRuntime）
  -> 观察（Observation）
  -> 状态更新（State Update）
  -> 验证（Verification）
  -> 证据（Evidence）
```

## 2. 八个核心对象

| 运行时对象 | 解决的问题 | 主要课程 / 阶段 |
| --- | --- | --- |
| 会话（`Session`） | 一次任务的状态、事件和恢复边界 | Lab 02、Core 24、Core 30、Core 31 |
| 消息流（`MessageStream`） | 模型、工具和运行时事实如何按顺序进入上下文 | Lab 01-02、Core 01 |
| 模型网关（`ModelGateway`） | 模型调用如何被解析、校验、预算控制和恢复 | Core 02、Core 07、Core 08、Core 23 |
| 上下文引擎（`ContextEngine`） | 本轮模型到底看见什么，哪些内容被裁剪、附件化或复用 | Lab 05、Core 03、Core 18、Core 29 |
| 工具运行时（`ToolRuntime`） | 工具如何被策略检查、执行、事务化和记录 | Lab 03-04、Core 01、Core 22、Core 27、Core 28 |
| 计划状态（`PlanState`） | 计划如何从文本变成可审批、可阻塞、可恢复的状态机 | Lab 06、Core 04、Core 20 |
| 评测证据（`EvalEvidence`） | 为什么可以声称某个机制成立，失败如何归因 | Lab 08、Core 06、Core 10-17、Core 19、Core 21 |
| 边界契约（`BoundaryContract`） | 哪些能力被证明，哪些不能声称 | Course 00、Course 03、Course 13-18、开源边界 |

## 3. 从 Lab 到 Core 的读法

| 学习层 | 读法 | 不要误读成 |
| --- | --- | --- |
| Lab | 单个机制的最小可运行样本 | 完整产品能力 |
| Core 01-12 | 最小代码智能体运行时（Runtime）骨架 | 生产级 Claude Code |
| Core 13-17 | 评测（eval）、参考运行（reference run）、成本（cost）和定价边界（pricing boundary） | 真实 Claude Code 基线或真实账单 |
| Core 18-26 | 生产化升级的本地确定性证据（deterministic local evidence） | 线上生产系统认证 |
| Core 27-31 | 产品表层（Product Surface）机制落成运行时边界（Runtime boundary） | 官方 Claude Code 内部实现 |

## 4. Core 27-31 如何回到对象地图

产品表层（Product Surface）主题很容易被误读成 UI 或配置说明。本项目只在它们能落成运行时对象（Runtime object）、状态（state）、边界（boundary）和验证证据（verify evidence）时才进入 Core。

| Core | 产品表层词 | 运行时对象 | 证明重点 |
| --- | --- | --- | --- |
| Core 27 | 设置与权限解析器（Settings / Permission Resolver） | 工具运行时（`ToolRuntime`）+ 边界契约（`BoundaryContract`） | 用户 / 项目 / 本地 / 策略（user / project / local / policy）规则先解析为允许 / 询问 / 拒绝（allow / ask / deny），再影响工具路径 |
| Core 28 | 钩子生命周期（Hooks Lifecycle） | 工具运行时（`ToolRuntime`）+ 会话（`Session`） | 钩子（hook）是生命周期事件（lifecycle event），不是伪装成系统提示词（system prompt）的任意文本 |
| Core 29 | 记忆来源 / 项目记忆 / 自动记忆（Memory Source / CLAUDE.md / Auto Memory） | 上下文引擎（`ContextEngine`）+ 会话（`Session`） | 记忆（memory）是可索引、可遗忘、可重新验证的上下文来源，不是压缩（compaction） |
| Core 30 | 检查点与回退（Checkpoint / Rewind） | 会话（`Session`）+ 边界契约（`BoundaryContract`） | 检查点（checkpoint）绑定文件指纹（hash）、会话事件（session event）和审计回放（audit replay），不覆盖外部变更 |
| Core 31 | 子代理上下文隔离（Subagent Context Isolation） | 会话（`Session`）+ 上下文引擎（`ContextEngine`）+ 边界契约（`BoundaryContract`） | 委派任务（delegated task）只拿隔离上下文，只回传摘要（summary）、证据（evidence）和结构化失败（structured failure） |

## 5. 学习者应该能复述什么

读完本项目后，不要求你背下所有文件名。你应该能用自己的话说明：

```text
模型为什么不能自己执行工具；
工具结果为什么必须回到消息流（MessageStream）；
上下文引擎（ContextEngine）为什么决定模型本轮能知道什么；
计划状态（PlanState）为什么不是一段提示词；
评测证据（EvalEvidence）为什么比主观感觉更可信；
会话（Session）为什么要只追加（append-only）、重放（replay）和审计（audit）；
产品表层主题为什么必须落成运行时边界（Runtime boundary）才能进入 Core。
```

## 6. 贡献者应该如何用这张图

新增或修改内容前，先问：

```text
它属于哪个运行时对象（Runtime object）？
它是否改变了状态（state）、边界（boundary）或验证证据（verify evidence）？
它是否只是补旧课程，而不是新 Core？
它是否需要更新 authority map、README 或 docs index？
它是否会让公开能力声明变大？
```

如果一个主题不能回答这些问题，它通常不应该直接变成新的 Core。

## 7. 能力边界

这张对象地图只描述本项目自己的学习运行时（Runtime）。它不能证明：

```text
Claude Code 官方实现就是这样；
本项目是 Claude Code 源码复刻；
本项目可以替代 Claude Code 生产使用；
本项目拥有真实模型服务账单证据（provider billing evidence）；
本项目拥有真实 Claude Code 基线（baseline）或相对分数（RelativeScore）。
```
