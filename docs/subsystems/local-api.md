# 本地 API 与 gba CLI

状态：Current。2026-11-13 代码完成；在 preview 构建上用本机 socket 实测了读接口、`inbox.create` 和 `gba` 命令。**真实多账号、正式打包、Windows 实机未验证。**

## 目标

让外部命令和 Agent 复用 GBA 已经拥有的多账号、Bot、发送队列和收件库，而不是再复制一份静态凭据。

## 架构

```text
gba CLI（薄客户端）
  → userData/local-api.sock（JSON Lines + token）
  → GBA 主进程 Local API（方法白名单）
  → 现有 RpcClient
  → utilityProcess AccountManager
```

Local API **不直接读写 SQLite**，不直接发送，也不向 CLI 返回 accessToken。账号、Bot、receipt 和发送仍然由服务进程持有。

## 通道与权限

| 平台 | socket | token |
| --- | --- | --- |
| macOS/Linux | `userData/local-api.sock`（目录 `0700`，socket `0600`） | `userData/local-api.token`（`0600`） |
| Windows | `\\.\pipe\grok-bot-anywhere-<userData hash>` | `userData/local-api.token` |

- 每次应用启动生成新的 32 字节 token；CLI 从 token 文件读取，不把 token 写进 skill 或 shell 历史。
- 请求格式：一行 JSON `{id,method,params,token}`；响应一行 JSON `{id,result}` 或 `{id,error:{code}}`。
- 只监听本机；没有 HTTP 端口，也没有远程访问。
- 应用退出时删除 socket；CLI 连接失败返回 `APP_NOT_RUNNING`。

## 方法

读取：

`app.status`、`api.methods`、`accounts.list`、`accounts.get`、`bots.list`、`bots.get`、`recipients.list`、`recipients.get`、`inbox.list`、`inbox.get`、`runtime.status`、`share.status`、`settings.get`。

写入：

`accounts.add/refresh/check/uncheck/remove`、`bots.duplicate/updateAvatar`、`recipients.configure`、`inbox.create/submit/retry/resolve/dismiss`、`messages.send/wait`、`share.update/order`、`settings.theme/composer/openAtLogin/touchBar/shortcut/save/cli`、`app.show`。

`messages.send` 的 `mode`：

- `compose`：只创建 receipt；
- `now`（默认）：创建 receipt 后立即提交；
- `direct`：按 Bot 的 direct 配置接收，来源开关仍生效。

`inbox.resolve` 只解除 `unconfirmed` 持锁，不重发；`messages.wait` 只轮询状态。

## gba CLI

设置里的「命令行」开关安装：

- `gba`：本地 API 薄客户端，多账号；
- `grok-bot`：`gba` 的别名，参数完全相同。

`gba` 的 launcher 只设置 `ELECTRON_RUN_AS_NODE=1`、`GBA_SOCKET`、`GBA_TOKEN_FILE`，不写凭据。

常用命令：

```sh
gba status --json
gba accounts list --json
gba bots list --json
gba send --account <id> --bot <id> --text "..." --json
gba inbox list --json
gba api api.methods --json
```

完整命令见随包 skill 的 `references/local-api.md`。

## 安全边界

- 调用方必须持有当前进程的 token；socket 权限只允许当前用户。
- Local API 是显式白名单，不暴露主进程 `dispatch` 的全部方法，也不暴露窗口/文件选择器/凭据。
- 发送是真实对外发言；`gba send` 默认立即提交，`--compose` 只起草。Agent 调用前要确认目标和内容。
- 不自动重发：`unconfirmed` 只返回状态，等待用户在 GBA 里 `resolve`。
- 不把收件附件路径当作远程 URL；附件只能是本机路径。

## 限制

- 应用必须正在运行；CLI 目前不会自动拉起应用。
- Windows named pipe、正式签名包和真实双账号尚未实机验证。
- 旧 `grok-bot` 的 0.3.0 静态实现、`profiles/default.json` 和 `accounts.json` 已移除；`grok-bot` 只是 `gba` 的别名。
- 没有 MCP；`gba` 是当前唯一的本地 Agent 接口。

## 验证

```sh
cd desktop
npm test                 # 包含 local-api / gba-cli / cli-bridge
```

preview 实测：

- `app.status`、`accounts.list`、`bots.list`、`recipients.list`、`inbox.list`、`settings.get`、`share.status`、`api.methods` 返回正常；
- `gba status/accounts list/bots list/api` 通过 socket 返回；
- `gba send --compose` 创建 receipt，`gba inbox list` 能读回。

## 相关

- [桌面外壳](desktop-shell.md)
- [投递服务](delivery-service.md)
- [命令行](../reference/cli.md)
- [数据位置](../reference/configuration.md)
