# 分享菜单

状态：Current。macOS 已实机验证（微信版本有差异）；Windows 不支持微信等价入口。

## 目标

微信「转发 → 其他应用」里每个接收 Bot 一行，文案 `发给 {Bot 名}`，图标是该 Bot 的头像；点这一行直接投给绑定 Bot，不再选一次。

## 为什么是 12 个固定槽

macOS 的分享扩展是**签名过的 appex**，不能运行时凭空创建。应用预先打包 12 个同程序、不同槽号的扩展：

- 第 1–12 个启用的接收 Bot 占用槽 1–12。
- 第 13 个起仍可当接收单位，用悬浮输入框 / 快捷指令 / 拖放，只是进不了这个菜单。
- 增加/删除/改名/换头像都需要重新生成宿主、重签、重新注册；只切换已有槽的启用状态可以只改显示。

决策见 [ADR 0002](../decisions/0002-share-menu-slots.md)。

## 组成

| 部分 | 路径 | 说明 |
| --- | --- | --- |
| 扩展二进制 | `native/macos/Sources/GrokBotShare` | 无网络权限；只把内容写到 ShareInbox |
| 宿主 App | `desktop/native/GrokBotMenuHost.app` → 安装到 `~/Applications/Grok Bot Anywhere Menu` | 承载 12 个 `PlugIns/GrokBotShareN.appex` |
| 绑定数据 | 宿主 `Contents/Resources/binding.json` + 每个扩展的 Info.plist | 槽号、显示名、头像、Bot id |
| 菜单模型 | `desktop/src/share/model.mjs` | `menuEntries`：哪些 Bot 占哪些槽 |
| 注册/更新 | `desktop/src/share/registration.mjs`、`reconciler.mjs`、`main/share-menu.mjs` | 写文件、签名、注册、读回、去抖 |
| 图标 | `desktop/src/main/menu-icons.mjs` | 渲染该 Bot 头像帧为 44/150 PNG |

## 运行时路径

```text
设置里启用 Bot / 改顺序 / 改名 / 换头像
  → 主进程收集 state（shareMenu.request）
  → MenuReconciler 去抖、串行
  → 写宿主槽位文件（binding.json、Info.plist、图标）
  → codesign（ad-hoc 开发 / Developer ID 打包）
  → 向系统重新注册 appex
  → 读回校验；失败保留“更新转发菜单”按钮重试
```

- 账号切换会立即吊销旧绑定，旧 generation 的安装请求作废。
- 设置里的「重新同步」是**强制重建**：即使应用认为菜单已是最新，也会重新生成宿主、重签并注册；微信仍显示旧菜单时先点它。
- 更新过程中状态再次变化（例如切账号、连续改顺序）不会丢掉请求：安装器会让位给最新状态并重试，而不是直接报错。
- 同名 Bot 靠头像区分；名字过长由系统截断。
- 更新后必须重新打开微信的转发菜单；微信会缓存旧菜单，必要时退出微信重开。手动「重新同步」会强制重建，适合应用显示已同步但微信仍是旧名字/旧顺序的情况。

## ShareInbox 契约

扩展没有网络权限，只写本地：

```text
ShareInbox/
  Ready/<batchId>/manifest.json + files…
  Staging/
  Imported/<batchId>/
  Rejected/<batchId>/failure.txt
```

manifest v1 字段：`version,id,source=wechat,accountId,botId,mode,prefix,text,title,createdAt,files[{relativePath,name}]`。服务进程校验后才导入；账号不匹配的批次留在 Ready，不跨账号投递。

## 失败与回滚

| 情况 | 行为 |
| --- | --- |
| 槽位文件写一半 | 原子写（temp + rename）；旧状态保留 |
| 签名失败 | 不注册，保留上次可用宿主，UI 显示错误 |
| 系统注册成功但读回不一致 | 重试有限次；仍失败提示用户“更新转发菜单” |
| 微信缓存旧菜单 | 重新打开微信转发菜单或重启微信 |
| 卸载 | 删除 `~/Applications/Grok Bot Anywhere Menu` 与注册；不删用户收件数据 |

## Windows

Windows 微信没有等价的 share-extension 宿主。当前支持：

- Explorer 右键级联（`HKCU\Software\Classes\*\shell\GrokBotAnywhere`）。
- 拖 ZIP/文件到 Bot 卡片。
- 悬浮输入框。

「共享对象 / 每个 Bot 一行」仍是研究项：本地验证包在 `projects/windows-share/`（默认不入库），未在 Windows 实机运行。

## 排障

- 失败详情写入 `userData/ShareInbox/menu-update.log`（只含错误码、堆栈和命令 stderr，不含凭据）。
- 宿主当前版本：`plutil -extract CFBundleVersion raw "$HOME/Applications/Grok Bot Anywhere Menu/Contents/Helpers/Destination01.app/Contents/Info.plist"`。
- 已注册的分享扩展：`pluginkit -m -p com.apple.share-services | grep grokbotanywhere`。
- 重建后仍不生效：完全退出微信再打开；微信会缓存分享扩展列表。

## 验证

```sh
npm run test:desktop
npm test                       # menu model / order / reconciler / registration / handoff
npm run build:share            # 重建宿主与 12 个 appex（macOS）
npm run smoke:native           # 原生伴侣，不覆盖真实微信
```

实机验收需要：开启 2+ 个接收 Bot → 更新菜单 → 退出微信 → 重开 → 转发一个 ZIP → 检查收件页和 Bot 回复。此流程在 macOS 上已人工跑过；微信版本差异仍可能影响菜单位置/缓存。

## 相关

- [ShareInbox 导入](delivery-service.md#分享收件箱)
- [macOS 平台](../platforms/macos.md)
- [打包与签名](packaging.md)
