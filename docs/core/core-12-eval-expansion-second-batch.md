# Core 12：Eval Expansion Second Batch

日期：2026-05-26

本阶段继续 Eval Expansion Pass，把第二批 Core 10 starter case 变成 executable repo seeds。

一句话：

```text
Core 12 proves that 5 more Core 10 starter cases can run as executable repo seeds, bringing cumulative executable starter coverage to 10/20 and adding a reference-agent runner interface without fabricating comparison results.
```

## 1. 为什么需要 Core 12

Core 11 已经完成第一批 5 个 executable repo seeds：

```text
read-before-edit
pagination fix
test command discovery
stale reread
dangerous command denial
```

Core 12 继续验证更容易出边界错误的能力：

```text
old_string 不唯一时不能编辑。
路径穿越必须被拒绝。
长 Bash 输出必须 artifact 化。
极小上下文预算下仍保留 latest_failure 和 verification_state。
Plan + Compaction 组合后仍能完成执行和验证。
```

## 2. 新增文件

代码：

```text
src/core/eval-expansion-second-batch.mjs
src/core/eval-expansion-second-batch.verify.mjs
```

文档：

```text
core-12-eval-expansion-second-batch.md
```

脚本：

```bash
npm run core:12
npm run core:12:verify
npm run verify:all
```

## 3. 本阶段选择的 5 个 seed

Core 12 选择：

```text
core10-l0-unique-old-string
core10-l0-path-safety
core10-l0-long-output-artifact
core10-l1-context-budget-pressure
core10-l3-plan-compact-continuity
```

覆盖范围：

```text
L0：old_string 多匹配必须返回 old_string_not_unique，不能修改文件。
L0：Read ../outside.txt 必须被 path policy 拒绝。
L0：长失败输出必须变成 context artifact。
L1：小预算下 latest_failure 和 verification_state 仍进入 context。
L3：approved plan 经过 compaction 后仍保留，并完成 Search / Read / Edit / Bash。
```

## 4. Eval Report 结构

Core 12 输出：

```text
scoreKind: executable_repo_seed_score
selectedStarterCases: 5
total: 5
passed: 5
score: 1
executableStarterCoverage.cumulativeCount: 10
executableStarterCoverage.starterTotal: 20
```

这表示：

```text
Core 10 的 20 个 starter case 中，目前已有 10 个被迁移为 executable repo seeds。
```

它仍不表示：

```text
已经达到完整 benchmark。
已经完成 reference-agent 对照。
已经获得 Claude Code / Codex-like 70%-80% 相对能力。
```

## 5. Reference-Agent 接口

Core 12 开始把 reference-agent 对照从“空字段”推进到“可运行接口”：

```text
referenceAgentComparison.status: interface_ready_no_runs
referenceAgentComparison.runnerContract.input:
  starterCaseId
  taskPrompt
  requiredChecks
referenceAgentComparison.runnerContract.output:
  score
  failureType
  cost
  latencyMs
  notes
```

每个 seed 都带有：

```text
referenceAgent.status: pending_run
referenceAgent.runRequest
referenceAgent.result: null
```

这表示结构已经能承载对照运行，但当前仍没有伪造 comparison score。

## 6. 本阶段证明了什么

Core 12 证明：

```text
第二批 5 个 starter case 可以稳定回放和评分。
old_string_not_unique、permission_denied、context artifact、hard context keep、compaction continuity 都能进入 executable seed evidence。
executable starter coverage 从 5/20 增加到 10/20。
reference-agent 对照接口已经明确，但对照结果仍为空。
verify:all 覆盖 Core 12。
```

## 7. 本阶段没有证明什么

Core 12 没有证明：

```text
剩余 10 个 starter case 已经 executable。
reference-agent 对照已经跑完。
executable_repo_seed_score 等于 SystemScore 或 RelativeScore。
当前系统达到生产级 70%-80% 能力。
```

下一步应该继续：

```text
把剩余 L0 provider/tool-result、L1 recovery/test attribution、L2 project/similar/public API、L4 prompt boundary 等 case 变成 executable seeds。
接入真正 reference-agent runner。
记录 cost、latency 和人工抽检字段。
把真实任务 trace 沉淀成 regression suite。
```

## 8. 验证命令

```bash
npm run core:12:verify
npm run verify:all
```

目标结果：

```text
core-12: 7/7 passed
full total: 110/110 passed
```
