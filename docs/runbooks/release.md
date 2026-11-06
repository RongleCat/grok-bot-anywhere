# 发布

状态：Current。macOS DMG 已能签名+公证；Windows 只有未签名 zip。

## 发布前检查单

- [ ] `git status` 干净；要知道发布的是哪个 commit。
- [ ] `npm run test:all` 通过（记录数字）。
- [ ] `cd native/macos && swift build` 通过。
- [ ] `npm run build` 成功；`out/` 与源码一致。
- [ ] 版本号在 `desktop/package.json` 里已更新（当前 0.1.4）。
- [ ] 0.1.4 的修复清单见 [更新说明](../updates/0.1.4.md)。
- [ ] 签名环境 `~/.gba-signing/env` 存在且未过期。
- [ ] 产物时间晚于最后一次源码/配置修改；否则重打。
- [ ] 在干净用户目录安装并启动一次（至少 macOS）。

## GitHub Actions（macOS）

`.github/workflows/macos-release.yml` 支持手动触发和 `v*` tag。两个架构都在 `macos-14` 上运行，先选 Xcode 16，再构建 Swift companion / 12 个 share appex，最后签名、公证和 staple：

- arm64：原生构建
- x64：同一 runner 上以 `GBA_TARGET_ARCH=x86_64` 交叉构建 native helper

仓库需要这些 Actions secrets（已在本机配置）：

| Secret | 内容 |
| --- | --- |
| `MAC_CERTIFICATE_P12` | Developer ID Application 证书 `.p12` 的 base64 |
| `MAC_CERTIFICATE_PASSWORD` | p12 密码 |
| `MAC_CERTIFICATE_NAME` | 完整 identity，如 `Developer ID Application: ...` |
| `APPLE_API_KEY_P8` | App Store Connect API `.p8` 文件内容 |
| `APPLE_API_KEY_ID` | Key ID |
| `APPLE_API_ISSUER` | Issuer ID |
| `APPLE_TEAM_ID` | Team ID |

手动运行：

```sh
gh workflow run macos-release.yml -f version=0.1.4
```

CI 会验证 App 的签名、架构、App ticket 和 DMG ticket，并上传 `macos-arm64` / `macos-x64` artifact。

## macOS

```sh
cd desktop
GBA_TARGET_ARCH=arm64 npm run build:native
GBA_TARGET_ARCH=arm64 npm run build:share
npm run package:mac-arm
GBA_TARGET_ARCH=x86_64 npm run build:native
GBA_TARGET_ARCH=x86_64 npm run build:share
npm run package:mac-intel
```

`package:mac-all` 只连续调用两个打包脚本，不会重建 native helper；双架构必须像上面这样分别用 `GBA_TARGET_ARCH` 重建，否则两种 DMG 会带同一个架构的伴侣。

产物：

```text
release/Grok Bot Anywhere-0.1.4-arm64.dmg
release/Grok Bot Anywhere-0.1.4.dmg        # x64
```

校验：

```sh
codesign --verify --deep --strict "release/mac-arm64/Grok Bot Anywhere.app"
codesign -dv --verbose=2 "release/mac-arm64/Grok Bot Anywhere.app"
spctl -a -vvv -t install "release/mac-arm64/Grok Bot Anywhere.app"
xcrun stapler validate "release/Grok Bot Anywhere-0.1.4-arm64.dmg"
```

`codesign -dv` 应显示 Developer ID、`flags=0x10000(runtime)`、`Notarization Ticket=stapled`。

## Windows

两条路，商店优先。

**Store**：`.github/workflows/windows-store.yml` 读仓库变量 `STORE_PACKAGE_NAME`、`STORE_PUBLISHER`、`STORE_PUBLISHER_DISPLAY_NAME`，产出未签名完整 MSIX，上传 Partner Center；商店认证后重签。账号免费、不需要证书。完整步骤与认证说明见 [Store 提交](store-submission.md)。

