# Contributing

感谢你愿意帮忙。这个项目是**非官方**客户端，维护重点是投递可靠性、跨平台边界和可验证的结论。开始之前请先读 [AGENTS.md](AGENTS.md) 和 [docs/standards/](docs/standards/code.md)。

## 可以贡献什么

- Windows 实机报告：窗口、托盘、Explorer 右键、悬浮输入框、安装包、`grokbotanywhere://`。
- 微信版本差异：转发菜单是否出现、菜单顺序、缓存行为、ZIP/文本/媒体导入。
- 投递问题：状态卡住、文件丢失、重复、未确认无法解锁，附复现步骤。
- 文档修正：路径失效、平台结论不准确、命令跑不通。
- 代码：小步、可测试、不改变无关行为的修复。

## 开发流程

```sh
git clone --recurse-submodules <repo-url>
cd grok-bot-anywhere
npm run setup
npm run test:all
npm run docs:check
```

- 依赖只装在 `desktop/`；不要在根目录 `npm install`。
- 开发启动用 `npm run dev`（会处理 `ELECTRON_RUN_AS_NODE`）。
- 改动涉及行为时，先加一个不带改动就失败的测试，再改实现。
- 纯文档改动至少跑 `npm run docs:check`。

## PR 约定

1. **一个 PR 一个目标。** 不相关的重构、格式化另开。
2. **写清验证。** 命令、通过数量、失败输出、未运行的平台/硬件。
3. **平台结论要标来源。** macOS 上跑过就说 macOS；Windows 没跑就写「未运行」，不要写「应该可以」。
4. **不要提交** token、cookie、真实聊天内容、私有 Bot ID、签名证书、`release/` 产物。
5. **文档跟着行为走。** 改契约时同步改拥有者页面和 `docs/catalog.json`。

提交信息格式见 [docs/standards/commits.md](docs/standards/commits.md)。

## 报告问题

请附：

- 操作系统与版本、应用版本或 commit。
- 复现步骤，尽量最小化。
- 实际结果与期望结果。
- 相关日志的脱敏片段（不要贴 token、cookie、聊天全文）。

投递问题如果涉及「未确认」，请说明你有没有在官方客户端核对，以及是否点过「已核对，解锁发送」。

## 行为准则

- 对事不对人；不要求维护者接受未经验证的重构。
- 不公开他人的账号、Bot ID、聊天内容或凭据。
- 安全/隐私问题不要开公开 issue；按 [SECURITY.md](SECURITY.md) 的渠道联系维护者。

## 许可

提交 PR 即表示你同意以本仓库的 [MIT](LICENSE) 许可提供你的贡献。
