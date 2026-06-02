# Course 16 Long Running Tool Gateway Production：从 verify case 跟踪长任务评测、事务工具和预算网关

> 本课对应 Core 21、Core 22、Core 23。
>
> `course-15` 已经跟踪了 Context Economy、Compaction Quality 和 Plan State Machine。
>
> 本课继续用同一标准跟踪：长任务压力场如何证明状态和成本曲线，ToolRuntime 如何把修改变成事务，ModelGateway 如何在 provider 调用前执行预算和能力决策。
>
> 术语先用中文理解；英文用于对照代码字段和 verify case：
>
> ```text
> docs/production-upgrade-terms-zh.md
> ```

---

## 0. 本课跟踪哪三条执行链

Core 21、Core 22、Core 23 共同解决的是生产化执行中的三类风险。

```text
Core 21 Long-Running Task Eval:
  多轮任务中失败、压缩、恢复和成本是否能被评估？

Core 22 ToolRuntime Transaction:
  真正写文件前能否 preview？
  多文件修改能否 commit / rollback？
  stale、protected、high-risk 是否会被拦截？

Core 23 ModelGateway Budget Controller:
  provider 调用前是否检查 token / cost？
  retry / fallback 是否有 trace？
  provider 不支持的能力是否不会暴露？
```

三条主线：

```text
主线 A：Long-Running Eval
  verify case
    -> buildLongRunningTaskEvalReport
    -> evaluateLongRunningTaskEvalReport
    -> turns / failureHistory / compactionEvents / costCurve / learningHandoff

主线 B：Tool Transaction
  verify case
    -> createTransactionWorkspace
    -> TransactionalToolRuntime.read
    -> previewTransaction
    -> commitTransaction / rollback
    -> authorizeBash / classifyBashRisk

主线 C：Budgeted Gateway
  verify case
    -> BudgetedModelGateway.next
    -> BudgetController.assess
    -> ProviderCapabilityRegistry
    -> retry / fallback / collectBudgetedModelOutput
```

一句话：

```text
Eval 证明长任务不是假完成，ToolRuntime 证明写入不是裸写，ModelGateway 证明 provider 调用不是无预算黑盒。
```

---

## 1. 先运行什么

```bash
npm run core:21:verify
npm run core:22:verify
npm run core:23:verify
```

然后读：

```text
src/core/long-running-task-eval.verify.mjs
src/core/long-running-task-eval.mjs
src/core/tool-runtime-transaction.verify.mjs
src/core/tool-runtime-transaction.mjs
src/core/model-gateway-budget-controller.verify.mjs
src/core/model-gateway-budget-controller.mjs
src/core/model-gateway.mjs
```

读法：

```text
先看报告对象的字段。
再看每个 verify case 如何构造失败或边界。
最后看它阻止了哪类生产化误判。
```

---

## 2. Execution Chain A1：7 轮长任务为什么不是“多跑几轮”

对应 case：

```text
src/core/long-running-task-eval.verify.mjs
multi-turn repair: state continues until final verification passes
```

verify 调用：

```text
const report = buildLongRunningTaskEvalReport()
const evaluation = evaluateLongRunningTaskEvalReport(report)
```

然后检查：

```text
report.turns.length === 7
report.finalVerification.status === "passed"
report.finalDecision.allowed === true
evaluation.status === "passed"
```

报告里的 7 轮覆盖：

```text
Search
Read
Edit
failed Bash
revision + compaction + failed Bash
Edit
passed Bash
```

这个 case 钉住的边界是：

```text
长任务通过不是模型最后说“完成”。
它必须有连续 turns、最终 passed verification 和 finalDecision.allowed。
```

---

## 3. Execution Chain A2：重复失败为什么必须进入 failureHistory

对应 case：

```text
repeated failure: two failures remain in history and steer next action
```

verify 检查：

```text
report.failureHistory.length === 2
exitCode 列表 === [1, 1]
每个 failure.influencedNextAction === true
failure[0].nextAction includes "Revise plan"
failure[1].nextAction includes "restored plan step"
```

failureHistory 每条记录至少解释：

```text
turn
command
exitCode
stderr
reason
nextAction
influencedNextAction
```

这个 case 钉住的边界是：

