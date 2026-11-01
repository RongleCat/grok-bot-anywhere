# scripts

仓库级工具。产品自己的构建脚本在 `desktop/scripts/` 与 `native/macos/scripts/`，不要混。

| 文件 | 作用 |
| --- | --- |
| `run.mjs` | 根 npm 脚本的跨平台启动器；剥掉 `ELECTRON_RUN_AS_NODE` 后转发命令 |
| `check-docs.mjs` | 校验 `docs/catalog.json`、页面状态行、相对链接、旧路径；CI/提交前跑 |
| `agent-runners/run_codex.sh` | 在某个 `projects/<name>` 下跑一个 Codex 任务，保存日志与完成标记 |
| `agent-runners/run_claude_review.sh` | 只读审查任务，结果写回项目 |
| `agent-runners/run_cursor.sh` | Grok 额度耗尽时的 Cursor 备选 |
| `agent-runners/run_grok.sh` | Grok Build 任务 |

Runner 用法：

```sh
scripts/agent-runners/run_codex.sh <project-dir> <task-id> <prompt-file>
```

同一编号只跑一次；日志/`.done`/`.fail` 写到 `<project-dir>/logs/`。

## 文档校验

```sh
node scripts/check-docs.mjs
```

失败会列出具体页面与原因；不要用跳过校验的方式让 CI 变绿。
