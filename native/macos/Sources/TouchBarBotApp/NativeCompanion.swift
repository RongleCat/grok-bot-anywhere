import AppKit
import Foundation

struct CompanionSnapshot: Decodable {
    struct Account: Decodable { let id: String }
    struct Runtime: Decodable {
        struct Status: Decodable { let agentId: String; let isRunning: Bool }
        let mainAgentId: String?
        let statuses: [Status]
    }
    struct Receipt: Decodable { let botId: String; let status: String; let messageId: String; var holdResolved: Bool? = nil }
    let connected: Bool
    let bots: [Bot]
    let runtime: Runtime
    let inbox: [Receipt]
    var account: Account? = nil
    var heldSends: [String: String] {
        var result: [String: String] = [:]
        for item in inbox where item.status == "unconfirmed" && item.holdResolved != true { result[item.botId] = item.messageId }
        return result
    }
    var runningIDs: Set<String> { Set(runtime.statuses.filter(\.isRunning).map(\.agentId)) }
}

/// Private, inherited stdio only. No listening port and no credentials.
@MainActor
final class NativeCompanion {
    static let enabled = CommandLine.arguments.contains("--companion")
    private let store: AppStore
    private var pending: [String: CheckedContinuation<Data, any Error>] = [:]
    private var reader: Task<Void, Never>?
    private var receiptIDs: [String: String] = [:]
    private var accountID: String?
    var openComposer: (() -> Void)?

    init(store: AppStore) {
        self.store = store
        store.bridge.externalCall = { [weak self] method, params in
            guard let self else { throw BridgeFailure.code("HOST_EXITED") }
            var values = params
            if method == "send", let botId = values["botId"] as? String {
                values["receiptId"] = self.receiptIDs[botId]
            }
            let result = try await self.request(method, values)
            if method == "send", let botId = values["botId"] as? String { self.receiptIDs.removeValue(forKey: botId) }
            return result
        }
    }
    func start() {
        reader = Task { [weak self] in
            do {
                for try await line in FileHandle.standardInput.bytes.lines {
                    guard !Task.isCancelled else { return }
                    self?.receive(Data(line.utf8))
                }
            } catch { }
            self?.stop()
            NSApplication.shared.terminate(nil)
        }
        emit(["event": "hello", "data": ["version": 1, "platform": "darwin", "capabilities": ["composer", "touchbar", "speech"]]])
    }
    func event(_ name: String) { emit(["event": name, "data": [:]]) }
    func askParentToCompose(_ botId: String) async -> Bool {
        do {
            _ = try await request("compose", ["botId": botId])
            return true
        } catch {
            return false
        }
    }
    private func emit(_ value: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: value) else { return }
        try? FileHandle.standardOutput.write(contentsOf: data + Data([10]))
    }
    private func request(_ method: String, _ params: [String: Any]) async throws -> Data {
        let id = UUID().uuidString
        return try await withCheckedThrowingContinuation { continuation in
            pending[id] = continuation
            emit(["id": id, "method": method, "params": params])
        }
    }
    private func receive(_ data: Data) {
        guard let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let id = value["id"] as? String else { return }
        if let continuation = pending.removeValue(forKey: id) {
            if let error = value["error"] as? [String: Any], let code = error["code"] as? String { continuation.resume(throwing: BridgeFailure.code(code)) }
            else if let result = value["result"], let resultData = try? JSONSerialization.data(withJSONObject: result) { continuation.resume(returning: resultData) }
            else { continuation.resume(throwing: BridgeFailure.code("INVALID_RESPONSE")) }
            return
        }
        do {
            let params = value["params"] as? [String: Any] ?? [:]
            switch value["method"] as? String {
            case "state":
                let payload = try JSONSerialization.data(withJSONObject: params)
                let snapshot = try JSONDecoder().decode(CompanionSnapshot.self, from: payload)
                if accountID != snapshot.account?.id { receiptIDs.removeAll(); accountID = snapshot.account?.id }
                store.applyCompanionSnapshot(snapshot)
            case "composer.open":
                guard params["accountId"] as? String == accountID else { throw BridgeFailure.code("RECEIPT_SCOPE_MISMATCH") }
                guard let botId = params["botId"] as? String, store.bots.contains(where: { $0.id == botId }) else { throw BridgeFailure.code("BOT_NOT_FOUND") }
                if let receipt = params["receipt"] as? [String: Any] {
                    let receiptId = receipt["id"] as? String
                    if receiptIDs[botId] != receiptId {
                        let files = (receipt["files"] as? [[String: Any]] ?? []).compactMap { row -> URL? in
                            guard let path = row["path"] as? String else { return nil }; return URL(fileURLWithPath: path)
                        }
                        try store.loadCompanionDraft(botID: botId, text: receipt["text"] as? String ?? "", files: files)
                        receiptIDs[botId] = receiptId
                    } else if let bot = store.bots.first(where: { $0.id == botId }) { store.select(bot) }
                } else if let bot = store.bots.first(where: { $0.id == botId }) { store.select(bot) }
                openComposer?()
            case "composer.hide": store.onHideComposer?()
            case "touchbar.pin": store.setPinnedTouchBar(params["pinned"] as? Bool ?? false)
            case "shutdown": NSApplication.shared.terminate(nil)
            default: throw BridgeFailure.code("METHOD_UNKNOWN")
            }
            emit(["id": id, "result": [:]])
        } catch { emit(["id": id, "error": ["code": error.localizedDescription]]) }
    }
    func stop() {
        reader?.cancel(); reader = nil
        for continuation in pending.values { continuation.resume(throwing: BridgeFailure.code("HOST_EXITED")) }
        pending.removeAll()
    }
}
