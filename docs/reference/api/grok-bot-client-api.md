# Grok Bot 客户端接口与登录 MVP

调研日期：2026-10-14。客户端：本机 `/Applications/Grok Bot.app`，版本 **0.70.2**。本次直接分析客户端发布包并用 Node 原生 HTTP 验证，不依赖之前调研的两个 SDK。

## 结论与验收证据

可行：通过客户端使用的浏览器登录流程取得账号凭据，再调用 Cursor 云端接口读取账号和 Bot 名单。读取名单已有直接云端路径，不需要先拿云电脑 IP、导入 gateway.json 或通过本机转发。

| 验证项 | 结果 | 脱敏证据 |
| --- | --- | --- |
| 新浏览器登录 → `/auth/poll` → `GetMe` → `ListGrokBotAgents` | **同一次端到端成功**；账号/名单均 200；37 条，truncated=false | [完整新登录报告](client-mvp-browser-cloud-report.json)；凭据本身未保存 |
| 本机已有会话 → `GetMe` → `ListGrokBotAgents` | 都为 200，37 条，truncated=false | [云端名单报告](client-mvp-cloud-report.json) |
| 本机已有会话 → `EnsureSandBox` → `/health` → `listAgents` | 都为 200；37 条，包括 2 个 group；20 条有头像相关字段 | [gateway 报告](client-mvp-live-report.json) |
| 云电脑休眠 | 新浏览器登录时 Broker 返回 HIBERNATED，无 gateway 连接信息；MVP 没有唤醒它 | [浏览器登录报告](client-mvp-browser-report.json) |

最新的完整新登录报告来自单次运行：浏览器页面显示 All set，MVP 取得独立 access/refresh token 后，连续验证 GetMe 和云端名单，未读取本机已有账号凭据。另三份报告保留为辅助验证，分别覆盖旧会话名单、运行中 gateway，以及首次浏览器登录时休眠的 Broker。读取云端名单没有访问 Broker/gateway；没有单独验证当时云电脑是否休眠。

37 是返回记录数，不是“37 个个人独有且都可见的 Bot”的断言。请求设置 `includeTeamAgents:true`，可能包含团队 Bot 和 group。产品层需要结合 kind、role、viewerIsOwner、teamId、visibility 做过滤；两条路径的数量相同，也不能仅据数量断言 ID 集合完全一致。初次名单/授权验收没有读取聊天或发送消息；后续用户授权的附件消息测试见第七节。

## 本次分析范围与可信度

- `dist/electron-main/main-app.cjs`：登录、headers、HTTP/gateway 传输、服务调用引用与 gateway 方法声明。
- `dist/electron-main/main-core.cjs`：客户端认证配置等辅助信息。
- `dist/electron-main/proto.cjs`：Connect 服务描述符与请求/响应 schema。
- 发布包 SHA256、schema 字段和源文件版本记录在 [机器可读目录](client-api-inventory.json)。提取过程只读 ASAR，**不执行其中的 JavaScript**，不将完整客户端源码复制进项目。

[完整接口目录](client-api-catalog.md) 有 **7 个服务、484 个 RPC 方法声明、167 个 gateway 方法声明**。这包含管理、账单、后台任务等服务，不是 651 个“已验证可用”的接口。目录的静态引用数匹配 `.clientMethod(` 文本，同名方法可能跨服务重复计数；不能当作请求次数或服务归属的最终证明。以下明确标出“实测”与“静态发现”。

## 一、登录授权

### 1. 创建客户端登录请求（实测）

生成随机 `uuid` 和随机 32 字节的 `verifier`；verifier 使用无 padding 的 Base64URL。`challenge = Base64URL(SHA256(verifier))`。

浏览器打开：

```text
GET https://cursor.com/loginDeepControl
  ?challenge=<challenge>
  &uuid=<uuid>
  &mode=login
  &redirectTarget=sand
  &supportsSelectedTeamLogin=true
```

用户在 Cursor 网页完成登录及授权。授权后可能弹出“打开 Grok Bot”提示；MVP 通过 poll 接收结果，不需要官方 App 回跳，实测取消回跳后网页仍显示 All set。MVP 使用系统默认浏览器；不自动填写密码。登录 URL 仅含 challenge，不含 verifier/access token。MVP 使用随机的独立登录事务，不接管正在运行的客户端事务。

