# Touch Bar Bot：需求理解、技术调研与设计方案

日期：2026-10-14（Asia/Singapore）
状态：设计提案；开发环境与 mock 原型已获用户授权。账号自动全量同步、真实附件传输和全局 Touch Bar 常驻尚未验证，不属于已完成能力。

## 1. 产品目标

将账号下已有的、有名字和头像的 Grok Bots 变成 Mac Touch Bar 上的一排快捷入口。左右滑动浏览，停止后确定当前 Bot，展示它的名称；再次点击该 Bot 或按快捷键，打开带动画头像的小输入面板。面板可输入文字、录音，且在 Finder 选中文件时，把选中的文件作为可预览、可删除的待发送附件带进面板。

用户已进一步确认目标是 Cursor 专门管理 Grok Bot 的 SDK。主方案按 Grok Bot 产品理解。普通 Cursor coding Agent / Cloud Agent 单独作为可选 provider，不能用它们的列表冒充 Grok Bot 名单。当前找到官方 BDK Grok Bot 扩展与非官方 grokbot-sdk；尚未核实另一份独立官方全账号管理 SDK，已请求用户提供所见发布链接，同时继续现有研究与环境搭建。

“所有 Bot”应包括本人创建的可用 Bot，区分隐藏 Bot、团队共享 Bot、已删除 Bot，不把只显示在 sidebar 的项目当完整名单。完整性必须用账号 UI 的真实清单对照，不能通过某个 API 返回成功推定。

## 2. 已确认事实与接入边界

| 项目 | 发现 | 对实现的影响 |
| --- | --- | --- |
| Cursor Agent SDK | 官方 TypeScript `@cursor/sdk` 与 Python SDK 存在，支持 local/cloud agent、分页列表、恢复、run 与事件流 | 适合 coding agents；不能由此推导支持全部 Grok Bots |
| Grok Bot | 官方产品是有名称、头像、长期上下文的 Bot，Bot 使用账号共享的云电脑 | 选择必须绑定持久 Bot 身份，不能每次创建新 agent |
| BDK Grok Bot 扩展 | 已检查的 `@cursor/bdk@0.2.24` 随包指南描述 configured bots / caller contacts；不枚举全账号 | MVP roster 可手动导入，但不能验收为“所有账号 Bot 已自动同步” |
| BDK 别名 | 已查 `@cursor/july` 是同版本 BDK 别名 | 不是另一份全账号 Grok Bot 管理 SDK |
| 社区 grokbot-sdk | `@adam91holt/grokbot-sdk` 文档提供 host gateway 的 listAgents、头像与事件流；作者明确非官方 | 可作为候选实验适配层，需核实 host 所在位置和可达性；桌面 app 已安装不代表云 host 在本机 |
| Grok Bot 文本接口 | BDK 指南有 session、messages、entries、interrupt | 先验证明确 session ID 的文本往返；不能混用 coding Agent run |
| 按名称获取 session | get-or-create 可能因名称拼错而创建新 Bot | 不在滑动、点击、启动或刷新时调用；身份绑定需显式流程 |
| Grok Bot 附件 | 官方客户端能附文件；已查 BDK 消息接口没有附件 surface | 客户端能力不等于 SDK 能力；真实附件通道是单独交付关卡 |
| Touch Bar | Apple 公开 `NSTouchBar` 跟随前台应用和 responder chain | 公共 API 不能承诺 Finder 前台时仍展示本应用的所有 Bot |
| 本机动画 | Grok Bot bundle 有程序化头像 renderer；没有发现可直接复用的独立完整动画包 | 不将闭源 bundle 抽取后作为本项目组件发布 |
| bloub | MIT SVG 复现，14 种 catalogue 状态；不是 x.ai 官方动画源码 | 可离线打包并保留署名；实现同风格交互，不宣称逐帧等同官方 |

### SDK 选择

