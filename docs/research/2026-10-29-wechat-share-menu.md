# WeChatBridge sharing implementation

Reviewed upstream source on 2026-10-29 to diagnose the missing Grok Bot menu entry.

## What actually puts a row in WeChat

1. `macos/Scripts/share-slots.sh` defines twelve fixed slot rows. Each row becomes an independently identified `.appex`; all run the same binary and read `DKShareAction` from their own bundle. A generic custom destination does not create arbitrary new system menu rows.
2. `macos/Resources/Share-Info.plist` sets extension point `com.apple.share-services`, a pinned Objective-C view-controller class and file activation rules. Names are localized through `InfoPlist.strings`; icons are compiled with actool or iconutil.
3. `macos/Scripts/make-app.sh` copies one executable into each extension, rewrites the per-slot metadata and signs extensions before the containing app.
4. `macos/Scripts/install-dev-build.sh` stops the old application, installs into `~/Applications`, and calls Launch Services `lsregister -f`. Running only a Swift executable or a loose build does not produce an installed sharing entry.
5. `ShareEntryProbe.swift` maps Settings toggles to `pluginkit -e use|ignore -i <identifier>`, then reads `pluginkit -m -i <identifier>`. Exit status alone is insufficient; only the `+` flag is treated as enabled. The unsandboxed main application performs this management; the share extension remains sandboxed.
6. The extension copies user-exported files into an atomic local batch, signals/launches the containing app and completes the share request. Its entitlements contain no network client permission. It does not read WeChat databases or inject into WeChat.

## Consequence for Grok Bot Anywhere

The original Electron milestone had recipient database rows but no `.appex` bundles or system registration. That configuration could never add a WeChat row. The correction supplies twelve signed slots, actual system election read-back, offline batch intake and account-scoped routing.

Arbitrary Bot names/photos differ from WeChatBridge's fixed names: changing those resources requires a signed metadata update, not just a database write. The mutable Menu Host is installed in `~/Applications/Grok Bot Anywhere Menu/Contents/Helpers`, independently of the running composer/Electron executable.

## Local verification

The configured recipient was registered with `pluginkit` as enabled (`+`). A read-only `NSSharingService.sharingServices(forItems:)` ZIP probe enumerated `Send to 知识管理员` together with `Send to Codex` and `Send to Custom`. No sharing service was invoked and no Bot message was sent. System registration was initially asynchronous; the installer now re-adds missed slots and verifies the enabled flag rather than assuming a successful command means a visible row.

## Sources

- https://github.com/freestylefly/WeChatBridge/blob/main/macos/Scripts/share-slots.sh
- https://github.com/freestylefly/WeChatBridge/blob/main/macos/Scripts/make-app.sh
- https://github.com/freestylefly/WeChatBridge/blob/main/macos/Scripts/install-dev-build.sh
- https://github.com/freestylefly/WeChatBridge/blob/main/macos/Resources/Share-Info.plist
- https://github.com/freestylefly/WeChatBridge/blob/main/macos/Sources/WeChatBridgeApp/ShareEntryProbe.swift
- https://github.com/freestylefly/WeChatBridge/blob/main/macos/Sources/WeChatBridgeShare/ShareViewController.swift


## Automatic reconciliation and actual system icon verification

Recipient/name/avatar changes now trigger a debounced serialized installer. Configuration publishes independently during installation so account transitions immediately revoke stale bindings. Revision checks abort stale installations before swapping/registering. Each extension lives in a separately signed application under an ordinary directory, rather than inside an outer application. Local `NSSharingService.image` probes returned generic icons for the nested layout, even while `NSWorkspace.icon(forFile:)` returned correct icons. Moving destinations out of the containing outer application fixed the actual share-service images. Verified both configured recipients (blue and pink avatars) through the system sharing API without invoking delivery.
