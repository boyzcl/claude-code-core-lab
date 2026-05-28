# Production Upgrade Roadmap：Core 18-26 生产化升级路线

本文是 Core 18-26 的生产化升级总控文档。它不替代 `CURRENT_STATE.md` 的当前断点，也不替代未来每个 `core-XX-*.md` 的阶段记录。

它回答：

```text
为什么下一阶段从 reference-agent 对比转向 Runtime 生产化？
Core 18-26 各自解决什么问题？
这些阶段之间有什么依赖？
每个阶段完成后应该证明什么？
哪些能力仍然不在本阶段承诺范围内？
```

当前判断：

```text
第二 reference-agent baseline 有价值，但本地可用性和外部工具依赖较重。
当前更高收益的方向是把 Context / Plan / Compaction / Eval / ToolRuntime / ModelGateway / Session / Repo Intelligence / Human Approval 从 starter 级推向更接近生产级。
```

---

## 1. 升级目标

Core 01-17 已经证明：

```text
Claude Code-like Core 的最小闭环可以运行。
Lab 机制可以集成成 CoreRuntime。
20/20 starter eval cases 已经 executable。
8 个 codex-local reference runs 已有 cost basis 和本地 pricing estimate。
```

Core 18-26 的目标不是继续扩 demo 数量，而是补齐生产级 Runtime 的关键属性：

```text
省 token：上下文更准、更稳定、更可缓存。
稳状态：计划、压缩、会话和 replay 不丢关键事实。
敢改代码：工具执行可预览、可回滚、可解释。
能控预算：模型调用有 budget、retry、fallback 和 cost gate。
找得准：repo intelligence 提升相关文件选择质量。
可协作：人类审批、打断和需求变化进入 Runtime 状态。
可证明：每个生产化能力都有 executable verification。
```

---

## 2. Core 18-26 总览

| Core | 名称 | 生产化问题 | 主要依赖 | 完成后得到 |
| --- | --- | --- | --- | --- |
| Core 18 | Context Economy + Cache-Aware Context Engine | token 节省、稳定前缀、cache-aware block 组织 | Core 03, 05, 16, 17 | 带 token/cached-token 模拟和 eviction reason 的 Context Engine |
| Core 19 | Compaction Quality Eval | 压缩不是普通摘要，而是可验证的状态保真 | Core 05, 06, 18 | compaction 前后目标、约束、失败、计划、文件和下一步动作可对照 |
| Core 20 | Plan State Machine | plan 从一次性审批升级为 step-level 状态机 | Core 04, 05, 19 | plan step 可追踪、阻塞、修订、恢复 |
| Core 21 | Long-Running Task Eval | 长任务中的恢复、压缩和成本曲线可评估 | Core 06, 18, 19, 20 | 长任务 eval seeds 和成本/状态曲线证据 |
| Core 22 | ToolRuntime Transaction + Patch Safety | 多文件修改可预览、可回滚、可防 stale | Core 04, 09, 20, 21 | edit transaction、diff preview、rollback 和安全写入证据 |
| Core 23 | Production ModelGateway + Budget Controller | provider 调用可重试、限时、限额、降级 | Core 02, 07, 16, 17, 18 | token/cost budget gate、retry/fallback 和 provider capability registry |
| Core 24 | Durable Session Store + Replay | crash / handoff 后可以恢复和审计 | Core 05, 06, 20, 22, 23 | append-only session snapshots、replay 和 trace 对照 |
| Core 25 | Repo Intelligence + Relevance Index | 大仓库中找准上下文，少塞无关文件 | Core 09, 18, 21, 24 | repo map、symbol/test/rule index 和 relevance scoring |
| Core 26 | Human Approval + Interruption Protocol | 高风险动作、需求变化和用户打断进入 Runtime | Core 20, 22, 24, 25 | approval state、interrupt handling、plan revision 和 handoff protocol |

---

## 3. 推荐执行顺序

固定主线：

```text
Core 18 -> Core 19 -> Core 20 -> Core 21 -> Core 22 -> Core 23 -> Core 24 -> Core 25 -> Core 26
```

原因：

```text
Core 18 先解决 context / token / cache，因为后续所有能力都依赖上下文质量。
Core 19 紧接着验证 compaction 保真，否则长任务状态不可相信。
Core 20 把 plan 变成状态机，为长任务、工具事务和人工审批打基础。
Core 21 用长任务 eval 把前面三层放进压力场。
Core 22 解决真实改代码的安全性。
Core 23 解决模型调用预算和 provider 稳定性。
Core 24 让 session 可持久化和可 replay。
Core 25 用 repo intelligence 提升 context selection 的输入质量。
Core 26 把人类审批和打断接入 Runtime 状态。
```

