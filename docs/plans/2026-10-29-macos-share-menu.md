# Mac WeChat share menu implementation

The approved product design requires twelve signed Share Extension slots, each directly bound to a Bot. The first Electron milestone stored the settings but shipped no extensions; this explains the missing WeChat entry.

## Design

Bundle a small native Menu Host app with twelve extensions sharing one executable. On explicit “Update WeChat forwarding menu”, copy that template to the user's Applications directory, write the selected Bot names/icons/bindings, sign extensions and host inside-out, register the installed host with Launch Services/pluginkit, and elect only active slots. Keep this mutable menu host separate from the running composer and Electron binaries so changing names/icons cannot overwrite a running executable or invalidate account-storage identity.

The extension has a sandbox with a single local share-inbox filesystem exception and no network entitlement. It copies exported ZIP/media/text into a temporary batch and atomically renames to Ready only after all files and the manifest are durable. The manifest snapshots account, Bot, session, mode and prefix. It never reads WeChat data or sends WeChat messages.

The service imports Ready batches with persistent source-ID deduplication; account mismatch or missing current source permission leaves the batch local. The main process opens compose-first receipts only after account/receipt validation. Direct receipts use the existing safe delivery machinery. No automatic resend is introduced. A fixed shared configuration file controls whether an installed binding may accept new input, including account transitions/logout.

## Work and validation

1. Add failing tests for slot selection, configuration identity, manifest ingestion, >4MiB copies, deduplication, path containment and account mismatch. Implement the shared model and importer.
2. Add the native extension/Menu Host Swift targets; compile and validate activation rules, signing entitlements and atomic staging behavior with local fixture files.
3. Add installed-host menu update/registration with authoritative service state and renderer avatar captures. Expose registration/needs-update status and disable unavailable Shortcuts entry points.
4. Build/package, run offline regression and share smoke checks. Register the enabled user-selected Bot without sending messages; enumerate through a system NSSharingService picker to confirm the actual name/icon/visibility. WeChat refresh and full user-initiated forwarding remain a real-host acceptance step.

Use tests before implementation and an independent code review for the file/IPC/account boundary. No root Git repository is present.
