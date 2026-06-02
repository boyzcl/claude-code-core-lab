# CURRENT_STATE：Claude Code Core 学习项目当前状态

最后更新：2026-06-02 15:59 CST

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
在学习完成后，把这条学习过程整理成可开源、可复刻、可教学的公开学习路径。
```

当前产品目标不是完整复刻 Claude Code，而是先构建：

```text
Claude Code Core
```

它关注本地代码任务的核心闭环：

```text
User Goal
  -> Runtime Loop
  -> Context
  -> Model Decision
  -> Tool Call
  -> Policy
  -> ToolRuntime
  -> Observation
  -> State
  -> Plan
  -> Compaction
  -> Eval
  -> Product Surface
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
先用 core logic map 建立完整机制主线
再用 course 建立分段心智模型
再用 lab 体验单个机制
再用 core 集成最小产品骨架
最后用 verify / records / capstone 进入证据层
```

---

## 3. 文档体系当前角色

| 文档 | 当前角色 | Authority |
| --- | --- | --- |
| `CURRENT_STATE.md` | 当前状态入口、新对话接力、下一步动作 | 当前进度和下一步以本文为准 |
| `docs/course/claude-code-core-learning-path.md` | 学习总控 | 学习路线、阶段定义、命名规则 |
| `docs/course/course-00-teaching-standard.md` | 教学规范 | 说明如何避免隐式信息 |
| `docs/course/course-01-initial-model-request.md` | 课程 | 模型第一次被调用时看见什么 |
| `docs/course/course-02-action-selection-rubric.md` | 课程 | 动作选择如何判断“合理” |
| `docs/course/course-03-clean-room-prompt-pack.md` | 课程 | 公开学习边界下的提示词包（Prompt Pack）如何从运行时（Runtime）需求倒推 |
| `docs/course/course-04-single-task-full-trace.md` | 课程 | 单任务如何从用户输入跑到验证完成 |
| `docs/course/course-05-product-mental-model.md` | 课程 | 从用户、模型、运行时（Runtime）、工具和评测（Eval）五层理解产品 |
| `docs/course/course-06-labs-to-core-map.md` | 课程 | 8 个实验（Lab）如何映射成核心阶段（Core）产品骨架 |
| `docs/course/course-07-core-build-pass-overview.md` | 课程 | Core 01 到 Core 12 主体构建的教学总览 |
| `docs/course/course-08-model-gateway-and-context-engine.md` | 课程 | 模型网关（ModelGateway）与上下文引擎（Context Engine）如何控制模型输出和可见世界 |
| `docs/course/course-09-plan-mode-and-compaction.md` | 课程 | 计划模式（Plan Mode）与压缩（Compaction）如何让长任务受控不断片 |
| `docs/course/course-10-trace-eval-real-model-and-recovery.md` | 课程 | 轨迹 / 评测 / 真实模型 / 提示词恢复（Trace / Eval / Real Model / Prompt Recovery）如何让系统可证明、可恢复 |
| `docs/course/course-11-real-repo-task-layer.md` | 课程 | 真实仓库测试夹具（repo fixture）比玩具工作区（toy workspace）多证明了什么 |
| `docs/course/course-12-eval-packaging-and-executable-seeds.md` | 课程 | 评测打包（Eval packaging）与可执行种子（executable seeds）如何把能力证明体系落地 |
| `docs/course/course-13-eval-reference-cost-evidence.md` | 课程 | Core 13-17 的可执行任务集（executable suite）、参考智能体（reference-agent）、成本口径（cost basis）和定价边界（pricing boundary）执行链 |
| `docs/course/course-14-production-upgrade-evidence-chain.md` | 课程 | Core 18-26 生产化升级（Production Upgrade）如何形成本地确定性证据（deterministic local evidence）链 |
| `docs/course/course-15-context-compaction-plan-production.md` | 课程 | Core 18-20 的上下文经济（Context Economy）、压缩质量（Compaction Quality）、计划状态机（Plan State Machine）执行链 |
| `docs/course/course-16-long-running-tool-gateway-production.md` | 课程 | Core 21-23 的长任务评测（Long-Running Eval）、工具运行时事务（ToolRuntime Transaction）、模型网关预算（ModelGateway Budget）执行链 |
| `docs/course/course-17-session-repo-approval-production.md` | 课程 | Core 24-26 的持久会话（Durable Session）、仓库理解（Repo Intelligence）、人工批准（Human Approval）执行链 |
| `docs/course/course-18-product-surface-implementation-chain.md` | 课程 | Core 27-31 的设置、钩子、记忆、检查点、子代理（Settings / Hooks / Memory / Checkpoint / Subagent）产品表层执行链 |
| `docs/production-upgrade-terms-zh.md` | 术语参考 | 当前解释性文档的中文先行术语入口；文件名沿用生产化升级阶段的历史名称 |
| `docs/core-logic-map.md` | 核心逻辑总览 | 第一次理解 Claude Code-like Agent 完整机制链路；代码和 verify 只作为证据入口 |
| `docs/start-here-for-learners.md` | 学习者入口 | 第一次打开仓库时的学习路线和运行入口 |
| `docs/learning-plan.md` | 从零学习计划 | 面向第一次学习者的 30 分钟、半天和七节主线学习节奏 |
| `docs/troubleshooting.md` | 故障排查入口 | 学习者遇到安装、验证、live model、capstone starter 或公开入口同步问题时的排查顺序 |
| `exercises/README.md` | 练习入口 | Course / Lab / Core 之后的最小动手任务入口，不替代课程正文 |
| `projects/README.md` | 项目实践入口 | 端到端学习项目和 capstone 入口 |
| `solutions/README.md` | 参考解法入口 | 学习者先做练习后的参考答案，不替代 current rule 或 Core 证据 |
| `docs/open-source-boundary.md` | 开源边界 | 对外能力声明、公开学习边界和密钥（secret）边界 |
| `docs/github-release-checklist.md` | 开源检查表 | 发布到 GitHub 前的最小检查 |
| `docs/lab/lab-01-*` 到 `docs/lab/lab-08-*` | 可执行实验 | 每个实验（Lab）证明一个局部机制 |
| `docs/core/core-01-integrated-runtime.md` | 集成实现记录 | 证明多个实验（Lab）机制可以合成最小运行时（Runtime） |
| `docs/core/core-02-model-gateway.md` | 集成实现记录 | 证明模型层可以替换成模型网关（Model Gateway），且运行时 / 工具 / 策略（Runtime / Tool / Policy）边界不变 |
| `docs/core/core-03-context-engine-integration.md` | 集成实现记录 | 证明上下文引擎（Context Engine）可以接入 CoreRuntime，控制本轮模型可见世界 |
| `docs/core/core-04-plan-mode-integration.md` | 集成实现记录 | 证明计划模式（Plan Mode）可以接入 CoreRuntime，控制计划审批和工具权限 |
| `docs/core/core-05-compaction-artifact-integration.md` | 集成实现记录 | 证明压缩 / 附件（Compaction / Artifact）可以接入 CoreRuntime，保留长任务关键状态 |
| `docs/core/core-06-trace-eval-harness-expansion.md` | 集成实现记录 | 证明轨迹 / 评测框架（Trace / Eval Harness）可以接入 CoreRuntime，生成评分和失败归因证据 |
| `docs/core/core-07-real-model-api-e2e.md` | 集成实现记录 | 证明真实模型 API 可以接入模型网关（ModelGateway），且本地运行时（Runtime）边界不变 |
| `docs/core/core-08-prompt-pack-recovery-loop.md` | 集成实现记录 | 证明提示词包（Prompt Pack）可以引导模型恢复，但不能替代运行时（Runtime）强制边界 |
| `docs/core/core-09-real-repo-task-layer.md` | 集成实现记录 | 证明 CoreRuntime 可以处理真实仓库任务层的规则、测试、多文件和过期编辑（stale edit） |
| `docs/core/core-10-70-80-eval-open-source-packaging.md` | 集成实现记录 | 证明项目已有入门评测打包（starter eval packaging）和最小开源文档入口 |
| `docs/core/core-11-eval-expansion-executable-seeds.md` | 集成实现记录 | 证明第一批入门用例（starter case）可以变成可执行仓库种子（executable repo seeds） |
| `docs/core/core-12-eval-expansion-second-batch.md` | 集成实现记录 | 证明第二批入门用例（starter case）可以变成可执行仓库种子（executable repo seeds），并预留参考智能体运行器（reference-agent runner）接口 |
| `docs/core/core-13-eval-expansion-third-batch.md` | 集成实现记录 | 证明第三批入门用例（starter case）可以变成可执行仓库种子（executable repo seeds），累计 15/20 入门用例可执行（starter case executable） |
| `docs/core/core-14-eval-expansion-final-starter-batch.md` | 集成实现记录 | 证明剩余入门用例（starter case）可以变成可执行仓库种子（executable repo seeds），累计 20/20 入门用例可执行（starter case executable） |
| `docs/core/core-15-reference-agent-comparison.md` | 集成实现记录 | 证明本机 Codex CLI 可以作为第一阶段参考智能体基线（reference-agent baseline）产生小样本真实对照证据 |
| `docs/core/core-16-reference-agent-cost-and-cross-agent.md` | 集成实现记录 | 证明 8 个本机 Codex 运行（codex-local runs）已有成本（cost）计量口径，并明确横向对照仍被第二智能体基线（agent baseline）阻塞 |
| `docs/core/core-17-reference-agent-pricing-table-baseline.md` | 集成实现记录 | 证明显式本地价格表（pricing table）可以为 8 个本机 Codex 运行（codex-local runs）生成配置估算美元成本（configured estimated USD），同时不声称真实厂商账单 |
| `docs/core/core-18-context-economy-cache-aware-context-engine.md` | 集成实现记录 | 证明上下文经济引擎（Context Economy Engine）可以输出稳定前缀（stable prefix）、动态尾部（dynamic tail）、驱逐（eviction）、附件（artifact）和缓存模拟（cache simulation）证据 |
| `docs/core/core-19-compaction-quality-eval.md` | 集成实现记录 | 证明压缩质量评测（Compaction Quality Eval）可以机器对照压缩前后状态并识别压缩丢失（compaction_loss） |
| `docs/core/core-20-plan-state-machine.md` | 集成实现记录 | 证明计划状态机（Plan State Machine）可以追踪步骤生命周期（step lifecycle）、阻塞（blocked）、修订（revision）、恢复（resume）、权限（permission）和最终回答落地（final grounding） |
| `docs/core/core-21-long-running-task-eval.md` | 集成实现记录 | 证明长任务评测（Long-Running Task Eval）可以评估多轮修复、重复失败、压缩恢复、成本曲线和禁止虚假完成（no false final） |
| `docs/core/core-22-tool-runtime-transaction.md` | 集成实现记录 | 证明工具运行时事务（ToolRuntime Transaction）可以预览差异（diff）、多文件提交、回滚并拦截过期 / 受保护 / 高风险动作（stale / protected / high-risk） |
| `docs/core/core-23-model-gateway-budget-controller.md` | 集成实现记录 | 证明模型网关（ModelGateway）可以在服务商（provider）调用前执行令牌 / 成本预算闸门（token / cost budget gate），并记录重试 / 回退（retry / fallback）、能力过滤（capability filtering）和输出修复证据（output repair evidence） |
| `docs/core/core-24-durable-session-store-replay.md` | 集成实现记录 | 证明持久会话存储（Durable Session Store）可以记录只追加事件日志（append-only event log）、快照恢复（snapshot restore）、崩溃恢复（crash recovery）、轨迹回放（trace replay）、压缩审计（compaction audit）和密钥边界证据（secret boundary evidence） |
| `docs/core/core-25-repo-intelligence-relevance-index.md` | 集成实现记录 | 证明仓库理解（Repo Intelligence）可以记录仓库地图（repo map）、符号 / 测试 / 规则索引（symbol / test / rule index）、相关性评分（relevance scoring）、增量更新（incremental update）和令牌收益证据（token benefit evidence） |
| `docs/core/core-26-human-approval-interruption-protocol.md` | 集成实现记录 | 证明人工批准协议（Human Approval Protocol）可以记录需要批准（approval_required）、批准 / 拒绝路径（approve / reject path）、中断（interruption）、交接（handoff）和禁止隐藏执行证据（no hidden execution evidence） |
| `docs/core/core-27-settings-permission-resolver.md` | 集成实现记录 | 证明设置与权限解析器（Settings / Permission Resolver）可以把用户 / 项目 / 本地 / 策略（user / project / local / policy）配置解析为允许 / 询问 / 拒绝（allow / ask / deny），并记录规则来源、解析轨迹和决策缓存（ruleSource / resolverTrace / decisionCache）证据 |
| `docs/core/core-28-hooks-lifecycle.md` | 集成实现记录 | 证明钩子生命周期（Hooks Lifecycle）可以把用户提示、工具前、工具后钩子（user prompt / pre tool / post tool hooks）记录为可审计会话事件（session event）、受限观察（observation）、阻断决策和脱敏输出 |
| `docs/core/core-29-memory-source-auto-memory.md` | 集成实现记录 | 证明记忆来源 / 项目记忆 / 自动记忆（Memory Source / CLAUDE.md / Auto Memory）可以把长期记忆路由、写入索引、删除、重新验证并作为独立上下文来源（context source） |
| `docs/core/core-30-checkpoint-rewind.md` | 集成实现记录 | 证明检查点与回退（Checkpoint / Rewind）可以把恢复点绑定文件指纹（hash）、会话事件（session event）、外部改动冲突和审计回放（audit replay） |
| `docs/core/core-31-subagent-context-isolation.md` | 集成实现记录 | 证明子代理上下文隔离（Subagent Context Isolation）可以把委派任务（delegated task）、隔离上下文、结构化结果、去重账本（ledger）和审计回放（audit replay）串起来 |
| `docs/roadmap/production-upgrade-roadmap.md` | 生产化升级总控 | Core 18-26 的路线、依赖、边界和统一完成定义 |
| `docs/roadmap/production-upgrade-validation-matrix.md` | 验证矩阵 | Core 18-26 的验证先行口径和必过检查 |
| `docs/roadmap/product-surface-study-roadmap.md` | 产品表层学习总控 | Core 26 之后如何研究 Claude Code 产品工件，并判断补旧课还是新建 Core |
| `docs/roadmap/product-surface-validation-matrix.md` | 产品表层验证矩阵 | 新阶段的证据层级、同主题合并门、候选 Core 进入条件 |
| `docs/roadmap/product-surface-core-candidates.md` | 产品表层候选 Core Mini Brief | Settings、Hooks、Memory、Subagent、Checkpoint 是否值得独立成 Core 的评审 |
| `README.md` | 项目总入口 | 第一视觉机制图、学习入口、验证入口和当前边界 |
| `AGENTS.md` | Agent 控制入口 | Agent 工作规则、secret 边界和完成定义 |
| `docs/index.md` | 文档索引 | 区分当前规则、历史和证据 |
| `docs/authority-map.md` | authority map | 文档冲突优先级和 canonical doc 声明 |
| `docs/records/labs-verification-record.md` | 验证记录 | Lab 全量验证历史记录 |
| `docs/records/core-run-record.md` | 验证记录 | Core 集成验证历史记录 |
| `docs/reference/claude-code-agent-runtime-framework.md` | 架构参考 | 产品和运行时抽象 |
| `docs/reference/claude-code-core-implementation-blueprint.md` | 施工图参考 | 模块级实现规格 |
| `docs/reference/claude-code-70-80-validation-and-model-access.md` | 验收和模型接入参考 | 能力定义、评测、GPT / OpenAI-compatible API 接入 |
| `docs/reference/agent-runtime-optimization-loop.md` | 迭代参考 | trace、失败归因、eval、灰度和回归 |
| `docs/reference/code-agent-implementation-logic.md` | 当前综合文章 | 用中文优先术语讲清代码智能体（Code Agent）从运行时循环到产品表层边界的完整搭建逻辑 |
| `docs/reference/open-source-project-standards.md` | 开源项目规范参考 | 把优秀 GitHub 项目经验转译成本项目 README、reference、Issue、PR 和验证标准 |
| `docs/reference/core-runtime-object-map.md` | 运行时对象地图 | 把 Lab 01 到 Core 31 收束为少数运行时对象（Runtime object）和边界（boundary） |
| `docs/reference/claude-code-capability-coverage-matrix.md` | 官方能力覆盖矩阵 | 把 Claude Code 官方公开能力、本项目 Course / Lab / Core 转译、verify 证据和 out-of-scope 边界放在同一张表里 |
| `assets/diagrams/claude-code-core-mechanism.png` | README 第一视觉机制图 | 用 GPT 生成视觉底图和本地确定性标签排版展示完整机制链路，不作为官方架构图 |
| `docs/releases/v0.1-learning-preview.md` | release note | v0.1 learning preview 的发布说明，不替代当前状态或验证记录 |
| `CHANGELOG.md` | 变更记录 | 面向发布和治理变化的人工变更记录，不替代当前状态 |
| `scripts/check-doc-links.mjs` | 文档链接检查脚本 | 检查 Markdown 内部相对链接；外部链接只计数，不在 CI 中抓外网 |
| `.github/ISSUE_TEMPLATE/` / `.github/PULL_REQUEST_TEMPLATE.md` | GitHub 协作入口 | 把 bug、learning feedback 和 PR 变成可复现、可验证、守边界的协作对象 |

冲突处理：

```text
当前进度 / 下一步动作：CURRENT_STATE.md
学习顺序 / 命名规则：docs/course/claude-code-core-learning-path.md
课程正文：对应 course-XX 文档
实验机制：对应 lab-XX 文档和 src/labXX 代码
集成行为：docs/core/core-01-integrated-runtime.md 到 docs/core/core-31-subagent-context-isolation.md 和 src/core 代码
产品表层阶段：docs/roadmap/product-surface-study-roadmap.md、docs/roadmap/product-surface-validation-matrix.md、docs/roadmap/product-surface-core-candidates.md
历史观点：两篇原始分析文章只作背景材料
```

---

## 4. 当前学习进度

已完成理解和复习：

```text
course-01 到 course-06 已由学习者复习完成。
学习者已经能理解模型、运行时（Runtime）、工具（Tool）、策略（Policy）、状态（State）、上下文（Context）、计划（Plan）、压缩（Compaction）和评测（Eval）的基本循环关系。
```

当前教学整理：

```text
docs/course/course-07-core-build-pass-overview.md 已完成并由学习者复盘通过。
course-08 到 course-12 已按执行链样板重写，并由学习者逐课复盘完成。
docs/course/course-13-eval-reference-cost-evidence.md 已创建，用于补齐 Core 13-17 的可执行任务集（executable suite）、参考智能体基线（reference-agent baseline）、成本口径（cost basis）、价格表（pricing table）和相对分数（RelativeScore）阻塞边界。
docs/course/course-14-production-upgrade-evidence-chain.md 已创建，用于衔接 course-13，并讲清 Core 18-26 生产化升级（Production Upgrade）的阶段理由、生产化问题、证据链和不在当前范围（out-of-scope）边界。
docs/course/course-15-context-compaction-plan-production.md、docs/course/course-16-long-running-tool-gateway-production.md、docs/course/course-17-session-repo-approval-production.md 已创建，用于按 course-08 到 course-12 的同一执行链标准细读 Core 18-26 验证用例（verify case）。
docs/course/course-18-product-surface-implementation-chain.md 已创建，用于按同一执行链标准细读 Core 27-31 的设置与权限解析器（Settings / Permission Resolver）、钩子生命周期（Hooks Lifecycle）、记忆来源（Memory Source）、检查点与回退（Checkpoint / Rewind）和子代理上下文隔离（Subagent Context Isolation）。
docs/production-upgrade-terms-zh.md 已创建，用于把 Core 18-26 的英文代码术语翻译成中文机制解释。
docs/start-here-for-learners.md、docs/open-source-boundary.md、docs/github-release-checklist.md 已创建，用于开源前的学习者入口、能力声明边界和发布检查。
README.md 已按中文学习者第一屏重写：先说明这是围绕 Claude Code 核心机制的中文学习项目，再给运行命令、学习路线、项目结构、预期结果和能力边界。
根目录已瘦身，课程、Core、Lab、验证记录、参考资料和历史材料已移动到 docs/course、docs/core、docs/lab、docs/records、docs/reference、docs/history，并补充各目录 README。
Teaching Consolidation Pass 第一轮完成。
生产化升级教学整理（Production Upgrade Teaching Consolidation Pass）已完成总览课和三门细课整理；开源学习预览（Open Source Learning Preview）已同步 GitHub 并通过 CI；产品表层学习阶段准备（Product Surface Study Stage Preparation）已完成路线、验证矩阵、课程补充和候选 Core mini brief；产品表层教学整理（Product Surface Teaching Consolidation Pass）已完成 course-18 并同步导航入口。
开源项目规范整理（Open Source Project Standards Pass）已完成：新增 GitHub Issue / PR 模板、CHANGELOG、开源项目规范参考和核心运行时对象地图（Core Runtime Object Map），并同步 README、CONTRIBUTING、docs index、authority map、project structure 和 GitHub release checklist。
代码智能体实现逻辑（Code Agent Implementation Logic）Pass 已完成：新增 `docs/reference/code-agent-implementation-logic.md`，用中文优先术语、用户视角和 Claude Code 负责人视角，重新讲清代码智能体从最小运行时循环、工具安全、模型边界、上下文、计划、压缩、评测、真实仓库、生产化治理到产品表层运行时边界的搭建逻辑。
中文先行术语规范 Pass 已完成：`course-00` 已正式规定当前解释性文档采用中文在前、英文括注；`authority-map` 已登记该规则；`docs/production-upgrade-terms-zh.md` 已升级为当前解释性文档术语入口。历史材料、文件名、命令名、代码字段、错误码和 verify case 名不做机械改写。
从零学习计划（Learning Plan）Pass 已完成：新增 `docs/learning-plan.md`，把 README / 学习者入口 / Course 00-18 / Core verify 串成 30 分钟、半天和七节主线学习法，并同步 README、docs 入口、course README、authority-map 和项目结构说明。
公开学习实践层第一阶段（Complete Learning Pass Phase 1）已完成：新增 `docs/troubleshooting.md`，新增 `exercises/`、`projects/`、`solutions/` 最小结构，并补齐 `projects/capstone-mini-runtime/` 端到端学习任务；README、docs 入口、learning-plan、start-here、course README、authority-map、project-structure 和 GitHub release checklist 已同步入口。
公开传播专业化第二阶段（Professional Learning Preview Phase 2）已完成：新增 `docs/reference/claude-code-capability-coverage-matrix.md`，用官方公开文档来源把 Claude Code 能力、本项目 Course / Lab / Core 转译、verify 证据和 out-of-scope 边界对齐；README 新增 Runtime 闭环图；新增 `scripts/check-doc-links.mjs`、`npm run docs:links` 并接入 GitHub Actions；新增 `docs/releases/v0.1-learning-preview.md` release note。
v0.2 Core Logic Clarity Pass 已完成：新增 `docs/core-logic-map.md`，用中文先讲清 User Goal、Runtime Loop、Context、Model Decision、Tool Call、Policy、ToolRuntime、Observation、State、Plan、Compaction、Eval 和 Product Surface 的完整链路；README 第一视觉替换为 `assets/diagrams/claude-code-core-mechanism.png`；README、学习者入口、learning-plan、docs index、course README、authority-map 和 project-structure 已同步为“先理解机制逻辑，再看 verify 证据”的入口顺序。
```

已亲自体验：

```text
lab-01 到 lab-08 已由学习者运行、复述和理解。
course-06 中 Lab 到 Core 的映射问题已由学习者确认能回答。
```

当前状态：

```text
v0.2 Core Logic Clarity Pass 已完成
```

它的目的不是再新增 Core，而是把项目从“可运行、可验证”进一步整理成“逻辑主线清晰、首页一眼看懂”的公开学习项目：新用户先看机制图和核心逻辑总览，再进入 Course / Lab / Core 深入材料，最后用 verify、records 和 capstone 参考验证作为证据层。

当前断点：

```text
Core 15 参考智能体对照（Reference-Agent Comparison）已实现并通过目标验证。
Core 16 参考智能体成本与横向对照（Reference-Agent Cost + Cross-Agent）已实现并通过目标验证。
Core 17 参考智能体价格表基线（Reference-Agent Pricing Table Baseline）已实现并通过目标验证。
Core 18 上下文经济与缓存感知上下文引擎（Context Economy + Cache-Aware Context Engine）已实现并通过目标验证。
Core 19 压缩质量评测（Compaction Quality Eval）已实现并通过目标验证。
Core 20 计划状态机（Plan State Machine）已实现并通过目标验证。
Core 21 长任务评测（Long-Running Task Eval）已实现并通过目标验证。
Core 22 工具运行时事务与补丁安全（ToolRuntime Transaction + Patch Safety）已实现并通过目标验证。
Core 23 生产化模型网关与预算控制器（Production ModelGateway + Budget Controller）已实现并通过目标验证。
Core 24 持久会话存储与回放（Durable Session Store + Replay）已实现并通过目标验证。
Core 25 仓库理解与相关性索引（Repo Intelligence + Relevance Index）已实现并通过目标验证。
Core 26 人工批准与中断协议（Human Approval + Interruption Protocol）已实现并通过目标验证。
Core 27 设置与权限解析器（Settings / Permission Resolver）已实现并通过目标验证。
Core 28 钩子生命周期（Hooks Lifecycle）已实现并通过目标验证。
Core 29 记忆来源 / 项目记忆 / 自动记忆（Memory Source / CLAUDE.md / Auto Memory）已实现并通过目标验证。
Core 30 检查点与回退（Checkpoint / Rewind）已实现并通过目标验证。
Core 31 子代理上下文隔离（Subagent Context Isolation）已实现并通过目标验证。
Course 18 产品表层实现链（Product Surface Implementation Chain）已创建，用于把 Core 27-31 整理成和 course-14 到 course-17 一致的教学执行链。
生产化升级路线（Production Upgrade Roadmap）Pass 已建立 Core 18-26 路线：上下文经济、压缩质量、计划状态机、长任务评测、工具运行时事务、模型网关预算、持久回放、仓库理解、人工批准。
核心构建（Core Build）Pass 第一轮完成。
教学整理（Teaching Consolidation）Pass 第一轮完成，course-07 到 course-12 已由学习者复盘通过。
评测 / 参考运行 / 成本教学桥（Eval / Reference / Cost Teaching Bridge）已完成 course-13 整理：Core 13-17 被讲成 20/20 可执行任务集（executable suite）、本机 Codex 基线（codex-local baseline）、成本口径（cost basis）、定价边界（pricing boundary）和相对分数（RelativeScore）阻塞的证据桥（evidence bridge）。
生产化升级教学整理（Production Upgrade Teaching Consolidation Pass）已完成 course-14 到 course-17 整理：Core 18-26 被讲成上下文、压缩、计划、评测、工具运行时、模型网关、会话、仓库理解、人工批准（Context / Compaction / Plan / Eval / ToolRuntime / ModelGateway / Session / Repo Intelligence / Human Approval）的本地确定性证据（deterministic local evidence）链，并按 Core 18-20、Core 21-23、Core 24-26 拆成验证用例执行链（verify-case execution-chain）细课。
Production Upgrade 中文术语表已补充，课程阅读时先按中文理解，英文只用于对照代码字段和 verify case 名称。
Open Source Learning Preview docs 已补齐：LICENSE、CONTRIBUTING、SECURITY、CODE_OF_CONDUCT、.env.example、GitHub Actions verify workflow、学习者入口、开源边界、项目结构说明和 GitHub release checklist。
GitHub 展示层已按中文学习者视角重构：README 第一屏明确 Claude Code 学习对象，说明怎么运行、怎么学习、预期结果、项目结构和能力边界；根目录只保留入口文件，docs 分区承载课程和证据。
中文术语入口已前移：README、学习者入口、docs 入口和 Course 03 均采用中文先行；早期文件名里的英文标签只解释为公开学习边界，不再作为普通用户第一屏定位，也不作为运行时对象。
Markdown 链接轻量检查已通过：README/docs 内部 Markdown 链接无断链。
产品表层学习阶段准备（Product Surface Study Stage Preparation）已完成：已建立阶段总控、验证矩阵和候选 Core 迷你简报（mini brief）；Course 00 / Course 03 / Course 08 / Course 09 / Course 15-17 已补充产品表层材料归位规则。从 Claude Code 产品工件、系统提示词提取、源码映射（source map）观察和官方文档中学习时，必须先做证据层级（evidence tier）、同主题合并（same-topic merge）、运行时边界（runtime boundary）、验证形态（verify shape）和公开边界（public boundary）判断；同主题优先补回已有 course/core，只有新的运行时边界（Runtime boundary）才候选 Core 27+。
产品表层学习 Core 27 实现（Product Surface Study Core 27 Implementation）Pass 已完成：设置与权限解析器（Settings / Permission Resolver）先补实现级验证矩阵（validation matrix），再实现 permissionConfig、resolverTrace、ruleSource、decisionCache、允许 / 询问 / 拒绝（allow / ask / deny）、前缀命令规则（prefix command rule）和禁止隐藏执行证据（no hidden execution evidence）。Core 27 明确不重复 Core 22 事务（transaction）或 Core 26 批准决策（approval decision）。
产品表层学习 Core 28 实现（Product Surface Study Core 28 Implementation）Pass 已完成：钩子生命周期（Hooks Lifecycle）先补实现级验证矩阵（validation matrix），再实现 hookRegistry、hookEvent、hookDecision、hookFeedback、redactedHookOutput、工具前 / 工具后 / 用户钩子（pre / post / user hook）、钩子失败（hook failure）、密钥边界（secret boundary）和禁止隐藏执行证据（no hidden execution evidence）。Core 28 明确不重复 Core 24 持久存储（durable store）或 Core 26 批准决策（approval decision）。
产品表层学习 Core 29 实现（Product Surface Study Core 29 Implementation）Pass 已完成：记忆来源 / 项目记忆 / 自动记忆（Memory Source / CLAUDE.md / Auto Memory）先补实现级验证矩阵（validation matrix），再实现 memoryStore、memoryIndex、memoryType、memoryFreshnessCheck、forgetEvent、写入 / 索引（write / index）、遗忘（forget）、过期验证（stale verification）、压缩边界（compaction boundary）和禁止代码结构记忆证据（no code-structure memory evidence）。Core 29 明确不重复 Course 08/09 或 Core 18/19/24。
产品表层学习 Core 30 实现（Product Surface Study Core 30 Implementation）Pass 已完成：检查点与回退（Checkpoint / Rewind）先补实现级验证矩阵（validation matrix），再实现 checkpoint、rewindRequest、fileStateSnapshot、externalChangeConflict、rewindAudit、检查点创建（checkpoint creation）、回退状态（rewind state）、部分回退拒绝（partial rewind denial）、审计回放（audit replay）和事件日志边界证据（event log boundary evidence）。Core 30 明确不重复 Core 22 事务（transaction）或 Core 24 持久回放（durable replay）。
产品表层学习 Core 31 实现（Product Surface Study Core 31 Implementation）Pass 已完成：子代理上下文隔离（Subagent Context Isolation）先补实现级验证矩阵（validation matrix），再实现 delegatedTask、subagentContext、subagentResult、delegationLedger、isolationAudit、独立任务（independent task）、上下文隔离（context isolation）、禁止重复研究（no duplicate research）、结果契约（result contract）和失败传播证据（failure propagation evidence）。Core 31 明确不重复 Core 21 长任务评测（long-running eval）、Core 24 持久存储（durable store）或 Core 25 仓库理解（repo intelligence）。
产品表层教学整理（Product Surface Teaching Consolidation Pass）已完成：Course 00 / 03 / 08 / 09 / 15 / 16 / 17 的产品表层（Product Surface）补充已和 Core 27-31 边界对齐；Course 18 已新增为 Core 27-31 的执行链（execution-chain）细课；README、docs/index、authority-map、course README 和 CURRENT_STATE 已同步导航。
Eval Expansion Pass starter executable suite 完成，累计 20/20 starter case executable。
Reference-Agent Comparison Pass 已完成第一批 Codex local CLI 小样本对照：8 个 executable seeds 有真实 run evidence，覆盖修复、失败归因、安全拒绝和歧义拒绝。
Cost + Cross-Agent Pass 已补上 8 个 codex-local sample runs 的 cost 计量口径：token、cached token、uncached token、output token、reasoning output token、latency 和 raw log hash 都可汇总；没有 pricing table 时 USD 仍保持 null。横向对照当前结论是 single_baseline_only：本机只有 codex-local 有 recorded runs，未检测到 Claude Code / Claude / OpenCode / Aider / Cursor Agent / Gemini / Qwen / OpenAI CLI 的可用第二 baseline。没有第二 agent 真实 runs 前，不生成 RelativeScore。
Pricing Table Baseline Pass 已给同一批 8 个 runs 接入显式本地示例价格表，total estimatedCostUsd=0.609534，averageEstimatedCostUsd=0.07619175；这不是厂商真实账单，也不是跨 agent RelativeScore。
Context Economy Pass 已建立 cache-aware context report：stable prefix、dynamic tail、token budget eviction、artifact boundary、cache simulation 和 no prompt-only saving 均有 verify evidence。
Compaction Quality Pass 已建立 compaction 前后机器对照：objective、constraints、failure、plan、modified files、pending actions 和 bad summary compaction_loss 均有 verify evidence。
Plan State Machine Pass 已建立 step-level plan lifecycle：pending -> active -> done、blocked reason、revision history、compaction resume、permission denial 和 final grounding 均有 verify evidence。
Long-Running Task Eval Pass 已建立 7 轮长任务压力场：multi-turn repair、repeated failure history、compaction resume、per-turn cost curve、verification_missing false final 和 learning handoff 均有 verify evidence。
ToolRuntime Transaction Pass 已建立 patch safety 事务层：diff preview、multi-file commit、rollback、stale reread、protected file approval 和 high-risk Bash approval routing 均有 verify evidence。
ModelGateway Budget Controller Pass 已建立模型调用预算层：token/cost budget gate、retry/fallback、provider capability registry 和 schema-bound JSON repair 均有 verify evidence。
Durable Session Store Replay Pass 已建立本地可恢复事实流：append-only event log、snapshot restore、crash recovery、trace replay、compaction audit 和 secret boundary 均有 verify evidence。
Repo Intelligence Relevance Pass 已建立本地 repo-aware relevance 层：repo map、symbol/test/rule index、relevance scoring、incremental update 和 token benefit 均有 verify evidence。
Human Approval Interruption Pass 已建立本地人类协作协议层：approval_required、approve path、reject path、interruption、handoff 和 no hidden execution 均有 verify evidence。
Core 18-26 Production Upgrade Roadmap Pass 已完成当前 deterministic local evidence 主线；第二 reference-agent baseline 仍不作为当前已完成项。
```

---

## 5. 已完成的构建成果

课程层：

```text
docs/course/course-00-teaching-standard.md
docs/course/course-01-initial-model-request.md
docs/course/course-02-action-selection-rubric.md
docs/course/course-03-clean-room-prompt-pack.md
docs/course/course-04-single-task-full-trace.md
docs/course/course-05-product-mental-model.md
docs/course/course-06-labs-to-core-map.md
docs/course/course-07-core-build-pass-overview.md
docs/course/course-08-model-gateway-and-context-engine.md
docs/course/course-09-plan-mode-and-compaction.md
docs/course/course-10-trace-eval-real-model-and-recovery.md
docs/course/course-11-real-repo-task-layer.md
docs/course/course-12-eval-packaging-and-executable-seeds.md
docs/course/course-13-eval-reference-cost-evidence.md
docs/course/course-14-production-upgrade-evidence-chain.md
docs/course/course-15-context-compaction-plan-production.md
docs/course/course-16-long-running-tool-gateway-production.md
docs/course/course-17-session-repo-approval-production.md
docs/course/course-18-product-surface-implementation-chain.md
```

Lab 层：

```text
docs/lab/lab-01-mock-runtime-loop.md
docs/lab/lab-02-message-store.md
docs/lab/lab-03-read-search-bash.md
docs/lab/lab-04-edit-tool-safety.md
docs/lab/lab-05-context-engine-v1.md
docs/lab/lab-06-plan-mode-v1.md
docs/lab/lab-07-compaction-v1.md
docs/lab/lab-08-eval-runner.md
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
src/core/model-gateway-budget-controller.mjs
src/core/durable-session-store-replay.mjs
src/core/repo-intelligence-relevance-index.mjs
src/core/human-approval-interruption-protocol.mjs
src/core/settings-permission-resolver.mjs
src/core/hooks-lifecycle.mjs
src/core/memory-source-auto-memory.mjs
src/core/checkpoint-rewind.mjs
src/core/subagent-context-isolation.mjs
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
src/core/model-gateway-budget-controller.verify.mjs
src/core/durable-session-store-replay.verify.mjs
src/core/repo-intelligence-relevance-index.verify.mjs
src/core/human-approval-interruption-protocol.verify.mjs
src/core/settings-permission-resolver.verify.mjs
src/core/hooks-lifecycle.verify.mjs
src/core/memory-source-auto-memory.verify.mjs
src/core/checkpoint-rewind.verify.mjs
src/core/subagent-context-isolation.verify.mjs
```

集成层：

```text
docs/core/core-01-integrated-runtime.md
docs/core/core-02-model-gateway.md
docs/core/core-03-context-engine-integration.md
docs/core/core-04-plan-mode-integration.md
docs/core/core-05-compaction-artifact-integration.md
docs/core/core-06-trace-eval-harness-expansion.md
docs/core/core-07-real-model-api-e2e.md
docs/core/core-08-prompt-pack-recovery-loop.md
docs/core/core-09-real-repo-task-layer.md
docs/core/core-10-70-80-eval-open-source-packaging.md
docs/core/core-11-eval-expansion-executable-seeds.md
docs/core/core-12-eval-expansion-second-batch.md
docs/core/core-13-eval-expansion-third-batch.md
docs/core/core-14-eval-expansion-final-starter-batch.md
docs/core/core-15-reference-agent-comparison.md
docs/core/core-16-reference-agent-cost-and-cross-agent.md
docs/core/core-17-reference-agent-pricing-table-baseline.md
docs/core/core-18-context-economy-cache-aware-context-engine.md
docs/core/core-19-compaction-quality-eval.md
docs/core/core-20-plan-state-machine.md
docs/core/core-21-long-running-task-eval.md
docs/core/core-22-tool-runtime-transaction.md
docs/core/core-23-model-gateway-budget-controller.md
docs/core/core-24-durable-session-store-replay.md
docs/core/core-25-repo-intelligence-relevance-index.md
docs/core/core-26-human-approval-interruption-protocol.md
docs/core/core-27-settings-permission-resolver.md
docs/core/core-28-hooks-lifecycle.md
docs/core/core-29-memory-source-auto-memory.md
docs/core/core-30-checkpoint-rewind.md
docs/core/core-31-subagent-context-isolation.md
docs/roadmap/production-upgrade-roadmap.md
docs/roadmap/production-upgrade-validation-matrix.md
docs/roadmap/product-surface-study-roadmap.md
docs/roadmap/product-surface-validation-matrix.md
docs/roadmap/product-surface-core-candidates.md
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
src/core/model-gateway-budget-controller.mjs
src/core/model-gateway-budget-controller.verify.mjs
src/core/durable-session-store-replay.mjs
src/core/durable-session-store-replay.verify.mjs
src/core/repo-intelligence-relevance-index.mjs
src/core/repo-intelligence-relevance-index.verify.mjs
src/core/human-approval-interruption-protocol.mjs
src/core/human-approval-interruption-protocol.verify.mjs
src/core/settings-permission-resolver.mjs
src/core/settings-permission-resolver.verify.mjs
src/core/hooks-lifecycle.mjs
src/core/hooks-lifecycle.verify.mjs
src/core/memory-source-auto-memory.mjs
src/core/memory-source-auto-memory.verify.mjs
src/core/checkpoint-rewind.mjs
src/core/checkpoint-rewind.verify.mjs
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

