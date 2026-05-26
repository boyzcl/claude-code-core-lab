# Course 04 Single Task Full Trace：手工跑完整一条 Agent 任务

> 学习目标：不用先写代码，先把一个 Claude Code Core 任务从用户输入到最终验证完整手工跑一遍。
>
> 这份文档是第一条完整任务轨迹课程。它的作用不是解释所有架构概念，而是让你看到：
>
> ```text
> Agent Runtime 是如何由 Message、Context、ToolCall、ToolResult、StateUpdate 和 Verification 一轮轮组成的。
> ```
>
> 前置阅读：
>
> ```text
> 0. course-00-teaching-standard.md
>    先理解无隐式信息规范：任何“模型知道/应该/合理”都必须说明来源、给法、目标和验证。
>
> 1. course-01-initial-model-request.md
>    先理解模型第一次被调用时到底看到了哪些 messages、tools 和 state。
>
> 2. course-02-action-selection-rubric.md
>    再理解“合理动作/不合理动作”的判断来源：用户目标、当前状态、工具说明、Policy 和动作选择规则。
> ```
>
> 读完这些前置内容，再看本文的 Search/Read/Edit 流程会更顺。
>
> 当前状态说明：本文第一版仍是完整轨迹参考，不是最理想的第一学习入口。后续需要按 `course-00-teaching-standard.md` 重构每个 Turn，补上 Model visible info、Decision source、Action claim、Runtime enforcement 和 Missing info failure。

---

## 0. 这份课程要训练什么

完成这份文档后，你应该能回答：

```text
1. 用户输入进来后，Runtime 创建了哪些对象？
2. 第一轮上下文为什么不是整个项目？
3. 模型为什么先 Search，而不是直接 Edit？
4. SearchResult 怎么变成下一轮模型能看到的信息？
5. ReadTool 除了返回文件内容，还建立了什么状态？
6. EditTool 为什么要检查 read-before-write 和 stale file？
7. BashTool 的测试结果如何变成 VerificationState？
8. 测试失败时，失败输出如何回灌给模型？
9. 最终回答为什么必须区分“已验证”和“未验证”？
10. 这条任务如何转成第一个 eval case？
```

这条完整任务轨迹的核心心智模型：

```text
用户不是直接让模型“改代码”。
用户是在启动一个受控 Runtime。
模型每一轮只根据当前可见上下文做下一步决策。
工具执行真实动作。
工具结果回灌为下一轮 observation。
Runtime 负责保存状态、权限、验证和 trace。
```

---

## 1. Toy Repo 场景

为了学习，我们先假设一个很小的 TypeScript 项目。

目录：

```text
toy-pagination/
  package.json
  src/
    pagination.ts
    pagination.test.ts
```

`package.json`：

```json
{
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "typescript": "^5.0.0"
  }
}
```

`src/pagination.ts` 初始内容：

```ts
export type PaginationInput = {
  page: number
  pageSize: number
}

export function getSliceRange(input: PaginationInput) {
  const page = Math.max(1, input.page)
  const pageSize = Math.max(1, input.pageSize)

  const start = (page - 1) * pageSize
  const end = start + pageSize + 1

  return { start, end }
}

export function paginate<T>(items: T[], input: PaginationInput): T[] {
  const { start, end } = getSliceRange(input)
  return items.slice(start, end)
}
```

`src/pagination.test.ts` 初始内容：

```ts
import { describe, expect, it } from "vitest"
import { paginate } from "./pagination"

describe("paginate", () => {
  it("returns the requested page size", () => {
    const items = [1, 2, 3, 4, 5]

    expect(paginate(items, { page: 1, pageSize: 2 })).toEqual([1, 2])
    expect(paginate(items, { page: 2, pageSize: 2 })).toEqual([3, 4])
  })
})
```

隐藏 bug：

```text
end = start + pageSize + 1
```

正确逻辑应该是：

```text
end = start + pageSize
```

---

## 2. 用户输入

用户说：

```text
分页返回数量多了一个，请修复并运行测试验证。
```

这句话在 Runtime 里不是普通聊天消息，而是启动一次任务。

Runtime 要把它转成：

```text
Session
Message
Objective
Constraints
Runtime Mode
可用工具
第一轮上下文
```

---

## 3. 初始 Runtime 对象

### 3.1 Session

```json
{
  "id": "sess_001",
  "workspaceRoot": "/workspace/toy-pagination",
  "mode": "normal",
  "permissionMode": "default",
  "activePlanId": null,
  "state": {
    "objective": "修复分页返回数量多一个的问题，并运行测试验证。",
    "constraints": [
      {
        "source": "user",
        "text": "修复分页 bug",
        "priority": 900
      },
      {
        "source": "user",
        "text": "运行测试验证",
        "priority": 900
      }
    ],
    "activeFiles": {},
    "modifiedFiles": [],
    "lastVerification": null,
    "repeatedFailures": []
  }
}
```

### 3.2 UserMessage

```json
{
  "id": "msg_001",
  "role": "user",
  "content": "分页返回数量多了一个，请修复并运行测试验证。",
  "priority": 920,
  "source": "user"
}
```

### 3.3 初始 MessageStream

```text
msg_001 user:
  分页返回数量多了一个，请修复并运行测试验证。
```

注意：

```text
现在模型还没有看过任何文件。
Runtime 也不能假设 bug 在哪个文件。
```

---

## 4. 第一轮 Context

### 4.1 第一轮 ContextBlock

第一轮模型应该看到：

```text
system_prompt
runtime_contract
mode_instruction: normal
permission_instruction: default
latest_user_message
environment_context
available_tools
```

不应该看到：

```text
src/pagination.ts 全文
src/pagination.test.ts 全文
package.json 全文
旧 compact summary
memory
随机猜测的 bug 原因
```

原因：

```text
Agent 还没有通过工具观察项目。
第一步应该定位相关文件，而不是凭文件名想象。
```

### 4.1.1 第一轮 Model-visible info

这一轮模型能做决策，只能依赖下面这些可见信息。

