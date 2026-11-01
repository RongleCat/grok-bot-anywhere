# 测试

状态：Current。

## 一键

```sh
npm test          # desktop + client-protocol + avatar
npm run test:all  # 再加 Swift
```

或分别：

```sh
npm run test:desktop
npm run test:client
npm run test:avatar
npm run test:swift
```

## 各套测试

| 套件 | 命令 | 覆盖 | 前置 |
| --- | --- | --- | --- |
| Electron | `npm run test:desktop` | 主进程纯函数、窗口选项、深链、快捷键、收件状态机、分享模型、CLI 脚本、账号隔离 | 已 `npm ci` |
| Client Protocol | `npm run test:client` | 协议解析、头像向量、SSE、附件、桥接、脱敏 | Node >=22.13 |
| Avatar renderer | `npm run test:avatar` | Bloub 14 状态、mask、前后轨道、无 NaN | `vendor/bloub` + esbuild |
| Swift | `npm run test:swift` | 选择稳定性、名单刷新、草稿隔离、发送目标冻结、编辑保护 | Xcode/CLT |
| Electron smoke | `npm run smoke` | 启动窗口、本地收件、>4MiB intake、截图 | 构建完成 |
| Native smoke | `npm run smoke:native` | 伴侣启动、共享名单、原生输入框、`DRAFT_BUSY` | macOS + `build:native` |

当前基线（2026-11-01）：desktop **129 passed**，client-protocol **60 passed**，avatar **1 passed**，Swift **8 passed**。改动后重新跑，不要引用过期数字。

## 隔离规则

1. **测试不碰真实用户数据**：不读写 `~/Library/Application Support/Grok Bot Anywhere`、真实 Keychain、`~/.agents`、`~/.claude`、`~/.local/bin`。
2. **网络**：单测不联网；真实登录/发送验收必须显式、可回滚，并写脱敏报告。
3. **临时目录**：每个测试自建 temp，结束删除；不要清空共享 cache。
4. **进程**：测试启动的子进程必须在测试结束前停止；否则会写进下一个测试。
5. **一个测试一个保证**：测试名描述用户可见行为，不描述实现。

## 失败处理

- 失败就是 bug。不要用“在旧版本也失败”当基线；先查 `git log` 是否有人已修。
- 不要靠重跑碰运气；注入延迟/断网复现。
- 修复时加一个**不带修复就失败**的测试，并在提交信息里写失败输出。
- 暂时无法修：开 issue 记录复现命令、输出、影响平台，不要静默跳过。

## 平台矩阵

| 检查 | macOS | Windows | Linux |
| --- | --- | --- | --- |
| `npm test` | 已跑 | 未跑 | 未跑 |
| `swift build` / `test` | 已跑 | 不适用 | 不适用 |
| `npm run smoke` | 已跑 | 未跑 | 未跑 |
| 真实发送/回复 | 已人工验收 | 未跑 | 不适用 |
| 安装包启动 | DMG 已验 | zip 未验 | 无包 |

在 Windows 上跑完再改这张表；不要把“代码在 macOS 上通过”写成“Windows 已验证”。

## 证据怎么写

提交/交接里写：

```text
Ran: npm run test:desktop
Result: 129 passed, 0 failed (exit 0)
Not run: Windows smoke, real send, Touch Bar hardware
```

不要只写“测试通过”。

## 相关

- [测试规范](../standards/testing.md)
- [构建](build.md)
- [排障](troubleshooting.md)
