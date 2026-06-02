# 项目中文术语表（Chinese-First Terms）

本文最初给 `course-14` 到 `course-17` 使用；现在作为当前解释性文档的中文术语入口。文件名暂不修改，以免破坏既有链接。

原则是：

```text
先用中文理解机制。
英文名词只作为词汇括注、代码字段、验证用例（verify case）名称和后续检索关键词。
```

当前解释性文档第一次写术语时，采用：

```text
中文说法（English term）
```

文件名、命令名、错误码、代码字段和真实输出可以保留英文原样，但正文解释应给中文含义。历史文档不强制回写；遇到冲突时，以 `course-00`、`authority-map` 和本文为准。

---

## 0. 全项目常见词

| 中文说法 | 英文词 | 用一句话理解 |
| --- | --- | --- |
| Claude Code | Claude Code | 学习对象，是成熟代码智能体产品；本项目学习其产品问题和运行时机制，不复制官方源码。 |
| 代码智能体 | Coding Agent / Agent | 能读代码、改代码、调用工具、跑验证并处理失败的系统。 |
| 代码智能体核心 / 核心运行时 | Agent Core | 不含完整商业产品外壳，专注模型请求、上下文、工具、计划、状态和评测闭环。 |
| 运行时 | Runtime | 真正保存状态、执行工具、检查权限、调用模型和记录证据的程序层。 |
| 权限策略 / 安全策略 | Policy | 决定什么动作允许、拒绝或需要人工批准。 |
| 提示词 | Prompt | 给模型看的规则文本；它可以指导模型，但不能替代权限策略或工具运行时。 |
| 公开学习边界 / 不复制式学习 | 文件名里的 clean-room | 这不是运行时对象，只是早期文件名中的英文标签。它指代码和课程由本项目自己写，不复制官方源码、私有提示词或非公开实现。 |
| 验证脚本 | verify | 可运行的检查，用来证明某个机制确实成立。 |
| 测试夹具 / 受控样例仓库 | fixture | 为了验证机制而准备的小型文件、仓库或输入数据。 |
| 证据 | evidence | 运行结果、验证脚本、记录或报告；证据支持能力声明，但不能夸大范围。 |
| 不在当前范围 | out of scope | 当前阶段明确不承诺、不证明的能力。 |

---

## 1. 上下文相关

| 中文说法 | 英文词 | 用一句话理解 |
| --- | --- | --- |
| 上下文 / 模型本轮可见材料 | Context | 运行时（Runtime）本轮交给模型看的信息，不等于完整历史。 |
| 上下文经济 / 上下文省用机制 | Context Economy | 用结构化选择、裁剪、附件和缓存模拟，让模型少看无关内容。 |
| 模型请求 | ModelRequest | 运行时（Runtime）调模型时组出来的输入包。 |
| 消息事实流 | MessageStore | 保存完整用户消息（user）、助手消息（assistant）、工具调用（tool call）和工具结果（tool result）的地方。 |
| 信息块 | block | 上下文引擎（Context Engine）用来选择和裁剪上下文的最小单位。 |
| 候选信息块 | candidate blocks | 所有可能进入本轮上下文的信息块。 |
| 入选信息块 | selected blocks | 预算裁剪后真正进入本轮上下文解释的信息块。 |
| 入选原始消息 | selected messages | 从 MessageStore 里选出来、随本轮请求给模型看的原始消息。 |
| 稳定前缀 | stable prefix | 跨轮通常不变、适合模拟缓存的前半段信息，例如系统消息（system）、工具定义（tools）和项目规则（project rules）。 |
| 动态尾部 | dynamic tail | 每轮会变的信息，例如最新用户消息、工具结果、验证状态、失败状态。 |
| 缓存 | cache | 这里指“上一轮已经见过、这一轮相同的稳定前缀可视为复用”。 |
| 缓存命中 | cache hit | 同位置的信息块 id 和内容指纹都没变，所以本地模拟为可复用。 |
| 缓存未命中 | cache miss | 稳定前缀的信息块变了，不能视为复用。 |
| 文本计量单位 | token | 模型输入输出的大致计量单位，用来估算上下文和成本。 |
| 词元预算 | token budget | 本轮最多允许塞给模型多少文本量。 |
| 裁剪 / 淘汰 | eviction | 预算不够时，把低优先级信息块移出本轮上下文。 |
| 裁剪报告 | eviction report | 说明哪些信息块被裁掉、为什么被裁掉。 |
| 附件 / 证据附件 | artifact | 长输出不直接塞进上下文，而是存成引用材料。 |
| 附件边界 | artifact boundary | 长输出保留证据，但本轮模型只看摘要和引用。 |
| 内容指纹 | hash | 根据内容算出的短标识，用来判断内容是否变化。 |
| 优先级 | priority | 高 / 中 / 低（hard / medium / low），决定预算压力下谁先保留。 |
| 必保状态 | hard state | 任务恢复必需的信息，例如活跃计划（active plan）、验证状态（verification state）、最新失败（latest failure）。 |

