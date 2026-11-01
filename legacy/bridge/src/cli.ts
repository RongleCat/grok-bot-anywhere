import { createInterface } from "node:readline";
import { handleRequest, type BridgeRequest } from "./protocol.js";

// stdin/stdout only. No login, credential lookup, SDK initialization or network.
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  if (!line.trim()) continue;
  try {
    const request: unknown = JSON.parse(line);
    if (!request || typeof request !== "object" || !("id" in request) || !("method" in request) || (typeof request.id !== "string" && typeof request.id !== "number") || typeof request.method !== "string") throw new Error("Expected id and method.");
    process.stdout.write(JSON.stringify(await handleRequest(request as BridgeRequest)) + "\n");
  } catch {
    process.stdout.write(JSON.stringify({ id: null, ok: false, error: { code: "INVALID_REQUEST", message: "Expected one JSON request per line." } }) + "\n");
  }
}
