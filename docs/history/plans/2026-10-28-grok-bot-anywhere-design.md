# Grok Bot Anywhere — Electron design

Status: architecture approved on 2026-10-28. Product requirements: `docs/grok-bot-anywhere.md`.

## Architecture

Electron owns the shared roster, recipient settings, inbox, theme, application lifecycle and OS credential encryption. A Node utility process owns `grok-bot-sdk`, file uploads, durable inbox delivery and reply subscriptions. Preload exposes named application operations, never credentials or unrestricted IPC. The service is independent of the selected UI Bot.

macOS uses the existing Swift/AppKit composer, picker, Touch Bar and speech implementation through a private JSON-lines companion channel. Windows uses a native companion with a system text control. No web textarea substitutes for either composer. Companion failure must leave the roster, account and inbox usable. A typed/versioned operation envelope distinguishes application requests from native UI events.

## Storage and delivery

The service owns SQLite in the Electron user-data directory and managed attachment copies. All external submissions are committed locally before networking. Recipient configuration is scoped to account identity; defaults are disabled and compose-first. A receipt snapshots source, creation time, account, Bot, mode, prefix, title, text and attachments. Entry manifests can later be atomically dropped into a staging directory by sandboxed share extensions.

Receipt statuses are needs-input, sent, unconfirmed, failed and expired. Internal queued/uploading/sending phases retain recovery information. Persist a stable message ID and sending phase before calling the SDK. An interrupted sending phase becomes unconfirmed on restart and is never automatically retried. Only definitely unsent failures can retry. Ninety seconds is the direct-delivery deadline; a send already dispatched at the deadline is unconfirmed, not expired. Files survive errors. Drafts from separate receipts do not overwrite one another.

Credentials stay out of renderer and inbox storage. Electron safeStorage encrypts the account credential document. Login uses SDK createLogin/pollLogin; native existing-login is Mac-only and explicit. Authentication errors stop delivery until login. Neither refresh nor resend is automatic.

## Dependencies and visuals

Depend on the independent `grok-bot-sdk` and `grok-bot-avatar-engine` packages, pinned through the lockfile. The current embedded SDK has runtime-settings/status methods absent in the independent SDK: capability detection must expose that limitation until upstream provides them. Do not duplicate Bot RPCs in Electron.

Shared UI uses the specified warm monochrome canvases, orange #f59312, 22px card radius, system typography and system-following light/dark theme. All live avatars use createAvatar; native strip uses createStrip; screenshots use capture. Package avatar resources offline; remove the requirement to extract a locally installed Grok Bot ASAR during companion migration.

## Delivery stages

1. Runnable Electron host, SDK service, encrypted login, persistent recipient settings and inbox, delivery tests, shared roster/settings/history, native protocol contract. Keep current Swift app runnable.
2. Native companion integration and two-slot Mac share feasibility check; then twelve slots, App Intents, URL submissions. System menu ordering and dynamic signing/name/icon refresh require real-host verification.
3. Complete parity for native composer, Touch Bar, speech and existing login; Windows native companion and packaging verified on Windows. No unsupported feature is represented as working.
4. Windows WeChat sharing only after real-device verification.

## Validation

Use isolated temporary data and injected SDK/upload transports for tests: local-first >4MiB ingestion, source/account checks, compose-first behavior, prefix, receipt deduplication, no automatic resend, restart recovery, deadline and authentication handling. Run existing Swift and Node regression suites. Launch Electron in isolated smoke mode without account access or real sends. Native input/Touch Bar/Windows/share registration remain explicit platform acceptance checks.

## References

- https://www.electronjs.org/docs/latest/tutorial/security
- https://www.electronjs.org/docs/latest/api/utility-process
- https://www.electronjs.org/docs/latest/api/safe-storage
- https://github.com/freestylefly/WeChatBridge/blob/main/macos/Scripts/share-slots.sh

The workspace has no root Git repository; no initialization or commit is implied by this migration.