| 信息 | 来源 | 怎么给模型 | 目标 | 如果不给会怎样 |
| --- | --- | --- | --- | --- |
| 用户要修复分页多返回一个 | User Message | user message | 确定任务领域和目标 | 模型不知道要修什么 |
| 用户要求运行测试验证 | User Message | user message | 确定最终需要 VerificationState | 模型可能改完不测试 |
| 还没有读过文件 | Runtime State | runtime state block | 阻止模型直接 Edit 或声称理解代码 | 模型可能凭空改文件 |
| 还没有修改文件 | Runtime State | runtime state block | 说明任务未进入修改阶段 | 模型可能误以为已有 patch |
| 还没有验证 | Runtime State | runtime state block | 说明不能 final answer 为已完成 | 模型可能误报已验证 |
| Search 可用 | Tool Schema | tools array | 让模型能定位相关文件 | 模型不知道可以搜索 |
| Read 可用 | Tool Schema | tools array | 让模型能读取候选文件 | 模型无法获取文件内容 |
| Edit 可用但要求先 Read | Tool Schema + Policy | tools array + policy instruction | 让模型知道 Edit 有前置条件 | 模型可能直接 Edit，被拒绝 |
| Bash 可用 | Tool Schema + Policy | tools array + policy instruction | 让模型知道最终可运行测试 | 模型不知道如何验证 |

注意：

```text
模型此时看不到 src/pagination.ts。
模型也不知道 package.json 里测试命令是什么。
```

### 4.1.2 第一轮 Context Item Contract

| Context Item | why_supply | decision_enabled | failure_if_missing |
| --- | --- | --- | --- |
| `latest_user_message` | 给任务目标和验收要求 | 生成分页相关搜索方向；知道最终要测试 | 模型不知道任务 |
| `runtime_state.no_files_read` | 暴露当前无文件事实 | 避免直接 Edit | 触发无依据修改 |
| `available_tools.Search` | 暴露定位能力 | 选择低风险探索动作 | 模型可能只能猜路径 |
| `available_tools.Edit` + 前置条件 | 暴露修改能力和限制 | 知道必须先 Read | 模型直接请求 Edit |
| `permission_instruction.default` | 暴露权限模式 | 判断读写命令大致可用 | 模型可能请求被拒绝动作 |

### 4.2 第一轮可用工具

```text
Search
Read
Edit
Write
Bash
Todo
AskUser
```

但可用不代表应该马上用。

第一轮合理动作：

```text
Search "paginate" 或 "pageSize"
Read package.json 了解测试命令
```

第一轮不合理动作：

```text
直接 Edit src/pagination.ts
直接声称已修复
直接运行 npm test 但还没看代码
```

### 4.2.1 第一轮 Action Claim 表

| 动作 | 合理性 | 来源 | 规则类型 | 如果做错会怎样 |
| --- | --- | --- | --- | --- |
| Search `paginate/pageSize` | 合理 | 用户任务提到分页；Search 工具说明适合定位文件；当前无文件路径 | Soft strategy | 如果不搜索，可能盲读或猜路径 |
| Read `package.json` | 可合理 | 需要测试命令；Read 工具可用 | Soft strategy | 不读也可以先 Search，但后续可能不知道测试命令 |
| Edit `src/pagination.ts` | 硬不合理 | 当前未读文件；路径只是猜测；Edit 要求 read-before-write | Hard rule | Policy 返回 `file_not_read` 或路径不确定 |
| Final Answer “已修复” | 软不合理，且严重 | 未修改、未验证；用户要求修复并测试 | Soft rule / Eval critical | 评测应判未完成，可能 critical failure |
| Bash `npm test` | 暂时软不合理 | 未读 package.json，不知道测试命令；还未定位问题 | Soft strategy | 可能命令错误或低信息增益；但某些任务中可合理 |

---

## 5. Turn 1：模型决定先 Search

### 5.1 AssistantMessage with ToolCall

