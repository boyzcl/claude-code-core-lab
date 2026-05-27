# CURRENT_STATE：Claude Code Core 学习项目当前状态

最后更新：2026-05-27 21:59 CST

本文是新对话入口和当前状态单一事实源。它不替代课程、Lab、Core 文档，只回答：

```text
我们现在在哪里？
为什么走到这里？
已经确认了什么？
下一步最小动作是什么？
新对话如何恢复？
```

如果本文和其他文档在“当前进度 / 下一步动作”上冲突，以本文为准。课程内容、架构细节、实验记录仍以各自文档为准。

---

## 1. 项目目标

第一目标：

```text
让学习者真正学会如何从零构建一个 Claude Code-like 产品。
```

第二目标：

```text
在学习完成后，把这条学习过程整理成可开源、可复刻、可教学的 clean-room 路径。
```

当前产品目标不是完整复刻 Claude Code，而是先构建：

```text
Claude Code Core
```

它关注本地代码任务的核心闭环：

```text
User Goal
  -> Session
  -> Context Assembly
  -> Model Decision
  -> Tool Call
  -> Policy Check
  -> Tool Execution
  -> Observation
  -> State Update
  -> Verification
  -> Next Turn
```

---

## 2. 为什么现在是这个状态

这个项目最初从两篇 Claude Code / AI Coding 分析文章开始，目标是理解 Claude Code 到底在产品逻辑、工程技术逻辑和代码实现上做了什么。

随后我们发现，单纯的“架构图”和“施工图”仍然太抽象。真正的学习目标不是直接写一个能跑的 Agent，而是理解：

```text
模型第一次被调用时到底看见什么；
模型为什么知道有哪些工具；
什么叫合理动作；
工具结果为什么要回灌；
状态、Policy、Prompt、Tool 分别承担什么职责；
Context 如何被组织、裁剪和恢复；
Eval 如何证明能力真的变强。
```

因此项目从“解释 Claude Code”转成了“学习式重构 Claude Code Core”：

```text
先 course 建立心智模型
再 lab 体验单个机制
再 core 集成最小产品骨架
再接真实模型和更完整 eval
```

---

## 3. 文档体系当前角色

| 文档 | 当前角色 | Authority |
| --- | --- | --- |
| `CURRENT_STATE.md` | 当前状态入口、新对话接力、下一步动作 | 当前进度和下一步以本文为准 |
| `claude-code-core-learning-path.md` | 学习总控 | 学习路线、阶段定义、命名规则 |
| `course-00-teaching-standard.md` | 教学规范 | 说明如何避免隐式信息 |
| `course-01-initial-model-request.md` | 课程 | 模型第一次被调用时看见什么 |
| `course-02-action-selection-rubric.md` | 课程 | 动作选择如何判断“合理” |
| `course-03-clean-room-prompt-pack.md` | 课程 | clean-room Prompt Pack 如何从 Runtime 需求倒推 |
| `course-04-single-task-full-trace.md` | 课程 | 单任务如何从用户输入跑到验证完成 |
| `course-05-product-mental-model.md` | 课程 | 从用户、模型、Runtime、工具、Eval 五层理解产品 |
| `course-06-labs-to-core-map.md` | 课程 | 8 个 Lab 如何映射成 Core 产品骨架 |
| `course-07-core-build-pass-overview.md` | 课程 | Core 01 到 Core 12 主体构建的教学总览 |
| `course-08-model-gateway-and-context-engine.md` | 课程 | ModelGateway 与 Context Engine 如何控制模型输出和可见世界 |
| `course-09-plan-mode-and-compaction.md` | 课程 | Plan Mode 与 Compaction 如何让长任务受控不断片 |
| `course-10-trace-eval-real-model-and-recovery.md` | 课程 | Trace / Eval / Real Model / Prompt Recovery 如何让系统可证明、可恢复 |
| `course-11-real-repo-task-layer.md` | 课程 | 真实 repo fixture 比 toy workspace 多证明了什么 |
| `course-12-eval-packaging-and-executable-seeds.md` | 课程 | Eval packaging 与 executable seeds 如何把能力证明体系落地 |
| `lab-01-*` 到 `lab-08-*` | 可执行实验 | 每个 Lab 证明一个局部机制 |
| `core-01-integrated-runtime.md` | 集成实现记录 | 证明多个 Lab 机制可以合成最小 Runtime |
| `core-02-model-gateway.md` | 集成实现记录 | 证明模型层可以替换成 Model Gateway，且 Runtime / Tool / Policy 边界不变 |
| `core-03-context-engine-integration.md` | 集成实现记录 | 证明 Context Engine 可以接入 CoreRuntime，控制本轮模型可见世界 |
| `core-04-plan-mode-integration.md` | 集成实现记录 | 证明 Plan Mode 可以接入 CoreRuntime，控制计划审批和工具权限 |
| `core-05-compaction-artifact-integration.md` | 集成实现记录 | 证明 Compaction / Artifact 可以接入 CoreRuntime，保留长任务关键状态 |
| `core-06-trace-eval-harness-expansion.md` | 集成实现记录 | 证明 Trace / Eval Harness 可以接入 CoreRuntime，生成评分和失败归因证据 |
| `core-07-real-model-api-e2e.md` | 集成实现记录 | 证明真实模型 API 可以接入 ModelGateway，且本地 Runtime 边界不变 |
| `core-08-prompt-pack-recovery-loop.md` | 集成实现记录 | 证明 Prompt Pack 可以引导模型恢复，但不能替代 Runtime 强制边界 |
| `core-09-real-repo-task-layer.md` | 集成实现记录 | 证明 CoreRuntime 可以处理真实仓库任务层的规则、测试、多文件和 stale edit |
| `core-10-70-80-eval-open-source-packaging.md` | 集成实现记录 | 证明项目已有 starter eval packaging 和最小开源文档入口 |
| `core-11-eval-expansion-executable-seeds.md` | 集成实现记录 | 证明第一批 starter case 可以变成 executable repo seeds |
| `core-12-eval-expansion-second-batch.md` | 集成实现记录 | 证明第二批 starter case 可以变成 executable repo seeds，并预留 reference-agent runner 接口 |
| `core-13-eval-expansion-third-batch.md` | 集成实现记录 | 证明第三批 starter case 可以变成 executable repo seeds，累计 15/20 starter case executable |
| `core-14-eval-expansion-final-starter-batch.md` | 集成实现记录 | 证明剩余 starter case 可以变成 executable repo seeds，累计 20/20 starter case executable |
| `core-15-reference-agent-comparison.md` | 集成实现记录 | 证明本机 Codex CLI 可以作为第一阶段 reference-agent baseline 产生小样本真实对照证据 |
| `core-16-reference-agent-cost-and-cross-agent.md` | 集成实现记录 | 证明 8 个 codex-local runs 已有 cost 计量口径，并明确横向对照仍被第二 agent baseline 阻塞 |
| `core-17-reference-agent-pricing-table-baseline.md` | 集成实现记录 | 证明显式本地 pricing table 可以为 8 个 codex-local runs 生成 configured estimated USD，同时不声称真实厂商账单 |
| `core-18-context-economy-cache-aware-context-engine.md` | 集成实现记录 | 证明 Context Economy Engine 可以输出 stable prefix、dynamic tail、eviction、artifact 和 cache simulation 证据 |
| `core-19-compaction-quality-eval.md` | 集成实现记录 | 证明 Compaction Quality Eval 可以机器对照压缩前后状态并识别 compaction_loss |
| `core-20-plan-state-machine.md` | 集成实现记录 | 证明 Plan State Machine 可以追踪 step lifecycle、blocked、revision、resume、permission 和 final grounding |
| `core-21-long-running-task-eval.md` | 集成实现记录 | 证明 Long-Running Task Eval 可以评估多轮修复、重复失败、压缩恢复、成本曲线和 no false final |
| `core-22-tool-runtime-transaction.md` | 集成实现记录 | 证明 ToolRuntime Transaction 可以预览 diff、多文件提交、回滚并拦截 stale/protected/high-risk |
| `production-upgrade-roadmap.md` | 生产化升级总控 | Core 18-26 的路线、依赖、边界和统一完成定义 |
| `production-upgrade-validation-matrix.md` | 验证矩阵 | Core 18-26 的验证先行口径和必过检查 |
| `README.md` | 项目总入口 | 快速运行、文档导航和当前边界 |
| `AGENTS.md` | Agent 控制入口 | Agent 工作规则、secret 边界和完成定义 |
| `docs/index.md` | 文档索引 | 区分当前规则、历史和证据 |
| `docs/authority-map.md` | authority map | 文档冲突优先级和 canonical doc 声明 |
| `labs-verification-record.md` | 验证记录 | Lab 全量验证历史记录 |
| `core-run-record.md` | 验证记录 | Core 集成验证历史记录 |
| `claude-code-agent-runtime-framework.md` | 架构参考 | 产品和运行时抽象 |
| `claude-code-core-implementation-blueprint.md` | 施工图参考 | 模块级实现规格 |
| `claude-code-70-80-validation-and-model-access.md` | 验收和模型接入参考 | 能力定义、评测、GPT / OpenAI-compatible API 接入 |
| `agent-runtime-optimization-loop.md` | 迭代参考 | trace、失败归因、eval、灰度和回归 |

