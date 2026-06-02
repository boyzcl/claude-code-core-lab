# Core Run Record：Core Runtime 验证记录

运行日期：2026-06-01

最后验证时间：2026-06-02 15:59 CST

运行命令：

```bash
npm run core:verify
npm run core:02:verify
npm run core:03:verify
npm run core:04:verify
npm run core:05:verify
npm run core:06:verify
npm run core:07:verify
npm run core:08:verify
npm run core:09:verify
npm run core:10:verify
npm run core:11:verify
npm run core:12:verify
npm run core:13:verify
npm run core:14:verify
npm run core:15:verify
npm run core:16:verify
npm run core:17:verify
npm run core:18:verify
npm run core:19:verify
npm run core:20:verify
npm run core:21:verify
npm run core:22:verify
npm run core:23:verify
npm run core:24:verify
npm run core:25:verify
npm run core:26:verify
npm run core:27:verify
npm run core:28:verify
npm run core:29:verify
npm run core:30:verify
npm run core:31:verify
npm run docs:links
npm run project:capstone:solution:verify
npm run verify:all
```

本轮 v0.2 Core Logic Clarity Pass 额外确认：

```text
git diff --check: passed
npm run docs:links: passed, 233 internal links passed, 33 external links recorded
npm run project:capstone:solution:verify: 8/8 passed
npm run verify:all: passed, total 265/265
```

---

## 1. Core 验证结果

```text
core: 5/5 passed
core-02: 10/10 passed
core-03: 5/5 passed
core-04: 5/5 passed
core-05: 5/5 passed
core-06: 5/5 passed
core-07: 4/4 passed
core-08: 5/5 passed
core-09: 6/6 passed
core-10: 7/7 passed
core-11: 7/7 passed
core-12: 7/7 passed
core-13: 7/7 passed
core-14: 7/7 passed
core-15: 6/6 passed
core-16: 7/7 passed
core-17: 7/7 passed
core-18: 8/8 passed
core-19: 9/9 passed
core-20: 10/10 passed
core-21: 8/8 passed
core-22: 8/8 passed
core-23: 9/9 passed
core-24: 8/8 passed
core-25: 9/9 passed
core-26: 9/9 passed
core-27: 8/8 passed
core-28: 9/9 passed
core-29: 9/9 passed
core-30: 8/8 passed
core-31: 9/9 passed
```

case：

```text
happy path: integrated runtime fixes and verifies bug
message store integration: every tool result is linked
policy: Edit without Read returns structured error
policy: non-allowlisted Bash is denied
runtime: stops with final answer after verification
```

Core 02 case：

```text
gateway runtime: model gateway fixes and verifies bug
parser: text-only model output becomes final answer
parser: explicit text tool_call JSON is recovered
parser: multiple tool calls are normalized to first call
validator: unknown model tool is rejected before execution
validator: missing required tool input is rejected
adapter: provider failure is normalized as model_failed
adapter: provider http error preserves provider code
openai-compatible adapter: response json maps to tool call event
chat-completions adapter: tool call json maps to tool call event
```

Core 03 case：

```text
gateway runtime: context engine integrated without breaking tool chain
context selection: hard state survives budget pressure
message boundary: artifacted long output is not selected raw context
model gateway: adapter receives context object with blocks
context budget: latest failure survives tiny budget
```

Core 04 case：

```text
plan runtime: approved plan enables full fix and verification
plan policy: Edit is denied before plan approval
plan validation: vague plan is recorded and does not execute
plan context: approved plan appears in context snapshots
plan controller: rejected plan cannot be approved in core path
```

Core 05 case：

```text
compactor: preserves hard state and artifacts long output
runtime: compaction triggers before model request
runtime: failed verification cannot become passed after compact
runtime: newer messages remain available after compact
context: compact summary does not replace latest user message
```

Core 06 case：

```text
happy path: core eval report scores and attributes failures
case schema: starter cases declare executable expectations
evidence: happy case includes runtime trace and context snapshots
failure attribution: unverified final answer is caught
policy regression: edit-before-read passes only with denial evidence
```

Core 07 case：

```text
adapter contract: mock responses drive full local e2e
adapter contract: mock chat completions drive full local e2e
config: missing api key fails before fetch
payload: tool results are fed back as next request input
```

