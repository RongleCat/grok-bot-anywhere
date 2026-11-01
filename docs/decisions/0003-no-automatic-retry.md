# ADR 0003：结果不明确时不自动重发

状态：Accepted。实现：`Delivery.process` + `resolve`。

## 背景

发送可能在上传后、服务端接受前超时；网络错误/未知 ack 不能区分「没发出去」和「已经发出去了」。自动重试会造成重复消息，且用户无法撤回。

## 决定

- 已经尝试发送但没有明确结果 → `unconfirmed`，该 Bot 进入 `held`。
- 该 Bot 的新发送被拒绝（`BOT_SEND_HELD`），直到用户到官方客户端核对并点“已核对，解锁发送”。
- `resolve` 只解锁，**不重发**原 receipt；原条目保持 `unconfirmed`。
- 上传失败可以 `retry`，因为上传有服务端引用、没有对外发言；发送重试必须由用户重新发起。
- direct 模式 90 秒截止后变 `expired`，不再补发。

## 后果

- 宁可让用户核对一次，也不重复打扰 Bot/群。
- 需要清楚的 UI 文案和“原条目仍不可确认”的状态，不能把 resolve 当成 sent。
- 服务端 `messageId` 稳定，重试同一 receipt 也不会生成新 id；但当前产品不自动重试。

## 相关

- [投递服务](../subsystems/delivery-service.md)
- [收件状态](../reference/receipts.md)
