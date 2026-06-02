# Lab 到 Core 练习

这一组练习对应 Course 06 和 Course 07。目标是把单机制 Lab 映射到 Core Runtime，而不是把 Lab 名称机械搬进 Core。

## 任务 1：选一个 Lab，追到 Core

从 Lab 01-08 中任选一个，填写：

| 项目 | 你的回答 |
| --- | --- |
| Lab 文件 |  |
| Lab 证明的单机制 |  |
| 对应 Core 文件 |  |
| 进入 Core 后新增了哪些边界 |  |
| verify 证明了什么 |  |
| verify 不能证明什么 |  |

建议验证：

```bash
npm run verify:labs
npm run core:verify
```

## 任务 2：工具链闭环

用自己的话解释：

```text
Search -> Read -> Edit -> Bash -> Verify
```

为什么不是“模型直接修改文件”，而是运行时逐步执行工具、回灌观察并用验证落地。

建议下一步：做 [capstone-mini-runtime](../../projects/capstone-mini-runtime/README.md)。

参考答案入口：[solutions/lab-to-core/](../../solutions/lab-to-core/)。
