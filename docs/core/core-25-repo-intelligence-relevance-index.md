# Core 25 Repo Intelligence + Relevance Index：把上下文输入升级为 repo-aware relevance

> 本 Core 接在 `core-24-durable-session-store-replay.md` 后面。
>
> Core 09 / 18 / 21 / 24 已经证明：
>
> ```text
> CoreRuntime 可以在真实 repo fixture 中读取规则、发现测试并修复文件。
> Context Economy 可以解释 token / cache / eviction。
> Long-Running Task Eval 可以记录多轮状态和成本曲线。
> Durable Session Store 可以把运行事实持久化并 replay。
> ```
>
> Core 25 验证：
>
> ```text
> Context Engine 的输入可以来自可解释的 repo map、symbol/test/rule index 和 relevance scoring，而不是只靠全文搜索命中。
> ```

---

## 1. 本 Core 解决什么问题

大仓库任务中，模型需要的不只是“哪些文件包含关键词”，而是：

```text
哪些文件是实现入口？
哪些 symbol 和用户目标相关？
哪些测试文件和测试命令能验证目标文件？
哪些项目规则必须高优先级进入上下文？
相似文件很多时，为什么这个文件排第一？
文件改动后，索引能否局部刷新？
repo-aware selection 是否用更少 token 选中正确文件？
```

Core 25 把这些问题做成 deterministic local repo relevance evidence。

---

## 2. 当前实现位置

代码：

```text
src/core/repo-intelligence-relevance-index.mjs
src/core/repo-intelligence-relevance-index.verify.mjs
```

运行：

```bash
npm run core:25
npm run core:25:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. 核心机制

### 3.1 Repo Map

`RepoIntelligenceIndex.buildIndex()` 会扫描 fixture repo，记录：

```text
file path
kind
line count
hash
token estimate
package scripts
rule entrypoints
```

verify 会确认 `src/pagination.cjs`、`package.json`、`AGENTS.md` 和测试脚本都进入 repo map。

### 3.2 Symbol Index

索引器会从 CommonJS fixture 中提取：

```text
function symbols
module.exports exports
require references
```

verify 会确认 exported `paginate` 位于 `src/pagination.cjs`，并且 `tests/pagination.test.cjs` 直接引用它。

### 3.3 Test Index

测试索引会关联：

```text
package.json scripts
tests/*.test.cjs
source -> test association
```

这让系统能解释“修改这个实现文件后，应该看哪些测试和命令”。

### 3.4 Rule Discovery

`AGENTS.md` 和 `README.md` 中的规则会进入 `ruleIndex`：

```text
Preserve public API exports.
Use npm test before final.
Public API names must stay stable.
```

涉及 public API、test、preserve 的规则会被标为 high priority。

### 3.5 Relevance Scoring

`scoreRelevance()` 会按多类证据打分：

```text
term overlap
symbol match
test association
targeted test
rule priority
test command
doc penalty
```

verify 构造多个相似文件，确认 `src/pagination.cjs` 高于 `src/cart.cjs`，并留下 reasons。

### 3.6 Incremental Update

`updateFiles()` 会在文件变化后只刷新指定 path，并记录：

```text
changedPaths
updatedFileCount
reusedFileCount
before / after hash
```

verify 会修改 `src/pagination.cjs`，证明 hash 改变且其他文件被复用。

### 3.7 Token Benefit

`compareTokenBenefit()` 会对比：

```text
naive keyword context
repo-indexed selected context
```

verify 证明 indexed selection 用更少 token 选中 `src/pagination.cjs`、规则和相关测试。

### 3.8 边界

Core 25 证明的是：

```text
本地 deterministic repo index 可以构建 repo map、symbol/test/rule index、relevance scoring、incremental update 和 token benefit evidence。
```

它不证明：

```text
完整语义 embedding 检索。
任意超大仓库的生产级索引。
真实 IDE / LSP 全量符号能力。
生产级 Claude Code 70%-80% 能力。
```

---

## 4. 验证点

`npm run core:25:verify` 覆盖 9 个 case：

```text
1. core25: repo intelligence demo runs and verifies
2. repo map: fixture files, scripts, and rule entries are indexed
3. symbol index: exported symbol and references can be located
4. test index: package scripts and test files are associated
5. rule discovery: AGENTS and README rules enter high priority index
6. relevance scoring: correct file ranks above similar files
7. incremental update: modified file refreshes without full reindex
8. token benefit: indexed context selects correct file with fewer tokens
9. boundary: repo intelligence is local evidence, not production search
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| demo | repo map、symbol/test/rule index、relevance、token benefit 可一起运行 |
| repo map | 文件、脚本和规则入口进入索引 |
| symbol index | exported symbol 和引用可定位 |
| test index | 测试命令、测试文件和 source association 可解释 |
| rule discovery | 项目规则进入 high priority index |
| relevance scoring | 相似文件中正确实现文件排序更高 |
| incremental update | 单文件变化可以局部刷新并留 hash evidence |
| token benefit | indexed selection 用更少 token 选中正确文件 |
| boundary | 本 Core 是本地证据，不是生产级搜索系统 |

---

## 5. 做完本 Core 后得到什么

做完 Core 25 后，项目得到：

```text
一个 repo-aware relevance evidence layer。
```

它能解释：

```text
为什么这个文件相关。
哪些 symbol 支撑相关性。
哪些测试和脚本验证该文件。
哪些规则必须随任务进入上下文。
文件变更后索引刷新了什么。
为什么 indexed context 比 naive search 更省 token。
```

这让 Core 26 的 Human Approval + Interruption Protocol 可以把高风险动作、用户打断和 handoff 建立在更准确的 repo evidence 上。

---

## 6. 下一步

Core 25 之后进入：

```text
Core 26: Human Approval + Interruption Protocol
```
