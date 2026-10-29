# Bot ID → 默认头像参数算法

核对日期：2026-10-14。适用客户端：Grok Bot **0.70.2**。

已经完成静态调用链追踪、独立 Node 实现和独立 Python 的 uint32/UTF-16 参考向量验证。默认头像参数完全可以离线求出，不要求账号 token、gateway 或安装官方客户端；本文不把参数算法当作完整头像动画引擎。

## 1. 实際使用哪个 ID

云端 ListGrokBotAgents 返回的字段意义不同：

- `id`：服务端数字标识，JSON 表现为 string，例如 `11635495`。
- `agentId`：本 Bot 的 UUID，例如 `33cf1aae-3a51-452d-b761-34a6ccb62201`。
- 本机 renderer 接收的 `agent.id` 是主进程从云端 `agentId` 映射的 UUID，所以 renderer 中调用 defaultAvatar(agent.id) 不意味着应使用云端原始记录的数字 `id`。

主进程 main-app.cjs 的 `i_` 将云端 `e.agentId` 经 parseAgentId 后写入本机对象的 `id`；另一列表适配器 `Ew` 则把数字标识另存为 `serverId`。renderer 的 `il`/`Ys` 读取本机 `t.id`。

**使用 API 返回的 agentId 字符串原文。** 不按名字计算，不移除 UUID 横线，不更改大小写，不额外 trim/Unicode normalize。同一个 UUID 改成大写会得到另一头像。Swift 实现尤其不要把 UUID 解析后再使用可能改变大小写的 uuidString。

网关/本机模型的 `id` 可能已是 UUID；统一 SDK 必须先做数据来源适配，不能用一个模糊的 `agentId ?? id` 把数字标识混进算法。本次独立模块 `resolveAgentAvatar` 明确接收原始云端记录，仅接受 `agentId`；`deriveDefaultAvatar` 接收已经选好的头像 key。

## 2. 头像选择优先级

1. 有自定义图片（图片 URL/data URL 或 avatarVersion 标记）时，显示该图片。只有 version 时还需走图片读取机制；不能猜出图片 URL。
2. 没有自定义图片时，形状、颜色分别判断显式配置是否在当前版本有效列表中。
3. 每个未提供、空白值或无效的字段，独立退回 ID 派生的默认值。不是任意一个字段为空就把两个配置一起丢掉。

默认选择池只有 **8 种形状 × 10 种颜色 = 80 种组合**。编辑器允许 25 种形状、11 种颜色，其中黑色可以显式选择，但不参与默认随机色池。不能要求所有 Bot 的头像各不相同。

## 3. 基础 ID 哈希

使用 FNV-1a 的 32 位循环，但字符输入是 JavaScript `charCodeAt` 对应的 **UTF-16 code unit**，不是 UTF-8 bytes 或 Unicode code point。

```js
let h = 2166136261;
for (let i = 0; i < key.length; i++) {
  h = Math.imul(h ^ key.charCodeAt(i), 16777619);
}
h = h >>> 0;
```

Math.imul 保留乘法低 32 位；`>>>` 是无符号右移，`>>> 0` 将结果解释为 uint32。将代码直接翻成 Python/C/Swift 时必须显式处理整数宽度；不能用普通 JavaScript 浮点乘法替代 Math.imul。

实际 UUID 只有 ASCII，但 UTF-16 语义仍写入兼容协议，参考向量包含非 BMP 字符，防止未来把原始 key 的编码方式改掉。

## 4. 默认形状

在 h 上再做一次 32 位混合：

```js
let s = h | 0;
s = Math.imul(s ^ (s >>> 16), 73244475);
s = Math.imul(s ^ (s >>> 13), 3266489909);
s = (s ^ (s >>> 16)) >>> 0;
const shapeIndex = s % 8;
```

候选列表的顺序必须固定：

| Index | Shape | 含义 |
| --- | --- | --- |
| 0 | blob | 不规则团子 |
| 1 | pebble | 圆润卵石 |
| 2 | squircle | 方圆形 |
| 3 | tablet | 圆角长方形 |
| 4 | wedge | 楔形 |
| 5 | hex | 六边形 |
| 6 | cloud | 云朵 |
| 7 | teardrop | 水滴 |

选形状不是直接 `h % 8`，必须经过上面的额外混合。

## 5. 默认颜色

当前客户端保留两个独立版本盐值，均为 1：

```js
const identitySeed = (h ^ Math.imul(1, 2654435769)) >>> 0;
const paletteSeed = (identitySeed ^ Math.imul(1, 2654435769)) >>> 0;
```

这版两次 XOR 恰好抵消，最终 seed=h。但它们是两个配置位置，后续可能分别改动，独立实现仍保留这两个步骤并标注版本。

对 paletteSeed 使用 Mulberry32 形式的 PRNG，**只取第一个样本**：

```js
let t = (paletteSeed + 1831565813) | 0;
let n = Math.imul(t ^ (t >>> 15), 1 | t);
n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
const r = ((n ^ (n >>> 14)) >>> 0) / 4294967296;
const colorIndex = Math.floor(r * 10);
```

这里没有系统随机数，不会每次重启换色，也没有按名称生成随机种子。形状和颜色在同一个基础哈希上走不同路径。

