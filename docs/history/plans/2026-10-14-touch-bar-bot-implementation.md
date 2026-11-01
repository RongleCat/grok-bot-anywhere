# Touch Bar Bot Implementation Plan

> For Codex: 按任务顺序实施，每个接入关卡以实际行为验收；开发 mock 不代表账号能力已完成。用户已授权子代理搭建开发环境，正式功能实现按本设计提案推进。

**Goal:** 将本人已有 Grok Bots 显示到 Mac Touch Bar，提供停止选择、重复点击输入、Finder 附件、录音和完整动画反馈。

**Architecture:** Swift/AppKit 负责 Touch Bar、面板、Finder、录音；Node/TypeScript 子进程负责 SDK/provider。AvatarRenderer 用本地 WKWebView 包装 bloub SVG engine，名单与附件采用能力声明，避免 unsupported 功能被静默降级。

**Tech Stack:** Swift 6.2 / AppKit / WebKit / AVFoundation / Speech / Swift Testing；Node 22.13+ / TypeScript / 官方 Cursor SDK与BDK（版本以 bridge lockfile 为准）。

## Task 0：开发环境（本次完成范围）

文件：`Package.swift`, `native/macos/native/macos/Sources/TouchBarBotApp/`, `Tests/`, `scripts/`, `bridge/`, `assets/bloub/`, `docs/history/research/`。

1. 检查 macOS、Swift、Node、Touch Bar、应用 bundle，不输出序列号和凭据。
2. 建立不依赖真实账号的 AppKit mock picker/panel 和 Node bridge。
3. 验证 `swift build`、`native/macos/scripts/test.sh`、`native/macos/scripts/build-app.sh`；CLT 的 Testing framework path 用单命令参数处理。
4. 在 `bridge` 下运行 `npm ci --ignore-scripts`（仅需要重新安装时）、`npm run typecheck`、`npm test`、`npm run build`；以实际 scripts 为准。
5. 输出 `dist/TouchBarBot.app`，记录本地 ad-hoc 签名与正式分发缺口。

## Task 1：确认正确的 Grok Bot SDK 与全量 roster

文件：修改 `docs/history/research/cursor-sdk.md`；创建 `bridge/src/providers/roster.ts`、`bridge/test/roster.test.ts`。

1. 用用户提供的正式 SDK 发布链接核对 publisher、包版本、exports、认证、完整性声明；没有链接时以当前官方包与原仓库为证。
2. 创建 fake transport，设计分页去重测试：第 1 页含 A/B、第 2 页含 B/C，结果为 A/B/C，不能丢隐藏项或无限循环。
3. 实现 `BotRosterProvider`，返回 `complete: boolean`, `source`, `items`, `limitations`。BDK configured/contact 名单固定 `complete: false`。
4. 使用本地 fixture 验证稳定 ID、重名、改名、隐藏、删除、团队 Bot 的分组。
5. 真账号只读对照官方 roster 后记录差异，确认前不宣布“所有 Bot”。社区 gateway 若纳入，仅做明确连接目标的实验 provider，不自动寻找 token 或读 host 数据库。

验收：名单来源和范围明确；正确 provider 可以与官方 UI 全量一致，或清楚报告不完整。

## Task 2：身份绑定与现有 Bot 文本通信

文件：`bridge/src/providers/grok-bot.ts`、`bridge/src/protocol.ts`、`bridge/test/grok-bot.test.ts`；Swift `BotStore.swift`, `BridgeClient.swift`。

1. 先测试未绑定 session、未知 Bot、空文本、重复 requestID、超时重试；未绑定不得 get-or-create。
2. 以已知、确认的 sessionID 发送文字并用 messageID 去重。名称只用于 UI，不作为发送目标主键。
3. 用 fixture 将 entries/updates 规范为事件，验证 updatedSeq 增量与重复事件。
4. Swift 通过 `Process` 的 pipes 使用 NDJSON；超时、EOF、bridge 异常退出恢复并保存草稿。
5. 真账号验收用一个既有 Bot：发送一次测试文本、收到回复、确认没有新增 Bot；不要让编译测试触发真实消息。

验收：目标正确、上下文持续、错误可见、重试不会重复发消息。

## Task 3：Touch Bar 正式选择与快捷键

文件：`native/macos/native/macos/Sources/TouchBarBotApp/TouchBarController.swift`, `BotStore.swift`, `GlobalShortcut.swift`；选择逻辑测试放 `Tests/TouchBarBotAppTests/`。

1. 复用现有 mock `DemoSelection` 的可测试状态机制，扩展稳定 ID。
2. 测试首次选中、重复选中、删除当前项和列表刷新；把拖动候选与最终选择分开。
3. NSScrubber 的 free/center/continuous 模式配合结束回调，不把拖动回调当点击。
4. 配置快捷键注册、注销、冲突提示；触发前先记录来源 app。
5. 在真实 Touch Bar 上测试 8/50/100 项、Control Strip 宽度变化、惯性停止、二次点击和输入焦点。

验收：停止后选中居中项，名称一致，滑动不误开面板，二次点击和快捷键均可打开。公开实现只承诺本 app 前台。

