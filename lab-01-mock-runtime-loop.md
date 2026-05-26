# Lab 01 Mock Runtime Loop：不用真实模型，先跑通最小 Agent 循环

> 本文是第一个可执行实验文档。
>
> 它不是新的理论课，而是把 `course-01` 到 `course-05` 学到的最小机制跑起来。
>
> 本 Lab 只训练一件事：
>
> ```text
> UserMessage -> ModelRequest -> ToolCall -> ToolResult -> StateUpdate -> Next ModelRequest
> ```
>
> 先不要接 GPT 5.5，也不要做完整 Claude Code Core。
>
> 原因很简单：
>
> ```text
> 强模型会替你补很多 Runtime 没做好的事。
> MockModel 不会帮你脑补。
> 它能逼你看清楚 Runtime 到底给了什么、记录了什么、回灌了什么。
> ```

---

## 0. 前置条件

开始本 Lab 前，你应该已经读完：

```text
course-00-teaching-standard.md
course-01-initial-model-request.md
course-02-action-selection-rubric.md
course-03-clean-room-prompt-pack.md
course-04-single-task-full-trace.md
course-05-product-mental-model.md
```

并能回答：

```text
1. 模型第一次被调用时，看到的不是裸用户消息，而是 ModelRequest。
2. 工具不是模型天然知道的，而是 Runtime 通过 tools/schema 暴露的。
3. 合理动作来自用户目标、当前状态、工具说明、Policy 和阶段规则。
4. Prompt 负责引导，Policy 负责约束，Tool 负责行动，State 负责事实。
5. ToolResult 是下一轮 observation，不是一次失败就结束整个 Agent。
```

如果上面 5 条还讲不清楚，先不要做本 Lab。

### 0.1 本地运行入口

本 Lab 已经有最小可运行实现：

```text
package.json
src/lab01/mock-runtime-loop.mjs
```

运行命令：

```bash
npm run lab:01
```

完整验证命令：

```bash
npm run lab:01:verify
```

这个命令会输出：

```text
finalAnswer
checks
state
messageStream
trace
```

其中 `checks` 是本 Lab 的内置验收结果，用来确认：

```text
第一轮 ModelRequest 没有 Read 结果。
第二轮 ModelRequest 已经能看到 Read 的 ToolResult。
最终回答来自 ToolResult。
MessageStream 顺序正确。
```

`lab:01:verify` 会额外验证：

```text
happy path：ToolResult 能进入第二轮 ModelRequest。
missing tool schema：没有 Read schema 时，模型不能凭空调用 Read。
policy denial：非法路径会被 Policy 拒绝，并转成 denied ToolResult。
tool failure：工具失败会返回结构化 error ToolResult，而不是让 Runtime 崩掉。
```

---

## 1. 本 Lab 要学会什么

你要亲手跑通一个最小 Agent 循环。

这个循环里有：

```text
1. UserMessage
2. Session
3. MessageStream
4. ModelRequest
5. Tool schema
6. MockModel
7. ToolCall
8. FakeReadTool
9. ToolResult
10. RuntimeState update
11. Second ModelRequest
12. Final assistant answer
```

你暂时不会做：

```text
Search
Edit
Bash
真实文件系统
真实模型 API
Plan Mode
Compaction
复杂权限
```

这些不是不重要，而是不能在第一步混进来。

第一步只看清楚：

```text
一次工具调用如何进入下一轮模型上下文。
```

---

## 2. 为什么第一个 Lab 必须用 MockModel

如果一开始就接真实模型，模型可能会：

```text
根据常识猜下一步。
自动补全你没给的规则。
容忍混乱的 ToolResult。
在上下文缺失时仍然给出看似合理的回答。
```

这会掩盖 Runtime 的问题。

MockModel 的好处是：

```text
它只按你写死的规则行动。
它不会自己理解代码库。
它不会猜工具。
它不会替你修复状态丢失。
```

所以如果 MockModel 都跑不通，说明 Runtime 协议一定有问题。

---

## 3. 最小任务场景

用户输入：

```text
请读取 README.md，并告诉我项目名。
```

我们假设有一个假的工具 `Read`，它不真的读磁盘，而是返回固定内容：

```text
# Toy Agent Runtime

This is a minimal runtime loop demo.
```

最终 Agent 应该回答：

```text
项目名是 Toy Agent Runtime。
```

注意：

```text
模型第一次不能直接回答项目名。
因为第一次 ModelRequest 里还没有 README.md 内容。
它只能先调用 Read。
```

