# Claude Code Core Learning Path：学习优先的构建方案

> 本文是整个项目的学习总控文档。
>
> 第一目标：让你真正学会如何从零构建一个 Claude Code-like 产品。
>
> 第二目标：在学习完成后，把这条学习过程整理成可开源、可复刻、可教学的路径。
>
> 因此，本项目不是先追求“最快做出一个 Agent”，而是通过重新构建 Claude Code Core，掌握它背后的产品逻辑、运行时架构、工程边界、评测方法和迭代方式。

当前状态入口：

```text
CURRENT_STATE.md
```

新对话恢复、当前学习断点、最新验证结果和下一步动作，以 `CURRENT_STATE.md` 为准。本文负责学习路线和命名规则，不再承担“最新状态接力”的角色。

---

## 0. 最重要的判断

当前阶段不应该立刻进入完整代码实现。

正确顺序是：

```text
先理解产品
再手工推演
再抽象模块
再做最小实验
再集成实现
再评测验证
再沉淀成开源学习材料
```

原因：

```text
如果直接写代码，你可能得到一个能跑的 Agent，但不一定真正理解它为什么这么设计。
如果先建立学习路径，你会掌握一套可迁移的 Agent 产品构建能力。
```

最终要学会的不是“Claude Code 的某个实现细节”，而是：

```text
如何把一个强模型包装成可持续执行真实工程任务的受控 Agent Runtime。
```

---

## 1. 总目标

### 1.1 学习目标

完成后，你应该能独立回答并实践这些问题：

```text
1. Claude Code-like 产品到底是什么？
2. 为什么它不是一个聊天产品，也不是一个编辑器插件？
3. 用户输入之后，Runtime 内部发生了什么？
4. 模型什么时候直接回答，什么时候调用工具？
5. 工具结果如何进入下一轮上下文？
6. 为什么工具失败不是异常，而是 observation？
7. Context Engine 如何选择、排序、裁剪信息？
8. Edit 工具为什么必须 read-before-write？
9. Bash 输出很长时为什么不能直接塞回上下文？
10. Plan Mode 为什么是产品机制，不只是 prompt？
11. Compact 为什么必须保留目标、约束、失败、文件和验证状态？
12. 70%-80% 能力如何被测试和证明？
13. Runtime 如何通过 trace/eval 持续迭代？
14. GPT 5.5 / OpenAI-compatible API 应该放在系统哪一层？
15. 怎么把这个学习过程整理成别人也能复刻的开源路径？
```

### 1.2 产品目标

学习过程中的目标产品叫：

```text
Claude Code Core
```

它不是完整 Claude Code，而是本地代码任务的核心闭环：

```text
User Goal
  -> Session
  -> Context Assembly
  -> Model Decision
  -> Tool Call
  -> Policy Check
  -> Tool Execution
  -> Observation
  -> State Update
  -> Verification
  -> Next Turn
```

第一阶段做到：

```text
能搜索/读文件
能安全改文件
能运行命令和测试
能根据错误输出继续修
能做 plan -> execute -> verify
能处理长输出和 compact
能记录 trace
能用 eval 验证能力
```

第一阶段不追：

```text
远端 session
企业 policy
团队协作
复杂多 Agent
完整 memory ecosystem
完整 MCP marketplace
极致 UI
```

---

## 2. 总体方法：学习式重构

每个模块都按同一套学习循环推进：

```text
1. Product Question
   先问：这个模块解决什么产品问题？

2. Manual Trace
   手工推演：如果没有代码，Claude Code Core 这一轮应该怎么跑？

3. Object Model
   抽象对象：这个模块里有哪些数据对象和状态？

4. Runtime Rule
   写规则：什么时候做、什么时候不做、优先级是什么？

5. Minimal Lab
   写最小实验：只实现这个模块最小可观察行为。

6. Eval Case
   写评测用例：证明这个模块真的工作。

7. Reflection Note
   写学习笔记：记录为什么这样设计，常见误解是什么。

8. Publishable Doc
   整理成未来可开源文档：去除私有路径、源码痕迹和不可公开材料。
```

一句话：

```text
先能讲清楚，再能手工跑，再写代码，再用 eval 证明。
```

---

## 3. 文档体系分工

当前已有文档的角色如下：

| 文档 | 角色 | 权威范围 |
| --- | --- | --- |
| `CURRENT_STATE.md` | 当前状态入口 | 当前进度、最新验证、下一步动作、新对话恢复 |
| `claude-code-core-learning-path.md` | 学习总控 | 学习顺序、阶段产出、开源沉淀方式 |
| `claude-code-agent-runtime-framework.md` | 架构地图 | 产品和运行时抽象 |
| `claude-code-core-implementation-blueprint.md` | 施工图 | 模块级实现规格 |
| `claude-code-70-80-validation-and-model-access.md` | 验收与模型接入 | 70%-80% 能力定义、评测、GPT 5.5/API 接入 |
| `agent-runtime-optimization-loop.md` | 迭代框架 | trace、失败归因、eval、灰度、回归 |
| 两篇原始分析文章 | 背景材料 | 观点来源和历史理解，不作为当前实现规则 |

冲突时优先级：

