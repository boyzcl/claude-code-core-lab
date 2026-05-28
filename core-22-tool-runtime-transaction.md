# Core 22 ToolRuntime Transaction + Patch Safety：把修改升级为可预览、可回滚的事务

> 本 Core 接在 `core-21-long-running-task-eval.md` 后面。
>
> Core 04 / 09 / 20 / 21 已经证明：
>
> ```text
> Edit 需要 read-before-write、stale check 和路径安全。
> 真实 repo 任务会遇到项目规则、stale edit 和验证失败。
> Plan State Machine 可以约束执行步骤。
> Long-Running Eval 可以把多轮失败和恢复放进压力场。
> ```
>
> Core 22 验证：
>
> ```text
> Agent 可以改代码，但每次修改必须可预览、可事务化、可回滚、可解释。
> ```

---

## 1. 本 Core 解决什么问题

Core 04 的 Edit 已经证明单文件安全写入，但生产化任务还需要回答：

```text
edit 前是否能生成 diff preview？
未 commit 前是否保证不写入？
多文件修改是否能一次 transaction commit？
中途失败是否能 rollback 到事务前内容和 hash？
外部修改后是否要求 reread，而不是覆盖用户改动？
受保护 API 文件是否要求审批？
高风险 Bash 是否被拒绝或进入审批？
```

Core 22 把这些问题做成 deterministic local transaction runtime。

---

## 2. 当前实现位置

代码：

```text
src/core/tool-runtime-transaction.mjs
src/core/tool-runtime-transaction.verify.mjs
```

运行：

```bash
npm run core:22
npm run core:22:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. 核心机制

### 3.1 Read Snapshot

事务预览前必须先 `read(path)`，记录：

```text
path
text
hash
```

没有 snapshot 的 edit 会得到：

```text
file_not_read
recommended_next_tool=Read
```

### 3.2 Diff Preview

`previewTransaction(edits)` 会检查：

```text
path safety
protected file
read snapshot
stale hash
oldString uniqueness
```

通过后生成：

```text
transactionId
diffArtifacts[]
transactionLog
writesApplied=false
```

这证明 preview 不是写入伪装。

### 3.3 Transaction Commit

`commitTransaction(transactionId)` 会在写入前再次检查 before hash，然后把多文件修改作为一次 transaction 写入。

成功时记录：

```text
transaction.committed
written[]
```

### 3.4 Rollback

如果 commit 中途失败，Runtime 会把已写文件按事务前内容恢复，并记录：

```text
transaction.rolled_back
restored[]
```

verify 用 `failAfterWrites=1` 构造失败，证明文件回到事务前状态。

### 3.5 Stale / Protected / Bash Risk

Core 22 继续保留安全边界：

```text
stale_file -> recommended_next_tool=Read
protected_file_requires_approval -> recommended_next_tool=AskUser
high_risk_command_requires_approval -> recommended_next_tool=AskUser
```

这让后续 Core 26 的 Human Approval 可以接入真实审批状态。

### 3.6 边界

Core 22 证明的是：

```text
本地 deterministic transaction layer 可以预览、commit、rollback，并拦截 stale/protected/high-risk。
```

它不证明：

```text
完整生产级 ToolRuntime。
完整 patch parser。
真实 IDE diff UI。
完整 Human Approval 产品。
生产级 Claude Code 70%-80% 能力。
```

---

## 4. 验证点

`npm run core:22:verify` 覆盖 8 个 case：

```text
1. core22: transaction demo runs and verifies
2. diff preview: preview creates diff artifacts and does not write
3. transaction commit: multi-file transaction writes only after commit
4. rollback: simulated failure restores pre-transaction hashes
5. stale reread: external change after read blocks preview
6. protected file: protected API edit requires approval
7. bash risk class: high-risk command is denied or sent to approval
8. boundary: transaction layer is local evidence, not full ToolRuntime
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| demo | preview + commit + transaction log 可运行 |
| diff preview | 预览生成 diff artifact 且不写文件 |
| transaction commit | 多文件修改在 commit 后一次写入 |
| rollback | 中途失败会恢复事务前内容 |
| stale reread | 外部修改会触发 stale_file |
| protected file | 受保护 API 文件要求审批 |
| bash risk class | 高风险命令不直接执行 |
| boundary | 本 Core 是本地证据，不是完整 ToolRuntime |

---

## 5. 做完本 Core 后得到什么

做完 Core 22 后，项目得到：

```text
一个可事务化的 patch safety 层。
```

它能解释：

```text
准备改哪些文件。
每个文件的 diff preview 是什么。
什么时候真正写入。
失败后恢复了哪些文件和 hash。
为什么 stale/protected/high-risk 被拒绝。
```

这让 Core 24 的 Durable Replay 和 Core 26 的 Human Approval 可以复用 transaction evidence。

---

## 6. 下一步

Core 22 之后进入：

```text
Core 23: Production ModelGateway + Budget Controller
```

最小动作：

```text
给 ModelGateway 增加 token/cost budget gate、retry/fallback 和 provider capability registry 的 deterministic evidence。
```
