# Core 09 Real Repo Task Layer：从 toy workspace 到真实仓库任务

Core 09 验证：

```text
CoreRuntime 不只能在固定 toy workspace 里跑通，还能处理更接近真实仓库的项目规则、git 状态、多文件定位、测试发现和用户中途改文件。
```

---

## 1. 本 Core 在课程层面要学什么

你要学会：

```text
真实仓库任务不是“知道某个文件然后修改一行”。
Agent 必须先理解项目规则、观察仓库状态、发现测试命令、定位多个候选文件，并处理中途变化。
```

Core 09 对应：

```text
Core 03 Context Engine Integration
Core 04 Plan Mode Integration
Core 08 Prompt Pack / Recovery Loop
Lab 04 Edit Tool Safety
Lab 08 Eval Runner
```

---

## 2. 本 Core 做什么

当前实现新增：

```text
1. createRealRepoFixtureWorkspace
2. RealRepoTaskModel
3. runRealRepoTaskDemo
4. verifyRealRepoTaskResult
5. core:09:verify
```

fixture workspace 包含：

```text
AGENTS.md
package.json
src/pricing.cjs
src/cart.cjs
scripts/test.cjs
.git
```

它比 toy workspace 多了几类真实因素：

```text
项目规则文件
package script 测试入口
多个源码候选文件
git status
初始测试失败
用户中途改文件导致 stale edit
```

---

## 3. Real Repo 任务链路

Core 09 demo 的目标：

```text
修复折扣计算错误，遵守项目规则，找到并运行正确测试。
```

运行链路：

```text
Bash git status --short
Read AGENTS.md
Read package.json
Search applyDiscount
Read src/pricing.cjs
Edit src/pricing.cjs
  -> stale_file
Read src/pricing.cjs
Edit src/pricing.cjs
Bash npm test
FinalAnswer
```

这证明：

```text
项目规则可以进入上下文。
测试命令可以从 package.json / rules 中发现。
多文件搜索可以返回多个候选。
stale edit 可以被检测和恢复。
最终回答必须由 npm test 的 passed verificationState 支撑。
```

---

## 4. 它守住了什么边界

Core 09 仍然不直接修改当前学习仓库。

```text
真实仓库任务层先使用受控 fixture workspace。
Runtime 只能在 workspaceRoot 内读写。
Bash 仍然只允许 allowlist 命令。
Edit 仍然需要 read-before-edit 和 stale check。
```

在这个 Core 里，允许的命令是：

```text
git status --short
npm test
```

不允许：

```text
npm install
任意 cd && command
危险 shell 命令
workspaceRoot 外路径
```

---

## 5. 运行入口

```bash
npm run core:09
npm run core:09:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 6. 验证点

`core:09:verify` 覆盖 6 个 case：

```text
1. real repo: task observes rules, recovers stale edit, and verifies
2. fixture: git status starts clean
3. fixture: npm test initially fails before fix
4. policy: real repo command allowlist denies unknown command
5. context: real repo run keeps project rules visible
6. runtime: final answer remains verification grounded
```

它们证明：

```text
fixture 是真实 git repo。
测试在修复前失败。
未知命令会被 allowlist 拒绝。
AGENTS.md 项目规则进入上下文。
用户中途改文件会触发 stale_file。
模型可以通过重新 Read 再 Edit 恢复。
最终回答基于 npm test passed。
```

---

## 7. 学习者应该观察什么

运行：

```bash
npm run core:09
```

重点看：

```text
toolSequence
Bash git status --short
Read AGENTS.md
Read package.json
Search applyDiscount 的多个 matches
Edit stale_file
第二次 Read / Edit
Bash npm test
verificationState
```

观察重点不是“这个 fixture 很复杂”，而是：

```text
真实仓库任务的复杂度来自环境发现、规则发现、测试发现和并发变化。
```

---

## 8. 过关自测问题

机制题：

```text
Core 09 和 toy workspace 最大区别是什么？
为什么要先 git status？
为什么要读 AGENTS.md 和 package.json？
```

边界题：

```text
为什么不能直接在当前学习仓库做破坏性真实修复？
为什么 npm install 应该被 allowlist 拒绝？
为什么 stale edit 必须重新 Read？
```

失败题：

```text
初始 npm test 失败说明什么？
stale_file 说明什么？
如果搜索返回多个候选文件，模型下一步应该怎么缩小范围？
```

一句话总结：

```text
Core 09 证明 Agent Core 开始面对真实仓库任务复杂度，但仍把读写、命令和验证权留在本地 Runtime。
```
