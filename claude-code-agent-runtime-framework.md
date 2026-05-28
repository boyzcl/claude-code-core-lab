# Claude Code 式通用 Agent Runtime 抽象设计文档

> 目标：把 Claude Code 抽象成一个可复刻、可泛化的 Agent 框架，而不是复刻某个聊天界面或几个工具调用。
>
> 本文讲的是产品与工程抽象：一个通用 Agent Runtime 应该如何组织上下文、工具、权限、计划、状态、记忆、任务与人类介入。
>
> 学习总控文档：`claude-code-core-learning-path.md` 负责定义学习顺序、阶段产出、记录方式和未来开源沉淀路径。
>
> 施工图文档：`claude-code-core-implementation-blueprint.md` 负责定义模块级数据结构、算法规则、工具协议、状态机、Prompt Pack 和开发阶段。
>
> 补充验收文档：`claude-code-70-80-validation-and-model-access.md` 负责定义 70%-80% 能力如何测试、评分，以及 GPT 5.5 / OpenAI-compatible API 如何接入。

---

## 0. 总体定义

Claude Code 这类产品的核心不是“模型会写代码”，而是：

```text
一个受控的任务运行时，把用户目标转化为持续的感知、规划、行动、反馈、修正和验证过程。
```

它的最小闭环是：

```text
User Goal
  -> Session
  -> Context Assembly
  -> Tool Assembly
  -> Model Decision
  -> Permission Check
  -> Tool Execution
  -> Observation
  -> State Update
  -> Next Turn
```

如果要复刻它，应先抽象以下主对象：

```text
Session        一次持续任务会话
MessageStream  事实流水账，包括用户消息、模型消息、工具结果、系统事件
Context        每一轮喂给模型的可见信息包
ToolRuntime    可被模型调用的行动能力集合
PolicyEngine   权限、模式、沙箱、安全规则
Plan           可持久化、可审批、可转执行的方案对象
StateStore     Runtime 自己维护的任务状态
Memory         跨会话稳定知识
Compaction     长上下文压缩与恢复机制
Task           前台/后台/子代理/远端/验证任务
Artifact       代码、日志、计划、报告、截图、测试结果等交付物
```

---

## 1. 运行时主循环

### 1.1 核心职责

主循环负责把“模型的一次回答”变成“可持续推进任务的过程”。

它每一轮做四件事：

```text
准备模型能看的信息
准备模型能用的工具
执行模型选择的动作
把动作结果回灌给下一轮
```

### 1.2 伪代码

```ts
async function runSession(session: Session) {
  while (!session.done) {
    const context = await contextEngine.build(session)
    const tools = await toolRegistry.assemble(session)

    const modelOutput = await model.call({
      messages: session.messageStream.visibleMessages(),
      context,
      tools,
      mode: session.permission.mode,
    })

    session.messageStream.append(modelOutput.message)

    if (modelOutput.toolCalls.length === 0) {
      session.done = true
      return modelOutput.finalText
    }

    const results = await toolExecutor.runBatch({
      toolCalls: modelOutput.toolCalls,
      session,
    })

    session.messageStream.append(results.toMessages())
    await stateStore.applyToolResults(session, results)

    if (await compactor.shouldCompact(session)) {
      await compactor.compact(session)
    }
  }
}
```

### 1.3 判断逻辑

主循环不是简单 while true，它要处理这些分支：

```text
如果模型直接给最终答案：结束任务
如果模型请求工具：进入权限检查和工具执行
如果工具失败：失败结果进入消息流，不直接吞掉
如果用户打断：取消当前可中断工具，保留已有状态
如果上下文接近窗口上限：触发 compact
如果达到 max turns：返回受控中止
如果权限被拒绝：拒绝原因作为观察结果回灌给模型
如果 plan 需要审批：暂停执行，等待用户确认
```

---

## 2. Context Engine：上下文组织模块

上下文组织是整个框架最关键的模块之一。它的任务不是“把所有信息拼进去”，而是：

```text
在有限上下文窗口内，按优先级选择当前轮最该让模型知道的信息。
```

### 2.1 上下文来源

一个 Claude Code 式框架通常有这些上下文来源：

