# Grok Bot Anywhere — Electron app

主产品。跨 macOS / Windows 的 Electron 外壳；macOS 的原生能力由 [`native/macos`](../native/macos) 的 Swift 伴侣补足。

文档以 [docs/](../docs/README.md) 为唯一事实来源，本页只保留这个目录的运行入口和边界。

## 运行

```sh
cd desktop
npm ci
npm run build
npm run build:native    # macOS：Touch Bar / 原生输入框 / 语音
npm run build:share     # macOS：微信 12 槽菜单
npm start
```

- 隔离预览：`npm start -- --preview`（临时 userData，不能发送）。
- 冒烟：`npm run smoke`；原生冒烟：`npm run smoke:native`。
- 测试：`npm test`（129 个）。

## 构建与打包

```sh
npm run build          # esbuild → out/
npm run package        # 未签名 --dir
npm run package:mac-all# 签名+公证 arm64/x64 DMG
npm run package:win    # 未签名 zip
```

签名需要 `~/.gba-signing/env`；不要把它或产物提交进仓库。

## 结构

```text
src/main/      主进程：窗口、托盘、快捷键、深链、CLI、分享同步
src/service/   utility process：账号、SQLite 收件库、上传、发送
src/renderer/  主窗口、悬浮输入框、Tab 宫格
src/share/     macOS 分享槽位与注册
src/shell/     跨平台纯函数
test/          Node 测试
scripts/       构建、原生、分享、签名脚本
```

## 边界

- 渲染层无 Node、无凭据；所有动作走 preload + 主进程白名单。
- 服务进程是收件库/发送队列的唯一写入者。
- 结果不明确时不自动重发；`unconfirmed` 等用户核对。
- Windows 已实现但未实机验证；Linux 未支持。
- 不要用 `electron .` 绕过 `npm run build`，`out/` 会是旧的。

## 相关

- [架构](../docs/architecture.md)
- [桌面外壳](../docs/subsystems/desktop-shell.md)
- [投递服务](../docs/subsystems/delivery-service.md)
- [打包与签名](../docs/subsystems/packaging.md)
- [Windows](../docs/platforms/windows.md)
