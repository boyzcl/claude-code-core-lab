Title: Capstone Mini Runtime
Type: capstone-project
Layer: learner-practice
Mode: tutorial
Scope: project
Status: active
Owner: project-maintainer
Source of Truth: yes
Related Files: exercises/lab-to-core/README.md, solutions/capstone-mini-runtime/README.md

# Capstone：capstone-mini-runtime

这个 capstone 的目标是从一个会失败的 starter 出发，实现一个最小代码智能体运行时闭环：

```text
Search -> Read -> Edit -> Bash -> Verify
```

你要修的不是一个生产 Agent，而是一个教学用 mini runtime。它只处理一个小 fixture：`calculator.mjs` 里 `add()` 写错，`test-calculator.mjs` 会失败。你的运行时需要找到 bug、读取文件、做安全编辑、运行验证命令，并把最终回答绑定到验证结果。

---

## 1. 初始失败

先运行 starter 验证：

```bash
node projects/capstone-mini-runtime/starter/mini-runtime.verify.mjs
```

预期结果：失败。

失败是设计的一部分。starter 只保留接口骨架，还没有实现 Search、Read、Edit、Bash 和 Verify 的闭环。

---

## 2. 你的任务

在 `projects/capstone-mini-runtime/starter/mini-runtime.mjs` 中补齐：

| 步骤 | 要求 |
| --- | --- |
| Search | 在工作区中找到包含 `return a - b` 的文件 |
| Read | 在 Edit 前读取目标文件，并记录已读文件 |
| Edit | 只允许编辑已经 Read 过的文件；`oldText` 必须唯一匹配 |
| Bash | 只允许运行 `node test-calculator.mjs` |
| Verify | 只有 Bash exit code 为 0 时，最终状态才能是 `verified` |

最终结果必须返回：

```text
status: "verified"
trace: Search -> Read -> Edit -> Bash -> Verify
finalAnswer: 提到验证命令，不声称生产能力
```

---

## 3. 参考解法

参考实现放在：

```text
solutions/capstone-mini-runtime/
```

先自己实现一次，再看参考解法。参考解法验证命令：

```bash
npm run project:capstone:solution:verify
```

也可以直接运行：

```bash
node solutions/capstone-mini-runtime/mini-runtime.verify.mjs
```

---

## 4. 完成后复述

完成 capstone 后，用三句话回答：

```text
1. 为什么 Edit 前必须 Read？
2. 为什么 Bash 需要 allowlist？
3. 为什么 final answer 必须绑定 Verify，而不是模型自己说“修好了”？
```

---

## 5. 边界

这个 capstone 不证明：

```text
真实大仓库任务能力
真实模型规划能力
生产级补丁安全
Claude Code 官方实现
真实 Claude Code baseline
```

它证明的是：你能把 Course、Lab 和 Core 里反复出现的运行时边界，合成一个端到端最小学习任务。
