# Product Surface Core Candidates：候选 Core Mini Brief

本文对应 `product-surface-study-roadmap.md` 和 `product-surface-validation-matrix.md`。

它的作用不是宣布 Core 27-31 已经立项，而是先做独立性评审：

```text
哪些主题只补旧课？
哪些主题确实有新的 Runtime 状态、强制边界和 verify shape？
```

结论先行：

```text
当前只有 Settings / Permission Resolver、Hooks Lifecycle、Memory Source、Subagent Context Isolation、Checkpoint / Rewind 进入候选池。
Prompt Assembly、Tool Surface、Output Style、Fast Mode、MCP、Cron 暂不独立成 Core。
```

---

## 1. Candidate A：Settings / Permission Resolver

```text
Topic: Settings / Permission Resolver
Existing course/core to extend: Course 16, Course 17, Core 22, Core 26
Why not only extend existing docs: 现有 Core 22/26 有 protected/high-risk 审批，但还没有 user/project/local/policy 配置优先级，也没有 allow/ask/deny resolver。
Evidence tier: A 官方 settings/permissions 文档；B 产品工件观察；D 未来本项目 verify。
New runtime state: permissionConfig, resolverTrace, ruleSource, decisionCache.
New enforced boundary: 工具执行前必须由 resolver 输出 allow / ask / deny，ask/deny 前不能执行。
Minimal fixture: 一个 fixture repo，含 user config、project config、local config、policy config 和多条 Bash/Edit action。
Minimal verify cases:
  - config precedence
  - allow ask deny
  - prefix command rule
  - no hidden execution before ask/deny
Out of scope:
  - 完整企业 policy 产品
  - 真实 Claude Code 权限实现复刻
  - GUI 权限弹窗
Public-safe wording: 学习 Claude Code-like 权限配置分层，构建本项目自己的 Permission Resolver。
```

初步判断：

```text
可以独立成 Core 候选。
```

实现状态：

```text
已作为 Core 27 Settings / Permission Resolver 实现，并通过 npm run core:27:verify。
Core 27 只解析 allow / ask / deny，不重复 Core 22 transaction 或 Core 26 approval decision。
```

---

## 2. Candidate B：Hooks Lifecycle

```text
Topic: Hooks Lifecycle
Existing course/core to extend: Course 16, Course 17, Core 21, Core 24, Core 26
Why not only extend existing docs: hooks 会在工具执行前后、用户输入后改变运行事实；它不只是提示词规则，而是外部事件进入 Runtime 的生命周期。
Evidence tier: A 官方 hooks 文档；B 产品工件观察；D 未来本项目 verify。
New runtime state: hookRegistry, hookEvent, hookDecision, hookFeedback, redactedHookOutput.
New enforced boundary: pre hook 可以阻断工具执行；hook 输出只能作为受限 observation，不升级为 system prompt；hook 输出写入 session 前必须脱敏。
Minimal fixture: 一个本地 hook registry，模拟 preToolUse block、postToolUse feedback、userPrompt hook constraint、hook failure。
Minimal verify cases:
  - pre tool hook blocks execution
  - post tool hook enters next context as observation
  - user prompt hook adds constraint
  - hook failure is structured
  - secret boundary redacts hook output
Out of scope:
  - 真实 shell hook 产品
  - 任意用户脚本安全沙箱
  - 完整插件系统
Public-safe wording: 学习 hooks 作为 Runtime lifecycle event 的机制，不复制 Claude Code hook 实现。
```

初步判断：

```text
可以独立成 Core 候选。
```

实现状态：

```text
已作为 Core 28 Hooks Lifecycle 实现，并通过 npm run core:28:verify。
Core 28 只处理 hook lifecycle event、阻断、反馈、失败和脱敏，不重复 Core 24 durable store 或 Core 26 approval decision。
```

---

## 3. Candidate C：Memory Source / CLAUDE.md / Auto Memory

```text
Topic: Memory Source / CLAUDE.md / Auto Memory
Existing course/core to extend: Course 08, Course 09, Course 15, Core 18, Core 19, Core 24
Why not only extend existing docs: 现有 Context / Compaction 能选择和压缩信息，但还没有长期记忆的类型、写入、索引、删除、过时校验和“不存代码结构”边界。
Evidence tier: A 官方 memory / CLAUDE.md 文档；B 产品工件观察；D 未来本项目 verify。
New runtime state: memoryStore, memoryIndex, memoryType, memoryFreshnessCheck, forgetEvent.
New enforced boundary: 代码结构类信息不能写长期 memory；memory 引用文件/函数时必须重新验证；用户要求 forget 时必须删除并更新索引。
Minimal fixture: memory directory + MEMORY index + fixture repo，包含 user/feedback/project/reference 四类记忆和过时文件引用。
Minimal verify cases:
  - memory type routing
  - write and index
  - forget
  - stale verification before recommendation
  - compaction boundary
  - no code-structure memory
Out of scope:
  - 真实 Claude Code memory 文件格式复刻
  - 多用户远端记忆服务
  - 隐私合规系统
Public-safe wording: 学习长期记忆作为上下文来源和状态治理机制，使用本项目自己的文件格式和验证。
```

初步判断：

```text
可以独立成 Core 候选，但必须先补 Course 09 的 Memory / Compaction 边界。
```

实现状态：

