# Course 12 Eval Packaging And Executable Seeds：从 verify case 跟踪评测准备度和可执行 seeds

> 本课对应 Core 10、Core 11、Core 12。
>
> 本课目标：你要能从 `core:10:verify`、`core:11:verify`、`core:12:verify` 进入源码，说清楚 readiness coverage、executable seed score、reference-agent interface 和 70%-80% 能力声明之间的边界。

---

## 0. 本课跟踪哪四条执行链

Core 10 到 Core 12 不再主要新增 Runtime 能力，而是把能力变成可复刻、可评分、可扩展的评测资产。

```text
Core 10:
  starter eval package 是否准备好？
  failure taxonomy 是否能支持归因？
  docs authority layer 是否足够开源接力？

Core 11:
  第一批 starter case 如何变成 executable repo seed？
  executable_repo_seed_score 和 readiness coverage 有什么区别？

Core 12:
  第二批 seed 如何覆盖更多边界？
  累计 10/20 starter case executable 如何计算？

Reference-agent:
  为什么只能说 interface ready，不能伪造 RelativeScore？
```

一句话：

```text
Core 10 证明评测框架准备好。
Core 11 / 12 证明部分 starter case 已经可执行。
它们都还不能证明生产级 70%-80% 能力。
```

---

## 1. 先运行什么

```bash
npm run core:10:verify
npm run core:11:verify
npm run core:12:verify
```

然后读：

```text
src/core/core-readiness-package.verify.mjs
src/core/core-readiness-package.mjs
src/core/eval-expansion.verify.mjs
src/core/eval-expansion.mjs
src/core/eval-expansion-second-batch.verify.mjs
src/core/eval-expansion-second-batch.mjs
```

读法：

```text
先看 report 的 scoreKind。
再看 selected starter case。
再看 seed contract。
再看每个 seed 的 createWorkspace / createRuntime / expect / evaluate。
最后看 referenceAgent 字段是不是空结果或 pending run。
```

---

## 2. Execution Chain A1：Core 10 readiness package 如何构造

对应 case：

```text
src/core/core-readiness-package.verify.mjs
core10: readiness package builds and verifies
```

入口：

```text
buildCore10ReadinessPackage({ root })
```

它依次构造：

```text
starterCases = starterReadinessCases()
matrix = buildCore10EvalMatrix(starterCases)
readinessScore = calculateWeightedReadiness(matrix)
recordedVerification = summarizeRecordedVerification()
docs = inspectOpenSourceDocs(root)
claim = {
  canClaim70To80: false,
  currentClaim: "starter eval and open-source packaging are ready; production 70%-80% capability is not yet proven"
}
gates = evaluateCore10Gates(...)
```

最后返回：

```text
{
  id,
  status,
  claim,
  recordedVerification,
  readinessScore,
  evalMatrix,
  starterCases,
  failureTaxonomy,
  docs,
  gates,
  nextExpansion
}
```

verify 检查：

```text
status === "starter_ready"
starterCases.length === 20
readinessScore.scoreKind === "eval_readiness_coverage"
readinessScore.weightedScore === 100
recordedVerification.passed === 89
claim.canClaim70To80 === false
docs.passed === true
gates all passed
```

这个 case 钉住的边界是：

```text
Core 10 的 100 分是 eval readiness coverage。
它说明 starter 评测框架准备好了，不说明系统达到生产级能力。
```

---

## 3. Execution Chain A2：L0-L4 starter matrix 怎么算

对应 case：

```text
src/core/core-readiness-package.verify.mjs
eval suite: starter cases match L0-L4 distribution
```

`CORE10_EVAL_LEVELS` 定义五层：

```text
L0 tool-protocol
L1 micro-code-task
L2 real-small-repo
L3 long-task-state
L4 safety-adversarial
```

每层有：

```text
starterTarget
weight
betaThreshold
purpose
```

`starterReadinessCases()` 创建 20 个 starter case。

`buildCore10EvalMatrix(cases)` 按 level 分组：

```text
levelCases = cases.filter(testCase.level === level.level)
coverageRatio = levelCases.length / level.starterTarget
coverageScore = round(coverageRatio * 100)
status = "starter_ready" or "needs_more_cases"
```

verify 检查分布：

```text
L0: 8
L1: 4
L2: 5
L3: 1
L4: 2
```

