# Course 07 Core Build Pass Overview：从 Core 01 到 Core 12 的完整教学总览

> 本课进入 Teaching Consolidation Pass。
>
> Core 01 到 Core 12 已经完成了学习版 Claude Code Core 的主体构建。
>
> 现在要做的不是继续堆功能，而是把已经做完的 Core Build Pass 讲成一条可复述、可教学、可验证的主线。

---

## 0. 本课解决什么问题

学习者已经理解：

```text
course-01 到 course-06
lab-01 到 lab-08
core-01 的最小 Runtime 骨架
```

但 Core 02 到 Core 12 是一整段连续工程推进。如果只看每个 `core-XX` 文档，会知道“新增了什么”，但不一定能回答：

```text
这些 Core 阶段为什么按这个顺序出现？
每一阶段到底解决哪个产品问题？
哪些能力属于 Runtime 硬边界？
哪些能力属于模型可见上下文？
哪些能力属于 eval 证明体系？
为什么现在说主体构建完成，但还不能说生产级 70%-80% 能力完成？
```

本课就是把 Core 01 到 Core 12 串成一个完整故事。

---

## 1. 先给结论

当前已经完成的是：

```text
Claude Code Core 学习版的主体构建。
```

它已经具备：

```text
Runtime loop
MessageStore
Search / Read / Edit / Bash
Policy
ModelGateway
Context Engine
Plan Mode
Compaction
Trace / Eval Harness
Real Model API adapter boundary
Prompt Pack / Recovery Loop
Real repo fixture task layer
Starter eval packaging
Executable repo seeds
```

但还没有完成：

```text
生产级 Claude Code-like 产品。
完整 120-case benchmark。
reference-agent 相对能力认证。
长期真实仓库回归。
成本、延迟、人工抽检闭环。
```

一句话：

```text
Core 主体已经搭完；后续重点从“构建能力”转向“证明能力、比较能力、扩大回归、持续迭代”。
```

---

## 2. Core Build Pass 的总路线

Core 01 到 Core 12 可以分成六段。

| 阶段 | 主题 | 解决的问题 |
| --- | --- | --- |
| Core 01 | Integrated Runtime | 把 Lab 机制合成最小可运行闭环 |
| Core 02 | Model Gateway | 把 scripted model 替换成可接模型 API 的边界 |
| Core 03 | Context Engine | 控制模型本轮能看见什么 |
| Core 04-05 | Plan + Compaction | 让长任务可计划、可审批、可压缩恢复 |
| Core 06-08 | Trace / Eval / Real Model / Prompt Recovery | 让系统可证明、可接真实模型、可从拒绝中恢复 |
| Core 09-12 | Real Repo + Eval Packaging + Executable Seeds | 把能力推进到 repo fixture 和可执行评测 |

这条路线的核心判断是：

```text
不要先追求“模型更聪明”。
先把模型外面的 Runtime 边界、上下文、工具、状态、验证和 eval 建起来。
```

---

## 3. Product Trace：一条任务如何穿过 Core 12

以一个真实任务为例：

```text
修复分页多返回一个元素的问题，并运行测试。
```

在 Core 12 的心智模型里，这条任务不是一次模型回答，而是一条受控链路。

```text
User Goal
  -> MessageStore append user
  -> Context Engine 组装本轮可见世界
  -> ModelGateway / Model 输出下一步动作
  -> ToolCall schema 校验
  -> Policy / Plan Mode 授权
  -> CoreToolRuntime 执行 Search / Read / Edit / Bash
  -> ToolResult append 到 MessageStore
  -> CoreState 更新 modifiedFiles / verificationState
  -> 必要时 Compaction 保留关键状态
  -> Eval Harness 抽取 evidence
  -> FinalAnswer 必须基于 verificationState
```

如果这条链上任一环缺失，系统都会退化。

例如：

```text
没有 MessageStore，ToolResult 不能成为下一轮 observation。
没有 Read snapshot，Edit 可能覆盖 stale 文件。
没有 Bash allowlist，模型可能执行危险命令。
没有 Context Engine，模型可能被长日志挤掉最新失败。
没有 Eval Harness，系统只能说“看起来不错”，不能归因。
```

---

## 4. Knowledge Provenance