采用原生 Swift/AppKit 客户端 + 独立 Node/TypeScript bridge。官方 SDK 是 Node-first，桥接进程隔离 SDK 更新、认证与事件处理。开发期通过标准输入/输出 NDJSON 通信；不需要本地监听 HTTP 端口。Swift 启动 bridge、管理生命周期与超时，stdout 只输出协议，诊断日志写 stderr 并去掉凭据。

BDK 的 Grok Bot 扩展作为可研究的 GrokBotProvider，普通 `@cursor/sdk` 作为独立 CursorAgentProvider。不把 BDK 的 `Bot` 开发框架对象误认成账号里现存的 Grok Bot 对象。

## 3. 三种实施路径与推荐

| 路径 | 能做到 | 代价与限制 |
| --- | --- | --- |
| A. 原生客户端 + 公开 API，推荐作为基础 | 快捷键唤起、前台 Touch Bar、原生面板、文件暂存、录音、可替换 provider | 全账号 Bot roster 和附件 SDK 尚缺；Finder 前台没有常驻 Bot bar |
| B. 在 A 上增加全局 Touch Bar 集成 | 尽量实现其他 app 前台仍有 Bot 入口 | 需验证第三方宿主或 macOS 私有机制；存在版本兼容、分发与恢复成本；单独模块和开关 |
| C. 用官方 Grok Bot 客户端辅助 | 可借官方客户端完成支持的上传、身份与会话交接 | 需先验证公开 deeplink/自动化入口；若退回 UI automation，会有辅助功能权限和版本脆弱性 |

A 提供稳定基础，B 解决完整常驻交互，C 是账号接口缺口的候选补充。另可研究社区 host gateway SDK，验证能否连接账号的云端 host；其文档中的同机 `sand-data` 指 host 的机器，不是普通 Mac 客户端。B/C 和 gateway 都不能在未做实机 spike 前写成已支持。若没有可靠完整名单或附件通道，交付应明确为“交互原型/已知 Bot 快捷入口”，而不是完整需求已实现。

## 4. 交互设计

### 4.1 Touch Bar

主体使用 `NSCustomTouchBarItem` 包含 `NSScrubber`：free 模式、连续选中、居中对齐。头像目标尺寸约 28–30pt，单项宽 44–52pt；只给当前项加明显选中标记，旁边固定位置显示名称，长名称截断。尺寸需要在本机实际 Control Strip 布局下验证，不能硬编码整条可用宽度。

“停下的地方”定义为选中槽中心最近的头像：手指移动过程中更新候选，结束及吸附完成后提交 selectedBotID。提交不会发送消息、创建 session 或打开面板。点击新头像只切换，点击已选中的头像才打开面板。触摸结束和点击回调需要去重，避免一次滑动误打开。

列表刷新保持 selectedBotID 和当前顺序，不因为后台刷新跳到其他 Bot；头像异步加载不改变 item 尺寸。网络失败继续展示缓存，明确离线状态。大量 Bot 通过复用视图与头像缓存支持，不为每项创建 WebView。

### 4.2 全局快捷键和窗口

建议默认 `⌃⌥Space`，允许修改和冲突检测；这是拟定值，当前原型的快捷键以 README 为准。第一次按键先记录来源应用，若 Finder 在前台，则获取它的选中文件快照，再激活本应用。再次按键打开当前 Bot 的输入面板；也可为“直接输入”单独配置快捷键。

浮动 `NSPanel` 约 460×280pt，可随附件和转写内容增长；避免抢掉原输入应用的上下文。包含动画头像、Bot 名称、文字输入、附件条、录音按钮、发送按钮和紧凑状态。`Esc` 收起保留草稿，`⌘Return` 发送；焦点丢失不自动丢掉输入。每个 Bot 单独保存草稿，发送开始后固定目标 ID。

状态为 hidden / composing / recording / transcribing / uploading / sending / responding / success / error。允许收起面板后继续任务；如果 Bot 要求操作审批，显示明确入口跳转官方会话，不在小面板内静默批准。

