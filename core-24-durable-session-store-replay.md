# Core 24 Durable Session Store + Replay：把运行状态升级为可恢复事实流

> 本 Core 接在 `core-23-model-gateway-budget-controller.md` 后面。
>
> Core 05 / 06 / 20 / 22 / 23 已经证明：
>
> ```text
> Compaction 可以保留长任务关键状态。
> Trace / Eval 可以把运行过程变成 evidence。
> Plan State Machine 可以恢复 active step。
> ToolRuntime Transaction 可以留下 transaction evidence。
> ModelGateway Budget Controller 可以留下 provider / budget decision。
> ```
>
> Core 24 验证：
>
> ```text
> 任意一次运行都能从 append-only event log、snapshot 和 replay evidence 重建“发生了什么、为什么能恢复”。
> ```

---

## 1. 本 Core 解决什么问题

前序 Core 的状态主要在内存里。生产化长任务需要回答：

```text
event log 是否 append-only，不能悄悄重排？
snapshot restore 是否能恢复同等关键 state？
crash / handoff 后 active plan 和 pending action 是否还在？
trace replay 是否能从旧事件重建关键状态？
compaction 前后状态转换是否可审计？
session evidence 是否不会落 raw secret？
```

Core 24 把这些问题做成 deterministic local durable replay evidence。

---

## 2. 当前实现位置

代码：

```text
src/core/durable-session-store-replay.mjs
src/core/durable-session-store-replay.verify.mjs
```

运行：

```bash
npm run core:24
npm run core:24:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. 核心机制

### 3.1 Append-only Event Log

`DurableSessionStore.appendEvent()` 会把事件写入 `events.jsonl`，每条事件包含：

```text
seq
type
payload
previousHash
hash
```

`verifyAppendOnlyLog()` 会检查：

```text
seq 必须连续。
previousHash 必须指向上一条事件。
hash 必须和事件内容一致。
```

verify 会构造 reordered log，并证明重排会被拒绝。

### 3.2 Snapshot Restore

`createSnapshot()` 会基于 replay state 写入 snapshot：

```text
throughSeq
eventLogHash
stateHash
state
```

`restoreSnapshot()` 读取 snapshot 后，verify 会和 `replay(... throughSeq)` 的 state 对照，证明恢复不是凭空摘要。

### 3.3 Crash Recovery

`recoverAfterCrash()` 会：

```text
读取最新 snapshot。
重放 snapshot.throughSeq 之后的 tail events。
返回 recovered state、activePlan 和 pendingActions。
```

verify 构造 crash 后 tail events，确认：

```text
activePlan.id=plan_core24
currentStepId=step_2
pendingActions 仍包含下一步验证动作
```

### 3.4 Trace Replay

`replay()` 会从事件流重建：

```text
messages
runtimeTrace
modelGatewayDecisions
activePlan
pendingActions
modifiedFiles
verificationState
failureHistory
compactionAudit
```

这让旧 trace 不只是日志文本，而是能恢复 Runtime 关键 state 的事实流。

### 3.5 Compaction Audit

`recordCompactionTransition()` 会写入：

```text
compaction.before
compaction.after
quality report
```

quality report 复用 Core 19 的 `evaluateCompactionQuality()`，用于证明 compaction 前后的：

```text
objective
constraints
failure
active plan
modified files
pending actions
```

没有丢失。

### 3.6 Secret Boundary

写入前会执行 `sanitizeForStorage()`：

```text
apiKey
authorization
token
secret
credential
password
```

这些 key 的值会变成：

```text
[REDACTED]
```

verify 会扫描 event log 和 snapshot，确认 raw provider credential 没有落盘。

### 3.7 边界

Core 24 证明的是：

```text
本地 deterministic durable session store 可以 append event、create snapshot、restore、replay、recover after crash，并扫描 secret boundary。
```

它不证明：

```text
分布式 durable storage。
跨机器 session 产品。
完整数据库迁移系统。
完整 enterprise audit log。
生产级 Claude Code 70%-80% 能力。
```

---

## 4. 验证点

`npm run core:24:verify` 覆盖 8 个 case：

```text
1. core24: durable session demo runs and verifies
2. append-only event log: sequence and hash chain cannot reorder
3. snapshot restore: restored state matches snapshot replay state
4. crash recovery: pending action and active plan survive
5. trace replay: old trace rebuilds equivalent key state
6. compaction audit: replay explains before and after transition
7. secret boundary: raw provider credentials are not persisted
8. boundary: durable replay is local evidence, not production store
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| demo | event log、snapshot、recovery、replay、audit、secret scan 可一起运行 |
| append-only event log | seq/hash chain 可检测重排 |
| snapshot restore | snapshot state 和 replay state 一致 |
| crash recovery | crash 后 active plan / pending action 不丢 |
| trace replay | 旧事件可重建关键 Runtime state |
| compaction audit | compaction 前后转换可审计且质量通过 |
| secret boundary | raw credential 不写入 event log / snapshot |
| boundary | 本 Core 是本地证据，不是完整生产级存储产品 |

---

## 5. 做完本 Core 后得到什么

做完 Core 24 后，项目得到：

```text
一个可恢复、可审计的 session evidence layer。
```

它能解释：

```text
每条事件的顺序和 hash 链。
snapshot 恢复到了哪一个 seq。
crash 后重放了哪些 tail events。
active plan 和 pending action 为什么仍然存在。
compaction 前后哪些字段被保留。
secret 为什么没有进入持久化证据。
```

这让 Core 25 的 Repo Intelligence 可以把 repo index / relevance decision 写入可 replay 的 session 事实流。

---

## 6. 下一步

Core 24 之后进入：

```text
Core 25: Repo Intelligence + Relevance Index
```

最小动作：

```text
建立 repo map、symbol/test/rule index、incremental update 和 relevance scoring 的 deterministic evidence。
```
