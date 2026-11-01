import AppKit
import Combine

struct ReplyItem: Identifiable { var id: String; var text: String }

@MainActor
final class AppStore: ObservableObject {
    @Published private(set) var workspace = BotWorkspace()
    @Published var isConnected = false
    @Published var isLoading = false
    @Published var status = "连接账号，让你的 Bots 触手可及。"
    @Published var issue: String?
    @Published var streamStatus = ""
    @Published var replies: [String: [ReplyItem]] = [:]
    @Published var sendingBotID: String?
    @Published var uncertainSends: [String: String] = [:]
    @Published var search = ""
    @Published var hotkeyAvailable = true
    @Published var composerVisible = false
    @Published private(set) var pinTouchBar: Bool
    @Published private(set) var keepComposerAfterSend: Bool
    @Published private(set) var dismissComposerOnOutsideClick: Bool
    @Published private(set) var mainAgentID: String?
    @Published private(set) var runningIDs: Set<String> = []
    @Published var dictationArmed = false
    @Published private(set) var readyBotID: String?
    let bridge = SDKBridge()
    let speech = SpeechService()
    @Published private(set) var preview: Bool
    var onSelection: (() -> Void)?
    var openComposer: (() -> Void)?
    var onPinChanged: ((Bool) -> Void)?
    var onHideComposer: (() -> Void)?
    private var watchRevision = UUID()
    private var savedCursors: [String: String] = [:]
    private var presencePoll: Task<Void, Never>?
    private var companionAccountID: String?

    var bots: [Bot] { workspace.bots }
    var selectedBot: Bot? { workspace.selectedBot }
    var draftText: String { get { workspace.draft.text } set { workspace.updateDraft(text: newValue) } }
    var attachments: [StagedAttachment] { workspace.draft.attachments }
    var selectedReplies: [ReplyItem] { selectedBot.flatMap { replies[$0.id] } ?? [] }
    var filteredBots: [Bot] { search.isEmpty ? bots : bots.filter { $0.name.localizedCaseInsensitiveContains(search) } }
    var canSend: Bool { (isConnected || preview) && !isLoading && selectedBot != nil && sendingBotID == nil && selectedBot.flatMap { uncertainSends[$0.id] } == nil && (!draftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !attachments.isEmpty) && !(preview && !attachments.isEmpty) }
    var animationState: String {
        if speech.isRecording { return "listening" }
        if sendingBotID != nil && sendingBotID == selectedBot?.id { return "streaming" }
        if let id = selectedBot?.id, runningIDs.contains(id) { return "working" }
        return "idle"
    }
    func isExecuting(_ id: String) -> Bool { runningIDs.contains(id) || sendingBotID == id }

    func applyCompanionSnapshot(_ value: CompanionSnapshot) {
        if companionAccountID != value.account?.id {
            workspace = BotWorkspace()
            replies = [:]
            speech.stop()
            onHideComposer?()
            companionAccountID = value.account?.id
        }
        workspace.replaceBots(value.bots)
        isConnected = value.connected
        mainAgentID = value.runtime.mainAgentId
        runningIDs = value.runningIDs
        uncertainSends = value.heldSends
        status = value.connected ? "已连接 Grok Bot Anywhere" : "请在 Grok Bot Anywhere 登录"
        onSelection?()
    }
    func loadCompanionDraft(botID: String, text: String, files: [URL]) throws {
        guard bots.contains(where: { $0.id == botID }) else { throw BridgeFailure.code("BOT_NOT_FOUND") }
        var staged = workspace
        staged.select(botID)
        guard staged.draft.text.isEmpty, staged.draft.attachments.isEmpty else { throw BridgeFailure.code("DRAFT_BUSY") }
        let attachments = try files.map { url -> StagedAttachment in
            let values = try url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
            guard values.isRegularFile == true, let bytes = values.fileSize, bytes > 0 else { throw BridgeFailure.code("ATTACHMENT_INVALID") }
            return StagedAttachment(url: url, bytes: Int64(bytes))
        }
        staged.updateDraft(text: text, attachments: attachments)
        workspace = staged
        speech.stop()
        onSelection?()
    }
    private func persistSendHolds() {
        if !NativeCompanion.enabled { UserDefaults.standard.set(uncertainSends, forKey: "pendingSends") }
    }

