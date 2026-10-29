import AppKit
import Carbon

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var picker: PickerWindowController?
    private var composer: ComposerWindowController?
    private var statusItem: NSStatusItem?
    private let shortcut = GlobalShortcut()
    private let store = AppStore(preview: CommandLine.arguments.contains("--preview"))
    private var dictationMonitor: Any?
    private var companion: NativeCompanion?

    func applicationDidFinishLaunching(_ notification: Notification) {
        configureMenus()
        picker = PickerWindowController(store: store)
        composer = ComposerWindowController(store: store)
        picker?.compose = { [weak self] in self?.showComposer() }
        store.openComposer = { [weak self] in self?.showComposer() }
        store.onSelection = { [weak self] in self?.picker?.refresh() }
        composer?.window?.touchBar = picker?.makeTouchBar()
        picker?.window?.touchBar = picker?.makeTouchBar()
        store.onPinChanged = { [weak self] pinned in self?.picker?.setPinned(pinned) }
        store.onHideComposer = { [weak self] in self?.composer?.hide() }
        picker?.setPinned(store.pinTouchBar)
        if ProcessInfo.processInfo.environment["GROK_ANYWHERE_SMOKE"] != "1" {
            store.hotkeyAvailable = shortcut.register(id: 1, keyCode: UInt32(kVK_Space), modifiers: UInt32(controlKey | optionKey)) { [weak self] in self?.globalCompose() }
            _ = shortcut.register(id: 2, keyCode: UInt32(kVK_ANSI_V), modifiers: UInt32(controlKey | optionKey)) { [weak self] in self?.dictateCompose() }
        }
        dictationMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            let consume = MainActor.assumeIsolated { () -> Bool in
                guard let self, self.store.dictationArmed, self.store.speech.isRecording else { return false }
                self.store.finishDictationAndSend()
                return true
            }
            return consume ? nil : event
        }
        if NativeCompanion.enabled {
            companion = NativeCompanion(store: store)
            companion?.openComposer = { [weak self] in self?.showComposer() }
        } else {
            picker?.showWindow(nil)
            NSApplication.shared.activate(ignoringOtherApps: true)
        }
        Task {
            await GrokAvatarEngine.shared.prepare()
            if GrokAvatarEngine.shared.root != nil { GrokAvatarRaster.shared.start() }
            if NativeCompanion.enabled { companion?.start() }
            else { await store.restore() }
        }
        if CommandLine.arguments.contains("--composer") { showComposer() }
    }
    func applicationDidResignActive(_ notification: Notification) {
        guard store.pinTouchBar else { return }
        picker?.setPinned(true)
    }
    func applicationDidBecomeActive(_ notification: Notification) {
        guard store.pinTouchBar else { return }
        picker?.setPinned(true)
    }
    func menuWillOpen(_ menu: NSMenu) {
        for item in menu.items where item.action == #selector(togglePinnedTouchBar) {
            item.state = store.pinTouchBar ? .on : .off
        }
    }
    private func configureMenus() {
        let main = NSMenu(), app = NSMenu(), actions = NSMenu(title: "Bot"), edit = NSMenu(title: "编辑")
        app.addItem(withTitle: "关于 Touch Bar Bot", action: #selector(about), keyEquivalent: "")
        app.addItem(.separator())
        app.addItem(withTitle: "退出 Touch Bar Bot", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let compose = NSMenuItem(title: "打开输入框", action: #selector(showComposer), keyEquivalent: "\r")
        compose.target = self; compose.keyEquivalentModifierMask = [.command, .shift]
        actions.addItem(compose)
        let dictate = NSMenuItem(title: "语音发送  ⌃⌥V", action: #selector(dictateCompose), keyEquivalent: "")
        dictate.target = self; actions.addItem(dictate)
        let library = NSMenuItem(title: "显示所有 Bots", action: #selector(showLibrary), keyEquivalent: "1"); library.target = self; actions.addItem(library)
        let pin = NSMenuItem(title: "常驻 Touch Bar", action: #selector(togglePinnedTouchBar), keyEquivalent: ""); pin.target = self; actions.addItem(pin)
        actions.delegate = self
        for (title, action, key) in [("撤销", Selector(("undo:")), "z"), ("剪切", #selector(NSText.cut(_:)), "x"), ("复制", #selector(NSText.copy(_:)), "c"), ("粘贴", #selector(NSText.paste(_:)), "v"), ("全选", #selector(NSText.selectAll(_:)), "a")] { edit.addItem(withTitle: title, action: action, keyEquivalent: key) }
        for menu in [app, actions, edit] { let item = NSMenuItem(); item.submenu = menu; main.addItem(item) }
        NSApplication.shared.mainMenu = main
        let statusMenu = NSMenu()
        let open = NSMenuItem(title: "开始对话  ⌃⌥Space", action: #selector(globalCompose), keyEquivalent: ""); open.target = self; statusMenu.addItem(open)
        let voice = NSMenuItem(title: "语音发送  ⌃⌥V", action: #selector(dictateCompose), keyEquivalent: ""); voice.target = self; statusMenu.addItem(voice)
        let all = NSMenuItem(title: "所有 Bots…", action: #selector(showLibrary), keyEquivalent: ""); all.target = self; statusMenu.addItem(all)
        let pinStatus = NSMenuItem(title: "常驻 Touch Bar", action: #selector(togglePinnedTouchBar), keyEquivalent: ""); pinStatus.target = self; statusMenu.addItem(pinStatus)
        statusMenu.delegate = self
        statusMenu.addItem(.separator())
        statusMenu.addItem(withTitle: "退出", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem?.button?.image = NSImage(systemSymbolName: "bubble.left.and.bubble.right", accessibilityDescription: "Touch Bar Bot")
        statusItem?.menu = statusMenu
    }
    @objc private func showComposer() {
        guard !store.bots.isEmpty else { showLibrary(); return }
        if store.selectedBot == nil, let bot = store.bots.first { store.select(bot) }
        picker?.window?.orderOut(nil)
        composer?.show()
    }
    @objc private func globalCompose() {
        if store.selectedBot == nil, let bot = store.bots.first { store.select(bot) }
        store.addFiles(FinderSelection.captureIfFrontmost())
        showComposer()
    }
    @objc private func dictateCompose() {
        if store.dictationArmed, store.speech.isRecording { store.finishDictationAndSend(); return }
        if store.selectedBot == nil, let bot = store.bots.first { store.select(bot) }
        showComposer()
        store.beginDictationSend()
    }
    @objc private func showLibrary() {
        if NativeCompanion.enabled { companion?.event("library.open"); return }
        picker?.showWindow(nil); picker?.window?.makeKeyAndOrderFront(nil); NSApplication.shared.activate(ignoringOtherApps: true)
    }
    @objc private func togglePinnedTouchBar() { store.setPinnedTouchBar(!store.pinTouchBar) }
    @objc private func about() {
        let credits = GrokAvatarEngine.shared.root != nil
            ? "原生 macOS Bot 快捷入口\n头像使用本机 Grok Bot 的渲染引擎\n非官方 Grok Bot 客户端"
            : "原生 macOS Bot 快捷入口\n未找到本机 Grok Bot 时，头像回退到 Bloub（MIT）\nhttps://github.com/jeremy-prt/bloub\n非官方 Grok Bot 客户端"
        NSApplication.shared.orderFrontStandardAboutPanel(options: [
            .applicationName: "Touch Bar Bot",
            .credits: NSAttributedString(string: credits)
        ])
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { if !flag { showLibrary() }; return true }
    func applicationWillTerminate(_ notification: Notification) {
        if let dictationMonitor { NSEvent.removeMonitor(dictationMonitor) }
        shortcut.unregister(); store.speech.stop(); companion?.stop(); store.bridge.stop()
    }
}
