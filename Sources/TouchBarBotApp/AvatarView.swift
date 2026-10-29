import AppKit
import SwiftUI
import Combine

extension Color {
    init(hex: String) {
        let clean = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let value = UInt64(clean, radix: 16) ?? 0x4788C8
        self.init(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255)
    }
}

struct BotSilhouette: Shape {
    let kind: String
    func path(in rect: CGRect) -> Path {
        let frame = rect.insetBy(dx: rect.width * 0.06, dy: rect.height * 0.06)
        switch kind {
        case "squircle", "square", "cube": return Path(roundedRect: frame, cornerRadius: frame.width * 0.28)
        case "tablet", "capsule": return Path(roundedRect: frame.insetBy(dx: 0, dy: frame.height * 0.11), cornerRadius: frame.height * 0.32)
        case "wedge", "triangle", "hex", "diamond", "pentagon", "star":
            let n = kind == "hex" ? 6 : kind == "diamond" ? 4 : kind == "pentagon" ? 5 : kind == "star" ? 10 : 3
            return Path { path in
                for i in 0..<n {
                    let angle = Double(i) * 2 * .pi / Double(n) - .pi / 2
                    let radius = kind == "star" && i % 2 == 1 ? 0.29 : 0.48
                    let point = CGPoint(x: rect.midX + cos(angle) * rect.width * radius, y: rect.midY + sin(angle) * rect.height * radius)
                    if i == 0 { path.move(to: point) } else { path.addLine(to: point) }
                }
                path.closeSubpath()
            }
        default:
            return Path { path in
                let count = 96
                var points: [CGPoint] = []
                for i in 0..<count {
                    let a = Double(i) * 2 * .pi / Double(count)
                    let r: Double
                    switch kind {
                    case "cloud": r = 0.42 + 0.045 * cos(5 * a) + 0.02 * sin(3 * a)
                    case "pebble": r = 0.43 + 0.025 * cos(2 * a + 0.5) + 0.015 * cos(3 * a + 2.1)
                    case "teardrop": r = 0.40 * (1 - 0.20 * sin(a))
                    case "flower", "clover": r = 0.40 + 0.065 * cos((kind == "clover" ? 4 : 6) * a)
                    default: r = 0.43 + 0.012 * cos(3 * a)
                    }
                    points.append(CGPoint(x: rect.midX + cos(a) * rect.width * r, y: rect.midY + sin(a) * rect.height * r))
                }
                if let first = points.first { path.move(to: first) }
                for point in points.dropFirst() { path.addLine(to: point) }; path.closeSubpath()
            }
        }
    }
}

struct CharacterFace: View {
    let bot: Bot
    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size.width
            BotSilhouette(kind: bot.avatarShape)
                .fill(LinearGradient(colors: [Color(hex: bot.avatar.character.lightHex), Color(hex: bot.avatar.character.baseHex), Color(hex: bot.avatar.character.darkHex)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay {
                    HStack(spacing: size * 0.13) {
                        Capsule().frame(width: size * 0.085, height: size * 0.20)
                        Capsule().frame(width: size * 0.085, height: size * 0.20)
                    }.foregroundStyle(.white.opacity(0.95)).offset(y: size * 0.015)
                }
        }
    }
}

struct BotAvatarView: View {
    let bot: Bot
    var size: CGFloat = 40
    var main: Bool = false
    @ObservedObject private var pictures = AvatarPictures.shared
    @ObservedObject private var raster = GrokAvatarRaster.shared
    var body: some View {
        avatar
            .frame(width: size, height: size)
            .mainBotBadge(main, size: size)
            .accessibilityLabel(main ? "\(bot.name)的头像，主 Bot" : "\(bot.name)的头像")
            .task(id: bot) {
                await pictures.load(bot)
                if bot.avatar.kind != "picture" { raster.request(shape: bot.avatarShape, hex: bot.avatar.character.baseHex) }
            }
    }
    @ViewBuilder private var avatar: some View {
        if let image = pictures.images[bot.id] {
            Image(nsImage: image).resizable().scaledToFill().clipShape(RoundedRectangle(cornerRadius: size * 0.30))
        } else if let still = raster.still(shape: bot.avatarShape, hex: bot.avatar.character.baseHex) {
            Image(nsImage: still).resizable().scaledToFit()
        } else {
            CharacterFace(bot: bot).padding(size * 0.12)
        }
    }
}

/// Official roster badge: a circular bite is cut from the avatar's bottom-right,
/// then a #f59312 disc with a white star sits in that bite. The disc is 16/60 of
/// the avatar and the bite is 2.7pt larger on the 60pt reference.
enum MainBotMark {
    static let reference: CGFloat = 60
    static let discRatio: CGFloat = 16 / 60
    static let gapRatio: CGFloat = 2.7 / 60
    static let discColor = NSColor(srgbRed: 245 / 255, green: 147 / 255, blue: 18 / 255, alpha: 1)
    static let hairline = NSColor(srgbRed: 28 / 255, green: 28 / 255, blue: 28 / 255, alpha: 15 / 255)