允许的小调整：

```text
如果 Core 18 中发现 repo relevance 是主要瓶颈，可以为 Core 25 提前做最小 repo map spike，但不提前宣称 Core 25 完成。
如果 Core 22 工具事务需要 session snapshots，可以先在 Core 22 内做局部 transaction log，但 Durable Session 的 canonical 仍在 Core 24。
如果真实 provider budget 信息不足，Core 23 先用 deterministic provider fixture 和本地 pricing table 证明预算边界。
```

---

## 4. 每个 Core 的统一完成定义

每个 Core 阶段完成必须满足：

```text
1. 有对应 `core-XX-*.md`，说明问题、机制、边界、验收和下一步。
2. 有对应 `src/core/*.mjs` 实现，不只是文档描述。
3. 有对应 `src/core/*.verify.mjs`，至少覆盖 happy path、边界、回归和 out-of-scope guard。
4. `package.json` 暴露 demo 和 verify 脚本。
5. `npm run verify:all` 通过。
6. `CURRENT_STATE.md`、`docs/records/core-run-record.md`、`README.md`、`docs/index.md` 和必要 authority 文档同步。
7. 学习者可以运行 demo / verify，并用一句话复述“这证明了什么”。
```

不满足以上任一条，不认为该 Core 完成。

---

## 5. 学习节奏

每个 Core 的学习节奏：

```text
先读阶段文档。
再运行 demo。
再运行 verify。
再看 verify 输出中的 case。
再回到代码看实现边界。
最后复述：
  这个 Core 解决了什么生产级问题？
  哪些证据证明它解决了？
  哪些仍然 out of scope？
```

不要把后续学习变成“只看实现 diff”。这条路线的学习价值在于理解 Runtime 为什么要这样切分职责。

---

## 6. 关键设计原则

### 6.1 生产级不是“大而全”

本阶段追求的是：

```text
更真实的约束。
更强的状态保真。
更可解释的失败。
更可重复的验证。
```

不是一次性做：

```text
完整 Claude Code 复刻。
远端 session 产品。
完整企业权限系统。
完整 MCP marketplace。
GUI 产品化。
```

### 6.2 Prompt 不能替代 Runtime

Core 18-26 仍然延续前序边界：

```text
Prompt 可以给模型指导。
Runtime / Policy / ToolRuntime / ModelGateway / Eval 才能强制边界。
```

尤其是：

```text
节省 token 不能靠一句“请简洁”。
安全修改不能靠一句“请小心”。
压缩保真不能靠一句“请总结重点”。
预算控制不能靠一句“请少花钱”。
```

### 6.3 先证明局部机制，再声称能力

任何生产级声明必须绑定证据：

```text
verify case
runtime trace
context snapshot
cost/token report
diff / transaction log
session replay output
eval report
```

没有证据的能力，只能写成目标或 out of scope。

---

## 7. 不做范围

Core 18-26 暂不承诺：

```text
真实 Claude Code 横向 RelativeScore。
生产级 70%-80% 成功率认证。
任意真实仓库复杂任务自动完成。
真实厂商账单精确复现。
完整 GUI / IDE 插件。
完整远端多用户 session。
完整 enterprise policy。
```

如果后续要重新纳入，必须新增独立 roadmap 或 Core 阶段。

---

## 8. 与验证矩阵的关系

具体可执行验收以 `docs/roadmap/production-upgrade-validation-matrix.md` 为准。

本文件负责：

```text
路线、依赖、原则和范围。
```

验证矩阵负责：

```text
每个 Core 的必过检查、验证方法、证据留存和失败判定。
```

未来每个 `core-XX-*.md` 必须引用或继承验证矩阵里的对应条目。

---

## 9. 当前进度和下一步

Core 26 已完成 deterministic local verification：

```text
high-risk approval_required
approve path
reject path
interruption
handoff
no hidden execution
```

Core 18-26 Production Upgrade Roadmap Pass 已完成当前 deterministic local evidence 主线：

```text
Core 18 Context Economy + Cache-Aware Context Engine
Core 19 Compaction Quality Eval
Core 20 Plan State Machine
Core 21 Long-Running Task Eval
Core 22 ToolRuntime Transaction + Patch Safety
Core 23 Production ModelGateway + Budget Controller
Core 24 Durable Session Store + Replay
Core 25 Repo Intelligence + Relevance Index
Core 26 Human Approval + Interruption Protocol
```

下一步可以进入：

```text
复盘 Core 18-26 证据链，并选择下一条路线：真实 repo benchmark、第二 reference-agent baseline，或更完整的 approval / policy 产品层。
```
