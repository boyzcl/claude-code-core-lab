# Course 00-05 参考答案要点

## 任务 1：信息来源卡

参考要点：

```text
模型第一轮只能看见 Runtime 放进 ModelRequest 的消息、工具 schema、项目规则、系统提示词和硬状态。
ToolResult 不会凭空进入模型先验；它必须由 Runtime 写入消息事实流，并在下一轮上下文组装时被选入。
```

对应证据：

```bash
npm run lab:01:verify
npm run lab:02:verify
```

## 任务 2：prompt 不能替代 policy

参考要点：

```text
prompt guidance 可以提醒模型不要请求危险命令。
Policy 必须在工具执行前做 allow / ask / deny 判断。
ToolRuntime 必须返回结构化 denial，而不是把危险动作悄悄忽略。
```

对应证据：

```bash
npm run lab:04:verify
npm run core:08:verify
```

## 任务 3：五层拆解

参考要点：

| 层 | 职责 | 不能替代什么 |
| --- | --- | --- |
| User | 给出目标和约束 | 不能证明工具已经执行 |
| Model | 选择下一步动作或最终回答 | 不能直接读写文件 |
| Runtime | 组织上下文、状态和循环 | 不能伪造验证通过 |
| Tool | 执行读、搜、改、命令等动作 | 不能越过 Policy |
| Eval | 把能力声明变成可运行证据 | 不能证明未覆盖的生产能力 |