```text
1. System Prompt
2. Agent / Role Prompt
3. Runtime Mode Instruction
4. Current User Message
5. Message History
6. Tool Results
7. Project Rules
8. Environment Context
9. Git / Workspace Context
10. Plan Context
11. Memory Context
12. Compact Summary
13. Task Notifications
14. Artifact References
15. Dynamic Attachments
16. MCP / Plugin Context
```

### 2.2 推荐优先级

上下文优先级不是单纯文本顺序，而是“冲突时谁赢”和“预算不够时谁保留”。

建议优先级如下：

```text
P0  安全与治理规则
P1  当前用户最新意图
P2  当前运行模式，例如 plan / execute / review
P3  当前工具结果和错误输出
P4  当前任务计划和待办
P5  项目内显式规则，例如 CLAUDE.md、.rules
P6  当前工作区环境，例如 cwd、git status、依赖信息
P7  最近对话历史
P8  相关长期记忆
P9  旧对话 compact 摘要
P10 可重新获得的信息引用，例如文件路径、artifact 路径
```

冲突规则：

```text
安全规则 > 用户最新指令 > 当前模式 > 项目规则 > 长期记忆 > 历史摘要
```

例子：

```text
长期记忆说“默认直接修改”
当前用户说“先不要改，只分析”
那么当前用户赢。

项目规则说“可以自动 format”
当前处于 plan mode
那么 plan mode 赢，不能写文件。

旧 compact 摘要说测试已通过
最新工具结果说测试失败
那么最新工具结果赢。
```

### 2.3 必须拼入的信息

以下信息通常每轮都应该进入上下文：

```text
System Prompt
当前用户消息
当前运行模式
工具定义或工具索引
必要的权限提示
最近的模型/工具交互
```

如果是 coding 场景，还建议固定拼：

```text
当前工作目录
当前日期
项目规则文件摘要
git 状态摘要
```

但这些也应有开关。例如远端环境、非 git 项目、裸模式、隐私模式下，git 状态和项目规则可以不拼。

### 2.4 按需拼入的信息

这些信息不应无脑拼，而应按触发条件拼：

```text
文件内容：只有 Read/Search 工具读出来后才进入消息流
长期记忆：只有相关性检索命中后才拼
完整日志：默认不拼，只拼摘要和 artifact 路径
旧对话：默认拼 compact summary，不拼完整历史
MCP resource：只有用户或模型请求后才读取
Plan 文件：plan mode、执行 plan、resume plan 时拼
动态技能/插件说明：只有触发路径或任务类型匹配时拼
测试输出：短输出直接拼，长输出保存为 artifact 再拼摘要
```

### 2.5 不应该拼入的信息

以下内容不要默认进入模型上下文：

```text
整个代码库
所有历史对话
所有长期记忆
所有工具输出全文
所有 git log
所有依赖源码
所有插件文档
所有后台任务日志
```

原因很简单：

```text
会浪费上下文
会稀释当前任务注意力
会增加冲突信息
会破坏 prompt cache
会引入过期事实
```

### 2.6 上下文装配流程

推荐流程：

```text
1. 收集强制上下文
   - system prompt
   - current user message
   - runtime mode
   - safety rules

2. 收集项目上下文
   - project rules
   - local instructions
   - current cwd
   - git status

3. 收集任务上下文
   - current plan
   - todo state
   - active tasks
   - recent tool results

4. 收集相关记忆
   - 根据当前用户消息、计划、最近工具结果检索
   - 限制数量
   - 避免与项目规则重复

5. 收集历史上下文
   - 最近几轮原文
   - 更早内容用 compact summary

6. 做 token budget 分配
   - 高优先级不可丢
   - 中优先级可摘要
   - 低优先级可仅保留引用

7. 输出最终上下文包
```

### 2.7 Token Budget 策略

建议把上下文窗口切成预算区：

```text
20%  系统、模式、安全规则
20%  当前任务和计划
25%  最近消息和工具结果
20%  文件片段、日志、artifact 摘要
10%  项目规则和环境
5%   相关长期记忆
```

这不是固定值，而是默认策略。

当上下文超限时，裁剪顺序：

