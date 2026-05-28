# Production Upgrade 中文术语表

本文给 `course-14` 到 `course-17` 使用。原则是：

```text
先用中文理解机制。
英文名词只作为代码字段、verify case 名称和后续检索关键词。
```

如果课程正文里出现英文词，优先按本文的中文解释理解。

---

## 1. 上下文相关

| 英文 | 中文说法 | 用一句话理解 |
| --- | --- | --- |
| Context | 上下文 / 模型本轮可见材料 | Runtime 本轮交给模型看的信息，不等于完整历史。 |
| Context Economy | 上下文经济 / 上下文省用机制 | 用结构化选择、裁剪、附件和缓存模拟，让模型少看无关内容。 |
| ModelRequest | 模型请求 | Runtime 调模型时组出来的输入包。 |
| MessageStore | 消息事实流 | 保存完整 user、assistant、tool call、tool result 的地方。 |
| block | 信息块 | Context Engine 用来选择和裁剪上下文的最小单位。 |
| candidate blocks | 候选信息块 | 所有可能进入本轮上下文的信息块。 |
| selected blocks | 入选信息块 | 预算裁剪后真正进入本轮上下文解释的信息块。 |
| selected messages | 入选原始消息 | 从 MessageStore 里选出来、随本轮请求给模型看的原始消息。 |
| stable prefix | 稳定前缀 | 跨轮通常不变、适合模拟缓存的前半段信息，例如 system、tools、project rules。 |
| dynamic tail | 动态尾部 | 每轮会变的信息，例如最新用户消息、工具结果、验证状态、失败状态。 |
| cache | 缓存 | 这里指“上一轮已经见过、这一轮相同的稳定前缀可视为复用”。 |
| cache hit | 缓存命中 | 同位置的信息块 id 和内容指纹都没变，所以本地模拟为可复用。 |
| cache miss | 缓存未命中 | 稳定前缀的信息块变了，不能视为复用。 |
| token | 文本计量单位 | 模型输入输出的大致计量单位，用来估算上下文和成本。 |
| token budget | token 预算 | 本轮最多允许塞给模型多少文本量。 |
| eviction | 裁剪 / 淘汰 | 预算不够时，把低优先级信息块移出本轮上下文。 |
| eviction report | 裁剪报告 | 说明哪些信息块被裁掉、为什么被裁掉。 |
| artifact | 附件 / 证据附件 | 长输出不直接塞进上下文，而是存成引用材料。 |
| artifact boundary | 附件边界 | 长输出保留证据，但本轮模型只看摘要和引用。 |
| hash | 内容指纹 | 根据内容算出的短标识，用来判断内容是否变化。 |
| priority | 优先级 | hard / medium / low，决定预算压力下谁先保留。 |
| hard state | 必保状态 | 任务恢复必需的信息，例如 active plan、verification state、latest failure。 |

---

## 2. 压缩和计划相关

| 英文 | 中文说法 | 用一句话理解 |
| --- | --- | --- |
| Compaction | 压缩 / 状态压缩 | 上下文太长时，把旧历史压成可恢复的关键状态。 |
| compact summary | 压缩摘要 | 压缩后用于恢复任务的状态摘要。 |
| Compaction Quality | 压缩质量评估 | 机器检查压缩前后的目标、约束、失败、计划等有没有丢。 |
| compaction_loss | 压缩丢失 | 压缩后关键状态丢失或漂移的失败归因。 |
| before / after diff | 压缩前后差异 | 对比压缩前状态和压缩后摘要的差异。 |
| Plan | 计划 | 任务如何一步步执行的 Runtime 状态，不只是模型写的文字。 |
| Plan State Machine | 计划状态机 | 把计划拆成 step，并跟踪 pending、active、done、blocked、revised、resumed。 |
| step | 步骤 | 计划里的单个执行单元。 |
| lifecycle | 生命周期 | 一个 step 从 pending 到 active 到 done 或 blocked 的变化过程。 |
| blocked | 受阻 | 当前步骤不能继续，需要修订、恢复或人工处理。 |
| revision | 修订 | 用户改需求或任务受阻后，生成新计划并保留旧计划历史。 |
| resumed | 恢复执行 | 压缩或中断后，从原来的 active step 继续。 |
| final grounding | 最终回答依据校验 | final answer 前检查计划已完成且验证已通过。 |

---

## 3. 长任务、工具和模型网关相关

