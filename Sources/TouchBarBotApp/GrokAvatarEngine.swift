import AppKit
import ObjectiveC
import SwiftUI
import WebKit

struct EngineStamp: Codable { var asarSize: Int; var asarMtimeMs: Double }

@MainActor
final class GrokAvatarEngine: ObservableObject {
    static let shared = GrokAvatarEngine()
    @Published private(set) var root: URL?
    @Published private(set) var failed = false

    func prepare() async {
        if NativeCompanion.enabled,
           let path = ProcessInfo.processInfo.environment["GROK_BOT_AVATAR_ROOT"],
           FileManager.default.fileExists(atPath: path + "/bridge.js") {
            root = URL(fileURLWithPath: path, isDirectory: true)
            return
        }
        let asar = URL(fileURLWithPath: "/Applications/Grok Bot.app/Contents/Resources/app.asar")
        guard FileManager.default.fileExists(atPath: asar.path),
              let script = Bundle.module.url(forResource: "install-engine", withExtension: "mjs", subdirectory: "GrokHost"),
              let node = Self.nodeURL() else { failed = true; return }
        let values = try? asar.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
        let size = values?.fileSize ?? 0
        let mtime = values?.contentModificationDate?.timeIntervalSince1970 ?? 0
        let out = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("TouchBarBot/GrokAvatar", isDirectory: true)
        if let data = try? Data(contentsOf: out.appendingPathComponent("engine.json")),
           let saved = try? JSONDecoder().decode(EngineStamp.self, from: data),
           saved.asarSize == size, abs(saved.asarMtimeMs - mtime * 1000) < 2000,
           FileManager.default.fileExists(atPath: out.appendingPathComponent("platform.js").path),
           FileManager.default.fileExists(atPath: out.appendingPathComponent("bridge.js").path) {
            root = out
            return
        }
        let installed: Bool = await Task.detached(priority: .userInitiated) {
            let process = Process()
            process.executableURL = node
            process.arguments = [script.path, out.path, asar.path]
            process.standardOutput = FileHandle.nullDevice
            process.standardError = FileHandle.nullDevice
            do { try process.run() } catch { return false }
            process.waitUntilExit()
            return process.terminationStatus == 0
        }.value
        if installed, FileManager.default.fileExists(atPath: out.appendingPathComponent("bridge.js").path) { root = out }
        else { failed = true }
    }

    private static func nodeURL() -> URL? {
        if let resources = Bundle.main.resourceURL {
            let packaged = resources.appendingPathComponent("runtime/node")
            if FileManager.default.isExecutableFile(atPath: packaged.path) { return packaged }
        }
        let candidates = [ProcessInfo.processInfo.environment["TOUCH_BAR_BOT_NODE"], "/opt/homebrew/bin/node", "/usr/local/bin/node"].compactMap { $0 }
        if let found = candidates.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) { return URL(fileURLWithPath: found) }
        let versions = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".nvm/versions/node")
        let dirs = (try? FileManager.default.contentsOfDirectory(at: versions, includingPropertiesForKeys: nil)) ?? []
        return dirs.sorted { $0.lastPathComponent > $1.lastPathComponent }.map { $0.appendingPathComponent("bin/node") }.first { FileManager.default.isExecutableFile(atPath: $0.path) }
    }
}

@MainActor
final class GrokAvatarRaster: ObservableObject {
    static let shared = GrokAvatarRaster()
    static let stripPage = URL(string: "grokavatar://avatar/strip.html")!
    static let stripMark: Double = 40
    static let stripCell: CGFloat = 56
    @Published private(set) var stills: [String: NSImage] = [:]
    private var clips: [String: [NSImage]] = [:]
    private var web: WKWebView?
    private var panel: NSPanel?
    private var ready = false
    private var waiters: [CheckedContinuation<Void, Never>] = []
    private var inflight: Set<String> = []
    private var warming: Set<String> = []
    private var rejectedClips: Set<String> = []
    private var clipAttempts: [String: Int] = [:]
    private var jobs: [() async -> Void] = []
    private var pumping = false
    private var stripPoses: [StripPose] = []
    private var stripSignature = ""
    private var stripDirty = false
    private var stripRunning = false
    private var stripFrames: [String: NSImage] = [:]
    private var stripStep = 0

