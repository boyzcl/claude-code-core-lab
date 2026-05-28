# Core 29 Memory Source / CLAUDE.md / Auto Memory：把长期记忆变成可治理的上下文来源

> 本 Core 接在 `core-28-hooks-lifecycle.md` 后面。
>
> Course 08 / Course 09 / Core 18 / Core 19 / Core 24 已经证明：
>
> ```text
> Context Engine 可以选择模型本轮看见什么。
> Compaction 可以把长任务状态压成 compactSummary。
> Context Economy 可以解释 token / cache / artifact 边界。
> Compaction Quality 可以检查压缩前后状态保真。
> Durable Session Store 可以把事件写入 append-only log。
> ```
>
> Core 29 验证：
>
> ```text
> memory / CLAUDE.md / auto memory 可以作为独立的长期上下文来源进入 Runtime：按类型路由、正文与索引分离、支持 forget、推荐前做 stale verification、和 compactSummary 分开，并拒绝把代码结构事实写进长期记忆。
> ```

---

## 0. 实现级 Validation Matrix

Core 29 是 Product Surface Study 的第三个独立 Core。它先经过 `product-surface-validation-matrix.md` 的 same-topic merge gate：

```text
它补充 Course 08 / Course 09 / Core 18 / Core 19 / Core 24，
但不重复这些已有边界。
```

边界：

```text
Core 29: memory type -> memory store / index -> freshness check -> context source。
Course 08: ModelRequest / Context Engine 装配。
Course 09: compaction 如何保留当前任务状态。
Core 18: token economy / stable prefix / dynamic tail。
Core 19: compaction quality eval。
Core 24: durable session event log / replay。
```

新增 Runtime state：

```text
memoryStore
memoryIndex
memoryType
memoryFreshnessCheck
forgetEvent
```

| Case | Fixture | 预期结果 | 证据 |
| --- | --- | --- | --- |
| memory type routing | user / feedback / project CLAUDE.md / reference 四类 candidate | 每类得到不同 read/write policy、context priority 和 freshness 要求 | route report |
| write and index | user-confirmed preference | memory body 写入 `items/*.json`，`memory-index.json` 只保存 summary、hash 和 bodyPath | body file、index |
| forget | 用户要求删除 feedback memory | body 删除，index 移除 entry，并写入 forgetEvent | deletion report |
| stale verification | reference memory 指向缺失文件/符号 | 推荐前重新检查，stale memory 不进入推荐 | freshness trace |
| compaction boundary | compactSummary 和长期 memory 同时存在 | memory block 保持 `long_term_memory`，不混入 compact summary | context snapshot |
| no code-structure memory | candidate 断言函数定义/导出位置 | 拒绝写入 memory，并建议回到 repo evidence | policy result |
| boundary | boundary object | 不声称官方 memory 格式、远端多用户 memory、隐私合规系统或代码智能数据库 | boundary assertions |

公开边界：

```text
本 Core 只学习长期记忆作为上下文来源和状态治理机制。
不复制系统提示词原文、source map 原文或反编译源码片段。
不声称复刻 Claude Code 官方 memory / CLAUDE.md / auto memory 内部实现。
```

---

## 1. 本 Core 解决什么问题

已有 Context / Compaction 能回答：

```text
模型这一轮看到什么？
长任务压缩后哪些状态必须保留？
```

但 memory 还多出一组状态治理问题：

```text
哪些内容可以成为长期记忆？
user / feedback / project / reference 是否有不同规则？
CLAUDE.md 这类项目记忆文件如何进入索引？
memory 正文和索引是否分离？
用户要求 forget 时是否真的删除并更新索引？
记忆引用文件或符号时，推荐前是否重新确认仍然存在？
长期 memory 是否会和 compactSummary 混淆？
代码结构事实是否会被错误写成长期偏好？
```

Core 29 把这些问题做成 deterministic local memory source evidence。

---

## 2. 当前实现位置

代码：

```text
src/core/memory-source-auto-memory.mjs
src/core/memory-source-auto-memory.verify.mjs
```

运行：

```bash
npm run core:29
npm run core:29:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. 核心机制

### 3.1 Memory Type Routing

`MemorySourceRuntime` 支持四类 memory：

```text
user
feedback
project
reference
```

每类 memory 都有自己的：

```text
readPolicy
writePolicy
contextPriority
requiresFreshnessCheck
```

这让 memory 不再只是“塞进上下文的一段文本”，而是带来源和策略的 Runtime state。

### 3.2 CLAUDE.md Project Memory

fixture 中的 `CLAUDE.md` 被当作 project memory source：

```text
indexProjectMemoryFromClaudeMd()
  -> read CLAUDE.md
  -> route type=project
  -> write body file
  -> update memory-index.json