### 2. 轮询取回登录结果（实测）

```text
GET https://api2.cursor.sh/auth/poll?uuid=<uuid>&verifier=<verifier>
```

| 响应 | 含义 |
| --- | --- |
| 404 | 授权未完成，继续等待 |
| 200 JSON | `accessToken`、`refreshToken`；可能还有 `selectedTeamId` |
| 403 | 客户端代码包含 sign-in policy violation 分支，不能按授权成功处理 |
| 连续其他错误 | MVP 连续 3 次停止，输出固定错误码 |

MVP 使用 1 秒起始、1.2 倍退避、上限 10 秒，最多 150 次轮询；每个 HTTP 请求超时 20 秒。`verifier` 在查询串里，应避免代理/服务端记录完整轮询 URL。MVP 不打印这个 URL，也不打印凭据。

### 3. 刷新、API key 交换与退出（静态发现，未执行）

| 方法/路径 | 鉴权/请求 | 主要响应 |
| --- | --- | --- |
| POST `/oauth/token` | JSON `{client_id, grant_type:"refresh_token", refresh_token}`；client_id 来自该环境的客户端配置 | `access_token`、可能轮换的 `refresh_token`、`shouldLogout`、`error` |
| POST `/auth/exchange_user_api_key` | `Authorization: Bearer <user-api-key>`；JSON `{}` | `accessToken`、`refreshToken` |
| POST `/auth/logout` | 当前会话的 Bearer 凭据；请求细节需在实现退出时继续核实 | 退出相关响应未实测 |

MVP 不刷新本机官方客户端共用的 refresh token，避免与客户端的轮换发生竞争。新登录的 refresh token 也只存在进程内存；当前 MVP 没有持久登录、后台刷新或撤销独立会话的实现，退出进程只丢弃本地内存，不等于服务端 logout。

### 4. 复用本机已登录会话（实测的辅助入口）

本机 `~/Library/Application Support/Grok Bot/sand-secrets.json` 保存 stringified JSON 的 `cursor-accounts`。通过其 `active` 选择当前账号，账号记录的 `cursor-access-token` 为 Electron safeStorage 加密值。本机 Keychain 的服务名是 `Grok Bot Safe Storage`。

这台 Mac 的 v10 格式对应 PBKDF2-SHA1（salt `saltysalt`，1003 次，16 字节 key），AES-128-CBC（IV 为 16 个空格）。这些参数仅用于当前本机格式；其他平台或未来版本不能直接照用。MVP 捕获 Keychain 命令输出后在内存解密，不修改客户端存储，不输出 keychain password、token、machine ID 或账号邮箱。

这个入口用于开发验收；未来 Watch 登录应使用独立浏览器授权/设备配对，不应依赖读取 Mac 客户端文件。

## 二、Cursor 云端 RPC

### 通用传输（Unary JSON 实测）

Base URL：`https://api2.cursor.sh`。

```text
POST /aiserver.v1.<Service>/<Method>
Content-Type: application/json
Connect-Protocol-Version: 1
Authorization: Bearer <account-access-token>
```

MVP 根据客户端代码发送以下身份/context headers。它们在本次实测中可用，未逐项测试哪一个可以省略。

| Header | 值/来源 |
| --- | --- |
| `x-cursor-client-type` | `sand` |
| `x-cursor-client-source` | `sand-desktop` |
| `x-cursor-client-version` | 安装客户端版本，本次 `0.70.2` |
| `x-cursor-client-os` | `darwin` |
| `x-sand-box-namespace` | `prod` |
| `x-ghost-mode` | `true` |
| `x-request-id` | 每组验证生成 UUID |
| `x-cursor-team-id` | 选择团队时传入 |
| `x-cursor-checksum` | 本机路径根据客户端时间混合算法与 machine ID 构建；新浏览器登录未传，也成功读取 GetMe |
| `User-Agent` | 客户端 Sand/version UA |

这里复现的是桌面客户端已有协议，尚未证明 Watch 原生身份的 headers 会被接受。MVP 禁止 HTTP 重定向；账号 token 仅发送到固定官方 API 域名。

