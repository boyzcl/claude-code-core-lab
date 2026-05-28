# Core 06 Trace / Eval Harness Expansion：让能力可证明、失败可归因

Core 06 验证：

```text
Eval 不是普通测试脚本，而是把 CoreRuntime 的运行事实转成可评分、可复现、可归因的证据包。
```

---

## 1. 本 Core 在课程层面要学什么

你要学会：

```text
一个 Agent 是否“做对了”，不能只看最后一句话。
必须看它有没有产生正确的 ToolCall / ToolResult、有没有更新状态、有没有验证、有没有留下 trace 证据。
```

Core 06 对应：

```text
Lab 02 MessageStore / Trace
Lab 05 Context Engine
Lab 08 Eval Runner
Core 01 到 Core 05 的完整运行结果
```

它把前面已经跑通的 Runtime 变成可以被 eval 检查的对象。

---

## 2. 本 Core 做什么

当前实现新增：

```text
1. CoreRuntime 记录 runtimeTrace
2. Eval Harness 运行 CoreRuntime case
3. buildCoreEvalEvidence 抽取运行证据
4. evaluateCoreExpectations 对照 case 预期评分
5. failureType 记录失败归因
6. core:06:verify 覆盖正向成功、未验证 final、policy denial 三类情况
```

`runtimeTrace` 记录的是运行时层事件，例如：

```text
runtime.started
context.built
model.output
tool.authorized
tool.result
runtime.finished
context.compacted
```

`MessageStore trace` 仍然记录消息和状态事实，例如：

```text
session.created
message.appended
state.updated
```

两者边界不同：

```text
MessageStore trace 证明事实流如何 append 和更新。
runtimeTrace 证明 Runtime 如何构造上下文、接收模型输出、授权工具、完成任务。
```

---

## 3. 新增系统能力

Core 06 后，CoreRuntime 的一次运行可以被转成 eval evidence：

```text
toolSequence
toolResults
modifiedFiles
verificationStatus
finalAnswer
storeTraceEvents
runtimeTraceEvents
contextTurns
compaction metadata
```

这让 eval 可以判断：

```text
是否真的搜索、读取、编辑、验证
是否未验证却声称完成
是否 edit-before-read 被安全拒绝
是否 context snapshot 留下了本轮模型可见材料
失败属于 verification、policy/tool safety、context、state 还是 trace evidence 缺失
```

---

## 4. 它守住了什么边界

Core 06 不改变工具执行语义。

```text
Search / Read / Edit / Bash 仍由 CoreToolRuntime 执行。
Policy 仍在 ToolRuntime 和 PlanController 里生效。
MessageStore 仍是 append-only 事实流。
Context Engine 仍负责本轮 ModelRequest 可见材料。
Eval Harness 只读取运行结果并评分，不替 Runtime 做决策。
```

这点很重要：

```text
Eval 是证据层和反馈层，不是执行层。
```

---

## 5. 运行入口

```bash
npm run core:06
npm run core:06:verify
```

`core:06` 会运行 starter eval suite。

其中包含一个故意失败的 case：

```text
unverified final answer is caught by eval
```

所以 demo report 的分数不是 1，而是证明 eval 能抓住“没验证却声称完成”。

`core:06:verify` 才是本 Core 的验证入口。

---

## 6. 验证点

`core:06:verify` 覆盖 5 个 case：

```text
1. core eval report scores and attributes failures
2. starter cases declare executable expectations
3. happy case includes runtime trace and context snapshots
4. unverified final answer is caught
5. edit-before-read passes only with denial evidence
```

它们证明：

```text
Eval Harness 能运行 CoreRuntime case。
评分不是凭感觉，而是来自 evidence。
未验证 final answer 会被判为 verification_missing。
Edit before Read 只有在留下 file_not_read denial evidence 时才算符合预期。
Runtime trace 和 context snapshots 会进入 evidence。
```

---

## 7. 学习者应该观察什么

运行：

```bash
npm run core:06
```

重点看：

```text
score
failureTypes
results[].evidence.toolSequence
results[].evidence.runtimeTraceEvents
results[].evidence.contextTurns
results[].failureType
```

如果一个 case 失败，不要先问“模型是不是笨”。

先问：

```text
1. 预期写清楚了吗？
2. Trace 里有没有证据？
3. ToolResult 有没有结构化错误？
4. Context snapshot 有没有给模型必要信息？
5. CoreState 有没有正确保存验证状态？
6. FinalAnswer 是否被 verificationState 支撑？
```

---

## 8. 过关自测问题

机制题：

```text
Core Eval Harness 的输入是什么？
它输出哪些 evidence？
为什么不能只看 finalAnswer？
runtimeTrace 和 MessageStore trace 有什么区别？
```

边界题：

```text
Eval Harness 能不能替 ToolRuntime 执行工具？
Eval Harness 能不能绕过 Policy？
为什么未验证 final answer 应该被判失败？
为什么 edit-before-read 的通过条件是留下 denial evidence，而不是真的编辑成功？
```

失败题：

```text
verification_missing 表示什么？
tool_result_mismatch 表示什么？
missing_trace_evidence 表示什么？
如何根据 trace 判断问题属于 model、context、tool、policy、state 还是 eval 标准？
```

一句话总结：

```text
Trace 让运行过程可观察，Eval Harness 让运行能力可评分和可归因。
```
