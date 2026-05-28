# Course 10 Trace Eval Real Model And Recovery：从 verify case 跟踪证据、真实模型和恢复

> 本课对应 Core 06、Core 07、Core 08。
>
> 本课目标：你要能从 `core:06:verify`、`core:07:verify`、`core:08:verify` 进入源码，说明系统如何证明能力、如何接真实模型、如何从可恢复错误继续推进。

---

## 0. 本课跟踪哪三条执行链

Core 06 到 Core 08 不是继续加工具，而是在回答三个更成熟的问题。

```text
Core 06 Trace / Eval:
  怎么证明 Agent 真的做对了？
  失败时归因到哪一层？

Core 07 Real Model API E2E:
  真实 provider 协议如何接入？
  本地 Runtime 边界是否仍然不变？

Core 08 Prompt Pack / Recovery:
  Prompt 如何引导模型从拒绝和失败中恢复？
  Prompt 为什么不能替代 Runtime 权限？
```

三条主线：

```text
主线 A：Eval evidence 链
  Runtime result
    -> buildCoreEvalEvidence
    -> evaluateCoreExpectations
    -> assertions / failureType / score

主线 B：Real model adapter 链
  ModelRequest
    -> Responses / Chat Completions payload
    -> provider json
    -> local model events
    -> CoreRuntime 工具闭环

主线 C：Prompt recovery 链
  system prompt guidance
    -> model 先犯错
    -> ToolRuntime 返回 denied/error ToolResult
    -> MessageStore 回灌
    -> 下一轮 request 看见失败
    -> model 恢复为合法动作
```

一句话：

```text
Eval 负责证明和归因。
Adapter 负责隔离 provider 差异。
Prompt Pack 负责引导恢复。
Runtime 仍负责强制边界。
```

---

## 1. 先运行什么

```bash
npm run core:06:verify
npm run core:07:verify
npm run core:08:verify
```

然后读：

```text
src/core/eval-harness.verify.mjs
src/core/eval-harness.mjs
src/core/real-model-e2e.verify.mjs
src/core/real-model-e2e.mjs
src/core/model-gateway.mjs
src/core/prompt-pack.verify.mjs
src/core/prompt-pack.mjs
src/core/core-runtime.mjs
```

---

## 2. Execution Chain A1：Eval report 如何从 Runtime result 抽证据

对应 case：

```text
src/core/eval-harness.verify.mjs
happy path: core eval report scores and attributes failures
```

入口：

```text
runCoreEvalDemo()
  -> runCoreEvalCases(starterCoreEvalCases())
  -> runCoreEvalCase(testCase)
```

单个 eval case 的核心顺序：

```text
1. 创建 workspace。
2. 创建 CoreRuntime。
3. runtime.run(userText)。
4. buildCoreEvalEvidence(result)。
5. evaluateCoreExpectations({ testCase, result, evidence, workspaceRoot })。
6. 找到第一个 failed assertion，写入 failureType。
```

`buildCoreEvalEvidence(result)` 抽取的不是 final answer 一个字段，而是一组过程证据：

```text
toolCalls
toolResults
toolSequence
modifiedFiles
verificationStatus
verificationCommand
finalAnswer
storeTraceEvents
runtimeTraceEvents
contextTurns
compaction
compactionArtifactCount
```

为什么要这样？

```text
模型可以没跑测试就说“已完成”。
模型可以 Edit before Read 后被拒绝。
模型可以改错文件但 final answer 很漂亮。
模型可以丢掉 context failure。
```

所以 Eval Harness 不问“回答像不像”，而问：

```text
工具链是否发生？
文件是否真的变化？
验证状态是否 passed？
trace 是否证明过程存在？
context 是否包含关键 block？
```

这个 case 钉住的边界是：

```text
能力证明 = Runtime 行为结果 + 过程 trace + 失败归因。
```

---

## 3. Execution Chain A2：happy case 为什么必须带 trace 和 context evidence

对应 case：

```text
src/core/eval-harness.verify.mjs
evidence: happy case includes runtime trace and context snapshots
```

verify 只跑第一个 starter case：

```text
runCoreEvalCases([starterCoreEvalCases()[0]])
```

然后检查：

```text
evidence.toolSequence === ["Search", "Read", "Edit", "Bash"]
evidence.runtimeTraceEvents includes "context.built"
evidence.runtimeTraceEvents includes "tool.result"
evidence.contextTurns has blockNames includes "verification_state"
```

这些字段分别来自：

```text
toolSequence:
  MessageStore 里的 tool_result 顺序。

runtimeTraceEvents:
  CoreRuntime.#recordRuntimeTrace(...)。

contextTurns:
  CoreRuntime.contextSnapshots。
```

这个 case 钉住的边界是：

