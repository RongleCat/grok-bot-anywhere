struct DemoSelection {
    let count: Int
    private(set) var index = 0

    mutating func select(_ candidate: Int) -> Bool {
        guard (0..<count).contains(candidate) else { return false }
        let repeated = candidate == index
        index = candidate
        return repeated
    }
}
