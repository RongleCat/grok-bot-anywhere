# 分享菜单

状态：Current。macOS 每 Bot 一个 appex，Windows 单入口 + 应用内选择。保存到本地与多账号菜单为 2026-11-12 代码完成，**未在真实微信/真实多账号上验证**；其余原有路径保持已实机验证。

## 目标

微信「转发 → 其他应用」里每个接收 Bot 一行，文案 `发给 {Bot 名}`，图标是该 Bot 的头像；点这一行直接投给绑定 Bot，不再选一次。

## 为什么是 12 个固定槽

macOS 的分享扩展是**签名过的 appex**，不能运行时凭空创建。应用预先打包 12 个同程序、不同槽号的扩展，再预打包 1 个独立的「保存到本地」扩展：

- 第 1–12 个启用的接收 Bot 占用槽 1–12；开启「保存到本地」后 Bot 槽上限降为 11，保存项占第 12 行。
- 第 13 个起仍可当接收单位，用悬浮输入框 / 快捷指令 / 拖放，只是进不了这个菜单。
- 多账号时，所有**勾选**账号的 Bot 一起排序：先按账号顺序，再按账号内的菜单顺序；条目带 `accountId`。
- 菜单图标只展示 Bot 头像，不带主 Bot 星标或其他应用内标记，并保留透明背景；主 Bot 状态变化不重建菜单。
- 增加/删除/改名/换头像都需要重新生成宿主、重签、重新注册；只切换已有槽的启用状态可以只改显示。
- 宿主布局从 v4 升到 **v5**：每个 `DestinationNN.app` 仍承载一个 Bot appex，另加 `DestinationSave.app` + `GrokBotSave.appex`；保存扩展默认随宿主生成，但只有设置开启时才 `pluginkit -e use`。
- `configuration.json` 从 v1 升到 **v2**：保留 `accountId` 兼容单账号，新增 `accounts: [id...]` 和 `saveToLocal`；Bot 扩展用 `accounts` 校验 binding 的账号。

决策见 [ADR 0002](../decisions/0002-share-menu-slots.md)。

## 组成

| 部分 | 路径 | 说明 |
| --- | --- | --- |
| 扩展二进制 | `native/macos/Sources/GrokBotShare` | 无网络权限；只把内容写到 ShareInbox |
| 宿主 App | `desktop/native/GrokBotMenuHost.app` → 安装到 `~/Applications/Grok Bot Anywhere Menu` | 承载 12 个 Bot appex + 1 个保存 appex |
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

**Finder 的右键共享菜单是另一层缓存。** `pluginkit` 和 `NSSharingService` 已经返回新名字时，Finder 仍可能显示旧入口，直到 Finder 进程重启。应用在菜单更新成功后会自动重启 Finder；启动时如果发现 Finder 早于 `menu-state.json`，也会刷新一次。仍异常时可手动 `killall Finder`。

## 保存到本地（macOS）

设置 → 分享菜单 → **保存到本地** 打开后，微信分享菜单多一行「保存到本地」。它只处理微信转发，不创建 receipt、不进入发送记录、不投递 Bot。

```text
微信分享 → 保存扩展
  → 检查前台 App 是 com.tencent.xinWeChat（含多开编号）
  → 检查 configuration.json 的 saveToLocal=true
  → 附件写入 ShareInbox/Save/Staging/<id>，manifest 落地后移到 Save/Ready/<id>
  → MenuHost 拉起主应用（--share-intake）
主应用 SaveInbox
  → 校验 manifest、路径、符号链接、文件数量
  → default：写设置里的默认位置
    choose：打开目录选择器（默认上次目录），选完记住
  → 成功删除批次并通知；取消删除批次；失败移到 Save/Failed 并保留内容
```

规则：

