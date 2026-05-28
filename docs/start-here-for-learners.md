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

## 怎么学习

推荐按四步走：

1. 读 `../README.md`，知道项目目标、结构和边界。
2. 读 `docs/course/claude-code-core-learning-path.md`，知道课程总路线。
3. 顺序学习 `docs/course/course-00...` 到 `docs/course/course-18...`。
4. 每读完一段，就运行对应 `npm run lab:*:verify` 或 `npm run core:*:verify`。

不要只读文档。这个项目的重点是：

```text
读课程 -> 跟源码 -> 跑验证脚本 -> 看证据 -> 复述边界
```

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

课程里保留了一些英文，是为了对应代码字段和 verify case 名称。

先按中文理解：

- `Context`：上下文，模型本轮看见的材料。
- `ToolRuntime`：工具运行时，真正读文件、改文件、跑命令的地方。
- `Compaction`：压缩，把长历史变成可恢复状态。
- `Plan State Machine`：计划状态机，记录每一步待处理、执行中、完成或受阻。
- `RelativeScore`：相对分数，必须有第二个真实智能体对照后才可能计算。

Core 18-26 的术语集中看 [Production Upgrade 中文术语表](production-upgrade-terms-zh.md)。

## 下一步

从这里开始：

1. [课程路线](course/claude-code-core-learning-path.md)
2. [Course 00 教学标准](course/course-00-teaching-standard.md)
3. [项目结构说明](project-structure.md)
