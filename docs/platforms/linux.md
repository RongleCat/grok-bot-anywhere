# Linux

状态：**未支持**。没有打包目标，也没有任何 Linux 实机验证。

## 现在能做什么

理论上可以：

```sh
cd desktop
npm ci
npm run build
npx electron .
```

Electron 与 Node 服务进程大部分是平台无关的；但以下能力在 Linux 上没有实现或没有验证：

| 能力 | 现状 |
| --- | --- |
| 主窗口 / 托盘 | 走 Electron 默认；托盘图标、菜单行为未验证 |
| 全局快捷键 | `globalShortcut` 未在 Wayland/X11 验证；Wayland 可能不生效 |
| 悬浮输入框置顶/穿透 | 依赖窗口管理器；未实现平台适配 |
| 微信分享 | 不适用（Linux 微信无此扩展模型） |
| Touch Bar / 原生输入框 / 语音 | macOS 专属，Linux 没有替代 |
| 原生分享目标 | 未实现 |
| 打包 | 没有 AppImage/deb/rpm 目标 |
| CLI / skills | 逻辑可移植，但安装路径、shell shim 未适配 |

## 本阶段不做的理由

1. 产品要在 Linux 上可用，需要先决定系统集成的最低集：全局快捷键、托盘、悬浮窗、文件选择、剪贴板/拖放。
2. 需要至少一台真实 Linux 桌面（X11 与 Wayland 各一）做验证，不能只靠 `GOOS`/交叉检查。
3. 微信分享入口在 Linux 不存在，需要换一个入口（例如桌面文件拖放/命令行），否则功能不完整。

## 如果要开始支持

建议顺序：

1. 先跑通 `npm ci && npm run build && npx electron .`，记录窗口、托盘、快捷键的实际行为。
2. 在 `desktop/src/shell/` 增加 `linux` 分支，而不是在业务逻辑里散落 `process.platform`。
3. 用 Electron 的 `Tray`/`globalShortcut` 做最小可用；Wayland 下若快捷键不可用，明确降级。
4. 加一个 `electron-builder` 的 `linux` target（AppImage 优先），在 CI 或真实机器上构建。
5. 把“已验证/未验证”写进本页和 [README 状态表](../README.md)。

## 相关

- [平台边界 ADR](../decisions/0005-platform-boundaries.md)
- [桌面外壳](../subsystems/desktop-shell.md)