```text
当前进度：以 CURRENT_STATE.md 为准。
学习顺序：以本文为准。
产品架构：以 claude-code-agent-runtime-framework.md 为准。
实现细节：以 claude-code-core-implementation-blueprint.md 为准。
能力验收：以 claude-code-70-80-validation-and-model-access.md 为准。
迭代流程：以 agent-runtime-optimization-loop.md 为准。
历史观点：只作为参考，不覆盖当前规则。
```

### 3.1 命名规则：一条主线，七类材料

为了避免 `Lesson / P / W / L` 混用造成学习路径断裂，后续统一使用下面的命名规则。

```text
course-XX-*.md
  学习主线。
  必读内容都放进 course。
  你按编号顺序读，就应该能从零建立完整理解。

lab-XX-*.md
  可执行实验。
  lab 跟随 course 出现，用来把刚学到的机制跑起来。
  lab 不是新的理论主线。

module-XX-*.md
  工程参考。
  module 写某个 Runtime 模块的实现规格，供写代码时查。
  module 不替代 course，也不要求第一次学习时逐字读完。

eval-XX-*.md
  验收材料。
  eval 用来证明能力，不承担教学主线。

core-XX-*.md
  集成实现里程碑。
  core 表示已经把多个 lab 机制合成一个可运行产品骨架。
  core 不是学习主线本身；学习者理解 core 的文档仍然应该进入 course。

exercise
  练习入口。
  exercise 位于 course / lab / core 之后，用来让学习者动手复述、修改、验证。
  exercise 不新增课程编号，也不替代 verify evidence。

project / capstone
  端到端项目。
  project 用来把多个机制合成完整学习任务；capstone 是系统学习后的综合练习。

solution
  参考解法。
  solution 只能在学习者先做练习后使用，不作为 current rule，也不替代 src/core 的行为证据。

run-record / verification-record
  运行记录和验证记录。
  只记录命令、结果、case，不承担新的学习主线。
```

当前学习主线只认：

```text
course-00 -> course-01 -> course-02 -> course-03 -> course-04 -> course-05 -> course-06 -> course-07 -> course-08 -> course-09 -> course-10 -> course-11 -> course-12 -> course-13 -> course-14 -> course-15 -> course-16 -> course-17 -> course-18
```

`course-06` 之后进入 Core Build Pass，`course-07` 负责把 Core Build Pass 已完成的 Core 01 到 Core 12 重新整理成教学总览；`course-08` 到 `course-12` 负责按主题拆开学习：

```text
core-01 -> core-02 -> core-03 -> ... -> core-12
```

`course-13` 负责补齐 Core 13-17 的 executable suite、reference-agent、cost basis 和 pricing boundary 教学；`course-14` 负责把 Core 18-26 Production Upgrade 重新整理成教学总览；`course-15` 到 `course-17` 负责按主题拆开学习；`course-18` 负责把 Core 27-31 Product Surface 重新整理成 execution-chain：

```text
core-13 -> core-14 -> core-15 -> core-16 -> core-17
core-18 -> core-19 -> core-20 -> ... -> core-26
core-27 -> core-28 -> core-29 -> core-30 -> core-31
```

Core Build Pass 不再新增一条平行的 `Review-XX` 主线。
每个 `core-XX` 文档本身必须包含课程层面的学习契约，并受本文 `6.1 Core Build Pass 学习调度框架` 约束。
实践层不改变课程编号系统；当前实践入口是 `exercises/`、`projects/capstone-mini-runtime/` 和 `solutions/`。

课程索引：

