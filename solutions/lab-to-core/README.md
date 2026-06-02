# Lab 到 Core 参考答案要点

示例：Lab 04 到 Core 22。

| 项目 | 参考回答 |
| --- | --- |
| Lab 文件 | `docs/lab/lab-04-edit-tool-safety.md`、`src/lab04/edit-tool-safety.verify.mjs` |
| Lab 证明的单机制 | Edit 前必须 Read，Bash 必须经过 allowlist |
| 对应 Core 文件 | `docs/core/core-22-tool-runtime-transaction.md`、`src/core/tool-runtime-transaction.verify.mjs` |
| 进入 Core 后新增边界 | diff preview、多文件事务、rollback、stale reread、protected file approval、high-risk Bash routing |
| verify 证明了什么 | 工具运行时可以在提交前预览、在失败时回滚、在风险动作前要求批准 |
| verify 不能证明什么 | 不能证明真实生产仓库所有补丁都安全，也不能替代人工 code review |

对应验证：

```bash
npm run lab:04:verify
npm run core:22:verify
```

capstone 中的 `Search -> Read -> Edit -> Bash -> Verify` 是这条映射的最小综合练习。它只验证本地小 fixture，不声称生产级代码智能体能力。
