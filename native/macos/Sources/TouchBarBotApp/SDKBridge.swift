import Foundation

enum BridgeFailure: LocalizedError {
    case code(String)
    var errorDescription: String? {
        switch self { case .code(let code): return code }
    }
}

@MainActor
final class SDKBridge {
    private var process: Process?
    private var input: FileHandle?
    private var reader: Task<Void, Never>?
    private var pending: [String: CheckedContinuation<Data, any Error>] = [:]
    private var timeouts: [String: Task<Void, Never>] = [:]
    var onEvent: ((String, Data) -> Void)?
    var onExit: (() -> Void)?
    var externalCall: (@MainActor (String, [String: Any]) async throws -> Data)?

    private func start() throws {
        if process?.isRunning == true { return }
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let resources = Bundle.main.resourceURL
        let script = resources?.appendingPathComponent("client-protocol/app-bridge.mjs")
        let packaged = script.map { FileManager.default.fileExists(atPath: $0.path) } ?? false
        let node: URL
        if packaged, let resources { node = resources.appendingPathComponent("runtime/node") }
        else {
            let candidates = [ProcessInfo.processInfo.environment["TOUCH_BAR_BOT_NODE"], "/opt/homebrew/bin/node", "/usr/local/bin/node"]
                .compactMap { $0 }
            if let found = candidates.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) { node = URL(fileURLWithPath: found) }
            else {
                let versions = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".nvm/versions/node")
                let dirs = (try? FileManager.default.contentsOfDirectory(at: versions, includingPropertiesForKeys: nil)) ?? []
                guard let found = dirs.sorted(by: { $0.lastPathComponent > $1.lastPathComponent }).map({ $0.appendingPathComponent("bin/node") }).first(where: { FileManager.default.isExecutableFile(atPath: $0.path) }) else { throw BridgeFailure.code("NODE_UNAVAILABLE") }
                node = found
            }
        }
        let child = Process(), stdinPipe = Pipe(), stdoutPipe = Pipe()
        child.executableURL = node
        child.arguments = [(packaged ? script! : root.appendingPathComponent("packages/client-protocol/app-bridge.mjs")).path]
        child.standardInput = stdinPipe
        child.standardOutput = stdoutPipe
        child.standardError = FileHandle.nullDevice
        child.terminationHandler = { [weak self] _ in Task { @MainActor in self?.didExit() } }
        try child.run()
        process = child
        input = stdinPipe.fileHandleForWriting
        reader = Task { [weak self] in
            do {
                for try await line in stdoutPipe.fileHandleForReading.bytes.lines {
                    if Task.isCancelled { break }
                    self?.handle(Data(line.utf8))
                }
            } catch { }
        }
    }

    func call(_ method: String, _ params: [String: Any] = [:], timeout: UInt64 = 40) async throws -> Data {
        if let externalCall { return try await externalCall(method, params) }
        try start()
        let id = UUID().uuidString
        let data = try JSONSerialization.data(withJSONObject: ["id": id, "method": method, "params": params]) + Data([10])
        return try await withCheckedThrowingContinuation { continuation in
            pending[id] = continuation
            timeouts[id] = Task { [weak self] in
                try? await Task.sleep(for: .seconds(timeout))
                guard !Task.isCancelled else { return }
                self?.finish(id, result: .failure(BridgeFailure.code(method == "send" ? "SEND_UNCONFIRMED" : "REQUEST_TIMEOUT")))
            }
            do { try input?.write(contentsOf: data) }
            catch { finish(id, result: .failure(BridgeFailure.code("BRIDGE_WRITE_FAILED"))) }
        }
    }

    private func handle(_ data: Data) {
        guard let envelope = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        if let event = envelope["event"] as? String {
            if let value = envelope["data"], let payload = try? JSONSerialization.data(withJSONObject: value) { onEvent?(event, payload) }
            return
        }
        guard let id = envelope["id"] as? String else { return }
        if let error = envelope["error"] as? [String: Any] { finish(id, result: .failure(BridgeFailure.code(error["code"] as? String ?? "BRIDGE_REQUEST_FAILED"))) }
        else if let value = envelope["result"], let payload = try? JSONSerialization.data(withJSONObject: value) { finish(id, result: .success(payload)) }
    }
    private func finish(_ id: String, result: Result<Data, any Error>) {
        timeouts.removeValue(forKey: id)?.cancel()
        pending.removeValue(forKey: id)?.resume(with: result)
    }
    private func didExit() {
        process = nil; input = nil
        for id in Array(pending.keys) { finish(id, result: .failure(BridgeFailure.code("BRIDGE_EXITED"))) }
        onExit?()
    }
    func stop() {
        reader?.cancel(); reader = nil
        process?.terminationHandler = nil
        try? input?.close()
        if process?.isRunning == true { process?.terminate() }
        didExit()
    }
}