Core 23 已确认：

```text
BudgetedModelGateway 可以在 provider 调用前执行 token/cost budget gate，并把 decision 写入 gatewayTrace。
token budget exceeded 会在 adapter 调用前被拒绝。
cost budget exceeded 可以跳过 expensive primary，并降级到 cheaper fallback。
rate_limit / timeout / provider_unavailable 等 retryable failure 会按 retryPolicy 处理。
unknown tool / invalid schema 等 non-retryable failure 不会被盲目 retry。
ProviderCapabilityRegistry 会过滤 unsupported tools、streaming 和 reasoning。
可修复 JSON tool_call 文本只能做窄范围 repair，修复后仍必须通过 tool schema。
这只是 deterministic local gateway evidence，不是真实 provider SLA、真实厂商账单或完整生产级 provider router。
```

Core 24 已确认：

```text
DurableSessionStore 可以把 session event 写入 append-only events.jsonl，并用 seq、previousHash 和 hash 检测重排。
snapshot 会记录 throughSeq、eventLogHash、stateHash 和 replay state，restore 后可以和 replay(... throughSeq) 对照。
crash recovery 会从最新 snapshot 重放 tail events，保留 activePlan、currentStepId 和 pendingActions。
trace replay 可以从事件流重建 messages、runtimeTrace、modelGatewayDecisions、modifiedFiles、verificationState、failureHistory 和 compactionAudit。
compaction audit 会记录 before / after / quality report，并复用 Core 19 的 compaction quality evidence。
session evidence 写入前会 redaction provider credential；verify 会扫描 event log 和 snapshot，确认 raw secret 不落盘。
这只是 deterministic local durable replay evidence，不是分布式 durable storage、跨机器 session 产品或生产级 audit log。
```

