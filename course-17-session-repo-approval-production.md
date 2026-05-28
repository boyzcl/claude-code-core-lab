# Course 17 Session Repo Approval Production：从 verify case 跟踪会话恢复、仓库相关性和人工协作

> 本课对应 Core 24、Core 25、Core 26。
>
> `course-16` 已经跟踪了长任务评测、事务工具和预算网关。
>
> 本课继续跟踪 Production Upgrade 后半段：运行事实如何持久化和 replay，仓库相关性如何解释，高风险动作和用户打断如何进入 Runtime 状态。
>
> 术语先用中文理解；英文用于对照代码字段和 verify case：
>
> ```text
> docs/production-upgrade-terms-zh.md
> ```

---

## 0. 本课跟踪哪三条执行链

Core 24、Core 25、Core 26 共同解决的是生产化协作和恢复问题。

```text
Core 24 Durable Session Store + Replay:
  运行事实能不能从 append-only event log、snapshot 和 replay 中恢复？
  secret 是否不会进入持久化证据？

Core 25 Repo Intelligence + Relevance Index:
  为什么选这个文件、测试和规则？
  索引能否局部更新？
  repo-aware context 是否比 naive context 更省 token？

Core 26 Human Approval + Interruption Protocol:
  protected edit / high-risk Bash 是否进入 approval_required？
  approve / reject / interrupt / handoff 是否进入可 replay session event？
  审批前隐藏执行是否会被拦截？
```

三条主线：

```text
主线 A：Durable Session
  verify case
    -> createDurableSessionFixture
    -> DurableSessionStore.readEvents / replay / restoreSnapshot / recoverAfterCrash
    -> verifyAppendOnlyLog / scanForSecrets

主线 B：Repo Intelligence
  verify case
    -> createRepoIntelligenceFixture
    -> RepoIntelligenceIndex.buildIndex
    -> scoreRelevance / updateFiles / compareTokenBenefit

主线 C：Human Approval
  verify case
    -> createHumanApprovalFixture
    -> HumanApprovalInterruptionProtocol.requestAction
    -> approve / reject / interrupt / buildHandoff
    -> assertNoHiddenExecution
```

一句话：

```text
Session 让运行事实可恢复，Repo Intelligence 让上下文输入可解释，Human Approval 让人类协作事件可审计。
```

---

## 1. 先运行什么

```bash
npm run core:24:verify
npm run core:25:verify
npm run core:26:verify
```

然后读：

```text
src/core/durable-session-store-replay.verify.mjs
src/core/durable-session-store-replay.mjs
src/core/repo-intelligence-relevance-index.verify.mjs
src/core/repo-intelligence-relevance-index.mjs
src/core/human-approval-interruption-protocol.verify.mjs
src/core/human-approval-interruption-protocol.mjs
```

读法：

```text
先看每个 verify case 如何构造持久化事实或协作事件。
再看对应对象如何把事实写成可检查字段。
最后看 boundary case 防止哪些生产级能力漂移。
```

---

## 2. Execution Chain A1：append-only event log 如何检测重排

对应 case：

```text
src/core/durable-session-store-replay.verify.mjs
append-only event log: sequence and hash chain cannot reorder
```

verify 构造：

```text
const fixture = await createDurableSessionFixture()
const events = await fixture.store.readEvents(fixture.sessionId)
const verification = verifyAppendOnlyLog(events)
const reordered = [events[1], events[0], ...events.slice(2)]
```

正常 events 必须满足：

```text
seq 连续
previousHash 指向上一条事件
hash 和事件内容一致
```

verify 检查：

```text
verification.valid === true
events.map(event.seq) === [1, 2, ..., n]
verifyAppendOnlyLog(reordered) throws
```

这个 case 钉住的边界是：

```text
session log 不是普通日志文本。
它有 seq/hash chain，可以检测事件重排。
```

如果没有这条边界：

```text
审批事件可能被移动到执行事件之后。
crash recovery 可能基于错误顺序恢复。
审计时无法判断历史是否被篡改。
```

---

## 3. Execution Chain A2：snapshot restore 和 crash recovery 如何证明状态可恢复

