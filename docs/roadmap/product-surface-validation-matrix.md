# Product Surface Validation Matrix：Claude Code 产品表层学习验证矩阵

本文对应 `product-surface-study-roadmap.md`。

它不是实现清单，而是防止新阶段失控的验证先行文档：

```text
先证明主题是否该独立。
再证明材料是否可公开。
最后才证明实现是否成立。
```

---

## 1. 全局验证原则

所有 Product Surface Study 主题都必须先过这六个门：

| Gate | 必须证明 | 失败判定 |
| --- | --- | --- |
| Evidence tier | 材料来自 A/B/C/D 哪一层 | 把第三方提取材料写成官方公开文档 |
| Same-topic merge | 是否能补入已有课程或 Core | 能补旧主题却新建散模块 |
| Runtime boundary | 是否新增状态、权限、工具、会话或上下文边界 | 只是文字规则却声称新 Core |
| Verify shape | 最小可执行验证是什么 | 只有分析，没有可运行检查 |
| Public boundary | 是否避免原文 prompt / 反编译源码进入 repo | 提交可还原提取原文的内容 |
| Out of scope | 是否写清不能证明什么 | 把学习证据说成 Claude Code 官方实现 |

---

## 2. Mini Brief 模板

每个候选主题进入实现前，必须先写 mini brief：

```text
Topic:
Existing course/core to extend:
Why not only extend existing docs:
Evidence tier:
New runtime state:
New enforced boundary:
Minimal fixture:
Minimal verify cases:
Out of scope:
Public-safe wording:
```

判定：

```text
没有 new runtime state 或 new enforced boundary -> 不独立成 Core。
没有 minimal verify cases -> 不进入实现。
public-safe wording 说不清 -> 不进入公开文档。
```

---

## 3. Prompt Assembly / Prompt Governance

先归入：

```text
Course 03
Course 08
Core 08
```

只有满足以下条件才独立：

| Case | 验证方法 | 预期结果 | 证据 |
| --- | --- | --- | --- |
| segment provenance | 构造 system、tool、project、memory、runtime reminder 分段 | 每段都有 source / reason / public-safe flag | assembly report |
| precedence | 同主题规则来自不同来源 | 高优先级规则覆盖低优先级规则 | precedence trace |
| injection isolation | tool result 中放入伪 system instruction | 被标记为 external content，不进入 system segment | safety report |
| no raw extraction | 扫描 docs/src | 不包含提取 prompt 原文或长段相似文本 | secret/public scan |

如果只讲“好提示词怎么写”，不独立成 Core。

---

## 4. Settings / Permission Resolver

先归入：

```text
Core 22
Core 26
```

可独立条件：

| Case | 验证方法 | 预期结果 | 证据 |
| --- | --- | --- | --- |
| config precedence | 构造 user / project / local / policy 四层配置 | 优先级稳定且可解释 | resolver report |
| allow ask deny | 同一工具命中不同规则 | allow 直接执行，ask 进入审批，deny 拒绝 | policy trace |
| prefix command rule | Bash 命令前缀匹配 | 只允许明确前缀，不外推到相似命令 | command decision |
| no hidden execution | ask/deny 前不执行工具 | provider/tool call count 为 0 | trace assertion |

如果只是补充“高风险先问”的教学，不独立。

### 4.1 Core 27 实现级 Validation Matrix

Core 27 已选择 Settings / Permission Resolver 作为第一个 Product Surface Core。它的实现边界是：

```text
Settings / permissions -> PermissionResolver -> allow / ask / deny decision
```

它不负责：

```text
Core 22 的 diff preview / transaction commit / rollback。
Core 26 的 approve / reject / interrupt / handoff。
```

本项目采用自己的对象模型，不复制 prompt 原文、source map 原文或反编译源码片段。

新增 Runtime state：

```text
permissionConfig
resolverTrace
ruleSource
decisionCache
```

配置优先级：

```text
policy > local > project > user
```

这是本项目为了可验证学习而定义的稳定优先级，不声称等同于 Claude Code 官方内部实现。

| Case | Fixture | 预期结果 | 证据 |
| --- | --- | --- | --- |
| config precedence | user / project / local / policy 四层规则同时命中 `git push origin main` | policy deny 胜出，project/user 命中被记录为 shadowedMatches；`node scripts/test.cjs` 由 local allow 胜出 | resolver report、trace、ruleSource、shadowedMatches |
| allow ask deny | local allow 测试命令、project ask `git push`、policy deny `rm -rf` | allow 执行，ask 只桥接到 Core 26 approval_required，deny 直接拒绝 | permission trace、harness counters |
| prefix command rule | `npm test` 前缀规则，对比 `npm test -- --runInBand`、`npm testing`、`npm test:unit` | 只允许明确前缀加参数，不外推到相似命令名 | command decision |
| no hidden execution | ask / deny action 在进入审批或拒绝前 | providerCalls delta=0，toolExecutions delta=0 | trace assertion |
| decision cache | 同一 action 重复解析 | 第二次 fromCache=true，仍保留 ruleSource 和 matchedRule | decisionCache、resolverTrace |
| boundary | boundary object | 不声称 Core 22 transaction、Core 26 approval decision、enterprise policy、GUI permission product 或官方实现 | boundary assertions |

