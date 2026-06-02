# 项目结构说明

这个仓库按“GitHub 用户先看得懂、学习者能顺序学习、维护者能找到证据”的方式组织。

## 根目录

| 路径 | 用途 |
| --- | --- |
| `README.md` | GitHub 首页，说明项目是什么、怎么运行、怎么学习 |
| `CHANGELOG.md` | 面向发布和治理变化的人工变更记录，不替代当前状态 |
| `package.json` | 所有 Lab / Core / verify 命令 |
| `assets/` | README 和公开文档使用的图片资产 |
| `src/` | 真正可运行的实现和验证脚本 |
| `docs/` | 课程、记录、路线、参考资料 |
| `AGENTS.md` | 给 Agent 和维护者看的工作规则 |
| `CURRENT_STATE.md` | 当前进度和恢复入口 |
| `scripts/` | 本地检查脚本，例如 docs link check |
| `.github/workflows/verify.yml` | GitHub Actions 全量验证 |
| `.github/ISSUE_TEMPLATE/` | bug report 和 learning feedback 模板 |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR 证据、边界和导航检查 |
| `.env.example` | live model 本地配置模板 |
| `exercises/` | Course / Lab / Core 之后的练习入口 |
| `projects/` | 端到端学习项目和 capstone |
| `solutions/` | 参考解法，先做练习后再看 |

根目录不再堆满课程和阶段记录。第一次访问 GitHub 的用户应该能先看懂入口，而不是被几十个 Markdown 文件淹没。

## docs 根入口

`docs/` 根目录保留少量跨分区入口：

```text
docs/start-here-for-learners.md
docs/core-logic-map.md
docs/learning-plan.md
docs/troubleshooting.md
docs/index.md
docs/authority-map.md
docs/production-upgrade-terms-zh.md
docs/open-source-boundary.md
```

其中 `core-logic-map.md` 是第一机制总览：先讲 Claude Code-like Agent 的完整逻辑链路，再把代码和 verify 作为证据入口。`learning-plan.md` 只负责学习节奏：30 分钟、半天和七节主线学习法。课程顺序仍以 `docs/course/claude-code-core-learning-path.md` 为准，行为证据仍以 `src/**/*.verify.mjs` 为准。

## assets

公开文档图片资产。

```text
assets/diagrams/
```

当前 README 第一视觉使用 `assets/diagrams/claude-code-core-mechanism.png`。它是 GPT 生成视觉底图加本地确定性标签排版，不是官方 Claude Code 架构图或源码映射。

## docs/course

课程主线。按编号顺序读：

```text
course-00 -> course-01 -> ... -> course-18
```

课程负责回答：

```text
这个机制为什么存在？
它在 Claude Code-like 代码智能体产品里解决什么问题？
学习者应该如何运行、追源码、看证据？
哪些能力不能说过头？
```

## docs/lab

Lab 是单机制实验。

例如：

```text
docs/lab/lab-03-read-search-bash.md
docs/lab/lab-04-edit-tool-safety.md
docs/lab/lab-07-compaction-v1.md
```

Lab 的作用是让你先拆开一个小机制，不直接跳进完整 Core。

## docs/core

Core 是集成阶段记录。

例如：

```text
docs/core/core-18-context-economy-cache-aware-context-engine.md
docs/core/core-24-durable-session-store-replay.md
docs/core/core-26-human-approval-interruption-protocol.md
docs/core/core-27-settings-permission-resolver.md
docs/core/core-28-hooks-lifecycle.md
docs/core/core-29-memory-source-auto-memory.md
docs/core/core-30-checkpoint-rewind.md
docs/core/core-31-subagent-context-isolation.md
```

Core 文档负责说明：

```text
这一阶段实现了什么？
verify 证明了什么？
还没有证明什么？
```

## docs/records

验证记录。

```text
docs/records/core-run-record.md
docs/records/labs-verification-record.md
lab-*-run-record.md
```

这些记录是证据，不是新规则。能力声明仍要回到课程、Core 文档和验证脚本。

## docs/releases

公开发布说明。

```text
docs/releases/v0.1-learning-preview.md
```

Release note 只浓缩某个公开版本的课程、Lab、Core、实践层、验证结果和边界，不替代 `CURRENT_STATE.md` 或验证记录。

## docs/roadmap

路线和验证矩阵。

```text
docs/roadmap/production-upgrade-roadmap.md
docs/roadmap/production-upgrade-validation-matrix.md
```

当项目进入一条新路线时，应先写路线图和验证矩阵，再写实现。

## docs/reference

架构和实现参考。

这些文档比课程更长、更像设计资料。第一次学习不需要逐字读完，遇到实现问题时再查。

其中 `code-agent-implementation-logic.md` 负责用一篇当前综合文章讲完整代码智能体（Code Agent）搭建逻辑；`open-source-project-standards.md` 负责把优秀 GitHub 项目经验转译成本项目规范；`core-runtime-object-map.md` 负责把 Lab 01 到 Core 31 收束成少数运行时对象（Runtime object）。
`claude-code-capability-coverage-matrix.md` 负责把官方公开能力、本项目 Course / Lab / Core 转译、verify 证据和 out-of-scope 边界放在同一张表里。

当前解释性文档采用中文先行、英文括注；历史材料保留原语境，不作为当前术语规范入口。

## docs/history

早期分析文章，只作背景材料。

这些文章可以帮助理解项目怎么来的，但不覆盖当前规则、课程和验证证据（verify evidence）。

## exercises

练习层。它不替代 Course、Lab 或 Core，而是在每组学习材料之后提供最小动手任务。

```text
exercises/course-00-05/
exercises/lab-to-core/
exercises/core-01-12/
exercises/production-upgrade/
exercises/product-surface/
```

练习完成定义是：能说清任务、初始失败或缺口、修复或判断、对应 verify 命令，以及它不能证明什么。

## projects

端到端项目层。

当前项目：

```text
projects/capstone-mini-runtime/
```

capstone starter 可以预期失败；它是学习材料，不接入 `npm run verify:all`。

## solutions

参考解法层。

```text
solutions/course-00-05/
solutions/lab-to-core/
solutions/capstone-mini-runtime/
```

参考解法只在学习者先做过任务后使用。它们不是新的 current rule，也不替代 `src/**/*.verify.mjs` 的行为证据。

## scripts

本地检查脚本。

```text
scripts/check-doc-links.mjs
```

当前 `npm run docs:links` 只检查 Markdown 内部相对链接是否存在；外部链接只计数，不在 CI 中抓取外网。

## src

源码结构和课程结构对应：

```text
src/lab01 ... src/lab08
src/core/*.mjs
src/core/*.verify.mjs
```

学习时不要只读 Markdown。每个机制都应该回到 `src/` 里看它怎么被验证。
