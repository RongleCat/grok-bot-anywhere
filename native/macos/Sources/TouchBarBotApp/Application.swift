import AppKit

@main
@MainActor
enum Application {
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(NativeCompanion.enabled ? .accessory : .regular)
        withExtendedLifetime(delegate) { app.run() }
    }
}
