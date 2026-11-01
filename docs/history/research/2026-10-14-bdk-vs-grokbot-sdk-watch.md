# BDK 与 grokbot-sdk 原理、功能和手表部署对比

日期：2026-10-14，Asia/Singapore。
范围：官方 `@cursor/bdk@0.2.24` 的 Grok Bot 扩展，与社区 `@adam91holt/grokbot-sdk`。手表先按 Apple Watch / watchOS 评估；不是已实现或已完成实机验收的手表应用。

## 结论

针对“控制账号已有 Bot”的功能广度，社区 SDK 明显更全面，也更贴近头像选择、名单、未读与状态同步。官方 BDK 的整体能力是构建自己的 agents；其 Grok Bot 扩展只是咨询已有 Bot 的窄入口，不能拿整个 BDK 的插件/部署能力当作已有 Bot 的管理 API。

两套实现都可用于支撑手表客户端，但都不是原生 watchOS SDK，也不能把 Node 包直接放进普通 watchOS app。推荐 watchOS SwiftUI 客户端 + 独立、可长期运行的后端；后端切换官方 session provider 或社区 gateway provider。手表不承担 Node runtime、长轮询、持续 SSE 或 Bot host 文件系统操作。

目前没有真实账号联调，社区 gateway 的可达性、名单完整性和附件上传仍待验证。源码有功能入口不等于账号可使用。

## 核验依据

- 官方 BDK 已安装包：`bridge/node_modules/@cursor/bdk/docs/guides/grokbot-agents.md`、`dist/extensions/cursor-grokbot-agents/lib/backend.js` 与 `.d.ts`。
- 社区源码只读下载至 `/tmp/touch-bar-bot-grokbot-sdk-research`，revision `c14347fa82d167b9a5984ec1baff56b2f074485a`；该 checkout 的 package.json 为 `0.2.0`，不以此推定 npm latest。没有安装/执行它的脚本、读取 host 文件、获取凭据或连账号。
- Apple 官方 watchOS 网络、后台执行、通知、WatchConnectivity、Web Views 与 Digital Crown 资料。

## 1. 官方 BDK Grok Bot 扩展怎么工作

链路：调用方 → BDK extension 工具 → `api.cursor.com/v0/grokbot/...` → 账号已有的云端 Grok Bot。

扩展提供 ask / check / interrupt / list。ask 按名称获得 session，发送一条文本，然后按 transcript 游标轮询；超出等待时间后可以 check 继续消费新回复。底层 HTTP 请求使用 Cursor API key 的 Bearer 认证，不需要调用方直接连接 Bot 电脑上的私人 gateway。

源码的四条路由：

| 操作 | 路由 | 语义 |
| --- | --- | --- |
| 获得 session | POST `/v0/grokbot/sessions` | `{name}`，不存在时创建；不是只读查询 |
| 发送 | POST `/v0/grokbot/sessions/{id}/messages` | `{text,messageId}`，检查 delivery 接收结果 |
| 读取 | GET `/v0/grokbot/sessions/{id}/entries?afterUpdatedSeq=...` | 文本条目与 idle/inFlight/queued |
| 停止 | POST `/v0/grokbot/sessions/{id}/interrupt` | 停止当前工作；保留 Bot 的持续上下文 |

list 是扩展自己知道的配置名单/caller contacts，并非全账号清单。Caller 的读游标分开，但目标仍是同一 host credential 账号的现有 Bot 对话，并不自动创建隔离的 Bot 记忆。ask 检测 Bot 忙碌时不发送新任务；共享官方客户端使用的会话需要处理并发。

选择这个实现的原因是认证和网络路径简单、实现来自官方发布包。限制是当前已查扩展没有 roster、avatar、attachment 或通用管理接口。底层 backend 不是独立公共 export；直接复刻它的 HTTP 不能冒充官方独立 Swift SDK或已保证稳定的REST合约。已有 app 中的实验 adapter 就按这个边界标识。

## 2. 社区 grokbot-sdk 怎么工作

它有两个不同入口，不能混淆：

### Gateway 客户端（建议研究这条）

链路：调用方 → TypeScript wrapper → Bot computer host 的 HTTP gateway → 真正的 Grok Bot host process。

`listAgents()` 实际是 JSON POST `/api/listAgents`；类似地封装 sendPrompt、interruptAgentRun、updateAgent、getAgentTranscript 等命令。`GET /avatars/{id}` 返回头像字节，`GET /events` 读取 SSE。调用者需要可达 host URL 和 gateway token；该 token 不是 Cursor API key。默认通过 host 同机的 gateway.json 发现端口和 token。