Core 25 已确认：

```text
RepoIntelligenceIndex 可以扫描 fixture repo，输出 repoMap、files、symbolIndex、testIndex、ruleIndex 和 boundary。
repo map 会记录文件、脚本、规则入口、line count、hash 和 token estimate。
symbol index 可以定位 exported paginate，并记录 tests/pagination.test.cjs 对 src/pagination.cjs 的 require reference。
test index 可以从 package.json scripts 和 test files 建立 source -> test association。
rule discovery 会把 AGENTS.md / README.md 中的 public API 和 npm test 规则标为 high priority。
relevance scoring 会用 term overlap、symbol match、test association、targeted test、rule priority 和 test command 解释排序。
相似文件存在时，src/pagination.cjs 会高于 src/cart.cjs，并留下 score reasons。
incremental update 会只刷新 src/pagination.cjs，记录 before / after hash、updatedFileCount 和 reusedFileCount。
token benefit 对比证明 indexed context 用更少 token 选中正确实现、规则和相关测试。
这只是 deterministic local repo index evidence，不是完整语义 embedding 检索、任意超大仓库生产级索引或真实 IDE / LSP 全量符号能力。
```

Core 26 已确认：

```text
HumanApprovalInterruptionProtocol 可以把 protected edit 和 high-risk Bash 分类为 approval_required，并写入 durable session events。
approve path 会先写入 approval.approved，再执行 tool.executed，并留下 runtimeTrace。
reject path 会写入 approval.rejected，不执行被拒绝动作，并生成 plan revision。
用户 interruption 会 pause 当前 active step，写入 session.interrupted 和 constraint.added，并生成 revised plan。
handoff artifact 会记录 sessionId、lastEventSeq、activePlan、pendingApprovals、constraints、pendingActions 和 recoveryInstructions。
assertNoHiddenExecution 会扫描 event log，确认 approvalRequired tool.executed 必须有更早 approval.approved。
构造隐藏执行坏事件会被 verify 拒绝。
这只是 deterministic local approval protocol evidence，不是完整 GUI approval 产品、enterprise policy 系统或真实多人协作权限模型。
```

