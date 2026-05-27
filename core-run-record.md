# Core Run Record：Core Runtime 验证记录

运行日期：2026-05-27

最后验证时间：2026-05-27 16:01 CST

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
npm run verify:all
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

total: 152/152 passed
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
README.md、AGENTS.md、docs/index.md 和 docs/authority-map.md 已形成最小开源入口。
docs/authority-map.md 声明当前规则、历史背景和证据目录的边界。
verify:all 已覆盖 core:18:verify。
```
