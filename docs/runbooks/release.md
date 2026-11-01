# 发布

状态：Current。macOS DMG 已能签名+公证；Windows 只有未签名 zip。

## 发布前检查单

- [ ] `git status` 干净；要知道发布的是哪个 commit。
- [ ] `npm run test:all` 通过（记录数字）。
- [ ] `cd native/macos && swift build` 通过。
- [ ] `npm run build` 成功；`out/` 与源码一致。
- [ ] 版本号在 `desktop/package.json` 里已更新（当前 0.1.0）。
- [ ] 签名环境 `~/.gba-signing/env` 存在且未过期。
- [ ] 产物时间晚于最后一次源码/配置修改；否则重打。
- [ ] 在干净用户目录安装并启动一次（至少 macOS）。

## macOS

```sh
cd desktop
npm run build:native
npm run build:share
npm run package:mac-all
```

产物：

```text
release/Grok Bot Anywhere-0.1.0-arm64.dmg
release/Grok Bot Anywhere-0.1.0.dmg        # x64
```

校验：

```sh
codesign --verify --deep --strict "release/mac-arm64/Grok Bot Anywhere.app"
codesign -dv --verbose=2 "release/mac-arm64/Grok Bot Anywhere.app"
spctl -a -vvv -t install "release/mac-arm64/Grok Bot Anywhere.app"
xcrun stapler validate "release/Grok Bot Anywhere-0.1.0-arm64.dmg"
```

`codesign -dv` 应显示 Developer ID、`flags=0x10000(runtime)`、`Notarization Ticket=stapled`。

## Windows

```powershell
cd desktop
npm run package:win
```

产物 `release/Grok Bot Anywhere-0.1.0-win.zip`，未签名。**发布前必须在 Windows 机器上解压启动一次**；当前没有这条证据。

## 发布记录

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