通过条件：

```text
npm run core:27:verify
npm run verify:all
```

---

## 5. Hooks Lifecycle

先归入：

```text
Core 24
Core 26
```

可独立条件：

| Case | 验证方法 | 预期结果 | 证据 |
| --- | --- | --- | --- |
| pre tool hook | 工具执行前 hook 返回 block | 工具不执行，反馈进入 session event | event log |
| post tool hook | 工具执行后 hook 返回 message | 反馈作为用户相关观察进入后续上下文 | context snapshot |
| user prompt hook | 用户提交后 hook 补充约束 | 约束进入 Runtime State，不伪装成 system | state update |
| hook failure | hook 脚本失败 | 结构化失败，不绕过原权限 | hook report |
| secret boundary | hook 输出含 token 样式文本 | 写入前脱敏 | redaction report |

如果只是说明 hooks 存在，不独立。

### 5.1 Core 28 实现级 Validation Matrix

Core 28 已选择 Hooks Lifecycle 作为第二个 Product Surface Core。它的实现边界是：

```text
hook registry -> lifecycle event -> constrained session event / observation / block decision
```

它不负责：

```text
Core 24 的 durable store 新实现。
Core 26 的 approve / reject / interrupt / handoff。
```

本项目采用自己的对象模型，不复制 prompt 原文、source map 原文或反编译源码片段。

新增 Runtime state：

```text
hookRegistry
hookEvent
hookDecision
hookFeedback
redactedHookOutput
```

| Case | Fixture | 预期结果 | 证据 |
| --- | --- | --- | --- |
| pre tool hook | `preToolUse` hook 对 write-mode test command 返回 block | tool 不执行，block feedback 写入 session event | event log、tool execution counter |
| post tool hook | `postToolUse` hook 在允许的 Bash 后返回 message | message 进入下一轮 context 的 dynamic observation，不进入 system | context snapshot |
| user prompt hook | `userPromptSubmit` hook 从用户输入补 public API 约束 | 约束进入 Runtime State，不伪装成 system prompt | state update、context snapshot |
| hook failure | `preToolUse` hook 抛错，同时 permission deny `rm -rf` | hook failure 结构化记录，原 permission deny 不被绕过，tool 不执行 | hook report、permission trace |
| secret boundary | hook output 含 `Bearer` 和 `sk-` 样式文本 | 写入 session event 前脱敏，secret scan 通过 | redaction report、secret scan |
| no hidden execution | blocked / denied action | 没有 allow 且未被 hook block 的 action 才能出现 `tool.executed` | trace assertion |
| boundary | boundary object | 不声称真实 shell hook 产品、任意用户脚本 sandbox、完整 plugin system 或官方实现 | boundary assertions |

通过条件：

```text
npm run core:28:verify
npm run verify:all
```

---

## 6. Memory / CLAUDE.md / Auto Memory

先归入：

```text
Course 08
Course 09
Core 18
Core 19
Core 24
```

可独立条件：

| Case | 验证方法 | 预期结果 | 证据 |
| --- | --- | --- | --- |
| memory type | 构造 user / feedback / project / reference | 不同类型有不同保存和读取规则 | memory report |
| write and index | 保存记忆并更新索引 | 正文和索引分离 | file evidence |
| forget | 用户要求忘记 | 对应记忆删除，索引更新 | deletion report |
| stale verification | 记忆提到文件/函数 | 推荐前重新确认仍存在 | verification trace |
| compaction boundary | 对话压缩后读取长期记忆 | memory 不与 compact summary 混淆 | context report |
| no code-structure memory | 代码结构类信息不写 memory | 被拒绝并建议读 repo | policy result |

如果只是把 CLAUDE.md 当项目规则读入上下文，补 Core 18/25 即可。

### 6.1 Core 29 实现级 Validation Matrix

Core 29 已选择 Memory Source / CLAUDE.md / Auto Memory 作为第三个 Product Surface Core。它的实现边界是：

```text
memory type -> memory store / index -> freshness check -> context source
```

它不负责：

```text
Course 08 的通用 ModelRequest / Context Engine 装配。
Course 09 的 conversation compaction。
Core 18 的 token economy / cache simulation。
Core 19 的 compaction quality scoring。
Core 24 的 durable session store 新实现。
```

本项目采用自己的对象模型，不复制 prompt 原文、source map 原文或反编译源码片段。

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
| memory type routing | user / feedback / project CLAUDE.md / reference 四类 candidate | 每类得到不同 readPolicy、writePolicy、contextPriority 和 freshness 要求 | route report |
| write and index | user-confirmed preference | memory body 写入 `items/*.json`，`memory-index.json` 只保存 summary、hash 和 bodyPath | body file、index |
| forget | 用户要求删除 feedback memory | body 删除，index 移除 entry，并写入 forgetEvent | deletion report |
| stale verification | reference memory 指向缺失文件/符号 | 推荐前重新检查，stale memory 不进入推荐 | freshness trace |
| compaction boundary | compactSummary 和长期 memory 同时存在 | memory block 保持 `long_term_memory`，不混入 compact summary | context snapshot |
| no code-structure memory | candidate 断言函数定义/导出位置 | 拒绝写入 memory，并建议回到 repo evidence | policy result |
| boundary | boundary object | 不声称官方 memory 格式、远端多用户 memory、隐私合规系统、代码智能数据库或官方实现 | boundary assertions |

