# Core 03 Context Engine Integration：把本轮模型可见世界接入 Runtime

> 本 Core 接在 `core-02-model-gateway.md` 后面。
>
> Core 02 已经证明：
>
> ```text
> 模型层可以替换成 ModelGateway，但本地 Runtime 仍掌握工具、权限、事实流和验证状态。
> ```
>
> Core 03 验证：
>
> ```text
> ModelGateway 收到的不是完整 MessageStore 原始历史，
> 而是经过 Context Engine 选择、裁剪和 artifact 化后的 ModelRequest。
> ```

---

## 1. 本 Core 解决什么问题

Core 01 / Core 02 的 `ModelRequest` 仍然偏简单：

```text
system prompt
runtime state
完整 message stream
tools
```

这能跑通 toy task，但不是长期可用的 Agent Runtime。

真实任务里会出现：

```text
大量历史消息
多次工具结果
长 Bash 输出
失败日志
已读文件内容
用户最新约束
active plan
验证状态
```

如果全部塞给模型，会造成：

```text
关键约束被长日志挤掉。
最新失败被旧成功淹没。
模型看到过期事实。
成本和上下文窗口不可控。
```

所以 Core 03 把 Lab 05 的 Context Engine 接入 CoreRuntime。

---

## 2. 核心边界

Core 03 最重要的边界是：

```text
MessageStore 是完整事实流。
Context Engine 是本轮模型可见材料选择器。
```

它们不是同一个东西。

MessageStore 要尽量完整：

```text
记录 user message
记录 assistant tool call
记录 tool result
记录 assistant final answer
保持 append-only
作为 trace 和恢复依据
```

Context Engine 要尽量有选择：

```text
保留最新用户约束
保留 active plan
保留最新失败
保留 verificationState
选择必要已读文件
裁剪旧成功输出
长输出转 artifact
```

---

## 3. 当前实现位置

代码：

```text
src/core/context-engine.mjs
src/core/context-engine.verify.mjs
src/core/core-runtime.mjs
```

运行：

```bash
npm run core:03
npm run core:03:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 4. 当前实现了什么

### 4.1 CoreContextEngine

`CoreContextEngine` 负责从这些输入构造上下文：

```text
sessionId
workspaceRoot
turn
storeState
coreState
MessageStore messages
```

输出：

```text
blocks
artifacts
tokenEstimate
selectedMessages
messages
```

其中：

```text
blocks
  是 Context Engine 选择出的结构化上下文块。

artifacts
  是长工具输出转成的引用。

selectedMessages
  是本轮仍需要直接进入模型消息流的 MessageStore 子集。

messages
  是最终交给 ModelGateway 的 ModelRequest messages。
```

### 4.2 CoreRuntime 接入点

CoreRuntime 以前直接构造：

```text
system + runtime + full messages
```

现在改为：

```text
MessageStore
  -> CoreContextEngine.build(...)
  -> context.messages
  -> ModelGateway
```

同时 Runtime 会记录：

```text
contextSnapshots
```

用于观察每一轮：

```text
保留了哪些 context blocks
生成了哪些 artifacts
选择了哪些 message ids
估算了多少 tokens
```

### 4.3 和 ModelGateway 的关系

ModelGateway 现在收到：

```text
runtimeRequest.context
runtimeRequest.messages
```

这证明：

```text
模型层不直接决定上下文怎么裁剪。
Context Engine 在 Runtime 内部先决定本轮可见世界。
```

---

## 5. 这次实现中的关键发现

第一次接入时暴露了一个重要问题：

```text
Search ToolResult 被当成长输出 artifact 化后，
下一轮 ModelGateway 看不到 SearchResult，
于是无法决定 Read 哪个 path。
```

这说明：

```text
Context Engine 不能只会裁剪。
它还必须知道哪些 observation 是下一步决策必需的。
```

当前修正是：

```text
Search 结果进入上下文时使用紧凑摘要。
它保留 query、path、lineNumber 等下一步定位所需信息，
避免因为 JSON 过长被误裁剪或 artifact 化。
```

这正是 Core 阶段和 Lab 阶段的差别：

```text
Lab 05 证明了裁剪机制。
Core 03 证明了裁剪机制接入真实决策链时，不能破坏下一步行动所需的 observation。
```

---

## 6. 验证点

`npm run core:03:verify` 覆盖 5 个 case：

```text
1. gateway runtime: context engine integrated without breaking tool chain
2. context selection: hard state survives budget pressure
3. message boundary: artifacted long output is not selected raw context
4. model gateway: adapter receives context object with blocks
5. context budget: latest failure survives tiny budget
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| integrated runtime | 接入 Context Engine 后，Search -> Read -> Edit -> Bash 仍然跑通 |
| hard state | 最新用户、active plan、验证状态、最新失败不会被预算压力裁掉 |
| artifact boundary | 长输出可 artifact 化，原始长输出不直接塞进 selected messages |
| gateway context | ModelGateway 收到的是带 context blocks 的请求 |
| latest failure | 小预算下最新失败和验证状态仍然保留 |

---

## 7. 课程层面的学习契约

本 Core 对应 `claude-code-core-learning-path.md` 里的 Core Build Pass。

你在 Core 03 要学到的不是“拼 prompt 技巧”，而是：

```text
Runtime 如何决定本轮模型该看什么。
```

### 7.1 Product Question

Core 03 解决的问题是：

```text
如何让模型看到足够做下一步决策的事实，同时不被历史、长输出和低价值信息淹没？
```

如果没有 Core 03，系统会退化成：

```text
把 MessageStore 全量倒给模型。
```

这在 toy task 能跑，但在真实任务里会很快失控。

### 7.2 Integration Map

Core 03 的接入图：

```text
MessageStore + CoreState
  -> CoreContextEngine
  -> context.blocks / artifacts / selectedMessages
  -> ModelRequest
  -> ModelGateway
  -> ToolCall / FinalAnswer
```

学习时重点观察：

```text
MessageStore 仍然完整。
ModelRequest 变成 Context Engine 选择后的视图。
Context blocks 里 hard state 是否保留。
长输出是否转 artifact。
selectedMessages 是否避免携带原始长输出。
SearchResult 是否仍保留下一步 Read 所需 path。
```

### 7.3 Gate Check

学完 Core 03 后，你应该能回答：

```text
1. MessageStore 和 ModelRequest 的区别是什么？
2. Context Engine 为什么不能只是“压缩历史”？
3. 哪些信息必须 hard keep？
4. 长 Bash 输出为什么要 artifact 化？
5. 为什么最新失败比旧成功更重要？
6. 为什么 SearchResult 被误裁剪会破坏下一轮决策？
7. Context Engine 失败时，问题应该归因到 context 层，而不是 model 或 tool 层，为什么？
```

能回答这些问题，才进入 Core 04。

---

## 8. 下一步

Core 03 之后，下一步应该进入：

```text
Core 04 Plan Mode Integration
```

目标：

```text
把 Lab 06 的 Plan Mode 从独立实验接入 CoreRuntime，
让 plan / approval / execute mode 真正影响工具权限和运行状态。
```