---

## 2. 压缩和计划相关

| 中文说法 | 英文词 | 用一句话理解 |
| --- | --- | --- |
| 压缩 / 状态压缩 | Compaction | 上下文太长时，把旧历史压成可恢复的关键状态。 |
| 压缩摘要 | compact summary | 压缩后用于恢复任务的状态摘要。 |
| 压缩质量评估 | Compaction Quality | 机器检查压缩前后的目标、约束、失败、计划等有没有丢。 |
| 压缩丢失 | compaction_loss | 压缩后关键状态丢失或漂移的失败归因。 |
| 压缩前后差异 | before / after diff | 对比压缩前状态和压缩后摘要的差异。 |
| 计划 | Plan | 任务如何一步步执行的运行时（Runtime）状态，不只是模型写的文字。 |
| 计划状态机 | Plan State Machine | 把计划拆成步骤（step），并跟踪待处理、活跃、完成、受阻、已修订、已恢复（pending、active、done、blocked、revised、resumed）。 |
| 步骤 | step | 计划里的单个执行单元。 |
| 生命周期 | lifecycle | 一个 step 从 pending 到 active 到 done 或 blocked 的变化过程。 |
| 受阻 | blocked | 当前步骤不能继续，需要修订、恢复或人工处理。 |
| 修订 | revision | 用户改需求或任务受阻后，生成新计划并保留旧计划历史。 |
| 恢复执行 | resumed | 压缩或中断后，从原来的 active step 继续。 |
| 最终回答依据校验 | final grounding | 最终回答（final answer）前检查计划已完成且验证已通过。 |

---

## 3. 长任务、工具和模型网关相关

| 中文说法 | 英文词 | 用一句话理解 |
| --- | --- | --- |
| 长任务评测 | Long-Running Task Eval | 检查多轮任务中的失败、压缩、恢复和成本曲线。 |
| 失败历史 | failure history | 记录失败验证，保证下一步修复受失败影响。 |
| 成本曲线 | cost curve | 每轮词元（token）和本地估算成本的变化记录。 |
| 学习交接摘要 | learning handoff | 给学习者看的“为什么继续、何时压缩、如何恢复”的摘要。 |
| 工具运行时 | ToolRuntime | 真正执行读文件、改文件、跑命令的本地层。 |
| 预览 | preview | 写入前先生成差异（diff），让人或系统看将要改什么。 |
| 差异 | diff | 文件修改前后的对照。 |
| 事务 | transaction | 把多个写入当作一组操作，要么全部成功，要么可恢复。 |
| 提交写入 | commit | 预览通过后真正落盘。 |
| 回滚 | rollback | 中途失败后恢复到事务前内容。 |
| 过期文件 | stale file | 读过文件后，文件又被外部改了，旧快照不能继续写。 |
| 受保护文件 | protected file | 修改前需要更高权限或人工批准的文件。 |
| 高风险命令 | high-risk Bash | 可能删除、联网安装或破坏环境的命令。 |
| 模型网关 | ModelGateway | 运行时（Runtime）和模型服务之间的边界层。 |
| 模型服务方 | provider | 提供模型 API 的后端。 |
| 预算闸门 | budget gate | 调模型服务方（provider）前检查词元（token）或成本是否超限。 |
| 重试 | retry | 临时失败时再试一次。 |
| 降级 / 备用模型 | fallback | 主模型服务方（provider）不可用或太贵时换另一个。 |
| 能力登记表 | capability registry | 记录某模型服务方（provider）支持哪些工具、流式、推理等能力。 |
| 输出修复 | output repair | 对模型输出里的小 JSON 错误做窄范围修补，但仍要过 schema。 |