```text
失败不是日志噪声。
连续失败必须成为下一步 plan revision 或 resumed step 的输入。
```

如果没有 failureHistory：

```text
模型可能重复同一个失败 Bash。
compaction 后可能忘记为什么要改 plan。
eval 无法判断下一步是否真的受失败影响。
```

---

## 4. Execution Chain A3：compaction under pressure 如何连接 Core 19 / 20 / 21

对应 case：

```text
compaction under pressure: active step survives and resumes
```

Core 21 在第 5 轮制造 compaction pressure。verify 检查：

```text
event.quality.status === "passed"
event.activeStepBefore === "step_2"
event.restoredStepStatus === "resumed"
event.continuedAfterCompaction === true
turn.compaction.qualityStatus === "passed"
```

这条链路背后依赖：

```text
Core 19 evaluateCompactionQuality:
  压缩前后状态保真。

Core 20 PlanStateMachine.restore:
  active step 恢复为 resumed。

Core 21 Long-Running report:
  记录 compactionEvents 并继续完成任务。
```

这个 case 钉住的边界是：

```text
长任务中的 compaction 不是孤立摘要。
它必须有 quality report、恢复 step 和 continuedAfterCompaction evidence。
```

---

## 5. Execution Chain A4：cost curve 和 no false final 证明什么

对应 case：

```text
cost curve: every turn has token and configured cost basis
no false final: premature final is attributed to verification_missing
learning handoff: summary explains continue, compact, resume, and cost
```

cost curve case 检查：

```text
report.costCurve.perTurn.length === report.turns.length
report.costCurve.totalTokens > 0
report.costCurve.cacheHitTokens > 0
report.costCurve.estimatedCostUsd > 0
report.costCurve.realProviderBillingClaim === false
```

no false final case 构造：

```text
createFalseFinalFixture()
```

evaluation 返回：

```text
status = "failed"
failureType = "verification_missing"
```

learning handoff 检查文本包含：

```text
failed verification
Compacted
restored active step
estimated tokens
```

这个 case 钉住的边界是：

```text
长任务 eval 不只看是否最终 passed。
它还要能解释每轮成本、为什么继续、何时压缩、如何恢复、假 final 为什么失败。
```

仍然不能声称：

```text
真实 provider billing。
生产级长任务 benchmark。
```

---

## 6. Execution Chain B1：preview 为什么不能写文件

对应 case：

```text
src/core/tool-runtime-transaction.verify.mjs
diff preview: preview creates diff artifacts and does not write
```

verify 顺序：

```text
const workspaceRoot = await createTransactionWorkspace()
const runtime = new TransactionalToolRuntime({ workspaceRoot })
await runtime.read("src/pagination.cjs")
const before = readFile(...)
const preview = await runtime.previewTransaction([...])
const afterPreview = readFile(...)
```

断言：

```text
preview.status === "previewed"
preview.writesApplied === false
afterPreview === before
preview.diffArtifacts[0].preview includes "-   return start"
preview.diffArtifacts[0].preview includes "+   return start"
```

这个 case 钉住的边界是：

```text
diff preview 不是偷偷写入。
用户或后续审批看到的是预览证据，文件内容仍未变。
```

---

## 7. Execution Chain B2：multi-file commit 和 rollback 如何保证事务语义

对应 case：

```text
transaction commit: multi-file transaction writes only after commit
rollback: simulated failure restores pre-transaction hashes
```

commit case 先 read 两个文件：

```text
src/pagination.cjs
src/empty-page.cjs
```

preview 两个 edit 后：

```text
const commit = await runtime.commitTransaction(preview.transactionId)
```

断言：

```text
commit.status === "committed"
commit.written === ["src/pagination.cjs", "src/empty-page.cjs"]
文件内容真的变化
```

rollback case 构造：

```text
commitTransaction(preview.transactionId, { failAfterWrites: 1 })
```

断言：

```text
result.status === "rolled_back"
afterPagination === beforePagination
afterEmpty === beforeEmpty
result.rollback.restoredCount === 1
```

这个 case 钉住的边界是：

```text
多文件写入不是多个无关联 Edit。
它们共享 transactionId，失败后必须恢复事务前内容。
```

---