对应 case：

```text
snapshot restore: restored state matches snapshot replay state
crash recovery: pending action and active plan survive
```

snapshot restore case：

```text
const restored = await fixture.store.restoreSnapshot(sessionId, snapshot.id)
const replayAtSnapshot = await fixture.store.replay(sessionId, {
  throughSeq: snapshot.throughSeq
})
```

断言：

```text
restored.id === snapshot.id
restored.stateHash === snapshot.stateHash
restored.state === replayAtSnapshot.state
restored.state.activePlan.id === "plan_core24"
```

crash recovery case：

```text
const recovery = await fixture.store.recoverAfterCrash(sessionId)
```

断言：

```text
recovery.status === "recovered"
recovery.activePlan.id === "plan_core24"
recovery.activePlan.currentStepId === "step_2"
pendingActions includes "Rerun node scripts/test.cjs"
recovery.state.crash.recoverable === true
```

这个 case 钉住的边界是：

```text
恢复不是把一段摘要读回来。
snapshot state 必须能和 replay state 对齐；crash 后 tail events 必须恢复 active plan 和 pending action。
```

---

## 4. Execution Chain A3：trace replay、compaction audit 和 secret boundary 如何合成审计链

对应 case：

```text
trace replay: old trace rebuilds equivalent key state
compaction audit: replay explains before and after transition
secret boundary: raw provider credentials are not persisted
```

trace replay 检查：

```text
replay.state.activePlan.id === fixture.activePlan.id
replay.state.modifiedFiles === ["src/pagination.cjs"]
replay.state.verificationState.status === "failed"
runtimeTrace includes context.built
modelGatewayDecisions.length === 1
compactionAudit.length === 1
```

compaction audit 检查：

```text
audit.transitionId === "compaction_core24_001"
audit.before.activePlan.id === "plan_core24"
audit.after.compactSummary.activePlan.id === "plan_core24"
audit.quality.status === "passed"
audit.quality.failureType === null
```

secret boundary 检查：

```text
scan.status === "passed"
scan.matches.length === 0
eventsText 不包含 local-test-provider-key
eventsText 不包含 Bearer local-test-provider-token
eventsText 包含 [REDACTED]
```

这个 case 钉住的边界是：

```text
Durable Session 不只是恢复运行状态。
它还要让 trace、model gateway decision、compaction audit 和 secret redaction 都成为可检查证据。
```

仍然不能声称：

```text
分布式 durable storage。
跨机器 session 产品。
enterprise audit log。
```

---

## 5. Execution Chain B1：repo map、symbol index、test index 分别证明什么

对应 case：

```text
src/core/repo-intelligence-relevance-index.verify.mjs
repo map: fixture files, scripts, and rule entries are indexed
symbol index: exported symbol and references can be located
test index: package scripts and test files are associated
```

repo map case：

```text
const fixture = await createRepoIntelligenceFixture()
const repoIndex = new RepoIntelligenceIndex({ workspaceRoot })
const index = await repoIndex.buildIndex()
```

断言：

```text
repoMap.files includes src/pagination.cjs
repoMap.files includes package.json
repoMap.scripts includes test
repoMap.ruleEntrypoints includes AGENTS.md
```

symbol index case 检查：

```text
symbol name = paginate
symbol path = src/pagination.cjs
symbol.exported = true
reference from tests/pagination.test.cjs to src/pagination.cjs
reference.imported includes paginate
```

test index case 检查：

```text
packageScripts includes test
testFiles includes tests/pagination.test.cjs
associations includes src/pagination.cjs -> tests/pagination.test.cjs
```

这个 case 钉住的边界是：

```text
Repo Intelligence 不只是 Search 命中。
它知道文件、脚本、导出符号、引用关系和 source -> test association。
```

---

## 6. Execution Chain B2：rule discovery 和 relevance scoring 如何解释“为什么这个文件第一”

对应 case：

```text
rule discovery: AGENTS and README rules enter high priority index
relevance scoring: correct file ranks above similar files
```

rule discovery 检查 high priority rules：

