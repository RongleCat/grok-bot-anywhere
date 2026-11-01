# Lessons

这个仓库已经踩过的坑，以及下次能提前拦住它的规则。改代码前读一遍；新增条目要能指向具体文件、提交或事故，不要写泛泛的建议。

格式：**规则** → 发生了什么 → 证据 → Seen N×。

## 构建与产物

**构建产物必须晚于它使用的配置和源码；发布前先比较时间。**
- 2026-11-01：Windows zip 08:00 构建，`desktop/package.json` 10:15 才加入协议注册、win 打包配置和 SDK 依赖调整；zip 与最终配置不一致。
- 规则：发布前检查“产物 mtime ≥ 所有被它包含的源文件/配置”；否则重打。产物旁边记录 commit。
- Seen 1×（2026-11-01）。

**Submodule 未初始化时，构建失败信息会指向错误的位置。**
- 2026-11-01：头像源码从 `avatar/` 移到 `native/macos/avatar/` 后，esbuild 报找不到 `../../../vendor/bloub/...`；真正原因是 `vendor/bloub` 从未 `--init`，不是路径错。
- 规则：任何依赖 submodule 的构建，先 `git submodule update --init --recursive`；README/构建页写明。
- Seen 1×（2026-11-01）。

**移动源码目录时，所有用 `#filePath`/相对层级推根目录的代码都要重算。**
- 2026-11-01：`SDKBridge.swift` 原来从 `Sources/TouchBarBotApp/` 上跳 3 层到仓库根；移到 `native/macos/` 后需要 4 层，否则开发模式找不到 `app-bridge.mjs`。
- 规则：移动后全仓 `grep` `#filePath`、`new URL('../../')`、`dirname $0/..`，逐个核对层数并跑一次真实启动。
- Seen 1×（2026-11-01）。

**嵌套签名必须由内向外，签完 `--verify --deep --strict`。**
- 2026-10-29 起：分享宿主里 12 个 appex、伴侣 App、主 App 层层嵌套；顺序错或漏签会导致注册成功但扩展不启动。
- 规则：appex → 宿主 → 主 App；每次签名后验证；公证前再验证一次。
- Seen 1×（2026-10-29）。

**开发/冒烟命令不要继承 `ELECTRON_RUN_AS_NODE=1`。**
- 2026-11-01：`npm run smoke` 报 `The requested module 'electron' does not provide an export named 'BrowserWindow'`，进程跑在 Node v24 而不是 Electron；当前 shell 带着 `ELECTRON_RUN_AS_NODE=1`。
- 规则：桌面应用用 `env -u ELECTRON_RUN_AS_NODE npm start/smoke`；只有 `grok-bot` shim 需要 Node 模式时才显式设置。
- Seen 1×（2026-11-01）。

## 平台

**Electron 第二个实例的 argv 会被 Chromium 重排，不能假设 `--flag value` 相邻。**
- 2026-10-31：`--explorer-forward --bot <id> -- "%1"` 在应用已运行时，`--bot` 后面常插入 `--allow-file-access-from-files` 等开关，旧解析器把开关当 botId，每次都误报“没有开启接收转发”。
- 规则：按参数形状解析（`--bot=...` 或跳过 `--` 开关），并用真实 `second-instance` payload 做测试。
- Seen 1×（2026-10-31，`desktop/src/shell/actions.mjs` `parseExplorerForward`）。

**Windows 上不要用 `reg query` 的输出直接写回 Path。**
- 2026-10-30 审查：`reg.exe` 重定向输出用 OEM 代码页（中文 GBK），Node 按 UTF-8 解码会得到 U+FFFD；写回会永久改坏含中文的 Path 条目。
- 规则：Path 读写走 PowerShell + UTF-8；读取失败当 unknown，不覆盖。
- Seen 1×（2026-10-30，`cli-bridge.mjs` `readWindowsPath`）。

**Explorer 选区会包含文件夹、零字节文件和虚拟项，发送前必须过滤。**
- 2026-10-30 审查：Windows 路径曾直接返回 Explorer 原始 `Path`，选中文件夹也会挂成附件；macOS 路径本来就有 `regularFiles`。
- 规则：所有平台入口统一走 `regularFiles`；不是普通文件就丢弃并提示。
- Seen 1×（2026-10-30，`main.mjs` + `selection.mjs`）。

**微信会缓存转发菜单；更新后必须重开微信。**
- 2026-10-29 起：菜单已注册但微信仍显示旧项/少项；退出微信再开才刷新。
- 规则：UI 文案写清“更新后重开微信”；排障第一步就是完全退出微信。
- Seen 多次（2026-10-29 起）。

**分享宿主必须放在普通 Applications 文件夹，不能嵌在另一个 App 里。**
- `desktop/README.md`：嵌在另一个应用内会让 macOS 返回占位图标；因此每个槽是独立 `DestinationNN.app`。
- 规则：宿主路径变更时，同时验证图标、注册、微信列表。
- Seen 1×。

