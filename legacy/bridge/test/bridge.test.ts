import assert from "node:assert/strict";
import test from "node:test";
import { handleRequest } from "../src/protocol.js";

test("default list returns only explicitly labeled mock bots", async () => {
  const response = await handleRequest({ id: "list", method: "bots.list" });
  assert.equal(response.ok, true);
  if (!response.ok) return;
  const result = response.result as { source: string; accountEnumeration: boolean; bots: { provider: string }[] };
  assert.equal(result.source, "mock");
  assert.equal(result.accountEnumeration, false);
  assert.ok(result.bots.length > 1);
  assert.ok(result.bots.every(bot => bot.provider === "mock"));
});

test("mock send rejects attachments rather than pretending to upload", async () => {
  const response = await handleRequest({ id: "send", method: "bots.send", params: { botId: "mock-researcher", text: "Inspect", attachments: ["/tmp/report.pdf"] } });
  assert.equal(response.ok, false);
  if (response.ok) return;
  assert.equal(response.error.code, "ATTACHMENTS_NOT_IMPLEMENTED");
});

test("unsupported method gives a structured error preserving request id", async () => {
  const response = await handleRequest({ id: 4, method: "bots.delete" });
  assert.equal(response.id, 4);
  assert.equal(response.ok, false);
  if (response.ok) return;
  assert.equal(response.error.code, "METHOD_NOT_FOUND");
});

test("mock send resolves an existing bot and never invents one", async () => {
  const result = await handleRequest({ id: 5, method: "bots.send", params: { botId: "does-not-exist", text: "Hello" } });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "BOT_NOT_FOUND");
});
