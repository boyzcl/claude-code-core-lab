# Core 27 Settings / Permission Resolver：把配置分层解析为工具执行前的权限决策

> 本 Core 接在 `core-26-human-approval-interruption-protocol.md` 后面。
>
> Core 22 / Core 26 已经证明：
>
> ```text
> Core 22 可以把修改变成 diff preview、transaction commit 和 rollback。
> Core 22 可以把 protected / high-risk action 路由到审批。
> Core 26 可以把 approval_required、approve、reject、interrupt 和 handoff 写入 Runtime 状态。
> ```
>
> Core 27 验证：
>
> ```text
> 多层 settings / permission rules 可以在工具执行前解析成 allow / ask / deny，并留下可解释的 ruleSource、resolverTrace 和 decisionCache evidence。
> ```

---

## 0. 实现级 Validation Matrix

Core 27 是 Product Surface Study 的第一个独立 Core。它先经过 `product-surface-validation-matrix.md` 的 same-topic merge gate：

```text
它补充 Core 22 / Core 26，但不重复 Core 22 / Core 26。
```

边界：

```text
Core 27: Settings / permissions -> allow / ask / deny。
Core 22: diff preview / transaction commit / rollback。
Core 26: approve / reject / interrupt / handoff。
```

新增 Runtime state：

```text
permissionConfig
resolverTrace
ruleSource
decisionCache
```

配置优先级：

```text
policy > local > project > user
```

这是本项目自己的对象模型和验证口径，不声称等同于 Claude Code 官方内部实现。

| Case | Fixture | 预期结果 | 证据 |
| --- | --- | --- | --- |
| config precedence | user / project / local / policy 四层规则 | 高优先级规则胜出，低优先级命中进入 shadowedMatches | resolver report |
| allow ask deny | Bash actions 命中 allow、ask、deny | allow 执行，ask 桥接 approval_required，deny 拒绝 | permission trace |
| prefix command rule | `npm test` 前缀和相似命令 | 明确前缀加参数可匹配，相似命令不外推 | command decision |
| no hidden execution | ask / deny action | provider/tool execution delta 为 0 | trace assertion |
| decision cache | 同一 action 重复解析 | 第二次 fromCache=true，ruleSource 不丢失 | decisionCache |
| boundary | boundary object | 不声称 transaction、approval decision、enterprise policy 或 GUI product | boundary assertions |

公开边界：

```text
本 Core 只学习 Claude Code-like 权限配置分层机制。
不复制系统提示词原文、source map 原文或反编译源码片段。
不声称复刻官方 Settings / Permission 内部实现。
```

---

## 1. 本 Core 解决什么问题

Core 22 / Core 26 已经知道“某些动作需要审批”，但还缺一个更靠前的问题：

```text
这个 action 为什么是 allow、ask 还是 deny？
规则来自 user、project、local 还是 policy？
多个来源同时命中时谁说了算？
同一条命令前缀是否会误放行相似命令？
ask / deny 之前是否真的没有执行工具？
```

Core 27 把这些问题做成 deterministic local permission resolver。

---

## 2. 当前实现位置

代码：

```text
src/core/settings-permission-resolver.mjs
src/core/settings-permission-resolver.verify.mjs
```

运行：

```bash
npm run core:27
npm run core:27:verify
```

全量验证：

```bash
npm run verify:all
```

---

## 3. 核心机制

### 3.1 Permission Config

`SettingsPermissionResolver` 接收四层配置：

```text
user
project
local
policy
```

每条 rule 至少包含：

```text
id
tool
decision: allow | ask | deny
match
description
```

当前 fixture 覆盖：

```text
user allow git
project ask git push
local allow node scripts/test.cjs
local allow npm test
policy deny rm -rf
policy deny git push origin main
```

### 3.2 Precedence Resolver

解析顺序固定为：

```text
policy > local > project > user
```

同一个 action 如果命中多条规则，最高优先级规则胜出，其他命中记录到：

```text
shadowedMatches
```

这让“为什么不是低优先级规则生效”可以被验证脚本检查。

### 3.3 allow / ask / deny