JSON 使用 camelCase 字段名。机器目录保留 protobuf schema 原始 snake_case。64 位整数 JSON 通常用十进制字符串；enum 通常用枚举名。请求中“非 optional”代表 schema 声明，不能简单推断为后端业务必填。当前 MVP 只实现 Unary JSON，目录里 ServerStreaming 不能直接套用普通 JSON fetch。

### GetMe（实测）

```text
POST /aiserver.v1.DashboardService/GetMe
```

最小请求 `{}`。可选 `teamId`（int32）、`sourceSiteHostname`（string）、`includeMobileAppStatus`（bool）。

主要响应：`authId`、`userId`、`email`、`firstName`、`lastName`、`teamId`、`teamName`、`profilePictureUrl`、`isTeamAdmin`、`hasActiveMobileSession` 等。MVP 验证 identity 字段存在，只保存身份/邮箱字段是否存在，不保存值。HTTP 200 但缺少身份字段会标为 `INVALID_RESPONSE`。

### ListGrokBotAgents（实测，名单首选）

```text
POST /aiserver.v1.GrokBotService/ListGrokBotAgents
```

```json
{"includeTeamAgents":true}
```

| 请求字段 | 类型 | 说明 |
| --- | --- | --- |
| `role` | string，可选 | 服务端角色过滤，具体支持值未验证 |
| `includeTeamAgents` | bool，可选 | 本次传 true；客户端也有 `{}` 调用 |
| `addedTeamAgentsOnly` | bool，可选 | 团队筛选条件未单独验证 |

响应：`agents` 数组、`truncated`、`slackConnections`、`teamsConnections`。

`agents[]` 的主要 schema：

| 字段 | 类型 | 用途 |
| --- | --- | --- |
| `id`, `agentId`, `legacyAgentId` | string | 标识有多个字段；后续请求要按对应接口选择，不要假设始终相同 |
| `name`, `description`, `title` | string | 名称与说明 |
| `avatarShape`, `avatarColor` | string | 客户端头像渲染参数 |
| `avatarVersion`, `avatarUrl` | string，可选 | 头像版本/地址，不表示包含完整交互动画 |
| `harness`, `role` | string | 执行形态、角色；本次所有记录的 harness 为 temporal |
| `kind`, `visibility` | enum | 记录类型/可见性，完整值映射需结合该版本 enum 定义 |
| `teamId`, `viewerIsOwner`, `viewerCanManage` | 可选 int32/bool/bool | 所属团队与当前查看者权限 |
| `viewerSessionId` | string | 当前查看者会话标识 |
| `memberAgentIds`, `people` | string[] / message[] | group/参与者信息 |
| `createdAtMs`, `updatedAtMs` | int64 | 毫秒时间，JSON 按字符串处理 |
| `voiceId`, `voiceSpeed`, `voiceLanguage` | 可选 string/float/string | 语音相关元数据 |

本次返回 37 条、`truncated=false`，20 条有头像参数。若将来返回 `truncated=true`，不能宣称已拿到全部名单；这个请求 schema 中未发现分页 cursor，完整性需要另行验证。Touch Bar 第一版可读取此接口做 UI 列表，再按产品需要过滤团队/group。

### EnsureSandBox（实测，获取 gateway 连接）

```text
POST /aiserver.v1.GrokBotService/EnsureSandBox
```

```json
{"wake":false,"supportsAsleepBox":true}
```

响应主要字段：`gatewayUrl`、`gatewayToken`、`networkToken`、`runState`；另外声明了 cluster、tenantId、podId、execDaemonUrl/authToken、vncUrl、image 等。本 MVP 不使用远程执行/VNC 字段。

`gatewayUrl` 是 Broker 分配的可达地址；`gatewayToken` 是 gateway 层鉴权；`networkToken` 是网络入口鉴权。它们与账号 access token 不可互换。运行时返回的连接凭据只在内存中使用，报告仅保存字段存在性。休眠时可能没有连接地址/凭据；HTTP 200 仍应检查 runState。MVP 永远传 `wake:false`。

描述符也存在 `/aiserver.v1.SandBoxService/EnsureSandBox`，本次只验证 **GrokBotService** 路径，不能把两个服务混用。

### 后续聊天相关接口（静态发现，未实测）

