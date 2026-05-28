# Course 14 Production Upgrade Evidence Chain：从 Core 18 到 Core 26 学生产化证据链

> 本课对应 Core 18 到 Core 26。
>
> `course-07` 到 `course-12` 已经把学习版 Core 主体构建、真实 repo fixture、eval packaging 和 executable seeds 讲成一条教学主线。
>
> `course-13` 补上了 Core 13-17：20/20 executable starter suite、codex-local reference runs、cost basis 和 pricing table 边界。
>
> 本课接在这条主线之后，回答一个新问题：
>
> ```text
> 当系统已经能运行、能验证、能把 starter case 变成 executable evidence，
> 并且第一批 reference/cost evidence boundary 已经守住之后，
> 下一步怎样把 Runtime 的生产化属性做成可解释、可复现、可守边界的证据链？
> ```
>
> 本课是总览课。逐 verify case 跟源码的细课继续读：
>
> ```text
> course-15-context-compaction-plan-production.md
> course-16-long-running-tool-gateway-production.md
> course-17-session-repo-approval-production.md
> ```
>
> 如果你看到英文术语卡住，先读：
>
> ```text
> docs/production-upgrade-terms-zh.md
> ```
>
> 课程里的英文主要用于对应代码字段和 verify case 名称；理解时优先看中文含义。

---

## 0. 本课解决什么问题

学习者读完 `course-12` 后，应该已经能区分：

```text
eval_readiness_coverage
executable_repo_seed_score
SystemScore
RelativeScore
```

也应该知道：

```text
可执行 seed 通过，不等于生产级 Claude Code 能力。
reference-agent interface ready，不等于 RelativeScore。
```

Core 18-26 继续往前走，但不是继续堆更多 seed，也不是伪造 reference-agent 分数。

它要解决的是另一类问题：

```text
Context 是否能解释 token / cache / eviction？
Compaction 是否能被机器检查状态保真？
Plan 是否能成为可恢复、可修订的 step-level 状态？
长任务是否能留下失败、压缩、成本和恢复曲线？
ToolRuntime 是否能预览、事务提交和回滚？
ModelGateway 是否能在 provider 调用前做预算和能力决策？
Session 是否能持久化、恢复和 replay？
Repo Intelligence 是否能解释相关文件、测试和规则为什么入选？
Human Approval 是否能把批准、拒绝、打断和 handoff 写入 Runtime 状态？
```

一句话：

```text
Core 18-26 把“能跑”之后最容易失控的生产化边界，逐个变成 deterministic local evidence。
```

---

## 1. 先给结论

Core 18-26 是一个阶段，因为它们共同把学习版 Runtime 从：

```text
可以完成受控任务，并能用 executable seeds 证明
```

升级为：

```text
可以解释上下文经济性、状态保真、计划执行、长任务恢复、事务修改、模型预算、会话 replay、仓库相关性和人工协作事件。
```

这条阶段链是：

```text
Core 18 Context Economy
  -> Core 19 Compaction Quality
  -> Core 20 Plan State Machine
  -> Core 21 Long-Running Task Eval
  -> Core 22 ToolRuntime Transaction
  -> Core 23 ModelGateway Budget Controller
  -> Core 24 Durable Session Store Replay
  -> Core 25 Repo Intelligence Relevance Index
  -> Core 26 Human Approval Interruption Protocol
```

它证明的是：

```text
每个生产化机制都有本地可复现的行为、边界、回归和证据。
```

它没有证明：

```text
完整 Claude Code 复刻。
生产级 70%-80% 真实仓库成功率。
真实 provider SLA。
真实厂商账单。
真实 provider cache billing。
跨 agent RelativeScore。
完整 GUI / IDE / enterprise policy 产品。
```

---

## 2. 它如何衔接 course-07 到 course-13

`course-07` 的收束是：

```text
Core 01 到 Core 12 已经完成学习版 Core 主体构建。
```

`course-08` 到 `course-10` 分别把这些边界讲清楚：

```text
ModelGateway 控制模型输出是否能进入工具层。
Context Engine 控制模型本轮能看见什么。
Plan Mode 是 Runtime 权限状态，不是 prompt 文本。
Compaction 是状态保全，不是普通摘要。
Trace / Eval 让行为可证明、可归因。
Real Model Adapter 只替换 provider 边界，不替换本地 Runtime。
Prompt Recovery 只能引导恢复，不能授权危险动作。
```

`course-11` 把 toy workspace 推进到 real repo fixture：

