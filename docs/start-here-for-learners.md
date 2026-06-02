# 学习者入口

如果你是第一次打开这个仓库，请先看这一页。

## 一句话

这个项目教你用中文、用可运行代码、用可验证实验，理解并重建 Claude Code 这类代码智能体的核心机制。

它不是要告诉你“Claude Code 官方源码内部就是这样写的”，而是带你学会：

```text
为什么 Claude Code 能持续读代码、改代码、跑命令、处理失败、保持上下文、做计划、做验证。
```

## 先跑起来

```bash
npm install
npm run verify:all
```

如果全部通过，说明这个项目的课程配套代码和验证脚本在你本地可复现。

如果卡在安装、Node 版本、验证脚本、真实模型配置或 capstone starter，先看 [故障排查（Troubleshooting）](troubleshooting.md)。

## 先选一种学习方式

你不需要一口气读完所有课程。按你现在的精力选一种：

| 方式 | 适合谁 | 怎么做 | 你会得到什么 |
| --- | --- | --- | --- |
| 30 分钟快速确认 | 只想判断项目值不值得继续 | 读 README、本页和 Course 00；运行 `npm run verify:labs` | 知道项目目标、边界和本地验证是否能跑 |
| 半天主线体验 | 想看到完整闭环但不深挖所有细节 | 读 Course 00、01、03、07、13、14、18；运行 `npm run core:10:verify`、`core:18:verify`、`core:31:verify` | 知道课程为什么这样排，以及 Core 如何用 verify 证明机制 |
| 系统学习 | 想真的复刻学习过程 | 按 Course 00 到 Course 18 顺序读；每一组课程都跟源码、练习和 verify | 能复述从模型请求（ModelRequest）到产品表层核心阶段（Product Surface Core）的完整证据链，并完成 capstone |

如果你希望有人把学习节奏排成表，直接看 [从零学习计划（Learning Plan）](learning-plan.md)。它把本页的三种方式拆成 30 分钟、半天和七节主线学习法。
如果你已经读完一组课程，下一步看 [练习入口（Exercises）](../exercises/README.md)；想做端到端任务时，看 [capstone-mini-runtime](../projects/capstone-mini-runtime/README.md)。

学习节奏建议：

```text
一次只学一组，不要把 course-00 到 course-18 当成一天内读完的长文档。
每读完一组，只问三个问题：
  1. 这个机制解决什么问题？
  2. 它落在哪个运行时对象（Runtime object）、状态（state）或边界（boundary）？
  3. 哪个验证用例（verify case）证明它成立，哪些能力不能声称？
```

## 怎么学习

推荐按四步走：

1. 读 `../README.md`，知道项目目标、结构和边界。
2. 读 `docs/course/claude-code-core-learning-path.md`，知道课程总路线。
3. 顺序学习 `docs/course/course-00...` 到 `docs/course/course-18...`。
4. 每读完一段，就做对应练习，并运行 `npm run lab:*:verify` 或 `npm run core:*:verify`。

不要只读文档。这个项目的重点是：

```text
读课程 -> 跟源码 -> 做练习 -> 跑验证脚本 -> 看证据 -> 复述边界
```

每一阶段都可以用这个小验收判断是否该继续：

| 阶段 | 可以继续的信号 |
| --- | --- |
| Course 00-05 | 你能解释模型“知道”某件事的信息来源，而不是说“模型自然知道” |
| Course 06-12 | 你能从一个验证用例（verify case）找到对应源码对象和断言 |
| Course 13-17 | 你能说清哪些是本地 deterministic evidence，哪些不是生产能力声明 |
| Course 18 | 你能把设置、钩子、记忆、检查点、子代理（Settings / Hooks / Memory / Checkpoint / Subagent）都讲成运行时状态（Runtime state）和强制边界（enforced boundary） |

## 学习路线总览

| 阶段 | 文档 | 你要搞懂什么 |
| --- | --- | --- |
| 先建立标准 | `course-00` | 怎么避免“模型知道”“Agent 应该”这种含糊说法 |
| 产品心智模型 | `course-01` 到 `course-05` | Claude Code-like 产品的模型、工具、状态、上下文和验证循环 |
| Lab 到 Core | `course-06` 到 `course-07` | 8 个单机制实验如何合成一个最小核心运行时 |
| 主体机制 | `course-08` 到 `course-12` | 模型网关、上下文、计划、压缩、评测和真实仓库测试夹具 |
| 评测和对照 | `course-13` | 可执行任务种子、参考智能体、成本口径和价格边界 |
| 生产化升级 | `course-14` 到 `course-17` | 上下文经济、会话重放、仓库理解、人工批准等证据链 |
| 产品表层 Core | `course-18` / `core-27` 起 | settings / permission、hooks、memory、checkpoint、subagent 等产品表层机制如何先过 validation matrix 再实现；Core 27 / 28 / 29 / 30 / 31 已有 execution-chain 示例 |

## 你最终会得到什么

学完后，你应该能做到：

- 画出一次 Claude Code-like 任务从用户输入到最终验证的完整链路。
- 解释模型、运行时、工具、权限策略、上下文、计划和评测分别负责什么。
- 写出一个最小本地代码智能体核心，并知道每个边界为什么存在。
- 用验证用例证明一个机制是否真的成立。
- 判断一个代码智能体项目的能力声明有没有证据支撑。

## 你不会得到什么

这个项目不会给你：

- Claude Code 官方源码。
- 官方 Prompt 原文。
- 一个能直接替代 Claude Code 的产品。
- 真实生产环境成功率。
- 没有第二 Agent 实跑就得出的 RelativeScore。

这些不是缺陷，而是边界。边界守住了，项目才能公开学习、复现和协作。

## 看不懂英文术语怎么办

课程里保留了一些英文，是为了对应代码字段和验证用例（verify case）名称。

先按中文理解：

- `Context`：上下文，模型本轮看见的材料。
- `ToolRuntime`：工具运行时，真正读文件、改文件、跑命令的地方。
- `Compaction`：压缩，把长历史变成可恢复状态。
- `Plan State Machine`：计划状态机，记录每一步待处理、执行中、完成或受阻。
- `RelativeScore`：相对分数，必须有第二个真实智能体对照后才可能计算。

Core 18-26 的术语集中看 [Production Upgrade 中文术语表](production-upgrade-terms-zh.md)。

## 下一步

从这里开始：

1. [从零学习计划（Learning Plan）](learning-plan.md)
2. [课程路线](course/claude-code-core-learning-path.md)
3. [Course 00 教学标准](course/course-00-teaching-standard.md)
4. [练习入口（Exercises）](../exercises/README.md)
5. [capstone-mini-runtime](../projects/capstone-mini-runtime/README.md)
6. [项目结构说明](project-structure.md)