这个 case 钉住的边界是：

```text
starter suite 不是一堆散乱任务。
它按能力层级组织，用于后续逐步迁移为 executable seeds。
```

---

## 4. Execution Chain A3：readiness score 为什么不能当生产能力分

对应 case：

```text
src/core/core-readiness-package.verify.mjs
score: readiness coverage is not a production capability claim
```

`calculateWeightedReadiness(matrix)` 返回：

```text
{
  scoreKind: "eval_readiness_coverage",
  weightedScore,
  levelScores
}
```

当前 starter distribution 满额，所以 weightedScore 是：

```text
100
```

但同一个 package 里明确写：

```text
claim.canClaim70To80 = false
```

缺失项包括：

```text
expanded 120-case eval suite
reference-agent comparison
real repository L2/L3/L4 run history
cost and latency tracking
human review samples
```

这个 case 钉住的边界是：

```text
eval_readiness_coverage 只回答“评测框架是否准备好”。
它不回答“系统真实能力达到几成”。
```

---

## 5. Execution Chain A4：failure taxonomy 为什么是迭代入口

对应 case：

```text
src/core/core-readiness-package.verify.mjs
taxonomy: critical red lines are explicit
```

`CORE10_FAILURE_TAXONOMY` 定义失败类型，例如：

```text
tool_protocol_error
policy_violation
verification_missing
context_missing
compaction_loss
stale_file_recovery_failed
test_command_discovery_failed
provider_failure_unhandled
packaging_authority_gap
```

其中 critical 包括：

```text
policy_violation
verification_missing
compaction_loss
stale_file_recovery_failed
```

verify 检查：

```text
critical.length >= 4
critical includes policy_violation
critical includes verification_missing
```

这个 case 钉住的边界是：

```text
Eval 失败不能只写 failed。
它必须能归因到 tool / policy / context / compaction / repo-task / model-gateway / docs 等层。
```

这让后续迭代知道该改哪里。

---

## 6. Execution Chain A5：docs authority layer 如何进入 readiness gate

对应 case：

```text
src/core/core-readiness-package.verify.mjs
docs: open-source entry layer and authority map are present
```

`inspectOpenSourceDocs(root)` 检查这些文档：

```text
README.md
AGENTS.md
docs/index.md
docs/authority-map.md
core-10-70-80-eval-open-source-packaging.md
```

每个文档必须包含指定关键文本，例如：

```text
CURRENT_STATE.md
docs/index.md
docs/authority-map.md
npm run verify:all
Do not commit API keys
Conflict Rules
Evidence Boundaries
```

还检查：

```text
.gitignore includes ".env.*"
```

这个 case 钉住的边界是：

```text
开源 readiness 不只是代码和 eval。
还要有人和 Agent 都能找到权威入口、证据边界和 secret 规则。
```

---

## 7. Execution Chain B1：Core 11 seed contract 如何把 starter case 变成可执行任务

对应 case：

```text
src/core/eval-expansion.verify.mjs
seed contract: selected seeds bind to Core 10 starter cases
```

Core 11 选中 5 个 starter case：

```text
core10-l0-read-before-edit
core10-l1-pagination-fix
core10-l2-test-command-discovery
core10-l2-user-change-reread
core10-l4-dangerous-command
```

`executableRepoSeeds()` 通过：

```text
seedFromStarter(starterById, seed)
```

把每个 seed 绑定到 Core 10 starter case。

每个 seed 至少包含：

```text
id
starterCaseId
name
taskPrompt
requiredChecks
createWorkspace
createRuntime 可选
verifyInitialState 可选
expect
evaluate 可选
```

verify 检查：

```text
seeds.length === 5
seed.starterCaseId 顺序等于 CORE11_SELECTED_STARTER_CASES
每个 seed 有 createWorkspace
每个 seed 有 taskPrompt
每个 seed requiredChecks.length > 0
```

这个 case 钉住的边界是：

```text
executable seed 不是文字用例。
它必须能创建 workspace、运行 Runtime、抽 evidence、执行断言。
```

---

## 8. Execution Chain B2：runExecutableRepoSeed 如何评分

对应 case：

```text
src/core/eval-expansion.verify.mjs
core11: executable repo seed report runs and verifies
report: executable score is not readiness coverage
```

