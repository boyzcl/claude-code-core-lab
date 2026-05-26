# Course 11 Real Repo Task Layer：从 verify case 跟踪受控真实仓库任务

> 本课对应 Core 09。
>
> 本课目标：你要能从 `npm run core:09:verify` 进入源码，跟踪真实 repo fixture 如何比 toy workspace 多证明项目规则、测试发现、多文件定位、stale edit 恢复和验证落地。

---

## 0. 本课跟踪哪条执行链

Core 09 解决的问题不是“任意真实仓库都能做”，而是先把 toy workspace 推进到一个受控真实 repo fixture。

```text
toy workspace:
  单文件
  固定测试命令
  没有 git 状态
  没有项目规则
  没有用户中途改文件

real repo fixture:
  git repo
  AGENTS.md 项目规则
  package.json 脚本
  多个相似文件
  Bash allowlist
  stale_file 恢复
  npm test 验证
```

本课主线：

```text
createRealRepoFixtureWorkspace
  -> RealRepoTaskModel scripted decisions
  -> CoreRuntime tool loop
  -> CoreToolRuntime stale check / Bash allowlist
  -> Context Engine 保留项目规则
  -> verifyRealRepoTaskResult
```

一句话：

```text
Core 09 不是泛化真实世界。
它是在一个可重复 fixture 里证明真实仓库任务的关键边界开始进入 Runtime。
```

---

## 1. 先运行什么

```bash
npm run core:09:verify
```

然后读：

```text
src/core/real-repo-task.verify.mjs
src/core/real-repo-task.mjs
src/core/core-runtime.mjs
src/core/prompt-pack.mjs
```

读法：

```text
先看 verify case 名字。
再看 fixture 创建了哪些文件。
再看 RealRepoTaskModel 每一步为什么输出那个工具。
最后看 verifyRealRepoTaskResult 检查了哪些真实 repo 边界。
```

---

## 2. Execution Chain A1：fixture repo 到底创建了什么

对应 case：

```text
src/core/real-repo-task.verify.mjs
fixture: git status starts clean
fixture: npm test initially fails before fix
```

入口：

```text
createRealRepoFixtureWorkspace()
```

它创建临时目录，并写入：

```text
AGENTS.md
package.json
src/pricing.cjs
src/cart.cjs
scripts/test.cjs
```

`AGENTS.md` 里有项目规则：

```text
Do not change public API exports.
Prefer the smallest fix.
Use `npm test` for verification.
```

`package.json` 里有：

```text
scripts.test = "node scripts/test.cjs"
```

`src/pricing.cjs` 初始 bug：

```text
function applyDiscount(price, percent) {
  return price - percent;
}

module.exports = { applyDiscount };
```

测试期待：

```text
applyDiscount(200, 10) === 180
totalWithDiscount(..., 25) === 150
```

所以初始 `npm test` 应该失败。

fixture 最后执行：

```text
git init
git add .
git commit -m init
```

verify 用 `CoreToolRuntime` 直接执行：

```text
Bash { command: "git status --short" }
```

期望：

```text
stdout === ""
```

再执行：

```text
Bash { command: "npm test" }
```

期望：

```text
status === "error"
exitCode === 1
```

这个 case 钉住的边界是：

```text
Core 09 的任务不是空想 repo。
它有真实文件、真实 git 初始化、真实失败测试。
```

---

## 3. Execution Chain A2：完整真实 repo 任务如何跑

对应 case：

```text
src/core/real-repo-task.verify.mjs
real repo: task observes rules, recovers stale edit, and verifies
```

入口：

```text
runRealRepoTaskDemo()
  -> createRealRepoFixtureWorkspace()
  -> new RealRepoTaskModel()
  -> new CoreRuntime({
       workspaceRoot,
       model,
       tools: new CoreToolRuntime({
         allowedCommands: ["git status --short", "npm test"]
       }),
       contextEngine: createPromptPackContextEngine({ budget: 8000 }),
       maxTurns: 12
     })
  -> runtime.run("修复折扣计算错误，遵守项目规则，找到并运行正确测试。")
```

`RealRepoTaskModel` 按固定顺序输出工具：

```text
1. Bash git status --short
2. Read AGENTS.md
3. Read package.json
4. Search applyDiscount
5. Read src/pricing.cjs
6. 模拟用户中途改文件
7. Edit src/pricing.cjs -> stale_file
8. Read src/pricing.cjs
9. Edit src/pricing.cjs -> success
10. Bash npm test
11. FinalAnswer
```

这条链路比 toy workspace 多了几个真实仓库动作：

```text
观察 git 状态。
读取项目规则。
读取 package.json 找测试入口。
Search 返回多个候选。
处理用户中途改文件导致的 stale snapshot。
运行 npm test，而不是固定 toy command。
```

verify 检查：

```text
git_status_observed === true
project_rules_read === true
test_command_discovered === true
stale_edit_recovered === true
verification_passed === true
```

这个 case 钉住的边界是：

```text
真实仓库任务必须先获取 repo 事实，再编辑，再验证。
模型不能只凭任务描述猜文件和命令。
```

---

## 4. Execution Chain A3：为什么要先 git status