模型输出：

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "tool_call",
      "call": {
        "id": "call_001",
        "name": "Search",
        "input": {
          "query": "paginate|pageSize|getSliceRange",
          "path": "src",
          "mode": "regex",
          "maxResults": 20
        }
      }
    }
  ]
}
```

### 5.2 为什么先 Search

产品逻辑：

```text
用户描述的是行为问题，不是明确文件路径。
Search 是低成本定位工具。
Search 可以避免盲读整个项目。
```

### 5.2.1 Turn 1 Decision Source

| 决策点 | 模型可见依据 | 来源 | 说明 |
| --- | --- | --- | --- |
| 用户说的是行为，不是路径 | “分页返回数量多了一个”中没有文件路径 | User Message | 说明模型不能直接 Read/Edit 指定文件 |
| Search 可用于定位文件 | Search description | Tool Schema | Runtime 显式告诉模型 Search 的用途 |
| 当前还没读文件 | `No files have been read yet` | Runtime State | 说明直接 Edit 违反前置条件 |
| 分页相关关键词 | “分页” + 模型工程常识 | User Message + Model Prior | 只能作为搜索假设，不是事实 |
| path 选 `src` | toy repo 场景假设或文件树摘要 | Environment Context / Example Assumption | 如果 Runtime 没给文件树，真实系统应使用 `.` 或先列目录 |

这里有一个教学修正：

```text
如果初始上下文没有给顶层目录或文件树，模型不应该凭空知道有 src 目录。
更严格的第一轮 Search 应该把 path 设为 "."，或者先用只读命令/文件列表发现目录结构。
```

更无隐式信息的 Search call 应该是：

```json
{
  "name": "Search",
  "input": {
    "query": "paginate|pagination|pageSize|limit|offset",
    "path": ".",
    "mode": "regex",
    "maxResults": 50
  }
}
```

本文保留 `src` 版本作为 toy repo 简化，但真实教学中要标明：

```text
src 来自环境上下文或示例假设，不是模型天然知道。
```

### 5.3 Policy Check

Search 是只读工具：

```json
{
  "action": "allow",
  "riskLevel": "low",
  "reason": "Search is read-only and scoped to workspace."
}
```

### 5.4 ToolResult

```json
{
  "callId": "call_001",
  "toolName": "Search",
  "status": "success",
  "content": {
    "summary": "Found 5 matches in 2 files.",
    "matches": [
      {
        "path": "src/pagination.ts",
        "line": 1,
        "preview": "export type PaginationInput = {"
      },
      {
        "path": "src/pagination.ts",
        "line": 6,
        "preview": "export function getSliceRange(input: PaginationInput) {"
      },
      {
        "path": "src/pagination.ts",
        "line": 15,
        "preview": "export function paginate<T>(items: T[], input: PaginationInput): T[] {"
      },
      {
        "path": "src/pagination.test.ts",
        "line": 2,
        "preview": "import { paginate } from \"./pagination\""
      },
      {
        "path": "src/pagination.test.ts",
        "line": 4,
        "preview": "describe(\"paginate\", () => {"
      }
    ],
    "recommendedNextTool": "Read"
  }
}
```

### 5.5 StateUpdate

```json
{
  "searchResults": [
    "src/pagination.ts",
    "src/pagination.test.ts"
  ],
  "activeFiles": {},
  "modifiedFiles": []
}
```

Search 不建立 read cache。它只告诉模型哪些文件值得读。

---

## 6. 第二轮 Context

第二轮模型会看到：

```text
用户目标
Search 工具结果
可用工具
当前还没有读过任何文件
当前没有 modified files
当前没有 verification state
```

模型现在合理动作：

```text
Read src/pagination.ts
Read src/pagination.test.ts
Read package.json
```

这里可以并发读，因为都是只读工具。

### 6.1 Turn 2 Decision Source

| 决策点 | 模型可见依据 | 来源 | 说明 |
| --- | --- | --- | --- |
| 读 `src/pagination.ts` | SearchResult 返回该路径和 `getSliceRange/paginate` 预览 | Tool Result | 这是第一次真正知道该文件存在 |
| 读 `src/pagination.test.ts` | SearchResult 返回测试文件路径和 `describe("paginate")` | Tool Result | 读取测试可理解预期行为 |
| 读 `package.json` | 用户要求运行测试，但测试命令未知 | User Message + Runtime State | 需要发现验证命令 |
| 可以并发 Read | Read 是只读工具，目标文件不同 | Tool Metadata / Runtime Scheduler | 并发是 Runtime 调度能力，不是模型必须知道 |
| 现在仍不能 Edit | 还没有目标文件内容和 read cache | Runtime State + Edit Policy | Search 不等于 Read，不能建立编辑快照 |

### 6.2 Turn 2 Action Claim 表

| 动作 | 合理性 | 来源 | 规则类型 | 如果做错会怎样 |
| --- | --- | --- | --- | --- |
| Read `src/pagination.ts` | 合理 | SearchResult 指向实现文件 | Soft strategy | 不读实现就无法定位 bug |
| Read `src/pagination.test.ts` | 合理 | SearchResult 指向测试文件 | Soft strategy | 不读测试就无法确认预期 |
| Read `package.json` | 合理 | 用户要求测试；测试命令未知 | Soft strategy | 后续可能不知道如何验证 |
| Edit `src/pagination.ts` | 仍不合理 | Search 不建立 read cache；未看内容 | Hard rule | Policy 返回 `file_not_read` |
| Bash `npm test` | 仍偏早 | 测试命令未确认；还未修改 | Soft strategy | 可能能获取信息，但不一定是最高信息增益 |

---

## 7. Turn 2：模型读取相关文件

### 7.1 ToolCalls

```json
[
  {
    "id": "call_002",
    "name": "Read",
    "input": {
      "path": "src/pagination.ts"
    }
  },
  {
    "id": "call_003",
    "name": "Read",
    "input": {
      "path": "src/pagination.test.ts"
    }
  },
  {
    "id": "call_004",
    "name": "Read",
    "input": {
      "path": "package.json"
    }
  }
]
```

### 7.2 Policy Check

```text
Read 是只读。
路径在 workspace 内。
允许并发。
```

### 7.3 ReadTool Result：pagination.ts

```json
{
  "callId": "call_002",
  "toolName": "Read",
  "status": "success",
  "content": {
    "path": "src/pagination.ts",
    "lineStart": 1,
    "lineEnd": 19,
    "totalLines": 19,
    "fileHash": "hash_pagination_ts_v1",
    "mtime": "2026-05-22T10:00:00.000Z",
    "content": "export type PaginationInput = { ... }"
  },
  "metadata": {
    "readCacheUpdated": true,
    "fullFileRead": true
  }
}
```

### 7.4 StateUpdate：Read Cache

```json
{
  "activeFiles": {
    "src/pagination.ts": {
      "lastReadHash": "hash_pagination_ts_v1",
      "lastReadAt": "2026-05-22T10:00:05.000Z",
      "fullFileRead": true
    },
    "src/pagination.test.ts": {
      "lastReadHash": "hash_pagination_test_ts_v1",
      "lastReadAt": "2026-05-22T10:00:05.000Z",
      "fullFileRead": true
    },
    "package.json": {
      "lastReadHash": "hash_package_json_v1",
      "lastReadAt": "2026-05-22T10:00:05.000Z",
      "fullFileRead": true
    }
  }
}
```

关键点：

```text
Read 不只是返回文本。
Read 还为后续 Edit 建立 file snapshot。
没有这个 snapshot，Edit 不能安全执行。
```

---

## 8. 第三轮 Context

第三轮模型现在看到：

```text
用户目标：修复分页多返回一个，并测试
Search 结果：pagination.ts 和 pagination.test.ts 相关
pagination.ts 文件内容
pagination.test.ts 文件内容
package.json scripts: test = vitest run
read cache：三个文件已完整读取
modifiedFiles: []
verification: null
```

模型可以推断：

```text
getSliceRange 中 end = start + pageSize + 1 造成多返回一个。
应该改为 end = start + pageSize。
已有测试覆盖 pageSize=2，应该能暴露 bug。
```

但注意：

```text
这是基于已读文件的推断，不是凭空猜。
```

### 8.1 Turn 3 Knowledge Provenance

| 推断 | 来源 | 怎么给模型 | 可靠性 | 用途 |
| --- | --- | --- | --- | --- |
| `getSliceRange` 控制分页范围 | `src/pagination.ts` ReadResult | tool result message | 高 | 定位实现函数 |
| `end = start + pageSize + 1` 多取一个 | `src/pagination.ts` ReadResult + JS `slice(start,end)` 常识 | tool result + Model Prior | 中高 | 形成 bug 假设 |
| `pageSize=2` 期望返回 2 个元素 | `src/pagination.test.ts` ReadResult | tool result message | 高 | 确认用户描述与测试一致 |
| 测试命令可通过 `npm test` 触发 | `package.json` ReadResult | tool result message | 高 | 后续验证 |
| 可以 Edit `src/pagination.ts` | full-file Read + hash snapshot | Runtime State | 高 | 满足 read-before-write 前置条件 |

注意：

```text
“JS slice 的 end 是不包含边界”来自模型工程常识。
如果这是不熟悉的语言/框架，成熟 Agent 应该查文档或看测试，而不是只靠常识。
```

### 8.2 Turn 3 Action Claim 表

| 动作 | 合理性 | 来源 | 规则类型 | 如果做错会怎样 |
| --- | --- | --- | --- | --- |
| Edit `end = start + pageSize + 1` | 合理 | 已读实现文件；old_string 明确；bug 与用户描述一致 | Hard prerequisites satisfied + soft focused change | 若 old_string 不唯一，EditTool 应拒绝 |
| 直接改测试 | 不合理 | 当前实现中有明显 off-by-one；用户说返回数量多一个 | Soft strategy | 可能掩盖真实 bug |
| 继续搜索更多分页文件 | 可选但信息增益较低 | 已找到实现和测试 | Soft strategy | 可能增加成本，但不是错误 |
| 直接 Bash 测试 | 可选但未修复前价值有限 | package.json 已读 | Soft strategy | 可确认失败，但用户要求修复，仍需 Edit |
| Final Answer | 不合理 | 尚未修改、尚未验证 | Soft/Eval critical | 任务未完成 |

---

## 9. Turn 3：模型请求 Edit

### 9.1 ToolCall

```json
{
  "id": "call_005",
  "name": "Edit",
  "input": {
    "path": "src/pagination.ts",
    "old_string": "  const end = start + pageSize + 1",
    "new_string": "  const end = start + pageSize"
  }
}
```

### 9.2 Policy Check

Edit 前检查：

```text
1. path normalize
2. 路径在 workspace 内
3. 文件存在
4. 文件不是 deny path
5. 文件已完整 Read
6. 当前文件 hash == lastReadHash
7. old_string 非空
8. old_string 存在
9. old_string 唯一
10. permissionMode 允许写
```

结果：

```json
{
  "action": "allow",
  "riskLevel": "medium",
  "reason": "File was fully read, hash is unchanged, old_string is unique."
}
```

### 9.3 EditTool Result

```json
{
  "callId": "call_005",
  "toolName": "Edit",
  "status": "success",
  "content": {
    "summary": "Updated src/pagination.ts: changed end calculation to use pageSize without adding one.",
    "path": "src/pagination.ts",
    "replacementCount": 1,
    "diffSummary": [
      "- const end = start + pageSize + 1",
      "+ const end = start + pageSize"
    ]
  },
  "metadata": {
    "snapshotArtifact": "artifact_file_snapshot_001",
    "newFileHash": "hash_pagination_ts_v2"
  }
}
```

### 9.4 StateUpdate

```json
{
  "activeFiles": {
    "src/pagination.ts": {
      "lastReadHash": "hash_pagination_ts_v2",
      "fullFileRead": true
    }
  },
  "modifiedFiles": [
    {
      "path": "src/pagination.ts",
      "summary": "Changed pagination end range from pageSize + 1 to pageSize.",
      "lastEditCallId": "call_005"
    }
  ]
}
```

关键点：

```text
Edit 成功后，Runtime 必须更新 read cache。
否则下一次 Edit 会误以为文件 stale。
```

---

## 10. 第四轮 Context

第四轮模型看到：

```text
用户要求修复并运行测试
已修改 src/pagination.ts
修改摘要
package.json 里测试命令是 npm test 或 npm run test
当前还没有 verification
```

模型合理动作：

```text
Bash npm test
```

不合理动作：

```text
直接最终回答“已修复”
```

因为用户明确要求运行测试验证。

### 10.1 Turn 4 Model-visible info

| 信息 | 来源 | 怎么给模型 | 目标 | 如果不给会怎样 |
| --- | --- | --- | --- | --- |
| 用户要求测试验证 | User Message | user message / retained constraint | 决定改完后不能直接 final | 模型可能不运行测试 |
| 已修改 `src/pagination.ts` | Runtime State | modifiedFiles block | 知道现在进入验证阶段 | 模型可能重复修改或漏报改动 |
| 修改内容摘要 | ToolResult + State | EditResult + modifiedFiles summary | 知道要验证哪类行为 | 模型可能跑无关验证 |
| `package.json` 已读 | ReadResult | previous tool result / file context | 知道测试命令来源 | 模型可能猜测 `npm test` |
| `lastVerification` 为空 | Runtime State | verification state block | 知道尚未验证 | 模型不能声称完成 |

### 10.2 Turn 4 Action Claim 表

| 动作 | 合理性 | 来源 | 规则类型 | 如果做错会怎样 |
| --- | --- | --- | --- | --- |
| Bash `npm test` | 合理 | 用户要求验证；已修改文件；package.json 提供 test script | Soft rule，用户明确要求时接近 hard eval | 如果不运行，Verification Quality 失败 |
| Final Answer “已修复” | 不合理 | lastVerification 为空；用户要求测试 | Eval critical | 未验证却声称完成 |
| 继续 Edit `pagination.ts` | 暂时不合理 | 已完成最小修复，未验证 | Soft strategy | 可能过度修改 |
| Search 更多文件 | 通常不必要 | 当前修复点明确，待验证 | Soft strategy | 可能浪费成本，但不一定错误 |

---

## 11. Turn 4：模型运行测试

### 11.1 ToolCall

```json
{
  "id": "call_006",
  "name": "Bash",
  "input": {
    "command": "npm test",
    "cwd": ".",
    "timeoutMs": 120000,
    "description": "Run the project test suite to verify the pagination fix."
  }
}
```

### 11.2 Policy Check

```json
{
  "action": "allow",
  "riskLevel": "medium",
  "reason": "npm test is a project-scoped verification command."
}
```

### 11.3 假设测试第一次失败

为了学习恢复流程，我们先设一个失败分支。

Bash 输出：

```text
> toy-pagination@ test
> vitest run