```text
1. 删除可重新获取的长日志全文，保留 artifact 路径
2. 压缩旧工具结果
3. 压缩旧对话
4. 降低长期记忆数量
5. 降低 git/status 细节
6. 最后才裁剪当前任务和最新工具结果
```

---

## 3. Tool Runtime：工具系统

### 3.1 工具不是函数

在通用 Agent Runtime 里，工具应该是带治理信息的能力对象。

```ts
interface Tool {
  name: string
  description: string
  inputSchema: Schema
  outputSchema?: Schema

  call(input: unknown, ctx: ToolUseContext): Promise<ToolResult>

  validateInput?(input: unknown, ctx: ToolUseContext): Promise<ValidationResult>
  checkPermission?(input: unknown, ctx: ToolUseContext): Promise<PermissionDecision>

  isReadOnly(input: unknown): boolean
  isConcurrencySafe(input: unknown): boolean
  isDestructive?(input: unknown): boolean
  maxResultSize?: number
}
```

### 3.2 工具装配流程

工具不是固定列表，而是运行时装配。

```text
1. 读取基础工具
   - Read
   - Search
   - Edit
   - Write
   - Shell
   - Todo
   - Plan
   - AskUser
   - Agent

2. 读取扩展工具
   - MCP tools
   - plugin tools
   - project tools
   - domain tools

3. 按运行模式过滤
   - plan mode 隐藏或禁止写工具
   - review mode 优先验证工具
   - non-interactive mode 禁止需要用户 UI 的工具

4. 按权限规则过滤
   - deny rule 命中的工具不展示给模型
   - allow rule 可自动执行
   - ask rule 需要用户确认

5. 按 agent 类型过滤
   - researcher 只读工具
   - worker 可编辑工具
   - verifier 只读 + shell/test

6. 稳定排序
   - 保持工具列表稳定，减少 prompt cache 失效
```

### 3.3 工具执行策略

工具执行不是全部并发。

```text
只读且并发安全：
  可以并发执行，例如 grep、glob、read

写入或状态变更：
  串行执行，例如 edit、write、delete

长任务：
  可进入 background task，例如测试服务器、长时间测试

危险工具：
  需要 permission 或 sandbox，例如 shell、网络、删除、发布
```

### 3.4 工具结果处理

工具结果进入消息流前要规范化：

```text
短结果：直接进入 tool_result
长结果：保存为 artifact，进入摘要和路径
错误结果：以错误观察进入消息流
权限拒绝：以拒绝原因进入消息流
用户反馈：附加到工具结果之后
```

这点非常重要：错误不是异常结束，而是模型下一轮决策的事实。

---

## 4. Policy Engine：权限与治理

### 4.1 权限模式

建议至少设计这些模式：

```text
default       默认模式，危险动作询问用户
plan          只读规划模式
acceptEdits   允许项目内编辑，但危险动作仍受限
bypass        高信任模式，尽量少问
readonly      纯只读模式
nonInteractive 后台/SDK 模式，不能弹用户确认
```

### 4.2 权限判断流程

每次工具调用前都应走：

```text
1. 工具是否存在
2. 输入 schema 是否合法
3. 工具是否在当前模式允许
4. 是否命中 deny rule
5. 是否命中 allow rule
6. 是否命中 ask rule
7. 是否通过工具自己的 validateInput
8. 是否通过路径/网络/命令安全检查
9. 是否需要 sandbox
10. 最终 allow / deny / ask
```

### 4.3 文件编辑安全

文件写入必须有额外保护：

```text
读前写禁止：
  没读过文件，不允许改。

过期写禁止：
  读完后文件被用户或工具改过，不允许直接写。

唯一匹配：
  edit 的 old_string 必须唯一匹配，除非显式 replace_all。

路径安全：
  禁止写配置、密钥、系统路径、危险目录。

备份：
  写前记录 file history，便于回滚。
```

### 4.4 Shell 安全

Shell 工具需要特别判断：

```text
是否只读命令
是否写文件
是否访问网络
是否删除文件
是否启动后台进程
是否超时
是否需要 sandbox
是否需要用户确认
```

不要把 Bash 当普通工具，它是一个能力放大器。

---

## 5. Plan System：计划系统

### 5.1 Plan 的工程本质

Plan 不应只是 assistant message，而应是一个持久化对象。

