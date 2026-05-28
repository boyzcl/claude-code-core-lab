# Core 21 Long-Running Task Eval：把长任务从多跑几轮升级为状态和成本曲线

> 本 Core 接在 `core-20-plan-state-machine.md` 后面。
>
> Core 18 / 19 / 20 已经分别证明：
>
> ```text
> Context 可以解释 token、cache 和 artifact。
> Compaction 可以做机器保真检查。
> Plan 可以成为 step-level Runtime 状态机。
> ```
>
> Core 21 验证：
>
> ```text
> 长任务不是“多跑几轮”，
> 而是多轮中 Context / Compaction / Plan / Cost / Failure 都能被评估和解释。
> ```

---

## 1. 本 Core 解决什么问题

前序 Core 已经有单任务闭环、压缩保真和计划状态机，但生产化长任务还需要回答：

```text
多轮修复过程中，状态是否连续？
连续失败两次时，failure history 是否保留并影响下一步？
中途 compaction 后，active plan step 是否能恢复并继续？
每轮 token / cache / cost 是否能汇总成曲线？
模型提前 final 时，eval 是否能归因为 verification_missing？
学习者能否读懂每轮为什么继续、压缩、恢复？
```

Core 21 把这些问题做成 deterministic local long-running eval。

---

## 2. 当前实现位置

代码：

```text
src/core/long-running-task-eval.mjs
src/core/long-running-task-eval.verify.mjs
```

运行：

```bash
npm run core:21
npm run core:21:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. 核心机制

### 3.1 Long-Running Report

Core 21 输出一份长任务报告：

```text
version
status
score
turns
failureHistory
compactionEvents
costCurve
learningHandoff
boundary
```

报告中的 7 轮模拟覆盖：

```text
Search
Read
Edit
failed Bash
revision + compaction + failed Bash
Edit
passed Bash
```

### 3.2 Repeated Failure History

连续两次失败不会被后续状态覆盖，而是进入：

```text
failureHistory[]
```

每条失败记录保留：

```text
turn
command
exitCode
stderr
reason
nextAction
influencedNextAction
```

这证明失败不是日志噪声，而是下一步决策输入。

### 3.3 Compaction Under Pressure

Core 21 在第 5 轮制造 compaction pressure：

```text
activePlan.currentStepId = step_2
compactSession(...)
evaluateCompactionQuality(...)
PlanStateMachine.restore(...)
```

验证点：

```text
compaction quality status=passed。
active step 在 compactSummary 中保留。
restore 后 active step 标为 resumed。
任务可以继续完成。
```

### 3.4 Cost Curve

每轮记录：

```text
inputTokens
cachedInputTokens
uncachedInputTokens
outputTokens
estimatedCostUsd
```

当前 cost 是本地 deterministic 示例表：

```text
core21-local-deterministic-example
```

它只证明 eval 可以记录和汇总成本曲线，不声称真实 provider billing。

### 3.5 No False Final

Core 21 提供 `createFalseFinalFixture()`：

```text
模型第 2 轮提前 final。
没有 passed verification。
```

`evaluateLongRunningTaskEvalReport()` 会归因为：

```text
verification_missing
```

### 3.6 Learning Handoff

报告会输出学习者可读 handoff：

```text
跑了几轮。
保留了几次失败。
第几轮压缩并恢复了哪个 step。
token / cache 曲线是多少。
边界是什么。
```

---

## 4. 验证点

`npm run core:21:verify` 覆盖 8 个 case：

```text
1. core21: long-running task eval demo runs and verifies
2. multi-turn repair: state continues until final verification passes
3. repeated failure: two failures remain in history and steer next action
4. compaction under pressure: active step survives and resumes
5. cost curve: every turn has token and configured cost basis
6. no false final: premature final is attributed to verification_missing
7. learning handoff: summary explains continue, compact, resume, and cost
8. boundary: long-running eval is local evidence, not production claim
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| demo | 长任务报告可以生成并自检 |
| multi-turn repair | 7 轮状态连续，最终验证通过 |
| repeated failure | 两次失败进入 history 并影响下一步 |
| compaction | 压缩后 active step 可 resumed |
| cost curve | 每轮 token / cost basis 可汇总 |
| no false final | 提前 final 被归因为 verification_missing |
| learning handoff | 学习者能读懂继续、压缩、恢复和成本 |
| boundary | 本 Core 是本地证据，不是生产级 benchmark |

---

## 5. 做完本 Core 后得到什么

做完 Core 21 后，项目得到：

```text
一个可复现的长任务压力场。
```

它能解释：

```text
为什么任务继续而不是 final。
失败如何保留并影响 plan revision。
compaction 后从哪个 active step 恢复。
每轮 context / cache / cost 曲线如何变化。
提前 final 为什么失败。
```

这让 Core 22 / Core 24 / Core 25 后续能力可以放入长任务 eval 中验证，而不是只做单点 demo。

---

## 6. 下一步

Core 21 之后进入：

```text
Core 22: ToolRuntime Transaction + Patch Safety
```

最小动作：

```text
把工具修改从单次 Edit 升级为 diff preview、transaction commit、rollback、stale reread 和 protected file / high-risk command safety。
```
