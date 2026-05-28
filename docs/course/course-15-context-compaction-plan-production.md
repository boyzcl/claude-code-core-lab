# Course 15 Context Compaction Plan Production：从 verify case 跟踪上下文经济、压缩保真和计划状态机

> 本课对应 Core 18、Core 19、Core 20。
>
> `course-14` 是 Core 18-26 Production Upgrade 总览课。
>
> 本课恢复 `course-08` 到 `course-12` 的执行链标准：从 verify case 进入源码对象，跟踪每个生产化边界在哪里被构造、检查、记录和验证。
>
> 术语先用中文理解；英文用于对照代码字段和 verify case：
>
> ```text
> docs/production-upgrade-terms-zh.md
> ```

---

## 0. 本课跟踪哪三条执行链

Core 18、Core 19、Core 20 共同解决长任务最前面的状态问题。

```text
Core 18 Context Economy:
  模型本轮能看见什么？
  哪些上下文稳定可缓存？
  哪些动态事实必须留在 tail？
  预算压力下为什么裁掉这些 block？

Core 19 Compaction Quality:
  压缩前后的目标、约束、失败、计划、文件和 pending action 是否保真？
  坏摘要能不能被机器归因为 compaction_loss？

Core 20 Plan State Machine:
  plan 如何从 approved 文本变成 step-level Runtime 状态？
  blocked、revision、resume、permission 和 final grounding 在哪里发生？
```

三条主线：

```text
主线 A：Context Economy
  verify case
    -> createContextEconomyFixture
    -> ContextEconomyEngine.build
    -> stablePrefix / dynamicTail / evictionReport / artifacts / cacheReport
    -> economyProof

主线 B：Compaction Quality
  verify case
    -> createCompactionQualityInput
    -> compactSession
    -> evaluateCompactionQuality
    -> checks / diff / failureType / recommendedAction

主线 C：Plan State Machine
  verify case
    -> PlanStateMachine.propose / approve
    -> startStep / completeStep / blockStep / revisePlan
    -> compactSession / PlanStateMachine.restore
    -> authorizeTool / finalAnswerDecision
```

一句话：

```text
Context 决定模型看见什么，Compaction 决定压缩后是否可信，Plan 决定任务执行到哪里以及能不能继续。
```

---

## 1. 先运行什么

```bash
npm run core:18:verify
npm run core:19:verify
npm run core:20:verify
```

然后读：

```text
src/core/context-economy.verify.mjs
src/core/context-economy.mjs
src/core/compaction-quality.verify.mjs
src/core/compaction-quality.mjs
src/core/plan-state-machine.verify.mjs
src/core/plan-state-machine.mjs
src/lab07/compaction.mjs
```

读法：

```text
先看 verify case 名字。
再看它构造了什么 fixture。
再看调用哪个核心对象或函数。
再看返回报告里的字段。
最后看断言证明了哪条生产化边界。
```

---

## 2. Core 18：上下文到底如何组装

先把实现里的入口写清楚。

`ContextEconomyEngine.build()` 接收的是：

```text
sessionId
workspaceRoot
turn
storeState
coreState
messages
previousSnapshot
```

这里有三类输入：

```text
配置输入:
  systemPrompt
  tools
  projectRules
  memories
  budget
  longToolOutputLimit

事实输入:
  MessageStore 生成的 messages
  storeState

Runtime 状态输入:
  activePlan
  modifiedFiles
  verificationState
  compactSummary
```

组装流程是固定的：

```text
ContextEconomyEngine.build
  -> buildEconomyCandidateBlocks
       生成所有候选 blocks 和 candidate artifacts
  -> fitEconomyBudget
       按 hard / medium / low 选择 blocks，输出 evictionReport
  -> stablePrefix = selectedBlocks.filter(zone === "stable_prefix")
  -> dynamicTail = selectedBlocks.filter(zone === "dynamic_tail")
  -> artifacts = candidateArtifacts 中被 selected block 引用的 artifact
  -> selectedMessages = selectEconomyMessages(messages, selectedBlocks)
  -> simulateStablePrefixCache({ stablePrefix, dynamicTail, previousSnapshot })
  -> buildTokenReport(...)
  -> economyProof
  -> return ModelRequest-like context result
```