```ts
interface Plan {
  id: string
  sessionId: string
  status: 'draft' | 'awaiting_approval' | 'approved' | 'rejected' | 'executing' | 'done'
  content: string
  evidenceRefs: ArtifactRef[]
  risks: string[]
  validationStrategy: string[]
  userFeedback?: string
  createdAt: string
  updatedAt: string
}
```

### 5.2 Plan Mode 的状态切换

推荐状态机：

```text
normal
  -> enter_plan
plan
  -> write_plan
awaiting_approval
  -> approved -> execute
  -> rejected -> plan
execute
  -> verify
verify
  -> done
```

### 5.3 Plan Mode 允许和禁止

Plan Mode 允许：

```text
读文件
搜索
查看 git 状态
询问用户
写 plan 文件
创建 todo
```

Plan Mode 禁止：

```text
改业务文件
运行有副作用命令
删除文件
安装依赖
提交代码
启动发布
```

### 5.4 Plan 如何转执行

用户批准后，不是简单继续聊天，而是构造一个执行输入：

```text
Implement the following plan:

{plan content}

User feedback:
{feedback}

Validation requirements:
{validation strategy}
```

这让 plan 成为执行阶段的控制输入。

---

## 6. State Store：运行时状态

### 6.1 为什么需要状态

不能把所有东西都交给模型记忆，因为：

```text
上下文会超限
模型会遗漏
工具执行有真实副作用
后台任务会跨轮存在
权限状态不能靠模型自觉
```

### 6.2 推荐状态结构

```ts
interface RuntimeState {
  sessionId: string
  mode: PermissionMode
  messages: Message[]
  plans: Record<string, Plan>
  tasks: Record<string, TaskState>
  artifacts: Record<string, Artifact>
  readFileCache: Record<string, FileReadState>
  permissions: PermissionContext
  compactState: CompactState
  memoryRefs: MemoryRef[]
  activeToolUseIds: Set<string>
}
```

### 6.3 哪些状态给模型看

不是所有 State 都进入上下文。

```text
给模型看：
  当前 plan
  当前 todo
  最新工具结果
  当前后台任务摘要
  artifact 摘要和路径

不给模型直接看：
  permission 内部计数器
  readFileCache 全量内容
  UI 状态
  toolUse 内部 id 集合
  token 预算内部变量
```

---

## 7. Memory 与 Compaction

### 7.1 Memory 和 Compact 的区别

```text
Memory:
  跨会话、稳定、长期。

Compact:
  当前会话太长后的摘要，服务于继续推进当前任务。
```

不要混用。

### 7.2 Memory 应该保存什么

适合保存：

```text
用户稳定偏好
团队长期约定
项目稳定工作方式
反复出现的用户反馈
```

不适合保存：

```text
临时 bug
当前任务进度
一次性测试结果
代码结构
文件路径
git 历史
已经写在项目规则里的内容
```

### 7.3 Memory 检索逻辑

```text
1. 用当前用户目标生成检索 query
2. 加上当前 plan 和最近工具结果
3. 检索候选 memory
4. 最多选少量高相关记忆
5. 去掉与项目规则重复的内容
6. 拼入上下文低优先区
```

### 7.4 Compact 触发条件

```text
token 使用接近阈值
用户手动 /compact
工具输出过长
恢复 session 时需要轻量上下文
进入新阶段时希望清理历史噪声
```

### 7.5 Compact 应保留什么

```text
用户原始目标
已确认的 plan
已经修改的文件
关键工具结果
失败过的路径
当前未解决问题
验证状态
artifact 引用
权限/模式提示
```

### 7.6 Compact 不应保留什么

```text
冗长日志全文
重复搜索结果
已废弃假设
无关闲聊
过期中间计划
可重新读取的文件全文
```

---

## 8. Task 与 Agent 系统

### 8.1 Task 的作用

Task 是比消息更稳定的任务对象。

```ts
interface TaskState {
  id: string
  type: 'foreground' | 'background' | 'subagent' | 'remote' | 'verification'
  status: 'pending' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled'
  goal: string
  ownerAgentId?: string
  outputArtifactId?: string
  parentTaskId?: string
}
```

### 8.2 什么时候创建子任务

适合创建子任务：

