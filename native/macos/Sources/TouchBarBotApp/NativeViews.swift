import AppKit
import SwiftUI
import UniformTypeIdentifiers

struct BotLibraryView: View {
    @ObservedObject var store: AppStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                HStack {
                    Text("你的 Bots").font(.title3.weight(.semibold))
                    Spacer()
                    if store.isLoading { ProgressView().controlSize(.small) }
                    else { Text("\(store.bots.count)").font(.caption.monospacedDigit()).foregroundStyle(.secondary) }
                }.padding(.horizontal, 18).padding(.top, 20).padding(.bottom, 12)
                if store.bots.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "person.crop.circle.badge.plus").font(.system(size: 28, weight: .light)).foregroundStyle(.secondary)
                        Text("连接你的账号").font(.headline)
                        Text("登录后，已有 Bots 会出现在这里。").font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    }.padding(24).frame(maxHeight: .infinity)
                } else {
                    List(selection: Binding(get: { store.workspace.selectedID }, set: { id in if let bot = store.bots.first(where: { $0.id == id }) { store.select(bot) } })) {
                        ForEach(store.filteredBots) { bot in
                            HStack(spacing: 10) {
                                BotAvatarView(bot: bot, size: 34, main: store.mainAgentID == bot.id)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(bot.name.isEmpty ? "未命名 Bot" : bot.name).font(.system(size: 13, weight: .medium)).lineLimit(1)
                                    Text(bot.viewerIsOwner ? "个人 Bot" : "共享 Bot").font(.system(size: 10)).foregroundStyle(.secondary)
                                }
                                Spacer(minLength: 0)
                            }.padding(.vertical, 4).tag(bot.id)
                        }
                    }.listStyle(.sidebar).searchable(text: $store.search, placement: .sidebar, prompt: "搜索 Bot")
                }
                Divider()
                VStack(alignment: .leading, spacing: 8) {
                    Toggle("常驻 Touch Bar", isOn: Binding(get: { store.pinTouchBar }, set: { store.setPinnedTouchBar($0) }))
                        .toggleStyle(.switch)
                        .help("开启后，切换到其他应用时 Touch Bar 仍只保留 Bot 选择")
                    Picker("发送后", selection: Binding(get: { store.keepComposerAfterSend }, set: { store.setKeepComposerAfterSend($0) })) {
                        Text("保留输入框").tag(true)
                        Text("直接隐藏").tag(false)
                    }
                    .pickerStyle(.menu)
                    .help("消息发出后，保留输入框或直接收起")
                    Toggle("点按外部关闭", isOn: Binding(get: { store.dismissComposerOnOutsideClick }, set: { store.setDismissComposerOnOutsideClick($0) }))
                        .toggleStyle(.switch)
                        .help("开启后，点按输入框以外会收起输入框，并不显示关闭按钮。关闭后，空白处仍可穿透，输入框显示关闭按钮。")
                }
                .font(.caption)
                .padding(.horizontal, 16)
                .padding(.top, 10)
                HStack(spacing: 7) {
                    Circle().fill(store.isConnected ? Color.green : Color.secondary.opacity(0.45)).frame(width: 5, height: 5)
                    Text(store.preview ? "界面预览" : store.isConnected ? "账号已连接" : "尚未登录").font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Menu {
                        if store.preview { Button("退出预览") { store.leavePreview() }; Divider() }
                        Button("浏览器登录") { Task { await store.login() } }
                        Button("使用本机 Grok Bot 登录") { Task { await store.login(desktop: true) } }
                        Divider()
                        Button("退出账号", role: .destructive) { Task { await store.logout() } }.disabled(!store.isConnected || store.sendingBotID != nil)
                    } label: { Image(systemName: "person.crop.circle") }.menuStyle(.borderlessButton).fixedSize().help("账号")
                }.padding(16)
            }.navigationSplitViewColumnWidth(min: 210, ideal: 236, max: 290)
        } detail: {
            VStack(spacing: 0) {
                HStack {
                    Text("TOUCH BAR BOT").font(.system(size: 10, weight: .medium, design: .rounded)).tracking(2).foregroundStyle(.tertiary)
                    Spacer()
                    Button { Task { await store.refresh() } } label: { Image(systemName: "arrow.clockwise") }
                        .buttonStyle(.borderless).help("刷新名单").disabled(!store.isConnected || store.isLoading)
                }.padding(.horizontal, 28).padding(.top, 22)
                Spacer(minLength: 20)
                if let bot = store.selectedBot {
                    AnimatedAvatar(bot: bot, state: store.animationState, visible: true, reducedMotion: reduceMotion, size: 112, main: store.mainAgentID == bot.id)
                    Text(bot.name).font(.system(size: 27, weight: .semibold)).lineLimit(2).multilineTextAlignment(.center).padding(.top, 18)
                    Text(bot.description.isEmpty ? "一个想法，一次对话。" : bot.description)
                        .font(.system(size: 13)).foregroundStyle(.secondary).lineLimit(3).multilineTextAlignment(.center).padding(.horizontal, 28).padding(.top, 8)
                    Button { store.openComposer?() } label: {
                        Label("开始对话", systemImage: "square.and.pencil").padding(.horizontal, 16).padding(.vertical, 5)
                    }.buttonStyle(.borderedProminent).controlSize(.large).padding(.top, 26)
                    Text("⌃⌥空格 唤起  ·  ⌃⌥V 语音发送").font(.system(size: 11)).foregroundStyle(.tertiary).padding(.top, 12)
                    if !store.hotkeyAvailable { Text("快捷键被占用，请从菜单栏打开。").font(.caption).foregroundStyle(.orange).padding(.top, 6) }
                } else {
                    Image(systemName: "rectangle.and.hand.point.up.left").font(.system(size: 52, weight: .ultraLight)).foregroundStyle(.secondary)
                    Text("你的 Bots，触手可及。").font(.system(size: 25, weight: .semibold)).padding(.top, 22)
                    Text("滑动 Touch Bar 选择，按下快捷键开始对话。").font(.system(size: 13)).foregroundStyle(.secondary).padding(.top, 10)
                    Button("连接 Grok Bot 账号") { Task { await store.login() } }.buttonStyle(.borderedProminent).controlSize(.large).padding(.top, 26).disabled(store.isLoading)
                    Button("使用本机已有登录") { Task { await store.login(desktop: true) } }.buttonStyle(.link).font(.caption).padding(.top, 12).disabled(store.isLoading)
                    Button("先预览一下") { store.showPreview() }.buttonStyle(.link).font(.caption).foregroundStyle(.secondary).padding(.top, 8).disabled(store.isLoading)
                }
                Spacer(minLength: 25)
                if let issue = store.issue { Label(issue, systemImage: "exclamationmark.circle").font(.caption).foregroundStyle(.secondary).padding(.horizontal, 24).padding(.bottom, 12).textSelection(.enabled) }
                HStack(spacing: 6) {
                    Image(systemName: store.preview ? "eye" : "checkmark.circle")
                    Text(store.status).lineLimit(2)
                }.font(.system(size: 11)).foregroundStyle(.secondary).padding(.bottom, 22)
            }.frame(minWidth: 390).background(Color(nsColor: .windowBackgroundColor))
        }.frame(minWidth: 690, minHeight: 490)
    }
}

