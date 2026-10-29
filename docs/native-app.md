# 原生应用交付说明

日期：2026-10-15，Asia/Singapore。应用：`dist/TouchBarBot.app`，版本 0.2.0，本机 arm64 构建。

## UI 与架构

- SwiftUI `NavigationSplitView`、原生 List/搜索/TextEditor/按钮，系统字体、语义颜色、原生菜单栏。
- AppKit `NSPanel` 承载小输入框；macOS 26+ 用 `NSGlassEffectView.regular`，圆角 28pt；旧系统用 `NSVisualEffectView`。玻璃只作为浮层承载，不将整个内容做成多层装饰。
- `NSTouchBar` + `NSScrubberImageItemView` 显示头像，形状/颜色来自 SDK 的统一输出，UUID 是身份主键。
- Swift `Process` 的 stdin/stdout NDJSON 调用自身 `client-mvp/app-bridge.mjs`，没有本地 HTTP 监听端口。SDK 的公开 SSE 输出保留，桌面 App 直接消费其 AsyncGenerator 事件。
- `.app` 内含 Node、自己的 SDK、头像资源和第三方许可；Node 标准输出只作为协议，凭据不会写日志。Mac 旧登录只由用户主动点击后读取；独立登录保存到本应用的 Keychain。

Apple 原生材质 API 及使用建议：[NSGlassEffectView](https://developer.apple.com/documentation/appkit/nsglasseffectview)、[Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)。

## 本次验证

| 项目 | 结果 |
|---|---|
| Swift 构建与模型测试 | 5 项通过：稳定选择、名单刷新、草稿隔离、发送目标冻结、编辑保护 |
| Node / 离线头像测试 | 58 项通过：SDK、桥接、取消、投递不明确、并发账号隔离、14 动画状态 |
| 真实账号桥接只读名单 | 当前 37 条，无截断，37 条均有统一头像；没有输出 token 或聊天正文 |
| 应用内 Node 与 NDJSON | 打包运行时成功启动桥接；未登录请求返回固定 NOT_CONNECTED |
| 实际原生窗口 | 欢迎页、4 Bot 示例名单、选择切换、玻璃输入面板及动画正常显示 |
| 实际草稿 | 原生编辑器粘贴文字 → Esc 收起 → 再打开，内容保持 |
| 代码复核 | 独立子代理进行离线复核；账号/发送竞态、会话过滤和投递状态问题均已修复 |

这次没有发起新的 Bot 消息，真实发送与附件协议沿用此前 [附件验收](api/webhook-attachment-live-report.json)。回复协议此前已有 [真实 SDK → SSE 回放验收](api/sdk-live-report.json)。原生 UI 的完整新发送 → 新回复链路尚未重新发消息验收。

## 功能与限制

登录：支持浏览器 PKCE 和主动使用本机已有登录；长期 refresh 未实现。退出应用不会在服务端撤销授权；退出账号会移除本应用保存的 Keychain 记录。

选择：名单来源为云端 ListGrokBotAgents，返回截断时明确标记，包含可见团队记录。背景刷新保持稳定 ID 选择。公开 Touch Bar 只能跟随本应用；系统全局常驻条未实现。Carbon 全局快捷键注册提供冲突提示，实际跨应用按键和真实 Touch Bar 的惯性/二次触摸需要人工硬件验收。

附件：Finder 位于前台时才采集选中项，进入草稿不上传；Apple Events 拒绝时仍可手动选文件。首次 Finder 系统授权需人工操作。暂不支持目录、空文件、multipart 或大于 4MiB 的文件。远端休眠时上传可能唤醒账号的云电脑。

语音：仅用户启动后申请麦克风和语音识别权限；优先且强制设备端中文识别，不自动切换云识别。关闭/切换 Bot 停止录音；实际麦克风权限及识别质量尚需人工验收。

动画：Bloub MIT 引擎完整保留 14 种 catalogue 状态，完整 viewBox、眼睛 mask、前后轨道和粒子层次。当前 UI 使用 idle、录音 wide、发送 comet 和指针视线，未把收到一条文本更新伪装成整回合完成。8 种默认形状显式映射到 Bloub；其他显式形状暂显示本项目静态角色近似，不伪装为相同官方 renderer。自定义照片优先，URL 不可读取时回退角色。关闭面板停止动画，减少动态效果时显示静帧。主窗口/Touch Bar 的静态轮廓是本项目原生近似绘制，未逐像素复刻官方闭源形状。

回复：只订阅选定 Bot/session；回复是完整文本 upsert，尚未验证逐 token。连接成功后才能发送，初始游标也保存；已排队的旧订阅事件通过 subscriptionId 与 session 过滤。游标过旧、正文省略和断开有明确状态，需要手动重新连接或到官方客户端查看；不自动补取完整历史。

发送：当前全局串行，上传全部成功后才提交；切换 Bot 不改变冻结的接收者。网络未知或未知 delivery ack 暂停此 Bot，nonce 写入 UserDefaults；账号 token 仅存在 Keychain/进程内存。暂停后先核对官方客户端和后台状态再解除，不会自动重发。进程内草稿不会跨重启保存，退出前需处理未发送内容。

## 文件入口

- UI：`Sources/TouchBarBotApp/NativeViews.swift`
- 面板与玻璃：`Sources/TouchBarBotApp/ComposerWindowController.swift`
- Touch Bar：`Sources/TouchBarBotApp/PickerWindowController.swift`
- 状态/账号：`AppStore.swift`、`BotModels.swift`、`CredentialStore.swift`
- 桥接：`SDKBridge.swift`、`client-mvp/app-session.mjs`、`app-bridge.mjs`
- 系统接入：`GlobalShortcut.swift`、`SpeechService.swift`
- 动画：`avatar/`、`AnimatedAvatar.swift`、`Resources/Avatar/`

Bloub 署名保存在应用 About 面板及 bundle 内 MIT 许可。项目为非官方客户端；当前本机测试包未作正式分发。