```text
需要并行调研多个方向
测试很慢
需要独立验证
任务可以明确分工
需要后台持续运行
需要远端环境
```

不适合创建子任务：

```text
一步命令即可完成
主 agent 立刻需要结果
任务边界不清
多个子任务会写同一批文件
用户只是问一个解释性问题
```

### 8.3 Agent 类型

推荐内置：

```text
main agent       面向用户，负责总控
research agent   只读调研
worker agent     实现改动
verifier agent   独立验证
reviewer agent   找风险和回归
remote agent     在远端环境运行
```

### 8.4 子 Agent 的上下文隔离

子 Agent 不应默认继承全部上下文。

它应该拿到：

```text
自包含任务说明
必要文件路径
相关背景
允许工具
权限模式
输出要求
```

它不应该拿到：

```text
完整主对话
无关用户隐私
主 agent 的所有中间思考
不属于该任务的文件内容
```

除非是 fork 型 agent，才考虑继承完整上下文。

---

## 9. Artifact Store：产物系统

### 9.1 为什么需要 Artifact

长输出和真实交付物不能都塞进聊天。

Artifact 应保存：

```text
测试日志
构建输出
patch
计划文件
报告
截图
长命令输出
远端任务结果
```

### 9.2 Artifact 进入上下文的方式

```text
短 artifact：直接摘要进入上下文
长 artifact：只拼摘要、路径、关键片段
可复现 artifact：只拼命令和引用
关键失败 artifact：拼错误核心和路径
```

---

## 10. 模块间调用关系

完整流程如下：

```text
UserInput
  -> SessionManager 创建或恢复 session
  -> ContextEngine 收集上下文
  -> ToolRegistry 装配工具
  -> ModelGateway 调模型
  -> ToolExecutor 接收 tool calls
  -> PolicyEngine 判断 allow/deny/ask
  -> HumanApproval 可选介入
  -> SandboxRunner 可选包裹执行
  -> Tool 执行
  -> ArtifactStore 保存长输出
  -> MessageStream 记录结果
  -> StateStore 更新状态
  -> Compactor 判断是否压缩
  -> Loop 下一轮
```

---

## 11. MVP 落地顺序

如果你要复刻，不要一次做完整 Claude Code。

建议顺序：

```text
Phase 1: 单 Agent 主循环
  - Session
  - MessageStream
  - Tool interface
  - Read/Search/Shell/Edit
  - Permission default/plan

Phase 2: 上下文系统
  - Project rules
  - Git status
  - Tool result summarization
  - Context budget
  - Compact summary

Phase 3: Plan 系统
  - EnterPlan
  - Plan file
  - Approval
  - Execute from plan

Phase 4: 安全治理
  - read-before-write
  - stale check
  - allow/deny/ask rules
  - sandbox
  - file history

Phase 5: 任务系统
  - background task
  - subagent
  - verifier
  - task notification

Phase 6: 扩展生态
  - MCP/plugin
  - memory
  - remote session
  - scheduled task
```

---

## 12. 关键设计原则

```text
1. 模型不是系统，模型只是决策器。
2. 上下文不是 prompt，而是分层装配的信息包。
3. 工具不是函数，而是带权限和状态影响的 runtime capability。
4. 错误不是异常，而是下一轮判断的观察结果。
5. Plan 不是文本，而是可审批、可恢复、可执行的对象。
6. Memory 不是历史记录，而是长期稳定知识。
7. Compact 不是丢上下文，而是把长会话变成可继续执行的摘要。
8. Permission 不是弹窗，而是行动治理系统。
9. Task 不是消息，而是可跟踪、可取消、可恢复的运行单元。
10. Artifact 不是附件，而是任务事实和交付物的持久化载体。
```

---

## 13. 最终抽象

一个 Claude Code 式通用 Agent 框架可以定义为：

```text
Agent Runtime =
  Context Engine
+ Tool Runtime
+ Control Loop
+ Policy Engine
+ State Store
+ Plan System
+ Memory / Compaction
+ Task Orchestrator
+ Artifact Store
+ Human-in-the-loop Protocol
```

它解决的不是“让模型回答得更好”，而是：

```text
让一个自然语言目标，在真实环境里被持续、受控、可验证地推进。
```
