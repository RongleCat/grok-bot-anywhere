# 打包与签名

状态：Current。macOS 已验证签名+公证；Windows 只产出未签名 zip，未实机验证。

## 配置

`desktop/package.json` 的 `build` 段：

| 项 | 值 |
| --- | --- |
| appId | `dev.ronglecat.grokbotanywhere` |
| productName | `Grok Bot Anywhere` |
| 输出目录 | `desktop/release/` |
| 协议 | `grokbotanywhere` |
| 文件 | `src/**`、`out/**`、`package.json`、`node_modules/**` |
| 额外资源 | `resources/grok-bot-skill`（CLI skill） |
| 应用图标 | `build/icon.png`（1024 主图）、`build/icon.icns`、`build/icon.ico` |
| macOS 额外资源 | `native/GrokBotCompanion.app`、`native/GrokBotMenuHost.app`、`out/native-avatar` |
| macOS | `icon: build/icon.icns`、hardened runtime、entitlements、`notarize: true`、目标 `dmg` |
| Windows | `icon: build/icon.ico`、目标 `zip`、`signExecutable: false`（保留图标/metadata 写入，跳过签名）、x64 |

## 命令

```sh
cd desktop

npm run build            # 只构建 out/（esbuild）
npm run build:icons      # 生成应用图标（mac icns / Windows ico）
npm run build:native     # macOS 伴侣（需要 Swift）
npm run build:share      # macOS 宿主 + 12 appex（需要 Swift）
npm run package          # 未签名 --dir，调试用
npm run package:mac-arm  # arm64 DMG，签名+公证
npm run package:mac-intel# x64 DMG，签名+公证
npm run package:mac-all  # 两个都打
npm run package:win      # 未签名 zip
```

应用图标只用于 App/Dock/任务栏；状态栏、托盘、微信菜单图标仍由 `coal-ball.mjs` 和 `menu-icons.mjs` 单独生成，不经过这里的资源。

macOS 图标遵循 Apple 的 1024/824 安全区：1024px 画布四周留 100px 透明边，煤球内容约 824px；Windows ICO 使用较小的透明边并包含 16/24/32/48/64/128/256 多尺寸。生成脚本为 `desktop/scripts/build-app-icons.mjs`。

macOS 签名脚本 `desktop/scripts/package-mac-signed.sh`：

- 从 `~/.gba-signing/env` 读 `CSC_NAME`、`APPLE_API_ISSUER`、`APPLE_TEAM_ID`、`APPLE_API_KEY`/`APPLE_API_KEY_PATH`（可用 `GBA_SIGNING_ENV` 覆盖路径）。
- 先签嵌套的伴侣与每个 appex，再签宿主；最后 `codesign --verify --deep --strict`。
- 再 `npm run build` + `electron-builder --mac dmg --<arch>`，由 electron-builder 做公证。
- 密钥文件不进仓库，也不要打印。

## 产物

| 文件 | 架构 | 状态 |
| --- | --- | --- |
| `release/Grok Bot Anywhere-0.1.0-arm64.dmg` | arm64 | Developer ID 签名 + 公证 + staple |
| `release/Grok Bot Anywhere-0.1.0.dmg` | x64 | Developer ID 签名 + 公证 + staple |
| `release/Grok Bot Anywhere-0.1.0-win.zip` | x64 | 未签名；早于最后一次 `package.json` 修改，发布前重打 |
| `release/mac/`、`release/mac-arm64/`、`release/win-unpacked/` | — | 构建中间产物，不提交 |

> 现有 DMG/zip 是 2026-11-01 结构迁移前的产物；迁移后尚未重打，发布前必须按当前源码重新构建。

校验：

```sh
codesign -dv --verbose=2 "desktop/release/mac-arm64/Grok Bot Anywhere.app"
codesign --verify --deep --strict "desktop/release/mac-arm64/Grok Bot Anywhere.app"
spctl -a -vvv -t install "desktop/release/mac-arm64/Grok Bot Anywhere.app"
xcrun stapler validate "desktop/release/Grok Bot Anywhere-0.1.0-arm64.dmg"
```

## 产物与提交的关系

DMG/zip 是本地构建物，`.gitignore` 已排除。**发布前必须记录产物对应的 commit**；如果最后一次修改在产物之后，重打。历史教训见 [LESSONS.md](../../LESSONS.md)。

## 未完成

- Windows 没有代码签名，也没有在 Windows 机器上安装/运行过。
- 没有 Developer ID 之外的商店分发、自动更新、公证重试流水线。
- DMG 已签名公证，但没有上传到任何发布页。
- Linux 没有打包目标。

## 相关

- [发布 runbook](../runbooks/release.md)
- [构建 runbook](../runbooks/build.md)
- [Windows](../platforms/windows.md)
