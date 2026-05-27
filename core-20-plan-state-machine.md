# Core 20 Plan State Machine：把计划从批准文本升级为可审计状态机

> 本 Core 接在 `core-19-compaction-quality-eval.md` 后面。
>
> Core 04 已经证明：
>
> ```text
> Plan Mode 可以控制计划审批和工具权限。
> ```
>
> Core 20 验证：
>
> ```text
> Plan 不应只是一次 approved 文本，
> 而应成为 Runtime 可追踪、可阻塞、可修订、可恢复、可验收的 step-level 状态机。
> ```

---

## 1. 本 Core 解决什么问题

Core 04 的 `PlanController` 已能证明“批准前不能写、批准后可执行”，但生产化任务还需要回答：

```text
每个 step 当前是 pending、active、done 还是 blocked？
工具执行是否匹配当前 active step？
缺文件、失败验证或用户改需求时，step 如何进入 blocked？
用户中途改需求时，revised plan 是否保留旧 plan 历史？
compaction 后 active step 是否可恢复？
final answer 前能否检查 plan 和 verification 都完成？
```

Core 20 把这些问题做成 deterministic local state machine。

---

## 2. 当前实现位置

代码：

```text
src/core/plan-state-machine.mjs
src/core/plan-state-machine.verify.mjs
```

运行：

```bash
npm run core:20
npm run core:20:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. 核心机制

### 3.1 Step-Level State

Core 20 的 `PlanStateMachine` 把 plan 标准化为：

```text
id
objective
status
approved
currentStepId
expectedFiles
validation
steps[]
```

每个 step 至少包含：

```text
id
text
status
expectedTools
blockedReason
evidence
```

当前 step status 覆盖：

```text
pending
active
done
blocked
revised
resumed
```

### 3.2 Plan Trace

状态机为关键动作记录 append-only trace：

```text
plan.proposed
plan.approved
step.active
step.done
step.blocked
plan.revised
plan.revision_approved
step.resumed
plan.completed
```

这让 plan 的执行历史可审计，而不是只依赖模型自然语言记忆。

### 3.3 Blocked And Revision

当 active step 无法继续时：

```text
blockStep(stepId, reason, evidence)
```

会把 step 标为 `blocked`，并记录：

```text
blockedReason
evidence
plan.status=blocked
```

用户中途改需求时：

```text
revisePlan(...)
```

会把旧 plan 放进 `planRevisionLog`，未完成 step 变为 `revised`，再生成新的 approved plan。旧历史不会被覆盖。

### 3.4 Compaction Resume

Core 20 复用 Core 19 的 compaction quality eval 证明：

```text
activePlan 可以进入 compactSummary。
压缩前后的 active step 不丢。
restore 后 active step 标记为 resumed。
```

这为 Core 21 的 long-running task eval 打基础。

### 3.5 Permission And Final Grounding

`authorizeTool(toolCall)` 会检查：

```text
未批准 plan 前，Edit / Write / Bash 被拒绝。
执行中 tool 必须匹配当前 active step 的 expectedTools。
blocked plan 必须先 revision 或 resume，不能继续乱跑工具。
```

`finalAnswerDecision({ verificationState })` 会检查：

```text
所有 steps 必须 done。
verificationState.status 必须 passed。
```

否则不能声称任务完成。

### 3.6 边界

Core 20 证明的是：

```text
本地 deterministic Plan State Machine 可以追踪 step lifecycle、blocked、revision、resume、permission 和 final grounding。
```

它不证明：

```text
完整生产级人工审批系统。
真实 Claude Code plan strategy。
任意长任务都能自动恢复。
完整 ToolRuntime transaction。
生产级 Claude Code 70%-80% 能力。
```

---

## 4. 验证点

`npm run core:20:verify` 覆盖 10 个 case：

```text
1. core20: plan state machine demo runs and verifies
2. step lifecycle: steps move pending to active to done
3. blocked reason: failed step records structured reason and evidence
4. revision: user change creates revised plan without overwriting history
5. resume: compaction preserves active step and restore marks it resumed
6. permission: unapproved write tool is denied by plan state
7. permission: approved execution is bounded to active step tool
8. final grounding: incomplete plan cannot claim completion
9. boundary: plan machine is local runtime evidence, not prompt-only claim
10. validation: malformed plan is rejected before execution
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| demo | plan 可以执行、压缩、恢复并完成 |
| step lifecycle | step 从 pending -> active -> done |
| blocked reason | blocked step 有 reason 和 evidence |
| revision | revised plan 不覆盖旧 plan 历史 |
| resume | compaction 后 active step 可恢复为 resumed |
| unapproved permission | 未批准写操作被拒绝 |
| active step permission | 已批准执行仍受 active step 限制 |
| final grounding | plan 未完成时不能 final |
| boundary | 本 Core 是本地证据，不是生产级声明 |
| validation | 坏 plan 不能进入执行 |

---

## 5. 做完本 Core 后得到什么

做完 Core 20 后，项目得到：

```text
一个可审计的 Plan State Machine。
```

它能解释：

```text
当前执行到了哪个 step。
为什么一个 step 被 blocked。
用户改需求后新旧 plan 如何关联。
compaction 后从哪个 step 恢复。
为什么某个工具被允许或拒绝。
final answer 是否有完成的 plan 和 passed verification 支撑。
```

这让后续 Core 21 / Core 22 / Core 26 可以依赖 plan state，而不是依赖模型记忆一段计划文本。

---

## 6. 下一步

Core 20 之后进入：

```text
Core 21: Long-Running Task Eval
```

最小动作：

```text
构造多轮长任务压力场，把 Context Economy、Compaction Quality 和 Plan State Machine 放到同一条 eval 曲线中验证。
```
