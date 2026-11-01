import AppKit
import Carbon

@MainActor
final class GlobalShortcut {
    private var hotkeys: [EventHotKeyRef] = []
    private var eventHandler: EventHandlerRef?
    private var actions: [UInt32: () -> Void] = [:]
    func register(id: UInt32, keyCode: UInt32, modifiers: UInt32, action: @escaping () -> Void) -> Bool {
        if eventHandler == nil, !installHandler() { return false }
        actions[id] = action
        var hotkey: EventHotKeyRef?
        let identifier = EventHotKeyID(signature: 0x54424254, id: id)
        guard RegisterEventHotKey(keyCode, modifiers, identifier, GetApplicationEventTarget(), 0, &hotkey) == noErr, let hotkey else { return false }
        hotkeys.append(hotkey)
        return true
    }
    func unregister() {
        for hotkey in hotkeys { UnregisterEventHotKey(hotkey) }
        if let eventHandler { RemoveEventHandler(eventHandler) }
        hotkeys.removeAll(); eventHandler = nil; actions.removeAll()
    }
    private func installHandler() -> Bool {
        var type = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        let context = Unmanaged.passUnretained(self).toOpaque()
        let installed = InstallEventHandler(GetApplicationEventTarget(), { _, event, context in
            guard let context, let event else { return OSStatus(eventNotHandledErr) }
            var hotKeyID = EventHotKeyID()
            let read = GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID), nil, MemoryLayout<EventHotKeyID>.size, nil, &hotKeyID)
            guard read == noErr else { return OSStatus(eventNotHandledErr) }
            let id = hotKeyID.id
            MainActor.assumeIsolated { Unmanaged<GlobalShortcut>.fromOpaque(context).takeUnretainedValue().actions[id]?() }
            return noErr
        }, 1, &type, context, &eventHandler)
        return installed == noErr
    }
}

@MainActor
enum FinderSelection {
    static func captureIfFrontmost() -> [URL] {
        guard NSWorkspace.shared.frontmostApplication?.bundleIdentifier == "com.apple.finder" else { return [] }
        let script = NSAppleScript(source: """
        tell application "Finder"
            set selectedPaths to {}
            repeat with selectedFile in (selection as alias list)
                set end of selectedPaths to POSIX path of selectedFile
            end repeat
            return selectedPaths
        end tell
        """)
        var error: NSDictionary?
        guard let result = script?.executeAndReturnError(&error), error == nil else { return [] }
        guard result.numberOfItems > 0 else { return [] }
        return (1...result.numberOfItems).compactMap { result.atIndex($0)?.stringValue }.map { URL(fileURLWithPath: $0) }
    }
}
