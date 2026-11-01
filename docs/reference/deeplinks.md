# URL 协议

状态：Current。协议名：`grokbotanywhere:`。

## 路由

| 链接 | 行为 |
| --- | --- |
| `grokbotanywhere://open` | 显示主窗口 |
| `grokbotanywhere://compose?bot=<id>` | 打开该 Bot 的悬浮输入框（无预填） |
| `grokbotanywhere://compose?bot=<id>&text=<text>` | 同上，满足条件时预填 |
| `grokbotanywhere://send?bot=<id>&text=<text>` | 打开输入框并预填；**不会自动发送** |

省略 `bot` 时使用托盘「打开输入框」的同一个默认 Bot。

## 预填条件

`compose?text` 与 `send` 同时要求：

1. 已有登录账号。
2. Bot 在该账号名单里。
3. 该 Bot 的接收转发已开启，且 **Shortcuts** 来源已开启。

不满足时只提示，不写入输入框。`compose` 不带 `text` 不检查来源开关——它等价于托盘打开输入框。

## 安全

- 链接里永远不放 token、cookie、账号 id。
- 即使 Bot 是 `direct` 模式，深链也不自动发送；需要 `grok-bot` 命令才可无确认提交。
- 冷启动从链接进入时保持后台，不先弹主窗口。
- 未识别的 URL / 参数：忽略并提示，不抛未捕获错误。

## 平台

- macOS：Shortcuts 的「打开 URL」、`open "grokbotanywhere://..."`。
- Windows：`start "" "grokbotanywhere://open"`；协议在安装/首次运行时注册。
- Linux：未支持。

## 个人 Bot 链接清单

真实的 Bot id 清单只保存在本地 `local/deeplinks.md`（已 gitignore），不进入仓库。需要时按 `grokbot://app/v1/agent?id=<uuid>` 生成官方客户端链接；本应用的深链用 `bot=<uuid>`。

## 相关

- [桌面外壳](../subsystems/desktop-shell.md)
- [CLI](cli.md)