    init(preview: Bool = false) {
        self.preview = preview
        pinTouchBar = UserDefaults.standard.bool(forKey: "pinTouchBar")
        if UserDefaults.standard.object(forKey: "keepComposerAfterSend") == nil { keepComposerAfterSend = true }
        else { keepComposerAfterSend = UserDefaults.standard.bool(forKey: "keepComposerAfterSend") }
        if UserDefaults.standard.object(forKey: "dismissComposerOnOutsideClick") == nil { dismissComposerOnOutsideClick = true }
        else { dismissComposerOnOutsideClick = UserDefaults.standard.bool(forKey: "dismissComposerOnOutsideClick") }
        if !preview && !NativeCompanion.enabled { uncertainSends = UserDefaults.standard.dictionary(forKey: "pendingSends") as? [String: String] ?? [:] }
        bridge.onEvent = { [weak self] name, data in self?.handleEvent(name, data) }
        bridge.onExit = { [weak self] in
            guard let self else { return }
            self.isConnected = false
            self.readyBotID = nil
            self.streamStatus = "连接已关闭，草稿已保留。"
        }
        if preview { showPreview() }
    }
    func showPreview() {
        guard !isConnected, !isLoading else { return }
        preview = true
        workspace.replaceBots([
                .fixture("preview-cloud", name: "研究伙伴", shape: "cloud", color: "brown", hex: "#936439"),
                .fixture("preview-code", name: "代码助手", shape: "squircle", color: "blue", hex: "#4788C8"),
                .fixture("preview-design", name: "灵感收集员", shape: "pebble", color: "violet", hex: "#916DBB"),
                .fixture("preview-writing", name: "写作搭档", shape: "tablet", color: "green", hex: "#5B966F")
            ])
        status = "界面预览 · 示例数据"
        onSelection?()
        GrokAvatarRaster.shared.prefetch(bots)
    }
    func leavePreview() { preview = false; workspace = BotWorkspace(); status = "连接账号，让你的 Bots 触手可及。"; onSelection?() }