FAIL src/pagination.test.ts
  paginate
    ✓ returns the requested page size
    × handles page numbers below 1

AssertionError: expected [1, 2] to deeply equal [3, 4]

Expected: [3, 4]
Received: [1, 2]

src/pagination.test.ts:14:58
```

这表示：

```text
原来的 bug 修了，但测试里还有另一个失败场景。
page < 1 的行为可能和测试预期冲突。
```

### 11.3.1 Bash 输出的 Knowledge Provenance

| 判断 | 来源 | 怎么给模型 | 可靠性 | 备注 |
| --- | --- | --- | --- | --- |
| 测试命令失败 | Bash exitCode = 1 | ToolResult | 高 | 这是 VerificationState failed 的直接依据 |
| 失败文件是 `src/pagination.test.ts` | Bash keyLines | ToolResult summary/keyLines | 高 | 可以定位下一步 Read |
| `returns the requested page size` 通过 | Bash output 中 `✓` 行 | ToolResult keyLines | 中高 | 说明原始 off-by-one 可能已修复，但还需整体通过 |
| `handles page numbers below 1` 失败 | Bash output 中 `×` 行 | ToolResult keyLines | 高 | 说明出现新的失败分支 |
| page<1 语义冲突 | Bash output + 已读实现 | ToolResult + ReadResult | 中 | 只是诊断假设，需要读失败上下文确认 |

注意：

```text
“原来的 bug 修了”只能说是弱判断。
因为整个测试仍失败，Runtime 不能把任务标记为完成。
```

### 11.4 ToolResult

```json
{
  "callId": "call_006",
  "toolName": "Bash",
  "status": "error",
  "content": {
    "command": "npm test",
    "cwd": ".",
    "exitCode": 1,
    "durationMs": 3210,
    "summary": "Tests failed in src/pagination.test.ts. The requested page size test passed, but page numbers below 1 failed.",
    "keyLines": [
      "FAIL src/pagination.test.ts",
      "✓ returns the requested page size",
      "× handles page numbers below 1",
      "AssertionError: expected [1, 2] to deeply equal [3, 4]",
      "src/pagination.test.ts:14:58"
    ],
    "truncated": false
  },
  "error": {
    "errorType": "test_failure",
    "message": "npm test exited with code 1.",
    "recoverable": true,
    "recommendedNextTool": "Read",
    "targetPath": "src/pagination.test.ts"
  }
}
```

### 11.5 VerificationState

```json
{
  "kind": "test",
  "command": "npm test",
  "status": "failed",
  "exitCode": 1,
  "summary": "Requested page size test passed, but page numbers below 1 failed.",
  "relatedFiles": [
    "src/pagination.test.ts"
  ],
  "lastRunAt": "2026-05-22T10:00:18.000Z"
}
```

关键点：

```text
测试失败不是 Runtime 异常。
测试失败是 observation。
它必须进入下一轮上下文，让模型继续判断。
```

### 11.6 Failure Observation Contract

| 字段 | 为什么给模型 | 模型用它做什么 | 如果不给会怎样 |
| --- | --- | --- | --- |
| `command` | 知道失败的是哪个验证命令 | 决定是否重跑、换命令或诊断 | 模型可能不知道失败来源 |
| `exitCode` | 区分命令成功/失败 | 更新 VerificationState | 模型可能误判测试通过 |
| `keyLines` | 保留失败核心证据 | 定位失败文件和断言 | 模型可能需要读完整长日志 |
| `errorType=test_failure` | 标准化失败类型 | 选择恢复策略 | 模型可能把测试失败当工具异常 |
| `recommendedNextTool=Read` | 给恢复建议 | 读取失败测试上下文 | 模型可能盲目重跑测试 |
| `targetPath` | 指向下一步候选文件 | 减少搜索成本 | 模型可能读错文件 |

---

## 12. 第五轮 Context：失败回灌

第五轮模型看到：

```text
用户目标：修复分页并测试
已修改 src/pagination.ts
最新测试命令：npm test
测试状态：failed
关键失败：page numbers below 1
失败文件：src/pagination.test.ts:14
推荐下一步：Read src/pagination.test.ts
```

模型此时不应该：

```text
重复运行 npm test
盲目再改 pagination.ts
声称任务完成
```

模型应该：

```text
读取失败测试附近上下文。
```

### 12.1 Turn 5 Decision Source

| 决策点 | 模型可见依据 | 来源 | 说明 |
| --- | --- | --- | --- |
| 不能 final answer | VerificationState = failed | Runtime State | 任务尚未通过验证 |
| 不应重复 `npm test` | 同一命令刚失败，且没有新改动 | ToolResult + Runtime State | 重跑没有信息增益 |
| 不应盲目改实现 | 失败点是新的测试语义，需看上下文 | Bash keyLines | 需要确认测试意图 |
| 应 Read 测试文件 | `recommendedNextTool=Read` + `targetPath` | ToolResult | 失败输出明确指向测试文件 |

### 12.2 Turn 5 Action Claim 表

| 动作 | 合理性 | 来源 | 规则类型 | 如果做错会怎样 |
| --- | --- | --- | --- | --- |
| Read `src/pagination.test.ts` | 合理 | failure keyLines + recommendedNextTool | Soft recovery strategy | 不读上下文可能误修实现 |
| 重复 Bash `npm test` | 软不合理 | 没有新改动，刚失败 | Recovery rule | 重复失败，浪费 turn |
| Edit `pagination.ts` | 软不合理 | 尚未确认失败语义 | Soft strategy | 可能扩大行为变更 |
| Final Answer | 严重不合理 | VerificationState failed | Eval critical | 未完成却报完成 |

---

## 13. Turn 5：读取失败测试上下文

### 13.1 ToolCall

```json
{
  "id": "call_007",
  "name": "Read",
  "input": {
    "path": "src/pagination.test.ts"
  }
}
```

### 13.2 ReadResult

假设测试文件完整内容现在是：

```ts
import { describe, expect, it } from "vitest"
import { paginate } from "./pagination"

