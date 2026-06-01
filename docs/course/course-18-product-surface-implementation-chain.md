# Course 18 产品表层实现链（Product Surface Implementation Chain）：从 Core 27 到 Core 31 学产品表层如何落成运行时边界（Runtime Boundary）

> 本课对应 Core 27、Core 28、Core 29、Core 30、Core 31。
>
> `course-14` 到 `course-17` 已经把 Core 18-26 讲成生产化证据链：
>
> ```text
> Context / Compaction / Plan
>   -> Long-Running Eval / ToolRuntime / ModelGateway
>   -> Durable Session / Repo Intelligence / Human Approval
> ```
>
> 本课接在这条链之后，回答一个更容易混淆的问题：
>
> ```text
> 从 Claude Code 产品表层看到的设置、钩子、记忆、检查点、子代理（settings / hooks / memory / checkpoint / subagent），
> 如何不变成提示词摘抄或功能清单，
> 而是转译成本项目自己的运行时对象（Runtime object）、状态（state）、边界（boundary）和验证证据（verify evidence）？
> ```
>
> 本课不复制 Claude Code 提示词（prompt）原文、源码映射（source map）原文或反编译源码片段。所有机制都以本项目自己的对象模型、实现和验证脚本为准。

---

## 0. 本课跟踪哪五条执行链

Core 27-31 不是五个孤立 UI 功能，而是产品表层学习（Product Surface Study）当前候选池 A-E 的实现收口。

```text
Core 27 Settings / Permission Resolver:
  settings / permission rules 如何在工具执行前解析为 allow / ask / deny？

Core 28 Hooks Lifecycle:
  user / pre tool / post tool hook 如何进入可审计 Runtime lifecycle？

Core 29 Memory Source / CLAUDE.md / Auto Memory:
  长期记忆如何变成可治理、可删除、可重新验证的 context source？

Core 30 Checkpoint / Rewind:
  用户可见恢复点如何绑定文件 hash、session event、外部改动检查和 audit replay？

Core 31 Subagent Context Isolation:
  子代理委派如何变成隔离上下文、结构化回传、去重 ledger 和 replayable audit？
```

五条主线：

```text
主线 A：Permission Resolver
  验证用例（verify case）
    -> SettingsPermissionResolver
    -> permissionConfig / resolverTrace / ruleSource / decisionCache
    -> allow / ask / deny
    -> no hidden execution

主线 B：Hooks Lifecycle
  验证用例（verify case）
    -> HooksLifecycleRuntime
    -> hookRegistry / hookEvent / hookDecision / hookFeedback
    -> block / observation / constraint / redaction
    -> 不升级系统提示词（no system prompt promotion）

主线 C：Memory Source
  验证用例（verify case）
    -> MemorySourceRuntime
    -> memoryType / memoryStore / memoryIndex / forgetEvent
    -> freshness check / long_term_memory block
    -> no code-structure memory

主线 D：Checkpoint Rewind
  验证用例（verify case）
    -> CheckpointRewindRuntime
    -> checkpoint / fileStateSnapshot / rewindRequest
    -> externalChangeConflict / restoredSessionState
    -> rewindAudit / append-only event boundary

主线 E：Subagent Context Isolation
  验证用例（verify case）
    -> SubagentContextIsolationRuntime
    -> delegatedTask / subagentContext / subagentResult
    -> delegationLedger / parent receipt
    -> isolationAudit
```

一句话：

```text
产品表层（Product Surface）的教学重点不是“产品里有这些名字”，而是这些名字是否落成新的运行时状态（Runtime state）、强制边界和可运行验证。
```

---

## 1. 先运行什么

```bash
npm run core:27:verify
npm run core:28:verify
npm run core:29:verify
npm run core:30:verify
npm run core:31:verify
```

然后读：

```text
docs/roadmap/product-surface-study-roadmap.md
docs/roadmap/product-surface-validation-matrix.md
docs/roadmap/product-surface-core-candidates.md

docs/core/core-27-settings-permission-resolver.md
docs/core/core-28-hooks-lifecycle.md
docs/core/core-29-memory-source-auto-memory.md
docs/core/core-30-checkpoint-rewind.md
docs/core/core-31-subagent-context-isolation.md

src/core/settings-permission-resolver.verify.mjs
src/core/hooks-lifecycle.verify.mjs
src/core/memory-source-auto-memory.verify.mjs
src/core/checkpoint-rewind.verify.mjs
src/core/subagent-context-isolation.verify.mjs
```

