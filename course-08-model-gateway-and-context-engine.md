# Course 08 Model Gateway And Context Engine：从 verify case 跟踪模型边界和可见世界

> 本课对应 Core 02 和 Core 03。
>
> 这不是总览课。总览已经在 `course-07-core-build-pass-overview.md` 完成。
>
> 本课目标：你要能从 `npm run core:02:verify` 和 `npm run core:03:verify` 进入源码，跟完整数据链路走一遍，并说清楚边界到底在哪里被执行。

---

## 0. 本课跟踪哪两条执行链

Core 02 和 Core 03 解决的是两个相邻但不同的问题。

```text
Core 02:
  模型输出了什么？
  这个输出能不能进入工具执行层？

Core 03:
  模型这一轮看见什么？
  哪些事实进入 ModelRequest，哪些事实只留在 MessageStore 或 artifact？
```

所以本课只抓两条主线：

```text
主线 A：ModelGateway 边界
  verify case
    -> Mock / adapter event
    -> collectModelOutput
    -> validateToolCall
    -> Runtime 是否能把 ToolCall 交给 ToolRuntime

主线 B：Context Engine 边界
  verify case
    -> MessageStore 完整事实流
    -> CoreContextEngine.build
    -> buildContext blocks / artifacts
    -> selectedMessages
    -> ModelGateway 收到的 ModelRequest
```

一句话：

```text
ModelGateway 控制“模型说的动作是否有效”。
Context Engine 控制“模型本轮能看见哪些事实”。
ToolRuntime / Policy / MessageStore / CoreState 仍然留在本地 Runtime。
```

---

## 1. 先运行什么

本课不要先读长文档。先跑 verify。

```bash
npm run core:02:verify
npm run core:03:verify
```

然后打开这些文件：

```text
src/core/model-gateway.verify.mjs
src/core/model-gateway.mjs
src/core/context-engine.verify.mjs
src/core/context-engine.mjs
src/core/core-runtime.mjs
src/lab05/context-engine.mjs
```

读法：

```text
先读 verify case 名字。
再看 case 调了哪个函数。
再看函数里创建了什么 request / message / state。
最后看断言钉住了哪条边界。
```

---

## 2. Execution Chain A1：完整 happy path 如何证明模型层可替换

对应 case：

```text
src/core/model-gateway.verify.mjs
gateway runtime: model gateway fixes and verifies bug
```

入口：

```text
runModelGatewayDemo()
  -> createCoreToyWorkspace()
  -> new ModelGateway({ adapter: createScriptedCoreResponsesAdapter() })
  -> new CoreRuntime({ workspaceRoot, model: gateway })
  -> runtime.run("修复分页多返回一个元素的问题，并运行测试。")
```

这里替换掉的是：

```text
ScriptedFixModel.next(request)
```

换成：

```text
ModelGateway.next(request)
```

没有替换的是：

```text
CoreRuntime
MessageStore
CoreToolRuntime
CORE_TOOL_SCHEMAS
Edit read-before-write / stale check
Bash allowlist
CoreState.verificationState
```

### 2.1 Runtime 每轮构造什么 request

在 `src/core/core-runtime.mjs` 里，每一轮会进入：

```text
CoreRuntime.run
  -> #buildModelRequest(turn)
  -> contextEngine.build(...)
  -> return {
       sessionId,
       workspaceRoot,
       turn,
       context,
       messages: context.messages,
       tools: CORE_TOOL_SCHEMAS
     }
```

这个 request 说明一件事：

```text
模型拿到的是 Runtime 构造好的 ModelRequest。
模型没有直接拿到文件系统、shell、MessageStore 写权限或 CoreState 写权限。
```

### 2.2 Adapter 返回什么

`createScriptedCoreResponsesAdapter()` 不是直接执行工具，它只返回模型事件：

```text
turn 1 -> tool_call Search { query: "pageSize + 1" }
turn 2 -> tool_call Read { path: search.content.matches[0].path }
turn 3 -> tool_call Edit { old_string, new_string }
turn 4 -> tool_call Bash { command: "node scripts/test.cjs" }
turn 5 -> output_text_delta final answer
```

这些事件要经过：