```text
git status
AGENTS.md
package.json
多个相似文件
stale_file
npm test
```

`course-12` 把能力证明体系落地成：

```text
starter eval package
executable repo seeds
scoreKind 边界
reference-agent interface
docs authority layer
```

Core 18-26 接在这里的原因是：

```text
主体链路和 starter evidence 已经成立。
继续学习的重点从“有没有闭环”转成“闭环在生产化压力下是否仍然可控、可恢复、可解释”。
```

中间 Core 13-17 完成了重要铺垫：

```text
Core 13-14 把 20/20 starter case 全部推进为 executable。
Core 15 记录 8 个 codex-local sample runs。
Core 16 建立 token / cache / latency / hash cost basis。
Core 17 用本地显式 pricing table 生成 configured estimated USD。
```

但这些仍然没有创建第二 reference-agent baseline，也没有生成 RelativeScore。所以 Core 18-26 没有把教学重点放在“对外比较”，而是先补 Runtime 自身的生产化证据。

---

## 3. Core 18-26 为什么必须连成一条链

这九个 Core 不是平行功能清单。它们是一个生产化责任链。

```text
Context:
  模型本轮能看见什么，token 怎么花，哪些内容稳定可缓存。

Compaction:
  上下文变长后，目标、约束、失败、计划和下一步动作是否保真。

Plan:
  长任务执行到哪一步，为什么 blocked，用户改需求后如何 revision / resume。

Eval:
  多轮任务中 failure、compaction、cost 和 no false final 是否可评估。

ToolRuntime:
  真正改文件前能否 preview，commit 是否事务化，失败能否 rollback。

ModelGateway:
  provider 调用前是否有 token / cost gate，失败是否 retry / fallback。

Session:
  所有这些事实是否能持久化、恢复、replay 和审计。

Repo Intelligence:
  Context 的输入是否来自 repo map、symbol、test、rule 和 relevance，而不是只靠关键词。

Human Approval:
  高风险动作、批准、拒绝、打断和 handoff 是否进入 Runtime 状态。
```

如果拿掉其中一环，生产化链路会断：

```text
没有 Context Economy，token 节省只能靠口头声明。
没有 Compaction Quality，压缩后的恢复状态不可信。
没有 Plan State Machine，长任务只能靠模型记住自然语言计划。
没有 Long-Running Eval，多轮失败和成本曲线不可证明。
没有 ToolRuntime Transaction，改代码缺少 preview、rollback 和 stale 防线。
没有 ModelGateway Budget，provider 调用没有预算决策记录。
没有 Durable Session，crash / handoff 后只能靠聊天文本猜发生了什么。
没有 Repo Intelligence，Context 仍然可能塞错文件、漏掉测试和规则。
没有 Human Approval，高风险协作事件仍然在 Runtime 外面。
```

---

## 4. Product Trace：一条生产化任务如何穿过 Core 26

假设任务是：

```text
修复分页空页问题，保留 public API，运行测试；如果需要改 protected API 或高风险命令，先请求用户批准。
```

在 Core 26 的心智模型里，它会穿过这条链：

```text
User Goal
  -> Repo Intelligence 建立 repo map / symbol / test / rule index
  -> Context Economy 选择 stable prefix 和 dynamic tail
  -> ModelGateway Budget Controller 检查 token / cost / provider capability
  -> Plan State Machine 激活当前 step
  -> ToolRuntime Transaction 读取 snapshot、生成 diff preview
  -> Human Approval 对 protected / high-risk action 进入 approval_required
  -> Durable Session Store 记录 approval、tool、trace、plan、gateway decision
  -> ToolRuntime commit 或 reject 后 revision
  -> Bash verification 更新 verificationState
  -> Compaction Quality 在上下文压力下检查状态保真
  -> Long-Running Task Eval 归纳 failure history、cost curve、handoff
  -> FinalAnswer 必须由 completed plan 和 passed verification 支撑
```

注意这不是说 Core 26 已经是完整真实产品。

它说的是：

```text
这些本地 deterministic 组件可以形成一条可运行、可 replay、可验证的教学证据链。
```

---

## 5. 每个 Core 解决的生产化问题

