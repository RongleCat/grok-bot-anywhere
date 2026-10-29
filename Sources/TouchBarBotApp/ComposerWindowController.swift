import AppKit
import SwiftUI
import Combine

private final class ComposerPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

private final class ClearHostingView<Content: View>: NSHostingView<Content> {
    /// SwiftUI rects, origin at the top-left. Empty means the whole view is interactive.
    var swiftRects: [CGRect] = []
    override var isOpaque: Bool { false }
    override func hitTest(_ point: NSPoint) -> NSView? {
        let local = convert(point, from: superview)
        guard containsInteractive(local) else { return nil }
        return super.hitTest(point)
    }
    func containsInteractive(_ local: NSPoint) -> Bool {
        if swiftRects.isEmpty { return bounds.contains(local) }
        let swift = CGPoint(x: local.x, y: bounds.height - local.y)
        return swiftRects.contains { $0.insetBy(dx: -8, dy: -8).contains(swift) }
    }
}

private final class PassThroughView: NSView {
    override var isOpaque: Bool { false }
    override func hitTest(_ point: NSPoint) -> NSView? {
        let hit = super.hitTest(point)
        if hit == nil || hit === self { return nil }
        return hit
    }
}

private final class EventMonitors: @unchecked Sendable {
    var items: [Any] = []
    var timer: Timer?
    func add(_ item: Any) { items.append(item) }
    func stopTimer() { timer?.invalidate(); timer = nil }
    deinit {
        timer?.invalidate()
        items.forEach(NSEvent.removeMonitor)
    }
}

private final class PostedEvent: @unchecked Sendable {
    let event: CGEvent
    init(_ event: CGEvent) { self.event = event }
}

private final class PointerGate: @unchecked Sendable {
    weak var window: NSWindow?
    weak var host: ClearHostingView<ComposerView>?
    var dismissOnOutside = true
    var outsidePress: NSPoint?
    var swallowUntil: TimeInterval = 0
    var onHide: @Sendable () -> Void = {}

    func contains(_ screenPoint: NSPoint) -> Bool {
        guard let window, let host, host.bounds.width > 1, host.bounds.height > 1 else { return false }
        let inWindow = window.convertFromScreen(NSRect(origin: screenPoint, size: .zero)).origin
        let local = host.convert(inWindow, from: nil)
        return host.containsInteractive(local)
    }

    func updatePassthrough() {
        guard let window, window.isVisible else { return }
        let interactive = contains(NSEvent.mouseLocation)
        if window.ignoresMouseEvents == interactive { window.ignoresMouseEvents = !interactive }
    }

    func notePress() {
        guard window?.isVisible == true else { return }
        let point = NSEvent.mouseLocation
        if contains(point) { outsidePress = nil; return }
        outsidePress = dismissOnOutside ? point : nil
    }

    func noteRelease() {
        guard let start = outsidePress else { return }
        outsidePress = nil
        guard window?.isVisible == true, dismissOnOutside else { return }
        let point = NSEvent.mouseLocation
        guard !contains(point), hypot(point.x - start.x, point.y - start.y) < 6 else { return }
        onHide()
    }

    func forward(_ event: NSEvent) -> NSEvent? {
        guard let window, window.isVisible else { return event }
        if event.timestamp <= swallowUntil { return nil }
        let point = NSEvent.mouseLocation
        if contains(point) {
            outsidePress = nil
            if !NSApplication.shared.isActive { NSApplication.shared.activate(ignoringOtherApps: true) }
            window.makeKey()
            return event
        }
        window.ignoresMouseEvents = true
        outsidePress = dismissOnOutside ? point : nil
        swallowUntil = event.timestamp
        if let raw = event.cgEvent {
            let posted = PostedEvent(raw)
            DispatchQueue.main.async { posted.event.post(tap: .cghidEventTap) }
        }
        return nil
    }
}

