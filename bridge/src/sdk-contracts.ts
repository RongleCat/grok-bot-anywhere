import type { Agent, ListAgentsOptions, SDKUserMessage, SDKMessage } from "@cursor/sdk";
import type { CursorGrokBotAgentsOptions } from "@cursor/bdk/extensions/cursor-grokbot-agents";

// Compile-time probes only. No runtime SDK import and no account calls.
export const cloudListShape = { runtime: "cloud", includeArchived: true } satisfies ListAgentsOptions;
export const localListShape = { runtime: "local", cwd: "." } satisfies ListAgentsOptions;
export const codingAgentImageShape = { text: "Inspect this image", images: [{ data: "", mimeType: "image/png" }] } satisfies SDKUserMessage;
export const grokBotExtensionShape = { agents: [{ name: "Confirmed name" }], needsApproval: true } satisfies CursorGrokBotAgentsOptions;
export type AgentResume = typeof Agent.resume;
export type CodingAgentStreamEvent = SDKMessage;
