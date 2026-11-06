import { streamChat, type ChatRequestBody, type StreamCallbacks } from "./sse-transport";

// TypeScript fallback. Metro selects sse-client.native.ts or sse-client.web.ts
// for the matching platform at runtime.
export function streamChatPlatform(body: ChatRequestBody, signal: AbortSignal, callbacks: StreamCallbacks): Promise<void> {
  return streamChat(globalThis.fetch.bind(globalThis), body, signal, callbacks);
}
