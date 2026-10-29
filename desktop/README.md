# Grok Bot Anywhere — Electron

Electron migration milestone. The original Swift application remains available at the repository root.

## Run on this Mac

```sh
cd desktop
npm ci
npm run build:native
npm run build:share
npm start
```

The shared window supports browser login, explicit local Grok Bot login on Mac, roster refresh, per-Bot recipient settings, theme and receipt history. The Mac companion reuses the current AppKit composer, IME protection, Tab picker, Touch Bar and speech code. Close the original Touch Bar Bot before using the new app so it does not compete for the same global shortcuts.

The Mac sharing build includes twelve Share Extension slots. Enabling/disabling a WeChat recipient, changing its name/avatar, or switching accounts automatically reconciles the system menu. Updates are debounced and serialized; a newer account state revokes old bindings immediately and supersedes a stale installer. Settings retains **Update forwarding menu** for retry. Each slot has an independent containing application under the ordinary folder `~/Applications/Grok Bot Anywhere Menu/Contents/Helpers`, with the same Bot icon in its application and extension resources. Nesting these inside another application causes macOS to return a placeholder icon. Reopen WeChat's forwarding menu after updating; if it caches the old menu, reopen WeChat. Development `npm start` does not install share destinations; use the packaged application.

Share extensions have no network permission. They copy ZIP/text/media to `ShareInbox/Ready`, and the service deduplicates/imports batches into the durable inbox before delivery. Account-mismatched batches remain local. Separate menu applications keep metadata updates from replacing a running composer or changing Electron's credential-storage identity.

Open a Bot to type using the native composer. For file intake, enable the Bot as a recipient and enable Drag and drop in Settings, then drop files onto its roster row. Compose-first intake is saved before the companion opens; if another draft is already open, the new item remains in Inbox. Direct intake uses the snapshotted prefix and Bot, uploads first, then submits once.

```sh
npm start -- --preview     # isolated sample workspace; cannot send
npm test                  # temporary SQLite/files and injected transports
npm run smoke             # Electron UI + >4MiB local intake + native open/hide if built
npm run smoke:native      # build Mac companion and verify native draft protection
npm run package           # local unsigned/ad-hoc unpacked app under release/
```

`smoke` captures roster/settings/inbox screenshots under `artifacts/`. Preview/smoke uses OS temporary storage and never restores an account or reads desktop credentials. It does not register global shortcuts during native smoke.

## Boundaries

- Renderer has no Node integration and no credentials. Named preload operations call an allowlisted main-process handler; only the main frame of the local window is accepted. Bot operations run in an Electron Node utility process through the independent SDK.
- Credentials use Electron's asynchronous OS-backed safeStorage, with no plaintext fallback. Receipt SQLite and managed file copies live under the application's user-data directory. Local intake works after token expiry; sending requires login.
- The service serializes sends per Bot and prevents account changes during delivery. Direct delivery expires after 90 seconds before submission; an attempted send with no definite result remains unconfirmed. Restart recovers an in-flight send as unconfirmed. Nothing automatically retries it.
- After checking an unconfirmed item in Grok Bot, use “Checked, unlock sending.” This releases the Bot for new messages; the original item stays unconfirmed and is not resent.
- Files have no legacy 4MiB intake limit. Single-PUT uploads stream from disk; multipart modes remain unsupported and fail without discarding files. The base64 gateway transport currently has an explicit 64MiB memory guard. Live large-file service limits have not been verified.
- The SDK exposes Bot/session messages rather than request-correlated replies. New live events are attached to the latest sending/sent receipt for that session, with replay filtered. Exact per-request reply association is not promised. Missing SDK runtime/status APIs are detected; no duplicate Bot RPC implementation is hidden in the app.

## Remaining work

- Windows native text-control companion, hotkey, click-through and real-machine packaging tests. The shared Electron UI/service are portable; the Mac companion is not a Windows implementation.
- User-initiated end-to-end WeChat forwarding on each supported macOS/WeChat version, menu order/cache regression, and App Intents. Twelve no-network share slots and system registration are implemented; the read-only local system share probe confirms the configured recipient is listed.
- Main-Bot/running-state SDK capability parity, complete native localization/theme synchronization, persistent native draft edits, reply reconnect/resync policy and Touch Bar hardware regression.
- Developer ID signing, notarization and distributable installers. `package` is a development artifact, not a production release.

## Dependencies

`vendor/grok-bot-sdk-0.1.0.tgz` and `vendor/grok-bot-avatar-engine-1.0.0.tgz` were packed from the local source projects named in `docs/grok-bot-anywhere.md` on 2026-10-28. These are explicit package snapshots, not imports of `client-mvp/`. The avatar package was not available on npm at integration time; the public SDK package version differed from the handoff. Lockfile integrity pins these exact snapshots. Licenses and avatar NOTICE are included in their packages.

Do not replace them with an unverified same-name public package. To update, build the specified source project, run `npm pack /absolute/source/path --pack-destination desktop/vendor --ignore-scripts`, then update/install the file dependency and rerun tests.
