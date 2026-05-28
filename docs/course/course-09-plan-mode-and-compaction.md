# Course 09 Plan Mode And Compaction：从 verify case 跟踪长任务控制和状态保全

> 本课对应 Core 04 和 Core 05。
>
> 本课目标：你要能从 `npm run core:04:verify` 和 `npm run core:05:verify` 进入源码，跟踪 plan 如何变成权限状态、compaction 如何在模型调用前保留关键状态。

---

## 0. 本课跟踪哪两条执行链

Core 04 和 Core 05 都是在解决长任务失控问题，但它们控制的是不同层。

```text
Core 04 Plan Mode:
  模型能不能现在执行写操作？
  谁批准计划？
  批准后的 plan 如何进入状态和上下文？

Core 05 Compaction:
  上下文变长后，哪些状态必须保留？
  历史如何被压缩？
  新消息为什么不能被旧 summary 覆盖？
```

两条主线：

```text
主线 A：Plan Mode 权限链
  verify case
    -> model 输出 plan 或 tool_call
    -> CoreRuntime 处理 plan
    -> PlanController propose / approve / authorizeTool
    -> coreState.activePlan / mode 更新
    -> ToolRuntime 是否执行

主线 B：Compaction 状态保全链
  verify case
    -> CoreRuntime.#buildModelRequest
    -> compactor.shouldCompact
    -> CoreCompactor.compact
    -> compactSession
    -> applyCompactionToCoreState
    -> Context Engine 把 compact summary 放回本轮请求
```

一句话：

```text
Plan Mode 不是一段提示词，而是 Runtime 的权限状态。
Compaction 不是普通摘要，而是模型可见世界的状态保全机制。
```

---

## 1. 先运行什么

```bash
npm run core:04:verify
npm run core:05:verify
```

然后读：

```text
src/core/plan-mode.verify.mjs
src/core/plan-mode.mjs
src/lab06/plan-mode.mjs
src/core/compaction.verify.mjs
src/core/compaction.mjs
src/lab07/compaction.mjs
src/core/core-runtime.mjs
```

读法仍然是：

```text
verify case 名字
  -> 它构造了什么 runtime / model / state
  -> 调到哪个函数
  -> 哪个对象被更新
  -> 哪个断言钉住边界
```

---

## 2. Execution Chain A1：批准计划后如何启用完整修复

对应 case：

```text
src/core/plan-mode.verify.mjs
plan runtime: approved plan enables full fix and verification
```

入口：

```text
runPlanModeDemo()
  -> createCoreToyWorkspace()
  -> new CoreRuntime({
       model: new PlanFirstFixModel(),
       planController: new PlanController(),
       autoApprovePlan: true
     })
  -> runtime.run("先制定计划，再修复分页多返回一个元素的问题。")
```

第一轮 `PlanFirstFixModel.next(request)` 会读取 runtime message：

```text
const runtime = request.messages.find((message) => message.role === "runtime");
const activePlan = runtime?.content?.coreState?.activePlan;
```

如果还没有 active plan，它不发工具，而是返回：

```text
{
  type: "plan",
  plan: sampleCorePlan()
}
```

`CoreRuntime.run` 收到 `output.type === "plan"` 后进入：

```text
#handlePlanOutput(output.plan)
```

里面发生三件事：

```text
1. planController.proposePlan(plan)
2. coreState.planEvents.push(proposed)
3. autoApprovePlan 为 true 时，planController.approvePlan(plan.id)
```

批准成功后 Runtime 更新：

```text
coreState.activePlan = approval.activePlan
coreState.mode = "execute"
```

后续轮次再构造 ModelRequest 时，`coreState.activePlan` 会出现在 runtime message 和 Context Engine 的 `active_plan` block 里。

之后模型才开始输出：

```text
Search -> Read -> Edit -> Bash -> FinalAnswer
```

verify 最后检查：

```text
coreState.mode === "execute"
coreState.activePlan.status === "approved"
planEvents[0].status === "proposed"
planEvents[1].status === "approved"
verificationState.status === "passed"
```

这个 case 钉住的边界是：

```text
计划不是 assistant message 装饰。
计划批准会改变 Runtime state，并启用后续工具执行。
```

---

## 3. Execution Chain A2：未批准前 Edit 为什么被拒绝

对应 case：

```text
src/core/plan-mode.verify.mjs
plan policy: Edit is denied before plan approval
```

verify 构造：

