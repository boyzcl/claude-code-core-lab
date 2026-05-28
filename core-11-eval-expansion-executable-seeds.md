# Core 11：Eval Expansion Executable Repo Seeds

日期：2026-05-26

本阶段目标是进入 Eval Expansion Pass，把 Core 10 的 starter task suite 中一小批 case 从 readiness mapping 推进为真正可执行、可回放、可评分、可归因的 repo seeds。

一句话：

```text
Core 11 proves that 5 Core 10 starter cases can run as executable repo seeds and produce an executable seed score, while reference-agent comparison remains an empty reserved structure.
```

## 1. 为什么需要 Core 11

Core 10 已经定义了：

```text
20 个 starter case
L0-L4 分层
failure taxonomy
eval_readiness_coverage
最小开源入口和 authority map
```

但 Core 10 的分数仍是：

```text
eval_readiness_coverage
```

它证明的是评测准备度，不是真实 case 已经被运行。Core 11 的目标是把第一批 starter case 变成：

```text
固定初始状态
固定 task prompt
固定允许工具和 required checks
固定 success assertions
可输出 executable_repo_seed_score
保留 reference-agent 对照字段但暂不填充
```

## 2. 新增文件

代码：

```text
src/core/eval-expansion.mjs
src/core/eval-expansion.verify.mjs
```

文档：

```text
core-11-eval-expansion-executable-seeds.md
```

脚本：

```bash
npm run core:11
npm run core:11:verify
npm run verify:all
```

## 3. 本阶段选择的 5 个 seed

Core 11 先选择 5 个 Core 10 starter case：

```text
core10-l0-read-before-edit
core10-l1-pagination-fix
core10-l2-test-command-discovery
core10-l2-user-change-reread
core10-l4-dangerous-command
```

覆盖范围：

```text
L0：Edit before Read 必须留下 file_not_read 证据。
L1：分页 off-by-one 可以搜索、读取、编辑并通过测试。
L2：真实 repo fixture 中可以发现 npm test。
L2：用户中途改文件后必须 stale_file -> Read -> Edit 恢复。
L4：危险 Bash 命令必须被 allowlist policy 拒绝。
```

## 4. Eval Report 结构

Core 11 输出：

```text
scoreKind: executable_repo_seed_score
selectedStarterCases: 5
total: 5
passed: 5
score: 1
```

每个 seed 都包含：

```text
starterCaseId
level
taskPrompt
requiredChecks
referenceAgent
assertions
evidence
```

其中 evidence 来自真实 CoreRuntime 运行结果，包括：

```text
toolCalls
toolResults
toolSequence
modifiedFiles
verificationStatus
verificationCommand
finalAnswer
storeTraceEvents
runtimeTraceEvents
contextTurns
```

## 5. Reference-Agent 边界

Core 11 只建立 reference-agent 对照字段：

```text
referenceAgent.status: empty
referenceAgentComparison.status: not_configured
```

这意味着：

```text
结构已经预留。
当前还没有运行 reference-agent。
当前 score 不能解释为 relative score。
```

## 6. 本阶段证明了什么

Core 11 证明：

```text
Core 10 的一部分 starter case 可以从 readiness mapping 变成可执行 eval seed。
每个 seed 可以固定初始状态、任务 prompt、required checks 和 success assertions。
Eval Expansion 可以输出真实运行后的 executable_repo_seed_score。
L2 fixture 可以作为 repo seed 反复验证项目规则、测试发现和 stale edit recovery。
L4 dangerous command seed 可以证明 prompt 或模型意图不能绕过 Bash allowlist policy。
reference-agent 对照字段可以进入报告，但保持空值，不制造相对能力声明。
```

## 7. 本阶段没有证明什么

Core 11 没有证明：

```text
20 个 starter case 都已经 executable。
120-case benchmark 已经存在。
reference-agent 对照已经完成。
executable_repo_seed_score 等于生产能力分。
当前系统达到 Claude Code / Codex-like 70%-80% 相对能力。
```

下一步应该继续：

```text
把剩余 15 个 starter case 逐步变成 executable seeds。
为每个 seed 增加 reference-agent 对照运行字段。
扩展 cost、latency、人工抽检和失败归因记录。
把真实任务 trace 沉淀成 regression suite。
```

## 8. 验证命令

```bash
npm run core:11:verify
npm run verify:all
```

目标结果：

```text
core-11: 7/7 passed
full total: 103/103 passed
```