Core 08 case：

```text
prompt pack: recovery demo fixes and verifies
prompt pack: system prompt contains guidance and boundaries
recovery loop: denied ToolResult re-enters next request
policy boundary: prompt cannot authorize unsafe Bash
context: prompt pack is delivered as system message
```

Core 09 case：

```text
real repo: task observes rules, recovers stale edit, and verifies
fixture: git status starts clean
fixture: npm test initially fails before fix
policy: real repo command allowlist denies unknown command
context: real repo run keeps project rules visible
runtime: final answer remains verification grounded
```

Core 10 case：

```text
core10: readiness package builds and verifies
eval suite: starter cases match L0-L4 distribution
score: readiness coverage is not a production capability claim
taxonomy: critical red lines are explicit
docs: open-source entry layer and authority map are present
scripts: core10 is wired into package verification
baseline: recorded verification evidence remains all green
```

Core 11 case：

```text
core11: executable repo seed report runs and verifies
seed contract: selected seeds bind to Core 10 starter cases
report: executable score is not readiness coverage
reference-agent: comparison fields are present but empty
L1 seed: pagination fix has file and verification evidence
L2 seeds: test discovery and stale reread evidence are executable
L4 seed: dangerous command is denied by policy
```

Core 12 case：

```text
core12: second executable seed batch runs and verifies
seed contract: second batch binds to unmigrated Core 10 cases
coverage: executable starter coverage is now 10 of 20
reference-agent: runnable interface exists without fake results
L0 seeds: unique old_string and path safety are enforced
context seeds: long output artifact and hard failure blocks survive
L3 seed: plan and compaction continuity is executable
```

Core 13 case：

```text
core13: third executable seed batch runs and verifies
seed contract: third batch binds to unmigrated Core 10 cases
coverage: executable starter coverage is now 15 of 20
reference-agent: interface remains ready without fabricated runs
L0 seeds: stale, bash denial, and linkage are executable
L1 seed: file_not_read recovery is executable
L2 seed: project rules enter context and verification passes
```

Core 14 case：

```text
core14: final executable starter batch runs and verifies
seed contract: final batch binds only to remaining Core 10 cases
coverage: executable starter coverage is now 20 of 20
reference-agent: interface remains ready with no RelativeScore
L0 seed: provider error is normalized before tool execution
L1/L2 seeds: failure attribution and similar-file search are executable
L2/L4 seeds: public API and prompt boundary are enforced
```

Core 15 case：

```text
core15: codex-local reference comparison runs are recorded
sample contract: selected runs bind to executable starter cases
claim boundary: no RelativeScore or Claude Code claim
repair samples: verification commands passed
safety sample: unsafe command avoided and files unchanged
expansion samples: failure and ambiguity outcomes are represented
```

Core 16 case：

```text
core16: cost and cross-agent report runs and verifies
cost basis: every recorded run has token, latency, outcome, and hash evidence
totals: token and latency sums are stable for the 8-run codex-local sample
pricing boundary: USD remains null without a configured price table
pricing option: configured pricing table can estimate a run without changing raw evidence
cross-agent gate: only codex-local has recorded runs on this machine snapshot
cross-agent option: a second agent needs recorded runs before RelativeScore can exist
```

Core 17 case：

```text
core17: pricing table baseline runs and verifies
pricing table contract: local table is explicit and bounded
per-run estimates: all 8 codex-local runs have configured USD estimates
totals: configured estimate sums are stable
evidence boundary: pricing does not rewrite raw run hashes
relative score boundary: pricing table does not create a second baseline
pricing validation: invalid local table is rejected
```

Core 18 case：

```text
core18: context economy demo runs and verifies
stable prefix: system, tool, and project blocks keep order id and hash
dynamic tail: latest user and tool results stay outside stable prefix
token budget: low priority content is evicted and hard state survives
cache simulation: second turn reports cache hits and uncached tail
artifact boundary: long output is artifacted and not selected raw
latest failure: failure, verification state, and active plan survive pressure
no prompt-only saving: savings are proven by selection, artifacts, and cache
```

Core 19 case：

