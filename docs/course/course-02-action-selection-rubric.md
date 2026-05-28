# Course 02 Action Selection Rubric：模型怎么判断下一步动作是否合理

> 这节回答一个比“模型怎么知道工具”更进一步的问题：
>
> ```text
> 模型怎么知道现在该 Search、Read、Edit、Bash，还是 AskUser？
> 为什么某些动作被说成合理，某些动作被说成不合理？
> ```
>
> 答案不是“模型天然知道合理”，而是 Runtime 必须把动作选择规则显式化。

---

## 0. 先给结论

模型选择动作依赖 6 类信息：

```text
1. 用户目标
   用户到底要完成什么。

2. 当前状态
   已经知道什么、还不知道什么、读过哪些文件、改过哪些文件、测过没有。

3. 可用工具
   Runtime 给了哪些工具，每个工具适合做什么。

4. 硬约束
   哪些动作不允许，做了也会被 Policy 或 Tool 拒绝。

5. 软策略
   哪些动作通常更好，例如先定位、再读取、再修改、再验证。

6. 历史反馈
   上一轮工具结果、失败日志、用户反馈、eval 经验。
```

所以“合理动作”不是凭空来的。

它来自：

```text
ModelRequest 里的 messages + tools + state + policy instruction + project rules。
```

---

## 1. 合理动作到底是什么意思

在 Agent Runtime 里，“合理”至少有三层。

### 1.1 合法

合法表示：

```text
这个动作满足工具 schema、权限和安全规则。
```

例子：

```text
Read workspace 内的普通文件：合法。
Edit 没读过的文件：不合法。
读取 ~/.ssh/id_rsa：不合法。
```

合法性由 Runtime 强制，不靠模型自觉。

### 1.2 有信息增益

有信息增益表示：

```text
这个动作能让模型知道完成任务所需的新事实。
```

例子：

```text
用户没给文件路径时 Search：有信息增益。
已经知道相关文件后 Read：有信息增益。
连续三次运行同一个失败命令：信息增益低。
```

### 1.3 符合任务阶段

符合任务阶段表示：

```text
动作和当前进度匹配。
```

例子：

```text
没找到文件前：Search 合理。
找到文件但没读前：Read 合理。
读完并定位 bug 后：Edit 合理。
改完后：Bash 验证合理。
测试失败后：读取失败日志相关文件合理。
测试通过后：Final Answer 合理。
```

所以合理动作可以粗略定义成：

```text
合法 + 有信息增益 + 符合当前任务阶段。
```

---

## 2. 不合理动作分两类

### 2.1 硬不合理：Runtime 应该拒绝

这类动作不是“建议不要做”，而是不能做。

例子：

```text
没 Read 就 Edit。
文件读过后被用户改了，还继续 Edit。
old_string 匹配多处但没设置 replace_all。
路径越出 workspace。
运行 rm -rf。
readonly 模式下 Write。
plan mode 下修改文件。
```

这些应该由：

```text
Tool validation
Policy Engine
Path safety
Shell safety
Read cache / stale check
```

强制拦截。

模型即使请求了，Runtime 也要返回错误 observation。

### 2.2 软不合理：Runtime 不一定拒绝，但应该引导

这类动作可能能执行，但通常不是好策略。

例子：

```text
用户没给文件路径时直接跑全量测试。
还没看代码就给最终答案。
Search 已经没结果还反复搜同一个词。
只改测试不看实现。
为了让一个测试通过大改无关模块。
测试失败后不看失败日志，直接乱改。
```

这些主要靠：

```text
system prompt
tool descriptions
runtime state summary
recovery instruction
eval regression
```

来减少。

注意：

```text
软不合理不是永远错误。
有些场景直接跑测试也可能合理，例如用户说“测试挂了，帮我看失败原因”。
```

所以软不合理需要结合任务阶段判断。

---

## 3. Runtime 应该显式给模型的动作选择规则

为了减少隐藏信息，第一次 ModelRequest 应该包含一段 Action Selection Contract。

示例：