    func restore() async {
        guard !preview, let data = CredentialStore.load(), let credentials = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        isLoading = true
        defer { isLoading = false }
        do { _ = try await bridge.call("connect", credentials); try await refreshThrowing() }
        catch { show(error) }
    }
    func login(desktop: Bool = false) async {
        guard !preview, !isLoading, sendingBotID == nil else { return }
        isLoading = true; issue = nil; isConnected = false; speech.stop()
        status = desktop ? "正在连接本机账号…" : "请在浏览器完成登录…"
        defer { isLoading = false }
        do {
            let result = try await bridge.call(desktop ? "desktop" : "login", timeout: 600)
            guard let response = try JSONSerialization.jsonObject(with: result) as? [String: Any], let credentials = response["credentials"] as? [String: Any] else { throw BridgeFailure.code("LOGIN_RESPONSE_INVALID") }
            try CredentialStore.save(JSONSerialization.data(withJSONObject: credentials))
            workspace = BotWorkspace(); replies = [:]; savedCursors = [:]; readyBotID = nil
            try await refreshThrowing()
        } catch { show(error) }
    }
    func refresh() async { guard !preview, !isLoading else { return }; isLoading = true; defer { isLoading = false }; do { try await refreshThrowing() } catch { show(error) } }
    private func refreshThrowing() async throws {
        let result = try await bridge.call("list")
        struct Roster: Decodable { let bots: [Bot]; let truncated: Bool }
        let roster = try JSONDecoder().decode(Roster.self, from: result)
        workspace.replaceBots(roster.bots); isConnected = true; issue = nil
        status = roster.truncated ? "\(bots.count) 个 Bots · 名单可能未完整返回" : "\(bots.count) 个 Bots 已同步"
        onSelection?()
        GrokAvatarRaster.shared.prefetch(bots)
        await refreshPresence()
        startPresencePoll()
    }
    func setKeepComposerAfterSend(_ keep: Bool) {
        keepComposerAfterSend = keep
        UserDefaults.standard.set(keep, forKey: "keepComposerAfterSend")
    }
    func setDismissComposerOnOutsideClick(_ dismiss: Bool) {
        dismissComposerOnOutsideClick = dismiss
        UserDefaults.standard.set(dismiss, forKey: "dismissComposerOnOutsideClick")
    }
    private func startPresencePoll() {
        guard presencePoll == nil else { return }
        presencePoll = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(4))
                guard !Task.isCancelled else { return }
                await self?.refreshPresence()
            }
        }
    }
    private func refreshPresence() async {
        guard isConnected, !preview, !bots.isEmpty else { return }
        if let data = try? await bridge.call("runtime"),
           let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            let id = value["mainAgentId"] as? String
            mainAgentID = id?.isEmpty == false ? id : nil
        }
        if let data = try? await bridge.call("statuses", ["agentIds": bots.map(\.id)]),
           let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let rows = value["statuses"] as? [[String: Any]] {
            runningIDs = Set(rows.compactMap { row in
                guard row["isRunning"] as? Bool == true, let id = row["agentId"] as? String else { return nil }
                return id
            })
        }
    }
    func setPinnedTouchBar(_ pinned: Bool) {
        let changed = pinTouchBar != pinned
        pinTouchBar = pinned
        UserDefaults.standard.set(pinned, forKey: "pinTouchBar")
        if changed || pinned { onPinChanged?(pinned) }
    }
    func select(_ bot: Bot, openOnRepeat: Bool = false, subscribe: Bool = true) {
        let repeated = workspace.select(bot.id)
        if !repeated { speech.stop(); onSelection?() }
        if repeated && openOnRepeat { openComposer?() }
    }
    func subscribe() async {
        guard isConnected, let bot = selectedBot else { return }
        let revision = UUID(); watchRevision = revision
        readyBotID = nil
        streamStatus = "连接回复流…"
        var parameters: [String: Any] = ["botId": bot.id, "sessionId": bot.sessionId, "subscriptionId": revision.uuidString]
        if let cursor = savedCursors[bot.id + "|" + bot.sessionId] { parameters["resumeFrom"] = cursor }
        do { _ = try await bridge.call("watch", parameters) }
        catch { if watchRevision == revision { streamStatus = "回复流连接失败，可重新连接。" } }
    }
    func logout() async {
        guard sendingBotID == nil, !isLoading else { issue = "账号操作或发送尚未结束，请稍候。"; return }
        speech.stop()
        dictationArmed = false
        presencePoll?.cancel()
        presencePoll = nil
        mainAgentID = nil
        runningIDs = []
        do { _ = try await bridge.call("logout") }
        catch { show(error); return }
        CredentialStore.delete()
        workspace = BotWorkspace(); replies = [:]; savedCursors = [:]; readyBotID = nil; isConnected = false; status = "已退出账号"; streamStatus = ""; issue = nil; onSelection?()
    }
    func send() async {
        guard canSend, let snapshot = try? workspace.prepareSend() else { return }
        speech.stop(); sendingBotID = snapshot.bot.id; issue = nil
        uncertainSends[snapshot.bot.id] = snapshot.messageID
        persistSendHolds()
        defer { sendingBotID = nil }
        do {
            _ = try await bridge.call("send", ["botId": snapshot.bot.id, "sessionId": snapshot.bot.sessionId, "text": snapshot.draft.text, "messageId": snapshot.messageID, "files": snapshot.draft.attachments.map { $0.url.path }], timeout: 300)
            workspace.commitSent(snapshot)
            uncertainSends.removeValue(forKey: snapshot.bot.id)
            persistSendHolds()
            status = "已发送给 \(snapshot.bot.name)"
            if !keepComposerAfterSend { onHideComposer?() }
        } catch {
            let code = error.localizedDescription
            if code == "SEND_UNCONFIRMED" || code == "BRIDGE_EXITED" || code == "BRIDGE_WRITE_FAILED" {
                uncertainSends[snapshot.bot.id] = snapshot.messageID
                issue = "投递结果未确认，已保留草稿并暂停此 Bot 的发送。请先在官方客户端核对，避免重复投递。"
            } else {
                uncertainSends.removeValue(forKey: snapshot.bot.id)
                persistSendHolds()
                show(error)
            }
        }
    }
    func addFiles(_ urls: [URL]) {
        guard selectedBot != nil else { return }
        var current = attachments
        for url in urls {
            guard !current.contains(where: { $0.url == url }) else { continue }
            guard current.count < (NativeCompanion.enabled ? 100 : 6) else { issue = "附件数量已达上限。"; break }
            guard let values = try? url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]), values.isRegularFile == true, let bytes = values.fileSize, bytes > 0, NativeCompanion.enabled || bytes <= 4 * 1024 * 1024 else { issue = "请选择可用的非空普通文件。"; continue }
            current.append(.init(url: url, bytes: Int64(bytes)))
        }
        workspace.updateDraft(attachments: current)
    }
    func removeFile(_ id: String) { workspace.updateDraft(attachments: attachments.filter { $0.id != id }) }
    func clearSendHold() async {
        guard let bot = selectedBot, sendingBotID == nil else { return }
        do {
            let result = try await bridge.call("status")
            let state = try JSONSerialization.jsonObject(with: result) as? [String: Any]
            if state?["sending"] as? Bool == true { issue = "原发送仍在后台处理中，请结束后再核对。"; return }
            if NativeCompanion.enabled { _ = try await bridge.call("resolve", ["botId": bot.id]) }
        } catch { show(error); return }
        uncertainSends.removeValue(forKey: bot.id)
        persistSendHolds()
        issue = nil
    }
    func chooseFiles() {
        let panel = NSOpenPanel(); panel.allowsMultipleSelection = true; panel.canChooseDirectories = false
        if panel.runModal() == .OK { addFiles(panel.urls) }
    }
    func toggleRecording() {
        guard !speech.isRecording else { dictationArmed = false; speech.stop(); return }
        guard !preview, isConnected else { issue = "连接账号后才能使用语音。"; return }
        startDictation(sendOnKey: false)
    }
    func beginDictationSend() {
        guard selectedBot != nil else { return }
        guard !preview, isConnected else { issue = "连接账号后才能语音发送。"; return }
        guard sendingBotID == nil, selectedBot.flatMap({ uncertainSends[$0.id] }) == nil else { issue = "上一条消息还没完成，暂不能语音发送。"; return }
        if speech.isRecording { dictationArmed = true; return }
        startDictation(sendOnKey: true)
    }
    func finishDictationAndSend() {
        guard dictationArmed, speech.isRecording else { dictationArmed = false; return }
        dictationArmed = false
        speech.stop()
        Task { await send() }
    }
    private func startDictation(sendOnKey: Bool) {
        dictationArmed = sendOnKey
        let botID = selectedBot?.id, original = draftText
        speech.start { [weak self] text in
            guard let self, self.selectedBot?.id == botID else { return }
            self.draftText = original + (original.isEmpty ? "" : "\n") + text
        } onFailure: { [weak self] in
            self?.dictationArmed = false
        }
    }
    private func handleEvent(_ name: String, _ data: Data) {
        guard let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        if name == "login.url", let text = value["url"] as? String, let url = URL(string: text), url.scheme == "https", url.host == "cursor.com" { NSWorkspace.shared.open(url); return }
        guard let botID = value["botId"] as? String, let currentBot = bots.first(where: { $0.id == botID }) else { return }
        if name != "upload.progress", (value["sessionId"] as? String ?? "") != currentBot.sessionId { return }
        if name != "upload.progress", value["subscriptionId"] as? String != watchRevision.uuidString { return }
        if name == "stream.error" || name == "stream.closed" {
            if selectedBot?.id == botID { readyBotID = nil; streamStatus = "回复流已断开，点击重新连接。" }; return
        }
        if name == "upload.progress" { status = "正在上传附件…"; return }
        guard let event = value["event"] as? [String: Any], let type = event["type"] as? String, let body = event["data"] as? [String: Any] else { return }
        if let cursor = event["id"] as? String { savedCursors[botID + "|" + currentBot.sessionId] = cursor }
        switch type {
        case "connected": if selectedBot?.id == botID { readyBotID = botID; streamStatus = "等待 Bot 的新回复" }
        case "message":
            guard let text = body["text"] as? String, let id = body["entryId"] as? String else { return }
            var items = replies[botID] ?? []
            if let index = items.firstIndex(where: { $0.id == id }) { items[index].text = text }
            else { items.append(.init(id: id, text: text)) }
            replies[botID] = Array(items.suffix(20))
            if selectedBot?.id == botID { streamStatus = "收到 Bot 回复" }
        case "message.deleted":
            if let id = body["entryId"] as? String { replies[botID]?.removeAll { $0.id == id } }
        case "reset": replies[botID] = []
        case "entry.unavailable": if selectedBot?.id == botID { streamStatus = "有一条较大内容未内联，请在官方客户端查看。" }
        case "resync-required": savedCursors.removeValue(forKey: botID + "|" + currentBot.sessionId); if selectedBot?.id == botID { readyBotID = nil; streamStatus = "历史游标已过期，请重新连接回复流。" }
        case "turn.failed": if selectedBot?.id == botID { streamStatus = "Bot 回合失败，请在官方客户端查看。" }
        default: break
        }
    }
    private func show(_ error: any Error) {
        switch error.localizedDescription {
        case "ACCOUNT_AUTH_FAILED", "RPC_FAILED", "NOT_CONNECTED": issue = "账号连接不可用，请重新登录。"
        case "KEYCHAIN_ACCESS_UNAVAILABLE": issue = "未获准访问本机登录，请使用浏览器登录。"
        case "KEYCHAIN_SAVE_FAILED": issue = "无法将登录保存到系统钥匙串。"
        case "SEND_IN_PROGRESS": issue = "后台仍在处理发送，请完成后再切换或退出账号。"
        case "ATTACHMENT_INPUT_INVALID": issue = "附件不可读取或超出限制，草稿已保留。"
        default: issue = "操作未完成（\(error.localizedDescription)），草稿已保留。"
        }
    }
}