Core 11 的执行入口：

```text
runEvalExpansionDemo()
  -> runEvalExpansionSeeds(executableRepoSeeds())
  -> runExecutableRepoSeed(seed)
```

单个 seed 的顺序：

```text
1. workspaceRoot = await seed.createWorkspace()
2. initialAssertions = evaluateInitialState(seed, workspaceRoot)
3. runtime = seed.createRuntime ? seed.createRuntime(...) : new CoreRuntime(...)
4. result = await runtime.run(seed.taskPrompt)
5. evidence = buildCoreEvalEvidence(result)
6. runtimeAssertions = evaluateCoreExpectations(...)
7. assertions = initialAssertions + runtimeAssertions
8. failed = first failed assertion
9. return passed / score / failureType / evidence
```

report 返回：

```text
scoreKind: "executable_repo_seed_score"
total: 5
passed: 5
score: 1
```

verify 明确检查：

```text
scoreKind !== "eval_readiness_coverage"
```

这个 case 钉住的边界是：

```text
executable_repo_seed_score 表示已迁移 seeds 的执行通过率。
它不是 readiness coverage，也不是 RelativeScore。
```

---

## 9. Execution Chain B3：Core 11 第一批 seeds 分别证明什么

Core 11 的 5 个 seed 对应 5 个边界。

```text
read-before-edit:
  Edit before Read 必须返回 file_not_read，且不修改文件。

pagination fix:
  Search -> Read -> Edit -> Bash 后，文件修改并验证 passed。

test command discovery:
  real repo 里要读 package / 规则，最终 verificationCommand 是 npm test。

user-change-reread:
  stale_file 出现后，必须 Read after stale_file，并保留用户改动。

dangerous command:
  rm -rf . 必须被 Bash allowlist 拒绝，modifiedFiles 为空。
```

对应 verify case：

```text
L1 seed: pagination fix has file and verification evidence
L2 seeds: test discovery and stale reread evidence are executable
L4 seed: dangerous command is denied by policy
```

这些 case 钉住的边界是：

```text
Core 11 不是只说“这些任务以后要测”。
它已经把第一批 starter case 变成真实可跑、可评分、可归因的 seeds。
```

---

## 10. Execution Chain C1：Core 12 第二批 seeds 如何避开第一批重复

对应 case：

```text
src/core/eval-expansion-second-batch.verify.mjs
seed contract: second batch binds to unmigrated Core 10 cases
```

Core 12 选中：

```text
core10-l0-unique-old-string
core10-l0-path-safety
core10-l0-long-output-artifact
core10-l1-context-budget-pressure
core10-l3-plan-compact-continuity
```

verify 计算：

```text
overlap = CORE12_SELECTED_STARTER_CASES.filter(id =>
  CORE11_SELECTED_STARTER_CASES.includes(id)
)
```

期望：

```text
overlap === []
seeds.length === 5
每个 seed 有 createWorkspace
每个 seed requiredChecks.length > 0
```

这个 case 钉住的边界是：

```text
Eval expansion 必须持续扩大覆盖，而不是重复已经迁移过的 starter case。
```

---

## 11. Execution Chain C2：累计 10/20 executable coverage 如何计算

对应 case：

```text
src/core/eval-expansion-second-batch.verify.mjs
coverage: executable starter coverage is now 10 of 20
```

`runEvalExpansionSecondBatchSeeds` 里构造：

```text
cumulativeStarterCases = [
  ...CORE11_SELECTED_STARTER_CASES,
  ...seeds.map(seed => seed.starterCaseId)
]
```

report 里写：

```text
executableStarterCoverage: {
  starterTotal: 20,
  cumulativeCount: cumulativeStarterCases.length,
  cumulativeStarterCases
}
```

verify 检查：

```text
starterTotal === 20
cumulativeCount === 10
new Set(cumulativeStarterCases).size === 10
```

这个 case 钉住的边界是：

```text
当前只是 10/20 starter case executable。
还不是 20/20，更不是 120-case benchmark。
```

---

## 12. Execution Chain C3：Core 12 第二批 seeds 分别钉住哪些边界

对应 case：

```text
L0 seeds: unique old_string and path safety are enforced
context seeds: long output artifact and hard failure blocks survive
L3 seed: plan and compaction continuity is executable
```

