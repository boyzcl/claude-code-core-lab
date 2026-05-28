# Security Policy

## 支持范围

当前仓库是围绕 Claude Code 核心机制的公开学习项目，不是生产级 Agent 产品。安全报告主要关注：

```text
密钥或 token 泄露
危险命令绕过 Policy / ToolRuntime
verify evidence 中包含私有日志或凭证
文档误导学习者执行高风险操作
```

## 报告方式

如果发现安全问题，请不要在公开 issue 中粘贴密钥、token、私有 trace 或可复现凭证。

公开仓库启用 GitHub Security Advisories 后，请优先使用 private advisory。如果仓库尚未启用，请联系维护者并只提供最小复现信息。

## 不属于漏洞的内容

以下内容通常不按安全漏洞处理：

```text
本地 deterministic fixture 的预期拒绝行为
课程里明确标注 out of scope 的生产能力
没有真实 provider 的模拟 cache / cost evidence
没有第二 reference agent 前的 RelativeScore 阻塞
```

## 处理原则

修复安全问题时必须同时检查：

```text
源码边界
verify case
课程或 README 的能力声明
secret 是否进入运行记录
```
