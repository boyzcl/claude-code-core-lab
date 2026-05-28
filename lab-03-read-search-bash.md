# Lab 03 Read / Search / Bash：接入第一组真实工具

> 本 Lab 接在 `lab-02-message-store.md` 后面。
>
> Lab 01 验证了最小循环。
>
> Lab 02 验证了事实层。
>
> Lab 03 验证：
>
> ```text
> 真实工具执行结果，能不能继续以结构化 ToolResult 的方式进入 MessageStore。
> ```

---

## 0. 本 Lab 不做什么

本 Lab 仍然不做 Edit。

原因：

```text
改文件是高风险动作。
在做 Edit 前，必须先证明 Read / Search / Bash 的观察链是可靠的。
```

所以本 Lab 只做：

```text
Search
Read
Bash
Policy denial
structured ToolResult
MessageStore integration
```

---

## 1. 本 Lab 要验证什么

本 Lab 有 5 个验证目标：

```text
1. Search 能在真实 workspace 中找到文件内容。
2. Read 能读取真实文件内容。
3. Bash 能运行 allowlisted 命令并记录 exitCode/stdout/stderr。
4. Policy 能拒绝越界读取和非 allowlisted 命令。
5. 工具失败不是 Runtime 崩掉，而是结构化 ToolResult。
```

这一步的重点不是工具功能多强，而是工具协议是否稳定。

---

## 2. 本地运行入口

演示命令：

```bash
npm run lab:03
```

验证命令：

```bash
npm run lab:03:verify
```

代码位置：

```text
src/lab03/read-search-bash.mjs
src/lab03/read-search-bash.verify.mjs
```

---

## 3. Toy Workspace

脚本运行时会创建一个临时 workspace。

里面包含：

```text
README.md
src/pagination.js
scripts/check.js
scripts/fail.js
```

为什么用临时 workspace？

```text
它是真实文件系统。
Search/Read/Bash 都是真执行。
但它不触碰当前真实项目里的内容。
```

这让我们同时获得：

```text
真实工具行为
可控实验边界
可重复验证结果
```

---

## 4. 工具边界

### 4.1 Search

输入：

```json
{
  "query": "paginate"
}
```

输出：

```json
{
  "status": "success",
  "content": {
    "query": "paginate",
    "matches": [
      {
        "path": "src/pagination.js",
        "lineNumber": 1,
        "line": "export function paginate(items, page, pageSize) {"
      }
    ]
  }
}
```

要点：

```text
Search miss 也是成功 observation。
如果没有结果，它应该返回 matches=[]，不是 Runtime error。
```

### 4.2 Read

输入：

```json
{
  "path": "src/pagination.js"
}
```

输出：

```json
{
  "status": "success",
  "content": {
    "path": "src/pagination.js",
    "text": "export function paginate..."
  }
}
```

Policy：

```text
拒绝绝对路径。
拒绝包含 .. 的路径。
只允许 workspace 内部路径。
```

### 4.3 Bash

输入：

```json
{
  "command": "node scripts/check.js"
}
```

输出：

```json
{
  "status": "success",
  "content": {
    "command": "node scripts/check.js",
    "exitCode": 0,
    "stdout": "pagination check passed",
    "stderr": ""
  }
}
```

Policy：

```text
只允许 allowlisted 命令。
本 Lab 允许：
  node scripts/check.js
  node scripts/fail.js
```

非 allowlisted 命令会返回：

```text
status=denied
error_type=permission_denied
```

---

## 5. 本 Lab 的验证结果

`npm run lab:03:verify` 应通过 5 个 case：

```text
1. happy path: real Search, Read, Bash results enter MessageStore
2. Read policy: path traversal is denied as ToolResult
3. Bash policy: non-allowlisted command is denied
4. Bash failure: non-zero exit is structured ToolResult
5. Search miss: zero matches is still a successful observation
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| happy path | 真实 Search/Read/Bash 的结果能进入 MessageStore |
| Read policy | 越界路径不会被执行，会变成 denied ToolResult |
| Bash policy | 危险或未知命令不会执行，会被拒绝 |
| Bash failure | 非 0 exit code 会被结构化记录，而不是抛崩 Runtime |
| Search miss | 没搜到也是有价值 observation |

---

## 6. 本 Lab 和前两关的关系

Lab 01：

```text
证明 ToolResult 可以回灌到下一轮。
```

Lab 02：

```text
证明 ToolResult 可以被可靠保存、关联和回放。
```

Lab 03：

```text
证明真实工具结果也能遵守同一套协议。
```

这个关系很重要。

我们不是为每个工具单独发明一套流程。

统一结构应该是：

```text
ToolCall
-> Policy
-> Tool execution
-> ToolResult
-> MessageStore
-> State update
-> Trace
```

---

## 7. 你应该学到什么

完成本 Lab 后，你应该能解释：

```text
1. 为什么真实工具也必须返回结构化 ToolResult。
2. 为什么 Search miss 不是错误，而是 observation。
3. 为什么 Bash 要有 allowlist。
4. 为什么非 0 exit code 仍然要回灌给模型。
5. 为什么 Edit 不能早于 Read/Search/Bash 工具链。
```

如果你能讲清这 5 点，就可以进入：

```text
lab-04-edit-tool-safety.md
```

Lab 04 才开始做 Edit。

但 Edit 的目标不是“能替换字符串”。

它要验证：

```text
read-before-write
old_string 唯一性
stale file check
path safety
structured edit errors
```
