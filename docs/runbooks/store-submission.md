# Microsoft Store 提交

状态：Unverified。最后核对：2026-11-04，基线 f2eacfc，随 Store 打包改动新增（未提交）。尚未向 Partner Center 提交过任何包；`package:win-store` 未在 Windows 上跑过；商店版功能未实机验证。

## 为什么走商店

Store 是目前唯一同时满足「零成本」和「用户安装零 SmartScreen 警告」的路径：

- 个人与公司开发者账号都**没有注册费**，个人只需政府证件 + 自拍，不经过信用卡。
- 提交 Store 的 MSIX **不需要 CA 证书，也不需要自己签名**；认证通过后商店用微软证书重签。
- 用户从商店安装，不触发「未知发布者」或 SmartScreen 拦截。

代价是包标识（PFN/Publisher）由商店分配、每次更新要过认证，以及商店版的注册表与文件写入受 MSIX 虚拟化约束（见[已知限制](#已知限制)）。

创建账号：<https://storedeveloper.microsoft.com> → Individual developer → 用 Microsoft 账号登录 → 手机拍证件与自拍 → 完成资料。**不要**从 Partner Center 或 Visual Studio 进入口，那些入口仍是旧的付费流程。

## 预留名称与拿身份

1. Partner Center → Apps and games → New product → **MSIX or PWA app**。
2. 预留应用名称（reserve name）。这个名字会成为商店展示名。
3. 打开该产品的 **Product identity** 页，抄下三项：

| Partner Center 字段 | 仓库变量 | 形态 |
| --- | --- | --- |
| Package/Identity/Name | `STORE_PACKAGE_NAME` | `12345RongleCat.GrokBotAnywhere` |
| Package/Identity/Publisher | `STORE_PUBLISHER` | `CN=<GUID>` |
| Package/Properties/PublisherDisplayName | `STORE_PUBLISHER_DISPLAY_NAME` | 账号显示名 |

可选：`STORE_DISPLAY_NAME` 覆盖包内显示名，默认 `Grok Bot`。**如果预留名称不是 `Grok Bot`，必须设置它**，包内 `DisplayName` 与预留名称不一致同样会在上传阶段被退回。

这三项必须**逐字符**一致。`Identity Name`、`Publisher` 或 `PublisherDisplayName` 有一处不同，上传阶段就会以包标识不匹配退回，且 MSIX 不能事后改。

## 打包

GitHub Actions → **Windows Store package** → Run workflow，填 app 版本与四段 MSIX 版本（必须大于上一次提交的版本）。产物 `store-msix` 里的 `GrokBot-<version>-x64.msix` 直接上传，**不要自己签**。

本地 Windows：

```powershell
$env:STORE_PACKAGE_NAME='12345RongleCat.GrokBotAnywhere'
$env:STORE_PUBLISHER='CN=<GUID>'
$env:STORE_PUBLISHER_DISPLAY_NAME='<显示名>'
$env:MSIX_VERSION='0.1.4.0'
npm run package:win-store
```

脚本先跑 electron-builder 生成 `release/win-unpacked`，再由 `pack-full.ps1 -Sign Unsigned` 打完整 MSIX，输出到 `desktop/artifacts/full/`。

## 提交

Partner Center → 该产品 → Start submission：

| 步骤 | 要填什么 |
| --- | --- |
| Packages | 上传 `GrokBot-<version>-x64.msix`；架构选 x64 |
| Properties | 分类（Productivity）、系统要求（Windows 10 19041+）、隐私政策 URL、支持联系方式 |
| Age ratings | IARC 问卷；无用户生成内容与应用内购买 |
| Store listings | 至少一张 1366×768 以上截图；中英文描述 |
| Pricing | 免费，可选市场 |
| Notes for certification | 见下一节 |

隐私政策 URL 必须公网可访问。仓库里的 `PRIVACY.md` 需要一个网页地址（GitHub Pages 或站点页面），直接给 `github.com/.../blob/main/PRIVACY.md` 也能打开，但认证员更希望看到普通网页。

## 认证说明模板

Notes for certification 里至少写清四件事，否则常见结果是「无法验证功能」退回：

```text
This is a desktop client for the Grok Bot service. Sign-in requires a Grok account.

Test account: <email / code>  (or: the app runs offline and shows the local UI without an account)

Network access: the app talks to the Grok Bot API on behalf of the signed-in user.
It also watches a local inbox folder for files shared from WeChat.

Capabilities:
- runFullTrust: the app is an Electron desktop app and needs to launch its bundled CLI.
- unvirtualizedResources: the app writes its skill files next to the user profile so the
  bundled CLI can read them.

How to test sharing: open WeChat, forward a file to "Other apps", pick Grok Bot.
```

如果认证期间必须登录，提供可用的测试账号；不提供通常直接退回。

## 已知限制

这些是完整 MSIX 的约束，不是 bug：

- **经典 Explorer 右键菜单预计失效。** 菜单通过 `reg add HKCU\Software\Classes\*` 注册（[actions.mjs](../../desktop/src/shell/actions.mjs)），而打包应用对 `HKCU\Software\Classes` 的写入会被 MSIX 虚拟化到包内，外部资源管理器看不到。商店版需要改用 `windows.fileExplorerContextMenus` 扩展（仅 Windows 11 现代菜单），或接受该功能缺失。未实机确认。
- **userData 路径变化。** 打包应用的 `%APPDATA%` 被重定向到 `%LOCALAPPDATA%\Packages\<PFN>\LocalCache\Roaming`；从 zip 版升级的用户不会自动带过登录态与收件库。迁移尚未实现。
- **更新走商店。** 商店版不应再检查自更新，版本节奏由提交与认证决定。
- **`runFullTrust` 与 `unvirtualizedResources` 是受限能力**，认证时需要理由；被要求整改时通常只能说明用途，不能删除。
- 微信分享目标在商店版是否按预期出现，未实机验证。

## 常见退回原因

| 现象 | 原因 |
| --- | --- |
| 包标识不匹配 | Identity 三件套与 Partner Center 不一致，或用了旧版本号 |
| 无法验证功能 | 没给测试账号，或没写清如何触发分享入口 |
| 缺隐私政策 | URL 为空或打不开 |
| 截图不合格 | 小于 1366×768，或只有窗口边框没有内容 |
| 受限能力未说明 | `runFullTrust` / `unvirtualizedResources` 没写理由 |

## 相关

- [Windows](../platforms/windows.md)
- [打包与签名](../subsystems/packaging.md)
- [发布](release.md)
