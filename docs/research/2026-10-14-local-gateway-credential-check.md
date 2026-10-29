# 本机社区 SDK gateway 凭据检查

检查日期：2026-10-14。用户授权检查本机是否有可用 token。

结论：在社区 SDK 的已知发现路径、相关应用目录、当前 shell 与 launchd 环境、shell 配置中，未找到可直接用于社区 gateway 的 token/address 配置。没有凭据对可以做 authenticated gateway 验证，因此没有把“未找到”写成“token 已失效”。

## 已检查结果

- `SAND_GATEWAY_TOKEN`、`GROKBOT_GATEWAY_URL`、`SAND_GATEWAY_URL`、`SAND_DATA_ROOT`：当前进程和 launchd 环境未配置，已检查 shell 配置未见相应变量定义。
- `/home/box/sand-data/gateway.json` 与 `/home/box/agent-data/gateway.json`：本机不存在。
- 已知本机 Grok Bot 数据路径以及 `.cursor`、`.grokbot` 等相关路径：未找到 gateway.json。
- TCP 1340 未发现监听；当前 Grok Bot 进程未发现 TCP 监听。不能以此推定云 host 没有运行。
- Grok Bot desktop-status 显示已登录。sand-secrets 的账号存储中存在 Cursor access/refresh credential 字段，但没有据此认定为社区 gateway token，也没有验证这些登录凭据的服务端有效性。
- 静态应用源码区分 Cursor account secrets、local execution key 与 host gateway 配置。不同凭据不可互换。

## 处理边界

只输出存在性、字段类别与连接配置状态。未展示、复制或写入任何凭据；没有解密 Keychain，没有读取 Cookies，没有读取会话内容，也没有发送真实 Bot 消息。目录检查仅作为发现，未读取其他应用的认证文件内容。

下一步应在账号的 Bot 云电脑上确认 host gateway discovery 文件和可达通道，再通过受控方式配置服务端。Mac 客户端已登录不能替代此步骤。

## 补充：用户提供的 gateway.json

用户随后提供 `/Users/ronglecat/Downloads/gateway.json` 并授权测试。它含社区 SDK 所识别的 port/pid/startedAt/scheme/host/token 字段，token 非空；未记录其内容或将文件复制进项目。

配置为 HTTP、端口1340、host为0.0.0.0。社区SDK将这个监听通配地址转为127.0.0.1，因此只读测试访问本机 `/health`。结果为 connection refused。

尚未执行带token的listAgents请求，不能判断token有效或失效。下一步缺少这份配置所属Bot host的可达URL；需用户提供主机名/IP/隧道地址，或明确配置相应网络通道。
