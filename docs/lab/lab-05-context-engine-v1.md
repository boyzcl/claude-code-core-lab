# Lab 05 Context Engine v1：上下文选择和裁剪

目标：

```text
验证 Context Engine 不是“把所有东西拼进去”，而是按优先级选择、保留和裁剪。
```

运行：

```bash
npm run lab:05
npm run lab:05:verify
```

验证点：

| case | 证明什么 |
| --- | --- |
| hard context survives | 最新用户约束、active plan、失败、验证状态优先保留 |
| file inclusion | 只拼入被选择的已读文件 |
| long output artifact | 长输出转 artifact 引用 |
| memory relevance | 低相关 memory 不拼 |
| latest failure | 最新失败在小预算下仍保留 |

学习重点：

```text
上下文工程的核心不是多塞，而是让模型看到下一步决策最需要的事实。
```