```text
path === "AGENTS.md"
text includes "public api"
text includes "npm test"
```

relevance scoring 输入：

```text
goal: "Fix paginate empty page bug, preserve public API, and run npm test."
query: "paginate empty page public API npm test"
```

断言：

```text
selectedFiles[0].path === "src/pagination.cjs"
target.score > cart.score
target.reasons includes symbol_match
target.reasons includes test_association
```

这个 case 钉住的边界是：

```text
正确文件排第一不是因为模型猜得准。
score reasons 解释了 symbol、test、rule 和 query 证据如何共同作用。
```

---

## 7. Execution Chain B3：incremental update 和 token benefit 防止什么误解

对应 case：

```text
incremental update: modified file refreshes without full reindex
token benefit: indexed context selects correct file with fewer tokens
```

incremental update 先 buildIndex，再修改：

```text
src/pagination.cjs
```

调用：

```text
const update = await repoIndex.updateFiles(["src/pagination.cjs"])
```

断言：

```text
before.hash !== after.hash
trace.event === "repo.index.updated"
changedPaths === ["src/pagination.cjs"]
updatedFileCount === 1
reusedFileCount > 0
```

token benefit 调用：

```text
const relevance = repoIndex.scoreRelevance(...)
const tokenBenefit = repoIndex.compareTokenBenefit(relevance)
```

断言：

```text
tokenBenefit.status === "passed"
correctFileSelected === true
indexed.tokens < naive.tokens
indexed.paths includes src/pagination.cjs
```

这个 case 钉住的边界是：

```text
repo-aware context 的收益必须可解释。
它不是“智能搜索”口号，而是能显示更新了什么、复用了什么、少用了多少 token。
```

仍然不能声称：

```text
embedding 语义检索。
任意超大仓库生产级索引。
真实 IDE / LSP 全量符号能力。
```

---

## 8. Execution Chain C1：approval_required 如何产生

对应 case：

```text
src/core/human-approval-interruption-protocol.verify.mjs
high-risk approval: protected edit and Bash enter approval_required
```

verify 构造：

```text
const fixture = await createHumanApprovalFixture()
const protectedEdit = await fixture.protocol.requestAction(createProtectedEditAction())
const highRiskBash = await fixture.protocol.requestAction(createHighRiskBashAction())
const events = await fixture.store.readEvents(fixture.sessionId)
```

断言：

```text
protectedEdit.status === "approval_required"
protectedEdit.approval.risk.riskClass === "protected_edit"
highRiskBash.status === "approval_required"
highRiskBash.approval.risk.riskClass === "high_risk_bash"
events 中 approval.required 数量 === 2
```

这个 case 钉住的边界是：

```text
protected edit 和 high-risk Bash 不直接执行。
它们先变成 approval.required session event。
```

---

## 9. Execution Chain C2：approve 和 reject 为什么都要写入 Runtime 状态

对应 case：

```text
approve path: user approval continues execution with trace
reject path: user rejection does not execute and revises plan
```

approve case：

```text
const request = await protocol.requestAction(createProtectedEditAction())
const approved = await protocol.approve(request.approval.id, {
  approver: "maintainer",
  note: "Reviewed diff preview."
})
```

断言：

```text
approved.status === "approved_and_executed"
approved.execution.status === "executed"
approval.approved event 早于 tool.executed event
runtimeTrace includes tool.executed
```

reject case：

```text
const request = await protocol.requestAction(createHighRiskBashAction())
const rejected = await protocol.reject(request.approval.id, {
  reason: "Not needed for verification."
})
```

断言：

```text
rejected.status === "rejected_plan_revised"
executedActionIds 不包含 bash_rm_rf
revision.reason === "approval_rejected"
activePlan.status === "revised"
step_2.blockedReason === "human_rejected_approval"
```

这个 case 钉住的边界是：

```text
批准不是口头许可，拒绝也不是聊天说明。
二者都必须改变 session events、runtimeTrace 和 plan state。
```

---

## 10. Execution Chain C3：interruption 和 handoff 如何成为恢复入口

对应 case：