```text
Action selection rules:

1. If you lack facts, use read-only tools first.
2. If the user gives a behavior but no file path, search before reading.
3. If search finds relevant files, read them before editing.
4. Do not edit a file that has not been read in this session.
5. Prefer small, focused edits that address the user's request.
6. After modifying code, run the most relevant verification command you can identify.
7. If a command fails, use the failure output as evidence and diagnose before retrying.
8. Do not repeat the same failed action without changing strategy.
9. If the requirement is ambiguous and the wrong choice could change behavior, ask the user when possible.
10. If you cannot ask because the session is non-interactive, choose the smallest reversible action and state the assumption.
```

翻译成中文：

```text
1. 缺少事实时，先用只读工具。
2. 用户只给行为没给文件路径时，先搜索。
3. 搜到相关文件后，先读文件再改。
4. 没读过的文件不要改。
5. 优先做小而聚焦的改动。
6. 改完代码后运行最相关的验证命令。
7. 命令失败后先根据失败输出诊断，不要盲目重试。
8. 不要重复同一个失败动作。
9. 需求有歧义且可能改变行为时，尽量问用户。
10. 不能问用户时，选择最小可逆动作并说明假设。
```

这段规则应该进入：

```text
system message
或 runtime instruction
或 mode instruction
```

而不是藏在教程叙述里。

---

## 3.1 Action Selection Contract 的规则类型

Action Selection Contract 里同时包含 hard rules 和 soft rules。

| 规则 | 类型 | 谁执行 | 违反后果 |
| --- | --- | --- | --- |
| Do not edit a file that has not been read | Hard | Policy Engine + EditTool | ToolResult 返回 `file_not_read` |
| Use read-only tools first when facts are missing | Soft | Prompt + Eval | 不一定拒绝，但可能导致低效或错误 |
| Search before reading when user gives behavior but no file path | Soft | Prompt + Tool Description + Eval | 不一定拒绝，但可能盲读/乱读 |
| Read files before editing | Hard for Edit, soft for planning | EditTool + Policy | Edit 被拒绝；或 plan 质量下降 |
| Prefer small, focused edits | Soft | Prompt + Review/Eval | 过度改动会被 eval 扣分 |
| Run verification after modifying code | Soft-to-hard by user request | Prompt + Eval；用户明确要求时变硬 | 未验证 final answer 会被评测判失败 |
| Do not repeat the same failed action | Soft until threshold, then Runtime guard | Runtime repeated failure guard | 第 3 次注入 recovery，第 4 次受控中止 |
| Ask user when ambiguity could change behavior | Soft, non-interactive 时转 blocked/assumption | Prompt + AskUser Tool + mode | 自动模式下需说明假设，否则扣分 |

关键点：

```text
不是所有“应该”都由 Runtime 拦截。
Hard rule 负责安全和一致性。
Soft rule 负责质量和成熟度。
```

---

## 3.2 Action Claim Contract 示例

以后文档里每次说“这个动作合理/不合理”，都应该能填出这个结构。

### 示例 1：第一轮 Search

```text
Action:
  当前动作: Search "paginate|pagination|pageSize|limit|offset"
  当前状态: 用户描述分页 bug；没有文件路径；没有读过文件；Search 工具可用
  合理性判断: 合理
  来源:
    - User Message: “分页返回数量多了一个”
    - Runtime State: no files read
    - Tool Description: Search 用于定位相关文件
    - Action Selection Contract: 缺少事实时先只读；无路径先 Search
  硬约束: 无
  软策略: 先定位再读取；避免盲读整个项目
  替代动作: Read package.json 或查看目录结构
  如果做错会怎样: 如果直接 Edit，会因不知道路径和 file_not_read 失败
```

### 示例 2：第一轮直接 Edit

```text
Action:
  当前动作: Edit src/pagination.ts
  当前状态: 没有读过任何文件；src/pagination.ts 只是猜测路径
  合理性判断: 硬不合理
  来源:
    - Runtime State: no files read
    - Edit Tool Description: target file must have been fully read
    - Policy Rule: read-before-write
  硬约束: Edit 前必须完整 Read，且文件 hash 未变化
  软策略: 不要猜文件内容
  替代动作: Search 分页关键词；或 Read 已知文件
  如果做错会怎样: Policy 返回 file_not_read 或 path_unknown；错误作为 observation 回灌
```

### 示例 3：改完后 Bash 测试

