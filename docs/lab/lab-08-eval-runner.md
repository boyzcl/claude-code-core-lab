# Lab 08 Eval Runner：用评测证明能力

目标：

```text
验证 Agent 能力不是靠感觉判断，而是通过 EvalCase、运行结果、分数和失败类型判断。
```

运行：

```bash
npm run lab:08
npm run lab:08:verify
```

验证点：

| case | 证明什么 |
| --- | --- |
| score and failure type | Eval Runner 能产生分数和失败类型 |
| case schema | eval case 必须有基本字段 |
| all-pass suite | 全通过时 score=1 |
| unexpected command failure | 非预期失败记录为 command_failed |

学习重点：

```text
Trace/Eval 是产品迭代层。没有 Eval，就无法证明 70%-80% 能力是否达成。
```