```text
new CoreRuntime({
  model: new EditFirstModel(),
  planController: new PlanController(),
  maxTurns: 2
})
```

`PlanController` 初始状态是：

```text
mode = "plan"
plan = null
```

`EditFirstModel` 第一轮直接输出：

```text
Edit {
  path: "src/pagination.cjs",
  old_string: "start + pageSize + 1",
  new_string: "start + pageSize"
}
```

Runtime 在工具执行前一定会走：

```text
#authorizePlanTool(output.toolCall)
  -> planController.authorizeTool(toolCall)
```

`PlanController.authorizeTool` 的关键规则：

```text
if (mode === "plan" && WRITE_TOOLS.has(toolCall.name)) {
  return {
    allowed: false,
    reason: `${toolCall.name} is not allowed in plan mode.`
  };
}
```

其中：

```text
WRITE_TOOLS = Edit / Write / Bash
READ_ONLY_TOOLS = Search / Read / AskUser
```

因为 Edit 是写工具，Runtime 不调用 `CoreToolRuntime.execute`，而是生成：

```text
ToolResult {
  status: "denied",
  error.error_type: "plan_mode_denied",
  error.recommended_next_tool: "Plan"
}
```

这个 case 钉住的边界是：

```text
Plan Mode 的强制力来自 Runtime 授权，不来自模型自觉。
未批准前，模型即使输出合法 Edit schema，也不能执行写操作。
```

---

## 4. Execution Chain A3：空泛计划为什么不能进入执行态

对应 case：

```text
src/core/plan-mode.verify.mjs
plan validation: vague plan is recorded and does not execute
```

verify 里的 model 返回：

```text
{
  type: "plan",
  plan: {
    id: "bad_plan",
    objective: "Fix it"
  }
}
```

`PlanController.proposePlan(plan)` 调用：

```text
validatePlan(plan)
```

必须有这些字段：

```text
id
objective
knownFacts
steps
expectedFiles
risks
validation
```

缺字段会得到：

```text
{
  status: "invalid",
  errors: ["missing_steps", ...]
}
```

Runtime 仍然会记录这个 plan event：

```text
coreState.planEvents.push(invalid)
```

但不会设置：

```text
coreState.activePlan
coreState.mode = "execute"
```

verify 检查：

```text
invalid.status === "invalid"
invalid.errors includes "missing_steps"
runtime.coreState.mode === "plan"
```

这个 case 钉住的边界是：

```text
不是模型输出了 plan 就能执行。
Plan 必须通过结构校验，才能被批准为 activePlan。
```

---

## 5. Execution Chain A4：approved plan 如何进入 context snapshots

对应 case：

```text
src/core/plan-mode.verify.mjs
plan context: approved plan appears in context snapshots
```

执行仍然是 `runPlanModeDemo()`。

关键链路：

```text
CoreRuntime.#handlePlanOutput
  -> coreState.activePlan = approval.activePlan

下一轮 CoreRuntime.#buildModelRequest
  -> contextEngine.build({ coreState, messages, ... })
  -> toContextInput(...)
  -> activePlan: formatActivePlan(coreState.activePlan)
  -> buildContext(...)
  -> add(blocks, "active_plan", "hard", input.activePlan)
```

verify 检查：

```text
result.contextSnapshots.some((snapshot) =>
  snapshot.blocks.some((block) => block.name === "active_plan")
)
```

这个 case 钉住的边界是：

```text
Plan 批准后不只存在 PlanController 内部。
它也进入下一轮模型可见世界，指导后续执行。
```

---

## 6. Execution Chain A5：rejected plan 为什么不能再批准

对应 case：

```text
src/core/plan-mode.verify.mjs
plan controller: rejected plan cannot be approved in core path
```

verify 直接操作 controller：

```text
controller.proposePlan(sampleCorePlan())
controller.rejectPlan("core_plan_001", "Need narrower validation.")
const approval = controller.approvePlan("core_plan_001")
```

`rejectPlan` 做两件事：

```text
this.plan.status = "rejected"
this.rejectedPlanIds.add(planId)
```

`approvePlan` 先检查：

```text
if (this.rejectedPlanIds.has(planId) || this.plan.status === "rejected") {
  return {
    status: "error",
    error_type: "plan_rejected"
  };
}
```

这个 case 钉住的边界是：

```text
被拒绝的计划不能被同一路径悄悄复活。
执行态必须来自一个仍然有效且被批准的 plan。
```