Core 27 已确认：

```text
SettingsPermissionResolver 可以读取 user/project/local/policy 四层 permissionConfig，并按 policy > local > project > user 解析。
resolver report 会记录 ruleSource、matchedRule、shadowedMatches、resolverTrace、precedence 和 decisionCache。
同一 action 可以解析为 allow / ask / deny：allow 进入 mock tool execution，ask 只生成 Core 26 approval_required bridge，deny 结构化拒绝。
命令前缀规则只匹配明确前缀和参数，不把 npm test 外推到 npm testing 或 npm test:unit。
ask / deny action 的 providerCalls delta 和 toolExecutions delta 都为 0。
assertNoHiddenPermissionExecution 会扫描 trace，确认只有 allow 后才允许 tool.executed。
这只是 deterministic local permission resolver evidence，不是完整 enterprise policy 产品、真实 Claude Code Settings / Permission 内部实现、GUI permission prompt、完整 shell parser 或 sandbox。
```

Core 28 已确认：

```text
HooksLifecycleRuntime 可以把 userPromptSubmit、preToolUse、postToolUse hooks 作为 Runtime lifecycle event 处理。
userPromptSubmit hook 可以把 public API 约束加入 Runtime State，并确认不进入 systemMessages。
preToolUse hook 可以返回 block，写入 hook.pre_tool.blocked 和 tool.blocked_by_hook，且 toolExecutions delta=0。
postToolUse hook 可以把反馈写入 dynamicObservations，并标记 promotedToSystem=false。
hook failure 会被结构化为 hook_failed，且不能把 permission deny 的 action 升级为可执行。
hook output 在写入 DurableSessionStore 前会脱敏 Bearer、sk- 和 token 样式文本，secret scan 通过。
assertNoHiddenHookExecution 会确认 blocked / denied action 不会出现 tool.executed。
这只是 deterministic local hooks lifecycle evidence，不是真实 shell hook 产品、任意用户脚本安全沙箱、完整插件系统或真实 Claude Code hooks 内部实现。
```

