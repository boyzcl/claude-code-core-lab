Title: Claude Code Capability Coverage Matrix
Type: reference
Layer: reference
Mode: public-boundary
Scope: learning-system
Status: active
Owner: project-maintainer
Source of Truth: yes
Related Files: docs/open-source-boundary.md, docs/course/claude-code-core-learning-path.md, docs/reference/core-runtime-object-map.md, src/core/*.verify.mjs

# Claude Code 官方能力覆盖矩阵

本文回答：

```text
Claude Code 官方公开能力，在本项目里被转译成了哪些 Course / Lab / Core？
哪些 verify 证据能证明本地教学实现？
哪些能力仍然 out-of-scope，不能对外声称？
官方依据来自哪里？
```

边界先说清：

```text
本矩阵只使用官方公开文档和 Anthropic 官方公开文章作为来源。
它不使用官方 Prompt 原文、source map、反编译源码、非公开日志或第三方提取材料。
本项目的证据是 deterministic local evidence，不是 Claude Code 官方实现证明。
```

---

## 1. Source Evidence

核对日期：2026-06-02。

| ID | 官方来源 | 本项目使用方式 |
| --- | --- | --- |
| S1 | [Claude Code overview](https://code.claude.com/docs/en/overview) | 只作为产品能力和使用定位来源 |
| S2 | [Common workflows](https://code.claude.com/docs/en/common-workflows) | 只作为常见代码任务工作流来源 |
| S3 | [Settings](https://code.claude.com/docs/en/settings) | 只作为配置和权限规则入口来源 |
| S4 | [Permission modes](https://code.claude.com/docs/en/permission-modes) | 只作为权限模式和工具批准边界来源 |
| S5 | [Memory](https://code.claude.com/docs/en/memory) | 只作为 memory / project memory 能力来源 |
| S6 | [Hooks](https://code.claude.com/docs/en/hooks) | 只作为 hook lifecycle 能力来源 |
| S7 | [Subagents](https://code.claude.com/docs/en/sub-agents) | 只作为 subagent 能力来源 |
| S8 | [MCP](https://code.claude.com/docs/en/mcp) | 只作为外部工具 / server 扩展能力来源 |
| S9 | [Checkpointing](https://code.claude.com/docs/en/checkpointing) | 只作为 checkpoint / restore 能力来源 |
| S10 | [GitHub Actions](https://code.claude.com/docs/en/github-actions) | 只作为 CI / GitHub 工作流集成来源 |
| S11 | [IDE integrations](https://code.claude.com/docs/en/ide-integrations) | 只作为 IDE 集成能力来源 |
| S12 | [Troubleshooting](https://code.claude.com/docs/en/troubleshooting) | 只作为官方排查入口类型参考 |

---

## 2. Coverage Matrix

| 官方能力类目 | 官方来源 | 本项目教学转译 | 本地 verify 证据 | Out-of-scope 边界 |
| --- | --- | --- | --- | --- |
| 代码智能体闭环：理解目标、读代码、改代码、运行命令并继续迭代 | S1, S2 | Course 01-05, Course 07, Lab 01-04, Core 01 | `npm run lab:01:verify`, `npm run lab:03:verify`, `npm run lab:04:verify`, `npm run core:verify` | 不声称复刻 Claude Code 官方运行时、UI 或完整产品能力 |
| 工具调用与工具结果回灌 | S1, S2 | Course 01, Course 04, Lab 01-03, Core 01-03 | `npm run lab:01:verify`, `npm run lab:02:verify`, `npm run core:02:verify`, `npm run core:03:verify` | 不声称官方 tool schema 或官方 Prompt 内部格式 |
| 安全编辑和命令执行边界 | S2, S4 | Course 02, Course 04, Lab 04, Core 09, Core 22, Core 26 | `npm run lab:04:verify`, `npm run core:09:verify`, `npm run core:22:verify`, `npm run core:26:verify` | 不声称生产级 patch safety、企业审批系统或真实沙箱隔离 |
| 计划、探索、执行和验证工作流 | S2, S4 | Course 02, Course 04, Course 09, Core 04, Core 20, Core 21 | `npm run core:04:verify`, `npm run core:20:verify`, `npm run core:21:verify` | 不声称官方 plan mode 内部状态机或所有长任务成功率 |
| 上下文组装、仓库规则和长输出处理 | S1, S2 | Course 08-11, Lab 05, Lab 07, Core 03, Core 05, Core 18, Core 25 | `npm run lab:05:verify`, `npm run lab:07:verify`, `npm run core:03:verify`, `npm run core:18:verify`, `npm run core:25:verify` | 不声称真实 provider cache billing、完整代码智能索引或官方上下文算法 |
| 模型接入和 provider boundary | S1 | Course 08, Course 10, Core 02, Core 07, Core 23 | `npm run core:02:verify`, `npm run core:07:verify`, `npm run core:23:verify` | 不声称官方模型路由、真实厂商账单、真实 provider 缓存成本 |
| 本地评测、trace 和能力声明证据 | S2 | Course 10-13, Lab 08, Core 06, Core 10-17 | `npm run lab:08:verify`, `npm run core:06:verify`, `npm run core:10:verify` 到 `npm run core:17:verify` | 不声称生产级 70%-80% benchmark、Claude Code baseline 或跨 agent RelativeScore |
| 设置、权限规则和允许 / 询问 / 拒绝 | S3, S4 | Course 18, Core 27 | `npm run core:27:verify` | 不声称企业策略产品、官方配置格式完整兼容或 GUI permission product |
| Memory / project memory / long-term context source | S5 | Course 09, Course 18, Core 29 | `npm run core:29:verify` | 不声称官方 memory 文件格式、远端多用户 memory 服务或隐私合规系统 |
| Hooks lifecycle | S6 | Course 18, Core 28 | `npm run core:28:verify` | 不声称 shell hook 产品、任意脚本沙箱、插件系统或官方 hook 实现 |
| Subagents / delegated work | S7 | Course 18, Core 31 | `npm run core:31:verify` | 不声称远端 worker 隔离、生产调度器、agent marketplace 或官方 subagent 实现 |
| Checkpoint / restore / rewind | S9 | Course 18, Core 30 | `npm run core:30:verify` | 不声称 IDE 级 checkpoint product、跨机器恢复、分布式 session store 或官方实现 |
| MCP / 外部工具生态 | S8 | Course 03, Course 08, Course 18; 当前只作为边界和扩展方向 | 无独立 MCP verify；由 `npm run core:02:verify` 和 `npm run core:08:verify` 证明 tool schema / prompt boundary 的本地前置机制 | 不声称实现 MCP marketplace、远端 MCP server 管理或官方 MCP 兼容产品 |
| GitHub Actions / CI 工作流 | S10 | README, GitHub workflow, Core 10 packaging, docs link check | `npm run core:10:verify`, `npm run docs:links`, `npm run verify:all` | 不声称官方 Claude Code GitHub Action 集成或云端 agent PR flow |
| IDE integrations | S11 | 当前只在能力矩阵和 out-of-scope 中登记 | 无 IDE integration verify | 不声称 IDE 插件、编辑器 UI、诊断面板或官方 IDE 集成 |
| Troubleshooting / support path | S12 | `docs/troubleshooting.md`, GitHub issue contact links | `npm run docs:links` 证明入口可达；运行问题仍靠对应 verify 输出定位 | 不声称覆盖官方所有错误码或真实服务状态问题 |

---

## 3. Capability Claim Rules

对外可以说：

```text
本项目把 Claude Code 官方公开能力转译成本地可学习的 Course / Lab / Core / verify evidence。
```

不能说：

```text
本项目复刻了 Claude Code 官方实现。
本项目验证了真实 Claude Code baseline。
本项目实现了官方 Prompt、source map 或内部工具协议。
本项目已经达到生产级代码智能体能力。
```

当 README、release note 或课程材料要新增能力声明时，先补本矩阵：

```text
官方能力来源 -> 本项目 Course/Core/Lab -> verify evidence -> out-of-scope -> source evidence
```

如果缺任意一项，该能力只能写成研究方向或第二阶段之后的 backlog。
