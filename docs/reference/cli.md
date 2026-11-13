# 命令行（gba / grok-bot 别名）

状态：Current。命令由应用安装，不随 npm 发布。`gba` 是唯一 CLI 实现；`grok-bot` 是它的别名。

## 安装

设置 → 工具箱 → 命令行 → 打开开关后：

| 平台 | 写入 |
| --- | --- |
| macOS | `~/.local/bin/gba` 与 `~/.local/bin/grok-bot`（同一 gba 实现）+ 应用 userData 下的 skill |
| Windows | `gba.cmd` 与 `grok-bot.cmd`，并把目录追加到用户 Path |

两个命令参数完全相同。交互式 zsh 里 `gba` 可能是 `git branch --all` 的别名；此时用 `grok-bot` 或 `command gba`。launcher 只设置：

```text
ELECTRON_RUN_AS_NODE=1
GBA_SOCKET=<userData>/local-api.sock（Windows 为 named pipe）
GBA_TOKEN_FILE=<userData>/local-api.token
```

运行时用应用自带的 Node/Electron；不下载 Node/Bun，也不写 `profiles/default.json` 或 `accounts.json`。

## 凭据

`gba` **不保存明文凭据**。所有调用都通过本机 socket 进入运行中的 GBA，由服务进程的 `AccountManager` 持有账号和发送状态。详见[本地 API](../subsystems/local-api.md)。

启用/关闭命令行时会清理旧版本留下的 `userData/cli/profiles/` 与 `accounts.json`。

## 常用

```sh
gba --version
gba status --json
gba accounts list --json
gba bots list --json
gba send --account <id> --bot <id> --text "..." --json
gba inbox list --json
```

Agent 调用时始终加 `--json`，按退出码分支，日志/进度看 stderr。完整命令见随包 skill 的 `references/local-api.md`。

## 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 2 | API 错误 / 未登录 / 需要用户操作 |
| 3 | 用法错误、运行时缺失 |
| 4 | GBA 没运行 |
| 5 | 本地 API 等待超时 |

## 边界

- 应用必须正在运行；`gba` 不会自动拉起 GBA。
- 命令以用户身份对外发言；发送前确认目标与内容。
- 不打印 token、socket 或凭据。
- `unconfirmed` 不自动重试；等用户在 GBA 里核对。
- 应用被删除/移动后，launcher 返回 `CLI_RUNTIME_MISSING`，提示重新打开应用并开启命令行。
- Windows named pipe 与正式签名包尚未实机验证；Linux 未支持。

## 相关

- [本地 API](../subsystems/local-api.md)
- [桌面外壳](../subsystems/desktop-shell.md)
- [URL 协议](deeplinks.md)
- 随包 skill：`desktop/resources/grok-bot-skill/grok-bot/`
