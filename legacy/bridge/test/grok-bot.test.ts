import assert from "node:assert/strict";
import test from "node:test";
import { GrokBotClient } from "../src/grok-bot.js";

test("Grok Bot client refuses all traffic without explicit live enablement", async () => {
  let calls = 0;
  const client = new GrokBotClient({ enabled: false, apiKey: "test-only", confirmedSessionIds: ["session-123"], fetch: async () => { calls++; return new Response("{}"); } });
  await assert.rejects(client.sendText("session-123", "Hello"), /LIVE_DISABLED/);
  assert.equal(calls, 0);
});

test("Grok Bot client refuses unknown session ids before making a request", async () => {
  let calls = 0;
  const client = new GrokBotClient({ enabled: true, apiKey: "test-only", confirmedSessionIds: [], fetch: async () => { calls++; return new Response("{}"); } });
  await assert.rejects(client.sendText("new-name", "Hello"), /SESSION_NOT_CONFIRMED/);
  assert.equal(calls, 0);
});

test("Grok Bot text send matches observed public BDK wire contract", async () => {
  let observedUrl = "";
  let observedBody: Record<string, unknown> = {};
  const client = new GrokBotClient({ enabled: true, apiKey: "test-only", confirmedSessionIds: ["session-123"], fetch: async (url, options) => {
    observedUrl = String(url);
    observedBody = JSON.parse(String(options?.body));
    assert.equal(new Headers(options?.headers).get("authorization"), "Bearer test-only");
    return Response.json({ messageId: observedBody.messageId, delivery: "accepted_temporal" });
  } });
  await client.sendText("session-123", "Hello");
  assert.equal(observedUrl, "https://api.cursor.com/v0/grokbot/sessions/session-123/messages");
  assert.equal(observedBody.text, "Hello");
  assert.match(String(observedBody.messageId), /^[0-9a-f-]{36}$/);
  assert.deepEqual(Object.keys(observedBody).sort(), ["messageId", "text"]);
});

test("Grok Bot client rejects unsupported delivery acknowledgements", async () => {
  const client = new GrokBotClient({ enabled: true, apiKey: "test-only", confirmedSessionIds: ["session-123"], fetch: async () => Response.json({ messageId: "m", delivery: "unknown" }) });
  await assert.rejects(client.sendText("session-123", "Hello"), /DELIVERY_NOT_ACCEPTED/);
});
