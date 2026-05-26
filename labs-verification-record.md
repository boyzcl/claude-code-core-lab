# Labs Verification Record：全量 Lab 验证记录

运行日期：2026-05-22

一键验证命令：

```bash
npm run verify:labs
```

结果：

```text
lab-01: 4/4 passed
lab-02: 5/5 passed
lab-03: 5/5 passed
lab-04: 6/6 passed
lab-05: 5/5 passed
lab-06: 5/5 passed
lab-07: 5/5 passed
lab-08: 4/4 passed

total: 39/39 passed
```

每个 Lab 验证的核心机制：

| Lab | 核心机制 |
| --- | --- |
| Lab 01 | 最小 Runtime Loop 和 ToolResult 回灌 |
| Lab 02 | MessageStore、append-only、ToolCall/ToolResult 关联 |
| Lab 03 | 真实 Read/Search/Bash 工具和 Policy |
| Lab 04 | Edit 安全：read-before-write、唯一匹配、stale check |
| Lab 05 | Context Engine：优先级、裁剪、artifact |
| Lab 06 | Plan Mode：计划审批、工具权限、状态切换 |
| Lab 07 | Compaction：保留关键任务状态 |
| Lab 08 | Eval Runner：评分、失败类型、case schema |

这条 Lab 链证明：

```text
Claude Code-like Core 的最小机制已经能被逐层验证。
```
