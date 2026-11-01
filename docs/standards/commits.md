# 提交规范

状态：Current。

## 一个提交一个目标

- 两个不相关的修复 = 两个提交；这样 revert 只回退一个。
- 顺手发现的问题另开提交，不塞进当前改动。
- 大规模格式化/重命名单独提交，避免淹没行为 diff。

## 消息格式

```text
<area>: <用户可见的变化，一句话>

<body: 为什么、影响范围、验证命令与结果、未运行项>
```

`area` 示例：`desktop`、`native`、`share`、`service`、`cli`、`docs`、`build`。

好的例子：

```text
desktop: keep the direct send deadline at 90 seconds

The receipt deadline is created at intake, not at submit. A retry after
90 seconds must expire instead of sending late.

Ran: npm run test:desktop (129 passed)
Not run: Windows smoke
```

## 必须写进提交的内容

- 验证命令与结果（通过/失败、数量、退出码）。
- 未运行的平台/真实服务/硬件，以及原因。
- 行为变化的前后对比（如果用户能感知）。

不写：token、密钥、用户聊天内容、私有 Bot ID、本机绝对路径。

## 不要提交

- `desktop/release/`、`out/`、`native/` 构建产物、`node_modules/`、`.build/`。
- 签名材料（`~/.gba-signing/env`、证书、API key）。
- 真实账号报告（除非已脱敏且项目约定保留在 `docs/reference/api/`）。

## 提交前

```sh
git status --short
git diff --stat
npm run test:desktop
npm run docs:check
```

确认 `git show --stat HEAD` 只包含你的文件。

## 相关

- [代码规范](code.md)
- [测试规范](testing.md)