struct ComposerView: View {
    @ObservedObject var store: AppStore
    @ObservedObject var speech: SpeechService
    let close: () -> Void
    var onLayout: (Bool) -> Void = { _ in }
    var onHeight: (CGFloat) -> Void = { _ in }
    var onRegions: ([CGRect]) -> Void = { _ in }
    @State private var confirmSendHold = false
    @State private var picking = false
    @State private var pickIndex = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private static let pickColumns = 10
    static let pickerWidth: CGFloat = 760
    static let fieldWidth: CGFloat = 368
    var body: some View {
        VStack(spacing: 8) {
            if picking {
                BotPicker(bots: store.bots, index: pickIndex, mainID: store.mainAgentID, reduceMotion: reduceMotion, choose: { index in
                    pickIndex = index
                    confirmPick()
                })
                .transition(.opacity)
                .anchorPreference(key: HitRegionKey.self, value: .bounds) { [$0] }
            }
            if let bot = store.selectedBot {
                VStack(spacing: 6) {
                    AnimatedAvatar(bot: bot, state: store.animationState, visible: store.composerVisible, reducedMotion: reduceMotion, size: 88, main: store.mainAgentID == bot.id)
                        .allowsHitTesting(false)
                    inputCard(bot)
                }
                .frame(width: Self.fieldWidth)
                .layoutPriority(1)
                .anchorPreference(key: HitRegionKey.self, value: .bounds) { [$0] }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 12)
        .frame(width: picking ? Self.pickerWidth : 400, alignment: .bottom)
        .fixedSize(horizontal: false, vertical: true)
        .background {
            GeometryReader { proxy in
                Color.clear.preference(key: ComposerHeightKey.self, value: proxy.size.height)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .onPreferenceChange(ComposerHeightKey.self) { height in
            guard height > 1 else { return }
            DispatchQueue.main.async { onHeight(height) }
        }
        .backgroundPreferenceValue(HitRegionKey.self) { anchors in
            GeometryReader { proxy in
                Color.clear.preference(key: HitRectsKey.self, value: anchors.map { proxy[$0] })
            }
        }
        .onPreferenceChange(HitRectsKey.self) { rects in
            DispatchQueue.main.async { onRegions(rects) }
        }
        .onChange(of: picking) {
            onLayout(picking)
            DispatchQueue.main.async { onLayout(picking) }
        }
        .onChange(of: store.bots.count) {
            if pickIndex >= store.bots.count { pickIndex = max(0, store.bots.count - 1) }
            if picking { onLayout(true) }
        }
        .onDrop(of: Self.dropTypes, isTargeted: nil) { acceptDrop($0) }
    }

    private static let dropTypes = [UTType.fileURL.identifier, UTType.image.identifier, UTType.png.identifier, UTType.jpeg.identifier, UTType.tiff.identifier, UTType.gif.identifier, UTType.heic.identifier]

    private func acceptDrop(_ providers: [NSItemProvider]) -> Bool {
        let fileProviders = providers.filter { $0.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) }
        let chosen = fileProviders.isEmpty ? providers : fileProviders
        var accepted = false
        for provider in chosen {
            if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
                accepted = true
                provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                    let url: URL?
                    if let found = item as? URL { url = found }
                    else if let data = item as? Data { url = URL(dataRepresentation: data, relativeTo: nil) }
                    else { url = nil }
                    guard let url, let copy = copiedDropFile(url) else { return }
                    Task { @MainActor in store.addFiles([copy]) }
                }
                continue
            }
            let imageType = [UTType.png, .jpeg, .tiff, .gif, .heic, .image].first { provider.hasItemConformingToTypeIdentifier($0.identifier) }
            guard let imageType else { continue }
            accepted = true
            provider.loadDataRepresentation(forTypeIdentifier: imageType.identifier) { data, _ in
                guard let data, !data.isEmpty else { return }
                let ext = imageType.preferredFilenameExtension ?? "png"
                let url = FileManager.default.temporaryDirectory.appendingPathComponent("touch-bar-bot-\(UUID().uuidString).\(ext)")
                guard (try? data.write(to: url, options: .atomic)) != nil else { return }
                Task { @MainActor in store.addFiles([url]) }
            }
        }
        return accepted
    }



