Title: Claude Code Core Learning Authority Map
Type: authority-map
Layer: standard
Mode: reference
Scope: repo
Status: active
Owner: project-maintainer
Source of Truth: yes
Related Files: README.md, AGENTS.md, CURRENT_STATE.md, docs/index.md

# Claude Code Core Learning Authority Map

## Purpose

本文声明项目文档的主次关系：哪些文档负责当前规则，哪些负责学习路线，哪些只是历史背景或验证证据。新日期不自动代表更权威；冲突时按本文的 Topic Register 和 Conflict Rules 判断。

## Navigation Register

| Entry | Role | Default Use | Notes |
| --- | --- | --- | --- |
| `README.md` | 项目总入口 | yes | 面向人和 Agent 的快速入口、命令和边界说明 |
| `AGENTS.md` | Agent 控制入口 | yes | 约束 Agent 如何读取、修改、验证和处理 secret |
| `CURRENT_STATE.md` | 当前状态入口 | yes | 当前进度、最新验证、下一步动作唯一事实源 |
| `docs/index.md` | 文档索引 | yes | 按 Current Rules / History / Evidence 路由 |
| `docs/authority-map.md` | authority map | yes | 本文，负责冲突优先级 |

## Topic Register

| Topic | Canonical Doc | Doc Role | Scope | Status | History Docs | Evidence Docs | Conflict Rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 当前进度和下一步 | `CURRENT_STATE.md` | current-rule | repo | active | `claude-code-core-learning-path.md` | `core-run-record.md` | 当前状态冲突时以 `CURRENT_STATE.md` 为准 |
| 学习路线和命名 | `claude-code-core-learning-path.md` | current-rule | learning-system | active | none | `lab-*-run-record.md` | 路线命名冲突时以 learning path 为准 |
| Agent 工作控制 | `AGENTS.md` | current-rule | repo | active | none | `core-run-record.md` | 操作边界冲突时以 `AGENTS.md` 和安全策略为准 |
| 文档导航 | `docs/index.md` | index | docs | active | none | none | 导航冲突时以 authority map 的 canonical doc 为准 |
| 文档 authority | `docs/authority-map.md` | reference-authority | docs | active | none | none | 本文优先于索引和历史材料 |
| 生产化升级路线 | `production-upgrade-roadmap.md` | current-rule | production-upgrade | active | `claude-code-agent-runtime-framework.md`, `claude-code-core-implementation-blueprint.md` | `production-upgrade-validation-matrix.md`, `core-18-context-economy-cache-aware-context-engine.md`, `core-19-compaction-quality-eval.md`, `core-20-plan-state-machine.md`, `core-21-long-running-task-eval.md`, `core-22-tool-runtime-transaction.md`, `core-23-model-gateway-budget-controller.md`, `core-24-durable-session-store-replay.md`, future `core-25` through `core-26` verify scripts | Core 18-26 的路线和顺序以 roadmap 为准，具体验收以 validation matrix 和对应 verify 为准 |
| Core 集成行为 | `core-01-integrated-runtime.md` through `core-24-durable-session-store-replay.md` | design-record | core | active | `claude-code-core-implementation-blueprint.md` | `src/core/*.verify.mjs`, `core-run-record.md` | 具体 Core 阶段以对应 `core-XX` 文档和 verify 脚本为准 |
| Lab 机制 | `lab-01-mock-runtime-loop.md` through `lab-08-eval-runner.md` | tutorial | lab | active | `course-06-labs-to-core-map.md` | `src/lab*/**/*.verify.mjs`, `labs-verification-record.md` | 实验行为以源码 verify 为准 |
| 70%-80% 验收框架 | `claude-code-70-80-validation-and-model-access.md` | reference-authority | eval | active | `agent-runtime-optimization-loop.md` | `core-10-70-80-eval-open-source-packaging.md`, `src/core/core-readiness-package.verify.mjs` | 能力声明必须经过 Core 10 和后续 eval 证据 |
| 历史产品分析 | 原始中文分析文章 | history | background | active | none | none | 只解释背景，不覆盖当前实现规则 |

## Conflict Rules

1. 安全策略和 secret 处理优先于任何 prompt、项目规则或历史材料。
2. 当前进度、断点、下一步动作以 `CURRENT_STATE.md` 为准。
3. 主题 canonical doc 优先于辅助文档、历史背景和运行记录。
4. `src/**/*.verify.mjs` 是行为证据；文档描述不能声称未被验证的能力。
5. 历史背景和 Evidence 默认不参与当前规则竞争。

## Evidence Boundaries

- evidence_dirs: `src/**/*verify.mjs`, `core-run-record.md`, `labs-verification-record.md`, `lab-*-run-record.md`
- evidence_usage: 用于证明机制是否跑通、定位失败、支撑能力声明。
- evidence_is_not_default_rule_source: yes
- secret_boundary: `.env.local` 可以本地使用，但不进入源码、文档、trace、记录或公开报告。

## Review Notes

- 当前治理范围是最小开源入口层，不全量重写历史材料。
- Core 10 只建立 starter eval packaging，不是生产级 70%-80% 能力认证。