## 8. Execution Chain B3：stale、protected、high-risk 分别在哪里被拦住

对应 case：

```text
stale reread: external change after read blocks preview
protected file: protected API edit requires approval
bash risk class: high-risk command is denied or sent to approval
```

stale case：

```text
await runtime.read("src/pagination.cjs")
writeFile("src/pagination.cjs", "function touched() { return true; }\n")
previewTransaction([...])
```

返回：

```text
status = "denied"
error.error_type = "stale_file"
recommended_next_tool = "Read"
```

protected case：

```text
await runtime.read("src/public-api.cjs")
previewTransaction([{ path: "src/public-api.cjs", ... }])
```

返回：

```text
protected_file_requires_approval
recommended_next_tool = "AskUser"
```

high-risk Bash case：

```text
runtime.authorizeBash("npm test") -> allowed
runtime.authorizeBash("rm -rf .") -> denied
classifyBashRisk("rm -rf .") -> high
recommended_next_tool = "AskUser"
```

这个 case 钉住的边界是：

```text
ToolRuntime Transaction 不只负责写入。
它还把 stale 协作风险、protected API 风险和 high-risk Bash 风险结构化路由。
```

这为 Core 26 的 approval protocol 铺路。

---

## 9. Execution Chain C1：token budget gate 为什么必须发生在 provider call 前

对应 case：

```text
src/core/model-gateway-budget-controller.verify.mjs
token budget gate: oversized request is blocked before provider call
```

verify 构造 adapter：

```text
const adapter = new MockResponsesAdapter({
  steps: [toolCallEvents("should_not_run", "Search", { query: "unreachable" })]
})
```

然后设置预算：

```text
new BudgetController({
  maxInputTokens: 80,
  maxTotalTokens: 200,
  maxEstimatedCostUsd: 1
})
```

request 里放入超长 user content：

```text
"x".repeat(1600)
```

调用：

```text
await gateway.next(request)
```

必须抛出：

```text
ModelGatewayBudgetError
code = "budget_exceeded"
reason = "token_budget_exceeded"
```

并且：

```text
adapter.index === 0
```

这个 case 钉住的边界是：

```text
预算 gate 必须在 provider 调用前发生。
否则超预算请求已经花出去了，再记录 budget exceeded 就太晚了。
```

---

## 10. Execution Chain C2：cost gate、retry 和 fallback 如何留下 provider decision

对应 case：

```text
cost budget gate: expensive primary is skipped for cheaper fallback
retryable failure: mock rate limit and timeout are retried
fallback: primary failover uses fallback provider
```

cost gate case 构造：

```text
expensive provider pricingTable 非常贵
cheap fallback pricingTable 很便宜
maxEstimatedCostUsd = 0.001
```

断言：

```text
expensiveAdapter.index === 0
cheapAdapter.index === 1
output.metadata.provider.providerId === "cheap"
gatewayTrace includes budget.rejected / cost_budget_exceeded
```

retry case 构造：

```text
rate_limit
timeout
tool_call success
retryPolicy.maxRetries = 2
```

断言：

```text
provider.attempts === 3
adapter.index === 3
retry.scheduled events length === 2
```

fallback case 构造 primary unavailable：

```text
primary -> provider_unavailable
fallback -> Read tool_call
```

断言：

```text
primaryAdapter.index === 1
fallbackAdapter.index === 1
providerId === "fallback"
gatewayTrace includes provider.failed for primary
```

这个 case 钉住的边界是：

```text
Gateway 不能只“最终用了某个模型”。
它必须解释 primary 为什么没用、为什么 retry、为什么 fallback。
```

仍然不能声称：

```text
真实厂商账单。
真实 provider SLA。
```

---

## 11. Execution Chain C3：non-retryable failure 和 capability registry 防住什么

对应 case：

```text
non-retryable failure: invalid tool schema is not retried
capability registry: unsupported tools and streaming are not exposed
```

non-retryable case：

```text
adapter step 1 -> DeleteEverything tool_call
adapter step 2 -> Search should_not_retry
retryPolicy.maxRetries = 2
```

Gateway 抛出：

```text
unknown_tool
```

并且：

```text
adapter.index === 1
```

这说明 invalid tool schema 不会盲目 retry。

