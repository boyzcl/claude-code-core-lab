# Lab 02 Message Store：把临时数组升级成可回放事实层

> 本 Lab 接在 `lab-01-mock-runtime-loop.md` 后面。
>
> Lab 01 验证的是：
>
> ```text
> ToolResult 能不能回灌到下一轮 ModelRequest。
> ```
>
> Lab 02 验证的是：
>
> ```text
> 这些 Message、ToolCall、ToolResult、TraceEvent 能不能被可靠保存、关联和回放。
> ```

---

## 0. 为什么要做 Message Store

如果 Agent 只有一个临时数组，会出现几个问题：

```text
ToolResult 可能找不到对应的 ToolCall。
外部代码可能误改历史消息。
重复 ToolResult 可能污染状态。
Trace 无法证明每一步发生过什么。
下一轮 ModelRequest 不知道该从哪里取消息事实。
```

所以 Claude Code-like Runtime 需要一个事实层：

```text
Session
MessageStream
ToolCall
ToolResult
RuntimeState
TraceEvent
```

这个事实层不是为了“存数据好看”，而是为了让 Agent 的行为：

```text
可回放
可验证
可恢复
可归因
```

---

## 1. 本 Lab 要验证什么

本 Lab 有 5 个验证目标：

```text
1. MessageStream 是有顺序的。
2. ToolResult 必须关联一个已存在的 ToolCall。
3. ToolResult 不能随便重复写入。
4. 外部读取 messages 后，不能反向修改 Store 内部状态。
5. 每次 append 都必须留下 TraceEvent。
```

这 5 件事对应 Agent Runtime 的基础可靠性。

如果它们不成立，后面的 Context Engine、Eval、Compaction 都会站不稳。

---

## 2. 本地运行入口

演示命令：

```bash
npm run lab:02
```

验证命令：

```bash
npm run lab:02:verify
```

代码位置：

```text
src/lab02/message-store.mjs
src/lab02/message-store.verify.mjs
```

---

## 3. 最小对象模型

### 3.1 Session

Session 是一次任务或一段连续对话的容器。

它包含：

```text
id
state
messages
trace
```

在本 Lab 中：

```json
{
  "id": "session_001",
  "state": {
    "mode": "normal",
    "workspaceRoot": "/workspace/toy-agent",
    "readFiles": [],
    "toolResults": [],
    "lastAction": null
  }
}
```

### 3.2 MessageStream

MessageStream 是 append-only 的事实流。

本 Lab 的顺序：

```text
1. user
2. assistant_tool_call
3. tool_result
4. assistant
```

每条 message 都有：

```text
id
sequence
type
role
content 或 tool_call / tool_result 字段
```

### 3.3 ToolCall

ToolCall 是模型请求 Runtime 执行的动作。

```json
{
  "id": "tool_call_001",
  "name": "Read",
  "input": {
    "path": "README.md"
  }
}
```

### 3.4 ToolResult

ToolResult 是工具执行后的 observation。

它必须通过 `tool_call_id` 关联 ToolCall：

```json
{
  "id": "tool_result_001",
  "tool_call_id": "tool_call_001",
  "name": "Read",
  "status": "success"
}
```

如果没有这个关联，模型下一轮也许能看到一段工具输出，但 Runtime 无法证明：

```text
这是哪个工具调用返回的。
它是否对应当前回合。
它是否重复。
它是否应该更新状态。
```

### 3.5 TraceEvent

TraceEvent 是给人和 eval 看的执行证据。

本 Lab 记录：

```text
session.created
message.appended
state.updated
```

Trace 不是模型上下文本身。

Trace 的作用是：

```text
调试
验收
失败归因
回放
未来 eval
```

---

## 4. 本 Lab 的验证结果

`npm run lab:02:verify` 应通过 5 个 case：

```text
1. happy path: append-only MessageStream with linked ToolResult
2. append-only: returned messages cannot mutate store internals
3. orphan ToolResult: result before call is rejected
4. duplicate ToolResult: one ToolCall gets one result in lab-02
5. trace: every append is recorded with sequence
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| happy path | 消息顺序、ToolResult 关联、State 更新、Trace 更新都成立 |
| append-only clone | 外部拿到 messages 后不能篡改 Store 内部事实 |
| orphan ToolResult | 没有 ToolCall 的 ToolResult 会被拒绝 |
| duplicate ToolResult | 同一个 ToolCall 不会被重复写入结果 |
| trace sequence | append 事件有顺序，可回放 |

---

## 5. 本 Lab 和 Lab 01 的关系

Lab 01 里我们直接操作：

```text
session.messages.push(...)
```

Lab 02 把它升级成：

```text
store.appendUserMessage(...)
store.appendAssistantToolCall(...)
store.appendToolResult(...)
store.appendAssistantMessage(...)
```

这个变化看起来只是包装了一层 API，但产品意义很大：

```text
从“代码刚好能跑”变成“Runtime 有事实边界”。
```

后面 Context Engine 不应该随便读写数组。

它应该通过 Store 拿：

```text
listMessages(sessionId)
getState(sessionId)
getTrace(sessionId)
buildModelMessageStream(sessionId)
```

---

## 6. 你应该学到什么

完成本 Lab 后，你应该能解释：

```text
1. 为什么 MessageStream 应该 append-only。
2. 为什么 ToolResult 必须通过 tool_call_id 关联 ToolCall。
3. 为什么外部读取 messages 应该拿 clone，而不是内部引用。
4. 为什么 RuntimeState 不是 MessageStream 的替代品。
5. 为什么 TraceEvent 是 eval 和失败归因的基础。
```

如果你能讲清这 5 点，就可以进入：

```text
lab-03-read-search-bash.md
```

Lab 03 会开始接触真实工具能力：

```text
Read
Search
Bash
```

但仍然先不做 Edit。

因为改文件之前，要先把“读、搜、跑命令、记录结果”这条事实链做扎实。