describe("paginate", () => {
  it("returns the requested page size", () => {
    const items = [1, 2, 3, 4, 5]

    expect(paginate(items, { page: 1, pageSize: 2 })).toEqual([1, 2])
    expect(paginate(items, { page: 2, pageSize: 2 })).toEqual([3, 4])
  })

  it("handles page numbers below 1", () => {
    const items = [1, 2, 3, 4, 5]

    expect(paginate(items, { page: 0, pageSize: 2 })).toEqual([3, 4])
  })
})
```

### 13.3 模型判断

这里有一个重要学习点。

测试期待：

```text
page = 0 时返回 [3, 4]
```

但实现中：

```ts
const page = Math.max(1, input.page)
```

所以 page=0 会被当成 page=1，返回 `[1, 2]`。

这时模型不能立刻改实现。它要判断：

```text
这是产品需求，还是测试写错了？
用户原始要求只说“分页返回数量多了一个”。
page=0 的预期和当前实现的防御性逻辑冲突。
```

如果项目没有更多规则，合理选择有两个：

```text
1. 如果 page<1 应该归一到 1，则测试错了。
2. 如果 page=0 在这个项目里代表第二页，则实现错了，但这个语义很奇怪。
```

这里的“避免过度改动”不是模型凭空知道的。

它应该来自第一次 ModelRequest 里的显式工程准则，例如：

```text
Prefer small, focused changes.
Preserve existing behavior unless the user asks to change it.
Do not expand the task scope without evidence.
When behavior is ambiguous, inspect project rules or ask the user.
```

也可能来自项目规则：

```text
README / CLAUDE.md / CONTRIBUTING 里写了兼容性要求、参数语义或测试策略。
```

如果这些都没有，模型只能基于工程常识做弱判断；这种弱判断不应该被当成事实。

这里为了保持任务聚焦，模型应该选择：

```text
不扩大需求。
修正明显不合理的测试预期，或询问用户。
```

在自动模式下，如果测试明显和实现防御逻辑冲突，且用户没有要求改变 page<1 语义，可以选择最小改动。

但这一步有风险，因此更稳妥的 mature agent 行为是：

```text
优先查项目规则或历史测试。
如果仍不明确，询问用户。
如果 non_interactive 模式不能询问，做最小可逆改动，并在 final answer 中明确说明假设。
```

### 13.4 需求边界判断来源表

| 判断 | 来源 | 怎么给模型 | 可靠性 | 教学备注 |
| --- | --- | --- | --- | --- |
| 用户只要求修“多返回一个” | User Message | retained user constraint | 高 | 不包含 page=0 语义变更 |
| `page=0` 当前实现会 clamp 到 1 | `src/pagination.ts` ReadResult | file content context | 高 | 这是已观察事实 |
| 测试期望 `[3,4]` | `src/pagination.test.ts` ReadResult | file content context | 高 | 这是已观察事实 |
| page=0 应该是什么语义 | 项目规则/用户需求 | 当前缺失 | 低 | 不能只靠模型猜 |
| 避免扩大需求 | System Prompt / Action Contract | 初始 messages | 中高 | soft rule，不是业务事实 |

### 13.5 决策分叉：问用户、查规则、改测试、改实现

| 候选动作 | 何时合理 | 来源 | 风险 |
| --- | --- | --- | --- |
| 查 README/CLAUDE.md/历史测试 | 项目规则未读，且语义冲突 | Project Rules strategy | 增加成本，但更稳 |
| AskUser | 交互模式可用，且业务语义不明确 | AskUser tool + ambiguity rule | 打断用户，但避免误改语义 |
| 改测试为 `[1,2]` | non_interactive、无项目规则、现有实现明显 clamp、只做最小可逆改动 | Soft strategy + explicit assumption | 可能错误固化现有行为 |
| 改实现让 page=0 返回第二页 | 项目规则明确 page=0 表示第二页 | Project rule / user instruction | 如果无依据，属于过度改动 |

教学约束：

```text
本文选择“改测试预期”只是为了演示失败恢复分支。
真实产品中，这一步必须由项目规则、用户澄清或 eval case 明确规定。
如果 eval case 没定义 page=0 语义，就不应该把“改测试”当作唯一正确答案。
```

---

## 14. Turn 6：修正测试预期

### 14.1 ToolCall

```json
{
  "id": "call_008",
  "name": "Edit",
  "input": {
    "path": "src/pagination.test.ts",
    "old_string": "    expect(paginate(items, { page: 0, pageSize: 2 })).toEqual([3, 4])",
    "new_string": "    expect(paginate(items, { page: 0, pageSize: 2 })).toEqual([1, 2])"
  }
}
```

### 14.1.1 Turn 6 Action Claim 表

| 动作 | 合理性 | 来源 | 规则类型 | 如果做错会怎样 |
| --- | --- | --- | --- | --- |
| Edit test expectation to `[1,2]` | 条件合理 | 已读测试；old_string 明确；non_interactive 示例；保持现有 clamp 行为 | Soft strategy + hard Edit prerequisites | 如果 page=0 语义实际应变，修错方向 |
| AskUser | 更稳妥 | 业务语义不明确；可交互时可询问 | Soft ambiguity rule | 会暂停任务，但降低误改风险 |
| 查项目规则 | 更稳妥 | 缺少 page=0 语义来源 | Soft strategy | 增加步骤，但证据更强 |
| 改实现支持 page=0 -> second page | 当前不合理 | 无用户/项目规则支持 | Soft strategy violation | 可能改变产品语义 |

显式前提：

```text
本示例选择 Edit 测试，是为了演示 non_interactive 下的最小可逆假设。
如果当前模式允许询问用户，AskUser 通常比直接改测试更稳。
```

### 14.2 Policy Check

```text
文件已读。
hash 未变化。
old_string 唯一。
允许 Edit。
```

### 14.2.1 Policy Enforcement Source

| 检查 | 来源 | 类型 | 失败后果 |
| --- | --- | --- | --- |
| 文件已读 | Runtime read cache | Hard | `file_not_read` |
| hash 未变化 | Runtime file snapshot | Hard | `stale_file` |
| old_string 唯一 | EditTool validation | Hard | `ambiguous_match` |
| permissionMode 允许写 | Policy Engine | Hard | `permission_denied` |

### 14.3 EditResult

```json
{
  "status": "success",
  "summary": "Updated page=0 expectation to match the existing clamp-to-first-page behavior.",
  "path": "src/pagination.test.ts",
  "replacementCount": 1
}
```

### 14.4 StateUpdate

```json
{
  "modifiedFiles": [
    {
      "path": "src/pagination.ts",
      "summary": "Fixed end range off-by-one."
    },
    {
      "path": "src/pagination.test.ts",
      "summary": "Aligned page=0 test expectation with clamp-to-first-page behavior."
    }
  ],
  "lastVerification": {
    "status": "failed",
    "command": "npm test"
  }
}
```

学习点：

```text
Agent 不只是让测试变绿。
它要判断测试失败意味着实现错、测试错、环境错，还是需求不清。
```

### 14.5 修改测试后的状态含义

| 状态 | 来源 | 含义 | 对下一步的影响 |
| --- | --- | --- | --- |
| `modifiedFiles` 包含实现文件 | EditResult call_005 | 原始 bug 已被修复 | final answer 要报告 |
| `modifiedFiles` 包含测试文件 | EditResult call_008 | 测试预期被调整 | final answer 必须说明假设 |
| `lastVerification` 仍是 failed | 上一次 BashResult | 当前修改尚未重新验证 | 下一步必须重新运行验证 |

关键点：

```text
Edit 成功不等于任务成功。
只要 lastVerification 仍是 failed 或 empty，就不能 final answer 为完成。
```

---

## 15. Turn 7：重新运行测试

### 15.1 ToolCall

```json
{
  "id": "call_009",
  "name": "Bash",
  "input": {
    "command": "npm test",
    "cwd": ".",
    "timeoutMs": 120000,
    "description": "Re-run tests after fixing the pagination implementation and test expectation."
  }
}
```

### 15.1.1 Turn 7 Action Claim 表

| 动作 | 合理性 | 来源 | 规则类型 | 如果做错会怎样 |
| --- | --- | --- | --- | --- |
| Re-run `npm test` | 合理 | 修改后 lastVerification 仍 failed；用户要求验证 | Soft rule，用户要求时 eval hard | 不重跑无法证明恢复 |
| Final Answer | 不合理 | 最新修改未验证 | Eval critical | 未验证却声称完成 |
| 继续 Edit | 暂时不合理 | 没有新的失败证据 | Soft strategy | 可能过度改动 |
| Search 更多文件 | 信息增益低 | 当前失败已处理，需验证 | Soft strategy | 浪费 turn |

### 15.2 BashResult

```json
{
  "callId": "call_009",
  "toolName": "Bash",
  "status": "success",
  "content": {
    "command": "npm test",
    "exitCode": 0,
    "summary": "All tests passed.",
    "keyLines": [
      "PASS src/pagination.test.ts",
      "Test Files 1 passed",
      "Tests 2 passed"
    ],
    "truncated": false
  }
}
```

### 15.3 VerificationState

```json
{
  "kind": "test",
  "command": "npm test",
  "status": "passed",
  "exitCode": 0,
  "summary": "All tests passed.",
  "lastRunAt": "2026-05-22T10:00:40.000Z"
}
```

现在任务可以进入最终回答。

### 15.4 Verification Provenance

| 结论 | 来源 | 怎么给模型 | 可靠性 | 限制 |
| --- | --- | --- | --- | --- |
| `npm test` 已运行 | Bash ToolResult | tool result message | 高 | 只代表这个命令 |
| 测试通过 | exitCode = 0 + keyLines | ToolResult + VerificationState | 高 | 只覆盖当前测试集 |
| 当前可 final answer | VerificationState passed + modifiedFiles | Runtime State | 高 | 不能声称验证了未运行的测试 |

注意：

```text
通过 npm test 不等于“所有分页问题都修复”。
它只支持“当前项目测试通过，用户描述的问题已按当前测试验证”。
```

---

## 16. Final Answer

合理 final answer：

```text
已修复分页多返回一个的问题。

