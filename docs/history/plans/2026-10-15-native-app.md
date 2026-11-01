# 原生 Touch Bar Bot 应用实施计划

**Goal:** 将已验收的独立 SDK 接入真实 macOS 应用，保留原始需求中的头像选择、小面板、附件、语音和动画。

**Architecture:** 沿用用户已批准开始实施的原生 AppKit + Swift 内容 UI 方案，升级为 SwiftUI 内容/AppKit 窗口与 NSTouchBar。macOS 26+ 使用系统 NSGlassEffectView，旧版本回退 NSVisualEffectView。Node 子进程通过 NDJSON 调用 client-protocol SDK，不开放本地网络端口；应用自己的登录保存在自身 Keychain，已有 Grok Bot 登录仅在点击后使用。真实发送只由用户点击触发。

**Tech Stack:** Swift 6.2、SwiftUI、AppKit、Security、Carbon RegisterEventHotKey、AVFoundation/Speech、WebKit、本地 Bloub MIT 引擎、Node 22。

## 1. 账号与状态

新增 SDKBridge.swift、BotModels.swift、AppStore.swift、CredentialStore.swift，新增 packages/client-protocol/app-bridge.mjs。

先测试稳定 ID 选择、名单刷新保持选择、每 Bot 草稿隔离、发送目标冻结；再实现对应模型。Node 测试验证未登录拒绝、事件限定 Bot/session、发送不自动重试以及明确取消。桥接封装 login/connect/desktop/list/watch/unwatch/send/logout；stdout 仅作协议，不记录凭据。失效登录提示重新登录，暂不自动 refresh。

## 2. 原生内容与窗口

替换 mock picker/composer，增加 SwiftUI 原生名单、搜索、头像、编辑器、附件、紧凑回复；窗口轻量，系统字体/颜色/间距。悬浮面板采用单层系统玻璃承载，避免叠加装饰。Touch Bar 用 NSScrubberImageItemView 和静态头像缓存，不为列表创建 WebView。按钮/输入均有可访问标签，支持系统深浅色、减少动态效果与透明度。

## 3. 交互接入

Carbon 公开 API 注册 ⌃⌥Space，失败在 UI 提示。唤起前只在 Finder 为前台时读取选中文件；附件进入草稿，由发送操作才上传。第一版单文件 <=4MiB，最多 6 个文件，失败不提交消息。语音采用 Apple Speech，检查设备端能力，关闭面板/切换 Bot 停止麦克风。

输入面板 Esc 收起保留草稿，⌘Return 发送，发送目标由快照固定；发送不明确时保留固定 messageId 并阻止盲目重试。回复通过 SDK watch 接收，按 entryId upsert。正文省略/游标过旧/流结束均显示真实状态，不把网络断开当成回复完成。

## 4. 动画与打包

仅将已审查的 Bloub engine/geometry 源码与本地 SVG renderer 构建成离线资源，保留 MIT 许可。完整 viewBox、mask、前后轨道/粒子层次按 BotFrame 渲染。SwiftUI/AppKit 负责产品 UI，WebKit 仅用于头像。macOS 与 SDK 形状有显式映射，无法精确对应的形状需文档说明；Touch Bar 参数仍按 SDK 的精确形状绘制。

打包脚本将自身 bridge/SDK、本地头像资源、Node 可执行文件及许可复制到 .app，ad-hoc 签名。使用 preview 模式验证 UI，不通过界面测试自动发送真实消息。

## 5. 验证

运行 Node 离线测试、Swift 状态测试、swift build 与 native/macos/scripts/build-app.sh。通过原生 UI 自动化查看实际面板和名单；允许读取账号名单但不自动触发发送。记录硬件 Touch Bar 滑动、录音/Finder 首次权限和正式签名等尚需用户交互的验证边界。完成后由 requesting-code-review 子代理独立复核。

没有根 Git 仓库，不创建 worktree/commit；本次不创建 GitHub 仓库或发布应用。

## 完成记录

原生代码、SDK 子进程、登录/Keychain、名单、浮动玻璃面板、Touch Bar、全局快捷键、附件、录音入口和离线头像均已实现。58 项 Node/头像测试与 5 项 Swift 测试通过；真实只读桥接返回 37 条统一头像记录。实际界面已检查欢迎页、示例列表、玻璃面板、头像可见与 Esc 草稿恢复。独立复核完成。物理 Touch Bar、跨应用快捷键、Finder/麦克风首次权限和新发送链路仍列为人工验收，见 [交付说明](../native-app.md)。
