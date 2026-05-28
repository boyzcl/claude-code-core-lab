# Core 04 Plan Mode Integration：把计划审批接入 Runtime 权限

Core 04 验证：

```text
Plan Mode 不是模型写一段计划，而是 Runtime 的状态、审批和工具权限机制。
```

---

## 1. 本 Core 做什么

Core 04 把 Lab 06 的 `PlanController` 接入 `CoreRuntime`。

当前实现支持：

```text
1. 模型输出 type="plan"
2. Runtime 校验 plan
3. plan 可被 autoApprovePlan 模式批准
4. approved plan 进入 coreState.activePlan
5. plan mode 下 Edit / Write / Bash 会被拒绝
6. approved plan 会进入 Context Engine 的 active_plan block
```

默认 CoreRuntime 不启用 Plan Mode，因此不会破坏 Core 01-03。

---

## 2. 运行入口

```bash
npm run core:04
npm run core:04:verify
```

---

## 3. 验证点

`core:04:verify` 覆盖 5 个 case：

```text
1. approved plan enables full fix and verification
2. Edit is denied before plan approval
3. vague plan is recorded and does not execute
4. approved plan appears in context snapshots
5. rejected plan cannot be approved
```

它们证明：

```text
计划审批不是展示文本。
它会影响 Runtime mode、activePlan、Context Engine 和工具权限。
```

---

## 4. 学习重点

你要学会：

```text
Plan 负责把“准备怎么做”变成 Runtime 可检查状态。
批准前写操作不能执行。
批准后的 plan 要进入上下文，约束后续执行。
被拒绝或无效的 plan 不能变成 execute 权限。
```

一句话：

```text
Plan Mode 是执行权限的状态机，不是 prompt 礼貌用语。
```
