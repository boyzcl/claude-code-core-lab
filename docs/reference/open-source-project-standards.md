# Open Source Project Standards：把 GitHub 典范转译成本项目规范

本文把外部优秀 GitHub 项目的经验转译成 Claude Code Core Lab 自己可执行的标准。它不是新的项目路线图，也不替代 `CURRENT_STATE.md`、`docs/authority-map.md` 或 verify 脚本。

## 1. 本项目要学习的不是热度

优秀 GitHub 项目的共同点不是 star 数，而是陌生人能快速完成四件事：

```text
看懂 -> 跑通 -> 信任 -> 贡献
```

对本项目来说，这四件事分别落成：

| 目标 | 本项目对象 | 合格信号 |
| --- | --- | --- |
| 看懂 | `README.md`、`docs/start-here-for-learners.md` | 30 秒内知道这是中文代码智能体核心机制学习项目 |
| 跑通 | `npm run verify:labs`、`npm run verify:all` | 本地 deterministic verify 可以复现 |
| 信任 | `docs/authority-map.md`、`docs/open-source-boundary.md`、`docs/records/` | 能区分当前规则、历史背景、证据和能力边界 |
| 贡献 | `CONTRIBUTING.md`、`.github/ISSUE_TEMPLATE/`、`.github/PULL_REQUEST_TEMPLATE.md` | 贡献者知道能改什么、不能提交什么、要跑什么检查 |

## 2. 可参考对象和本项目转译

| 外部对象类型 | 值得学习 | 本项目采用方式 |
| --- | --- | --- |
| 小型工具库矩阵 | 项目边界清楚、README 一致、维护方式稳定 | 保持 course -> lab -> core 命名，不把 README 写成进度流水账 |
| 生态型前端项目 | 文档、示例、生态位置和项目资产目录清楚 | 把本项目定位为中文 AI Coding runtime 学习基础设施，而不是孤立代码仓库 |
| 教育型 AI 仓库 | 最小可运行、逐步扩展、复现实验清楚 | 每个课程都回到源码、verify case 和不能声称的边界 |
| 极简系统项目 | 少数核心抽象解释完整系统 | 用 Runtime object map 收束 31 个 Core，而不是让学习者死记阶段列表 |
| awesome-list 类知识库 | 筛选标准、分类、贡献规则和过期治理 | `docs/reference/` 只收录有明确用途、证据等级和边界说明的材料 |
| GitHub 健康仓库 | README、License、Contributing、Security、Code of Conduct、CI | 根目录保留健康文件，GitHub 模板要求复现、证据和 secret boundary |

## 3. README 标准

README 只做入口，不做百科。它必须回答：

```text
这是什么？
适合谁？
30 秒怎么跑？
学完会得到什么？
不能期待什么？
下一页读哪里？
```

不应该放进 README 的内容：

```text
长篇历史分析
完整课程正文
所有 verify 输出
候选 Core 的详细争论
尚未验证的生产能力声明
```

这些内容应该进入 `docs/course/`、`docs/core/`、`docs/roadmap/`、`docs/reference/` 或 `docs/records/`，并由 `docs/index.md` 和 `docs/authority-map.md` 路由。

## 4. 参考资料收录标准

`docs/reference/` 不是资料堆放区。新增参考资料前先判断：

| Gate | 必须回答 |
| --- | --- |
| 用途 | 它帮助理解哪个 Runtime object、Course、Lab、Core 或 eval 边界？ |
| 来源层级 | 它是公开文档、公开产品行为、公开论文、内部学习笔记，还是历史背景？ |
| 可验证性 | 它能否落到本项目自己的代码、fixture、verify case 或边界说明？ |
| 时效性 | 它是否可能过期？如果会，是否标明检查日期或只作为背景？ |
| 安全边界 | 是否包含 secret、私有日志、复制 prompt、source map 或反编译源码？ |
| Authority | 它是当前规则、参考资料、历史背景，还是证据记录？ |

只有通过这些 gate 的资料才适合进入公开仓库。不能通过的资料可以留在本地私有笔记，但不能进入项目文档。

## 5. 贡献入口标准

Issue 和 PR 不是聊天框，而是协作对象。

Bug issue 必须尽量包含：

```text
最小复现命令
预期结果
实际结果
相关区域
环境信息
secret / prompt / source map / decompiled source 边界确认
```

Learning feedback issue 必须尽量包含：

```text
卡住的位置
卡住的原因
预期学习结果
建议修法
对应学习路径
```

PR 必须说明：

```text
最小变更范围
改动类型
跑过的验证
是否更新导航或 authority
是否守住公开边界
```

## 6. 质量保障标准

默认检查：

```bash
git diff --check
```

涉及源码、verify、package metadata、CI 或核心行为时运行：

```bash
npm run verify:all
```

只改文档时仍要至少保证：

```text
Markdown 链接可达
导航入口已更新
没有陈旧 course/core 口径
没有能力边界漂移
```

## 7. 不照搬的东西

本项目不照搬：

```text
追 star 的项目包装
花哨但不可运行的官网优先
泛 AI Coding 百科化
英文开源话术直接搬进中文教学
复制 Claude Code prompt 原文
复制 source map 或反编译源码片段
把本地 deterministic evidence 写成生产级能力
```

本项目真正的公开气质应该稳定为：

```text
中文
可运行
可验证
边界诚实
教学链路完整
```
