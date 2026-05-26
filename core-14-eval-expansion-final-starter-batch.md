# Core 14 Eval Expansion Final Starter Batch：最终 starter seed 批次

> 本 Core 接在 `core-13-eval-expansion-third-batch.md` 后面。
>
> Core 13 已经证明：
>
> ```text
> 第三批 5 个 starter case 可以变成 executable repo seeds，
> 累计 executable starter coverage 从 10/20 提升到 15/20，
> reference-agent comparison 仍保持 interface_ready_no_runs，不伪造 RelativeScore。
> ```
>
> Core 14 验证：
>
> ```text
> 剩余 5 个 starter case 可以变成 executable repo seeds，
> 累计 executable starter coverage 从 15/20 提升到 20/20，
> reference-agent comparison 仍保持 interface_ready_no_runs，不伪造 RelativeScore。
> ```

---

## 1. 本 Core 解决什么问题

Core 10 定义了 20 个 starter cases。

Core 11 到 Core 13 已经迁移了 15 个 executable seeds。

Core 14 迁移最后 5 个，选择的是：

```text
core10-l0-provider-error
core10-l1-test-failure-attribution
core10-l2-similar-file-search
core10-l2-public-api-preserved
core10-l4-prompt-cannot-authorize-tool
```

这批覆盖：

```text
provider failure normalization
test failure attribution
similar-file search disambiguation
public API preservation
prompt boundary cannot authorize unsafe tools
```

---

## 2. 当前实现位置

代码：

```text
src/core/eval-expansion-final-starter-batch.mjs
src/core/eval-expansion-final-starter-batch.verify.mjs
```

运行：

```bash
npm run core:14
npm run core:14:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. 当前实现了什么

### 3.1 final batch seed contract

`finalStarterBatchExecutableRepoSeeds()` 返回 5 个 seed。

每个 seed 绑定一个 Core 10 starter case，并声明：

```text
id
starterCaseId
name
taskPrompt
requiredChecks
createWorkspace
createRuntime
verifyInitialState
expect
evaluate
referenceAgent
```

### 3.2 累计 coverage

Core 14 把累计迁移数量从：

```text
15/20
```

推进到：

```text
20/20
```

计算方式：

```text
CORE11_SELECTED_STARTER_CASES
  + CORE12_SELECTED_STARTER_CASES
  + CORE13_SELECTED_STARTER_CASES
  + CORE14_SELECTED_STARTER_CASES
```

并验证 20 个 starter case 没有重复、没有遗漏。

### 3.3 reference-agent 边界

Core 14 仍然只保留 runner contract：

```text
status = interface_ready_no_runs
runs = []
result = null
```

并显式验证：

```text
referenceAgentComparison 没有 relativeScore / RelativeScore 字段。
```

这说明：

```text
20/20 starter executable 已完成，
但还没有真实 reference-agent comparison runs，
所以仍然不能生成 RelativeScore。
```

---

## 4. 验证点

`npm run core:14:verify` 覆盖 7 个 case：

```text
1. core14: final executable starter batch runs and verifies
2. seed contract: final batch binds only to remaining Core 10 cases
3. coverage: executable starter coverage is now 20 of 20
4. reference-agent: interface remains ready with no RelativeScore
5. L0 seed: provider error is normalized before tool execution
6. L1/L2 seeds: failure attribution and similar-file search are executable
7. L2/L4 seeds: public API and prompt boundary are enforced
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| final batch report | 最后 5 个 seed 可执行、可评分、全通过 |
| seed contract | final batch 只绑定前面没有迁移过的 Core 10 starter case |
| coverage | 累计 executable starter coverage 达到 20/20 |
| reference-agent | 没有真实 runs 时不伪造 RelativeScore |
| provider error | provider failure 在 ModelGateway 边界归一化，不进入 ToolRuntime |
| failure/search | 测试失败能进入 verificationState；多候选搜索能定位正确文件 |
| API/prompt | 公开 API export 被保留；prompt 不能授权危险 Bash |

---

## 5. 本 Core 没证明什么

Core 14 没有证明：

```text
reference-agent comparison runs。
RelativeScore。
120-case benchmark。
生产级 70%-80% 能力。
真实大仓库长任务稳定性。
cost / latency / human review metrics。
```

它只证明：

```text
Core 10 的 20 个 starter case 已经全部有 executable repo seed。
```

---

## 6. 课程层面的学习契约

本 Core 对应 course-12 后续工程推进。

你在 Core 14 要学到：

```text
Eval Expansion 的第一阶段收束点是 20/20 starter executable。
20/20 executable 不是 RelativeScore。
Provider、Policy、Context、Repo Rule 和 Verification 的边界都必须有 seed evidence。
reference-agent 对照必须等真实 run 产生后才能记录 score/cost/latency/notes。
```

### 6.1 Product Question

Core 14 解决的问题是：

```text
如何把 starter eval suite 从 readiness mapping 完整推进为可执行、可评分、可归因的 seed suite？
```

### 6.2 Gate Check

学完 Core 14 后，你应该能回答：

```text
1. Core 14 迁移了哪 5 个 starter case？
2. 为什么 provider error seed 不应该进入 ToolRuntime？
3. 测试失败归因和 verification_missing 有什么区别？
4. similar-file search seed 如何证明模型定位了正确文件？
5. public API preserved seed 为什么要读取项目规则？
6. prompt cannot authorize tool seed 为什么属于 L4？
7. 20/20 executable 和 RelativeScore 的区别是什么？
8. 为什么下一步才是 reference-agent comparison runs？
```

---

## 7. 下一步

Core 14 之后，下一步应该进入：

```text
Reference-Agent Comparison Pass
```

目标：

```text
在不伪造结果的前提下，选择小样本 seed 运行 reference-agent 对照，
记录 score、failureType、cost、latencyMs 和 notes，
再讨论 RelativeScore 的计算口径。
```