```text
interruption: user change pauses active step and adds constraint
handoff: unfinished task produces recoverable artifact
```

interruption case 调用：

```text
protocol.interrupt({
  newGoal: "Stop protected writes and produce handoff.",
  newConstraint: "No more writes before user review."
})
```

断言：

```text
status === "interrupted"
pausedStep.status === "paused"
activePlan.constraints includes new constraint
events includes session.interrupted
events includes constraint.added
events includes plan.revised
```

handoff case 先制造 pending approval，再 interrupt，然后：

```text
const handoff = await protocol.buildHandoff()
```

断言：

```text
handoff.recoverable === true
pendingApprovals.length === 1
pendingActions.length > 0
recoveryInstructions includes "Restore durable session events."
boundary.productionHumanApprovalClaim === false
```

这个 case 钉住的边界是：

```text
用户打断不是破坏流程的外部事件。
它会暂停 active step、新增约束、修订 plan，并生成可恢复 handoff。
```

handoff 不能伪装成完成：

```text
它是恢复入口，不是 final answer。
```

---

## 11. Execution Chain C4：no hidden execution 如何防止审批绕过

对应 case：

```text
no hidden execution: approval assertion blocks pre-approval execution
risk classifier: safe action stays outside approval queue
```

hidden execution case：

```text
protocol.attemptHiddenExecution(
  createProtectedEditAction({ id: "hidden_before_approval" })
)
```

断言：

```text
denied.status === "denied"
executedActionIds 不包含 hidden_before_approval
assertion.error.error_type === "approval_required"
```

verify 还构造坏事件：

```text
[
  {
    seq: 1,
    type: "tool.executed",
    payload: {
      payload: {
        id: "hidden_before_approval",
        approvalRequired: true
      }
    }
  }
]
```

调用：

```text
assertNoHiddenExecution(badEvents)
```

必须抛出：

```text
Tool executed before approval
```

risk classifier case 检查：

```text
safe Read -> requiresApproval false
protected Edit -> riskClass protected_edit
high-risk Bash -> riskClass high_risk_bash
```

这个 case 钉住的边界是：

```text
只要 action 标记为 approvalRequired，tool.executed 前必须存在更早 approval.approved。
否则 replay audit 必须失败。
```

---

## 12. Knowledge Provenance

| 判断 / 信息 | 来源 | 怎么进入系统 | 目标 | 如果没有 |
| --- | --- | --- | --- | --- |
| event 顺序 | DurableSessionStore appendEvent | seq / previousHash / hash | 检测重排 | 审批和执行顺序不可审计 |
| snapshot state | replay state | snapshot throughSeq / stateHash | 快速恢复 | 恢复只能靠摘要 |
| crash tail events | event log after snapshot | recoverAfterCrash | 保留 pending action | crash 后丢下一步 |
| compaction audit | Core 19 quality report | compactionAudit | 解释压缩转换 | 压缩前后不可追踪 |
| provider secret | adapter / gateway payload | sanitizeForStorage / scanForSecrets | 防止密钥落盘 | 证据可能泄漏凭证 |
| repo files | fixture workspace | repoMap.files | 建立仓库地图 | 只能全文搜索 |
| exported symbol | source parser | symbolIndex.symbols | 定位实现入口 | 可能改调用方 |
| source -> test | require / test files | testIndex.associations | 找到验证文件 | 不知道跑哪些测试 |
| project rules | AGENTS / README | ruleIndex high priority | 保护 public API / test rule | 规则可能被漏给模型 |
| relevance reason | scoring signals | selectedFiles.reasons | 解释排序 | 文件选择不可复盘 |
| approval risk | classifier | approval.required event | 高风险动作先审 | 可能隐藏执行 |
| approval decision | user approve/reject | approval.approved / approval.rejected | 控制执行或 revision | 人类决定停留在聊天外 |
| interruption | user new goal/constraint | session.interrupted / constraint.added | 暂停 step 并修订 plan | 用户变更不可恢复 |
| handoff | unfinished state | handoff artifact | 新会话恢复 | 未完成任务被误认为完成 |

---

## 13. Action Claim Contract