```text
ModelGateway.next
  -> adapter.createResponse(request)
  -> collectModelOutput(events, request.tools)
```

### 2.3 Runtime 如何执行 ToolCall

如果 `collectModelOutput` 返回：

```text
{ type: "tool_call", toolCall }
```

Runtime 才会继续：

```text
store.appendAssistantToolCall(sessionId, output.toolCall)
plan authorization
tools.execute(output.toolCall)
store.appendToolResult(sessionId, result)
#applyCoreState(result)
```

状态变化发生在本地：

```text
Edit success
  -> coreState.modifiedFiles.push(path)

Bash success / error
  -> coreState.verificationState = {
       status,
       command,
       exitCode,
       stdout,
       stderr
     }
```

happy path 的断言钉住：

```text
tool call ids 来自 gateway mock events。
工具结果仍然由 CoreToolRuntime 产生。
最终文件真的被改了。
verificationState.status === "passed"。
```

这证明：

```text
模型层可以替换成 ModelGateway，但工具执行权没有交给模型。
```

---

## 3. Execution Chain A2：未知工具为什么进不了 ToolRuntime

对应 case：

```text
src/core/model-gateway.verify.mjs
validator: unknown model tool is rejected before execution
```

verify 直接调用：

```text
validateToolCall(
  {
    id: "tool_call_unknown",
    name: "DeleteEverything",
    input: {}
  },
  CORE_TOOL_SCHEMAS
)
```

`CORE_TOOL_SCHEMAS` 只有：

```text
Search
Read
Edit
Bash
```

所以 `validateToolCall` 里的关键检查是：

```text
const schema = toolSchemas.find((item) => item.name === call.name);

if (!schema) {
  throw new ModelGatewayError(
    "unknown_tool",
    `Model requested unknown tool: ${call.name}.`
  );
}
```

注意这里的层次：

```text
Mock adapter 可以“声称”模型想调用 DeleteEverything。
ModelGateway 可以接收到这个声称。
但 validateToolCall 在 ToolRuntime 前抛出 unknown_tool。
CoreToolRuntime.execute 没有机会被调用。
```

这个 case 钉住的边界是：

```text
模型不能凭空扩展工具能力。
可用工具只来自 Runtime 本轮给出的 tools schema。
```

如果把这个检查放错层，会发生什么？

```text
放到 ToolRuntime 里：
  仍然可能拒绝未知工具，但模型输出已经越过了模型边界。
  trace 归因会变成 tool 层问题，而不是 model output validation 问题。

只放到 prompt 里：
  模型可能遵守，也可能不遵守。
  一旦不遵守，未知工具就可能进入后续链路。
```

---

## 4. Execution Chain A3：缺 required input 为什么也进不了工具层

对应 case：

```text
src/core/model-gateway.verify.mjs
validator: missing required tool input is rejected
```

verify 输入：

```text
validateToolCall(
  {
    id: "tool_call_read_missing_path",
    name: "Read",
    input: {}
  },
  CORE_TOOL_SCHEMAS
)
```

`Read` 的 schema 写在 `src/core/core-runtime.mjs`：

```text
{
  name: "Read",
  input_schema: {
    required: ["path"]
  }
}
```

`validateToolCall` 会检查：

```text
for (const field of schema.input_schema?.required ?? []) {
  if (!(field in call.input)) {
    throw new ModelGatewayError(
      "invalid_tool_input",
      `Tool ${call.name} requires input.${field}.`
    );
  }
}
```

这个 case 钉住的边界是：

```text
模型不能只给一个看起来像工具调用的壳。
工具调用必须满足 Runtime 声明的最小输入契约。
```

这里的教学重点不是“Read 需要 path”这么简单，而是：

```text
Tool Schema 是模型可见的行动接口。
Validator 是接口契约的强制执行点。
ToolRuntime 是契约通过后的执行点。
```

---

## 5. Execution Chain A4：provider failure 为什么不能伪装成 ToolResult

对应 case：

```text
src/core/model-gateway.verify.mjs
adapter: provider failure is normalized as model_failed
```

verify 构造：

