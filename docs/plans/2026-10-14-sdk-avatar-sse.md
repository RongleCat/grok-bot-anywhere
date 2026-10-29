# SDK 统一头像与 SSE 转发 Implementation Plan

**Goal:** 将已验证的独立协议 MVP 封装为可导入的 SDK，让 Bot 名单始终返回统一头像结构；订阅指定 Bot 的回复事件并转成标准 SSE。

**Architecture:** 用户已明确批准显式头像优先、缺失字段按 ID 补齐的输出规则。沿用独立协议实现，不接入此前两个 SDK。SDK listBots 返回统一 Bot DTO；GrokBotService/WatchGrokBotTranscripts 使用 Connect JSON framing，上游流经有大小限制的解码器变为 AsyncIterable 事件，再转换为 Web Response SSE。发送与订阅分开，绝不因断线重复发消息。若真实流接口不可用，记录限制，不把定时轮询描述为原生实时流。

**Tech Stack:** Node >=22.13 原生 fetch/ReadableStream/Response；零新增 npm 依赖；ESM 与 TypeScript 声明。

---

### Task 1: 统一 SDK 名单

- Create: client-mvp/sdk.mjs、sdk.d.mts、test/sdk.test.mjs。
- 使用现有 avatar.mjs，公开 id 始终为 UUID，serverId 单列；avatarShape/avatarColor 与 avatar.character 一致。
- 原始有效配置优先，空/无效值分别补齐；保留 picture 优先和 avatar.sources。
- 先测试 raw roster 两种来源输出相同结构、字段独立覆盖及 truncated 保留，再实现。

### Task 2: Connect 流传输

- Create: client-mvp/connect-stream.mjs、test/connect-stream.test.mjs。
- 先验证跨 HTTP chunk/UTF8 分包、5 字节 envelope、终止帧内错误、大小上限和取消释放，再实现。
- 仅协商 identity frame，不暗中接受未知压缩/flags；HTTP 200 必须继续检查 endstream error。
- SDK watchBot 默认从最新 cursor 开始，支持明确 cursor/Last-Event-ID 恢复。限定 botId/sessionId，保持 uint64 序号为 string。
- 解码新 Bot 文本为 message upsert；用户回显为 entry，删除/reset/cursor-too-old/失败单独输出。事件更新不是逐字 token 协议。

### Task 3: SSE Response

- Create: client-mvp/sse.mjs、test/sse.test.mjs。
- 输出标准 text/event-stream、event/id/data；JSON 转义防止内容注入 SSE 字段。
- 下游取消立即 abort 上游；pull 驱动背压，keepalive comment 在有空间时才输出。
- 不把上游私有 frame/凭据原样透传，也不启动对外监听服务器。

### Task 4: 验证与交付

- 保存真实只读 Watch 握手/帧类型脱敏报告，只订阅已有 Webhook 测试员，不发送新消息。
- 验证真实 SDK listBots 的头像一致性；若可订阅历史已授权 Bot 回复，用明确 cursor 验证事件→SSE 回放，不混称新消息实时投递测试。
- 更新 README、接口文档、SDK 导出和 TypeScript 声明，提供 Web Response 路由示例。
- 跑离线测试、独立代码复核；修复重要问题。
- 根目录没有 Git 仓库，不创建 commit。

## 完成记录

四项均已完成。SDK 实际名单为 35 个 Bot，20 个显式配置、15 个按 ID 派生，全部返回统一头像。只读订阅及此前附件回复的 SDK → SSE 回放通过，新增发送 0 次。49 项离线测试、strict NodeNext 声明检查和 npm pack dry-run 通过，独立代码复核确认修复了取消、名单更新范围与非法游标问题。完整接入和能力边界见 [SDK 使用文档](../api/sdk-usage.md)。
