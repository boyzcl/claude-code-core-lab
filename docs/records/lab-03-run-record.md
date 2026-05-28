# Lab 03 Run Record：Read / Search / Bash 运行记录

运行日期：2026-05-22

运行命令：

```bash
npm run lab:03
npm run lab:03:verify
```

---

## 1. 本次运行证明了什么

本次运行接入了第一组真实工具：

```text
Search
Read
Bash
```

它证明：

```text
Search 能在真实临时 workspace 中找到 src/pagination.js。
Read 能读取真实文件 src/pagination.js。
Bash 能执行 allowlisted 命令 node scripts/check.js。
三个 ToolResult 都进入 MessageStore。
RuntimeState 记录了 readFiles、toolResults、lastAction。
```

---

## 2. 演示结果

`npm run lab:03` 输出的核心检查：

```json
{
  "search_found_real_file": true,
  "read_returned_real_file_content": true,
  "bash_ran_real_command": true,
  "tool_results_entered_message_store": true,
  "state_tracks_read_and_last_action": true
}
```

最终状态：

```json
{
  "readFiles": ["src/pagination.js"],
  "toolResults": [
    "tool_result_tool_call_search_001",
    "tool_result_tool_call_read_001",
    "tool_result_tool_call_bash_001"
  ],
  "lastAction": "Bash"
}
```

---

## 3. 完整验证套件结果

`npm run lab:03:verify` 通过 5 个 case：

```json
{
  "passed": 5,
  "cases": [
    "happy path: real Search, Read, Bash results enter MessageStore",
    "Read policy: path traversal is denied as ToolResult",
    "Bash policy: non-allowlisted command is denied",
    "Bash failure: non-zero exit is structured ToolResult",
    "Search miss: zero matches is still a successful observation"
  ]
}
```

---

## 4. 这对学习有什么帮助

Lab 03 把工具从“假的返回值”推进到了“真实执行”。

但真正重要的不是：

```text
我们能读文件。
我们能搜文件。
我们能跑命令。
```

真正重要的是：

```text
真实工具也被统一成 ToolResult。
真实工具也受 Policy 控制。
真实工具失败也不会让 Runtime 崩掉。
真实工具结果也会进入 MessageStore 和 Trace。
```

这就是 Claude Code-like 产品能可靠工作的基础。

如果工具只是随便打印输出，后面模型无法稳定恢复。

如果 Bash 失败直接抛异常，模型无法基于失败日志继续推理。

如果 Search miss 被当作 Runtime error，模型会失去“没有结果”这个重要事实。

---

## 5. 下一步

下一步进入：

```text
lab-04-edit-tool-safety.md
```

目标：

```text
实现安全 Edit。
验证 read-before-write。
验证 old_string 唯一性。
验证 stale file check。
验证 Edit 失败也返回结构化 ToolResult。
```