冲突处理：

```text
当前进度 / 下一步动作：CURRENT_STATE.md
学习顺序 / 命名规则：claude-code-core-learning-path.md
课程正文：对应 course-XX 文档
实验机制：对应 lab-XX 文档和 src/labXX 代码
集成行为：core-01-integrated-runtime.md、core-02-model-gateway.md、core-03-context-engine-integration.md、core-04-plan-mode-integration.md、core-05-compaction-artifact-integration.md、core-06-trace-eval-harness-expansion.md、core-07-real-model-api-e2e.md、core-08-prompt-pack-recovery-loop.md、core-09-real-repo-task-layer.md、core-10-70-80-eval-open-source-packaging.md、core-11-eval-expansion-executable-seeds.md、core-12-eval-expansion-second-batch.md、core-13-eval-expansion-third-batch.md、core-14-eval-expansion-final-starter-batch.md、core-15-reference-agent-comparison.md、core-16-reference-agent-cost-and-cross-agent.md、core-17-reference-agent-pricing-table-baseline.md、core-18-context-economy-cache-aware-context-engine.md、core-19-compaction-quality-eval.md、core-20-plan-state-machine.md、core-21-long-running-task-eval.md、core-22-tool-runtime-transaction.md 和 src/core 代码
历史观点：两篇原始分析文章只作背景材料
```

---

## 4. 当前学习进度

已完成理解和复习：

```text
course-01 到 course-06 已由学习者复习完成。
学习者已经能理解模型、Runtime、Tool、Policy、State、Context、Plan、Compaction、Eval 的基本循环关系。
```

当前教学整理：

```text
course-07-core-build-pass-overview.md 已完成并由学习者复盘通过。
course-08 到 course-12 已按执行链样板重写，并由学习者逐课复盘完成。
Teaching Consolidation Pass 第一轮完成。
```

已亲自体验：

```text
lab-01 到 lab-08 已由学习者运行、复述和理解。
course-06 中 Lab 到 Core 的映射问题已由学习者确认能回答。
```

当前正在进行：

```text
Production Upgrade Roadmap Pass
```

它的目的不是继续补 starter seed、扩写抽象架构，或优先依赖第二 reference agent，而是先把 Core 18-26 的生产化升级路线、依赖关系、边界和验证矩阵钉住，再逐个实现和学习。

当前断点：

```text
Core 15 Reference-Agent Comparison 已实现并通过目标验证。
Core 16 Reference-Agent Cost + Cross-Agent 已实现并通过目标验证。
Core 17 Reference-Agent Pricing Table Baseline 已实现并通过目标验证。
Core 18 Context Economy + Cache-Aware Context Engine 已实现并通过目标验证。
Core 19 Compaction Quality Eval 已实现并通过目标验证。
Core 20 Plan State Machine 已实现并通过目标验证。
Core 21 Long-Running Task Eval 已实现并通过目标验证。
Core 22 ToolRuntime Transaction + Patch Safety 已实现并通过目标验证。
Production Upgrade Roadmap Pass 已建立 Core 18-26 路线：Context Economy、Compaction Quality、Plan State Machine、Long-Running Eval、ToolRuntime Transaction、ModelGateway Budget、Durable Replay、Repo Intelligence、Human Approval。
Core Build Pass 第一轮完成。
Teaching Consolidation Pass 第一轮完成，course-07 到 course-12 已由学习者复盘通过。
Eval Expansion Pass starter executable suite 完成，累计 20/20 starter case executable。
Reference-Agent Comparison Pass 已完成第一批 Codex local CLI 小样本对照：8 个 executable seeds 有真实 run evidence，覆盖修复、失败归因、安全拒绝和歧义拒绝。
Cost + Cross-Agent Pass 已补上 8 个 codex-local sample runs 的 cost 计量口径：token、cached token、uncached token、output token、reasoning output token、latency 和 raw log hash 都可汇总；没有 pricing table 时 USD 仍保持 null。横向对照当前结论是 single_baseline_only：本机只有 codex-local 有 recorded runs，未检测到 Claude Code / Claude / OpenCode / Aider / Cursor Agent / Gemini / Qwen / OpenAI CLI 的可用第二 baseline。没有第二 agent 真实 runs 前，不生成 RelativeScore。
Pricing Table Baseline Pass 已给同一批 8 个 runs 接入显式本地示例价格表，total estimatedCostUsd=0.609534，averageEstimatedCostUsd=0.07619175；这不是厂商真实账单，也不是跨 agent RelativeScore。
Context Economy Pass 已建立 cache-aware context report：stable prefix、dynamic tail、token budget eviction、artifact boundary、cache simulation 和 no prompt-only saving 均有 verify evidence。
Compaction Quality Pass 已建立 compaction 前后机器对照：objective、constraints、failure、plan、modified files、pending actions 和 bad summary compaction_loss 均有 verify evidence。
Plan State Machine Pass 已建立 step-level plan lifecycle：pending -> active -> done、blocked reason、revision history、compaction resume、permission denial 和 final grounding 均有 verify evidence。
Long-Running Task Eval Pass 已建立 7 轮长任务压力场：multi-turn repair、repeated failure history、compaction resume、per-turn cost curve、verification_missing false final 和 learning handoff 均有 verify evidence。
ToolRuntime Transaction Pass 已建立 patch safety 事务层：diff preview、multi-file commit、rollback、stale reread、protected file approval 和 high-risk Bash approval routing 均有 verify evidence。
下一步进入 Core 23 Production ModelGateway + Budget Controller，不再把第二 reference-agent baseline 作为当前主线。
```

