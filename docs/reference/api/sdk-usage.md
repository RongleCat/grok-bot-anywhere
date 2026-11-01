# Grok Bot 协议 SDK：统一头像与 SSE

本地入口是 `packages/client-protocol/sdk.mjs`，附带 TypeScript 声明，零 npm 依赖，运行环境为 Node >=22.13。这是根据 Grok Bot 0.70.2 客户端协议实现的非官方 SDK，尚未发布 npm 包。已通过 app-bridge.mjs 接入 [Swift Touch Bar 应用](../../history/legacy/native-app.md)。核心模块不依赖安装 Grok Bot；读取 Mac 已有会话的 `desktop` adapter 才依赖本机 App/Keychain。watchOS 应调用部署后的自有后端，不能直接运行这个 Node SDK。

## 读取账号与统一名单

在仓库根目录创建调用脚本：

```js
import { GrokBotClient } from './packages/client-protocol/sdk.mjs';

const client = new GrokBotClient({ accessToken: process.env.GROK_BOT_ACCESS_TOKEN });
const me = await client.getMe();
const { bots, truncated } = await client.listBots();
// bots[i].id 是 agentId UUID；serverId 是服务端另一套记录 ID。
// bots[i].avatarShape / avatarColor 始终是解析后的有效参数。
```

`listBots({includeTeamAgents: true})` 默认包含接口可见的团队记录，原样返回 `truncated` 标记，不能把截断结果当成完整名单。每条 Bot 都有相同的字段结构，并且逐字段决定头像：有效的接口 `avatarShape`/`avatarColor` 优先；缺失、空或无效值按 `agentId` 计算。显式形状与默认颜色可以组合。算法固定为 `grok-bot-0.70.2`，详见 [推导和验收向量](bot-id-avatar-algorithm.md)。

Webhook 测试员的输出示例（省略其他 Bot 字段）：

```json
{
  "avatarShape": "cloud",
  "avatarColor": "brown",
  "avatar": {
    "algorithmVersion": "grok-bot-0.70.2",
    "kind": "character",
    "character": {
      "shape": "cloud", "color": "brown",
      "baseHex": "#936439", "lightHex": "#A27952", "darkHex": "#855C36"
    },
    "sources": {"shape": "id-default", "color": "id-default"},
    "picture": null
  }
}
```

如果存在自定义图片，`avatar.kind='picture'`，下游优先使用 `avatar.picture.url`；`character` 仍提供一致的备用角色参数。只有 `avatarVersion` 而没有 URL 时，`picture.url=null`，需另行解析图片地址，当前 SDK 不下载图片。模块提供形状与颜色参数，完整角色渲染和动画尚未接入。

## 接收 Bot 事件

```js
const control = new AbortController();
for await (const event of client.watchBot({
  botId: bots[0].id,
  sessionId: bots[0].sessionId,
  signal: control.signal,
})) {
  if (event.type === 'message') {
    // 按 entryId 更新这一条消息，text 是当前完整文本。
    console.log(event.data.entryId, event.data.text);
  }
}
```