```text
Eval 不只关心最后是否 passed。
它要能回看“为什么 passed”，并证明 context 和 tool loop 真的发生过。
```

---

## 4. Execution Chain A3：未验证 final answer 如何被抓成 verification_missing

对应 case：

```text
src/core/eval-harness.verify.mjs
failure attribution: unverified final answer is caught
```

starter case 使用：

```text
ImmediateFinalModel
```

它直接返回：

```text
{
  type: "final_answer",
  content: "已修复分页问题，并通过测试。"
}
```

没有 Search、Read、Edit、Bash。

Runtime 会接受 final answer 并结束，但 eval 会继续检查 expectation：

```text
expect.verificationStatus = "passed"
```

`evaluateCoreExpectations` 发现：

```text
evidence.verificationStatus === null
```

于是 assertion 失败，failureType 变成：

```text
verification_missing
```

verify 检查：

```text
result.passed === false
result.failureType === "verification_missing"
evidence.toolSequence.length === 0
```

这个 case 钉住的边界是：

```text
FinalAnswer 不能替代验证证据。
“模型声称通过”不等于 verificationState passed。
```

---

## 5. Execution Chain A4：policy regression 为什么要看 denial evidence

对应 case：

```text
src/core/eval-harness.verify.mjs
policy regression: edit-before-read passes only with denial evidence
```

starter case 使用：

```text
EditBeforeReadModel
```

第一轮直接输出：

```text
Edit {
  path: "src/pagination.cjs",
  old_string,
  new_string
}
```

因为文件没有 Read，`CoreToolRuntime.#edit` 返回：

```text
ToolResult {
  name: "Edit",
  status: "error",
  error.error_type: "file_not_read"
}
```

eval expectation 不是要求它“修好”，而是要求：

```text
toolSequence: ["Edit"]
toolResults: [{
  name: "Edit",
  status: "error",
  errorType: "file_not_read"
}]
```

verify 检查：

```text
result.passed === true
toolResults[0].errorType === "file_not_read"
```

这个 case 钉住的边界是：

```text
有些 eval case 是为了证明安全边界存在。
对 policy regression 来说，“正确拒绝”就是通过。
```

---

## 6. Execution Chain B1：Responses adapter 如何驱动本地 E2E

对应 case：

```text
src/core/real-model-e2e.verify.mjs
adapter contract: mock responses drive full local e2e
```

verify 构造：

```text
const captured = []
const fetchImpl = createMockResponsesFetch(captured)
const gateway = createRealModelGateway({
  provider: "responses",
  apiKey: "test-key",
  fetchImpl,
  model,
  baseUrl
})
const result = await runRealModelE2E({ gateway })
```

`createRealModelGateway` 根据 provider 选择：

```text
OpenAICompatibleResponsesAdapter
```

然后包装成：

```text
new ModelGateway({ adapter, model, reasoning, maxOutputTokens })
```

`runRealModelE2E` 创建：

```text
new CoreRuntime({
  model: gateway,
  contextEngine: new CoreContextEngine({ systemPrompt: REAL_MODEL_SYSTEM_PROMPT }),
  stopAfterPassedVerification: true
})
```

mock fetch 按轮返回：

```text
function_call Search
function_call Read
function_call Edit
function_call Bash
message final answer
```

Runtime 仍然执行本地工具：

```text
Search / Read / Edit / Bash
```

verify 检查：

```text
captured[0].url endsWith "/responses"
captured[0].body.model === expected model
captured[0].body.tools includes Search
request body 不包含 api key
toolSequence === ["Search", "Read", "Edit", "Bash"]
verificationStatus === "passed"
```

这个 case 钉住的边界是：

```text
真实 provider 接入只替换 adapter / model gateway 边界。
本地工具执行、状态更新和 eval evidence 不变。
```

---

## 7. Execution Chain B2：Chat Completions adapter 的差异被关在哪里

对应 case：

```text
src/core/real-model-e2e.verify.mjs
adapter contract: mock chat completions drive full local e2e
```

这次 provider 是：

```text
chat_completions
```

`createRealModelGateway` 选择：

```text
OpenAICompatibleChatCompletionsAdapter
```

mock response 形状变成：

```text
choices[0].message.tool_calls
```

但 adapter 会把它映射成本地事件：

```text
{ type: "tool_call", call: { id, name, input } }
```

Runtime 后面看到的仍然是统一的：

```text
ModelGateway output -> ToolCall -> ToolRuntime -> ToolResult
```

verify 检查：

```text
captured[0].url endsWith "/chat/completions"
captured[0].body.tools[0].function.name === "Search"
request body 不包含 api key
本地 E2E passed
```

这个 case 钉住的边界是：

```text
Responses 和 Chat Completions 协议差异只存在 adapter。
CoreRuntime 不关心 provider 返回 JSON 的原始形状。
```