改动：
- src/pagination.ts：将 end 从 start + pageSize + 1 改为 start + pageSize。
- src/pagination.test.ts：将 page=0 的测试预期调整为当前实现的 clamp-to-first-page 行为。

验证：
- 已运行 npm test，测试通过。
```

不合理 final answer：

```text
搞定了。
```

也不合理：

```text
已修复所有分页问题。
```

因为 Agent 只验证了当前测试集和用户描述的问题，不能扩大承诺。

更诚实的表达：

```text
已修复用户描述的 pageSize 多返回一个问题，并通过当前项目测试。
```

### 16.1 Final Answer Contract

最终回答必须由 Runtime State 和 ToolResult 支撑。

| Final 中能说什么 | 来源 | 为什么能说 | 不能扩大成什么 |
| --- | --- | --- | --- |
| 已修改 `src/pagination.ts` | modifiedFiles + EditResult | 工具真实执行并记录 diff | 不能说重构了分页系统 |
| 已调整 `src/pagination.test.ts` | modifiedFiles + EditResult | 工具真实执行并记录 diff | 不能隐瞒测试改动 |
| 已运行 `npm test` | Bash ToolResult | 有 command 和输出 | 不能说运行了 lint/typecheck |
| 测试通过 | VerificationState passed | exitCode 0 + keyLines | 不能说所有潜在场景都验证 |
| page=0 语义是假设 | Turn 6 decision note | 缺少项目规则确认 | 不能当成确定产品需求 |

### 16.2 Final Answer Action Claim

| 动作 | 合理性 | 来源 | 规则类型 | 如果做错会怎样 |
| --- | --- | --- | --- | --- |
| Final Answer with summary + verification | 合理 | modifiedFiles 非空；VerificationState passed；用户目标满足 | Completion rule | 正常结束 |
| Final Answer 不提测试改动 | 不合理 | modifiedFiles 包含测试文件 | Transparency rule | 用户不知道行为假设被改 |
| 声称“已修复所有分页问题” | 不合理 | 验证范围仅为当前测试 | Honesty/eval rule | 过度承诺 |
| 声称“已验证”但没有命令 | 硬性产品失败 | 缺 VerificationState | Eval critical | 严重信任问题 |

### 16.3 缺失后果表

| 缺失信息 | 可能错误 |
| --- | --- |
| 缺 `modifiedFiles` | final answer 可能漏报测试文件改动 |
| 缺 `VerificationState` | 模型可能未验证就说完成 |
| 缺 Bash keyLines | 用户无法判断验证是否真实 |
| 缺 Turn 6 假设记录 | 模型可能把 page=0 语义当成确定事实 |

---

## 17. 完整 MessageStream

这条任务最终的 MessageStream 可以概括为：

```text
msg_001 user:
  分页返回数量多了一个，请修复并运行测试验证。

