# 头像动画调研与导入方案

调研日期：2026-10-14。以下区分本机检查结果、上游公开事实及本应用的设计建议。

## 结论

本机确实安装了 **Grok Bot.app**，它的 avatar 实现可以在应用 bundle 中找到，但没有发现一个可独立导出的完整头像动画包。头像形状、颜色和交互状态与 React 程序一起编译，直接拿这些闭源代码作为本应用资源不适合作为可分发依赖。本阶段默认采用用户提供的 **bloub**，使用它完整的 procedural SVG engine 离线渲染。它是社区对 x.ai 头像的复现，不是 Grok 官方 SDK 或官方授权 artwork。

bloub 代码已下载到 `vendor/bloub/`，锁定 `b4bb3c1b5f93c7b87a2e8d620f667c4093d97749`。已准备带许可证和校验值的静态 SVG、状态参考图与 GIF 参考动画：`assets/bloub/`。未执行上游任何 install/build/tool 脚本，也未复制本机闭源 app assets。

## 本机检查证据

检查范围仅限 `/Applications` 中应用自身的公开 bundle 文件；没有访问 Keychain、cookies、聊天数据库、账号存储或用户私人图片目录。

| 应用 | 实际情况 | 对本应用的含义 |
| --- | --- | --- |
| `/Applications/Grok Bot.app` | Electron 应用。`Contents/Resources/app.asar` 约 42.9 MB；可以读取 archive 的文件清单和静态程序代码。 | 用户说的 Grok Bot 有实际本机应用对应，不能简单替换理解为 Cursor Cloud Agents。 |
| Grok Bot avatar 编辑器 | 有 `dist/electron-preload/preload-avatar-source.cjs`、`chunk-agent-avatar-editor-D_B575Am.js`、`chunk-agent-character-picker-CEuUTll_.js`。上传路径会缩放图像并调用 `setAgentAvatarBytes`，形状/颜色字段为 `avatarShape`、`avatarColor`。 | 静态自定义头像与默认程序化头像是不同输入。上传处理代码不是动画导出接口。 |
| Grok Bot default avatar | 主 renderer bundle 包含程序化形状/颜色、mark 状态、`isRunning`、`isComposingMessage`、`awaitingUserResponse`、`currentActivity` 等相关渲染逻辑。 | 能确认动画由程序驱动，不能由文件清单得出完整官方状态契约。 |
| Grok Bot 独立动画资源 | 该 archive 中未见独立 avatar GIF/WebP/MP4/WebM、Lottie/Rive、GLB/GLTF；资源清单主要是服务图标和声音。 | 未找到可以直接导出、合法独立打包的完整头像资产；此结论仅针对当前安装包。 |
| Grok Bot WebGL | bundle 有 `canvas-building-field` 装饰 shader。 | 这个 WebGL 代码不是头像本身的证据，不能把官方头像笼统称为 WebGL。 |
| `/Applications/Grok.app` | Resources 只见 `icon.icns`，另有本机 executable。 | 未见可复用完整交互动画。未对 executable 做反编译。 |
| `/Applications/Cursor.app` | Resources/app 文件清单中未找到 avatar/mascot/spritesheet/Lottie/Rive/3D 模型。 | Cursor IDE 的普通 icon 无法满足需求。 |
| `/Applications/ChatGPT.app` | 包含多种 Work Pets 的 spritesheet，和独立 avatar overlay bundle。 | 它们是 ChatGPT Pets，和 Grok Bot 头像不同；没有复制，也不把它们冒充 Grok assets。 |