- 默认位置默认 `~/Downloads/Grok Bot Anywhere`，可在设置里更改；目录不可写时提示后打开选择器。
- 单个文件直接保存；多个文件放进时间戳子目录；纯文字存 `.txt`；同名文件加 ` (2)`，不覆盖。
- macOS **没有公开 API 告诉分享扩展宿主是谁**，只能用前台 App 的 bundle id 做启发式判断（[openradar 48001368](https://github.com/lionheart/openradar-mirror/issues/20997)）。因此保存扩展是系统级注册的，Finder 里也可能显示；点击时会被拒绝。要完全从 Finder 隐藏，需要按前台 App 动态 `pluginkit` 启停，当前未做。

## ShareInbox 契约

扩展没有网络权限，只写本地：

```text
ShareInbox/
  Preparing/<batchId>.json
  Ready/<batchId>/manifest.json + files…
  Staging/
  Imported/<batchId>/
  Rejected/<batchId>/failure.txt
  Save/Staging/<batchId>/
  Save/Ready/<batchId>/manifest.json + files…
  Save/Saved/<batchId>/
  Save/Failed/<batchId>/failure.txt
```

扩展在复制附件前先写 `Preparing/<id>.json`（账号、Bot、模式、创建时间），主进程可以据此先打开输入框；manifest 落地 `Ready` 后再把附件补进同一个草稿。复制失败时扩展删除这个 marker。

manifest v1 字段：`version,id,source=wechat,accountId,botId,mode,prefix,text,title,createdAt,files[{relativePath,name}]`。服务进程校验后才导入；账号不匹配的批次留在 Ready，不跨账号投递。

扩展先处理 `file-url`；其余内容优先试 provider 声明的具体 UTType，再试 ZIP/影片/图片，最后用 `public.data` 兜底；只有当 provider 没有文件表示时才把纯文本当正文。这样 Word 等文档和不同微信版本提供的聊天记录不会只因为不在旧白名单里被丢掉；临时文件没有扩展名时从 UTType 补回（例如 `.docx`）。

## 失败与回滚

| 情况 | 行为 |
| --- | --- |
| 槽位文件写一半 | 原子写（temp + rename）；旧状态保留 |
| 签名失败 | 不注册，保留上次可用宿主，UI 显示错误 |
| 系统注册成功但读回不一致 | 重试有限次；仍失败提示用户“更新转发菜单” |
| 启动/切账号的过渡态 | `accountBusy` 时不写空的 `configuration.json`，保留已安装菜单；同步按钮禁用，避免手动同步把菜单清空 |
| direct 转发失败/过期/未确认 | 内容留在发送记录，并发系统通知；不会静默吞掉 |
| 微信缓存旧菜单 | 重新打开微信转发菜单或重启微信 |
| 保存失败 | 批次移到 `ShareInbox/Save/Failed`，保留文件并通知；不创建 receipt |
| 保存取消 | 删除该批次，不报错 |
| 卸载 | 删除 `~/Applications/Grok Bot Anywhere Menu` 与注册；不删用户收件数据 |

## Windows

Windows 微信没有 share-extension 宿主，所以**不是每个 Bot 一行**：只有一个 `Grok Bot` 条目，点开后由应用内的 Bot 选择面板决定目标。

| 环节 | 实现 |
| --- | --- |
| 注册 | 稀疏 MSIX 声明 `windows.shareTarget`（`SupportsAnyFileType` + `StorageItems`/`Text`/`URI`/`Bitmap`） |
| 接收 | `native/windows/share-target`（C++/WinRT）读 `ShareOperation`，文件落盘到 `share-pending/<batch>` |
| 唤起 | `grokbotanywhere://share?batch=<id>`，深链只带批次、不带 Bot |
| 选择 | `share-picker` 无标题栏面板：只列开启了接收转发的 Bot（Windows 不区分来源） |
| 投递 | 按 Bot 模式分流：`compose` 交给悬浮输入框，`direct` 直接发送；Esc 取消会删除该批次 |

要点：Windows 上「来源」开关不参与过滤（只有一个入口），因此设置页在 Windows 隐藏「来源」一行；macOS 仍按来源过滤并保持 12 行（保存开启时 11 个 Bot + 1 个保存项）。详见 [Windows](../platforms/windows.md#微信分享)。

## 微信里显示禁止符号

macOS 可能把新生成的 share extension 设为未启用，WeChat 会显示带禁止符号的入口。应用启动时会对已安装的每个槽位重新执行 `pluginkit -a` + `pluginkit -e use`；如果仍然灰色，退出并重开微信（微信会缓存分享列表）。手动修复单个槽位时可用：

```sh
pluginkit -a "$HOME/Applications/Grok Bot Anywhere Menu/Contents/Helpers/Destination02.app/Contents/PlugIns/GrokBotShare.appex"
pluginkit -e use -i dev.ronglecat.grokbotanywhere.menu.destination02.g2.share
```

## 排障

- 设置 → 分享菜单 → **复制报错日志**：复制应用与 Electron 版本、菜单状态、宿主 build、`configuration.json`/`menu-state.json` 摘要、最近一次更新错误。可能包含本机路径，不包含登录凭据。
- 失败详情写入 `userData/ShareInbox/menu-update.log`（只含错误码、堆栈和命令 stderr，不含凭据）。
- 宿主当前版本：`plutil -extract CFBundleVersion raw "$HOME/Applications/Grok Bot Anywhere Menu/Contents/Helpers/Destination01.app/Contents/Info.plist"`。
- 已注册的分享扩展：`pluginkit -m -p com.apple.share-services | grep grokbotanywhere`。
- 重建后仍不生效：完全退出微信再打开；微信会缓存分享扩展列表。

## 验证

```sh
npm run test:desktop
npm test                       # menu model / order / reconciler / registration / handoff
npm run build:share            # 重建宿主、12 个 Bot appex 与保存 appex（macOS）
npm run smoke:native           # 原生伴侣，不覆盖真实微信
```

实机验收需要：开启 2+ 个接收 Bot → 更新菜单 → 退出微信 → 重开 → 转发一个 ZIP → 检查收件页和 Bot 回复。此流程在 macOS 上已人工跑过；微信版本差异仍可能影响菜单位置/缓存。

保存到本地另需：开启开关 → 重新同步 → 完全退出微信重开 → 分别测默认位置/每次选择/取消/同名冲突；再在 Finder 共享里确认保存项不执行。**本轮未在真实微信/Finder 上验证保存项的位置和来源判断**，只验证了宿主构建、签名与代码路径。

## 相关

- [ShareInbox 导入](delivery-service.md#分享收件箱)
- [macOS 平台](../platforms/macos.md)
- [打包与签名](packaging.md)
