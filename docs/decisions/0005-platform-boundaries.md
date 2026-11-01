# ADR 0005：平台边界

状态：Accepted（2026-11-01 明确）。

## 决定

| 平台 | 定位 | 原生部分 |
| --- | --- | --- |
| macOS | 主平台，完整支持 | Swift 伴侣：Touch Bar、原生输入框、语音、Finder 选区、分享扩展宿主 |
| Windows | 支持，但必须实机验证 | 无 Swift；悬浮输入框是 Electron 窗口，选区读取用 PowerShell；微信分享入口不支持 |
| Linux | 暂不支持 | 无 |

## 理由

- macOS 的分享扩展/Touch Bar/Apple Events 没有跨平台等价物，必须原生。
- Windows 没有 Swift 工具链路径；用 Electron + PowerShell 能覆盖大部分入口，但系统级文本框/分享目标需要另写原生宿主，不能伪装。
- Linux 没有微信桌面分享模型，且需要单独的桌面集成与打包验证；在没有真实机器前不宣称支持。

## 约束

- 平台分支集中在 `desktop/src/shell/`、`desktop/src/share/`、`native/`；业务逻辑保持可移植。
- Windows 任何功能在实机跑过之前，文档必须写“未验证”，不能因为 macOS 单测通过就说支持。
- Linux 若要开始支持，先补平台页的验证矩阵和打包目标，再改代码。

## 相关

- [Windows](../platforms/windows.md)
- [Linux](../platforms/linux.md)
- [macOS](../platforms/macos.md)
