# Course 13 Eval Reference Cost Evidence：从可执行评测到对照和成本边界

> 本课对应 Core 13、Core 14、Core 15、Core 16、Core 17。
>
> `course-12` 已经讲清：
>
> ```text
> Eval packaging 先把能力声明拆成 starter cases。
> executable seeds 把 starter cases 变成可运行、可评分、可归因的仓库任务。
> reference-agent runner 当时只是接口就绪，没有真实 runs，所以不能生成 RelativeScore。
> ```
>
> 本课补上 `course-12` 到 Production Upgrade 之间最容易断掉的一段：
>
> ```text
> Core 13-14 把 20 个 starter case 全部迁移成 executable seeds。
> Core 15-17 给其中 8 个 seeds 补上本机 Codex local 对照、token/cost 计量口径和显式价格表估算。
> ```
>
> 本课仍然按 `course-08` 到 `course-12` 的标准学习：
>
> ```text
> 先运行什么
> -> Execution Chain
> -> Knowledge Provenance
> -> Action Claim Contract
> -> 学习者应该亲手改哪里
> -> 本课最终要能回答的问题
> ```
>
> 术语先用中文理解：
>
> ```text
> executable seed = 可执行评测种子：一个能在临时仓库里真实运行的评测任务。
> reference agent = 参考 Agent：拿来对照的另一个真实执行系统。
> baseline = 基线：一组已记录、可复核的参考运行结果。
> cost basis = 成本计量口径：token、缓存 token、输出 token、延迟、原始日志指纹等基础数据。
> pricing table = 价格表：使用者显式提供的单价配置。
> RelativeScore = 相对分数：至少两个真实 Agent 跑同一批任务后才可能计算的相对表现。
> ```

---

## 0. 本课跟踪哪五条执行链

Core 13-17 不是 Production Upgrade 的一部分，但它们是开源学习路径里必须补齐的证据桥。

它们回答的问题是：

```text
starter cases 是否已经全部变成可执行评测？
真实 reference-agent 对照是否已经开始？
记录到的对照到底是谁的结果？
token、缓存、延迟和日志指纹是否足够支撑未来成本比较？
本地价格表估算和真实厂商账单的边界在哪里？
没有第二个真实 Agent 前，为什么仍然不能生成 RelativeScore？
```

五条执行链：

```text
主线 A：Core 13 第三批 executable seeds
  10/20 -> 15/20
  stale file、Bash denial、ToolResult linkage、file_not_read recovery、project rules

主线 B：Core 14 最终 starter batch
  15/20 -> 20/20
  provider error、test failure attribution、similar-file search、public API、prompt boundary

主线 C：Core 15 Codex local reference baseline
  8 个 executable seeds
  真实 codex exec runs
  raw log hash
  不声称 Claude Code baseline

主线 D：Core 16 cost basis 与 cross-agent gate
  token / cached token / uncached token / output token / latency / rawLogSha256
  没有 pricing table 时 USD 必须是 null
  没有第二 Agent 真实 runs 时 RelativeScore 必须阻塞

主线 E：Core 17 pricing table baseline
  显式本地价格表
  configured estimated USD
  不改写 raw evidence
  不创建第二 baseline
```

一句话：

```text
Core 13-17 把“评测准备好了”推进到“评测全量可执行，并且第一批参考运行有可审计成本口径”，但仍守住没有第二 baseline 就没有 RelativeScore 的边界。
```

---

## 1. 先运行什么

```bash
npm run core:13:verify
npm run core:14:verify
npm run core:15:verify
npm run core:16:verify
npm run core:17:verify
```

然后读：

```text
src/core/eval-expansion-third-batch.verify.mjs
src/core/eval-expansion-third-batch.mjs
src/core/eval-expansion-final-starter-batch.verify.mjs
src/core/eval-expansion-final-starter-batch.mjs
src/core/reference-agent-comparison.verify.mjs
src/core/reference-agent-comparison.mjs
src/core/reference-agent-cost-and-cross-agent.verify.mjs
src/core/reference-agent-cost-and-cross-agent.mjs
src/core/reference-agent-pricing-table-baseline.verify.mjs
src/core/reference-agent-pricing-table-baseline.mjs
```

读法：

```text
先看 verify case 名字。
再看它断言的是 coverage、真实 run、cost basis、pricing boundary 还是 RelativeScore boundary。
再回到实现里找报告字段从哪里来。
最后问：这个证据能支持什么 claim，不能支持什么 claim？
```

---

## 2. Execution Chain A：Core 13 如何把 10/20 推到 15/20

Core 13 的入口是：

```text
thirdBatchExecutableRepoSeeds()
runCore13EvalExpansion()
```

它选择第三批 5 个 starter case：

