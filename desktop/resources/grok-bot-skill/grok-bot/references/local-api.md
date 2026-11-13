# gba local API CLI

`gba` 是 GBA 的薄客户端。它只连接本地 socket，不保存凭据；账号和 Bot 都来自 GBA 当前状态。

## 基础

```bash
gba status --json
gba accounts list --json
gba bots list [--account <id>] --json
gba recipients list [--account <id>] --json
```

## 发送与收件

```bash
gba send --account <id> --bot <bot-id> --text "..." --json
gba send --account <id> --bot <bot-id> --text "..." --file /absolute/path --json
gba send --account <id> --bot <bot-id> --text "..." --compose --json
gba inbox create --account <id> --bot <bot-id> --text "..." --json
gba inbox list --limit 20 --json
gba inbox get <receipt-id> --json
gba inbox submit <receipt-id> --text "..." --json
gba inbox retry <receipt-id> --json
gba inbox resolve <receipt-id> --json
gba wait <receipt-id> --timeout 60 --json
```

- `--compose` 只创建 receipt，不提交；
- 默认 `send` 创建后立即提交；
- `--direct` 使用 Bot 的 direct 配置（需要来源开关）；
- `inbox resolve` 只解除 `unconfirmed` 持锁，不重发。

## 账号和设置

```bash
gba accounts check <id> --json
gba accounts uncheck <id> --json
gba accounts remove <id> --json
gba accounts refresh --json
gba bots duplicate <bot> --json
gba bots avatar <bot> --shape cloud --color brown --json
gba recipients configure <bot> '{"enabled":true,"mode":"compose"}' --json
gba share status --json
gba share update --json
gba settings get --json
```

## 通用调用

```bash
gba api accounts.list --json
gba api bots.list '{"accountId":"..."}' --json
```

可用方法：`app.status`、`app.show`、`api.methods`、`accounts.list/get/add/refresh/check/uncheck/remove`、`bots.list/get/duplicate/updateAvatar`、`recipients.list/get/configure`、`inbox.list/get/create/submit/retry/resolve/dismiss`、`messages.send/wait`、`runtime.status`、`share.status/update/order`、`settings.get/theme/composer/openAtLogin/touchBar/shortcut/save/cli`。

## 错误

- `APP_NOT_RUNNING`（exit 4）：GBA 没运行，先打开 App；
- `LOCAL_API_TIMEOUT`（exit 5）：等待超时；
- `BOT_NOT_FOUND` / `AMBIGUOUS_BOT`：先列 Bot，再显式指定；
- `RECEIPT_NOT_FOUND`：receipt id 不对或已被清理。