## Task 4：输入面板与每 Bot 草稿

文件：`ComposerPanel.swift`, `DraftStore.swift`, `ComposerState.swift`。

1. 将 mock panel 换成绑定真实 BotStore 的面板；显式显示身份和 provider。
2. 每 Bot 保存文字与附件，`Esc` 收起保留，`⌘Return` 发送。
3. 测试发送后切换 Bot 的目标冻结和不同 Bot 草稿隔离。
4. 根据 provider capabilities 控制附件/音频按钮，不吞掉不支持的输入。
5. 展示紧凑响应、错误、忙碌、审批入口；详细会话通过经验证的官方跳转入口打开。

验收：不丢草稿、不误发、可从错误恢复。

## Task 5：Finder 快照与真实附件通道

文件：`FinderSelectionCapture.swift`, `AttachmentStaging.swift`, `scripts/Info.plist`；bridge `attachments.ts`、相关 transport tests。

1. 快捷键回调在激活前判定 Finder 为来源；读取 selection，不模拟 Cmd+C。
2. 仅申请 Finder automation 权限，失败提供手动选择/拖放。
3. 构建附件 metadata/chips，测试多选、删除、重名、消失、iCloud未下载、目录和超限。
4. 验证具体 Grok Bot upload 协议、signed URL 或官方交接接口；只做真实字节上传，不能把本地路径当云附件。
5. 附件全部传完后再提交消息；取消或任一失败保留草稿，避免半条消息已经发送。
6. 真账号用不敏感 fixture PDF/图片，确认目标 Bot 读到内容，attachment ID 正确归属该消息。

验收：选中文件进入草稿，用户可删除；真正上传并被读取。无官方通道时此任务保持未完成，不以“文本摘要”代替。

## Task 6：录音与转写

文件：`SpeechService.swift`, `AudioRecording.swift`, `scripts/Info.plist`, `ComposerPanel.swift`。

1. AVAudioEngine + Speech，启动录音时申请权限，运行时检查 on-device 支持。
2. 文本转写为可修改草稿；音频附件作为 provider 可选能力。
3. 发送归一化 amplitude 给 AvatarRenderer；不把音频或 transcript 传给动画 JS。
4. 测试拒绝、取消、面板关闭、录音设备消失与多次开始/停止，验证资源释放。
5. 实机确认输入录音、转写和发送，缺少语言模型时显示明确信息。

验收：关闭录音后麦克风停止，转写可编辑；不支持音频上传时不会伪装已发送音频。

## Task 7：完整 bloub SVG 动画

文件：新建 `avatar/` 构建小 renderer；`native/macos/native/macos/Sources/TouchBarBotApp/AvatarRenderer.swift`；使用 `vendor/bloub/src/bot/`、`assets/bloub/`。

1. 审查上游 runtime engine，再创建独立 bundler 配置，只引入 engine/face/skins，不打包整个 studio。
2. 输出离线 HTML/JS，用完整 viewBox 和遮挡顺序绘制 BotFrame；保留14 catalogue状态与swirl过渡。
3. Swift→JS 参数只允许 shape/color/state/look/amplitude/visible/reducedMotion，不拼接用户输入。
4. 按 animation-contract.json 映射真实状态，监听事件与文字状态同步。
5. 检查离线、减少动态效果、面板隐藏停止帧循环、错误静帧 fallback。
6. 逐状态固定时间采样截图，对照上游 renderer，确认眼睛、洞、环与粒子没有遗漏。

验收：完整交互动画可演示，非单GIF循环；保留版权与来源说明。

## Task 8：全局 Touch Bar 实验与分发

文件：独立 `GlobalTouchBarIntegration/` 或 capability 模块；新增 `docs/history/research/global-touch-bar.md`。

1. 先验证可用第三方宿主/公开扩展是否支持所需动态列表和滑动，再评估其他机制。
2. 在 Finder、浏览器、IDE 前台分别验证；不把本 app foreground bar 的成功当全局成功。
3. 若使用非公开机制，封装版本检测、开关、崩溃隔离和恢复，单独分发实验版本。
4. 打包 Node runtime与所需 SDK平台文件、avatar静态资源；在不依赖开发者PATH的.app中运行。
5. 正式签名、公证、稳定bundleID后验证Finder/麦克风授权与更新保留，最低系统版本单独测试。

验收：明确分开公共前台版与全局实验版，硬件验证通过，有故障回退。

## 最终回归清单

只在新修改、失败或未解决问题时重复相关检查，不把环境搭建扩展成无意义测试堆叠。

- Swift 编译、选择/草稿状态测试、bridge 类型/transport测试通过。
- 真机 UI：滑动停止、二次点击、快捷键、文件多选、录音权限与关闭、14动画状态。
- 真账号：全量 roster 对照、既有 Bot 文本、文件字节读取、忙碌/断网/超时避免重复。
- 离线：缓存、草稿和动画可用；登录失效可恢复。
- 根仓库初始化/提交时先决定 vendor snapshot 或 submodule；当前 upstream clone 保留内层git，不能误提交为意外gitlink。