| Core | 生产化问题 | 机制 | verify evidence 证明 | 仍然 out of scope |
| --- | --- | --- | --- | --- |
| Core 18 | 上下文如何省 token、稳定缓存、解释裁剪 | stable prefix、dynamic tail、eviction report、artifact、cache simulation | system/tools/rules hash 稳定；hard state 在预算压力下保留；长输出 artifact 化；节省不是 prompt-only | 真实 provider cache billing、真实 Claude Code context engine |
| Core 19 | 压缩是否真的保留任务状态 | before/after diff、quality checks、compaction_loss | objective、constraints、failed verification、active plan、modified files、pending actions 保真；坏摘要被抓出 | 完整生产级 compaction system、任意长任务无损恢复 |
| Core 20 | plan 如何从 approved 文本变成可审计状态机 | step lifecycle、blocked、revision、resume、permission、final grounding | pending -> active -> done；blocked reason；revision 不覆盖历史；resume；未批准/越 step 拒绝；未完成不能 final | 完整人工审批系统、真实 plan strategy |
| Core 21 | 长任务不是多跑几轮，而是状态和成本曲线 | long-running report、failureHistory、compactionEvents、costCurve、learningHandoff | 7 轮状态连续；重复失败影响下一步；compaction 后 resumed；每轮 token/cost；提前 final 归因为 verification_missing | 生产级长任务 benchmark、真实 provider billing |
| Core 22 | 改代码如何可预览、可事务化、可回滚 | read snapshot、diff preview、transaction commit、rollback、risk class | preview 不写文件；多文件 commit；失败 rollback；stale 要 reread；protected/high-risk 路由审批 | 完整 ToolRuntime、真实 IDE diff UI、完整 patch parser |
| Core 23 | 模型调用如何先过预算和 provider 决策 | BudgetController、capability registry、retry/fallback、output repair | token 超预算调用前拦截；cost gate 降级；retryable retry；non-retryable 不重试；能力过滤；JSON repair 后仍过 schema | 真实 provider SLA、真实账单、完整 provider router |
| Core 24 | 运行事实如何持久化、恢复和 replay | append-only event log、snapshot、crash recovery、trace replay、compaction audit、redaction | seq/hash chain 拒绝重排；snapshot 与 replay 对齐；active plan / pending action 不丢；secret 不落盘 | 分布式 durable storage、跨机器 session、enterprise audit log |
| Core 25 | 大仓库里为什么这个文件、测试和规则相关 | repo map、symbol/test/rule index、relevance scoring、incremental update、token benefit | 文件/脚本/规则入索引；export/reference 可定位；测试关联；正确文件排序更高；局部更新；indexed context 更省 token | embedding 语义检索、任意超大仓库生产级索引、真实 IDE / LSP 全量符号 |
| Core 26 | 人类审批和打断如何成为 Runtime 事实 | approval_required、approve/reject、interrupt、handoff、no hidden execution | protected/high-risk 进入审批；批准后才执行；拒绝后不执行并 revision；打断 pause step；handoff 可恢复；隐藏执行被拒 | GUI approval 产品、enterprise policy、真实多人协作权限模型 |

---

## 6. Execution Chain A：Context -> Compaction -> Plan

这一组解决的是：

```text
模型能看见什么？
长任务中状态如何保真？
执行到哪一步？
```

### 6.1 Core 18：Context Economy

先运行：

```bash
npm run core:18:verify
```

重点看这些 case：

```text
stable prefix: system, tool, and project blocks keep order id and hash
dynamic tail: latest user and tool results stay outside stable prefix
token budget: low priority content is evicted and hard state survives
artifact boundary: long output is artifacted and not selected raw
no prompt-only saving: savings are proven by selection, artifacts, and cache
```

学习重点：

```text
Context 不是把历史塞满。
Context Economy 要解释哪些 token 稳定、哪些动态、哪些被裁、哪些 artifact 化。
```

最重要的边界：

```text
cache simulation 是本地确定性模拟，不是真实 provider cache billing。
```

### 6.2 Core 19：Compaction Quality

先运行：

```bash
npm run core:19:verify
```

重点看这些 case：

```text
objective preservation
constraint preservation
failure preservation
plan preservation
modified files
pending actions
quality score: bad summary is identified as compaction_loss
```

学习重点：

```text
Compaction 不是“摘要写得不错”。
它必须能机器对照压缩前后是否保留继续任务所需 hard state。
```

最重要的边界：

```text
坏 compact summary 必须阻止恢复路径，不能把 failed verification 洗成 passed。
```

### 6.3 Core 20：Plan State Machine

先运行：

```bash
npm run core:20:verify
```

重点看这些 case：

```text
step lifecycle: steps move pending to active to done
blocked reason: failed step records structured reason and evidence
revision: user change creates revised plan without overwriting history
resume: compaction preserves active step and restore marks it resumed
permission: approved execution is bounded to active step tool
final grounding: incomplete plan cannot claim completion
```

