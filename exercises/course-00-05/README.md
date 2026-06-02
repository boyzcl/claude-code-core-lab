# Course 00-05 练习：产品心智和信息来源

这一组练习对应 Course 00 到 Course 05。目标是先学会把“模型应该知道”改写成可检查的信息来源和运行时边界。

## 任务 1：信息来源卡

读 Course 00 和 Course 01 后，写一张信息来源卡：

| 问题 | 你的回答 |
| --- | --- |
| 用户目标是什么 |  |
| 模型第一轮可见什么 |  |
| 模型第一轮不可见什么 |  |
| ToolResult 在第几轮才进入模型可见上下文 |  |
| 哪个 verify 脚本证明这个顺序 |  |

建议验证：

```bash
npm run lab:01:verify
npm run lab:02:verify
```

## 任务 2：prompt 不能替代 policy

读 Course 02 和 Course 03 后，选择一个危险工具动作，分别写：

```text
prompt guidance 可以提醒什么
Policy 必须强制什么
ToolRuntime 必须返回什么结构化结果
```

建议验证：

```bash
npm run lab:04:verify
npm run core:08:verify
```

## 任务 3：五层拆解

读 Course 04 和 Course 05 后，把一次任务拆成：

```text
User
Model
Runtime
Tool
Eval
```

完成信号：你能说清每一层做了什么，以及它不能越权替代哪一层。

参考答案入口：[solutions/course-00-05/](../../solutions/course-00-05/)。
