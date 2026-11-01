# native/macos

macOS 原生伴侣。Swift Package，产物 `TouchBarBot` 被打包为 `desktop/native/GrokBotCompanion.app`；分享扩展宿主是 `GrokBotMenuHost.app`。

职责、协议与边界见：

- [原生伴侣](../../docs/subsystems/native-companion.md)
- [原生协议](../../docs/reference/native-protocol.md)
- [macOS](../../docs/platforms/macos.md)

## 常用

```sh
cd native/macos
swift build
./scripts/test.sh          # Swift 测试
./scripts/build-app.sh     # 独立 .app（旧路径，产物在 dist/）
node scripts/build-avatar.mjs
```

Electron 打包用 `cd desktop && npm run build:native` / `build:share`，不要在这里手动复制。

## 注意

- `vendor/bloub` 是 submodule；头像构建前先 `git submodule update --init --recursive`。
- 本目录只放原生代码与资源；不要读 Electron ASAR，不要直接发消息。
