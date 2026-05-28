# Core 26 Human Approval + Interruption Protocol：把人工协作事件纳入 Runtime 状态

> 本 Core 接在 `core-25-repo-intelligence-relevance-index.md` 后面。
>
> Core 20 / 22 / 24 / 25 已经证明：
>
> ```text
> Plan State Machine 可以追踪 step lifecycle、blocked、revision 和 resume。
> ToolRuntime Transaction 可以把 protected edit / high-risk Bash 路由到 approval。
> Durable Session Store 可以把运行事实持久化并 replay。
> Repo Intelligence 可以解释相关文件、测试、规则和 token benefit。
> ```
>
> Core 26 验证：
>
> ```text
> 高风险动作、用户批准 / 拒绝、用户打断、新约束和 handoff 都可以进入可 replay 的 Runtime 状态。
> ```

---

## 1. 本 Core 解决什么问题

前序 Core 已经能识别高风险动作，但人工协作还需要成为 Runtime 事实：

```text
高风险 Bash / protected edit 是否进入 approval_required？
用户批准后是否继续执行并留下 trace？
用户拒绝后是否不执行，并修订 plan？
用户中途改目标时，active step 是否 pause，新约束是否进入 session event？
任务未完成时，是否能输出可恢复 handoff artifact？
审批前工具执行是否会被 policy assertion 拦截？
```

Core 26 把这些问题做成 deterministic local approval protocol evidence。

---

## 2. 当前实现位置

代码：

```text
src/core/human-approval-interruption-protocol.mjs
src/core/human-approval-interruption-protocol.verify.mjs
```

运行：

```bash
npm run core:26
npm run core:26:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. 核心机制

### 3.1 Approval Required

`HumanApprovalInterruptionProtocol.requestAction()` 会先调用 risk classifier：

```text
protected Edit -> protected_edit
rm -rf / sudo / curl | sh -> high_risk_bash
```

这些动作不会直接执行，而是写入：

```text
approval.required
approvalState.pending
runtimeTrace
```

### 3.2 Approve Path

`approve()` 会：

```text
从 pending approval 移到 decided approval。
写入 approval.approved session event。
随后执行对应 action。
写入 tool.executed runtime trace。
```

verify 会检查 approval event 一定早于 tool execution。

### 3.3 Reject Path

`reject()` 会：

```text
写入 approval.rejected。
不执行 action。
生成 plan revision。
把当前 step 标记为 blocked / human_rejected_approval。
```

这证明人工拒绝不是对话外说明，而是 Runtime 状态变化。

### 3.4 Interruption

`interrupt()` 会处理用户中途改目标：

```text
当前 active step -> paused。
新增 constraint。
写入 session.interrupted。
写入 constraint.added。
生成 plan revision。
```

这让“用户打断”可以被 replay，而不是只存在于聊天文本里。

### 3.5 Handoff Artifact

`buildHandoff()` 会在任务未完成时生成：

```text
sessionId
lastEventSeq
activePlan
pendingApprovals
constraints
pendingActions
recoveryInstructions
```

handoff artifact 是恢复入口，不声称任务已经完成。

### 3.6 No Hidden Execution

`assertNoHiddenExecution()` 会扫描 event log：

```text
approvalRequired tool.executed 必须有更早的 approval.approved。
```

verify 会构造坏事件，证明隐藏执行会被拒绝。

### 3.7 边界

Core 26 证明的是：

```text
本地 deterministic approval protocol 可以把 approval、reject、interrupt 和 handoff 写成可 replay 的 session events。
```

它不证明：

```text
完整 GUI approval 产品。
完整 enterprise policy 系统。
真实多人协作权限模型。
生产级 Claude Code 70%-80% 能力。
```

---

## 4. 验证点

`npm run core:26:verify` 覆盖 9 个 case：

```text
1. core26: human approval demo runs and verifies
2. high-risk approval: protected edit and Bash enter approval_required
3. approve path: user approval continues execution with trace
4. reject path: user rejection does not execute and revises plan
5. interruption: user change pauses active step and adds constraint
6. handoff: unfinished task produces recoverable artifact
7. no hidden execution: approval assertion blocks pre-approval execution
8. risk classifier: safe action stays outside approval queue
9. boundary: approval protocol is local evidence, not production UI
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| demo | approval / reject / interrupt / handoff / no hidden execution 可一起运行 |
| high-risk approval | protected edit 和 high-risk Bash 进入 approval_required |
| approve path | 批准后才执行，并留下 trace |
| reject path | 拒绝后不执行，并修订 plan |
| interruption | 用户打断会 pause active step 并新增约束 |
| handoff | 未完成任务可以输出可恢复 artifact |
| no hidden execution | 审批前执行会被 policy assertion 拦截 |
| risk classifier | safe action 不进入审批队列，高风险动作会分类 |
| boundary | 本 Core 是本地证据，不是生产级 approval UI |

---

## 5. 做完本 Core 后得到什么

做完 Core 26 后，Core 18-26 的生产化升级主线得到完整闭环：

```text
Context Economy 解释 token / cache / eviction。
Compaction Quality Eval 发现坏摘要。
Plan State Machine 恢复和修订步骤。
Long-Running Task Eval 评估多轮状态和成本。
ToolRuntime Transaction 预览、提交、回滚和审批路由。
ModelGateway Budget Controller 控制预算和 provider 决策。
Durable Session Store 重放运行事实。
Repo Intelligence 提升上下文输入相关性。
Human Approval Protocol 把审批和打断写入 Runtime 状态。
```

这仍然只是 deterministic local evidence，不是生产级 Claude Code 能力声明。

---

## 6. 下一步

Core 26 之后可以进入：

```text
复盘 Core 18-26 的证据链。
整理后续 roadmap：真实 repo benchmark、第二 reference-agent baseline、或更完整的 approval / policy 产品层。
```
