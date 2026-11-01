import Testing
@testable import TouchBarBotApp

@Test func companionSnapshotProjectsHeldSendsAndRunningBots() throws {
    let bot = Bot.fixture("bot-one", name: "Research")
    let snapshot = CompanionSnapshot(connected: true, bots: [bot],
        runtime: .init(mainAgentId: "bot-one", statuses: [.init(agentId: "bot-one", isRunning: true)]),
        inbox: [.init(botId: "bot-one", status: "unconfirmed", messageId: "message-one")])
    #expect(snapshot.bots.first?.name == "Research")
    #expect(snapshot.heldSends["bot-one"] == "message-one")
    #expect(snapshot.runningIDs.contains("bot-one"))
}

@Test @MainActor func companionDraftDoesNotOverwriteExistingBotDraft() throws {
    let store = AppStore(preview: true)
    let bot = store.bots[0]
    store.draftText = "unsent work"
    #expect(throws: (any Error).self) {
        try store.loadCompanionDraft(botID: bot.id, text: "incoming context", files: [])
    }
    #expect(store.draftText == "unsent work")
}

@Test @MainActor func changingCompanionAccountClearsDraftForSharedBot() {
    let store = AppStore(preview: true)
    let bots = store.bots
    store.applyCompanionSnapshot(.init(connected: true, bots: bots, runtime: .init(mainAgentId: nil, statuses: []), inbox: [], account: .init(id: "a")))
    store.draftText = "Account A private draft"
    store.applyCompanionSnapshot(.init(connected: true, bots: bots, runtime: .init(mainAgentId: nil, statuses: []), inbox: [], account: .init(id: "b")))
    #expect(store.draftText.isEmpty)
}