| 顺序 | 文档 | 本课解决的问题 | 完成标准 |
| --- | --- | --- | --- |
| 0 | `course-00-teaching-standard.md` | 怎么避免“模型知道/Agent 应该/合理动作”里的隐式信息 | 你能判断一句 Agent 描述是否说明了来源、给法、目标、约束和验证 |
| 1 | `course-01-initial-model-request.md` | 模型第一次被调用时到底看到了什么 | 你能说清 ModelRequest 里的 messages、tools、state、policy |
| 2 | `course-02-action-selection-rubric.md` | 模型怎么判断下一步动作是否合理 | 你能用“合法 + 信息增益 + 阶段匹配”判断 Search/Read/Edit/Bash/AskUser |
| 3 | `course-03-clean-room-prompt-pack.md` | 怎么在公开学习边界下，从运行时需求倒推 Prompt Pack | 你能区分提示词引导、权限策略强制、工具行动、状态记录 |
| 4 | `course-04-single-task-full-trace.md` | 一条任务如何从用户输入跑到最终验证 | 你能画出 MessageStream、ToolCall、ToolResult、StateUpdate |
| 5 | `course-05-product-mental-model.md` | 怎么把前面机制沉淀成产品心智模型 | 你能从用户、模型、Runtime、工具、Eval 五个界面解释产品 |
| 6 | `course-06-labs-to-core-map.md` | 怎么把 8 个 Lab 映射成 Core 产品骨架 | 你能解释每个 Lab 在 Core 里变成哪个模块、数据如何流动、哪些仍然是 toy |
| 7 | `course-07-core-build-pass-overview.md` | 怎么把 Core 01 到 Core 12 的主体构建讲成一条完整教学主线 | 你能解释每个 Core 阶段解决的产品问题、证明边界和后续验证方向 |
| 8 | `course-08-model-gateway-and-context-engine.md` | ModelGateway 与 Context Engine 如何分别控制模型输出和模型可见世界 | 你能解释模型边界、tool schema 校验、context blocks、artifacts 和 MessageStore 的区别 |
| 9 | `course-09-plan-mode-and-compaction.md` | Plan Mode 与 Compaction 如何让长任务受控不断片 | 你能解释计划审批、工具授权、compact summary、newer messages 和 failed verification 红线 |
| 10 | `course-10-trace-eval-real-model-and-recovery.md` | Trace / Eval / Real Model / Prompt Recovery 如何让系统可证明、可接真模型、可恢复 | 你能解释 verification_missing、provider adapter、denied ToolResult 回灌和 prompt 与 policy 的边界 |
| 11 | `course-11-real-repo-task-layer.md` | 真实 repo fixture 比 toy workspace 多证明了什么 | 你能解释项目规则、测试发现、多候选文件、stale_file 和 public API 边界 |
| 12 | `course-12-eval-packaging-and-executable-seeds.md` | Eval packaging 与 executable seeds 如何把能力证明体系落地 | 你能区分 eval_readiness_coverage、executable_repo_seed_score、SystemScore 和 RelativeScore |
| 13 | `course-13-eval-reference-cost-evidence.md` | Core 13-17 如何把 executable suite、reference-agent baseline、cost basis 和 pricing boundary 接起来 | 你能解释 20/20 executable、codex-local baseline、rawLogSha256、configured estimated USD 和 RelativeScore 阻塞边界 |
| 14 | `course-14-production-upgrade-evidence-chain.md` | Core 18-26 Production Upgrade 如何形成 deterministic local evidence 链 | 你能解释 Context / Compaction / Plan / Eval / ToolRuntime / ModelGateway / Session / Repo Intelligence / Human Approval 如何连成生产化证据链，并说清 out-of-scope |
| 15 | `course-15-context-compaction-plan-production.md` | Context Economy、Compaction Quality、Plan State Machine 如何构成状态保真链 | 你能从 Core 18-20 verify case 指到 stablePrefix、compaction diff、plan trace、permission 和 final grounding |
| 16 | `course-16-long-running-tool-gateway-production.md` | Long-Running Eval、ToolRuntime Transaction、ModelGateway Budget 如何构成执行安全链 | 你能从 Core 21-23 verify case 解释 failureHistory、transaction rollback、budget gate、retry/fallback 和 capability filtering |
| 17 | `course-17-session-repo-approval-production.md` | Durable Session、Repo Intelligence、Human Approval 如何构成恢复和协作链 | 你能从 Core 24-26 verify case 解释 event replay、relevance reasons、approval_required、interrupt 和 no hidden execution |
| 18 | `course-18-product-surface-implementation-chain.md` | Settings、Hooks、Memory、Checkpoint、Subagent 如何从 Product Surface 材料落成 Runtime execution-chain | 你能从 Core 27-31 verify case 解释 permission decision、hook lifecycle、memory governance、rewind audit、subagent isolation 和官方实现边界 |

不要再使用：

```text
Lesson-XX
PXX 作为文档编号
WXX 作为 walkthrough 编号
LXX 作为 lab 编号
Review-XX 作为学习主线编号
```

如果文档内部需要规则编号，必须加语义前缀，例如：

```text
PLAN-01
FINAL-01
CTX-01
TOOL-01
```

这样学习者可以一眼区分：

```text
course-02 是课程编号。
PLAN-01 是规则编号。
lab-01 是实验编号。
module-05 是工程参考编号。
```

---

## 4. 当前开源项目的文档结构

当前 GitHub 项目已经按“首页友好、课程可顺序学习、证据可追踪”的方式整理：

```text
claude-code-core-lab/
  README.md
  package.json
  src/
    lab01 ... lab08
    core/
  docs/
    README.md
    index.md
    authority-map.md
    start-here-for-learners.md
    project-structure.md
    troubleshooting.md
    course/
      course-00 ... course-18
    lab/
      lab-01 ... lab-08
    core/
      core-01 ... core-31
    records/
      core-run-record.md
      labs-verification-record.md
    roadmap/
      production-upgrade-roadmap.md
      production-upgrade-validation-matrix.md
    reference/
      架构、实现、评测参考
    history/
      早期分析文章
  exercises/
    course-00-05/
    lab-to-core/
    core-01-12/
    production-upgrade/
    product-surface/
  projects/
    capstone-mini-runtime/
  solutions/
    course-00-05/
    lab-to-core/
    capstone-mini-runtime/
```

开源时的定位：

```text
围绕 Claude Code 核心机制的中文学习项目：
从零构建一个 Claude Code-like local coding agent runtime。
```

不能定位成：

```text
Claude Code 源码复刻
官方实现解析
泄露源码教程
```

---

## 5. 公开学习边界

为了能公开学习、复现和协作，学习过程中必须遵守公开学习边界：学 Claude Code 的产品机制和工程问题，但不复制官方源码、私有 Prompt 或非公开实现。

可以公开：

```text
自己写的架构抽象
自己写的数据结构
自己写的伪代码
自己写的实验代码
自己设计的 eval case
公开 API 文档中的接口说明
公开产品行为的观察和推理
```

不能公开：

```text
非官方源码原文
反编译/还原源码片段
私有 prompt 原文
包含私有路径、账号、token、日志的 trace
不可确认来源的内部实现细节
直接声称“Claude Code 就是这样实现的”
```

