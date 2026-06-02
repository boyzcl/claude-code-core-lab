# Core 30 Checkpoint / Rewind：把恢复点变成用户可见、可审计、不会覆盖外部改动的状态边界

> 本 Core 接在 `core-29-memory-source-auto-memory.md` 后面。
>
> Core 22 / Core 24 已经证明：
>
> ```text
> Core 22 可以把文件修改做成 diff preview、transaction commit 和 rollback。
> Core 24 可以把 session event 写入 append-only log，并支持 snapshot / replay / recovery。
> ```
>
> Core 30 验证：
>
> ```text
> checkpoint / rewind 可以作为用户可见恢复点进入 Runtime：checkpoint 绑定 session event 和文件 hash，rewind 能恢复目标文件和 replay state，外部用户改动会阻止恢复，所有恢复都留下 audit replay。
> ```

---

## 0. 实现级 Validation Matrix

Core 30 是 Product Surface Study 的第四个独立 Core。它先经过 `product-surface-validation-matrix.md` 的 same-topic merge gate：

```text
它补充 Core 22 / Core 24，但不重复 Core 22 / Core 24。
```

边界：

```text
Core 30: checkpoint -> rewind request -> external change check -> file restore + audit replay。
Core 22: diff preview / transaction commit / transaction rollback / stale edit / protected file / Bash risk。
Core 24: append-only event log / durable snapshot store / replay / crash recovery。
```

新增 Runtime state：

```text
checkpoint
rewindRequest
fileStateSnapshot
externalChangeConflict
rewindAudit
```

| Case | Fixture | 预期结果 | 证据 |
| --- | --- | --- | --- |
| checkpoint creation | before / after pagination transaction checkpoint | checkpoint 绑定 file hash、event seq、event hash 和 durable snapshot id | checkpoint log |
| rewind state | 从 after-fix checkpoint 回到 before-fix checkpoint | 文件恢复到目标 checkpoint，返回 target replay state | restored files、state diff |
| partial rewind denial | source checkpoint 后用户外部修改文件 | rewind 被拒绝，任何文件都不恢复，要求用户确认 | externalChangeConflict |
| audit replay | 已执行 rewind request | 能解释 source checkpoint、target checkpoint、restored files 和 replay through seq | rewind audit report |
| event log boundary | rewind 后检查 event log | 只追加 rewind events，不截断或改写旧 transaction evidence | append-only prefix check |
| boundary | boundary object | 不声称 IDE UI、跨机器恢复、分布式 session store、完整 patch parser 或官方实现 | boundary assertions |

公开边界：

```text
本 Core 只学习用户可见恢复点如何连接 Tool Transaction 和 Durable Replay。
不复制系统提示词原文、source map 原文或反编译源码片段。
不声称复刻 Claude Code 官方 checkpoint / rewind 内部实现。
```

---

## 1. 本 Core 解决什么问题

Core 22 已经能预览、提交和回滚一次 transaction；Core 24 已经能 replay session event。但用户可见 checkpoint / rewind 还有一层新问题：

```text
checkpoint 是否绑定文件 hash，而不只是聊天里的“我记住了”？
checkpoint 是否能对应 session event 和 durable snapshot？
rewind 是恢复文件状态和 session replay state，还是只生成一句解释？
如果用户在 checkpoint 后手动改了文件，rewind 会不会覆盖？
rewind 后能否审计“从哪里回到哪里，恢复了哪些文件”？
event log 是否仍然 append-only，而不是为了回退而删历史？
```

Core 30 把这些问题做成 deterministic local checkpoint rewind evidence。

---

## 2. 当前实现位置

代码：

```text
src/core/checkpoint-rewind.mjs
src/core/checkpoint-rewind.verify.mjs
```

运行：

