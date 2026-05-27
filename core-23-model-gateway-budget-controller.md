# Core 23 Production ModelGateway + Budget Controller：让模型调用先过预算和 provider 决策

> 本 Core 接在 `core-22-tool-runtime-transaction.md` 后面。
>
> Core 02 / 07 / 16 / 17 / 18 已经证明：
>
> ```text
> ModelGateway 可以替换 ScriptedFixModel，并校验模型输出。
> 真实模型 adapter 可以映射到本地 tool_call / final_answer。
> token、cached token、latency 和本地 pricing table 可以形成 cost basis。
> Context Economy 可以提供 deterministic token/cache evidence。
> ```
>
> Core 23 验证：
>
> ```text
> 每次模型调用都必须留下预算决策、provider 决策、retry/fallback 证据和 capability 过滤证据。
> ```

---

## 1. 本 Core 解决什么问题

Core 02 的 ModelGateway 已经能把 provider 输出变成本地 Runtime 事件，但生产化调用还需要回答：

```text
请求是否在 token budget 内？
估算 cost 是否超过本地预算？
超过 cost 时能否降级到 cheaper fallback？
429 / timeout 这类 retryable failure 是否按策略 retry？
schema / tool invalid 这类 non-retryable failure 是否停止，而不是盲目 retry？
provider 不支持的 tool / streaming / reasoning 是否不会暴露给模型？
可修复的 JSON tool_call 文本是否能修复后再过 schema？
```

Core 23 把这些问题做成 deterministic local gateway evidence。

---

## 2. 当前实现位置

代码：

```text
src/core/model-gateway-budget-controller.mjs
src/core/model-gateway-budget-controller.verify.mjs
```

运行：

```bash
npm run core:23
npm run core:23:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. 核心机制

### 3.1 BudgetController

`BudgetController.assess()` 会在 provider 调用前估算：

```text
inputTokens
cachedInputTokens
uncachedInputTokens
outputTokens
totalTokens
estimatedCostUsd
```

超过 token budget 时返回：

```text
token_budget_exceeded
action=compact_or_reduce_context_before_model_call
```

超过 cost budget 时返回：

```text
cost_budget_exceeded
action=try_cheaper_fallback_or_ask_for_budget
```

verify 会断言 oversized request 在 provider adapter index 仍为 0 时就被拦截。

### 3.2 ProviderCapabilityRegistry

`ProviderCapabilityRegistry` 记录 provider / model 能力：

```text
toolCalls
streaming
reasoning
supportedTools
maxInputTokens
```

`BudgetedModelGateway` 会按 registry 过滤 request：

```text
不支持 toolCalls -> tools=[]
只支持部分 tools -> 只暴露 supportedTools
不支持 reasoning -> reasoning=null
```

能力不靠 prompt 约束，而由 gateway 构造 ModelRequest 时强制执行。

### 3.3 Retry / Fallback

Core 23 把 provider failure 分为：

```text
retryable: rate_limit, timeout, provider_unavailable, selected HTTP 429/5xx codes
non-retryable: unknown_tool, invalid_tool_input, invalid_model_json, schema errors
```

retryable failure 会按 `retryPolicy.maxRetries` 重试，并留下：

```text
provider.attempt
provider.failed
retry.scheduled
provider.succeeded
```

如果 primary provider 在预算内但 retryable failure 耗尽，gateway 可以转向 fallback provider。

### 3.4 Cost Downgrade

Core 23 使用本地显式示例价格表：

```text
source=local_configured_example_not_vendor_price
realVendorPriceClaim=false
```

verify 构造 expensive primary 和 cheap fallback：

```text
expensive primary 因 cost_budget_exceeded 被跳过
cheap fallback 被调用并返回 tool_call
```

这证明的是本地 deterministic cost decision，不是真实厂商账单。

### 3.5 Output Repair Boundary

`collectBudgetedModelOutput()` 可以修复一种窄范围 JSON 错误：

```text
remove_trailing_commas
```

修复后仍必须通过 `validateToolCall()`：

```text
tool name 必须存在
required input 必须齐全
unknown tool 不会进入 ToolRuntime
```

repair 不能绕过 schema，也不会把不可修复输出当作成功。

### 3.6 边界

Core 23 证明的是：

```text
本地 deterministic gateway 可以在 provider 调用前检查 token/cost budget，
可以 retry/fallback，
可以按 capability registry 过滤 request，
可以修复窄范围 JSON tool_call 输出并重新过 schema。
```

它不证明：

```text
真实 provider SLA。
真实厂商账单。
完整生产级 provider router。
完整模型输出修复系统。
生产级 Claude Code 70%-80% 能力。
```

---

## 4. 验证点

`npm run core:23:verify` 覆盖 9 个 case：

```text
1. core23: budgeted gateway demo runs and verifies
2. token budget gate: oversized request is blocked before provider call
3. cost budget gate: expensive primary is skipped for cheaper fallback
4. retryable failure: mock rate limit and timeout are retried
5. non-retryable failure: invalid tool schema is not retried
6. fallback: primary failover uses fallback provider
7. capability registry: unsupported tools and streaming are not exposed
8. output repair boundary: repairable JSON becomes schema-valid tool call
9. boundary: gateway budget evidence is local and not production claim
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| demo | budget decision、retry trace 和 provider decision 可运行 |
| token budget gate | oversized request 在 provider call 前被拒绝 |
| cost budget gate | expensive primary 可被 cost gate 跳过并降级到 cheaper fallback |
| retryable failure | rate_limit / timeout 会按策略 retry |
| non-retryable failure | invalid tool schema 不会被盲目 retry |
| fallback | primary retryable failure 后 fallback provider 被使用 |
| capability registry | unsupported tools / streaming / reasoning 不暴露 |
| output repair boundary | 可修复 JSON 仍必须 schema-valid |
| boundary | 本 Core 是本地证据，不是真实 provider / billing / full gateway claim |

---

## 5. 做完本 Core 后得到什么

做完 Core 23 后，项目得到：

```text
一个可解释的 budgeted model gateway layer。
```

它能解释：

```text
为什么本次 provider 调用被允许或拒绝。
估算 token / cost basis 是什么。
为什么 primary 被 retry、跳过或 fallback。
本轮暴露给模型的 provider capability 是什么。
模型输出是否经过 repair，以及 repair 后是否仍过 schema。
```

这让 Core 24 的 Durable Session Store + Replay 可以把 model budget 和 provider decision 写进可恢复事实流。

---

## 6. 下一步

Core 23 之后进入：

```text
Core 24: Durable Session Store + Replay
```

最小动作：

```text
把 session 从内存状态升级为 append-only event log、snapshot restore、trace replay 和 secret-safe recovery evidence。
```
