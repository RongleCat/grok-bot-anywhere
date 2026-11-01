# Windows

状态：Current 代码 + **Unverified 实机**。所有 Windows 行为都在 macOS 上通过单元测试，尚未在 Windows 机器上运行。

## 已实现

| 能力 | 说明 |
| --- | --- |
| 主窗口无边框 | `frame:false` + 自绘最小化/最大化/关闭；去掉应用菜单，补回 `Ctrl+A/C/V/X/Z/Y` |
| 悬浮输入框 | `floatingComposerTraits('win32')`：不进任务栏、置顶、透明、`thickFrame:false` |
| 托盘 | 煤球图标；点击显示主窗口；退出前销毁图标 |
| 全局快捷键 | 默认 `Ctrl+Alt+Space`（可改） |
| URL 协议 | `start "" "grokbotanywhere://open"`；`start "" "grokbotanywhere://send?bot=<id>&text=<text>"`；行为与 macOS 一致 |
| 命令行 | 写 `grok-bot.cmd` + `grok-bot.ps1`；Path 通过 PowerShell 读写 `HKCU\Environment`，写完广播 `WM_SETTINGCHANGE` |
| 应用图标 | `build/icon.ico`；`signExecutable: false` 保留 exe 图标/metadata，仅跳过签名 |
| skills | 复制 skill；Claude Code 用 junction |
| Explorer 右键 | `HKCU\Software\Classes\*\shell\GrokBotAnywhere` 级联，每个启用 Bot 一行 |
| 收件/发送 | 与 macOS 同一套服务进程与 SQLite |
| 打包 | `npm run package:win` → 未签名 zip |

## 微信分享

Windows 微信没有 macOS `GrokBotShare.appex` 等价的宿主。当前**不支持**微信「转发 → 其他应用」里出现本应用。替代路径：

- Explorer 右键 → 发给 Bot。
- 拖 ZIP/文件到 Bot 卡片。
- 悬浮输入框 / `grok-bot` 命令。

「每个 Bot 一行」的 MSIX 稀疏包方案仍是研究项，验证包在 `projects/windows-share/`，未在 Windows 运行，也没有 exe。

## 未验证项

- 真实 Windows 11 上的窗口、托盘、快捷键、协议注册。
- Explorer 右键在「显示更多选项」中的位置、15 项多选上限。
- 多标签 Explorer 只返回第一个标签选区。
- 常驻 PowerShell 选择宿主：企业安全软件可能告警；编译一次后复用。
- `grok-bot.cmd` 的代码页/Path 中文条目；已在单测覆盖，但无实机。
- 安装 zip 后的首次启动、登录、分享导入、通知。
- 打包产物无签名，SmartScreen/SAC 可能拦截。

## 开发

```powershell
cd desktop
npm ci
npm run build
npm start
```

需要 Node >=22.13。`build:native` / `build:share` 在 Windows 上会直接报错——它们是 macOS 专用。

## 数据位置

`%APPDATA%\Grok Bot Anywhere\`：`inbox\`、`ShareInbox\`、偏好 JSON。
CLI 凭据：`%LOCALAPPDATA%\Grok Bot Anywhere\cli\`。

## 验证（在 Windows 机器上）

1. `npm test`（应通过；这里只证明纯函数）。
2. `npm start`：窗口、托盘、快捷键、输入框、拖放。
3. `start "" "grokbotanywhere://open"`。
4. 设置 → 工具箱 → Windows 菜单 → 重建；在 Explorer 右键验证每个 Bot 一行。
5. `npm run package:win`，解压到干净目录再启动。
6. 记录每一步的实际结果；未运行就写“未运行”，不要写“应该可以”。

## 已知风险

- 微信分享目标需要 MSIX/包标识；自签名在 Smart App Control 开启时大概率被拦。见 [ADR 0005](../decisions/0005-platform-boundaries.md)；本地验证包在 `projects/windows-share/`（默认不入库）。
- 无边框窗口的最大化内缩依赖 `anywhere:window-state` 的工作区 inset；多显示器/DPI 缩放未验证。

## 相关

- [桌面外壳](../subsystems/desktop-shell.md)
- [Windows 覆盖历史文档](../history/legacy/windows-coverage.md)
- [构建](../runbooks/build.md)