    static func key(shape: String, hex: String) -> String { shape + "|" + hex.lowercased() }
    static func clipKey(shape: String, hex: String, state: String) -> String { key(shape: shape, hex: hex) + "|" + state }
    var isReady: Bool { ready }

    func start() {
        guard web == nil else { loadIfNeeded(); return }
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        if let root = GrokAvatarEngine.shared.root {
            config.setURLSchemeHandler(GrokAvatarScheme(root: root), forURLScheme: GrokAvatarScheme.scheme)
        }
        let view = WKWebView(frame: NSRect(x: 0, y: 0, width: 128, height: 128), configuration: config)
        view.navigationDelegate = RasterNavigation.shared
        view.setValue(false, forKey: "drawsBackground")
        view.underPageBackgroundColor = .clear
        let host = RasterPanel(contentRect: NSRect(x: -4000, y: -4000, width: 128, height: 128), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        host.isOpaque = false
        host.backgroundColor = .clear
        host.hasShadow = false
        host.ignoresMouseEvents = true
        host.level = .statusBar
        host.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        host.sharingType = .none
        host.alphaValue = 0.02
        host.contentView = view
        host.orderFrontRegardless()
        panel = host
        web = view
        RasterNavigation.shared.onFinish = { [weak self] in self?.didLoad() }
        loadIfNeeded()
    }

    func loadIfNeeded() {
        guard let web, GrokAvatarEngine.shared.root != nil else { return }
        if web.url != Self.stripPage { web.load(URLRequest(url: Self.stripPage)) }
    }

    func prefetch(_ bots: [Bot]) {
        for bot in bots where bot.avatar.kind != "picture" { request(shape: bot.avatarShape, hex: bot.avatar.character.baseHex) }
    }

    func request(shape: String, hex: String) {
        let key = Self.key(shape: shape, hex: hex)
        guard stills[key] == nil, !inflight.contains(key) else { return }
        inflight.insert(key)
        enqueue { [weak self] in
            guard let self else { return }
            if let image = await self.renderStill(shape: shape, hex: hex), Self.hasVisiblePixels(image) { self.stills[key] = image }
            self.inflight.remove(key)
        }
    }

    func still(shape: String, hex: String) -> NSImage? { stills[Self.key(shape: shape, hex: hex)] }

    func warm(shape: String, hex: String, state: String, seed: String, front: Bool = false) {
        let key = Self.clipKey(shape: shape, hex: hex, state: state)
        guard still(shape: shape, hex: hex) != nil else { return }
        guard (clips[key]?.count ?? 0) < 2, !warming.contains(key), !rejectedClips.contains(key) else { return }
        warming.insert(key)
        enqueue(front: front) { [weak self] in
            guard let self else { return }
            await self.sampleClip(shape: shape, hex: hex, state: state, seed: seed)
            self.warming.remove(key)
        }
    }

    func frame(shape: String, hex: String, state: String, date: TimeInterval = Date.timeIntervalSinceReferenceDate) -> NSImage? {
        let frames = clips[Self.clipKey(shape: shape, hex: hex, state: state)] ?? []
        guard frames.count >= 2 else { return nil }
        let fps = state == "working" ? 8.0 : 4.0
        let index = Int(date * fps) % frames.count
        return frames[index]
    }

    struct StripPose: Equatable {
        var id: String
        var shape: String
        var hex: String
        var state: String
        var main: Bool = false
    }

    func botFrame(_ id: String) -> NSImage? { stripFrames[id] }

    func syncStrip(_ poses: [StripPose]) {
        let signature = poses.map { "\($0.id)|\($0.shape)|\($0.hex)|\($0.state)|\($0.main)" }.joined(separator: "\n")
        if signature != stripSignature {
            stripSignature = signature
            stripPoses = poses
            stripDirty = true
        }
        guard !poses.isEmpty, !stripRunning else { return }
        stripRunning = true
        Task { @MainActor in await self.runStrip() }
    }

    func acknowledge(_ id: String) {
        guard id.range(of: #"^[A-Za-z0-9_-]+$"#, options: .regularExpression) != nil else { return }
        enqueue { _ = await self.runJS("if (window.acknowledge) window.acknowledge(id);", arguments: ["id": id]) }
    }

    private func runStrip() async {
        await untilReady()
        while !Task.isCancelled {
            if stripDirty {
                await enqueueWait {
                    let poses = self.stripPoses
                    self.stripDirty = false
                    await self.renderStrip(poses)
                }
            }
            await enqueueWait { await self.stepAndCapture() }
            try? await Task.sleep(nanoseconds: 20_000_000)
        }
    }

    private func enqueueWait(_ job: @escaping () async -> Void) async {
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            enqueue {
                await job()
                continuation.resume()
            }
        }
    }

    private func renderStrip(_ poses: [StripPose]) async {
        guard !poses.isEmpty else { return }
        resizeStrip(count: poses.count)
        let bots = poses.map { ["id": $0.id, "shape": $0.shape, "color": $0.hex, "state": $0.state, "main": $0.main] }
        _ = await runJS("""
        const started = Date.now();
        while (!window.renderStrip) { if (Date.now() - started > 4000) return; await new Promise(r => setTimeout(r, 40)); }
        window.renderStrip(config);
        await new Promise(r => setTimeout(r, 50));
        window.stepStrip(48); window.stepStrip(48); window.stepStrip(48); window.stepStrip(48);
        """, arguments: ["config": ["mark": Self.stripMark, "bots": bots]])
    }

    private func stepAndCapture() async {
        guard !stripPoses.isEmpty else { return }
        stripStep += 1
        if stripStep % 24 == 0 {
            _ = await runJS("return window.nodNeighbors ? window.nodNeighbors() : '';", arguments: [:])
        }
        _ = await runJS("if (window.stepStrip) window.stepStrip(33);", arguments: [:])
        guard let image = await snapshotStrip() else { return }
        slice(image)
    }

    private func resizeStrip(count: Int) {
        let width = CGFloat(max(count, 1)) * Self.stripCell
        let frame = NSRect(x: 0, y: 0, width: width, height: Self.stripCell)
        web?.frame = frame
        panel?.setFrame(NSRect(x: -8000, y: -8000, width: width, height: Self.stripCell), display: false)
    }

    private func snapshotStrip() async -> NSImage? {
        guard let web, !stripPoses.isEmpty else { return nil }
        resizeStrip(count: stripPoses.count)
        let width = CGFloat(stripPoses.count) * Self.stripCell
        let previous = panel?.alphaValue ?? 0.02
        panel?.alphaValue = 1
        panel?.orderFrontRegardless()
        web.layoutSubtreeIfNeeded()
        defer { panel?.alphaValue = previous }
        let config = WKSnapshotConfiguration()
        config.rect = NSRect(x: 0, y: 0, width: width, height: Self.stripCell)
        config.snapshotWidth = NSNumber(value: Double(width))
        config.afterScreenUpdates = true
        return try? await web.takeSnapshot(configuration: config)
    }

    private func slice(_ image: NSImage) {
        let count = stripPoses.count
        guard count > 0, image.size.width > 8, image.size.height > 8 else { return }
        let cellWidth = image.size.width / CGFloat(count)
        let cellHeight = image.size.height
        var next = stripFrames
        for (index, pose) in stripPoses.enumerated() {
            let piece = NSImage(size: NSSize(width: Self.stripCell, height: Self.stripCell))
            piece.lockFocus()
            image.draw(
                in: NSRect(x: 0, y: 0, width: Self.stripCell, height: Self.stripCell),
                from: NSRect(x: CGFloat(index) * cellWidth, y: 0, width: cellWidth, height: cellHeight),
                operation: .copy,
                fraction: 1
            )
            piece.unlockFocus()
            let bitmap = Self.bitmap(piece)
            guard Self.accepts(bitmap) else { continue }
            next[pose.id] = bitmap
        }
        stripFrames = next
    }

    func captureLive(shape: String, hex: String, state: String, seed: String) async -> NSImage? {
        await withCheckedContinuation { (continuation: CheckedContinuation<NSImage?, Never>) in
            enqueue { [weak self] in
                guard let self else { continuation.resume(returning: nil); return }
                let config: [String: Any] = ["shape": shape, "color": hex, "state": state, "seed": seed, "visible": true, "reducedMotion": false]
                _ = await self.runJS("const started = Date.now(); while (!window.prepareLive) { if (Date.now() - started > 4000) return; await new Promise(r => setTimeout(r, 40)); } window.prepareLive(config);", arguments: ["config": config])
                try? await Task.sleep(nanoseconds: 40_000_000)
                continuation.resume(returning: await self.grabLive())
            }
        }
    }

    private func didLoad() {
        ready = true
        let waiting = waiters
        waiters.removeAll()
        waiting.forEach { $0.resume() }
        pump()
    }

    private func untilReady() async {
        if ready { return }
        await withCheckedContinuation { waiters.append($0) }
    }

    private func enqueue(front: Bool = false, _ job: @escaping () async -> Void) {
        if front { jobs.insert(job, at: 0) } else { jobs.append(job) }
        pump()
    }

    private func pump() {
        guard ready, !pumping else { return }
        pumping = true
        Task { @MainActor in
            while let next = self.jobs.first {
                self.jobs.removeFirst()
                await next()
            }
            self.pumping = false
            if !self.jobs.isEmpty { self.pump() }
        }
    }

    private func renderStill(shape: String, hex: String) async -> NSImage? {
        let config: [String: Any] = ["shape": shape, "color": hex, "size": 128]
        let value = await runJS("const started = Date.now(); while (!window.renderStill) { if (Date.now() - started > 4000) return ''; await new Promise(r => setTimeout(r, 40)); } return await window.renderStill(config);", arguments: ["config": config])
        return decode(value)
    }

    private func sampleClip(shape: String, hex: String, state: String, seed: String) async {
        let key = Self.clipKey(shape: shape, hex: hex, state: state)
        let config: [String: Any] = ["shape": shape, "color": hex, "state": state, "seed": seed, "visible": true, "reducedMotion": false]
        _ = await runJS("const started = Date.now(); while (!window.prepareLive) { if (Date.now() - started > 4000) return; await new Promise(r => setTimeout(r, 40)); } window.prepareLive(config);", arguments: ["config": config])
        let pause: UInt64 = state == "working" ? 90_000_000 : 200_000_000
        var frames: [NSImage] = []
        for _ in 0..<6 {
            try? await Task.sleep(nanoseconds: pause)
            guard let image = await grabLive(), Self.hasVisiblePixels(image) else { continue }
            frames.append(image)
        }
        if frames.count >= 2 {
            clips[key] = frames
        } else {
            let attempts = (clipAttempts[key] ?? 0) + 1
            clipAttempts[key] = attempts
            if attempts >= 2 { rejectedClips.insert(key) }
        }
    }

    private func grabLive() async -> NSImage? {
        if let image = await snapshotLive(), Self.accepts(image) { return image }
        try? await Task.sleep(nanoseconds: 80_000_000)
        if let image = await snapshotLive(), Self.accepts(image) { return image }
        let value = await runJS("const started = Date.now(); while (!window.captureLive) { if (Date.now() - started > 4000) return ''; await new Promise(r => setTimeout(r, 40)); } return await window.captureLive(128);", arguments: [:])
        guard let image = decode(value), Self.accepts(image) else { return nil }
        return image
    }

    private func snapshotLive() async -> NSImage? {
        guard let web else { return nil }
        let previous = panel?.alphaValue ?? 0.02
        panel?.alphaValue = 1
        panel?.orderFrontRegardless()
        web.layoutSubtreeIfNeeded()
        defer { panel?.alphaValue = previous }
        let config = WKSnapshotConfiguration()
        config.rect = NSRect(x: 0, y: 0, width: 128, height: 128)
        config.snapshotWidth = NSNumber(value: 128)
        config.afterScreenUpdates = true
        guard let image = try? await web.takeSnapshot(configuration: config) else { return nil }
        return Self.bitmap(image)
    }

    private static func accepts(_ image: NSImage) -> Bool {
        hasVisiblePixels(image) && hasInk(image)
    }

    private func runJS(_ script: String, arguments: [String: Any]) async -> String? {
        guard let web else { return nil }
        await untilReady()
        return await withCheckedContinuation { continuation in
            web.callAsyncJavaScript(script, arguments: arguments, in: nil, in: .page) { result in
                continuation.resume(returning: (try? result.get()) as? String)
            }
        }
    }

    private func decode(_ text: String?) -> NSImage? {
        guard let text, let range = text.range(of: "base64,"), let data = Data(base64Encoded: String(text[range.upperBound...])), let image = NSImage(data: data), image.size.width > 8 else { return nil }
        return Self.bitmap(image)
    }

    private static func bitmap(_ image: NSImage) -> NSImage {
        let size = image.size
        let pixels = NSSize(width: max(1, size.width * 2), height: max(1, size.height * 2))
        guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(pixels.width), pixelsHigh: Int(pixels.height), bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0) else {
            image.isTemplate = false
            return image
        }
        rep.size = size
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
        image.draw(in: NSRect(origin: .zero, size: size))
        NSGraphicsContext.restoreGraphicsState()
        let out = NSImage(size: size)
        out.addRepresentation(rep)
        out.isTemplate = false
        return out
    }