```text
Action:
  当前动作: Bash "npm test"
  当前状态: 已修改 src/pagination.ts；package.json 已读出 test script；用户要求运行测试验证
  合理性判断: 合理
  来源:
    - User Message: 要求运行测试验证
    - Runtime State: modifiedFiles 非空，lastVerification 为空
    - Read Result: package.json scripts.test = vitest run
    - Action Selection Contract: 修改后运行相关验证
  硬约束: Bash 命令必须通过 shell safety；cwd 在 workspace 内
  软策略: 优先运行最相关测试而不是无关命令
  替代动作: 如果 test script 不明确，先 Read README 或 package scripts
  如果做错会怎样: 不验证就 final answer 会被 verification eval 判失败
```

### 示例 4：未验证直接 Final Answer

```text
Action:
  当前动作: Final Answer “已修复”
  当前状态: 已修改文件，但 lastVerification 为空；用户明确要求测试验证
  合理性判断: 软不合理，评测中应判严重失败
  来源:
    - User Message: 要求运行测试验证
    - Runtime State: no verification performed
    - System Prompt: 不要声称未发生的工具结果
  硬约束: Runtime 通常不拦截 final answer
  软策略: final answer 必须诚实区分已验证/未验证
  替代动作: Bash 运行测试；或说明无法验证的原因
  如果做错会怎样: 用户信任受损；eval 扣 Verification Quality，可能触发 critical failure
```

---

## 4. 模型如何使用这套规则

模型第一次看到：

```text
用户任务：分页返回数量多了一个，请修复并运行测试验证。
当前状态：没有读过文件，没有改过文件，没有验证。
工具：Search、Read、Edit、Bash。
动作规则：缺少事实先只读；无文件路径先 Search；Edit 前必须 Read。
```

它的动作候选：

```text
Search
Read
Edit
Bash
Final Answer
AskUser
```

逐个判断：

```text
Final Answer：
  不合理。还没修复，也没验证。

Edit：
  硬不合理。没读文件，也不知道路径。

Bash：
  软不合理。可以执行，但还不知道测试命令，也没定位问题。

Read：
  暂时不可选或信息增益不足。还不知道读哪个文件。

AskUser：
  暂时不需要。可以先自己搜索。

Search：
  合理。用户给了行为描述但没给路径，Search 是只读且有信息增益。
```

所以第一步选择：

```text
Search
```

不是因为模型知道答案。

而是因为 Search 在当前状态下：

```text
合法
低风险
有信息增益
符合“缺事实先观察”的规则
```

---

## 5. 动作选择状态机

最小状态机可以这么理解：

```text
Need location
  -> Search / list files / inspect project

Need content
  -> Read

Need change
  -> Edit / Write

Need verification command
  -> Read package scripts / project docs / run targeted command

Need verification
  -> Bash test/lint/typecheck

Verification failed
  -> Read failure context / diagnose / edit / rerun

Verified
  -> Final Answer

Ambiguous high-risk choice
  -> AskUser or make smallest reversible assumption
```

这就是“合理动作”的来源。

它不是模型凭空悟出来，而是 Runtime 应该给模型这张隐形地图。

如果我们做产品，就应该把这张地图显式写进 prompt 和 eval。

---

## 6. 每个工具的适用条件

### 6.1 Search

适合：

```text
不知道文件路径。
用户描述的是行为、功能、接口、错误文本。
需要定位符号、函数、测试、配置。
```

不适合：

```text
已经知道精确文件且需要看全文。
需要确认文件当前内容。
```

### 6.2 Read

适合：

```text
已经知道候选文件。
需要理解代码。
准备编辑文件。
需要读取失败测试上下文。
```

不适合：

```text
完全不知道读哪个文件。
盲读大量无关文件。
```

### 6.3 Edit

适合：

```text
已完整 Read 目标文件。
已经定位要替换的精确文本。
改动小而明确。
文件没有 stale。
```

不适合：

```text
没读文件。
old_string 不唯一。
需求还不清楚。
需要大范围重构但没有 plan。
```

### 6.4 Bash

适合：

```text
运行测试。
查看 git status。
执行项目命令。
验证构建、lint、typecheck。
```

不适合：

```text
还没定位问题就反复跑全量测试。
运行危险命令。
用 shell 绕过 Tool/Policy。
```

### 6.5 AskUser

适合：

