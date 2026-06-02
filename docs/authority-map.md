Title: Claude Code Core Learning Authority Map
Type: authority-map
Layer: standard
Mode: reference
Scope: repo
Status: active
Owner: project-maintainer
Source of Truth: yes
Related Files: README.md, AGENTS.md, CURRENT_STATE.md, docs/index.md, docs/open-source-boundary.md

# Claude Code Core Learning Authority Map

## Purpose

本文声明项目文档的主次关系：哪些文档负责当前规则，哪些负责学习路线，哪些只是历史背景或验证证据。新日期不自动代表更权威；冲突时按本文的 Topic Register 和 Conflict Rules 判断。

## Navigation Register

| Entry | Role | Default Use | Notes |
| --- | --- | --- | --- |
| `README.md` | 项目总入口 | yes | 面向人和 Agent 的快速入口、命令和边界说明 |
| `AGENTS.md` | Agent 控制入口 | yes | 约束 Agent 如何读取、修改、验证和处理 secret |
| `CURRENT_STATE.md` | 当前状态入口 | yes | 当前进度、最新验证、下一步动作唯一事实源 |
| `docs/index.md` | 文档索引 | yes | 按当前规则 / 历史 / 证据（Current Rules / History / Evidence）路由 |
| `docs/authority-map.md` | 权威关系图（authority map） | yes | 本文，负责冲突优先级 |
| `docs/start-here-for-learners.md` | 学习者入口 | yes | 第一次阅读仓库时使用，不替代当前状态（current state） |
| `docs/learning-plan.md` | 从零学习计划 | yes | 把学习入口拆成 30 分钟、半天和七节主线学习法，不替代课程正文 |
| `docs/open-source-boundary.md` | 开源边界入口 | yes | 公开声明、公开学习边界和能力边界 |
| `docs/production-upgrade-terms-zh.md` | 中文术语表 | yes | 当前解释性文档采用中文先行、英文括注时的术语入口；文件名沿用历史名称 |
| `docs/reference/code-agent-implementation-logic.md` | 代码智能体实现逻辑综合文 | yes | 当前综合文章，用一篇长文复盘从运行时循环到产品表层边界的搭建逻辑 |
| `docs/reference/core-runtime-object-map.md` | 运行时对象地图 | yes | 学习辅助入口，把 Lab 01 到 Core 31 收束成少数运行时对象 |
| `docs/reference/open-source-project-standards.md` | 开源项目规范参考 | yes | 把优秀 GitHub 项目经验转译成本项目协作、参考资料和验证标准 |

## Topic Register

