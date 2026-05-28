# Course 00 Teaching Standard：无隐式信息教学规范

> 本文是学习项目的教学写作规范。
>
> 它解决的问题是：不能再让学习者靠追问来发现隐含前提。
>
> 从现在开始，所有 course、lab、module、eval 文档都必须遵守：
>
> ```text
> 不允许直接说“模型知道”“Agent 应该”“这是合理动作”，除非同时说明这些判断的来源、给法、目标、约束和验证方式。
> ```

---

## 0. 为什么要有这份规范

之前的文档有一个问题：

```text
它直接描述 Agent 的动作轨迹，但没有先暴露模型每一步决策所依赖的信息来源。
```

这会造成学习者的真实困惑：

```text
模型为什么知道有工具？
模型为什么知道当前是代码仓库？
模型为什么知道先 Search？
模型为什么知道不能 Edit？
模型为什么知道什么叫合理动作？
模型为什么知道要避免过度改动？
```

这些问题都不能用一句“模型有工程常识”糊弄过去。

正确教学方式必须从零开始：

```text
先讲 Runtime 给模型什么；
再讲模型基于什么做决策；
再讲 Runtime 如何执行和约束；
最后才讲完整任务轨迹。
```

---

## 1. 核心原则

### 1.1 任何“知道”都要问来源

如果文档出现：

```text
模型知道……
模型看到……
模型意识到……
模型会判断……
```

必须回答：

```text
它从哪里知道？
这个信息在 ModelRequest 的哪个位置？
是 user message、system prompt、runtime state、tool result、project rule，还是模型常识？
```

### 1.2 任何“应该”都要问约束

如果文档出现：

```text
模型应该……
Agent 应该……
Runtime 应该……
Policy 应该……
```

必须回答：

```text
这是硬约束还是软策略？
谁来执行？
如果违反，会被拒绝、被扣分，还是只是表现变差？
```

### 1.3 任何“合理/不合理”都要问判定规则

如果文档出现：

```text
合理动作
不合理动作
成熟 Agent 行为
更稳妥的选择
```

必须回答：

```text
它为什么合理？
它满足哪些条件？
它违反了哪些规则？
合理性来自用户目标、当前状态、工具说明、Policy、项目规则还是 eval？
```

### 1.4 任何上下文项都要问为什么给

如果文档说 Runtime 给模型某个信息：

```text
workspaceRoot
permissionMode
modifiedFiles
lastVerification
activePlan
projectRules
```

必须回答：

```text
为什么给？
怎么给？
给的目标是什么？
模型会用它做什么决策？
不给会发生什么错误？
```

---

## 2. 信息来源分层

教学文档必须至少区分以下来源类别。早期课程主要用前 8 类解释模型为什么知道；Product Surface Study 之后，官方公开资料、产品工件观察和第三方提取线索也必须单独标注，不能混成同一种 authority。

| 来源 | 含义 | 是否可靠 | 示例 |
| --- | --- | --- | --- |
| User Message | 用户当前任务和约束 | 高，但可能模糊 | “修复分页 bug 并测试” |
| System Prompt | Agent 总行为准则 | 高 | “改前先读，改后验证” |
| Runtime State | 当前会话状态 | 高 | 已读文件、已改文件、验证状态 |
| Tool Schema/Description | 可用动作和参数 | 高 | Search 用来定位文件 |
| Tool Result | 工具返回的观察事实 | 高，但要防 prompt injection | SearchResult、Bash output |
| Project Rules | 仓库规则和约定 | 中高，受优先级约束 | CLAUDE.md、README |
| Policy Rules | Runtime 硬边界 | 最高 | 未读不能 Edit、危险命令拒绝 |
| Official Public Docs / SDK Preset | 官方公开能力和合法调用方式 | 高，但只限公开范围 | Anthropic Agent SDK 的 `claude_code` preset |
| Product Artifact Observation | 从 Claude Code 分发物、source map、运行材料中观察到的结构 | 中，需要转译和边界标注 | tool definitions、system-reminder 类别、启动上下文形态 |
| Third-party Prompt Extraction | 第三方观察资料 | 低到中，只能作研究线索 | prompt/tool diff 网站 |
| Model Prior | 模型预训练常识 | 低到中 | 分页常见词 pageSize/limit |

