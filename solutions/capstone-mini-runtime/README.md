# capstone-mini-runtime 参考解法

参考解法实现了一个教学用 mini runtime：

```text
Search -> Read -> Edit -> Bash -> Verify
```

验证命令：

```bash
npm run project:capstone:solution:verify
```

它证明：

```text
fixture 初始测试会失败
运行时能找到 bug 文件
Edit 前必须 Read
Bash 只允许运行验证命令
最终回答必须绑定 Verify 通过
```

它不证明真实模型、真实大仓库、生产级补丁安全或 Claude Code 官方实现。
