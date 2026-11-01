# 构建

状态：Current。

根目录的 `npm run ...` 是跨平台入口；`cd desktop && ...` 是等价的包内命令，只在调试脚本时用。

## 依赖

| 依赖 | 版本/说明 |
| --- | --- |
| Node | >=22.13 |
| npm | 随 Node |
| Swift | 6.0 工具链（macOS 原生伴侣） |
| Xcode CLT | macOS 14+ |
| git submodule | `vendor/bloub`（头像） |
| electron-builder | 随 `desktop` devDependencies |

## 首次安装

```sh
git clone --recurse-submodules <repo-url>
cd <repo>
npm run setup        # 等价于 cd desktop && npm ci
```

如果已经克隆但没有 submodule：

```sh
npm run setup:submodules
```

## 构建顺序

### 1. Electron UI

```sh
npm run build
```

产物：`desktop/out/`（`index.html`、`composer.html`、`app.js`、`composer.js`、`styles.css`、`native-avatar/`）。`out/` 不提交。

### 2. Swift 原生伴侣（macOS）

```sh
npm run build:native
```

它会在 `native/macos/` 执行 `swift build`，把 `TouchBarBot` 与资源复制到 `desktop/native/GrokBotCompanion.app`，ad-hoc 签名。

### 3. 分享宿主与 12 个扩展（macOS）

```sh
npm run build:share
```

产物：`desktop/native/GrokBotMenuHost.app`，含 `PlugIns/GrokBotShare1..12.appex`。不会注册到系统；注册由应用运行时做。

### 4. 头像资源

头像资源是提交在源码里的生成物；改了 `native/macos/avatar/` 后需要重新生成（不是 `build:native` 自动触发）：

```sh
npm run build:avatar
```

输出到 `native/macos/Sources/TouchBarBotApp/Resources/Avatar/`。需要 `vendor/bloub` 与 `desktop/node_modules/esbuild`。

### 5. Swift 独立包

```sh
cd native/macos
swift build
```

## 开发运行

```sh
npm run dev        # 构建 + Electron
npm run dev -- --preview   # 隔离示例工作区，不能发送（透传参数）
```

`npm run dev` / `npm run smoke` 已经通过 `scripts/run.mjs` 剥掉 `ELECTRON_RUN_AS_NODE`；如果绕过根脚本直接 `cd desktop && npm start`，仍需自己 `env -u ELECTRON_RUN_AS_NODE`。

预览使用临时 userData，不读取真实账号，不注册全局快捷键。

## 清理

```sh
rm -rf desktop/out desktop/native desktop/release desktop/artifacts
rm -rf native/macos/.build native/macos/dist
```

不要删除 `desktop/node_modules`，除非准备重新 `npm ci`。

## 常见构建失败

| 错误 | 原因 | 处理 |
| --- | --- | --- |
| `Could not resolve "../vendor/bloub/..."` | submodule 未初始化或 avatar 源码移动后路径错 | `git submodule update --init --recursive`；确认 `native/macos/avatar/*.ts` 指向 `../../../vendor/bloub` |
| `Cannot find module 'esbuild'` | 没装 desktop 依赖 | `npm run setup` |
| `swift: command not found` | 没装 CLT | `xcode-select --install` |
| `link.exe not found` | 在 macOS 交叉编 Windows | 不支持；Windows 原生部分需 Windows 机器 |
| 分享宿主签名失败 | 嵌套 appex 未签或 entitlements 不对 | 用 `package-mac-signed.sh` 的由内向外顺序 |

## 相关

- [测试](test.md)
- [发布](release.md)
- [排障](troubleshooting.md)
