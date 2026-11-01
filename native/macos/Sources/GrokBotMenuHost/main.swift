import AppKit

@MainActor final class MenuHostDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let path = Bundle.main.object(forInfoDictionaryKey: "GBAApplicationPath") as? String else { NSApp.terminate(nil); return }
        let config = NSWorkspace.OpenConfiguration(); config.activates = false; config.arguments = ["--share-intake"]
        NSWorkspace.shared.openApplication(at: URL(fileURLWithPath: path), configuration: config) { _, _ in
            Task { @MainActor in NSApp.terminate(nil) }
        }
    }
}
MainActor.assumeIsolated {
    let application = NSApplication.shared
    let delegate = MenuHostDelegate()
    application.delegate = delegate
    application.setActivationPolicy(.accessory)
    withExtendedLifetime(delegate) { application.run() }
}
