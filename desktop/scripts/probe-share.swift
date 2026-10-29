import AppKit
import Foundation

let path = FileManager.default.temporaryDirectory.appendingPathComponent("grok-share-probe.zip")
try Data([0x50, 0x4b, 0x05, 0x06] + Array(repeating: UInt8(0), count: 18)).write(to: path)
defer { try? FileManager.default.removeItem(at: path) }
let services = NSSharingService.sharingServices(forItems: [path])
var matched = false
for service in services {
    print(service.title)
    if let index = CommandLine.arguments.firstIndex(of: "--match"), CommandLine.arguments.count > index + 1, service.title.contains(CommandLine.arguments[index + 1]),
       let data = service.image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: data), let png = bitmap.representation(using: .png, properties: [:]) {
        var output = "/tmp/gba-system-share-icon.png"
        if let outputIndex = CommandLine.arguments.firstIndex(of: "--output"), CommandLine.arguments.count > outputIndex + 1 { output = CommandLine.arguments[outputIndex + 1] }
        try png.write(to: URL(fileURLWithPath: output))
        matched = true
    }
}
if CommandLine.arguments.contains("--match") && !matched { throw NSError(domain: "ShareProbe", code: 1, userInfo: [NSLocalizedDescriptionKey: "SHARE_SERVICE_NOT_FOUND"]) }
if let index = CommandLine.arguments.firstIndex(of: "--bundle"), CommandLine.arguments.count > index + 1 {
    let image = NSWorkspace.shared.icon(forFile: CommandLine.arguments[index + 1])
    if let data = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: data), let png = bitmap.representation(using: .png, properties: [:]) {
        try png.write(to: URL(fileURLWithPath: "/tmp/gba-workspace-icon.png"))
    }
}