```bash
npm run core:30
npm run core:30:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. 核心机制

### 3.1 Checkpoint Creation

`CheckpointRewindRuntime.createCheckpoint()` 会同时记录：

```text
checkpoint id / label / reason
session replay through seq
replay state hash
fileStateSnapshot
checkpoint.created event seq / hash
durable snapshot id
```

`fileStateSnapshot` 包含每个文件的：

```text
path
exists
text
hash
bytes
```

这让 checkpoint 成为可验证状态，而不是聊天承诺。

### 3.2 Rewind State

`requestRewind()` 会指定：

```text
targetCheckpointId
fromCheckpointId
```

如果当前文件仍匹配 source checkpoint，Runtime 会把目标 checkpoint 的文件正文写回 workspace，并返回：

```text
restoredFiles
restoredSessionState
rewindAudit
```

`restoredSessionState` 来自 Core 24 的 replay through target checkpoint seq。

### 3.3 External Change Conflict

rewind 前会检查当前文件是否仍等于 source checkpoint 的 file hash。

如果用户在 source checkpoint 后外部改了文件，会生成：

```text
externalChangeConflict
safetyResult.allowedToRestore=false
recommendedNextEvent=ask_user_to_confirm_or_create_new_checkpoint
```

此时：

```text
filesRestored=[]
```

这证明 partial rewind denial 不是提示词建议，而是文件恢复前的强制边界。

### 3.4 Audit Replay

成功 rewind 会追加：

```text
rewind.requested
rewind.applied
```

`replayRewindAudit()` 能解释：

```text
sourceCheckpointId
targetCheckpointId
restoredFiles
replayThroughSeq
replayStateHash
eventTypes
```

### 3.5 Event Log Boundary

Core 30 不截断 event log。

verify 会在 rewind 前后对比 event hash prefix，确认：

```text
旧事件 hash 保持不变。
transaction evidence 仍然存在。
rewind 只是追加新 audit events。
```

---

## 4. 验证点

`npm run core:30:verify` 覆盖 8 个 case：

```text
1. core30: checkpoint rewind demo runs and verifies
2. validation matrix: Core 30 does not duplicate Core 22 or Core 24
3. checkpoint creation: checkpoint binds file hashes session event and durable snapshot
4. rewind state: files and replay state return to target checkpoint
5. partial rewind denial: external user change is not overwritten
6. audit replay: applied rewind explains source target files and seq
7. event log boundary: rewind appends audit events without truncating history
8. boundary: checkpoint rewind is local evidence, not IDE rewind product
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| demo | checkpoint、rewind、conflict、audit 和 boundary 可以一起运行 |
| validation matrix | Core 30 不重复 Core 22 transaction 或 Core 24 durable replay |
| checkpoint creation | checkpoint 绑定 file hash、session event 和 durable snapshot |
| rewind state | rewind 恢复文件并返回 target replay state |
| partial rewind denial | 外部用户改动会阻止恢复，且不会覆盖文件 |
| audit replay | rewind 可解释 source、target、restored files 和 replay seq |
| event log boundary | rewind 追加 audit events，不改写历史 |
| boundary | 本 Core 是本地确定性证据，不是 IDE rewind 产品 |

---

## 5. 做完本 Core 后得到什么

做完 Core 30 后，Product Surface Study 得到第四个可验证 Core：

```text
Checkpoint / Rewind 可以作为 Tool Transaction 和 Durable Replay 之间的用户可见恢复层。
```

现在链路可以表达为：

```text
transaction evidence
  -> checkpoint fileStateSnapshot + session event
  -> rewind request
  -> external change conflict check
  -> file restore + audit replay
```

---

## 6. 边界

Core 30 证明的是：

```text
本地 deterministic checkpoint rewind 可以创建用户可见 checkpoint、绑定文件 hash 和 session event、恢复文件和 replay state、拒绝覆盖外部改动，并留下可 replay 的 audit trail。
```

它不证明：

```text
完整 IDE UI。
跨机器恢复。
分布式 session store。
完整 patch parser。
真实 Claude Code checkpoint / rewind 内部实现。
生产级恢复产品。
```