---

## 4. 本 Lab 的最小对象

### 4.1 UserMessage

```json
{
  "type": "user",
  "id": "msg_user_001",
  "content": "请读取 README.md，并告诉我项目名。"
}
```

它解决的问题：

```text
记录用户目标。
```

模型如何看到：

```text
作为 messages 的一部分进入 ModelRequest。
```

### 4.2 Tool schema

```json
{
  "name": "Read",
  "description": "Read a text file from the current workspace.",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Workspace-relative file path."
      }
    },
    "required": ["path"]
  }
}
```

它解决的问题：

```text
告诉模型有什么工具、工具叫什么、参数怎么填。
```

关键纠偏：

```text
工具信息不应该只塞在 system prompt 的自然语言里。
真实 Runtime 应该用结构化 tool schema 暴露工具。
system prompt 可以解释使用策略，但 tools/schema 才是工具接口。
```

### 4.3 RuntimeState

第一轮前：

```json
{
  "mode": "normal",
  "workspaceRoot": "/workspace/toy-agent",
  "readFiles": [],
  "toolResults": [],
  "lastAction": null
}
```

Read 成功后：

```json
{
  "mode": "normal",
  "workspaceRoot": "/workspace/toy-agent",
  "readFiles": ["README.md"],
  "toolResults": ["tool_result_001"],
  "lastAction": "Read"
}
```

它解决的问题：

```text
Runtime 记录事实，而不是让模型自己记。
```

模型如何看到：

```text
Context Engine 可以把 RuntimeState 的摘要拼进下一轮 ModelRequest。
```

### 4.4 MessageStream

第一轮前：

```json
[
  {
    "type": "user",
    "id": "msg_user_001",
    "content": "请读取 README.md，并告诉我项目名。"
  }
]
```

Read 之后：

```json
[
  {
    "type": "user",
    "id": "msg_user_001",
    "content": "请读取 README.md，并告诉我项目名。"
  },
  {
    "type": "assistant_tool_call",
    "id": "msg_assistant_001",
    "tool_call": {
      "id": "tool_call_001",
      "name": "Read",
      "input": {
        "path": "README.md"
      }
    }
  },
  {
    "type": "tool_result",
    "id": "tool_result_001",
    "tool_call_id": "tool_call_001",
    "name": "Read",
    "status": "success",
    "content": {
      "path": "README.md",
      "text": "# Toy Agent Runtime\n\nThis is a minimal runtime loop demo."
    }
  }
]
```

它解决的问题：

```text
把用户说过什么、模型做过什么、工具返回什么串成可回放事实。
```

关键原则：

```text
MessageStream 应该 append-only。
不要为了让上下文好看，事后改写旧 ToolResult。
如果输出太长，后续通过 Artifact 和 Summary 处理，不在本 Lab 处理。
```

---

## 5. 第一次 ModelRequest

第一次请求不是裸用户消息。

它至少应该长这样：

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a local coding agent. Use tools when information is missing. Do not claim to know file contents unless a tool result provides them."
    },
    {
      "role": "runtime",
      "content": {
        "mode": "normal",
        "workspaceRoot": "/workspace/toy-agent",
        "readFiles": [],
        "knownFacts": []
      }
    },
    {
      "role": "user",
      "content": "请读取 README.md，并告诉我项目名。"
    }
  ],
  "tools": [
    {
      "name": "Read",
      "description": "Read a text file from the current workspace.",
      "input_schema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string"
          }
        },
        "required": ["path"]
      }
    }
  ]
}
```

模型第一轮能知道：

| 信息 | 来源 | 用途 |
| --- | --- | --- |
| 用户要知道项目名 | user message | 明确目标 |
| 需要文件内容才知道项目名 | system rule + 常识 | 判断信息缺失 |
| 不能假装知道 README 内容 | system rule | 阻止直接回答 |
| 可以调用 Read | tools schema | 选择工具 |
| Read 需要 path 参数 | tools schema | 构造 ToolCall |
| 当前没有读过文件 | runtime state | 确认信息缺口 |

模型第一轮不应该知道：

```text
README.md 的内容。
项目名是什么。
文件是否真的存在。
```

---

## 6. MockModel 的行为规则

本 Lab 的 MockModel 不调用任何真实大模型。

它只有两条规则：

```text
Rule 1:
如果 MessageStream 里还没有 Read 的 ToolResult，
就输出 ToolCall: Read({ "path": "README.md" })。

