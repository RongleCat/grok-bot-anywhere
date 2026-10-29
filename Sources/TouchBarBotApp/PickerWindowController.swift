import AppKit
import SwiftUI
import Combine

@MainActor
final class PickerWindowController: NSWindowController, NSTouchBarDelegate, NSScrubberDataSource, NSScrubberDelegate {
    private static let pickerID = NSTouchBarItem.Identifier("dev.local.TouchBarBot.picker")
    private static let avatarID = NSUserInterfaceItemIdentifier("avatar")
    private static let itemSide = AvatarScrubberItem.side
    private static let itemSpacing: CGFloat = 8
    private let store: AppStore
    private var scrubbers: [ObjectIdentifier: NSScrubber] = [:]
    private var interactionStartID: String?
    private var interactionMoved = false
    private var scrubbing = false
    private var centeredSelectionID: String?
    private var interactionOriginX: CGFloat?
    private var selectionFromScrubber = false
    private var widthSignatures: [ObjectIdentifier: String] = [:]
    private var imageRefreshPending = false
    private var renderedRoster: [Bot] = []
    private var pictures: AnyCancellable?
    private var stills: AnyCancellable?
    private var pinnedBar: NSTouchBar?
    private var motionTimer: Timer?
    var compose: (() -> Void)?

    init(store: AppStore) {
        self.store = store
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 760, height: 530), styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
        window.title = "Touch Bar Bot"; window.titlebarAppearsTransparent = true
        window.contentView = NSHostingView(rootView: BotLibraryView(store: store))
        window.minSize = NSSize(width: 690, height: 490)
        window.center()
        super.init(window: window)
        pictures = AvatarPictures.shared.objectWillChange.sink { [weak self] in Task { @MainActor in self?.paintScrubberImages() } }
        stills = GrokAvatarRaster.shared.objectWillChange.sink { [weak self] in Task { @MainActor in self?.paintScrubberImages() } }
        motionTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.paintScrubberImages() }
        }
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
    func refresh() {
        let rosterChanged = renderedRoster.map(\.id) != store.bots.map(\.id)
        renderedRoster = store.bots
        let fromScrubber = selectionFromScrubber
        selectionFromScrubber = false
        if rosterChanged {
            centeredSelectionID = nil
            widthSignatures.removeAll()
            for scrubber in scrubbers.values { scrubber.reloadData() }
        }
        guard !scrubbing else {
            if fromScrubber { selectionFromScrubber = true }
            return
        }
        let changed = centeredSelectionID != store.workspace.selectedID
        let scroll: NSScrubber.Alignment? = changed ? (fromScrubber ? NSScrubber.Alignment.none : .center) : nil
        showSelected(scroll: scroll)
    }
    func setPinned(_ pinned: Bool) {
        if pinned {
            if pinnedBar == nil { pinnedBar = makePinnedTouchBar() }
            if let pinnedBar { SystemTouchBar.present(pinnedBar); refresh() }
        } else if let pinnedBar {
            SystemTouchBar.dismiss(pinnedBar)
        }
    }
    override func makeTouchBar() -> NSTouchBar? {
        let bar = NSTouchBar(); bar.delegate = self
        bar.defaultItemIdentifiers = [Self.pickerID]
        return bar
    }
    private func makePinnedTouchBar() -> NSTouchBar {
        let bar = NSTouchBar()
        bar.delegate = self
        bar.defaultItemIdentifiers = [Self.pickerID]
        return bar
    }
    func touchBar(_ touchBar: NSTouchBar, makeItemForIdentifier identifier: NSTouchBarItem.Identifier) -> NSTouchBarItem? {
        guard identifier == Self.pickerID else { return nil }
        let item = NSCustomTouchBarItem(identifier: identifier)
        let picker = BarScrubber()
        let layout = TouchBarScrubberLayout()
        layout.itemSize = NSSize(width: Self.itemSide, height: Self.itemSide)
        layout.itemSpacing = Self.itemSpacing
        picker.scrubberLayout = layout
        picker.mode = .free
        // Continuous would treat alignment .none as center and reselect on every pan, reflowing the wide item.
        picker.isContinuous = false
        picker.itemAlignment = .none
        picker.floatsSelectionViews = false
        picker.selectionBackgroundStyle = .roundedBackground
        picker.showsAdditionalContentIndicators = false
        picker.backgroundColor = .clear
        picker.register(AvatarScrubberItem.self, forItemIdentifier: Self.avatarID)
        picker.dataSource = self
        picker.delegate = self
        picker.translatesAutoresizingMaskIntoConstraints = false
        // A wide fixed width makes the scrubber believe every bot already fits, so free-mode pans do nothing.
        picker.setContentHuggingPriority(NSLayoutConstraint.Priority(1), for: .horizontal)
        picker.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        let height = picker.heightAnchor.constraint(equalToConstant: Self.itemSide)
        height.priority = .required
        height.isActive = true
        scrubbers[ObjectIdentifier(touchBar)] = picker
        item.view = picker
        DispatchQueue.main.async { [weak self] in self?.showSelected(scroll: .center) }
        return item
    }
    func numberOfItems(for scrubber: NSScrubber) -> Int { store.bots.count }
    func scrubber(_ scrubber: NSScrubber, viewForItemAt index: Int) -> NSScrubberItemView {
        let item = scrubber.makeItem(withIdentifier: Self.avatarID, owner: self) as! AvatarScrubberItem
        let bot = store.bots[index]
        configure(item, bot: bot, selected: bot.id == store.workspace.selectedID)
        if bot.avatar.kind == "picture" { Task { await AvatarPictures.shared.load(bot) } }
        return item
    }
    func itemSize(at itemIndex: Int) -> NSSize {
        let square = NSSize(width: Self.itemSide, height: Self.itemSide)
        guard store.bots.indices.contains(itemIndex) else { return square }
        let bot = store.bots[itemIndex]
        guard bot.id == store.workspace.selectedID else { return square }
        return NSSize(width: AvatarScrubberItem.selectedWidth(for: bot.name), height: Self.itemSide)
    }
    private func showSelected(scroll: NSScrubber.Alignment?) {
        guard !scrubbing, let id = store.workspace.selectedID, let index = store.bots.firstIndex(where: { $0.id == id }) else { return }
        centeredSelectionID = id
        let signature = "\(id)|\(store.bots.count)|\(Int(AvatarScrubberItem.selectedWidth(for: store.bots[index].name)))"
        withoutAnimation {
            for scrubber in scrubbers.values {
                let key = ObjectIdentifier(scrubber)
                if scrubber.selectedIndex != index { scrubber.selectedIndex = index }
                if widthSignatures[key] != signature {
                    widthSignatures[key] = signature
                    (scrubber.scrubberLayout as? NSScrubberFlowLayout)?.invalidateLayout()
                }
                scrubber.layoutSubtreeIfNeeded()
                if let scroll {
                    let alignment = scroll == NSScrubber.Alignment.none ? Self.revealAlignment(in: scrubber, index: index) : scroll
                    if let alignment { scrubber.scrollItem(at: index, to: alignment) }
                }
            }
        }
        paintScrubberImages()
    }
    private func withoutAnimation(_ changes: () -> Void) {
        NSAnimationContext.beginGrouping()
        NSAnimationContext.current.duration = 0
        NSAnimationContext.current.allowsImplicitAnimation = false
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        changes()
        CATransaction.commit()
        NSAnimationContext.endGrouping()
    }
    private func paintScrubberImages() {
        syncTouchBarMotion()
        imageRefreshPending = false
        let selected = store.workspace.selectedID
        for scrubber in scrubbers.values {
            for index in store.bots.indices {
                guard let item = scrubber.itemViewForItem(at: index) as? AvatarScrubberItem else { continue }
                configure(item, bot: store.bots[index], selected: store.bots[index].id == selected)
            }
        }
    }
    private func configure(_ item: AvatarScrubberItem, bot: Bot, selected: Bool) {
        let image = avatarImage(bot)
        if item.image !== image { item.image = image }
        let name = bot.name.isEmpty ? "未命名 Bot" : bot.name
        let star = store.mainAgentID == bot.id
        if item.showsName != selected || item.nameText != name {
            item.showsName = selected
            item.nameText = name
            item.needsLayout = true
        }
        item.setAccessibilityLabel(star ? "\(name)，主 Bot" : name)
    }
    private func syncTouchBarMotion() {
        guard !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion else { return }
        let poses = store.bots.compactMap { bot -> GrokAvatarRaster.StripPose? in
            guard bot.avatar.kind != "picture" else { return nil }
            let state = store.isExecuting(bot.id) ? "working" : "idle"
            return GrokAvatarRaster.StripPose(id: bot.id, shape: bot.avatarShape, hex: bot.avatar.character.baseHex, state: state, main: store.mainAgentID == bot.id)
        }
        GrokAvatarRaster.shared.syncStrip(poses)
    }
    private var fusedMarks: [ObjectIdentifier: NSImage] = [:]
    private func avatarImage(_ bot: Bot) -> NSImage {
        if bot.avatar.kind != "picture", !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion, let live = GrokAvatarRaster.shared.botFrame(bot.id) {
            return live
        }
        let base = AvatarImages.image(bot)
        guard store.mainAgentID == bot.id else { return base }
        let key = ObjectIdentifier(base)
        if let marked = fusedMarks[key] { return marked }
        let marked = MainBotMark.fuse(base)
        if fusedMarks.count > 80 { fusedMarks.removeAll() }
        fusedMarks[key] = marked
        return marked
    }
    /// `.none` means "reveal the whole item". A minimum scroll leaves a newly widened name under the close control.
    private static func revealAlignment(in scrubber: NSScrubber, index: Int) -> NSScrubber.Alignment? {
        guard let frame = scrubber.scrubberLayout.layoutAttributesForItem(at: index)?.frame else { return NSScrubber.Alignment.none }
        let visible = scrubber.scrubberLayout.visibleRect
        let tailHidden = frame.maxX > visible.maxX + 1
        let headHidden = frame.minX < visible.minX - 1
        if !tailHidden && !headHidden { return nil }
        if frame.width <= visible.width, tailHidden { return .trailing }
        return .leading
    }
    func didBeginInteracting(with scrubber: NSScrubber) {
        scrubbing = true
        interactionStartID = store.workspace.selectedID
        interactionMoved = false
        interactionOriginX = scrubber.scrubberLayout.visibleRect.origin.x
    }
    func scrubber(_ scrubber: NSScrubber, didSelectItemAt selectedIndex: Int) {
        guard store.bots.indices.contains(selectedIndex) else { return }
        let bot = store.bots[selectedIndex]
        if interactionStartID != bot.id { interactionMoved = true }
        selectionFromScrubber = true
        GrokAvatarRaster.shared.acknowledge(bot.id)
        store.select(bot, subscribe: false)
    }
    func didFinishInteracting(with scrubber: NSScrubber) {
        if let start = interactionOriginX, abs(scrubber.scrubberLayout.visibleRect.origin.x - start) > 6 {
            interactionMoved = true
        }
        scrubbing = false
        selectionFromScrubber = false
        if !interactionMoved, store.bots.indices.contains(scrubber.selectedIndex), store.bots[scrubber.selectedIndex].id == interactionStartID {
            compose?()
        }
        interactionStartID = nil
        interactionOriginX = nil
        let changed = centeredSelectionID != store.workspace.selectedID
        showSelected(scroll: changed ? NSScrubber.Alignment.none : nil)
        if imageRefreshPending { paintScrubberImages() }
    }
    func didCancelInteracting(with scrubber: NSScrubber) {
        scrubbing = false
        interactionStartID = nil
        interactionOriginX = nil
        selectionFromScrubber = false
        showSelected(scroll: nil)
        if imageRefreshPending { paintScrubberImages() }
    }
}

