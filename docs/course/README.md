# 课程区

这里是学习主线。按编号顺序读即可：

```text
course-00 -> course-01 -> ... -> course-18
```

推荐入口：

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
| `course-14` 到 `course-17` | Core 18-26 生产化升级证据链，并为 Product Surface 后续课程提供生产化边界 |
| `course-18` | Core 27-31 Product Surface Implementation Chain，把 Settings、Hooks、Memory、Checkpoint 和 Subagent 讲成 Runtime object、state、boundary 和 verify evidence |

课程里的英文名词主要用于对应文件名、代码字段和验证脚本名。第一次学习时先看中文含义；不清楚的术语先查 [中文术语表](../production-upgrade-terms-zh.md)。

Core 26 之后的新学习方向先看 [Product Surface Study Roadmap](../roadmap/product-surface-study-roadmap.md)。这条路线要求同主题优先补回已有课程；只有出现新的 Runtime 边界和可执行验证时，才新增 Core。Core 27 Settings / Permission Resolver、Core 28 Hooks Lifecycle、Core 29 Memory Source、Core 30 Checkpoint / Rewind 和 Core 31 Subagent Context Isolation 已作为当前 Product Surface 候选 Core 落地；细读它们时看 [Course 18 Product Surface Implementation Chain](course-18-product-surface-implementation-chain.md)。