公开表达方式：

```text
这个项目基于公开产品行为和我们自己写的运行时设计，教学如何构建一个 Claude Code-like 代码智能体核心。
```

不要表达成：

```text
This is how Claude Code source code works internally.
```

### 5.1 官方 Claude Code preset 与第三方 prompt diff 的使用策略

你提到的第三方 Claude Code 版本对比站，可以作为研究材料，但不能改变本项目的公开学习边界。

我们采用三层策略：

| 用途 | 是否可以 | 说明 |
| --- | --- | --- |
| 用官方 Anthropic Agent SDK 的 `claude_code` preset 跑 reference baseline | 可以 | 这是官方公开支持的方式，适合做对照组 |
| 查看第三方 prompt/tool diff 来理解版本演化和规则类别 | 可以，但只作研究观察 | 它可以提醒我们哪些类别值得关注 |
| 直接复制第三方提取的 Claude Code system prompt 到我们的开源 Prompt Pack | 不可以 | 会破坏公开学习边界，也削弱学习目标 |

正确使用方式：

```text
Reference Agent:
  可以使用官方 Claude Code / Agent SDK preset。
  目标是对照能力和行为。

Learning Runtime:
  必须使用我们自己写的 Prompt Pack。
  每条规则都要说明来源、给法、目标、缺失后果和 eval 验证。

Research Notes:
  可以记录第三方 diff 观察到的“规则类别”，例如工具说明、权限、上下文、验证、计划模式。
  但不要保存或发布第三方提取的原文 prompt。
```

这能同时满足两个目标：

```text
1. 学习时有真实 reference baseline。
2. 未来开源时保持可解释、可复刻、可发布。
```

---

## 6. 学习阶段总览

### Phase A：建立产品心智模型

目标：

```text
从“AI 写代码”升级到“Agent Runtime 产品”。
```

你要学会：

```text
Claude Code-like 产品的核心不是聊天，而是受控执行环境。
模型是决策核心。
工具是 action 能力。
Context 是模型的可见世界。
Policy 是行动边界。
Trace/Eval 是产品变强的基础。
```

产出：

```text
course-00-teaching-standard.md
course-01-initial-model-request.md
course-02-action-selection-rubric.md
course-03-clean-room-prompt-pack.md
course-04-single-task-full-trace.md
course-05-product-mental-model.md
```

学习顺序：

```text
0. course-00-teaching-standard.md
   先建立无隐式信息的学习规范：任何“知道/应该/合理”都必须说明来源、给法、目标和验证。

1. course-01-initial-model-request.md
   先搞清楚第一次调用模型时，Runtime 给了模型什么。

2. course-02-action-selection-rubric.md
   再搞清楚模型如何判断下一步动作是否合理。

3. course-03-clean-room-prompt-pack.md
   再学习如何把运行时需求转成我们自己写的 Prompt Pack，而不是复制官方或第三方 prompt。

4. course-04-single-task-full-trace.md
   再看模型拿到初始请求后，如何一轮轮完成任务。

5. course-05-product-mental-model.md
   最后沉淀成产品心智模型。
```

验收问题：

```text
你能不能判断一句“模型知道/Agent 应该/合理动作”是否说明了来源？
你能不能讲清楚模型第一次被调用时看到了哪些 messages、tools 和 state？
你能不能讲清楚“合理动作”来自用户目标、当前状态、工具说明、Policy 和动作选择规则？
你能不能讲清楚“自己写的学习用 Prompt Pack”和官方 reference baseline 的区别？
你能不能不用代码，讲清楚用户输入后 Runtime 发生的 12 个步骤？
你能不能解释为什么工具失败要回灌给模型？
你能不能解释为什么 Claude Code-like 产品不是 workflow chain？
```

### Phase B：手工推演第一条完整任务

目标：

```text
用一条真实代码任务，把所有模块串起来。
```

建议任务：

```text
修复一个分页 bug，并运行测试验证。
```

手工推演内容：

```text
用户目标是什么？
Runtime 创建了哪些对象？
第一轮上下文里有什么？
模型为什么先 Search？
Search 结果怎么变成下一轮上下文？
Read 建立了什么 file snapshot？
Edit 前检查什么？
Bash 输出怎么解析？
测试失败后如何继续？
最终如何判断完成？
```

产出：

```text
course-04-single-task-full-trace.md
```

当前第一条完整任务轨迹课程已创建：

```text
course-04-single-task-full-trace.md
```

它用分页 off-by-one bug 手工跑通：

```text
UserMessage
-> ContextBlock
-> ToolCall
-> ToolResult
-> StateUpdate
-> VerificationState
-> FinalAnswer
```

后续如果要把分页案例拆成更独立的专题课程，再创建：

```text
course-06-pagination-bug-deep-dive.md
```

验收问题：

```text
你能不能画出这条任务的 MessageStream？
你能不能标出每一次工具调用前后的状态变化？
你能不能解释每个模块在这条任务里起什么作用？
```

### Phase C：实现 Mock Runtime Loop

目标：

```text
不接真实模型，先跑通 Runtime 协议。
```

为什么先不接 GPT 5.5：

```text
强模型会掩盖 runtime 缺陷。
Mock 模型能逼我们先把协议、状态和工具回灌做对。
```