| 英文 | 中文说法 | 用一句话理解 |
| --- | --- | --- |
| Long-Running Task Eval | 长任务评测 | 检查多轮任务中的失败、压缩、恢复和成本曲线。 |
| failure history | 失败历史 | 记录失败验证，保证下一步修复受失败影响。 |
| cost curve | 成本曲线 | 每轮 token 和本地估算成本的变化记录。 |
| learning handoff | 学习交接摘要 | 给学习者看的“为什么继续、何时压缩、如何恢复”的摘要。 |
| ToolRuntime | 工具运行时 | 真正执行读文件、改文件、跑命令的本地层。 |
| preview | 预览 | 写入前先生成 diff，让人或系统看将要改什么。 |
| diff | 差异 | 文件修改前后的对照。 |
| transaction | 事务 | 把多个写入当作一组操作，要么全部成功，要么可恢复。 |
| commit | 提交写入 | 预览通过后真正落盘。 |
| rollback | 回滚 | 中途失败后恢复到事务前内容。 |
| stale file | 过期文件 | 读过文件后，文件又被外部改了，旧快照不能继续写。 |
| protected file | 受保护文件 | 修改前需要更高权限或人工批准的文件。 |
| high-risk Bash | 高风险命令 | 可能删除、联网安装或破坏环境的命令。 |
| ModelGateway | 模型网关 | Runtime 和模型服务之间的边界层。 |
| provider | 模型服务方 | 提供模型 API 的后端。 |
| budget gate | 预算闸门 | 调 provider 前检查 token 或成本是否超限。 |
| retry | 重试 | 临时失败时再试一次。 |
| fallback | 降级 / 备用模型 | 主 provider 不可用或太贵时换另一个。 |
| capability registry | 能力登记表 | 记录某 provider 支持哪些工具、流式、推理等能力。 |
| output repair | 输出修复 | 对模型输出里的小 JSON 错误做窄范围修补，但仍要过 schema。 |

---

## 4. 会话、仓库和人工协作相关

| 英文 | 中文说法 | 用一句话理解 |
| --- | --- | --- |
| Session | 会话 | 一次任务运行的状态和事件集合。 |
| event log | 事件日志 | 记录运行中发生了什么。 |
| append-only event log | 只追加事件日志 | 只能往后追加，不能悄悄改旧事件或重排。 |
| seq | 序号 | 事件顺序编号。 |
| hash chain | 指纹链 | 每条事件带上一条事件的指纹，用来检测重排或篡改。 |
| snapshot | 快照 | 某个时刻的恢复点。 |
| replay | 重放 | 根据事件日志重新构建运行状态。 |
| crash recovery | 崩溃恢复 | 中断后从快照和后续事件恢复任务。 |
| redaction | 脱敏 | 写入证据前把密钥、token 等替换成 `[REDACTED]`。 |
| Repo Intelligence | 仓库理解 / 仓库智能 | 建立文件、符号、测试和规则索引，帮助选对上下文。 |
| repo map | 仓库地图 | 文件、脚本、规则入口等仓库结构信息。 |
| symbol index | 符号索引 | 函数、导出、引用关系索引。 |
| test index | 测试索引 | 源码文件和测试文件、测试命令的关联。 |
| rule index | 规则索引 | AGENTS.md、README 等项目规则的索引。 |
| relevance scoring | 相关性评分 | 用多个理由解释为什么某文件更相关。 |
| incremental update | 增量更新 | 文件变更后只刷新相关索引，不全量重建。 |
| token benefit | token 收益 | 证明 repo-aware selection 比 naive search 用更少 token 选中正确材料。 |
| Human Approval | 人工批准 | 高风险动作先让人批准。 |
| approval_required | 需要批准 | 动作不能直接执行，必须先进入审批状态。 |
| approve | 批准 | 人同意后继续执行。 |
| reject | 拒绝 | 人不同意，不执行，并修订计划。 |
| interruption | 用户打断 | 用户中途改变目标或新增约束。 |
| handoff | 交接材料 | 任务未完成时，给下一次恢复用的材料。 |
| no hidden execution | 禁止隐藏执行 | 需要批准的动作不能先执行再补批准记录。 |

---

## 5. 分数和边界相关

| 英文 | 中文说法 | 用一句话理解 |
| --- | --- | --- |
| deterministic local evidence | 本地确定性证据 | 在本地固定脚本里可复现的证据，不等于真实生产表现。 |
| production claim | 生产级能力声明 | 声称系统已经能在真实生产环境可靠工作。当前不能这样声称。 |
| provider billing | 模型服务真实账单 | 厂商真实计费。当前本地价格表不等于真实账单。 |
| provider cache billing | 模型服务真实缓存计费 | 厂商对缓存命中的真实计费。Core 18 只是本地模拟。 |
| benchmark | 基准评测 | 大规模、有代表性的任务集评测。 |
| RelativeScore | 相对分数 | 和另一个真实 reference agent 对照后的相对表现。没有第二 agent 实跑就不能算。 |
| SystemScore | 系统绝对分 | 自己在大规模 benchmark 下的通过率。 |
| out of scope | 不在当前范围 | 当前阶段明确不承诺的能力。 |