读法仍然和 `course-15` 到 `course-17` 一样：

```text
先看验证用例（verify case）名字。
再看它构造了什么 fixture。
再看哪个运行时对象（Runtime object）被调用。
再看返回报告里的状态（state）字段。
最后看断言防止了哪类能力误判。
```

---

## 2. 为什么先有 roadmap / matrix / mini brief

产品表层学习（Product Surface Study）有一个关键风险：

```text
看到产品表层材料后，直接新增一串 Core。
```

本项目不这样做。Core 27-31 都先经过三层判断：

```text
Roadmap:
  这个主题先补旧课，还是可能独立成 Core？

Validation Matrix:
  它有没有 evidence tier、same-topic merge、runtime boundary、verify shape、public boundary 和 out-of-scope？

Mini Brief:
  它补哪个已有主题？
  为什么不能只补旧文档？
  新增运行时状态（Runtime state）是什么？
  新增强制边界（enforced boundary）是什么？
  最小测试夹具（fixture）和验证用例（verify case）是什么？
```

这一步是教学的一部分。它防止学习者把：

```text
settings
hooks
memory
checkpoint
subagent
```

误解成：

```text
把产品文案写进 prompt。
复制第三方提取原文。
把 UI 名称当成 Runtime 能力。
```

本课只讲已经通过候选评审并落地 verify 的五个 Core。

---

## 3. Core 27：Settings / Permission Resolver

Core 27 接在 Core 22 和 Core 26 之间。

```text
Core 22 已经证明 ToolRuntime 可以 preview / commit / rollback。
Core 26 已经证明 ask 之后的人类 approve / reject / interrupt / handoff 可以进入 Runtime 状态。
Core 27 补的是更前面的决策：为什么这个 action 是 allow、ask 或 deny？
```

### 3.1 config precedence 证明什么

对应 case：

```text
config precedence: policy/local/project/user rules are explainable
```

实现对象：

```text
SettingsPermissionResolver
```

输入是四层配置：

```text
user
project
local
policy
```

本项目定义的优先级是：

```text
policy > local > project > user
```

verify 检查：

```text
最高优先级规则胜出。
低优先级命中进入 shadowedMatches。
ruleSource 能解释到底是哪层规则生效。
resolverTrace 能解释解析过程。
```

这个 case 防止的误解：

```text
permission 不是一句“高风险要问用户”。
它必须能解释配置来源和优先级。
```

### 3.2 allow / ask / deny 证明什么

对应 case：

```text
allow ask deny: one resolver feeds execute, approval, and refusal paths
```

三种输出：

```text
allow -> 允许进入 mock tool execution。
ask -> 只生成 approval_required bridge，交给 Core 26。
deny -> 结构化拒绝，不执行工具。
```

边界：

```text
Core 27 只决定 action permission。
Core 22 负责 transaction。
Core 26 负责人类批准或拒绝。
```

### 3.3 prefix command / no hidden execution / decision cache 证明什么

Core 27 还钉住三个容易出错的边界：

```text
prefix command rule:
  npm test 可以匹配 npm test -- --runInBand。
  npm testing 和 npm test:unit 不能被外推。

no hidden execution:
  ask / deny 之前 providerCalls delta 和 toolExecutions delta 都必须是 0。

decision cache:
  第二次解析可以 fromCache=true，但不能丢 ruleSource 或 matchedRule。
```

一句话：

```text
Permission Resolver 是工具执行前的 deterministic local decision layer，不是 enterprise policy 产品，也不是 GUI permission prompt。
```

---

## 4. Core 28：Hooks Lifecycle

Core 28 接在 Core 24、Core 26、Core 27 之后。

```text
Core 24 能保存和 replay session event。
Core 26 能处理 human approval event。
Core 27 能在工具执行前解析 permission decision。
Core 28 补的是 hooks 如何作为 lifecycle event 进入 Runtime。
```

### 4.1 userPromptSubmit hook 证明什么

对应 case：

```text
用户提示钩子（user prompt hook）：约束进入运行时状态（runtime state），不是系统提示词（system prompt）
```

输入：

```text
用户提交 prompt。
hook 从中提取可执行约束。
```

Runtime 更新：

```text
constraint.added
contextSnapshot.constraints
```

不能更新：

```text
systemMessages
```

这个 case 防止的误解：

```text
钩子反馈（hook feedback）不是更高优先级系统提示词（system prompt）。
它是受限 Runtime State 或 observation。
```