    private func beginPick() {
        guard !store.bots.isEmpty, !speech.isRecording else { return }
        if let id = store.workspace.selectedID, let index = store.bots.firstIndex(where: { $0.id == id }) {
            pickIndex = index
        } else {
            pickIndex = 0
        }
        setPicking(true)
    }

    private func confirmPick() {
        guard picking, store.bots.indices.contains(pickIndex) else { setPicking(false); return }
        let bot = store.bots[pickIndex]
        setPicking(false)
        if bot.id != store.workspace.selectedID { store.select(bot) }
    }

    private func setPicking(_ value: Bool) {
        let animation: Animation? = reduceMotion ? nil : .spring(response: 0.42, dampingFraction: 0.86)
        withAnimation(animation) { picking = value }
    }

    private func movePick(dx: Int, dy: Int) {
        let count = store.bots.count
        guard count > 0 else { return }
        if dx != 0 {
            let next = pickIndex + dx
            if next >= 0 && next < count { pickIndex = next }
            return
        }
        let column = pickIndex % Self.pickColumns
        let next = pickIndex + dy * Self.pickColumns
        if next >= 0 && next < count {
            pickIndex = next
        } else if dy > 0, pickIndex / Self.pickColumns < (count - 1) / Self.pickColumns {
            pickIndex = min(count - 1, ((count - 1) / Self.pickColumns) * Self.pickColumns + column)
        }
    }