学习重点：

```text
Plan 不再只是“批准过的一段计划文本”。
Plan 是 Runtime 里的 step-level 状态机，控制工具权限和 final answer 条件。
```

最重要的边界：

```text
Plan State Machine 是 deterministic local runtime evidence，不是完整生产级人工审批系统。
```

---

## 7. Execution Chain B：Eval -> ToolRuntime -> ModelGateway

这一组解决的是：

```text
长任务如何被评估？
工具修改如何安全落盘？
模型调用如何受预算和 provider 能力控制？
```

### 7.1 Core 21：Long-Running Task Eval

先运行：

```bash
npm run core:21:verify
```

重点看这些 case：

```text
multi-turn repair: state continues until final verification passes
repeated failure: two failures remain in history and steer next action
compaction under pressure: active step survives and resumes
cost curve: every turn has token and configured cost basis
no false final: premature final is attributed to verification_missing
learning handoff: summary explains continue, compact, resume, and cost
```

学习重点：

```text
长任务不是多跑几轮。
长任务要能解释为什么继续、为什么压缩、失败如何影响下一步、成本如何变化。
```

最重要的边界：

```text
本地 cost curve 只是 deterministic 示例，不是真实 provider billing。
```

### 7.2 Core 22：ToolRuntime Transaction

先运行：

```bash
npm run core:22:verify
```

重点看这些 case：

```text
diff preview: preview creates diff artifacts and does not write
transaction commit: multi-file transaction writes only after commit
rollback: simulated failure restores pre-transaction hashes
stale reread: external change after read blocks preview
protected file: protected API edit requires approval
bash risk class: high-risk command is denied or sent to approval
```

学习重点：

```text
“能改代码”不够。
生产化修改必须能在写入前解释 diff，写入时事务化，中途失败能恢复，风险动作能路由到审批。
```

最重要的边界：

```text
Core 22 不是完整 ToolRuntime，也不是 IDE diff UI。
```

### 7.3 Core 23：ModelGateway Budget Controller

先运行：

```bash
npm run core:23:verify
```

重点看这些 case：

```text
token budget gate: oversized request is blocked before provider call
cost budget gate: expensive primary is skipped for cheaper fallback
retryable failure: mock rate limit and timeout are retried
non-retryable failure: invalid tool schema is not retried
capability registry: unsupported tools and streaming are not exposed
output repair boundary: repairable JSON becomes schema-valid tool call
```

学习重点：

```text
ModelGateway 不只是 adapter。
生产化 Gateway 要在 provider 调用前控制 token、cost、capability 和 retry/fallback。
```

最重要的边界：

```text
本地 pricing table 和 mock provider 只证明预算决策链，不证明真实厂商账单或 SLA。
```

---

## 8. Execution Chain C：Session -> Repo Intelligence -> Human Approval

这一组解决的是：

```text
运行事实如何恢复？
仓库相关性如何解释？
人工协作如何进入 Runtime 状态？
```

### 8.1 Core 24：Durable Session Store Replay

先运行：

```bash
npm run core:24:verify
```

重点看这些 case：

```text
append-only event log: sequence and hash chain cannot reorder
snapshot restore: restored state matches snapshot replay state
crash recovery: pending action and active plan survive
trace replay: old trace rebuilds equivalent key state
compaction audit: replay explains before and after transition
secret boundary: raw provider credentials are not persisted
```

学习重点：

```text
Session 不是内存变量集合。
生产化 session 要能从 append-only event、snapshot 和 replay 重建关键事实。
```

最重要的边界：

```text
Core 24 不是分布式 durable storage，也不是跨机器 session 产品。
```

### 8.2 Core 25：Repo Intelligence Relevance Index

先运行：

```bash
npm run core:25:verify
```

重点看这些 case：

```text
repo map: fixture files, scripts, and rule entries are indexed
symbol index: exported symbol and references can be located
test index: package scripts and test files are associated
rule discovery: AGENTS and README rules enter high priority index
relevance scoring: correct file ranks above similar files
incremental update: modified file refreshes without full reindex
token benefit: indexed context selects correct file with fewer tokens
```

学习重点：

```text
Repo Intelligence 给 Context Engine 更好的输入。
它解释“为什么这个文件相关”，而不是只说“全文搜索命中了”。
```

最重要的边界：

```text
Core 25 不是 embedding 语义检索，也不是任意超大仓库生产级索引。
```

### 8.3 Core 26：Human Approval Interruption Protocol