这张表回答：模型为什么知道下一步该怎么做。

| 模型用到的信息 | 来源 | 怎么给模型 | 目标 | 如果不给会怎样 |
| --- | --- | --- | --- | --- |
| 用户要修分页问题 | User Message | user message | 确定任务目标 | 模型不知道要修什么 |
| 当前有哪些工具 | Tool Schema | `tools` 列表 | 允许模型选择 Search / Read / Edit / Bash | 模型无法合法调用工具 |
| Search 结果 | Tool Result | MessageStore -> Context Engine | 找到候选文件 | 模型只能凭空猜文件 |
| 文件内容 | Tool Result | Read result 被选入 context | 让模型基于事实编辑 | 模型可能生成错误 old_string |
| Edit 前必须 Read | Policy + Tool Description | 工具规则和 Runtime 检查 | 防止凭空写文件 | Policy 会拒绝，或发生危险写入 |
| 文件是否 stale | Runtime State | ToolRuntime snapshot，不完全给模型 | 防止覆盖用户新改动 | 可能覆盖用户修改 |
| 计划是否批准 | Runtime State + PlanController | active_plan block / authorization | 决定是否允许写操作 | 模型可能绕过审批直接写 |
| 最新失败 | Tool Result + CoreState | latest_failure block | 引导下一轮恢复 | 模型可能重复无效动作 |
| 验证状态 | CoreState | verification_state block | 决定能否 final answer | 模型可能未验证就声称完成 |
| 长日志 artifact | Context Engine | artifact reference | 保留证据但不挤占上下文 | 关键上下文被长输出挤掉 |
| 项目规则 | Project Rules | AGENTS.md / context block | 遵守 repo 约束 | 模型可能改错边界或跑错命令 |
| 评测断言 | Eval Case | verify 脚本 | 证明行为是否成立 | 无法判断能力是否真的变强 |

注意：

```text
模型“知道”不是神秘能力。
它要么来自 user / tool result / runtime state / context block / tool schema，
要么只是低可靠的 model prior。
高风险行为不能只靠 model prior。
```

---

## 5. Core 01：最小集成 Runtime

Core 01 做的事：

```text
把 Search -> Read -> Edit -> Bash -> FinalAnswer 跑通。
```

它证明：

```text
Agent 必须是循环。
ToolResult 必须回灌。
Edit 必须受 read-before-write、stale check、old_string 唯一约束。
Bash 验证结果必须进入 verificationState。
FinalAnswer 必须发生在验证之后。
```

它还没有证明：

```text
真实模型能接进来。
复杂上下文能被管理。
长任务能被压缩。
能力能被大规模 eval。
```

Core 01 的学习重点是：

```text
Claude Code-like 产品的最小单位不是 prompt，而是 Runtime loop。
```

---

## 6. Core 02：Model Gateway

Core 02 替换的是：

```text
ScriptedFixModel.next(request)
```

它不替换：

```text
ToolRuntime
Policy
MessageStore
CoreState
Verification
```

Model Gateway 负责：

```text
调用 provider adapter。
解析模型输出。
把输出归一化成 tool_call 或 final_answer。
校验工具名和 required input。
把 provider failure 归一化成模型层错误。
```

它证明：

```text
模型层可以替换，但本地 Runtime 边界不变。
```

常见误解：

```text
接真实模型 = 让模型直接操作文件。
```

正确理解：

```text
真实模型只能提出动作。
动作是否能执行，仍由 Runtime / Tool / Policy 决定。
```

---

## 7. Core 03：Context Engine

Core 03 解决的问题是：

```text
模型这一轮到底看见什么？
```

MessageStore 保存完整事实流，但 ModelRequest 不能无限塞历史。

Context Engine 要做：

```text
选择最新用户消息。
保留 active plan。
保留 verificationState。
保留 latest failure。
保留必要 Read 文件。
把长输出转成 artifact。
在预算压力下裁剪低优先级材料。
```

它证明：

```text
Context 不是普通摘要。
Context 是 Runtime 给模型准备的本轮可见世界。
```

如果没有 Core 03：

```text
长 Bash 输出可能挤掉最新失败。
模型可能看不到验证状态。
模型可能丢失用户最新约束。
```

---

## 8. Core 04：Plan Mode

