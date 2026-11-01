# Grok Bot 客户端协议 SDK / MVP

直接复现 Grok Bot 0.70.2 的客户端协议，无第三方 SDK、零 npm 依赖。Node SDK 支持账号/名单、统一头像、消息发送及 Connect → SSE 回复转发；CLI 保留授权和附件验收功能。原生应用现通过 app-bridge.mjs 接入这些能力，见 [应用说明](../../docs/history/legacy/native-app.md)。

SDK 核心只需要 Node >=22.13；下方 CLI 的本机凭据/静态提取功能需要 macOS 和本机 Grok Bot。在仓库根目录运行：

```sh
# 新的独立浏览器登录，登录成功后读取账号和云端 Bot 名单
node packages/client-protocol/cli.mjs login --cloud-only

# 用官方客户端本机已有登录验证同样的读取接口
node packages/client-protocol/cli.mjs verify --desktop --cloud-only

# 进一步访问 Broker 和 gateway；永远 wake=false
node packages/client-protocol/cli.mjs verify --desktop

# 保存脱敏结果，文件按 0600 创建
node packages/client-protocol/cli.mjs verify --desktop --cloud-only --report docs/reference/api/local-verification.json

node --test packages/client-protocol/test/*.test.mjs
node packages/client-protocol/cli.mjs inventory
```

`login` 打开系统浏览器并轮询授权；`--no-open` 仅输出登录页面 URL，用于手动打开。凭据仅在进程内存中使用，退出丢弃，不刷新共用的客户端 token，不修改客户端账户存储。`--desktop` 会通过系统 Keychain 读取 `Grok Bot Safe Storage` 并在内存解密当前 active account；若系统要求访问授权，由正常 Keychain 机制处理，不绕过系统权限。已有凭据失效时会停止，请改用独立 `login`。

读取结果是真实数据，但输出仅保留数量、状态码、字段是否存在，不打印凭据、邮箱、Bot 名称/ID、头像地址或聊天内容。`--cloud-only` 仅调用 GetMe/ListGrokBotAgents；省略时再尝试 Broker/health/listAgents。gateway 休眠不会唤醒；报告标 host_not_running。验证失败 exit 1，用法错误 exit 2。新授权的 refresh token 当前不持久化；退出进程不等于服务端撤销授权。

已验证：同一次新浏览器授权 → GetMe → 云端名单，37 条、无截断，报告在 docs/reference/api/client-mvp-browser-cloud-report.json；另有旧会话云端/gateway 的辅助报告，gateway 返回 37 条（2 个 group）。详情见 [接口文档](../../docs/reference/api/grok-bot-client-api.md)、[完整方法目录](../../docs/reference/api/client-api-catalog.md)、[机器可读 schema](../../docs/reference/api/client-api-inventory.json)。

提取器只读 ASAR 的静态文本，不执行客户端代码。484 RPC +167 gateway 为声明范围，绝大多数未执行。内部接口更新后需要重新核实；当前不具备持久授权、自动 refresh、录音或 Watch 原生实现。附件消息发送与回复验收见下文。

## SDK 快速使用

```js
import { GrokBotClient } from './sdk.mjs';
const client = new GrokBotClient({ accessToken: process.env.GROK_BOT_ACCESS_TOKEN });
const { bots, truncated } = await client.listBots();
// 接口的有效头像参数优先，缺失参数按 Bot UUID 计算。
const bot = bots[0];
const response = client.botEventsSSE({ botId: bot.id, sessionId: bot.sessionId });
// 已认证的后端路由可流式返回 response。
```

`watchBot()` 返回 AsyncGenerator，`botEventsSSE()` 返回标准 Web Response。消息为完整文本 upsert，尚未验证逐 token 输出。支持恢复游标、取消、重复过滤；默认从最新返回记录的游标开始，旧记录的编辑仍可能回放。`reset` 要清理会话状态；`resync-required` 要重载历史；`entry.unavailable` 当前不自动补取正文。SDK 自身不自动重连或 refresh。

最新实测 35 个 Bot 全部有统一头像（20 显式、15 派生），已将 Webhook 测试员之前的附件回复通过 SDK 转为 SSE，未新增发送。完整事件格式、后端接入、游标和实测范围见 [SDK 使用文档](../../docs/reference/api/sdk-usage.md)。

## 指定 Bot 的附件发送验收

仅在明确授权收件者与文件后使用：

```sh
node packages/client-protocol/attachment-cli.mjs --send --bot 'webhook 测试员' --file '/Users/ronglecat/Downloads/ESP32_调研与文章资料.md' --wait-seconds 180

# 只观察已有发送的新回复，不重复发送
node packages/client-protocol/attachment-cli.mjs --observe --bot 'webhook 测试员' --wait-seconds 180
```

默认报告为 docs/reference/api/webhook-attachment-live-report.json。已有报告时禁止再次 --send；仅当报告明确 sendAttempted=false 时，可用 --resume-unsent 和完全相同的文件继续准备。发送请求前持久记录 nonce/attempt 标记；网络模糊失败查 GetGrokBotSendStatus，不自动重新投递。不要删除报告以盲目重发。

附件先请求 BeginGrokBotAttachmentUpload：SINGLE_PUT 使用签名地址上传并 Complete；USE_BOX 则经 Broker 获取 gateway 后 uploadAttachment。当前小文件验收限制 4MiB，未实现 multipart。为完成用户授权的附件上传，USE_BOX 路径若没有可用 gateway，会请求 wake=true，最多等待约两分钟；原 verify 默认不唤醒的行为保持不变。

使用固定 messageId 经云端 SendGrokBotUserMessage 发送。只检查当前目标的新回复，成功验收同时要求 Bot 返回本次 messageId、文件原始字节数、标题和 SHA-256；用户消息回显或旧 nonce 不作为验收通过。报告不包含账号/gateway/network token、签名上传 URL，包含本次目标 ID、消息 ID、文件摘要和相关 Bot 回复。进程退出码 0 仅表示命令运行结束，最终读取结果应检查报告 status=attachment-read-verified；sent-awaiting-reply 不等于已读取。

## Bot ID 默认头像参数

`avatar.mjs` 提供离线的 `deriveDefaultAvatar(key)` 与 `resolveAgentAvatar(rawCloudAgent)`，复现本机 0.70.2 的 ID 派生形状/颜色及显式参数覆盖。无需账号或安装官方 App；云端输入必须使用 agentId UUID，不能使用数字 id。模块提供参数，不包含完整头像渲染/动画。完整推导、候选列表、跨语言验收向量见 [算法说明](../../docs/reference/api/bot-id-avatar-algorithm.md)。
