# 文档索引

本文档负责导航，不替代各主题的 canonical doc。当前进度以 `../CURRENT_STATE.md` 为准；冲突优先级以 `authority-map.md` 为准。

## 第一次学习

- [项目首页](../README.md)
- [学习者入口](start-here-for-learners.md)
- [从零学习计划（Learning Plan）](learning-plan.md)
- [故障排查（Troubleshooting）](troubleshooting.md)
- [练习入口（Exercises）](../exercises/README.md)
- [capstone-mini-runtime](../projects/capstone-mini-runtime/README.md)
- [课程路线](course/claude-code-core-learning-path.md)
- [核心运行时对象地图（Core Runtime Object Map）](reference/core-runtime-object-map.md)
- [代码智能体实现逻辑（Code Agent Implementation Logic）](reference/code-agent-implementation-logic.md)
- [Claude Code 官方能力覆盖矩阵](reference/claude-code-capability-coverage-matrix.md)
- [项目结构说明](project-structure.md)
- [项目中文术语表（Chinese-First Terms）](production-upgrade-terms-zh.md)

## 当前规则

- [CURRENT_STATE.md](../CURRENT_STATE.md): 当前断点、最新验证、下一步动作。
- [AGENTS.md](../AGENTS.md): Agent / 维护者工作规则。
- [权威关系图（Authority Map）](authority-map.md): 文档冲突优先级。
- [开源边界](open-source-boundary.md): 对外能力声明、公开边界、secret 边界。
- [故障排查（Troubleshooting）](troubleshooting.md): 学习者遇到安装、验证、live model、capstone starter 或公开入口同步问题时的排查顺序。
- [开源项目规范](reference/open-source-project-standards.md): 把优秀 GitHub 项目经验转译成本项目的 README、reference、Issue、PR 和验证标准。
- [Claude Code 官方能力覆盖矩阵](reference/claude-code-capability-coverage-matrix.md): 官方公开能力、本项目 Course / Lab / Core 转译、verify 证据和 out-of-scope 边界。
- [生产化升级路线图](roadmap/production-upgrade-roadmap.md): Core 18-26 路线。
- [生产化升级验证矩阵](roadmap/production-upgrade-validation-matrix.md): Core 18-26 验证矩阵。
- [产品表层学习路线图](roadmap/product-surface-study-roadmap.md): Core 26 之后，如何从 Claude Code 产品工件中学习，并判断补旧课还是新建 Core。
- [产品表层验证矩阵](roadmap/product-surface-validation-matrix.md): 新阶段的证据层级、同主题合并规则和候选 Core 进入条件。
- [产品表层候选 Core 迷你简报（Mini Brief）](roadmap/product-surface-core-candidates.md): 设置、钩子、记忆、子代理、检查点（Settings / Hooks / Memory / Subagent / Checkpoint）是否值得独立成 Core 的评审。

## 学习材料

- [Course](course/): 课程主线，按 `course-00` 到 `course-18` 学。
- [Lab](lab/): 单机制实验说明。
- [Core](core/): Core 集成阶段记录。
- [Records](records/): 运行记录和验证记录。
- [Reference](reference/): 架构、实现、评测、开源项目规范和 Runtime 对象地图。
- [Releases](releases/): 公开 release note。
- [History](history/): 早期分析文章，只作背景。
- [Exercises](../exercises/README.md): Course / Lab / Core 之后的练习入口。
- [Projects](../projects/README.md): 端到端项目和 capstone。
- [Solutions](../solutions/README.md): 参考解法，先做练习后再看。

## 关键课程

- [Course 00 教学标准](course/course-00-teaching-standard.md)
- [Course 07 核心构建总览（Core Build Pass Overview）](course/course-07-core-build-pass-overview.md)
- [Course 12 评测打包和可执行种子（Eval Packaging And Executable Seeds）](course/course-12-eval-packaging-and-executable-seeds.md)
- [Course 13 评测、参考运行和成本证据（Eval Reference Cost Evidence）](course/course-13-eval-reference-cost-evidence.md)
- [Course 14 生产化升级证据链（Production Upgrade Evidence Chain）](course/course-14-production-upgrade-evidence-chain.md)
- [Course 15 上下文、压缩和计划生产化（Context Compaction Plan Production）](course/course-15-context-compaction-plan-production.md)
- [Course 16 长任务、工具和网关生产化（Long Running Tool Gateway Production）](course/course-16-long-running-tool-gateway-production.md)
- [Course 17 会话、仓库和批准生产化（Session Repo Approval Production）](course/course-17-session-repo-approval-production.md)
- [Course 18 产品表层实现链（Product Surface Implementation Chain）](course/course-18-product-surface-implementation-chain.md)
- [产品表层学习路线图（Product Surface Study Roadmap）](roadmap/product-surface-study-roadmap.md)
- [产品表层候选 Core（Product Surface Core Candidates）](roadmap/product-surface-core-candidates.md)
- [Core 27 设置与权限解析器（Settings Permission Resolver）](core/core-27-settings-permission-resolver.md)
- [Core 28 钩子生命周期（Hooks Lifecycle）](core/core-28-hooks-lifecycle.md)
- [Core 29 记忆来源（Memory Source）](core/core-29-memory-source-auto-memory.md)
- [Core 30 检查点回退（Checkpoint Rewind）](core/core-30-checkpoint-rewind.md)
- [Core 31 子代理上下文隔离（Subagent Context Isolation）](core/core-31-subagent-context-isolation.md)
- [核心运行时对象地图（Core Runtime Object Map）](reference/core-runtime-object-map.md)
- [开源项目规范（Open Source Project Standards）](reference/open-source-project-standards.md)
- [Claude Code 官方能力覆盖矩阵（Capability Coverage Matrix）](reference/claude-code-capability-coverage-matrix.md)
- [代码智能体实现逻辑（Code Agent Implementation Logic）](reference/code-agent-implementation-logic.md)

## 关键证据

- [Core 验证记录](records/core-run-record.md)
- [Lab 验证记录](records/labs-verification-record.md)
- [capstone-mini-runtime 参考解法验证](../solutions/capstone-mini-runtime/README.md)
- `../src/core/*.verify.mjs`
- `../src/lab*/**/*.verify.mjs`
- `../solutions/capstone-mini-runtime/mini-runtime.verify.mjs`
- `../src/core/settings-permission-resolver.verify.mjs`
- `../src/core/hooks-lifecycle.verify.mjs`
- `../src/core/memory-source-auto-memory.verify.mjs`
- `../src/core/checkpoint-rewind.verify.mjs`
- `../src/core/subagent-context-isolation.verify.mjs`

## 开源协作

- [GitHub 发布检查表](github-release-checklist.md)
- [v0.1 Learning Preview release note](releases/v0.1-learning-preview.md)
- [贡献指南](../CONTRIBUTING.md)
- [安全策略](../SECURITY.md)
- [行为准则](../CODE_OF_CONDUCT.md)
- [变更记录](../CHANGELOG.md)
- [许可证](../LICENSE)

## 说明

历史材料和验证记录默认不是当前规则入口。遇到冲突时，先看 [Authority Map](authority-map.md)，再回到对应课程、Core 文档和 verify 脚本。