## 投递

**发送结果不明确时只能暂停，不能自动重发。**
- 设计起：上传成功/服务端接受前的超时无法区分“没发”与“已发”；自动重试会重复对外发言。
- 规则：`unconfirmed` 持锁该 Bot；用户核对后 `resolve` 只解锁，不重发原 receipt。
- 见 [ADR 0003](docs/decisions/0003-no-automatic-retry.md)。

**direct 的 90 秒截止从 receipt 创建算，不是从点击发送算。**
- `delivery.mjs`：`deadline=item.createdAt+90_000`；retry 也不能把过期条目救回来。
- 规则：改投递超时前先确认起点；测试要覆盖“创建后 91 秒再提交”。
- Seen 1×。

**SDK 的回复是 Bot/session 消息流，不是按请求关联的回复。**
- 2026-10-28：SDK 只暴露完整文本 upsert；应用把新事件挂到该 session 最近一条发送中/已发送 receipt，并过滤 replay。
- 规则：不要承诺“这条回复对应那次发送”；UI 文案说“收到新回复”，不说“对刚才那条的回复”。
- Seen 1×（`docs/reference/api/sdk-usage.md`）。

## 分享菜单

**系统共享面板和宿主注册是两层缓存，不要把 Finder 的旧列表当成注册失败。**
- 2026-11-01：`pluginkit` 与 `NSSharingService.sharingServices` 已返回「赛博小晚/杂物总管」，Finder 右键 → 共享仍显示更早的「增长情报/测试 cli」；Finder 进程从 10-26 起未重启，缓存了旧的 share extension 列表。
- 规则：先看 `pluginkit -m -p com.apple.share-services` 和 live `NSSharingService`，再看 Finder/微信进程；Finder 需要重启才会重新枚举；应用现在在菜单更新和启动时自动重启 Finder。
- 证据：`desktop/src/main/main.mjs` 的 `refreshFinderMenu`；宿主 `Destination01/02` 显示名与注册 ID 对比。
- Seen 1×（2026-11-01）。

**微信菜单图标不带应用内状态标记。**
- 2026-11-01：菜单图标配置把 `mainAgentId` 传给了头像引擎，主 Bot 在微信里显示成「圆形 + 五角星」；`avatarKey` 也把主 Bot 状态算进签名 key，切换主 Bot 会无谓重建菜单。
- 规则：菜单图标只传形状/颜色/图片/group members，`main:false`；`avatarKey` 不包含主 Bot 或运行状态。
- 证据：`desktop/src/main/menu-icons.mjs`、`desktop/src/share/model.mjs`；测试断言主 Bot 状态不改变 key。
- Seen 1×（2026-11-01）。

**更新请求不能被正在进行的安装吞掉；手动「重新同步」必须是强制重建。**
- 2026-11-01：切账号或连续改顺序时，安装前的 `isCurrent` 检查会抛 `MENU_SUPERSEDED`；旧实现把它当失败，且安装期间到达的新状态请求被 `running` 吞掉，结果是红色横幅 + 微信仍是旧菜单。手动按钮只 bump revision，菜单状态被判定为最新时不会重建。
- 规则：`MENU_SUPERSEDED` / `MENU_UPDATE_BUSY` / `ACCOUNT_BUSY` 由 reconciler 重试最新状态，不显示失败；用户点「重新同步」时传 `force`，无条件重建宿主并重注册。
- 证据：`desktop/src/share/reconciler.mjs`、`desktop/src/main/share-menu.mjs`；单元测试覆盖两种重试与 force。
- Seen 1×（2026-11-01）。

## 文档与仓库


**目录/入口一变，所有文档里的路径都要在同一改动里更新。**
- 2026-11-01：根 README 仍写 `dist/TouchBarBot.app`，而 Electron 迁移后该目录已不存在；`docs/native-app.md` 等也引用旧 `client-mvp/`。
- 规则：移动/重命名后跑 `node scripts/check-docs.mjs`；它检查 catalog、链接和禁止的旧路径。
- Seen 1×（2026-11-01）。

**私有 Bot ID、账号清单不进入仓库文档。**
- 2026-11-01：`docs/grok-bot-deeplinks.md` 含 37 个真实 Bot ID，文件自己写着“不要放进公开仓库”。
- 规则：个人清单放 gitignored 的 `local/`；仓库只保留协议语法和示例。
- Seen 1×（2026-11-01）。

**测试不能碰真实用户数据；一次也不行。**
- 设计起：`userData`、Keychain、`~/.agents`、`~/.claude` 都可能含真实账号/聊天；测试用 temp + 注入。
- 规则：测试失败时先检查它有没有写到真实路径；有就立即修，不要靠“本机没事”放过。
- Seen 0×（保持）。

## 怎么加一条

1. 写清规则、事故、证据（文件/提交/日期）。
2. 只写能被下一次改动执行的规则，不写故事。
3. 同一条第二次出现时把 `Seen` 改成 2×，并考虑把它升级为代码检查。
