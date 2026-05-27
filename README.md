# Claude Code Core Learning

这是一个 clean-room 学习项目，用 course -> lab -> core 的方式，从零构建一个 Claude Code-like Core。目标不是一次性复刻完整产品，而是把本地 coding agent 的关键闭环拆成可运行、可验证、可教学的阶段。

当前状态以 `CURRENT_STATE.md` 为准。历史解释、架构背景和实验记录只作为辅助材料。

## Quick Start

Prerequisites:

```bash
node --version
npm --version
```

Install:

```bash
npm install
```

Verify:

```bash
npm run verify:all
```

Run selected demos:

```bash
npm run core:demo
npm run core:07:live
npm run core:10
npm run core:11
npm run core:12
npm run core:13
npm run core:14
npm run core:15
npm run core:16
npm run core:17
npm run core:18
npm run core:19
npm run core:20
npm run core:21
```

`core:07:live` 会读取本地 `.env.local` 里的模型配置。`.env.local` 被 git 忽略，不能提交。

## Repository Map

- `CURRENT_STATE.md`: 当前进度、最新验证、下一步动作和新对话恢复入口。
- `claude-code-core-learning-path.md`: 学习路线、阶段定义和命名规则。
- `course-*.md`: 课程层，解释每个机制为什么存在。
- `lab-*.md` and `src/lab*/`: 局部机制实验。
- `core-*.md` and `src/core/`: 集成实现与验证。
- `core-run-record.md`: Core 验证记录。
- `labs-verification-record.md`: Lab 验证记录。
- `docs/index.md`: 开源文档导航。
- `docs/authority-map.md`: 文档 authority 和冲突优先级。
- `production-upgrade-roadmap.md`: Core 18-26 生产化升级路线。
- `production-upgrade-validation-matrix.md`: Core 18-26 验证先行矩阵。

## Common Tasks

- Run all lab checks: `npm run verify:labs`
- Run all checks: `npm run verify:all`
- Verify real model adapter contract: `npm run core:07:verify`
- Run live DeepSeek E2E: `npm run core:07:live`
- Inspect eval/open-source readiness: `npm run core:10`
- Verify eval/open-source readiness: `npm run core:10:verify`
- Run executable eval seeds: `npm run core:11`
- Verify executable eval seeds: `npm run core:11:verify`
- Run second executable seed batch: `npm run core:12`
- Verify second executable seed batch: `npm run core:12:verify`
- Run third executable seed batch: `npm run core:13`
- Verify third executable seed batch: `npm run core:13:verify`
- Run final starter seed batch: `npm run core:14`
- Verify final starter seed batch: `npm run core:14:verify`
- Run Codex local reference comparison sample: `npm run core:15`
- Verify Codex local reference comparison sample: `npm run core:15:verify`
- Run reference-agent cost and cross-agent readiness report: `npm run core:16`
- Verify reference-agent cost and cross-agent readiness report: `npm run core:16:verify`
- Run reference-agent pricing table baseline: `npm run core:17`
- Verify reference-agent pricing table baseline: `npm run core:17:verify`
- Run context economy and cache-aware context report: `npm run core:18`
- Verify context economy and cache-aware context report: `npm run core:18:verify`
- Run compaction quality eval report: `npm run core:19`
- Verify compaction quality eval report: `npm run core:19:verify`
- Run plan state machine report: `npm run core:20`
- Verify plan state machine report: `npm run core:20:verify`
- Run long-running task eval report: `npm run core:21`
- Verify long-running task eval report: `npm run core:21:verify`
- Run tool runtime transaction report: `npm run core:22`
- Verify tool runtime transaction report: `npm run core:22:verify`

## Docs

Start here:

- `CURRENT_STATE.md`
- `production-upgrade-roadmap.md`
- `production-upgrade-validation-matrix.md`
- `docs/index.md`
- `docs/authority-map.md`

Learning courses:

- `course-00-teaching-standard.md`
- `course-01-initial-model-request.md`
- `course-02-action-selection-rubric.md`
- `course-03-clean-room-prompt-pack.md`
- `course-04-single-task-full-trace.md`
- `course-05-product-mental-model.md`
- `course-06-labs-to-core-map.md`
- `course-07-core-build-pass-overview.md`
- `course-08-model-gateway-and-context-engine.md`
- `course-09-plan-mode-and-compaction.md`
- `course-10-trace-eval-real-model-and-recovery.md`
- `course-11-real-repo-task-layer.md`
- `course-12-eval-packaging-and-executable-seeds.md`

Core implementation records:

- `core-01-integrated-runtime.md`
- `core-02-model-gateway.md`
- `core-03-context-engine-integration.md`
- `core-04-plan-mode-integration.md`
- `core-05-compaction-artifact-integration.md`
- `core-06-trace-eval-harness-expansion.md`
- `core-07-real-model-api-e2e.md`
- `core-08-prompt-pack-recovery-loop.md`
- `core-09-real-repo-task-layer.md`
- `core-10-70-80-eval-open-source-packaging.md`
- `core-11-eval-expansion-executable-seeds.md`
- `core-12-eval-expansion-second-batch.md`
- `core-13-eval-expansion-third-batch.md`
- `core-14-eval-expansion-final-starter-batch.md`
- `core-15-reference-agent-comparison.md`
- `core-16-reference-agent-cost-and-cross-agent.md`
- `core-17-reference-agent-pricing-table-baseline.md`
- `core-18-context-economy-cache-aware-context-engine.md`
- `core-19-compaction-quality-eval.md`
- `core-20-plan-state-machine.md`
- `core-21-long-running-task-eval.md`
- `core-22-tool-runtime-transaction.md`

## Current Boundary

Core 14 establishes executable repo seeds for all 20 Core 10 starter cases and brings cumulative executable starter coverage to 20/20. Core 15 records a small Codex local CLI reference-agent sample for 8 seeds, including repair, safety refusal, ambiguity refusal, and expected failed-verification outcomes. Core 16 adds a cost measurement basis and cross-agent readiness gate for those runs. Core 17 adds an explicit local pricing table baseline that produces configured USD estimates from the same evidence. Core 18 adds a cache-aware Context Economy Engine with stable prefix, dynamic tail, token budget eviction, artifact boundary, and cache simulation reports. Core 19 adds a compaction quality evaluator that detects objective drift, constraint loss, failure loss, plan loss, modified-file loss, and pending-action loss. Core 20 adds a Plan State Machine with step lifecycle, blocked reasons, revisions, compaction resume, permission checks, and final grounding. Core 21 adds a long-running task eval with repeated failure history, compaction resume, cost curve, no-false-final attribution, and learning handoff. Core 22 adds a deterministic ToolRuntime transaction layer with diff preview, multi-file commit, rollback, stale reread protection, protected-file approval gates, and high-risk Bash approval routing. The current roadmap continues through Core 23-26 production upgrades: model budget, durable replay, repo intelligence, and human approval. This is not a Claude Code baseline, not a RelativeScore, not a real vendor bill, not real provider cache billing, not a production long-running benchmark, not a full production ToolRuntime, and not a production-level Claude Code 70%-80% capability claim.

## Contributing

Before handing off changes, run:

```bash
npm run verify:all
```

Keep secrets in local ignored files such as `.env.local`; do not write API keys into source, docs, traces, or verification records.
