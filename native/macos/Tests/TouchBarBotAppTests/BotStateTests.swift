import Testing
@testable import TouchBarBotApp

struct BotStateTests {
    @Test func refreshPreservesStableSelectionAndDraft() {
        var state = BotWorkspace()
        state.replaceBots([.fixture("a"), .fixture("b")])
        state.select("b")
        state.updateDraft(text: "B 的草稿")
        state.replaceBots([.fixture("b"), .fixture("a")])
        #expect(state.selectedID == "b")
        #expect(state.draft.text == "B 的草稿")
        state.select("a")
        #expect(state.draft.text.isEmpty)
    }

    @Test func sendSnapshotFreezesRecipientAndProtectsEditedDraft() throws {
        var state = BotWorkspace()
        state.replaceBots([.fixture("a"), .fixture("b")])
        state.updateDraft(text: "first")
        let snapshot = try state.prepareSend()
        state.updateDraft(text: "edited")
        state.select("b")
        state.commitSent(snapshot)
        #expect(snapshot.bot.id == "a")
        state.select("a")
        #expect(state.draft.text == "edited")
    }

    @Test func emptySendRejectedAndDeletedSelectionFallsBack() {
        var state = BotWorkspace()
        state.replaceBots([.fixture("a"), .fixture("b")])
        #expect(throws: (any Error).self) { try state.prepareSend() }
        state.select("b")
        state.replaceBots([.fixture("a")])
        #expect(state.selectedID == "a")
        state.replaceBots([])
        #expect(state.selectedID == nil)
    }
}
