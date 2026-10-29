# Touch Bar Bot bridge

隔离 Node + TypeScript 开发环境。锁定官方 @cursor/sdk 1.0.37 和 @cursor/bdk 0.2.24；Node >=22.13。默认协议仅使用 mock，没有账号登录、令牌读取或真实消息发送。

```sh
cd bridge
npm ci --ignore-scripts
npm run check
npm run build
node dist/src/cli.js
```

向 stdin 发送一行 JSON，stdout 返回一行 JSON（不用 npm run dev 的日志作为 IPC）：

```json
{"id":"1","method":"capabilities"}
{"id":"2","method":"bots.list"}
{"id":"3","method":"bots.send","params":{"botId":"mock-researcher","text":"Hello"}}
```

mock send 返回 delivered:false；有附件直接返回 ATTACHMENTS_NOT_IMPLEMENTED，不会读取附件路径。GrokBotClient 是实验性的独立 adapter：仅匹配官方 BDK 发布包已观察到的文本 session 协议；必须显式 enabled、传入 apiKey 与 confirmedSessionIds 才能调用。CLI 未接线该 adapter，不提供名称 get-or-create 或全账号发现。

sdk-contracts.ts 只验证官方 SDK 公共 TypeScript 类型，不导入执行 SDK。测试注入内存 fetch，绝不连账号。完整调研见 ../docs/research/cursor-sdk.md。BDK 随包原始指南见 node_modules/@cursor/bdk/docs/guides/grokbot-agents.md 与同包 LICENSE.md。
