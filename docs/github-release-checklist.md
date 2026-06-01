# GitHub 发布检查表

本文是开源到 GitHub 前的最小检查表。它不是当前进度事实源；当前状态仍看 `../CURRENT_STATE.md`。

## 1. 项目定位

- README 说明这是围绕 Claude Code 核心机制的中文学习项目。
- README 没有写成 Claude Code 源码复刻或官方实现。
- `docs/open-source-boundary.md` 已说明 capability claim 边界。
- `LICENSE`、`CONTRIBUTING.md`、`SECURITY.md`、`CODE_OF_CONDUCT.md` 存在。
- `CHANGELOG.md` 存在，并说明它不替代 `CURRENT_STATE.md`。
- `.github/ISSUE_TEMPLATE/` 和 `.github/PULL_REQUEST_TEMPLATE.md` 存在，并要求复现、证据和公开边界检查。

## 2. Secret 检查

- `.env.local` 不在 git tracking 中。
- 文档和源码不包含真实 API key、token、账号信息。
- 运行记录只保留结构化 evidence 和 hash，不提交私有 raw logs。
- `.env.example` 只包含空值或示例默认值。

## 3. 学习路径检查

- `course-00` 到 `course-18` 连续可导航。
- Core 13-17 有课程解释，不从 course-12 直接跳到 Production Upgrade。
- Core 18-26 有总览课和三门细课。
- Core 27-31 有 Product Surface execution-chain 细课。
- 英文术语有中文解释或中文上下文。

## 4. GitHub 读者体验检查

- README 第一屏能说明：这是围绕 Claude Code 核心机制的中文学习项目。
- README 能回答新用户最关心的五件事：项目是什么、怎么运行、怎么学习、会得到什么结果、不能期待什么。
- 根目录只保留入口、配置和源码目录，不把课程、记录和历史文章堆在第一屏。
- `docs/README.md`、`docs/index.md`、`docs/authority-map.md` 能把学习材料、当前规则、证据记录和历史背景分开。
- 普通中文学习者不需要先理解 `clean-room`、`Runtime`、`Context` 等英文词，也能知道下一步该读哪一页、跑哪条命令。
- `docs/reference/open-source-project-standards.md` 能说明本项目如何吸收 GitHub 典范经验但不照搬。
- `docs/reference/core-runtime-object-map.md` 能把 Lab 01 到 Core 31 收束为少数 Runtime object。

## 5. Evidence 边界检查

- 20/20 executable 不写成生产级 benchmark。
- codex-local baseline 不写成 Claude Code baseline。
- configured estimated USD 不写成真实厂商账单。
- cache simulation 不写成真实 provider cache billing。
- 没有第二 agent 真实 runs 前，不添加 RelativeScore。

## 6. 验证

至少运行：

```bash
git diff --check
```

开源前推荐运行：

```bash
npm run verify:all
```

GitHub Actions 会运行：

```text
npm install
git diff --check
npm run verify:all
```

## 7. 发布前最后检查

- `git status --short` 中没有意外的密钥、日志、压缩包或 node_modules。
- README 的 Quick Start 可以在干净 clone 后执行。
- `CURRENT_STATE.md` 的断点和下一步动作与实际一致。
- `docs/index.md` 和 `docs/authority-map.md` 能路由所有新增文档。
