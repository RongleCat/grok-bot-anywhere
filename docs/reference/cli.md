# 命令行（grok-bot）

状态：Current。命令由应用安装，不随 npm 发布。

## 安装

设置 → 工具箱 → 命令行 → 打开开关后：

| 平台 | 写入 |
| --- | --- |
| macOS | `~/.local/bin/grok-bot`（或用户目录下的 shim）+ 应用 userData 下的 skill |
| Windows | `grok-bot.cmd` + `grok-bot.ps1`，并把目录追加到用户 Path |

命令指向随包的 `grok-bot.mjs`（版本 0.3.0，协议目标 0.78.1），运行时用应用自带的 Node/Electron `ELECTRON_RUN_AS_NODE`，不下载 Node/Bun。

已存在且不是本应用安装的命令/skill 不会被覆盖，返回 `CLI_COMMAND_EXISTS`。

## 凭据

为了在 Electron 外运行，命令使用一份**单独的明文副本**：

- macOS：`~/Library/Application Support/Grok Bot Anywhere/cli`
- Windows：`%LOCALAPPDATA%\Grok Bot Anywhere\cli`

退出登录、关闭开关、token 失效时删除。应用自身的登录仍在 safeStorage/Keychain。

## 常用

```sh
grok-bot --version
grok-bot accounts list --json
grok-bot status --json
grok-bot send --bot "<名称或 id>" --text "..." --json
```

Agent 调用时始终加 `--json`，按退出码分支，日志/进度看 stderr。完整旗标、JSON 键、错误码见随包 skill 的 `references/commands.md`。

## 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 2 | 未登录 / 凭据失效 / 需要用户操作 |
| 3 | 用法错误、运行时缺失/过旧 |
| 4 | 网络错误 |

## 边界

- 命令以用户身份对外发言；发送前确认目标与内容。
- 不打印凭据目录或文件内容。
- 应用被删除/移动后，launcher 返回 `CLI_RUNTIME_MISSING`，提示重新打开应用并开启命令行。
- Linux 未支持。

## 相关

- [桌面外壳](../subsystems/desktop-shell.md)
- [URL 协议](deeplinks.md)
- 随包 skill：`desktop/resources/grok-bot-skill/grok-bot/`
