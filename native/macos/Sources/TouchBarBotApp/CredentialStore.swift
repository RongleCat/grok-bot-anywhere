import Foundation
import Security

enum CredentialStore {
    private static var query: [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "dev.local.TouchBarBot.account", kSecAttrAccount as String: "active"] }
    static func load() -> Data? {
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        return SecItemCopyMatching(request as CFDictionary, &value) == errSecSuccess ? value as? Data : nil
    }
    static func save(_ data: Data) throws {
        let attributes: [String: Any] = [kSecValueData as String: data]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var value = query
            value[kSecValueData as String] = data
            value[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            guard SecItemAdd(value as CFDictionary, nil) == errSecSuccess else { throw BridgeFailure.code("KEYCHAIN_SAVE_FAILED") }
        } else if status != errSecSuccess { throw BridgeFailure.code("KEYCHAIN_SAVE_FAILED") }
    }
    static func delete() { SecItemDelete(query as CFDictionary) }
}
