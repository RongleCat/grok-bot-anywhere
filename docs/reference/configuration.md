# 数据位置与配置

状态：Current。所有路径以 Electron `app.getPath('userData')` 为根。

## 目录

| 路径 | 内容 | 可删？ |
| --- | --- | --- |
| `inbox/inbox.sqlite` (+ `-wal`, `-shm`) | receipts、recipients、preferences | 删 = 丢收件历史；先备份 |
| `inbox/files/<receiptId>/` | 该条收件的附件副本（0600） | 随 receipt 清理 |
| `ShareInbox/Ready|Staging|Imported|Rejected/` | 分享扩展投递批次 | `Imported` 可清；`Ready` 未导入不要删 |
| `ShareInbox/Save/Ready|Staging|Saved|Failed/` | 微信「保存到本地」批次 | `Saved` 可清；`Ready` 未保存不要删 |
| `accounts/<id>.enc` | 每个账号一份 safeStorage 加密凭据 | 删 = 退出该账号 |
| `local-api.sock` / `local-api.token` | `gba` 本地 socket 与一次性 token | 应用退出后 socket 消失；token 可删，重启重生成 |
| `save-prefs.json` | 保存到本地开关、默认位置、上次目录 | 可删，回默认 |
| `cli/` | `grok-bot` 的明文凭据副本与 profile | 关开关/退出登录会自动删 |
| `composer-prefs.json` | 发送后保留、点击外部收起 | 可删，回默认 |
| `cli-enabled.json` | 命令行开关 | 可删 |
| `explorer-menu.json` | Windows Explorer 菜单开关 | 可删 |
| `login-item.json` | 登录项偏好 | 可删 |
| `touchbar.json` | Touch Bar pin | 可删 |
| `share menu state`（应用内部） | 宿主路径、槽位、generation | 不要手改；用设置里的更新 |
| `logs/explorer-forward.log` | Windows 拒绝记录（脱敏） | 可删 |
| `ShareInbox/menu-update.log` | 分享菜单更新失败的错误码/堆栈/命令 stderr | 可删；报障时附上 |
| `artifacts/`（开发） | smoke 截图 | 可删 |

macOS 根：`~/Library/Application Support/Grok Bot Anywhere/`
Windows 根：`%APPDATA%\Grok Bot Anywhere\`
预览模式：系统临时目录，退出即删。

## 凭据

| 凭据 | 位置 | 说明 |
| --- | --- | --- |
| 应用登录 | Electron `safeStorage`（macOS 落在 Keychain），每个账号一个 `accounts/<id>.enc` | 无明文回退；旧 `account.enc` 迁移后删除 |
| 旧 CLI 目录 | `userData/cli` | 旧版本遗留；开关启用/关闭时清理，`gba` 不使用 |
| 本机 Grok Bot 登录 | 系统 Keychain，`Grok Bot Safe Storage` | 只在用户主动点“使用本机登录”时读 |
| 分享扩展 / 保存扩展 | 无 | 扩展无网络权限，只写本地文件 |

## 不要做

- 不要手工编辑 `inbox.sqlite`；要迁移就写脚本并备份。
- 不要把 `userData` 整个提交/打包。
- 不要在测试里指向真实 `userData`；用 `--preview` 或临时目录。
- 不要在日志/报告里写 token、cookie、聊天正文、私有 Bot id。

## 备份与恢复

1. 退出应用（托盘 → 退出）。
2. 复制整个 `userData/inbox/`、`ShareInbox/` 与 `accounts/`。
3. 恢复时放回同一路径，权限保持 `0700`/`0600`。
4. 启动后检查收件页；`phase=sending` 的条目会被标为 `unconfirmed`，这是预期。

## 相关

- [投递服务](../subsystems/delivery-service.md)
- [收件状态](receipts.md)
