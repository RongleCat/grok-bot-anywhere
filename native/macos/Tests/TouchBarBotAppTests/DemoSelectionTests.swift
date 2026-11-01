import Testing
@testable import TouchBarBotApp

struct DemoSelectionTests {
    @Test func outOfRangeIndexDoesNotChangeSelection() {
        var selection = DemoSelection(count: 3)
        let negative = selection.select(-1)
        let overflow = selection.select(3)
        #expect(!negative)
        #expect(!overflow)
        #expect(selection.index == 0)
    }

    @Test func repeatedSelectionCanOpenComposerButNewSelectionCannot() {
        var selection = DemoSelection(count: 3)
        let changed = selection.select(1)
        #expect(!changed)
        #expect(selection.index == 1)
        let repeated = selection.select(1)
        #expect(repeated)
    }
}