gateway 位于 Bot 电脑，通常需要 private network、隧道或明确的网络入口。安装 Mac 官方客户端不会自动使 `/home/box/sand-data` 和 host gateway 出现在 Mac。SDK 仓库也不提供 host 本身。

类型与命令表来自 host bundle 的提取快照，仓库有 manifest 和 compat() 用于比较 host version。TypeScript 类型包装大部分是编译期提示，不能推定服务端 schema 永远一致；尤其未专门包装的 command 需要验证字段。

SSE 是状态/频道事件入口，不应简单称为已经支持逐 token 文本流。`sendPrompt({wait:true})` 仍是客户端等待/轮询 idle 并读取 transcript tail 的组合，不是服务端阻塞到任务结束的单一 RPC。

### Disk 读写器（不作为跨设备主路径）

GrokBotDisk 在 host 同机读取 sand-data 的 profile、transcript、SQLite、memory、automation/workflow 文件；无需网络 token，也不需要 host process 正在运行，但必须有 host 文件权限。部分 memory 写入绕过 host 的 watcher/合并逻辑，上游建议 host 运行时优先走 gateway。

它无法直接从远程手表读取云 host 磁盘。后端可在 host 同机用它辅助排查，但产品主路径不靠扫描私有文件，不把磁盘离线快照当实时名单。

## 3. 与本项目需求的功能对照

以下是发布包/源码的入口范围，不是实际账号验收结果。

| 功能 | BDK Grok Bot 扩展 | 社区 gateway SDK |
| --- | --- | --- |
| 联系已有 Bot | 有，名字解析到 session | 有，名单与 stable ID |
| 全名单来源 | 配置和caller contacts；非全账号枚举 | 有 host roster listAgents；全账号/隐藏/团队覆盖仍需对照 |
| 静态头像/形状/颜色 | 未发现 | 有头像字节、shape/color/version等字段 |
| 完整官方头像动画 | 无 | 无；头像字节/元数据不能替代 renderer |
| 发送文本/读回复 | 有，游标轮询 | 有，sendPrompt 与 transcript API |
| 工作状态/未读 | 基础 turn 状态 | roster 有 running/composing/unread/waiting等字段，并有 SSE |
| 停止当前任务 | 有 | 有 |
| 新建/修改/隐藏/群组 | 狭窄 get-or-create 入口 | 有专门命令/typed wrappers |
| memory/自动任务/workflow | 此扩展未发现管理接口 | 有管理接口与 host 同机 disk 辅助 |
| 任意文件附件 | 当前文本 surface 未发现 | 部分协议线索：sendPrompt 的 attachmentPaths/attachmentNames + uploadAttachment 命令名 |
| 独立 Node 22 runtime | BDK 要求 Node >=22.13 | package声明 Node >=22 |
| 直接部署 watchOS npm 包 | 无此支持 | 无此支持 |

### 附件的重要细节

社区实现更接近附件需求，但此次不能把它写成“已经完整支持 Finder 上传”。源码中：

- SendPromptInput 确实有 `attachmentPaths` / `attachmentNames`。
- 命令 manifest 确实列出 `uploadAttachment`。
- 本次 checkout 没有找到独立 typed `uploadAttachment()` wrapper、其完整 body/result schema 或明确的跨机器上传闭环。

需要补齐：Mac/Watch 文件字节 → 上传到 host → 获得 host 可读路径/引用 → sendPrompt 附上 → 目标 Bot 能读内容。Mac 的 `/Users/...` 不能直接作为云 host 的路径；Watch 的录音路径也一样。typed字段是入口线索，不是成功证明。

## 4. 手表接入的三条路径

### A. Apple Watch 直接 HTTPS 调用应用后端（长期推荐）

后端运行 Node adapters，watchOS 用 Swift URLSession 调自己的 API。上游轮询/SSE由后端负责，任务完成后通知手表，手表激活时读取状态/结果。独立联网的 Watch 可不依赖 Mac/iPhone 实时运行，但仍需要网络、可用后端和可达的 Bot host。

官方 provider 直接访问 Cursor API；社区 provider 由后端通过私有链路访问 gateway。后端不要暴露原始 `/api/<任意命令>`，只提供本应用实际需要的 Bot 列表、任务提交、状态、取消、头像和附件接口。

这是推荐架构，不是两个 SDK 自带的 Watch 支持。部署、登录、push、后台结果持久化需要我们实现。

### B. Apple Watch → iPhone companion → 后端（适合第一版）

iPhone 做配对登录、名单缓存、附件转交；WatchConnectivity 同步小数据。即时 sendMessage 需要 counterpart reachable；不可达时保留 requestID 并使用排队/后台传输策略。iPhone也不是无限运行的 Node host，不应把持续 SSE 和后台轮询职责转移给它。

