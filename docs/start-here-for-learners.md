# 学习者入口

本文给第一次打开仓库的人使用。当前进度和断点仍以 `../CURRENT_STATE.md` 为准。

## 这个项目是什么

这是一个 clean-room 学习项目，用 `course -> lab -> core` 的方式，从零构建一个 Claude Code-like 本地 coding agent core。

它不是：

```text
Claude Code 源码复刻
官方内部实现解析
生产级 Agent 产品
```

它是：

```text
一条可运行、可验证、可教学的 Agent Runtime 学习路径。
```

## 推荐学习顺序

1. 先读 `../README.md`，知道怎么安装和运行。
2. 再读 `../CURRENT_STATE.md`，知道项目当前完成到哪里。
3. 按 `../claude-code-core-learning-path.md` 的课程顺序读 `course-00` 到 `course-17`。
4. 每读到一个机制，就运行对应 `lab:*:verify` 或 `core:*:verify`。
5. 看到英文术语时，先找课程里的中文解释；Core 18-26 术语见 `production-upgrade-terms-zh.md`。

## 最小运行路径

```bash
npm install
npm run verify:all
```

如果只想先体验局部机制：

```bash
npm run verify:labs
npm run core:10:verify
npm run core:14:verify
npm run core:18:verify
npm run core:26:verify
```

## 如何读课程

课程不是博客，也不是实现备忘录。课程的读法是：

```text
先看本课解决什么问题。
再运行 verify。
再按 Execution Chain 追源码。
再看 Knowledge Provenance，确认每个 claim 来自哪里。
最后看 Action Claim Contract，确认哪些话不能说过头。
```

## 学完后应该获得什么

你应该能解释并实践：

```text
模型第一次被调用时看见什么。
工具为什么必须由 Runtime 执行，而不是 prompt 授权。
Context 如何选择、裁剪、附件化和模拟缓存。
Plan 为什么是状态机，不是计划文本。
Compaction 为什么要检查状态保真。
Eval 如何把能力声明变成可运行证据。
Reference-agent 和 RelativeScore 的证据门槛是什么。
Production Upgrade 为什么仍只是 deterministic local evidence，不是生产级能力认证。
```