Core 04 解决的问题是：

```text
长任务或高风险任务不能让模型边想边写。
```

Plan Mode 不是：

```text
模型写一段计划文本。
```

Plan Mode 是：

```text
Runtime 状态。
权限模式。
PlanController 校验。
批准后才允许写操作。
activePlan 进入 context。
```

它证明：

```text
未批准计划前，Edit / Write / Bash 可以被拒绝为结构化 ToolResult。
approved plan 会影响 Runtime 状态和模型上下文。
```

学习重点：

```text
计划不是 prompt 装饰，而是权限边界。
```

---

## 9. Core 05：Compaction

Core 05 解决的问题是：

```text
长任务中上下文会变长，但不能因为压缩丢掉关键状态。
```

Compaction 必须保留：

```text
objective
latest user constraints
active plan
modified files
latest failures
verificationState
pending actions
artifact references
newer messages
```

它不能做：

```text
把 failed verification 改写成 passed。
用 summary 覆盖最新用户消息。
改写 MessageStore 的事实流。
```

它证明：

```text
压缩不是普通摘要。
压缩是长任务状态保全机制。
```

---

## 10. Core 06：Trace / Eval Harness

Core 06 解决的问题是：

```text
怎么证明系统真的做对了？
```

Eval Harness 抽取：

```text
toolSequence
toolResults
modifiedFiles
verificationStatus
finalAnswer
storeTraceEvents
runtimeTraceEvents
contextTurns
```

它会抓住：

```text
未验证就 final answer -> verification_missing。
Edit before Read 只有留下 file_not_read denial evidence 才算符合预期。
```

它证明：

```text
Eval 不是只看最终答案。
Eval 要看过程证据和失败归因。
```

---

## 11. Core 07：Real Model API E2E

Core 07 解决的问题是：

```text
真实模型 API 能不能接进 ModelGateway 后面，同时不破坏本地 Runtime 边界？
```

它证明：

```text
OpenAI-compatible Responses 和 Chat Completions adapter 都能映射成本地事件。
真实模型输出 tool_call 后，本地 Runtime 仍负责工具执行。
API key 不进入源码、文档、trace 或报告。
```

需要记住的边界：

```text
真实模型可能多搜索、多 Read、多 tool_calls、验证后还想继续调用工具。
Runtime 必须吸收这些差异，而不是把边界让给模型。
```

---

## 12. Core 08：Prompt Pack / Recovery Loop

Core 08 解决的问题是：

```text
模型犯了可恢复错误后，如何被 ToolResult 引导回来？
```

Prompt Pack 可以提供：

```text
identity
tool order
recovery guidance
runtime boundaries
```

但 Prompt Pack 不能替代：

```text
Policy
ToolRuntime
PlanController
Bash allowlist
Edit safety
```

它证明：

```text
file_not_read / permission_denied 等 ToolResult 可以回灌给下一轮模型。
模型可以恢复为 Search / Read / Edit 或 allowlisted Bash。
但 prompt 不能授权危险命令。
```

学习重点：

```text
Prompt 引导行为，Runtime 强制边界。
```

---

## 13. Core 09：Real Repo Task Layer

Core 09 解决的问题是：

```text
toy workspace 之外，真实仓库任务至少要看到哪些东西？
```

它加入了受控 fixture repo：

```text
AGENTS.md
package.json
src/pricing.cjs
src/cart.cjs
scripts/test.cjs
git status
npm test
```

它证明：

```text
Runtime 可以读取项目规则。
可以发现测试命令。
可以搜索多个相似候选文件。
可以处理用户中途改文件导致的 stale_file。
最终回答由 npm test passed 支撑。
```

边界：

```text
这仍是 fixture repo，不是任意真实仓库 benchmark。
```

---

## 14. Core 10：Eval + Open Source Packaging

Core 10 解决的问题是：

```text
如何把已有证据整理成 70%-80% 验收框架的 starter packaging？
```

它定义：

```text
20 个 starter case
L0-L4 分层
failure taxonomy
eval_readiness_coverage
README / AGENTS / docs index / authority map
```

它证明：

```text
项目已经有 starter eval packaging 和最小开源入口。
```

它没有证明：

```text
系统已经达到生产级 70%-80% 能力。
```

