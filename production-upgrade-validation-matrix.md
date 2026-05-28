# Production Upgrade Validation Matrix：Core 18-26 验证矩阵

本文是 Core 18-26 的验证先行文档。它定义每个生产化阶段进入实现前必须满足的验收思路。

本文不替代具体 `*.verify.mjs`，而是给未来 verify 脚本提供共同标准：

```text
每个 Core 必须证明它解决了什么。
每个 Core 必须证明它没有越界声称什么。
每个 Core 必须留下可复现证据。
```

---

## 1. 全局验证原则

所有 Core 18-26 必须满足：

| 验证维度 | 必须回答 |
| --- | --- |
| Behavior | 机制是否真的执行，而不是只写在文档里 |
| Boundary | 安全、预算、状态和权限边界是否仍由 Runtime 强制 |
| Regression | 前序 Core 的关键保证是否仍成立 |
| Evidence | 是否有 trace、snapshot、report、diff 或 replay 可检查 |
| Cost / Token | 如果影响上下文或模型调用，是否记录 token/cost basis |
| Recovery | 失败后是否能恢复或给出结构化失败原因 |
| Out of Scope | 是否防止把 starter 能力误称为生产认证 |

---

## 2. Core 18：Context Economy + Cache-Aware Context Engine

目标：

```text
让 Context Engine 从“选择上下文”升级为“解释上下文经济性”。
```

必过验证：

| Case | 验证方法 | 预期结果 | 证据 |
| --- | --- | --- | --- |
| stable prefix | 构造多轮相同 system/tool/project blocks | 稳定 block 顺序、id 和 hash 不变 | context snapshot |
| dynamic tail | 加入最新用户消息和工具结果 | 动态内容进入 tail，不污染 stable prefix | context blocks |
| token budget | 设置小预算 | 低优先级内容被裁剪，高优先级 hard state 保留 | eviction report |
| cache simulation | 连续两轮构造请求 | stablePrefixTokens、cacheHitTokens、cacheMissTokens 可解释 | cache report |
| artifact boundary | 长输出进入 artifact | raw long output 不反复进入 selected messages | artifact list |
| latest failure | 小预算下保留失败状态 | latest failure / verification state 不丢 | selected blocks |
| no prompt-only saving | 检查实现 | token 节省由 block selection / artifact / cache simulation 证明 | verify assertion |

完成信号：

```text
每轮 ModelRequest 都能解释：为什么选、为什么裁、估计多少 token、哪些可缓存。
```

---

## 3. Core 19：Compaction Quality Eval

目标：

```text
让 Compaction 从“摘要”升级为“状态保真转换”。
```

必过验证：

| Case | 验证方法 | 预期结果 | 证据 |
| --- | --- | --- | --- |
| objective preservation | 压缩前后对照目标 | 目标不漂移 | compaction diff |
| constraint preservation | 放入用户约束和安全约束 | 约束完整保留 | summary fields |
| failure preservation | 压缩前 verification failed | 压缩后不能变 passed | state assertion |
| plan preservation | active plan 存在 | plan id、step、status 保留 | compact summary |
| modified files | 已修改文件进入压缩摘要 | 文件列表和原因可追踪 | modified file log |
| pending actions | 有 pending next action | 下一步动作不丢 | summary / trace |
| quality score | 构造缺字段坏摘要 | verify 能识别 compaction_loss | eval report |

完成信号：

```text
压缩前后可以机器对照，且坏压缩会被明确归因。
```

---

## 4. Core 20：Plan State Machine

目标：

```text
让 Plan 从批准文本升级为可恢复、可修订、可阻塞的 Runtime 状态机。
```

必过验证：

| Case | 验证方法 | 预期结果 | 证据 |
| --- | --- | --- | --- |
| step lifecycle | plan steps 依次执行 | pending -> active -> done | plan trace |
| blocked reason | 构造缺文件/失败验证 | step 进入 blocked，记录原因 | plan state |
| revision | 用户中途改需求 | 生成 revised plan，不覆盖历史 | plan revision log |
| resume | compaction 后继续执行 | active step 可恢复 | restored state |
| permission | 未批准写操作 | ToolRuntime 继续拒绝 | policy result |
| final grounding | final answer 前检查 plan 完成 | 未完成不能冒充完成 | verify case |

完成信号：

```text
Plan 能被 Runtime 审计，而不是只被模型读懂。
```

---

## 5. Core 21：Long-Running Task Eval

目标：

```text
建立长任务压力场，验证 Context / Compaction / Plan / Cost 在多轮中不崩。
```

必过验证：

| Case | 验证方法 | 预期结果 | 证据 |
| --- | --- | --- | --- |
| multi-turn repair | 构造多轮修复任务 | 状态连续、最终验证通过 | eval report |
| repeated failure | 连续失败两次 | failure history 保留并影响下一步 | trace |
| compaction under pressure | 中途强制压缩 | 压缩后继续完成 | replay / context |
| cost curve | 记录每轮 token/cost | 成本曲线可汇总 | cost report |
| no false final | 模型提前 final | eval 归因为 verification_missing | failure taxonomy |
| learning handoff | 输出学习者可读摘要 | 能解释每轮为何继续/压缩/恢复 | run record |

完成信号：

```text
长任务不是“多跑几轮”，而是有成本、状态和失败归因曲线。
```

---