### 4.3 Finder 文件

通过 Finder 的 Apple Events 读取 `selection`，直接操作 Finder，不通过 System Events 模拟复制。系统 Finder.sdef 已确认该属性表示 frontmost Finder window 中选中的项。获取前检查来源应用，避免从其他应用触发时附上 Finder 中残留的旧选择。

先捕获 URL 元数据，不自动上传。面板显示文件名、类型、大小和删除按钮，用户点击发送后才读取/上传。提供拖放与 NSOpenPanel 后备方式；权限被拒绝时仍可正常输入。文件不存在、未下载的 iCloud 文件、包目录、普通目录、别名、超限文件分别给明确状态，不盲目打包目录。

Grok Bot 官方客户端当前文档写桌面每消息最多 6 个附件，文档/图片/音频每个 25MB、视频 200MB。此值作为设计参考，不能套成 BDK API 合约；最终以具体 provider 的能力声明与服务端响应为准。

上传必须传真实字节并取得附件引用；把本地 `/Users/...` 路径塞进云端 prompt 不算发送附件。不支持附件的 provider 需要禁用发送含附件的消息并说明原因，不能静默丢文件。

### 4.4 录音

按下录音后才申请麦克风权限并启动 `AVAudioEngine`。默认流程为语音转成可编辑文字，再发送；保留“以音频附件发送”的 UI 位置，但只有 provider 支持后开放。以声级包络驱动头像，避免复制原始音频到 JS renderer。

优先用 Apple Speech 的设备端识别，运行时检查语言与 on-device 支持；缺少离线模型时明确状态，不自动切到未声明的云服务。停止录音后清理音频 tap、识别任务和临时文件；面板关闭不能造成麦克风继续采集。转写错误保留本次录音供用户重新处理或删除。

## 5. 头像动画

Touch Bar 使用头像静帧/小尺寸轻动画；完整 SVG 动画只在输入面板出现。`AvatarRenderer` 和 Bot provider 解耦，不要求服务器推送官方表情。

优先次序：公开可导出的本机用户头像/有明确授权的动画资产 → bloub MIT renderer。现阶段找到的官方本机头像逻辑位于闭源 React bundle，preload-avatar-source 主要处理静态图片读取与缩放，不满足“独立动画包可直接拿来”的条件。

bloub 使用离线 `WKWebView`，抽出渲染组件，构建本地静态资源，限制导航和 JS bridge 消息。14 个 catalogue 状态完整保留并提供开发预览；实际交互映射为 idle/composing→idle、listening→wide、sending→comet、thinking→thinking、working→orbit、waitingForUser→notify、done→wink。动画是本客户端的状态反馈，并非服务器原始内部推理/表情数据。失败和未确认状态采用明确文字提示。

跟随指针的 gaze、点击响应、麦克风声级、响应节奏可以独立驱动。面板关闭停止 requestAnimationFrame；尊重减少动态效果；保留 MIT LICENSE 和来源 commit。上游说明 MIT 覆盖代码，不覆盖所模仿的 x.ai 视觉设计。无需拷贝原项目完整编辑器、GIF 导出等产品 UI。

## 6. 组件与数据流

```text
GlobalShortcut / MenuBar
          |
FinderSelectionCapture（激活前）
          |
BotStore <---- BotRosterProvider ---- Node bridge ---- Grok Bot / Cursor SDK
   |                 |                                      |
TouchBarController   cache                           normalized events
   |
ComposerPanel ---- DraftStore / AttachmentStaging / SpeechService
   |                                         |
AvatarRenderer                         provider capabilities
   |
离线 bloub SVG
```

Bot 记录至少包含 provider、stableID、name、avatarSource、ownership、visibility、capabilities、sessionBinding、status、updatedAt。主键是 provider + stableID，名字不是身份。capabilities 包含 completeRoster / textSend / attachments / audioAttachments / liveStatus / cancel。