capability registry case 构造 provider：

```text
toolCalls: true
streaming: false
reasoning: false
supportedTools: ["Read"]
```

adapter 看到的 request：

```text
tools = ["Read"]
metadata.capabilities.streaming = false
reasoning = null
```

output metadata：

```text
capabilityDecision.exposedTools = ["Read"]
streamingExposed = false
```

这个 case 钉住的边界是：

```text
provider 不支持的能力不能靠 prompt 提醒模型别用。
Gateway 构造请求时就不能暴露这些能力。
```

---

## 12. Execution Chain C4：output repair 为什么不能绕过 schema

对应 case：

```text
output repair boundary: repairable JSON becomes schema-valid tool call
```

verify 构造带 trailing comma 的 JSON 文本：

```text
{
  "tool_call": {
    "id": "repair_search",
    "name": "Search",
    "input": { "query": "pageSize + 1", },
  },
}
```

Gateway 可以做窄范围修复：

```text
remove_trailing_commas
```

但修复后仍必须通过：

```text
validateToolCall
```

断言：

```text
output.type === "tool_call"
output.toolCall.name === "Search"
output.toolCall.input === { query: "pageSize + 1" }
metadata.repair.applied === true
metadata.repair.strategy === "remove_trailing_commas"
```

这个 case 钉住的边界是：

```text
repair 是模型输出兼容层，不是放宽工具契约。
unknown tool 或缺 required input 仍然不能进 ToolRuntime。
```

---

## 13. Knowledge Provenance

| 判断 / 信息 | 来源 | 怎么进入系统 | 目标 | 如果没有 |
| --- | --- | --- | --- | --- |
| turn sequence | long-running fixture | report.turns | 证明状态连续 | 只能看最终回答 |
| failure history | failed Bash / verificationState | failureHistory | 影响下一步修复 | 重复失败不可解释 |
| compaction event | Core 19 quality + Core 20 restore | compactionEvents | 证明压缩后继续 | 压缩恢复只是口头声明 |
| cost basis | deterministic local table | costCurve | 解释每轮 token / cost | 长任务成本不可评估 |
| false final | premature final fixture | evaluateLongRunningTaskEvalReport | 防止未验证完成 | final answer 文本可能骗人 |
| read snapshot | TransactionalToolRuntime.read | snapshot hash/text | 防 stale 写入 | 可能覆盖用户修改 |
| diff preview | previewTransaction | diffArtifacts | 写入前解释变更 | 用户看不到副作用 |
| rollback evidence | transaction before state | rollback.restored | 中途失败恢复 | 多文件半写入 |
| risk class | classifyBashRisk / protected path | authorization result | 路由审批 | 高风险命令可能执行 |
| token estimate | ModelRequest | BudgetController.assess | 调用前预算 gate | 超预算后才发现 |
| local pricing table | explicit config | budget decision | cost gate / fallback | 成本决策不可解释 |
| provider failure type | adapter event | gatewayTrace | retry / no retry / fallback | 所有失败被混为一谈 |
| capability registry | provider metadata | filtered ModelRequest | 不暴露 unsupported capability | prompt 无法强制 provider 能力 |
| repaired output | model text | repair metadata + schema validation | 兼容窄 JSON 错误 | repair 可能绕过工具契约 |
| permission settings | user/project/policy config | ToolRuntime authorization input | 决定 allow / ask / deny | 高风险动作只能靠模型自觉 |
| hook feedback | pre/post/user hook result | session event + dynamic observation | 让外部阻断或反馈进入长任务链路 | hook 结果丢失或被当作 system |
| memory source | CLAUDE.md / user / feedback / reference memory | typed memory block + freshness trace | 让长期偏好或项目规则进入上下文 | 过时 memory 被当成当前事实 |
| checkpoint marker | transaction boundary + file hashes | checkpoint event | 给长任务提供用户可见恢复点 | 只能靠聊天说明“可以回退” |
| deferred tool capability | Provider / Tool Surface Registry | filtered tools / available deferred tools | 只暴露当前可用工具表面 | 模型可能请求未启用工具 |

---

### 13.1 Product Surface 如何接回 Core 21-23

Settings、permission rules、hooks、subagent、deferred tools 这些产品表层特性，首先要接回本课的三条执行链。

