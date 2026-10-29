# Touch Bar Bot

Electron 改造已开始，新的 **Grok Bot Anywhere** 位于 [`desktop/`](desktop/README.md)。共享窗口、独立 SDK 服务、本地收件与 Mac 原生伴侣已接入；启动、验证和当前边界见该目录说明。下文仍是原有独立 Mac 应用的使用说明。

原生 macOS Bot 快捷入口，已接入本项目的独立 Grok Bot 协议 SDK。SwiftUI 负责内容与控件，AppKit 负责 Touch Bar、浮窗、菜单栏和快捷键。macOS 26+ 使用原生 Liquid Glass；macOS 14–25 回退系统模糊材质。

## 直接使用

构建好的本机应用位于 `dist/TouchBarBot.app`，双击打开即可。应用内附带 Node 运行时和离线头像资源，不依赖终端的 PATH。

1. 点击“连接 Grok Bot 账号”在浏览器授权；也可主动选择“使用本机已有登录”。应用自己的登录保存在系统钥匙串中，当前没有自动 refresh，失效时重新登录。
2. 搜索或选择一个 Bot，点击“开始对话”。首次使用也可点击“先预览一下”，检查示例界面，预览不能发送。
3. `⌃⌥Space` 全局唤起输入框；应用菜单提供 `⇧⌘Return`。输入框内 `⌘Return` 发送、`Esc` 收起并保留当前进程内草稿。
4. 从 Finder 唤起时，将当前选中文件暂存为附件；也支持拖放或附件按钮选择。当前最多 6 个非空普通文件，每个 <=4MiB；点击发送后才上传。
5. 麦克风按钮启动设备端中文转写，首次使用需授权并具有可用的系统语言模型。录音期间正文暂不手工编辑；停止或关闭面板后释放麦克风。

Touch Bar 使用公开 `NSScrubber`：滑动时中央项更新选择，停下后对齐；点击当前项或名称打开输入框。硬件滑动与重复点击仍需人工确认。公开 `NSTouchBar` 跟随本应用的前台 responder chain；Finder 等其他应用前台时，通过快捷键/菜单栏打开原生面板。

回复流连接就绪后才允许发送；按消息 ID 更新完整文本。切换 Bot 保存会话游标，返回时可恢复期间的更新。附件全部上传成功后才提交一次消息；账号在发送期间不能切换。投递结果不明确时保留 nonce 并暂停发送，跨重启保留暂停记录；用户核对后才能解锁。超时不会自动取消尚在后台执行的上传/发送，解锁前也会检查后台忙碌状态。草稿/回复目前只保留在进程内，退出即清除。

## 本机开发

```sh
node scripts/build-avatar.mjs
swift build
scripts/test.sh
node --test client-mvp/test/*.test.mjs avatar/renderer.test.mjs
scripts/build-app.sh
```

头像构建使用 `bridge/node_modules` 中已锁定的 esbuild；依赖缺失时在 `bridge/` 运行 `npm ci --ignore-scripts`。打包脚本复制本机架构的 Node，因此当前构建为本机 arm64，不是 universal app。构建为本地 ad-hoc 签名，尚无 Developer ID、公证或商店分发。

完整使用和验证边界见 [原生应用交付说明](docs/native-app.md)。

## 客户端登录与真实名单 MVP

`client-mvp/` 是独立于此前 SDK 调研的客户端协议 SDK 与验证 CLI。已验证浏览器登录、账号读取、云端/gateway 名单和附件消息，支持统一头像与 Connect → SSE 回复转发，现已通过 app-bridge 接入 Swift 界面。上一轮 SDK 快照为 35 条，本轮原生桥接只读快照为 37 条。CLI 凭据仅在内存中使用，输出脱敏摘要。接入示例见 [SDK 使用文档](docs/api/sdk-usage.md)。

```sh
node client-mvp/cli.mjs login --cloud-only
node client-mvp/cli.mjs verify --desktop --cloud-only
```

运行说明见 [client-mvp README](client-mvp/README.md)。[接口文档](docs/api/grok-bot-client-api.md) 包含登录、请求头、云端名单、Broker/gateway、附件/转写/发送接口和实测边界；[完整方法目录](docs/api/client-api-catalog.md) 包含静态提取的 484 个 RPC 和 167 个 gateway 声明。

## 方案与桥接环境

- [详细设计方案](docs/plans/2026-10-14-touch-bar-bot-design.md)
- [实施计划与验收关卡](docs/plans/2026-10-14-touch-bar-bot-implementation.md)
- [Cursor / Grok Bot SDK 调研](docs/research/cursor-sdk.md)
- [头像动画调研](docs/research/avatar-animation.md)

`bridge/` 保留早期官方 SDK 调研环境和 mock CLI；当前原生应用使用 `client-mvp/app-bridge.mjs`，不使用它的 provider。头像构建工具使用此目录锁定的 esbuild。

`vendor/bloub/` 是固定 revision 的上游源码 checkout，`assets/bloub/` 保留 MIT 许可、样本和状态映射。完整 engine 已通过本地 SVG renderer 嵌入应用的头像区域。该目录以 Git submodule 固定版本管理；首次拉取使用 `git clone --recurse-submodules`，已有 checkout 使用 `git submodule update --init --recursive`。