---

## 7. Execution Chain B1：Compactor 如何保留 hard state 和长输出证据

对应 case：

```text
src/core/compaction.verify.mjs
compactor: preserves hard state and artifacts long output
```

入口：

```text
runCompactionDemo()
  -> new MessageStore()
  -> append user
  -> append 4 轮 Bash failed ToolResult
  -> coreState = {
       activePlan,
       modifiedFiles,
       verificationState: failed
     }
  -> new CoreCompactor({ messageThreshold: 6, keepRecent: 3 })
  -> compactor.compact({ messages, coreState })
  -> applyCompactionToCoreState(coreState, compacted)
```

`CoreCompactor.compact` 先切分消息：

```text
splitAt = messages.length - keepRecent
olderMessages = messages.slice(0, splitAt)
newerMessages = messages.slice(splitAt)
```

然后调用 Lab 07：

```text
compactSession({
  objective: latestUser(messages)?.content,
  latestUserConstraints: [latestUser(messages).content],
  activePlan: coreState.activePlan,
  modifiedFiles: coreState.modifiedFiles,
  latestFailures: latestFailures(messages),
  verificationState: coreState.verificationState,
  pendingActions: pendingActions(coreState),
  messages: olderMessages.map(toCompactMessage),
  newerMessages
})
```

`compactSession` 生成：

```text
compactSummary {
  objective,
  latestUserConstraints,
  activePlan,
  modifiedFiles,
  latestFailures,
  verificationState,
  pendingActions,
  artifactRefs,
  olderHistorySummary
}
artifacts
newerMessages
```

长输出处理在 `summarizeOlderHistory`：

```text
if (content.length > LONG_OUTPUT_LIMIT) {
  artifacts.push({ id, source, content })
  parts.push(`${message.type}:${message.name} stored in ${artifactId}`)
}
```

verify 检查：

```text
compactSummary.verificationState.status === "failed"
compactSummary.modifiedFiles includes "src/pagination.cjs"
compactSummary.activePlan.id === "plan_001"
compactionArtifacts.length >= 1
newerMessages.length > 0
```

这个 case 钉住的边界是：

```text
Compaction 可以压缩旧消息，但不能丢 activePlan、modifiedFiles、failed verification 和长输出证据。
```

---

## 8. Execution Chain B2：Compaction 什么时候触发

对应 case：

```text
src/core/compaction.verify.mjs
runtime: compaction triggers before model request
```

verify 构造：

```text
new CoreRuntime({
  compactor: new CoreCompactor({ messageThreshold: 1, keepRecent: 1 }),
  model: {
    next(request) {
      sawCompactSummary = request.messages.some(...)
      return final_answer
    }
  }
})
```

关键位置在：

```text
CoreRuntime.#buildModelRequest(turn)
```

顺序是：

```text
1. messages = store.buildModelMessageStream(sessionId)
2. if compactor.shouldCompact({ messages, coreState })
3. compacted = compactor.compact({ messages, coreState })
4. applyCompactionToCoreState(coreState, compacted)
5. messages = compacted.newerMessages
6. contextEngine.build({ coreState, messages })
7. model.next(request)
```

所以 compaction 发生在：

```text
模型调用前。
Context Engine 构造本轮 context 前。
```

`toContextInput` 会把 `coreState.compactSummary` 作为 project rules / compact summary block 放回 context：

```text
projectRules: coreState.compactSummary
  ? { enabled: true, text: formatCompactSummary(coreState.compactSummary) }
  : ...
```

这个 case 钉住的边界是：

```text
Compaction 是 Runtime 构造 ModelRequest 前的上下文准备步骤。
模型看到的是 compact 后的本轮材料，不负责自己压缩历史。
```

---

## 9. Execution Chain B3：failed verification 为什么不能被 compact 成 passed

对应 case：

```text
src/core/compaction.verify.mjs
runtime: failed verification cannot become passed after compact
```

verify 先手动设置：

```text
runtime.coreState.verificationState = {
  status: "failed",
  command: "node scripts/test.cjs",
  exitCode: 1
}
```

然后触发 compaction。

`CoreCompactor.compact` 把这个状态原样传入：

```text
verificationState: coreState.verificationState
```

Lab 07 的 `normalizeVerification` 只保留 failed：

```text
if (verificationState?.status === "failed") {
  return {
    ...verificationState,
    status: "failed"
  };
}
```

verify 检查：

