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

The shared window supports browser login, explicit local Grok Bot login on Mac, the Bot grid, per-Bot receive settings, theme and receipt history. The composer is a separate floating window on Mac and Windows and stays above other apps. On Windows that composer keeps a PowerShell process running: the app compiles it once after startup, and enterprise security software may warn about that process. On Windows 11, a multi-tab Explorer window may return the first tab's selection. Neither of those Windows behaviors has been verified on a Windows machine. Settings records the global shortcut that opens it. The default is Control+Option+Space. Touch Bar display still uses the Swift companion when that binary is present. Close the original Touch Bar Bot before using the new app so it does not keep that shortcut.

The Mac sharing build includes twelve Share Extension slots. Enabling/disabling a WeChat recipient, changing its name/avatar, or switching accounts automatically reconciles the system menu. Updates are debounced and serialized; a newer account state revokes old bindings immediately and supersedes a stale installer. Settings retains **Update forwarding menu** for retry. Each slot has an independent containing application under the ordinary folder `~/Applications/Grok Bot Anywhere Menu/Contents/Helpers`, with the same Bot icon in its application and extension resources. Nesting these inside another application causes macOS to return a placeholder icon. Reopen WeChat's forwarding menu after updating; if it caches the old menu, reopen WeChat. Development `npm start` installs share destinations when `native/GrokBotMenuHost.app` is present, so run `npm run build:share` before the first start. Reopen WeChat after the menu sync finishes.

Share extensions have no network permission. They copy ZIP/text/media to `ShareInbox/Ready`, and the service deduplicates/imports batches into the durable inbox before delivery. Account-mismatched batches remain local. Separate menu applications keep metadata updates from replacing a running composer or changing Electron's credential-storage identity.

Pick a Bot and open the floating composer. Enter sends; Shift+Enter adds a line. Tab opens the Bot panel. Compose-mode intake and the global shortcut open that panel with the Bot's avatar. Direct intake uses the saved prefix and Bot, uploads, then submits once. Drop files on a Bot tile to follow that Bot's receive setting.

Shortcuts and other launchers open this app with a `grokbotanywhere://` link. In the Shortcuts app, add **Open URL**. `grokbotanywhere://open` shows the main window. `grokbotanywhere://compose?bot=<botId>` opens the floating composer. Leave `bot` out to use the same Bot as the menu-bar **Open composer** command. `grokbotanywhere://compose?bot=<botId>&text=<text>` prefills that composer only when the Bot is enabled, its Shortcuts source is on, and an account is signed in. `grokbotanywhere://send?bot=<botId>&text=<text>` uses those same checks and places the text in the composer. A link never sends by itself, even when that Bot's mode is direct. Use the `grok-bot` command when a caller needs to submit without that confirmation. The link never carries a login token. Each Bot page has **Copy shortcut link**, which copies the compose URL. On Windows, run `start "" "grokbotanywhere://open"`.

Closing the main window hides it while the coal-ball tray icon is up. The tray menu follows the system language and can show the main window, open the composer, or quit. With no tray (preview, or the icon failed to come up), closing the window quits. On Windows, a click on the tray icon opens the main window, and the icon is destroyed before quit. The app listens for `session-end`. That path has not been tested on a Windows machine.

**Launch at login** is written to the system only in a packaged build. In development the switch still saves and shows the preference, and it does not register the bare Electron binary. A launch that came from the login item stays in the background and does not open the main window.

Settings → Toolbox → **Turn off all** turns off receive-forward (`recipient.enabled`) for every Bot that has it on, including a Bot hidden behind a same-name group. Sources, mode, and prefix stay, so turning a Bot back on restores them. If none are on, the button is disabled. One main-process call updates them in a single store transaction.

