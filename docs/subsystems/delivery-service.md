# 投递服务

状态：Current。运行在 Electron `utilityProcess`，入口 `desktop/src/service/worker.mjs`。多账号管理为 2026-11-12 代码完成，单测覆盖；**未用两个真实账号做实机投递验收**。

## 职责与边界

服务进程是**唯一**拥有以下状态的地方：

- 账号注册表（名称、顺序、勾选状态）与每个账号的 Bot 名单、运行时状态（主 Bot、置顶、分组、运行中）。
- SQLite 收件库（receipts / recipients / preferences）。
- 上传与发送队列。
- 分享收件箱的 drain 循环。

主进程通过 JSON RPC 调用它，渲染层永远不直接接触它。

## 源码入口

| 文件 | 作用 |
| --- | --- |
| `service/worker.mjs` | 进程入口、RPC 方法分发、分享 drain 定时器 |
| `service/accounts.mjs` | 多账号管理器：账号注册表、连接/移除/勾选、按 Bot/receipt 路由、合并状态 |
| `service/session.mjs` | 单个账号会话、登录、名单刷新、watcher、发送队列、状态快照 |
| `service/store.mjs` | SQLite schema、receipts/recipients/preferences 读写 |
| `service/delivery.mjs` | 一条 receipt 的完整投递状态机 |
| `service/upload.mjs` | 文件上传（单 PUT / 分片边界） |
| `service/share-inbox.mjs` | 扫描 `ShareInbox/Ready`、校验 manifest、导入、移动目录 |
| `main/rpc.mjs` | 主进程侧 RPC 客户端 |

## RPC 方法

`initialize` 之后可用：

| 方法 | 作用 |
| --- | --- |
| `snapshot` | 全量状态：accounts、合并 Bot/recipients/inbox、theme、shortcuts、runtime、watchErrors |
| `login` / `desktopLogin` / `addAccount` / `connect` / `removeAccount` / `setAccountChecked` / `logout` | 添加账号（浏览器 PKCE/本机）、连接、移除一个账号、勾选、退出全部 |
| `refresh` | 刷新全部勾选账号，或指定 `accountId` 刷新一个 |
| `duplicateBot` / `updateBotAvatar` | 按 `accountId+botId` 复制 Bot / 改头像 |
| `configure` | 改指定账号的 recipient（enabled/mode/prefix/sources/order） |
| `disableAllReceive` | 关闭指定账号或全部勾选账号的 enabled recipient |
| `receive` | 新建 receipt（入口统一走这里；按 `accountId+botId` 路由） |
| `submit` / `submitAsync` / `retry` / `resolve` / `composer` / `dismissComposer` | 补字发送、后台发送并立即返回 receipt id、重试失败项、核对解锁、取草稿、关闭草稿并清理附件 |
| `resume` | 启动时恢复未完成状态 |
| `theme` / `setShortcut` | 偏好 |
| `watch` | 订阅某 Bot/session 回复 |
| `shutdown` | 停 drain、关 watcher、关库 |

错误码是稳定的 `UPPER_SNAKE`，不会把 SDK/HTTP 原文透给渲染层。

## 多账号状态

- `accounts[]`：每个已添加账号的 `account`、`checked`、`connected`、`busy`、`runtime`、`botCount`；未勾选账号也在这里，便于设置页切换。
- `bots/recipients/inbox`：只合并**勾选**账号，每项带 `accountId`（Bot 还带 `accountName`）。切账号只影响可见集合，不改变已冻结的 receipt 目标。
- `account` / `connected` / `accountBusy`：兼容别名；`account` 是第一个勾选账号，`connected` 是任一勾选账号在线，`accountBusy` 是任一勾选账号过渡或正在添加账号。
- 每个账号有自己的 `AccountSession`、`client`、`Delivery`、watcher 和发送队列；新增/移除一个账号不会阻塞其他账号的发送。移除账号只要求该账号自己 idle。

## SQLite

路径：`userData/inbox/inbox.sqlite`（macOS `~/Library/Application Support/Grok Bot Anywhere/inbox/`）。

```sql
recipients(account, bot, value JSON, PRIMARY KEY(account,bot))
receipts(id, account, value JSON, PRIMARY KEY(id))
preferences(key, value JSON, PRIMARY KEY(key))
```