```text
compactSummary.verificationState.status === "failed"
compactSummary.verificationState.status !== "passed"
```

这个 case 钉住的边界是：

```text
摘要不能改变验证事实。
失败验证不能被总结成通过。
```

这是 compaction 的红线。

---

## 10. Execution Chain B4：newer messages 为什么必须保留

对应 case：

```text
src/core/compaction.verify.mjs
runtime: newer messages remain available after compact
context: compact summary does not replace latest user message
```

第一条 case 在 model.next 里检查：

```text
request.context.selectedMessages.map((message) => message.type)
```

应该是：

```text
["user"]
```

也就是说，compact 后仍然保留最新 user message。

第二条 case 检查：

```text
request.messages.some(
  message.type === "user" &&
  message.content === "最新用户约束不能被 compact summary 覆盖。"
)
```

为什么？

`CoreCompactor.compact` 明确切出：

```text
newerMessages = messages.slice(splitAt)
```

然后 Runtime 继续用：

```text
messages = compacted.newerMessages
contextEngine.build({ messages, coreState })
```

所以：

```text
compactSummary 负责旧历史摘要。
newerMessages 负责保留最新事实和用户约束。
```

这个 case 钉住的边界是：

```text
旧 summary 不能覆盖最新用户消息。
长任务恢复时，最新约束优先于历史摘要。
```

---

## 11. Knowledge Provenance

| 模型用到的信息 | 来源 | 怎么给模型 | 目标 | 如果不给会怎样 |
| --- | --- | --- | --- | --- |
| 当前处于 plan mode | `PlanController.mode` / CoreState | runtime message / mode block | 判断能否执行写工具 | 模型可能直接 Edit |
| plan 是否有效 | `validatePlan` | plan event + assistant message | 阻止空泛计划进入执行 | 空计划也可能开启写权限 |
| plan 是否 approved | `PlanController.approvePlan` | `coreState.activePlan` | 切换到 execute | 写操作无法获得授权 |
| 写工具是否允许 | `authorizeTool` | Runtime 执行前检查 | 强制 plan 权限 | prompt 无法阻止越权 |
| active plan | CoreState | `active_plan` hard block | 指导批准后的执行 | 模型可能忘记计划约束 |
| compact summary | CoreCompactor | Context Engine compact summary block | 压缩旧历史但保留任务状态 | 长任务上下文爆掉 |
| newer messages | MessageStore split | `selectedMessages` | 保留最新用户约束 | 旧 summary 覆盖新要求 |
| failed verification | CoreState | compactSummary + verification_state | 防止假完成 | 摘要可能把失败写成通过 |
| latest failures | ToolResult | compactSummary.latestFailures | 指导恢复 | 模型不知道下一步修什么 |
| long outputs | older tool results | compaction artifacts | 保留证据但不挤占 context | 证据丢失或上下文被日志淹没 |
| project memory / CLAUDE.md | Project Rules / Memory source | Context Engine 作为规则或 memory block 放入 | 提供长期项目约定和用户偏好 | 模型可能重复问已知偏好或忽略项目规则 |
| auto memory | Memory Store | 经类型过滤后进入 context，不进入 compact summary 原文 | 跨会话保留用户、反馈、项目或外部引用信息 | 长期协作偏好丢失 |
| memory index | Memory Store | memory index / reference block | 找到应该读取的长期记忆 | 模型把临时任务状态误当长期事实 |

---

### 11.1 Product Surface 补充：Memory 和 Compaction 不是一回事

Claude Code 产品表层材料里能看到 memory / CLAUDE.md / auto memory 这类机制。它们很容易被误解成“更大的 compact summary”，但在本课程里必须分开：

| 机制 | 中文理解 | 生命周期 | 主要风险 |
| --- | --- | --- | --- |
| `CLAUDE.md` / project rules | 项目规则入口 | 随仓库存在，可被版本管理 | 规则过期或和当前任务冲突 |
| Memory | 长期记忆 | 跨会话存在，可写入、索引、删除 | 过时、误存代码结构、泄漏私人信息 |
| Compaction | 压缩摘要 | 当前任务内缓解上下文压力 | 丢 active plan、失败、约束、下一步 |
| Plan State | 计划状态 | 当前任务执行状态 | 被摘要覆盖、状态漂移 |

所以本课补充一个边界：

```text
Compaction 负责当前任务状态保真。
Memory 负责跨会话长期信息。
CLAUDE.md / project rules 负责仓库级规则。
Plan 负责当前任务执行位置。
```

