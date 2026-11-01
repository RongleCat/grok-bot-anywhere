# 头像引擎

状态：Current。

## 两条渲染路径

| 运行位置 | 引擎 | 入口 |
| --- | --- | --- |
| Electron 列表 / 输入框 / 宫格 / 设置 | `grok-bot-avatar-engine` 1.0.0（npm tarball，`vendor/`） | `createAvatar`、`createStrip`；`desktop/src/renderer/app.mjs`、`composer.mjs` |
| Swift 原生伴侣 / Touch Bar | Bloub（MIT，`vendor/bloub` submodule）编译成离线 `avatar.js` | `native/macos/avatar/frame.ts`、`runtime.ts`；WKWebView 加载 `Resources/Avatar/` |
| 微信菜单图标 | 渲染一帧 → 44/150 PNG | `desktop/src/main/menu-icons.mjs` |

两套引擎共享**输入契约**：形状、颜色、状态、尺寸、主 Bot 标记。输出像素不要求逐像素一致，但形状/颜色应来自同一份 Bot 数据。

## 身份与派生

- 身份主键是 Bot UUID（`agentId`），不是数字 id，也不是名字。
- 云端显式字段（形状、颜色、图片）优先；缺失的项按 UUID 派生。
- 派生算法在 `packages/client-protocol/avatar.mjs`，纯 JS、无环境依赖；完整规则与验证向量见 [算法说明](../reference/api/bot-id-avatar-algorithm.md)。
- 有自定义头像图片时优先显示图片；URL 不可读时回退角色，不空白。

## Bloub / Swift

- 上游锁定 revision，`vendor/bloub` 以 submodule 管理；**克隆必须带 `--recurse-submodules`**，否则头像构建失败。
- 14 个 catalogue 状态：idle、thinking、wink、wide、alert、notify、exclaim、sleep、egg、hexagon、play、orbit、burst、comet。
- 完整 viewBox `-158 -158 316 316`、眼睛 mask、前后轨道层、粒子层都保留。
- 构建：`node native/macos/scripts/build-avatar.mjs`，用 `desktop/node_modules/esbuild` 打包到 `native/macos/Sources/TouchBarBotApp/Resources/Avatar/`。
- 减少动态效果时渲染静帧；面板关闭时停止动画。
- 8 种默认形状映射到 Bloub；未知显式形状显示本项目的静态近似，不冒充官方 renderer。

## Electron

- 引擎文件在构建时被轻微 patch（眼睛填充色），见 `desktop/scripts/build.mjs`；这是已知的视觉修正，不是升级。
- 列表用 IntersectionObserver 只启动可见头像，避免几十个动画同时跑。
- 主 Bot 星标：60 视口里直径 16 的圆盘，贴右下，填充 `#f59312`；只用于应用内表面。
- 微信菜单图标只展示头像本身，不带主 Bot 星标；菜单动画/标记不进入系统静态图标。
- 原生头像桥 `src/renderer/native-avatar.mjs` 与 Electron 用同一份引擎，输出给 Swift WKWebView。

## 菜单静态图标

微信菜单那一行是系统静态图标，放不进实时画面。更新菜单时：

1. 用 `createStrip` 或 `capture` 渲染该 Bot 当前帧。
2. 导出 44×44 与 150×150 PNG。
3. 写入宿主槽位的 Resources。
4. 重新签名/注册。

图标尺寸不匹配会被系统忽略或显示占位。

## 验证

```sh
node --test native/macos/avatar/renderer.test.mjs
cd packages/client-protocol && npm test     # avatar vectors
npm run test:desktop                       # group avatar / menu icons
```

Swift 侧没有逐像素回归；视觉变化需要看真实窗口和 Touch Bar。

## 相关

- [渲染层](renderer-ui.md)
- [分享菜单](share-menu.md)
- [头像算法](../reference/api/bot-id-avatar-algorithm.md)