最终返回的 `messages` 不是原始 MessageStore 全量历史，而是：

```text
[
  {
    role: "system",
    content: systemPrompt
  },
  {
    role: "runtime",
    content: {
      storeState,
      coreState,
      stablePrefix,
      dynamicTail,
      artifacts,
      evictionReport,
      cacheReport,
      tokenReport,
      economyProof
    }
  },
  ...selectedMessages
]
```

这就是“上下文组装”的核心：

```text
MessageStore 仍保存完整事实流。
Context Economy 只把本轮需要给模型看的 blocks、artifact references 和 selectedMessages 放进请求视图。
Runtime message 负责解释本轮选择、裁剪、缓存和 token 报告。
```

### 2.1 candidate blocks 从哪里来

`buildEconomyCandidateBlocks()` 先把信息转成统一 block。

stable prefix 候选：

```text
stable:system
  name=system
  zone=stable_prefix
  priority=hard
  content=systemPrompt

stable:tools
  name=tools
  zone=stable_prefix
  priority=hard
  content=stableStringify(tools)

stable:project_rules
  name=project_rules
  zone=stable_prefix
  priority=medium
  content=projectRules
```

dynamic tail 候选：

```text
tail:latest_user
tail:active_plan
tail:verification_state
tail:latest_failure
tail:modified_files
tail:compact_summary
tail:file:<path>
tail:tool:<tool_result_id>
tail:memory:<memory_id>
```

每个 block 都会被补齐：

```text
order
cacheable
content
tokens
hash
```

其中：

```text
cacheable = block.zone === "stable_prefix"
tokens = estimateTokens(content)
hash = sha256(stableStringify({ id, zone, content }))
```

这几个字段非常关键：

```text
order 解释 block 顺序。
zone 决定它属于 stable prefix 还是 dynamic tail。
priority 决定预算不足时谁先保留。
hash 决定下一轮能否模拟 cache hit。
```

### 2.2 预算选择怎么发生

`fitEconomyBudget(blocks, budget)` 的规则很朴素：

```text
1. 先选中所有 hard blocks。
2. 再按 medium、low 顺序尝试加入。
3. 加入某个 block 后如果不超过 budget，就保留。
4. 没被选中的 block 进入 evictionReport。
```

所以 Core 18 不是按“内容短不短”选择上下文，而是按：

```text
priority
budget
token estimate
```

一起决定。

这解释了为什么小预算下仍然保留：

```text
latest_user
active_plan
verification_state
latest_failure
```

因为它们是 hard state。

### 2.3 selectedMessages 为什么不是 selectedBlocks 的重复

`selectedBlocks` 是 Runtime 给模型的结构化解释。

`selectedMessages` 是从 MessageStore 里挑出来的原始消息子集：

```text
selectEconomyMessages(messages, selectedBlocks)
```

规则是：

```text
如果 selected block 有 sourceMessageId，就选中对应 message。
如果 block 来自 tool result，也选中对应 assistant_tool_call。
如果 tool result 已经 artifact 化，就不把 raw tool result message 放回 selectedMessages。
```

所以模型本轮得到的是两层材料：

```text
runtime message:
  告诉模型本轮上下文结构、裁剪、缓存、artifact 和 token 情况。

selectedMessages:
  给模型必要的原始 user / tool_call / tool_result 事实。
```

这就是为什么长输出不会反复污染上下文：

```text
长 tool result 会变成 artifact。
runtime message 给 artifact reference。
selectedMessages 不再携带 raw long output。
```

---

## 3. Core 18：什么叫“可以被缓存”

这里的“可以被缓存”不是说项目已经接入真实 provider cache billing。

它只证明：

```text
本地 Context Engine 能稳定识别哪些 block 在相邻轮次中没有变化，
并用 id + hash 对照模拟 cache hit。
```

缓存成立需要三个条件同时满足。

### 3.1 内容必须放在 stable prefix

Core 18 只把这些放进 stable prefix：

```text
system
tools
project_rules
```

因为这些内容在相邻轮次中通常不随工具结果、用户新消息、验证状态变化。

这些不会放进 stable prefix：

