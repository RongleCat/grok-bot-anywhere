# 打包与签名

状态：Current。macOS 已验证签名+公证；Windows 开发期用稀疏包并已实机验证，发布用完整 MSIX（未实现）。

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
| macOS 额外资源 | `native/GrokBotCompanion.app`、`native/GrokBotMenuHost.app`、`out/native-avatar` → `Resources/native/avatar` |
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
npm run package:mac-arm   # arm64 DMG，签名+公证
npm run package:mac-intel # x64 DMG，签名+公证
npm run package:mac-all   # 两个都打
npm run package:win       # 未签名 zip
npm run package:win-store # 商店 MSIX（未签名，身份来自 Partner Center）
```

菜单图标抓取在打包后必须从 `process.resourcesPath/native/avatar/index.html` 加载，而不是 `app.asar/out/native-avatar`。

应用图标只用于 App/Dock/任务栏；状态栏、托盘、微信菜单图标仍由 `coal-ball.mjs` 和 `menu-icons.mjs` 单独生成，不经过这里的资源。

macOS 图标遵循 Apple 的 1024/824 安全区：1024px 画布四周留 100px 透明边，煤球内容约 824px；Windows ICO 使用较小的透明边并包含 16/24/32/48/64/128/256 多尺寸。生成脚本为 `desktop/scripts/build-app-icons.mjs`。

macOS 签名脚本 `desktop/scripts/package-mac-signed.sh`：

- 从 `~/.gba-signing/env` 读 `CSC_NAME`、`APPLE_API_ISSUER`、`APPLE_TEAM_ID`、`APPLE_API_KEY`/`APPLE_API_KEY_PATH`（可用 `GBA_SIGNING_ENV` 覆盖路径）。
- 先签嵌套的伴侣与每个 appex，再签宿主；最后 `codesign --verify --deep --strict`。
- 再 `npm run build` + `electron-builder --mac dmg --<arch>`，由 electron-builder 做 App 公证；脚本再对生成的 DMG 单独执行 `notarytool submit --wait`，随后 `stapler staple` + `stapler validate`，确保离线 Gatekeeper 可用。
- 密钥文件不进仓库，也不要打印。

## 产物

| 文件 | 架构 | 状态 |
| --- | --- | --- |
| `release/Grok Bot Anywhere-0.1.5-arm64.dmg` | arm64 | Developer ID 签名 + 公证 + staple |
| `release/Grok Bot Anywhere-0.1.5.dmg` | x64 | Developer ID 签名 + 公证 + staple |
| `release/Grok Bot Anywhere-0.1.5-win.zip` | x64 | 未签名；用户拉取后自行签名或放行 |
| `release/mac/`、`release/mac-arm64/`、`release/win-unpacked/` | — | 构建中间产物，不提交 |

> 打双架构时，每个架构都要用 `GBA_TARGET_ARCH=arm64` / `x86_64` 重新生成 native companion 与 share host，再调用对应的 `package:mac-*`；`package:mac-all` 不会自动切换这两个 helper 的架构。0.1.5 的 CI 产物以本次 Actions 构建为准。

校验：

```sh
codesign -dv --verbose=2 "desktop/release/mac-arm64/Grok Bot Anywhere.app"
codesign --verify --deep --strict "desktop/release/mac-arm64/Grok Bot Anywhere.app"
spctl -a -vvv -t install "desktop/release/mac-arm64/Grok Bot Anywhere.app"
xcrun stapler validate "desktop/release/Grok Bot Anywhere-0.1.5-arm64.dmg"
```

## 产物与提交的关系

DMG/zip 是本地构建物，`.gitignore` 已排除。**发布前必须记录产物对应的 commit**；如果最后一次修改在产物之后，重打。历史教训见 [LESSONS.md](../../LESSONS.md)。

## Windows：稀疏包与完整包

开发期用**稀疏包**（当前实现）：包只带身份与清单，exe 在 `-InstallRoot` 下，脚本见 `desktop/scripts/pack-share.ps1` 与 `register-share.ps1`。它的好处是改动热、不必重打应用。

发布期要换成**完整 MSIX**，把 Electron 应用整个放进包里。原因：稀疏包要求用户先装好应用再注册，且外部目录不能随包升级；完整包才有干净的一步安装、卸载和更新。

完整包要处理两件事（没有老用户，因此不做数据迁移）：

| 事项 | 说明 |
| --- | --- |
| 包身份 | `Identity Name` + `Publisher` 一旦有真实用户就不能改；Publisher 必须与签名证书 Subject 逐字符一致 |
| 更新 | 改用 `.appinstaller`（MSIX 自带升级），否则只能手动重装 |

签名有三条路，按当前优先级：

| 路径 | 成本 | 约束 |
| --- | --- | --- |
| Microsoft Store | 免费 | MSIX 不需要证书，认证后商店重签；包身份由商店分配。见 [Store 提交](../runbooks/store-submission.md) |
| SignPath Foundation | 免费 | 公开仓库、OSI 许可、必须由 CI 从仓库构建；Publisher 是 SignPath Foundation |
| 商业 OV 证书 | 约 ¥600/年起 | 自己持有证书；Certum 个人版，国内代理可付款 |

自签只用于本地开发。`exe`/`dll`/`msix` **必须用同一张证书**，否则包与进程身份对不上；本地自签用 `new-dev-certificate.ps1`。

Azure Artifact Signing（原 Trusted Signing）只对美国和加拿大的个人、以及美国/加拿大/欧盟/英国的组织开放，其他地区不要按这条路准备。

`pack-share.ps1 -Sign Unsigned` 产出的 zip 就是 SignPath 的输入形状（helper exe + msix），接 CI 时换成完整包的 payload 即可。

完整 MSIX 的身份随分发渠道变化：Store 用 Partner Center 给的 `Name`/`Publisher`/`PublisherDisplayName`，侧载用证书 Subject。两者不能混用，见 `desktop/scripts/pack-full.ps1` 的参数。

## 未完成

- Windows 只验证了稀疏包；完整 MSIX、数据迁移、`.appinstaller` 更新都还没做。
- 商店包未构建、未上传、未认证；`package:win-store` 未在 Windows 上跑过。
- 没有非商店正式证书；SignPath 待批，商业 OV 未购买。
- 没有 Developer ID 之外的商店分发、自动更新、公证重试流水线。
- DMG 已签名公证，但没有上传到任何发布页。
- Linux 没有打包目标。

## 相关

- [发布 runbook](../runbooks/release.md)
- [构建 runbook](../runbooks/build.md)
- [Windows](../platforms/windows.md)