先运行：

```bash
npm run core:26:verify
```

重点看这些 case：

```text
high-risk approval: protected edit and Bash enter approval_required
approve path: user approval continues execution with trace
reject path: user rejection does not execute and revises plan
interruption: user change pauses active step and adds constraint
handoff: unfinished task produces recoverable artifact
no hidden execution: approval assertion blocks pre-approval execution
```

学习重点：

```text
人工协作不是聊天外的说明。
批准、拒绝、打断、新约束和 handoff 都应该成为可 replay 的 Runtime event。
```

最重要的边界：

```text
Core 26 不是完整 GUI approval 产品，也不是 enterprise policy 系统。
```

---

## 9. Knowledge Provenance

这张表回答：生产化链路里的判断从哪里来，怎么进入系统，目标是什么。

| 判断 / 信息 | 来源 | 怎么进入系统 | 目标 | 如果没有 |
| --- | --- | --- | --- | --- |
| stable prefix 是否可复用 | system / tools / project rules blocks | Context Economy 的 stablePrefix id / hash | 解释可缓存输入 | cache saving 只能靠猜 |
| 预算压力下保留什么 | block priority + runtime hard state | evictionReport / selected blocks | 保留 active plan、verification、latest failure | 长任务恢复断片 |
| 压缩是否保真 | before state + compactSummary | Compaction Quality diff / checks | 防止状态漂移 | 坏摘要可能进入恢复 |
| 当前执行 step | PlanStateMachine | activePlan.currentStepId / planTrace | 控制工具权限和恢复点 | 模型只能靠自然语言记忆 |
| 重复失败 | Bash ToolResult / verificationState | failureHistory | 影响下一步修复 | 模型可能重复失败 |
| 修改预览 | read snapshot + edit intent | diffArtifacts / transactionLog | 写入前解释副作用 | 用户看不到将改什么 |
| rollback 依据 | transaction before hash/text | rollback evidence | 失败后恢复文件 | 半写入状态不可解释 |
| token / cost 决策 | ModelRequest + local pricing table | gatewayTrace / budget report | provider 调用前控制预算 | 成本超限后才发现 |
| provider 能力 | ProviderCapabilityRegistry | filtered tools / metadata | 不暴露不支持能力 | prompt 可能诱导错误工具 |
| session 恢复 | append-only event log + snapshot | replay / recoverAfterCrash | crash / handoff 后恢复状态 | 只能靠聊天文本猜 |
| repo 相关性 | repo map / symbols / tests / rules | relevance score reasons | 选中正确文件、测试和规则 | 上下文可能塞错文件 |
| 人工批准 | approval event | Durable session events / runtimeTrace | 高风险动作先批准再执行 | hidden execution 无法审计 |
| 用户打断 | interruption input | session.interrupted / constraint.added / plan revision | 新约束进入 Runtime | 用户新要求只停留在聊天里 |

---

## 10. Action Claim Contract

### 10.1 “Context 省 token”这个 claim 怎样才成立

```text
Action:
  声称 Context Engine 节省 token。

当前状态:
  Core 18 输出 stablePrefix、dynamicTail、evictionReport、artifacts、cacheReport。

合理性判断:
  可以声称 deterministic local context economy evidence 成立。

来源:
  src/core/context-economy.verify.mjs

硬约束:
  economyProof.promptOnlySaving 必须是 false。
  hard state 在小预算下必须保留。
  raw long output 不能反复进入 selectedMessages。

不能声称:
  真实 provider cache billing。
  真实 Claude Code context engine。
```

### 10.2 “压缩后可以恢复”这个 claim 怎样才成立

```text
Action:
  声称 compaction 后可以继续任务。

当前状态:
  Core 19 对照 before state 和 compactSummary。
  Core 20 验证 active step resume。
  Core 21 在长任务压力下触发 compaction 并继续完成。

合理性判断:
  可以声称本地 deterministic 状态保真和 resume 链路成立。

来源:
  src/core/compaction-quality.verify.mjs
  src/core/plan-state-machine.verify.mjs
  src/core/long-running-task-eval.verify.mjs

硬约束:
  failed verification 不能变 passed。
  active plan / pending actions 不能丢。
  premature final 必须归因为 verification_missing。

不能声称:
  任意长任务都能无损恢复。
  完整生产级 compaction system。
```

### 10.3 “高风险动作受人工审批控制”这个 claim 怎样才成立