```text
latest_user
tool results
active_plan
verification_state
latest_failure
modified_files
compact_summary
read file content
memory
```

它们属于 dynamic tail。

原因很直接：

```text
一旦用户继续说话、工具返回结果、测试失败或 plan 状态变化，这些内容就会变。
如果把它们放进 stable prefix，stable prefix hash 就会频繁变化，cache simulation 失去意义。
```

### 3.2 id、顺序、hash 必须稳定

`simulateStablePrefixCache()` 不是模糊比较文本。

它逐个位置比较上一轮和这一轮的：

```text
block.id
block.hash
```

代码逻辑等价于：

```text
for each stablePrefix block by index:
  previous = previousSnapshot.stablePrefix[index]
  if previous.id === block.id && previous.hash === block.hash:
    cacheHitTokens += block.tokens
  else:
    cacheMissTokens += block.tokens
```

所以 cache hit 的前提是：

```text
同一个位置。
同一个 id。
同一个 content hash。
```

这也是为什么 verify 要同时检查：

```text
stablePrefix names 相同
stablePrefix ids 相同
stablePrefix hashes 相同
```

### 3.3 dynamic tail 必须明确不缓存

cache report 会分开记录：

```text
stablePrefixTokens
cacheHitTokens
cacheMissTokens
uncachedTailTokens
estimatedSavedTokens
```

其中：

```text
uncachedTailTokens = sumTokens(dynamicTail)
estimatedSavedTokens = cacheHitTokens
```

这表示：

```text
stable prefix 可以模拟缓存命中。
dynamic tail 每轮都按未缓存输入处理。
```

这条边界很重要：

```text
Core 18 没有说“整个上下文都可缓存”。
它只说 stable prefix 中 id/hash 不变的 blocks 在本地模拟中可视为 cache hit。
```

### 3.4 为什么这是关键教学内容

如果不讲清楚组装和缓存条件，学习者会误解成：

```text
把 system prompt 放前面就能缓存。
把内容写短一点就叫 token saving。
把摘要塞进 prompt 就叫 Context Economy。
```

正确理解应该是：

```text
上下文经济性 = block 化 + zone 分层 + priority 预算选择 + artifact 边界 + id/hash cache simulation。
```

这也是 Core 18 相比 Core 03 的升级点：

```text
Core 03 证明 Context Engine 可以选择和裁剪本轮可见世界。
Core 18 进一步证明这次选择为什么省 token、哪些内容稳定、哪些内容动态、哪些内容被裁、哪些内容可模拟 cache hit。
```

---

## 4. Execution Chain A1：stable prefix 为什么能稳定复用

对应 case：

```text
src/core/context-economy.verify.mjs
stable prefix: system, tool, and project blocks keep order id and hash
```

verify 构造：

```text
const fixture = createContextEconomyFixture()
const engine = new ContextEconomyEngine({
  budget: 1200,
  projectRules: "Preserve public APIs. Prefer narrow edits. Verify before final."
})
const first = buildWithFixture(engine, fixture, { turn: 1 })
fixture.store.appendUserMessage(...)
const second = buildWithFixture(engine, fixture, { turn: 2, previousSnapshot: first })
```

`buildWithFixture` 最终调用：

```text
engine.build({
  sessionId,
  workspaceRoot,
  turn,
  storeState,
  coreState,
  messages,
  previousSnapshot
})
```

Core 18 把这些 block 放进 stable prefix：

```text
system
tools
project_rules
```

verify 断言两轮的：

```text
stablePrefix names 相同
stablePrefix ids 相同
stablePrefix hashes 相同
```

这个 case 钉住的边界是：

```text
稳定前缀不是“看起来差不多”的文本。
它有明确 block id、顺序和 hash，能被后续 cache simulation 使用。
```

如果没有这条证据，token/cache 只能靠主观判断：

```text
可能误把 latest user 放进稳定前缀。
可能每轮重排 system / tools / rules，导致无法解释 cache hit。
可能把 provider cache saving 说成 prompt 策略，而不是 Runtime 结构。
```

---

## 5. Execution Chain A2：dynamic tail 为什么不能污染 stable prefix

对应 case：

```text
dynamic tail: latest user and tool results stay outside stable prefix
```