产出：

```text
lab-01-mock-runtime-loop.md
src/runtime/loop.ts
src/model/mock.ts
```

验收：

```text
Mock 模型发起 Read。
Read 结果进入 MessageStream。
下一轮 Mock 模型能看到 Read 结果并继续。
```

### Phase D：构建工具与安全修改能力

目标：

```text
实现真实代码任务的核心工具。
```

学习模块：

```text
Read
Search
Bash
Edit
Write
Policy
```

重点不是“工具能跑”，而是：

```text
工具是否有 schema？
错误是否结构化？
权限是否可解释？
Edit 是否 read-before-write？
stale file 是否阻止覆盖？
Bash 长输出是否 artifact 化？
```

产出：

```text
module-03-tool-runtime.md
module-04-core-tools.md
module-06-policy-engine.md
lab-03-read-search-bash.md
lab-04-edit-tool-safety.md
```

验收：

```text
未读文件不能 Edit。
用户中途改文件后不能覆盖。
old_string 多处匹配时不能乱改。
危险 Bash 命令会被 ask/deny。
```

### Phase E：构建 Context Engine

目标：

```text
学会如何组织模型的可见世界。
```

重点问题：

```text
每轮固定拼什么？
什么条件下拼项目规则？
什么条件下拼文件内容？
工具输出多长时转 artifact？
旧成功输出什么时候裁掉？
最新失败为什么 hard keep？
CLAUDE.md 和最新用户指令冲突怎么办？
```

产出：

```text
module-05-context-engine.md
lab-05-context-engine-v1.md
```

验收：

```text
最新用户约束不会被旧摘要覆盖。
active plan 不会被裁掉。
长 Bash 输出不会挤掉关键上下文。
```

### Phase F：构建 Plan Mode

目标：

```text
理解 plan 是产品状态，不是模型随便写一段计划。
```

重点问题：

```text
什么时候进入 plan mode？
plan mode 里允许哪些工具？
plan 被拒绝后如何阻止旧计划继续执行？
approved plan 如何 handoff 到 execute？
执行中偏离计划怎么办？
```

产出：

```text
module-07-plan-mode.md
course-07-plan-rejected-and-revised.md
lab-06-plan-mode-v1.md
```

验收：

```text
plan mode 中不能 Edit。
plan 太空泛不能通过。
用户拒绝后不会执行旧 plan。
```

### Phase G：构建 Compaction 与 Artifact

目标：

```text
让中长任务不断上下文时不失忆。
```

重点问题：

```text
什么时候 compact？
compact summary 保留哪些字段？
长失败日志怎么处理？
artifact 如何被引用？
compact 后如何恢复 active plan、modified files、verification state？
```

产出：

```text
module-08-compaction-artifact.md
course-08-long-bash-output-compact.md
lab-07-compaction-v1.md
```

验收：

```text
compact 后不丢目标。
compact 后不丢最新用户约束。
compact 后不把失败测试误认为通过。
```

### Phase H：构建 Trace/Eval

目标：

```text
用评测证明 Agent 是否真的接近 70%-80%。
```

重点问题：

```text
Trace 要记录什么？
Eval case 怎么描述？
怎么判断任务完成？
怎么和 reference agent 比？
失败如何归因到 context/tool/policy/model？
```

产出：

```text
module-09-trace-eval.md
lab-08-eval-runner.md
eval-case-schema.md
starter-cases.md
```

验收：

```text
20 个 starter eval cases 可运行。
每个失败能定位 failure taxonomy。
能输出 SystemScore 和关键失败原因。
```

### Phase I：接入 GPT 5.5 / OpenAI-compatible API

目标：

```text
把强模型接入 runtime，但不让模型供应商绑定产品架构。
```

重点问题：

```text
Model Gateway 为什么独立？
Responses API 如何承载 tool calling？
OpenCloud/OpenClaw 应该处在哪一层？
工具执行为什么必须留在本地 runtime？
```

产出：

```text
module-10-model-gateway.md
src/model/openaiResponses.ts
```

验收：

```text
同一 runtime 可切换 mock / GPT 5.5 / fallback model。
模型 tool call 能被本地 Tool Runtime 执行。
```

### Phase J：整理开源学习版本

目标：

```text
把学习过程整理成别人能复刻的课程式项目。
```

重点工作：

```text
清理私有路径。
删除非公开源码依赖。
把个人学习笔记改写成不复制官方源码和私有提示词的公开教程。
为每个 lab 补 README。
为每个 eval case 补说明。
写清楚项目定位和免责声明。
```

产出：

```text
README.md
docs/index.md
docs/authority-map.md
labs/
examples/
evals/
```

验收：

```text
一个新读者可以从 README 开始，按顺序完成学习。
每个阶段都有文档、lab、eval。
项目没有泄露源码、私有路径或不可公开材料。
```

---

## 6.1 Core Build Pass 学习调度框架

### 6.1.1 本节定位

从 `core-01` 开始，学习重点从：

```text
理解单个机制
```

切换为：

```text
理解机制如何接入完整 Runtime，并形成可运行、可控制、可验证、可迭代的产品骨架。
```

因此：

```text
Lab 是零件测试。
Core 是整机装配和道路测试。
```

Core 阶段不是重复 Lab，而是回答这些问题：