- 文件权限 `0600`，目录 `0700`；WAL + `synchronous=FULL`。
- 启动时修复中断状态：`phase=sending` → `unconfirmed/held`；`phase=uploading` → `failed/ready`。
- receipt 里的附件复制到 `inbox/files/<receiptId>/`，数据库只存路径/名称/字节数。

## 投递状态机

```text
receive
  ├─ 无文字/文件             → RECEIPT_EMPTY
  ├─ 来源关闭（非 manual）    → SOURCE_DISABLED
  └─ 建 receipt, needs-input, phase=ready
        │
        ├─ compose 模式 + 无 edit → 等用户（INPUT_REQUIRED）
        └─ process
              ├─ 上传失败/超预算 → failed / ready（可 retry）
              ├─ direct 未开始就超 90s → expired / done
              ├─ 发送抛错(已尝试) → unconfirmed / held（该 Bot 暂停）
              ├─ 结果明确        → sent / done
              └─ 401/403         → 继续抛给上层（触发重新登录）
```

关键规则：

- **同 Bot 串行**：`sendQueues` 按 botId 排队；不同 Bot 可并行。
- **同 Bot 持锁**：存在未 `holdResolved` 的 `unconfirmed` 时，新发送返回 `BOT_SEND_HELD`。
- **direct 截止时间 90s 只决定是否开始**：从 receipt 创建时刻算。开始上传后改用单独的 30 分钟传输预算；100 个附件不会在上传中途因为创建时间过期，传输超预算则回到 `failed/ready`，文件保留、可重试。
- **账号切换/移除**：单个账号的 `assertIdle` 阻止该账号有 pending/active/inflight 时移除；新增/勾选其他账号不会阻塞它。切换 generation 使旧回调失效。
- **`sent` 只表示服务端接受**，不表示 Bot 已读；回复通过 watcher 事件另行挂载。

## 回复挂载

- `watch(botId, sessionId)` 建立 SDK 订阅；断开/切换会取消。
- 新事件挂到该 session 最近一条 `sending`/`sent` receipt；按事件 id 去重并过滤 replay。
- 不承诺“这条回复属于哪一次请求”；这是 SDK 的能力边界，不是 bug。
- `watchErrors` 保留每个 Bot 的订阅错误，UI 显示但不自动重连风暴。

## 分享收件箱

`share-inbox.mjs` 每 0.25 秒扫描 `ShareInbox/Preparing` 和 `ShareInbox/Ready`：

1. 目录名只允许 `[A-Za-z0-9_-]{1,100}`，拒绝符号链接。
2. `manifest.json` 必须版本 1、`source=wechat`、账号/投递模式/文件列表合法，大小 ≤8MB。
3. 账号不匹配或切换中：留在 `Ready`，不导入。
4. 已存在同 `sourceId`：移到 `Imported`，不重复。
5. 成功：按 manifest 的 `accountId` 找到对应 session，`session.receive(...)` → 移到 `Imported`；配置类错误保留；其他失败写 `failure.txt` 后移到 `Rejected`。
6. 未勾选账号的批次留在 `Ready`，勾选后再导入；不同账号的批次不会串投。

## 上传

- 单 PUT 从磁盘流式上传；分片模式未实现，遇到会失败且不丢文件。流式上传按字节回报进度，`Delivery` 节流写入 receipt 的 `progress`，输入框收起后的小条据此显示百分比。
- base64 gateway 传输有 64MiB 内存守卫；单请求超时 30 分钟，整条 receipt 的传输预算也是 30 分钟。
- 上传引用只在发送成功后才有意义；失败保留本地文件供 retry。

## 验证

```sh
npm run test:desktop
```

覆盖：状态机、账号隔离、串行发送、未确认持锁、过期、分享 manifest、路径穿越、上传失败、启动恢复。
真实发送/回复链路不在单测里，见 [测试 runbook](../runbooks/test.md) 的“未运行项”。

## 相关

- [收件状态](../reference/receipts.md)
- [数据位置](../reference/configuration.md)
- [ADR 0003：不自动重发](../decisions/0003-no-automatic-retry.md)
- [ADR 0004：本地优先收件箱](../decisions/0004-local-first-inbox.md)