verify 在第一轮后追加新用户消息：

```text
fixture.store.appendUserMessage(fixture.sessionId, "继续处理最新失败。")
```

第二轮 build 后检查：

```text
stableNames 不包含 latest_user
stableNames 不包含 tool:* block
dynamicNames 包含 latest_user
dynamicNames 包含 tool:* block
first latest_user hash !== second latest_user hash
```

这个 case 钉住的边界是：

```text
最新用户消息和工具结果是动态事实。
它们必须进入 dynamic tail，不能污染 stable prefix。
```

教学重点：

```text
Context Economy 不是只为了省 token。
它还要把“稳定配置”和“每轮事实”分层，否则 cache 命中和任务恢复都会变得不可解释。
```

---

## 6. Execution Chain A3：预算压力下 hard state 为什么不能被裁

对应 case：

```text
token budget: low priority content is evicted and hard state survives
latest failure: failure, verification state, and active plan survive pressure
```

verify 设置很小预算：

```text
new ContextEconomyEngine({
  budget: 170,
  memories: [{ id: "low-priority-memory", ... }]
})
```

或更极端：

```text
budget: 80
```

然后检查 selected block：

```text
active_plan
verification_state
latest_failure
```

仍然存在；低优先级内容进入：

```text
evictionReport[]
```

每个 eviction entry 记录：

```text
id
name
zone
priority
tokens
reason
```

这个 case 钉住的边界是：

```text
预算裁剪不是随便删短文本或旧文本。
恢复任务所需 hard state 必须优先保留。
```

如果删错，后果是：

```text
模型看不到 active plan，不知道下一步做什么。
模型看不到 verification_state，可能未验证就 final。
模型看不到 latest_failure，可能重复失败动作。
```

---

## 7. Execution Chain A4：artifact 和 cache simulation 如何证明不是 prompt-only saving

对应 case：

```text
artifact boundary: long output is artifacted and not selected raw
cache simulation: second turn reports cache hits and uncached tail
no prompt-only saving: savings are proven by selection, artifacts, and cache
```

artifact case 检查：

```text
artifactSources includes "tool_result_latest_failure"
selectedMessages 不包含 raw long output
selectedMessages 不包含 tool_result_latest_failure 原始消息
```

cache case 检查第二轮：

```text
cacheHitTokens === stablePrefixTokens
cacheMissTokens === 0
uncachedTailTokens > 0
estimatedSavedTokens > 0
```

no prompt-only case 检查：

```text
economyProof.promptOnlySaving === false
economyProof.mechanisms.blockSelection === true
economyProof.mechanisms.artifactBoundary === true
economyProof.mechanisms.cacheSimulation === true
```

这个 case 钉住的边界是：

```text
token 节省必须来自 Runtime 可检查机制。
不能只靠 prompt 里写“请简洁”。
```

仍然不能声称：

```text
真实 provider cache billing。
真实 Claude Code context engine。
```

---

## 8. Execution Chain B1：Compaction Quality 如何做 before / after 对照

对应 case：

```text
objective preservation: compacted objective does not drift
constraint preservation: user and safety constraints remain complete
failure preservation: failed verification cannot become passed
```

verify 的共同入口是：

```text
const before = createCompactionQualityInput()
const compacted = compactSession(before)
const report = evaluateCompactionQuality({ before, compacted })
```

`before` 是 canonical task state：

```text
objective
latestUserConstraints
activePlan
modifiedFiles
latestFailures
verificationState
pendingActions
messages
newerMessages
```

`evaluateCompactionQuality` 输出：

```text
checks
failedChecks
diff
score
status
failureType
recommendedAction
```

objective case 检查：

```text
report.diff.objective.before === before.objective
report.diff.objective.after === before.objective
```

constraint case 检查：

```text
report.diff.constraints.missing === []
report.diff.constraints.extra === []
```

failure case 检查：

```text
before.verificationState.status === "failed"
report.diff.verificationState.after.status === "failed"
```

这个 case 钉住的边界是：

```text
Compaction 质量不是靠读摘要感觉。
它要能机器对照关键字段是否漂移、缺失或被改写。
```

---