这里最关键的概念是：

```text
eval_readiness_coverage 只代表评测准备度。
```

---

## 15. Core 11-12：Executable Repo Seeds

Core 11 和 Core 12 解决的问题是：

```text
starter case 不能只停留在 readiness mapping。
它们要逐步变成可执行、可回放、可评分、可归因的 repo seeds。
```

Core 11 覆盖：

```text
read-before-edit
pagination fix
test command discovery
stale reread
dangerous command denial
```

Core 12 覆盖：

```text
unique old_string
path safety
long output artifact
context budget pressure
plan compact continuity
```

当前状态：

```text
10/20 starter case 已 executable。
scoreKind = executable_repo_seed_score。
reference-agent runner contract 已预留。
reference-agent comparison runs 仍为空。
```

它证明：

```text
能力证明体系已经从“准备度”进入“真实可执行 seed”。
```

它没有证明：

```text
RelativeScore。
SystemScore。
完整 120-case benchmark。
生产级能力。
```

---

## 16. 四种分数不要混淆

| 分数 | 当前是否有 | 含义 | 不能解释为 |
| --- | --- | --- | --- |
| `eval_readiness_coverage` | 有 | starter eval packaging 是否准备好 | 系统真实能力 |
| `executable_repo_seed_score` | 有 | 已迁移 executable seeds 的通过率 | 生产能力或相对能力 |
| `SystemScore` | 尚未完整建立 | 大规模 benchmark 下系统绝对表现 | reference-agent 对照 |
| `RelativeScore` | 尚未建立 | 相对 reference-agent 的表现 | 自己跑通多少 case |

当前最准确的说法是：

```text
学习版 Core 主体完成。
能力证明体系已经开始落地。
但还没有生产级 SystemScore 或 RelativeScore。
```

---

## 17. 为什么说主体完成了

可以说主体完成，是因为：

```text
关键 Runtime 边界都已有最小实现。
关键工具链可以完成本地代码修改和验证。
真实模型 API 接入边界已经证明。
Context / Plan / Compaction / Eval 都已接入 CoreRuntime。
Real repo fixture 已经证明非 toy 的仓库任务层。
Eval packaging 和 executable seeds 已经开始形成闭环。
verify:all 已经覆盖 Lab、Core 01-12。
```

不能说生产完成，是因为：

```text
任务数量仍少。
真实仓库仍以 fixture 为主。
reference-agent 对照还没跑。
没有长期成本、延迟、人工抽检记录。
没有 120-case benchmark。
没有持续真实任务 regression suite。
```

这两个判断必须同时成立。

---

## 18. 后续教学建议

本课是总览课，不要求一次读懂所有源码。

后续教学应该分成五组：

```text
course-08：Core 02-03，ModelGateway 与 Context Engine。
course-09：Core 04-05，Plan Mode 与 Compaction。
course-10：Core 06-08，Trace / Eval / Real Model / Prompt Recovery。
course-11：Core 09，Real Repo Task Layer。
course-12：Core 10-12，Eval Packaging 与 Executable Seeds。
```

每组都应该遵守：

```text
先讲产品问题。
再讲没有它会出什么错。
再手工 trace。
再讲对象和状态。
再指向代码入口。
最后讲 verify 证明了什么和没证明什么。
```

---

## 19. 自测题

你应该能回答：

```text
1. 为什么 Core 02 只替换模型边界，而不替换 ToolRuntime？
2. MessageStore 和 Context Engine 的职责有什么不同？
3. 为什么 Plan Mode 是权限状态，而不是 prompt 文本？
4. Compaction 为什么不能把 failed verification 改写成 passed？
5. Eval Harness 为什么不能只看 final answer？
6. Prompt Pack 为什么不能授权 unsafe Bash？
7. Core 09 的 fixture repo 比 toy workspace 多证明了什么？
8. Core 10 的 eval_readiness_coverage 为什么不是能力分？
9. Core 11 / Core 12 的 executable_repo_seed_score 为什么不是 RelativeScore？
10. 当前为什么可以说学习版 Core 主体完成，但不能说生产级 70%-80% 能力完成？
```

如果这些问题能讲清楚，说明你已经从“跟着跑代码”进入了“能解释产品运行机制”的阶段。