    private static func hasVisiblePixels(_ image: NSImage) -> Bool {
        guard let rep = image.representations.compactMap({ $0 as? NSBitmapImageRep }).first ?? NSBitmapImageRep(data: image.tiffRepresentation ?? Data()) else { return false }
        let width = rep.pixelsWide
        let height = rep.pixelsHigh
        guard width > 8, height > 8 else { return false }
        var hits = 0
        var sampled = 0
        let stepX = max(1, width / 12)
        let stepY = max(1, height / 12)
        for y in stride(from: stepY, to: height, by: stepY) {
            for x in stride(from: stepX, to: width, by: stepX) {
                guard let color = rep.colorAt(x: x, y: y) else { continue }
                sampled += 1
                if color.alphaComponent > 0.15 { hits += 1 }
                if hits >= 6 { return true }
            }
        }
        return sampled == 0
    }

    private static func hasInk(_ image: NSImage) -> Bool {
        guard let rep = image.representations.compactMap({ $0 as? NSBitmapImageRep }).first ?? NSBitmapImageRep(data: image.tiffRepresentation ?? Data()) else { return false }
        let width = rep.pixelsWide
        let height = rep.pixelsHigh
        guard width > 8, height > 8 else { return false }
        var colorful = 0
        var opaque = 0
        let stepX = max(1, width / 12)
        let stepY = max(1, height / 12)
        for y in stride(from: stepY, to: height, by: stepY) {
            for x in stride(from: stepX, to: width, by: stepX) {
                guard let color = rep.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB), color.alphaComponent > 0.4 else { continue }
                opaque += 1
                let maxChannel = max(color.redComponent, color.greenComponent, color.blueComponent)
                let minChannel = min(color.redComponent, color.greenComponent, color.blueComponent)
                if maxChannel > 0.22 && maxChannel - minChannel > 0.08 { colorful += 1 }
            }
        }
        // Near-black silhouettes are rejected. Pale or gray avatars still count as ink.
        var lit = 0
        for y in stride(from: stepY, to: height, by: stepY) {
            for x in stride(from: stepX, to: width, by: stepX) {
                guard let color = rep.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB), color.alphaComponent > 0.4 else { continue }
                if max(color.redComponent, color.greenComponent, color.blueComponent) > 0.18 { lit += 1 }
            }
        }
        return opaque > 0 && (colorful * 3 >= opaque || lit * 2 >= opaque)
    }
}