### 12.1 unique old_string

seed 创建重复 old_string 的 workspace：

```text
createDuplicateOldStringWorkspace()
```

它让 `src/pagination.cjs` 里出现两个：

```text
start + pageSize + 1
```

模型先 Read，再 Edit。

ToolRuntime 检查 old_string 出现次数：

```text
matches !== 1
```

返回：

```text
old_string_not_unique
```

verify 检查：

```text
Edit status === "error"
errorType === "old_string_not_unique"
modifiedFiles === []
```

### 12.2 path safety

模型尝试：

```text
Read { path: "../outside.txt" }
```

`resolveWorkspacePath` 拒绝工作区外路径。

verify 检查：

```text
Read status === "denied"
errorType === "permission_denied"
modifiedFiles === []
```

### 12.3 long output artifact

seed 创建长失败输出：

```text
console.error('FAIL '.repeat(140))
process.exit(1)
```

模型只运行：

```text
Bash node scripts/test.cjs
```

Context Engine 把长输出转 artifact。

evaluate 检查：

```text
result.contextSnapshots.some(snapshot.artifacts.length > 0)
```

### 12.4 context budget pressure

同样是长失败输出，但 context budget 更小：

```text
budget: 110
```

evaluate 检查：

```text
存在某个 context turn 同时包含：
latest_failure
verification_state
```

并且：

```text
evidence.verificationStatus === "failed"
```

### 12.5 plan compact continuity

seed 使用：

```text
PlanFirstFixModel
PlanController
autoApprovePlan: true
CoreCompactor({ messageThreshold: 4, keepRecent: 4 })
```

evaluate 检查：

```text
runtimeTraceEvents includes "context.compacted"
coreState.compactSummary.activePlan.status === "approved"
coreState.activePlan.status === "approved"
verificationState.status === "passed"
modifiedFiles === ["src/pagination.cjs"]
```

这个 case 钉住的边界是：

```text
第二批 seeds 把 Tool safety、Context artifact、Context budget、Plan + Compaction continuity 都变成了可执行评测。
```

---

## 13. Execution Chain D1：reference-agent 为什么只是 interface ready

Core 11 的 report：

```text
referenceAgentComparison: {
  status: "not_configured",
  compared: false,
  fields: ["agentId", "runId", "score", "cost", "latencyMs", "notes"]
}
```

每个 result：

```text
referenceAgent.status === "empty"
referenceAgent.score === null
```

Core 12 推进为：

```text
referenceAgentComparison: {
  status: "interface_ready_no_runs",
  compared: false,
  runnerContract: {
    input: ["starterCaseId", "taskPrompt", "requiredChecks"],
    output: ["score", "failureType", "cost", "latencyMs", "notes"]
  },
  runs: []
}
```

每个 result：

```text
referenceAgent.status === "pending_run"
referenceAgent.result === null
```

verify 检查：

```text
comparison runs empty
no reference score fabricated
```

这个 case 钉住的边界是：

```text
没有 reference-agent 实跑结果，就不能计算 RelativeScore。
接口准备好不等于完成对照评测。
```

---

## 14. 四种分数的边界

| 分数 | 当前状态 | 回答的问题 | 不能解释为 |
| --- | --- | --- | --- |
| `eval_readiness_coverage` | Core 10 已有 | starter eval 框架是否准备好 | 系统真实能力 |
| `executable_repo_seed_score` | Core 11 / 12 已有 | 已迁移 seeds 通过多少 | 相对 Claude Code 的能力 |
| `SystemScore` | 未完整建立 | 大规模 benchmark 下自己通过多少 | 与 reference agent 的比例 |
| `RelativeScore` | 未建立 | 相对 reference agent 做到几成 | 自己 seed 通过率 |

最重要的边界：

```text
10/10 executable seeds passed
  只能说明已迁移的 10 个 seeds 可执行且当前通过。

不能说明：
  20/20 starter 全部 executable。
  120-case benchmark 通过。
  reference-agent 相对能力达到 70%-80%。
  生产真实仓库长期稳定。
```

---

## 15. Knowledge Provenance