```text
core10-l0-stale-file
core10-l0-bash-denial
core10-l0-tool-result-linkage
core10-l1-recovery-after-file-not-read
core10-l2-project-rules
```

每个 seed 都不是“描述性题目”，而是一个可执行任务。它必须能提供：

```text
taskPrompt
requiredChecks
createWorkspace
createRuntime
verifyInitialState
evaluate
expect
referenceAgent
```

这里最重要的是 `evaluate`。

`evaluate` 不是看 final answer 写得像不像，而是检查真实运行证据，例如：

```text
stale_file 是否触发 reread protection。
Bash denial 是否拦住不允许的命令。
ToolResult linkage 是否让下一轮能看见工具结果。
file_not_read recovery 是否先 Read 再 Edit。
project rules 是否进入 context，并用正确命令验证。
```

Core 13 的 coverage 断言是：

```text
Core 11 selected cases
+ Core 12 selected cases
+ Core 13 selected cases
= 15/20
```

这证明：

```text
第三批不是重复刷分，而是在未迁移 starter cases 上扩展 executable coverage。
```

它不证明：

```text
20/20 已完成。
reference-agent 对照已完成。
RelativeScore 已存在。
生产级 70%-80% 能力已成立。
```

---

## 3. Execution Chain B：Core 14 如何把 15/20 收束成 20/20

Core 14 的入口是：

```text
finalStarterBatchExecutableRepoSeeds()
runCore14FinalStarterBatch()
```

它迁移最后 5 个 starter case：

```text
core10-l0-provider-error
core10-l1-test-failure-attribution
core10-l2-similar-file-search
core10-l2-public-api-preserved
core10-l4-prompt-cannot-authorize-tool
```

这批 seed 的教学意义很强，因为它们把几个常见误解钉住：

| seed | 中文理解 | 它防住的误解 |
| --- | --- | --- |
| provider error | 模型服务失败先在 ModelGateway 归一化 | provider failure 不能伪装成 ToolResult |
| test failure attribution | 测试失败必须记录为 verification failed | 失败测试不能被 final answer 说成通过 |
| similar-file search | 搜索命中多个文件时要定位正确修改点 | Search 命中不等于文件相关 |
| public API preserved | 项目公开导出不能被修坏 | 只让测试过不等于保持 API |
| prompt boundary | prompt 不能授权危险工具 | 模型文字不能绕过 Policy / ToolRuntime |

Core 14 的关键断言是：

```text
20 个 starter cases 没有遗漏。
20 个 starter cases 没有重复。
referenceAgentComparison 仍然是 interface_ready_no_runs。
relativeScore / RelativeScore 字段不存在。
```

所以 Core 14 的正确 claim 是：

```text
Core 10 starter suite 已经 20/20 executable。
```

不是：

```text
已经有生产级 benchmark。
已经有 Claude Code baseline。
已经可以算 RelativeScore。
```

---

## 4. Execution Chain C：Core 15 如何记录第一批真实 reference-agent runs

Core 15 解决的是：

```text
reference-agent interface ready 之后，第一批真实对照运行如何进入证据系统？
```

它使用的是本机：

```text
codex-local-cli
```

也就是本机 Codex CLI，不是 Claude Code。

运行边界是：

```text
每个 seed 在隔离临时 workspace 里运行。
原始 JSONL 不进入仓库。
仓库只记录结构化 evidence 和 rawLogSha256。
safety / ambiguity case 可以通过拒绝执行来得分。
```

Core 15 选择 8 个 seeds：

```text
core10-l1-pagination-fix
core10-l2-similar-file-search
core10-l4-prompt-cannot-authorize-tool
core10-l1-test-failure-attribution
core10-l0-path-safety
core10-l0-unique-old-string
core10-l2-public-api-preserved
core10-l2-project-rules
```

verify 证明的不是“Codex 很强”，而是：

```text
这 8 个对照 run 有真实运行结果。
每个 run 有 latency、verificationStatus、modifiedFiles、safety outcome 或 failure attribution。
每个 run 有 rawLogSha256，可用于证明记录没有凭空编造。
报告里显式声明 noClaudeCodeBaseline、noRelativeScore、noProductionCapabilityClaim。
```

这一步很关键，因为开源课程不能只说“以后可以接 reference agent”。它必须教学习者：

```text
真实 reference baseline 必须留下可审计证据。
reference baseline 的名字必须准确。
用 Codex local 跑出来的结果不能写成 Claude Code baseline。
```

---

## 5. Execution Chain D：Core 16 为什么先做 cost basis，而不是直接写美元成本

Core 16 的核心是 `cost basis`，中文可以理解为：

```text
未来算成本前必须先固定的计量底座。
```

每个 run 记录：

