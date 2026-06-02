Title: Claude Code Core Lab Exercises
Type: tutorial-index
Layer: learner-practice
Mode: guide
Scope: repo
Status: active
Owner: project-maintainer
Source of Truth: yes
Related Files: docs/learning-plan.md, projects/capstone-mini-runtime/README.md, solutions/README.md

# 练习入口（Exercises）

这里是课程、Lab、Core 之后的实践层。它的目标不是替代课程正文，而是把学习动作从：

```text
读课程 -> 跑 verify
```

补成：

```text
读课程 -> 做任务 -> 看到失败 -> 修复 -> 对照参考解法 -> 跑 verify -> 复述边界
```

练习仍然遵守本项目的命名系统：

```text
course -> lab -> core -> exercise -> solution -> project
```

先读任务，再动手；不要一开始就看 `solutions/`。

---

## 1. 当前练习分区

| 路径 | 用途 |
| --- | --- |
| [course-00-05/](course-00-05/) | 产品心智、信息来源和 prompt / policy 边界练习 |
| [lab-to-core/](lab-to-core/) | 从 Lab 机制映射到 Core Runtime 的练习 |
| [core-01-12/](core-01-12/) | 最小 Core、模型网关、上下文、计划、压缩和评测练习 |
| [production-upgrade/](production-upgrade/) | Core 18-26 生产化证据链练习 |
| [product-surface/](product-surface/) | Core 27-31 产品表层运行时边界练习 |
| [../projects/capstone-mini-runtime/](../projects/capstone-mini-runtime/) | 端到端 capstone：最小 Search -> Read -> Edit -> Bash -> Verify Runtime |

---

## 2. 每门 Course 的最小练习入口

这张表只给最小动作。深入任务看上面的分区文档。

| Course | 最小练习 | 建议 verify |
| --- | --- | --- |
| course-00 | 找出一个“模型自然知道”的说法，并改写成可证明的信息来源 | `npm run verify:labs` |
| course-01 | 写出模型第一轮请求可见和不可见的 5 项内容 | `npm run lab:01:verify` |
| course-02 | 为一个工具动作写允许 / 拒绝理由 | `npm run lab:04:verify` |
| course-03 | 说明 prompt guidance 为什么不能授权危险 Bash | `npm run core:08:verify` |
| course-04 | 按 trace 顺序标注 UserGoal、ToolResult、Observation、Verification | `npm run core:verify` |
| course-05 | 把一次任务拆成用户、模型、运行时、工具、评测五层 | `npm run core:06:verify` |
| course-06 | 从 Lab 01-08 中选一个机制，说明它进入 Core 后职责是否变化 | `npm run verify:labs` |
| course-07 | 解释 Core 01 为什么是集成运行时，不是新的单机制 Lab | `npm run core:verify` |
| course-08 | 找出 ModelGateway 和 Context Engine 的边界 | `npm run core:02:verify`、`npm run core:03:verify` |
| course-09 | 标注一次 plan approval 和一次 compaction 保真的证据 | `npm run core:04:verify`、`npm run core:05:verify` |
| course-10 | 找出 false final 被 eval 捕获的证据 | `npm run core:06:verify` |
| course-11 | 比较 toy workspace 和 real repo fixture 多出的约束 | `npm run core:09:verify` |
| course-12 | 说明 starter eval packaging 为什么不是生产能力认证 | `npm run core:10:verify` |
| course-13 | 写出 RelativeScore 仍 blocked 的原因 | `npm run core:15:verify`、`npm run core:17:verify` |
| course-14 | 把 Core 18-26 画成一条生产化证据链 | `npm run core:18:verify`、`npm run core:26:verify` |
| course-15 | 解释 context economy、compaction quality 和 plan state 的依赖关系 | `npm run core:18:verify`、`npm run core:20:verify` |
| course-16 | 找出 no false final、transaction、budget gate 的共同边界 | `npm run core:21:verify`、`npm run core:23:verify` |
| course-17 | 说明 durable session、repo intelligence、human approval 如何互相补位 | `npm run core:24:verify`、`npm run core:26:verify` |
| course-18 | 为 settings / hooks / memory / checkpoint / subagent 各写一个 runtime boundary | `npm run core:27:verify` 到 `npm run core:31:verify` |

---

## 3. 练习完成定义

一个练习完成时，至少要有：

```text
任务说明
你观察到的初始失败或缺口
你做出的修改或判断
对应 verify 命令
一句话说明它不能证明什么
```

如果练习涉及真实模型、真实仓库或外部服务，不要把 API key、`.env.local`、provider raw response 或私有代码片段写进答案。
