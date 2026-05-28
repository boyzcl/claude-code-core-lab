# Core 16 Reference-Agent Cost + Cross-Agent：Cost 口径与横向对照闸门

> 本 Core 接在 `core-15-reference-agent-comparison.md` 后面。
>
> Core 15 已经证明：
>
> ```text
> 本机 Codex CLI 可以作为第一阶段 codex-local reference-agent baseline，
> 对 8 个 executable seeds 产生真实 run evidence，
> 但它不是 Claude Code baseline，也不能生成 RelativeScore。
> ```
>
> Core 16 验证：
>
> ```text
> 可以为这 8 个 runs 建立稳定 cost 计量口径，
> 但没有配置价格表时不估算 USD；
> 当前本机只有 codex-local 有 recorded runs，
> 所以横向对照和 RelativeScore 仍被第二 agent baseline 阻塞。
> ```

---

## 1. 本 Core 解决什么问题

Core 15 的 runner contract 已经有：

```text
score
failureType
costUsd
latencyMs
notes
```

但当时 cost 只记录为：

```text
costUsd: null
costStatus: not_reported_by_cli
```

Core 16 把它推进到更可解释的一层：

```text
不伪造美元成本。
不把 Codex local 当 Claude Code。
不在单 baseline 下生成 RelativeScore。
先把 token、cache、latency、hash evidence 和未来 pricing table 接口固定下来。
```

---

## 2. 当前实现位置

代码：

```text
src/core/reference-agent-cost-and-cross-agent.mjs
src/core/reference-agent-cost-and-cross-agent.verify.mjs
```

运行：

```bash
npm run core:16
npm run core:16:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. Cost 计量口径

Core 16 的 cost schema 是：

```text
version: core16-cost-v1
```

每个 run 记录：

```text
inputTokens
cachedInputTokens
uncachedInputTokens = inputTokens - cachedInputTokens
outputTokens
reasoningOutputTokens
visibleTotalTokens = inputTokens + outputTokens
latencyMs
rawLogSha256
```

美元估算公式预留为：

```text
USD cost =
  uncachedInputTokens * uncachedInputUsdPer1M / 1e6
+ cachedInputTokens * cachedInputUsdPer1M / 1e6
+ outputTokens * outputUsdPer1M / 1e6
```

`reasoningOutputTokens` 当前单独追踪。只有 pricing table 明确声明 `reasoningOutputTreatment: "separate"` 时，才额外计入 reasoning output 价格。

当前结果：

```text
pricingTableConfigured: false
estimatedCostUsd: null
estimatedUsdStatus: blocked_until_pricing_table_configured
```

这表示：

```text
已有足够 token 输入用于未来估价；
但现在没有价格表，所以不能写入美元成本。
```

---

## 4. 8 个 Codex Local Runs 汇总

Core 16 沿用 Core 15 的 8 个样本：

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

汇总结果：

| metric | value |
| --- | ---: |
| runs | 8 |
| inputTokens | 660067 |
| cachedInputTokens | 523904 |
| uncachedInputTokens | 136163 |
| outputTokens | 7233 |
| reasoningOutputTokens | 2174 |
| visibleTotalTokens | 667300 |
| latencyMs | 362003 |
| averageLatencyMs | 45250.375 |

解释：

```text
现在能比较“同一组任务下，一个 agent 花了多少 token、多少延迟、是否通过、失败类型是什么”。
现在还不能比较“谁更便宜的美元成本”，因为没有稳定 pricing table。
```

---

## 5. 横向对照当前状态

本机候选 agent snapshot：

| agent | command | status |
| --- | --- | --- |
| codex-local-cli | `codex` | ready_with_recorded_runs |
| claude-code-cli | `claude-code` | not_installed |
| claude-cli | `claude` | not_installed |
| opencode-cli | `opencode` | not_installed |
| aider-cli | `aider` | not_installed |
| cursor-agent-cli | `cursor-agent` | not_installed |
| gemini-cli | `gemini` | not_installed |
| qwen-cli | `qwen` | not_installed |
| openai-cli | `openai` | not_installed |

当前 readiness：

```text
crossAgentReadiness.status: single_baseline_only
readyAgents: codex-local-cli
secondBaselineCandidates: none
relativeScore.status: blocked_until_second_agent_runs
```

结论：

```text
横向对照的表结构、字段和闸门已经准备好。
但当前还没有第二个真实 agent baseline。
所以不能算 Codex vs Claude Code，也不能算 RelativeScore。
```

---

## 6. 验证点

`npm run core:16:verify` 覆盖 7 个 case：

```text
1. core16: cost and cross-agent report runs and verifies
2. cost basis: every recorded run has token, latency, outcome, and hash evidence
3. totals: token and latency sums are stable for the 8-run codex-local sample
4. pricing boundary: USD remains null without a configured price table
5. pricing option: configured pricing table can estimate a run without changing raw evidence
6. cross-agent gate: only codex-local has recorded runs on this machine snapshot
7. cross-agent option: a second agent needs recorded runs before RelativeScore can exist
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| cost report | Core 16 report 可以从 Core 15 runs 构造并验证 |
| cost basis | 每个 run 都有 token、latency、outcome 和 raw log hash |
| totals | 8-run token 和 latency 汇总稳定 |
| pricing boundary | 没有 pricing table 时 USD 必须保持 null |
| pricing option | 未来接入价格表后可以估算，且不改变原始 evidence |
| cross-agent gate | 当前只有 codex-local 有 recorded runs |
| second-agent option | 第二 agent 仅被检测到还不够，必须有真实 runs 才能算 RelativeScore |

---

## 7. 做完本 Core 后的预期结果

做完 Core 16 后，项目会得到：

```text
一个 cost-ready 的 codex-local baseline。
```

具体来说：

```text
8 个 Codex local sample runs 都能被稳定汇总 token、cache、latency、outcome 和 evidence hash。
如果后续配置 pricing table，可以从同一份 evidence 估算 USD。
如果没有 pricing table，USD 保持 null，不伪造成本。
```

横向对照层面的预期是：

```text
现在只能得到单 agent baseline。
接入第二个非交互式 coding agent 并跑同一批 seeds 后，
才会得到真正的横向比较表：

agent
seed
score
failureType
verificationStatus
latencyMs
token/cost basis
safety outcome
notes
```

仍然不应该得到：

```text
Claude Code baseline。
Codex vs Claude Code RelativeScore。
生产级 70%-80% 能力声明。
```

---

## 8. 下一步

Core 16 之后，下一步有两个可选方向：

```text
如果只继续用本机 Codex：
  配置明确 pricing table，生成 estimatedCostUsd，但仍不做 RelativeScore。

如果要做横向对比：
  安装或配置第二个非交互式 coding agent，
  对同一批 8 个 seeds 跑真实 runs，
  再比较 pass rate、failureType、latencyMs、token/cost basis 和安全结果。
```

无论走哪条路，仍保持边界：

```text
没有第二 agent 真实 runs 前，不生成 RelativeScore。
没有价格表前，不生成 USD cost。
```