```

project memory 是 read-only source，不通过 auto memory 随意改写。

### 3.3 Write And Index

`writeMemory()` 会把正文写入：

```text
memory/items/<id>.json
```

同时把索引写入：

```text
memory/memory-index.json
```

index 只保存：

```text
id
type
tags
source
bodyPath
bodyHash
summary
references
```

verify 会确认正文里的 unique phrase 不进入 index，且 index 的 `bodyHash` 和 body file 对应。

### 3.4 Forget

`forgetMemory()` 会：

```text
删除 body file。
从 memory-index.json 移除 entry。
写入 forgetEvent。
把 memory.forgotten 记录到 durable session event。
```

这证明 forget 不是“在提示词里说忘记”，而是对 memory store 和 index 的状态更新。

### 3.5 Stale Verification

reference memory 如果带有：

```text
references: [{ path, symbol }]
```

`recommendMemories()` 在推荐前会调用：

```text
verifyMemoryFreshness()
```

当前验证规则是：

```text
文件必须仍存在。
若声明 symbol，文件正文必须仍包含 symbol。
```

stale memory 会进入 `staleRejected`，不会进入推荐结果。

### 3.6 Compaction Boundary

`buildContextSnapshot()` 会把长期记忆和压缩摘要放在不同 block：

```text
long_term_memory
compact_summary
```

并明确：

```text
memoryMixedWithCompactSummary=false
```

这说明 memory 不是 Core 19 compact summary 的替代品，也不能靠长期记忆覆盖当前任务状态。

### 3.7 No Code-Structure Memory

Core 29 拒绝把模型推断出的代码结构事实写入长期 memory。

例如：

```text
The paginate function is defined in src/pagination.cjs and exports paginate.
```

会被拒绝为：

```text
error_type=code_structure_memory_denied
recommendedNextEvent=read_repo_or_update_repo_index
```

代码结构应该来自当前 repo evidence、Read/Search 或 Core 25 repo index，而不是长期记忆。

---

## 4. 验证点

`npm run core:29:verify` 覆盖 9 个 case：

```text
1. core29: memory source demo runs and verifies
2. validation matrix: Core 29 does not duplicate Course 08/09 or Core 18/19/24
3. memory type routing: user feedback project and reference use distinct policies
4. write and index: memory body and index are separated
5. forget: deleted memory removes body and updates index
6. stale verification: referenced files are checked before recommendation
7. compaction boundary: long-term memory stays separate from compact summary
8. no code-structure memory: repo facts are denied as long-term memory
9. boundary: memory source is local evidence, not official memory product
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| demo | type routing、write/index、forget、stale check、compaction boundary 和 no code-structure policy 可以一起运行 |
| validation matrix | Core 29 不重复 Course 08/09 或 Core 18/19/24 |
| memory type routing | user / feedback / project / reference 有不同策略 |
| write and index | memory body 和 memory index 分离且 hash-linked |
| forget | 删除会更新 body、index 和 forgetEvent |
| stale verification | 引用文件/符号的 memory 推荐前必须重新检查 |
| compaction boundary | long-term memory 不和 compactSummary 混淆 |
| no code-structure memory | 代码结构事实不能写长期 memory |
| boundary | 本 Core 是本地确定性证据，不是官方 memory 产品 |

---

## 5. 做完本 Core 后得到什么

做完 Core 29 后，Product Surface Study 得到第三个可验证 Core：

```text
Memory Source / CLAUDE.md / Auto Memory 可以作为 Context / Compaction / Session 之间的治理层。
```

现在链路可以表达为：

```text
CLAUDE.md / user preference / feedback / reference
  -> memory type routing
  -> memory body + memory index
  -> forget / freshness check
  -> long_term_memory context block
```

这让后续 Checkpoint / Rewind、Subagent Context Isolation 等 Product Surface Core 可以复用同一条原则：

```text
产品表层不是提示词文案，必须落到 Runtime state、enforced boundary 和 verify evidence。
```

---

## 6. 边界

Core 29 证明的是：

```text
本地 deterministic memory source 可以路由 memory type、写入正文和索引、执行 forget、在推荐前验证 stale reference、和 compact summary 分开，并拒绝代码结构 memory。
```

它不证明：

```text
真实 Claude Code memory 文件格式。
真实 Claude Code memory / CLAUDE.md / auto memory 内部实现。
远端多用户 memory 服务。
隐私合规系统。
完整代码智能数据库。
生产级 memory 产品。
```