```text
new ModelGateway({
  adapter: new MockResponsesAdapter({
    steps: [
      {
        type: "failed",
        error: {
          code: "rate_limit",
          message: "provider rate limited request"
        }
      }
    ]
  })
})
```

执行：

```text
gateway.next({
  sessionId,
  turn,
  messages: [],
  tools: CORE_TOOL_SCHEMAS
})
```

事件进入：

```text
collectModelOutput(events, toolSchemas)
```

遇到：

```text
event.type === "failed"
```

就抛出：

```text
new ModelGatewayError(
  "model_failed",
  event.error?.message ?? "Model response failed.",
  { providerCode: event.error?.code }
)
```

这个 case 钉住的边界是：

```text
模型服务失败属于 model boundary failure。
它不是 Search / Read / Edit / Bash 的 ToolResult。
它不能被写成“工具观察事实”回灌给下一轮模型。
```

如果 provider failure 被伪装成 ToolResult，会污染事实流：

```text
MessageStore 里会出现一个并不存在的工具执行结果。
下一轮模型会把 provider 错误当作 workspace observation。
Eval 归因会把模型服务故障误判成工具失败或任务失败。
```

---

## 6. Execution Chain A5：adapter mapping 证明 provider 差异被关在哪里

对应 case：

```text
src/core/model-gateway.verify.mjs
openai-compatible adapter: response json maps to tool call event
chat-completions adapter: tool call json maps to tool call event
```

Responses adapter 做两次转换。

请求方向：

```text
ModelRequest
  -> toResponsesPayload(request)
  -> POST /responses payload
```

返回方向：

```text
provider response json
  -> fromResponsesJson(json)
  -> { type: "tool_call", call: { id, name, input } }
  -> collectModelOutput
  -> validateToolCall
```

Chat Completions adapter 也是同样边界：

```text
ModelRequest
  -> toChatCompletionsPayload(request)
  -> provider response json
  -> fromChatCompletionsJson(json)
  -> local tool_call event
```

这个 case 钉住的边界是：

```text
provider 协议差异只能存在于 Adapter。
CoreRuntime 只面对本地统一事件：tool_call / output_text_delta / failed / usage。
```

---

## 7. Execution Chain B1：Context Engine 接入后，工具链为什么还能跑通

对应 case：

```text
src/core/context-engine.verify.mjs
gateway runtime: context engine integrated without breaking tool chain
```

入口仍然是：

```text
runModelGatewayDemo()
```

但 Core 03 关注点变了。它检查：

```text
result.coreState.verificationState.status === "passed"
result.contextSnapshots.every((snapshot) => snapshot.blocks.length > 0)
```

这说明每一轮模型调用前，Runtime 都经过：

```text
#buildModelRequest(turn)
  -> contextEngine.build({
       sessionId,
       workspaceRoot,
       turn,
       storeState,
       coreState,
       messages
     })
  -> contextSnapshots.push({
       turn,
       blocks,
       artifacts,
       tokenEstimate,
       selectedMessageIds
     })
  -> model.next({
       context,
       messages: context.messages,
       tools: CORE_TOOL_SCHEMAS
     })
```

这个 case 钉住的边界是：

```text
Context Engine 可以改变模型可见世界。
但不能破坏 Search -> Read -> Edit -> Bash 的工具闭环。
```

Core 03 曾经暴露过一个重要问题：

```text
Search ToolResult 如果被当成长输出完全 artifact 化，
下一轮模型就看不到 path，
于是无法决定 Read 哪个文件。
```

现在 `toolResultText(message)` 对 Search 做了紧凑摘要：

```text
query=...
matches=path:lineNumber
```

这说明 Context Engine 不只是“压缩历史”。

它必须保留下一步行动所需的 observation。

---

## 8. Execution Chain B2：MessageStore 和 ModelRequest 的差别

先看完整事实流从哪里来：

```text
MessageStore
  appendUserMessage
  appendAssistantToolCall
  appendToolResult
  appendAssistantMessage
```

Runtime 构造模型输入时调用：

```text
store.buildModelMessageStream(sessionId)
```

这得到的是一条较完整的消息流。

但 Core 03 不把这条流原样倒给模型，而是进入：

