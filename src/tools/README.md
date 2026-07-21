# 工具模块目录

每个工具拥有独立目录和公开入口 `index.ts`，页面从 `src/tools/index.ts` 引入工具。

新增工具步骤：

1. 创建 `src/tools/<tool-name>/index.ts`；
2. 在 `catalog.ts` 注册导航信息；
3. 在 `App.vue` 放置工具页面；
4. 在 `tests/core.test.ts` 添加公式测试。

共享样式、图片和基础组件仍放在 `src/styles.css`、`src/assets` 和 `src/components`，避免重复资源。
