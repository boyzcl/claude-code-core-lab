# Reference

这里放架构、实现和评测参考资料。

这些文档适合在你已经读过课程、需要深入某个设计时再查：

- [Open Source Project Standards](open-source-project-standards.md)
- [Core Runtime Object Map](core-runtime-object-map.md)
- [Agent Runtime Framework](claude-code-agent-runtime-framework.md)
- [Core Implementation Blueprint](claude-code-core-implementation-blueprint.md)
- [70-80 Validation and Model Access](claude-code-70-80-validation-and-model-access.md)
- [Optimization Loop](agent-runtime-optimization-loop.md)

第一次学习不要从大篇 reference 开始。例外是 `core-runtime-object-map.md`：它可以作为课程路线旁边的压缩地图，帮助你把多个 Core 收束成少数 Runtime object。

新增 reference 文档前先确认：

```text
它帮助理解哪个 Runtime object、Course、Lab、Core 或 eval 边界？
它是当前规则、参考资料、历史背景，还是证据记录？
它能否落到本项目自己的代码、fixture、verify case 或边界说明？
它是否包含 secret、私有日志、复制 prompt、source map 或反编译源码？
```
