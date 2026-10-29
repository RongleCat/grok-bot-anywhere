# Grok Bot Client Protocol MVP Implementation Plan

**Goal:** 独立验证本机Grok Bot客户端的登录授权、账号信息、Broker连接发现与Bot名单；输出脱敏结果与接口目录。

**Architecture:** Node 22标准库命令行工具，不依赖此前两个SDK。静态提取器只读app.asar中的service/schema元数据；live工具读取用户授权的现有登录凭据，或执行新的浏览器PKCE登录，直接发送Connect JSON与gateway HTTP。

**Tech Stack:** Node.js crypto/fs/fetch/child_process、node:test；无第三方runtime依赖。

## Tasks

1. 创建`client-mvp/test/core.test.mjs`，先验证PKCE、凭据解密、脱敏、端点限制、假transport全链路的失败测试。
2. 创建`client-mvp/core.mjs`，实现安全解析与受限请求；默认不联网，live命令显式选择。
3. 创建`client-mvp/extract.mjs`，从本机bundle提取service methods、request/response schema、gateway声明；输出文档与JSON元数据，不复制完整闭源代码。
4. 创建`client-mvp/cli.mjs`，支持`inventory`、`verify --desktop`与`login`。禁止任意RPC/写操作；Broker默认wake:false。
5. 在本机验证已登录账号→GetMe→EnsureSandBox不唤醒→health/listAgents。接口成功、失败和未测分别记录。
6. 验证浏览器登录授权流程；如需用户完成浏览器步骤则继续独立文档工作，保存“待用户完成”状态，不伪装登录成功。
7. 输出`docs/api/grok-bot-client-api.md`及完整静态RPC目录，记录来源版本、调用证据、错误、生命周期边界和下一阶段关卡。

## Validation

- `node --test client-mvp/test/*.test.mjs`。
- 无凭据fixture确保输出不含token、query、账号原文或messagePreview。
- 请求禁止重定向；身份凭据仅发往已确认Cursor API，gateway凭据仅发往Broker给出的可信HTTPS电脑origin。
- 不调用send/create/delete/reset/recreate，不修改官方客户端凭据、不刷新其共享refresh token。
- live报告只包含阶段状态、HTTP/code、字段是否存在和Bot数量。浏览器登录取得的新凭据独立保存，默认仅进程内使用。