可用于语音指令、Bot 选择、结果通知；不能保证手机断开时所有即时交互继续正常。

### C. Apple Watch → Mac bridge（仅开发验证）

可以复用当前 Mac Node 环境，但手表需能访问 Mac 的受控网络服务，不能直接连当前 stdio pipes，也不能把 localhost 当 Mac 地址。Mac 睡眠、关机或外网不可达时入口不可用。WatchConnectivity 不是 Watch↔Mac 通道，它用于配对 iPhone 与 Watch。

## 5. watchOS 本身的约束

1. 原生 SwiftUI + URLSession可以做选择、文字输入、状态和结果显示。两个 Node-first包本身无官方 watchOS运行支持；底层HTTP可用Swift重写窄客户端，但需承担上游协议兼容与认证管理。
2. 不在后台长时间轮询/SSE。watchOS后台会调度/暂停工作，推荐后台URLSession传输 + 通知，不能保证每750ms更新一次或后台保持连接。
3. Digital Crown适合Bot轮盘：旋转更新候选，onIdle提交选择，点击打开输入；与Touch Bar共用选择状态模型，UI分别实现。
4. 文字/语音优先用系统听写。录音能在手表端采集，但音频上传/转写是否可用由后端provider与语言/设备能力决定。
5. WKWebView 不支持watchOS，Mac的bloub HTML/SVG运行方案不能原样移植。Watch用SwiftUI Path/Canvas实现轮廓、眼睛、mask与状态形变，或先用导出的逐帧资源；后者只适合基础状态动画，完整gaze/音量驱动需要原生参数化renderer。
6. Finder是Mac侧来源。Watch只能使用已经同步到后端的附件草稿，或自己录音/从iPhone转交的文件；不能直接读取Mac当前Finder选择。
7. 正式Watch开发需要完整Xcode与watchOS SDK/模拟器；当前Mac仅CLT环境，没有做手表编译验收。

## 6. 对现有方案的建议

优先做社区 gateway **只读 spike**：确认 host连接授权、网络路径、compat版本、listAgents与头像、隐藏/群组与官方名单对照。成功后它是Mac/Watch主要的完整管理provider候选。失败时保留官方BDK作为已知Bot文本入口，但不要降低“所有Bot”验收要求。

统一应用层的provider接口，独立处理认证/ID映射。官方 sessionID 与 gateway AgentID在未验证之前不能假设完全一致；同名也不意味着相同对象。两个provider切换时不能按名称静默发送。

共享Bot模型、requestID、草稿、附件元数据和任务事件；AppKit Touch Bar、watchOS SwiftUI和头像renderer各自适配。短期Mac保留WKWebView；长期可将bloub数学/形变移植为Swift模块，让Mac与Watch共用完整renderer。

当明确要离开Mac/iPhone也可用时，将当前stdio bridge扩展为服务器adapter，保留本地mock；不用为了手表把Bot业务放进Watch进程。

## 来源

- [官方 BDK npm](https://www.npmjs.com/package/@cursor/bdk)；精确Grok Bot细节来自已安装0.2.24指南/backend源码。
- [社区 SDK](https://github.com/adam91holt/grokbot-sdk)
- [社区 client.ts](https://github.com/adam91holt/grokbot-sdk/blob/c14347fa82d167b9a5984ec1baff56b2f074485a/sdk/src/gateway/client.ts)
- [社区 types.ts](https://github.com/adam91holt/grokbot-sdk/blob/c14347fa82d167b9a5984ec1baff56b2f074485a/sdk/src/types.ts)
- [命令表](https://github.com/adam91holt/grokbot-sdk/blob/c14347fa82d167b9a5984ec1baff56b2f074485a/sdk/src/gateway/commands.ts)
- [远程接入](https://github.com/adam91holt/grokbot-sdk/blob/c14347fa82d167b9a5984ec1baff56b2f074485a/docs/remote.md)
- [Apple：独立 Watch app](https://developer.apple.com/videos/play/wwdc2019/208/)
- [Apple：后台网络](https://developer.apple.com/documentation/watchos-apps/making-background-requests)
- [Apple：后台执行](https://developer.apple.com/documentation/watchkit/background-execution)
- [Apple：Watch 通知](https://developer.apple.com/documentation/watchos-apps/notifications)
- [Apple：WCSession](https://developer.apple.com/documentation/watchconnectivity/wcsession)
- [Apple：Digital Crown](https://developer.apple.com/documentation/swiftui/digitalcrownevent)
- [Apple：Web views 不支持 watchOS](https://developer.apple.com/design/human-interface-guidelines/web-views)
