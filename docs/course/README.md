# 课程区

这里是学习主线。按编号顺序读即可：

```text
course-00 -> course-01 -> ... -> course-18
```

推荐入口：

- [从零学习计划](../learning-plan.md)
- [课程总路线](claude-code-core-learning-path.md)
- [Course 00 教学标准](course-00-teaching-standard.md)

课程分段：

| 范围 | 主题 |
| --- | --- |
| `course-00` | 教学标准，避免隐式信息 |
| `course-01` 到 `course-05` | Claude Code-like 产品心智模型 |
| `course-06` 到 `course-07` | 单机制实验如何集成成核心运行时 |
| `course-08` 到 `course-12` | 模型网关、上下文、计划、压缩、评测和真实仓库测试夹具 |
| `course-13` | 可执行任务集、参考智能体、成本和价格边界 |
| `course-14` 到 `course-17` | Core 18-26 生产化升级证据链，并为产品表层（Product Surface）后续课程提供生产化边界 |
| `course-18` | Core 27-31 产品表层实现链（Product Surface Implementation Chain），把设置、钩子、记忆、检查点和子代理（Settings / Hooks / Memory / Checkpoint / Subagent）讲成运行时对象（Runtime object）、状态（state）、边界（boundary）和验证证据（verify evidence） |

课程里的英文名词主要用于对应文件名、代码字段和验证脚本名。第一次学习时先看中文含义；不清楚的术语先查 [中文术语表](../production-upgrade-terms-zh.md)。

Core 26 之后的新学习方向先看 [产品表层学习路线图（Product Surface Study Roadmap）](../roadmap/product-surface-study-roadmap.md)。这条路线要求同主题优先补回已有课程；只有出现新的运行时边界（Runtime boundary）和可执行验证时，才新增 Core。Core 27 设置与权限解析器（Settings / Permission Resolver）、Core 28 钩子生命周期（Hooks Lifecycle）、Core 29 记忆来源（Memory Source）、Core 30 检查点与回退（Checkpoint / Rewind）和 Core 31 子代理上下文隔离（Subagent Context Isolation）已作为当前产品表层候选 Core 落地；细读它们时看 [Course 18 产品表层实现链（Product Surface Implementation Chain）](course-18-product-surface-implementation-chain.md)。