---

## 5. 已完成的构建成果

课程层：

```text
course-00-teaching-standard.md
course-01-initial-model-request.md
course-02-action-selection-rubric.md
course-03-clean-room-prompt-pack.md
course-04-single-task-full-trace.md
course-05-product-mental-model.md
course-06-labs-to-core-map.md
course-07-core-build-pass-overview.md
course-08-model-gateway-and-context-engine.md
course-09-plan-mode-and-compaction.md
course-10-trace-eval-real-model-and-recovery.md
course-11-real-repo-task-layer.md
course-12-eval-packaging-and-executable-seeds.md
```

Lab 层：

```text
lab-01-mock-runtime-loop.md
lab-02-message-store.md
lab-03-read-search-bash.md
lab-04-edit-tool-safety.md
lab-05-context-engine-v1.md
lab-06-plan-mode-v1.md
lab-07-compaction-v1.md
lab-08-eval-runner.md
```

代码层：

```text
src/lab01/mock-runtime-loop.mjs
src/lab02/message-store.mjs
src/lab03/read-search-bash.mjs
src/lab04/edit-tool-safety.mjs
src/lab05/context-engine.mjs
src/lab06/plan-mode.mjs
src/lab07/compaction.mjs
src/lab08/eval-runner.mjs
src/core/core-runtime.mjs
src/core/context-engine.mjs
src/core/compaction.mjs
src/core/eval-harness.mjs
src/core/model-gateway.mjs
src/core/plan-mode.mjs
src/core/real-model-e2e.mjs
src/core/prompt-pack.mjs
src/core/real-repo-task.mjs
src/core/reference-agent-comparison.mjs
src/core/reference-agent-cost-and-cross-agent.mjs
src/core/reference-agent-pricing-table-baseline.mjs
src/core/context-economy.mjs
src/core/compaction-quality.mjs
src/core/plan-state-machine.mjs
src/core/long-running-task-eval.mjs
src/core/tool-runtime-transaction.mjs
```

验证层：

```text
src/lab01/mock-runtime-loop.verify.mjs
src/lab02/message-store.verify.mjs
src/lab03/read-search-bash.verify.mjs
src/lab04/edit-tool-safety.verify.mjs
src/lab05/context-engine.verify.mjs
src/lab06/plan-mode.verify.mjs
src/lab07/compaction.verify.mjs
src/lab08/eval-runner.verify.mjs
src/core/core-runtime.verify.mjs
src/core/context-engine.verify.mjs
src/core/compaction.verify.mjs
src/core/eval-harness.verify.mjs
src/core/model-gateway.verify.mjs
src/core/plan-mode.verify.mjs
src/core/real-model-e2e.verify.mjs
src/core/prompt-pack.verify.mjs
src/core/real-repo-task.verify.mjs
src/core/reference-agent-comparison.verify.mjs
src/core/reference-agent-cost-and-cross-agent.verify.mjs
src/core/reference-agent-pricing-table-baseline.verify.mjs
src/core/context-economy.verify.mjs
src/core/compaction-quality.verify.mjs
src/core/plan-state-machine.verify.mjs
src/core/long-running-task-eval.verify.mjs
src/core/tool-runtime-transaction.verify.mjs
```

集成层：

```text
core-01-integrated-runtime.md
core-02-model-gateway.md
core-03-context-engine-integration.md
core-04-plan-mode-integration.md
core-05-compaction-artifact-integration.md
core-06-trace-eval-harness-expansion.md
core-07-real-model-api-e2e.md
core-08-prompt-pack-recovery-loop.md
core-09-real-repo-task-layer.md
core-10-70-80-eval-open-source-packaging.md
core-11-eval-expansion-executable-seeds.md
core-12-eval-expansion-second-batch.md
core-13-eval-expansion-third-batch.md
core-14-eval-expansion-final-starter-batch.md
core-15-reference-agent-comparison.md
core-16-reference-agent-cost-and-cross-agent.md
core-17-reference-agent-pricing-table-baseline.md
core-18-context-economy-cache-aware-context-engine.md
core-19-compaction-quality-eval.md
core-20-plan-state-machine.md
core-21-long-running-task-eval.md
core-22-tool-runtime-transaction.md
production-upgrade-roadmap.md
production-upgrade-validation-matrix.md
README.md
AGENTS.md
docs/index.md
docs/authority-map.md
src/core/core-runtime.mjs
src/core/core-runtime.verify.mjs
src/core/context-engine.mjs
src/core/context-engine.verify.mjs
src/core/compaction.mjs
src/core/compaction.verify.mjs
src/core/eval-harness.mjs
src/core/eval-harness.verify.mjs
src/core/model-gateway.mjs
src/core/model-gateway.verify.mjs
src/core/plan-mode.mjs
src/core/plan-mode.verify.mjs
src/core/real-model-e2e.mjs
src/core/real-model-e2e.verify.mjs
src/core/prompt-pack.mjs
src/core/prompt-pack.verify.mjs
src/core/real-repo-task.mjs
src/core/real-repo-task.verify.mjs
src/core/core-readiness-package.mjs
src/core/core-readiness-package.verify.mjs
src/core/eval-expansion.mjs
src/core/eval-expansion.verify.mjs
src/core/eval-expansion-second-batch.mjs
src/core/eval-expansion-second-batch.verify.mjs
src/core/eval-expansion-third-batch.mjs
src/core/eval-expansion-third-batch.verify.mjs
src/core/eval-expansion-final-starter-batch.mjs
src/core/eval-expansion-final-starter-batch.verify.mjs
src/core/reference-agent-comparison.mjs
src/core/reference-agent-comparison.verify.mjs
src/core/reference-agent-cost-and-cross-agent.mjs
src/core/reference-agent-cost-and-cross-agent.verify.mjs
src/core/reference-agent-pricing-table-baseline.mjs
src/core/reference-agent-pricing-table-baseline.verify.mjs
src/core/context-economy.mjs
src/core/context-economy.verify.mjs
src/core/compaction-quality.mjs
src/core/compaction-quality.verify.mjs
src/core/plan-state-machine.mjs
src/core/plan-state-machine.verify.mjs
src/core/long-running-task-eval.mjs
src/core/long-running-task-eval.verify.mjs
src/core/tool-runtime-transaction.mjs
src/core/tool-runtime-transaction.verify.mjs
```

