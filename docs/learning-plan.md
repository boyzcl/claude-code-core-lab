# 从零学习计划（Learning Plan）：按节奏学完 Claude Code Core

本文给第一次学习者一条可执行学习节奏。它不替代 [学习者入口](start-here-for-learners.md)、[课程路线](course/claude-code-core-learning-path.md) 或每一门课程；它只回答：

```text
我今天该读哪几篇？
我该跑哪个命令？
我学完这一段应该能说清什么？
如果卡住了，应该回到哪里？
```

---

## 1. 先做准备

开始前先确认本地能跑：

```bash
npm install
npm run verify:labs
```

如果你想一次确认完整项目健康状态，再跑：

```bash
npm run verify:all
```

`verify:all` 会跑完所有实验（Lab）和核心阶段（Core）。第一次学习不需要每次都跑全量；每一节按表格跑对应命令即可。

---

## 2. 每次学习固定动作

每一节都按同一套动作走：

```text
1. 先读指定课程。
2. 再打开对应源码或 Core 文档。
3. 跑对应 verify 命令。
4. 看验证输出证明了什么。
5. 用三句话复述：
   这个机制解决什么问题？
   它落在哪个运行时对象（Runtime object）、状态（state）或边界（boundary）？
   它不能证明什么？
```

不要只读文章。这个项目的学习结果不是“知道名词”，而是能把名词落到代码对象、验证用例（verify case）和能力边界。

---

## 3. 七节主线学习法

这是默认推荐路线。每节大约 60 到 120 分钟，适合分 7 次学完。

| 节次 | 目标 | 读什么 | 跑什么 | 学完应该能回答 |
| --- | --- | --- | --- | --- |
| 0 | 建立入口和边界 | [README](../README.md)、[学习者入口](start-here-for-learners.md)、[Course 00](course/course-00-teaching-standard.md) | `npm run verify:labs` | 这个项目是什么，不是什么；为什么要中文先行、证据先行 |
| 1 | 理解产品心智模型 | `course-01` 到 `course-05` | `npm run lab:01:verify`、`npm run lab:02:verify` | 模型第一次被调用时看见什么；消息流为什么是事实源 |
| 2 | 从实验合成核心运行时 | `course-06`、`course-07` | `npm run verify:labs`、`npm run core:verify` | 8 个实验如何变成最小运行时；工具为什么必须受策略约束 |
| 3 | 处理模型、上下文、计划和压缩 | `course-08`、`course-09` | `npm run core:02:verify` 到 `npm run core:05:verify` | 模型网关（ModelGateway）、上下文引擎（Context Engine）、计划模式（Plan Mode）和压缩（Compaction）分别管什么 |
| 4 | 建立评测和真实仓库任务 | `course-10` 到 `course-12` | `npm run core:06:verify` 到 `npm run core:12:verify` | 为什么“修好了”必须由验证证明；真实仓库测试夹具（repo fixture）比玩具任务多证明什么 |
| 5 | 理解参考运行、成本和证据门槛 | `course-13` | `npm run core:13:verify` 到 `npm run core:17:verify` | 可执行任务集、参考智能体、成本估算和相对分数为什么不能乱声称 |
| 6 | 理解生产化升级链 | `course-14` 到 `course-17` | `npm run core:18:verify`、`npm run core:20:verify`、`npm run core:22:verify`、`npm run core:24:verify`、`npm run core:26:verify` | 上下文经济、计划状态、工具事务、持久会话和人工批准如何组成生产化证据链 |
| 7 | 理解产品表层实现链 | `course-18` | `npm run core:27:verify` 到 `npm run core:31:verify` | 设置、钩子、记忆、检查点、子代理如何落成运行时状态、强制边界和验证证据 |

---

## 4. 三种时间预算

### 4.1 只有 30 分钟

```text
README
学习者入口
Course 00
npm run verify:labs
```

目标不是学完，而是判断这个项目是否值得继续。

你应该能回答：

```text
这个项目为什么不是 Claude Code 官方源码？
为什么文档一直强调验证用例（verify case）？
为什么提示词（prompt）不能替代运行时策略？
```

### 4.2 只有半天

```text
Course 00
Course 01
Course 03
Course 07
Course 13
Course 14
Course 18
```

配套运行：

```bash
npm run core:10:verify
npm run core:18:verify
npm run core:31:verify
```

这条路线让你先抓住主干：教学标准、模型请求、提示词边界、核心构建、评测证据、生产化升级和产品表层。

### 4.3 想系统学完

按第 3 节的七节主线走。不要跳过验证脚本，也不要跳过每节最后的复述。

如果你已经读完一节，但说不清“不能证明什么”，说明还没真正学完这一节。

---

## 5. 每节的最小验收

| 阶段 | 最小验收 |
| --- | --- |
| Course 00-05 | 你能区分用户消息、系统提示词、运行时状态、工具结果、项目规则和模型先验 |
| Course 06-07 | 你能解释实验（Lab）和核心阶段（Core）的关系 |
| Course 08-12 | 你能从一次工具失败追到下一轮模型请求为什么会恢复 |
| Course 13-17 | 你能解释本地确定性证据（deterministic local evidence）和真实生产能力声明的区别 |
| Course 14-17 | 你能把 Core 18-26 讲成一条生产化升级证据链，而不是散功能 |
| Course 18 | 你能把产品表层（Product Surface）讲成设置、钩子、记忆、检查点、子代理各自的状态和边界 |

---

## 6. 卡住时回哪里

| 卡住点 | 回到哪里 |
| --- | --- |
| 不知道项目是什么 | [README](../README.md)、[学习者入口](start-here-for-learners.md) |
| 不知道课程顺序 | [课程路线](course/claude-code-core-learning-path.md)、[课程区 README](course/README.md) |
| 英文术语看不懂 | [项目中文术语表](production-upgrade-terms-zh.md) |
| 31 个 Core 太散 | [核心运行时对象地图](reference/core-runtime-object-map.md) |
| 想读完整叙事 | [代码智能体实现逻辑](reference/code-agent-implementation-logic.md) |
| 不知道某个文档谁说了算 | [权威关系图](authority-map.md) |
| 不知道验证结果 | [Core 验证记录](records/core-run-record.md) |

---

## 7. 不建议一开始读什么

第一次学习时，不建议先读：

```text
docs/history/
docs/reference/claude-code-core-implementation-blueprint.md
docs/reference/claude-code-70-80-validation-and-model-access.md
```

这些材料有价值，但更适合作为背景、扩展或复盘。先从课程和验证脚本建立主线，再读大型参考文档。

---

## 8. 学完整条路线后的结果

学完后，你应该能做四件事：

```text
1. 画出一次代码智能体任务从用户目标到最终验证的闭环。
2. 解释模型、运行时、工具、上下文、策略、计划、压缩、评测分别承担什么职责。
3. 从任意 Core 文档找到对应源码和验证用例。
4. 判断一个能力声明是否被本项目验证，还是仍属于不能声称的生产能力。
```

如果能做到这四件事，就说明你不是只读完了文档，而是真的学会了这套代码智能体核心构建逻辑。
