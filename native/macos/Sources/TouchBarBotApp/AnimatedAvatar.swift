import SwiftUI
import WebKit

struct AnimatedAvatar: View {
    let bot: Bot
    let state: String
    let visible: Bool
    let reducedMotion: Bool
    var size: CGFloat = 84
    var main: Bool = false
    @ObservedObject private var engine = GrokAvatarEngine.shared
    var body: some View {
        Group {
            if bot.avatar.kind == "picture" {
                BotAvatarView(bot: bot, size: size, main: main)
            } else if engine.root != nil {
                GrokAvatarWebView(bot: bot, state: state, visible: visible, reducedMotion: reducedMotion, main: main)
            } else if engine.failed {
                AvatarWebView(bot: bot, state: state, visible: visible, reducedMotion: reducedMotion)
                    .mainBotBadge(main, size: size)
            } else {
                BotAvatarView(bot: bot, size: size, main: main)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

struct GrokAvatarWebView: NSViewRepresentable {
    let bot: Bot
    let state: String
    let visible: Bool
    let reducedMotion: Bool
    var main: Bool = false
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        if let root = GrokAvatarEngine.shared.root {
            config.setURLSchemeHandler(GrokAvatarScheme(root: root), forURLScheme: GrokAvatarScheme.scheme)
        }
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.setValue(false, forKey: "drawsBackground")
        web.underPageBackgroundColor = .clear
        web.wantsLayer = true
        web.layer?.backgroundColor = NSColor.clear.cgColor
        web.layer?.masksToBounds = true
        context.coordinator.load(web)
        return web
    }
    func updateNSView(_ web: WKWebView, context: Context) {
        context.coordinator.config = ["shape": bot.avatarShape, "color": bot.avatar.character.baseHex, "state": state, "visible": visible, "reducedMotion": reducedMotion, "seed": bot.id, "main": main]
        context.coordinator.load(web)
        context.coordinator.push(web)
    }
    static func dismantleNSView(_ web: WKWebView, coordinator: Coordinator) {
        web.evaluateJavaScript("window.setAvatar && window.setAvatar({visible:false,reducedMotion:true})")
        web.stopLoading()
    }
    @MainActor final class Coordinator: NSObject, WKNavigationDelegate {
        var ready = false
        var config: [String: Any] = [:]
        func load(_ web: WKWebView) {
            guard GrokAvatarEngine.shared.root != nil, web.url != GrokAvatarScheme.page else { return }
            ready = false
            web.load(URLRequest(url: GrokAvatarScheme.page))
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { ready = true; push(webView) }
        func push(_ web: WKWebView) {
            guard ready else { return }
            web.callAsyncJavaScript("const started = Date.now(); while (!window.setAvatar) { if (Date.now() - started > 4000) return; await new Promise(r => setTimeout(r, 40)); } window.setAvatar(config);", arguments: ["config": config], in: nil, in: .page) { _ in }
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
            navigationAction.request.url?.scheme == GrokAvatarScheme.scheme ? .allow : .cancel
        }
    }
}

private struct AvatarWebView: NSViewRepresentable {
    let bot: Bot
    let state: String
    let visible: Bool
    let reducedMotion: Bool
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.setValue(false, forKey: "drawsBackground")
        web.underPageBackgroundColor = .clear
        let packaged = Bundle.main.resourceURL?.appendingPathComponent("TouchBarBot_TouchBarBotApp.bundle")
        let resources = packaged.flatMap { Bundle(url: $0) } ?? Bundle.module
        if let root = resources.url(forResource: "Avatar", withExtension: nil) {
            web.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo: root)
        }
        return web
    }
    func updateNSView(_ web: WKWebView, context: Context) {
        context.coordinator.config = ["shape": bot.avatarShape, "color": bot.avatar.character.baseHex, "state": state, "visible": visible, "reducedMotion": reducedMotion]
        context.coordinator.update(web)
    }
    static func dismantleNSView(_ web: WKWebView, coordinator: Coordinator) {
        web.evaluateJavaScript("window.setAvatar && window.setAvatar({visible:false})")
        web.stopLoading()
    }
    @MainActor final class Coordinator: NSObject, WKNavigationDelegate {
        var ready = false
        var config: [String: Any] = [:]
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { ready = true; update(webView) }
        func update(_ web: WKWebView) {
            guard ready else { return }
            web.callAsyncJavaScript("window.setAvatar(config)", arguments: ["config": config], in: nil, in: .page) { _ in }
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy { navigationAction.request.url?.isFileURL == true ? .allow : .cancel }
    }
}