```text
CoreContextEngine.build(...)
  -> toContextInput(...)
  -> buildContext(input, { budget })
  -> selectMessagesForContext(messages, context)
  -> return {
       blocks,
       artifacts,
       tokenEstimate,
       selectedMessages,
       messages: [
         system message,
         runtime message,
         ...selectedMessages
       ]
     }
```

所以两者职责不同：

```text
MessageStore:
  保存完整事实流，用于 trace、恢复、归因。

ModelRequest.messages:
  本轮给模型看的消息视图，用于下一步决策。
```

这个区别非常关键。

如果把 Context Engine 当成新的记忆系统，就会误删事实。

如果把 MessageStore 全量当成 ModelRequest，就会让长日志、旧结果和低价值历史挤掉关键状态。

---

## 9. Execution Chain B3：hard state 如何在预算压力下保留

对应 case：

```text
src/core/context-engine.verify.mjs
context selection: hard state survives budget pressure
context budget: latest failure survives tiny budget
```

verify 调用：

```text
runContextEngineDemo()
  -> new MessageStore()
  -> append user
  -> append Read tool call / result
  -> append Bash tool call / failed result with long stderr
  -> new CoreContextEngine({ budget: 130, activePlan })
  -> engine.build(...)
```

`CoreContextEngine.build` 会先构造 `toContextInput`：

```text
latestUserMessage
activePlan
modifiedFiles
verificationState
latestFailure
readFiles
toolResults
```

然后进入 Lab 05 的：

```text
buildContext(input, { budget })
```

`src/lab05/context-engine.mjs` 里 hard blocks 是：

```text
system
mode
latest_user
active_plan
modified_files
verification_state
latest_failure
```

预算裁剪发生在：

```text
fitBudget(blocks, budget)
```

裁剪顺序是：

```text
先删 low
再删 medium
不删 hard
```

所以 verify 断言：

```text
blockNames includes latest_user
blockNames includes active_plan
blockNames includes verification_state
blockNames includes latest_failure
```

这个 case 钉住的边界是：

```text
上下文预算再小，也不能裁掉恢复任务所需的硬状态。
```

为什么这些是 hard state？

```text
latest_user:
  决定当前任务目标和最新约束。

active_plan:
  决定当前批准后的执行路线。

verification_state:
  决定能不能 final answer，以及上次验证状态。

latest_failure:
  指导下一步恢复，避免模型重复无效动作。
```

---

## 10. Execution Chain B4：长输出如何变成 artifact，而不是挤进 selectedMessages

对应 case：

```text
src/core/context-engine.verify.mjs
message boundary: artifacted long output is not selected raw context
```

demo 里构造了一个失败 Bash 结果：

```text
stderr: "FAIL ".repeat(80)
```

`toContextInput` 会把 Bash ToolResult 转成文本：

```text
JSON.stringify({
  command,
  exitCode,
  stdout,
  stderr
})
```

进入 `buildContext` 后，如果：

```text
result.output.length > LONG_TOOL_OUTPUT_LIMIT
```

就创建：

```text
artifacts.push({
  id: "artifact_1",
  source: result.id,
  text: result.output
})
```

同时 blocks 里只放引用摘要：

```text
tool:tool_result_bash_001
failed output stored in artifact_1: FAIL FAIL FAIL ...
```

接着 `selectMessagesForContext(messages, context)` 会看：

```text
artifactSources = new Set(context.artifacts.map((artifact) => artifact.source))
```

如果某个 tool result 已经 artifact 化：

```text
if (!artifactSources.has(resultId)) {
  selectedToolResultIds.add(resultId)
}
```

也就是：

```text
长 Bash ToolResult 不会以原始消息形式进入 selectedMessages。
```

verify 断言：

```text
result.artifacts.length === 1
selectedMessages 不包含连续长 FAIL 日志
```

这个 case 钉住的边界是：

```text
长输出要保留证据，但不能原样挤占本轮模型上下文。
```

注意：artifact 不是丢弃。

```text
MessageStore 仍然保留 ToolResult。
artifact 保留完整长输出文本。
runtime message 给模型 artifact reference。
selectedMessages 避免携带原始长日志。
```

---

## 11. Execution Chain B5：ModelGateway 如何收到 context blocks