@MainActor
final class RasterNavigation: NSObject, WKNavigationDelegate {
    static let shared = RasterNavigation()
    var onFinish: (() -> Void)?
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { onFinish?() }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        navigationAction.request.url?.scheme == GrokAvatarScheme.scheme ? .allow : .cancel
    }
}

final class GrokAvatarScheme: NSObject, WKURLSchemeHandler {
    static let scheme = "grokavatar"
    static let page = URL(string: "grokavatar://avatar/index.html")!
    let root: URL
    private let lock = NSLock()
    private var stopped: Set<ObjectIdentifier> = []
    init(root: URL) { self.root = root }
    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        let task = urlSchemeTask as AnyObject
        let requested = urlSchemeTask.request.url?.lastPathComponent ?? ""
        let name = requested == "strip.html" ? "index.html" : requested
        let allowed: Set<String> = ["index.html", "bridge.js", "common.js", "vendor.js", "platform.js"]
        guard allowed.contains(name), let url = urlSchemeTask.request.url, let data = try? Data(contentsOf: root.appendingPathComponent(name)) else {
            if !isStopped(task) { urlSchemeTask.didFailWithError(NSError(domain: "GrokAvatar", code: 404)) }
            return
        }
        let mime = name.hasSuffix(".html") ? "text/html" : "text/javascript"
        guard let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [
            "Content-Type": "\(mime); charset=utf-8",
            "Content-Length": String(data.count),
            "Access-Control-Allow-Origin": "*"
        ]) else { return }
        guard !isStopped(task) else { return }
        urlSchemeTask.didReceive(response)
        guard !isStopped(task) else { return }
        urlSchemeTask.didReceive(data)
        guard !isStopped(task) else { return }
        urlSchemeTask.didFinish()
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {
        lock.lock(); stopped.insert(ObjectIdentifier(urlSchemeTask as AnyObject)); lock.unlock()
    }
    private func isStopped(_ task: AnyObject) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return stopped.contains(ObjectIdentifier(task))
    }
}