final class BarScrubber: NSScrubber {
    /// MacBook Pro Touch Bar is 2170 px at 2x. Anything wider is a stretched container, not the visible strip.
    private static let hardwareWidth: CGFloat = 1085
    private var slotWidth: NSLayoutConstraint?
    private var slotUpdateScheduled = false

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        scheduleSlotUpdate()
    }

    override func layout() {
        super.layout()
        scheduleSlotUpdate()
    }

    private func scheduleSlotUpdate() {
        guard !slotUpdateScheduled else { return }
        slotUpdateScheduled = true
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.slotUpdateScheduled = false
            self.applySlotWidth()
        }
    }

    private func applySlotWidth() {
        let slot = measuredSlot()
        guard slot > 120 else { return }
        if let slotWidth {
            if abs(slotWidth.constant - slot) > 0.5 { slotWidth.constant = slot }
            return
        }
        let match = widthAnchor.constraint(equalToConstant: slot)
        match.priority = NSLayoutConstraint.Priority(999)
        match.isActive = true
        slotWidth = match
    }

    /// Prefer the touch bar window. A shrunk wrapper must not win, and a 4000pt container must not either: content that fits inside the view cannot be panned.
    private func measuredSlot() -> CGFloat {
        if let window {
            let width = window.contentView?.bounds.width ?? window.frame.width
            let height = window.frame.height
            if width > 120, height > 0, height <= 80 { return min(width, Self.hardwareWidth) }
        }
        var best: CGFloat = 0
        var sawStretched = false
        var node = superview
        while let view = node {
            let width = view.bounds.width
            let height = view.bounds.height
            if height >= 24, height <= 60, width > 120 {
                if width <= Self.hardwareWidth {
                    best = max(best, width)
                } else {
                    sawStretched = true
                }
            }
            node = view.superview
        }
        if best > 0 { return best }
        return sawStretched ? Self.hardwareWidth : 0
    }
}

final class TouchBarScrubberLayout: NSScrubberFlowLayout {
    /// Trailing space so the last bot, and a selected name, can scroll clear of the system close control.
    static let endPadding: CGFloat = 96
    override var scrubberContentSize: NSSize {
        let size = super.scrubberContentSize
        guard size.width > 0 else { return size }
        return NSSize(width: size.width + Self.endPadding, height: size.height)
    }
}

extension PickerWindowController: NSScrubberFlowLayoutDelegate {
    nonisolated func scrubber(_ scrubber: NSScrubber, layout: NSScrubberFlowLayout, sizeForItemAt itemIndex: Int) -> NSSize {
        MainActor.assumeIsolated { itemSize(at: itemIndex) }
    }
}