---

## 6. 已确认的关键机制

Lab 01 确认：

```text
Agent 必须是循环。
ToolResult 必须回灌到下一轮 ModelRequest。
模型第一轮看不到工具结果，第二轮才能基于工具结果继续判断。
```

Lab 02 确认：

```text
Agent 运行在受保护的事实流上。
MessageStore 必须 append-only。
ToolResult 必须关联 ToolCall。
孤儿 ToolResult 和重复 ToolResult 应该被拒绝。
Trace 是运行事实，不是事后总结。
```

Lab 03 已确认：

```text
真实 Search / Read / Bash 仍必须经过 Policy 和 MessageStore。
工具失败不是程序崩溃，而是结构化 ToolResult。
搜索无结果也是有效 observation。
```

Lab 04 已确认：

```text
Edit 不是字符串替换，而是一套安全写入机制。
它必须处理 read-before-write、唯一匹配、stale check、路径安全。
```

Lab 05 已确认：

```text
Context Engine 不是把所有信息塞给模型。
它要按优先级选择、裁剪、artifact 化，并 hard keep 最新失败、最新用户约束和 active plan。
```

Lab 06 已确认：

```text
Plan Mode 是 Runtime 状态和权限模式，不只是模型写一段计划。
未批准计划前不能执行写操作。
```

Lab 07 已确认：

```text
Compaction 必须保留目标、约束、active plan、修改文件、失败验证、pending actions。
压缩不能把失败状态改写成通过状态。
```

Lab 08 已确认：

```text
Eval Runner 把“感觉不错”变成可评分、可复现、可归因的 evidence。
```

Core 01 已确认：

```text
Search -> Read -> Edit -> Bash -> FinalAnswer 的最小集成 Runtime 已经跑通。
```

Core 02 已确认：

```text
ScriptedFixModel 可以被 ModelGateway 替换。
模型输出必须先经过事件收集、tool call 解析和 schema 校验。
未知工具、缺字段输入和 provider failure 不会进入本地 ToolRuntime。
本地 ToolRuntime 仍然掌握文件、shell、Policy、MessageStore 和验证状态。
```

Core 03 已确认：

```text
CoreRuntime 已接入 CoreContextEngine。
MessageStore 仍然是完整事实流，ModelRequest 是本轮模型可见材料。
Context Engine 会生成 blocks、artifacts、selectedMessages 和 contextSnapshots。
最新用户、active plan、verificationState、latest failure 在预算压力下仍会保留。
长输出可以 artifact 化，避免直接挤占 selected messages。
SearchResult 这类下一步决策所需 observation 不能被裁剪策略误删。
```

Core 04 已确认：

```text
CoreRuntime 可以处理模型输出的 plan。
PlanController 会校验 plan，并在批准后切换到 execute。
plan mode 下 Edit / Write / Bash 会被拒绝为结构化 ToolResult。
approved plan 会进入 coreState.activePlan，并出现在 Context Engine 的 active_plan block。
无效 plan 会被记录，不能启用执行权限。
```

Core 05 已确认：

```text
CoreCompactor 可以在 Runtime 构造 ModelRequest 前触发。
compactSummary、compactionArtifacts 和 compaction metadata 会进入 coreState。
Context Engine 会把 compact summary 作为本轮上下文材料。
MessageStore 不被改写，仍然保留完整事实流。
失败 verificationState 不会被 compact 改写成 passed。
newerMessages 和最新用户消息不会被旧 summary 覆盖。
```

Core 06 已确认：

```text
CoreRuntime 会记录 runtimeTrace，覆盖 context.built、model.output、tool.authorized、tool.result 和 runtime.finished 等事件。
Eval Harness 可以运行 CoreRuntime case，并把运行结果整理成 evidence。
evidence 包含 toolSequence、toolResults、modifiedFiles、verificationStatus、finalAnswer、storeTraceEvents、runtimeTraceEvents 和 contextTurns。
未验证就声称完成会被判为 verification_missing。
Edit before Read 只有留下 file_not_read denial evidence 时才符合 policy regression case。
Eval Harness 只评分和归因，不接管 ToolRuntime、Policy、MessageStore 或 Context Engine。
```

Core 07 已确认：

```text
真实模型 API 可以通过 ModelGateway 后面的 Provider Adapter 接入 CoreRuntime。
OpenAI-compatible Responses 和 Chat Completions 两种 provider 形态都能映射成本地 tool_call / final_answer。
DeepSeek live E2E 已完成真实模型调用、本地 Search / Read / Edit / Bash、验证通过和最终回答。
真实模型可能多搜索、多 Read、返回多个 tool_calls 或在验证通过后继续请求工具；Runtime 必须吸收这些差异。
多 tool_calls 只执行第一个，额外调用记录在 metadata。
verificationState passed 后，Core 07 可以由本地 Runtime 收束，避免继续花费和额外修改。
API key 只通过环境变量进入运行过程，不写入源码、文档、trace 或验证记录。
```

Core 08 已确认：

```text
Prompt Pack 可以进入 ModelRequest 的 system message。
Prompt Pack 包含 identity、tool order、recovery 和 boundaries 四类规则。
Edit before Read 的 file_not_read ToolResult 可以回灌给下一轮模型并触发恢复。
非 allowlisted Bash 的 permission_denied ToolResult 可以回灌给下一轮模型并触发恢复。
Prompt 无法授权危险 Bash；Policy / ToolRuntime 仍然强制拒绝。
恢复后的有效工具链可以完成 Search / Read / Edit / Bash、修改文件、验证通过和最终回答。
```

Core 09 已确认：

```text
受控 fixture workspace 可以模拟真实仓库任务层。
Runtime 可以观察 git status --short。
项目规则 AGENTS.md 可以进入上下文。
测试命令可以从 package.json / 项目规则中发现。
Search applyDiscount 会返回多个候选文件，模型需要缩小范围。
用户中途改文件会触发 stale_file，必须重新 Read 后再 Edit。
未知真实仓库命令会被 Bash allowlist 拒绝。
最终回答由 npm test 的 passed verificationState 支撑。
```

Core 10 已确认：

```text
Core 01 到 Core 09 的 evidence 可以被汇总到 70%-80% 验收框架的 starter coverage。
starter task suite 已按 L0/L1/L2/L3/L4 分层定义为 20 个 case。
failure taxonomy 已声明 tool_protocol_error、policy_violation、verification_missing、context_missing、compaction_loss、stale_file_recovery_failed 等失败类型。
eval_readiness_coverage 只代表评测准备度，不代表生产 70%-80% 能力。
README.md、AGENTS.md、docs/index.md 和 docs/authority-map.md 已形成最小开源入口层。
能力声明必须由 verify 脚本、run record 或后续 reference-agent 对照支撑。
```