private final class RasterPanel: NSPanel {
    override func constrainFrameRect(_ frameRect: NSRect, to screen: NSScreen?) -> NSRect { frameRect }
}

enum SystemTouchBar {
    static func present(_ bar: NSTouchBar) {
        let selector = NSSelectorFromString("presentSystemModalTouchBar:systemTrayItemIdentifier:")
        guard let method = class_getClassMethod(NSTouchBar.self, selector) else { return }
        typealias Present = @convention(c) (AnyObject, Selector, NSTouchBar, AnyObject?) -> Void
        unsafeBitCast(method_getImplementation(method), to: Present.self)(NSTouchBar.self, selector, bar, nil)
    }
    static func dismiss(_ bar: NSTouchBar) {
        let selector = NSSelectorFromString("dismissSystemModalTouchBar:")
        guard let method = class_getClassMethod(NSTouchBar.self, selector) else { return }
        typealias Dismiss = @convention(c) (AnyObject, Selector, NSTouchBar) -> Void
        unsafeBitCast(method_getImplementation(method), to: Dismiss.self)(NSTouchBar.self, selector, bar)
    }
}

final class AvatarScrubberItem: NSScrubberItemView {
    static let side: CGFloat = 30
    static let nameGap: CGFloat = 6
    static let nameTrail: CGFloat = 8
    static let nameFont = NSFont.systemFont(ofSize: 13, weight: .medium)
    static func selectedWidth(for name: String) -> CGFloat {
        let shown = name.isEmpty ? "未命名 Bot" : name
        let text = ceil((shown as NSString).boundingRect(
            with: NSSize(width: 10_000, height: 40),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: [.font: nameFont]
        ).width)
        return side + nameGap + text + nameTrail + 8
    }
    let imageView = NSImageView()
    let nameField = NSTextField(labelWithString: "")
    var showsName = false
    var nameText = ""
    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        imageView.imageScaling = .scaleProportionallyUpOrDown
        imageView.imageAlignment = .alignCenter
        nameField.font = Self.nameFont
        nameField.textColor = .labelColor
        nameField.lineBreakMode = .byClipping
        nameField.maximumNumberOfLines = 1
        nameField.drawsBackground = false
        nameField.isBordered = false
        nameField.isEditable = false
        nameField.cell?.lineBreakMode = .byClipping
        nameField.cell?.truncatesLastVisibleLine = false
        nameField.cell?.wraps = false
        addSubview(imageView)
        addSubview(nameField)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
    override func layout() {
        super.layout()
        let inset: CGFloat = 0
        let avatarSide = max(0, bounds.height - inset * 2)
        imageView.frame = NSRect(x: inset, y: inset, width: avatarSide, height: avatarSide)
        if showsName {
            nameField.isHidden = false
            nameField.stringValue = nameText
            let textHeight: CGFloat = 16
            let textX = bounds.height + Self.nameGap
            nameField.frame = NSRect(x: textX, y: (bounds.height - textHeight) / 2, width: max(0, bounds.width - textX - Self.nameTrail), height: textHeight)
        } else {
            nameField.isHidden = true
        }
    }
    var image: NSImage? {
        get { imageView.image }
        set { imageView.image = newValue }
    }
}
