# ADR 0001：Electron 作为跨平台主外壳

状态：Accepted（2026-10-28 起）。

## 背景

最初产品是纯 Swift 的 macOS Touch Bar Bot：SwiftUI 窗口、AppKit Touch Bar/浮窗、Node 子进程桥接协议。要把同一套「把上下文交给 Bot」的能力带到 Windows，Swift 不能复用。

## 决定

- **Electron 应用 `desktop/` 成为主产品**，负责窗口、名单、输入框、收件、投递、设置、托盘、深链、CLI。
- **Swift 退为 macOS 原生伴侣 `native/macos/`**，只补 Electron 做不到的系统能力：Touch Bar、原生输入框、语音、Finder 选区、分享扩展宿主。
- 两者用 NDJSON 协议通信；原生伴侣不碰账号凭据、不直接发消息。
- 旧 Swift 独立模式保留，但不再是主路径。

## 后果

- 一套 UI/业务逻辑覆盖 macOS + Windows；Linux 未来可复用。
- 需要维护两条 UI 渲染路径（Electron HTML 与 Swift 原生）；视觉不要求逐像素一致。
- 原生能力缺失时（伴侣未构建/崩溃）主窗口必须仍可用，只是没有 Touch Bar/原生输入框。
- Windows 没有 Swift 伴侣，必须另写原生文本框宿主；不能拿浏览器 textarea 冒充。

## 相关

- [架构](../architecture.md)
- [原生伴侣](../subsystems/native-companion.md)
- [ADR 0005](0005-platform-boundaries.md)