Core 29 已确认：

```text
MemorySourceRuntime 可以把 user、feedback、project、reference 四类 memory candidate 路由到不同 read/write policy、contextPriority 和 freshness 要求。
CLAUDE.md 可以作为 project memory source 被索引，但不通过 auto memory 随意改写。
writeMemory 会把正文写入 memory/items/<id>.json，把 summary、bodyPath、bodyHash 和 references 写入 memory-index.json，正文和索引分离。
forgetMemory 会删除 body file、移除 index entry，并写入 forgetEvent。
recommendMemories 对带 references 的 memory 会先执行 freshness check；缺失文件或 symbol 的 stale memory 不进入推荐。
buildContextSnapshot 会把 long_term_memory block 和 compact_summary block 分开，memoryMixedWithCompactSummary=false。
代码结构事实会被拒绝为 code_structure_memory_denied，并建议 read_repo_or_update_repo_index。
这只是 deterministic local memory source evidence，不是真实 Claude Code memory 文件格式、远端多用户 memory 服务、隐私合规系统、完整代码智能数据库或官方实现。
```

Core 30 已确认：

```text
CheckpointRewindRuntime 可以创建 checkpoint，并把它绑定到文件 hash、session event seq、event hash 和 durable snapshot id。
rewind request 会从 source checkpoint 回到 target checkpoint，并恢复目标 checkpoint 的文件内容和 replay state。
如果 source checkpoint 之后存在外部文件改动，rewind 会返回 externalChangeConflict，不恢复任何文件。
rewind audit 可以解释 source checkpoint、target checkpoint、restored files 和 replay through seq。
rewind 只向 event log 追加 checkpoint / rewind audit events，不截断或改写 Core 22 transaction evidence 和 Core 24 durable replay evidence。
这只是 deterministic local checkpoint rewind evidence，不是 IDE rewind UI、跨机器恢复、分布式 session store、完整 patch parser 或真实 Claude Code Checkpoint 内部实现。
```

