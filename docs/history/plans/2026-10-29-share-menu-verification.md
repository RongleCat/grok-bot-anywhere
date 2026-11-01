# Mac sharing correction — verification

- Cause: recipient settings were persisted but the previous development app contained no Share Extension bundles or registration flow.
- Implemented: twelve same-program signed extension slots; installed mutable menu host under the user's Applications directory; native offline ZIP/media/text batching; account/session/policy snapshots; source-ID deduplication; active-slot election and read-back; bounded re-add for asynchronous registration; avatar/name updates with signatures and template-code upgrade detection.
- UI: real registration state and explicit menu update button, automatic disabling of previously installed rows, unavailable Shortcuts/system-share controls marked disabled.
- Current configured destination: one enabled recipient. `pluginkit` confirms `+ dev.ronglecat.grokbotanywhere.menu.slot01`. A read-only system ZIP share enumeration includes `Send to 知识管理员`, alongside the existing reference Codex/Custom entries.
- Extension signed entitlements were read back: app sandbox plus the single ShareInbox filesystem exception; no network permission.
- Tests: 45 desktop Node tests and 8 Swift tests pass. Packaged Electron smoke passes (avatars, local >4MiB receipt, native composer, no web textarea). Code review's account-switch, rollback, background activation, photo-avatar and symlink-diagnostic findings were addressed; final scoped review has no remaining material findings.
- New development app: `desktop/release-share/mac-arm64/Grok Bot Anywhere.app`. It has been opened for user testing. User account credentials and existing local receipts were retained.
- No sharing service was invoked and no real Bot message was sent during automated verification. The final WeChat forwarding interaction is for the user to test; WeChat may need its sharing menu reopened to refresh its cached destinations.

Reference analysis: `docs/history/research/2026-10-29-wechat-share-menu.md`.
