# ADR 0004：本地优先收件箱

状态：Accepted。

## 背景

入口（微信分享、快捷指令、Explorer、拖放）可能发生在未登录、断网、云电脑休眠时。直接走网络会丢内容，且用户不知道丢在哪一步。

## 决定

- 所有入口先在本机生成 receipt：复制文件到 `inbox/files/<id>/`，写 SQLite。
- 网络动作（上传/发送）只在 receipt 落地后进行；失败保留文件，可重试。
- 分享扩展没有网络权限，只写 `ShareInbox/Ready`；服务进程再导入。
- 账号不匹配的批次留在本地，不跨账号投递。
- 启动时修复中断状态（`sending` → `unconfirmed`，`uploading` → `failed`）。

## 后果

- 断网/未登录不丢内容；用户能在收件页看到“待补充/失败/未确认”。
- 本地会有文件副本，需要清理策略与备份说明（见 [数据位置](../reference/configuration.md)）。
- 分享导入是异步的（1.5s drain），UI 需要“已收到、正在导入”的状态。

## 相关

- [投递服务](../subsystems/delivery-service.md)
- [收件状态](../reference/receipts.md)