    static func discSide(_ avatar: CGFloat) -> CGFloat { avatar * discRatio }
    static func gap(_ avatar: CGFloat) -> CGFloat { avatar * gapRatio }

    static func fuse(_ image: NSImage) -> NSImage {
        let size = image.size
        guard size.width > 2, size.height > 2 else { return image }
        let side = min(size.width, size.height)
        let disc = side * discRatio
        let gap = side * gapRatio
        let radius = disc / 2 + gap
        let center = NSPoint(x: size.width - disc / 2, y: disc / 2)
        let marked = NSImage(size: size)
        marked.lockFocus()
        image.draw(in: NSRect(origin: .zero, size: size), from: NSRect(origin: .zero, size: size), operation: .copy, fraction: 1)
        if let context = NSGraphicsContext.current {
            context.compositingOperation = .destinationOut
            NSBezierPath(ovalIn: NSRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)).fill()
            context.compositingOperation = .sourceOver
        }
        let discRect = NSRect(x: size.width - disc, y: 0, width: disc, height: disc)
        discColor.setFill()
        NSBezierPath(ovalIn: discRect).fill()
        hairline.setStroke()
        let ring = NSBezierPath(ovalIn: discRect.insetBy(dx: 0.25, dy: 0.25))
        ring.lineWidth = max(0.5, disc * 0.5 / 16)
        ring.stroke()
        NSColor.white.setFill()
        starPath(in: discRect.insetBy(dx: disc * 0.24, dy: disc * 0.24), upward: true).fill()
        marked.unlockFocus()
        marked.isTemplate = false
        return marked
    }

    static func starPath(in rect: NSRect, upward: Bool) -> NSBezierPath {
        let path = NSBezierPath()
        let outer = min(rect.width, rect.height) / 2
        let inner = outer * 0.40
        let cx = rect.midX
        let cy = rect.midY
        for index in 0..<10 {
            let radius = index % 2 == 0 ? outer : inner
            let angle = -CGFloat.pi / 2 + CGFloat(index) * .pi / 5
            let dy = sin(angle) * radius
            let point = NSPoint(x: cx + cos(angle) * radius, y: cy + (upward ? -dy : dy))
            if index == 0 { path.move(to: point) } else { path.line(to: point) }
        }
        path.close()
        return path
    }
}

private struct MainBotDisc: View {
    var body: some View {
        GeometryReader { proxy in
            let side = min(proxy.size.width, proxy.size.height)
            let disc = CGRect(x: 0, y: 0, width: side, height: side)
            ZStack {
                Circle().fill(Color(nsColor: MainBotMark.discColor))
                Circle().strokeBorder(Color(nsColor: MainBotMark.hairline), lineWidth: max(0.5, side * 0.5 / 16))
                MainBotStarShape().fill(Color.white).padding(side * 0.24)
            }
            .frame(width: disc.width, height: disc.height)
        }
    }
}

