# Core 10：70%-80% Eval + Open Source Packaging

日期：2026-05-25

本阶段目标不是继续增加 Agent 功能，而是把 Core 01 到 Core 09 的成果整理成可复刻、可验证、可开源的最小交付层。

一句话：

```text
Core 10 proves the project now has a starter task suite, readiness scoring, failure taxonomy, and docs authority layer; it is not a production 70%-80% claim.
```

## 1. 为什么需要 Core 10

Core 01 到 Core 09 已经证明了：

```text
Search -> Read -> Edit -> Bash -> FinalAnswer 可以闭环。
ModelGateway 可以接真实模型 API。
Context / Plan / Compaction / Eval / Prompt Pack / Real Repo Task Layer 都已接入最小 Runtime。
DeepSeek live E2E 可以用本地工具完成真实验证。
```

但这些仍然不能直接推出：

```text
已经达到 Claude Code / Codex-like 产品 70%-80% 能力。
```

原因：

```text
当前任务数量仍然小。
真实仓库任务主要是受控 fixture。
还没有 reference-agent 对照。
还没有成本、延迟、人工抽检和长期真实任务回归。
```

所以 Core 10 做两件事：

```text
1. 建立 70%-80% 验收的 starter eval packaging。
2. 建立开源项目最小文档入口和 authority map。
```

## 2. 新增文件

代码：

```text
src/core/core-readiness-package.mjs
src/core/core-readiness-package.verify.mjs
```

文档入口：

```text
README.md
AGENTS.md
docs/index.md
docs/authority-map.md
core-10-70-80-eval-open-source-packaging.md
```

脚本：

```bash
npm run core:10
npm run core:10:verify
npm run verify:all
```

## 3. Starter Task Suite

Core 10 定义了 20 个 starter eval case，分布和 `claude-code-70-80-validation-and-model-access.md` 的第一周建议一致：

```text
L0 工具协议：8 个
L1 微型代码：4 个
L2 真实小仓库：5 个
L3 长任务：1 个
L4 安全对抗：2 个
```

这些 case 目前是 readiness case：它们把已有 Lab/Core 证据映射到 70%-80% 评测框架，而不是完整 120-case benchmark。

覆盖的关键主题：

```text
Read before Edit
Edit old_string 多匹配
stale file recovery
path safety
Bash permission denial
provider error normalization
tool result linkage
long output artifact
pagination fix
test failure attribution
file_not_read recovery
context budget pressure
project rules
test command discovery
similar file search
user change reread
public API preserved
plan + compaction continuity
dangerous command denial
prompt cannot authorize unsafe tool
```

## 4. Failure Taxonomy

Core 10 把失败归因收束为 starter taxonomy：

```text
tool_protocol_error
policy_violation
verification_missing
context_missing
compaction_loss
stale_file_recovery_failed
test_command_discovery_failed
provider_failure_unhandled
packaging_authority_gap
```

其中红线类失败包括：

```text
policy_violation
verification_missing
compaction_loss
stale_file_recovery_failed
```

这些红线说明：即使总分足够，也不能把系统声明为可稳定用于真实项目。

## 5. Readiness Score

Core 10 输出的是：

```text
eval_readiness_coverage
```

它衡量的是：

```text
是否已经具备 starter 评测分层、任务覆盖、失败分类、证据映射和文档入口。
```

它不等于：

```text
SystemScore
RelativeScore
Claude Code 70%-80% capability
```

当前 baseline evidence：

```text
Labs: 39/39
Core 01-09: 50/50
total before Core 10: 89/89
```

Core 10 自身通过后，全量验证进入：

```text
96/96 passed
```

## 6. Open Source Packaging

新增最小入口层：

```text
README.md
AGENTS.md
docs/index.md
docs/authority-map.md
```

角色分工：

```text
README.md：项目总入口和常用命令。
AGENTS.md：Agent 工作控制入口、secret 边界和完成定义。
docs/index.md：文档索引，区分 Current Rules / History / Evidence。
docs/authority-map.md：冲突优先级和 canonical doc 声明。
```

关键原则：

```text
当前进度以 CURRENT_STATE.md 为准。
能力声明必须有 verify 脚本或 run record 支撑。
历史分析文章不覆盖当前实现规则。
.env.local 可以用于本地持续测试，但不能进入源码、文档、trace 或公开记录。
```

## 7. 本阶段证明了什么

Core 10 证明：

```text
已有 Core evidence 可以被汇总成 70%-80% 验收框架的 starter coverage。
项目已经有 starter task suite 和 failure taxonomy。
项目已经有 README / docs index / authority map 的最小开源入口。
验证系统明确阻止“已经达到生产 70%-80%”这类过度声明。
verify:all 会覆盖 Core 10。
```

## 8. 本阶段没有证明什么

Core 10 没有证明：

```text
系统已经达到 Claude Code / Codex-like reference agent 的 70%-80% 相对能力。
系统可以直接在任意真实仓库自动完成复杂任务。
当前 Prompt Pack、Context Engine、Compaction、Eval Harness 已经生产级。
当前 DeepSeek live E2E 可以代表长期稳定性。
```

要证明这些，下一阶段需要：

```text
把 20 个 starter case 变成可执行 repo seeds。
扩展到 120 个任务。
加入 reference-agent 对照。
记录成本、延迟、失败类型和人工抽检。
沉淀真实任务 trace 到 regression suite。
```

## 9. 验证命令

```bash
npm run core:10:verify
npm run verify:all
```

目标结果：

```text
core-10: 7/7 passed
full total: 96/96 passed
```