```text
需求歧义高。
继续执行会改变产品语义。
需要权限或外部凭据。
多种修复方向都合理。
```

不适合：

```text
代码里能自己查到答案。
只是懒得搜索或阅读。
```

---

## 7. course-04 里的“合理/不合理”应该怎么读

course-04 里出现的“合理动作”和“不合理动作”，都应该按这个表理解：

| 场景 | 合理性来源 |
| --- | --- |
| 第一轮先 Search | 用户没给路径；Search 只读；action contract 说缺事实先搜索 |
| 第一轮不直接 Edit | Edit 工具要求先 Read；Policy 会拒绝 file_not_read |
| 找到文件后 Read | SearchResult 给出候选路径；Read 是理解和编辑前置 |
| 改完后 Bash | 用户要求验证；action contract 要求修改后验证 |
| 测试失败后不直接乱改 | 失败输出是新事实；recovery rule 要求先诊断 |
| 不扩大 page=0 语义 | system prompt 要求小改动；项目规则不足时应避免改变既有行为 |
| 测试通过后 Final Answer | VerificationState passed；任务目标已满足 |

如果 course-04 里任何一句“合理/不合理”找不到来源，就说明文档还不合格。

来源必须至少落在一处：

```text
用户目标
当前状态
工具说明
system/runtime instruction
project rules
policy hard rule
eval/recovery rule
```

---

## 8. 产品实现时怎么减少模型乱选动作

不能只对模型说“做合理动作”。

要把合理性拆到系统里。

### 8.1 Prompt 层

写清：

```text
缺事实先观察。
改前先读。
改后验证。
失败后诊断。
不要重复失败动作。
需求歧义时询问。
```

### 8.2 Tool description 层

每个工具写清：

```text
什么时候用。
什么时候不用。
前置条件。
失败后下一步。
```

### 8.3 Policy 层

硬性拦截：

```text
未读文件 Edit。
stale file Edit。
危险 Bash。
越权路径。
plan mode 写文件。
```

### 8.4 Runtime state 层

每轮告诉模型：

```text
已经读过哪些文件。
改过哪些文件。
最后一次测试状态。
最近失败是什么。
当前模式是什么。
```

### 8.5 Eval 层

把错误动作做成 case：

```text
没读就 Edit -> fail。
测试失败后重复跑同一命令 -> fail。
改完不验证 -> fail。
过度改动无关文件 -> fail。
```

这样模型才会越来越稳定。

---

## 9. 小练习

### 练习 1：判断动作来源

场景：

```text
用户说：登录接口报错，请修复。
当前状态：没有读过文件。
工具：Search、Read、Edit、Bash。
```

动作：

```text
直接 Edit src/auth.ts。
```

为什么不合理？

参考答案：

```text
不知道文件是不是 src/auth.ts。
没读过文件。
Edit 工具要求先 Read。
Policy 应该拒绝 file_not_read。
```

### 练习 2：判断 Search 是否合理

场景：

```text
用户说：/users 接口分页多返回一个。
当前状态：没有读过文件。
```

动作：

```text
Search "users|pageSize|limit|offset"
```

为什么合理？

参考答案：

```text
用户给了接口和行为，但没给文件路径。
Search 是只读。
关键词来自用户语义和分页常见命名。
它能定位候选文件。
```

### 练习 3：判断 Bash 是否合理

场景：

```text
用户说：测试失败了，帮我看。
当前状态：没有失败日志。
```

动作：

```text
Bash "npm test"
```

是否合理？

参考答案：

```text
可能合理。
因为用户的任务就是测试失败，重新运行测试可以获取失败日志。
但如果项目测试命令未知，可能应该先 Read package.json。
```

这说明：

```text
同一个动作是否合理，取决于当前状态和任务阶段。
```

---

## 10. 进入 course-04 前你要会什么

看 course-04 之前，你要能复述：

```text
模型不是天然知道合理动作。
Runtime 通过 messages、tools、state、policy instruction 给它动作选择依据。
硬不合理由 Runtime 拦截。
软不合理由 prompt、工具说明、状态摘要和 eval 引导。
合理动作 = 合法 + 有信息增益 + 符合任务阶段。
```

如果你能复述这段，再看 course-04 里的“合理/不合理”就不会觉得它是凭空来的。