对应 case：

```text
src/core/context-engine.verify.mjs
model gateway: adapter receives context object with blocks
```

verify 创建一个 Mock adapter step：

```text
(request) => {
  sawContext =
    Array.isArray(request.context?.blocks) &&
    request.context.blocks.some((block) => block.name === "latest_user");

  return output_text_delta;
}
```

然后：

```text
const model = new ModelGateway({ adapter })
const runtime = new CoreRuntime({ workspaceRoot, model, maxTurns: 1 })
await runtime.run("只检查 context 是否传入模型网关。")
```

链路是：

```text
CoreRuntime.#buildModelRequest
  -> contextEngine.build
  -> model.next(request)
  -> ModelGateway.#normalizeRequest(runtimeRequest)
  -> adapter.createResponse(request)
```

`ModelGateway.#normalizeRequest` 保留：

```text
context: runtimeRequest.context ?? null
messages: runtimeRequest.messages ?? []
tools: runtimeRequest.tools ?? []
```

这个 case 钉住的边界是：

```text
Context Engine 的输出真的进入 ModelGateway。
Adapter 可以看到 context blocks。
模型请求不再只是 raw messages + tools。
```

但这不意味着 Adapter 可以改 context。

```text
Context Engine 在 Runtime 内部先构造 context。
ModelGateway 只是把这个 context 传给 provider adapter。
```

---

## 12. Knowledge Provenance

这张表回答：模型这一轮用到的信息从哪里来，怎么进入请求，目的是什么。

| 模型用到的信息 | 来源 | 怎么给模型 | 目标 | 如果不给会怎样 |
| --- | --- | --- | --- | --- |
| 可用工具列表 | `CORE_TOOL_SCHEMAS` | `ModelRequest.tools` | 让模型只能选择 Runtime 注册过的工具 | 模型可能输出无法执行或危险的动作 |
| tool call 必填字段 | Tool Schema | `validateToolCall` 强制检查 | 阻止缺字段调用进入 ToolRuntime | Read/Edit/Bash 会收到不完整 input |
| provider 输出事件 | Adapter | `createResponse` event stream | 隔离 Responses / Chat Completions 协议差异 | CoreRuntime 会被 provider 协议污染 |
| 最新用户目标 | MessageStore | `latest_user` hard block + selected user message | 保持当前任务目标 | 模型可能偏离最新约束 |
| 当前模式 | MessageStore / Runtime State | `mode` hard block | 让模型知道 normal / plan / execute | 模型可能选择当前模式不允许的动作 |
| active plan | CoreState / PlanController | `active_plan` hard block | 让模型沿批准路线行动 | 模型可能绕开计划或重复规划 |
| modified files | CoreState | `modified_files` hard block | 让模型知道哪些文件已被改动 | 模型可能忘记已修改文件 |
| verification state | CoreState | `verification_state` hard block | 决定能否结束和如何恢复 | 模型可能未验证就 final answer |
| latest failure | ToolResult + MessageStore | `latest_failure` hard block | 指导下一步恢复 | 模型可能重复失败动作 |
| Read 文件内容 | ToolResult | `file:path` block + selected Read result | 让模型基于事实编辑 | 模型可能凭空生成 old_string |
| Search matches | ToolResult | 紧凑 `tool:id` block | 给下一轮 Read 提供 path / lineNumber | 模型可能不知道该读哪个文件 |
| 长 Bash 输出 | ToolResult | artifact + block reference | 保留证据但控制上下文预算 | 长日志会挤掉目标、失败、验证状态 |

---

## 13. Action Claim Contract

### 13.1 未知工具应该被拒绝

```text
Action:
  当前动作:
    模型输出 DeleteEverything tool_call。
  当前状态:
    Runtime 本轮 tools 只有 Search / Read / Edit / Bash。
  合理性判断:
    不合法，必须拒绝。
  来源:
    CORE_TOOL_SCHEMAS + validateToolCall。
  硬约束:
    未注册工具不能进入 ToolRuntime。
  软策略:
    prompt 可以提醒模型只用可用工具，但不能代替 validator。
  替代动作:
    输出 Search / Read / Edit / Bash 中的合法工具，或 final_answer。
  如果做错会怎样:
    模型凭空扩展能力，ToolRuntime 边界被污染。
```