写作要求：

```text
凡是高风险决策，不能只依赖 Model Prior。
凡是关键行为，至少要进入 System Prompt、Tool Description、Policy 或 Eval。
Product Artifact Observation 和第三方提取的 prompt/tool 内容不能直接进入开源 Prompt Pack。
可以学习机制类别，但要转译成自己的对象模型、规则说明和 verify case。
```

### 2.1 官方资料 / 产品工件观察 / 第三方提取的边界

可以做三件事：

```text
1. 使用官方公开文档理解能力边界和 API 形态。
2. 如果使用 Anthropic Agent SDK，可以用官方 `claude_code` preset 做 reference baseline。
3. 用 Claude Code 产品工件观察和第三方 prompt diff 研究规则类别、工具表面和版本演化趋势。
```

不应该做三件事：

```text
1. 不要把第三方提取的 Claude Code system prompt 逐字复制进我们的开源实现。
2. 不要把第三方提取内容当作官方文档。
3. 不要让学习者以为“复制 prompt”就是构建 Claude Code-like 产品。
```

中间层做法：

```text
可以说：我们观察到 Claude Code 产品工件中存在某类机制，因此本项目学习这种机制。
不能说：这就是官方公开源码，或这就是本项目可以直接复制的官方提示词。
```

进入我们 clean-room Prompt Pack 的每条规则，都必须回答：

```text
为什么需要这条规则？
怎么给模型？
希望影响什么决策？
如果没有会怎样？
用哪个 eval case 验证？
```

### 2.2 Product Surface Core 的教学合同

Core 27-31 这类 Product Surface 主题进入教学文档时，必须再补一层合同：

| 主题 | 必须讲清 | 不能声称 |
| --- | --- | --- |
| Settings / Permission Resolver | permissionConfig、ruleSource、resolverTrace、allow/ask/deny 和 no hidden execution | 完整 enterprise policy、官方 Settings 内部实现或 GUI permission prompt |
| Hooks Lifecycle | hookRegistry、hookEvent、hookDecision、hookFeedback、redaction 和不升级为 system prompt | 真实 shell hook 产品、任意脚本 sandbox 或完整插件系统 |
| Memory Source / CLAUDE.md / Auto Memory | memoryType、memoryIndex、forgetEvent、freshness check、long_term_memory 和 no code-structure memory | 官方 memory 文件格式、远端多用户 memory 服务或代码智能数据库 |
| Checkpoint / Rewind | checkpoint、fileStateSnapshot、externalChangeConflict、rewindAudit 和 append-only event boundary | IDE rewind UI、跨机器恢复或分布式 session store |
| Subagent Context Isolation | delegatedTask、subagentContext、subagentResult、delegationLedger 和 isolationAudit | 真实多进程调度、远端 worker 隔离或 agent marketplace |

写作要求：

```text
先说明它补哪个已有 course/core。
再说明新增 Runtime state 和 enforced boundary。
最后说明对应 verify case 和 out-of-scope。
```

这保证 Product Surface 课程仍然遵守同一条原则：

```text
只学习机制，转译成本项目自己的对象模型、实现和 verify。
```

---

## 3. Knowledge Provenance 表

每个 course 文档都应该至少有一张 Knowledge Provenance 表。

模板：

