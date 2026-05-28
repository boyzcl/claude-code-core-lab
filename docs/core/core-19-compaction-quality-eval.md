# Core 19 Compaction Quality Eval：把压缩从摘要升级为状态保真验证

> 本 Core 接在 `core-18-context-economy-cache-aware-context-engine.md` 后面。
>
> Core 05 已经证明：
>
> ```text
> Compaction 可以把长任务关键状态迁移到 compactSummary，
> 并把长输出放入 artifact。
> ```
>
> Core 19 验证：
>
> ```text
> Compaction 不能只看“有没有摘要”，
> 还必须机器对照压缩前后的目标、约束、失败、计划、文件和下一步动作是否保真。
> ```

---

## 1. 本 Core 解决什么问题

Core 05 的 compactor 已经能生成 compact summary，但生产化任务里还需要回答：

```text
目标有没有漂移？
用户约束和安全约束有没有丢？
失败验证有没有被错误压成 passed？
active plan 的 id、step 和 status 是否还能恢复？
修改过的文件和修改原因是否可追踪？
下一步动作是否还在？
坏压缩能不能被明确归因为 compaction_loss？
```

Core 19 把这些问题做成 deterministic local eval。

---

## 2. 当前实现位置

代码：

```text
src/core/compaction-quality.mjs
src/core/compaction-quality.verify.mjs
```

运行：

```bash
npm run core:19
npm run core:19:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. 核心机制

### 3.1 Before / After 对照

Core 19 的 evaluator 接收：

```text
before
compacted.compactSummary
```

`before` 是压缩前的 canonical task state：

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

`compactSummary` 是压缩后的恢复材料。

### 3.2 Quality Checks

当前质量检查包括：

```text
objective_preservation
constraint_preservation
failure_preservation
plan_preservation
modified_files_preservation
pending_actions_preservation
```

每个 check 都输出：

```text
name
passed
failureType
details
```

失败时统一归因为：

```text
compaction_loss
```

### 3.3 Compaction Diff

报告会输出 `diff`：

```text
objective.before / after / preserved
constraints.missing / extra
verificationState.before / after / failedStatePreserved
activePlan.before / after
modifiedFiles.before / after
pendingActions.before / after
```

这让压缩问题可定位，而不是只得到一个“摘要不好”的主观判断。

### 3.4 Quality Score

报告会输出：

```text
score
status
failureType
failedChecks
recommendedAction
```

坏摘要会得到：

```text
status=failed
failureType=compaction_loss
recommendedAction=repair_or_rerun_compaction_before_restore
```

### 3.5 边界

Core 19 证明的是：

```text
本地 deterministic compaction quality eval 可以识别状态保真和 compaction_loss。
```

它不证明：

```text
完整生产级压缩系统。
真实 Claude Code compaction 策略。
任意长任务都能无损恢复。
生产级 Claude Code 70%-80% 能力。
```

---

## 4. 验证点

`npm run core:19:verify` 覆盖 9 个 case：

```text
1. core19: compaction quality demo runs and verifies
2. objective preservation: compacted objective does not drift
3. constraint preservation: user and safety constraints remain complete
4. failure preservation: failed verification cannot become passed
5. plan preservation: active plan id, steps, and status survive
6. modified files: file path and reason remain traceable
7. pending actions: next actions remain available after compact
8. quality score: bad summary is identified as compaction_loss
9. boundary: quality eval is local evidence, not production claim
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| demo | quality report 可以生成并自检 |
| objective | 压缩前后的目标不漂移 |
| constraints | 用户约束和安全约束完整保留 |
| failure | failed verification 不能被压成 passed |
| plan | active plan 的 id、step、status 保留 |
| modified files | 修改文件和原因可追踪 |
| pending actions | 下一步动作不丢 |
| quality score | 坏摘要会被归因为 compaction_loss |
| boundary | 本 Core 是本地证据，不是生产级 Claude Code 声明 |

---

## 5. 做完本 Core 后得到什么

做完 Core 19 后，项目得到：

```text
一个 compaction quality evaluator。
```

它能解释：

```text
compact summary 是否保留了继续执行任务所需的 hard state。
哪些字段在压缩后丢失或漂移。
坏压缩为什么不能进入恢复路径。
失败归因是不是 compaction_loss。
```

这让后续 Core 20 / Core 21 可以更安全地依赖 compaction 恢复 active plan 和长任务状态。

---

## 6. 下一步

Core 19 之后进入：

```text
Core 20: Plan State Machine
```

最小动作：

```text
把 Plan 从一次性 approved 文本升级为 step-level 状态机，验证 pending -> active -> done / blocked / revised / resumed。
```
