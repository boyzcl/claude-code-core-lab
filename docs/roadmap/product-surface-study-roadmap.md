# Product Surface Study Roadmap：Claude Code 产品表层学习路线

本文是 Core 26 之后的新阶段总控文档。它先回答一个更重要的问题：

```text
从 Claude Code 的真实产品工件、分发物、运行提示词和官方文档中，
哪些东西应该补回已有课程，
哪些东西才值得独立成新的 Core？
```

本阶段暂不直接承诺 Core 27 到 Core N。先做归位，再做实现。

---

## 1. 为什么要有这个阶段

Core 01-26 已经把学习版核心运行时做成一条可验证链路：

```text
模型请求
工具执行
上下文
计划
压缩
评测
真实仓库测试夹具
参考运行和成本边界
生产化升级证据链
```

现在可以继续研究 Claude Code 更真实的产品表层：

```text
系统提示词如何装配？
工具定义和 deferred tools 如何暴露？
settings / permission / hooks 如何进入运行时？
memory / CLAUDE.md / auto memory 如何成为上下文来源？
slash command / skill / subagent / MCP 如何扩展工具表面？
checkpoint / rewind 如何让用户看见可恢复状态？
输出风格如何从审美要求变成信息带宽控制？
```

这些材料来自不同证据层，不能混用：

| 层级 | 材料 | 本阶段用法 |
| --- | --- | --- |
| A | 官方文档、SDK、CLI 帮助、公开 preset 说明 | 可以公开引用，作为能力和接口边界依据 |
| B | Claude Code 分发物、source map、运行材料中抽取出的结构 | 可以学习机制，转译成我们自己的对象模型和验证 |
| C | 第三方版本 diff、提示词历史整理、社区观察 | 只能作研究线索，进入文档前要标注来源层级 |
| D | 本项目自己的抽象、实现和 verify | 只能声称本项目已经验证的能力 |

本阶段不会把 B/C 层材料直接写成“官方公开源码”或“官方公开系统提示词”。公开项目里沉淀的是：

```text
机制抽象
对象模型
验证矩阵
我们自己写的实现
边界说明
```

---

## 2. 核心原则：同主题优先合并

新增模块前必须先问：

```text
它是不是已有主题的补充？
它有没有新的 Runtime 状态？
它有没有新的 Policy / Tool / Context / Session 边界？
它能不能写出独立 verify case？
学习者如果在旧课程里学，会不会更连贯？
```

判定规则：

| 情况 | 处理方式 |
| --- | --- |
| 只是解释已有机制的新证据 | 补入已有 course / core 文档 |
| 只是提示词写法或产品文案原则 | 补入 Course 03 或教学规范，不独立成 Core |
| 引入新的状态、配置优先级、权限决策或工具生命周期 | 可以候选独立 Core |
| 需要新的可执行 fixture 和 verify 才能证明 | 可以候选独立 Core |
| 只是第三方材料中的原文差异 | 不进入实现；只提炼规则类别 |
| 与 Core 18-26 的能力高度重叠 | 优先补充 Core 18-26 教学，不另起炉灶 |

一句话：

```text
同主题在同一课程里学；只有新边界才新建 Core。
```

---

## 3. 主题归位表

| 研究主题 | 先归入哪里 | 是否独立 Core | 原因 |
| --- | --- | --- | --- |
| Prompt Assembly / system-reminder / startup context | Course 03、Course 08、Core 08 | 候选 | 如果只讲提示词结构，补旧课；如果实现分段装配、来源标注、优先级和注入隔离，可独立 |
| 工具优先级：专用工具优先于 Bash | Course 02、Course 10、Core 22 | 暂不独立 | 这是动作选择和 ToolRuntime 策略，先补已有主题 |
| Deferred Tools / tool surface registry | Course 08、Core 23、Core 26 | 候选 | 如果实现按上下文暴露工具、能力登记、延迟工具列表，可独立 |
| Settings / permission modes / permission rules | Core 22、Core 26 | 候选 | 配置优先级和权限解析是新 Runtime 边界，可能需要独立 verify |
| Hooks lifecycle | Core 24、Core 26 | 候选 | hooks 会把外部脚本反馈变成运行时事件，若实现生命周期和阻断语义，可独立 |
| CLAUDE.md / auto memory / memory types | Course 08、Course 09、Core 18、Core 19、Core 24 | 候选 | 记忆同时涉及上下文来源、持久化、过期校验和删除语义，可能独立 |
| Subagent / Explore agent / context isolation | Core 21、Core 25 | 候选 | 子代理有独立上下文和结果压缩；若只是教学说明，先补长任务和 repo intelligence |
| Slash command / skill expansion | Course 03、Core 23、Core 26 | 暂不独立 | 先作为 prompt/tool surface 的输入形态；只有实现命令展开和权限继承时再独立 |
| MCP / external tool integration | Core 23、Core 26 | 暂缓 | 范围容易过大；先记录接口边界，不做 marketplace |
| Checkpoint / rewind | Core 24、Core 22 | 候选 | 如果只是 replay 教学，补 Core 24；若实现用户可见 rewind 和文件状态恢复，可独立 |
| Output style / concise updates | Course 00、Course 03、README | 不独立 | 属于教学和提示词治理，不是 Runtime 新边界 |
| 高风险操作分级 | Core 22、Core 26、open-source boundary | 暂不独立 | 已有审批和事务基础，先补风险分类表 |
| Fast mode / model metadata | Core 23 | 不独立 | 属于 ModelGateway provider capability / model selection 信息 |
| Cron / detached automation | Core 24、Core 26 | 暂缓 | 涉及异步任务和调度，除非明确要做自动化运行时 |

