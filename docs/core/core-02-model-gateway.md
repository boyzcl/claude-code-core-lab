# Core 02 Model Gateway：把模型接入变成可替换边界

> 本 Core 接在 `course-06-labs-to-core-map.md` 和 `core-01-integrated-runtime.md` 后面。
>
> Core 01 已经证明：
>
> ```text
> Search -> Read -> Edit -> Bash -> FinalAnswer
> ```
>
> 可以组成最小 Claude Code-like Runtime。
>
> Core 02 验证：
>
> ```text
> 模型层可以被替换成 Model Gateway，同时 Runtime / Tool / Policy / MessageStore 边界不变。
> ```

---

## 1. 本 Core 解决什么问题

Core 01 里的模型还是：

```text
ScriptedFixModel
```

它直接根据 MessageStore 中的结果写死下一步动作。

这对学习很有用，但它不是未来真实模型接入的边界。

Core 02 把模型层改成：

```text
CoreRuntime
  -> ModelGateway
    -> ModelAdapter
      -> MockResponsesAdapter / OpenAICompatibleResponsesAdapter
```

模型网关只负责：

```text
1. 标准化 ModelRequest
2. 调用 Provider Adapter
3. 收集模型事件
4. 解析 tool_call 或 final_answer
5. 校验 tool name 和 required input
6. 归一化模型错误
```

它不负责：

```text
读文件
写文件
执行 bash
决定权限
篡改 MessageStore
跳过验证状态
```

---

## 2. 为什么不能让模型直接接管工具

真实模型接入时，最容易犯的错是：

```text
模型 API 能 tool calling，于是把工具执行也交给模型服务。
```

但 Claude Code-like Runtime 的关键边界恰恰是：

```text
模型只提出意图。
Runtime 执行工具。
Policy 决定是否允许。
MessageStore 记录事实。
ToolResult 回灌给下一轮模型。
```

所以 Core 02 只替换模型决策层：

```text
ScriptedFixModel.next(request)
```

替换成：

```text
ModelGateway.next(request)
```

其他边界不动。

---

## 3. 当前实现位置

代码：

```text
src/core/model-gateway.mjs
src/core/model-gateway.verify.mjs
```

运行：

```bash
npm run core:02
npm run core:02:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 4. 当前实现了什么

Core 02 包含三个层次。

### 4.1 ModelGateway

负责把 Runtime Request 变成模型请求，并把模型事件变成 Core Runtime 能理解的输出：

```text
tool_call event -> { type: "tool_call", toolCall }
text deltas     -> { type: "final_answer", content }
failed event    -> ModelGatewayError
```

同时它会校验：

```text
tool call 必须有 id
tool name 必须注册在本轮 tools 中
input 必须是 object
required input 字段必须存在
当前 Core 02 每轮只支持一个 tool call
```

这证明：

```text
模型输出不能原样进入工具执行层。
它必须先经过模型网关解析和校验。
```

### 4.2 MockResponsesAdapter

用于协议测试，不依赖真实 API。

它模拟 Responses-like 事件：

```text
tool_call
output_text_delta
usage
completed
failed
```

Core 02 的主 demo 使用它跑通：

```text
Search -> Read -> Edit -> Bash -> FinalAnswer
```

这证明：

```text
即使模型层变成事件流，Core 01 的工具闭环仍然成立。
```

### 4.3 OpenAICompatibleResponsesAdapter

这是一个最小 OpenAI-compatible Responses 适配器边界。

它负责：

```text
POST /responses
把 Runtime messages 转成 provider input
把 function_call output 转回 tool_call event
把 message output 转回 text delta
把 provider error 转成 failed event
```

当前验证使用 mock fetch，不触发真实网络请求。

这一步的重点不是立刻调用真实模型，而是先固定：

```text
Runtime 不依赖某个具体模型名。
Provider 差异被关在 Adapter 里面。
```

---

## 5. 验证点

`npm run core:02:verify` 覆盖 6 个 case：

```text
1. gateway runtime: model gateway fixes and verifies bug
2. parser: text-only model output becomes final answer
3. validator: unknown model tool is rejected before execution
4. validator: missing required tool input is rejected
5. adapter: provider failure is normalized as model_failed
6. openai-compatible adapter: response json maps to tool call event
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| gateway runtime | 换成 ModelGateway 后，Core 仍能完成修复和验证 |
| text-only output | 模型不发工具时可以形成 final answer |
| unknown tool | 未注册工具不会进入 ToolRuntime |
| missing input | 缺字段 tool call 不会执行 |
| provider failure | 模型服务失败被结构化为 ModelGatewayError |
| response json mapping | OpenAI-compatible function_call 能映射为本地 tool_call |

