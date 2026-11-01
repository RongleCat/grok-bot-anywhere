# 手表直连 Grok Bot 的 HTTPS 接口部署方案

日期：2026-10-14。状态：基于官方文档与社区源码的部署提案，尚未部署云服务，也没有已可用的公网 URL。

更新：随后静态检查客户端0.70.2发现Broker返回远程gatewayUrl/gatewayToken/networkToken。应优先验证[客户端Broker链路](../research/2026-10-14-client-auth-and-broker.md)，成功时可让独立HTTPS后端直接访问分配的远程gateway，以下自建Tunnel部署作为备用方案。

## 官方与社区建议的区别

社区 SDK remote.md 推荐在 Bot computer 和调用端之间使用 Tailscale、VPN、LAN或SSH通道，配置可达gateway origin与gateway token。它不提供公网托管API。

Cursor 官方 Grok Bot private-networks 文档给出桌面出网转发或自行安装组织网络客户端的模式。Tailscale/Cloudflare是文档示例；Enterprise Team Setup负责安装脚本与重建后重应用。它不是官方托管社区gateway，文档主要解决Bot访问私网，不构成公开内部1340端口的官方承诺。

Cursor插件库内的Tailscale插件说明是Bot访问tailnet内MCP服务器，不能仅由“已装插件”推定外部服务可以访问Bot gateway。

## 本项目推荐部署

手表HTTPS请求 → Cloudflare固定域名 → Tunnel → Bot云电脑上的窄HTTP API服务 → 社区SDK → 同机127.0.0.1:1340 gateway。

桥接API和cloudflared部署在Bot云电脑上，Mac不参与运行链路。cloudflared主动建立出站通道，不需要手表知道云电脑公网IP；隧道需要云电脑允许安装/运行connector、外连Cloudflare且connector可访问origin。

SDK同机读取host自身gateway.json，避免手表持有gateway token。之前复制到Downloads的文件含token但只有0.0.0.0监听地址，因此无法在Mac上单独完成远程连接；它不是公网地址登记文件。

## 拟定API（尚未实现）

| 路由 | 行为 |
| --- | --- |
| GET /health | 桥接服务状态，不返回凭据 |
| GET /v1/bots | 经过规范化的id/name/avatarVersion/status/未读名单 |
| GET /v1/bots/{id}/avatar | 静态头像与缓存版本 |
| POST /v1/bots/{id}/messages | 提交text与requestID，返回202与taskID；不阻塞等完整结果 |
| GET /v1/tasks/{taskID} | 查询持久任务状态和结果 |
| POST /v1/tasks/{taskID}/cancel | 明确取消选中的任务 |

附件endpoint在uploadAttachment协议与真实字节传输验收后增加；当前不能用attachmentPaths字段替代上传。

目前已有bridge CLI是stdio mock，不是HTTP服务，也没有真正实现这些公网路由。先实现这些接口和认证，再发布隧道；不能把命令表里的任意/api/<command>直接作为Watch产品API。

## 实施顺序

1. 在Bot云电脑内部验证localhost:1340/health，以及带授权的listAgents；输出数量/成功状态，不输出token或聊天预览。
2. 实现HTTP bridge，监听127.0.0.1:8787，加载社区SDK；gateway token仅在host进程内使用。
3. 为API加入应用自己的设备授权、请求ID去重、任务持久状态和明确错误。手表发送应用凭据，避免拿gateway管理员凭据做产品登录。
4. 测试期可以在云电脑启动Quick Tunnel：`cloudflared tunnel --url http://127.0.0.1:8787`。返回临时trycloudflare.com域名；先验证外部HTTP名单读取。此时必须已经有API认证，不能依赖随机URL隐藏服务。
5. 长期版创建Cloudflare remotely-managed tunnel，Published application route把用户自己的固定域名（示例bot-api.example.com）映射到http://127.0.0.1:8787。该示例不是实际部署地址。
6. 在Mac和Watch网络侧验证HTTPS证书、API响应、正确/错误设备凭据、上游断网，以及来自真实gateway的名单。若前置Cloudflare Access，选适合原生客户端的认证方式，不能让API默认重定向为网页验证码登录。
7. 验证进程启动与云电脑重建恢复。Enterprise可用Team Setup hook；个人账号的手动部署与恢复需实测，不能宣称获得同等官方生命周期保证。不要为应用此改动自动reset云电脑。

Quick Tunnel仅开发用途，URL会变、无可用性保证且不支持SSE；第一轮用短HTTP请求/任务查询。固定域名与命名Tunnel适合后续稳定客户端配置。

## 需要的信息

- 是否能在账号的Bot云电脑运行服务与connector，且gateway本机只读验证成功。
- 正式部署用的Cloudflare账号和可控制域名；没有域名可先临时试连。
- Cursor个人/Teams/Enterprise类型影响自动安装和重建恢复方式。

## 来源

- [社区remote说明](https://github.com/adam91holt/grokbot-sdk/blob/main/docs/remote.md)
- [Cursor私网文档](https://cursor.com/docs/grok-bot/private-networks)
- [插件库Tailscale说明](https://github.com/cursor/plugins/blob/main/third_party/tailscale/README.md)
- [Cloudflare Tunnel路由](https://developers.cloudflare.com/tunnel/concepts/routing/)
- [创建命名Tunnel](https://developers.cloudflare.com/learning-paths/clientless-access/connect-private-applications/create-tunnel/)
- [Quick Tunnel能力与限制](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