msg_002 assistant tool_call:
  Search paginate|pageSize|getSliceRange

msg_003 tool:
  SearchResult: found src/pagination.ts, src/pagination.test.ts

msg_004 assistant tool_call:
  Read src/pagination.ts
  Read src/pagination.test.ts
  Read package.json

msg_005 tool:
  ReadResult pagination.ts
  ReadResult pagination.test.ts
  ReadResult package.json

msg_006 assistant tool_call:
  Edit src/pagination.ts old end -> new end

msg_007 tool:
  EditResult success

msg_008 assistant tool_call:
  Bash npm test

msg_009 tool:
  BashResult failed, page=0 expectation mismatch

msg_010 assistant tool_call:
  Read src/pagination.test.ts

msg_011 tool:
  ReadResult test file

msg_012 assistant tool_call:
  Edit src/pagination.test.ts expectation

msg_013 tool:
  EditResult success

msg_014 assistant tool_call:
  Bash npm test

msg_015 tool:
  BashResult success

msg_016 assistant final:
  Summary + verification
```

这就是 Agent 的真实形态：

```text
不是一段回答，而是一条可追踪的执行轨迹。
```

---

## 18. 每轮 Context 如何变化

### Round 1

```text
用户目标
系统规则
模式
可用工具
```

### Round 2

```text
用户目标
SearchResult
还没有读文件
```

### Round 3

```text
用户目标
SearchResult
pagination.ts 内容
pagination.test.ts 内容
package.json scripts
read cache 状态
```

### Round 4

```text
用户目标
已修改 pagination.ts
测试尚未运行
```

### Round 5

```text
用户目标
已修改 pagination.ts
npm test failed
失败测试和关键日志
推荐读取失败测试文件
```

### Round 6

```text
用户目标
失败测试文件内容
实现逻辑
需求边界
```

### Round 7

```text
用户目标
已修改文件列表
上一次测试失败
最新修改测试预期
需要重新验证
```

### Final

```text
用户目标
已修改文件列表
验证通过状态
```

---

## 19. 这条任务里的核心状态

### 19.1 activeFiles

```json
{
  "src/pagination.ts": {
    "lastReadHash": "hash_pagination_ts_v2",
    "fullFileRead": true
  },
  "src/pagination.test.ts": {
    "lastReadHash": "hash_pagination_test_ts_v2",
    "fullFileRead": true
  },
  "package.json": {
    "lastReadHash": "hash_package_json_v1",
    "fullFileRead": true
  }
}
```

### 19.2 modifiedFiles

```json
[
  {
    "path": "src/pagination.ts",
    "summary": "Fixed off-by-one end range."
  },
  {
    "path": "src/pagination.test.ts",
    "summary": "Aligned page=0 expectation with clamp-to-first-page behavior."
  }
]
```

### 19.3 lastVerification

```json
{
  "kind": "test",
  "command": "npm test",
  "status": "passed",
  "exitCode": 0,
  "summary": "All tests passed."
}
```

---

## 20. 关键学习点

### 20.1 模型是决策核心，不是执行者

模型决定：

```text
下一步搜什么
读哪个文件
改哪一行
跑哪个测试
失败后怎么恢复
最终怎么报告
```

但模型不直接执行：

```text
文件读写由工具执行。
权限由 Policy 判断。
状态由 Runtime 保存。
验证由 Bash 结果和 VerificationState 记录。
```

### 20.2 工具失败是 observation

测试失败不是异常终止。

它是下一轮模型判断的重要事实：

```text
失败命令
exit code
关键日志
失败文件
推荐下一步
```

### 20.3 Edit 安全来自状态，不来自模型自觉

Edit 能安全执行，是因为 Runtime 检查了：

```text
文件是否读过
hash 是否变化
old_string 是否唯一
路径是否安全
权限是否允许
```

不是因为模型“应该小心”。

### 20.4 Final Answer 不能替代 Verification

模型说“已验证”不算验证。

Runtime 必须有：

```text
Bash command
exitCode
关键输出
VerificationState
```

---

## 21. 反事实：如果某一步出错怎么办

### 21.1 如果模型一开始直接 Edit

Policy 应该拒绝：

```json
{
  "errorType": "file_not_read",
  "message": "File has not been read yet. Read the full file before editing.",
  "recoverable": true,
  "recommendedNextTool": "Read",
  "targetPath": "src/pagination.ts"
}
```

### 21.2 如果用户在 Edit 前改了文件

Policy 应该拒绝：

```json
{
  "errorType": "stale_file",
  "message": "The file changed after it was last read. Read it again before editing.",
  "recoverable": true,
  "recommendedNextTool": "Read",
  "targetPath": "src/pagination.ts"
}
```

### 21.3 如果 old_string 匹配两处

EditTool 应该拒绝：

```json
{
  "errorType": "ambiguous_match",
  "message": "old_string matched 2 locations. Use a longer old_string or replace_all=true.",
  "recoverable": true,
  "recommendedNextTool": "Read"
}
```

### 21.4 如果 npm test 输出很长

BashTool 应该：

```text
保存完整输出到 artifact。
上下文只保留摘要、关键失败行、exit code 和 artifact ref。
```

### 21.5 如果 exit code 0 但输出包含 failed

Runtime 不应直接标记 passed。

应该标记：

```text
suspicious_success
```

并把关键词行回灌给模型判断。

---

## 22. Trace 应该记录什么

这条任务的 trace 至少记录：

```text
session_created
user_input
context_built round 1
model_request round 1
tool_call_requested Search
permission_decision allow
tool_result Search
state_update searchResults
context_built round 2
tool_call_requested Read x3
tool_result Read x3
state_update readCache
tool_call_requested Edit
permission_decision allow
tool_result Edit
state_update modifiedFiles
tool_call_requested Bash npm test
tool_result Bash failed
state_update verification failed
tool_call_requested Read test file
tool_call_requested Edit test expectation
tool_call_requested Bash npm test
tool_result Bash passed
state_update verification passed
final_answer
```

Trace 的目标不是“记录很多日志”，而是能回答：

```text
Agent 为什么做出这个动作？
它当时看到了什么？
它改文件前是否有安全依据？
它是否真的验证过？
如果失败，失败属于 context/tool/policy/model 哪一类？
```

---

## 23. 转成 Eval Case 草案

这条完整任务轨迹可以转成第一个 eval case：

```yaml
id: w01-pagination-off-by-one
level: L1
title: Fix pagination off-by-one and verify tests
repo_seed: repos/toy-pagination
initial_ref: seed-off-by-one
task_prompt: |
  分页返回数量多了一个，请修复并运行测试验证。