---

## 6. 本 Core 的学习意义

Core 01 证明：

```text
机制能组成最小产品闭环。
```

Core 02 证明：

```text
模型只是 Runtime 的一个可替换决策源。
```

也就是说：

```text
强模型很重要，但 Claude Code-like 产品的稳定性来自边界。
```

这些边界必须继续由本地 Runtime 掌握：

```text
Tool 执行权
Policy 决策权
MessageStore 事实记录
Edit 安全检查
Bash allowlist
VerificationState
Trace / Eval
```

---

## 7. 课程层面的学习契约

本 Core 对应 `claude-code-core-learning-path.md` 里的 Core Build Pass。

你在 Core 02 要学到的不是某个供应商 API，而是：

```text
模型层可以替换，但 Runtime 的权力边界不能移动。
```

### 7.1 Product Question

Core 02 解决的问题是：

```text
如何从写死的 ScriptedFixModel 走向真实模型接入，同时不让模型接管本地工具和权限？
```

如果没有 Core 02，系统会卡在：

```text
能跑通 Core 01，但模型决策源仍然是写死的 demo。
```

如果 Core 02 做错，最危险的情况是：

```text
模型 API 直接拥有本地读写和执行权。
```

这会破坏前面 Lab 已经建立的 ToolRuntime、Policy、MessageStore 和 VerificationState 边界。

### 7.2 Integration Map

Core 02 的接入图：

```text
CoreRuntime
  -> ModelGateway
    -> ModelAdapter
      -> MockResponsesAdapter / OpenAICompatibleResponsesAdapter
  -> parsed ToolCall / FinalAnswer
  -> CoreToolRuntime
  -> Policy / Tool Execution
  -> ToolResult
  -> MessageStore
```

学习时重点观察：

```text
assistant_tool_call 的 id 来自 ModelGateway。
模型输出先经过 collectModelOutput 和 validateToolCall。
未知 tool name 不会进入 CoreToolRuntime。
缺 required input 不会进入 CoreToolRuntime。
provider failure 被归一化为 ModelGatewayError。
本地文件、shell、权限和验证状态仍然由 CoreRuntime / CoreToolRuntime 掌握。
```

### 7.3 Gate Check

学完 Core 02 后，你应该能回答：

```text
1. ModelGateway 替换的是 Core 01 里的哪一块？
2. ModelGateway、ModelAdapter、Provider Adapter 有什么区别？
3. 为什么真实模型不能直接执行 Read / Edit / Bash？
4. 为什么模型输出的 tool_call 不能直接交给 ToolRuntime？
5. provider failure 和 tool failure 为什么要分层处理？
6. Core 02 为什么不是“真实模型接入完成”，而是“真实模型接入边界建立完成”？
```

能回答这些问题，才进入 Core 03。

---

## 8. 下一步

Core 02 之后，下一步应该进入：

```text
Core 03 Context Engine Integration
```

目标：

```text
把 Lab 05 的 Context Engine 从独立实验接入 CoreRuntime，
让 ModelGateway 收到的不是简化 messages，
而是经过优先级、裁剪和 artifact 策略处理过的 ModelRequest。
```