**Command line and skills.** The settings switch installs `grok-bot` and the skill this app ships, and links that skill for Claude Code. It does not replace a `grok-bot` command or skill you installed yourself. The command line keeps a separate plaintext copy of the login in your user folder (on Windows, `%LOCALAPPDATA%\Grok Bot Anywhere\cli`; on Mac, the app's user-data `cli` directory). That copy is removed when you sign out and when you turn the switch off. The app's own login stays in OS-backed safeStorage.

Windows behavior below is implemented and covered by tests on this Mac. It has not been verified on a Windows machine. See `docs/windows-coverage.md`. WeChat has no Windows share menu; use the Explorer menu, drop a ZIP on a Bot, or the floating composer.

On Windows, Settings → Toolbox → **Windows menu** can rebuild that Explorer menu or remove every key this app has written and turn the menu off. If WeChat’s “other apps” menu, or another program’s menu, looks wrong, choose **Remove all**, restart that program, and see whether the menu comes back. A packaged build sets the Windows notification identity to `dev.ronglecat.grokbotanywhere` and uses the coal-ball icon. In development, Windows can still show the name Electron and the default Electron icon; that is a system limit for an unpackaged app.

To inspect the keys without changing them, from `desktop/` run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows-diagnose.ps1
```

The script is read-only. It prints our keys, every verb under `HKCU\Software\Classes\*\shell` and `HKLM\SOFTWARE\Classes\*\shell`, and marks a verb that has no `command`, `SubCommands`, or `ExtendedSubCommandsKey`. It also writes `diagnose-<time>.txt` in the current directory. Send that file back with a report of a broken menu.

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
- The app login uses Electron's asynchronous OS-backed safeStorage, with no plaintext fallback. The command-line switch keeps a separate plaintext copy of that login in the user folder so `grok-bot` can run outside Electron. That copy is deleted on sign-out and when the switch is turned off. Receipt SQLite and managed file copies live under the application's user-data directory. Local intake works after token expiry; sending requires login.
- The service serializes sends per Bot and prevents account changes during delivery. Direct delivery expires after 90 seconds before submission; an attempted send with no definite result remains unconfirmed. Restart recovers an in-flight send as unconfirmed. Nothing automatically retries it.
- After checking an unconfirmed item in Grok Bot, use “Checked, unlock sending.” This releases the Bot for new messages; the original item stays unconfirmed and is not resent.
- Files have no legacy 4MiB intake limit. Single-PUT uploads stream from disk; multipart modes remain unsupported and fail without discarding files. The base64 gateway transport currently has an explicit 64MiB memory guard. Live large-file service limits have not been verified.
- The SDK exposes Bot/session messages rather than request-correlated replies. New live events are attached to the latest sending/sent receipt for that session, with replay filtered. Exact per-request reply association is not promised. Missing SDK runtime/status APIs are detected; no duplicate Bot RPC implementation is hidden in the app.

## Remaining work

- Windows native text-control companion, hotkey, click-through and real-machine packaging tests. Explorer, the floating composer, the command line, skills, and the URL protocol are implemented and unit-tested, and have not been run on a Windows machine. The shared Electron UI/service are portable; the Mac companion is not a Windows implementation.
- User-initiated end-to-end WeChat forwarding on each supported macOS/WeChat version, menu order/cache regression, and App Intents. Twelve no-network share slots and system registration are implemented; the read-only local system share probe confirms the configured recipient is listed.
- Main-Bot/running-state SDK capability parity, complete native localization/theme synchronization, persistent native draft edits, reply reconnect/resync policy and Touch Bar hardware regression.
- Developer ID signing, notarization and distributable installers. `package` is a development artifact, not a production release.

## Dependencies

`grok-bot-sdk` is installed from `github:RongleCat/grok-bot-sdk`. `vendor/grok-bot-avatar-engine-1.0.0.tgz` remains a packed snapshot. These are not imports of `client-mvp/`.

Do not replace them with an unverified same-name public package. To update, build the specified source project, run `npm pack /absolute/source/path --pack-destination desktop/vendor --ignore-scripts`, then update/install the file dependency and rerun tests.