## 9. Execution Chain B2：plan、modified files、pending actions 为什么必须保留

对应 case：

```text
plan preservation: active plan id, steps, and status survive
modified files: file path and reason remain traceable
pending actions: next actions remain available after compact
```

plan case 检查：

```text
report.diff.activePlan.after.id === before.activePlan.id
report.diff.activePlan.after.steps.map(step.status) === ["done", "active", "pending"]
```

modified files case 检查：

```text
report.diff.modifiedFiles.after === [
  {
    path: "src/pagination.cjs",
    reason: "Remove the extra item returned by page slicing."
  }
]
```

pending actions case 检查：

```text
report.diff.pendingActions.after === before.pendingActions
```

这个 case 钉住的边界是：

```text
压缩后能不能继续任务，关键不在摘要优美，而在 plan、文件变更和下一步动作有没有可恢复。
```

---

## 10. Execution Chain B3：坏摘要为什么必须归因为 compaction_loss

对应 case：

```text
quality score: bad summary is identified as compaction_loss
```

verify 构造：

```text
const { report } = createBadCompactionFixture()
```

然后检查：

```text
report.status === "failed"
report.failureType === "compaction_loss"
report.score < 1
report.failedChecks includes "objective_preservation"
report.failedChecks includes "failure_preservation"
report.recommendedAction === "repair_or_rerun_compaction_before_restore"
```

这个 case 钉住的边界是：

```text
坏 compaction 不能进入恢复路径。
它必须被明确归因，并要求 repair 或 rerun。
```

这和 `course-09` 的红线一致：

```text
failed verification 不能被 compact 改写成 passed。
```

---

## 11. Execution Chain C1：step lifecycle 如何成为 Runtime trace

对应 case：

```text
step lifecycle: steps move pending to active to done
```

verify 创建 approved machine：

```text
const machine = new PlanStateMachine()
machine.propose(createPlanStateMachineFixture())
machine.approve("plan_core20")
```

然后执行：

```text
machine.startStep("step_1")
machine.completeStep("step_1", { tool: "Search" })
```

状态变化：

```text
pending -> active -> done
```

trace tail：

```text
step.active
step.done
```

这个 case 钉住的边界是：

```text
plan 执行历史不靠模型自然语言记忆。
每个 step 状态变化都写进 Runtime trace。
```

---

## 12. Execution Chain C2：blocked 和 revision 为什么不能覆盖历史

对应 case：

```text
blocked reason: failed step records structured reason and evidence
revision: user change creates revised plan without overwriting history
```

blocked case 调用：

```text
machine.startStep("step_2")
machine.blockStep("step_2", "target_file_missing", {
  path: "src/pagination.cjs",
  tool: "Read"
})
```

它写入：

```text
step.status = "blocked"
step.blockedReason = "target_file_missing"
plan.status = "blocked"
trace event = "step.blocked"
```

revision case 先 block：

```text
machine.blockStep("step_3", "user_changed_requirement", ...)
```

再调用：

```text
machine.revisePlan({
  reason: "user_changed_requirement",
  userMessage: "Keep helper signature untouched.",
  steps: [...]
})
```

verify 检查：

```text
revision.previousPlanId === "plan_core20"
machine.plan.id === "plan_core20_rev1"
machine.plan.revisionOf === "plan_core20"
machine.revisions.length === 1
machine.revisions[0].previousPlan.steps[2].status === "blocked"
```

这个 case 钉住的边界是：

```text
用户改需求后，不是悄悄覆盖旧计划。
旧 plan 必须进入 revision history，新 plan 必须显式关联旧 plan。
```

---

## 13. Execution Chain C3：compaction resume 如何把 Core 19 和 Core 20 接起来

对应 case：

```text
resume: compaction preserves active step and restore marks it resumed
```

verify 先让 step_3 active：

```text
machine.startStep("step_3")
```

再把 machine snapshot 放进 compaction：

```text
compactSession({
  objective: machine.plan.objective,
  activePlan: machine.snapshot().activePlan,
  pendingActions: ["Complete active step"],
  ...
})
```

恢复：

```text
PlanStateMachine.restore({
  activePlan: compacted.compactSummary.activePlan,
  planTrace: machine.trace,
  planRevisionLog: machine.revisions
})
```

