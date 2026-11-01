// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TouchBarBot",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "TouchBarBot", targets: ["TouchBarBotApp"]), .executable(name: "GrokBotShare", targets: ["GrokBotShare"]), .executable(name: "GrokBotMenuHost", targets: ["GrokBotMenuHost"])],
    targets: [
        .executableTarget(name: "TouchBarBotApp", resources: [.copy("Resources/Avatar"), .copy("Resources/GrokHost")]),
        .executableTarget(name: "GrokBotMenuHost", swiftSettings: [.swiftLanguageMode(.v5)]),
        .executableTarget(name: "GrokBotShare", swiftSettings: [.swiftLanguageMode(.v5), .unsafeFlags(["-application-extension"])], linkerSettings: [.unsafeFlags(["-Xlinker", "-e", "-Xlinker", "_NSExtensionMain", "-Xlinker", "-application_extension"])]),
        .testTarget(name: "TouchBarBotAppTests", dependencies: ["TouchBarBotApp"])
    ]
)