对应 case：

```text
fixture: git status starts clean
real repo: task observes rules, recovers stale edit, and verifies
```

`RealRepoTaskModel` 第一轮：

```text
Bash { command: "git status --short" }
```

`CoreToolRuntime` 只有这些 allowlisted commands：

```text
git status --short
npm test
```

执行成功后，ToolResult 进入 MessageStore。完整 run 的 verify 最后检查：

```text
bashCommands === ["git status --short", "npm test"]
```

教学意义：

```text
真实 repo 里，Agent 应该先知道工作区状态。
这不是模型常识，而是 Bash ToolResult 给出的事实。
```

当前 fixture 初始是 clean：

```text
stdout === ""
```

但这个 case 的重点不是 clean 本身，而是：

```text
Runtime 支持把 git 状态作为任务事实纳入工具链。
```

---

## 5. Execution Chain A4：项目规则如何进入模型视野

对应 case：

```text
src/core/real-repo-task.verify.mjs
context: real repo run keeps project rules visible
```

模型第二轮读取：

```text
Read { path: "AGENTS.md" }
```

`Read` ToolResult 包含：

```text
# Project Rules
Use `npm test` for verification
Do not change public API exports
```

这个 ToolResult 写入 MessageStore。随后 Context Engine 会把已读文件作为 file block：

```text
file:AGENTS.md
```

verify 检查两个地方：

```text
requestText includes "Project Rules"
requestText includes "Use `npm test` for verification"
selectedText includes "file:AGENTS.md"
```

这个 case 钉住的边界是：

```text
模型不是天然知道项目规则。
规则必须通过 Read -> ToolResult -> MessageStore -> Context Engine 进入 ModelRequest。
```

---

## 6. Execution Chain A5：package.json 如何帮助发现测试命令

完整任务链里第三轮：

```text
Read { path: "package.json" }
```

`package.json` 里有：

```text
"scripts": {
  "test": "node scripts/test.cjs"
}
```

同时 AGENTS.md 也写了：

```text
Use `npm test` for verification.
```

最后模型运行：

```text
Bash { command: "npm test" }
```

verify 检查：

```text
bashCommands === ["git status --short", "npm test"]
coreState.verificationState.command === "npm test"
finalAnswer includes "npm test"
```

这个 case 钉住的边界是：

```text
测试命令来自 repo 文件和项目规则，不是 toy runtime 写死给模型。
```

注意：

```text
CoreToolRuntime 仍然用 allowlist 强制只能跑 git status --short 和 npm test。
模型发现命令不等于模型获得任意 shell 权限。
```

---

## 7. Execution Chain A6：Search 返回多个候选有什么意义

模型第四轮：

```text
Search { query: "applyDiscount" }
```

fixture 中至少两个文件会出现：

```text
src/pricing.cjs
src/cart.cjs
```

因为：

```text
pricing.cjs 定义 applyDiscount
cart.cjs 引用 applyDiscount
```

verify 检查：

```text
search.content.matches.length >= 2
```

这个 case 钉住的边界是：

```text
真实仓库定位不是只有一个显然目标。
Search 给出候选，模型还要通过 Read 判断该改定义文件还是调用文件。
```

当前脚本模型选择：

```text
Read src/pricing.cjs
```

教学重点是：

```text
Search 是定位入口，不是编辑授权。
Edit 仍然必须建立在 Read snapshot 上。
```

---

## 8. Execution Chain A7：stale_file 如何保护用户中途修改

这是 Core 09 最重要的真实协作边界。

模型先读：

```text
Read src/pricing.cjs
```

`CoreToolRuntime.#read` 会保存 snapshot：

```text
snapshots.set(path, {
  text,
  hash
})
```

然后 `RealRepoTaskModel` 在第一次 Edit 前模拟用户修改：

```text
#simulateUserChange(workspaceRoot)
```

它把文件改成：

```text
function applyDiscount(price, percent) {
  return price - percent;
}

// user note: keep applyDiscount export stable
module.exports = { applyDiscount };
```

接着模型尝试用旧 snapshot Edit。

`CoreToolRuntime.#edit` 会重新读当前文件，并比较：

```text
hash(currentText) !== snapshot.hash
```

于是返回：

```text
ToolResult {
  status: "error",
  error.error_type: "stale_file",
  recommended_next_tool: "Read"
}
```

模型看到 stale_file 后重新：

```text
Read src/pricing.cjs
```

这次 snapshot 更新，第二次 Edit 才成功。

verify 检查：

```text
存在 stale_file Edit result
存在 successful Edit result
modelRequests includes "user note: keep applyDiscount export stable"
finalText 仍保留 module.exports = { applyDiscount }
```

这个 case 钉住的边界是：

```text
Edit safety 是协作安全机制。
Agent 不能覆盖用户在 Read 之后的新改动。
```

---

## 9. Execution Chain A8：Bash allowlist 如何限制真实 repo 命令

对应 case：

```text
src/core/real-repo-task.verify.mjs
policy: real repo command allowlist denies unknown command
```

verify 直接创建：

```text
new CoreToolRuntime({
  allowedCommands: ["git status --short", "npm test"]
})
```

