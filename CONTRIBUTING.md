# Contributing

感谢你想参与这个学习项目。本仓库的目标不是复刻 Claude Code 源码，而是围绕 Claude Code 的核心产品机制，构建一个可运行、可验证、可教学的本地 Agent Core。

## 贡献范围

欢迎贡献：

```text
课程解释的中文化和可读性改进
course -> lab -> core 主线里的缺口修补
deterministic local verify case
更清晰的 out-of-scope 边界
不含密钥和私有日志的错误复现
```

暂不接受：

```text
复制官方或第三方提取的 Claude Code prompt 原文
反编译、还原或粘贴非公开源码
提交 API key、token、.env.local 或带密钥的 trace
把本地 deterministic evidence 夸大成生产级 Claude Code 能力
没有真实第二 baseline 却添加 RelativeScore
```

## 开发流程

1. 先读 `CURRENT_STATE.md`、`docs/index.md`、`docs/authority-map.md`。
2. 找到最接近的 `docs/course/course-XX`、`docs/lab/lab-XX` 或 `docs/core/core-XX` 文档。
3. 修改实现时同时补对应 verify；只改教学文档时说明证据来源和边界。
4. 提交前至少运行：

```bash
git diff --check
```

修改 `package.json`、verify 脚本或核心运行链路时，运行：

```bash
npm run verify:all
```

## 文档标准

课程文档优先使用中文解释。英文术语可以保留，但要能对应到中文含义、代码字段或 verify case。

一门课程应该尽量包含：

```text
先运行什么
Execution Chain
Knowledge Provenance
Action Claim Contract
学习者应该亲手改哪里
本课最终要能回答的问题
```

## Secret 边界

`.env.local` 被 git 忽略，只能留在本机。不要把真实 API key、账号信息、provider token、原始私有日志或带 secret 的 trace 写入源码、文档、issue 或 PR。