| Topic | Canonical Doc | Doc Role | Scope | Status | History Docs | Evidence Docs | Conflict Rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 当前进度和下一步 | `CURRENT_STATE.md` | current-rule | repo | active | `docs/course/claude-code-core-learning-path.md` | `docs/records/core-run-record.md` | 当前状态冲突时以 `CURRENT_STATE.md` 为准 |
| 学习路线和命名 | `docs/course/claude-code-core-learning-path.md` | current-rule | learning-system | active | none | `docs/records/lab-*-run-record.md` | 路线命名冲突时以 learning path 为准 |
| 从零学习计划 | `docs/learning-plan.md` | learner-guide | learning-system | active | none | `docs/course/course-00-teaching-standard.md` through `docs/course/course-18-product-surface-implementation-chain.md`, `src/**/*.verify.mjs` | 学习节奏以 learning plan 为入口；课程顺序和命名仍以 learning path 为准，行为证据以 verify 脚本为准 |
| Agent 工作控制 | `AGENTS.md` | current-rule | repo | active | none | `docs/records/core-run-record.md` | 操作边界冲突时以 `AGENTS.md` 和安全策略为准 |
| 文档导航 | `docs/index.md` | index | docs | active | none | none | 导航冲突时以 authority map 的 canonical doc 为准 |
| 文档 authority | `docs/authority-map.md` | reference-authority | docs | active | none | none | 本文优先于索引和历史材料 |
| 中文先行术语规范 | `docs/course/course-00-teaching-standard.md` | current-rule | docs | active | `docs/history/` | `docs/production-upgrade-terms-zh.md` | 当前解释性文档默认中文先行、英文括注；文件名、命令名、代码字段、错误码、验证用例（verify case）和历史原文不做机械改写 |
| 开源边界 | `docs/open-source-boundary.md` | current-rule | open-source | active | `docs/course/claude-code-core-learning-path.md` | `docs/records/core-run-record.md`, `src/core/*.verify.mjs` | 对外能力声明、公开学习边界和 secret 边界以 open-source boundary、AGENTS 和 verify 证据为准 |
| 代码智能体实现逻辑综合文 | `docs/reference/code-agent-implementation-logic.md` | learning-reference | learning-system | active | `docs/history/`, `docs/reference/core-runtime-object-map.md`, `docs/course/claude-code-core-learning-path.md` | `docs/course/course-00-teaching-standard.md` through `docs/course/course-18-product-surface-implementation-chain.md`, `docs/core/core-01-integrated-runtime.md` through `docs/core/core-31-subagent-context-isolation.md`, `src/core/*.verify.mjs` | 该文负责当前综合叙事，不替代 course、core 或 verify；涉及能力声明时以开源边界和验证证据为准 |
| 开源项目规范 | `docs/reference/open-source-project-standards.md` | reference-authority | open-source | active | `docs/github-release-checklist.md` | `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/course_feedback.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `CHANGELOG.md` | GitHub 协作入口、reference 收录 gate 和 README / Issue / PR 标准以该文为参考；当前进度仍以 `CURRENT_STATE.md` 为准 |
| 运行时对象地图（Runtime Object Map） | `docs/reference/core-runtime-object-map.md` | learning-reference | learning-system | active | `docs/course/claude-code-core-learning-path.md`, `docs/course/course-07-core-build-pass-overview.md`, `docs/course/course-14-production-upgrade-evidence-chain.md`, `docs/course/course-18-product-surface-implementation-chain.md` | `docs/core/core-01-integrated-runtime.md` through `docs/core/core-31-subagent-context-isolation.md`, `src/core/*.verify.mjs`, `src/lab*/**/*.verify.mjs` | 对象地图只负责学习收束；具体行为、验收和边界仍以对应 Course、Core、Lab 和 verify 脚本为准 |
| Core 13-17 教学整理 | `docs/course/course-13-eval-reference-cost-evidence.md` | tutorial | course | active | `docs/course/course-12-eval-packaging-and-executable-seeds.md` | `docs/core/core-13-eval-expansion-third-batch.md`, `docs/core/core-14-eval-expansion-final-starter-batch.md`, `docs/core/core-15-reference-agent-comparison.md`, `docs/core/core-16-reference-agent-cost-and-cross-agent.md`, `docs/core/core-17-reference-agent-pricing-table-baseline.md`, `src/core/eval-expansion-third-batch.verify.mjs`, `src/core/eval-expansion-final-starter-batch.verify.mjs`, `src/core/reference-agent-comparison.verify.mjs`, `src/core/reference-agent-cost-and-cross-agent.verify.mjs`, `src/core/reference-agent-pricing-table-baseline.verify.mjs` | Core 13-17 的教学解释以 course-13 为准；具体验收以对应 core 文档和 verify 脚本为准 |
| 生产化升级路线 | `docs/roadmap/production-upgrade-roadmap.md` | current-rule | production-upgrade | active | `docs/reference/claude-code-agent-runtime-framework.md`, `docs/reference/claude-code-core-implementation-blueprint.md` | `docs/roadmap/production-upgrade-validation-matrix.md`, `docs/core/core-18-context-economy-cache-aware-context-engine.md`, `docs/core/core-19-compaction-quality-eval.md`, `docs/core/core-20-plan-state-machine.md`, `docs/core/core-21-long-running-task-eval.md`, `docs/core/core-22-tool-runtime-transaction.md`, `docs/core/core-23-model-gateway-budget-controller.md`, `docs/core/core-24-durable-session-store-replay.md`, `docs/core/core-25-repo-intelligence-relevance-index.md`, `docs/core/core-26-human-approval-interruption-protocol.md` | Core 18-26 的路线和顺序以 roadmap 为准，具体验收以 validation matrix 和对应 verify 为准 |
| Core 18-26 教学整理 | `docs/course/course-14-production-upgrade-evidence-chain.md` through `docs/course/course-17-session-repo-approval-production.md` | tutorial | course | active | `docs/course/course-07-core-build-pass-overview.md` through `docs/course/course-13-eval-reference-cost-evidence.md`, `docs/roadmap/production-upgrade-roadmap.md` | `docs/roadmap/production-upgrade-validation-matrix.md`, `docs/records/core-run-record.md`, `src/core/context-economy.verify.mjs` through `src/core/human-approval-interruption-protocol.verify.mjs` | Core 18-26 的总览叙事以 course-14 为准，逐验证用例（verify case）教学以 course-15 到 course-17 为准；路线和验收仍以路线图、验证矩阵和验证脚本（roadmap / validation matrix / verify scripts）为准 |
| Core 27-31 产品表层（Product Surface）教学整理 | `docs/course/course-18-product-surface-implementation-chain.md` | tutorial | course | active | `docs/roadmap/product-surface-study-roadmap.md`, `docs/roadmap/product-surface-validation-matrix.md`, `docs/roadmap/product-surface-core-candidates.md`, `docs/course/course-15-context-compaction-plan-production.md` through `docs/course/course-17-session-repo-approval-production.md` | `docs/core/core-27-settings-permission-resolver.md`, `docs/core/core-28-hooks-lifecycle.md`, `docs/core/core-29-memory-source-auto-memory.md`, `docs/core/core-30-checkpoint-rewind.md`, `docs/core/core-31-subagent-context-isolation.md`, `src/core/settings-permission-resolver.verify.mjs`, `src/core/hooks-lifecycle.verify.mjs`, `src/core/memory-source-auto-memory.verify.mjs`, `src/core/checkpoint-rewind.verify.mjs`, `src/core/subagent-context-isolation.verify.mjs` | Core 27-31 的教学执行链以 course-18 为准；候选资格仍以产品表层路线图 / 验证矩阵 / 迷你简报（Product Surface roadmap / validation matrix / mini brief）为准；具体验收以对应 Core 文档和 verify 脚本为准 |
| 产品表层学习路线 | `docs/roadmap/product-surface-study-roadmap.md` | current-rule | product-surface-study | active | `docs/course/course-00-teaching-standard.md`, `docs/course/course-03-clean-room-prompt-pack.md`, `docs/course/course-14-production-upgrade-evidence-chain.md` | `docs/roadmap/product-surface-validation-matrix.md`, `docs/core/core-27-settings-permission-resolver.md`, `docs/core/core-28-hooks-lifecycle.md`, `docs/core/core-29-memory-source-auto-memory.md`, `docs/core/core-30-checkpoint-rewind.md`, `docs/core/core-31-subagent-context-isolation.md`, official docs, locally reviewed product artifacts, future mini briefs | Core 26 之后的主题先按产品表层路线图（product-surface roadmap）判断“补旧课还是新 Core”；不能直接把系统提示词、源码映射（source map）或第三方差异（diff）原文写成公开实现依据 |
| 产品表层验证矩阵 | `docs/roadmap/product-surface-validation-matrix.md` | current-rule | product-surface-study | active | `docs/roadmap/product-surface-study-roadmap.md` | `src/core/settings-permission-resolver.verify.mjs`, `src/core/hooks-lifecycle.verify.mjs`, `src/core/memory-source-auto-memory.verify.mjs`, `src/core/checkpoint-rewind.verify.mjs`, `src/core/subagent-context-isolation.verify.mjs`, future mini briefs, future verify scripts | 候选 Core 必须先通过证据层级（evidence tier）、同主题合并（same-topic merge）、运行时边界（runtime boundary）、验证形态（verify shape）和公开边界门（public boundary gate） |
| 产品表层候选 Core | `docs/roadmap/product-surface-core-candidates.md` | planning-brief | product-surface-study | active | `docs/roadmap/product-surface-study-roadmap.md`, `docs/roadmap/product-surface-validation-matrix.md` | `docs/core/core-27-settings-permission-resolver.md`, `docs/core/core-28-hooks-lifecycle.md`, `docs/core/core-29-memory-source-auto-memory.md`, `docs/core/core-30-checkpoint-rewind.md`, `docs/core/core-31-subagent-context-isolation.md`, `src/core/settings-permission-resolver.verify.mjs`, `src/core/hooks-lifecycle.verify.mjs`, `src/core/memory-source-auto-memory.verify.mjs`, `src/core/checkpoint-rewind.verify.mjs`, `src/core/subagent-context-isolation.verify.mjs`, future verify scripts | 候选 Core 独立性以迷你简报（mini brief）为准；已实现候选以对应 Core 文档和验证脚本（verify scripts）为准；未通过 mini brief 的主题只能补已有课程 |
| Core 集成行为 | `docs/core/core-01-integrated-runtime.md` through `docs/core/core-31-subagent-context-isolation.md` | design-record | core | active | `docs/reference/claude-code-core-implementation-blueprint.md` | `src/core/*.verify.mjs`, `docs/records/core-run-record.md` | 具体 Core 阶段以对应 `core-XX` 文档和 verify 脚本为准 |
| Lab 机制 | `docs/lab/lab-01-mock-runtime-loop.md` through `docs/lab/lab-08-eval-runner.md` | tutorial | lab | active | `docs/course/course-06-labs-to-core-map.md` | `src/lab*/**/*.verify.mjs`, `docs/records/labs-verification-record.md` | 实验行为以源码 verify 为准 |
| 70%-80% 验收框架 | `docs/reference/claude-code-70-80-validation-and-model-access.md` | reference-authority | eval | active | `docs/reference/agent-runtime-optimization-loop.md` | `docs/core/core-10-70-80-eval-open-source-packaging.md`, `src/core/core-readiness-package.verify.mjs` | 能力声明必须经过 Core 10 和后续 eval 证据 |
| 历史产品分析 | `docs/history/` | history | background | active | none | none | 只解释背景，不覆盖当前实现规则 |

## Conflict Rules

1. 安全策略和 secret 处理优先于任何 prompt、项目规则或历史材料。
2. 当前进度、断点、下一步动作以 `CURRENT_STATE.md` 为准。
3. 主题 canonical doc 优先于辅助文档、历史背景和运行记录。
4. `src/**/*.verify.mjs` 是行为证据；文档描述不能声称未被验证的能力。
5. 历史背景和证据（Evidence）默认不参与当前规则竞争。

## 证据边界（Evidence Boundaries）

- evidence_dirs: `src/**/*verify.mjs`, `docs/records/core-run-record.md`, `docs/records/labs-verification-record.md`, `docs/records/lab-*-run-record.md`
- evidence_usage: 用于证明机制是否跑通、定位失败、支撑能力声明。
- evidence_is_not_default_rule_source: yes
- secret_boundary: `.env.local` 可以本地使用，但不进入源码、文档、trace、记录或公开报告。

## Review Notes

- 当前治理范围是最小开源入口层，不全量重写历史材料。
- Core 10 只建立 starter eval packaging，不是生产级 70%-80% 能力认证。
- 开源学习预览（Open Source Learning Preview）可以发布学习路径、本地确定性证据（deterministic local evidence）和协作规范；不能发布或暗示官方源码复刻、Claude Code 基线（baseline）、真实厂商账单或相对分数（RelativeScore）。