    private func pickDigit(_ column: Int) {
        guard picking else { return }
        let next = (pickIndex / Self.pickColumns) * Self.pickColumns + column
        guard store.bots.indices.contains(next) else { return }
        pickIndex = next
        confirmPick()
    }

    private func inputCard(_ bot: Bot) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ComposerField(
                text: Binding(get: { store.draftText }, set: { store.draftText = $0 }),
                isEnabled: !speech.isRecording,
                isActive: store.composerVisible && !speech.isRecording,
                navigates: picking,
                onSubmit: { if picking { confirmPick() } else { Task { await store.send() } } },
                onCancel: { if picking { setPicking(false) } else { close() } },
                onTab: { if picking { confirmPick() } else { beginPick() } },
                onNavigate: { movePick(dx: $0, dy: $1) },
                onDigit: { pickDigit($0) },
                onRow: { movePick(dx: 0, dy: $0) }
            )
            .accessibilityLabel("发给\(bot.name)的消息")
            if let issue = store.issue ?? speech.issue {
                Text(issue).font(.system(size: 11)).foregroundStyle(.secondary).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading)
            }
            if speech.isRecording {
                HStack(spacing: 8) {
                    HStack(spacing: 2) { ForEach(0..<7) { i in Capsule().fill(.red.opacity(0.7)).frame(width: 2, height: CGFloat(3 + speech.level * Float(6 + (i % 3) * 4))) } }
                        .frame(height: 14)
                        .accessibilityLabel("录音声级")
                    if store.dictationArmed { Text("按任意键发送").font(.system(size: 11)).foregroundStyle(.secondary) }
                }
            }
            if !store.attachments.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(store.attachments) { file in
                            HStack(spacing: 4) {
                                Text(file.name).lineLimit(1)
                                Button { store.removeFile(file.id) } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }.buttonStyle(.borderless).help("移除 \(file.name)")
                            }.font(.system(size: 11)).padding(.horizontal, 8).padding(.vertical, 4).background(.primary.opacity(0.06), in: Capsule())
                        }
                    }
                }
            }
            if store.uncertainSends[bot.id] != nil && store.sendingBotID == nil {
                HStack(spacing: 8) {
                    Text("上次投递尚未确认").font(.caption).foregroundStyle(.secondary)
                    Button("解除暂停") { confirmSendHold = true }.font(.caption).buttonStyle(.link)
                }
                .confirmationDialog("超时后原请求仍可能继续投递。请先在 Grok Bot 里核对。解除暂停不会自动重发。", isPresented: $confirmSendHold) {
                    Button("解除暂停") { Task { await store.clearSendHold() } }
                    Button("取消", role: .cancel) { }
                }
            }
            HStack(spacing: 8) {
                Button { store.chooseFiles() } label: { Image(systemName: "paperclip").frame(width: 22, height: 22) }.help("添加附件，单个暂限 4 MB")
                Button { store.toggleRecording() } label: { Image(systemName: speech.isRecording ? "stop.circle.fill" : "mic").foregroundStyle(speech.isRecording ? Color.red : Color.primary).frame(width: 22, height: 22) }
                    .help(speech.isRecording ? "停止录音" : "设备端中文语音转写")
                    .disabled(store.preview || !store.isConnected)
                Spacer(minLength: 0)
                ZStack { if store.sendingBotID != nil { ProgressView().controlSize(.small) } }.frame(width: 22, height: 22)
                Button { Task { await store.send() } } label: { Image(systemName: "arrow.up").font(.system(size: 12, weight: .semibold)).frame(width: 22, height: 22) }
                    .buttonStyle(.borderedProminent).clipShape(Circle()).help("发送").disabled(!store.canSend)
                if !store.dismissComposerOnOutsideClick {
                    Button(action: close) { Image(systemName: "xmark").font(.system(size: 11, weight: .semibold)).frame(width: 22, height: 22) }
                        .buttonStyle(.borderless).foregroundStyle(.secondary).help("收起 · Esc")
                }
            }
            .buttonStyle(.borderless)
        }
        .padding(.horizontal, 12)
        .padding(.top, 10)
        .padding(.bottom, 8)
        .modifier(ComposerGlass())
    }
}