**侧载**：`.github/workflows/windows-release.yml` 会构建 app zip、完整 MSIX、share helper zip 和稀疏 share MSIX，并上传 `unsigned-for-signing`。配置 SignPath 变量后会提交签名；未配置时只产出未签名 artifact。

签名前必须确认：

- `WINDOWS_PUBLISHER` 与签名证书 Subject 完全一致。
- SignPath artifact configuration 覆盖 app zip、完整 MSIX、share zip 和稀疏 MSIX。
- 完整 MSIX 的 share target 和安装器仍需 Windows 实机验证。

本地侧载打包：

```powershell
cd desktop
npm run package:win
```

产物 `release/Grok Bot Anywhere-0.1.4-win.zip`，未签名；由用户拉取后自行签名或放行。自签只影响本机信任，公共分发仍会被 SmartScreen/SAC 拦。**发布前必须在 Windows 机器上解压启动一次**；当前没有这条证据。

## 0.1.3 发布记录

```text
Commit: 38dd40d
macOS: arm64 DMG 118.6 MiB, x64 DMG 124.6 MiB; Developer ID signed, notarized, stapled
Checks: codesign --verify --deep --strict, spctl, stapler validate, hdiutil verify passed for both; packaged arm64 and x64 smoke passed
Windows: x64 zip 146.7 MiB; unsigned; extracted and app.asar version 0.1.3 verified on macOS; Windows install/self-sign not run
SHA256: arm64 2f3fe166d7225e79e735f5b91b04dac127ae0944fe45a1b016b7ae23eac5090b
SHA256: x64 e8110edebed0af3a4b8b1d267a31056d61ab4829e81df0d8612422f23cae2196
SHA256: win b5b8fc73f005cb01d8db250bf6f4a674d8066e944e935c572f0d4a1461f5bf02
Tests: desktop 167 passed; client-protocol 61 passed; avatar 1 passed; Swift 8 passed; docs check passed
Not run: Windows real-device install, Touch Bar hardware, live WeChat send on this exact build
```

0.1.3 的用户操作文档：[Grok Bot Anywhere 下载与使用教程](https://jcng5q8n0f3z.feishu.cn/wiki/HwHmwM4dcidx8Wko50QcJlgGnyd)；更新说明见 [0.1.3 更新说明](../updates/0.1.3.md)。

## 0.1.2 发布记录

```text
Commit: 95661dd
macOS: arm64 DMG 120 MB, x64 DMG 125 MB; Developer ID signed, notarized, stapled
Checks: codesign --verify --deep --strict passed for both; spctl accepted; stapler validate passed
Tests: desktop 161 passed; client-protocol 60 passed; avatar 1 passed; Swift 8 passed; docs check passed; packaged arm64 smoke passed
Feishu: tutorial updated with 0.1.2 download links and update note; both files set to tenant-readable links
Not run: Windows real-device install, Touch Bar hardware, live WeChat send on this exact build
```

0.1.2 的用户操作文档：[Grok Bot Anywhere 下载与使用教程](https://jcng5q8n0f3z.feishu.cn/wiki/HwHmwM4dcidx8Wko50QcJlgGnyd)；更新说明见 [0.1.2 更新说明](../updates/0.1.2.md)。

在 release note / 交接里写：

```text
Commit: <sha>
macOS: arm64 DMG <size>, x64 DMG <size>; codesign + notarized + stapled
Windows: zip <size>; unsigned; smoke not run
Tests: desktop 129 passed; swift build ok
Not run: Windows install, Touch Bar hardware, real WeChat forward on this build
```

## 不要做

- 不要把 `release/`、DMG、zip 提交进 git（已 ignore）。
- 不要把 `~/.gba-signing/env`、API key、证书密码写进仓库或聊天。
- 不要在产物早于源码时对外发布；先重打。
- 不要把“未签名 zip”描述成可分发安装包。

## 相关

- [打包与签名](../subsystems/packaging.md)
- [构建](build.md)
- [LESSONS](../../LESSONS.md)