通过条件：

```text
npm run core:29:verify
npm run verify:all
```

---

## 7. Subagent / Context Isolation

先归入：

```text
Core 21
Core 25
```

可独立条件：

| Case | 验证方法 | 预期结果 | 证据 |
| --- | --- | --- | --- |
| independent task | 两个互不依赖研究任务 | 可并行，结果分别压缩回主上下文 | subagent trace |
| context isolation | 子代理看到的上下文受限 | 不泄漏主上下文无关材料 | context diff |
| no duplicate research | 主代理已委派任务 | 不重复执行同一研究 | task ledger |
| result contract | 子代理返回结构化摘要 | 主代理只接收摘要和证据链接 | handoff report |
| failure propagation | 子代理失败 | 主代理获得结构化失败原因 | failure report |

如果只是“深度搜索时可以用子代理”的提示词规则，不独立。

### 7.1 Core 31 实现级 Validation Matrix

Core 31 已选择 Subagent Context Isolation 作为第五个 Product Surface Core。它的实现边界是：

```text
delegated task -> isolated context -> subagent result -> parent receipt -> delegation ledger
```

它不负责：

```text
Core 21 的 long-running eval / multi-turn repair / cost curve / compaction resume / no false final。
Core 24 的 durable store / append-only hash chain / snapshot / crash recovery。
Core 25 的 repo map / symbol index / test index / relevance scoring / incremental update。
```

本项目采用自己的对象模型，不复制 prompt 原文、source map 原文或反编译源码片段。

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

通过条件：

```text
npm run core:31:verify
npm run verify:all
```

---

## 8. Tool Surface / Slash Command / Skill / Deferred Tool

先归入：

```text
Course 03
Course 08
Core 23
Core 26
```

可独立条件：

| Case | 验证方法 | 预期结果 | 证据 |
| --- | --- | --- | --- |
| deferred tool list | 构造不同任务模式 | 只暴露相关 deferred tools | tool surface report |
| slash command expansion | 输入 `/name` | 展开为已登记 skill，不猜不存在的 skill | command trace |
| permission inheritance | skill 展开后调用工具 | 仍经过原 ToolRuntime / Policy | policy trace |
| unknown command | 输入未登记命令 | 结构化拒绝或请求澄清 | error report |

如果只讲工具名称和提示词，不独立。

---

## 9. Checkpoint / Rewind

先归入：

```text
Core 22
Core 24
```

可独立条件：

| Case | 验证方法 | 预期结果 | 证据 |
| --- | --- | --- | --- |
| checkpoint creation | 写入前后创建 checkpoint | checkpoint 绑定文件 hash 和 session event | checkpoint log |
| rewind state | 回到旧 checkpoint | session state 和文件状态恢复 | state diff |
| partial rewind denial | 有外部用户改动 | 不覆盖用户改动，要求确认 | safety result |
| audit | rewind 后 replay | 能解释从哪一步回到哪一步 | replay report |

如果只是 session replay，不独立。

### 9.1 Core 30 实现级 Validation Matrix

Core 30 已选择 Checkpoint / Rewind 作为第四个 Product Surface Core。它的实现边界是：

```text
checkpoint -> rewind request -> external change check -> file restore + audit replay
```

它不负责：

```text
Core 22 的 diff preview / transaction commit / transaction rollback / stale edit / protected file / Bash risk。
Core 24 的 append-only event log 新实现 / durable snapshot store / crash recovery。
```

本项目采用自己的对象模型，不复制 prompt 原文、source map 原文或反编译源码片段。

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

通过条件：

```text
npm run core:30:verify
npm run verify:all
```

---

## 10. Output Style / Information Bandwidth

先归入：

```text
Course 00
Course 03
README
```

不独立成 Core，除非未来要做输出评测器。

可补充的验证：

| Case | 验证方法 | 预期结果 |
| --- | --- | --- |
| status update shape | 检查课程示例 | 只在阻塞、状态变化、需要用户输入时输出 |
| no filler | 检查 final answer 模板 | 不复述用户问题，不堆过程 |
| code reference format | 检查本地文件引用 | 使用稳定路径和行号 |

---

## 11. 阶段完成定义

Product Surface Study 进入实现前，必须满足：

```text
1. roadmap 和 validation matrix 已登记到 docs/index.md。
2. authority-map 声明本阶段材料的主文档和边界。
3. Course 00 明确 A/B/C/D 证据层级。
4. 每个候选 Core 先有 mini brief。
5. 没有候选主题绕过 same-topic merge gate。
6. git diff --check 通过。
7. 如果新增 verify 脚本或 package 脚本，npm run verify:all 通过。
```