---

## 4. 会话、仓库和人工协作相关

| 中文说法 | 英文词 | 用一句话理解 |
| --- | --- | --- |
| 会话 | Session | 一次任务运行的状态和事件集合。 |
| 事件日志 | event log | 记录运行中发生了什么。 |
| 只追加事件日志 | append-only event log | 只能往后追加，不能悄悄改旧事件或重排。 |
| 序号 | seq | 事件顺序编号。 |
| 指纹链 | hash chain | 每条事件带上一条事件的指纹，用来检测重排或篡改。 |
| 快照 | snapshot | 某个时刻的恢复点。 |
| 重放 | replay | 根据事件日志重新构建运行状态。 |
| 崩溃恢复 | crash recovery | 中断后从快照和后续事件恢复任务。 |
| 脱敏 | redaction | 写入证据前把密钥、token 等替换成 `[REDACTED]`。 |
| 仓库理解 / 仓库智能 | Repo Intelligence | 建立文件、符号、测试和规则索引，帮助选对上下文。 |
| 仓库地图 | repo map | 文件、脚本、规则入口等仓库结构信息。 |
| 符号索引 | symbol index | 函数、导出、引用关系索引。 |
| 测试索引 | test index | 源码文件和测试文件、测试命令的关联。 |
| 规则索引 | rule index | AGENTS.md、README 等项目规则的索引。 |
| 相关性评分 | relevance scoring | 用多个理由解释为什么某文件更相关。 |
| 增量更新 | incremental update | 文件变更后只刷新相关索引，不全量重建。 |
| 词元收益 | token benefit | 证明仓库感知选择（repo-aware selection）比朴素搜索（naive search）用更少词元（token）选中正确材料。 |
| 人工批准 | Human Approval | 高风险动作先让人批准。 |
| 需要批准 | approval_required | 动作不能直接执行，必须先进入审批状态。 |
| 批准 | approve | 人同意后继续执行。 |
| 拒绝 | reject | 人不同意，不执行，并修订计划。 |
| 用户打断 | interruption | 用户中途改变目标或新增约束。 |
| 交接材料 | handoff | 任务未完成时，给下一次恢复用的材料。 |
| 禁止隐藏执行 | no hidden execution | 需要批准的动作不能先执行再补批准记录。 |

---

## 5. 分数和边界相关

| 中文说法 | 英文词 | 用一句话理解 |
| --- | --- | --- |
| 本地确定性证据 | deterministic local evidence | 在本地固定脚本里可复现的证据，不等于真实生产表现。 |
| 生产级能力声明 | production claim | 声称系统已经能在真实生产环境可靠工作。当前不能这样声称。 |
| 模型服务真实账单 | provider billing | 厂商真实计费。当前本地价格表不等于真实账单。 |
| 模型服务真实缓存计费 | provider cache billing | 厂商对缓存命中的真实计费。Core 18 只是本地模拟。 |
| 基准评测 | benchmark | 大规模、有代表性的任务集评测。 |
| 相对分数 | RelativeScore | 和另一个真实参考智能体（reference agent）对照后的相对表现。没有第二个智能体（agent）实跑就不能算。 |
| 系统绝对分 | SystemScore | 自己在大规模基准评测（benchmark）下的通过率。 |
| 不在当前范围 | out of scope | 当前阶段明确不承诺的能力。 |