| 路径，均为 `/aiserver.v1.GrokBotService/` 前缀 | 主要请求 | 主要响应 |
| --- | --- | --- |
| `ListGrokBotAgentStatuses` | `agentIds:string[]` | `statuses[]` |
| `ListGrokBotTranscriptEntries` | `agentId:string`、`limit:uint32`、`sessionId:string`；可选 generation:uint32、beforeSeq:uint64、unreadBoundaryMs:int64 | entries[]、generation、cloudAgentPeerIds[]、cloudAgentPeerIdsKnown、unreadAnchor |
| `SendGrokBotUserMessage` | `agentId`、`messageId`、`text`、`sentAtMs:int64`、`sessionId`；附件路径/名称数组、richText、replyToId、isFork、traceparent、source/initiator/sendSource enum 等 | dispatched、mode、workflowId、delivery、refusal |

发送接口不是把本地文件路径放进去就能上传文件；需先上传，并使用服务端可识别的 attachment path。上表仅帮助下一阶段选型，没有发送测试、枚举值兼容或投递语义保证。全部字段和引用在 JSON 目录中，枚举取值/嵌套对象的完整协议需继续解析，不能凭空填写。

## 三、云电脑 gateway

Base URL 来自 `EnsureSandBox.gatewayUrl`，不能把 gateway.json 的 `0.0.0.0` 当作远程地址。

```text
Authorization: Bearer <gatewayToken>
x-anyrun-network-token: <networkToken>
Content-Type: application/json
```

MVP 仅接受 HTTPS、无 URL 用户信息、无 query/hash、443 端口的 `*.cursorvm.com` 返回地址；其他部署形式需显式设计新的可信域名规则。所有请求拒绝重定向。

| HTTP/路径 | 请求 | 状态与用途 |
| --- | --- | --- |
| GET `/health` | 无 body | **实测 200**，JSON `ok:true`；false 不继续获取名单 |
| POST `/api/listAgents` | `{}` | **实测 200**，顶层数组；包括 Bot/group/sidebar/头像元数据 |
| POST `/api/getAgentAvatar` | `{id:string}` | 静态发现；头像数据响应具体结构未实测 |
| POST `/api/getHostStatus` | `{includeManagedCapabilities?:bool}` | 静态发现；host 状态 |
| POST `/api/getAgentTranscriptPage` | `{id:string,limit:number,untilMs:number,beforeSeq?:number,sinceMs?:number}` | 静态 schema；聊天分页，注意该版本 untilMs 非 optional |
| POST `/api/uploadAttachment` | `{filename:string,bytesBase64:string,agentId?:string}` | 静态发现；附件上传 |
| POST `/api/uploadAttachmentChunk` | `{uploadId:string,filename:string,offset:number,totalSize:number,bytesBase64:string,agentId?:string}` | 静态发现；分块上传，大小/完成语义未测 |
| POST `/api/readAttachmentText` | `{path:string,agentId?:string}` | 静态发现；读取文本附件 |
| POST `/api/readAttachmentChunk` | `{path:string,offset:number,length:number,agentId?:string,videoPlayback?:bool}` | 静态发现；读取附件分块 |
| POST `/api/transcribeAudio` | `{audioBase64:base64,mimeType:string,language?:string}` | 静态发现；录音转写，音频格式/时长限制未测 |
| POST `/api/sendPrompt` | 下文 | 静态发现；发送提示词 |
| POST `/api/interruptAgentRun` | `{id:string,sessionId?:string}` | 静态发现；中断执行 |
| GET `/events` | 流式连接 | 客户端发现事件通道/SSE，未建立订阅；事件结构、恢复与重连待验证 |

`sendPrompt` 的最小 schema 字段是 `prompt:string`、`agentId:string`。其他可选字段：directAddressedAcceptance（仅 true）、clientNonce、attachmentPaths:string[]、attachmentNames:string[]、richText、replyToId、automationWriteProvenance、isFork、traceparent、enterEpochMs、composedAtMs、source、sendSource、mcpConfigJson、sessionId、machineId、onePasswordAppInstalled、taskId、initiator。enum/custom 约束不能按任意字符串处理。该版本还有转换逻辑删除空白的 mcpConfigJson；自动提取器只解析字段，不执行转换。

这些路径按客户端声明及已验证的 `/api/<method>` 规则整理。未经执行的 gateway 方法，响应结构、权限、是否支持当前 host 版本仍待单独验证。目录同时包含审批/机密/host 管理操作，本次没有调用。