```text
1. 这个机制接入 Runtime 的哪个位置？
2. 它读取哪些事实和状态？
3. 它产出什么对象给下一层？
4. 哪些模块不能绕过它？
5. 失败时如何进入 MessageStore / State / Trace？
6. 怎么证明它没有破坏已有闭环？
```

### 6.1.2 每个 Core 的固定学习闭环

每个 Core 都按 6 步推进。

1. Product Question

```text
这个 Core 解决什么产品问题？
如果没有它，Agent 会在哪里失败？
```

2. Lab Recall

```text
它对应哪些已经验证过的 Lab？
Lab 已经证明了什么？
Lab 还没有证明什么？
为什么现在必须接入 Core？
```

3. Integration Map

```text
谁调用它？
它读取什么状态？
它输出什么对象？
谁不能绕过它？
失败时怎么回灌？
```

4. Run And Read Trace

```text
运行 demo / verify。
不要只看 passed，要看 MessageStream、ToolCall、ToolResult、StateUpdate 和 Trace。
```

5. Explain Back

```text
学习者用自己的话复述：
这个 Core 接入了什么机制？
系统多了什么能力？
它守住了什么边界？
如果没有它，会发生什么坏情况？
```

6. Gate Check

```text
能回答机制题、边界题、失败题后，才进入下一 Core。
```

### 6.1.3 Core 阶段的验收格式

每个 Core 至少有三类过关问题。

机制题：

```text
它做什么？
输入是什么？
输出是什么？
它和上一阶段相比新增了什么能力？
```

边界题：

```text
谁能调用它？
谁不能绕过它？
哪些权力必须留在 Runtime / ToolRuntime / Policy / MessageStore？
```

失败题：

```text
它失败时如何结构化记录？
失败如何回灌给下一轮模型？
如何判断失败属于模型、上下文、工具、Policy、状态还是 eval 标准？
```

### 6.1.4 Core 01 到 Core 10 的课程调度

| Core | 实现里程碑 | 对应学习主题 | 过关标准 |
| --- | --- | --- | --- |
| Core 01 | Integrated Runtime | Lab 机制如何组成最小产品闭环 | 能画出 User -> Search -> Read -> Edit -> Bash -> FinalAnswer 的完整数据流 |
| Core 02 | Model Gateway | 模型只是可替换决策源，不是 Agent 本身 | 能区分 ModelGateway、Adapter、ToolRuntime、Policy、MessageStore 的职责 |
| Core 03 | Context Engine Integration | 本轮模型该看什么 | 能解释 MessageStore 和 ModelRequest 的区别，知道 hard keep / prune / artifact 的位置 |
| Core 04 | Plan Mode Integration | Plan 是状态、审批和权限切换 | 能解释 plan mode 为什么不能只靠 prompt，以及批准前为什么不能写文件 |
| Core 05 | Compaction / Artifact Integration | 长任务如何不断片 | 能解释 compact 前后目标、约束、失败、文件和验证状态如何保持连续 |
| Core 06 | Trace / Eval Harness Expansion | 能力如何被证明和归因 | 能根据失败 trace 判断问题属于 model/context/tool/policy/state/eval 哪一层 |
| Core 07 | Real Model API E2E | 真实模型如何接入但不重写 Runtime | 能解释真实 API 只替换 Adapter，不能接管本地工具执行 |
| Core 08 | Prompt Pack / Recovery Loop | Prompt 负责引导，Runtime 负责强制 | 能区分哪些规则靠 prompt，哪些规则必须由 Policy / ToolRuntime 保证 |
| Core 09 | Real Repo Task Layer | toy workspace 到真实仓库的差距 | 能处理项目规则、测试发现、git status、多文件定位和用户中途改文件 |
| Core 10 | 70%-80% Eval + Open Source Packaging | 如何证明能力并沉淀成可复刻项目 | 能用任务集、评分、相对能力和文档 authority 说明项目是否达标 |

### 6.1.5 Core 文档必须包含的课程契约

每篇 `core-XX-*.md` 除了实现说明，还必须包含：

```text
1. 本 Core 在课程层面要学什么
2. 它对应哪些 Lab / Course
3. 本 Core 新增了什么系统能力
4. 它守住了什么边界
5. 学习者应该运行什么命令
6. 学习者应该观察哪些 trace / output
7. 过关自测问题
```

这条规则用于避免 Core 文档只变成实现记录。

Core 文档必须同时服务两类读者：

```text
工程读者：知道代码怎么跑。
学习读者：知道这个阶段为什么存在、要学会什么、怎么证明自己学会了。
```

---

## 7. 每个模块的固定文档模板

未来写 `modules/module-XX-*.md` 时统一使用这个模板：

```text
# Module XX 模块名

## 1. 你要学会什么

## 2. 这个模块解决什么产品问题

## 3. 它在 Claude Code Core 里的位置

## 4. 手工推演

## 5. 数据结构

## 6. 执行流程

## 7. 判断规则

## 8. 边界情况

## 9. 最小代码实验

## 10. Eval Case

## 11. 自测问题

## 12. 常见误解

## 13. 开源整理备注
```

每个模块必须同时产出：

```text
一篇模块文档
一个 course 案例或 lab
至少 2 个 eval cases
一段 reflection note
```

---

## 8. 每次学习会话的记录方式