Core 31 已确认：

```text
SubagentContextIsolationRuntime 可以把父代理请求转成 delegatedTask，并为每个任务生成只含 allowed paths 的 subagentContext。
independent tasks 可以在同一 parallel group 中运行；session evidence 通过本地 append queue 串行写入 Core 24 event log，避免破坏 seq/hash chain。
subagentResult 只向父代理返回 summary、evidenceRefs、contextDigestHash 和 structured failure，不返回 raw parent messages 或 raw transcript。
delegationLedger 会按 task signature 阻止重复研究；重复委派返回 duplicate_reused，researchExecuted=false。
failure propagation 会把 isolated context 中的失败结构化为 failure.reason 和 retryHint，并写入 parent receipt。
isolationAudit 可以从 session events replay delegation.started、subagent.result_received、delegation.completed 和 ledger entry。
这只是 deterministic local subagent isolation evidence，不是真实多进程 agent 调度、远端 worker 隔离、agent marketplace 或真实 Claude Code Subagent 内部实现。
```

Production Upgrade Roadmap Pass 已确认：

```text
Core 18-26 的生产化升级路线已经落到 docs/roadmap/production-upgrade-roadmap.md。
Core 18-26 的验证先行口径已经落到 docs/roadmap/production-upgrade-validation-matrix.md。
下一阶段主线从 second reference-agent baseline 调整为 Runtime 生产化升级。
Core 18 到 Core 26 的顺序为 Context Economy、Compaction Quality Eval、Plan State Machine、Long-Running Task Eval、ToolRuntime Transaction、ModelGateway Budget、Durable Replay、Repo Intelligence、Human Approval。
每个 Core 必须先有阶段文档、实现、verify 脚本、package 脚本、verify:all、CURRENT_STATE 和 run record 更新，才算完成。
生产化升级仍不声称完整 Claude Code 复刻、生产级 70%-80% 能力认证或跨 agent RelativeScore。
```

---

## 7. 最新验证结果

最后一次完整验证时间：

```text
2026-06-02 15:59 CST
```

运行命令：

```bash
npm run docs:links
npm run verify:all
npm run project:capstone:solution:verify
```

额外检查：

```bash
git diff --check
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
core-23: 9/9 passed
core-24: 8/8 passed
core-25: 9/9 passed
core-26: 9/9 passed
core-27: 8/8 passed
core-28: 9/9 passed
core-29: 9/9 passed
core-30: 8/8 passed
core-31: 9/9 passed

total: 265/265 passed
exit code: 0
```

额外检查结果：

```text
git diff --check: passed
npm run docs:links: passed, 233 internal links passed, 33 external links recorded
npm run project:capstone:solution:verify: 8/8 passed
```

这证明：

```text
当前 Lab 机制、Core 01 集成链路、Core 02 Model Gateway 边界、Core 03 Context Engine 集成链路、Core 04 Plan Mode 权限链路、Core 05 Compaction / Artifact 链路、Core 06 Trace / Eval Harness 链路、Core 07 Real Model API E2E 链路、Core 08 Prompt Pack / Recovery Loop 链路、Core 09 Real Repo Task Layer 链路、Core 10 Eval / Open Source Packaging 链路、Core 11 第一批 executable seed 链路、Core 12 第二批 executable seed 链路、Core 13 第三批 executable seed 链路、Core 14 final starter batch 链路、Core 15 codex-local reference comparison 链路、Core 16 reference-agent cost/cross-agent readiness 链路、Core 17 pricing table baseline 链路、Core 18 context economy/cache-aware context 链路、Core 19 compaction quality eval 链路、Core 20 plan state machine 链路、Core 21 long-running task eval 链路、Core 22 tool runtime transaction 链路、Core 23 model gateway budget controller 链路、Core 24 durable session replay 链路、Core 25 repo intelligence relevance 链路、Core 26 human approval interruption 链路、Core 27 settings permission resolver 链路、Core 28 hooks lifecycle 链路、Core 29 memory source 链路、Core 30 checkpoint rewind 链路和 Core 31 subagent context isolation 链路都可运行。
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
学习者需要正式复盘 docs/course/course-13-eval-reference-cost-evidence.md 到 docs/course/course-18-product-surface-implementation-chain.md。
学习者需要能把 Core 13-17 复述为可执行任务集（executable suite）-> 本机 Codex 基线（codex-local baseline）-> 成本口径（cost basis）-> 定价边界（pricing boundary）-> 相对分数阻塞（RelativeScore blocked）的证据桥。
学习者需要能把 Core 18-26 复述为上下文、压缩、计划、评测、工具运行时、模型网关、会话、仓库理解、人工批准（Context / Compaction / Plan / Eval / ToolRuntime / ModelGateway / Session / Repo Intelligence / Human Approval）的生产化证据链。
学习者需要能把 Core 27-31 复述为设置、钩子、记忆、检查点、子代理（Settings / Hooks / Memory / Checkpoint / Subagent）的产品表层执行链（Product Surface execution-chain），并能说明每个主题的运行时状态（Runtime state）、强制边界（enforced boundary）、验证用例（verify case）和不能声称的官方实现边界。
学习者需要继续区分本地确定性证据（deterministic local evidence）、真实服务商账单（provider billing）、真实服务商缓存账单（provider cache billing）、生产级基准（benchmark）、系统分数（SystemScore）和相对分数（RelativeScore）。
```