### 13.2 长 Bash 输出应该 artifact 化

```text
Action:
  当前动作:
    Context Engine 处理失败 Bash 的长 stderr。
  当前状态:
    verificationState failed，stderr 很长，预算有限。
  合理性判断:
    完整输出保留为 artifact，selectedMessages 不携带原始长日志。
  来源:
    buildContext 的 LONG_TOOL_OUTPUT_LIMIT 和 artifacts。
  硬约束:
    hard blocks 不能被长日志挤掉。
  软策略:
    block 摘要给模型足够恢复线索。
  替代动作:
    只保留摘要但不保留 artifact，会丢证据；全量塞回 messages，会挤占上下文。
  如果做错会怎样:
    latest_failure / verification_state / 用户约束可能被挤掉，恢复链断片。
```

---

## 14. 学习者应该亲手改哪里

这些实验用来确认你真的理解边界。

### 14.1 改未知工具 case

文件：

```text
src/core/model-gateway.verify.mjs
```

把：

```text
name: "DeleteEverything"
```

改成：

```text
name: "Read"
```

但保持：

```text
input: {}
```

再运行：

```bash
npm run core:02:verify
```

你应该观察到：

```text
错误从 unknown_tool 变成 invalid_tool_input。
```

这说明：

```text
validator 先检查工具是否注册，再检查该工具的 required input。
```

### 14.2 改 Read required input

文件：

```text
src/core/core-runtime.mjs
```

临时把 Read schema 的：

```text
required: ["path"]
```

改成：

```text
required: []
```

再运行：

```bash
npm run core:02:verify
```

你应该观察到：

```text
missing required tool input case 不再按预期失败。
```

这说明：

```text
Tool Schema 不是文档装饰，它直接决定 ModelGateway 的强制校验。
```

实验后要改回。

### 14.3 改长输出阈值

文件：

```text
src/lab05/context-engine.mjs
```

临时把：

```text
const LONG_TOOL_OUTPUT_LIMIT = 120;
```

改得很大，例如：

```text
const LONG_TOOL_OUTPUT_LIMIT = 10000;
```

再运行：

```bash
npm run core:03:verify
```

你应该观察到：

```text
message boundary: artifacted long output is not selected raw context
```

相关断言失败。

这说明：

```text
artifact 化不是可有可无的优化，而是 Context Engine 的边界行为。
```

实验后要改回。

### 14.4 删除 latest_failure hard block

文件：

```text
src/lab05/context-engine.mjs
```

临时注释：

```text
add(blocks, "latest_failure", "hard", input.latestFailure);
```

再运行：

```bash
npm run core:03:verify
```

你应该观察到：

```text
context budget: latest failure survives tiny budget
```

相关断言失败。

这说明：

```text
latest_failure 是恢复链硬状态，不是普通历史消息。
```

实验后要改回。

---

## 15. 本课最终要能回答的问题

学完本课后，你应该能回答：

```text
1. Runtime 每一轮在哪里构造 ModelRequest？
2. ModelGateway.next 做了哪几步？
3. adapter event 和本地 ToolCall 的区别是什么？
4. unknown_tool 在哪一层被拒绝，为什么不能只靠 ToolRuntime？
5. missing required input 如何从 Tool Schema 推导出来？
6. provider failure 为什么是 model_failed，而不是 ToolResult？
7. MessageStore 和 ModelRequest.messages 的最大区别是什么？
8. Context Engine 的 blocks / artifacts / selectedMessages 分别是什么？
9. latest_failure 和 verification_state 为什么是 hard keep？
10. 长 Bash 输出如何同时做到保留证据和不挤占上下文？
11. SearchResult 为什么不能被粗暴 artifact 化到模型看不见 path？
12. 如果一个 bug 出现在“模型没看到必要信息”，应该归因到哪个层？
```

过关标准不是背结论，而是能拿着 verify case 指给别人看：

```text
这个输入在哪里构造。
这个对象在哪里变化。
这个边界在哪里执行。
这个断言证明了什么。
```
