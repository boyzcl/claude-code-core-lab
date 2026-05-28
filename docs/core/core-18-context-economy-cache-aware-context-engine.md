# Core 18 Context Economy + Cache-Aware Context Engine：让上下文选择变成可解释的经济系统

> 本 Core 接在 `production-upgrade-roadmap.md` 和 `production-upgrade-validation-matrix.md` 的 Core 18 条目之后。
>
> Core 03 已经证明：
>
> ```text
> Context Engine 可以接入 CoreRuntime，
> 让 ModelGateway 收到经过选择、裁剪和 artifact 化的本轮上下文。
> ```
>
> Core 18 验证：
>
> ```text
> Context Engine 不只选择上下文，
> 还可以解释 stable prefix、dynamic tail、token budget、artifact 边界和 cache 命中模拟。
> ```

---

## 1. 本 Core 解决什么问题

Core 03 的 Context Engine 已经能避免把完整 MessageStore 原始历史塞给模型，但它还没有回答这些生产化问题：

```text
哪些内容适合作为可缓存稳定前缀？
哪些内容必须留在每轮动态尾部？
预算不足时到底裁掉了什么，为什么裁？
长工具输出有没有真的 artifact 化，而不是反复进入 selected messages？
连续两轮相同稳定前缀能模拟多少 cached token？
token 节省是不是由 Runtime 机制证明，而不是靠 prompt 文案？
```

Core 18 把这些问题做成可执行输出。

---

## 2. 当前实现位置

代码：

```text
src/core/context-economy.mjs
src/core/context-economy.verify.mjs
```

运行：

```bash
npm run core:18
npm run core:18:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. 核心机制

### 3.1 Stable Prefix

Core 18 把这些 block 放入稳定前缀：

```text
system
tools
project_rules
```

每个 stable block 都有：

```text
id
name
order
hash
tokens
priority
zone=stable_prefix
```

连续两轮 system / tools / project rules 不变时，stable prefix 的顺序、id 和 hash 保持稳定。

### 3.2 Dynamic Tail

这些内容进入动态尾部：

```text
latest_user
active_plan
verification_state
latest_failure
modified_files
compact_summary
read files
tool results
memories
```

动态尾部可以变化，但不会污染 stable prefix。最新用户消息和工具结果都在 `zone=dynamic_tail`。

### 3.3 Token Budget 和 Eviction Report

Core 18 按 priority 选择 blocks：

```text
hard
medium
low
```

小预算下：

```text
active_plan
verification_state
latest_failure
```

作为 hard state 保留。低优先级 memory、旧成功工具输出、部分 medium context 会进入 `evictionReport`，并记录：

```text
id
name
zone
priority
tokens
reason
```

### 3.4 Artifact Boundary

长工具输出不直接反复进入 selected messages。

Core 18 为长输出生成 artifact：

```text
id
source
bytes
tokens
hash
```

上下文 block 只保留 artifact 引用和短 preview。`selectedMessages` 不再包含 raw long output。

### 3.5 Cache Simulation

Core 18 在第二轮输入上一轮 snapshot 后输出：

```text
stablePrefixTokens
cacheHitTokens
cacheMissTokens
uncachedTailTokens
estimatedSavedTokens
```

当前是 deterministic simulation，不声称真实 provider cache billing。

### 3.6 No Prompt-Only Saving

Core 18 的 token economy 由这些机制证明：

```text
block selection
artifact boundary
cache simulation
```

`economyProof.promptOnlySaving=false`。节省不能靠一句“请简洁”来声明。

---

## 4. 验证点

`npm run core:18:verify` 覆盖 8 个 case：

```text
1. core18: context economy demo runs and verifies
2. stable prefix: system, tool, and project blocks keep order id and hash
3. dynamic tail: latest user and tool results stay outside stable prefix
4. token budget: low priority content is evicted and hard state survives
5. cache simulation: second turn reports cache hits and uncached tail
6. artifact boundary: long output is artifacted and not selected raw
7. latest failure: failure, verification state, and active plan survive pressure
8. no prompt-only saving: savings are proven by selection, artifacts, and cache
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| demo | Context Economy report 可以生成并自检 |
| stable prefix | system / tools / project rules 的顺序、id、hash 在多轮保持稳定 |
| dynamic tail | 最新用户消息和工具结果进入动态尾部，不污染 stable prefix |
| token budget | 小预算下 low priority 被裁剪，hard runtime state 保留 |
| cache simulation | 第二轮能解释 cached / uncached token |
| artifact boundary | 长输出 artifact 化，raw long output 不进入 selected messages |
| latest failure | 最新失败、verification state、active plan 在预算压力下仍保留 |
| no prompt-only saving | token 节省由 block selection / artifact / cache simulation 证明 |

---

## 5. 做完本 Core 后得到什么

做完 Core 18 后，项目得到：

```text
一个 cache-aware 的 Context Economy Engine。
```

它能解释每轮 ModelRequest：

```text
哪些 block 入选。
哪些 block 被裁剪。
哪些 token 属于 stable prefix。
哪些 token 属于 dynamic tail。
哪些 stable prefix token 在第二轮模拟 cache hit。
哪些长输出进入 artifact。
节省 token 的证据来自 Runtime 结构，而不是 prompt 文案。
```

这仍然不是：

```text
真实 provider cache billing。
真实 Claude Code context engine。
生产级 Claude Code 能力认证。
跨 agent RelativeScore。
```

---

## 6. 下一步

Core 18 之后进入：

```text
Core 19: Compaction Quality Eval
```

最小动作：

```text
验证 compaction 前后的目标、约束、失败、计划、文件和 pending action 是否机器可对照。
```