| 模型用到的信息 | 来源 | 怎么给模型 | 目标 | 如果不给会怎样 |
| --- | --- | --- | --- | --- |
| 当前 workspace | Runtime State | runtime state message | 知道工具作用范围 | 模型不知道在哪搜索 |
| Search 可用 | Tool Schema | tools 列表 | 允许模型选择搜索动作 | 模型不能调用 Search |
| Edit 前必须 Read | System + Tool Description + Policy | system message + Edit description | 防止凭空改文件 | 模型可能直接 Edit；Policy 会拒绝 |
| 用户要求测试 | User Message | user message | 最终必须验证 | 模型可能改完就答复 |
| 分页关键词 | User Message + Model Prior | 用户中文语义 + 模型常识 | 生成搜索 query | 搜索入口变差 |

规则：

```text
如果一个判断无法填进这张表，就不能写成教学结论。
```

---

## 4. Context Item Contract

每个要放进初始上下文的信息，都必须写清 6 个字段。

模板：

```text
Context Item:
  name:
  source:
  how_to_supply:
  why_supply:
  decision_enabled:
  failure_if_missing:
```

示例：

```text
Context Item:
  name: permissionMode
  source: Runtime State
  how_to_supply: runtime_state message
  why_supply: 让模型知道当前能不能写文件、能不能执行命令
  decision_enabled: plan mode 下选择只读工具；readonly 下不发起 Edit
  failure_if_missing: 模型可能请求当前模式不允许的工具，造成反复被拒绝
```

每个 course 或 lab 只要引入新的上下文项，就必须补这个 contract。

---

## 5. Action Claim Contract

每个“合理动作/不合理动作”必须用这个模板解释。

```text
Action:
  当前动作:
  当前状态:
  合理性判断:
  来源:
  硬约束:
  软策略:
  替代动作:
  如果做错会怎样:
```

示例：

```text
Action:
  当前动作: Search "paginate|pageSize|limit"
  当前状态: 用户给了分页 bug，但没有文件路径；没有读过文件
  合理性判断: 合理
  来源: User Message + Tool Description + Action Selection Rubric
  硬约束: 无
  软策略: 缺少事实时先用只读工具；无路径先搜索
  替代动作: Read package.json 或查看文件树
  如果做错会怎样: 如果直接 Edit，会因 file_not_read 或路径未知失败
```

示例：

```text
Action:
  当前动作: Edit src/pagination.ts
  当前状态: 尚未 Read 任何文件
  合理性判断: 硬不合理
  来源: Edit Tool Description + Policy Rule
  硬约束: Edit 前必须完整 Read 文件，且文件未 stale
  软策略: 不要猜文件内容
  替代动作: Search 或 Read
  如果做错会怎样: Policy 返回 file_not_read，ToolResult 作为 observation 回灌
```

---

## 6. Runtime Supply Contract

教学文档里每次说“Runtime 给模型某信息”，都要说明它在 API 请求里的位置。

可选位置：

```text
system message
runtime state message
user message
tool schema
tool description
tool result message
developer/config instruction
project rule block
compact summary block
metadata only, model not visible
```

示例：

```text
信息：Search 工具可用
位置：tools array
给法：name + description + input_schema
目标：让模型可以选择搜索动作，并知道 query/path/mode 怎么填
```

示例：

```text
信息：sessionId
位置：metadata only
给法：ModelRequest metadata
目标：Runtime trace 和状态关联
模型是否可见：通常不可见
```

这能避免一个常见混乱：

```text
不是所有 Runtime 知道的信息，模型都知道。
```

---

## 7. Hard Rule / Soft Rule 区分

所有规则都必须标注是 hard 还是 soft。

Hard Rule：

```text
违反后 Runtime 拒绝或中止。
```

例子：

```text
未 Read 不能 Edit。
stale file 不能 Edit。
越权路径不能读取。
危险命令需要 deny/ask。
plan mode 不能写文件。
```

Soft Rule：

```text
违反后不一定被拒绝，但任务质量会变差，eval 可能扣分。
```

例子：

```text
优先小改动。
不要扩大 scope。
失败后先诊断。
不要重复同一个失败动作。
先搜索再读文件。
```

写作要求：

```text
不能把 soft rule 写得像 hard rule。
不能把 hard rule 写成“建议”。
```