### 4.2 preToolUse hook 证明什么

对应 case：

```text
pre tool hook: block prevents tool execution and enters event log
```

流程：

```text
action
  -> Core 27 permission resolver
  -> preToolUse hook
  -> tool execution or hook block
```

如果 hook 返回 block：

```text
写入 hook.pre_tool.blocked。
写入 tool.blocked_by_hook。
toolExecutions delta = 0。
```

### 4.3 postToolUse / hook failure / secret boundary 证明什么

Core 28 还钉住三条边界：

```text
postToolUse:
  工具后反馈进入 dynamicObservations，不升级为 system。

hook failure:
  hook 抛错会结构化为 hook_failed，不能绕过原 permission deny。

secret boundary:
  hook output 写入 session event 前必须 redaction，并通过 secret scan。
```

一句话：

```text
Hooks Lifecycle 是外部反馈进入 Runtime 的可审计生命周期，不是任意用户脚本 sandbox，也不是插件系统复刻。
```

---

## 5. Core 29：Memory Source / CLAUDE.md / Auto Memory

Core 29 接回 Course 08、Course 09、Core 18、Core 19、Core 24。

```text
Course 08 负责 ModelRequest / Context Engine 装配。
Course 09 和 Core 19 负责 compaction 是否保真。
Core 18 负责 context economy。
Core 24 负责 durable session event。
Core 29 补的是长期 memory source 自己的治理边界。
```

### 5.1 memory type routing 证明什么

对应 case：

```text
memory type routing: user feedback project and reference use distinct policies
```

Core 29 支持四类 memory：

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

这说明记忆（memory）不是“长一点的摘要”，而是带类型和策略的运行时状态（Runtime state）。

### 5.2 CLAUDE.md / write and index / forget 证明什么

Core 29 把 `CLAUDE.md` 当作 project memory source：

```text
CLAUDE.md
  -> route type=project
  -> write body file
  -> update memory-index.json
```

正文和索引分离：

```text
memory/items/<id>.json      保存正文。
memory/memory-index.json    保存 summary、bodyPath、bodyHash、references。
```

forget 不是提示词承诺：

```text
删除 body file。
移除 index entry。
写入 forgetEvent。
写入 memory.forgotten session event。
```

### 5.3 stale verification / compaction boundary / no code-structure memory 证明什么

三条关键边界：

```text
stale verification:
  reference memory 提到的 path / symbol 推荐前必须重新检查。

compaction boundary:
  long_term_memory block 和 compact_summary block 分开。

no code-structure memory:
  函数定义、导出位置、文件结构这类事实不能写长期 memory。
  应回到 Read/Search 或 Core 25 repo evidence。
```

一句话：

```text
Memory Source 是长期上下文来源治理，不是 compact summary，不是 repo index，也不是官方 memory 文件格式复刻。
```

---

## 6. Core 30：Checkpoint / Rewind

Core 30 接在 Core 22 和 Core 24 之间。

```text
Core 22 证明 transaction 可以 preview / commit / rollback。
Core 24 证明 session event 可以 append-only、snapshot、replay。
Core 30 补的是用户可见恢复点如何绑定文件状态和 replay 状态。
```

### 6.1 checkpoint creation 证明什么

对应 case：

```text
checkpoint creation: checkpoint binds file hashes session event and durable snapshot
```

checkpoint 记录：

```text
checkpoint id / label / reason
session replay through seq
replay state hash
fileStateSnapshot
checkpoint.created event seq / hash
durable snapshot id
```

`fileStateSnapshot` 至少包含：

```text
path
exists
text
hash
bytes
```

所以 checkpoint 不是聊天里的“我记住了”，而是可验证状态。

### 6.2 rewind state 证明什么

对应 case：

```text
rewind state: files and replay state return to target checkpoint
```

流程：

```text
requestRewind({
  targetCheckpointId,
  fromCheckpointId
})
```

如果当前文件仍匹配 source checkpoint：

```text
恢复目标 checkpoint 的文件正文。
返回 target replay state。
追加 rewind.requested / rewind.applied events。
生成 rewindAudit。
```

### 6.3 external change conflict / audit / event log boundary 证明什么

Core 30 的安全边界：

```text
externalChangeConflict:
  如果 source checkpoint 后用户外部改了文件，rewind 被拒绝，不恢复任何文件。

audit replay:
  可以解释 source checkpoint、target checkpoint、restored files 和 replay seq。

event log boundary:
  rewind 只追加新事件，不截断或改写 Core 22 / Core 24 的旧证据。
```