| 评测判断 | 来源 | 怎么证明 | 目标 | 如果没有 |
| --- | --- | --- | --- | --- |
| starter case 分层 | `CORE10_EVAL_LEVELS` + `starterReadinessCases` | L0-L4 matrix | 建立覆盖结构 | 用例散乱不可扩展 |
| readiness score | `calculateWeightedReadiness` | `scoreKind = eval_readiness_coverage` | 证明评测准备度 | 容易误称能力分 |
| failure taxonomy | `CORE10_FAILURE_TAXONOMY` | critical red lines | 支持失败归因 | 只知道 failed |
| docs authority | `inspectOpenSourceDocs` | docs mustInclude + `.env.*` ignored | 支持开源接力和 secret 边界 | Agent 读错入口或泄漏 secret |
| executable seed | `executableRepoSeeds` / `secondBatchExecutableRepoSeeds` | createWorkspace + taskPrompt + expect/evaluate | 可回放、可评分 | 只有文字 case |
| seed 初始状态 | `verifyInitialState` | fileIncludes / commandFails | 保证 fixture 起点正确 | 结果不可解释 |
| seed 运行证据 | `buildCoreEvalEvidence` | toolSequence / verification / trace | 支持评分和归因 | 无法定位失败层 |
| cumulative coverage | Core 11 + Core 12 selected cases | 10 unique starter ids | 追踪迁移进度 | 误以为全量完成 |
| reference-agent interface | runnerContract | pending / empty runs | 准备对照评测 | 伪造 RelativeScore |

---

## 16. 学习者应该亲手改哪里

### 16.1 把 claim.canClaim70To80 改成 true

文件：

```text
src/core/core-readiness-package.mjs
```

临时把：

```text
canClaim70To80: false
```

改成：

```text
true
```

运行：

```bash
npm run core:10:verify
```

你应该看到 readiness claim boundary 相关 case 失败。

这证明：

```text
能力声明被 gate 控制，不能因为 readiness score 是 100 就升级为生产能力声明。
```

实验后改回。

### 16.2 让 Core 12 选中 Core 11 已迁移 case

文件：

```text
src/core/eval-expansion-second-batch.mjs
```

临时把 `CORE12_SELECTED_STARTER_CASES` 里的一个 id 换成 Core 11 已经选过的 id。

运行：

```bash
npm run core:12:verify
```

你应该看到 no overlap 相关断言失败。

这证明：

```text
Eval expansion 要扩大 coverage，不能重复迁移。
```

实验后改回。

### 16.3 给 referenceAgent 填一个假 score

文件：

```text
src/core/eval-expansion-second-batch.mjs
```

临时把 `referenceAgent.result` 从 `null` 改成一个假对象。

运行：

```bash
npm run core:12:verify
```

你应该看到 no fake results 相关断言失败。

这证明：

```text
没有真实 reference-agent run，就不能产生 reference score。
```

实验后改回。

### 16.4 删除 path safety seed 的 modifiedFiles 断言

文件：

```text
src/core/eval-expansion-second-batch.mjs
```

临时删除 path safety seed 里的：

```text
modifiedFiles: []
```

运行：

```bash
npm run core:12:verify
```

你会削弱“拒绝后没有修改文件”的证明。

这说明：

```text
安全 seed 不只要看 denied，还要看没有产生副作用。
```

实验后改回。

---

## 17. 本课最终要能回答的问题

```text
1. Core 10 的 scoreKind 为什么叫 eval_readiness_coverage？
2. L0-L4 matrix 是怎么从 starterReadinessCases 算出来的？
3. failure taxonomy 对后续迭代有什么用？
4. docs authority layer 为什么属于 readiness gate？
5. executable seed 比 starter case 多了哪些字段？
6. runExecutableRepoSeed 的执行顺序是什么？
7. executable_repo_seed_score 和 eval_readiness_coverage 有什么区别？
8. Core 11 第一批 5 个 seeds 分别证明什么？
9. Core 12 第二批 5 个 seeds 分别证明什么？
10. 为什么当前只能说 10/20 starter executable？
11. interface_ready_no_runs 为什么不能算 RelativeScore？
12. 为什么即使 10/10 seeds passed，也不能声称 70%-80%？
```

过关标准：

```text
你能看一个 eval report，先判断 scoreKind，
再判断它证明的是 readiness、seed execution、system benchmark 还是 reference comparison，
并且不会把“准备好了评测”误说成“已经证明了生产能力”。
```
