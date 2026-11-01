# Grok Bot 客户端认证与 Broker 连接发现

日期：2026-10-14。只读检查本机 Grok Bot 0.70.2 的公开应用bundle，未调用认证/Broker服务，没有读取或展示新的凭据。

## 结论

技术上可以研究并实现自己账号的客户端登录、凭据刷新和连接发现链路。本次已找到实际Broker响应字段，而不只是猜测客户端能绕开手工隧道。

客户端已有一条远程gateway发现机制：登录凭据 → GrokBotService.EnsureSandBox → gatewayUrl/gatewayToken/networkToken → 远程host gateway。它是未公开稳定SDK合约的客户端内部机制；尚未对本账号进行实际联调，也未证明可以从独立后端运行。

此发现意味着手工Tailscale/Cloudflare Tunnel并非唯一候选，应优先验证现成Broker路由，再决定是否需要自行打通网络。

## 本机静态证据

来源为 `/Applications/Grok Bot.app/Contents/Resources/app.asar`：

- `dist/electron-main/proto.cjs` 有服务描述符 `aiserver.v1.GrokBotService`、`EnsureSandBox`。
- `EnsureSandBoxRequest` 包含可选 `wake`、`supports_asleep_box`；这不是纯名单读接口，调用可能影响云电脑生命周期，因此此次不自动执行。
- `EnsureSandBoxResponse` 包含 `gateway_url`、`gateway_token`、`network_token` 和 run state 等字段。
- `main-app.cjs` 将响应的gatewayUrl用作连接baseUrl，将gatewayToken用作gateway凭据；networkToken转成`x-anyrun-network-token`请求头。
- 客户端存在凭据刷新实现和登录管理器；账户secret储存不同于gateway凭据。不要把access token、refresh token、gateway token、network token互换。
- Cursor官方网络文档说明桌面分别连接Cursor API与`<computer>.<cluster>.cursorvm.com`电脑端点，与这一发现一致。

## 建议的后端链路

Watch → 我们的HTTPS API → 客户端协议adapter → Cursor认证/Broker → 已分配的host gateway。

后端完成账号登录/凭据刷新、Broker发现、缓存与更新连接信息，以及社区SDK调用。手表使用应用自己的设备授权，不持有refresh token或底层network/gateway凭据。

社区SDK已提供的gateway commands可继续复用，但其公开options没有直接接受客户端headers的独立字段。需要适配fetch或transport，在已确认的gateway origin上添加network授权头。不能假设只有Bearer gateway token就能穿过客户端的远程网络层。

## 功能与验收

1. 先确认既有账号登录凭据的解析/刷新方式；不为第三方账号复制自己的凭据，发布版需独立用户登录方案。
2. 构造与当前客户端版本匹配的Broker请求，确认会话/账号/团队scope和云电脑状态；不调用recreate/reset之类操作。
3. 内存保留Broker凭据，只输出发现成功/端点存在的布尔结果，不输出token。
4. 对已发现gateway执行health和listAgents，记录Bot数量，并与官方名单核对。
5. 确认远程headers、登录过期、host休眠/重建、token轮换后的恢复。
6. 后续分别验证头像、状态、文本与附件。uploadAttachment仍是单独关卡，不能因为获得完整gateway就推定字节上传已实现。

## 对先前结论的修正

本地检查没有找到host gateway token仍然成立，用户提供的gateway.json只包含监听地址的结论也成立。但是客户端并非只能靠这份静态文件连接：它可以通过Broker取得远程origin及另一层network授权。因此在实现自建隧道之前，应先验证这条链路。

官方BDK仍是公开的较窄文本通道。客户端内部机制功能更贴近官方UI，但需要版本兼容、服务端schema和登录生命周期处理，不能称为官方支持的第三方Bot管理SDK。

## 参考

- [Cursor客户端网络说明](https://cursor.com/docs/grok-bot/proxies)
- [社区gateway客户端](https://github.com/adam91holt/grokbot-sdk/blob/main/sdk/src/gateway/client.ts)
- 本机0.70.2 public bundle 的main-app/main-core/proto静态实现；不复制完整闭源源码进入项目。