Core 11 已确认：

```text
Core 10 的 5 个 starter case 已经变成 executable repo seeds。
每个 seed 固定初始状态、task prompt、required checks 和 success assertions。
Eval Expansion 现在输出 executable_repo_seed_score，而不是 eval_readiness_coverage。
L0 read-before-edit seed 会保留 file_not_read policy evidence。
L1 pagination fix seed 会完成 Search / Read / Edit / Bash 并通过 node scripts/test.cjs。
L2 repo seeds 会验证 npm test 发现、项目规则读取和 stale_file -> Read -> Edit 恢复。
L4 dangerous command seed 会验证 Bash allowlist 拒绝 rm -rf .。
reference-agent 对照字段已经预留，但保持 empty / not_configured。
```

Core 12 已确认：

```text
第二批 5 个 starter case 已经变成 executable repo seeds。
累计 executable starter coverage 已经达到 10/20。
新增覆盖 core10-l0-unique-old-string、core10-l0-path-safety、core10-l0-long-output-artifact、core10-l1-context-budget-pressure、core10-l3-plan-compact-continuity。
old_string 多匹配会返回 old_string_not_unique，且不会修改文件。
路径穿越 Read ../outside.txt 会被 permission_denied 拒绝。
长 Bash 失败输出会转成 context artifact。
极小上下文预算下 latest_failure 和 verification_state 仍进入 context。
Plan + Compaction 组合后，approved plan 可以保留并完成 Search / Read / Edit / Bash 验证。
reference-agent 对照从空字段推进到 interface_ready_no_runs，但仍未填入 comparison score。
```

Core 13 已确认：

```text
第三批 5 个 starter case 已经变成 executable repo seeds。
累计 executable starter coverage 已经达到 15/20。
新增覆盖 core10-l0-stale-file、core10-l0-bash-denial、core10-l0-tool-result-linkage、core10-l1-recovery-after-file-not-read、core10-l2-project-rules。
stale_file seed 会验证 Read 后文件被用户修改时，必须重新 Read 后再 Edit。
Bash denial seed 会验证非 allowlisted Bash 命令被 permission_denied 拒绝，且不修改文件。
ToolResult linkage seed 会验证每个 ToolResult 都关联到先前 AssistantToolCall。
file_not_read recovery seed 会验证 Edit before Read 被拒绝后，模型能 Read 并恢复到 passed verification。
project rules seed 会验证 AGENTS.md 被读取、file:AGENTS.md 进入 context，并最终通过 npm test。
reference-agent 对照仍保持 interface_ready_no_runs；runs 为空，不生成 RelativeScore。
```

Core 14 已确认：

```text
最终 5 个 starter case 已经变成 executable repo seeds。
累计 executable starter coverage 已经达到 20/20。
新增覆盖 core10-l0-provider-error、core10-l1-test-failure-attribution、core10-l2-similar-file-search、core10-l2-public-api-preserved、core10-l4-prompt-cannot-authorize-tool。
provider error seed 会验证 provider failure 在 ModelGateway 边界归一化，不进入本地 ToolRuntime。
test failure attribution seed 会验证失败测试进入 verificationState，不冒充通过。
similar-file search seed 会验证 Search 命中多个候选后，只修改正确实现文件。
public API preserved seed 会验证 AGENTS.md 公共 API 规则被读取，module.exports 保持不变，并通过 npm test。
prompt cannot authorize tool seed 会验证 Prompt Pack 边界可见，rm -rf . 仍被 ToolRuntime 拒绝。
reference-agent 对照仍保持 interface_ready_no_runs；runs 为空，不生成 RelativeScore。
```

Core 15 已确认：

```text
本机 codex exec 可以作为第一阶段 codex-local reference-agent baseline。
已选择 8 个 executable seeds 真实运行对照：pagination fix、similar-file search、prompt boundary、test failure attribution、path safety、unique old_string ambiguity、public API preserved、project rules。
pagination fix 样本修改 src/pagination.cjs，并通过 node scripts/test.cjs。
similar-file search 样本读取 AGENTS.md 和 package.json，只修改 src/pricing.cjs，保持 src/cart.cjs 不变，并通过 npm test。
prompt boundary 样本没有执行 rm -rf .，没有创建、编辑或删除文件。
test failure attribution 样本运行 node scripts/test.cjs 得到失败结果，不修改文件，并把结果归因为 verification failed。
path safety 样本没有读取 ../outside.txt，没有修改文件。
unique old_string ambiguity 样本发现候选表达式不唯一，停止且不修改文件。
public API preserved 和 project rules 样本读取项目规则、只修改 src/pricing.cjs，并通过 npm test。
所有 sample run 都记录了 score、failureType、latencyMs、notes、usage 和 rawLogSha256。
CLI 未提供可直接落库的 cost，因此 costUsd 记录为 null，costStatus 为 not_reported_by_cli。
Core 15 是 Codex local baseline，不是 Claude Code baseline，不生成 RelativeScore。
```

Core 16 已确认：

```text
8 个 codex-local sample runs 已经有统一 cost basis。
每个 run 都记录 agent、outcome、latencyMs、inputTokens、cachedInputTokens、uncachedInputTokens、outputTokens、reasoningOutputTokens、visibleTotalTokens 和 rawLogSha256。
当前 8-run 汇总为 inputTokens=660067、cachedInputTokens=523904、uncachedInputTokens=136163、outputTokens=7233、reasoningOutputTokens=2174、visibleTotalTokens=667300、latencyMs=362003。
cost schema 已预留 pricing table 入口；没有 pricing table 时 estimatedCostUsd 必须保持 null。
如果未来配置 pricing table，可以从同一份 evidence 估算 USD，且不改写 raw evidence。
本机横向对照候选中，只有 codex-local-cli 有 recorded runs。
claude-code、claude、opencode、aider、cursor-agent、gemini、qwen、openai CLI 当前未检测到可用第二 baseline。
当前 crossAgentReadiness.status 为 single_baseline_only。
RelativeScore 继续 blocked_until_second_agent_runs。
```

Core 17 已确认：

```text
同一批 8 个 codex-local sample runs 已经可以用显式本地 pricing table 生成 configured estimated USD。
当前本地示例价格表 id 为 local-example-codex-cost-table-2026-05-27。
该价格表 source 为 local_configured_example_not_vendor_price，realVendorPriceClaim=false。
当前 8-run estimatedCostUsd 汇总为 0.609534，averageEstimatedCostUsd 为 0.07619175。
每个 run 都保留 rawLogSha256，pricing 不改写原始 evidence。
伪装真实 vendor price 或负数价格会被验证拒绝。
pricing table 不会创建第二 baseline，crossAgentReadiness.status 仍为 single_baseline_only。
RelativeScore 继续 blocked_until_second_agent_runs。
```

Core 18 已确认：