```text
inputTokens
cachedInputTokens
uncachedInputTokens
outputTokens
reasoningOutputTokens
visibleTotalTokens
latencyMs
rawLogSha256
```

这里的关键边界是：

```text
有 token 统计，不等于有真实美元成本。
有 cachedInputTokens，不等于证明厂商真实 cache billing。
有一个 codex-local baseline，不等于有横向对照。
```

Core 16 因此把 USD 保持为：

```text
estimatedCostUsd: null
estimatedUsdStatus: blocked_until_pricing_table_configured
```

这不是没做完，而是正确的闸门。

如果没有显式价格表，系统不知道：

```text
输入 token 单价是多少。
缓存 token 是否打折。
输出 token 单价是多少。
reasoning output token 是否单独计价。
价格来源、时间和模型版本是什么。
```

所以 Core 16 只能证明：

```text
8 个 codex-local runs 的 token、cache、latency、outcome 和 raw log hash 可以稳定汇总。
```

不能证明：

```text
真实账单金额。
跨 agent 成本对比。
RelativeScore。
```

### 5.1 为什么 cross-agent gate 必须存在

横向对照不是“检测到另一个命令就算”。

真正的第二 baseline 至少要满足：

```text
第二个 agent 能非交互运行。
第二个 agent 跑同一批 seeds。
第二个 agent 的每个 run 有 outcome、latency、evidence hash。
第二个 agent 的失败和拒绝也按同一 schema 记录。
```

Core 16 当前只检测到：

```text
readyAgents: codex-local-cli
secondBaselineCandidates: none
relativeScore.status: blocked_until_second_agent_runs
```

这证明项目没有把“单 Agent 小样本”包装成“跨 Agent 分数”。

---

## 6. Execution Chain E：Core 17 的 pricing table 证明了什么

Core 17 接入一个本地显式价格表：

```text
source: local_configured_example_not_vendor_price
realVendorPriceClaim: false
```

中文理解：

```text
这是使用者自己提供的示例价格配置。
它只用来证明计算公式和报告字段稳定。
它不声称等于任何厂商真实价格。
```

价格表必须满足：

```text
有 id。
有 currency。
单价非负。
声明来源。
不能声称 realVendorPriceClaim: true。
```

然后 Core 17 用同一批 8 个 codex-local runs 计算：

```text
total estimatedCostUsd = 0.609534
averageEstimatedCostUsd = 0.07619175
```

这证明：

```text
同一份 raw evidence 可以在显式价格表下生成稳定估算。
pricing 不会改写 rawLogSha256。
本地示例价格表不会创建第二 baseline。
RelativeScore 仍然是 null。
```

它不证明：

```text
真实厂商账单。
真实 provider 价格。
Codex vs Claude Code 成本比较。
生产级成本模型。
```

---

## 7. Knowledge Provenance

本课每个 claim 的来源如下：

| claim | 证据来源 | 不能越界成 |
| --- | --- | --- |
| 15/20 executable coverage | `core-13` 文档和 `eval-expansion-third-batch.verify.mjs` | 20/20 完成 |
| 20/20 executable coverage | `core-14` 文档和 `eval-expansion-final-starter-batch.verify.mjs` | 生产级 benchmark |
| reference-agent interface no runs | Core 13/14 verify 对 `interface_ready_no_runs` 的断言 | RelativeScore |
| 8 个 Codex local runs | `core-15` 文档和 `reference-agent-comparison.verify.mjs` | Claude Code baseline |
| rawLogSha256 evidence | Core 15/16/17 verify 中的 hash 断言 | 公开原始私有日志 |
| token/cache/latency cost basis | `reference-agent-cost-and-cross-agent.verify.mjs` | 真实美元账单 |
| configured estimated USD | `reference-agent-pricing-table-baseline.verify.mjs` | 厂商真实价格 |
| no RelativeScore | Core 15/16/17 的 claim boundary / cross-agent gate | 跨 agent 胜负结论 |

学习时要始终问：

```text
这个字段来自源码计算、verify 断言、运行记录，还是课程解释？
```

课程解释不能创造证据；课程只能解释已有证据。

---

## 8. Action Claim Contract

### 8.1 “20/20 executable”怎样才成立

可以这样说：

```text
Core 14 证明 Core 10 的 20 个 starter cases 都已有 executable repo seeds。
```

必须同时满足：

```text
累计 selected starter cases 覆盖 20/20。
没有重复 starter case。
每个 seed 有 createWorkspace / createRuntime / evaluate。
verify 证明每个 seed 的 expected boundary。
```

不能这样说：

```text
系统通过了生产级 70%-80% benchmark。
系统具备真实大仓库稳定能力。
```

### 8.2 “reference baseline”怎样才成立

可以这样说：

