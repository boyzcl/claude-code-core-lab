# Core 18-26 练习：生产化证据链

这一组练习对应 Course 14 到 Course 17。目标是把 Core 18-26 看成一条生产化升级证据链，而不是九个散功能。

## 最小任务

把下面机制连成一张因果链：

```text
Context Economy
Compaction Quality
Plan State Machine
Long-Running Eval
ToolRuntime Transaction
ModelGateway Budget Controller
Durable Session Store
Repo Intelligence
Human Approval
```

每个机制写两句话：

```text
它解决什么生产化问题？
哪个 verify case 证明它没有说过头？
```

建议验证：

```bash
npm run core:18:verify
npm run core:20:verify
npm run core:22:verify
npm run core:24:verify
npm run core:26:verify
```
