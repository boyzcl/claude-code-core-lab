# Core 07 Real Model API E2E：真实模型只替换 Adapter

Core 07 验证：

```text
真实模型 API 可以接入 CoreRuntime，但不能接管本地工具、权限、状态和验证。
```

---

## 1. 本 Core 在课程层面要学什么

你要学会：

```text
真实模型接入不是把 Agent 交给模型服务。
真实模型只替换 ModelGateway 后面的 Provider Adapter。
```

Core 07 对应：

```text
Core 02 Model Gateway
Core 03 Context Engine
Core 06 Trace / Eval Harness
claude-code-70-80-validation-and-model-access.md 的模型接入策略
```

它把前面 mock 的模型边界接到真实供应商 API，但 Runtime 权力仍留在本地。

---

## 2. 本 Core 做什么

当前实现新增：

```text
1. Core 07 live E2E 入口
2. OpenAI-compatible Responses Adapter 真实请求路径
3. OpenAI-compatible Chat Completions Adapter
4. DeepSeek Chat Completions tool_calls 接入
5. provider HTTP error code 归一化
6. 文本化 tool_call JSON 的窄恢复
7. 多 tool_call 归一化为单步执行
8. 验证通过后的本地收束 guard
```

运行入口：

```bash
npm run core:07
npm run core:07:verify
npm run core:07:live
```

`core:07:verify` 不依赖真实 key，使用 mock fetch 验证 adapter contract。

`core:07:live` 需要通过环境变量提供真实模型配置。

---

## 3. 当前支持的 Provider 形态

Responses-compatible：

```text
OpenAICompatibleResponsesAdapter
POST {baseUrl}/responses
function_call -> local tool_call
message output_text -> final_answer
```

Chat Completions-compatible：

```text
OpenAICompatibleChatCompletionsAdapter
POST {baseUrl}/chat/completions
message.tool_calls[] -> local tool_call
message.content -> final_answer
```

示例配置：

```bash
DEEPSEEK_API_KEY=...
AGENT_MODEL_PROVIDER=deepseek
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
npm run core:07:live
```

敏感信息规则：

```text
API key 只通过环境变量传入。
API key 不写入源码、文档、验证记录或 trace。
```

---

## 4. 它守住了什么边界

真实模型可以：

```text
阅读 Context Engine 选择后的 ModelRequest。
返回 function_call / tool_calls。
返回 final answer。
```

真实模型不能：

```text
直接读文件。
直接写文件。
直接执行 bash。
绕过 read-before-edit。
绕过 Bash allowlist。
绕过 MessageStore 事实流。
绕过 Eval Harness 的 evidence 检查。
```

本地 Runtime 仍然负责：

```text
ToolRuntime 执行 Search / Read / Edit / Bash。
Policy 决定是否允许工具调用。
MessageStore 记录 ToolCall / ToolResult。
Context Engine 决定下一轮模型看见什么。
Eval Harness 判断是否真的完成。
```

---

## 5. 真实模型暴露出的行为差异

DeepSeek live E2E 观察到：

```text
模型可能多搜索一次。
模型可能先 Read 测试文件，再 Read 目标文件。
模型可能一次返回多个 tool_calls。
模型可能尝试带 cd 的 Bash 命令。
模型验证通过后有时仍继续请求工具。
```

这些不是简单“模型错误”，而是 Runtime 边界要吸收的真实差异。

因此 Core 07 增加了三个保护：

```text
1. 多 tool_calls 只执行第一个，其余记录在 metadata。
2. 明确 JSON tool_call 文本可恢复为 tool_call，但普通文本仍是 final_answer。
3. verificationState passed 后，Core 07 可以由本地 Runtime 收束最终回答。
```

注意：

```text
这些保护不替模型执行业务判断。
它们只防止真实模型 API 形态破坏本地 Runtime 的单步工具闭环。
```

---

## 6. 验证点

`core:07:verify` 覆盖：

```text
1. mock Responses adapter 可以驱动完整本地 E2E
2. mock Chat Completions adapter 可以驱动完整本地 E2E
3. 缺少 API key 时不会调用 fetch，错误被归一化
4. ToolResult 会进入下一轮模型请求
```

DeepSeek live 已验证：

```text
Search -> Read -> Read -> Edit -> Bash
verificationStatus: passed
modifiedFiles: src/pagination.cjs
finalAnswer grounded in passed verification
```

其中 `Read` 多一次是可接受的真实模型探索；Eval 要求的是有效子序列：

```text
Search -> Read -> Edit -> Bash
```

而不是 mock 模型的刚性四步。

---

## 7. 学习者应该观察什么

运行：

```bash
npm run core:07:verify
```

重点看：

```text
Responses 和 Chat Completions 两种 provider 形态都只影响 Adapter。
本地工具执行链路没有被 provider 接管。
ToolResult 会回灌到下一轮模型请求。
缺 key 不会触发真实请求。
```

有真实 key 时运行：

```bash
npm run core:07:live
```

重点看：

```text
toolSequence
verificationStatus
modifiedFiles
finalAnswer
runtimeTraceEvents
contextTurns
```

---

## 8. 过关自测问题

机制题：

```text
Core 07 新增了哪两类 Provider Adapter？
Responses function_call 和 Chat Completions tool_calls 分别如何映射成本地 tool_call？
为什么 ToolResult 必须进入下一轮 ModelRequest？
```

边界题：

```text
真实模型 API 能不能直接执行本地工具？
为什么 OpenCloud / OpenClaw / DeepSeek 都应该处在 ModelGateway 后面？
为什么 API key 不能进入源码和 trace？
```

失败题：

```text
provider_http_error 如何归一化？
模型一次返回多个 tool_calls 时为什么只执行第一个？
验证已经 passed 但模型继续请求工具时，Runtime 为什么应该收束？
```

一句话总结：

```text
Core 07 证明真实模型只是可替换决策源，本地 Runtime 才是 Agent 产品边界。
```
