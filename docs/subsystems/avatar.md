# 头像引擎

状态：Current。

## 渲染路径

| 运行位置 | 引擎 | 入口 |
| --- | --- | --- |
| Electron 列表 / 输入框 / 宫格 / 设置 | `grok-bot-avatar-engine` 0.1.0（Grok Bot 0.78.1 客户端渲染器移植，npm tarball，`vendor/`） | `desktop/src/renderer/avatar-adapter.mjs`；`app.mjs`、`composer.mjs`、`share-picker.mjs` |
| Swift 主界面 / Touch Bar 动画 | 优先 `out/native-avatar` 的 0.1.0 桥；GrokHost 不可用时回退 Bloub（MIT，`vendor/bloub` submodule） | `native/macos/.../AnimatedAvatar.swift`、`desktop/src/renderer/native-avatar.mjs` |
| Swift Touch Bar 位图 / 微信菜单图标 | 0.1.0 桥或宿主引擎渲染一帧 → PNG | `native/macos/.../GrokAvatarEngine.swift`、`desktop/src/main/menu-icons.mjs` |

Electron 路径和原生头像桥共享同一份引擎。Swift 的 Touch Bar 位图由 `desktop/src/renderer/native-avatar.mjs` 打包出的 `out/native-avatar/bridge.js` 提供，和主窗口使用同一套形状、颜色、状态。

## 0.1.0 的 API 变化

1.0.0 是本项目自带的动画封装；0.1.0 是客户端渲染器的移植，属于重写级变化：

- 26 个选择器形状（新增 `pumpkin`）、26 个渲染体、53 个状态、11 个颜色；`blob`/`flower`/`heart`/`star` 是别名。
- 眼睛改为从身体挖空，不再是画上去的白点。
- `createAvatar` 仍返回 controller，但去掉了 `capture`、`setShape`、`setColor`、`setMain`、`setVisible`、`setReducedMotion`；新增 `setBody`、`setPlaying`、`setExpression`、`gaze`。
- 去掉了 `createStrip`、`renderAvatarPng`、`colorHex`、`PALETTE`、`main`、`theme`、`reducedMotion`。
- 颜色表只有一组客户端色值；主 Bot 星标在 0.78.1 渲染器里不存在。

这些差异收在 `desktop/src/renderer/avatar-adapter.mjs`，调用方仍使用 `createAvatar` / `createStrip` / `renderAvatarPng` / `colorHex`。适配层负责：

- 把 `theme` 映射回 `avatar-ink.mjs` 里的 light/dark 色值，再以显式 hex 交给引擎；
- 用 `isStatic` 接住 `reducedMotion`；
- 用 Shadow DOM 隔离每个实例的 defs/mask id（引擎默认挂到 light DOM，同形状头像会撞 id）；
- 补回主 Bot 星标与右下缺口（`#f59312`；按身体包围盒定位：直径约为身体宽的 27.6%，圆心在身体宽 87%、高 97% 处，比参考图再往右下让一点，减少对图案的侵入；
- 用 SVG → canvas 重新实现 `capture` 和 `renderAvatarPng`；
- 用普通 DOM 单元格重新实现 `createStrip`。

上游 0.1.0 的 `resolveAvatar` 在显式 `avatarColor` 上缺一个颜色表绑定；适配层不把 `avatarColor` 直接交给它，而是转成 `color`。直接调用引擎的 `resolveAvatar({avatarColor})` 会抛 `gn is not defined`，升级上游后应重新核对这一条。

## 身份与派生

- 身份主键是 Bot UUID（`agentId`），不是数字 id，也不是名字。
- 云端显式字段（形状、颜色、图片）优先；缺失的项按 UUID 派生。
- 派生算法在 `packages/client-protocol/avatar.mjs`，纯 JS、无环境依赖；完整规则与验证向量见 [算法说明](../reference/api/bot-id-avatar-algorithm.md)。
- `VALID_SHAPES` 已补上 `pumpkin`；显式南瓜不会被打回派生形状。默认随机池仍是 8 种形状 × 10 种颜色，南瓜不进默认池。
- 有自定义头像图片时优先显示图片；输入框、宫格和分享选择面板按容器 `cover` 填充，不按原图像素撑破窗口。
- 眼睛是挖空的，暗色模式里黑色 Bot 的身体由适配层换成白色，挖空处透出背景，不会出现白底白眼睛。
- URL 不可读、协议不允许或图片加载失败时回退角色，不空白；微信菜单的方图会先居中裁成正方形，避免非正方形图片被拉伸。

## Bloub / Swift

- 上游锁定 revision，`vendor/bloub` 以 submodule 管理；**克隆必须带 `--recurse-submodules`**，否则头像构建失败。
- 14 个 catalogue 状态：idle、thinking、wink、wide、alert、notify、exclaim、sleep、egg、hexagon、play、orbit、burst、comet。
- 完整 viewBox `-158 -158 316 316`、眼睛 mask、前后轨道层、粒子层都保留。
- 构建：`node native/macos/scripts/build-avatar.mjs`，用 `desktop/node_modules/esbuild` 打包到 `native/macos/Sources/TouchBarBotApp/Resources/Avatar/`。
- 减少动态效果时渲染静帧；面板关闭时停止动画。
- 8 种默认形状映射到 Bloub；未知显式形状显示本项目的静态近似，不冒充官方 renderer。

## Electron

- 引擎 tarball 指向 `0.1.0`，构建时不再 patch 引擎源码；眼睛对比度由渲染器自己的挖空和适配层的主题色处理。
- 列表用 IntersectionObserver 只启动可见头像，避免几十个动画同时跑。
- 主 Bot 星标由适配层叠加：橙色圆盘 + 圆角五角星，按身体包围盒定位并随尺寸/形状重算，圆心取身体宽 87%、高 97%；CSS mask 在头像上切出同一位置的缺口，缺口半径比星标半径多身体宽的 5.2%。只用于应用内表面。
- 微信菜单图标只展示头像本身，不带主 Bot 星标；菜单动画/标记不进入系统静态图标。
- 菜单图标保留透明背景，Finder/微信自己提供背后的材质；不要把白底烤进 PNG。
- 原生头像桥 `src/renderer/native-avatar.mjs` 走同一个适配层；`renderStrip`、`acknowledge`、`nodNeighbors` 的桥接签名保持不变。

## 菜单静态图标

微信菜单那一行是系统静态图标，放不进实时画面。更新菜单时：

1. 用 `captureMenuAvatar`（单头像）或 `renderStackPng`（群聊堆叠）渲染该 Bot 当前帧。
2. 导出 44×44 与 150×150 PNG。
3. 写入宿主槽位的 Resources。
4. 重新签名/注册。

图标尺寸不匹配会被系统忽略或显示占位。

## 验证

```sh
node --test native/macos/avatar/renderer.test.mjs
cd packages/client-protocol && npm test     # avatar vectors + pumpkin gate
npm run test:desktop                       # engine, adapter palette, group avatar, menu icons
npm run smoke                              # Electron 隔离冒烟，avatarCount 应大于 0
```

Swift 侧没有逐像素回归；视觉变化需要看真实窗口和 Touch Bar。Electron 侧的南瓜和菜单图标已用隐藏窗口实际截过 PNG；Swift 的 Touch Bar 未在真机回归。

## 相关

- [渲染层](renderer-ui.md)
- [分享菜单](share-menu.md)
- [头像算法](../reference/api/bot-id-avatar-algorithm.md)