工程侧还缺：

```text
Core 03 仍是 starter Context Engine，不是完整生产级上下文系统。
Core 04 仍是 starter Plan Mode，不是完整人工审批交互。
Core 05 仍是 starter Compaction，不是完整生产级压缩系统。
Core 06 仍是 starter Eval Harness，不是完整 70%-80% 能力评测集。
Core 07 仍是入门模型适配器端到端（starter Model Adapter E2E），不是完整服务商路由 / 重试 / 成本控制（provider router / retry / cost control）。
Core 08 仍是入门提示词包 / 恢复循环（starter Prompt Pack / Recovery Loop），不是完整生产级提示词 / 运行时恢复系统（production prompt/runtime recovery system）。
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
Core 23 已实现 deterministic model gateway budget controller；但它不是真实 provider SLA、真实厂商账单，也不是完整生产级 provider router。
Core 24 已实现 deterministic durable session replay；但它不是分布式 durable storage、跨机器 session 产品或生产级 audit log。
Core 25 已实现 deterministic repo intelligence relevance index；但它不是完整语义 embedding 检索、任意超大仓库生产级索引或真实 IDE / LSP 全量符号能力。
Core 26 已实现 deterministic human approval interruption protocol；但它不是完整 GUI approval 产品、enterprise policy 系统或真实多人协作权限模型。
Core 27 已实现 deterministic settings permission resolver；但它不是完整 enterprise policy 产品、真实 Claude Code Settings / Permission 内部实现、GUI permission prompt、完整 shell parser 或 sandbox。
Core 28 已实现 deterministic hooks lifecycle；但它不是真实 shell hook 产品、任意用户脚本安全沙箱、完整插件系统或真实 Claude Code hooks 内部实现。
Core 29 已实现 deterministic memory source；但它不是真实 Claude Code memory 文件格式、远端多用户 memory 服务、隐私合规系统、完整代码智能数据库或官方实现。
Core 30 已实现 deterministic checkpoint rewind；但它不是 IDE rewind UI、跨机器恢复、分布式 session store、完整 patch parser 或真实 Claude Code Checkpoint 内部实现。
Core 31 已实现 deterministic subagent context isolation；但它不是真实多进程 agent 调度、远端 worker 隔离、agent marketplace 或真实 Claude Code Subagent 内部实现。
Core 18-26 已完成 deterministic local evidence 主线；但仍不能声称完整 Claude Code 生产能力、任意真实仓库 70%-80% 成功率或跨 agent RelativeScore。
```

文档治理侧当前结论：

```text
README + docs/index + authority-map 的入口层已经建立。
开源协作文件、学习者入口、开源边界、项目结构说明和 GitHub release checklist 已补齐。
历史文档已移动到 docs/history，只作背景材料，不再占据根目录。
当前已达到 GitHub learning-preview 发布结构；发布后仍应继续收集真实中文学习者反馈。
Production Upgrade Roadmap Pass 已建立路线入口，course-14 到 course-17 已建立 Core 18-26 教学整理入口；未来新路线开始前仍要先写清新的 roadmap / validation matrix，并同步 CURRENT_STATE、README、docs/index 和 authority-map。
产品表层学习阶段准备（Product Surface Study Stage Preparation）已完成路线入口、验证矩阵、Step A 课程补充和候选 Core 迷你简报（mini brief）。Core 27、Core 28、Core 29、Core 30 和 Core 31 已作为当前候选池 A-E 实现；后续仍不能直接新增一串 Core，必须先从候选池中选择真正满足运行时边界（Runtime boundary）和验证形态（verify shape）的主题，并补具体实现级验证矩阵（validation matrix）。
产品表层教学整理（Product Surface Teaching Consolidation Pass）已完成 course-18 教学入口，并将 course-00 / 03 / 08 / 09 / 15 / 16 / 17 的产品表层（Product Surface）补充对齐到 Core 27-31 的对象、状态、验证（verify）和公开边界。
```

---

## 9. 下一步最小可执行动作

下一步只做一件事：

```text
按新的公开入口复盘 README 第一视觉和 docs/core-logic-map.md，确认学习者能先复述完整机制链路，再进入 Course / Lab / Core 和 verify 证据层。
```

推荐优先顺序：

```text
1. 读 README 第一屏和 assets/diagrams/claude-code-core-mechanism.png，确认机制图一眼能看懂。
2. 读 docs/core-logic-map.md，复述 User Goal 到 Product Surface 的完整链路。
3. 再按 docs/start-here-for-learners.md 和 docs/learning-plan.md 选择学习节奏。
4. 需要深入时进入 Course / Lab / Core；需要证据时运行对应 verify。
5. 后续若要新增产品表层候选，仍先写迷你简报（mini brief）、证据层级（evidence tier）、同主题合并（same-topic merge）、运行时边界（runtime boundary）、验证形态（verify shape）和公开边界（public boundary）。
6. 不使用提取提示词（prompt）原文、源码映射（source map）原文或反编译源码片段。
```

做完下一步后的预期结果：

```text
学习者能先把 Claude Code-like Agent 复述为：User Goal 进入 Runtime Loop，Context 约束 Model Decision，Tool Call 经过 Policy 和 ToolRuntime，Observation 回灌 State / Plan / Compaction，Eval 形成证据，Product Surface 呈现用户可控边界。
Course / Lab / Core 仍作为深入学习材料保留，不变成首页第一理解负担。
项目继续避免把提取提示词（prompt）/ 源码映射（source map）观察直接写成官方公开实现或生产级 Claude Code 能力。
```

---

## 10. 新对话恢复协议

如果开启新对话，先让 Agent 读取：

```text
CURRENT_STATE.md
docs/course/claude-code-core-learning-path.md
docs/start-here-for-learners.md
docs/open-source-boundary.md
docs/github-release-checklist.md
docs/course/course-06-labs-to-core-map.md
docs/course/course-07-core-build-pass-overview.md
docs/course/course-08-model-gateway-and-context-engine.md
docs/course/course-09-plan-mode-and-compaction.md
docs/course/course-10-trace-eval-real-model-and-recovery.md
docs/course/course-11-real-repo-task-layer.md
docs/course/course-12-eval-packaging-and-executable-seeds.md
docs/course/course-13-eval-reference-cost-evidence.md
docs/course/course-14-production-upgrade-evidence-chain.md
docs/course/course-15-context-compaction-plan-production.md
docs/course/course-16-long-running-tool-gateway-production.md
docs/course/course-17-session-repo-approval-production.md
docs/core/core-02-model-gateway.md
docs/core/core-03-context-engine-integration.md
docs/core/core-04-plan-mode-integration.md
docs/core/core-05-compaction-artifact-integration.md
docs/core/core-06-trace-eval-harness-expansion.md
docs/core/core-07-real-model-api-e2e.md
docs/core/core-08-prompt-pack-recovery-loop.md
docs/core/core-09-real-repo-task-layer.md
docs/core/core-10-70-80-eval-open-source-packaging.md
docs/core/core-11-eval-expansion-executable-seeds.md
docs/core/core-12-eval-expansion-second-batch.md
docs/core/core-13-eval-expansion-third-batch.md
docs/core/core-14-eval-expansion-final-starter-batch.md
docs/core/core-15-reference-agent-comparison.md
docs/core/core-16-reference-agent-cost-and-cross-agent.md
docs/core/core-17-reference-agent-pricing-table-baseline.md
docs/core/core-18-context-economy-cache-aware-context-engine.md
docs/core/core-19-compaction-quality-eval.md
docs/core/core-20-plan-state-machine.md
docs/core/core-21-long-running-task-eval.md
docs/core/core-22-tool-runtime-transaction.md
docs/core/core-23-model-gateway-budget-controller.md
docs/core/core-24-durable-session-store-replay.md
docs/core/core-25-repo-intelligence-relevance-index.md
docs/core/core-26-human-approval-interruption-protocol.md
docs/core/core-27-settings-permission-resolver.md
docs/core/core-28-hooks-lifecycle.md
docs/core/core-29-memory-source-auto-memory.md
docs/core/core-30-checkpoint-rewind.md
docs/core/core-31-subagent-context-isolation.md
docs/roadmap/production-upgrade-roadmap.md
docs/roadmap/production-upgrade-validation-matrix.md
docs/roadmap/product-surface-study-roadmap.md
docs/roadmap/product-surface-validation-matrix.md
docs/roadmap/product-surface-core-candidates.md
README.md
AGENTS.md
docs/index.md
docs/authority-map.md
```

