# 原生伴侣（macOS）

状态：Current。macOS 已实机验证；Touch Bar 硬件行为与语音权限仍需人工确认。

## 它是什么

`native/macos/` 是一个 Swift Package，产物 `TouchBarBot` 被打包成 `desktop/native/GrokBotCompanion.app`，由 Electron 主进程以 `--companion` 启动。它补 Electron 做不到的 macOS 系统能力：

- Touch Bar 上的 Bot 头像条（`NSScrubber`）与选择。
- 原生悬浮输入框（AppKit `NSPanel` + SwiftUI/NSGlassEffectView），默认贴当前屏幕底部；卡片顶部短横条可拖动内容，收起按钮始终显示。
- 设备端中文语音识别。
- Finder 当前选区的读取（Apple Events；也可手动选文件）。
- 分享扩展宿主（`GrokBotMenuHost` + 12 appex）。
- 全局快捷键的 Carbon 注册（与 Electron 的快捷键协调）。

## 进程与通信

- 父进程：Electron main。子进程：`TouchBarBot --companion`。
- 只走 stdin/stdout 的 UTF-8 JSON Lines（NDJSON）。stdout 只放协议，stderr 是诊断且必须被排空。
- 没有 socket、没有 token、没有 URL 凭据。父进程 EOF 时伴侣退出。
- 协议版本 1，请求/成功/失败/事件四种信封。完整契约见 [原生伴侣协议](../reference/native-protocol.md)。

## 职责边界

| 做 | 不做 |
| --- | --- |
| 显示/切换 Bot、播放头像状态 | 不登录、不读 token、不直接调 Grok 服务 |
| 打开/隐藏原生输入框，保护草稿 | 不决定投递模式、不生成 receipt |
| 语音转文字，插入输入框 | 不自动发送录音 |
| 读 Finder 选区，交给父进程 | 不访问分享收件箱以外的文件 |
| 显示 Touch Bar 与 pin 状态 | 不在后台重启自己 |

所有 `send` / `resolve` / `watch` 都回到父进程，由服务进程执行。

## 草稿与发送

- `composer.open` 带 `botId` + 可选 receipt。已有草稿时**不覆盖**，返回 `DRAFT_BUSY`，新内容留在持久收件箱。
- 输入框内 `⌘Return` 发送、`Esc` 只收起输入框并保留内容；切 Bot/关面板不丢草稿。顶部把手拖动只移动输入框内容，不移动覆盖全屏的透明面板。
- 发送请求返回前，原生层不能用 UI 超时当作失败；以服务进程结果为准。
- 账号切换会清空所有原生草稿与 receipt 绑定，包括同 ID 的 Bot。

## Touch Bar

- 使用公开 `NSScrubber`；滑动更新中央选择，停下对齐；点击当前项或名称打开输入框。
- 未选中 30×30、间距 8；选中项显示全名不省略。
- 一条离屏画面切帧给每个 Bot，避免每项一个 WebView。
- 只跟随本应用前台；Finder 等其他应用前台时用快捷键/菜单栏打开原生面板。
- 硬件滑动惯性、重复点击、真实 Touch Bar 机型仍需人工验收。

## 语音

- 只在用户主动开始时申请麦克风 + 语音识别权限。
- 强制设备端中文识别，不自动切云识别；关闭/切 Bot 停止录音。
- 录音期间暂停正文编辑；停止后释放麦克风。

## 启动与降级

- 伴侣缺失/启动失败：主进程记录 `NATIVE_COMPOSER_UNAVAILABLE`，主窗口仍可登录、收件、用 Electron 输入框。
- `GROK_BOT_AVATAR_ROOT` 必须指向真实文件系统目录（打包时放在 ASAR 外）；Swift 不读 ASAR 虚拟路径。
- 不自动重启状态不明的伴侣，避免重复草稿/重复发送。

## 独立模式与 Electron 模式

- Electron 模式：不启动内嵌协议桥、不读账号凭据，只服务原生 UI。
- 独立模式（旧 Swift App）：通过 `packages/client-protocol/app-bridge.mjs` 启动 Node 桥，自行登录与发送。两条路径不要混用。

## 源码入口

| 文件 | 作用 |
| --- | --- |
| `native/macos/Sources/TouchBarBotApp/AppDelegate.swift` | 生命周期、`--companion` 参数 |
| `native/macos/Sources/TouchBarBotApp/NativeCompanion.swift` | NDJSON 协议服务端 |
| `native/macos/Sources/TouchBarBotApp/ComposerWindowController.swift` | 原生输入框与玻璃材质 |
| `native/macos/Sources/TouchBarBotApp/PickerWindowController.swift` | Touch Bar / 宫格选择 |
| `native/macos/Sources/TouchBarBotApp/AnimatedAvatar.swift` + `Resources/Avatar/` | Bloub 头像渲染 |
| `native/macos/Sources/TouchBarBotApp/SpeechService.swift` | 设备端语音 |
| `native/macos/Sources/TouchBarBotApp/GlobalShortcut.swift` | Carbon 热键 |
| `native/macos/Sources/TouchBarBotApp/SDKBridge.swift` | 独立模式的 Node 桥启动（Electron 模式不走） |

## 验证

```sh
cd native/macos && swift build
cd native/macos && ./scripts/test.sh          # Swift 测试
npm run build:native            # 重新打包伴侣
npm run smoke:native            # 共享名单、原生输入框、草稿保护
```

`swift test` 依赖 Xcode/CLT 的 Testing.framework；`scripts/test.sh` 处理了 CLT 的搜索路径差异。

未验证：真实 Touch Bar 硬件的滑动惯性/二次点击、麦克风权限拒绝路径、语音识别质量。

## 相关

- [原生协议](../reference/native-protocol.md)
- [macOS 平台](../platforms/macos.md)
- [头像](avatar.md)
