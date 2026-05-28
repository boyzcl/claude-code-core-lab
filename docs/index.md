# 文档索引

本文档负责导航，不替代各主题的 canonical doc。当前进度以 `../CURRENT_STATE.md` 为准；冲突优先级以 `authority-map.md` 为准。

## 第一次学习

- [项目首页](../README.md)
- [学习者入口](start-here-for-learners.md)
- [课程路线](course/claude-code-core-learning-path.md)
- [项目结构说明](project-structure.md)
- [中文术语表](production-upgrade-terms-zh.md)

## 当前规则

- [CURRENT_STATE.md](../CURRENT_STATE.md): 当前断点、最新验证、下一步动作。
- [AGENTS.md](../AGENTS.md): Agent / 维护者工作规则。
- [权威关系图（Authority Map）](authority-map.md): 文档冲突优先级。
- [开源边界](open-source-boundary.md): 对外能力声明、公开边界、secret 边界。
- [生产化升级路线图](roadmap/production-upgrade-roadmap.md): Core 18-26 路线。
- [生产化升级验证矩阵](roadmap/production-upgrade-validation-matrix.md): Core 18-26 验证矩阵。

## 学习材料

- [Course](course/): 课程主线，按 `course-00` 到 `course-17` 学。
- [Lab](lab/): 单机制实验说明。
- [Core](core/): Core 集成阶段记录。
- [Records](records/): 运行记录和验证记录。
- [Reference](reference/): 架构、实现和评测参考。
- [History](history/): 早期分析文章，只作背景。

## 关键课程

- [Course 00 教学标准](course/course-00-teaching-standard.md)
- [Course 07 Core Build Pass Overview](course/course-07-core-build-pass-overview.md)
- [Course 12 Eval Packaging And Executable Seeds](course/course-12-eval-packaging-and-executable-seeds.md)
- [Course 13 Eval Reference Cost Evidence](course/course-13-eval-reference-cost-evidence.md)
- [Course 14 Production Upgrade Evidence Chain](course/course-14-production-upgrade-evidence-chain.md)
- [Course 15 Context Compaction Plan Production](course/course-15-context-compaction-plan-production.md)
- [Course 16 Long Running Tool Gateway Production](course/course-16-long-running-tool-gateway-production.md)
- [Course 17 Session Repo Approval Production](course/course-17-session-repo-approval-production.md)

## 关键证据

- [Core 验证记录](records/core-run-record.md)
- [Lab 验证记录](records/labs-verification-record.md)
- `../src/core/*.verify.mjs`
- `../src/lab*/**/*.verify.mjs`

## 开源协作

- [GitHub 发布检查表](github-release-checklist.md)
- [贡献指南](../CONTRIBUTING.md)
- [安全策略](../SECURITY.md)
- [行为准则](../CODE_OF_CONDUCT.md)
- [许可证](../LICENSE)

## 说明

历史材料和验证记录默认不是当前规则入口。遇到冲突时，先看 [Authority Map](authority-map.md)，再回到对应课程、Core 文档和 verify 脚本。