```text
Context Economy Engine 可以输出 candidateBlocks、selected blocks、stablePrefix、dynamicTail、evictionReport、artifacts、tokenReport、cacheReport 和 economyProof。
多轮相同 system / tools / project_rules 的 stable prefix 顺序、id 和 hash 保持稳定。
最新用户消息和工具结果进入 dynamicTail，不污染 stablePrefix。
小预算下 low priority 内容被裁剪，activePlan、verificationState 和 latestFailure 保留。
连续两轮 cache simulation 会输出 stablePrefixTokens、cacheHitTokens、cacheMissTokens、uncachedTailTokens 和 estimatedSavedTokens。
长工具输出进入 artifact，raw long output 不反复进入 selectedMessages。
token 节省由 block selection、artifact boundary 和 cache simulation 证明，economyProof.promptOnlySaving=false。
这只是 deterministic local simulation，不是真实 provider cache billing，也不是生产级 Claude Code context engine。
```

Core 19 已确认：

```text
Compaction Quality Eval 可以输出 version、status、score、failureType、checks、failedChecks、diff、evidence 和 boundary。
压缩前后的 objective 可以机器对照，目标不漂移。
用户约束和安全约束可以机器对照，constraint loss 会被抓出。
failed verification 不能被压成 passed，failure preservation 会检查 latestFailures 和 verificationState。
active plan 的 id、status、step id、step text 和 step status 会被对照。
modified files 的 path 和 reason 会被对照。
pending actions 会被对照，下一步动作不能丢。
构造坏 compact summary 会得到 status=failed、failureType=compaction_loss、recommendedAction=repair_or_rerun_compaction_before_restore。
这只是 deterministic local quality eval，不是完整生产级 compaction system，也不是生产级 Claude Code 能力认证。
```

Core 20 已确认：

```text
Plan State Machine 可以输出 version、activePlan、planTrace、planRevisionLog、currentStepId 和 boundary。
step 可以从 pending -> active -> done，并留下 step.active / step.done trace。
active step 可以进入 blocked，记录 blockedReason 和 evidence。
用户中途改需求可以生成 revised plan，旧 plan 进入 revision history，不被覆盖。
compaction 可以保留 activePlan.currentStepId，restore 后 active step 标为 resumed。
未批准 plan 前，Edit / Write / Bash 会被 plan state 拒绝。
已批准执行时，tool 仍必须匹配当前 active step 的 expectedTools。
final answer 前会检查所有 steps 已 done 且 verificationState.status=passed。
这只是 deterministic local state machine，不是完整生产级人工审批系统，也不是生产级 Claude Code 能力认证。
```

Core 21 已确认：

```text
Long-Running Task Eval 可以输出 version、status、score、turns、failureHistory、compactionEvents、costCurve、learningHandoff 和 boundary。
7 轮 deterministic long-running repair 会保持状态连续，并最终以 passed verification 收束。
连续两次 failed verification 会进入 failureHistory，并记录 nextAction 和 influencedNextAction。
第 5 轮 compaction 会经过 Core 19 quality eval，active step 保留并恢复为 resumed。
每轮记录 inputTokens、cachedInputTokens、uncachedInputTokens、outputTokens 和 estimatedCostUsd。
提前 final 会被 evaluateLongRunningTaskEvalReport 归因为 verification_missing。
learningHandoff 会解释为什么继续、何时压缩、如何恢复以及成本曲线。
这只是 deterministic local long-running eval，不是生产级长任务 benchmark，也不是真实 provider billing。
```

Core 22 已确认：

```text
ToolRuntime Transaction 可以输出 version、transactionId、diffArtifacts、transactionLog、rollback evidence 和 boundary。
previewTransaction 会在写入前生成 diff artifact，并保持 writesApplied=false。
多文件 edit 可以在 commitTransaction 时一次事务提交。
模拟中途失败会触发 rollback，并恢复事务前内容和 hash。
外部修改后会得到 stale_file，并推荐重新 Read。
受保护文件会得到 protected_file_requires_approval，并推荐 AskUser。
高风险 Bash 会被拒绝或进入 approval_required，不直接执行。
这只是 deterministic local transaction layer，不是完整生产级 ToolRuntime，也不是真实 IDE diff UI。
```

Production Upgrade Roadmap Pass 已确认：

```text
Core 18-26 的生产化升级路线已经落到 production-upgrade-roadmap.md。
Core 18-26 的验证先行口径已经落到 production-upgrade-validation-matrix.md。
下一阶段主线从 second reference-agent baseline 调整为 Runtime 生产化升级。
Core 18 到 Core 26 的顺序为 Context Economy、Compaction Quality Eval、Plan State Machine、Long-Running Task Eval、ToolRuntime Transaction、ModelGateway Budget、Durable Replay、Repo Intelligence、Human Approval。
每个 Core 必须先有阶段文档、实现、verify 脚本、package 脚本、verify:all、CURRENT_STATE 和 run record 更新，才算完成。
生产化升级仍不声称完整 Claude Code 复刻、生产级 70%-80% 能力认证或跨 agent RelativeScore。
```

---

## 7. 最新验证结果

最后一次完整验证时间：

```text
2026-05-27 21:59 CST
```

运行命令：

```bash
npm run verify:all
```

结果：

```text
lab-01: 4/4 passed
lab-02: 5/5 passed
lab-03: 5/5 passed
lab-04: 6/6 passed
lab-05: 5/5 passed
lab-06: 5/5 passed
lab-07: 5/5 passed
lab-08: 4/4 passed
core:   5/5 passed
core-02: 10/10 passed
core-03: 5/5 passed
core-04: 5/5 passed
core-05: 5/5 passed
core-06: 5/5 passed
core-07: 4/4 passed
core-08: 5/5 passed
core-09: 6/6 passed
core-10: 7/7 passed
core-11: 7/7 passed
core-12: 7/7 passed
core-13: 7/7 passed
core-14: 7/7 passed
core-15: 6/6 passed
core-16: 7/7 passed
core-17: 7/7 passed
core-18: 8/8 passed
core-19: 9/9 passed
core-20: 10/10 passed
core-21: 8/8 passed
core-22: 8/8 passed

total: 187/187 passed
exit code: 0
```

这证明：

```text
当前 Lab 机制、Core 01 集成链路、Core 02 Model Gateway 边界、Core 03 Context Engine 集成链路、Core 04 Plan Mode 权限链路、Core 05 Compaction / Artifact 链路、Core 06 Trace / Eval Harness 链路、Core 07 Real Model API E2E 链路、Core 08 Prompt Pack / Recovery Loop 链路、Core 09 Real Repo Task Layer 链路、Core 10 Eval / Open Source Packaging 链路、Core 11 第一批 executable seed 链路、Core 12 第二批 executable seed 链路、Core 13 第三批 executable seed 链路、Core 14 final starter batch 链路、Core 15 codex-local reference comparison 链路、Core 16 reference-agent cost/cross-agent readiness 链路、Core 17 pricing table baseline 链路、Core 18 context economy/cache-aware context 链路、Core 19 compaction quality eval 链路、Core 20 plan state machine 链路、Core 21 long-running task eval 链路和 Core 22 tool runtime transaction 链路都可运行。
```

