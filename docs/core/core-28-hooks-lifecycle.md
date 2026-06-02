# Core 28 Hooks Lifecycle：把外部反馈纳入可审计的 Runtime 生命周期

> 本 Core 接在 `core-27-settings-permission-resolver.md` 后面。
>
> Core 24 / Core 26 / Core 27 已经证明：
>
> ```text
> Core 24 可以把 session event 写入 append-only log，并支持 replay / secret scan。
> Core 26 可以把 approval_required、approve、reject、interrupt 和 handoff 写入 Runtime 状态。
> Core 27 可以在工具执行前解析 allow / ask / deny。
> ```
>
> Core 28 验证：
>
> ```text
> hooks 可以作为 Runtime lifecycle event 进入 session：用户输入后补约束、工具前阻断、工具后反馈、失败结构化、输出脱敏，并且不能升级为 system prompt 或绕过权限。
> ```

---

## 0. 实现级 Validation Matrix

Core 28 是 Product Surface Study 的第二个独立 Core。它先经过 `product-surface-validation-matrix.md` 的 same-topic merge gate：

```text
它补充 Core 24 / Core 26，但不重复 Core 24 / Core 26。
```

边界：

```text
Core 28: hook registry -> lifecycle event -> constrained session event / observation / block decision。
Core 24: append-only durable session store / replay。
Core 26: human approve / reject / interrupt / handoff。
```

新增 Runtime state：

```text
hookRegistry
hookEvent
hookDecision
hookFeedback
redactedHookOutput
```

| Case | Fixture | 预期结果 | 证据 |
| --- | --- | --- | --- |
| pre tool hook | preToolUse hook 返回 block | tool 不执行，block feedback 进入 session event | event log |
| post tool hook | postToolUse hook 返回 message | message 进入 dynamic observation，不进入 system | context snapshot |
| user prompt hook | userPromptSubmit hook 补约束 | 约束进入 Runtime State，不伪装成 system | state update |
| hook failure | hook 抛错且 permission deny action | 结构化失败，不绕过原权限 | hook report |
| secret boundary | hook output 含 token 样式文本 | 写入前脱敏，secret scan 通过 | redaction report |
| no hidden execution | blocked / denied action | action 不会出现 tool.executed | trace assertion |
| boundary | boundary object | 不声称 shell hook product、script sandbox、plugin system 或官方实现 | boundary assertions |

公开边界：

```text
本 Core 只学习 hooks 作为 Runtime lifecycle event 的机制。
不复制系统提示词原文、source map 原文或反编译源码片段。
不声称复刻 Claude Code 官方 hooks 内部实现。
```

---

## 1. 本 Core 解决什么问题

Core 24 已经能保存和 replay session event，Core 26 已经能处理人工审批事件。但 hooks 还多出一类问题：

```text
外部反馈是否能在工具执行前阻断？
工具执行后的反馈是否能进入下一轮上下文？
用户输入后的补充约束是否能成为 Runtime State？
hook 失败会不会绕过原有权限？
hook 输出里的 secret 是否会落盘？
hook 反馈是否会被误当成 system prompt？
```

Core 28 把这些问题做成 deterministic local hooks lifecycle evidence。

---

## 2. 当前实现位置

代码：

```text
src/core/hooks-lifecycle.mjs
src/core/hooks-lifecycle.verify.mjs
```

运行：