```text
已作为 Core 29 Memory Source / CLAUDE.md / Auto Memory 实现，并通过 npm run core:29:verify。
Core 29 只处理长期记忆的类型路由、写入/索引、forget、stale verification、compaction boundary 和 no code-structure memory policy，不重复 Course 08/09 或 Core 18/19/24。
```

---

## 4. Candidate D：Subagent Context Isolation

```text
Topic: Subagent Context Isolation
Existing course/core to extend: Course 16, Course 17, Core 21, Core 25, Core 24
Why not only extend existing docs: 子代理不是普通搜索；它有独立任务、独立上下文、结构化结果回传和 no duplicate research 约束。
Evidence tier: A 官方 subagent / SDK 文档；B 产品工件观察；D 未来本项目 verify。
New runtime state: delegatedTask, subagentContext, subagentResult, delegationLedger.
New enforced boundary: 子代理只拿任务相关上下文；主代理接收结构化摘要和证据，不重复做同一研究；失败结构化回传。
Minimal fixture: 一个 repo 研究任务和两个独立子任务，分别需要文件搜索和测试关联分析。
Minimal verify cases:
  - independent task can run in parallel
  - context isolation
  - no duplicate research
  - result contract
  - failure propagation
Out of scope:
  - 真实多进程 agent 调度
  - 任意长任务并行系统
  - 完整 agent marketplace
Public-safe wording: 学习子代理的上下文隔离和结果回传契约，不复刻 Claude Code 内部调度。
```

初步判断：

```text
可以独立成 Core 候选，但要避免和 Repo Intelligence / Long-Running Eval 重叠。
```

实现状态：

```text
已作为 Core 31 Subagent Context Isolation 实现，并通过 npm run core:31:verify。
Core 31 只处理 delegatedTask、subagentContext、subagentResult、delegationLedger、isolationAudit、context isolation、no duplicate research 和 result contract，不重复 Core 21 long-running eval、Core 24 durable store 或 Core 25 repo intelligence。
```

---

## 5. Candidate E：Checkpoint / Rewind

```text
Topic: Checkpoint / Rewind
Existing course/core to extend: Course 17, Core 22, Core 24
Why not only extend existing docs: Core 24 已有 replay，Core 22 已有 transaction；但用户可见 checkpoint / rewind 需要把 session state、file hash、外部改动检测和恢复审计合起来。
Evidence tier: A 官方 checkpoint/rewind 相关文档或 CLI 行为；B 产品工件观察；D 未来本项目 verify。
New runtime state: checkpoint, rewindRequest, fileStateSnapshot, externalChangeConflict.
New enforced boundary: rewind 不能覆盖用户在 checkpoint 后的外部修改；恢复必须留下 audit trail。
Minimal fixture: 一个文件修改事务、多个 checkpoint、一次外部修改和一次 rewind request。
Minimal verify cases:
  - checkpoint creation
  - rewind state
  - partial rewind denial
  - audit replay
Out of scope:
  - 完整 IDE UI
  - 跨机器恢复
  - 分布式 session store
Public-safe wording: 学习用户可见恢复点如何连接 Tool Transaction 和 Durable Replay，使用本项目自己的实现。
```

初步判断：

```text
可以独立成 Core 候选。
```

实现状态：

```text
已作为 Core 30 Checkpoint / Rewind 实现，并通过 npm run core:30:verify。
Core 30 只处理用户可见 checkpoint、rewind request、fileStateSnapshot、externalChangeConflict 和 rewindAudit，不重复 Core 22 transaction 或 Core 24 durable replay。
```

---

## 6. 暂不独立的主题

| 主题 | 原因 | 处理 |
| --- | --- | --- |
| Prompt Assembly / Prompt Governance | 当前主要是 Course 03/08 的装配和治理补充；独立前需要先实现 provenance / precedence / injection isolation | 先补旧课 |
| Tool Surface / Slash Command / Skill | 与 ModelGateway tools、Permission、Human Approval 重叠；独立前要证明 command expansion 是新边界 | 暂不独立 |
| Output Style / Information Bandwidth | 属于 Course 00/03 的写作和提示词治理 | 不独立 |
| Fast Mode / model metadata | 属于 ModelGateway provider capability / model selection | 不独立 |
| MCP / External Tool Integration | 范围过大，容易变成 marketplace | 暂缓 |
| Cron / Detached Automation | 涉及异步任务和调度，当前 Product Surface Step A 不做 | 暂缓 |

---

## 7. 推荐顺序

如果要开始实现，推荐优先顺序：

```text
1. Settings / Permission Resolver（已作为 Core 27 实现）
2. Hooks Lifecycle（已作为 Core 28 实现）
3. Memory Source / CLAUDE.md / Auto Memory（已作为 Core 29 实现）
4. Checkpoint / Rewind（已作为 Core 30 实现）
5. Subagent Context Isolation（已作为 Core 31 实现）
```

原因：

```text
Permission Resolver 是 ToolRuntime / Human Approval 的前置层。
Hooks Lifecycle 依赖 Permission / Session，但能快速验证外部事件进入 Runtime。
Memory Source 需要 Context / Compaction / Session 三层稳定后再做。
Checkpoint / Rewind 依赖 Tool Transaction 和 Durable Replay。
Subagent Context Isolation 依赖 Repo Intelligence、Long-Running Eval 和 Session handoff。
```

当前候选池 A-E 已全部完成实现前 validation matrix、Core 文档、src/core 实现和 focused verify。未来新增 Product Surface Core 仍必须先补 mini brief 和实现级 validation matrix，不能从产品表层材料直接跳到实现。
