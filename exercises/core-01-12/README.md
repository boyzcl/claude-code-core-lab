# Core 01-12 练习：最小运行时到评测打包

这一组练习对应 Core 01 到 Core 12。目标是理解最小核心运行时如何逐步接入 ModelGateway、Context Engine、Plan Mode、Compaction、Eval、真实仓库任务和 starter packaging。

## 最小任务

选择一个 Core 阶段，回答：

```text
这一阶段新增了哪个运行时对象或边界？
它复用了哪些 Lab 机制？
对应 verify case 中最重要的断言是什么？
它没有证明哪些生产能力？
```

建议验证：

```bash
npm run core:verify
npm run core:02:verify
npm run core:06:verify
npm run core:10:verify
```

如果你想动手实现一个最小闭环，去做 [capstone-mini-runtime](../../projects/capstone-mini-runtime/README.md)。