```bash
npm run core:28
npm run core:28:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. 核心机制

### 3.1 Hook Registry

`HooksLifecycleRuntime` 使用本地 hook registry：

```text
userPromptSubmit
preToolUse
postToolUse
```

registry 只是一组本项目自己的函数 fixture，用于证明 lifecycle shape，不是任意用户脚本执行系统。

### 3.2 User Prompt Hook

`handleUserPrompt()` 会调用 `userPromptSubmit` hook。

当 hook 发现 public API 约束时，会写入：

```text
constraint.added
contextSnapshot.constraints
```

它不会写入：

```text
systemMessages
```

这证明用户输入 hook 的反馈是 Runtime State，不是伪 system prompt。

### 3.3 Pre Tool Hook

`requestAction()` 会先经过 Core 27 permission resolver，再调用 `preToolUse` hooks。

如果 pre hook 返回：

```text
decision=block
```

Runtime 会写入：

```text
hook.pre_tool.blocked
tool.blocked_by_hook
```

并保证：

```text
toolExecutions delta = 0
```

### 3.4 Post Tool Hook

允许执行的工具完成后，`postToolUse` hook 可以返回 message。

message 会进入：

```text
dynamicObservations
```

并明确：

```text
promotedToSystem=false
hookFeedbackPromotedToSystem=false
```

### 3.5 Hook Failure

hook 抛错时会被转成结构化失败：

```text
decision=failure
error_type=hook_failed
recoverable=true
```

verify 用 `rm -rf .` 构造 permission deny，同时让 pre hook 抛错，证明：

```text
hook failure 不会把 denied action 升级为可执行。
```

### 3.6 Secret Boundary

hook 输出写入 session event 前会经过 redaction：

```text
Bearer ...
sk-...
token=...
```

都会被替换成：

```text
[REDACTED]
```

然后再用 Core 24 的 `scanForSecrets()` 做存储扫描。

---

## 4. 验证点

`npm run core:28:verify` 覆盖 9 个 case：

```text
1. core28: hooks lifecycle demo runs and verifies
2. validation matrix: Core 28 does not duplicate Core 24 or Core 26
3. pre tool hook: block prevents tool execution and enters event log
4. post tool hook: feedback enters next context as observation
5. user prompt hook: constraint enters runtime state, not system prompt
6. hook failure: structured failure does not bypass permission denial
7. secret boundary: hook output is redacted before storage
8. no hidden execution: blocked and denied actions never execute
9. boundary: hooks lifecycle is local evidence, not shell hook product
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| demo | matrix、pre/post/user hooks、failure、redaction 和 no hidden execution 可以一起运行 |
| validation matrix | Core 28 不重复 Core 24 durable store 或 Core 26 human approval |
| pre tool hook | pre hook 可以阻断工具执行并留下 event log |
| post tool hook | post hook feedback 进入 observation，不进入 system |
| user prompt hook | hook 补充约束进入 Runtime State |
| hook failure | hook 错误结构化，不能绕过 permission deny |
| secret boundary | hook 输出脱敏后才落盘 |
| no hidden execution | blocked / denied action 不会执行 |
| boundary | 本 Core 是本地确定性证据，不是 shell hook 产品或插件系统 |

---

## 5. 做完本 Core 后得到什么

做完 Core 28 后，Product Surface Study 得到第二个可验证 Core：

```text
Hooks Lifecycle 可以作为 Session / ToolRuntime / Human Feedback 之间的 lifecycle layer。
```

现在链路可以表达为：

```text
user prompt
  -> userPromptSubmit hook
  -> Runtime constraints

tool action
  -> Permission Resolver
  -> preToolUse hook
  -> tool execution or hook block
  -> postToolUse hook
  -> dynamic observation
```

---

## 6. 边界

Core 28 证明的是：

```text
本地 deterministic hooks lifecycle 可以记录 hook events、hook decisions、hook feedback、redacted output，并防止 hook 反馈升级为 system prompt 或绕过权限。
```

它不证明：

```text
真实 shell hook 产品。
任意用户脚本安全沙箱。
完整插件系统。
真实 Claude Code hooks 内部实现。
生产级 Claude Code 70%-80% 能力。
```

---

## 7. 下一步

Core 28 之后，Core 29 Memory Source / CLAUDE.md / Auto Memory 已完成。Product Surface 候选池继续按实现前 validation matrix 推进。

推荐下一步：

```text
评估 Checkpoint / Rewind 是否进入 Core 30。
```
