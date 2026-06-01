# 参考资料（Reference）

这里放架构、实现和评测参考资料。

这些文档适合在你已经读过课程、需要深入某个设计时再查：

- [代码智能体实现逻辑（Code Agent Implementation Logic）](code-agent-implementation-logic.md)
- [开源项目规范（Open Source Project Standards）](open-source-project-standards.md)
- [核心运行时对象地图（Core Runtime Object Map）](core-runtime-object-map.md)
- [智能体运行时框架（Agent Runtime Framework）](claude-code-agent-runtime-framework.md)
- [核心实现蓝图（Core Implementation Blueprint）](claude-code-core-implementation-blueprint.md)
- [70-80 Validation and Model Access](claude-code-70-80-validation-and-model-access.md)
- [优化循环（Optimization Loop）](agent-runtime-optimization-loop.md)

第一次学习不要从大篇 reference 开始。例外是 `core-runtime-object-map.md` 和 `code-agent-implementation-logic.md`：前者可以作为课程路线旁边的压缩地图，后者适合在你想用一篇长文复盘完整搭建逻辑时阅读。

新增 reference 文档前先确认：

```text
它帮助理解哪个运行时对象（Runtime object）、课程（Course）、实验（Lab）、核心阶段（Core）或评测（eval）边界？
它是当前规则、参考资料、历史背景，还是证据记录？
它能否落到本项目自己的代码、测试夹具（fixture）、验证用例（verify case）或边界说明？
它是否包含密钥（secret）、私有日志、复制提示词（prompt）、源码映射（source map）或反编译源码？
```