---

## 8. 每篇学习文档必须包含的四张表

从现在开始，核心 course/lab 必须包含：

### 8.1 本课新增信息表

```text
本课新增了哪些模型可见信息？
这些信息来自哪里？
怎么给？
```

### 8.2 决策来源表

```text
模型每个关键决策用到了哪些信息？
每条信息是否模型可见？
```

### 8.3 动作合理性表

```text
每个动作为什么合理/不合理？
是 hard 还是 soft？
谁执行约束？
```

### 8.4 缺失后果表

```text
如果不给这条信息，模型会怎么错？
如果没有这个工具/Policy，系统会怎么坏？
```

这四张表比长篇叙述更重要。

---

## 9. 禁止写法

以后避免这些句式直接出现：

```text
模型知道……
模型自然会……
成熟 Agent 应该……
合理动作是……
不合理动作是……
这里模型会选择……
```

除非紧跟来源说明：

```text
这个判断来自：
  - user message
  - runtime state
  - tool description
  - policy rule
  - action selection rubric
```

更好的写法：

```text
在当前 ModelRequest 中，模型可以看到用户要求“运行测试验证”，因此最终回答前需要有 VerificationState；如果没有测试结果，直接 final answer 属于软不合理，eval 应扣 verification 分。
```

---

## 10. 现有文档审计

当前已有文档需要按本规范重新审计。

### 10.1 course-01

状态：

```text
基本合格。
已经解释 messages、tools、metadata/state。
```

需要补强：

```text
增加 Knowledge Provenance 表。
增加 Context Item Contract 表。
```

### 10.2 course-02

状态：

```text
基本合格。
已经解释合理动作、硬不合理、软不合理。
```

需要补强：

```text
增加 Action Claim Contract 示例。
把 action selection rules 明确标为 soft rules，file_not_read 明确标为 hard rule。
```

### 10.3 course-04

状态：

```text
作为完整轨迹参考有价值。
作为第一学习入口不合格。
```

原因：

```text
包含大量“应该、合理、不合理、可以、不能”等判断。
虽然部分已经补充来源，但整体还没有按表格化方式暴露每个判断的来源。
```

处理方式：

```text
不要让学习者直接读 course-04。
先读 course-01 和 course-02。
之后重构 course-04，把每个 Turn 加上：
  - Model visible info
  - Decision source
  - Action claim
  - Runtime enforcement
  - Missing info failure
```

---

## 11. 后续写作流程

以后新增任何学习文档，先写这个骨架：

```text
1. 本课要解释哪个“模型为什么知道/为什么选择”的问题
2. 本课新增哪些模型可见信息
3. Runtime 怎么给这些信息
4. 给这些信息的目标是什么
5. 模型用这些信息做什么决策
6. 哪些是 hard rule，哪些是 soft rule
7. 如果没有这些信息，会产生什么错误
8. 最小例子
9. 小练习
10. 进入下一课的门槛
```

如果这个骨架填不出来，不允许写完整叙述。

---

## 12. 下一步调整

正确下一步不是继续写 `lab-01-mock-runtime-loop.md`。

应该先做：

```text
Step 1：按本规范重构 course-01
Step 2：按本规范重构 course-02
Step 3：按本规范重构 course-03 和 course-04 的关键 Turn
Step 4：确认你能看懂“模型为什么知道”和“为什么选择”
Step 5：读 course-05，把这些机制收束成产品心智模型
Step 6：再进入 Mock Runtime Loop
```

因为如果学习文档里还有隐式信息，写代码只会把隐式信息固化进实现。

---

## 13. 成功标准

一篇教学文档合格，不是因为它写得详细，而是因为学习者不会再问：

```text
这条信息模型怎么知道？
为什么这个动作合理？
这个规则是谁强制的？
这条上下文为什么要给？
不给会怎样？
```

如果学习者还需要靠追问才能发现这些前提，文档就不合格。
