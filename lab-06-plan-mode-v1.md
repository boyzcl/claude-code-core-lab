# Lab 06 Plan Mode v1：计划是产品状态

目标：

```text
验证 Plan Mode 不是让模型写一段计划，而是 Runtime 的模式和审批状态。
```

运行：

```bash
npm run lab:06
npm run lab:06:verify
```

验证点：

| case | 证明什么 |
| --- | --- |
| valid plan approved | 合格 plan 可进入 execute |
| Edit denied in plan | plan mode 禁止写入工具 |
| vague plan invalid | 空泛计划不能通过 |
| rejected plan | 被拒绝的 plan 不能再次执行 |
| active plan | approved plan 成为执行上下文 |

学习重点：

```text
Plan Mode 的关键是审批、状态切换和工具权限，而不是“计划文本”本身。
```