Resolver 只输出 decision，不直接承担 Core 22 或 Core 26 的职责：

```text
allow -> PermissionedActionHarness 执行 mock tool。
ask -> 生成 approval_required bridge，交给 Core 26 这类协议继续处理。
deny -> 结构化拒绝，不执行工具。
```

### 3.4 Prefix Command Rule

当前命令前缀匹配只允许：

```text
command === prefix
command starts with `${prefix} `
```

所以：

```text
npm test -- --runInBand -> matches npm test
npm testing --fast -> does not match npm test
npm test:unit -> does not match npm test
```

这不是完整 shell parser 或 sandbox，只是证明“明确前缀不能外推到相似命令”。

### 3.5 No Hidden Execution

`PermissionedActionHarness` 记录 counters：

```text
providerCalls
toolExecutions
approvalRequests
denials
```

ask / deny action 的验证要求：

```text
providerCalls delta = 0
toolExecutions delta = 0
```

同时 `assertNoHiddenPermissionExecution()` 会扫描 trace，确认只有 `allow` 后才允许出现 `tool.executed`。

### 3.6 Decision Cache

同一个 action 重复解析会命中：

```text
decisionCache
```

缓存命中后仍必须保留：

```text
ruleSource
matchedRule
decision
```

缓存只是性能和可解释性证据，不是跨会话持久化 policy store。

---

## 4. 验证点

`npm run core:27:verify` 覆盖 8 个 case：

```text
1. core27: settings permission resolver demo runs and verifies
2. validation matrix: Core 27 does not duplicate Core 22 or Core 26
3. config precedence: policy/local/project/user rules are explainable
4. allow ask deny: one resolver feeds execute, approval, and refusal paths
5. prefix command rule: explicit prefix does not allow similar command
6. no hidden execution: ask and deny produce zero provider/tool deltas
7. decision cache: repeated action records cache hit without losing source
8. boundary: resolver is local evidence, not enterprise policy product
```

它们分别证明：

| case | 证明什么 |
| --- | --- |
| demo | validation matrix、precedence、allow/ask/deny、prefix、cache、no hidden execution 可以一起运行 |
| validation matrix | Core 27 不重复 Core 22 transaction 或 Core 26 approval decision |
| config precedence | policy/local/project/user 优先级稳定且可解释 |
| allow ask deny | 同一个 resolver 可以给执行、审批桥接和拒绝路径提供决策 |
| prefix command rule | 明确命令前缀不会外推到相似命令 |
| no hidden execution | ask / deny 前 provider 和 tool execution delta 均为 0 |
| decision cache | 重复解析可以缓存，但不能丢 ruleSource |
| boundary | 本 Core 是本地确定性证据，不是 enterprise policy 或 GUI permission product |

---

## 5. 做完本 Core 后得到什么

做完 Core 27 后，Product Surface Study 的第一个候选 Core 进入实现阶段并通过验证：

```text
Settings / Permission Resolver 可以作为 ToolRuntime 和 Human Approval 前置层。
```

现在链路可以表达为：

```text
settings / permission rules
  -> permission resolver
  -> allow / ask / deny
  -> Core 22 transaction or Core 26 approval protocol
```

这让后续 Hooks、Memory、Checkpoint 等 Product Surface Core 可以复用同一条原则：

```text
只有新增 Runtime state、enforced boundary 和 verify shape，才独立成 Core。
```

---

## 6. 边界

Core 27 证明的是：

```text
本地 deterministic permission resolver 可以把四层配置解析为 allow / ask / deny，并保留 ruleSource、resolverTrace 和 decisionCache 证据。
```

它不证明：

```text
完整 enterprise policy 产品。
真实 Claude Code Settings / Permission 内部实现。
完整 GUI permission prompt。
完整 shell parser、sandbox 或 OS 权限系统。
Core 22 transaction 能力。
Core 26 approval decision 能力。
生产级 Claude Code 70%-80% 能力。
```

---

## 7. 下一步

Core 27 之后，Product Surface 候选池仍需逐个经过实现前 validation matrix。

推荐下一步：

```text
评估 Hooks Lifecycle 是否进入 Core 28。
```