然后告诉 Agent：

```text
Core 18-26 Production Upgrade Roadmap 后的逐阶段生产化升级已完成当前 deterministic local evidence 主线。
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
Core 23 Production ModelGateway + Budget Controller 已实现并通过目标验证。
Core 24 Durable Session Store + Replay 已实现并通过目标验证。
Core 25 Repo Intelligence + Relevance Index 已实现并通过目标验证。
Core 26 Human Approval + Interruption Protocol 已实现并通过目标验证。
Core 27 设置与权限解析器（Settings / Permission Resolver）已实现并通过目标验证。
Core 28 钩子生命周期（Hooks Lifecycle）已实现并通过目标验证。
Core 29 记忆来源 / 项目记忆 / 自动记忆（Memory Source / CLAUDE.md / Auto Memory）已实现并通过目标验证。
Core 30 检查点与回退（Checkpoint / Rewind）已实现并通过目标验证。
Core 31 子代理上下文隔离（Subagent Context Isolation）已实现并通过目标验证。
生产化升级路线（Production Upgrade Roadmap）Pass 已建立 Core 18-26 路线和验证矩阵。
course-07 Core Build Pass Overview 已创建并复盘完成。
course-08 到 course-12 已按执行链样板重写并复盘完成。
course-13 Eval Reference Cost Evidence 已创建，用于复盘 Core 13-17 的 executable suite、codex-local baseline、cost basis、pricing boundary 和 RelativeScore 阻塞。
course-14 Production Upgrade Evidence Chain 已创建，用于复盘 Core 18-26 的 deterministic local evidence 主线。
course-15 到 course-17 已创建，用于按同一执行链标准细读 Core 18-26 验证用例（verify case）。
course-18 产品表层实现链（Product Surface Implementation Chain）已创建，用于按同一执行链标准细读 Core 27-31 验证用例（verify case）。
开源学习预览（Open Source Learning Preview）已补齐课程桥、开源边界、协作文件和 CI，已同步 GitHub 并通过 CI。
产品表层学习阶段准备（Product Surface Study Stage Preparation）已完成 Core 26 之后的新阶段路线、验证矩阵、Step A 课程补充和候选 Core 迷你简报（mini brief）。Core 27 设置与权限解析器（Settings / Permission Resolver）、Core 28 钩子生命周期（Hooks Lifecycle）、Core 29 记忆来源（Memory Source）、Core 30 检查点与回退（Checkpoint / Rewind）和 Core 31 子代理上下文隔离（Subagent Context Isolation）已进入实现并通过验证。产品表层教学整理（Product Surface Teaching Consolidation Pass）已完成 course-18 和导航同步。当前候选池 A-E 已完成；新增候选前必须先补迷你简报（mini brief）和实现级验证矩阵（validation matrix）。
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
2. 先读 docs/start-here-for-learners.md 和 docs/open-source-boundary.md。
3. 再读 docs/course/course-13-eval-reference-cost-evidence.md，确认 Core 13-17 的 evidence bridge 不再缺课。
4. 继续读 docs/course/course-14-production-upgrade-evidence-chain.md 到 docs/course/course-17-session-repo-approval-production.md，确认 Core 18-26 每组验证用例（verify case）的对象、状态和断言。
5. 读 docs/course/course-18-product-surface-implementation-chain.md，确认 Core 27-31 每组验证用例（verify case）的对象、状态和边界。
6. 不要把 Core 18-31 的 deterministic local evidence 扩写成生产级 Claude Code 能力声明。
7. 下一阶段开始前，先写清新的 roadmap / validation matrix。
8. 不要在没有真实外部对照或更大 benchmark 时声称 70%-80% 成功率、真实 provider SLA 或跨 agent RelativeScore。
9. 产品表层学习（Product Surface Study）必须先判断同主题是否补旧课；只有新的运行时边界（Runtime boundary）和可执行验证形态（verify shape）才能新建 Core。
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
npm --prefix /Users/boyzcl/Documents/A/C run core:23
npm --prefix /Users/boyzcl/Documents/A/C run core:23:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:24
npm --prefix /Users/boyzcl/Documents/A/C run core:24:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:25
npm --prefix /Users/boyzcl/Documents/A/C run core:25:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:26
npm --prefix /Users/boyzcl/Documents/A/C run core:26:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:27
npm --prefix /Users/boyzcl/Documents/A/C run core:27:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:28
npm --prefix /Users/boyzcl/Documents/A/C run core:28:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:29
npm --prefix /Users/boyzcl/Documents/A/C run core:29:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:30
npm --prefix /Users/boyzcl/Documents/A/C run core:30:verify
npm --prefix /Users/boyzcl/Documents/A/C run core:31
npm --prefix /Users/boyzcl/Documents/A/C run core:31:verify
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
Core 23 model gateway budget controller 已完成，token/cost budget gate / retry / fallback / capability filtering / JSON repair 均有 verify evidence。
Core 24 durable session replay 已完成，append-only event log / snapshot restore / crash recovery / trace replay / compaction audit / secret boundary 均有 verify evidence。
Core 25 repo intelligence relevance index 已完成，repo map / symbol index / test index / rule discovery / relevance scoring / incremental update / token benefit 均有 verify evidence。
Core 26 human approval interruption protocol 已完成，approval_required / approve path / reject path / interruption / handoff / no hidden execution 均有 verify evidence。
Core 27 settings permission resolver 已完成，config precedence / allow ask deny / prefix command rule / no hidden execution / decision cache 均有 verify evidence。
Core 28 hooks lifecycle 已完成，pre tool hook / post tool hook / user prompt hook / hook failure / secret boundary / no hidden execution 均有 verify evidence。
Core 29 memory source 已完成，memory type routing / write and index / forget / stale verification / compaction boundary / no code-structure memory 均有 verify evidence。
Core 30 checkpoint rewind 已完成，checkpoint creation / rewind state / external change conflict / audit replay / event log boundary 均有 verify evidence。
Core 31 subagent context isolation 已完成，independent task / context isolation / no duplicate research / result contract / failure propagation / isolation audit 均有 verify evidence。
Production Upgrade Roadmap Pass 已建立 Core 18-26 路线和验证矩阵。
Core 18-26 Production Upgrade Roadmap Pass 当前实现主线已完成。
没有跨 agent 真实 runs 前不要生成 RelativeScore。
不要把 Core 17 的本地示例价格表当作真实厂商账单。
不要把 Core 18 的 cache simulation 当作真实 provider cache billing。
不要把 Core 19 的 deterministic quality eval 当作完整生产级压缩系统。
不要把 Core 20 的 deterministic state machine 当作完整生产级人工审批系统。
不要把 Core 21 的 deterministic long-running eval 当作生产级长任务 benchmark。
不要把 Core 22 的 deterministic transaction layer 当作完整生产级 ToolRuntime。
不要把 Core 23 的 deterministic gateway budget controller 当作真实 provider SLA、真实厂商账单或完整生产级 provider router。
不要把 Core 24 的 deterministic durable replay 当作分布式 durable storage、跨机器 session 产品或生产级 audit log。
不要把 Core 25 的 deterministic repo index 当作完整语义 embedding 检索、任意超大仓库生产级索引或真实 IDE / LSP 全量符号能力。
不要把 Core 26 的 deterministic approval protocol 当作完整 GUI approval 产品、enterprise policy 系统或真实多人协作权限模型。
不要把 Core 27 的 deterministic permission resolver 当作完整 enterprise policy 产品、真实 Claude Code Settings / Permission 内部实现、GUI permission prompt、完整 shell parser 或 sandbox。
不要把 Core 28 的 deterministic hooks lifecycle 当作真实 shell hook 产品、任意用户脚本安全沙箱、完整插件系统或真实 Claude Code hooks 内部实现。
不要把 Core 29 的 deterministic memory source 当作真实 Claude Code memory 文件格式、远端多用户 memory 服务、隐私合规系统、完整代码智能数据库或官方实现。
不要把 Core 30 的 deterministic checkpoint rewind 当作 IDE rewind UI、跨机器恢复、分布式 session store、完整 patch parser 或真实 Claude Code Checkpoint 内部实现。
不要把 Core 31 的 deterministic subagent context isolation 当作真实多进程 agent 调度、远端 worker 隔离、agent marketplace 或真实 Claude Code Subagent 内部实现。
```