```text
Action:
  声称 protected edit 或 high-risk Bash 不能隐藏执行。

当前状态:
  Core 22 可以把 protected / high-risk 动作路由为 approval_required。
  Core 24 可以持久化并 replay session events。
  Core 26 可以检查 approval.approved 必须早于 tool.executed。

合理性判断:
  可以声称本地 deterministic approval protocol evidence 成立。

来源:
  src/core/tool-runtime-transaction.verify.mjs
  src/core/durable-session-store-replay.verify.mjs
  src/core/human-approval-interruption-protocol.verify.mjs

硬约束:
  reject path 不能执行动作。
  no hidden execution case 必须拒绝坏事件。
  handoff artifact 不能伪装成任务完成。

不能声称:
  完整 GUI approval 产品。
  enterprise policy 系统。
  真实多人协作权限模型。
```

---

## 11. 统一 Out Of Scope

Core 18-26 全部通过后，仍然不能说：

```text
已经达到 Claude Code 生产能力。
已经证明任意真实仓库 70%-80% 成功率。
已经有跨 agent RelativeScore。
已经有真实 provider cache billing。
已经有真实厂商账单。
已经有真实 provider SLA。
已经有分布式 durable storage。
已经有完整语义 embedding 检索。
已经有任意超大仓库生产级索引。
已经有真实 IDE / LSP 全量符号能力。
已经有 GUI approval 产品。
已经有 enterprise policy 或真实多人协作权限模型。
```

当前最准确的说法是：

```text
Core 18-26 已完成 Production Upgrade 的 deterministic local evidence 主线。
它证明了本地 Runtime 生产化关键机制的行为和边界。
它为后续真实 repo benchmark、第二 reference-agent baseline 或更完整 approval / policy 产品层打基础。
```

---

## 12. 学习者应该亲手跑什么

本课建议按三组跑，不要一次只看 `verify:all` 总数。

如果你要按 `course-08` 到 `course-12` 的同一细读标准学习，跑完每组后继续进入对应细课：

第一组，状态和上下文：

```bash
npm run core:18:verify
npm run core:19:verify
npm run core:20:verify
```

你应该观察：

```text
stable prefix / dynamic tail 分离。
compaction_loss 能被识别。
plan step lifecycle 和 final grounding 被验证。
```

对应细课：

```text
course-15-context-compaction-plan-production.md
```

第二组，长任务、工具和模型调用：

```bash
npm run core:21:verify
npm run core:22:verify
npm run core:23:verify
```

你应该观察：

```text
long-running eval 不是只看最后答案。
transaction preview 不写文件。
budget gate 可以在 provider call 前拦截。
```

对应细课：

```text
course-16-long-running-tool-gateway-production.md
```

第三组，会话、仓库和人工协作：

```bash
npm run core:24:verify
npm run core:25:verify
npm run core:26:verify
```

你应该观察：

```text
append-only log 可以检测重排。
repo relevance 有 score reasons。
approval_required 动作不能隐藏执行。
```

对应细课：

```text
course-17-session-repo-approval-production.md
```

最后再跑：

```bash
npm run verify:all
```

`222/222 passed` 的教学含义不是“生产级能力完成”，而是：

```text
当前 Lab、Core 01-26 和 Production Upgrade deterministic local evidence 全部可复现。
```

---

## 13. 本课最终要能回答的问题

```text
1. 为什么 Core 18-26 是一个 Production Upgrade 阶段，而不是九个散功能？
2. Core 18 的 token saving 为什么不能写成 prompt-only saving？
3. Core 19 如何把坏压缩归因为 compaction_loss？
4. Core 20 为什么说 Plan 是状态机，不是计划文本？
5. Core 21 为什么要记录 failure history 和 cost curve？
6. Core 22 的 preview 为什么不能写文件？
7. Core 23 的 token / cost gate 为什么必须发生在 provider call 前？
8. Core 24 的 append-only event log 为什么要有 seq/hash chain？
9. Core 25 的 relevance scoring 比 Search 命中多证明了什么？
10. Core 26 的 no hidden execution case 防住了什么？
11. Context / Compaction / Plan / Eval / ToolRuntime / ModelGateway / Session / Repo Intelligence / Human Approval 如何形成一条链？
12. Core 18-26 通过后，为什么仍不能声称生产级 Claude Code 能力或 RelativeScore？
```

过关标准：

```text
你能拿任意一个 Core 18-26 的 verify case，
说清它证明的生产化问题、证据来源、Runtime 边界和 out-of-scope 声明，
并且不会把 deterministic local evidence 误说成生产级 Claude Code 能力。
```
