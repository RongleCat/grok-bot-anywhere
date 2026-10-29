import Foundation

struct BotAvatar: Codable, Hashable, Sendable {
    struct Character: Codable, Hashable, Sendable {
        var shape: String
        var color: String
        var baseHex: String
        var lightHex: String
        var darkHex: String
    }
    struct Picture: Codable, Hashable, Sendable { var url: String?; var version: String? }
    var kind: String
    var character: Character
    var picture: Picture?
}

struct Bot: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var name: String
    var description: String
    var avatarShape: String
    var avatarColor: String
    var avatar: BotAvatar
    var sessionId: String
    var viewerIsOwner: Bool
    var viewerCanManage: Bool

    static func fixture(_ id: String, name: String? = nil, shape: String = "blob", color: String = "blue", hex: String = "#4788C8") -> Bot {
        Bot(id: id, name: name ?? id, description: "", avatarShape: shape, avatarColor: color,
            avatar: .init(kind: "character", character: .init(shape: shape, color: color, baseHex: hex, lightHex: hex, darkHex: hex), picture: nil),
            sessionId: "", viewerIsOwner: true, viewerCanManage: true)
    }
}

struct StagedAttachment: Identifiable, Equatable, Sendable {
    var id: String { url.path }
    let url: URL
    let bytes: Int64
    var name: String { url.lastPathComponent }
}

struct BotDraft: Equatable, Sendable {
    var text = ""
    var attachments: [StagedAttachment] = []
    var revision = UUID()
}
struct SendSnapshot: Sendable {
    let bot: Bot
    let draft: BotDraft
    let messageID: String
}
enum WorkspaceError: Error { case noBot, emptyDraft }

struct BotWorkspace {
    private(set) var bots: [Bot] = []
    private(set) var selectedID: String?
    private var drafts: [String: BotDraft] = [:]
    var selectedBot: Bot? { bots.first { $0.id == selectedID } }
    var draft: BotDraft { selectedID.flatMap { drafts[$0] } ?? BotDraft() }

    mutating func replaceBots(_ updated: [Bot]) {
        var seen: Set<String> = []
        bots = updated.filter { seen.insert($0.id).inserted }
        if !bots.contains(where: { $0.id == selectedID }) { selectedID = bots.first?.id }
    }
    @discardableResult mutating func select(_ id: String) -> Bool {
        guard bots.contains(where: { $0.id == id }) else { return false }
        let repeated = selectedID == id
        selectedID = id
        return repeated
    }
    mutating func updateDraft(text: String? = nil, attachments: [StagedAttachment]? = nil) {
        guard let selectedID else { return }
        var value = draft
        if let text { value.text = text }
        if let attachments { value.attachments = attachments }
        value.revision = UUID()
        drafts[selectedID] = value
    }
    func prepareSend() throws -> SendSnapshot {
        guard let bot = selectedBot else { throw WorkspaceError.noBot }
        guard !draft.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !draft.attachments.isEmpty else { throw WorkspaceError.emptyDraft }
        return SendSnapshot(bot: bot, draft: draft, messageID: UUID().uuidString.lowercased())
    }
    mutating func commitSent(_ snapshot: SendSnapshot) {
        if drafts[snapshot.bot.id]?.revision == snapshot.draft.revision { drafts[snapshot.bot.id] = BotDraft() }
    }
}
