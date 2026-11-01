状态：Current。协议版本 1。

# Native companion protocol, version 1

The Electron parent launches the bundled native companion with `--companion`. Only inherited stdin/stdout carry UTF-8 JSON lines. stdout is reserved for the protocol; stderr is diagnostics and must be drained. No socket, token or URL credential is involved. EOF terminates the companion; process exit rejects parent requests. The parent does not automatically restart a companion with unknown draft/send state.

Request: `{ "id": "unique", "method": "state", "params": {} }`.
Success: `{ "id": "unique", "result": {} }`.
Failure: `{ "id": "unique", "error": { "code": "DRAFT_BUSY" } }`.
Event: `{ "event": "hello", "data": { "version": 1, "platform": "darwin", "capabilities": ["composer", "touchbar", "speech"] } }`.

Both sides can initiate requests. Request IDs correlate replies independently; events never resolve requests. Public errors are codes, never raw SDK/HTTP/file diagnostics. Envelope limits apply to metadata, not attachment bytes: files are sent by path and copied into the application's managed inbox before upload.

## Parent → companion

- `state`: account `{id}` or null, connected flag, normalized SDK bots, runtime `{mainAgentId,statuses}`, inbox hold summaries. Account changes reset all native drafts and receipt bindings, including shared Bot IDs.
- `composer.open`: `botId`, optional receipt `{id,text,files:[{path,name,bytes}]}`. A different receipt never overwrites an existing draft; return `DRAFT_BUSY` and leave the new item in the durable inbox.
- `composer.hide`: hide the native panel and stop speech.
- `shutdown`: terminate normally.

The parent passes an absolute real filesystem `GROK_BOT_AVATAR_ROOT` pointing to offline engine resources. Swift must not attempt to read an Electron ASAR virtual directory. Packaged builds copy the avatar host outside ASAR.

## Companion → parent

- `list`, `runtime`, `statuses`, `status`: read the shared service state. Missing SDK runtime capabilities return empty optional metadata.
- `watch` / `unwatch`: the service owns per-Bot subscriptions; hiding/switching the native composer does not cancel receipt reply monitoring.
- `send`: `botId,sessionId,text,files,messageId`, plus bound `receiptId` for intake drafts. The parent validates receipt/Bot/account scope, persists new manual intake, and submits through the service. The service owns the actual stable send ID and all upload references. Native RPC waits for the service's authoritative delivery result, not a UI timeout.
- `resolve`: user explicitly checked the Bot's unconfirmed send; release persisted holds without resending.
- `library.open` event: show the shared Electron window.

The native companion never launches its embedded protocol bridge or reads account credentials in companion mode. Standalone mode keeps the existing behavior. Windows must implement the same contract with its native system text control; a browser textarea is not a substitute.
