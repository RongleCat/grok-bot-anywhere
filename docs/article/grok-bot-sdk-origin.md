# grok-bot-sdk 怎么来的

调研和实现集中在 2026-10-14（Asia/Singapore）。开源仓库在 2026-10-15 推到 GitHub。

这份文档是写文章用的素材，按真实顺序整理。它还不是对外文案。文末有一节只给作者看，发布前删掉。

对外始终写清楚：这是对照 Grok Bot **0.70.2** 桌面客户端做出的非官方 Node.js SDK。作者是铁柱AGI（[@cgnot996](https://x.com/cgnot996)）。它不是 xAI 的产品，不是 Cursor 的产品，也不是 Grok Bot 官方 SDK。

---

## 可以当开头的一段

一开始只是想在 Mac 的 Touch Bar 上放一排自己的 Grok Bot：能滑动，能点开，能打字、录音，还能把 Finder 里选中的文件带进去。要做成这个，得先拿到账号里已有的 Bot，名字、头像、会话都要是原来的那一个，不能每点一次就新建一个。

公开能装到的 SDK 对不上这件事。官方的 Cursor Agent SDK 管的是写代码的 Agent。官方 BDK 里的 Grok Bot 扩展能按名字发一条文字，列出来的却不是整个账号。社区的 grokbot-sdk 更接近 Bot 电脑上的 gateway，而那台电脑不在这台 Mac 上。

所以后来不再套这两套 SDK，改为阅读本机 Grok Bot 0.70.2 的客户端，把桌面应用自己在用的登录、名单、发送和订阅重做成一个零依赖的 Node 包。读名单不必先把云电脑唤醒。头像缺字段时按 Bot 的 UUID 补齐。回复从 Connect 帧转成普通的 SSE。仓库是 [RongleCat/grok-bot-sdk](https://github.com/RongleCat/grok-bot-sdk)。

---

## 时间线

| 时间 | 做了什么 |
|---|---|
| 2026-10-14 | 定产品：Touch Bar 上的已有 Grok Bot。确认要的是 Bot，不是 Cursor 的 coding Agent。 |
| 同一天 | 核对三套现成入口：`@cursor/sdk`、`@cursor/bdk` 的 Grok Bot 扩展、社区 `grokbot-sdk`。此阶段没有登录，没有发真实任务。 |
| 同一天 | 只读桌面客户端 0.70.2 的安装包，找到「登录凭据 → Broker → 云电脑 gateway」这条发现路径。仍未把整份闭源代码拷进项目。 |
| 同一天 | 决定自己做协议层。先写失败测试，再实现。浏览器登录、读账号、读云端名单，在同一次运行里走通。云电脑休眠时不唤醒它。 |
| 同一天 | 在明确授权下，向一个测试 Bot 发过一次带 Markdown 附件的消息。Bot 的回复和本机独立计算的文件特征一致。 |
| 同一天 | 把头像规则收成独立模块：显式字段优先，缺的按 agent UUID 派生。用另一份语言的参考实现核对，没有执行官方渲染器。 |
| 同一天 | 把协议收成可导入的 SDK：统一头像、发送、订阅，并把上游 Connect 流转成 SSE。这次订阅只回放已有回复，没有新发消息。 |
| 2026-10-15 | 从 Touch Bar 应用里拆出协议层，以 `grok-bot-sdk` 单独开源。中英文 README，VitePress 接口站部署在 GitHub Pages。未发布到 npm。 |

Touch Bar 界面本身没有放进这个开源仓库。SDK 是那次产品调研里先做出来、并且已经对过真实账号的协议层。

---

## 1. 最初要做的事

产品目标写在 2026-10-14 的设计稿里：

把账号下已有的、有名字和头像的 Grok Bot，放成 Mac Touch Bar 上的一排快捷入口。左右滑动浏览，停住后认出当前是哪一个，旁边显示名称。再点一次，或者按快捷键，打开一块小面板。面板里有动画头像，可以打字，可以录音。如果当时 Finder 里选中了文件，这些文件作为可预览、可删除的待发送附件进面板。

后面还考虑过 Apple Watch：手表只做选择、输入和看结果，Node 运行时、长连接和云电脑上的文件操作留在自己的后端。手表方案停留在调研，没有做成应用。

这里有一条当时就写死的边界：

- 要的是 Grok Bot。它有名字、头像、长期对话和记忆，同一账号的 Bot 共用一台持久的云电脑。
- 普通 Cursor coding Agent、Cloud Agent 可以另做一条入口，不能用它们的列表冒充 Grok Bot 名单。
- 「所有 Bot」包括自己创建、可用的那些，还要能区分隐藏、团队共享和已删除。某个接口返回成功，不等于名单已经完整。
- 选中必须绑定已经存在的 Bot。按名字「没有就创建」不能用在滑动、点击、启动或刷新上，拼错一个字就会多出一个 Bot。
- 官方客户端能附文件，不代表手头的 SDK 能附文件。附件是单独一关。

界面侧当时的技术选择是：Swift / AppKit 做 Touch Bar 和面板，Node 做桥。桥在开发期用标准输入输出传 JSON，不在本机开 HTTP 端口。官方 SDK 是 Node 优先的，所以没有先用 Swift 重写一整套。

这一层 UI 后来没有和协议 SDK 一起开源。开源的是下面这条协议。

---

## 2. 先找现成 SDK，三套都对不上

核验日同样是 2026-10-14。当时装过包、读过公开文档和已安装包里的实现，没有读取登录令牌，没有登录，没有发真实任务。

用户曾经补充过一条线索：官方应该有一份专门管理 Grok Bot 的 SDK。这条线索按「还要继续找」处理，没有把「这次没搜到」写成「官方一定没有」。找完能核实的包之后，结论是：截至当天能看到的公开文档和已安装包，没有一份公开、稳定、能覆盖全账号名单、真实头像、状态订阅和任意附件的 SDK。

当天登记的版本：

| 包 | 当天看到的版本 | 它实际是什么 |
|---|---|---|
| `@cursor/sdk` | 1.0.37，latest | 官方 TypeScript coding agent SDK。Node >= 22.13。版本号是 1.x，发布说明仍写 public beta。 |
| `cursor-sdk`（PyPI） | 1.0.37 | 官方 Python SDK，Python >= 3.10。 |
| `@cursor/bdk` | 0.2.24 | Bot Development Kit。里面有公开的 Grok Bot 扩展。 |
| `@cursor/july` | 0.2.24 | 和 BDK 同一套产品，不是另一份全账号管理 SDK。 |
| `@cursor/february` | 1.0.7 | 更早的 private-alpha coding Agent SDK，核心仍是 Agent 的创建、恢复和列表。 |
| `@cursor/bot-sdk`、`@cursor/grok-bot-sdk` | npm 返回 404 | 只说明这两个名字不存在。 |
| `@adam91holt/grokbot-sdk` | 只读 checkout 的 `package.json` 为 0.2.0，revision `c14347fa` | 社区包，作者标明非官方。没有把它安装进项目，也没有拿它连账号。不把这次 checkout 的版本说成 npm 上的 latest。 |

本机 Node 是 v22.22.0，满足这些包写的 Node >= 22.13。

### 官方 Cursor Agent SDK：管的是写代码的 Agent

`@cursor/sdk` 能创建、恢复、列出 local / cloud agent，能看 run，能接事件流。本地和云上的对象都带着 coding workspace 的语义。公开类型里没有独立的 Grok Bot 名单、头像或附件接口。

它解决不了「把我账号里已有的 Grok Bot 列出来」。

官方还有一份 SDK Bridge，给 Swift 用 Connect / JSON 去接 coding agent。那是另一条集成路线，同样不提供 Grok Bot 全名单。

### 官方 BDK 的 Grok Bot 扩展：能说话，列不全

已安装的 `@cursor/bdk@0.2.24` 里，扩展名是 `cursor-grokbot-agents`。调用链是：

调用方 → BDK 扩展 → `https://api.cursor.com/v0/grokbot/...` → 账号里已有的云端 Bot。

认证用的是 Cursor API key 的 Bearer。扩展自己的实现注明，这条路不用 `api2` 那台主机。它不要求调用方自己去连 Bot 电脑上的私人 gateway。这一点当时是它的优点：网络路径简单，代码来自官方发布包。

四条路由：

| 操作 | 路由 | 实际语义 |
|---|---|---|
| 按名字要一个会话 | `POST /v0/grokbot/sessions`，body 是 `{name}` | 没有就创建。不是只读查询。 |
| 发文字 | `POST /v0/grokbot/sessions/{id}/messages`，body 是 `{text, messageId}` | 看 delivery。接收结果里出现过 `accepted_temporal` 和 `duplicate`。 |
| 读回复 | `GET /v0/grokbot/sessions/{id}/entries?afterUpdatedSeq=...` | 文本条目，外加 idle / inFlight / queued。 |
| 停下 | `POST /v0/grokbot/sessions/{id}/interrupt` | 停当前工作，Bot 的长期上下文还在。 |

`list` 返回的是扩展配置过的名单，加上调用者联系过的 Bot。随包指南写明这不是全账号枚举。回复靠轮询，默认间隔 750 毫秒，没有公开的 SSE 或 WebSocket 名单流。发送面只有 `text` 和 `messageId`，没有附件字段。也没有头像接口。

底层 backend 没有作为独立公共 export 暴露。把这几条 HTTP 抄出来，不能写成官方保证稳定的 REST，也不能写成一份 Swift SDK。

对 Touch Bar 来说，缺的正是一开始就要的东西：完整名单、头像、附件。按名字获取会话还有副作用，所以后来的桥明确禁止用名字探测 Bot 在不在。

### 社区 grokbot-sdk：更全，但入口在 Bot 电脑上

社区包比 BDK 扩展更接近「管理已有 Bot」：名单、头像字节、形状和颜色、未读、运行状态、SSE、发送、打断、新建和修改，命令表里也有附件路径和 `uploadAttachment` 这个名字。

它有两条入口，不能混成一条。

Gateway 客户端的链路是：调用方 → TypeScript 包装 → **Bot 电脑上的 HTTP gateway** → 主机进程。`listAgents()` 实际是向 gateway 发 `POST /api/listAgents`。头像是 `GET /avatars/{id}`。事件是 `GET /events` 的 SSE。调用方需要能到达的 host URL，以及 gateway token。这个 token 不是 Cursor API key。默认发现方式是读主机上的 `gateway.json`。文档里的 `sand-data` 在 `/home/box`，指的是 Bot 电脑，不是这台 Mac。

Mac 上装了官方 Grok Bot 客户端，不会因此在 Mac 上出现那台云电脑的 gateway。SDK 仓库也不包含 host 本身。

磁盘读写器更不适合当跨设备的主路径。它在 host 同一台机器上读 profile、transcript、SQLite 和 memory，不需要网络 token，但必须有 host 的文件权限。手表和另一台电脑读不到那块磁盘。部分写入还会绕过 host 自己的合并逻辑。

附件只核到入口线索：发送参数里有 `attachmentPaths` / `attachmentNames`，命令清单里有 `uploadAttachment`。那次只读的 checkout 里没有找到完整的上传函数、请求体和「字节从 Mac 传到云电脑、再变成 Bot 读得到的引用」的闭环。Mac 上的 `/Users/...` 不能直接当成云电脑上的路径。

这次没有安装它的脚本，没有读 host 文件，没有拿 token，没有用它连账号。源码里有函数，不等于这个账号能用。

### 对照之后缺的是同一件事

| 需要的能力 | Agent SDK | BDK Grok Bot 扩展 | 社区 gateway SDK |
|---|---|---|---|
| 联系一个已有 Bot | 对象通常不是 Grok Bot | 可以，按名字进会话 | 可以，按稳定 ID |
| 全账号名单 | 没有 | 配置和联系人，不是全量 | 有 host 上的 `listAgents`，是否覆盖隐藏和团队还要再对 |
| 头像 | 没有 | 没有 | 有字节和形状、颜色等字段，没有官方动画 |
| 发文字、读回复 | coding agent 的 run | 有，靠轮询 | 有 |
| 附件 | coding agent 的图片字段不能当成 Grok Bot 附件 | 文本接口上没有 | 有路径字段和上传命令名，闭环没在那次阅读里找到 |
| 从这台 Mac 直接调用 | 可以走 Cursor API | 可以走 Cursor API | 先得连上 Bot 电脑 |

三套都能在各自的范围内用。没有一套同时给出：从自己的账号列出已有 Bot、拿到头像、在不把云电脑路径当本机路径的前提下发送附件。

当时留下的产品判断是：如果名单和附件没有可靠通道，Touch Bar 只能做成「已知 Bot 的交互原型」，不能写成「账号里的 Bot 已经全部接上」。

---

## 3. 转向桌面客户端自己的协议

下一步是只读本机已安装的 Grok Bot **0.70.2**。看的是应用包里的服务描述、请求字段和调用方式，不执行包内的 JavaScript，也不把整份闭源代码复制进仓库。

静态阅读先改了一个判断。

社区 SDK 默认靠 host 上的 `gateway.json`。本机能找到的那份材料只说明了监听地址，找不到可以直接拿去远程调用的 gateway token。这容易得出「必须自己打隧道，或者人在云电脑旁边」的结论。

客户端里还有另一条路：登录凭据交给 `GrokBotService.EnsureSandBox`，响应里有 `gatewayUrl`、`gatewayToken`、`networkToken` 和云电脑的运行状态。桌面应用把 `gatewayUrl` 当作连接地址，把 gateway token 当作 gateway 凭据，把 network token 放进单独的网络头。Cursor 自己的网络文档也是这么分的：桌面一边连 Cursor API，一边连 `<computer>.<cluster>.cursorvm.com` 上的电脑。

所以手工隧道不是唯一候选。账号 token、刷新 token、gateway token、network token 是四种东西，不能互换。`EnsureSandBox` 还带一个 `wake` 字段，调用它可能影响云电脑是醒着还是睡着，不能为了「看看名单」就顺手把机器唤醒。

这条发现仍然只是客户端内部机制。它比 BDK 那条窄文本通道更接近官方界面，但没有因此变成官方支持的第三方管理 SDK。版本、schema 和登录生命周期都要自己跟上。

同一轮还记下了后来被实测改写的一点：当时还没有证明这条 Broker 路径能从独立进程跑起来。证明留到了下一天的实现里，日期仍是 10 月 14 日。

---

## 4. 自己做，而且先限制自己能做什么

协议层定了这几条，后来开源时大体还在：

- Node.js 22，只用语言自带的 `fetch`、加密、文件和测试。运行时不依赖那两套 SDK，也不依赖别的 npm 包。
- 静态目录只提取服务名、方法名和字段元数据，用来知道「客户端声明了哪些调用」。目录不是抓包全集，更不是「这些接口都已经调用成功」。
- 活的调用要显式打开。默认不联网。
- 凭据只发到已经确认的 Cursor API 域名。云电脑的凭据只发到 Broker 返回的、校验过的 HTTPS 源。拒绝重定向。
- 第一轮验证禁止发送、创建、删除、重置、重建。不修改官方客户端已经保存的凭据，不刷新它正在用的 refresh token。浏览器登录拿到的是另一份会话。
- Broker 默认 `wake: false`。云电脑休眠就记成休眠，不把它喊醒，也不把休眠写成 gateway 成功。
- 输出只留状态码、数量和「字段在不在」。令牌、邮箱、Bot 名字、聊天内容和头像地址不进日志。

实现顺序是先写会失败的测试：登录挑战里不能出现 verifier、解不开的钥匙串格式要返回固定错误、请求不能打到账号 API 以外的地址、假的 HTTP 层要能把失败路径跑完。然后才写真正的请求。

---

## 5. 登录：浏览器走完，凭据从轮询回来

桌面客户端的登录是一条 PKCE 风格的流程。

客户端生成 32 字节的 verifier，挑战值是它的 SHA-256，再用 base64url 编码。浏览器打开的是 `https://cursor.com/loginDeepControl`，查询参数里有挑战、uuid、`mode=login`，以及 `redirectTarget=sand`。打开的网址里没有 verifier，也没有 access token。

用户在网页上登录并授权。页面可能提示「打开 Grok Bot」。实测里取消这个回跳，网页仍然显示完成，轮询照样拿到凭据。所以成功的依据是轮询结果，不是浏览器有没有跳回桌面应用。

轮询是 `GET /auth/poll`，带上 uuid 和 verifier。404 表示还在等。200 返回 access token 和 refresh token，有时还有选中的团队。403 是失败。连续三次其他错误记为轮询失败。尝试次数有上限，超过记为超时。间隔从 1 秒开始，按 1.2 倍增加，最高 10 秒。单次 HTTP 超时 20 秒。

这是一次新的登录事务，用随机 uuid，不接管官方客户端正在进行的那一次。新拿到的 refresh token 当时只放在进程内存里。退出进程会丢掉这份内存，不会在服务端注销。官方客户端磁盘上的 refresh token 保持不动，避免两处一起轮换。

后来又对过登录页的静态脚本。桌面回跳用的是 `sand://`，移动标记对应 `grokbot://`。页面上能看到 cli、sdk 等 redirect target，中间登录路径会跟着变。这些 target 没有拿来做端到端验证。已经跑通的仍是 `sand` 这一条。没有证据表明官方网页会跳进一个任意登记的自定义 scheme。自己的应用可以在轮询成功之后更新自己的界面，那是自己的回调，不改 Cursor 的网页。

`POST /oauth/token` 和 `POST /auth/logout` 能在客户端里看到。这个 SDK 没有实现刷新，也没有实现退出。access token 失效后，重新做一次浏览器登录。

Mac 上还有一条可选路径：读官方客户端放在钥匙串里的「Grok Bot Safe Storage」，用 Electron v10 那套参数解开。操作系统会弹出授权。这条路径只在 macOS 上提供。一把过期的桌面令牌就停在认证失败，下一步仍是浏览器登录，而不是去刷新官方应用正在用的那一把。

---

## 6. 账号和名单可以不经过云电脑

请求打到 `https://api2.cursor.sh`。形式是 Connect 风格的一元 JSON：`POST /aiserver.v1.<服务>/<方法>`。

客户端带上的身份头包括：Bearer 令牌、`connect-protocol-version: 1`、客户端类型 `sand`、来源 `sand-desktop`、版本默认 `0.70.2`、操作系统 `darwin`、命名空间 `prod`、ghost mode，以及每个请求一个 UUID。操作系统头即使进程不在 Mac 上也保持 `darwin`，因为核对过的那份客户端就是这样送的。机器码存在时才附加 checksum。一次全新的浏览器登录没有带 checksum，仍然读到了账号。这些头在实测里一起可用。没有逐个拆开，证明哪一个可以省。

同一轮里分清了两种名单，都能返回 200：

1. **云端直接读。** `GetMe`，然后 `ListGrokBotAgents`。不需要云电脑的 IP，不需要导入 `gateway.json`，也不需要在本机做转发。请求可以带上包含团队 Bot。响应里的 `truncated` 必须当真：被截断就不是全量，这个 SDK 不会自己继续翻页。
2. **经云电脑的 gateway。** `EnsureSandBox` 拿到连接，再请求 `/health` 和 `/api/listAgents`。这是社区 SDK 所在的那一层。电脑醒着时这条也通了。电脑休眠时，Broker 返回休眠，没有 gateway 地址，实现没有唤醒它。

对最初的产品问题，第 1 条是分界。名单不必先拥有一台醒着的云电脑。云端名单和 gateway 名单条数相同，也不能据此断言两边的 ID 集合完全一致。团队 Bot 和分组可能混在里面，产品层还要用 kind、所有者、teamId 自己滤。

静态目录当时抽出 7 个服务、484 个 RPC 方法声明、167 个 gateway 方法声明。这里面有管理、账单和后台任务。这个数字是「客户端声明了多少」，不是「已经验证能调用多少」。引用计数来自包内文本匹配，同名方法跨服务会重复，不能当成请求次数。

Bot 有两个 ID。`agentId` 是 UUID，发送、订阅和头像计算用它。另一边是服务端的数字 ID。混用会让默认头像算错。SDK 里 `Bot.id` 是 UUID，`Bot.serverId` 是另一个。

---

## 7. 头像：接口没给字段，不代表没有头像

云端名单的 schema 里有形状和颜色，但很多记录的 JSON 里这两个键是空的。自定义图片 URL 也可以是空的。

客户端的选择是分开的：

1. 有自定义图片就显示图片。只有版本号、没有 URL 时，仍然标成图片，URL 留空。SDK 不猜 URL，也不下载图片。
2. 没有自定义图片时，形状和颜色各自判断。给出的值落在这一版的合法表里，就用给出的值。
3. 缺了、空了或非法的那一项，单独用 Bot 的 UUID 派生。不能因为颜色空了，就把已经写明的形状也丢掉。

派生是确定性的，不需要令牌，也不需要安装客户端。哈希是 FNV-1a 的 32 位版本，但吃的是 JavaScript `charCodeAt` 的 UTF-16 code unit，不是 UTF-8 字节。形状和颜色在这个哈希上再做一次混合，用的盐在 0.70.2 里都是 1。默认池是 8 种形状乘 10 种颜色。编辑器里的形状更多，黑色可以作为显式颜色，但不进随机色池。所以两个 Bot 可以长得一样，这是规则，不是碰撞bug。

UUID 必须按接口返回的字符串原样使用：保留连字符，不改大小写，不去空白，也不要先解析成 UUID 再转回字符串。大写之后是另一个头像。数字形式的 server id 代不进这个函数。

核对方式是另写一份不依赖这份 Node 代码的 uint32 参考，逐项比哈希、形状下标和颜色下标。没有执行官方客户端里的渲染包。一个缺少显式头像字段的测试 Bot，独立算出的形状和颜色与客户端里看到的一致。

SDK 的 `listBots()` 因此总是返回同一套头像结构：解析后的形状和颜色，加上 `avatar.kind`、图片和来源。缺字段不再被说成「这个 Bot 没有头像」。

动画没有放进 SDK。桌面里的表情、视线和形变是另一套渲染器。Bot 的 ID 推不出它现在是在思考还是在说话。仓库里的 README 头图用的是这套形状和颜色的静止帧，中间那只是默认的黑色圆形。绘制参考了一份 MIT 的独立复现，那份代码不是官方美术，也没有把渲染器源码放进这个开源包。

---

## 8. 发送、附件和回复

第一轮协议验证故意不发送。发送是在用户明确授权之后，单独做的一次。

那次向一个指定的测试 Bot 发了一篇 Markdown。上传走的是云电脑 gateway：申请上传时返回的模式是使用 Box，不是单次 PUT。文件字节经 gateway 的上传接口写到云电脑，响应当作附件引用。然后调用 `SendGrokBotUserMessage`。

发送时用的是 agent UUID，而不是数字 ID。`messageId` 由调用方固定。来源、发起人和发送场景用的是桌面客户端那一组枚举。时间是十进制字符串。附件路径和附件名成对出现。响应 HTTP 200，投递结果是 `accepted-temporal`。

回复从 `ListGrokBotTranscriptEntries` 读。正文是 Base64 的 JSON。Bot 在回复里给出了标题、原始字节数和哈希。这些值和本机对原文件的独立计算一致，预期哈希没有事先写进提示里。只有这种对得上，才把这次标成「附件被读过」。

单次 PUT 再加完成提交，只有离线测试，不能写成同一次真人验收。gateway 这条上传、发送和读回复，是实测过的。

这套上传命令行没有放进开源包。开源 SDK 的 `sendMessage` 只接收已经在服务端的附件引用。把本机路径传进去，不会帮你上传。

投递被接受，只说明服务端收下了这条投递记录。它不说明 Bot 已经读完，也不说明已经有回复。`dispatched` 是另一个布尔值。HTTP 结果含糊时抛 `SEND_UNCONFIRMED`，SDK 不会自动再发一次。自动重试可能投出第二份。调用方自己保持同一个 `messageId`，重复时可以看到 `duplicate`。

---

## 9. 收成 SDK：订阅的是 Connect，交出去的是 SSE

协议调用稳定之后，收成一个可以 `import` 的模块。导出的是：

- 浏览器登录的创建和轮询
- `GrokBotClient`：`getMe`、`listBots`、`sendMessage`、`watchBot`、`botEventsSSE`
- 头像的纯函数
- 可选的 macOS 桌面凭据读取
- 固定的错误码

`watchBot` 订阅的是 `WatchGrokBotTranscripts`。上游是 Connect 的 JSON 帧，一块一块带长度和标志，不是一条现成的 SSE。压缩帧直接拒绝。单帧有大小上限。`botEventsSSE` 把这些事件收成标准的 `text/event-stream` 响应，调用方拿到的是 Web `Response`，SDK 自己不监听端口。

消息事件里的文本是这一条记录当时的完整正文。同一个 `entryId` 后来再次出现，就是整段替换。逐 token 的增量没有在这条流上被证实。它也不是 OpenAI Chat Completions 的数据块。

不传游标时，先用 `limit: 1` 读最新一条，从它的 `updatedSeq` 开始，避免把全部历史再放一遍。这不是全局高水位：更早的记录被改过，仍可能再出现。`seq` 和 `updatedSeq` 是十进制字符串，比较要用 `BigInt`。游标太旧时发出 `resync-required` 并停下，不假装中间漏掉的消息已经送到。生成号变了就是 `reset`，本地那份会话副本要丢掉。

`watchBot` 里没有自动重连。流结束只说明这次 HTTP 正文结束，不说明 Bot 这一轮说完了。要继续，就用上一事件的 id 再开一次。发送和订阅分开：连接断了，绝不会因此把消息再发一遍。

账号令牌留在持有 `GrokBotClient` 的服务端。浏览器的 `EventSource` 去连自己的路由。令牌不放进 URL。

这一层做过一次真实订阅：HTTP 200，收到连接和状态事件，并把此前那次已授权回复经 SDK 转成 SSE，正文里的验收标记还在。这次新增发送次数是 0。`sendMessage` 这个封装函数的行为由离线测试覆盖；底层发送接口的真人证据是更早的那次附件验收。打包成公开仓库之后，没有再对线上重跑一遍。公开仓库里的测试是 37 项假响应测试，和当时私有树里连同提取器、附件上传一起的 49 项不是同一个集合。

---

## 10. 开源时留在仓库里的，和故意留下的

2026-10-15，协议层从 Touch Bar 应用中拆出来，单独成为 [github.com/RongleCat/grok-bot-sdk](https://github.com/RongleCat/grok-bot-sdk)。Touch Bar 应用仓库保持原样，里面的调研笔记、脱敏报告和未公开的上传工具没有进这个公开仓库。

公开包的形态：

- 名字 `grok-bot-sdk`，MIT，版权 2026 RongleCat。
- ESM，Node.js >= 22.13，运行时零依赖。TypeScript 只用来检查声明文件。
- 版本 0.1.0。没有发布到 npm。安装方式是 `npm install github:RongleCat/grok-bot-sdk`。
- 命令行只有登录和 `whoami`。登录必须指定输出文件，文件权限是 `0600`。标准输出不打印令牌，只打印「保存了没有、字段在不在」。
- 接口站用 VitePress，英文在站点根，中文在 `/zh/`。GitHub Pages 的地址是 <https://ronglecat.github.io/grok-bot-sdk/> 。
- README 中英并列。相关项目写了 Grok App、awesome-grok-bot，以及学习站 <https://bot.tiezhu.si/> 。作者渠道是 X [@cgnot996](https://x.com/cgnot996) 和微信公众号「铁柱AGI」。付费交流群是加作者微信后再邀请，不是一个扫进去就进群的群二维码。

Grok App 是同一作者做的、本机 Grok Build CLI 的桌面工作台，仓库在 <https://github.com/RongleCat/grok-app> ，站点是 <https://grok-app.com> 。它和 grok-bot-sdk 是两个程序。文章里不要写成「Grok App 的 SDK」，也不要写成 xAI 官方客户端的开源替代品。

故意没有放进公开包的：

- 从安装包提取接口目录的工具
- 附件字节上传的命令行
- 本机的实测报告、Bot 名单和任何凭据
- 令牌刷新、退出登录、云电脑唤醒
- 头像动画运行时
- Touch Bar、录音、手表界面

公开文档把这些边界写在「使用前要知道的事」里。版本按 0.70.2 核对。更新的客户端可以改路径、请求头、枚举和头像盐。调用方可以传 `version`，默认字符串仍是 `0.70.2`。

---

## 11. 写文章时可以怎么铺

建议按决定的顺序写，不要先堆接口表。

1. **想做的交互。** Touch Bar 上是一排已经存在的 Bot。点开就能说，还能带上 Finder 里的文件。一句就够，不必展开 Swift。
2. **为什么现成 SDK 不够。** 用上面的三列表。重点是三句话：Agent SDK 的列表不是 Grok Bot；BDK 能对话，但名单不是全账号，而且按名字会创建；社区 SDK 要连的是 Bot 电脑，不是这台 Mac。
3. **自己读客户端之后，名单可以走云端。** 这是整个过程里最值得写的发现。读 Bot 名单不必先把云电脑叫醒，也不必先拿到 gateway。
4. **头像那一笔。** JSON 里没有形状和颜色，常常只是空字符串被省掉了。用 UUID 可以离线算回来，而且必须用对那一个 ID。
5. **回复不是官方 SSE。** 上游是 Connect 帧，SDK 把它收成浏览器能直接消费的 SSE。文本是整段更新，不要写成打字机式的 token 流。
6. **开源的范围。** 协议层开源了。Touch Bar 还是本地产品。上传文件、刷新令牌、自动重连没有放进来。
7. **怎么装、文档在哪、作者是谁。** 链接放文末。

标题可以老实写，例如：

- 为了在 Touch Bar 上调用已有的 Grok Bot，我把客户端协议做成了一个 SDK
- 现成的 Grok Bot SDK 对不上名单和头像，于是有了 grok-bot-sdk

少用「首个」「官方替代」「完全兼容后续版本」这类说法。客户端一更新，路径和盐都可能变。

---

## 12. 对外链接

| 用途 | 地址 |
|---|---|
| 仓库 | https://github.com/RongleCat/grok-bot-sdk |
| 英文文档 | https://ronglecat.github.io/grok-bot-sdk/ |
| 中文文档 | https://ronglecat.github.io/grok-bot-sdk/zh/ |
| 安装 | `npm install github:RongleCat/grok-bot-sdk` |
| X | https://x.com/cgnot996 |
| 学习站 | https://bot.tiezhu.si/ |
| Grok App | https://github.com/RongleCat/grok-app |
| awesome-grok-bot | https://github.com/RongleCat/awesome-grok-bot |
| 官方 Agent SDK 文档 | https://cursor.com/docs/sdk/typescript |
| 官方 BDK | https://www.npmjs.com/package/@cursor/bdk |
| 社区 gateway SDK | https://github.com/adam91holt/grokbot-sdk |
| Grok Bot 产品文档 | https://cursor.com/docs/grok-bot |

社区 SDK 和官方包是调研对象。文章里写它们各自覆盖了什么，不写成它们不可用，也不写成我们的包是它们的下游。

---

## 发布前删掉这一节

下面这些只帮助作者核对，不要出现在公开文章、帖子和配图里。

- 不要写令牌、verifier、钥匙串密码、机器码、邮箱、聊天原文、签名上传地址。
- 不要写本机路径，包括应用安装位置、支持目录、报告文件的磁盘路径。
- 不要点名那次验收用的测试 Bot，不要贴那份 Markdown 的标题、字节数、哈希和来源编号。公开说法停在：向一个授权过的测试 Bot 发送过一篇本地 Markdown，回复里的文件特征和本机独立计算一致。
- 名单条数在不同只读快照里不一样，而且包含团队 Bot 和分组的可能。不要把某一次的条数写成「我有多少个 Bot」。
- 私有调研笔记留在 Touch Bar 项目的 `docs/research` 和 `docs/api`。那些 JSON 报告即使脱敏，也不要随文章仓库一起公开。
- 49 项测试是私有目录连同提取器和附件工具的数字。公开仓库是 37 项，全部使用假的 HTTP 响应。
- `sendMessage` 这个公开函数没有在打包之后再做「新发一条 → 等到新回复」的线上闭环。底层发送接口有更早的一次附件实测。两件事分开说。
- 头像算法的盐、形状顺序和编码方式已经写进公开文档。文章里用自然语言讲「按 UUID 派生」即可，不必再贴一版实现。渲染器源码不要随文章分发。