### 13.1 event log 被重排还能恢复吗

```text
Action:
  用重排后的 events 做 replay / recovery。

当前状态:
  seq/hash chain 不连续。

合理性判断:
  不合理。verifyAppendOnlyLog 必须拒绝。

来源:
  Core 24 append-only event log case。

硬约束:
  seq 连续，previousHash 指向上一条事件，hash 匹配内容。

如果做错会怎样:
  tool.executed 可能被放到 approval.approved 之前或之后，审计失效。
```

### 13.2 只靠 Search 命中就说文件相关合理吗

```text
Action:
  因为 query 命中某文件，就声称它是最佳编辑目标。

当前状态:
  Repo Intelligence 有 symbol_match、test_association、rule priority、test command 等 reasons。

合理性判断:
  不充分。必须看 relevance scoring reasons。

来源:
  Core 25 relevance scoring case。

硬约束:
  正确文件排序要能解释为什么高于相似文件。

如果做错会怎样:
  可能改调用文件而不是实现文件，或漏掉验证测试。
```

### 13.3 approval_required action 可以先执行再补审批吗

```text
Action:
  protected edit 先 tool.executed，再补 approval.approved。

当前状态:
  action.approvalRequired=true。

合理性判断:
  不合理。assertNoHiddenExecution 必须拒绝。

来源:
  Core 26 no hidden execution case。

硬约束:
  approvalRequired tool.executed 必须有更早 approval.approved。

如果做错会怎样:
  人类审批退化成事后说明，高风险动作已经发生。
```

---

## 14. 学习者应该亲手改哪里

### 14.1 破坏 event 顺序

文件：

```text
src/core/durable-session-store-replay.verify.mjs
```

观察已有代码：

```text
const reordered = [events[1], events[0], ...events.slice(2)]
```

运行：

```bash
npm run core:24:verify
```

你应该能解释：

```text
为什么 verifyAppendOnlyLog(reordered) 必须 throw。
```

### 14.2 让 secret 不 redacted

文件：

```text
src/core/durable-session-store-replay.mjs
```

只读 `sanitizeForStorage` 和 `scanForSecrets`，不要写真实 secret。

你应该能指出：

```text
apiKey / authorization / token / secret / credential / password 这些 key 为什么要变成 [REDACTED]。
```

### 14.3 删除 test association reason

文件：

```text
src/core/repo-intelligence-relevance-index.mjs
```

临时让 scoring 不计入 test association。

运行：

```bash
npm run core:25:verify
```

你应该看到 relevance scoring 或 token benefit 相关 case 变弱或失败。

实验后改回。

### 14.4 允许 hidden execution

文件：

```text
src/core/human-approval-interruption-protocol.mjs
```

临时放宽 `assertNoHiddenExecution`。

运行：

```bash
npm run core:26:verify
```

你应该看到 no hidden execution case 失败或无法抛出预期错误。

实验后改回。

---

## 15. 本课最终要能回答的问题

```text
1. Core 24 的 seq/hash chain 防止什么？
2. snapshot restore 为什么要和 replay state 对照？
3. crash recovery 为什么必须保留 activePlan 和 pendingActions？
4. trace replay 能重建哪些关键 Runtime state？
5. secret boundary 为什么属于 session evidence，而不是部署细节？
6. Core 25 repo map、symbol index、test index 分别证明什么？
7. relevance scoring 为什么比 Search 命中更强？
8. incremental update 如何证明索引不是每次全量重建？
9. token benefit 如何证明 repo-aware selection 的上下文收益？
10. protected edit 和 high-risk Bash 如何进入 approval_required？
11. approve path 和 reject path 对 plan state 有什么不同影响？
12. interruption 和 handoff 为什么不能只写在聊天文本里？
13. no hidden execution case 如何防止审批绕过？
```

过关标准：

```text
你能从 Core 24-26 的任一 verify case 指到对应 session event、repo relevance reason 或 approval state，
说明它从哪里来、为什么要持久化或排序、被哪个断言证明，
以及为什么这仍然不是分布式 store、生产级语义搜索或 GUI approval 产品。
```