一句话：

```text
Checkpoint / Rewind 是用户可见恢复层，不是 IDE rewind UI，也不是分布式 session store。
```

---

## 7. Core 31：Subagent Context Isolation

Core 31 接回 Core 21、Core 24、Core 25。

```text
Core 21 证明长任务可以评估多轮修复、失败和 no false final。
Core 24 证明 session event 可以 replay。
Core 25 证明 repo map、symbol/test/rule index 和 relevance scoring。
Core 31 补的是子代理委派的上下文隔离和结果契约。
```

### 7.1 delegated task 证明什么

对应 case：

```text
independent task: two delegated tasks run in one parallel group
```

父代理请求先转成：

```text
delegatedTask
```

字段包括：

```text
id / type / objective / query
allowedPaths / forbiddenPaths
contextBudget / maxContextFiles
expectedResultShape
parallelGroupId
```

这说明 subagent 不是一句“去搜索”，而是结构化委派任务。

### 7.2 context isolation 证明什么

对应 case：

```text
context isolation: subagent sees only task-specific files
```

`buildSubagentContext()` 使用 Core 25 repo index，但只选择 `allowedPaths`。

context 明确记录：

```text
includedParentBlocks
excludedParentBlocks
rawParentMessagesIncluded=false
rawSubagentTranscriptReturned=false
```

这个 case 防止的误解：

```text
子代理不应该默认看到完整父上下文。
隔离必须由 context builder 执行，而不是靠 prompt 口头提醒。
```

### 7.3 ledger / result contract / failure / audit 证明什么

四条边界：

```text
no duplicate research:
  delegationLedger 按 task signature 复用结果。

result contract:
  parent 只接收 summary、evidenceRefs、contextDigestHash。

failure propagation:
  失败结构化回传 reason 和 retryHint，不伪装成成功。

isolation audit:
  session events 能 replay delegation.started、subagent.result_received、delegation.completed 和 ledger entry。
```

一句话：

```text
Subagent Context Isolation 是委派边界，不是多进程 agent 调度、远端 worker 隔离或 agent marketplace。
```

---

## 8. 五条链如何接成产品表层执行链（Product Surface execution-chain）

本课的“chain”不是说每个用户请求都按同一个函数栈固定调用五个 Core。更准确的理解是：

```text
产品表层材料（Product Surface material）
  -> roadmap / validation matrix / mini brief
  -> 本项目自己的运行时对象（Runtime object）
  -> 状态字段（state field）
  -> 强制边界（enforced boundary）
  -> 验证证据（verify evidence）
  -> 范围外边界（out-of-scope boundary）
```

当它们进入一次 Claude Code-like 任务时，可以这样组合理解：

```text
CLAUDE.md / memory source
  -> Core 29 memory routing / freshness check
  -> Course 08 / Core 18 context assembly

user prompt / tool action
  -> Core 28 userPromptSubmit hook if present
  -> Core 27 permission resolver
  -> Core 28 preToolUse hook
  -> Core 22 transaction or Core 26 approval path
  -> Core 28 postToolUse hook observation

transaction / session progress
  -> Core 30 checkpoint creation
  -> Core 24 append-only session event
  -> Core 30 rewind request / audit if needed

research delegation
  -> Core 31 delegatedTask
  -> Core 25 repo intelligence input
  -> isolated subagentContext
  -> structured subagentResult
  -> Core 24 replayable session evidence
```

因此学习者要避免两个极端：

```text
不要把五个 Core 当成 UI 功能介绍。
也不要把五个 Core 强行合并成一个巨型产品表层运行时（Product Surface Runtime）。
```

每个 Core 独立的原因，仍然以：

```text
新增运行时状态（Runtime state）
新增强制边界（enforced boundary）
新增测试夹具（fixture）
新增验证用例（verify case）
清楚不在当前范围（out-of-scope）
```

为准。

---

## 9. Knowledge Provenance

