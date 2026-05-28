# Lab 07 Compaction v1：压缩时保留关键状态

目标：

```text
验证 compact 不是普通摘要，而是保留任务继续执行所需的关键状态。
```

运行：

```bash
npm run lab:07
npm run lab:07:verify
```

验证点：

| case | 证明什么 |
| --- | --- |
| hard state preserved | 目标、约束、计划、文件、失败、验证状态都保留 |
| failed verification | 失败验证不能被写成通过 |
| newer messages | 新消息不会被旧 summary 覆盖 |
| long output artifact | 长输出转 artifact |
| pending actions | 待办动作保留 |

学习重点：

```text
Compaction 的产品目标是不断上下文后不失忆，而不是让历史变短而已。
```