协议 envelope 包含 requestID、method、params 和 typed result/error；流事件有 requestID、botID、sequence、kind。取消本地等待和取消服务端任务需要区分。请求超时之后发送状态可能不明确，应先检查原 request/messageID，不能无条件再发。

认证使用官方登录/用户主动提供 API key，在正式应用中存 Keychain。开发 mock 不读取已有 app 凭据。不要因发现本机已登录就推定 Node bridge 已获授权；不读取第三方 cookies 或私有账号数据库作为默认认证方案。

## 7. 验收与失败处理

1. 完整名单：以账号官方清单对照，包括隐藏项处理；公开扩展的配置列表不能冒充全量。
2. 选择交互：50 个以上 Bot 可滑动，停下居中选中、名称一致、首次选中不误打开、再次点击打开。
3. 目标正确：点击发送后切换 Bot 不改变此次目标；身份绑定失败不能偷偷创建新 Bot。
4. 附件正确：Finder 多选进入草稿，删除项不发送，权限拒绝不阻断文字输入；真实 Bot 能读到文件内容。
5. 录音正确：开始/停止、权限拒绝、切换语言、关闭面板后的麦克风释放可实测。
6. 动画正确：14 状态可预览，离线运行，关闭不耗持续帧循环；明确它是 bloub 复现。
7. Touch Bar：实际 M1 MacBookPro17,1 验证；分开报告前台公开实现与跨 app 常驻能力。
8. 故障恢复：登录失效、网络断开、bridge 退出、重复事件、超时不造成重复发送或丢草稿。

## 8. 本次工作与下一步关卡

本次交付是调研、详细设计、实施计划和经验证的开发环境/mock 骨架，不是已连接账号的成品。

首先完成三个 spike：完整 roster 的可支持获取方式；现有 Bot session 的文本往返；真实文件上传与会话引用。它们决定正式 provider 实现。其次在真 Touch Bar 上确认 scrubber 的停止选择和二次点击，再实现快捷键/Finder/语音/动画。

公开 API 路线确定不了全局常驻时，将全局 Touch Bar 集成列为独立兼容实验，不能因此延误原生面板和账号适配层。

## 9. 来源

后续用户明确考虑手表部署：见 [BDK / 社区 SDK 与 watchOS 追加研究](../research/2026-10-14-bdk-vs-grokbot-sdk-watch.md)。架构新增长期服务端adapter与watchOS原生客户端方向；桌面WKWebView动画不直接复用到Watch，正式附件协议仍需验证。

- [Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript)
- [Grok Bot 概述](https://cursor.com/docs/grok-bot)
- [Work with Grok Bot](https://cursor.com/docs/grok-bot/work)
- [Grok Bot 设置](https://cursor.com/docs/grok-bot/settings)
- 官方 npm `@cursor/bdk@0.2.24` 随包 `docs/guides/grokbot-agents.md`；本项目研究报告将记录本地可复查位置
- [BDK 官方 npm 包](https://www.npmjs.com/package/@cursor/bdk)
- [社区 grokbot-sdk 源码与自述](https://github.com/adam91holt/grokbot-sdk)（非官方；仅研究，当前不连接 host）
- [NSTouchBar](https://developer.apple.com/documentation/appkit/nstouchbar)
- [NSScrubber](https://developer.apple.com/documentation/appkit/nsscrubber)
- [Apple Events entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.automation.apple-events)
- [Device speech support](https://developer.apple.com/documentation/speech/sfspeechrecognizer/supportsondevicerecognition)
- [bloub 源仓库](https://github.com/jeremy-prt/bloub)，MIT；固定 commit 见 avatar-animation 研究报告
- 本机只读证据：Finder.sdef、Grok Bot.app 公开 bundle、开发工具链与 Touch Bar 设备枚举；未读取凭证或聊天存储