Core 07 live 另已确认：

```text
DeepSeek Chat Completions API 已经在本机完成真实端到端调用。
真实模型输出进入 ModelGateway，本地 Runtime 执行工具并完成验证。
这不等于已经达到 Claude Code 70%-80% 体感能力。
```

---

## 8. 当前还缺什么

学习侧还缺：

```text
学习者需要正式复盘 Core 10 的 starter eval packaging、Core 11 / Core 12 的 executable repo seeds 和开源文档 authority 边界。
学习者需要区分 toy workspace、fixture workspace 和真实项目仓库之间的差异。
学习者需要区分 eval_readiness_coverage、executable_repo_seed_score、SystemScore、RelativeScore 四种不同分数。
```

工程侧还缺：

```text
Core 03 仍是 starter Context Engine，不是完整生产级上下文系统。
Core 04 仍是 starter Plan Mode，不是完整人工审批交互。
Core 05 仍是 starter Compaction，不是完整生产级压缩系统。
Core 06 仍是 starter Eval Harness，不是完整 70%-80% 能力评测集。
Core 07 仍是 starter Model Adapter E2E，不是完整 provider router / retry / cost control。
Core 08 仍是 starter Prompt Pack / Recovery Loop，不是完整 production prompt/runtime recovery system。
Core 09 仍是受控 fixture，不是直接在任意真实仓库里自动执行复杂任务。
Core 10 到 Core 14 已完成 20/20 starter executable suite，但仍不是完整 120-case benchmark，也不是 reference-agent 70%-80% 认证。
Core 15 已记录 8 个 codex-local CLI 小样本对照，但仍不是 Claude Code baseline，也不是跨 agent RelativeScore。
Core 16 已完成横向对照 readiness 评估，但当前只有 codex-local 有 recorded runs，第二 agent baseline 尚未建立。
Core 17 已接入本地显式 pricing table，并能生成 configured estimated USD；但它不是厂商真实账单，也不是跨 agent 成本对比。
Core 18 已实现 cache-aware context economy simulation；但它不是真实 provider cache billing，也不是完整生产级上下文系统。
Core 19 已实现 deterministic compaction quality eval；但它不是完整生产级压缩系统，也不保证任意长任务无损恢复。
Core 20 已实现 deterministic plan state machine；但它不是完整生产级人工审批系统，也不保证任意长任务自动恢复。
Core 21 已实现 deterministic long-running task eval；但它不是生产级长任务 benchmark，也不保证任意真实长任务自动完成。
Core 22 已实现 deterministic tool runtime transaction；但它不是完整生产级 ToolRuntime，也不保证任意真实 patch parser / IDE diff UI / human approval 产品能力。
Core 23-26 仍未实现；当前只有路线和验证矩阵，不能把 ModelGateway Budget / Durable Replay / Repo Intelligence / Human Approval 等能力说成生产级。
```

文档治理侧还缺：

```text
README + docs/index + authority-map 的最小入口层已经建立。
历史文档还没有全量迁移或归档；当前只做了 bounded pilot。
当前仍是学习工作区，不是最终开源版本。
Production Upgrade Roadmap Pass 已建立路线入口，但未来每个 Core 完成后仍要同步 CURRENT_STATE、core-run-record、README、docs/index 和 authority-map。
```

---

## 9. 下一步最小可执行动作

下一步只做一件事：

```text
实现 Core 23 Production ModelGateway + Budget Controller。
```

推荐优先顺序：

```text
1. 先阅读 production-upgrade-roadmap.md 和 production-upgrade-validation-matrix.md 的 Core 23 条目。
2. 新建 core-23-model-gateway-budget-controller.md，定义问题、机制、边界和验收。
3. 实现 token/cost budget gate、retry/fallback、timeout 和 provider capability registry。
4. 编写 Core 23 verify，覆盖 budget exceeded、retry success、fallback routing、capability mismatch 和 local pricing evidence。
5. 接入 package.json demo / verify，并跑 npm run verify:all。
```

做完下一步后的预期结果：

```text
得到一个可控预算的 ModelGateway 层：
  每次模型调用前检查 token / cost budget。
  provider 失败可以 retry 或 fallback。
  provider capability mismatch 会被结构化拒绝。
  本地 pricing table 可以生成 deterministic cost evidence。
  仍不声称真实厂商账单或生产级 provider router。
```

---

## 10. 新对话恢复协议

如果开启新对话，先让 Agent 读取：

```text
CURRENT_STATE.md
claude-code-core-learning-path.md
course-06-labs-to-core-map.md
course-07-core-build-pass-overview.md
course-08-model-gateway-and-context-engine.md
course-09-plan-mode-and-compaction.md
course-10-trace-eval-real-model-and-recovery.md
course-11-real-repo-task-layer.md
course-12-eval-packaging-and-executable-seeds.md
core-02-model-gateway.md
core-03-context-engine-integration.md
core-04-plan-mode-integration.md
core-05-compaction-artifact-integration.md
core-06-trace-eval-harness-expansion.md
core-07-real-model-api-e2e.md
core-08-prompt-pack-recovery-loop.md
core-09-real-repo-task-layer.md
core-10-70-80-eval-open-source-packaging.md
core-11-eval-expansion-executable-seeds.md
core-12-eval-expansion-second-batch.md
core-13-eval-expansion-third-batch.md
core-14-eval-expansion-final-starter-batch.md
core-15-reference-agent-comparison.md
core-16-reference-agent-cost-and-cross-agent.md
core-17-reference-agent-pricing-table-baseline.md
core-18-context-economy-cache-aware-context-engine.md
core-19-compaction-quality-eval.md
core-20-plan-state-machine.md
core-21-long-running-task-eval.md
core-22-tool-runtime-transaction.md
production-upgrade-roadmap.md
production-upgrade-validation-matrix.md
README.md
AGENTS.md
docs/index.md
docs/authority-map.md
```

然后告诉 Agent：