private func copiedDropFile(_ url: URL) -> URL? {
    let accessing = url.startAccessingSecurityScopedResource()
    defer { if accessing { url.stopAccessingSecurityScopedResource() } }
    let ext = url.pathExtension.isEmpty ? "png" : url.pathExtension
    let dest = FileManager.default.temporaryDirectory.appendingPathComponent("touch-bar-bot-\(UUID().uuidString).\(ext)")
    if (try? FileManager.default.copyItem(at: url, to: dest)) != nil { return dest }
    return url
}

private struct ComposerHeightKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        let next = nextValue()
        if next > 0 { value = next }
    }
}

private struct HitRegionKey: PreferenceKey {
    static let defaultValue: [Anchor<CGRect>] = []
    static func reduce(value: inout [Anchor<CGRect>], nextValue: () -> [Anchor<CGRect>]) {
        value.append(contentsOf: nextValue())
    }
}

private struct HitRectsKey: PreferenceKey {
    static let defaultValue: [CGRect] = []
    static func reduce(value: inout [CGRect], nextValue: () -> [CGRect]) {
        value.append(contentsOf: nextValue())
    }
}

private struct BotPicker: View {
    let bots: [Bot]
    let index: Int
    let mainID: String?
    var reduceMotion: Bool
    var choose: (Int) -> Void
    private static let columnCount = 10
    private static let rowHeight: CGFloat = 86
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: columnCount)
    private var listHeight: CGFloat {
        let rows = ceil(Double(max(bots.count, 1)) / Double(Self.columnCount))
        return min(2, rows) * Self.rowHeight + 8
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVGrid(columns: columns, spacing: 6) {
                        ForEach(Array(bots.enumerated()), id: \.element.id) { item, bot in
                            let row = item / Self.columnCount
                            let activeRow = index / Self.columnCount
                            VStack(spacing: 4) {
                                BotAvatarView(bot: bot, size: 36, main: mainID == bot.id)
                                Text(bot.name.isEmpty ? "未命名 Bot" : bot.name)
                                    .font(.system(size: 10, weight: item == index ? .semibold : .medium))
                                    .multilineTextAlignment(.center)
                                    .lineLimit(2)
                                    .frame(maxWidth: .infinity, minHeight: 24, alignment: .top)
                            }
                            .padding(.horizontal, 3)
                            .padding(.vertical, 6)
                            .frame(maxWidth: .infinity, minHeight: Self.rowHeight - 6, alignment: .top)
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(item == index ? Color.accentColor.opacity(0.18) : Color.primary.opacity(0.05))
                            )
                            .overlay(alignment: .topLeading) {
                                if row == activeRow {
                                    Text(item % Self.columnCount == 9 ? "0" : "\(item % Self.columnCount + 1)")
                                        .font(.system(size: 9, weight: .semibold, design: .rounded))
                                        .foregroundStyle(.secondary)
                                        .padding(4)
                                }
                            }
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .strokeBorder(item == index ? Color.accentColor.opacity(0.9) : Color.clear, lineWidth: 1.5)
                            )
                            .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .onTapGesture { choose(item) }
                            .id(bot.id)
                            .accessibilityElement(children: .combine)
                            .accessibilityLabel(bot.name.isEmpty ? "未命名 Bot" : bot.name)
                            .accessibilityAddTraits(item == index ? .isSelected : [])
                        }
                    }
                    .padding(8)
                    .animation(reduceMotion ? .none : .spring(response: 0.28, dampingFraction: 0.78), value: index)
                }
                .frame(height: listHeight)
                .onAppear { reveal(proxy) }
                .onChange(of: index) { reveal(proxy) }
            }
            Text("1–0 选择当前行    − + 换行    回车或 Tab 确认    Esc 取消")
                .font(.system(size: 10))
                .foregroundStyle(.tertiary)
                .frame(maxWidth: .infinity)
                .padding(.bottom, 8)
        }
        .modifier(ComposerGlass())
        .fixedSize(horizontal: false, vertical: true)
        .focusable(false)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Bot 列表")
    }
    private func reveal(_ proxy: ScrollViewProxy) {
        guard bots.indices.contains(index) else { return }
        if reduceMotion { proxy.scrollTo(bots[index].id, anchor: .center) }
        else { withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo(bots[index].id, anchor: .center) } }
    }
}

