export interface BridgeRequest { id: string | number; method: string; params?: Record<string, unknown>; }
export type BridgeResponse = { id: string | number; ok: true; result: unknown } | { id: string | number; ok: false; error: { code: string; message: string } };
const mockBots = [
  { id: "mock-researcher", name: "研究员", provider: "mock", status: "idle", avatarSource: "bloub", accent: "blue" },
  { id: "mock-builder", name: "开发助手", provider: "mock", status: "working", avatarSource: "bloub", accent: "green" },
  { id: "mock-writer", name: "写作伙伴", provider: "mock", status: "idle", avatarSource: "bloub", accent: "purple" },
];
export const capabilities = {
  mode: "mock",
  grokBot: { accountEnumeration: false, avatarDiscovery: false, attachments: false, liveSessionProtocol: "experimental-observed-bdk-v0", liveCLIEnabled: false },
  cursorAgent: { enabled: false, localWorkspaceList: false, cloudList: false, coversIDEChats: false },
  sdkSupport: { cursorAgent: { sdkVersion: "1.0.37", localWorkspaceList: true, cloudList: true } },
};
export async function handleRequest(request: BridgeRequest): Promise<BridgeResponse> {
  const ok = (result: unknown): BridgeResponse => ({ id: request.id, ok: true, result });
  const error = (code: string, message: string): BridgeResponse => ({ id: request.id, ok: false, error: { code, message } });
  switch (request.method) {
    case "capabilities": return ok(capabilities);
    case "bots.list": return ok({ source: "mock", accountEnumeration: false, bots: mockBots });
    case "bots.send": {
      const params = request.params ?? {};
      if (Array.isArray(params.attachments) && params.attachments.length > 0) return error("ATTACHMENTS_NOT_IMPLEMENTED", "附件尚未上传；请保留在本地草稿中。");
      const bot = mockBots.find(bot => bot.id === params.botId);
      if (!bot) return error("BOT_NOT_FOUND", "请选择已配置的 Bot。");
      if (typeof params.text !== "string" || !params.text.trim()) return error("INVALID_TEXT", "消息不能为空。");
      return ok({ source: "mock", delivered: false, botId: bot.id, text: "本地演示已收到。真实账号尚未接入。", status: "finished" });
    }
    default: return error("METHOD_NOT_FOUND", `Unsupported method: ${request.method}`);
  }
}
