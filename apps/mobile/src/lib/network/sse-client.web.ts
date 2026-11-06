import { streamChat, type ChatRequestBody, type StreamCallbacks } from "./sse-transport";

export function streamChatPlatform(body: ChatRequestBody, signal: AbortSignal, callbacks: StreamCallbacks): Promise<void> {
  return streamChat(globalThis.fetch.bind(globalThis), body, signal, callbacks);
}