---

## 4. 推荐阶段结构

本阶段分三步，不直接拆成一串新 Core。

### Step A：补充已有课程

优先补这些文档：

```text
Course 00：证据层级、B/C 层材料使用规则、不要把提取原文当公开官方文档。
Course 03：Prompt Pack 从“自写提示词”升级为“prompt assembly / prompt governance”。
Course 08：ModelGateway 与 Context Engine 加入 startup context、system-reminder、tool definitions 的装配位置。
Course 09：Compaction 与 memory 的边界，区分当前计划、长期记忆、压缩摘要。
Course 15-17：把产品表层特性连接回 Core 18-26 的生产化链路。
```

这一步不新增 Core，只修正教学连续性。

### Step B：做独立性评审

每个候选主题必须写一页 mini brief，回答：

```text
它补的是哪个已有主题？
为什么不能只补旧文档？
新增的 Runtime 状态是什么？
新增的强制边界是什么？
最小 verify case 是什么？
out of scope 是什么？
```

没有通过 mini brief 的主题，不进入 Core。

### Step C：只选择少数独立 Core

如果 Step B 通过，最多先选 3 到 5 个 Core：

```text
候选 Core A：Settings / Permission Resolver
候选 Core B：Hooks Lifecycle
候选 Core C：Memory Source / CLAUDE.md / Auto Memory
候选 Core D：Subagent Context Isolation
候选 Core E：Checkpoint / Rewind
```

暂不把 slash command、output style、fast mode、MCP marketplace 单独立 Core。

---

## 5. 和 Core 18-26 的关系

Product Surface Study 不是推翻 Core 18-26，而是把真实产品表层往已有链路上接：

```text
Prompt Assembly -> Context / ModelRequest / Prompt Pack
Settings -> Policy / ToolRuntime / Human Approval
Hooks -> Session / Event Log / Human Feedback
Memory -> Context / Compaction / Durable Session
Subagent -> Long-Running Eval / Repo Intelligence / Context Economy
Checkpoint -> Tool Transaction / Durable Replay
Output Style -> Teaching Standard / Prompt Governance
```

如果某个主题无法明确接到这条链上，就先不做。

---

## 6. 公开边界

可以公开沉淀：

```text
证据层级说明。
机制分类。
对象模型。
验证矩阵。
我们自己写的代码和测试。
不含原文的规则摘要。
```

不公开沉淀：

```text
第三方提取的 Claude Code system prompt 原文。
反编译源码片段。
可还原私有实现的代码结构。
真实账号、token、路径、日志。
把 B/C 层材料写成“官方公开源码”的说法。
```

可以这样表达：

```text
本阶段研究 Claude Code 真实产品工件所暴露出的机制类别，并把它们转译为本项目自己的运行时设计和验证。
```

不要这样表达：

```text
本阶段复刻 Claude Code 官方源码和官方系统提示词。
```

---

## 7. 完成定义

Product Surface Study 的阶段准备完成，必须满足：

```text
1. 本 roadmap 存在，并明确合并/独立规则。
2. 对应 validation matrix 存在。
3. docs/index.md、docs/authority-map.md、CURRENT_STATE.md 已登记。
4. 至少完成 Step A 的课程补充计划。
5. 每个候选 Core 都经过 mini brief，不凭直觉新增。
6. 所有文档不包含提取 prompt 原文或反编译源码片段。
7. git diff --check 通过；若更新验证链路，再运行 npm run verify:all。
```

---

## 8. 下一步

当前阶段准备已经完成：

```text
Product Surface Validation Matrix 已创建。
Course 00 / Course 03 / Course 08 / Course 09 / Course 15-17 已补充产品表层材料归位规则。
候选 Core A-E 已写入 Product Surface Core Candidates mini brief。
docs/index.md、docs/authority-map.md、CURRENT_STATE.md 已登记。
Core 27 Settings / Permission Resolver 已实现第一个 Product Surface Core，并验证它不重复 Core 22 / Core 26。
Core 28 Hooks Lifecycle 已实现第二个 Product Surface Core，并验证它不重复 Core 24 / Core 26。
Core 29 Memory Source / CLAUDE.md / Auto Memory 已实现第三个 Product Surface Core，并验证它不重复 Course 08 / Course 09 / Core 18 / Core 19 / Core 24。
Core 30 Checkpoint / Rewind 已实现第四个 Product Surface Core，并验证它不重复 Core 22 / Core 24。
Core 31 Subagent Context Isolation 已实现第五个 Product Surface Core，并验证它不重复 Core 21 / Core 24 / Core 25。
```

当前候选池 A-E 已完成。下一步不是继续追加一串 Core，而是收口 Product Surface Study 的阶段记录；未来只有出现新的 Runtime boundary、verify shape 和 public-safe mini brief 时，才进入新的候选评审。

推荐先做：

```text
1. 保持 Core 27-31 的 course -> lab -> core 命名和导航一致。
2. 继续把 Product Surface 材料先归位到 roadmap / validation matrix / candidate mini brief。
3. 新候选必须先确认 same-topic merge、runtime boundary、verify shape 和 public boundary。
4. 不使用提取 prompt 原文、source map 原文或反编译源码片段。
5. 通过 focused verify、npm run verify:all 和 git diff --check 后再更新阶段状态。
```
