# Core 17 Reference-Agent Pricing Table Baseline：显式价格表估算基线

> 本 Core 接在 `core-16-reference-agent-cost-and-cross-agent.md` 后面。
>
> Core 16 已经证明：
>
> ```text
> 8 个 codex-local sample runs 已有 token/cache/latency/hash cost basis；
> 没有 pricing table 时 estimatedCostUsd 必须保持 null；
> 没有第二 agent 真实 runs 前不生成 RelativeScore。
> ```
>
> Core 17 验证：
>
> ```text
> 可以给同一批 codex-local runs 接入一个显式本地 pricing table，
> 生成稳定的 per-run 和 total estimated USD，
> 但这个估算不是厂商真实账单，也不创建第二 baseline 或 RelativeScore。
> ```

---

## 1. 本 Core 解决什么问题

Core 16 已经有 `estimateCostUsd` 函数，但默认状态仍是：

```text
pricingTableConfigured: false
estimatedCostUsd: null
```

Core 17 把它推进为一个可运行 baseline：

```text
给 pricing table 明确 schema。
验证 pricing table 必须显式配置、非负、带来源。
本地示例表不能声称真实 vendor price。
用同一份 raw evidence 计算每个 run 的 estimatedCostUsd。
汇总 8-run total estimatedCostUsd。
继续阻止 RelativeScore，直到第二 agent 有真实 runs。
```

---

## 2. 当前实现位置

代码：

```text
src/core/reference-agent-pricing-table-baseline.mjs
src/core/reference-agent-pricing-table-baseline.verify.mjs
```

运行：

```bash
npm run core:17
npm run core:17:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. Pricing Table 边界

Core 17 使用本地显式示例表：

```text
id: local-example-codex-cost-table-2026-05-27
currency: USD
source: local_configured_example_not_vendor_price
realVendorPriceClaim: false
uncachedInputUsdPer1M: 2
cachedInputUsdPer1M: 0.5
outputUsdPer1M: 8
reasoningOutputTreatment: separate
reasoningOutputUsdPer1M: 8
```

这个表只证明：

```text
当使用者显式提供价格表时，系统可以稳定计算 estimated USD。
```

它不证明：

```text
Codex CLI 的真实厂商价格。
真实账单金额。
Claude Code 或其他 agent 的成本。
跨 agent RelativeScore。
```

---

## 4. 8 个 Codex Local Runs 估算

Core 17 沿用 Core 15 / Core 16 的 8 个样本。

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
| estimatedCostUsd | 0.609534 |
| averageEstimatedCostUsd | 0.07619175 |

每个 run 的估算：

| run | estimatedCostUsd |
| --- | ---: |
| codex-local-20260526-core11-pagination | 0.078556 |
| codex-local-20260526-core14-similar-file | 0.131522 |
| codex-local-20260526-core14-prompt-boundary | 0.030142 |
| codex-local-20260526-core14-test-failure | 0.044632 |
| codex-local-20260526-core12-path-safety | 0.059356 |
| codex-local-20260526-core12-unique-old-string | 0.036888 |
| codex-local-20260526-core14-public-api | 0.087186 |
| codex-local-20260526-core13-project-rules | 0.141252 |

---

## 5. 验证点

`npm run core:17:verify` 覆盖 7 个 case：

```text
1. core17: pricing table baseline runs and verifies
2. pricing table contract: local table is explicit and bounded
3. per-run estimates: all 8 codex-local runs have configured USD estimates
4. totals: configured estimate sums are stable
5. evidence boundary: pricing does not rewrite raw run hashes
6. relative score boundary: pricing table does not create a second baseline
7. pricing validation: invalid local table is rejected
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| pricing baseline | Core 17 report 可以生成并验证 |
| pricing contract | 本地价格表显式、非负、不声称真实厂商价格 |
| per-run estimates | 8 个 codex-local runs 都有 configured USD estimate |
| totals | token、latency 和 estimated USD 汇总稳定 |
| evidence boundary | pricing 不改写 rawLogSha256 |
| relative boundary | pricing table 不会创建第二 baseline 或 RelativeScore |
| validation | 伪装真实 vendor price 或负数价格会被拒绝 |

---

## 6. 做完本 Core 后的结果

做完 Core 17 后，项目得到：

```text
一个 pricing-table-ready 的 codex-local baseline。
```

具体来说：

```text
8 个 Codex local sample runs 都有 token/cache/latency/hash evidence。
同一份 evidence 可以在显式 pricing table 下生成 estimatedCostUsd。
当前示例 total estimatedCostUsd 为 0.609534。
raw evidence 不被改写。
```

仍然不应该得到：

```text
真实厂商账单金额。
Claude Code baseline。
Codex vs Claude Code RelativeScore。
生产级 70%-80% 能力声明。
```

---

## 7. 下一步

Core 17 之后，下一步优先方向是：

```text
建立第二 reference-agent baseline。
```

最小动作：

```text
安装或配置第二个可非交互运行的 coding agent。
对同一批 8 个 seeds 跑真实 runs。
用同一 schema 对比 score、failureType、verificationStatus、latencyMs、token/cost basis、安全结果和 notes。
```

边界保持：

```text
没有第二 agent 真实 runs 前，不生成 RelativeScore。
如果要把本地示例价格替换成真实厂商价格，必须明确来源、模型、时间和价格表版本。
```