## 四、完整目录的读取方法

[Markdown 目录](client-api-catalog.md) 用于搜索方法名；[JSON 目录](client-api-inventory.json) 用于查看 request/response 字段、tag、optional、repeated 以及类型引用。

Proto 类型编码：`9=string`、`8=bool`、`5=int32`、`13=uint32`、`3=int64`、`4=uint64`、`2=float`、`1=double`、`12=bytes`；`#0/#1/...` 指该消息 `references` 对应索引。reference 若是 message alias，可在顶层 `messages` 找到；若是 enum alias，当前自动目录未导出 enum 取值表。gateway 的 custom 类型以及部分引用也未完全解析。这是一份可追溯的接口清单和重点接口说明，不是完整 OpenAPI 或正式类型 SDK。

目录中 7 个服务的方法数量：AgentStoreService 24、AiService 8、BackgroundComposerService 7、DashboardService 73、AnalyticsService 8、GrokBotService 309、SandBoxService 55。后续版本变化可重新运行 inventory 比较；静态引用为 0 不等于运行时永远不使用（可能有 renderer/动态调用）。

## 五、MVP 使用与边界

环境：macOS，本机安装 Grok Bot，Node >=22.13；零 npm 依赖。

在仓库根目录：

```sh
# 新浏览器授权，然后直接获取账号和云端名单
node packages/client-protocol/cli.mjs login --cloud-only

# 复用本机当前客户端账号，直接读取云端名单
node packages/client-protocol/cli.mjs verify --desktop --cloud-only

# 额外验证 Broker 和 gateway，保持不唤醒云电脑
node packages/client-protocol/cli.mjs verify --desktop

# 只输出脱敏报告到指定文件
node packages/client-protocol/cli.mjs verify --desktop --cloud-only --report docs/reference/api/local-verification.json

# 离线测试与静态清单重建
node --test packages/client-protocol/test/*.test.mjs
node packages/client-protocol/cli.mjs inventory
```

CLI 输出 HTTP 状态、数量、字段存在性，不展示 Bot 名称/ID/聊天/头像 URL 或 token。程序内部确实取得真实名单；本次交付是协议验证 CLI，尚未接入 Touch Bar UI。无论新登录还是已有会话，凭据只留内存，不写入官方存储；`--report` 保存的是脱敏摘要。失败输出固定 code，失败验证 exit 1；休眠单独标为 host_not_running，不伪装成 gateway 成功。云端 roster 已成功但 gateway 未运行时仍可使用 roster。

Watch 后续可以经自有后端提供设备配对和安全凭据存储，再请求云端名单；上述实验已经消除了“必须访问本机 gateway.json 才能拿名单”的前置条件。WatchOS 原生实现、长期 refresh、团队切换、网络入口过期及音频尚未验收；用户后续授权的消息/附件测试见第七节。这是客户端内部协议分析，版本和授权政策变化会影响可用性，不能当作官方公开稳定 API 合约。

