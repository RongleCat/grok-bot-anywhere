# ADR 0006：根目录只放命令门面，不用 npm workspaces

状态：Accepted（2026-11-01）。

## 背景

仓库是混合技术栈：Electron（`desktop/`）、Swift（`native/macos/`）、独立 Node 协议包（`packages/client-protocol/`）。此前只有 Makefile 和分散的 `cd ... && npm ...`；Windows 没有 make，Agent 也容易跑错目录。用户提出在根目录加 `package.json` 配置启动命令。

## 决定

- 根 `package.json` 是**命令门面**：`private: true`、无依赖、不使用 workspaces。
- 所有根脚本通过 `npm --prefix <dir>` 或 `scripts/run.mjs` 转发到真正的包。
- Makefile 保留，但每个目标只调用对应的 `npm run`，不再维护第二套命令。
- `scripts/run.mjs` 负责跨平台启动，并剥掉 `ELECTRON_RUN_AS_NODE`，避免 Electron 被当成 Node。
- 依赖仍只安装在 `desktop/`；根目录不执行 `npm install`。

## 为什么不用 workspaces

1. electron-builder 按 `desktop/node_modules/**` 打包；workspace hoisting 会改变依赖位置和打包内容。
2. `desktop/package.json` 使用 `file:vendor/...` 与 GitHub 依赖；hoisting 会让路径和锁文件语义变化。
3. Swift 不是 npm 包，`native/macos` 无法成为 workspace，统一安装并不能覆盖全部构建。
4. 这个仓库的首要目标是“命令可发现”，不是“依赖统一安装”；门面足够。

## 后果

- macOS / Linux / Windows 都能用同一组 `npm run ...`；`make` 只是 Unix 的快捷方式。
- 根目录不会出现 `node_modules`；看到根 `package-lock.json` 说明有人误跑了 `npm install`，可以删除。
- 新增命令时只改根 `package.json` 与 Makefile 的转发目标（或只改前者），不要在两处写不同实现。
- 如果未来真的需要共享依赖，再单独评估 workspaces，并先验证打包产物。

## 相关

- [构建 runbook](../runbooks/build.md)
- [测试 runbook](../runbooks/test.md)
- [AGENTS.md](../../AGENTS.md)