verify 检查：

```text
compacted.compactSummary.activePlan.currentStepId === "step_3"
restored.findStep("step_3").status === "resumed"
trace includes "step.resumed"
```

这个 case 钉住的边界是：

```text
Compaction 和 Plan 不是两套独立机制。
压缩必须保留 active step，restore 后状态机必须知道从哪里继续。
```

---

## 14. Execution Chain C4：permission 和 final grounding 如何防止假完成

对应 case：

```text
permission: unapproved write tool is denied by plan state
permission: approved execution is bounded to active step tool
final grounding: incomplete plan cannot claim completion
validation: malformed plan is rejected before execution
```

未批准写操作：

```text
machine.propose(plan)
machine.authorizeTool({ name: "Read" }) -> allowed
machine.authorizeTool({ name: "Edit" }) -> denied plan_not_approved
```

已批准但不匹配 active step：

```text
machine.startStep("step_1")
Search -> allowed
Edit -> denied tool_outside_active_step
```

final grounding：

```text
verificationState.status === "passed"
但 plan 只完成 step_1
finalAnswerDecision -> denied plan_incomplete
```

完成所有 steps 后：

```text
finalAnswerDecision -> allowed
```

malformed plan：

```text
validatePlanStateMachinePlan({ id: "bad_plan", objective: "Fix it", steps: [] })
```

返回：

```text
valid=false
errors includes missing_steps
errors includes missing_validation
```

这个 case 钉住的边界是：

```text
plan 不是 prompt 建议。
它决定写工具能不能执行，以及 final answer 是否有资格出现。
```

---

## 15. Knowledge Provenance

| 判断 / 信息 | 来源 | 怎么进入系统 | 目标 | 如果没有 |
| --- | --- | --- | --- | --- |
| candidate blocks | system/tools/rules/messages/coreState | buildEconomyCandidateBlocks | 统一上下文选择单位 | 无法解释哪个信息被选中或裁剪 |
| block hash | id + zone + content | hashBlock | 判断 stable prefix 是否可复用 | cache hit 只能靠文本感觉 |
| stable prefix | system / tools / project rules | ContextEconomyEngine stable blocks | 支撑 cache simulation | cache hit 无法解释 |
| dynamic tail | latest user / tool results | dynamicTail blocks | 保留每轮变化事实 | 最新约束或观察可能污染 stable prefix |
| hard state | coreState activePlan / verificationState / latestFailure | selected hard blocks | 预算压力下仍可恢复 | 模型可能重复失败或假完成 |
| eviction reason | block priority / token budget | evictionReport | 解释为什么裁剪 | 上下文缺失无法归因 |
| long output | ToolResult | artifact + preview block | 保留证据但不挤上下文 | 长日志淹没 hard state |
| selected messages | selected blocks 的 sourceMessageId / sourceToolCallId | selectEconomyMessages | 给模型必要原始事实 | runtime block 有解释但缺少原始观察 |
| cache report | current stablePrefix + previousSnapshot | simulateStablePrefixCache | 区分 cacheHit / uncachedTail | 无法解释哪些 token 可模拟缓存 |
| compaction before state | canonical task state | evaluateCompactionQuality input | 对照压缩保真 | 只能主观读摘要 |
| compact summary | compactSession output | report.diff / checks | 恢复长任务状态 | 坏摘要可能进入恢复 |
| active step | PlanStateMachine | currentStepId / planTrace | 控制当前执行 | 模型靠记忆猜下一步 |
| blocked reason | Runtime failure / user change | blockStep reason + evidence | 解释为什么暂停 | 失败历史被覆盖 |
| revision history | revisePlan | planRevisionLog | 保留旧计划和新计划关系 | 用户变更不可审计 |
| final grounding | plan steps + verificationState | finalAnswerDecision | 防止 plan 未完成却 final | passed 测试和完成计划可能脱钩 |
| startup context | Runtime environment / project entry | stable or dynamic context block | 让模型知道工作目录、平台、git 状态和项目入口 | 模型可能误判命令或上下文边界 |
| memory block | Memory source / project rules | candidate block，按优先级选择 | 提供长期偏好或项目规则 | 长期协作信息无法进入上下文 |
| system-reminder | Runtime / Policy / Hook feedback | dynamic tail reminder block | 临时提醒风险、阻断或审批状态 | 模型可能重复被拒绝动作 |