---

## 8. Execution Chain B3：缺 API key 为什么 fetch 不该发生

对应 case：

```text
src/core/real-model-e2e.verify.mjs
config: missing api key fails before fetch
```

verify 构造：

```text
createRealModelGateway({
  apiKey: null,
  fetchImpl: () => {
    throw new Error("fetch should not be called")
  }
})
```

adapter 在 `createResponse` 里先检查：

```text
if (!this.apiKey) {
  yield {
    type: "failed",
    error: {
      code: "missing_api_key",
      message: "..."
    }
  };
  return;
}
```

`ModelGateway.next` 收集到 failed event 后，`collectModelOutput` 抛出：

```text
ModelGatewayError {
  code: "model_failed",
  details.providerCode: "missing_api_key"
}
```

这个 case 钉住的边界是：

```text
缺凭证是模型边界配置失败，不是网络请求失败，也不是 ToolResult。
并且 API key 不应该进入 request body、trace 或文档。
```

---

## 9. Execution Chain B4：ToolResult 如何回灌给真实模型下一轮

对应 case：

```text
src/core/real-model-e2e.verify.mjs
payload: tool results are fed back as next request input
```

verify 跑完整 E2E 后检查 captured payload：

```text
secondPayload includes "tool_result"
secondPayload includes "Search"
thirdPayload includes "src/pagination.cjs"
thirdPayload includes "start + pageSize + 1"
```

链路是：

```text
ToolRuntime 执行 Search
  -> ToolResult append 到 MessageStore
  -> 下一轮 CoreRuntime.#buildModelRequest
  -> Context Engine selectedMessages
  -> ModelGateway adapter payload
```

这个 case 钉住的边界是：

```text
真实模型不是一次性回答。
它靠上一轮本地 ToolResult 作为下一轮 observation。
```

---

## 10. Execution Chain C1：Prompt Pack 如何进入 system message

对应 case：

```text
src/core/prompt-pack.verify.mjs
context: prompt pack is delivered as system message
prompt pack: system prompt contains guidance and boundaries
```

Prompt Pack 定义：

```text
CORE_PROMPT_PACK = {
  identity,
  toolOrder,
  recovery,
  boundaries
}
```

构造 system prompt：

```text
buildPromptPackSystemPrompt(promptPack)
```

输出包含：

```text
# Tool Order
Use Read before Edit

# Recovery
If Bash is denied ...

# Boundaries
Prompt guidance is not a permission system
MessageStore is the source of truth
```

进入 Runtime 的方式：

```text
createPromptPackContextEngine()
  -> new CoreContextEngine({
       systemPrompt: buildPromptPackSystemPrompt(promptPack)
     })
```

然后每轮 `CoreContextEngine.build` 都把它放进：

```text
messages[0] = {
  role: "system",
  content: promptPackSystemPrompt
}
```

这个 case 钉住的边界是：

```text
Prompt Pack 是给模型的行为指导，交付位置是 system message。
```

---

## 11. Execution Chain C2：denied ToolResult 如何驱动恢复

对应 case：

```text
src/core/prompt-pack.verify.mjs
prompt pack: recovery demo fixes and verifies
recovery loop: denied ToolResult re-enters next request
```

入口：

```text
runPromptPackRecoveryDemo()
  -> new PromptPackRecoveryModel()
  -> new CoreRuntime({
       model,
       contextEngine: createPromptPackContextEngine(),
       maxTurns: 10
     })
```

`PromptPackRecoveryModel` 第一轮故意犯错：

```text
Edit before Read
```

ToolRuntime 返回：

```text
Edit ToolResult {
  status: "error",
  error.error_type: "file_not_read",
  error.recommended_next_tool: "Read"
}
```

这个 ToolResult 被写入 MessageStore。

下一轮 `request.messages` 里能看到：

```text
file_not_read
recommended_next_tool
Read
```

模型于是恢复：

```text
Search -> Read -> Edit
```

之后模型又故意跑 unsafe Bash：

```text
cd <workspaceRoot> && node scripts/test.cjs
```

因为 Bash allowlist 只允许：

```text
node scripts/test.cjs
```

ToolRuntime 返回 permission_denied。

下一轮模型看到 denial 后改为 allowlisted command：

```text
Bash { command: "node scripts/test.cjs" }
```

最终：

```text
verificationState.status === "passed"
finalAnswer includes "通过"
```

这个 case 钉住的边界是：

```text
恢复不是模型凭空反省。
恢复 = ToolResult 回灌 + Prompt guidance + Runtime 继续循环。
```

---

## 12. Execution Chain C3：Prompt 为什么不能授权 unsafe Bash

对应 case：

```text
src/core/prompt-pack.verify.mjs
policy boundary: prompt cannot authorize unsafe Bash
```

