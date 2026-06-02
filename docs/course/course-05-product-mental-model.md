# Course 05 Product Mental Model：把 Claude Code-like Agent 当成产品来理解

> 本文是 Phase A 的收束课。
>
> 前四课分别回答了：
>
> ```text
> course-00：怎么避免隐式信息。
> course-01：模型第一次被调用时看到了什么。
> course-02：模型怎么判断下一步动作是否合理。
> course-03：提示词包（Prompt Pack）如何在公开学习边界下设计。
> course-04：一条任务如何从用户输入跑到最终验证。
> ```
>
> 本课要把这些机制合成一个产品心智模型：
>
> ```text
> Claude Code-like 产品不是“一个会写代码的聊天框”，而是一个把强模型接入真实工程环境的 Agent Runtime 产品。
> ```

---

## 0. 本课要解决什么问题

如果只说“Claude Code 是 Agent”，还是太抽象。

学习者真正需要搞清楚的是：

```text
1. 这个产品到底由哪些界面组成？
2. 哪些东西给模型看？
3. 哪些东西只存在 Runtime 里？
4. 哪些规则靠 prompt 引导？
5. 哪些规则必须靠 Tool / Policy 强制？
6. 为什么它能从一次用户输入推进到真实代码修改？
7. 为什么它不是传统 workflow chain？
```

本课的答案是：

```text
Claude Code-like 产品 = Model + Runtime + Tools + State + Policy + Context + UX + Trace/Eval
```

模型负责决策。
Runtime 负责循环。
工具负责行动。
状态负责记忆事实。
Policy 负责边界。
Context 负责给模型准备可见世界。
UX 负责让用户理解和介入。
Trace/Eval 负责让产品持续变强。

---

## 1. 最小产品定义

Claude Code Core 的最小产品不是：

```text
一个聊天机器人
一个编辑器插件
一组固定流程
一个 prompt 模板
一个自动运行 shell 的脚本
```

它的最小产品定义应该是：

```text
一个面向本地代码任务的受控 Agent Runtime。
它接收用户目标，组装模型可见上下文，让模型选择动作，
通过工具执行真实操作，把结果回灌给模型，
并用状态、权限、验证和 trace 约束整个过程。
```

这句话拆开看：

| 片段 | 含义 |
| --- | --- |
| 面向本地代码任务 | 第一阶段只解决代码库内的搜索、阅读、修改、测试、验证 |
| 受控 | 模型不能直接碰文件系统，必须通过 Runtime 和 Tool |
| Agent Runtime | 产品重点不是模型本身，而是模型外面的执行环境 |
| 用户目标 | 用户给的是结果诉求，不是每一步命令 |
| 模型可见上下文 | 模型只能基于 Runtime 给它的信息决策 |
| 模型选择动作 | 模型不是被硬编码流程牵着走，而是每轮选择下一步 |
| 工具执行真实操作 | Search、Read、Edit、Bash 等工具把决策变成行动 |
| 结果回灌 | 工具结果变成下一轮 observation |
| 状态、权限、验证、trace | 产品可靠性来自这些工程机制 |

---

## 2. 五个视角：同一个产品的五层界面

理解这个产品，不能只站在用户视角，也不能只站在模型视角。

同一轮执行里至少有五层界面。

### 2.1 用户可见界面

用户看到的是：

```text
输入目标
看到 Agent 正在搜索/阅读/修改/测试
必要时批准计划或权限
最后看到修改总结和验证结果
```

用户不需要知道：

```text
每轮 ModelRequest 的完整 token 拼装
工具结果如何被裁剪
文件 hash 如何保存
Policy 如何判断某条命令危险
```

但用户必须能理解：

```text
Agent 现在在做什么。
为什么需要某个权限。
最后到底改了什么。
有没有验证。
哪些事情没有做。
```

### 2.2 模型可见界面

模型看到的是 Runtime 组装出来的请求。

概念上包括：

```text
system / developer instructions
latest user message
recent message history
current mode
available tools and schemas
runtime state summary
project rules
recent tool results
active plan
verification state
compact summary if any
```

模型看不到：