private struct ComposerField: NSViewRepresentable {
    @Binding var text: String
    var isEnabled: Bool
    var isActive: Bool
    var navigates: Bool
    var onSubmit: () -> Void
    var onCancel: () -> Void
    var onTab: () -> Void
    var onNavigate: (Int, Int) -> Void
    var onDigit: (Int) -> Void
    var onRow: (Int) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeNSView(context: Context) -> ComposerTextView {
        let view = ComposerTextView()
        view.delegate = context.coordinator
        view.onSubmit = onSubmit
        view.onCancel = onCancel
        view.onTab = onTab
        view.onNavigate = onNavigate
        view.onDigit = onDigit
        view.onRow = onRow
        view.navigates = navigates
        view.string = text
        return view
    }
    func updateNSView(_ view: ComposerTextView, context: Context) {
        context.coordinator.parent = self
        view.onSubmit = onSubmit
        view.onCancel = onCancel
        view.onTab = onTab
        view.onNavigate = onNavigate
        view.onDigit = onDigit
        view.onRow = onRow
        view.navigates = navigates
        view.isEditable = isEnabled
        view.isSelectable = isEnabled
        if view.string != text { view.string = text }
        if isActive, view.window?.firstResponder !== view {
            DispatchQueue.main.async { view.window?.makeFirstResponder(view) }
        }
    }
    func sizeThatFits(_ proposal: ProposedViewSize, nsView: ComposerTextView, context: Context) -> CGSize? {
        let width = max(120, proposal.width ?? 240)
        nsView.textContainer?.containerSize = NSSize(width: width, height: CGFloat.greatestFiniteMagnitude)
        nsView.layoutManager?.ensureLayout(for: nsView.textContainer!)
        let used = nsView.layoutManager?.usedRect(for: nsView.textContainer!).height ?? 22
        return CGSize(width: width, height: min(160, max(22, ceil(used) + 6)))
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: ComposerField
        init(_ parent: ComposerField) { self.parent = parent }
        func textDidChange(_ notification: Notification) {
            guard let view = notification.object as? NSTextView, parent.text != view.string else { return }
            parent.text = view.string
        }
    }
}

