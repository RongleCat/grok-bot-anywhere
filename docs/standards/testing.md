# 测试规范

状态：Current。

## 核心规则

1. **修复必须带一个不带修复就失败的测试。** 提交里写：哪条测试、失败输出是什么。
2. **失败就是 bug。** 不把“旧版本也失败”“全量跑才失败”当基线；先查是否有人已修。
3. **测试不碰真实用户数据/网络。** 临时目录、注入 transport、假的 SDK。
4. **测试行为，不测实现。** 断言用户/调用方需要的契约；格式化和内部重构不应让测试红。
5. **测试自己清理。** 子进程、定时器、临时目录在测试返回前停/删。
6. **时间测试两侧留余量。** 不用墙钟卡死；用注入延迟复现，而不是重跑碰运气。
7. **每个平台的值都要测。** 路径、编码、快捷键、窗口选项至少有纯函数用例；实机行为另记。

## 这个仓库的测试层级

| 层 | 例子 | 不覆盖 |
| --- | --- | --- |
| 纯函数单测 | `shell/actions`、`window-chrome`、`share/model`、`order` | 真实窗口/系统 |
| 状态机单测 | `delivery`、`store`、`session`、`share-inbox` | 真实网络/SDK |
| 契约测试 | RPC、manifest、深链、CLI shim | 真实 Electron |
| 冒烟 | `npm run smoke`、`smoke:native` | 真实账号/微信 |
| 人工验收 | 微信转发、Touch Bar、语音、DMG 安装 | 自动化 |

## 写新测试

- 放在对应模块的 `test/`；命名描述保证，不描述函数名。
- 需要文件就用 `mkdtemp`；不要写仓库里的固定路径。
- 需要账号/凭据就用注入的 fake；不要读 Keychain。
- 需要等待就用条件轮询/事件，不要 `sleep(1000)` 赌时间。
- 断言错误码用稳定码，不断言完整英文句子。

## 验收记录

```text
Ran: <command>
Result: <N> passed, <M> failed (exit <code>)
Not run: <platform/real service/hardware>, because <reason>
```

“未运行”必须写出来；不要留空让读者以为是绿的。

## 相关

- [测试 runbook](../runbooks/test.md)
- [代码规范](code.md)
