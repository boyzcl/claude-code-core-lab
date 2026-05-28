# Lab 04 Edit Tool Safety：安全修改文件

目标：

```text
验证 Edit 不是字符串替换工具，而是受 Policy、ReadSnapshot 和结构化错误约束的写入工具。
```

运行：

```bash
npm run lab:04
npm run lab:04:verify
```

验证点：

| case | 证明什么 |
| --- | --- |
| happy path | Read 后 Edit 可以成功 |
| Edit before Read | 未读文件不能改 |
| old_string uniqueness | `old_string` 多处匹配时拒绝 |
| stale file | Read 后文件被外部改动时拒绝 |
| path safety | 越界路径拒绝 |
| exact replacement | 成功时只替换一处 |

学习重点：

```text
read-before-write 必须由 Tool/Policy 强制，不靠 prompt 自觉。
Edit 失败也必须返回结构化 ToolResult。
```