## 6. Core 22：ToolRuntime Transaction + Patch Safety

目标：

```text
让工具修改从单次 edit 升级为可预览、可回滚、可事务化的安全写入。
```

必过验证：

| Case | 验证方法 | 预期结果 | 证据 |
| --- | --- | --- | --- |
| diff preview | edit 前生成 diff | 未批准前不写入 | diff artifact |
| transaction commit | 多文件修改一次提交 | 全部成功后才 commit | transaction log |
| rollback | 中途失败 | 文件恢复到事务前状态 | hash evidence |
| stale reread | 外部修改文件 | stale_file，要求 reread | tool result |
| protected file | 修改受保护 API | 被拒绝或要求审批 | policy result |
| bash risk class | 高风险命令 | 被拒绝或进入审批 | tool authorization |

完成信号：

```text
Agent 可以改代码，但每次修改都能解释、预览、失败恢复。
```

---

## 7. Core 23：Production ModelGateway + Budget Controller

目标：

```text
让模型调用从 adapter demo 升级为带预算、重试、fallback 和能力登记的 gateway。
```

必过验证：

| Case | 验证方法 | 预期结果 | 证据 |
| --- | --- | --- | --- |
| token budget gate | 请求超过预算 | 调用前拒绝或压缩 | budget report |
| cost budget gate | 估算超过成本 | 调用前拒绝或降级 | cost decision |
| retryable failure | mock 429/timeout | 按策略 retry | gateway trace |
| non-retryable failure | mock schema/tool invalid | 不盲目 retry | error report |
| fallback | primary failover | fallback provider 被使用 | provider trace |
| capability registry | 工具/streaming 支持不同 | 不支持能力不暴露 | model request |
| output repair boundary | 可修复 JSON 错误 | 修复后仍过 schema | parser evidence |

完成信号：

```text
每次模型调用都有预算和 provider 决策记录。
```

---

## 8. Core 24：Durable Session Store + Replay

目标：

```text
让 session 从内存状态升级为可持久化、可恢复、可审计的事实流。
```

必过验证：

| Case | 验证方法 | 预期结果 | 证据 |
| --- | --- | --- | --- |
| append-only event log | 写入多轮事件 | event sequence 不可重排 | session log |
| snapshot restore | 从 snapshot 恢复 | state 与原运行一致 | state diff |
| crash recovery | 中断后恢复 | pending action / active plan 保留 | replay result |
| trace replay | 重放旧 trace | 得到同等关键状态 | replay report |
| compaction audit | replay 压缩前后 | 可解释状态转换 | compaction diff |
| secret boundary | session 不落密钥 | 扫描无 secret | secret scan |

完成信号：

```text
任意一次运行都能从证据重建“发生了什么、为什么这样做”。
```

---

## 9. Core 25：Repo Intelligence + Relevance Index

目标：

```text
让 Context Engine 的输入从全文搜索升级为 repo-aware relevance。
```

必过验证：

| Case | 验证方法 | 预期结果 | 证据 |
| --- | --- | --- | --- |
| repo map | 扫描 fixture repo | 文件、脚本、规则入口被索引 | repo map |
| symbol index | 构造导出/引用 | 相关符号能定位 | symbol report |
| test index | package / scripts | 测试命令和测试文件关联 | test map |
| rule discovery | AGENTS / README | 项目规则进入 high priority | rule index |
| relevance scoring | 多个相似文件 | 正确文件排序更高 | score report |
| incremental update | 文件修改 | index 局部更新 | index trace |
| token benefit | 对比无 index context | 更少 token 选中正确文件 | context report |

完成信号：

```text
系统能解释“为什么这个文件相关”，而不是只说搜索命中了。
```

---

## 10. Core 26：Human Approval + Interruption Protocol

目标：

```text
让人工审批、用户打断和需求变更成为 Runtime 状态，而不是对话外事件。
```

必过验证：

| Case | 验证方法 | 预期结果 | 证据 |
| --- | --- | --- | --- |
| high-risk approval | 高风险 Bash / protected edit | 进入 approval_required | approval state |
| approve path | 用户批准 | 继续执行且留痕 | runtime trace |
| reject path | 用户拒绝 | 不执行并修订计划 | plan revision |
| interruption | 用户中途改目标 | 当前 step pause，生成 new constraint | session event |
| handoff | 任务未完成 | 输出可恢复 handoff | handoff artifact |
| no hidden execution | 审批前工具执行 | verify 必须失败 | policy assertion |

完成信号：

```text
人类协作行为进入可 replay 的 Runtime 状态。
```

---

## 11. 生产化升级总验收

Core 18-26 全部完成后，至少应该能证明：

```text
Context Engine 能解释 token / cache / eviction。
Compaction 能被质量评估发现坏摘要。
Plan 能 step-level 恢复和修订。
长任务 eval 能显示成本曲线和失败归因。
ToolRuntime 能事务化修改和回滚。
ModelGateway 能预算控制和 provider 决策。
Session 能持久化和 replay。
Repo Intelligence 能提升相关文件选择。
Human Approval 能进入 Runtime 状态。
```

仍然不能自动声称：

```text
达到 Claude Code 生产能力。
达到任意真实仓库 70%-80% 成功率。
已经有跨 agent RelativeScore。
```

这些需要后续更大规模 benchmark 和真实 reference-agent 对照。