@MainActor
final class ComposerWindowController: NSWindowController, NSWindowDelegate {
    private let store: AppStore
    private var changes: AnyCancellable?
    private var speechChanges: AnyCancellable?
    private var pickerOpen = false
    private var adjustingFrame = false
    private var contentHeight: CGFloat = 0
    private let monitors = EventMonitors()
    private let gate = PointerGate()
    private var host: ClearHostingView<ComposerView>?
    private var hostHeight: NSLayoutConstraint?
    private var hostWidth: NSLayoutConstraint?
    private var hostBottom: NSLayoutConstraint?
    init(store: AppStore) {
        self.store = store
        let panel = ComposerPanel(contentRect: NSRect(x: 0, y: 0, width: 480, height: 380), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.title = "Touch Bar Bot · 对话"
        panel.isOpaque = false; panel.backgroundColor = .clear
        panel.hasShadow = false; panel.level = .floating
        panel.isFloatingPanel = true; panel.hidesOnDeactivate = false
        panel.isMovable = false
        panel.isMovableByWindowBackground = false
        panel.ignoresMouseEvents = true
        panel.acceptsMouseMovedEvents = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        super.init(window: panel)
        panel.delegate = self
        let hosting = ClearHostingView(rootView: ComposerView(
            store: store,
            speech: store.speech,
            close: { [weak self] in self?.hide() },
            onLayout: { [weak self] picking in
                self?.pickerOpen = picking
                self?.resize(animated: true)
            },
            onHeight: { [weak self] height in self?.noteHeight(height) },
            onRegions: { [weak self] rects in
                self?.host?.swiftRects = rects
                self?.gate.updatePassthrough()
            }
        ))
        hosting.sizingOptions = []
        hosting.wantsLayer = true
        hosting.layer?.isOpaque = false
        hosting.layer?.backgroundColor = NSColor.clear.cgColor
        hosting.translatesAutoresizingMaskIntoConstraints = false
        let container = PassThroughView()
        container.wantsLayer = true
        container.layer?.backgroundColor = NSColor.clear.cgColor
        container.addSubview(hosting)
        let height = hosting.heightAnchor.constraint(equalToConstant: 640)
        let width = hosting.widthAnchor.constraint(equalToConstant: 400)
        let bottom = hosting.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        NSLayoutConstraint.activate([
            hosting.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            bottom,
            width,
            height
        ])
        host = hosting
        hostHeight = height
        hostWidth = width
        hostBottom = bottom
        gate.window = panel
        gate.host = hosting
        gate.dismissOnOutside = store.dismissComposerOnOutsideClick
        gate.onHide = { [weak self] in MainActor.assumeIsolated { self?.hide() } }
        panel.contentView = container
        installMonitors()
        changes = store.objectWillChange.sink { [weak self] in Task { @MainActor in
            guard let self else { return }
            self.gate.dismissOnOutside = self.store.dismissComposerOnOutsideClick
            self.resize(animated: false)
        } }
        speechChanges = store.speech.$issue.sink { [weak self] _ in Task { @MainActor in self?.resize(animated: false) } }
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
    func show() {
        guard let window, store.selectedBot != nil else { return }
        store.composerVisible = true
        gate.dismissOnOutside = store.dismissComposerOnOutsideClick
        coverScreen()
        resize(animated: false)
        NSApplication.shared.activate(ignoringOtherApps: true)
        showWindow(nil)
        window.makeKeyAndOrderFront(nil)
        startTracking()
        gate.updatePassthrough()
    }
    func hide() {
        gate.outsidePress = nil
        monitors.stopTimer()
        store.dictationArmed = false
        store.speech.stop()
        store.composerVisible = false
        window?.ignoresMouseEvents = true
        window?.orderOut(nil)
    }
    private func noteHeight(_ height: CGFloat) {
        guard height > 1, abs(height - contentHeight) > 0.5 else { return }
        let grew = height - contentHeight > 40
        contentHeight = height
        resize(animated: grew && pickerOpen)
    }
    private func coverScreen() {
        guard let window else { return }
        let screen = NSScreen.main ?? window.screen ?? NSScreen.screens.first
        guard let screen else { return }
        if window.frame != screen.frame {
            adjustingFrame = true
            window.setFrame(screen.frame, display: true)
            adjustingFrame = false
        }
        let inset = max(0, (screen.visibleFrame.minY + 24) - screen.frame.minY)
        hostBottom?.constant = -inset
    }
    private func resize(animated: Bool) {
        guard let window, window.isVisible || store.composerVisible, contentHeight > 1 else { return }
        coverScreen()
        let screen = window.screen ?? NSScreen.main
        let cap = max(180, (screen?.visibleFrame.height ?? 800) - 36)
        let height = min(contentHeight, cap)
        let available = screen?.visibleFrame.width ?? 1200
        let width = pickerOpen ? min(ComposerView.pickerWidth, available - 24) : 400
        let reduce = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        let currentHeight = hostHeight?.constant ?? 0
        let currentWidth = hostWidth?.constant ?? 0
        if abs(currentHeight - height) > 0.5 { hostHeight?.constant = height }
        if abs(currentWidth - width) > 0.5 {
            if animated && !reduce {
                NSAnimationContext.runAnimationGroup { context in
                    context.duration = 0.32
                    context.timingFunction = CAMediaTimingFunction(controlPoints: 0.22, 0.9, 0.24, 1)
                    self.hostWidth?.animator().constant = width
                }
            } else {
                hostWidth?.constant = width
            }
        }
        gate.updatePassthrough()
    }
    private func startTracking() {
        monitors.stopTimer()
        let gate = self.gate
        let timer = Timer(timeInterval: 1.0 / 30.0, repeats: true) { _ in gate.updatePassthrough() }
        RunLoop.main.add(timer, forMode: .common)
        monitors.timer = timer
    }
    private func installMonitors() {
        let gate = self.gate
        let movement: NSEvent.EventTypeMask = [.mouseMoved, .leftMouseDragged, .rightMouseDragged]
        let buttons: NSEvent.EventTypeMask = [.leftMouseDown, .rightMouseDown]
        let release: NSEvent.EventTypeMask = [.leftMouseUp, .rightMouseUp]
        if let monitor = NSEvent.addGlobalMonitorForEvents(matching: movement, handler: { _ in
            gate.updatePassthrough()
        }) { monitors.add(monitor) }
        if let monitor = NSEvent.addLocalMonitorForEvents(matching: movement, handler: { event in
            gate.updatePassthrough()
            return event
        }) { monitors.add(monitor) }
        if let monitor = NSEvent.addGlobalMonitorForEvents(matching: buttons, handler: { _ in
            gate.notePress()
        }) { monitors.add(monitor) }
        if let monitor = NSEvent.addLocalMonitorForEvents(matching: buttons, handler: { event in
            gate.forward(event)
        }) { monitors.add(monitor) }
        if let monitor = NSEvent.addGlobalMonitorForEvents(matching: release, handler: { _ in
            gate.noteRelease()
        }) { monitors.add(monitor) }
        if let monitor = NSEvent.addLocalMonitorForEvents(matching: release, handler: { event in
            gate.noteRelease()
            return event
        }) { monitors.add(monitor) }
    }
    func windowWillClose(_ notification: Notification) { hide() }
}