---

### 15.1 Product Surface 如何接回 Core 18-20

Claude Code 产品表层里的 startup context、system-reminder、memory、CLAUDE.md 这类材料，第一落点不是新 Core，而是 Core 18-20：

```text
Core 18 问：这些材料是否应该进入本轮上下文？进入 stable prefix 还是 dynamic tail？
Core 19 问：压缩后这些材料里的任务状态有没有丢？哪些不该进入 compact summary？
Core 20 问：这些材料是否改变 active step、blocked、revision 或 final grounding？
```

归位规则：

| 产品表层材料 | 接回哪一层 | 理由 |
| --- | --- | --- |
| startup environment | Core 18 | 它是上下文候选 block，影响命令和路径判断 |
| system-reminder | Core 18 / Core 20 | 它通常是动态状态提醒，可能影响当前 step 或权限 |
| CLAUDE.md / project rules | Core 18 / Core 25 | 它是高优先级规则上下文，也会进入 repo rule index |
| auto memory | Core 18 / Core 19 / Core 24 | 它是长期信息来源，不等于 compact summary |
| plan-related reminder | Core 20 | 它应落到 plan state，而不是只留在模型文字里 |

独立 Core 的门槛：

```text
如果只是说明这些材料怎么进入上下文，补 Course 15。
如果实现 memory type、forget、stale verification、no code-structure memory、segment provenance / precedence 或独立 verify，才考虑独立 Core。
```

当前已经落地的 Product Surface Core 27-31 统一在 `course-18-product-surface-implementation-chain.md` 中细读；本课只负责说明它们如何先接回 Core 18-20 的 Context / Compaction / Plan 主线。

---

## 16. Action Claim Contract

### 16.1 裁剪 low priority context 是合理动作吗

```text
Action:
  Context Economy 在小预算下裁剪 low priority memory。

当前状态:
  budget 很小，active_plan / verification_state / latest_failure 是 hard state。

合理性判断:
  合理。低优先级内容可以进入 evictionReport，hard state 必须保留。

来源:
  ContextEconomyEngine priority selection。
  src/core/context-economy.verify.mjs token budget case。

硬约束:
  hard state 不能因为预算小被裁掉。

如果做错会怎样:
  长任务恢复断片，模型可能不知道失败和验证状态。
```

### 16.2 把 latest_user 放进 stable prefix 合理吗

```text
Action:
  把 latest_user 标记为 stable_prefix，试图让更多 token cache hit。

当前状态:
  latest_user 会随着每轮用户消息变化。

合理性判断:
  不合理。latest_user 必须属于 dynamic_tail。

来源:
  buildEconomyCandidateBlocks 的 tail:latest_user block。
  dynamic tail verify case。

硬约束:
  stable prefix 只放 system / tools / project_rules 这类稳定输入。

如果做错会怎样:
  用户新约束污染 stable prefix，hash 每轮变化，cache simulation 失真。
```

### 16.3 只比较 block name 就能证明 cache hit 吗

```text
Action:
  只要两轮都有 system/tools/project_rules，就声称 cache hit。

当前状态:
  cache simulation 比较的是相同 index 下的 id 和 hash。

合理性判断:
  不充分。name 相同但 content 变化时 hash 会变，应该算 cache miss。

来源:
  simulateStablePrefixCache。

硬约束:
  previous.id === block.id 且 previous.hash === block.hash。

如果做错会怎样:
  project rules 或 tools 内容变化时仍被误报为 cache hit。
```

### 16.4 坏 compact summary 可以继续 restore 吗

```text
Action:
  用缺失 objective / failed verification 的 compact summary 恢复任务。

当前状态:
  evaluateCompactionQuality 返回 failed / compaction_loss。

合理性判断:
  不合理。必须 repair 或 rerun compaction。

来源:
  Core 19 quality score case。

硬约束:
  bad summary 不能被当作可信恢复材料。

如果做错会怎样:
  目标漂移、失败被抹掉、pending action 丢失。
```

