
从 Agent 范式出发看：AI Coding 为什么会从 Cursor 走向 Claude Code

这篇文章是昨天写的，今天发出来，没想到下午就可以通过源码验证，确认整个框架和逻辑是完整且符合现实的，以下是基于源码和上述文章框架的完整验证文章。

阅读此篇之前，最好先读过上面那篇文章，以及，这篇文章有部分技术名词，不适合非工程师阅读，供参考。

0. 写在前面
这份文档不是对前 11 章专题报告的简单拼接，而是一次重新组织后的整合版总稿。

它有三个目标：

沿用你原文的论证骨架，而不是另起一套叙事顺序
把前面分章得出的判断压回一条完整主线
用源码里的模块、状态和调用链，把“Claude Code 为什么更像 runtime”讲到工程层
本文主证据来自本地还原源码，核心目录包括：

claude-code-sourcemap-main/restored-src/src/query.ts
claude-code-sourcemap-main/restored-src/src/Tool.ts
claude-code-sourcemap-main/restored-src/src/tools.ts
claude-code-sourcemap-main/restored-src/src/context.ts
claude-code-sourcemap-main/restored-src/src/utils/queryContext.ts
claude-code-sourcemap-main/restored-src/src/utils/claudemd.ts
claude-code-sourcemap-main/restored-src/src/memdir/*
claude-code-sourcemap-main/restored-src/src/services/tools/*
claude-code-sourcemap-main/restored-src/src/services/compact/*
claude-code-sourcemap-main/restored-src/src/utils/permissions/*
claude-code-sourcemap-main/restored-src/src/utils/sandbox/sandbox-adapter.ts
claude-code-sourcemap-main/restored-src/src/tasks/*
claude-code-sourcemap-main/restored-src/src/tools/AgentTool/*
claude-code-sourcemap-main/restored-src/src/remote/*
claude-code-sourcemap-main/restored-src/src/bridge/*
为了避免把推断和事实混在一起，本文采用两个表述层级：

“源码显示 / 代码里直接能看到”表示有明确模块证据
“因此更像 / 可以理解为”表示基于源码结构做的系统级归纳
如果把整篇文章压成一句话，我现在会这样表述：

Claude Code 不是把“模型会写代码”再做强一点，而是把软件任务推进这件事，落成了一个带状态、带工具协议、带任务系统、带治理层、还能桥接远程执行面的工程 runtime。

1. 问题的真正切入点：不要把它理解成功能列表对比
如果只列功能，Claude Code 和很多强一点的 coding assistant 的确高度重叠：

读代码
改文件
跑命令
做计划
调试
跑测试
接外部工具
支持一定程度的后台和自动化
但源码最值得注意的，不是这些点能力本身，而是它们被怎样组织起来。

Claude Code 不是把这些能力分别做成几个 feature，然后放进一个聊天壳里。它的核心做法是：

先装配一个带规则的会话上下文
再装配一个受模式和权限裁剪的能力面
再用统一 query loop 组织模型推理、工具执行和反馈回流
再把长任务延展到 task、agent、background、remote、bridge 这些对象上
最后再用 permission、filesystem、sandbox、policy 把整条链约束住
也就是说，真正该比较的不是“有没有某个功能”，而是：

系统主对象是什么
默认运行结构是什么
执行中认知如何更新
长链路如何延续
风险如何治理
从这个角度看，Claude Code 的关键对象已经不再只是 prompt 或 editor action，而是：

session
message stream
tool runtime
task
agent
remote session
bridge worker
这就是为什么它更适合被理解成一种 software task runtime，而不是增强版编辑器助手。

2. 规划层：真正的差别，不在有没有 Plan Mode，而在 Plan 在系统里处于什么地位
从源码看，Claude Code 的 Plan Mode 不是一个“回答前先列计划”的文本功能，而是一个真正会改变运行时行为的模式切换。

相关链条非常清楚：

用户可以通过 /plan 进入
模型可以通过 EnterPlanModeTool 请求进入
进入后会调用 handlePlanModeTransition(...)
然后通过 prepareContextForPlanMode(...) 和 applyPermissionUpdate(..., { mode: 'plan' }) 把当前 session 切到 plan 权限模式
这意味着 plan 的工程本质不是“生成一段计划文本”，而是“让会话进入一个只读探索和方案设计优先的特殊状态”。

EnterPlanModeTool 返回的 tool_result 也不是一句简单提示。它会显式告诉模型：

现在应该探索代码库和设计方案
可以提澄清问题
当前阶段不要直接写或编辑文件
这是 read-only planning phase
这点很关键。很多系统的 planning 仍然只是模型自己“记得要先想一想”；Claude Code 则把这种约束硬化成了工具语义和权限模式。

另一方面，plan 在 Claude Code 里还是一个落盘对象，而不只是对话文本。src/utils/plans.ts 说明：

每个会话都会拿到 plan slug
主会话和 subagent 有各自 plan 路径
plan 可读、可恢复、可复制
/plan open 可以把 plan 文件直接交给外部编辑器
因此，Claude Code 的 planning 更像：

进入 planning mode
在 mode 中探索和积累方案
把方案存成可持久化工作对象
再通过 ExitPlanModeV2Tool 把 plan 带着审批状态、用户反馈和验证要求，转化为下一轮 implementation 起点
ExitPlanModePermissionRequest 进一步说明，退出 plan 时系统会直接构造新的初始消息，形如：

Implement the following plan: ...
如果有验证要求，追加验证提示
如果用户对 plan 有反馈，再追加 User feedback on this plan: ...
这就把 plan 从“前置说明”变成了“后续执行的控制输入”。

所以更准确的说法不是“Claude Code 也有 Plan Mode”，而是：

Claude Code 把 plan 做成了一个真正的运行时模式、持久化对象和实施入口，而不是一次性前置文案。

3. Coding Agent 的第一性任务：始终是理解代码对象
这一点你的原文判断是对的，只需要把它工程化表达得更细一点。

Claude Code 并没有跳过代码对象理解。恰恰相反，它在进入执行控制之前，仍然需要先形成对代码对象的基本视图。相关工具面很明确：

FileReadTool
GlobTool
GrepTool
条件启用的 LSPTool
MCP 资源读取工具
这些工具对应的对象包括：

文件内容
路径集合
文本匹配和符号线索
diagnostics 与语言服务信息
项目外部资源
但 Claude Code 的不同之处在于，它通常不会把“对象理解本身”做成主要工作面，而是把它做成进入动作选择的前提。

从 query.ts 和工具编排链看，系统更接近下面这条节奏：

并发做必要的读、搜、列举
在拿到足够世界模型后迅速决定下一步动作
动作执行后吃回新反馈
再根据新反馈重建局部对象理解
也就是说，Claude Code 并不是不重视代码对象，而是把对象理解看成服务于执行控制的在线世界模型。

这可以从工具并发策略看得更清楚。toolOrchestration.ts 会先区分：

并发安全工具
不可并发工具
通常读、搜、列举更容易被放进前者，编辑、写入、状态改变类动作更容易被放进后者。这个设计本身就说明系统默认的节奏是：

先快速建立对象视图
再进入串行修改和验证
因此，对 Claude Code 更准确的表述是：

它同样以理解代码对象为前提，但对象理解达到“够用”后，系统重心会快速切向执行控制与反馈吸收，而不是无限停留在表示层。

4. 真正的 Agent 分水岭：不是会不会 planning，而是有没有默认闭环
Claude Code 最重要的工程差异，确实不在“会不会先列计划”，而在“系统默认是否被实现成闭环”。

src/query.ts 是这件事最直接的证据。这个文件维护的不是一次 completion 调用，而是一整套跨迭代状态，包括：

messages
toolUseContext
turnCount
autoCompactTracking
pendingToolUseSummary
maxOutputTokensRecoveryCount
taskBudget
transition
这些状态已经说明 Claude Code 对“一轮任务”的理解不是：

用户输入
模型回答
结束
而是：

当前消息流
当前上下文前缀
当前可用能力面
工具执行结果
压缩与恢复状态
必要时继续下一轮
默认闭环的主链可以压成下面这条：

fetchSystemPromptParts(...) 装配上下文前缀
tools.ts 组装当轮能力面
query() 发起模型流式请求
模型产生 tool_use
toolOrchestration / StreamingToolExecutor 执行工具
工具结果转成 tool_result 写回消息流
query() 再次继续
直到达到终止条件、用户打断或任务转入其他承载对象
这就是“认知 -> 行动 -> 反馈 -> 认知更新”的工程版本。

更重要的是，这个闭环不是靠 prompt 暗示实现的，而是靠显式状态、统一工具协议和持续 query loop 实现的。

所以 Claude Code 和普通“长 prompt + 多工具”的差别，不是步数多少，而是：

工具结果是否被系统性地重新注入
会话是否被建模为可持续推进的状态机
执行是否天然带有恢复、压缩和继续机制
5. 最难的一环：不是拿到反馈，而是把反馈更新进模型
这部分如果严格按源码讲，应该把“更新模型”改成“更新下一轮推理可见的任务现实”。

Claude Code 并没有在会话中做权重更新，它做的是更工程化、也更可追踪的一件事：

把用户反馈、拒绝理由、批准意见、补充指令结构化
再把这些结构化结果回注为下一轮 query() 的消息输入
相关链条主要在：

PermissionPrompt.tsx
interactiveHandler.ts
PermissionContext.ts
ExitPlanModePermissionRequest.tsx
query.ts
比如权限反馈路径：

模型提出 tool_use
系统发起权限请求
用户在 PermissionPrompt 中选择允许或拒绝，并可附加文字反馈
PermissionContext.handleUserAllow(...) 把反馈写成 acceptFeedback
cancelAndAbort(...) 把拒绝理由写成拒绝消息
这些结果再被并回消息流，成为后续推理输入
Plan 审批路径更明显：

用户批准退出 plan mode
系统构造新的 implementation 起始消息
计划内容、验证要求、用户反馈、team/transcript 提示一起拼进这条新消息
新一轮实现 query 从这条消息开始
所以“反馈更新模型”的真正工程含义是：

不是模型被训练了
而是运行时上下文被改写了
这也是 Claude Code 比很多表面上也有 feedback UI 的系统更强的一点。因为它不是把反馈停留在界面层，而是把反馈转换成 query loop 能继续消费的结构化事实。

6. 真正的难点不只是模型推理，而是“反馈可挂载、可比较、可累积”
如果只会把用户反馈塞回一条文本消息，系统仍然容易失真。Claude Code 的强点在于，它让反馈挂载到多个具体对象上，而不是只漂浮在对话里。

源码里至少能看到四种不同挂载面：

挂到权限决策对象上
挂到 plan 退出后的新 initial message 上
挂到工具结果与拒绝消息上
挂到文件状态和环境现实上
前面三条比较直观，第四条更容易被忽略。

例如 FileWriteTool 和 FileEditTool 明确要求：

已有文件必须先读后写
文件若在读取后被外部修改，则需要重新读取
edit 必须校验旧内容、目标路径、权限和文件状态
这意味着环境本身也会成为反馈源。Claude Code 并不是简单把用户嘴里的反馈接回去，而是把文件系统、shell 输出、测试结果、diagnostics 等环境变化，一起变成下一轮必须面对的事实。

这使得反馈具备三种更强的性质：

可挂载：可以挂在 permission decision、tool result、plan initial message、文件状态上
可比较：系统能比较“现在的文件状态”与“之前读到的状态”是否一致
可累积：新的反馈会在消息流、任务状态、plan 文件、memory 或 compact 结果中留下轨迹
这也是为什么 Claude Code 的核心难点不只是“模型够不够聪明”，而是“系统能不能持续把新证据变成新约束”。

7. 从抽象到实现：一个更成熟的 Coding Agent 在 Claude Code 里长成了什么样
如果把 Claude Code 的系统主干压成最核心的工程结构，我会把它概括成七层。

7.1 第一层：上下文装配层
核心文件：

src/utils/queryContext.ts
src/context.ts
src/utils/claudemd.ts
这一层负责把每轮 query 的稳定前缀拼出来，包括：

系统提示
用户级与项目级规则
当前日期
环境相关上下文
getUserContext() 会把 claudeMd 等内容重新装进上下文，这也是为什么 CLAUDE.md 更像 instructions loader，而不是单纯记忆仓库。

7.2 第二层：能力装配层
核心文件：

src/tools.ts
src/commands.ts
这一层负责按当前模式、feature gate、环境和权限，组装可见能力面。Claude Code 的工具不是固定表，而是一个运行时动态池。

这层会决定模型此刻到底能看到：

文件工具
搜索工具
shell 工具
plan 工具
agent 工具
MCP 资源工具
team / message / task 工具
7.3 第三层：统一工具协议层
核心文件：

src/Tool.ts
这里最关键的是 ToolUseContext 和 ToolPermissionContext。

ToolUseContext 把真正参与执行的运行时对象统一了起来，包括：

工具和命令集合
getAppState / setAppState
abort controller
读文件缓存
file history / attribution 更新器
当前消息数组
UI 与任务相关回调
这说明 Claude Code 的工具不是孤立函数，而是共享同一运行环境的操作单元。

7.4 第四层：query loop 控制层
核心文件：

src/query.ts
src/QueryEngine.ts
这一层负责：

流式采样
工具调用检测
工具结果回流
autoCompact
microcompact
fallback
max output tokens 恢复
stop hooks 和中断处理
这一层是 Claude Code 的真正中枢，它把“回答”提升成了“持续推进”。

7.5 第五层：工具编排层
核心文件：

src/services/tools/toolOrchestration.ts
src/services/tools/StreamingToolExecutor.ts
这一层负责按并发安全性组织工具执行。

系统不是见到工具就执行，而是先判断：

哪些工具可以并行
哪些必须串行
流式工具怎样保持顺序和进度
某个并发分支失败时怎样取消 sibling
这是 Claude Code 能同时兼顾吞吐和一致性的关键。

7.6 第六层：连续性层
核心文件：

src/utils/plans.ts
src/memdir/*
src/services/compact/*
src/utils/fileHistory.ts
这一层负责把运行延长到更长时间尺度。它并不只是一套 memory，而是至少分成四类对象：

plan 持久化
typed persistent memory
conversation compact
file rewind / history
这也是为什么一定要把 CLAUDE.md、memdir、compact、rewind 分开理解。

7.7 第七层：任务系统与控制面
核心文件：

src/tasks/*
src/tools/AgentTool/*
src/coordinator/coordinatorMode.ts
src/remote/RemoteSessionManager.ts
src/bridge/*
这一层把 Claude Code 从“交互式代理”推进成了“带任务系统和远程控制面的 runtime”。

它管理的对象包括：

主会话任务
shell 任务
local / remote agent task
workflow task
in-process teammate task
remote session
bridge worker session
如果把这七层合起来看，Claude Code 就不再像“一个很能干的聊天框”，而更像一套软件任务运行平台。

8. 落到三个核心场景：代码修改、测试、debug
从源码看，这三个场景不是三套 feature，而是同一条运行时工具链的三种展开。

8.1 代码修改：核心不是 edit，而是 read-before-write
FileWriteTool 与 FileEditTool 都体现了同一原则：

先建立读视图
再确认文件状态仍然有效
最后才执行写入
已存在文件需要先读后写；若文件在读取后被外部改动，则必须重新读取。这种约束把“修改代码”从盲写变成了基于当前事实的受控更新。

另外，写前还会走 fileHistoryTrackEdit(...)，并更新外部感知链路，如 notifyVscodeFileUpdated(...)。这说明一次 edit 的结果并不止是文件变了，而是：

diff 变了
可回滚历史变了
IDE 或外部宿主可见状态变了
后续技能触发条件也可能变了
8.2 测试：核心支柱是 BashTool，而不是专门的 test runner abstraction
Claude Code 对测试场景的处理很务实。它并没有造一个语言绑定很深的测试框架层，而是让模型通过 BashTool 直接使用真实工程环境。

BashTool 负责：

命令执行
超时与取消
是否沙箱化
输出截断和预览
长任务背景化
结果展示与持久化
这让测试场景天然覆盖：

npm test
pytest
cargo test
自定义脚本
构建命令
调试辅助命令
也就是说，Claude Code 不是抽象地“支持测试”，而是把测试当成可回到真实 shell 世界中的标准动作。

8.3 Debug：没有单独的 DebuggerTool，而是围绕同一闭环持续收缩错误空间
调试通常由多种工具协同完成：

FileReadTool 看代码
GlobTool / GrepTool 搜索线索
BashTool 复现问题、看日志、跑测试
LSPTool 在可用时补足语言服务信息
FileEditTool / FileWriteTool 应用修复
query.ts 将新错误或成功结果回流给下一轮
Claude Code 的 debug 因此更像：

围绕真实错误反馈持续缩小问题空间
而不是：

切到一个独立的图形化 debugger 模式
8.4 rewind 与 compact：让长 debug 仍然可持续
这两套机制一定要分开。

fileHistory / rewind 处理的是：

代码状态怎样回到某个更早点位
compact / sessionMemoryCompact 处理的是：

对话上下文太长时怎样压缩成仍可继续的最小有效现场
前者回退代码现实，后者压缩会话现实。两者一起，才能让长时间 debug 不至于越跑越乱。

9. 记忆：长链路闭环成立的前提，是记忆分层而不是尽量别忘
Claude Code 的记忆层是最容易被讲混的一块。源码表明，它至少要分成三层来理解。

9.1 第一层：CLAUDE.md 指令层
这层由 getUserContext() 和 getClaudeMds(...) 驱动，本质更接近多层 instructions/context hierarchy。

加载范围包括：

managed memory
user memory
project memory
local memory
.claude/rules/*.md
@include 与 frontmatter 限制
这层的职责不是“长期存事实”，而是“每轮开头都把稳定行为规则重新装入上下文”。

9.2 第二层：memdir 持久记忆层
memdir 才是 Claude Code 真正意义上的 typed persistent memory。

核心特征包括：

有专门目录
以 MEMORY.md 为索引入口
memory 被限制在明确 taxonomy 中
典型类型有 user、feedback、project、reference
更重要的是，它对“不该存什么”也写得很明确：

代码结构和架构不该乱存成 memory
当前任务细节不该乱存成 memory
plan 应该存 plan，不该伪装成 memory
这说明 Claude Code 对长期记忆的边界有很强自觉。

9.3 第三层：compact 会话压缩层
这一层处理的是当前会话太长怎么办。

compact.ts 和 sessionMemoryCompact.ts 会考虑：

tool_use / tool_result 对怎样保真
哪些 text block 必须保留
preserved tail 怎样维持 API 不变量
压缩后怎样继续下一轮 query
因此，compact 的目标不是“长期记住事实”，而是“在当前会话里继续跑下去”。

9.4 为什么这三层必须分开
如果把这三层混成一套“记忆系统”，会直接误读 Claude Code 的设计重点。

更准确的说法是：

CLAUDE.md 解决的是稳定规则注入
memdir 解决的是跨会话可迁移的非代码知识
compact 解决的是长会话续跑
这三者都是 persistence，但 persistence 的对象、时机和边界完全不同。

10. 治理：闭环越强，治理越不是外围模块，而是核心结构
Claude Code 的治理不是外层加个确认框，而是贯穿整条执行链的多层控制面。

源码里至少能明确分出四层：

组织级策略层
会话级权限决策层
文件系统保护层
沙箱执行层
10.1 组织级策略层
src/services/policyLimits/index.ts 会从 API 拉取 policy restrictions，并用这些 restrictions 来禁用 CLI feature。API 失败时选择 fail-open，而不是彻底停机。

这说明 Claude Code 接受“治理来自远程组织策略”这件事，同时也优先保留可用性。

10.2 会话级权限决策层
permissions.ts 和 Tool.ts 共同定义了：

permission mode
allow / deny / ask
工具级决策上下文
也就是说，某个工具能否执行，并不是工具运行后再补救，而是在 invocation 之前就先决定。

10.3 文件系统保护层
filesystem.ts 会对许多高风险路径做专门保护，例如：

.gitconfig
shell rc
.mcp.json
.claude.json
.git
.vscode
.idea
.claude
.claude/settings*.json
.claude/skills
.claude/agents
.claude/commands
这层保护的不是普通业务文件，而是那些一旦被自动修改，就可能扩大代理权限、改变执行环境、修改宿主配置的区域。

10.4 沙箱执行层
sandbox-adapter.ts 会把 Claude Code 自己的 permission rules 和 settings，下沉成真正可执行的 sandbox 配置，包括：

filesystem allow / deny
network allow / deny
高风险目录的 OS 级阻断
Claude Code 路径语义与 sandbox-runtime 路径语义的转换
这说明治理不是停在产品层，而是被继续下沉到了宿主执行层。

从产品逻辑上看，Claude Code 的治理不只是“执行前问你一次”，而是：

先决定哪些能力可见
再决定某次调用是否允许
再决定某些路径是否必拦
最后即使到了 shell，也还要接受 sandbox 的底层限制
这也是为什么闭环越强，治理越不能是外围装饰。

11. 为什么深度 Agent 的终点更像“软件任务操作系统”
“更像 runtime”不是夸张比喻，而是源码里确实已经实现出几类 runtime 基础设施。

11.1 统一状态容器
ToolUseContext 已经不是普通函数参数，而是跨工具、跨回合、跨 UI 生命周期共享的执行上下文。这里面既有当前消息，也有 app state、缓存、任务回调和中断控制。

这更像运行时状态容器，而不是一次工具调用参数包。

11.2 任务系统
src/tasks/types.ts 清楚定义了多种 task state：

LocalAgentTaskState
RemoteAgentTaskState
LocalWorkflowTaskState
LocalShellTaskState
InProcessTeammateTaskState
MonitorMcpTaskState
DreamTaskState
连主会话本身也可以被 background 成 LocalMainSessionTask。这已经脱离了“单回合聊天”范畴，进入了“任务生命周期管理”范畴。

11.3 多 agent 调度
AgentTool.tsx 和 runAgent.ts 表明 subagent 在系统里是被真正注册、跟踪和回收的运行实体，而不是 prompt trick。

它们具有：

独立 agentId
独立 transcript
前后台状态
进度通知
sidechain 消息继续输入
而 coordinatorMode.ts 又把系统切成 coordinator 和 worker 两个平面。这说明 Claude Code 已经显式地区分：

orchestration plane
execution plane
11.4 远程会话与桥接控制面
RemoteSessionManager.ts 负责：

WebSocket 订阅
HTTP 发送用户消息
permission request / response
viewerOnly 和重连
bridgeMain.ts 与 sessionRunner.ts 负责：

pulling work
child process session
heartbeat
reconnect
permission forwarding
session activity extraction
这意味着 Claude Code 的执行已经可以跨出当前本地 TTY，扩展到远程 session 和 bridge worker。

从系统抽象上看，Claude Code 已经具备：

状态容器
任务系统
agent 调度
控制面
远程执行桥接
这也是为什么把它理解成“软件任务操作系统”虽然仍是归纳表述，但已经有很强的源码支撑。

12. 有效性边界与代价：更像 Agent，不等于总是更优
Claude Code 的强项非常明确，但代价也一样明确。

12.1 第一条边界：上下文预算永远是硬约束
query.ts、tokenBudget.ts、compact.ts 一起说明：

blocking limit
autoCompact
reactive compact
snip
microcompact
max output tokens recovery
这些都在告诉我们一件事：即使系统做成 runtime，它最终也还是被模型上下文窗口约束。

也就是说，Claude Code 不是无限续航，而是努力把长任务压缩回仍可继续的窗口内。

12.2 第二条边界：大结果不可能一直留在主上下文里
toolResultStorage.ts 会对大结果做阈值判断、磁盘持久化、预览化回注和清理。

这让系统可以处理真实工程输出，但代价是：

模型未必总在主上下文里看到完整原始结果
若要重新精读，往往需要显式再读一次外置结果
12.3 第三条边界：治理越强，摩擦越大
permission、filesystem、sandbox、policy limits 会提高可控性，也会增加：

模式切换成本
审批摩擦
环境不一致性
用户理解成本
Claude Code 因为想做真实执行，所以必须承担这些摩擦。

12.4 第四条边界：任务系统与多 agent 提高吞吐，也提高心智负担
一旦系统支持 background、subagent、remote、bridge，用户就必须理解：

现在谁在执行
哪条结果对应哪个 task
哪些状态在前台，哪些在后台
哪些 permission request 来自主会话，哪些来自子代理
这不是偶然复杂，而是 runtime 化后的结构性成本。

12.5 第五条边界：动态装配使行为更灵活，也更难静态预测
feature gate、mode-dependent tool assembly、policy filtering、local/remote 分支、不同构建类型，这些都意味着 Claude Code 的实际能力面不是一成不变的。

这对产品演进是优点，对研究者和用户理解则是代价。

所以 Claude Code 最强的任务，通常是那类：

需要多轮推进
必须调用真实环境
允许试错和恢复
用户能接受控制面存在
反过来，对那类轻量、即时、低摩擦、一次性问答式的任务，它并不天然占优。

13. 对整个问题的最终判断
如果把这篇文章和前面 11 章源码报告一起压成最终判断，我会给出下面这版更完整的结论。

Claude Code 所代表的变化，并不是“终端替代编辑器”这么简单，也不是“模型更强”这么简单。它真正改变的是 AI Coding 系统的主对象、主能力和主控制结构。

它把系统中心从：

帮助人更快完成局部代码编辑
推进到了：

帮助系统在真实工程环境中持续推进软件任务
这个变化之所以成立，不是因为它多了某一个爆款 feature，而是因为源码里已经能看到一整套彼此咬合的基础设施：

Plan Mode 被做成运行时模式切换，而不是前置文本
对代码对象的理解被做成进入动作循环的在线世界模型
query loop 把理解、动作、反馈和继续执行串成默认闭环
用户反馈和环境反馈被结构化回注到下一轮推理
修改、测试、debug 被压进同一工具链和同一恢复机制
CLAUDE.md、memdir、compact 被拆成不同 persistence 层
permission、filesystem、sandbox、policy limits 被做成多层治理
task、agent、coordinator、remote session、bridge 把系统推向带控制面的 runtime
因此，如果要给 Claude Code 一个最准确、同时又尽量贴近源码的定义，我会这样写：

Claude Code 是一套围绕软件任务持续推进而设计的 coding agent runtime。它的核心不只是模型生成能力，而是把上下文装配、能力装配、工具协议、执行闭环、反馈回流、持久化分层、权限治理和任务控制面组织成了一个可运行、可继续、可恢复、可受控的工程系统。

如果再压成一句话，那就是：

Claude Code 的真正突破，不是“更会写代码”，而是“把 AI Coding 从一次性回答，推进成了受控的软件任务运行过程”。

14. 一条最短总调用链
最后，用一条最短调用链把整件事再压一次：

用户输入进入 session
queryContext、context、claudemd 装配稳定上下文前缀
tools.ts、commands.ts 组装当轮能力面
ToolUseContext 把运行时状态收拢成统一容器
query.ts 发起流式推理
模型产出文本或 tool_use
toolOrchestration / StreamingToolExecutor 执行工具
权限、文件系统、sandbox、policy 在关键节点拦截和裁剪
工具结果、用户反馈、环境反馈重新写回消息流
若任务变长，则转入 compact、task、agent、background、remote、bridge 等延展机制
系统继续循环，直到完成、失败、打断或升级介入
这 11 步加在一起，就是 Claude Code 的完整产品逻辑和工程技术逻辑。