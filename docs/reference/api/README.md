# API 参考与实测报告

状态：Current（文档）/ Historical（报告）。这里的 JSON 是过去某次真实账号验收的快照，**不是**当前构建的回归结果。

| 文件 | 内容 |
| --- | --- |
| [grok-bot-client-api.md](grok-bot-client-api.md) | 登录、请求头、云端名单、Broker/gateway、附件/转写/发送接口与实测边界 |
| [client-api-catalog.md](client-api-catalog.md) | 从客户端静态提取的 484 个 RPC / 167 个 gateway 声明 |
| [client-api-inventory.json](client-api-inventory.json) | 上述目录的机器可读版本 |
| [sdk-usage.md](sdk-usage.md) | SDK 用法、事件格式、游标、后端接入 |
| [bot-id-avatar-algorithm.md](bot-id-avatar-algorithm.md) | 按 Bot UUID 派生形状/颜色的规则与验证向量 |
| [missing-avatar-bots.md](missing-avatar-bots.md) | 历史缺失头像清单 |
| `client-mvp-*-report.json` | 登录/名单/gateway 的脱敏实测报告 |
| `sdk-live-report.json` / `sdk-stream-probe.json` | 回复流与 SSE 实测 |
| `webhook-attachment-live-report.json` | 附件发送与读取验收 |
| `native-app-verification.json` | 迁移前原生 App 验证记录 |

## 使用规则

- 报告只用于理解协议和边界；引用时写清日期与当时的客户端版本。
- 报告里不应出现 token、cookie、邮箱、聊天正文；发现泄漏立即删除并轮换凭据。
- 新验收写新文件，不覆盖旧报告；文件名带日期或场景。
- 当前行为以 [Client Protocol](../../subsystems/client-protocol.md) 与源码为准。

## 相关

- [Client Protocol 子系统](../../subsystems/client-protocol.md)
- [SDK 使用](sdk-usage.md)
