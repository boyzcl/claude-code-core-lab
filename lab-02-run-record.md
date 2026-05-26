# Lab 02 Run Record：Message Store 运行记录

运行日期：2026-05-22

运行命令：

```bash
npm run lab:02
npm run lab:02:verify
```

---

## 1. 本次运行证明了什么

本次运行把 Lab 01 的临时数组升级成了 `MessageStore`。

它证明：

```text
Session 可以创建。
MessageStream 可以按顺序 append。
ToolResult 必须关联已存在的 ToolCall。
ToolResult 会更新 RuntimeState。
每次 append 和 state update 都会产生 TraceEvent。
```

---

## 2. 演示结果

`npm run lab:02` 输出的核心检查：

```json
{
  "message_stream_is_ordered": true,
  "tool_result_is_linked_to_tool_call": true,
  "state_tracks_read_file": true,
  "trace_records_state_update": true
}
```

最终 MessageStream 顺序：

```text
1. user
2. assistant_tool_call
3. tool_result
4. assistant
```

最终 RuntimeState：

```json
{
  "readFiles": ["README.md"],
  "toolResults": ["tool_result_001"],
  "lastAction": "Read"
}
```

---

## 3. 完整验证套件结果

`npm run lab:02:verify` 通过 5 个 case：

```json
{
  "passed": 5,
  "cases": [
    "happy path: append-only MessageStream with linked ToolResult",
    "append-only: returned messages cannot mutate store internals",
    "orphan ToolResult: result before call is rejected",
    "duplicate ToolResult: one ToolCall gets one result in lab-02",
    "trace: every append is recorded with sequence"
  ]
}
```

---

## 4. 这对学习有什么帮助

Lab 01 让你看到：

```text
ToolResult 必须回灌给下一轮模型。
```

Lab 02 让你看到：

```text
ToolResult 不能只是“回灌一段文字”。
它必须成为可保存、可关联、可回放、可验证的事实。
```

这就是 Agent Runtime 的事实层。

没有事实层，后面会出现这些问题：

```text
模型不知道哪些文件已经读过。
Runtime 不知道某个 ToolResult 属于哪次 ToolCall。
Eval 无法判断 Agent 是否真的执行了工具。
Compaction 无法知道哪些信息必须保留。
Final Answer 无法证明自己有没有依据。
```

---

## 5. 下一步

下一步进入：

```text
lab-03-read-search-bash.md
```

目标：

```text
把 FakeReadTool 升级成真实 Read。
加入 Search。
加入 Bash。
让 ToolResult 继续进入 MessageStore。
```
