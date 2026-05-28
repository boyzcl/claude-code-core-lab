# Claude Code Core Lab

[![Verify](https://github.com/boyzcl/claude-code-core-lab/actions/workflows/verify.yml/badge.svg)](https://github.com/boyzcl/claude-code-core-lab/actions/workflows/verify.yml)

这是一个中文学习项目：围绕 Claude Code 这类代码智能体的核心机制，从零搭一个可运行、可验证、可复盘的本地核心运行时。

你可以把它理解成一套“动手学 Claude Code 产品机制”的课程和实验：

```text
先学 Claude Code 为什么不是普通聊天机器人
再手工推演一次代码任务怎么跑
再用 Lab 拆开单个机制
再把机制集成成 Core
最后用验证脚本证明每一步到底成立了什么
```

为了让项目能公开学习和长期维护，本仓库不复制 Claude Code 官方源码、私有提示词或非公开实现。它学习的是 Claude Code 暴露出来的产品问题和代码智能体运行时设计方法，并用我们自己写的代码和评测来复现核心闭环。

## 你会学到什么

学完后，你应该能用自己的话解释并动手验证：

- 模型第一次被调用时，到底看见哪些消息、工具、状态和规则。
- 工具为什么必须由运行时执行，而不是靠提示词口头授权。
- 上下文如何组装、裁剪、附件化，以及为什么有些内容可以稳定复用。
- 计划为什么是状态机，不是模型写的一段计划文本。
- 压缩为什么不是普通摘要，而是任务状态保真。
- 评测如何把“能力变强了”变成可运行证据。
- 参考智能体、成本估算、相对分数为什么都有严格证据门槛。
- Core 18-26 为什么是一条生产化升级证据链，而不是九个散功能。

## 适合谁

- 想系统理解 Claude Code / 代码智能体工作机制的学习者。
- 想从零实现一个本地代码智能体运行时的工程师。
- 想学习代码智能体产品如何做上下文、工具、权限策略、计划和评测的开发者。
- 想把 AI Coding 项目做成可验证、可教学、可开源项目的人。

不适合把它当成：

- Claude Code 官方源码。
- Claude Code 完整复刻。
- 可直接替代 Claude Code 的生产级产品。
- 真实厂商账单、真实 Claude Code baseline 或跨 Agent RelativeScore。

## 30 秒跑起来

环境要求：

```bash
node --version
npm --version
```

安装并运行全部本地验证：

```bash
npm install
npm run verify:all
```

如果看到命令正常结束，说明本地 Lab 和 Core 的确定性验证都可复现。当前完整记录见 [docs/records/core-run-record.md](docs/records/core-run-record.md)，最近一次记录是 `222/222 passed`。

## 你会得到什么结果

跑完和学完后，预期结果不是“得到一个 Claude Code 替代品”，而是：

- 你能在本地运行一套最小代码智能体核心。
- 你能读懂一次任务从用户输入、上下文组装、工具执行、计划更新到最终验证的链路。
- 你能用 `npm run core:*:verify` 证明某个机制到底成立了什么。
- 你能分清“本地确定性证据”和“真实生产能力声明”的差别。

## 推荐学习路线

第一次打开仓库，按这个顺序来：

1. 读 [学习者入口](docs/start-here-for-learners.md)，先建立整体地图。
2. 读 [课程路线](docs/course/claude-code-core-learning-path.md)，知道课程为什么这样排。
3. 从 [Course 00](docs/course/course-00-teaching-standard.md) 开始顺序读到 [Course 17](docs/course/course-17-session-repo-approval-production.md)。
4. 每读完一组机制，运行对应 Lab 或 Core 验证脚本。
5. 不懂英文术语时，看 [中文术语表](docs/production-upgrade-terms-zh.md)。

最小体验路径：

```bash
npm run verify:labs
npm run core:10:verify
npm run core:14:verify
npm run core:18:verify
npm run core:26:verify
```

## 项目结构

```text
.
├── README.md                     # GitHub 首页，先看这里
├── package.json                  # npm scripts，所有 verify 入口
├── src/                          # 可运行实现
│   ├── lab01 ... lab08           # 单机制实验
│   └── core/                     # 集成后的核心运行时实现和验证脚本
├── docs/
│   ├── course/                   # 课程主线：course-00 到 course-17
│   ├── lab/                      # Lab 说明：单机制怎么跑
│   ├── core/                     # Core 阶段记录：每个集成阶段证明什么
│   ├── records/                  # 验证记录
│   ├── roadmap/                  # 生产化升级路线和验证矩阵
│   ├── reference/                # 架构、实现和评测参考资料
│   └── history/                  # 早期分析文章，仅作背景
├── AGENTS.md                     # 给 Agent / 维护者看的工作规则
├── CURRENT_STATE.md              # 当前进度和恢复入口
└── .github/workflows/verify.yml  # GitHub Actions 验证
```

更详细的目录解释见 [项目结构说明](docs/project-structure.md)。
完整文档导航见 [docs/index.md](docs/index.md)，文档冲突和权威关系见 [docs/authority-map.md](docs/authority-map.md)。

## 核心命令

```bash
# 跑所有 Lab
npm run verify:labs

# 跑全部 Lab + Core，本项目最重要的健康检查
npm run verify:all

# 跑真实模型适配器的本地契约验证，不需要真实 API key
npm run core:07:verify

# 跑 Core 18-26 中的几个关键生产化证据
npm run core:18:verify
npm run core:22:verify
npm run core:24:verify
npm run core:26:verify
```

`npm run core:07:live` 会读取本地 `.env.local` 里的模型配置。`.env.local` 被 git 忽略，不能提交。可从 [.env.example](.env.example) 复制模板。

## 当前已经完成什么

- Lab 01-08：运行循环、消息事实流、读文件/搜索/命令、编辑安全、上下文、计划、压缩和评测。
- Core 01-12：把 Lab 机制集成成可运行核心运行时，并接入真实模型适配器、真实仓库测试夹具和评测打包。
- Core 13-17：完成 20/20 可执行入门评测任务集，记录 8 个 Codex local 参考运行，建立 token、成本和价格边界。
- Core 18-26：完成上下文经济、压缩质量、计划状态机、长任务评测、工具事务、模型预算闸门、会话重放、仓库理解和人工批准的本地确定性证据链。
- GitHub Actions：`npm run verify:all` 已接入 CI。

最新状态见 [CURRENT_STATE.md](CURRENT_STATE.md)，完整验证证据见 [Core 验证记录](docs/records/core-run-record.md)。

## 能力边界

本项目已经能证明很多代码智能体核心机制可以在本地稳定运行，但它仍然不是：

- Claude Code 官方实现。
- Claude Code 源码复刻。
- 生产级 Claude Code 替代品。
- 真实大仓库 70%-80% 成功率认证。
- 真实 Claude Code baseline。
- 真实厂商账单或模型服务真实缓存计费。
- 跨 Agent 相对分数（RelativeScore）。

更完整的公开表达边界见 [开源边界说明](docs/open-source-boundary.md)。

## 贡献

欢迎贡献中文教学、验证用例、文档结构和边界说明。提交前请读：

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [GitHub 发布检查表](docs/github-release-checklist.md)

提交前至少运行：

```bash
git diff --check
npm run verify:all
```