private final class ComposerTextView: NSTextView {
    var onSubmit: (() -> Void)?
    var onCancel: (() -> Void)?
    var onTab: (() -> Void)?
    var onNavigate: ((Int, Int) -> Void)?
    var onDigit: ((Int) -> Void)?
    var onRow: ((Int) -> Void)?
    var navigates = false
    /// Return that already confirmed a composition, keyed by the event timestamp.
    /// An input method can commit marked text before this view sees keyDown.
    private var returnHandledByInputMethod: TimeInterval = .nan
    convenience init() { self.init(frame: NSRect(x: 0, y: 0, width: 240, height: 22), textContainer: nil) }
    override init(frame frameRect: NSRect, textContainer container: NSTextContainer?) {
        let storage = NSTextStorage()
        let layout = NSLayoutManager()
        let textContainer = NSTextContainer(size: NSSize(width: 240, height: CGFloat.greatestFiniteMagnitude))
        textContainer.widthTracksTextView = true
        storage.addLayoutManager(layout)
        layout.addTextContainer(textContainer)
        super.init(frame: frameRect, textContainer: textContainer)
        drawsBackground = false
        isRichText = false
        isAutomaticQuoteSubstitutionEnabled = false
        isAutomaticDashSubstitutionEnabled = false
        isAutomaticTextReplacementEnabled = false
        font = .systemFont(ofSize: 14)
        textContainerInset = NSSize(width: 0, height: 2)
        isVerticallyResizable = true
        isHorizontallyResizable = false
        autoresizingMask = [.width]
        insertionPointColor = .labelColor
        unregisterDraggedTypes()
    }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard string.isEmpty, let font else { return }
        let pad = textContainer?.lineFragmentPadding ?? 0
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor.placeholderTextColor]
        NSString("消息").draw(at: NSPoint(x: textContainerInset.width + pad, y: textContainerInset.height), withAttributes: attributes)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
    override func keyDown(with event: NSEvent) {
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        let plain = flags.intersection([.command, .option, .control, .shift]).isEmpty
        if event.keyCode == 53 { onCancel?(); return }
        if event.keyCode == 48, plain { onTab?(); return }
        let typing = flags.intersection([.command, .option, .control]).isEmpty
        if navigates, typing {
            let typed = event.characters ?? ""
            if typed == "+" || event.keyCode == 69 { onRow?(1); return }
            if typed == "-" || event.keyCode == 27 || event.keyCode == 78 { onRow?(-1); return }
        }
        if navigates, plain {
            let bare = event.charactersIgnoringModifiers ?? ""
            if bare.count == 1, let character = bare.first {
                if character == "0" { onDigit?(9); return }
                if let value = character.wholeNumberValue, (1...9).contains(value) { onDigit?(value - 1); return }
            }
            switch event.keyCode {
            case 123: onNavigate?(-1, 0); return
            case 124: onNavigate?(1, 0); return
            case 126: onNavigate?(0, -1); return
            case 125: onNavigate?(0, 1); return
            default: break
            }
        }
        let isReturn = event.keyCode == 36 || event.keyCode == 76
        if isReturn, deferReturnToInputMethod(event) { return }
        if isReturn, flags.contains(.shift), !flags.contains(.command) {
            super.keyDown(with: event)
            return
        }
        if isReturn, !flags.contains(.option), !flags.contains(.control) {
            onSubmit?()
            return
        }
        super.keyDown(with: event)
    }
    override func insertText(_ insertString: Any, replacementRange: NSRange) {
        let composing = hasMarkedText()
        super.insertText(insertString, replacementRange: replacementRange)
        rememberReturnIfInputMethodCommitted(composing)
    }
    override func unmarkText() {
        let composing = hasMarkedText()
        super.unmarkText()
        rememberReturnIfInputMethodCommitted(composing)
    }
    /// While the input method is composing or its candidate window is open, Return confirms that session.
    private func deferReturnToInputMethod(_ event: NSEvent) -> Bool {
        if event.timestamp == returnHandledByInputMethod {
            returnHandledByInputMethod = .nan
            return true
        }
        guard hasMarkedText() || Self.inputMethodPanelVisible() else { return false }
        super.keyDown(with: event)
        returnHandledByInputMethod = .nan
        return true
    }
    private func rememberReturnIfInputMethodCommitted(_ wasComposing: Bool) {
        guard wasComposing, let event = NSApp.currentEvent, event.type == .keyDown,
              event.keyCode == 36 || event.keyCode == 76 else { return }
        returnHandledByInputMethod = event.timestamp
    }
    private static func inputMethodPanelVisible() -> Bool {
        let options = CGWindowListOption(arrayLiteral: .optionOnScreenOnly, .excludeDesktopElements)
        if let windows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] {
            for window in windows {
                let owner = window[kCGWindowOwnerName as String] as? String ?? ""
                let name = window[kCGWindowName as String] as? String ?? ""
                let pid = Self.processIdentifier(window[kCGWindowOwnerPID as String])
                let bundle = pid > 0 ? NSRunningApplication(processIdentifier: pid)?.bundleIdentifier ?? "" : ""
                guard isInputMethodOwner(owner: owner, name: name, bundle: bundle),
                      let rect = panelRect(window[kCGWindowBounds as String]),
                      isCandidatePanel(rect) else { continue }
                return true
            }
        }
        for window in NSApp.windows where window.isVisible {
            let kind = NSStringFromClass(type(of: window))
            if isInputMethodWindowClass(kind), isCandidatePanel(window.frame) { return true }
        }
        return false
    }
    private static func isInputMethodOwner(owner: String, name: String, bundle: String) -> Bool {
        let blob = "\(owner) \(name) \(bundle)".lowercased()
        let markers = ["scim", "tcim", "tyim", "kotoeri", "pinyin", "拼音", "cursoruiview", "textinputui", "inputmethod", "输入法", "sogou", "搜狗", "baidu", "百度", "wetype", "微信输入法", "squirrel", "鼠须管", "rime", "fcitx", "iflytek", "讯飞", "qingg", "清歌", "palminput", "手心"]
        return markers.contains { blob.contains($0) }
    }
    private static func isInputMethodWindowClass(_ name: String) -> Bool {
        let markers = ["Candidate", "IMK", "InputMethod", "TextSuggestion", "SCIM", "Pinyin"]
        return markers.contains { name.localizedCaseInsensitiveContains($0) }
    }
    private static func isCandidatePanel(_ rect: CGRect) -> Bool {
        rect.width >= 48 && rect.height >= 22 && rect.width <= 960 && rect.height <= 480
            && !(rect.minY < 8 && rect.height < 42 && rect.width > 500)
    }
    private static func panelRect(_ bounds: Any?) -> CGRect? {
        let dict: [String: Any]?
        if let values = bounds as? [String: Any] { dict = values }
        else if let values = bounds as? NSDictionary {
            dict = ["X": values["X"] as Any, "Y": values["Y"] as Any, "Width": values["Width"] as Any, "Height": values["Height"] as Any]
        } else { dict = nil }
        guard let x = number(dict?["X"] ?? nil), let y = number(dict?["Y"] ?? nil),
              let width = number(dict?["Width"] ?? nil), let height = number(dict?["Height"] ?? nil) else { return nil }
        return CGRect(x: x, y: y, width: width, height: height)
    }
    private static func processIdentifier(_ value: Any?) -> pid_t {
        if let number = value as? NSNumber { return number.int32Value }
        if let number = value as? Int { return pid_t(number) }
        return 0
    }
    private static func number(_ value: Any?) -> CGFloat? {
        if let number = value as? NSNumber { return CGFloat(number.doubleValue) }
        if let number = value as? Double { return CGFloat(number) }
        if let number = value as? Int { return CGFloat(number) }
        return nil
    }
    override var intrinsicContentSize: NSSize {
        guard let layout = layoutManager, let container = textContainer else { return super.intrinsicContentSize }
        layout.ensureLayout(for: container)
        let used = layout.usedRect(for: container)
        return NSSize(width: NSView.noIntrinsicMetric, height: min(160, max(22, ceil(used.height) + textContainerInset.height * 2)))
    }
    override func didChangeText() {
        super.didChangeText()
        invalidateIntrinsicContentSize()
        needsDisplay = true
    }
}

private struct ComposerGlass: ViewModifier {
    func body(content: Content) -> some View {
        content.background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}