### 16.5 plan 未完成但测试 passed 可以 final 吗

```text
Action:
  在 verificationState passed 但 plan steps 未全部 done 时 final answer。

当前状态:
  finalAnswerDecision 检查 plan completion 和 verificationState。

合理性判断:
  不合理。必须先完成 plan 或修订 plan。

来源:
  Core 20 final grounding case。

硬约束:
  incomplete plan -> plan_incomplete。

如果做错会怎样:
  模型可能完成了局部测试，却跳过用户要求的剩余步骤。
```

---

## 17. 学习者应该亲手改哪里

### 17.1 把 budget 调到极小

文件：

```text
src/core/context-economy.verify.mjs
```

临时把 latest failure case 的：

```text
budget: 80
```

再调低。

运行：

```bash
npm run core:18:verify
```

你应该观察：

```text
即使 overBudgetAfterHardState 出现，active_plan / verification_state / latest_failure 仍然被保留。
```

实验后改回。

### 17.2 把 latest_user 改成 stable prefix

文件：

```text
src/core/context-economy.mjs
```

临时把 `tail:latest_user` 的：

```text
zone: "dynamic_tail"
```

改成：

```text
zone: "stable_prefix"
```

运行：

```bash
npm run core:18:verify
```

你应该看到 dynamic tail 相关 case 失败。

这证明：

```text
最新用户消息不能进入 stable prefix，否则缓存边界会被污染。
```

实验后改回。

### 17.3 让 hashBlock 不包含 content

文件：

```text
src/core/context-economy.mjs
```

临时让 `hashBlock` 只 hash `id` 和 `zone`。

运行：

```bash
npm run core:18:verify
```

你会削弱 cache simulation 对内容变化的检测。正确实现必须让 hash 绑定 content。

实验后改回。

### 17.4 让 bad compaction 少丢一个字段

文件：

```text
src/core/compaction-quality.mjs
```

只读 `createBadCompactionFixture` 或相关 bad summary 构造，不一定要改。

你应该能指出：

```text
只要 objective 或 failure preservation 失败，report.failureType 就是 compaction_loss。
```

### 17.5 允许 active step 外的 Edit

文件：

```text
src/core/plan-state-machine.mjs
```

临时放宽 active step tool 检查。

运行：

```bash
npm run core:20:verify
```

你应该看到：

```text
permission: approved execution is bounded to active step tool
```

相关 case 失败。

实验后改回。

### 17.6 删除 final grounding 的 plan 完成检查

文件：

```text
src/core/plan-state-machine.mjs
```

临时让 verification passed 就允许 final。

运行：

```bash
npm run core:20:verify
```

你应该看到 incomplete plan final 相关 case 失败。

实验后改回。

---

## 18. 本课最终要能回答的问题

```text
1. Core 18 stable prefix 包含哪些 block，为什么 latest user 不在里面？
2. ContextEconomyEngine.build 的组装顺序是什么？
3. candidateBlocks、selectedBlocks、selectedMessages 分别是什么？
4. block 的 id、zone、priority、tokens、hash 分别解决什么问题？
5. 为什么 hash 必须包含 content？
6. simulateStablePrefixCache 如何判断 cache hit？
7. dynamic tail 解决什么问题？
8. evictionReport 为什么比“上下文被裁了”更有教学价值？
9. artifact boundary 如何证明长输出没有反复进入 selectedMessages？
10. economyProof.promptOnlySaving=false 防止了什么错误能力声明？
11. Core 19 的 before state 包含哪些字段？
12. compaction_loss 是怎样被构造和识别的？
13. active plan、modified files、pending actions 为什么是 compaction hard state？
14. PlanStateMachine 的 step lifecycle 如何写入 trace？
15. blocked 和 revision 如何保留旧计划历史？
16. compaction resume 如何把 Core 19 和 Core 20 接起来？
17. finalAnswerDecision 为什么同时看 plan completion 和 verificationState？
```

过关标准：

```text
你能从 Core 18-20 的任一 verify case 指到具体对象和字段，
说明这个字段来自哪里、被谁写入、被哪个断言证明，
以及它为什么不能被 prompt 文案或普通摘要替代。
```