```text
core19: compaction quality demo runs and verifies
objective preservation: compacted objective does not drift
constraint preservation: user and safety constraints remain complete
failure preservation: failed verification cannot become passed
plan preservation: active plan id, steps, and status survive
modified files: file path and reason remain traceable
pending actions: next actions remain available after compact
quality score: bad summary is identified as compaction_loss
boundary: quality eval is local evidence, not production claim
```

Core 20 case：

```text
core20: plan state machine demo runs and verifies
step lifecycle: steps move pending to active to done
blocked reason: failed step records structured reason and evidence
revision: user change creates revised plan without overwriting history
resume: compaction preserves active step and restore marks it resumed
permission: unapproved write tool is denied by plan state
permission: approved execution is bounded to active step tool
final grounding: incomplete plan cannot claim completion
boundary: plan machine is local runtime evidence, not prompt-only claim
validation: malformed plan is rejected before execution
```

Core 21 case：

```text
core21: long-running task eval demo runs and verifies
multi-turn repair: state continues until final verification passes
repeated failure: two failures remain in history and steer next action
compaction under pressure: active step survives and resumes
cost curve: every turn has token and configured cost basis
no false final: premature final is attributed to verification_missing
learning handoff: summary explains continue, compact, resume, and cost
boundary: long-running eval is local evidence, not production claim
```

Core 22 case：

```text
core22: transaction demo runs and verifies
diff preview: preview creates diff artifacts and does not write
transaction commit: multi-file transaction writes only after commit
rollback: simulated failure restores pre-transaction hashes
stale reread: external change after read blocks preview
protected file: protected API edit requires approval
bash risk class: high-risk command is denied or sent to approval
boundary: transaction layer is local evidence, not full ToolRuntime
```

Core 23 case：

```text
core23: budgeted gateway demo runs and verifies
token budget gate: oversized request is blocked before provider call
cost budget gate: expensive primary is skipped for cheaper fallback
retryable failure: mock rate limit and timeout are retried
non-retryable failure: invalid tool schema is not retried
fallback: primary failover uses fallback provider
capability registry: unsupported tools and streaming are not exposed
output repair boundary: repairable JSON becomes schema-valid tool call
boundary: gateway budget evidence is local and not production claim
```

Core 24 case：

```text
core24: durable session demo runs and verifies
append-only event log: sequence and hash chain cannot reorder
snapshot restore: restored state matches snapshot replay state
crash recovery: pending action and active plan survive
trace replay: old trace rebuilds equivalent key state
compaction audit: replay explains before and after transition
secret boundary: raw provider credentials are not persisted
boundary: durable replay is local evidence, not production store
```

Core 25 case：

```text
core25: repo intelligence demo runs and verifies
repo map: fixture files, scripts, and rule entries are indexed
symbol index: exported symbol and references can be located
test index: package scripts and test files are associated
rule discovery: AGENTS and README rules enter high priority index
relevance scoring: correct file ranks above similar files
incremental update: modified file refreshes without full reindex
token benefit: indexed context selects correct file with fewer tokens
boundary: repo intelligence is local evidence, not production search
```

Core 26 case：

```text
core26: human approval demo runs and verifies
high-risk approval: protected edit and Bash enter approval_required
approve path: user approval continues execution with trace
reject path: user rejection does not execute and revises plan
interruption: user change pauses active step and adds constraint
handoff: unfinished task produces recoverable artifact
no hidden execution: approval assertion blocks pre-approval execution
risk classifier: safe action stays outside approval queue
boundary: approval protocol is local evidence, not production UI
```

Core 27 case：

```text
core27: settings permission resolver demo runs and verifies
validation matrix: Core 27 does not duplicate Core 22 or Core 26
config precedence: policy/local/project/user rules are explainable
allow ask deny: one resolver feeds execute, approval, and refusal paths
prefix command rule: explicit prefix does not allow similar command
no hidden execution: ask and deny produce zero provider/tool deltas
decision cache: repeated action records cache hit without losing source
boundary: resolver is local evidence, not enterprise policy product
```

Core 28 case：

```text
core28: hooks lifecycle demo runs and verifies
validation matrix: Core 28 does not duplicate Core 24 or Core 26
pre tool hook: block prevents tool execution and enters event log
post tool hook: feedback enters next context as observation
user prompt hook: constraint enters runtime state, not system prompt
hook failure: structured failure does not bypass permission denial
secret boundary: hook output is redacted before storage
no hidden execution: blocked and denied actions never execute
boundary: hooks lifecycle is local evidence, not shell hook product
```

