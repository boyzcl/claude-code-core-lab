# Course 06 Labs To Core Map：从实验链到产品骨架

> 本课修正一个命名边界：
>
> ```text
> 复盘、理解、心智图、学习检查，都属于 course。
> 不再新增 Review-XX 这条学习主线。
> ```
>
> `lab-XX` 是实验。
>
> `core-XX` 是实现里程碑。
>
> `course-XX` 才是学习主线。

---

## 0. 本课解决什么问题

我们已经完成：

```text
course-00 到 course-05：建立产品心智模型。
lab-01 到 lab-08：逐个验证核心机制。
core-01：把多个 Lab 机制合成最小可运行产品骨架。
```

现在必须回答：

```text
这些 Lab 到底在 Core 里变成了什么？
一条真实任务的数据怎么流？
哪些东西已经是 Core 能力？
哪些还只是 toy / scripted / demo？
接真实模型之前，哪些边界不能被破坏？
```

这一步不是写新功能。

它是把“我跟着跑完了”变成“我真的理解了”。

---

## 1. Lab 到 Core 的映射

| Lab | 验证的机制 | 在 Core 里的位置 | 是否已进入 `core-01` |
| --- | --- | --- | --- |
| Lab 01 | Runtime Loop、ToolResult 回灌 | `CoreRuntime.run()` 的循环 | 是 |
| Lab 02 | MessageStore、append-only、ToolCall/ToolResult 关联 | `MessageStore` | 是 |
| Lab 03 | Search / Read / Bash、Policy、结构化 ToolResult | `CoreToolRuntime` 的 Search/Read/Bash | 是 |
| Lab 04 | Edit safety、read-before-write、stale check、唯一匹配 | `CoreToolRuntime` 的 Edit | 是 |
| Lab 05 | Context Engine 的选择、裁剪、artifact 思想 | `CoreRuntime.#buildModelRequest()` 的简化版 | 部分 |
| Lab 06 | Plan Mode、审批、plan mode 禁写 | 独立验证，`core-01` 未启用 | 否 |
| Lab 07 | Compaction、关键状态保留 | 独立验证，`core-01` 未触发 | 否 |
| Lab 08 | Eval Runner、score、failureType | `core:verify` 的思想来源 | 部分 |

这里最重要的是：

```text
不是每个 Lab 都已经完整进入 Core。
Core 01 只是第一个集成骨架。
```

---

## 2. Core 01 当前模块图

```text
User
  -> CoreRuntime
    -> buildModelRequest
    -> ScriptedFixModel
    -> ToolCall
    -> CoreToolRuntime
      -> Policy
      -> Search / Read / Edit / Bash
    -> ToolResult
    -> MessageStore
    -> CoreState
    -> FinalAnswer
```

对应关系：

```text
CoreRuntime
  负责主循环。

ScriptedFixModel
  负责模拟模型决策。
  这部分仍然是 toy，下一阶段会被 Model Gateway 替换。

CoreToolRuntime
  负责工具执行和工具级 Policy。

MessageStore
  负责事实记录。

CoreState
  负责 modifiedFiles、verificationState、finalAnswer 等运行时摘要。
```

---

## 3. 一条任务的数据流

任务：

```text
修复分页多返回一个元素的问题，并运行测试。
```

数据流：

```text
1. UserMessage append 到 MessageStore
2. CoreRuntime build ModelRequest
3. ScriptedFixModel 输出 Search ToolCall
4. CoreToolRuntime 执行 Search
5. Search ToolResult append 到 MessageStore
6. 下一轮 ModelRequest 能看到 SearchResult
7. ScriptedFixModel 输出 Read ToolCall
8. Read 建立文件 snapshot
9. Read ToolResult append 到 MessageStore
10. ScriptedFixModel 输出 Edit ToolCall
11. Edit 检查 read-before-write、stale、old_string 唯一
12. Edit 成功后 modifiedFiles 更新
13. ScriptedFixModel 输出 Bash ToolCall
14. Bash 运行 allowlisted 测试命令
15. verificationState 更新为 passed
16. ScriptedFixModel 输出 FinalAnswer
17. FinalAnswer append 到 MessageStore
```

这条链说明：

```text
Agent 的“智能表现”不是一次回答生成出来的。
它是由多轮 observation 和 state update 推进出来的。
```

---

## 4. 已经具备的 Core 能力

当前已经具备：

```text
1. 最小 Runtime Loop
2. MessageStore
3. ToolCall / ToolResult 关联
4. Search / Read / Edit / Bash
5. Path Policy
6. Bash allowlist
7. Edit read-before-write
8. Edit stale check
9. Edit old_string 唯一性检查
10. VerificationState
11. FinalAnswer after verification
12. Lab 和 Core 的自动验证命令
```

这些能力虽然很小，但已经是 Claude Code-like 产品骨架的一部分。

---

## 5. 仍然是 toy 的部分

当前仍然是 toy / scripted：

```text
1. ScriptedFixModel 不是真模型。
2. Context Engine 只在 Lab 05 完整验证，Core 里是简化版。
3. Plan Mode 没有接入 Core Runtime。
4. Compaction 没有在长任务中触发。
5. Tool Runtime 只支持临时 toy workspace。
6. Bash allowlist 是固定字符串。
7. Eval case 还是 starter 级别，不是 100 个任务集。
8. 没有真实用户权限确认交互。
9. 没有真实 OpenAI / GPT 5.5 / OpenAI-compatible Model Gateway。
```

这些不是失败。

它们是下一阶段的学习边界。

---

## 6. 接真实模型前必须守住的边界

下一阶段接真实模型时，不能让模型 API 侵入这些模块：

```text
Tool 执行权
Policy 决策权
MessageStore 事实记录
Edit 安全检查
Bash allowlist
VerificationState
Trace / Eval
```

真实模型只能替换：

```text
ScriptedFixModel.next(request)
```

也就是说：

```text
Model Gateway 只负责把 ModelRequest 发给模型，并把模型输出解析成 ToolCall 或 FinalAnswer。
```

它不应该负责：

```text
真实读文件
真实写文件
真实跑命令
决定权限是否允许
篡改 MessageStore
跳过验证状态
```

这是你现在最应该记住的边界。

---

## 7. 自测题

你应该能回答：

```text
1. Lab 01 在 Core 里对应哪段逻辑？
2. MessageStore 为什么不能被模型直接写？
3. Edit 为什么必须依赖 Read snapshot？
4. Bash 的非 0 exit code 为什么不是 Runtime 崩溃？
5. Context Engine 为什么不能把所有 ToolResult 全塞进去？
6. Plan Mode 为什么不能只靠 prompt？
7. Compaction 为什么必须保留 verificationState？
8. Eval Runner 为什么是产品能力，不只是测试脚本？
9. ScriptedFixModel 下一步应该被什么替换？
10. Model Gateway 接入后，哪些模块绝对不应该被模型绕过？
```

如果这些问题能回答，下一步才进入：

```text
Core 02 Model Gateway
```

---

## 8. 下一步

下一步不是再新增一套命名体系。

正确名称应该是：

```text
core-02-model-gateway.md
```

对应代码目标：

```text
src/core/model-gateway.mjs
```

学习目标：

```text
把 ScriptedFixModel 替换成真实模型适配层，同时保持 Runtime / Tool / Policy / MessageStore 边界不变。
```
