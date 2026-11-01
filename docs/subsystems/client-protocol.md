# Client Protocol SDK（packages/client-protocol）

状态：Current，但**非官方、实验性**。不要把它当成 xAI 支持的公开 API。

## 这是什么

从本机 Grok Bot 0.70.2 客户端复现的协议 SDK 与验证 CLI：

- 零 npm 依赖，Node >=22.13。
- 浏览器 PKCE 登录、读取账号、云端/gateway Bot 名单。
- 统一头像推导（显式参数优先，缺失按 Bot UUID 派生）。
- `sendMessage`、`watchBot()` AsyncGenerator、`botEventsSSE()` 标准 `Response`。
- 附件上传（单 PUT）与发送验收 CLI。
- 静态提取 484 个 RPC / 167 个 gateway 声明，用于调研，不代表都可用。

## 入口

| 文件 | 作用 |
| --- | --- |
| `sdk.mjs` / `sdk.d.mts` | `GrokBotClient`：getMe、listBots、sendMessage、watchBot、botEventsSSE |
| `avatar.mjs` | `deriveDefaultAvatar`、`resolveAgentAvatar` |
| `desktop.mjs` | 从本机 Grok Bot / Keychain 读取已有登录（仅 macOS） |
| `app-bridge.mjs` + `app-session.mjs` | Swift 独立模式的 NDJSON 桥 |
| `cli.mjs` | `login` / `verify` / `inventory` |
| `attachment-cli.mjs` | `--send` / `--observe` 附件验收 |
| `extract.mjs` | 从 ASAR 静态提取接口目录（只读文本，不执行客户端） |
| `test/` | 协议、头像、SSE、附件、桥接测试 |

## 常用命令

```sh
# 在仓库根目录
node packages/client-protocol/cli.mjs login --cloud-only
node packages/client-protocol/cli.mjs verify --desktop --cloud-only
node packages/client-protocol/cli.mjs inventory
node --test packages/client-protocol/test/*.test.mjs

# 或在包内
cd packages/client-protocol && npm test
```

`login` 打开系统浏览器并轮询授权；`--no-open` 只打印 URL。`--desktop` 通过系统 Keychain 读取 `Grok Bot Safe Storage`，在内存解密 active account。凭据只在进程内存中存在，退出即丢，不刷新、不写回官方客户端。

## 能力与边界

| 能力 | 状态 |
| --- | --- |
| 浏览器登录 → GetMe → ListGrokBotAgents | 已验证（37 条，无截断） |
| 本机已有登录读取名单 | 已验证 |
| 统一头像 | 已验证（35 条全部有头像） |
| 发送（稳定 messageId） | 已验证附件路径；不自动重投 |
| Connect → SSE | 已验证回放；完整文本 upsert，不保证逐 token |
| 附件上传 | 小文件单 PUT；无 multipart；4MiB 为验收上限 |
| refresh token 持久化 | 未实现 |
| 自动重连 / 自动 refresh | 不做 |
| 任意 RPC 调用 | CLI 禁止；只走已实现方法 |

**回复不是按请求关联的**：SDK 暴露的是 Bot/session 消息流。应用把新事件挂到最近一条发送 receipt，并过滤 replay；不要承诺“这条回复对应那次发送”。

## 安全

- 不打印 token、邮箱、Bot 名称/ID、头像 URL、聊天正文；报告只留数量、状态码、字段存在性。
- `verify --report` 按 `0600` 创建脱敏报告。
- `--desktop` 读取 Keychain 时交给系统授权，不绕过权限。
- `attachment-cli --send` 有已存在报告时拒绝再次发送；只有 `sendAttempted=false` 才允许 `--resume-unsent`。

## 与产品的关系

- Electron 应用**不**导入这个包；它使用 npm 的 `grok-bot-sdk`。两者是独立实现。
- Swift 独立模式通过 `app-bridge.mjs` 使用它；Electron 模式下原生伴侣不经桥、不读凭据。
- 修改这里不会自动改变 Electron 行为；反之亦然。

## 验证

```sh
node --test packages/client-protocol/test/*.test.mjs
```

真实账号验收会写报告到 `docs/reference/api/`。最近一次的真实发送/回复证据是历史报告，不要当作当前构建的回归结果。

## 相关

- [CLI 参考](../reference/cli.md)
- [API 文档](../reference/api/grok-bot-client-api.md)
- [历史计划](../history/plans/2026-10-14-client-protocol-mvp.md)
