import AppKit
import Combine
@preconcurrency import AVFoundation
@preconcurrency import Speech

@MainActor
final class SpeechService: ObservableObject {
    @Published private(set) var isRecording = false
    @Published private(set) var level: Float = 0
    @Published var issue: String?
    private var engine: AVAudioEngine?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var revision = UUID()

    private var tapInstalled = false

    func start(onText: @escaping @MainActor (String) -> Void, onFailure: (@MainActor () -> Void)? = nil) {
        guard !isRecording else { return }
        issue = nil
        guard Bundle.main.object(forInfoDictionaryKey: "NSSpeechRecognitionUsageDescription") != nil,
              Bundle.main.object(forInfoDictionaryKey: "NSMicrophoneUsageDescription") != nil else {
            issue = "请从 Touch Bar Bot.app 打开后再使用语音。当前进程没有麦克风和语音识别权限说明。"
            onFailure?()
            return
        }
        let token = UUID(); revision = token
        let fail: @MainActor () -> Void = { [weak self] in
            guard let self, self.revision == token else { return }
            onFailure?()
        }
        Task {
            let microphone = await AVCaptureDevice.requestAccess(for: .audio)
            guard revision == token else { return }
            guard microphone else { issue = "请在系统设置中允许麦克风访问。"; fail(); return }
            let authorized = await Self.speechAuthorized()
            guard revision == token else { return }
            guard authorized else { issue = "请在系统设置中允许语音识别。"; fail(); return }
            guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh-CN")), recognizer.isAvailable, recognizer.supportsOnDeviceRecognition else {
                issue = "设备端中文语音识别当前不可用，请先在系统中启用听写并下载语言。"
                fail(); return
            }
            let audio = AVAudioEngine()
            let recognition = SFSpeechAudioBufferRecognitionRequest()
            recognition.requiresOnDeviceRecognition = true
            recognition.shouldReportPartialResults = true
            let input = audio.inputNode
            let format = input.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else { issue = "没有可用的录音设备。"; fail(); return }
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
                recognition.append(buffer)
                guard let samples = buffer.floatChannelData?[0] else { return }
                let count = Int(buffer.frameLength)
                var sum: Float = 0
                for index in 0..<count { sum += samples[index] * samples[index] }
                let amplitude = min(1, sqrt(sum / Float(max(count, 1))) * 8)
                Task { @MainActor in if self?.revision == token { self?.level = amplitude } }
            }
            tapInstalled = true
            do {
                audio.prepare(); try audio.start()
                engine = audio; request = recognition; isRecording = true
                task = recognizer.recognitionTask(with: recognition) { [weak self] result, error in
                    let text = result?.bestTranscription.formattedString
                    let finished = result?.isFinal == true
                    let failed = error != nil
                    Task { @MainActor in
                        guard let self, self.revision == token else { return }
                        if let text, !text.isEmpty { onText(text) }
                        if finished || failed {
                            self.stop()
                            if failed { self.issue = "语音识别已停止，已识别的文字保留在草稿中。" }
                            if failed { onFailure?() }
                        }
                    }
                }
            } catch {
                removeInstalledTap(from: input)
                audio.stop()
                issue = "无法启动录音，请检查麦克风。"
                fail()
            }
        }
    }
    func stop() {
        revision = UUID()
        if tapInstalled, let engine {
            engine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
            engine.stop()
        } else {
            engine?.stop()
        }
        request?.endAudio(); task?.cancel()
        engine = nil; request = nil; task = nil
        isRecording = false; level = 0
    }
    /// The authorization handler runs on a TCC queue. Resuming a main-actor
    /// continuation from that queue traps, so this request stays nonisolated.
    private nonisolated static func speechAuthorized() async -> Bool {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status == .authorized)
            }
        }
    }

    private func removeInstalledTap(from node: AVAudioNode) {
        guard tapInstalled else { return }
        node.removeTap(onBus: 0)
        tapInstalled = false
    }
}