它们都可能进入 Context Engine，但不能互相替代。

具体规则：

```text
1. 进行中的短期任务状态，不写入长期 memory。
2. 代码结构、文件路径和函数存在性，优先从 repo 重新读取，不靠 memory 当事实。
3. memory 提到的文件或函数，在建议用户行动前必须重新验证。
4. 用户要求 forget 时，memory 必须可删除；compact summary 不承担这个职责。
5. compaction 不能把 failed verification 写成 passed，也不能让旧 memory 覆盖最新用户约束。
```

这就是为什么 Memory Source 先补 Course 09 / Core 18 / Core 19 / Core 24：

```text
如果只是讲长期信息如何进入上下文，它属于 Context / Compaction 主题。
只有当我们实现 memory type、write/index、forget、stale verification 和 no code-structure memory 的 verify case 时，它才值得独立成 Core。
```

Core 29 已按这个门槛落地：

```text
Memory Source / CLAUDE.md / Auto Memory
  -> memory type routing
  -> write and index
  -> forget
  -> stale verification
  -> compaction boundary
  -> no code-structure memory
```

所以学习时要保持三条线分开：

```text
Course 09 / Core 19 看 compactSummary 是否保真。
Core 29 看长期 memory 是否可治理、可删除、可重新验证。
Core 25 / Read/Search 看代码结构事实是否来自当前 repo evidence。
```

Core 29 的 memory 细节会在 `course-18-product-surface-implementation-chain.md` 中和 Core 27、28、30、31 一起复盘。本课只负责守住 Plan / Compaction 与长期 memory 的边界。

---

## 12. 学习者应该亲手改哪里

### 12.1 把 Edit 从 WRITE_TOOLS 移走

文件：

```text
src/lab06/plan-mode.mjs
```

临时把：

```text
const WRITE_TOOLS = new Set(["Edit", "Write", "Bash"]);
```

改成不含 `Edit`。

运行：

```bash
npm run core:04:verify
```

你应该看到：

```text
plan policy: Edit is denied before plan approval
```

相关 case 失败。

这证明：

```text
Plan Mode 权限不是 prompt，是真正的 authorizeTool 规则。
```

实验后改回。

### 12.2 删除 validatePlan 的 required field

文件：

```text
src/lab06/plan-mode.mjs
```

临时从 `validatePlan` required list 里删除 `steps`。

运行：

```bash
npm run core:04:verify
```

你应该看到 vague plan case 不再按预期记录 `missing_steps`。

这证明：

```text
计划质量边界由 PlanController 结构校验执行。
```

实验后改回。

### 12.3 把 keepRecent 改成 0

文件：

```text
src/core/compaction.verify.mjs
```

临时把某个 case 的：

```text
new CoreCompactor({ messageThreshold: 1, keepRecent: 1 })
```

改成：

```text
keepRecent: 0
```

运行：

```bash
npm run core:05:verify
```

你应该观察到 newer message / latest user 相关断言失败。

这证明：

```text
newerMessages 不是摘要的附属品，而是恢复最新约束的关键通道。
```

实验后改回。

### 12.4 手动把 failed 改成 passed

文件：

```text
src/lab07/compaction.mjs
```

临时让 `normalizeVerification` 对 failed 返回 passed。

运行：

```bash
npm run core:05:verify
```

你应该看到 failed verification case 失败。

这证明：

```text
Compaction 不能改写验证事实。
```

实验后改回。

---

## 13. 本课最终要能回答的问题

```text
1. Plan Mode 的状态存在谁那里？
2. 模型输出 plan 后，Runtime 具体调用哪个函数处理？
3. 一个 plan 至少要有哪些字段？
4. Edit 在未批准前是在哪里被拦住的？
5. approved plan 如何进入 active_plan block？
6. rejected plan 为什么不能再 approve？
7. Compaction 发生在模型调用前还是之后？
8. CoreCompactor 如何切分 olderMessages 和 newerMessages？
9. compactSummary 保存哪些 hard state？
10. failed verification 为什么不能被 summary 改成 passed？
11. newerMessages 和 compactSummary 的职责差别是什么？
12. 长输出在 compaction 中如何变成 artifact？
```

过关标准：

```text
你能从 verify case 指到具体函数，
说明哪个对象被写入，
哪个边界被强制执行，
以及哪个断言证明它没有退化成 prompt 建议或普通摘要。
```
