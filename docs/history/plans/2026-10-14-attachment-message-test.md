# 附件消息发送验收 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用已验证账号授权，向唯一名称匹配的 Webhook 测试员发送用户指定 Markdown 附件，并检查 Bot 是否实际读取。

**Architecture:** 复用现有协议/认证，提取本机认证为 adapter。名单锁定收件者，BeginGrokBotAttachmentUpload→signed PUT→Complete→SendGrokBotUserMessage；固定 nonce，发送只一次，模糊失败查 GetGrokBotSendStatus。以发送前 transcript seq 为界检查新回复。用户已明确授权本文件上传及向该 Bot 发送消息。

**Tech Stack:** Node built-ins，现有 client-protocol JSON RPC；不依赖两个 SDK。

---

### Task 1: 验证上传与发送的边界

- Create: packages/client-protocol/test/attachment.test.mjs
- Create: packages/client-protocol/attachment.mjs
- 先写失败测试：名称唯一匹配、上传成功才发送、独立上传请求不带账号 token、发送失败不自动重发。
- 运行 node --test packages/client-protocol/test/attachment.test.mjs，确认因功能缺失失败。
- 实现云端单 PUT 上传（文件仅 30782 bytes，不需要 multipart），上传域名/HTTPS/headers 校验，commit alias 后发送。unsupported mode 停止，不盲目切换 gateway。
- 重跑全部离线测试。

### Task 2: 使用当前授权实际验收

- Create: packages/client-protocol/desktop.mjs（从 CLI 提取已有本机凭据 adapter）
- Modify: packages/client-protocol/cli.mjs 复用 adapter，不改变原有 verify/login 行为。
- Create: packages/client-protocol/attachment-cli.mjs
- 文件绝对路径从命令行传入，复用桌面当前 account access token，内存使用，不刷新共享 refresh token。
- 读取目标名单唯一匹配并记录发送前 seq；上传原文件，消息让 Bot 返回标题、字节数、SHA256、章节和概要，不把预期哈希告诉它。
- 发送只一次。保存状态/nonce/文件摘要的验收报告，不保存凭据/上传 token/签名 URL。
- 间隔轮询新回复，核对 hash/文件标题/内容摘要；若 Bot 仍运行明确报告阶段，继续读取而不重复发消息。

### Task 3: 交付实测结果

- 更新 docs/reference/api/grok-bot-client-api.md，区分新实测上传/发送与原静态清单。
- 记录 Bot 回复和核验结论，报告中不包含旧聊天或账号凭据。
- 无根 Git 仓库，因此本任务不创建 commit。