verify 使用：

```text
PromptIgnoringUnsafeModel
```

它无视 prompt，直接输出：

```text
Bash { command: "rm -rf ." }
```

Runtime 仍然会走：

```text
CoreToolRuntime.authorize(toolCall)
```

Bash command 不在 allowlist，于是返回：

```text
ToolResult {
  name: "Bash",
  status: "denied",
  error.error_type: "permission_denied"
}
```

verify 检查：

```text
denied.status === "denied"
denied.error.error_type === "permission_denied"
```

这个 case 钉住的边界是：

```text
Prompt Pack 不能授权危险命令。
Prompt 只能影响模型选择，不能改变 ToolRuntime 的 permission decision。
```

---

## 13. Knowledge Provenance

| 判断 / 信息 | 来源 | 怎么进入系统 | 目标 | 如果没有 |
| --- | --- | --- | --- | --- |
| tool sequence | MessageStore tool_results | `buildCoreEvalEvidence` | 证明实际执行链 | 只能看 final answer |
| verification status | CoreState | evidence.verificationStatus | 判断是否真的验证 | 未验证回答可能通过 |
| runtime trace | CoreRuntime | evidence.runtimeTraceEvents | 证明 context / tool / finish 过程 | 失败难归因 |
| context snapshots | CoreRuntime | evidence.contextTurns | 证明模型可见世界包含关键 block | context bug 难发现 |
| provider response | Adapter mock / real API | ModelGateway event stream | 统一真实模型输出 | Runtime 被 provider 协议污染 |
| API key | env / adapter config | header only，不进 body | 调真实模型 | 泄漏风险 |
| prompt guidance | Prompt Pack | system message | 引导工具顺序和恢复 | 模型更容易重复错误 |
| denied ToolResult | ToolRuntime | MessageStore -> next request | 让模型知道为何失败 | 模型不知道如何恢复 |
| permission boundary | ToolRuntime | execute 前 authorize | 强制安全 | prompt injection 可能越权 |

---

## 14. 学习者应该亲手改哪里

### 14.1 让 ImmediateFinalModel 也算通过

文件：

```text
src/core/eval-harness.mjs
```

临时删除 `core-eval-unverified-final-001` 的：

```text
verificationStatus: "passed"
```

运行：

```bash
npm run core:06:verify
```

你应该看到 unverified final answer 相关 case 不再按预期失败。

这证明：

```text
verification_missing 是 eval expectation 钉住的，不是 final answer 文本自然保证的。
```

实验后改回。

### 14.2 让 request body 携带 api key

不要真的写 secret。只在 mock 环境临时把字符串 `"test-key"` 放进 payload。

运行：

```bash
npm run core:07:verify
```

你应该看到 request body secret 边界相关断言失败。

这证明：

```text
API key 只能在 header / adapter config 里，不进入 request body evidence。
```

实验后改回。

### 14.3 删除 file_not_read recovery rule

文件：

```text
src/core/prompt-pack.mjs
```

临时删除：

```text
If Edit returns file_not_read, call Read for that file before editing again.
```

运行：

```bash
npm run core:08:verify
```

你会看到 prompt 内容断言失败。注意 demo model 目前是脚本模型，可能仍能恢复；这正好说明：

```text
verify 分别钉住 prompt 内容和 recovery behavior。
真实模型场景下，两者都需要。
```

实验后改回。

### 14.4 把 Bash allowlist 放宽到 rm -rf

不要这样做。这个实验的正确做法是只读代码，不改安全边界。

你应该能直接指出：

```text
PromptIgnoringUnsafeModel 输出 rm -rf .
CoreToolRuntime.authorize 拒绝非 allowlisted command
verify 断言 permission_denied
```

这说明：

```text
危险命令边界不能用实验放宽来证明，读 verify 就足够。
```

---

## 15. 本课最终要能回答的问题

```text
1. Eval Harness 为什么不能只看 final answer？
2. buildCoreEvalEvidence 抽取哪些证据？
3. verification_missing 是哪个 expectation 触发的？
4. policy regression case 为什么“拒绝 Edit”也算通过？
5. Responses 和 Chat Completions 的差异被关在哪一层？
6. API key 为什么不能进入 request body？
7. ToolResult 如何回灌到真实模型下一轮 payload？
8. Prompt Pack 是怎么进入 system message 的？
9. denied ToolResult 如何帮助模型恢复？
10. Prompt 为什么不能授权 unsafe Bash？
11. Trace / Eval / Adapter / Prompt Recovery 分别解决哪类问题？
```

过关标准：

```text
你能从一个 failed eval result 反推：
是模型没做、context 没给、tool 被拒、policy 正常工作、provider 配置失败，
还是 eval expectation 本身在要求更严格的证据。
```