private struct MainBotNotch: Shape {
    var disc: CGFloat
    var gap: CGFloat
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.addRect(rect)
        let radius = disc / 2 + gap
        let center = CGPoint(x: rect.maxX - disc / 2, y: rect.maxY - disc / 2)
        path.addEllipse(in: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
        return path
    }
}

private struct MainBotStarShape: Shape {
    func path(in rect: CGRect) -> Path {
        let bezier = MainBotMark.starPath(in: NSRect(x: rect.minX, y: rect.minY, width: rect.width, height: rect.height), upward: false)
        return Path(bezier.cgPath)
    }
}

extension View {
    func mainBotBadge(_ enabled: Bool, size: CGFloat) -> some View {
        modifier(MainBotBadgeModifier(enabled: enabled, size: size))
    }
}

private struct MainBotBadgeModifier: ViewModifier {
    var enabled: Bool
    var size: CGFloat
    func body(content: Content) -> some View {
        if enabled {
            let disc = MainBotMark.discSide(size)
            let gap = MainBotMark.gap(size)
            content
                .mask {
                    MainBotNotch(disc: disc, gap: gap).fill(style: FillStyle(eoFill: true))
                }
                .overlay(alignment: .bottomTrailing) {
                    MainBotDisc().frame(width: disc, height: disc).accessibilityLabel("主 Bot")
                }
        } else {
            content
        }
    }
}

@MainActor
final class AvatarPictures: ObservableObject {
    static let shared = AvatarPictures()
    @Published private(set) var images: [String: NSImage] = [:]
    private var addresses: [String: String] = [:]
    private var loading: Set<String> = []
    private var requested: [String: String] = [:]
    func load(_ bot: Bot) async {
        guard bot.avatar.kind == "picture", let address = bot.avatar.picture?.url else {
            if images[bot.id] != nil { images.removeValue(forKey: bot.id) }
            addresses.removeValue(forKey: bot.id); requested.removeValue(forKey: bot.id); return
        }
        let key = bot.id + "|" + address
        guard addresses[bot.id] != address, !loading.contains(key) else { return }
        requested[bot.id] = address
        loading.insert(key); defer { loading.remove(key) }
        let data: Data
        if address.hasPrefix("data:image/"), let range = address.range(of: ";base64,"), address.utf8.count <= 6 * 1024 * 1024, let decoded = Data(base64Encoded: String(address[range.upperBound...])) { data = decoded }
        else if let url = URL(string: address), url.scheme == "https" {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.httpShouldSetCookies = false
            let session = URLSession(configuration: configuration)
            defer { session.finishTasksAndInvalidate() }
            var request = URLRequest(url: url); request.timeoutInterval = 15
            guard let (bytes, response) = try? await session.data(for: request), (response as? HTTPURLResponse)?.statusCode == 200, bytes.count <= 4 * 1024 * 1024 else { return }
            data = bytes
        } else { return }
        guard requested[bot.id] == address, let image = NSImage(data: data) else { return }
        addresses[bot.id] = address; images[bot.id] = image
    }
}

@MainActor
enum AvatarImages {
    private static var cache: [Bot: NSImage] = [:]
    static func image(_ bot: Bot) -> NSImage {
        if let picture = AvatarPictures.shared.images[bot.id] { return picture }
        if bot.avatar.kind != "picture", let still = GrokAvatarRaster.shared.still(shape: bot.avatarShape, hex: bot.avatar.character.baseHex) { return still }
        if let cached = cache[bot] { return cached }
        GrokAvatarRaster.shared.request(shape: bot.avatarShape, hex: bot.avatar.character.baseHex)
        let renderer = ImageRenderer(content: CharacterFace(bot: bot).padding(6).frame(width: 64, height: 64))
        renderer.scale = 2
        let image = renderer.nsImage ?? NSImage(size: NSSize(width: 64, height: 64))
        image.isTemplate = false
        if cache.count > 250 { cache.removeAll() }
        cache[bot] = image
        return image
    }
}