[Cursor 官方 settings 文档](https://prod.cursor.com/docs/grok-bot/settings)支持每个 Bot 更换头像，并描述 working/attention/unread 状态；文档没有提供可独立复用默认动画 renderer 的导出 API。此次在官方文档检索中也未找到这种公开 API，因此实现不依赖私有 bundle 函数名。是否存在未公开接口仍需官方确认。

## bloub 的真实能力

上游 [README](https://github.com/jeremy-prt/bloub) 和 [architecture](https://github.com/jeremy-prt/bloub/blob/main/docs/architecture.md) 与本次固定版本源码一致：使用 TypeScript 生成 SVG 路径，眼睛通过 mask 开洞，轮廓采用径向采样与插值，前后景轨道与粒子有遮挡顺序。没有动画库、WebGL、远端模型或在线素材依赖。

- 14 个 catalogue 状态：`idle`, `thinking`, `wink`, `wide`, `alert`, `notify`, `exclaim`, `sleep`, `egg`, `hexagon`, `play`, `orbit`, `burst`, `comet`。
- 另有 UI 过渡 `swirl`，它不属于 14 状态的 `SEQUENCE`。
- 8 种可配置形状、12 色、16 种 rest expressions；自定义外形只替换允许的 base-body 状态，不能强制覆盖所有形变。
- 框架无关 engine：`new BotEngine(100, state, shapeRadii, expression)`，`setState(state, seconds)`，`setShape(radii, seconds)`，`setExpression(expression, seconds)`，`setLook(look, seconds)`，`sample(seconds)`。`sample` 是确定性的时间采样；时钟由 UI 宿主管理。
- 完整画幅为 `viewBox="-158 -158 316 316"`，不是只包含 radius 100 body 的窄裁切；orbit/comet 的外圈需要 margin。
- 静态 export 支持 SVG/PNG；idle 的 animated SVG 只动画眼睛，不能代替完整 state morph。完整 timeline 支持 GIF/MP4 export。

## 推荐导入管线

### 输入框：WKWebView + 离线 SVG

首选原生 AppKit/SwiftUI 输入框，只有头像区域嵌入 WKWebView。将 `src/bot/` 和一个小 SVG renderer 构建成应用内的 HTML/JS 文件，用 `loadFileURL(_:allowingReadAccessTo:)` 载入本机 bundle。另一种实施方式是包内 Vue `BloubBot.vue`，但不加载上游 studio/sidebar/editor，避免整站 UI 混入本机输入框。

用 JSON 传递 `botId`, `state`, `shape`, `color`, `expression`, `reducedMotion`, `visible`，不要把聊天内容或任意 executable JS 暴露给头像。Swift 发送字面量 JSON，JS 仅调用 engine setter；不要拼接用户输入进 `evaluateJavaScript`。头像没有任何联网需求，生产构建应用 CSP 禁止网络请求。所有依赖和字体在 build 阶段本机打包。

`requestAnimationFrame` 只在面板可见时运行；面板关闭/隐藏取消循环，打开恢复相同状态。在 Reduce Motion 下使用确定性 still frame，在动画故障时回退到静态头像。录音强度如果需要驱动 avatar，由录音层发送归一化 amplitude；bloub 目前没有原生音频反应状态，不应声称它已经支持音频 lip sync。

静态 Bot 自定义图片优先用于 Touch Bar 和识别信息；bloub 可以按 Bot 的颜色/形状做对应。如果官方形状/色彩枚举和 bloub 枚举不同，应有显式映射与 fallback，不能假设字段字符串一致。

### Touch Bar：缓存静态头像

Touch Bar 每个小 item 默认使用缓存的 NSImage；选中 item 高亮且显示 Bot 名称。大号完整 morph 动画在输入面板中展现，避免为全部 Touch Bar items 创建 WKWebView。必要时仅为选中 item 用同一 engine 离屏采样生成小号 bitmap，限制刷新率和缓存数量。由 carousel 控制选择，不由头像动画控制选择。

### 应用状态到动画状态

以下是本应用建议映射，**不是官方状态定义**。`assets/bloub/animation-contract.json` 保存同一版本信息。

| 应用状态 | bloub 状态 | 行为 |
| --- | --- | --- |
| idle / composing | idle | 轻微眼神漂移与 blink |
| listening | wide | 保持录音反馈，独立显示录音时长与波形 |
| sending | comet | 仅发送过程中短暂使用 |
| thinking | thinking | 需要有真实 SDK 事件或请求状态支持 |
| working | orbit | 长任务执行中 |
| waitingForUser | notify | 需要问题回答、审批或接管时 |
| blocked | alert | 任务被阻塞 |
| done | wink → idle | 完成时短暂反馈 |
| error | exclaim | 配合实际错误文本，不用动画代替错误信息 |

形变、眼睛、mask、body 底色、通知 notch、渐变、orbit 后半/前半绘制顺序必须一起保留。仅提取一个 SVG circle 或 GIF loop 会失去完整交互能力。长期如果需要纯 Swift renderer，应通过 `BotFrame` 到 CGPath 的适配逐层移植，做固定时间截图对照；第一阶段 WKWebView 更少引入数学与视觉差异。

## 开发依赖与离线性

完整上游 studio 在当前固定版本是 Vue 3 / Vite 8 / TypeScript 5.9 / Tailwind 4，并声明 `pnpm@11.17.0`。这些是上游工程环境，并非本应用必须携带的全部依赖。只消费 `src/bot` 时 runtime 无第三方库；Vue host 只需 Vue，TypeScript/bundler 仅在 build 阶段。MP4 export 使用 `mediabunny` 的 lazy import，它只在导出视频时需要；本应用不需要视频 encoder。不能把 README 的 lazy fetch 理解为所有动画要联网。

以后启用构建，应先审查 package lock 和 scripts，固定构建器版本，然后使用仓库自己的明确构建命令。此次只克隆和读取上游，没有运行未知脚本。

## 许可与分发

[MIT LICENSE](https://github.com/jeremy-prt/bloub/blob/main/LICENSE) 要求分发代码或 substantial portions 时保留原作者版权与许可；已保存在 vendor 与 assets 中。程序内 Credits 应写 “Avatar engine: Bloub by Jérémy Perret (MIT)” 并链接上游。上游明确指出 MIT 覆盖代码，不覆盖所模仿的 x.ai 设计；因此不要以“Grok 官方头像/官方 SDK”发布。后续若得到官方资源导出接口或复用许可，可在同一 AvatarRenderer abstraction 后替换，业务层无需改动。