Core 29 case：

```text
core29: memory source demo runs and verifies
validation matrix: Core 29 does not duplicate Course 08/09 or Core 18/19/24
memory type routing: user feedback project and reference use distinct policies
write and index: memory body and index are separated
forget: deleted memory removes body and updates index
stale verification: referenced files are checked before recommendation
compaction boundary: long-term memory stays separate from compact summary
no code-structure memory: repo facts are denied as long-term memory
boundary: memory source is local evidence, not official memory product
```

Core 30 case：

```text
core30: checkpoint rewind demo runs and verifies
validation matrix: Core 30 does not duplicate Core 22 or Core 24
checkpoint creation: checkpoint binds file hashes, event seq, and durable snapshot
rewind state: files and replay state restore to target checkpoint
partial rewind denial: external user change blocks restore
audit replay: rewind report explains source target restored files and replay seq
event log boundary: rewind appends audit events without truncating history
boundary: checkpoint rewind is local evidence, not IDE rewind product
```

Core 31 case：

```text
core31: subagent context isolation demo runs and verifies
validation matrix: Core 31 does not duplicate Core 21 24 or 25
independent task: two delegated tasks run in one parallel group
context isolation: subagent sees only task-specific files
no duplicate research: delegated task signature reuses ledger
result contract: parent receives summary and evidence only
failure propagation: subagent failure reaches parent as structured failure
isolation audit: delegation ledger is replayable from session events
boundary: subagent isolation is local evidence not agent marketplace
```

---

## 2. 全量验证结果

```text
lab-01: 4/4 passed
lab-02: 5/5 passed
lab-03: 5/5 passed
lab-04: 6/6 passed
lab-05: 5/5 passed
lab-06: 5/5 passed
lab-07: 5/5 passed
lab-08: 4/4 passed
core:   5/5 passed
core-02: 10/10 passed
core-03: 5/5 passed
core-04: 5/5 passed
core-05: 5/5 passed
core-06: 5/5 passed
core-07: 4/4 passed
core-08: 5/5 passed
core-09: 6/6 passed
core-10: 7/7 passed
core-11: 7/7 passed
core-12: 7/7 passed
core-13: 7/7 passed
core-14: 7/7 passed
core-15: 6/6 passed
core-16: 7/7 passed
core-17: 7/7 passed
core-18: 8/8 passed
core-19: 9/9 passed
core-20: 10/10 passed
core-21: 8/8 passed
core-22: 8/8 passed
core-23: 9/9 passed
core-24: 8/8 passed
core-25: 9/9 passed
core-26: 9/9 passed
core-27: 8/8 passed
core-28: 9/9 passed
core-29: 9/9 passed
core-30: 8/8 passed
core-31: 9/9 passed

total: 265/265 passed
exit code: 0
```

---

## 3. 本次证明了什么

本次证明：

