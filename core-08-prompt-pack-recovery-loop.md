# Core 08 Prompt Pack / Recovery Loop：Prompt 引导，Runtime 强制

Core 08 验证：

```text
Prompt Pack 可以提高模型使用工具的稳定性，但安全和正确性必须由本地 Runtime 强制。
```

---

## 1. 本 Core 在课程层面要学什么

你要学会：

```text
Prompt 负责告诉模型应该怎么做。
Runtime 负责保证模型不能做不该做的事。
Recovery Loop 负责把失败 observation 回灌给下一轮模型。
```

Core 08 对应：

```text
course-03-clean-room-prompt-pack.md
course-02-action-selection-rubric.md
Core 04 Plan Mode Integration
Core 06 Trace / Eval Harness Expansion
Core 07 Real Model API E2E
```

它处理 Core 07 live 暴露出的真实模型问题：

```text
模型可能跳过 Read 直接 Edit。
模型可能用不被 allowlist 允许的 Bash 命令。
模型可能在工具失败后不知道如何恢复。
```

---

## 2. 本 Core 做什么

当前实现新增：

```text
1. CORE_PROMPT_PACK
2. buildPromptPackSystemPrompt
3. createPromptPackContextEngine
4. PromptPackRecoveryModel
5. PromptIgnoringUnsafeModel
6. core:08:verify
```

Prompt Pack 包含四类信息：

```text
Identity：模型是谁、以什么方式工作。
Tool Order：Search / Read / Edit / Bash 的阶段顺序。
Recovery：遇到 denied / error ToolResult 后如何恢复。
Boundaries：Prompt 不是权限系统，Runtime / Policy / MessageStore 才是强制边界。
```

---

## 3. Recovery Loop 证明了什么

Core 08 的 recovery demo 故意让模型先犯错：

```text
Edit before Read
  -> ToolRuntime 返回 file_not_read
  -> ToolResult 回灌
  -> 模型 Search
  -> Read
  -> Edit
  -> Bash 使用带 cd 的非 allowlisted command
  -> ToolRuntime 返回 permission_denied
  -> ToolResult 回灌
  -> 模型改用 node scripts/test.cjs
  -> verification passed
  -> final answer
```

这证明：

```text
Prompt Pack 可以提供恢复规则。
ToolResult 是恢复循环的关键 observation。
Policy denial 不是终点，而是下一轮模型要读懂的事实。
```

---

## 4. 它守住了什么边界

Core 08 明确区分：

```text
Prompt guidance：建议模型 Search before Read、Read before Edit、失败后恢复。
Policy enforcement：真正拒绝 Edit before Read、危险 Bash、路径逃逸。
MessageStore：记录发生过什么。
Eval Harness：判断恢复是否真的完成。
```

Prompt 不能：

```text
授权危险 Bash。
绕过 read-before-edit。
把失败 ToolResult 当成功。
替代验证状态。
```

这点是 Claude Code-like 产品的核心：

```text
Prompt 可以让模型更聪明。
Runtime 必须让系统更可靠。
```

---

## 5. 运行入口

```bash
npm run core:08
npm run core:08:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 6. 验证点

`core:08:verify` 覆盖 5 个 case：

```text
1. prompt pack: recovery demo fixes and verifies
2. prompt pack: system prompt contains guidance and boundaries
3. recovery loop: denied ToolResult re-enters next request
4. policy boundary: prompt cannot authorize unsafe Bash
5. context: prompt pack is delivered as system message
```

它们证明：

```text
Prompt Pack 会进入本轮 ModelRequest。
denied ToolResult 会进入下一轮 ModelRequest。
模型可以基于 file_not_read 和 permission_denied 恢复。
危险 Bash 即使在 Prompt Pack 存在时仍会被拒绝。
最终通过的是本地验证状态，不是模型自称完成。
```

---

## 7. 学习者应该观察什么

运行：

```bash
npm run core:08
```

重点看：

```text
modelRequests[0].messages[0].content
tool_result file_not_read
tool_result permission_denied
后续 Search / Read / Edit / Bash 如何恢复
coreState.verificationState
```

问题不在于“Prompt 有没有写得很漂亮”，而在于：

```text
Prompt 规则是否进入模型请求？
失败 observation 是否回灌？
Runtime 是否仍然强制边界？
Eval 是否能证明恢复后真的通过？
```

---

## 8. 过关自测问题

机制题：

```text
Prompt Pack 包含哪四类信息？
Recovery Loop 的输入是什么？
为什么 denied ToolResult 必须回灌给模型？
```

边界题：

```text
为什么 Prompt 不能替代 Policy？
为什么 Prompt 不能授权危险 Bash？
为什么 final answer 必须由 verificationState 支撑？
```

失败题：

```text
file_not_read 应该如何恢复？
permission_denied 应该如何恢复？
如果模型忽略 Prompt，哪个模块必须兜底？
```

一句话总结：

```text
Core 08 证明 Prompt 是模型行为引导层，Recovery Loop 是失败观察回灌层，安全边界仍由 Runtime 强制。
```
