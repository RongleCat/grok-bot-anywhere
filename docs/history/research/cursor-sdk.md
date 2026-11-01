# Cursor SDK、Grok Bot 与 BDK 调研

核验日期：2026-10-14（Asia/Singapore）。本报告区分公开文档、实际发布包中观察到的实现，以及尚未完成的账号联调。未读取登录令牌，未登录，未发送真实任务。

## 结论

用户描述的 Grok Bot 是真实的 Cursor 产品，不是模型名拼错。它是账号下有姓名、头像、独立对话与记忆的长期 Bot；同账号 Bot 共用一台持久云电脑。普通 Cursor Agent SDK 的 Agent.list 不能据此承诺枚举这些 Bot。

可公开核实的 Grok Bot 入口之一是 @cursor/bdk 的 cursor-grokbot-agents 扩展。它可以按名称咨询账号的 Bot、轮询回复、打断；但是它的 list 只返回配置的名单和调用者联系过的 Bot，官方随包指南明确不是全账号枚举。名称解析使用 get-or-create，拼写错误可能创建新 Bot。因此本项目 bridge 不实现名称解析，只允许明确确认的 sessionId。

截至本次可访问的官方文档与已安装公开包，尚未核实全账号 Bot 名单、真实头像 URL、实时状态订阅与任意附件上传的公开稳定 API。用户补充官方有专门管理 Grok Bot 的 SDK，该线索仍需进一步确认，不能把当前检索未命中写成接口不存在。这四项需要单独验证；MVP 保留手工配置 roster、官方界面导入以及本地 mock，不能用普通 coding Agent 或 BDK 项目列表替代真实 Grok Bot 名单。

## 实际安装版本与运行条件

| 组件 | 2026-10-14 registry 实际版本 | 条件 / 意义 |
| --- | --- | --- |
| @cursor/sdk | 1.0.37，latest；next 为 1.0.27-beta.0 | Node >=22.13；官方 TypeScript coding agent SDK |
| @cursor/bdk | 0.2.24 | Node >=22.13；Bot Development Kit，含公开 Grok Bot 扩展 |
| cursor-sdk (PyPI) | 1.0.37 | Python >=3.10；内置 SDK Bridge，提供同步与异步客户端 |
| 本机 Node / npm | v22.22.0 / 10.9.4 | 满足所选包 engines |

@cursor/sdk 的公共发布版本号是 1.x，但产品发布公告仍称 SDK 为 public beta，不能仅凭 semver 声称稳定 GA。@cursor/bdk 为 0.x，需锁定版本与验证升级。legacy/bridge/package-lock.json 锁定依赖。安装使用 --ignore-scripts，避免 BDK postinstall 自动安装 Cursor skills 到宿主配置。

## 三类对象边界

| 对象 | 发现方式 | 状态与续接 | 是否用户说的 Bot |
| --- | --- | --- | --- |
| 本地 SDK coding Agent | Agent.list({runtime:"local",cwd,store})，读取同一 workspace/store | Agent.resume(agentId,{local:{cwd,store},apiKey}) | 通常不是；未有文档承诺覆盖 IDE 所有历史聊天 |
| 云 coding Agent | Agent.list({runtime:"cloud",apiKey,includeArchived})；分页 nextCursor | resume、getRun、stream、wait、cancel | 通常不是；Cloud Agents 有 coding workspace / repo 语义 |
| Grok Bot | BDK 扩展配置名单与 contacts；按名称 get-or-create | /v0/grokbot sessionId 与 entries cursor | 是；但未有公开全账号 roster API |

本地 SDK 持久层包含 agents、runs、run_events、checkpoints，可使用 SQLite 或指定 JsonlLocalAgentStore。它不是 Cursor IDE 状态数据库的通用读取器。本地枚举应要求用户显式给 workspace/store，不能擅自扫描账号或 IDE 的私有数据库。

## Grok Bot 已观察到的公开 session 协议

依据：@cursor/bdk@0.2.24 官方发布包中的 dist/extensions/cursor-grokbot-agents/lib/backend.js 与同目录 .d.ts，及 docs/guides/grokbot-agents.md。扩展被 exports 公开导出；底层 backend 未单独 exports，项目不深度 import 内部路径。以下是包实现观察，不代表完整独立 REST API 文档或版本稳定性保证。