然后尝试：

```text
Bash { command: "npm install" }
```

`CoreToolRuntime.authorize` 检查：

```text
this.allowedCommands.has(command)
```

不在 allowlist，所以返回：

```text
status: "denied"
error.error_type: "permission_denied"
```

这个 case 钉住的边界是：

```text
真实 repo 并不意味着开放任意 shell。
测试发现和命令执行仍然受本地 Runtime allowlist 控制。
```

---

## 10. Execution Chain A9：final answer 为什么必须由 npm test 支撑

对应 case：

```text
src/core/real-repo-task.verify.mjs
runtime: final answer remains verification grounded
```

完整 run 后检查：

```text
coreState.verificationState.status === "passed"
coreState.verificationState.command === "npm test"
coreState.finalAnswer includes "npm test"
```

`CoreRuntime.#applyCoreState` 在 Bash result 后写入：

```text
verificationState = {
  status,
  command,
  exitCode,
  stdout,
  stderr
}
```

所以 final answer 的依据不是模型语气，而是：

```text
Bash npm test ToolResult
  -> CoreState.verificationState
  -> FinalAnswer
```

这个 case 钉住的边界是：

```text
真实 repo 任务的“完成”必须绑定具体验证命令。
```

---

## 11. Knowledge Provenance

| 模型用到的信息 | 来源 | 怎么给模型 | 目标 | 如果不给会怎样 |
| --- | --- | --- | --- | --- |
| 工作区是否 clean | `git status --short` ToolResult | MessageStore -> context | 判断初始 repo 状态 | 可能忽略用户已有改动 |
| 项目规则 | `AGENTS.md` Read result | `file:AGENTS.md` block / selected message | 遵守 public API 和验证规则 | 可能改错边界或跑错命令 |
| 测试入口 | `package.json` / AGENTS.md | Read result | 发现 `npm test` | 只能靠猜命令 |
| 候选文件 | Search ToolResult | tool result block | 从多文件中定位目标 | 可能改调用方而不是定义方 |
| 文件内容 | Read ToolResult | selected Read result | 基于事实编辑 | old_string 可能不匹配 |
| 文件快照 | ToolRuntime internal snapshot | 不直接给模型，执行 Edit 时使用 | 防 stale overwrite | 可能覆盖用户新改动 |
| stale_file | Edit ToolResult | MessageStore -> context | 引导重新 Read | 模型可能重复旧 Edit |
| 用户中途 note | 外部文件变化后重新 Read | Read result | 保留用户改动 | 用户修改可能丢失 |
| npm test passed | Bash ToolResult / CoreState | verification_state | 支撑 final answer | 未验证就声称完成 |

---

## 12. 学习者应该亲手改哪里

### 12.1 把 npm test 从 allowlist 移除

文件：

```text
src/core/real-repo-task.mjs
```

临时把 run demo 里的：

```text
allowedCommands: ["git status --short", "npm test"]
```

改成只保留：

```text
["git status --short"]
```

运行：

```bash
npm run core:09:verify
```

你应该看到完整任务无法通过 npm test 验证。

这证明：

```text
模型发现 npm test 不等于自动拥有执行权限。
```

实验后改回。

### 12.2 删除 simulateUserChange

文件：

```text
src/core/real-repo-task.mjs
```

临时注释第一次 Edit 前的：

```text
await this.#simulateUserChange(request.workspaceRoot);
```

运行：

```bash
npm run core:09:verify
```

你应该看到 stale edit 相关断言失败。

这证明：

```text
stale_file case 是故意制造的协作边界测试。
```

实验后改回。

### 12.3 不读 AGENTS.md

文件：

```text
src/core/real-repo-task.mjs
```

临时跳过 `didReadRules` 分支。

运行：

```bash
npm run core:09:verify
```

你应该看到项目规则进入 context 的断言失败。

这证明：

```text
项目规则必须通过工具读取进入模型视野。
```

实验后改回。

### 12.4 改 Search query

把：

```text
query: "applyDiscount"
```

临时改成只命中一个文件的字符串。

运行：

```bash
npm run core:09:verify
```

你应该看到 multi-file search 相关断言失败。

这证明：

```text
Core 09 特意要求 Search 暴露多个候选文件，模拟真实 repo 定位问题。
```

实验后改回。

---

## 13. 本课最终要能回答的问题

```text
1. createRealRepoFixtureWorkspace 创建了哪些真实 repo 事实？
2. 为什么 Core 09 要先 git status？
3. AGENTS.md 如何进入模型上下文？
4. package.json 在测试发现里起什么作用？
5. Search 返回多个候选文件证明了什么？
6. Read snapshot 存在哪里？
7. stale_file 是在哪个函数里被判定的？
8. 为什么 stale_file 后必须重新 Read？
9. npm install 为什么会被拒绝？
10. final answer 为什么必须绑定 npm test？
11. Core 09 和任意真实仓库 benchmark 的差距在哪里？
```

过关标准：

```text
你能把真实 repo 任务拆成：
repo fact discovery -> project rule ingestion -> candidate location -> stale-safe edit -> allowlisted verification -> grounded final answer。
```