```text
没有被 Read 的文件全文
没有被 Search 找到的文件列表
没有被放入上下文的历史细节
工具内部实现
Policy 内部所有规则
完整文件系统
完整 git history
```

所以不能说：

```text
模型天然知道项目结构。
```

只能说：

```text
Runtime 给了模型当前工作目录、工具说明、项目摘要、搜索结果或读文件结果；
模型基于这些可见信息推断下一步。
```

### 2.3 Runtime 内部界面

Runtime 保存真实状态。

例如：

```text
Session
MessageStream
RuntimeState
ToolRegistry
ToolCall
ToolResult
FileSnapshot
ModifiedFile
PermissionDecision
VerificationState
TraceEvent
Artifact
CompactSummary
```

这些对象不一定全部塞给模型。

Runtime 要判断：

```text
哪些状态必须让模型看到。
哪些状态只用于工具检查。
哪些状态只用于最终报告。
哪些状态只用于 trace/eval。
```

例子：

```text
FileSnapshot 的 hash 主要给 Runtime 用来做 stale check。
模型只需要知道“该文件已读，当前可安全尝试编辑”。

Bash 的完整 20000 行日志主要存在 Artifact。
模型只需要看到失败摘要、关键错误行和 artifact 引用。
```

### 2.4 工具执行界面

工具不是普通函数，它是模型动作和真实世界之间的边界。

每个工具至少要定义：

```text
name
description
input schema
permission requirement
precondition
execution logic
structured success result
structured error result
state update
trace event
```

例如 Edit 工具：

```text
输入：file_path、old_string、new_string、replace_all
前置条件：文件存在、路径允许、之前完整 Read 过、hash 未过期、old_string 唯一
成功结果：写入成功、diff 摘要、更新后的 hash
失败结果：error_type、recoverable、recommended_next_tool
状态更新：modified_files、file_snapshots、trace
```

这就是为什么工具设计决定 Agent 能力上限。

### 2.5 Eval 可见界面

Eval 看到的是 trace 和最终结果。

它关心：

```text
是否完成用户目标
是否调用了必要工具
是否遵守安全规则
是否跑了验证
是否如实报告
失败时能否归因
```

产品迭代不能只看“这次回答好不好”，而要看：

```text
失败发生在哪一层？

是 Context 没给够？
是 Tool 输出太乱？
是 Policy 太松？
是 Prompt 规则不清？
是模型能力不够？
是 eval 标准写错？
```

---

## 3. 一轮执行的产品级路径

一轮 Claude Code Core 执行，可以用下面这条路径理解：

```text
1. User submits goal
2. Runtime creates or updates Session
3. Runtime records UserMessage
4. Runtime updates RuntimeState
5. Context Engine assembles ModelRequest
6. Model chooses response or tool call
7. Policy checks the requested action
8. Tool Runtime executes the tool
9. ToolResult is recorded as observation
10. State is updated
11. Trace is written
12. Runtime decides whether to continue, ask, compact, or stop
13. If not done, go back to step 5
14. If done, FinalAnswer reports changes and verification
```

这里最重要的不是步骤数量，而是职责边界：

| 步骤 | 谁负责 | 关键问题 |
| --- | --- | --- |
| 1-4 | Runtime | 用户目标和状态是否被记录 |
| 5 | Context Engine | 模型现在应该看到什么 |
| 6 | Model | 下一步是回答、搜索、读文件、编辑、测试还是提问 |
| 7 | Policy | 这个动作能不能做 |
| 8 | Tool Runtime | 真实动作怎么安全执行 |
| 9-11 | Runtime | 结果如何变成下一轮事实 |
| 12 | Runtime | 是否继续、压缩、等待用户、结束 |
| 14 | Model + Runtime evidence | 最终回答能不能被 trace 支撑 |

---

## 4. 为什么它不是 workflow chain

传统 workflow chain 像这样：

```text
Step 1: 搜索
Step 2: 读取
Step 3: 修改
Step 4: 测试
Step 5: 总结
```

这适合稳定、可预期、分支很少的任务。

代码任务的问题是：