```text
Core 21 问：这些反馈是否进入长任务 failure history、next action 和 cost curve？
Core 22 问：这些配置是否改变 preview / commit / rollback / high-risk routing？
Core 23 问：这些能力是否改变 provider call 前的工具表面、预算和 capability filtering？
```

归位规则：

| 产品表层材料 | 接回哪一层 | 理由 |
| --- | --- | --- |
| permission settings | Core 22 / Core 26 | 它决定工具动作 allow / ask / deny |
| pre tool hook | Core 22 / Core 24 | 它可能阻断工具执行，并写入 session event |
| post tool hook | Core 21 / Core 24 | 它是新的 observation，可能影响下一步 |
| user prompt hook | Core 21 / Core 26 | 它可能增加用户约束或改变计划 |
| memory source | Course 08 / Course 09 / Core 18 / Core 19 / Core 24 | 它是长期上下文来源，不是 compact summary 或 repo index |
| checkpoint marker | Core 22 / Core 24 | 它要绑定 transaction evidence、file hash 和 session event |
| subagent delegation | Core 21 / Core 24 / Core 25 | 它需要独立任务、隔离上下文、结构化结果和去重 ledger |
| deferred tools | Core 23 | 它属于工具表面和 provider capability filtering |
| retry / fallback policy | Core 23 | 它必须在 provider call 前决策 |

独立 Core 的门槛：

```text
如果只是说明高风险动作要问用户，补 Core 22 / 26。
如果实现配置优先级、hook lifecycle、memory type / stale verification、checkpoint file hash / rewind audit、subagent context isolation / result contract、阻断语义、脱敏和 replay，再考虑独立 Core。
```

Core 27 已把其中的 `permission settings` 立成独立实现层：

```text
settings / permission rules
  -> PermissionResolver
  -> allow / ask / deny
  -> Core 22 transaction or Core 26 approval protocol
```

读 Core 27 时要注意：

```text
它只证明配置优先级、ruleSource、resolverTrace 和 decisionCache。
它不负责 Core 22 的 preview / commit / rollback。
它不负责 Core 26 的 approve / reject / interrupt / handoff。
```

Core 28 已把 `hooks` 中的 pre / post tool lifecycle 立成独立实现层：

```text
preToolUse hook 可以阻断工具执行。
postToolUse hook 可以把反馈作为 dynamic observation 交给后续上下文。
hook failure 必须结构化，不能绕过 Core 27 permission decision。
```

它不负责：

```text
Core 24 的 durable store 新实现。
Core 26 的 human approval decision。
真实 shell hook 产品或任意用户脚本 sandbox。
```

Core 29 已把 `memory source` 立成独立实现层：

```text
CLAUDE.md / user / feedback / reference
  -> MemorySourceRuntime
  -> memory body + memory index
  -> freshness check
  -> long_term_memory context block
```

读 Core 29 时要注意：

```text
它只证明长期 memory 的类型、索引、删除、过时校验和 no code-structure policy。
它不负责 Core 18 的 token economy。
它不负责 Core 19 的 compaction quality。
它不负责 Core 24 的 durable session store 新实现。
```

Core 30 已把 `checkpoint / rewind` 立成独立实现层：

```text
transaction evidence
  -> checkpoint fileStateSnapshot + session event
  -> rewind request
  -> external change conflict check
  -> file restore + audit replay
```

读 Core 30 时要注意：

```text
它只证明用户可见 checkpoint、rewind request、外部改动拒绝和 audit replay。
它不负责 Core 22 的 transaction commit / rollback。
它不负责 Core 24 的 append-only store 或 crash recovery 新实现。
```

Core 31 已把 `subagent context isolation` 立成独立实现层：

```text
delegated task
  -> isolated subagent context
  -> structured subagent result
  -> parent receipt
  -> delegation ledger
```

读 Core 31 时要注意：

```text
它只证明 delegatedTask、subagentContext、subagentResult、delegationLedger 和 isolationAudit。
它不负责 Core 21 的 long-running eval、cost curve 或 no false final。
它不负责 Core 25 的 repo index / relevance scoring 新实现。
它不负责真实多进程 agent 调度、远端 worker 隔离或 agent marketplace。
```

