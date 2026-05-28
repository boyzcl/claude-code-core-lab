# Core 31 Subagent Context Isolation：把委派任务变成隔离上下文、结构化回传和去重 ledger

> 本 Core 接在 `core-30-checkpoint-rewind.md` 后面。
>
> Core 21 / Core 24 / Core 25 已经证明：
>
> ```text
> Core 21 可以评估长任务的多轮修复、失败保留、压缩恢复和 no false final。
> Core 24 可以把 session event 写入 append-only log，并支持 replay。
> Core 25 可以建立 repo map、symbol/test/rule index 和 relevance scoring。
> ```
>
> Core 31 验证：
>
> ```text
> subagent 不是普通搜索提示词，而是 delegated task、subagentContext、subagentResult、delegationLedger 和 isolationAudit 组成的 Runtime 边界。子代理只看任务相关上下文，父代理只接收结构化摘要和证据链接，重复研究会被 ledger 阻止，失败会结构化回传。
> ```

---

## 0. 实现级 Validation Matrix

Core 31 是 Product Surface Study 的第五个独立 Core。它先经过 `product-surface-validation-matrix.md` 的 same-topic merge gate：

```text
它补充 Core 21 / Core 24 / Core 25，但不重复 Core 21 / Core 24 / Core 25。
```

边界：

```text
Core 31: delegated task -> isolated context -> subagent result -> parent receipt -> delegation ledger。
Core 21: long-running eval、multi-turn repair、cost curve、compaction resume、no false final。
Core 24: durable store、append-only hash chain、snapshot、crash recovery。
Core 25: repo map、symbol/test/rule index、relevance scoring、incremental update。
```

新增 Runtime state：

```text
delegatedTask
subagentContext
subagentResult
delegationLedger
isolationAudit
```

| Case | Fixture | 预期结果 | 证据 |
| --- | --- | --- | --- |
| independent task | 两个 pagination research tasks | 同一 parallel group 中返回两个独立结果 | delegation trace |
| context isolation | parent context 含 private notes 和 unrelated files | subagent 只看到 allowed paths，不含 parent private notes | subagentContext diff |
| no duplicate research | 同一 delegated task signature 提交两次 | 第二次复用 ledger result，不重新执行研究 | delegationLedger |
| result contract | 成功 subagent result | parent 只接收 summary 和 evidence refs，不接收 raw context | parent receipt |
| failure propagation | isolated context 中找不到目标 symbol | parent 收到 structured failure 和 retry hint | failure report |
| isolation audit | replay delegation events | 能解释 delegated task、result id、ledger entry 和 event seq | isolation audit |
| boundary | boundary object | 不声称多进程调度、远端 worker 隔离、agent marketplace 或官方实现 | boundary assertions |

公开边界：

```text
本 Core 只学习子代理上下文隔离和结果回传契约。
不复制系统提示词原文、source map 原文或反编译源码片段。
不声称复刻 Claude Code 官方 subagent 内部调度。
```

---

## 1. 本 Core 解决什么问题

现有 Core 已经能做长任务评估、durable session 和 repo intelligence，但子代理还有一层新的产品问题：

```text
父代理委派的是一个结构化任务，还是只是多说一句“去搜索”？
子代理看到的是完整父上下文，还是任务相关的受限上下文？
子代理结果回到父代理时，是 raw transcript，还是 summary + evidence refs？
同一研究是否会被重复执行？
子代理失败时，父代理能否拿到结构化失败原因，而不是把失败吞掉？
delegation 是否能进入 session event 并被 replay/audit？
```

Core 31 把这些问题做成 deterministic local subagent isolation evidence。

---

## 2. 当前实现位置

代码：

```text
src/core/subagent-context-isolation.mjs
src/core/subagent-context-isolation.verify.mjs
```

运行：

```bash
npm run core:31
npm run core:31:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. 核心机制

### 3.1 Delegated Task

`SubagentContextIsolationRuntime.delegateTask()` 会把父代理的委派请求转成 `delegatedTask`：

```text
id / type / objective / query
allowedPaths / forbiddenPaths
contextBudget / maxContextFiles
expectedResultShape
parallelGroupId
```

task signature 不包含 task id，因此同一研究换个 id 再提交时，会被 `delegationLedger` 识别为重复研究。

### 3.2 Subagent Context

`buildSubagentContext()` 会使用 Core 25 的 `RepoIntelligenceIndex` 作为输入，但只选择 `allowedPaths` 中的文件。

context 会显式记录：

```text
includedParentBlocks: delegated_task_objective, task_specific_constraints
excludedParentBlocks: parent_private_notes, unrelated_full_history, unrelated_repo_files
rawParentMessagesIncluded=false
rawSubagentTranscriptReturned=false
```

这证明隔离不是提示词建议，而是 context builder 的输入边界。

### 3.3 Result Contract

成功结果只返回：

```text
status
summary
evidenceRefs
contextDigestHash
```

父代理 receipt 记录：

```text
rawSubagentContextStored=false
promotedToSystemPrompt=false
duplicateResearchAllowed=false
```

### 3.4 No Duplicate Research

`delegationLedger` 以 task signature 为 key。

如果同一任务再次提交：

```text
status=duplicate_reused
researchExecuted=false
runCount=1
```

这不是靠模型记忆，而是 Runtime ledger 的强制边界。

### 3.5 Failure Propagation

失败结果不会变成成功摘要，也不会伪装成 final answer。

父代理收到：

```text
accepted_as_structured_failure
failure.reason
failure.retryHint
```

### 3.6 Durable Session Boundary

Core 31 不实现新的 durable store。它只把这些事件写入 Core 24 的 session event log：

```text
delegation.parallel_started
delegation.started
subagent.result_received
delegation.completed
delegation.parallel_completed
delegation.duplicate_reused
```

并在 runtime 内用 append queue 串行落盘，避免逻辑并行任务破坏 Core 24 的 append-only seq/hash chain。

---

## 4. 验证点

`npm run core:31:verify` 覆盖 9 个 case：

```text
1. core31: subagent context isolation demo runs and verifies
2. validation matrix: Core 31 does not duplicate Core 21 24 or 25
3. independent task: two delegated tasks run in one parallel group
4. context isolation: subagent sees only task-specific files
5. no duplicate research: delegated task signature reuses ledger
6. result contract: parent receives summary and evidence only
7. failure propagation: subagent failure reaches parent as structured failure
8. isolation audit: delegation ledger is replayable from session events
9. boundary: subagent isolation is local evidence not agent marketplace
```

这些 case 共同证明：

```text
subagent 的核心不是“多开一个搜索”，而是委派任务、隔离上下文、结构化结果、去重 ledger 和 replayable audit。
```

---

## 5. 本 Core 没有证明什么

Core 31 不是：

```text
真实多进程 agent 调度系统。
任意长任务并行系统。
远端 worker 隔离或权限沙箱。
完整 agent marketplace。
Claude Code 官方 subagent 内部实现。
```

它只证明本项目自己的 Runtime 可以把 subagent context isolation 的关键边界转成可验证对象模型。