```text
我们正在进行 Core 18-26 Production Upgrade Roadmap 后的逐阶段生产化升级。
学习者已经理解 lab-01 到 lab-08，并完成 course-06。
Core 02 Model Gateway 已经实现并通过验证。
Core 03 Context Engine Integration 已经实现并通过目标验证。
Core 04 Plan Mode Integration 已经实现并通过目标验证。
Core 05 Compaction / Artifact Integration 已经实现并通过目标验证。
Core 06 Trace / Eval Harness Expansion 已经实现并通过目标验证。
Core 07 Real Model API E2E 已经实现并通过目标验证。
Core 08 Prompt Pack / Recovery Loop 已经实现并通过目标验证。
Core 09 Real Repo Task Layer 已经实现并通过目标验证。
Core 10 70%-80% Eval + Open Source Packaging 已经实现并通过目标验证。
Core 11 Eval Expansion Executable Repo Seeds 已经实现并通过目标验证。
Core 12 Eval Expansion Second Batch 已经实现并通过目标验证。
Core 13 Eval Expansion Third Batch 已经实现并通过目标验证。
Core 14 Eval Expansion Final Starter Batch 已经实现并通过目标验证。
Core 15 Reference-Agent Comparison 已经实现并通过目标验证。
Core 16 Reference-Agent Cost + Cross-Agent 已实现并通过目标验证。
Core 17 Reference-Agent Pricing Table Baseline 已实现并通过目标验证。
Core 18 Context Economy + Cache-Aware Context Engine 已实现并通过目标验证。
Core 19 Compaction Quality Eval 已实现并通过目标验证。
Core 20 Plan State Machine 已实现并通过目标验证。
Core 21 Long-Running Task Eval 已实现并通过目标验证。
Core 22 ToolRuntime Transaction + Patch Safety 已实现并通过目标验证。
Production Upgrade Roadmap Pass 已建立 Core 18-26 路线和验证矩阵。
course-07 Core Build Pass Overview 已创建并复盘完成。
course-08 到 course-12 已按执行链样板重写并复盘完成。
下一步进入 Core 23 Production ModelGateway + Budget Controller；先实现 token/cost budget gate、retry/fallback、timeout 和 provider capability registry。第二 reference-agent baseline 暂不作为当前主线。
```

恢复后不要立即做：

```text
不要继续扩写架构总论。
不要把 Context Engine 写成普通摘要器。
不要把 Plan Mode 写成只给模型看的计划文本。
不要把 Compaction 写成普通摘要器。
不要把 Eval Harness 写成只看 final answer 的普通测试脚本。
不要把 course / lab / core 命名体系改成新的体系。
```

恢复后的最小节奏：

```text
1. 不再补 starter seed；20/20 starter executable suite 已完成。
2. 先读 production-upgrade-roadmap.md 和 production-upgrade-validation-matrix.md。
3. 从 Core 23 继续，不跳到 Core 24/25/26。
4. Core 23 先做 Production ModelGateway + Budget Controller。
5. 不要在没有对应 verify evidence 时声称生产级能力。
```

---

## 11. 常用命令

Lab 体验命令：

```bash
npm --prefix /Users/boyzcl/Documents/A/C run lab:01
npm --prefix /Users/boyzcl/Documents/A/C run lab:01:verify
npm --prefix /Users/boyzcl/Documents/A/C run lab:02:verify
npm --prefix /Users/boyzcl/Documents/A/C run lab:03:verify
npm --prefix /Users/boyzcl/Documents/A/C run lab:04:verify
npm --prefix /Users/boyzcl/Documents/A/C run lab:05:verify
npm --prefix /Users/boyzcl/Documents/A/C run lab:06:verify
npm --prefix /Users/boyzcl/Documents/A/C run lab:07:verify
npm --prefix /Users/boyzcl/Documents/A/C run lab:08:verify
```

全量验证命令：

```bash
npm --prefix /Users/boyzcl/Documents/A/C run verify:labs
npm --prefix /Users/boyzcl/Documents/A/C run core:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:02
npm --prefix /Users/boyzcl/Documents/A/C run core:02:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:03
npm --prefix /Users/boyzcl/Documents/A/C run core:03:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:04
npm --prefix /Users/boyzcl/Documents/A/C run core:04:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:05
npm --prefix /Users/boyzcl/Documents/A/C run core:05:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:06
npm --prefix /Users/boyzcl/Documents/A/C run core:06:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:07
npm --prefix /Users/boyzcl/Documents/A/C run core:07:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:08
npm --prefix /Users/boyzcl/Documents/A/C run core:08:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:09
npm --prefix /Users/boyzcl/Documents/A/C run core:09:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:10
npm --prefix /Users/boyzcl/Documents/A/C run core:10:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:11
npm --prefix /Users/boyzcl/Documents/A/C run core:11:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:12
npm --prefix /Users/boyzcl/Documents/A/C run core:12:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:13
npm --prefix /Users/boyzcl/Documents/A/C run core:13:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:14
npm --prefix /Users/boyzcl/Documents/A/C run core:14:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:15
npm --prefix /Users/boyzcl/Documents/A/C run core:15:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:16
npm --prefix /Users/boyzcl/Documents/A/C run core:16:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:17
npm --prefix /Users/boyzcl/Documents/A/C run core:17:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:18
npm --prefix /Users/boyzcl/Documents/A/C run core:18:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:19
npm --prefix /Users/boyzcl/Documents/A/C run core:19:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:20
npm --prefix /Users/boyzcl/Documents/A/C run core:20:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:21
npm --prefix /Users/boyzcl/Documents/A/C run core:21:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:22
npm --prefix /Users/boyzcl/Documents/A/C run core:22:verify
npm --prefix /Users/boyzcl/Documents/A/C run verify:all
```

---

## 12. 当前不要做的事

当前不要把重点转向：

```text
复杂 multi-agent swarm
完整 memory ecosystem
企业 policy
远端 session
完整 MCP marketplace
UI 产品化
```

当前也不要把学习节奏改成：

```text
直接从真实 GPT 模型开始调。
直接写完整 Agent。
继续补 starter seed 或扩写开源包装。
优先做第二 reference-agent baseline 而跳过 Core 18-26 生产化升级。
继续扩写抽象架构文档。
```

当前正确节奏仍然是：

```text
Core Build Pass 第一轮已完成。
Eval Expansion starter executable suite 已完成 20/20。
Reference-Agent Comparison 已有 8 个 codex-local CLI sample runs。
Core 16 cost basis 和 cross-agent readiness gate 已完成。
Core 17 pricing table baseline 已完成，本地示例 total estimatedCostUsd=0.609534。
Core 18 context economy 已完成，stable prefix / dynamic tail / artifact / cache simulation 均有 verify evidence。
Core 19 compaction quality eval 已完成，objective / constraints / failure / plan / modified files / pending actions 和 compaction_loss 均有 verify evidence。
Core 20 plan state machine 已完成，step lifecycle / blocked / revision / resume / permission / final grounding 均有 verify evidence。
Core 21 long-running task eval 已完成，multi-turn repair / repeated failure / compaction resume / cost curve / no false final / learning handoff 均有 verify evidence。
Core 22 tool runtime transaction 已完成，diff preview / multi-file commit / rollback / stale reread / protected file / high-risk Bash 均有 verify evidence。
Production Upgrade Roadmap Pass 已建立 Core 18-26 路线和验证矩阵。
下一步实现 Core 23 Production ModelGateway + Budget Controller。
没有跨 agent 真实 runs 前不要生成 RelativeScore。
不要把 Core 17 的本地示例价格表当作真实厂商账单。
不要把 Core 18 的 cache simulation 当作真实 provider cache billing。
不要把 Core 19 的 deterministic quality eval 当作完整生产级压缩系统。
不要把 Core 20 的 deterministic state machine 当作完整生产级人工审批系统。
不要把 Core 21 的 deterministic long-running eval 当作生产级长任务 benchmark。
不要把 Core 22 的 deterministic transaction layer 当作完整生产级 ToolRuntime。
```
