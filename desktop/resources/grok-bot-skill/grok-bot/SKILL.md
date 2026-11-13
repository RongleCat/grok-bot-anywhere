---
name: grok-bot
description: >
  Use the gba command to operate the user's own Grok Bot accounts through the
  running Grok Bot Anywhere app. Trigger when the user wants to list accounts or
  bots, send a message and check a receipt, read send history, or manage
  multi-account receive settings. `grok-bot` is an alias for `gba`.
  用户想通过 GBA 查看多账号、给 Bot 发消息、查看发送记录或管理接收设置时使用。
---

# gba（Grok Bot Anywhere）

`gba` 是 GBA 的本地 API 客户端。它不保存 token，也不读取静态凭据；所有账号、Bot、发送和收件状态都来自正在运行的 GBA。

`grok-bot` 是 `gba` 的别名，两者参数完全相同。交互式 zsh 里如果 `gba` 被 Git 别名占用，优先调用 `grok-bot` 或 `command gba`。

## 先确认应用在运行

```bash
gba status --json
```

- `APP_NOT_RUNNING`（exit 4）：先打开 Grok Bot Anywhere。
- `LOCAL_API_TIMEOUT`（exit 5）：等待超时。
- 其他错误带 `error.code`；不要猜错误原因。

## 账号与 Bot

```bash
gba accounts list --json
gba bots list --json
gba bots list --account <账号id> --json
```

规则：

- 有多个账号时不要猜；先列账号，再显式传 `--account`。
- 默认使用第一个勾选且已连接的账号；账号有歧义时先问用户。
- 不改变账号勾选状态，除非用户明确要求 `accounts check/uncheck`。

## 发送

```bash
gba send --account <id> --bot <id> --text "..." --json
gba send --account <id> --bot <id> --text "..." --file /absolute/path --json
gba send --account <id> --bot <id> --text "..." --compose --json
```

- 默认创建 receipt 后立即提交；
- `--compose` 只创建草稿，不发送；
- `--direct` 使用 Bot 的 direct 配置，来源开关仍生效；
- 发送前确认目标和内容；这是以用户身份对外发言。

## 收件与等待

```bash
gba inbox list --limit 20 --json
gba inbox get <receipt-id> --json
gba inbox submit <receipt-id> --text "..." --json
gba wait <receipt-id> --timeout 60 --json
```

- `unconfirmed` 不要自动重试；告诉用户到 GBA 发送记录核对；
- `resolve` 只解除持锁，不重发；
- 不承诺“这条回复对应哪次请求”。

## 配置与更多接口

```bash
gba share status --json
gba share update --json
gba settings get --json
gba api api.methods --json
```

完整接口和方法列表见 [references/local-api.md](references/local-api.md)。

## 安全

- 不要读取或打印 `GBA_TOKEN_FILE`、socket 路径或凭据；
- 不要调用 `gba api` 去绕过上面的发送/收件规则；
- 不要自动重发 `unconfirmed`；
- 只操作本机 GBA，不做远程访问。
