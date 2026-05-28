# Core 05 Compaction / Artifact Integration：长任务不断片

Core 05 验证：

```text
Compaction 不是普通摘要，而是把继续执行任务所需的关键状态迁移到下一轮上下文。
```

---

## 1. 本 Core 做什么

Core 05 把 Lab 07 的 compact 思想接入 `CoreRuntime`。

当前实现支持：

```text
1. CoreCompactor 按 messageThreshold 判断是否需要 compact
2. compact 时生成 compactSummary、artifacts、newerMessages
3. compactSummary 进入 coreState.compactSummary
4. artifacts 进入 coreState.compactionArtifacts
5. Context Engine 会把 compact summary 作为上下文材料
6. MessageStore 不被改写，仍然保留完整事实流
```

---

## 2. 运行入口

```bash
npm run core:05
npm run core:05:verify
```

---

## 3. 验证点

`core:05:verify` 覆盖 5 个 case：

```text
1. compactor preserves hard state and artifacts long output
2. compaction triggers before model request
3. failed verification cannot become passed after compact
4. newer messages remain available after compact
5. compact summary does not replace latest user message
```

它们证明：

```text
compact 保留目标、约束、active plan、修改文件、失败、验证状态和 pending actions。
长输出会转 artifact。
失败验证不会被写成通过。
新消息不会被旧 summary 覆盖。
```

---

## 4. 学习重点

你要学会：

```text
Compaction 不是让历史变短。
Compaction 是让 Agent 在上下文收缩后仍然知道任务怎么继续。
```

一句话：

```text
MessageStore 负责完整事实，compact summary 负责恢复继续执行所需的任务状态。
```