| Index | Color | 色板基础色 | 静态图标 light | 静态图标 dark |
| --- | --- | --- | --- | --- |
| 0 | brown | #936439 | #A27952 | #855C36 |
| 1 | red | #FF263C | #FF3E51 | #E02135 |
| 2 | orange | #FF6700 | #FF781C | #FF6700 |
| 3 | yellow | #FF9800 | #FFAF38 | #FF9800 |
| 4 | green | #00C972 | #00C972 | #009957 |
| 5 | cyan | #00BCA6 | #1CC3B0 | #00A592 |
| 6 | blue | #1084FE | #2A92FE | #0E74E0 |
| 7 | violet | #9159FE | #A97EFE | #804EE0 |
| 8 | magenta | #FF309B | #FF5EB1 | #E02A88 |
| 9 | gray | #777777 | #959595 | #777777 |

基础色来自 zf 色板；静态图标 light/dark 色来自 qf/mN（在 renderer 中通过 ti 引用）。界面还有另一套渐变色 Zw，因此基础色不等于每个截图像素的颜色。此前 Webhook 头像报告的 #936439 指色板基础色，不是对截图取色。

## 6. 参数如何变成实际图像

renderer 的静态头像调用链：

```text
云端 agentId → 本机 agent.id
           → il / Ys（显式参数或 ID 默认参数）
           → lh / E8e
           → gr(shape) 的身体几何 + light/dark ink
           → gD 生成静态图像
```

E8e 缓存 key 为 `shape:color`，调用 gr 时只传 shape，不传 ID。因此这条普通默认静态头像路径中，ID 控制的是形状/颜色选择，不再为每个 ID 单独随机生成身体或眼睛。相同 shape/color 的默认静态图像可以共享缓存。

动态头像另外接收 markState、isRunning/isComposingMessage、实时交互/时间等状态。Bot ID 不是完整动画的编码，不会仅凭 UUID 得出当前“思考/工作/说话”状态。眼睛、身体细节、动画等由渲染器决定。当前独立模块只复现参数规则；没有复制官方闭源 renderer 或把默认头像参数声明为官方开放 SDK。

## 7. Webhook 测试员的计算链

```text
agentId    = 33cf1aae-3a51-452d-b761-34a6ccb62201
FNV hash   = 287548938
shapeHash  = 4017622118
shapeIndex = 6 → cloud
colorIndex = 0 → brown
```

与此前客户端实际截图中的棕色云朵一致。若误用数字 ID `11635495`，结果是 shapeIndex=7 → teardrop，颜色仍是 brown；颜色碰巧相同并不代表 ID 选取正确。

如果把同一个 UUID 改成大写 `33CF1AAE-3A51-452D-B761-34A6CCB62201`，结果为 tablet/red，进一步证明字符串原文影响结果。

## 8. 独立实现与验收

实现：[client-mvp/avatar.mjs](../../client-mvp/avatar.mjs)。纯 JavaScript，无环境和账号依赖；可作为后续 SDK 的参数模块。

```js
import { deriveDefaultAvatar, resolveAgentAvatar } from './client-mvp/avatar.mjs';

const defaults = deriveDefaultAvatar('33cf1aae-3a51-452d-b761-34a6ccb62201');
// defaults.shape === 'cloud'; defaults.color === 'brown'

// agent 是 ListGrokBotAgents 返回的原始记录
const resolved = resolveAgentAvatar(agent);
// resolved.kind: character 或 picture
// resolved.character: shape/color/baseHex/lightHex/darkHex
// resolved.sources: 形状/颜色各自为 explicit 或 id-default
```

verify CLI 仍然输出名单脱敏统计，没有改为打印所有账号头像或 Bot ID。调用者可以在取得名单后使用 resolveAgentAvatar，不需要为了获取默认参数去打开客户端。

Python 独立 uint32/UTF-16 实现生成了 7 个固定参考向量，Node 测试逐项比对 hash、shapeHash、shapeIndex、colorIndex、shape、color。参考向量不是从被测试的 Node 模块生成，也没有执行官方 bundle。

还测试了：云端数字 id 不被当作头像 key、部分显式配置分别覆盖、black/heart 可显式指定、自定义图片优先、主题颜色、异常 JSON 类型不能伪装成有效色板 key。完整离线测试共 28 个通过。

```sh
node --test client-mvp/test/avatar.test.mjs
node --test client-mvp/test/*.test.mjs
```

Swift 端应遍历 `key.utf16`，使用 UInt32、溢出乘法 `&*` 和溢出加法 `&+`，按同样的数组顺序和 PRNG 首个样本实现。当前没有实现或验收 Swift/Watch 版本，参考向量可用作跨端兼容验收。

## 9. 可追溯的静态证据

- `main-app.cjs`：i_ 将云端 agentId 映射为本机 id；Ew 保留 serverId/agentId 的区别。
- `index.eager-platform-DUN5VkaE.js`：jf/Ww/Uw/Kw/Xw/Yw/fN/dN；形状与色板顺序、版本盐值、静态色。
- `index-CjjO5fU0.js`：il/Ys、显式参数有效性和默认回退；通过 agent.id 使用头像 key。
- `index.eager-app-fbmFpqqH.js`：E8e（导出 I，renderer 导入为 lh），静态图像 body/ink 和 shape:color 缓存。
- [参考向量](../../client-mvp/test/fixtures/avatar-vectors.json)、[验证摘要](avatar-algorithm-verification.json)、[先前头像实测报告](webhook-avatar-inspection.json)。

本结论来自本机 0.70.2 发布包的静态分析及独立复算，未读取新的账号凭据、未修改头像、未发送消息。未来客户端版本的盐值、候选列表、配色或 ID 适配变化都需要重新核实，不能把候选列表排序或“改大小写不影响 UUID 身份”等一般假设套用到该算法。
