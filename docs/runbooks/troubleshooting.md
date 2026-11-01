# 排障

状态：Current。先看错误码，再看平台。

## 错误码

| 码 | 含义 | 处理 |
| --- | --- | --- |
| `NODE_UNAVAILABLE` | Swift 独立模式找不到 Node | 装 Node 22+，或设置 `TOUCH_BAR_BOT_NODE`；Electron 模式不该出现 |
| `DRAFT_BUSY` | 原生输入框已有草稿，新的 receipt 不覆盖 | 处理/关闭当前草稿；新内容在收件箱里 |
| `SEND_UNCONFIRMED` | 发送尝试过但结果不明 | 去官方客户端核对；不要重发；核对后用“已核对，解锁发送” |
| `BOT_SEND_HELD` | 该 Bot 有未核对条目 | 先 `resolve`，再发新内容 |
| `SOURCE_DISABLED` | 该来源没开，或 Bot 未启用接收 | 设置 → 接收单位；用悬浮输入框手动发送 |
| `INPUT_REQUIRED` | compose 模式直接提交没带正文 | 打开草稿补字 |
| `RECEIPT_EMPTY` | 没有文字也没有文件 | 加内容 |
| `RECEIPT_INVALID` | 字段/文件/来源不合法 | 看是否路径不是绝对路径、文件为空、超 100 个 |
| `ACCOUNT_BUSY` | 正在登录/切换/发送 | 等当前操作结束 |
| `LOGIN_REQUIRED` | 未登录或 token 失效 | 重新登录 |
| `SHARE_IMPORT_FAILED` | 分享批次导入失败 | 看 `ShareInbox/Rejected/<id>/failure.txt`；文件仍在本地 |
| `MENU_UNAVAILABLE` | 分享菜单宿主未安装/不可用 | 设置 → 更新转发菜单；先 `npm run build:share` |
| `CLI_COMMAND_EXISTS` | 已有一个不是本应用装的 `grok-bot` 命令 | 不会覆盖；手动处理旧命令或关闭开关 |
| `EXPLORER_SYNC_FAILED` | Windows 注册表写入失败 | 打开诊断脚本；检查权限/安全软件 |
| `PREVIEW_ONLY` | 预览模式调用了真实动作 | 用正常启动，不要用 `--preview` |
| `DELIVERY_IN_PROGRESS` | 退出/切换账号时仍有发送 | 等发送结束 |

## 微信菜单没有出现/不更新

1. 设置里是否启用了至少一个接收 Bot？
2. 点“更新微信转发菜单”，等完成；看是否有错误。
3. **完全退出微信**再打开（微信缓存旧菜单）。
4. 重新打开「转发 → 其他应用」。
5. 仍没有：检查 `~/Applications/Grok Bot Anywhere Menu/Contents/Helpers/` 是否有 `DestinationNN.app`；重跑 `npm run build:share`。
6. 菜单行名对但头像空白：图标尺寸/资源不对，重建宿主；看 [分享菜单](../subsystems/share-menu.md)。

## npm start 直接退出：BrowserWindow 不是 electron 的导出

错误形如：

```text
SyntaxError: The requested module 'electron' does not provide an export named 'BrowserWindow'
Node.js v24.x
```

原因：当前 shell 带着 `ELECTRON_RUN_AS_NODE=1`（常见于被 Electron 宿主启动的终端）。Electron 会以纯 Node 运行，`electron` 模块没有窗口 API。

处理：

```sh
env -u ELECTRON_RUN_AS_NODE npm start
```

这个变量只应由应用安装的 `grok-bot` shim 在需要 Node 模式时设置，不要让它泄漏到开发/冒烟命令。

## 悬浮输入框不出现

- 全局快捷键被其他应用占用：换快捷键。
- 原生伴侣没启动：看主进程是否记录 `NATIVE_COMPOSER_UNAVAILABLE`；`npm run build:native` 后重启。
- 用了 `--preview`：预览不注册真实快捷键。
- macOS 权限：辅助功能/输入监控按系统提示授予。

## 头像空白/不动画

- `vendor/bloub` 未初始化：`git submodule update --init --recursive`。
- 没装 desktop 依赖：esbuild 不在 `desktop/node_modules`。
- 重新跑 `npm run build:avatar`。
- 自定义图片 URL 不可读：会回退角色；检查网络/URL。

## Electron 改了代码但界面没变

```sh
npm run build && npm run dev
```

`npm start` 会先 build；如果直接 `electron .`，`out/` 还是旧的。

## 进程/数据

- 主窗口关了但应用还在：正常，托盘存在时隐藏。
- 想完全退出：托盘 → 退出，或 `Cmd+Q`。
- 预览数据在临时目录，退出即删；不要拿它验证真实账号。
- 收件库损坏前先备份 `userData/inbox/`；不要手工改 SQLite。

## Windows 专项

- 常驻 PowerShell 被安全软件告警：这是选择宿主，编译一次后复用；可在设置里关闭相关功能。
- 无边框窗口最大化有空白：工作区 inset 计算；记录显示器/DPI 再查 `window-chrome.mjs`。
- 协议不启动：检查安装时是否注册 `grokbotanywhere`；用 `start "" "grokbotanywhere://open"` 测试。
- 菜单变空/异常：设置 → 工具箱 → Windows 菜单 → 移除全部，重启 Explorer/微信 再看。

## 找日志

| 日志 | 位置 |
| --- | --- |
| Explorer 拒绝 | `userData/logs/explorer-forward.log`（脱敏） |
| 服务进程 | Electron 主进程 stdout/stderr（开发时终端） |
| 分享导入失败 | `ShareInbox/Rejected/<id>/failure.txt` |
| 原生伴侣 | stderr（Electron 会排空，不落盘） |

## 相关

- [构建](build.md)
- [测试](test.md)
- [数据位置](../reference/configuration.md)
