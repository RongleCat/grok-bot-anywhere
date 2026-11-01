# macOS 开发环境与 Touch Bar 可行性

检查日期：2026-10-14（Asia/Singapore）。只进行只读环境检查和项目目录内构建，没有安装大型工具、修改系统设置或申请隐私权限。

## 本机结果

| 项目 | 检查结果 |
| --- | --- |
| macOS | 27.0，build 26A5406e |
| 架构 | arm64 |
| 硬件 | MacBookPro17,1，Apple M1，16 GB RAM |
| Touch Bar | IORegistry 中实测存在 TouchBarUserDevice，TouchBarServer 已运行 |
| 活跃开发工具 | /Library/Developer/CommandLineTools；未发现 Xcode.app |
| Swift | Apple Swift 6.2，swift-driver 1.127.14.1 |
| SDK | /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk |
| Clang | Apple clang 17.0.0 |
| Git | 2.50.1 |
| Node | 22.22.0（原生应用不依赖它） |
| 已安装应用 | Cursor.app、Grok Bot.app、Grok.app；本文件不读取账号存储或应用凭据 |

Apple 的 [机型识别页](https://support.apple.com/en-gb/108052) 将 MacBookPro17,1 映射为 13-inch M1 2020；该型号的 [技术规格](https://support.apple.com/en-us/111893) 明确列出 Touch Bar。

## 公开 API 能实现的范围

[NSTouchBar 官方文档](https://developer.apple.com/documentation/appkit/nstouchbar?language=objc) 说明，支持的 MacBook Pro 显示前台应用提供的 Touch Bar，系统沿 responder chain 决定显示哪个 bar。因此，我们的公开 AppKit 实现可用于应用前台的 picker 和 composer。不能把「Finder 前台时所有 Bot 依然全局驻留」当成公开 API 已支持的能力；这是必须在正式方案中独立决策的要求。没有找到公开的任意 Control Strip 第三方常驻入口，原型不调用私有 API。

[NSScrubber](https://developer.apple.com/documentation/appkit/nsscrubber) 是为 Touch Bar 设计的横向选择控件。本机 SDK 的公开 AppKit/Headers/NSScrubber.h 提供可直接验证的行为说明：free 模式允许横向滚动；continuous 为 true 时，在 itemAlignment 指定的轴经过的元素会自动被选择；center 对齐会让滚动结束时某个元素停在中央。使用此组合可完成「滑动选择、停下确定中央 Bot」，硬件触感与停靠时序还需交互验收。

原型用 NSWindowController 提供 Touch Bar，NSScrubber 负责头像选择，名称按钮打开 NSPanel。这里显示 Unicode 头像占位，完整 Grok Bot 动画由独立资源调研接入。应用内菜单快捷键为 Command+Return；它不是全局快捷键。

## 构建和验证

- SwiftPM 原生 AppKit executable，无第三方包。
- `swift build` 已验证开发工具链能编译与链接该 AppKit 原型。
- `native/macos/scripts/test.sh` 使用 Swift Testing 测试选择索引边界和重复点击逻辑。
- 直接导入 XCTest 在本机 CLT 环境报 no such module。Testing.framework 存在于 CLT/Library/Developer/Frameworks，但默认 SwiftPM 搜索路径缺失；测试脚本只为该命令添加 -F 和 rpath，不改变 xcode-select 或系统配置。
- 初始重复选择测试实际失败，证明能抓到 selection 未更新；随后实现选择逻辑。
- 最低部署 macOS 14，与当前 CLT 内 Swift Testing 的运行库版本对齐。正式兼容更早系统时可将测试配置与应用部署目标分离。
- `native/macos/scripts/build-app.sh` 生成 dist/TouchBarBot.app 并 ad-hoc 签名；发布版仍需 Developer ID、公证和明确的部署策略。
- release `.app` 已实际打包成功，并通过 native UI 验证：选择代码助手会更新名称；重复点击该头像打开 panel；应用内 Command+Return 能重新打开；文本能输入，检查按钮显示字符数且不会发送。已检查两个窗口截图，未见布局裁切。Touch Bar 物理滑动未由自动化工具验证。

## 下一阶段依赖

Finder 所选文件建议通过限定 Finder 的 Apple Events 查询或 Share Extension 导入，必须在切换前台前保存原上下文。启用前应清晰说明自动化用途并按系统流程申请 Finder automation 授权，不能自动写入 TCC。

录音建议使用 AVAudioEngine/AVAudioRecorder；只有用户点击录音时才申请麦克风权限。可选择 Speech 做转写，此时需独立的语音识别授权。全局快捷键、Finder 自动化、真实发送和头像动画都没有混进本次环境原型。

完整 Xcode 对 SwiftPM 这个 mock 原型不是必需条件，但签名、调试、Share Extension 和完整 XCTest 工程阶段应补齐。不要仅为当前可编译原型下载数十 GB 工具。
