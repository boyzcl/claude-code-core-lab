# Lab 01 Run Record：Mock Runtime Loop 运行记录

运行日期：2026-05-22

运行命令：

```bash
npm run lab:01
npm run lab:01:verify
```

---

## 1. 本次运行证明了什么

本次运行已经跑通最小 Agent 循环：

```text
UserMessage
-> ModelRequest
-> MockModel outputs ToolCall
-> FakeReadTool returns ToolResult
-> Runtime appends ToolResult
-> Runtime updates State
-> Second ModelRequest sees ToolResult
-> MockModel outputs FinalAnswer
```

最终回答：

```text
项目名是 Toy Agent Runtime。
```

---

## 2. 内置检查结果

脚本输出的 `checks`：

```json
{
  "final_answer_from_tool_result": true,
  "tool_schema_is_exposed": true,
  "first_request_has_no_read_result": true,
  "first_request_has_no_readme_text": true,
  "second_request_has_read_result": true,
  "second_request_has_readme_text": true,
  "message_stream_order_is_valid": true
}
```

含义：

| 检查项 | 说明 |
| --- | --- |
| `final_answer_from_tool_result` | 最终答案不是模型凭空猜的，而是来自 Read ToolResult |
| `tool_schema_is_exposed` | 第一轮 ModelRequest 明确暴露了 Read tool schema |
| `first_request_has_no_read_result` | 第一轮模型请求里还没有文件内容 |
| `first_request_has_no_readme_text` | 第一轮模型请求里没有 README 正文 |
| `second_request_has_read_result` | ToolResult 成功回灌到第二轮请求 |
| `second_request_has_readme_text` | 第二轮模型请求里已经有 README 正文 |
| `message_stream_order_is_valid` | MessageStream 顺序是 user -> tool_call -> tool_result -> assistant |

---

## 2.1 完整验证套件结果

`npm run lab:01:verify` 通过 4 个 case：

```json
{
  "passed": 4,
  "cases": [
    "happy path: ToolResult is fed into the second ModelRequest",
    "missing tool schema: model cannot call Read",
    "policy denial: illegal path becomes denied ToolResult",
    "tool failure: FakeReadTool returns structured error"
  ]
}
```

它们分别证明：

| case | 验证的机制 |
| --- | --- |
| happy path | ToolResult 进入 MessageStream，并被第二轮 ModelRequest 看见 |
| missing tool schema | 工具不是模型天然知道的，必须由 Runtime 通过 schema 暴露 |
| policy denial | 模型请求动作不等于 Runtime 必须执行，Policy 可以拒绝 |
| tool failure | 工具失败也要变成结构化 ToolResult，供下一轮模型观察 |

---

## 3. 本次关键 trace

最关键的两个 trace 事件：

```json
{
  "event": "model.request.built",
  "turn": 1,
  "has_read_result": false
}
```

```json
{
  "event": "model.request.built",
  "turn": 2,
  "has_read_result": true
}
```

这说明：

```text
ToolResult 没有只是打印出来。
它被写入了 MessageStream。
并且被 buildModelRequest 放进了下一轮模型可见上下文。
```

---

## 4. 本次学到的对象边界

### ModelRequest

模型每轮看到的请求包。

它包含：

```text
system message
runtime summary
message stream
tools schema
```

### ToolCall

模型请求 Runtime 执行的动作。

本次是：

```json
{
  "name": "Read",
  "input": {
    "path": "README.md"
  }
}
```

### ToolResult

工具执行后的 observation。

本次它包含 README 的内容：

```text
# Toy Agent Runtime
```

### MessageStream

可回放事实流。

本次顺序：

```text
user
assistant_tool_call
tool_result
assistant
```

### RuntimeState

Runtime 内部保存的状态摘要。

本次最终状态：

```json
{
  "readFiles": ["README.md"],
  "toolResults": ["tool_result_001"],
  "lastAction": "Read"
}
```

---

## 5. 下一步问题

Lab 01 只证明了最小循环成立。

它还没有解决：

```text
Session 如何持久化。
Message 如何 append-only 存储。
ToolCall 和 ToolResult 如何用 id 可靠关联。
多个工具结果如何查询。
Trace 如何成为 eval 的输入。
```

这些进入：

```text
lab-02-message-store.md
```