```text
Claude Code-like Core 的最小工程骨架已经成立。
模型层可以替换成 ModelGateway，而不破坏本地 Runtime / Tool / Policy / MessageStore 边界。
Context Engine 可以接入 CoreRuntime，让 ModelGateway 收到经过选择、裁剪和 artifact 化的本轮上下文。
Plan Mode 可以接入 CoreRuntime，让计划审批影响 activePlan、context 和工具权限。
Compaction / Artifact 可以接入 CoreRuntime，让长任务在上下文收缩后保留关键状态。
Trace / Eval Harness 可以接入 CoreRuntime，把运行过程转成可评分、可归因的 evidence。
Real Model API 可以接入 ModelGateway 后面的 Provider Adapter，且本地 Runtime 边界不变。
Prompt Pack / Recovery Loop 可以接入 Context Engine 和 MessageStore 反馈链路，但不能替代 Policy / ToolRuntime。
Real Repo Task Layer 可以用受控 fixture 验证项目规则、git 状态、测试发现、多文件定位和 stale edit 恢复。
Core 10 可以汇总前序 evidence，建立 starter task suite、failure taxonomy、readiness coverage 和最小开源文档入口。
Core 11 可以把 5 个 starter case 推进为 executable repo seeds，并输出 executable_repo_seed_score。
Core 12 可以把第二批 5 个 starter case 推进为 executable repo seeds，使累计 executable starter coverage 达到 10/20。
Core 13 可以把第三批 5 个 starter case 推进为 executable repo seeds，使累计 executable starter coverage 达到 15/20。
Core 14 可以把最终 5 个 starter case 推进为 executable repo seeds，使累计 executable starter coverage 达到 20/20。
Core 15 可以把 reference-agent comparison 从空接口推进到 8 个真实 codex-local CLI sample runs。
Core 16 可以为这 8 个 codex-local runs 建立 token/cache/latency/hash cost basis，并在只有单 baseline 时阻止 RelativeScore。
Core 17 可以给这 8 个 codex-local runs 接入显式本地 pricing table，生成 configured estimated USD，同时不声称真实厂商账单。
Core 18 可以让 Context Engine 输出 stable prefix、dynamic tail、eviction、artifact 和 cache simulation 证据，同时不把 token 节省归因于 prompt 文案。
Core 19 可以让 Compaction Quality Eval 机器对照目标、约束、失败、计划、文件和下一步动作，并把坏摘要归因为 compaction_loss。
Core 20 可以让 Plan State Machine 追踪 step lifecycle、blocked reason、revision、compaction resume、permission 和 final grounding。
Core 21 可以让 Long-Running Task Eval 记录多轮修复、重复失败、compaction resume、成本曲线、no false final 和学习交接摘要。
Core 22 可以让 ToolRuntime 修改先生成 diff preview，再以多文件 transaction commit；失败时 rollback，stale/protected/high-risk 会被结构化拦截。
Core 23 可以让 ModelGateway 在 provider 调用前执行 token/cost budget gate，并留下 retry/fallback、capability registry 和 output repair 证据。
Core 24 可以让 session event 进入 append-only log，并留下 snapshot restore、crash recovery、trace replay、compaction audit 和 secret scan 证据。
Core 25 可以让 Context Engine 的输入来自 repo map、symbol/test/rule index、relevance scoring、incremental update 和 token benefit 证据。
Core 26 可以让 human approval、reject、interruption、handoff 和 no hidden execution 都进入可 replay 的 Runtime 状态。
Core 27 可以让 settings / permission rules 在工具执行前解析为 allow / ask / deny，并留下 ruleSource、resolverTrace 和 decisionCache 证据。
Core 28 可以让 hooks 作为 user prompt / pre tool / post tool lifecycle event 进入可审计 session，并留下 hookDecision、hookFeedback、redactedHookOutput 和 no hidden execution 证据。
Core 29 可以让 CLAUDE.md / user / feedback / reference memory 作为可治理的长期上下文来源，并留下 memoryType、memoryIndex、forgetEvent、memoryFreshnessCheck 和 no code-structure memory 证据。
Core 30 可以让 checkpoint / rewind 作为用户可见恢复点进入 Runtime 状态，并留下 fileStateSnapshot、externalChangeConflict、rewindAudit 和 append-only event boundary 证据。
Core 31 可以让 subagent delegation 作为 Runtime 边界进入本地证据链，并留下 delegatedTask、subagentContext、subagentResult、delegationLedger、isolationAudit、no duplicate research 和 structured failure 证据。
```

它能在临时 toy workspace 中完成：

```text
Search 定位 bug
Read 建立文件快照
Edit 安全修改
Bash 运行验证
FinalAnswer 基于验证状态输出
```

整个过程中：

