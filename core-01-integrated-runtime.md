# Core 01 Integrated Runtime：把 Lab 机制合成最小 Agent Core

> 前 8 个 Lab 各自验证一个机制。
>
> 本文验证：
>
> ```text
> 这些机制能不能组成一条完整的 Claude Code-like Core 执行链。
> ```

---

## 1. 本 Core 做什么

它用一个 `ScriptedFixModel` 模拟模型决策，跑通：

```text
UserMessage
-> Search
-> Read
-> Edit
-> Bash
-> FinalAnswer
```

任务：

```text
修复分页多返回一个元素的问题，并运行测试。
```

Toy workspace 初始 bug：

```js
return items.slice(start, start + pageSize + 1);
```

修复后：

```js
return items.slice(start, start + pageSize);
```

验证命令：

```bash
node scripts/test.cjs
```

---

## 2. 本 Core 复用了哪些 Lab 机制

| 机制 | 来源 |
| --- | --- |
| Runtime Loop | Lab 01 |
| MessageStore | Lab 02 |
| Search / Read / Bash | Lab 03 |
| Edit safety | Lab 04 |
| Context request shape | Lab 05 的思想，当前 Core 使用简化版 |
| Plan Mode | Lab 06 已验证，当前 Core demo 未启用 |
| Compaction | Lab 07 已验证，当前 Core demo 未触发 |
| Eval Runner | Lab 08 已验证，当前 Core 用 `core:verify` 验收 |

---

## 3. 本地运行入口

演示：

```bash
npm run core:demo
```

验证：

```bash
npm run core:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 4. Core 验证点

`core:verify` 覆盖 5 个 case：

```text
1. integrated runtime fixes and verifies bug
2. every tool result is linked
3. Edit without Read returns structured error
4. non-allowlisted Bash is denied
5. runtime stops with final answer after verification
```

它证明：

```text
工具链按顺序执行。
ToolResult 都进入 MessageStore。
Edit 仍然受 read-before-write 保护。
Bash 仍然受 allowlist 保护。
FinalAnswer 发生在验证通过之后。
```

---

## 5. 这一步的学习意义

Lab 阶段回答：

```text
每个机制单独是否成立？
```

Core 01 回答：

```text
机制合在一起后，是否能完成一个真实代码任务？
```

这是从“模块理解”到“产品骨架”的第一步。

但它还不是完整 Claude Code Core。

还缺：

```text
真实模型接入
通用 Context Engine 集成
真实项目的文件工具边界
多任务 eval suite
Plan Mode 和 Compaction 的运行时触发
更完整的权限交互
```

---

## 6. 课程层面的学习契约

本 Core 对应 `claude-code-core-learning-path.md` 里的 Core Build Pass。

你在 Core 01 要学到的不是某个新工具，而是：

```text
多个已经验证过的 Lab 机制，如何组成一条最小可运行产品闭环。
```

### 6.1 Product Question

Core 01 解决的问题是：

```text
单个机制都成立之后，它们合在一起能不能完成一个真实代码任务？
```

如果没有 Core 01，我们只知道：

```text
Runtime Loop 单独能跑。
MessageStore 单独可靠。
Search / Read / Bash 单独能执行。
Edit 单独安全。
```

但还不知道：

```text
这些机制放到同一条任务链里是否仍然协同。
```

### 6.2 Integration Map

Core 01 的接入图：

```text
UserMessage
  -> CoreRuntime
  -> buildModelRequest
  -> ScriptedFixModel
  -> ToolCall
  -> CoreToolRuntime
  -> ToolResult
  -> MessageStore
  -> CoreState
  -> 下一轮 ModelRequest
```

学习时重点观察：

```text
ToolResult 是否全部进入 MessageStore。
Edit 是否仍然受 read-before-write 和 stale check 保护。
Bash 是否仍然受 allowlist 保护。
FinalAnswer 是否发生在 verificationState=passed 之后。
```

### 6.3 Gate Check

学完 Core 01 后，你应该能回答：

```text
1. Core 01 和 Lab 01-08 的关系是什么？
2. 为什么 Core 01 不是重复 Lab，而是集成验证？
3. Search -> Read -> Edit -> Bash 每一步如何改变 MessageStore 和 CoreState？
4. 如果 Edit 没有先 Read，应该由谁拒绝？
5. 为什么 FinalAnswer 不能只靠模型说“我修好了”？
```

能回答这些问题，才进入 Core 02。

---

## 7. 下一步

下一步应该进入：

```text
Core 02 Model Gateway
```

目标是把 `ScriptedFixModel` 替换成真实模型适配层，同时保持 Runtime / Tool / Policy / MessageStore 不变。