Rule 2:
如果 MessageStream 里已经有 Read 的 ToolResult，
就从 ToolResult.content.text 的第一行提取标题，并输出最终回答。
```

伪代码：

```ts
function mockModel(request: ModelRequest): ModelOutput {
  const readResult = findLatestToolResult(request.messages, "Read")

  if (!readResult) {
    return {
      type: "tool_call",
      toolCall: {
        id: "tool_call_001",
        name: "Read",
        input: {
          path: "README.md"
        }
      }
    }
  }

  const title = readResult.content.text
    .split("\n")[0]
    .replace(/^#\s*/, "")

  return {
    type: "final_answer",
    content: `项目名是 ${title}。`
  }
}
```

这段逻辑的学习意义：

```text
MockModel 不是为了变聪明。
它只是帮助你验证 Runtime 是否正确回灌 ToolResult。
```

如果第二轮 MockModel 看不到 ToolResult，它就无法回答。

这正是本 Lab 要暴露的问题。

---

## 7. FakeReadTool 的行为规则

FakeReadTool 也不读真实文件。

它只支持一个路径：

```text
README.md
```

成功返回：

```json
{
  "type": "tool_result",
  "id": "tool_result_001",
  "tool_call_id": "tool_call_001",
  "name": "Read",
  "status": "success",
  "content": {
    "path": "README.md",
    "text": "# Toy Agent Runtime\n\nThis is a minimal runtime loop demo."
  },
  "metadata": {
    "bytes": 62
  }
}
```

如果 path 不是 `README.md`，返回结构化失败：

```json
{
  "type": "tool_result",
  "id": "tool_result_error_001",
  "tool_call_id": "tool_call_001",
  "name": "Read",
  "status": "error",
  "error": {
    "error_type": "file_not_found",
    "message": "FakeReadTool only contains README.md.",
    "recoverable": true,
    "recommended_next_tool": null
  }
}
```

注意：

```text
失败也要变成 ToolResult。
失败不是 throw 后让整个 Runtime 消失。
```

---

## 8. Runtime Loop 执行流程

本 Lab 的 Runtime Loop 只跑最多 3 轮，防止死循环。

流程：

```text
1. 创建 Session。
2. 把 UserMessage append 到 MessageStream。
3. buildModelRequest(session)。
4. 调用 mockModel(request)。
5. 如果输出 final_answer，append 并结束。
6. 如果输出 tool_call，append tool_call。
7. 用 ToolRegistry 找到对应工具。
8. Policy 做最小检查。
9. 执行工具，得到 ToolResult。
10. append ToolResult。
11. 用 ToolResult 更新 RuntimeState。
12. 回到第 3 步。
```

最小伪代码：

```ts
function run(userText: string) {
  const session = createSession()
  appendMessage(session, {
    type: "user",
    content: userText
  })

  for (let i = 0; i < 3; i++) {
    const request = buildModelRequest(session)
    const output = mockModel(request)

    if (output.type === "final_answer") {
      appendMessage(session, {
        type: "assistant",
        content: output.content
      })
      return session
    }

    if (output.type === "tool_call") {
      appendMessage(session, {
        type: "assistant_tool_call",
        tool_call: output.toolCall
      })

      const decision = authorize(output.toolCall, session)
      const result = decision.allowed
        ? executeTool(output.toolCall)
        : makeDeniedToolResult(output.toolCall, decision)

      appendMessage(session, result)
      applyToolResultToState(session, result)
      continue
    }
  }

  throw new Error("Loop exceeded max turns")
}
```

---

## 9. 最小 Policy

本 Lab 只需要一个很小的 Policy：

```text
允许 Read("README.md")。
拒绝其他工具。
拒绝绝对路径。
拒绝包含 ".." 的路径。
```

为什么还要 Policy？

因为从第一天就要建立边界：

```text
模型请求动作，不代表 Runtime 必须执行动作。
```

在本 Lab 中：

```text
Prompt 可以告诉模型“只读 README.md”。
Policy 必须真的拒绝其他路径。
```

这能帮你理解：

```text
Prompt 是引导。
Policy 是硬门。
```

---

## 10. 预期完整 Trace

跑完本 Lab 后，你应该能得到类似 trace：

```json
[
  {
    "event": "session.created",
    "session_id": "session_001"
  },
  {
    "event": "message.appended",
    "message_type": "user"
  },
  {
    "event": "model.request.built",
    "turn": 1,
    "message_count": 1,
    "tool_count": 1
  },
  {
    "event": "model.output",
    "turn": 1,
    "output_type": "tool_call",
    "tool": "Read"
  },
  {
    "event": "tool.authorized",
    "tool": "Read",
    "allowed": true
  },
  {
    "event": "tool.executed",
    "tool": "Read",
    "status": "success"
  },
  {
    "event": "state.updated",
    "readFiles": ["README.md"]
  },
  {
    "event": "model.request.built",
    "turn": 2,
    "message_count": 3,
    "tool_count": 1
  },
  {
    "event": "model.output",
    "turn": 2,
    "output_type": "final_answer"
  }
]
```

Trace 要证明：

```text
第一轮模型没有文件内容。
第一轮模型调用了 Read。
Read 结果进入 MessageStream。
第二轮 ModelRequest 包含 Read 的 ToolResult。
第二轮模型基于 ToolResult 回答。
```

---

## 11. 验收标准

本 Lab 通过，不是看代码多漂亮，而是看 6 个事实是否成立。

### 11.1 必须通过

```text
1. 初始 ModelRequest 里有 user message。
2. 初始 ModelRequest 里有 Read tool schema。
3. 初始 ModelRequest 里没有 README.md 内容。
4. MockModel 第一轮输出 Read ToolCall。
5. FakeReadTool 的 ToolResult 被 append 到 MessageStream。
6. 第二轮 ModelRequest 能看到 ToolResult，并输出最终回答。
```

### 11.2 必须能解释

你要能用自己的话解释：

```text
为什么模型第一轮不能直接回答项目名。
为什么工具信息不等于一句自然语言提示。
为什么 ToolResult 要进入 MessageStream。
为什么 RuntimeState 和 MessageStream 不是同一个东西。
为什么失败 ToolResult 也应该回灌。
为什么 Policy 要在第一个 Lab 就出现。
```

---

## 12. 常见错误

### 12.1 把工具写进 prompt，但没有 tools schema

错误：

```text
system prompt 里说“你可以用 Read 工具”，但 request.tools 为空。
```

后果：

```text
模型没有结构化工具接口。
Runtime 也无法可靠解析 ToolCall。
```

### 12.2 ToolResult 没有进入第二轮 ModelRequest

错误：

```text
工具执行了，但结果只打印在控制台，没有 append 到 MessageStream。
```

后果：

```text
模型第二轮仍然看不到 README 内容。
Agent 循环断裂。
```

### 12.3 RuntimeState 代替 MessageStream

错误：

```text
只记录 readFiles=["README.md"]，但不保存 ToolResult.content.text。
```

后果：

```text
模型知道“读过”，但不知道“读到了什么”。
```

### 12.4 失败直接 throw，模型看不到失败

错误：

```text
Read 失败后 Runtime 直接崩掉。
```

后果：

```text
模型没有机会基于失败恢复。
```

正确做法：

```text
把失败标准化为 ToolResult，再让下一轮模型看到。
```

### 12.5 第一版就接真实模型

错误：

```text
一上来接 GPT 5.5，然后调 prompt。
```

后果：

```text
你可能以为 Agent 会跑了，但其实 Runtime 协议没有被验证。
```

---

## 13. 学习记录模板

做完本 Lab 后，用下面模板记录：

```text
本 Lab 我真正跑通了什么：

我现在能解释的对象：
  - ModelRequest:
  - ToolCall:
  - ToolResult:
  - MessageStream:
  - RuntimeState:

我看到的最关键状态变化：

如果 ToolResult 不回灌，会发生什么：

如果 tools schema 不给模型，会发生什么：

下一步我还不理解的地方：
```

这份记录未来会变成开源教程里的 reflection note。

---

## 14. 下一步

完成本 Lab 后，才进入：

```text
lab-02-message-store.md
```

`lab-02` 会把本 Lab 的内存数组，升级成更明确的 Session / MessageStore：

```text
Session 如何创建。
MessageStream 如何 append-only。
ToolCall 和 ToolResult 如何关联。
TraceEvent 如何记录。
```

再之后才进入：

```text
lab-03-read-search-bash.md
lab-04-edit-tool-safety.md
```

不要急着做 Edit。

因为 Edit 之前必须先真正理解：

```text
模型看到什么。
工具怎么暴露。
结果怎么回灌。
状态怎么更新。
Policy 怎么拦截。
```