Host：https://api.cursor.com；Bearer Cursor API key；x-cursor-client-type: agent-serve；x-request-id: UUID。默认请求超时 60 秒。该实现注明 api2 host 不适用。

| 操作 | 实际路由 / 请求 | 返回核心字段与约束 |
| --- | --- | --- |
| 按名称解析 / 创建 | POST /v0/grokbot/sessions，{name} | id,name,createdAtMs,latestUpdatedSeq；存在创建副作用，本 bridge 禁用 |
| 发送文本 | POST /v0/grokbot/sessions/{sessionId}/messages，{text,messageId} | messageId,delivery；accepted_temporal 或 duplicate 才算被接收 |
| 读取回复 | GET /v0/grokbot/sessions/{sessionId}/entries?afterUpdatedSeq=... | entries[{seq,updatedSeq,kind,role?,text?,createdAtMs}],latestUpdatedSeq,turn{idle,inFlight,queued} |
| 打断任务 | POST /v0/grokbot/sessions/{sessionId}/interrupt，{reason} | 带修改副作用；当前 bridge 未接线 |

扩展使用 pollIntervalMs，默认 750ms。官方建议需要结果时再 check，避免紧循环；回复游标按调用者保存。它没有公开 SSE/WebSocket roster/state stream。状态映射只能根据 turn 推导 working/idle/queued，不能虚构精确 thought/animation 状态。

认证来源包括 CURSOR_API_KEY、CURSOR_API_KEY_FILE、CURSOR_SERVICE_ACCOUNT_KEY 或 bdk login；本环境未读取任何一项。产品接入建议由原生 app 主动登录/Keychain 保存，在用户发送时将凭据经受控子进程或 IPC 提供。SDK 与 BDK 登录状态并非应默认互相读取。

## 附件与录音的真实边界

Grok Bot 官方客户端允许消息附带图片、音频、视频、PDF、Office、CSV、JSON、源码等；桌面一条消息最多 6 个附件，普通文档/图片/音频每个 25 MB，视频 200 MB。这是官方 UI 能力，不能推定同样字段可传给上面的文本 session API。

公开 Grok Bot 扩展的 send surface 只有 text 与 messageId，未发现 multipart、upload URL、附件 ID 或音频参数。Finder 附件可以先完整进入本地 composer 草稿，但在上传协议验证前需要显示等待接入或转交官方客户端；bridge 遇附件明确拒绝，不将本地路径冒充已上传文件。

普通 @cursor/sdk 的 SDKUserMessage 支持 text 与 images[{data:base64,mimeType}]；这适用于 coding Agent，不能当 Grok Bot 通用附件上传。普通文件可以通过本地 agent workspace 的文件工具访问，但 cloud agent 不能读取 Finder 的路径。语音可先通过 macOS Speech 转写成文字并发送；原始录音附件上传仍需要独立协议。

## Cursor Agent SDK 可用能力

TypeScript：Agent.create、Agent.resume、Agent.list/get/listRuns/getRun、agent.send、run.stream/wait/cancel、run.conversation、usage。SDKMessage 是判别联合，含 assistant、thinking、tool_call、status、usage、interaction_update 等；支持原始 deltas 与结果汇总，需以当前类型为准。

Python：Client / CursorClient 与 AsyncClient；agents.list/get/create；Agent.resume；agent.send；run 的流与 wait。AsyncClient 需要显式生命周期；Python wheel 自带 SDK Bridge。

认证支持 user API key 和 service account API key，未支持 Team Admin key。SDK runs 会计费并可能执行 shell/edit/write 工具，测试环境绝不创建或发送真实 Agent。Local 指 harness 与文件访问在本机，模型推理仍使用 Cursor hosted models。

## Swift 集成技术选择

1. 当前：Swift 原生 App + 本项目 Node TypeScript bridge。stdio NDJSON 边界简单，Swift 不需要复刻整个 SDK。bridge 默认纯 mock，无 TCP listener，无凭据读取，无账号流量。
2. 若只做普通 Cursor coding Agent：可直接下载官方 SDK Bridge，Swift 用 Connect/JSON RPC 对接 sdk.v1；需处理启动 ready-line、独立 bridge bearer、stream framing、进程退出和协议版本。它不解决 Grok Bot 全名单问题。
3. Python bridge：官方支持，但打包 Python + wheel 的体积与分发复杂度更高；对当前已有 Node 的开发机没有优势。