```text
ToolCall / ToolResult 被 MessageStore 关联。
Edit 不能绕过 read-before-write。
Bash 不能绕过 allowlist。
最终回答发生在测试通过之后。
ModelGateway 会在工具执行前校验 tool name 和 required input。
Provider failure 会被归一化成模型层错误，而不是误当作工具结果。
MessageStore 仍然保留完整事实流，ModelRequest 只暴露 Context Engine 选择后的本轮可见材料。
长输出可以转成 artifact，最新失败、验证状态和下一步决策所需 observation 必须保留。
批准前 Edit 会被 plan mode 拒绝为结构化 ToolResult。
approved plan 会进入 coreState.activePlan，并进入 Context Engine 的 active_plan block。
compactSummary 保留目标、约束、active plan、修改文件、失败、验证状态和 pending actions。
compactionArtifacts 保存长输出；MessageStore 不被 compact 改写。
runtimeTrace 记录 context.built、model.output、tool.authorized、tool.result 等运行事件。
Eval Harness 会抽取 toolSequence、toolResults、modifiedFiles、verificationStatus、finalAnswer、storeTraceEvents、runtimeTraceEvents 和 contextTurns。
未验证却 final answer 会被归因为 verification_missing。
edit-before-read 只有留下 file_not_read denial evidence 才算符合 policy regression 预期。
OpenAI-compatible Responses 和 Chat Completions 两类 Provider Adapter 都可以映射成本地 tool_call / final_answer。
DeepSeek live E2E 已完成真实模型调用、本地 Search / Read / Edit / Bash、验证通过和最终回答。
真实模型输出多 tool_calls 时，只执行第一个工具调用，额外调用记录到 metadata。
verificationState passed 后，Core 07 可以由本地 Runtime 收束，避免继续请求工具。
Prompt Pack 进入 ModelRequest 的 system message，提供工具顺序、恢复策略和边界说明。
denied / error ToolResult 会回灌给下一轮模型请求，成为恢复依据。
Edit before Read 的 file_not_read 可以恢复为 Search / Read / Edit。
非 allowlisted Bash 的 permission_denied 可以恢复为 allowlisted 验证命令。
Prompt 不能授权危险 Bash；Policy / ToolRuntime 仍然强制拒绝。
Core 09 fixture 是真实 git repo，初始 npm test 失败。
Runtime 会观察 git status --short、读取 AGENTS.md 和 package.json、搜索多个候选源码文件。
用户中途改文件会触发 stale_file，模型必须重新 Read 后再 Edit。
最终回答由 npm test 的 passed verificationState 支撑。
Core 10 的 eval_readiness_coverage 代表评测准备度，不代表生产 70%-80% 能力。
Core 11 的 executable_repo_seed_score 代表第一批 seed 的可执行评分，不代表 reference-agent relative score。
Core 11 已覆盖 read-before-edit、pagination fix、test command discovery、stale reread 和 dangerous command denial 5 个 executable repo seeds。
Core 12 已覆盖 unique old_string、path safety、long output artifact、context budget pressure 和 plan compact continuity 5 个 executable repo seeds。
Core 13 已覆盖 stale file reread、bash denial、tool result linkage、file_not_read recovery 和 project rules 5 个 executable repo seeds。
Core 14 已覆盖 provider error、test failure attribution、similar-file search、public API preserved 和 prompt cannot authorize tool 5 个 executable repo seeds。
Core 15 已记录 codex-local CLI 对照样本：pagination fix、similar-file search、prompt boundary、test failure attribution、path safety、unique old_string ambiguity、public API preserved 和 project rules。
Core 15 不是 Claude Code baseline，不生成 RelativeScore；costUsd 仍为 null，costStatus=not_reported_by_cli。
Core 16 已为 8 个 codex-local sample runs 建立 cost basis：inputTokens=660067、cachedInputTokens=523904、uncachedInputTokens=136163、outputTokens=7233、reasoningOutputTokens=2174、visibleTotalTokens=667300、latencyMs=362003。
Core 16 没有配置 pricing table 时 estimatedCostUsd 保持 null；当前只有 codex-local-cli 有 recorded runs，crossAgentReadiness.status=single_baseline_only，RelativeScore=blocked_until_second_agent_runs。
Core 17 已用本地显式 pricing table 生成 8-run configured estimate：estimatedCostUsd=0.609534，averageEstimatedCostUsd=0.07619175；该表 source=local_configured_example_not_vendor_price，realVendorPriceClaim=false。
Core 18 已验证 stable prefix / dynamic tail 分离、token budget eviction、artifact boundary、cache simulation 和 no prompt-only saving。
Core 18 的 cache simulation 是 deterministic local evidence，不是真实 provider cache billing。
Core 19 已验证 objective / constraints / failure / plan / modified files / pending actions 保真，并能把坏摘要归因为 compaction_loss。
Core 19 的 quality eval 是 deterministic local evidence，不是完整生产级 compaction system。
Core 20 已验证 pending -> active -> done、blocked reason、revision history、compaction resume、permission denial 和 final grounding。
Core 20 的 Plan State Machine 是 deterministic local evidence，不是完整生产级人工审批系统。
Core 21 已验证 7 轮 long-running repair、2 次失败 history、turn 5 compaction resume、per-turn cost curve、verification_missing false final 和 learning handoff。
Core 21 的 Long-Running Task Eval 是 deterministic local evidence，不是生产级长任务 benchmark。
Core 22 已验证 diff preview 不写文件、多文件 transaction commit、rollback、stale reread、protected file approval 和 high-risk Bash approval routing。
Core 22 的 ToolRuntime Transaction 是 deterministic local evidence，不是完整生产级 ToolRuntime。
Core 23 已验证 token budget preflight、cost downgrade、retryable failure retry、non-retryable failure no-retry、fallback provider、capability registry filtering 和 schema-bound JSON repair。
Core 23 的 ModelGateway Budget Controller 是 deterministic local evidence，不是真实 provider SLA、真实厂商账单或完整生产级 provider router。
Core 24 已验证 append-only event log、snapshot restore、crash recovery、trace replay、compaction audit 和 raw provider credential redaction。
Core 24 的 Durable Session Store + Replay 是 deterministic local evidence，不是分布式 durable storage、跨机器 session 产品或生产级 audit log。
Core 25 已验证 repo map、exported symbol/reference、package scripts/test association、high-priority rules、relevance scoring、incremental update 和 token benefit。
Core 25 的 Repo Intelligence + Relevance Index 是 deterministic local evidence，不是完整语义 embedding 检索、任意超大仓库生产级索引或真实 IDE / LSP 全量符号能力。
Core 26 已验证 approval_required、approve path、reject path、interruption、handoff、no hidden execution 和 risk classifier。
Core 26 的 Human Approval + Interruption Protocol 是 deterministic local evidence，不是完整 GUI approval 产品、enterprise policy 系统或真实多人协作权限模型。
Core 27 已验证 config precedence、allow ask deny、prefix command rule、no hidden execution、decision cache 和 Core 22 / Core 26 non-duplication boundary。
Core 27 的 Settings / Permission Resolver 是 deterministic local evidence，不是完整 enterprise policy 产品、真实 Claude Code Settings / Permission 内部实现、GUI permission prompt、完整 shell parser 或 sandbox。
Core 28 已验证 pre tool hook、post tool hook、user prompt hook、hook failure、secret boundary、no hidden execution 和 Core 24 / Core 26 non-duplication boundary。
Core 28 的 Hooks Lifecycle 是 deterministic local evidence，不是真实 shell hook 产品、任意用户脚本安全沙箱、完整插件系统或真实 Claude Code hooks 内部实现。
Core 29 已验证 memory type routing、write and index、forget、stale verification、compaction boundary、no code-structure memory 和 Course 08/09 / Core 18/19/24 non-duplication boundary。
Core 29 的 Memory Source / CLAUDE.md / Auto Memory 是 deterministic local evidence，不是真实 Claude Code memory 文件格式、远端多用户 memory 服务、隐私合规系统、完整代码智能数据库或官方实现。
Core 30 已验证 checkpoint creation、rewind state、partial rewind denial、audit replay、event log boundary 和 Core 22 / Core 24 non-duplication boundary。
Core 30 的 Checkpoint / Rewind 是 deterministic local evidence，不是 IDE rewind UI、跨机器恢复、分布式 session store、完整 patch parser 或真实 Claude Code Checkpoint 内部实现。
Core 31 已验证 independent task、context isolation、no duplicate research、result contract、failure propagation、isolation audit 和 Core 21 / Core 24 / Core 25 non-duplication boundary。
Core 31 的 Subagent Context Isolation 是 deterministic local evidence，不是真实多进程 agent 调度、远端 worker 隔离、agent marketplace 或真实 Claude Code Subagent 内部实现。
README.md、AGENTS.md、docs/index.md 和 docs/authority-map.md 已形成最小开源入口。
docs/authority-map.md 声明当前规则、历史背景和证据目录的边界。
verify:all 已覆盖 core:31:verify。
```
