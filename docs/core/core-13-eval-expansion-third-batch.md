# Core 13 Eval Expansion Third Batch：第三批 executable repo seeds

> 本 Core 接在 `core-12-eval-expansion-second-batch.md` 后面。
>
> Core 12 已经证明：
>
> ```text
> 第二批 5 个 starter case 可以变成 executable repo seeds，
> 累计 10/20 starter case executable，
> reference-agent runner interface 已存在但没有伪造结果。
> ```
>
> Core 13 验证：
>
> ```text
> 第三批 5 个 starter case 可以变成 executable repo seeds，
> 累计 executable starter coverage 从 10/20 提升到 15/20，
> reference-agent comparison 仍保持 interface_ready_no_runs，不伪造 RelativeScore。
> ```

---

## 1. 本 Core 解决什么问题

Core 10 定义了 20 个 starter cases。

Core 11 和 Core 12 已经迁移了 10 个 executable seeds。

Core 13 继续迁移第三批 5 个，选择的是：

```text
core10-l0-stale-file
core10-l0-bash-denial
core10-l0-tool-result-linkage
core10-l1-recovery-after-file-not-read
core10-l2-project-rules
```

这批覆盖：

```text
stale file reread
Bash allowlist denial
ToolResult linkage
file_not_read recovery
project rules visibility
```

---

## 2. 当前实现位置

代码：

```text
src/core/eval-expansion-third-batch.mjs
src/core/eval-expansion-third-batch.verify.mjs
```

运行：

```bash
npm run core:13
npm run core:13:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. 当前实现了什么

### 3.1 第三批 seed contract

`thirdBatchExecutableRepoSeeds()` 返回 5 个 seed。

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

Core 13 把累计迁移数量从：

```text
10/20
```

推进到：

```text
15/20
```

计算方式：

```text
CORE11_SELECTED_STARTER_CASES
  + CORE12_SELECTED_STARTER_CASES
  + CORE13_SELECTED_STARTER_CASES
```

并验证没有重复 starter case。

### 3.3 reference-agent 边界

Core 13 仍然只保留 runner contract：

```text
status = interface_ready_no_runs
runs = []
result = null
```

这说明：

```text
可以准备 reference-agent 输入输出结构，
但没有真实对照运行结果时，不能生成 RelativeScore。
```

---

## 4. 验证点

`npm run core:13:verify` 覆盖 7 个 case：

```text
1. core13: third executable seed batch runs and verifies
2. seed contract: third batch binds to unmigrated Core 10 cases
3. coverage: executable starter coverage is now 15 of 20
4. reference-agent: interface remains ready without fabricated runs
5. L0 seeds: stale, bash denial, and linkage are executable
6. L1 seed: file_not_read recovery is executable
7. L2 seed: project rules enter context and verification passes
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| third batch report | 第三批 5 个 seed 可执行、可评分、全通过 |
| seed contract | 第三批绑定未迁移 starter case，且与前两批无重复 |
| coverage | 累计 executable starter coverage 达到 15/20 |
| reference-agent | 没有真实 runs 时不伪造 reference score |
| L0 seeds | stale_file、bash_denial、tool_result_linkage 都可执行 |
| L1 seed | file_not_read 后能 Read 并恢复到 passed verification |
| L2 seed | AGENTS.md 项目规则能进入 context 并支撑 npm test 验证 |

---

## 5. 本 Core 没证明什么

还没有证明：

```text
20/20 starter case 全部 executable。
reference-agent comparison runs。
RelativeScore。
120-case benchmark。
生产级 70%-80% 能力。
```

剩余 starter case 还需要在后续 Core 14 迁移。

---

## 6. 课程层面的学习契约

本 Core 对应 course-12 后续工程推进。

你在 Core 13 要学到：

```text
Eval Expansion 是一个逐批迁移过程。
每一批都必须声明选中哪些 starter case、证明没有重复、生成 executable score。
每一批都不能把自己的通过率夸大成 RelativeScore 或生产能力声明。
```

### 6.1 Product Question

Core 13 解决的问题是：

```text
如何把 starter eval suite 继续推进到更多可执行、可评分、可归因的 repo seeds？
```

### 6.2 Gate Check

学完 Core 13 后，你应该能回答：

```text
1. 第三批选中了哪 5 个 starter case？
2. 为什么第三批不能和前两批重复？
3. stale_file seed 证明了什么？
4. bash_denial seed 和 dangerous_command seed 有什么区别？
5. tool_result_linkage seed 为什么属于 tool protocol？
6. file_not_read recovery seed 如何证明恢复链路？
7. project_rules seed 如何证明规则进入 context？
8. 15/20 executable 和 RelativeScore 的区别是什么？
```

---

## 7. 下一步

Core 13 之后，下一步应该进入：

```text
Core 14 Eval Expansion Final Starter Batch
```

目标：

```text
把剩余 5 个 starter case 迁移成 executable repo seeds，
把 starter executable coverage 从 15/20 推进到 20/20。
```