permission_mode: non_interactive
budgets:
  max_turns: 30
  max_tool_calls: 50
  max_wall_time_sec: 300
allowed_tools:
  - Search
  - Read
  - Edit
  - Bash
required_checks:
  - command: npm test
    expected_exit_code: 0
success_assertions:
  - type: file_contains
    path: src/pagination.ts
    pattern: "const end = start + pageSize"
  - type: no_file_contains
    path: src/pagination.ts
    pattern: "const end = start + pageSize + 1"
forbidden:
  changed_paths:
    - package.json
    - package-lock.json
scoring:
  task_completion: 40
  verification_quality: 15
  safety_permission: 15
  context_discipline: 10
  tool_efficiency: 10
  recovery_ability: 10
```

注意：

```text
如果 eval seed 里包含 page=0 测试失败分支，需要在 case 中明确它是预期要修测试，还是要修实现。
否则 eval 会把需求边界搞混。
```

对第一版 eval，建议先去掉 page=0 分支，让任务专注于 off-by-one。

恢复分支可以作为第二个 eval：

```text
w02-pagination-test-conflict
```

---

## 24. 你应该能复述的版本

学完这条完整任务轨迹，你应该能用自己的话说：

```text
Claude Code-like Agent 不是一次性生成答案。
它先把用户目标记录成 Session 和 Message。
每轮 Context Engine 只把必要信息给模型。
模型根据上下文选择工具。
Tool Runtime 执行动作。
Policy Engine 决定能不能执行。
ToolResult 回到 MessageStream。
StateStore 记录读过哪些文件、改过哪些文件、测试是否通过。
如果失败，失败作为 observation 进入下一轮。
最终回答必须基于真实验证状态。
```

如果你能复述这段，并能画出这条任务的 MessageStream，就可以进入下一步：

```text
course-05-product-mental-model.md
```

---

## 25. 下一步

下一步学习单元：

```text
course-05-product-mental-model.md
```

目标：

```text
把 course-00 到 course-04 学到的内容收束成产品心智模型。
先确认你理解这个产品的用户界面、模型界面、Runtime 内部界面、工具界面和 Eval 界面。
再进入 lab-01-mock-runtime-loop.md。
```

这一步会把本文的手工轨迹变成最小可运行代码。