参考解释材料：[Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)、[Chromium macOS OSCrypt 实现](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/os_crypt/sync/os_crypt_mac.mm)、[Connect 协议](https://connectrpc.com/docs/protocol/)、[ProtoJSON](https://protobuf.dev/programming-guides/json/)。接口发现与成功证据主要来自上述本机发布包和脱敏实测，不是从这些通用参考材料推断出来。

## 六、SDK 封装与授权回跳核实（2026-10-14 补充）

此阶段确认 MVP 可以封装为独立的非官方 SDK，并建议将纯协议层与 Mac Keychain/浏览器等运行环境适配分开。现已按此边界新增 SDK：客户端版本可配置，名单返回类型化数据，支持取消与消息流转发，见第九节。持久存储与独立会话 refresh 仍未实现；验证 CLI 继续只输出脱敏摘要。

官网当前公开 JavaScript 的 getLoginDeepRedirectPage 使用固定映射：

| redirectTarget | 完成页 |
| --- | --- |
| cursor | /loginDeepPage |
| cli | /loginDeepCli |
| origin | /loginDeepOrigin |
| sand | /loginDeepGrokBot |
| sdk | /loginDeepSdk |

未知 target 在该前端逻辑中 fallback 到 /loginDeepPage，因此不能把 target 直接换成自定义 scheme 或 HTTPS 地址，就认为服务端会回跳。当前未发现这条 PKCE/poll 流程接受任意第三方 redirect_uri 的入口。网页的 buildLoginDeepAuthUrl 中虽然有 redirect_uri，但其调用者构建的是返回 Cursor 自己的登录中间页地址，不能据此推断支持第三方 App 回调。

完成页的静态逻辑：sand 桌面回跳固定为 sand://app/v1/open，mobile 标记对应 grokbot://app/v1/open；/loginDeepSdk 页面仅显示完成信息，在检查到的页面逻辑中没有自动打开第三方 App。redirectTarget 也会影响中间登录路径：sand 走 /api/auth/bot/login，其他 target 走 /api/auth/login。cli/sdk 在官网映射中存在，但本项目尚未用它们完成 Grok Bot 账号的授权/名单端到端验证，团队选择/账号来源可能受影响。当前已验证的 sand 流程保持不变。

自有 App 可以在 SDK 的 waitForLogin/poll 成功后执行自己的 onAuthenticated/onSuccess：更新本地登录 UI、聚焦 Mac 窗口，或由自有后端通知设备。这个回调属于自有应用，可任意定义；它不会改写 Cursor 官方网页的最终跳转。授权凭据仍通过 poll 取得，回跳仅用于体验，既不作为成功依据，也不携带 token。此前实测已确认取消“打开 Grok Bot”不影响取得凭据和读取名单。若需要官方页面直接回跳自定义 scheme/域名，则需要找到并验证官方允许的第三方注册/回调机制，目前没有此证据。

Node/TypeScript SDK 可部署在自有后端，账号与名单的 HTTP 协议本身不依赖 Mac。watchOS 不能直接运行此 Node 实现；应调用自有后端，或另外实现 Swift 协议客户端。浏览器端直接访问是否满足 CORS、Watch 原生授权及长期 refresh 均未验证。

本补充依据公开网页静态文本的读取，未创建新授权或修改账号配置。来源：[登录页面脚本（映射、登录路径、scheme 常量）](https://cursor.com/_next/static/immutable/chunks/353sa-klxbh8r.js)、[SDK 完成页脚本](https://cursor.com/_next/static/immutable/chunks/2bnrk9_q8jb3_.js)、[Grok Bot 完成页脚本](https://cursor.com/_next/static/immutable/chunks/08c1t5h1gqkns.js)。这些带版本 hash 的资源可能随网站更新变更；这里只摘录协议结论，没有复制整个网页源码到项目。

## 七、真实附件消息测试（2026-10-14 补充）

用户明确授权向 **Webhook 测试员** 发送 ESP32_调研与文章资料.md，并让它读取。使用 MVP 本机当前账号会话，名称唯一匹配 temporal Bot；保持共享 refresh token 不变。

- BeginGrokBotAttachmentUpload 返回 HTTP 200，mode=GROK_BOT_ATTACHMENT_UPLOAD_MODE_USE_BOX；因此此账号这次上传未使用 SINGLE_PUT。
- 通过 EnsureSandBox 取得 gateway 连接，在 /api/uploadAttachment 上传原始文件（30782 bytes），HTTP 200，响应 path 字段作为消息附件引用。
- SendGrokBotUserMessage 返回 HTTP 200，delivery=GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_TEMPORAL；使用 agentId UUID，messageId 固定 UUID，source=1(DESKTOP)、initiator=1(USER)、sendSource=1(CHAT)、sentAtMs 十进制字符串、attachmentPaths/attachmentNames 配对。
- ListGrokBotTranscriptEntries 以发送前 seq 为基准读取后续回复。body 为 Base64 编码的 JSON bytes；kind=send-message、message.type=text、message.content 为 Bot 文本回复。只有返回本次 messageId 并匹配原始字节数/标题/SHA-256，才将 status 标为 attachment-read-verified。
- 上传单 PUT 与 Complete 的实现有离线测试，仍不能标为这次真人账号实测通过。gateway 上传、云端发送和读取回复已从“静态发现”升级为上述实际验证；读取内容的最终证据见报告 status=attachment-read-verified、validation 四项匹配。

[本次发送与读取报告](webhook-attachment-live-report.json) 会记录投递与后续结果，不包含凭据。程序入口与安全重试边界见 [MVP README](../../../packages/client-protocol/README.md)。完整目录的 gateway tested=false 为自动提取时的默认标记，具体验收以本补充和实测报告为准。

本次 Bot 回复确认：第一行标题为 `# ESP32：起源、发展、生态与真实案例`，原始字节数 30782，SHA-256 `8c9eca9669ed1c88f8c01ce4b2d23bcacaa334af0f936e1bdee466f782f76b1c`，最后来源 `[S51]`（FluidNC）；并返回章节列表与内容概要。哈希和文件大小由本机独立核对一致，消息中没有预先提供预期哈希。

## 八、头像字段缺失与默认头像（2026-10-14 补充）

ListGrokBotAgents 的 schema 有 avatarShape/avatarColor，不等于每条 JSON 记录都有非空值。最新只读复查中，返回 35 条记录，20 条同时有形状和颜色，avatarUrl 非空记录为 0；Webhook 测试员的 avatarShape、avatarColor、avatarVersion、avatarUrl 均未返回，不是 snake_case/camelCase 读取位置错误。

客户端 renderer 的形状选择逻辑为：显式 avatarShape 是有效形状则使用，否则用 ID 默认函数；颜色同理。默认函数是确定性的 ID hash/混合和色板选取，不需要 gateway 图片。index-CjjO5fU0.js 引用 index.eager-platform-DUN5VkaE.js 的默认形状/颜色函数。对 Webhook 测试员的 agentId UUID 独立复算，得到 **shape=cloud、color=brown**，色板基础色 #936439，与此前客户端截图相符。没有执行官方 renderer bundle。

这里需要使用客户端采用的 UUID 头像 key，不能把云端记录的数值型 id 直接替代 agentId；否则派生结果可能不同。默认头像参数不包含完整渲染/动画实现。

当前 SDK 的 listBots() 已统一返回解析后的 avatarShape/avatarColor 与 avatar（character、picture、sources）。形状/颜色分别优先采用有效接口字段，否则按 agentId 派生；自定义图片优先显示，只有 avatarVersion 而无 URL 时仍需另行解析。verify CLI 继续只输出数量摘要。不能把缺少显式 avatar 字段描述成“没有头像”或“接口不支持头像”。

[本次复查与默认参数报告](webhook-avatar-inspection.json)。名单数量来自新的只读快照，不能与此前 37 条快照混为同一时点的结果。

头像字段有无返回的进一步证据：CreateGrokBotTemporalAgent 的客户端请求在未指定头像时发送 avatarShape=""、avatarColor=""；头像编辑器恢复默认的提交同样把这两个字段设为 ""。GrokBotAgent protobuf 字段属于非 optional string，生成类默认值为 ""。根据 [ProtoJSON 默认值规则](https://protobuf.dev/programming-guides/json/#presence-and-default-values)，隐式存在字段的默认值通常不输出为 JSON key。因此“没有字段”符合“空显式配置 + ID 默认头像”的机制；不表示缺少头像或接口读取失败。有非空配置可能来自创建时选择、模板导入、编辑或迁移，未访问服务端数据库和历史记录，不能断言有字段的 Bot 全部由用户手动修改过。

完整 ID 哈希、形状/色板索引、颜色 PRNG、字段覆盖与跨语言验收结果见 [Bot ID 头像算法说明](bot-id-avatar-algorithm.md)。

## 九、SDK 与回复流实现

`packages/client-protocol/sdk.mjs` 已提供 getMe、listBots、sendMessage、watchBot 与 botEventsSSE，并附 TypeScript 声明。上游 WatchGrokBotTranscripts 使用 Connect JSON 帧，下游可返回标准 SSE Response。已实测订阅 HTTP 200，并回放此前授权的 Webhook 测试员附件回复，验证 SDK 转发的消息保留验收标记与 SHA-256；此次未新增发送。[实测记录](sdk-live-report.json)

消息输出为完整文本 upsert，尚未验证逐 token 增量。默认游标取最新返回记录的 updatedSeq，并非全局高水位；恢复游标、reset、resync-required 和正文省略需按应用逻辑处理。此 SDK 核心不依赖本机 App，但没有自动 refresh、正文 blob 补取、独占单次提问回复或 watchOS 原生实现。[完整 SDK 接入与边界](sdk-usage.md)