每次我们推进一个模块时，记录成这样的结构：

```text
本次主题：
本次要解决的核心问题：
手工推演：
关键对象：
关键规则：
边界情况：
最小实验：
验收方式：
我现在真正理解了什么：
还没理解什么：
未来开源时怎么表达：
```

这样做的目的：

```text
让学习过程本身变成未来教程的原材料。
```

不要只记录结论。要记录：

```text
为什么这么拆
中间误解是什么
哪些设计一开始容易想错
为什么最后选择当前方案
```

这些内容对未来学习者比完美结论更有价值。

---

## 9. 教学节奏建议

每个模块建议分三轮：

### 第一轮：理解

```text
只讨论产品问题和手工推演。
不写代码。
目标是你能复述这个模块为什么存在。
```

### 第二轮：实验

```text
写最小代码。
只实现一个行为。
目标是看到模块的关键机制跑起来。
```

### 第三轮：验证和沉淀

```text
写 eval case。
跑失败场景。
写 reflection note。
整理成可开源表达。
```

判断是否进入下个模块：

```text
你能讲清楚。
你能手工推演。
你能指出边界情况。
你能看懂最小实现。
你能设计 eval case。
```

否则不急着往下走。

---

## 10. 第一条完整任务轨迹设计

第一条完整任务轨迹课程叫：

```text
course-04-single-task-full-trace.md
```

任务：

```text
修复一个分页 bug，并运行测试验证。
```

它要完整记录：

```text
1. 用户输入
2. Session 创建
3. 初始 Context
4. 可用 Tools
5. 模型第一轮决策
6. Search 调用
7. Search Result 如何回灌
8. Read 调用
9. FileSnapshot 如何建立
10. Edit 前检查
11. Edit 成功后的 State Update
12. Bash 测试
13. 测试失败时如何继续
14. 测试通过时如何记录 VerificationState
15. Final Answer 如何诚实报告
16. Trace 里应该留下什么
```

这条完整任务轨迹是整个学习路径的中枢。

后续所有模块都可以回到它：

```text
Runtime Loop：看它如何循环
Context Engine：看每轮上下文怎么变
Tool Runtime：看工具如何执行
Policy Engine：看写文件前如何检查
Plan Mode：看复杂任务如何先计划
Compaction：看任务变长时如何压缩
Eval：看它如何变成评测 case
```

---

## 11. 学习验收标准

不是“文档写完”就算学会。

每个阶段用 4 类验收：

### 11.1 口头复述验收

你能不用文档讲清楚：

```text
模块解决什么问题。
输入输出是什么。
关键状态是什么。
最容易错在哪里。
```

### 11.2 手工推演验收

给一个小任务，你能画出：

```text
MessageStream
ToolCall
ToolResult
StateUpdate
ContextBlock
```

### 11.3 最小实现验收

代码能跑通：

```text
一个最小成功 case
一个关键失败 case
```

### 11.4 Eval 验收

至少有：

```text
一个 pass case
一个 fail/recovery case
结构化 trace
评分结果
```

---

## 12. 目前已经完成什么

已完成的基础资料：

```text
course-00 教学规范
   course-00-teaching-standard.md

course-01 初始模型请求
   course-01-initial-model-request.md

course-02 动作选择规则
   course-02-action-selection-rubric.md

course-03 公开学习边界下的 Prompt Pack
   course-03-clean-room-prompt-pack.md

course-04 单任务完整轨迹
   course-04-single-task-full-trace.md

course-05 产品心智模型
   course-05-product-mental-model.md

course-06 Lab 到 Core 映射
   course-06-labs-to-core-map.md

reference 架构地图
   claude-code-agent-runtime-framework.md

reference 施工图
   claude-code-core-implementation-blueprint.md

reference 验收与模型接入
   claude-code-70-80-validation-and-model-access.md

reference 迭代闭环
   agent-runtime-optimization-loop.md

entry 学习总控
   claude-code-core-learning-path.md

lab-01 最小 Runtime Loop 实验
   lab-01-mock-runtime-loop.md

lab-01 运行记录
   lab-01-run-record.md

lab-02 Message Store 实验
   lab-02-message-store.md

lab-02 运行记录
   lab-02-run-record.md

lab-03 Read/Search/Bash 实验
   lab-03-read-search-bash.md

lab-03 运行记录
   lab-03-run-record.md

lab-04 Edit Tool Safety 实验
   lab-04-edit-tool-safety.md

lab-05 Context Engine v1 实验
   lab-05-context-engine-v1.md

lab-06 Plan Mode v1 实验
   lab-06-plan-mode-v1.md

lab-07 Compaction v1 实验
   lab-07-compaction-v1.md

lab-08 Eval Runner 实验
   lab-08-eval-runner.md

全量 Lab 验证记录
   labs-verification-record.md

core-01 集成 Runtime
   core-01-integrated-runtime.md

core-02 Model Gateway
   core-02-model-gateway.md

core-03 Context Engine Integration
   core-03-context-engine-integration.md

core-04 Plan Mode Integration
   core-04-plan-mode-integration.md

core-05 Compaction / Artifact Integration
   core-05-compaction-artifact-integration.md

core 运行记录
   core-run-record.md
```

它们的关系：

