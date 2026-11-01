# Grok Bot Anywhere Implementation Plan

> Execution: work through the tasks in this session with tests and review checkpoints; user has authorized implementation. No root Git repository is present, so commit/worktree steps do not apply.

**Goal:** Introduce the Electron architecture with a runnable shared host and durable local-first delivery while preserving the existing Mac app.

**Architecture:** Sandboxed Electron renderer → allowlisted preload → main process → Node utility service. Native companions communicate over a versioned JSON-lines protocol. SQLite and managed files belong to the service; encrypted credentials belong to main.

**Tech Stack:** Electron, JavaScript ESM, Node SQLite, grok-bot-sdk, grok-bot-avatar-engine, Swift/AppKit and later C# native companion.

---

### Task 1: Delivery and persistence contract

Files: `desktop/package.json`, `desktop/src/service/store.mjs`, `desktop/src/service/delivery.mjs`, `desktop/test/delivery.test.mjs`.

1. Write behavioral tests for default disabled/compose-first recipients, source validation, durable attachment copies above 4MiB, account-scoped records and restart recovery. Run `node --test desktop/test/*.test.mjs` and observe missing behavior.
2. Implement SQLite store and serialized local ingestion. Preserve source files until copies and manifest commit, with cleanup on failure.
3. Add tests for direct-send prefix, stable message identity, no resend of unconfirmed delivery, deadline before send and no dependence on selected Bot. Implement delivery with injected SDK client and uploader.
4. Verify the complete service test suite. Do not contact a real account.

### Task 2: SDK service and Electron host

Files: `desktop/src/service/session.mjs`, `desktop/src/service/worker.mjs`, `desktop/src/main/main.mjs`, `desktop/src/main/service-client.mjs`, `desktop/src/main/credentials.mjs`, `desktop/src/preload.cjs`, `desktop/test/session.test.mjs`.

1. Test login/session redaction, per-Bot subscriptions, auth invalidation and cancellation of stale login.
2. Import the independent SDK package; make uploads application-owned. Detect missing runtime/status capabilities rather than recreating RPCs.
3. Implement utilityProcess transport, safeStorage credential persistence, named/validated IPC, local-only renderer, application lifecycle and isolated smoke mode.
4. Verify offline tests and Electron startup. No real credential restore/login/send in smoke mode.

### Task 3: Shared UI and avatar integration

Files: `desktop/src/renderer/index.html`, `desktop/src/renderer/app.mjs`, `desktop/src/renderer/styles.css`, `desktop/scripts/build.mjs`.

1. Build shared Bot roster, recipient switches/source settings, account controls, theme choice and inbox history.
2. Bundle the avatar engine offline, mount/destroy live avatars, support image avatars, choose one language from system locale.
3. Keep composer activation behind the native companion contract; report unavailable capabilities clearly. Never use a web textarea as the native composer.
4. Launch and inspect the UI, smoke-test named operations with temporary storage, check for renderer errors and packaged file paths.

### Task 4: Companion protocol and Mac integration

Files: `desktop/src/main/companion.mjs`, `docs/native-companion-protocol.md`, existing `native/macos/native/macos/Sources/TouchBarBotApp/` integration points.

1. Specify hello/state/composer.open/composer.submit/composer.close and lifecycle/error contracts; test request correlation and exit failure.
2. Add a companion execution mode to the existing Swift app, keep standalone mode intact, route send through the Node service and pass roster/state from Electron.
3. Replace installed-ASAR avatar dependency with bundled engine resources in companion mode. Keep native text control and IME logic unchanged.
4. Build and run Swift tests; verify Electron→native composer and draft submission using an offline fixture before live use.

### Task 5: Review and delivery

Files: `README.md`, `desktop/README.md`, build scripts and review findings.

1. Run `npm test` and `npm run build` in desktop, existing Node regressions, and `native/macos/scripts/test.sh` for affected Swift behavior.
2. Use requesting-code-review skill to review new service/IPC/native boundaries and fix material findings.
3. Document exact commands, implemented behavior, remaining stages and Windows/share/signing acceptance checks. Deliver the running milestone without claiming later phases complete.