| 判断 / 信息 | 来源 | 怎么进入系统 | 目标 | 如果没有 |
| --- | --- | --- | --- | --- |
| 产品表层（Product Surface）主题是否独立 | roadmap / validation matrix / mini brief | 课程和 Core 前置评审 | 防止看到产品名就新增 Core | 课程体系变成功能清单 |
| permissionConfig | user / project / local / policy fixture | SettingsPermissionResolver input | 解析 allow / ask / deny | 高风险动作只能靠模型自觉 |
| ruleSource / resolverTrace | resolver evaluation | decision report | 解释哪条规则生效 | 决策不可审计 |
| decisionCache | repeated action signature | resolver cache report | 证明缓存不丢来源 | 性能优化可能破坏可解释性 |
| hookRegistry | local fixture hooks | HooksLifecycleRuntime | 模拟 user/pre/post lifecycle | 外部反馈无法进入 Runtime |
| hookDecision | hook result | session event / tool block | 阻断或允许后续执行 | hook 只能停留在聊天里 |
| redactedHookOutput | hook output + redaction | durable event payload | 防止 secret 落盘 | 证据可能泄漏 token |
| memoryType | user / feedback / project / reference candidate | MemorySourceRuntime routing | 区分读写策略和 freshness | 长期记忆和项目规则混淆 |
| CLAUDE.md project memory | fixture project file | memory body + index | 作为项目规则来源 | 项目约定只能靠当前聊天记忆 |
| memoryIndex | memory store | memory-index.json | 查找、hash-link 和删除 memory | forget 无法证明 |
| memoryFreshnessCheck | referenced path / symbol | recommendation trace | 防止 stale memory 当事实 | 过期文件/函数误导模型 |
| checkpoint | file hash + session event | checkpoint.created event | 建立用户可见恢复点 | rewind 只有口头承诺 |
| externalChangeConflict | current file hash vs source snapshot | rewind safety result | 防止覆盖用户外部修改 | 恢复可能破坏用户改动 |
| rewindAudit | source / target / restored files / seq | audit replay report | 解释从哪里回到哪里 | 恢复不可复盘 |
| delegatedTask | parent request | SubagentContextIsolationRuntime | 明确研究目标和边界 | 子代理只是模糊搜索提示 |
| subagentContext | allowed paths + repo index | isolated context snapshot | 限制子代理可见材料 | 父上下文泄漏或误用旧约束 |
| delegationLedger | task signature | ledger entry | 阻止重复研究 | 主代理重复花 token 做同一研究 |
| subagentResult | structured result contract | parent receipt | 只回传摘要和证据 | raw transcript 淹没主上下文 |

---

## 10. Action Claim Contract

### 10.1 Permission Resolver 可以替代 Human Approval 吗

```text
Action:
  把 ask decision 直接当成 approve。

当前状态:
  Core 27 resolver 返回 ask。

合理性判断:
  不合理。

来源:
  Core 27 allow / ask / deny boundary。
  Core 26 Human Approval Protocol。

硬约束:
  ask 只能桥接 approval_required，不能等同于 approve。

如果做错会怎样:
  工具会在用户批准前隐藏执行，破坏 no hidden execution。
```

### 10.2 钩子反馈（Hook feedback）可以升级成系统提示词（system prompt）吗

```text
Action:
  把 postToolUse message 放入 system segment。

当前状态:
  hook 返回工具后反馈。

合理性判断:
  不合理。

来源:
  Core 28 post tool hook case。
  Course 08 segment precedence。

硬约束:
  钩子反馈（hook feedback）进入动态观察（dynamic observation），不升级为系统提示词（system prompt）。

如果做错会怎样:
  外部反馈获得过高优先级，可能覆盖安全边界。
```

### 10.3 Memory 可以替代 repo evidence 吗

```text
Action:
  把“函数定义在某文件”写入长期 memory，并据此修改代码。

当前状态:
  memory candidate 是代码结构事实。

合理性判断:
  不合理。

来源:
  Core 29 no code-structure memory。
  Core 25 repo intelligence。

硬约束:
  代码结构事实必须回到 Read/Search 或 repo index。

如果做错会怎样:
  stale memory 会让模型修改错误文件或错误符号。
```

### 10.4 Rewind 可以覆盖用户外部改动吗

```text
Action:
  source checkpoint 后文件 hash 已变，仍强制恢复旧 checkpoint。

当前状态:
  externalChangeConflict 已产生。

合理性判断:
  硬不合理。

来源:
  Core 30 partial rewind denial case。

硬约束:
  外部改动冲突时 filesRestored 必须为空。

如果做错会怎样:
  用户在 checkpoint 后的真实工作会被覆盖。
```

### 10.5 Subagent 可以拿完整父上下文吗