上游调用 `WatchGrokBotTranscripts`，使用 Connect JSON server streaming，而不是直接读取上游 SSE。SDK 解析帧、处理流结束错误，再输出 `AsyncGenerator<BotEvent>`。[Connect 协议说明](https://connectrpc.com/docs/protocol/)

| 事件 | 下游处理 |
|---|---|
| `connected` / `heartbeat` | 连接元数据与上游心跳；connected 的 id 提供初始恢复游标，可保存用于切换回来时补回尚未看到的更新 |
| `message` | `operation='upsert'`；按 `entryId` 替换完整 `text`，同一条消息可能多次更新 |
| `entry` | 其他 transcript 事件，保留解析后的 `entry` |
| `entry.unavailable` | 正文省略或不可解析，提供 `bodyOmitted`/`blobHash`，当前不自动补取 |
| `message.deleted` | 删除指定 transcript 记录 |
| `reset` | generation 改变或会话清空，应清理旧会话状态 |
| `resync-required` | 游标过旧；订阅结束，需要调用方重载历史后重新订阅 |
| `turn.failed` | Bot 回合失败 |
| `bot.state.changed` / `bot.updated` | 当前 Bot 状态或统一名单字段更新 |

这是消息/文本更新流，目前没有验证逐 token 增量，也不是 OpenAI Chat Completions 的流格式。订阅的是 Bot/session；同一会话中的其他发送也会出现。`sendMessage` 的 `messageId` 与 transcript 的 `entryId` 不等价，当前没有实现严格绑定某一次提问的独占回复流。

## 转发为标准 SSE

后端框架支持 Web `Response` 时，可以在已经认证且绑定当前用户 Bot 的路由中直接返回：

```js
// client 来自当前已认证用户的服务端凭据；authorizedBot 来自服务端权限校验。
function replyEvents(request, client, authorizedBot) {
  return client.botEventsSSE({
    botId: authorizedBot.id,
    sessionId: authorizedBot.sessionId,
    resumeFrom: request.headers.get('last-event-id') || undefined,
    signal: request.signal,
    keepAliveMs: 15000,
  });
}
```

返回头为 `text/event-stream; charset=utf-8`、`Cache-Control: no-cache, no-transform`、`X-Accel-Buffering: no`。调用方断开时取消上游请求，包括订阅前的游标查询。此处没有创建公网监听器或部署路由；框架/代理需要将 Response 流式发送。

消息事件格式如下，`id` 是 SDK 编码的 Bot/session/generation/updatedSeq 恢复游标：

```text
event: message
id: <resume-cursor>
data: {"botId":"…","sessionId":"","generation":0,"seq":"22","updatedSeq":"22","entryId":"…","replay":false,"operation":"upsert","text":"Bot 的完整回复"}

```

浏览器调用自有后端示例：

```js
const events = new EventSource('/api/bots/selected/events');
events.addEventListener('message', ({data}) => {
  const message = JSON.parse(data);
  replaceMessage(message.entryId, message.text);
});
events.addEventListener('resync-required', () => {
  events.close();
  reloadHistory(); // 应用负责重建基线，再创建新订阅。
});
events.addEventListener('error', (event) => {
  if (typeof event.data === 'string') console.error(JSON.parse(event.data).code);
});
```

SSE 标准支持命名事件及重连时的 `Last-Event-ID`；后端将其传给 `resumeFrom`，SDK 验证其 Bot/session 范围。不要将账号 token 放入 EventSource URL；调用方认证使用自己的会话机制。[WHATWG SSE 规范](https://html.spec.whatwg.org/multipage/server-sent-events.html)

## 游标与连接边界

- 未传 `cursor` 或 `resumeFrom` 时，先查询 `ListGrokBotTranscriptEntries(limit=1)`，以最新返回记录的 `updatedSeq` 作为起点，避免全量历史。它不是全局更新高水位，更早记录被编辑后仍可能回放其最新 snapshot。
- 需要明确回放时传 `cursor: {generation: 0, afterUpdatedSeq: '18'}`；generation 必须来自目标会话，不能通用地写死为 0。`cursor` 与 `resumeFrom` 二选一。
- `seq`/`updatedSeq` 始终是十进制字符串，以 BigInt 比较，保留 uint64 精度。同一批更新排序后推进游标，并过滤重复更新及其他 Bot/session 的 transcript。
- `entry.unavailable` 也会推进游标。当前没有 blob hydration 和缺失历史恢复 API，不保证省略正文自动补齐。
- `watchBot` 自身不自动重连；上游有连接寿命限制。SSE 调用方重建 HTTP 请求时可恢复游标，不能将 `stream.closed` 当成 Bot 已完成回复。
- HTTP 200 之后的上游流错误转成 SSE `error`，只含固定 `code`；正常连接结束输出 `stream.closed`。SSE 已开始后无法再改变 HTTP 状态。调用方应区分原生网络错误与含 JSON data 的 SDK 错误事件。
- 当前仅支持未压缩 Connect 帧，单帧最大 1 MiB；请求默认内联正文 256 KiB，可将 `inlineBodyMaxBytes` 设置到最多 512 KiB。

## 授权与发送

入口还导出 `createLogin()`/`pollLogin(flow)`，复用已验收的 PKCE 流程。打开浏览器、保存凭据、独立会话 refresh 由调用方负责，当前未实现长期自动 refresh。不要在日志记录登录事务、token 或签名地址。使用本机已有登录仅作为可选 Mac adapter：

```js
import { desktopCredentials } from './packages/client-protocol/desktop.mjs';
const credentials = await desktopCredentials();
const client = new GrokBotClient(credentials);
```

`sendMessage({botId,sessionId,text,messageId,attachmentPaths,attachmentNames})` 返回 `accepted-box`、`accepted-temporal` 或 `duplicate`。接受投递不等于已经读取/回复；网络结果不明确时抛 `SEND_UNCONFIRMED`，不会自动重发。附件参数是已上传的服务端引用，不能传本机路径作为上传操作；现有上传/验收仍使用 [附件 CLI](../../../packages/client-protocol/README.md#指定-bot-的附件发送验收)，尚未封装成这个 SDK 的上传方法。

## 已完成的验证

| 检查 | 结果 |
|---|---|
| 实际云端名单经过 `listBots()` | 35 条，无截断；20 个显式头像、15 个 ID 默认头像，全部有统一输出 |
| 实际上游 Connect 订阅 | HTTP 200，收到 connected/state 事件；[探测记录](sdk-stream-probe.json) |
| 实际 SDK → SSE 回复转发 | 回放 Webhook 测试员此前获授权的附件回复，验收标记与 SHA-256 一致；[SDK 实测记录](sdk-live-report.json) |
| 自动测试 | 当前 57 项客户端测试通过，另有 1 项 Bloub 全状态渲染测试；覆盖头像、分片帧、错误、游标精度、范围过滤、取消、账号切换与发送行为 |
| TypeScript | strict + NodeNext 声明检查通过 |

此次只读取和回放已有回复，新增发送次数为 0。新 SDK 的发送 facade 有离线测试，底层发送接口此前已有 [附件实测](webhook-attachment-live-report.json)；此次没有再做新发送到新回复的全链路验收。尚未实现录音、原生 Watch 客户端或动画渲染。