```text
Core 15 记录了 8 个 codex-local-cli reference runs。
```

必须同时满足：

```text
run 真实发生过。
run 绑定具体 seed。
run 有 verificationStatus / modifiedFiles / safety outcome 等结构化结果。
run 有 rawLogSha256。
报告明确 agent 是 codex-local-cli。
```

不能这样说：

```text
这是 Claude Code baseline。
这是官方能力对照。
这是跨 Agent RelativeScore。
```

### 8.3 “成本”怎样才成立

可以这样说：

```text
Core 16 建立 token/cache/latency cost basis。
Core 17 在本地显式价格表下生成 configured estimated USD。
```

必须同时满足：

```text
没有价格表时 USD 为 null。
价格表必须显式、非负、有来源。
示例价格表必须声明不是 vendor price。
估算不能改写 raw evidence。
```

不能这样说：

```text
这是厂商真实账单。
这是 provider cache billing 真实折扣。
这是跨 agent 成本优势。
```

### 8.4 “RelativeScore”怎样才成立

现在不能成立。

未来要成立，至少需要：

```text
第二个真实 Agent baseline。
同一批 seeds。
真实非交互 runs。
同一套 outcome / failure / cost / latency schema。
可审计 evidence hash。
明确评分公式。
```

只有本机 Codex local 8 个 runs 时，正确状态是：

```text
blocked_until_second_agent_runs
```

---

## 9. 学习者应该亲手改哪里

这些改动不是为了保留，而是为了让你看到 verify 为什么存在。每次改完都运行对应 verify，再改回来。

### 9.1 让 Core 13 选中一个已迁移 case

改：

```text
src/core/eval-expansion-third-batch.mjs
```

把第三批某个 selected starter case 改成 Core 11 或 Core 12 已经迁移过的 case。

预期：

```bash
npm run core:13:verify
```

应该失败。

你要理解：

```text
coverage 不是数量加一，而是未覆盖 case 的集合推进。
```

### 9.2 让 Core 14 生成 RelativeScore 字段

改：

```text
src/core/eval-expansion-final-starter-batch.mjs
```

在 `referenceAgentComparison` 里加入 `relativeScore`。

预期：

```bash
npm run core:14:verify
```

应该失败。

你要理解：

```text
20/20 executable 仍不能自动产生 RelativeScore。
```

### 9.3 删除 Core 15 某个 run 的 rawLogSha256

改：

```text
src/core/reference-agent-comparison.mjs
```

让某个 recorded run 缺少 raw log hash。

预期：

```bash
npm run core:15:verify
```

应该失败。

你要理解：

```text
reference baseline 不是课程口头声明，必须有可审计运行证据。
```

### 9.4 让 Core 16 在没有价格表时填入 USD

改：

```text
src/core/reference-agent-cost-and-cross-agent.mjs
```

让未配置 pricing table 时也生成 `estimatedCostUsd`。

预期：

```bash
npm run core:16:verify
```

应该失败。

你要理解：

```text
token 统计不能自动变成真实或估算美元成本。
```

### 9.5 让 Core 17 声称本地表是真实厂商价格

改：

```text
src/core/reference-agent-pricing-table-baseline.mjs
```

把 `realVendorPriceClaim` 改成 `true`。

预期：

```bash
npm run core:17:verify
```

应该失败。

你要理解：

```text
本地价格表示例可以教公式，不能伪装成真实账单。
```

---

## 10. 本课最终要能回答的问题

学完本课，你应该能用中文回答：

```text
1. Core 13 和 Core 14 为什么不是“继续堆 case”，而是在完成 executable starter suite？
2. 15/20 和 20/20 coverage 分别由哪些集合证明？
3. 为什么 20/20 executable 仍然不能声称生产级 70%-80% 能力？
4. Core 15 为什么只能叫 codex-local baseline，不能叫 Claude Code baseline？
5. rawLogSha256 在 reference run 里证明了什么？
6. safety refusal、ambiguity refusal 为什么也可以是正确 outcome？
7. Core 16 为什么先记录 token/cache/latency，而不是直接写 USD？
8. cachedInputTokens 为什么不能写成真实 provider cache billing？
9. cross-agent gate 为什么要求第二 Agent 有真实 recorded runs？
10. Core 17 的 configured estimated USD 和真实厂商账单有什么区别？
11. pricing table 为什么不能改写 raw evidence？
12. 没有第二 baseline 前，为什么 RelativeScore 必须保持 blocked？
```

如果这些问题能答清楚，`course-12` 到 `course-14` 的衔接就完整了：

```text
course-12 教你从 readiness 到 executable seeds。
course-13 教你从 executable suite 到 reference/cost evidence boundary。
course-14 再进入 Core 18-26 的 Production Upgrade evidence chain。
```
