export interface GrokBotOptions {
  enabled: boolean;
  apiKey: string;
  confirmedSessionIds: readonly string[];
  fetch?: typeof fetch;
}
export class GrokBotClient {
  constructor(private readonly options: GrokBotOptions) {}
  /** Uses only a previously confirmed id; never calls get-or-create by name. */
  async sendText(sessionId: string, text: string): Promise<void> {
    if (!this.options.enabled) throw new Error("LIVE_DISABLED: Explicitly enable account traffic first.");
    if (!this.options.confirmedSessionIds.includes(sessionId)) throw new Error("SESSION_NOT_CONFIRMED: Refusing an unknown session id.");
    if (!this.options.apiKey.trim()) throw new Error("API_KEY_REQUIRED");
    if (!text.trim()) throw new Error("INVALID_TEXT");
    const response = await (this.options.fetch ?? fetch)(`https://api.cursor.com/v0/grokbot/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.options.apiKey}`, "content-type": "application/json", "x-cursor-client-type": "agent-serve", "x-request-id": randomUUID() },
      body: JSON.stringify({ text, messageId: randomUUID() }),
      signal: AbortSignal.timeout(60_000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`GROK_BOT_HTTP_ERROR: HTTP ${response.status}`);
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("delivery" in result) || (result.delivery !== "accepted_temporal" && result.delivery !== "duplicate")) throw new Error("DELIVERY_NOT_ACCEPTED");
  }
}
import { randomUUID } from "node:crypto";