```text
Action:
  把 raw parent messages 全量传给 subagent。

当前状态:
  delegatedTask 已声明 allowedPaths / forbiddenPaths。

合理性判断:
  不合理。

来源:
  Core 31 context isolation case。

硬约束:
  subagentContext 只包含 task-specific context。

如果做错会怎样:
  子代理泄漏无关约束，结果也可能把 raw transcript 回灌主上下文。
```

---

## 11. 学习者应该亲手改哪里

### 11.1 让 low priority permission 覆盖 policy

文件：

```text
src/core/settings-permission-resolver.mjs
```

临时把优先级改成：

```text
user > project > local > policy
```

再运行：

```bash
npm run core:27:verify
```

应该看到 config precedence 或 deny 相关 case 失败。这个练习证明 permission 不是随便合并配置，而是有可验证优先级。

### 11.2 让 hook feedback 进入 systemMessages

文件：

```text
src/core/hooks-lifecycle.mjs
```

临时把 post hook feedback 放进 system-like 字段。

再运行：

```bash
npm run core:28:verify
```

应该看到工具后钩子（post tool hook）或用户提示钩子（user prompt hook）的边界失败。这个练习证明钩子（hooks）不是系统提示词（system prompt）注入通道。

### 11.3 允许代码结构事实写入 memory

文件：

```text
src/core/memory-source-auto-memory.mjs
```

临时移除 code-structure memory denial。

再运行：

```bash
npm run core:29:verify
```

应该看到 no code-structure memory case 失败。这个练习证明 memory 不能替代 repo evidence。

### 11.4 跳过 external change conflict

文件：

```text
src/core/checkpoint-rewind.mjs
```

临时让 rewind 不检查 source checkpoint 后的文件 hash。

再运行：

```bash
npm run core:30:verify
```

应该看到 partial rewind denial 失败。这个练习证明 rewind 不是只要能恢复就可以，必须先保护用户外部改动。

### 11.5 把 raw parent messages 传给 subagent

文件：

```text
src/core/subagent-context-isolation.mjs
```

临时把完整 parent context 加进 subagentContext。

再运行：

```bash
npm run core:31:verify
```

应该看到 context isolation 或 result contract 失败。这个练习证明 subagent 的核心是隔离上下文和结构化回传。

---

## 12. 本课最终要能回答的问题

读完本课后，学习者应该能回答：

1. 产品表层学习（Product Surface Study）为什么必须先有路线图（roadmap）、验证矩阵（validation matrix）和 mini brief？
2. Core 27 为什么不等于 Core 26 Human Approval？
3. `ask` 和 `approve` 的差别在哪里？
4. 钩子反馈（hook feedback）为什么不能升级成系统提示词（system prompt）？
5. hook failure 为什么不能绕过 permission deny？
6. Memory 和 compact summary 的生命周期差别是什么？
7. 为什么 `CLAUDE.md` 可以作为 project memory source，但 auto memory 不能随意改写它？
8. 为什么代码结构事实不能写入长期 memory？
9. checkpoint 为什么必须绑定文件 hash 和 session event？
10. rewind 为什么必须拒绝覆盖外部用户改动？
11. subagent 为什么不是普通搜索提示词？
12. subagentContext 为什么只能包含 task-specific context？
13. parent receipt 为什么只接收 summary、evidenceRefs 和 digest，而不是 raw transcript？
14. Core 27-31 分别不证明哪些生产级能力？
15. 未来新增产品表层核心阶段（Product Surface Core）前，必须先补哪些评审材料？

---

## 13. 能力边界

Core 27-31 已经证明的是：

```text
本项目自己的 deterministic local evidence 可以覆盖：
  settings / permission resolver
  hooks lifecycle
  memory source governance
  checkpoint / rewind recovery boundary
  subagent context isolation
```

不能声称：

```text
Claude Code 官方 Settings / Hooks / Memory / Checkpoint / Subagent 内部实现。
Claude Code 提示词（prompt）原文、源码映射（source map）原文或反编译源码复刻。
完整 enterprise policy 产品。
任意用户脚本安全 sandbox。
真实远端多用户 memory 服务。
完整 IDE rewind UI。
跨机器分布式 session store。
真实多进程 agent 调度。
agent marketplace。
生产级 Claude Code 70%-80% 能力。
```

公开表达时只能说：

```text
本项目学习 Claude Code-like 产品表层机制，并把它们转译成自己的 Runtime 对象模型、实现和 verify。
```

不能说：

```text
本项目复刻了 Claude Code 官方源码、官方系统提示词或官方内部实现。
```