官方 sdk-bridge 接口是 loopback HTTP/1.1 Connect/gRPC-Web；传统 HTTP/2 gRPC 客户端不能直接连接。API key 与 bridge bearer 是两份独立凭据。代码生成与二进制应按相同 release v1.0.37 锁定。无需另造完整 Swift SDK，先实现项目需要的窄协议。

## 环境交付和未验收项

bridge 包含默认 mock NDJSON 协议、显式 capability reporting、确认 sessionId 的 Grok Bot HTTP adapter、官方 SDK 类型探针、无凭据测试，以及 lockfile。没有默认登录或真实网络调用。CLI 的发送目前只支持 mock；真实 GrokBotClient 必须由未来 app 显式 enabled、传入 API key 与 confirmedSessionIds 后调用，不暴露无门槛命令。

未验收：实际账号能否调用 /v0/grokbot、如何获取全 roster、头像下载协议、附件上传、与正在运行的官方 app 对话并发，以及是否有更正式的 Bot API 访问授权/发布文档。接真实账号前需要先拿到这些能力的可检验契约，尤其不能执行名称解析来探测 Bot 存不存在。

## 官方出处

- [Grok Bot 概述](https://cursor.com/docs/grok-bot)
- [Grok Bot 工作与消息附件](https://cursor.com/docs/grok-bot/work)
- [TypeScript SDK](https://cursor.com/docs/sdk/typescript)
- [Python SDK](https://cursor.com/docs/sdk/python)
- [SDK Bridge 文档](https://cursor.com/docs/sdk/bridge)
- [SDK Bridge 协议源码与 release](https://github.com/cursor/sdk-bridge)
- [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints)
- [官方 BDK npm 包](https://www.npmjs.com/package/@cursor/bdk)
- [官方 SDK npm 包](https://www.npmjs.com/package/@cursor/sdk)
- [官方 Python SDK](https://pypi.org/project/cursor-sdk/)

BDK 完整指南安装后保留在 bridge/node_modules/@cursor/bdk/docs/guides/grokbot-agents.md；对应 LICENSE.md 写明 Anysphere 保留权利并按 Cursor Terms of Service 使用。仓库保留索引与研究总结，不另行复制整篇受版权保护的指南。


## 追加：专门 Bot 管理 SDK 的检索

用户补充官方存在专门 Grok Bot 管理 SDK 后，继续查 Cursor 文档、npm scope 与实际包导出：

- @cursor/july@0.2.24 的包说明、README 与 exports 指向 BDK 同一套产品，含同样的 cursor-grokbot-agents 扩展。
- @cursor/february@1.0.7 是旧代号 private-alpha coding Agent SDK，README 核心仍是 Agent.create/resume/list，不是已经核实的 Grok Bot roster SDK。
- @cursor/bot-sdk、@cursor/grok-bot-sdk 的 npm registry 查询返回 404；只表示这两个具体包名不存在，不能推断官方没有其他名称的 SDK。
- @cursor/sdk@1.0.37 实际公共 exports 仅有主入口、agent、sqlite、bundled 及 bundled/sqlite；检查公开 TypeScript 类型没有独立 Grok Bot roster/头像/附件接口。
- 发现第三方 [adam91holt/grokbot-sdk](https://github.com/adam91holt/grokbot-sdk)，MIT，Node 22+；作者提供 Grok Bot host gateway 的 roster、头像、SSE 与 prompt 包装。它不是 Cursor 官方发布包。默认 sand-data 位于 /home/box，指 Bot computer host，不应误认为本地 macOS 官方客户端必然运行同一 gateway。跨机器需要可达 host URL 与明确授权的 gateway token；本项目未读取 token 或连接该服务。

该第三方 SDK 可作为研究入口及独立可选 provider，但在官网独立 Bot SDK 身份和账号权限核实前，不自动代替用户指定的官方 SDK。

## 本次验证记录

npm install --ignore-scripts --no-audit --no-fund 完成（307 packages）；npm run check 的严格 typecheck 与 8 项测试通过；npm run build 通过；编译后 stdio CLI 的 3 条请求与 malformed JSON 冒烟通过，stderr 为空且 mock send 明确 delivered:false。SDK 类型依赖 Connect 的 HeadersInit，tsconfig 包含 DOM 标准 web API 类型，skipLibCheck 保持 false。