Core 27-31 的逐 case 教学统一收口到 `course-18-product-surface-implementation-chain.md`。本课的职责是先把这些产品表层材料接回 Core 21-23 的 long-running、ToolRuntime 和 ModelGateway 责任链。

---

## 14. Action Claim Contract

### 14.1 提前 final 为什么不合理

```text
Action:
  模型在长任务第 2 轮直接 final。

当前状态:
  没有 passed verification。

合理性判断:
  不合理，eval 必须归因为 verification_missing。

来源:
  createFalseFinalFixture
  evaluateLongRunningTaskEvalReport

硬约束:
  final 不能替代 verification evidence。

如果做错会怎样:
  长任务可以被漂亮回答伪装成完成。
```

### 14.2 preview 后立即认为文件已修改合理吗

```text
Action:
  previewTransaction 返回 diff 后，认为文件已经被写入。

当前状态:
  preview.writesApplied=false。

合理性判断:
  不合理。只有 commitTransaction 后才写入。

来源:
  Core 22 diff preview case。

硬约束:
  preview 不能产生文件副作用。

如果做错会怎样:
  审批前写入，破坏 human approval 和 rollback 语义。
```

### 14.3 provider 不支持 streaming 时可以靠 prompt 禁用吗

```text
Action:
  给模型提示“不要 streaming”，但 request 仍暴露 streaming 能力。

当前状态:
  ProviderCapabilityRegistry 声明 streaming=false。

合理性判断:
  不合理。Gateway 必须在 request 构造时过滤。

来源:
  Core 23 capability registry case。

硬约束:
  unsupported capability 不应暴露给 provider/model。

如果做错会怎样:
  Runtime 被 provider 能力差异污染，错误归因变困难。
```

---

## 15. 学习者应该亲手改哪里

### 15.1 让 false final 通过

文件：

```text
src/core/long-running-task-eval.mjs
```

临时放宽 `evaluateLongRunningTaskEvalReport` 对 verification 的要求。

运行：

```bash
npm run core:21:verify
```

你应该看到 no false final case 失败或失去预期 failureType。

实验后改回。

### 15.2 让 preview 写文件

文件：

```text
src/core/tool-runtime-transaction.mjs
```

临时在 `previewTransaction` 里写入文件。

运行：

```bash
npm run core:22:verify
```

你应该看到：

```text
diff preview: preview creates diff artifacts and does not write
```

相关 case 失败。

实验后改回。

### 15.3 把 stale check 去掉

文件：

```text
src/core/tool-runtime-transaction.mjs
```

临时跳过 before hash 检查。

运行：

```bash
npm run core:22:verify
```

你应该看到 stale reread case 失败。

实验后改回。

### 15.4 允许 unknown tool retry

文件：

```text
src/core/model-gateway-budget-controller.mjs
```

临时把 `unknown_tool` 当成 retryable。

运行：

```bash
npm run core:23:verify
```

你应该看到 non-retryable failure case 失败，因为 adapter.index 会超过 1。

实验后改回。

---

## 16. 本课最终要能回答的问题

```text
1. Core 21 的 7 轮长任务分别覆盖什么状态？
2. failureHistory 为什么要记录 influencedNextAction？
3. compactionEvents 如何证明 active step 被恢复？
4. costCurve 为什么不能解释为真实 provider billing？
5. verification_missing 如何防止 premature final？
6. previewTransaction 为什么不能写文件？
7. multi-file transaction commit 和多个 Edit 有什么区别？
8. rollback case 如何证明事务前内容被恢复？
9. stale_file、protected_file、high_risk_bash 分别推荐什么 next tool？
10. token budget exceeded 为什么必须让 adapter.index 保持 0？
11. retryable 和 non-retryable failure 的边界是什么？
12. ProviderCapabilityRegistry 为什么是硬边界，不是 prompt 建议？
13. output repair 为什么必须重新过 tool schema？
```

过关标准：

```text
你能从 Core 21-23 的任一 verify case 反推：
这是长任务 eval 问题、tool transaction 问题，还是 gateway budget/provider 问题；
并能说清哪个字段证明它没有退化成 final answer 文本、裸写文件或无预算 provider 调用。
```