```text
不知道 bug 在哪个文件。
不知道用户描述是否准确。
不知道测试命令是什么。
不知道第一次修改是否正确。
不知道工具会不会失败。
不知道用户会不会中途改需求。
不知道上下文会不会爆掉。
```

所以 Claude Code-like 产品更像：

```text
每一轮都由模型根据当前 observation 决定下一步。
Runtime 不规定每一步，但规定可用工具、可见上下文、权限边界和验证要求。
```

这就是“模型才是 Agent”的实际含义：

```text
模型负责根据当前上下文做动态决策。
Runtime 负责让这个决策能被安全执行、被记录、被纠正、被验证。
```

---

## 5. 什么是产品决策，什么是实现决策

学习时要区分两类问题。

### 5.1 产品决策

产品决策回答：

```text
这个能力为什么存在？
用户为什么需要它？
缺失后会造成什么体验或可靠性问题？
它应该暴露给用户、模型，还是只存在 Runtime 内部？
```

例子：

```text
Plan Mode 是产品决策。
因为复杂任务需要用户先批准方向，避免 Agent 未经确认改大量文件。
```

```text
Final Answer 必须报告验证结果是产品决策。
因为用户需要知道修改是否真的被测试支撑。
```

### 5.2 实现决策

实现决策回答：

```text
对象怎么设计？
状态怎么存？
schema 怎么写？
错误怎么结构化？
token 超限怎么裁剪？
并发怎么控制？
```

例子：

```text
FileSnapshot 用 hash 还是 mtime 做 stale check，是实现决策。
```

```text
Bash 输出超过多少 tokens 转 artifact，是实现决策。
```

产品学习要先问产品决策，再落实现决策。

否则容易变成：

```text
堆了一堆工具，但不知道为什么这些工具组成了一个产品。
```

---

## 6. 从本课开始，你应该怎么学

后续学习不要再按“文档数量”推进，而按能力闭环推进。

每学一个模块，都问 8 个问题：

```text
1. 这个模块解决什么产品问题？
2. 用户是否能感知这个模块？
3. 模型是否需要看到这个模块的信息？
4. Runtime 需要保存哪些内部状态？
5. Tool / Policy 需要强制什么？
6. Context Engine 什么时候把它拼进请求？
7. 失败时 trace 如何记录？
8. Eval 如何证明它做对了？
```

例如学 Edit Tool，不要只问“怎么替换字符串”。

要问：

```text
产品问题：怎么让模型能改文件，但不能乱改？
用户感知：用户看到改了哪些文件。
模型可见：模型知道文件已读、可尝试 edit。
Runtime 状态：FileSnapshot、hash、modified_files。
Tool 强制：read-before-write、old_string 唯一、stale check。
Context 拼装：最新编辑结果和失败原因要进入下一轮。
Trace：记录 edit input、result、diff summary、error type。
Eval：未读就 edit 应失败；用户中途改文件应阻止覆盖。
```

这才是“通过重建来学习产品”。

---

## 7. Phase A 完成标准

读完 `course-00` 到 `course-05` 后，你应该能不用代码讲清楚：

```text
1. 模型第一次被调用前，Runtime 做了什么。
2. 模型看到了哪些信息，看不到哪些信息。
3. 工具为什么要以 schema 暴露给模型。
4. 合理动作的来源是什么。
5. Prompt、Policy、Tool、State 的边界分别是什么。
6. 一条任务如何通过多轮 ToolResult 推进。
7. 为什么最终回答必须依赖 VerificationState。
8. 为什么 Trace/Eval 是产品迭代的一部分。
9. 为什么公开学习边界下的提示词包（Prompt Pack）不能直接复制第三方提示词（prompt）。
10. 为什么 Claude Code-like 产品的核心是 Runtime，而不是单个 prompt。
```

如果这些问题还能讲得含糊，就不要进入代码实现。

如果这些问题能讲清楚，下一步进入：

```text
lab-01-mock-runtime-loop.md
```

它的目标不是做完整 Agent，而是先证明：

```text
ModelRequest -> ToolCall -> ToolResult -> StateUpdate -> Next ModelRequest
```

这个最小循环真的跑起来。
