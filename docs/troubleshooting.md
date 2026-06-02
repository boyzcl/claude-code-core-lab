Title: Claude Code Core Lab Troubleshooting
Type: troubleshooting
Layer: learner-support
Mode: reference
Scope: repo
Status: active
Owner: project-maintainer
Source of Truth: yes
Related Files: README.md, docs/learning-plan.md, docs/open-source-boundary.md, AGENTS.md

# 故障排查（Troubleshooting）

本文只回答一件事：

```text
学习者跑不起来、验证失败、公开入口看起来不一致时，先按什么顺序排查。
```

它不替代 [CURRENT_STATE.md](../CURRENT_STATE.md)、[开源边界](open-source-boundary.md) 或具体课程 / Core 文档。遇到能力声明、secret 边界和当前断点冲突时，仍以这些 canonical 文档为准。

---

## 1. 先确认环境

症状：

```text
npm install 失败
npm run verify:labs 失败
node 命令不存在或版本过低
```

先跑：

```bash
node --version
npm --version
```

本项目当前 GitHub Actions 使用 Node 22。学习者本地不必完全相同，但如果遇到语法、模块或 ESM 相关错误，先升级到 Node 22 再复测。

恢复顺序：

```bash
npm install
npm run verify:labs
```

如果 `verify:labs` 已通过，再跑：

```bash
npm run verify:all
```

---

## 2. `npm run verify:all` 失败

症状：

```text
某个 lab:*:verify 或 core:*:verify 返回非 0
```

排查顺序：

1. 找到最先失败的脚本名。
2. 单独运行该脚本，例如：

```bash
npm run core:22:verify
```

3. 打开对应源码和文档：

```text
src/core/tool-runtime-transaction.verify.mjs
docs/core/core-22-tool-runtime-transaction.md
```

4. 只相信验证脚本、Core 文档和运行输出，不把历史材料当成当前规则。

常见原因：

| 症状 | 常见原因 | 下一步 |
| --- | --- | --- |
| 某个 assert 失败 | 行为和 verify case 不一致 | 看对应 `*.verify.mjs` 的 case 名和断言 |
| 找不到文件 | 工作目录不在仓库根目录 | 回到仓库根目录再运行命令 |
| ESM import 报错 | Node 版本过旧或用错运行方式 | 用 `npm run ...` 或升级 Node |
| 真实模型相关失败 | 误跑了 live 命令或 `.env.local` 缺配置 | 见第 3 节 |

---

## 3. 真实模型配置和 `.env.local`

`npm run core:07:verify` 不需要真实 API key。它验证的是模型适配器的本地契约。

会读取真实模型配置的是：

```bash
npm run core:07:live
```

如果你要运行 live 命令：

1. 从 [.env.example](../.env.example) 复制本地模板。
2. 写入 `.env.local`。
3. 确认 `.env.local` 没有进入 git tracking。

检查：

```bash
git status --short
```

不要把 API key、token、`.env.local`、真实 provider 响应、带密钥的 trace 或 raw log 写入源码、文档、运行记录或最终报告。

---

## 4. `git diff --check` 失败

症状：

```text
trailing whitespace
space before tab
```

处理方式：

1. 打开提示的文件和行号。
2. 删除行尾空格或不一致缩进。
3. 重新运行：

```bash
git diff --check
```

注意：`git diff --check` 默认检查 tracked diff。新增未跟踪文件也要人工确认没有行尾空格，或者在提交前让它们进入 diff 检查范围。

---

## 5. capstone starter 失败是不是坏了

不是。

[capstone-mini-runtime](../projects/capstone-mini-runtime/README.md) 刻意提供一个会失败的 starter。它的学习目标就是让你先看到失败，再实现 `Search -> Read -> Edit -> Bash -> Verify` 的最小运行时闭环。

预期失败命令：

```bash
node projects/capstone-mini-runtime/starter/mini-runtime.verify.mjs
```

参考解法验证命令：

```bash
npm run project:capstone:solution:verify
```

`npm run verify:all` 不包含 starter 失败用例；它继续只验证本项目已经完成的 Lab 和 Core deterministic evidence。

---

## 6. GitHub 首页显示旧状态

症状：

```text
本地 README / Course / Core 已更新，但 GitHub 默认页仍显示旧内容。
```

这通常不是文档内容错误，而是默认分支或远端同步状态问题。

排查顺序：

```bash
git status --short --branch
git branch -vv
```

发布前需要确认：

| 检查项 | 目的 |
| --- | --- |
| 当前分支是否包含最新入口文档 | 避免公开首页落后 |
| 默认分支是否已经合并最新学习入口 | 避免陌生学习者看到旧路线 |
| GitHub Actions 是否跑过 `verify:all` | 避免公开状态没有验证证据 |
| `docs/github-release-checklist.md` 是否通过 | 避免边界和 secret 检查遗漏 |

本仓库的工作规则是不在未获明确要求时提交或推送。若只是本地学习或本地整理，先完成文档和验证；是否合并到默认分支由维护者单独决定。

---

## 7. 文档太多，不知道先看哪里

按这个顺序：

1. [README](../README.md)
2. [学习者入口](start-here-for-learners.md)
3. [从零学习计划](learning-plan.md)
4. [练习入口](../exercises/README.md)
5. [capstone-mini-runtime](../projects/capstone-mini-runtime/README.md)

如果文档之间说法不同：

```text
当前进度 / 下一步：CURRENT_STATE.md
学习顺序 / 命名规则：docs/course/claude-code-core-learning-path.md
公开边界 / secret：docs/open-source-boundary.md、AGENTS.md、SECURITY.md
冲突优先级：docs/authority-map.md
行为证据：src/**/*.verify.mjs
```

---

## 8. 什么时候提交 issue

先确认你能提供这些信息：

```text
你运行的命令
失败的最小脚本
Node 和 npm 版本
失败输出中不含 secret 的关键片段
你已经查过的文档
```

不要提交：

```text
API key
.env.local
带认证信息的日志
真实 provider raw response
私有仓库路径和敏感代码片段
```

学习反馈走 GitHub learning feedback 模板；运行失败走 bug report 模板。