```text
learning-path
  -> 告诉我们按什么顺序学

course-00
  -> 告诉我们每个教学文档如何避免隐式信息

course-01
  -> 告诉我们模型第一次被调用时看到了什么

course-02
  -> 告诉我们模型如何判断下一步动作是否合理

course-03
  -> 告诉我们如何从运行时需求倒推自己写的 system prompt

course-04
  -> 告诉我们一条任务如何从用户输入跑到最终验证

course-05
  -> 告诉我们怎样把前面的机制沉淀成产品心智模型

course-06
  -> 告诉我们 8 个 Lab 如何映射成 Core 产品骨架

core-01
  -> 告诉我们多个 Lab 机制如何组成最小产品闭环

core-02
  -> 告诉我们模型层如何变成可替换边界，同时不移动本地 Runtime 权力

core-03
  -> 告诉我们 MessageStore 和 ModelRequest 如何分层，Context Engine 如何决定本轮模型可见世界

core-04
  -> 告诉我们 Plan Mode 如何成为 Runtime 状态、审批和工具权限机制

core-05
  -> 告诉我们 Compaction 如何保留继续任务所需状态，并把长输出转成 artifact

architecture-framework
  -> 告诉我们产品整体是什么

implementation-blueprint
  -> 告诉我们工程怎么做

validation-and-model-access
  -> 告诉我们怎么证明能力，怎么接模型

optimization-loop
  -> 告诉我们怎么持续变强
```

---

## 13. 下一步执行计划

注意：本节保留阶段计划和历史执行思路。当前真实学习断点、最新验证结果和下一步最小动作，以 `CURRENT_STATE.md` 为准。

接下来不要再扩写大而全的总文档。

下一步应该完成 Phase A 的收束学习：

```text
course-05-product-mental-model.md
```

当前状态：

```text
course-00-teaching-standard.md 已完成第一版。
course-01-initial-model-request.md 已按无隐式信息规范补充 Knowledge Provenance 和 Context Item Contract。
course-02-action-selection-rubric.md 已按无隐式信息规范补充 Action Claim Contract。
course-03-clean-room-prompt-pack.md 已完成第一版，用于说明如何从运行时需求倒推自己写的 Prompt Pack，并区分官方 reference baseline。
course-04-single-task-full-trace.md 已完成第一版，并已重构关键 Turn 的显式信息来源、动作判定、失败回灌、验证和 Final Answer 条件。
course-05-product-mental-model.md 已创建，用来把前四课沉淀成产品级理解。
学习顺序应调整为：course-00 -> course-01 -> course-02 -> course-03 -> course-04 -> course-05。
如果你已经读到 course-04，下一步先读 course-05；通过 Phase A 复述验收后，再进入 lab-01-mock-runtime-loop.md。
lab-01-mock-runtime-loop.md 已创建，用来跑通 MockModel + FakeReadTool 的最小循环。
lab-01 已有可运行实现：npm run lab:01。
lab-01 已有完整验证套件：npm run lab:01:verify。
lab-02 已有可运行实现：npm run lab:02。
lab-02 已有完整验证套件：npm run lab:02:verify。
lab-03 已有可运行实现：npm run lab:03。
lab-03 已有完整验证套件：npm run lab:03:verify。
lab-04 已有完整验证套件：npm run lab:04:verify。
lab-05 已有完整验证套件：npm run lab:05:verify。
lab-06 已有完整验证套件：npm run lab:06:verify。
lab-07 已有完整验证套件：npm run lab:07:verify。
lab-08 已有完整验证套件：npm run lab:08:verify。
全部 Lab 可一键验证：npm run verify:labs。
Core 集成验证：npm run core:verify。
全部 Lab + Core 一键验证：npm run verify:all。
```

目标：

```text
先建立无隐式信息的学习规范。
先搞清楚第一次模型调用时 Runtime 给模型什么。
再搞清楚模型如何判断动作是否合理。
再用一条具体任务，把 Claude Code Core 从用户输入到最终验证的全过程手工跑一遍。
```

建议执行顺序：

```text
1. 定义一个 toy repo 场景：分页 bug。
2. 写用户任务 prompt。
3. 手工模拟 Runtime 第一轮。
4. 写出 MessageStream。
5. 写出每一轮 ContextBlock。
6. 写出 ToolCall / ToolResult。
7. 写出 StateUpdate。
8. 写出测试失败和恢复分支。
9. 写出最终 verification。
10. 把这条完整任务轨迹变成第一个 eval case 草案。
```

这一步完成后，你会真正看懂：

```text
Agent Runtime 不是抽象图，而是一条条 message、tool result、state update 组成的执行轨迹。
```

---

## 14. 成功标准

这个项目最终成功，不是因为我们写了很多文档，而是因为达成三件事：

第一，你真正学会：

```text
你能独立拆解、设计和实现一个 Claude Code-like Agent Core。
```

第二，产品真的跑起来：

```text
它能在本地代码任务上达到 70%-80% 的可用能力。
```

第三，过程可以开源复刻：

```text
别人可以按照我们的 course、lab、module、eval case，走完同一条学习路径。
```

优先级永远是：

```text
你学会 > 产品跑通 > 开源好看
```

如果开源表达和学习深度冲突，先服务学习深度。
如果实现速度和理解质量冲突，先服务理解质量。
如果文档完整度和可执行路径冲突，先服务可执行路径。
